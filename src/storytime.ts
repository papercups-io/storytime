import {Socket, Channel} from 'phoenix';
import {record} from 'rrweb';
import * as request from 'superagent';
import {win} from './utils/helpers';

const SOCKET_URL =
  win.location.hostname === 'localhost'
    ? 'ws://localhost:4000/socket'
    : '/socket';

// TODO: figure out a better way to prevent recording on certain pages
// const blocklist: Array<string> = ['/player', '/sessions'];
const BLOCKLIST: Array<string> = [];

const createBrowserSession = async (accountId: string) => {
  return request
    .post(`/api/browser_sessions`)
    .send({
      browser_session: {
        account_id: accountId,
        started_at: new Date(),
      },
    })
    .then((res) => res.body.data);
};

const REPLAY_EVENT_EMITTED = 'replay:event:emitted';

type Config = {
  accountId: string;
  customerId?: string;
  publicKey?: string;
  blocklist?: Array<string>;
};

class Storytime {
  accountId: string;
  customerId?: string;
  publicKey?: string;
  blocklist: Array<string>;

  socket: Socket;
  channel!: Channel;

  constructor(config: Config) {
    this.accountId = config.accountId;
    this.customerId = config.customerId;
    this.publicKey = config.publicKey;
    this.blocklist = config.blocklist || BLOCKLIST;

    this.socket = new Socket(SOCKET_URL);
  }

  static init(config: Config) {
    return new Storytime(config).listen();
  }

  async listen() {
    if (!this.socket.isConnected()) {
      this.socket.connect();
    }

    this.socket.onError((err: any) => {
      // TODO: attempt to reconnect?
      console.error(err);
    });

    const sessionId = await this.getSessionId();
    const channel = this.getChannelName(sessionId);

    this.channel = this.socket.channel(channel, {
      customerId: this.customerId,
    });

    this.channel
      .join()
      .receive('ok', () => this.onConnectionSuccess())
      .receive('error', (err) => this.onConnectionError(err));
  }

  onConnectionSuccess() {
    console.log('Start recording!', this);

    record({
      emit: (event) => {
        const pathName = win.location.pathname;

        // TODO: just emit everything until bug is fixed?
        if (this.shouldEmitEvent(pathName)) {
          this.channel.push(REPLAY_EVENT_EMITTED, {
            event,
            customer_id: this.customerId,
          });
        }
      },
    });

    win.addEventListener('beforeunload', () => {
      // TODO: end session
    });
  }

  onConnectionError(err: any) {
    // TODO: how should we handle errors?
    console.error(err);
  }

  shouldEmitEvent(pathName: string) {
    return this.blocklist.every((p) => pathName.indexOf(p) === -1);
  }

  async getSessionId(): Promise<string> {
    // TODO: check cache first

    const {id: sessionId} = await createBrowserSession(this.accountId);

    return sessionId;
  }

  getChannelName(sessionId: string) {
    return `events:${this.accountId}:${sessionId}`;
  }
}

export default Storytime;
