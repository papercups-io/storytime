export const DEFAULT_CONFIG: {[key: string]: any} = {
  // api_host: 'https://app.papercups.io',
  api_host: 'http://localhost:3000', // TODO
  api_method: 'POST',
  api_transport: 'XHR',
  autocapture: true,
  persistence: 'cookie',
  persistence_name: '',
  cookie_name: '',
  loaded: function () {},
  store_google: true,
  save_referrer: true,
  test: false,
  verbose: false,
  img: false,
  capture_pageview: true,
  debug: false,
  capture_links_timeout: 300,
  cookie_expiration: 365,
  upgrade: false,
  disable_persistence: false,
  disable_cookie: false,
  secure_cookie: false,
  ip: true,
  opt_out_capturing_by_default: false,
  opt_out_persistence_by_default: false,
  opt_out_capturing_persistence_type: 'localStorage',
  opt_out_capturing_cookie_prefix: null,
  property_blacklist: [],
  xhr_headers: {}, // { header: value, header2: value }
  inapp_protocol: '//',
  inapp_link_new_window: false,
  request_batching: true,
};

export const USE_XHR =
  window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest();

export function getConfig(key: string) {
  return DEFAULT_CONFIG[key] || null;
}
