import {Socket, Channel, Presence} from 'phoenix';
import {record} from 'rrweb';
import * as request from 'superagent';
import {eventWithTime} from 'rrweb/typings/types';
import {win, document} from './utils/helpers';
import {fetch} from './utils/http';
import * as storage from './utils/storage';
import {getUserInfo} from './utils/info';
import {isWindowHidden, addVisibilityEventListener} from './utils/visibility';
import Logger from './utils/logger';

declare global {
  interface Window {
    Storytime: any;
  }
}

const DEFAULT_BASE_URL = 'https://app.papercups.io';

const REPLAY_EVENT_EMITTED = 'replay:event:emitted';
const ACTIVE_EVENT_EMITTED = 'session:active';
const INACTIVE_EVENT_EMITTED = 'session:inactive';

const SESSION_CACHE_KEY = 'papercups:storytime:session';
const CUSTOMER_CACHE_KEY = '__PAPERCUPS____CUSTOMER_ID__';

export type CustomerMetadata = {
  name?: string;
  email?: string;
  external_id?: string;
  metadata?: {[key: string]: any};
  // TODO: include browser info
};

const EMPTY_METADATA: CustomerMetadata = {};

export const getWebsocketUrl = (baseUrl = DEFAULT_BASE_URL) => {
  // TODO: handle this parsing better
  const [protocol, host] = baseUrl.split('://');
  const isHttps = protocol === 'https';

  // TODO: not sure how websockets work with subdomains
  return `${isHttps ? 'wss' : 'ws'}://${host}/socket`;
};

export const createNewCustomer = async (
  accountId: string,
  metadata: CustomerMetadata = EMPTY_METADATA,
  baseUrl = DEFAULT_BASE_URL
) => {
  return request
    .post(`${baseUrl}/api/customers`)
    .send({
      customer: {
        ...metadata,
        account_id: accountId,
        // TODO: deprecate?
        first_seen: new Date(),
        last_seen: new Date(),
      },
    })
    .then((res) => res.body.data);
};

export const updateCustomerMetadata = async (
  customerId: string,
  metadata: CustomerMetadata = EMPTY_METADATA,
  baseUrl = DEFAULT_BASE_URL
) => {
  return request
    .put(`${baseUrl}/api/customers/${customerId}/metadata`)
    .send({
      metadata,
    })
    .then((res) => res.body.data);
};

// TODO: figure out the best way to use this
export const findCustomerByExternalId = async (
  externalId: string,
  accountId: string,
  baseUrl = DEFAULT_BASE_URL
) => {
  return request
    .get(`${baseUrl}/api/customers/identify`)
    .query({external_id: externalId, account_id: accountId})
    .then((res) => res.body.data);
};

type Config = {
  accountId: string;
  customerId?: string;
  blocklist?: Array<string>;
  baseUrl?: string;
  customer?: CustomerMetadata;
  debug?: boolean;
  // Currently unused
  publicKey?: string;
};

// TODO: experiment with making this NOT a class
// (so there's a better guarantee that there's always only one instance running?)
class Storytime {
  accountId: string;
  customer: CustomerMetadata;
  customerId: string | null;
  publicKey?: string;
  blocklist: Array<string>;
  baseUrl: string;
  logger: Logger;
  version: string;

  socket: Socket;
  channel!: Channel;
  sessionId: string | null;
  stop?: () => void;
  unsubscribe?: () => void;

  constructor(config: Config) {
    this.accountId = config.accountId;
    this.customer = config.customer || {};
    this.sessionId = storage.session.get(SESSION_CACHE_KEY);
    this.customerId = storage.local.parse(CUSTOMER_CACHE_KEY); // config.customerId;
    this.publicKey = config.publicKey;
    this.blocklist = config.blocklist || [];
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.logger = new Logger(!!config.debug);
    this.version = '1.0.5';

    this.socket = new Socket(getWebsocketUrl(this.baseUrl));
  }

  static init(config: Config): Storytime {
    win.Storytime = win.Storytime || {};

    // TODO: test if this is actually necessary
    if (win.Storytime.initialized) {
      console.warn('Storytime has already been initialized!');
      console.warn('This may result in some unexpected issues.');
    }

    const instance = new Storytime(config);
    win.Storytime = instance;
    instance.listen();

    return instance;
  }

