import {JSONDecode} from './helpers';

const DOMAIN_MATCH_REGEX = /[a-z0-9][a-z0-9-]+\.[a-z.]{2,6}$/i;

// Methods partially borrowed from quirksmode.org/js/cookies.html
export const cookie = {
  get: function (name: string) {
    try {
      let nameEQ = name + '=';
      let ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
          c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
          return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
      }
    } catch (err) {}
    return null;
  },

  parse: function (name: string) {
    let cookie;
    try {
      cookie = JSONDecode(cookie.get(name)) || {};
    } catch (err) {
      // noop
    }
    return cookie;
  },

  setSeconds: function (
    name: string,
    value: string,
    seconds?: number,
    crossSubdomain?: string,
    isSecure?: boolean
  ) {
    try {
      let cdomain = '';
      let expires = '';
      let secure = '';

      if (crossSubdomain) {
        let matches = document.location.hostname.match(DOMAIN_MATCH_REGEX);
        let domain = matches ? matches[0] : '';

        cdomain = domain ? '; domain=.' + domain : '';
      }

      if (seconds) {
        let date = new Date();
        date.setTime(date.getTime() + seconds * 1000);
        expires = '; expires=' + date.toUTCString();
      }

      if (isSecure) {
        secure = '; secure';
      }

      document.cookie =
        name +
        '=' +
        encodeURIComponent(value) +
        expires +
        '; path=/' +
        cdomain +
        secure;
    } catch (err) {
      return;
    }
  },

  set: function (
    name: string,
    value: string,
    days?: number,
    crossSubdomain?: string,
    isSecure?: boolean
  ) {
    try {
      let cdomain = '';
      let expires = '';
      let secure = '';

      if (crossSubdomain) {
        let matches = document.location.hostname.match(DOMAIN_MATCH_REGEX);
        let domain = matches ? matches[0] : '';

        cdomain = domain ? '; domain=.' + domain : '';
      }

      if (days) {
        let date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = '; expires=' + date.toUTCString();
      }

      if (isSecure) {
        secure = '; secure';
      }

      let newCookieVal =
        name +
        '=' +
        encodeURIComponent(value) +
        expires +
        '; path=/' +
        cdomain +
        secure;
      document.cookie = newCookieVal;
      return newCookieVal;
    } catch (err) {
      return;
    }
  },

  remove: function (name: string, crossSubdomain: string) {
    try {
      cookie.set(name, '', -1, crossSubdomain);
    } catch (err) {
      return;
    }
  },
};

let _isLocalStorageSupported: boolean | null = null;

export const local = {
  isSupported: function () {
    if (_isLocalStorageSupported !== null) {
      return _isLocalStorageSupported;
    }

    let supported = true;
    try {
      let key = '__lssupport__',
        val = 'xyz';
      local.set(key, val);
      if (local.get(key) !== val) {
        supported = false;
      }
      local.remove(key);
    } catch (err) {
      supported = false;
    }
    if (!supported) {
      console.error('localStorage unsupported; falling back to cookie store');
    }

    _isLocalStorageSupported = supported;
    return supported;
  },

  error: function (msg) {
    console.error('localStorage error: ' + msg);
  },

  get: function (name: string) {
    try {
      return window.localStorage.getItem(name);
    } catch (err) {
      local.error(err);
    }
    return null;
  },

  parse: function (name: string) {
    try {
      return JSONDecode(local.get(name)) || {};
    } catch (err) {
      // noop
    }
    return null;
  },

  set: function (name: string, value: string) {
    try {
      window.localStorage.setItem(name, value);
    } catch (err) {
      local.error(err);
    }
  },

  remove: function (name: string) {
    try {
      window.localStorage.removeItem(name);
    } catch (err) {
      local.error(err);
    }
  },
};