  async listen(): Promise<Storytime> {
    try {
      if (!this.socket.isConnected()) {
        this.socket.connect();
      }

      this.socket.onError((err: any) => {
        // TODO: attempt to reconnect?
        this.logger.error(err);
      });

      this.customerId = await this.findOrCreateCustomerId();
      this.cacheCustomerId(this.customerId);

      this.sessionId = await this.getSessionId(this.accountId, this.customerId);
      this.channel = this.socket.channel(this.getChannelName(this.sessionId), {
        customerId: this.customerId,
      });

      this.channel
        .join()
        .receive(
          'ok',
          () => this.sessionId && this.onConnectionSuccess(this.sessionId)
        )
        .receive('error', (err) => this.onConnectionError(err));

      this.unsubscribe = addVisibilityEventListener(
        document,
        this.handleVisibilityChange
      );
    } catch (err) {
      this.logger.error('[Storytime] Error on `listen`:', err);
    }

    return this;
  }

  finish(): void {
    if (this.sessionId) {
      this.logger.debug('[Storytime] Marking session over...');
      this.finishBrowserSession(this.sessionId);
    }

    if (this.stop) {
      this.logger.debug('[Storytime] Stopping...');
      this.stop();
    }

    if (this.unsubscribe) {
      this.logger.debug('[Storytime] Unsubscribing visibility handler...');
      this.unsubscribe();
    }

    if (this.socket && this.socket.disconnect) {
      this.logger.debug('[Storytime] Disconnecting socket...');
      this.socket.disconnect();
    }

    if (this.channel && this.channel.leave) {
      this.logger.debug('[Storytime] Leaving channel...');
      this.channel.leave();
    }

    win.Storytime = {}; // Reset?
  }

  handleVisibilityChange = (e?: any) => {
    const doc = document || (e && e.target);

    if (!this.channel) {
      return;
    }

    if (isWindowHidden(doc)) {
      this.channel.push(INACTIVE_EVENT_EMITTED, {ts: +new Date()});
    } else {
      this.channel.push(ACTIVE_EVENT_EMITTED, {ts: +new Date()});
    }
  };

  cacheCustomerId = (customerId: string) => {
    win.dispatchEvent(
      new CustomEvent('storytime:customer:set', {detail: customerId})
    );
    storage.local.set(CUSTOMER_CACHE_KEY, JSON.stringify(customerId));
  };

  formatCustomerMetadata = (metadata: any) => {
    if (!metadata) {
      return {};
    }

    return Object.keys(metadata).reduce((acc, key) => {
      if (key === 'metadata') {
        return {...acc, [key]: metadata[key]};
      } else {
        // Make sure all other passed-in values are strings
        return {...acc, [key]: String(metadata[key])};
      }
    }, {});
  };

  findOrCreateCustomerId = async (): Promise<string> => {
    const existingId = await this.checkForExistingCustomerId();

    if (existingId) {
      this.logger.debug('Found existing customer id!', existingId);
      return existingId;
    }

    const {accountId, baseUrl, customer} = this;
    const metadata = this.formatCustomerMetadata({
      ...getUserInfo(),
      ...customer,
    });
    const {id: customerId} = await createNewCustomer(
      accountId,
      metadata,
      baseUrl
    );
    this.logger.debug('Created new customer id!', customerId);
    return customerId;
  };

  checkForExistingCustomerId = async (): Promise<string | null> => {
    const cachedId = storage.local.parse(CUSTOMER_CACHE_KEY);
    const {accountId, baseUrl, customer: metadata} = this;

    if (!metadata || !metadata?.external_id) {
      this.logger.debug(
        'No external_id specified - returning cachedId:',
        cachedId
      );
      return cachedId;
    }

    const {external_id: externalId} = metadata;
    const {customer_id: matchingCustomerId} = await findCustomerByExternalId(
      externalId,
      accountId,
      baseUrl
    );

    if (!matchingCustomerId) {
      this.logger.debug('No matching id found, returning null');
      return null;
    } else if (matchingCustomerId === cachedId) {
      this.logger.debug('Matching id matches cachedId!', {
        matchingCustomerId,
        cachedId,
      });
      return cachedId;
    }

    this.logger.debug('Matching id found!', matchingCustomerId);
    return matchingCustomerId;
  };

  createBrowserSession = async (accountId: string, customerId: string) => {
    const metadata = getUserInfo();

    // TODO: don't use superagent!
    return request
      .post(`${this.baseUrl}/api/browser_sessions`)
      .send({
        browser_session: {
          account_id: accountId,
          customer_id: customerId,
          started_at: new Date(),
          metadata,
        },
      })
      .then((res) => res.body.data);
  };

  isValidSessionId = async (sessionId?: string | null) => {
    if (!sessionId || !sessionId.length) {
      return false;
    }

    // TODO: don't use superagent!
    return request
      .get(`${this.baseUrl}/api/browser_sessions/${sessionId}/exists`)
      .then((res) => res.body.data);
  };

  setBrowserSessionCustomer = async (sessionId: string, customerId: string) => {
    return request
      .post(`${this.baseUrl}/api/browser_sessions/${sessionId}/identify`)
      .send({customer_id: customerId})
      .then((res) => res.body.data);
  };

  restartBrowserSession = (sessionId: string) => {
    // TODO: just handle this on the server if the session received new
    // events after being marked "finished" (i.e. `finished_at` is set)
    fetch(
      `${this.baseUrl}/api/browser_sessions/${sessionId}/restart`,
      {},
      {transport: 'sendbeacon'}
    );
  };

  finishBrowserSession = (sessionId: string): void => {
    // TODO: include metadata at finish?
    fetch(
      `${this.baseUrl}/api/browser_sessions/${sessionId}/finish`,
      {},
      {transport: 'sendbeacon'}
    );
  };

  captureReplayEvent(event: eventWithTime) {
    // TODO: allow capturing event through other means?
    this.channel.push(REPLAY_EVENT_EMITTED, {
      event,
      customer_id: this.customerId,
    });
  }

  startRecordingSession() {
    this.logger.debug('Start recording!', this);
    // TODO: before we start recording, should we emit some kind of event
    // indicating how long it's been since the last replay event? (i.e. so
    // we can have some sense of how long it's been since the user was active)

    this.stop = record({
      emit: (event) => {
        const pathName = win.location.pathname;

        // TODO: just emit everything until bug is fixed?
        if (this.shouldEmitEvent(pathName)) {
          this.captureReplayEvent(event);
        }
      },
    });
  }

  stopRecordingSession() {
    if (this.stop && typeof this.stop === 'function') {
      this.logger.debug('Stopped recording!', this);

      this.stop();
    }
  }

  onConnectionSuccess(sessionId: string) {
    win.Storytime.initialized = true;

    const presence = new Presence(this.channel);

    presence.onSync(() => {
      // Count the number of admin users connected to this session
      const online = presence
        .list()
        .map(({metas = []}) => metas)
        .reduce((acc, items) => acc.concat(items), [])
        .filter((info: any) => {
          if (!info) {
            return false;
          }

          const {session_id: sessionId, admin} = info;

          return admin && !!sessionId;
        });

      // TODO: maybe compare number only vs number previously online?
      if (online.length > 0) {
        this.stopRecordingSession();
        this.startRecordingSession();
      } else {
        this.stopRecordingSession();
      }
    });

    win.addEventListener('papercups:customer:set', (e: any) => {
      const customerId = e.detail;
      this.setBrowserSessionCustomer(sessionId, customerId);
    });

    win.addEventListener('beforeunload', () => {
      // TODO: verify that this actually works
      // TODO: also add ability to trigger this manually (i.e. stop a recording)
      this.finishBrowserSession(sessionId);
    });

    this.handleVisibilityChange();
  }

  onConnectionError(err: any) {
    // TODO: how should we handle errors?
    this.logger.error(err);
  }

  shouldEmitEvent(pathName: string) {
    // TODO: use regex here?
    return this.blocklist.every((p) => pathName.indexOf(p) === -1);
  }

  async getSessionId(accountId: string, customerId: string): Promise<string> {
    if (!storage.session.isSupported()) {
      const {id: sessionId} = await this.createBrowserSession(
        accountId,
        customerId
      );

      return sessionId;
    }

    const existingId = storage.session.get(SESSION_CACHE_KEY);
    const hasValidCachedId = await this.isValidSessionId(existingId);

    if (existingId && hasValidCachedId) {
      this.restartBrowserSession(existingId);
      await this.setBrowserSessionCustomer(existingId, customerId);

      return existingId;
    }

    const {id: sessionId} = await this.createBrowserSession(
      accountId,
      customerId
    );
    storage.session.set(SESSION_CACHE_KEY, sessionId);

    return sessionId;
  }

  getChannelName(sessionId: string) {
    return `events:${this.accountId}:${sessionId}`;
  }
}

export default Storytime;
