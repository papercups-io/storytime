import {
  navigator,
  isFunction,
  each,
  extend,
  bind,
  truncate,
  HTTPBuildQuery,
  JSONEncode,
  JSONDecode,
  base64Encode,
  __NOOP,
  __NOOPTIONS,
} from './helpers';
import {getConfig} from '../config';

const USE_XHR =
  window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest();

let _sendBeacon = navigator['sendBeacon'];

if (_sendBeacon) {
  _sendBeacon = bind(_sendBeacon, navigator);
}

export const sendBeacon = _sendBeacon;

export function getQueryParam(url: string, param: string) {
  // Expects a raw URL
  param = param.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');

  const regexS = '[\\?&]' + param + '=([^&#]*)';
  const regex = new RegExp(regexS);
  const results = regex.exec(url);

  if (
    results === null ||
    (results && typeof results[1] !== 'string' && (results[1] as any).length)
  ) {
    return '';
  } else {
    var result = results[1];
    try {
      result = decodeURIComponent(result);
    } catch (err) {
      console.error('Skipping decoding for malformed query param: ' + result);
    }
    return result.replace(/\+/g, ' ');
  }
}

export function request(
  url: string,
  data: any,
  options: any,
  callback?: (data: any) => void
) {
  const DEFAULT_OPTIONS = {
    method: getConfig('api_method'),
    transport: getConfig('api_transport'),
  };

  let bodyData: string | null = null;

  if (!callback && (isFunction(options) || typeof options === 'string')) {
    callback = options;
    options = null;
  }

  options = extend(DEFAULT_OPTIONS, options || {});

  if (!USE_XHR) {
    options.method = 'GET';
  }

  const useSendBeacon =
    sendBeacon && options.transport.toLowerCase() === 'sendbeacon';
  const usePost = useSendBeacon || options.method === 'POST';
  // needed to correctly format responses
  let verboseMode = getConfig('verbose');

  if (data['verbose']) {
    verboseMode = true;
  }

  if (getConfig('test')) {
    data['test'] = 1;
  }
  if (verboseMode) {
    data['verbose'] = 1;
  }
  if (getConfig('img')) {
    data['img'] = 1;
  }

  if (!USE_XHR) {
    if (callback) {
      data['callback'] = callback;
    } else if (verboseMode || getConfig('test')) {
      // Verbose output (from verbose mode, or an error in test mode) is a json blob,
      // which by itself is not valid javascript. Without a callback, this verbose output will
      // cause an error when returned via jsonp, so we force a no-op callback param.
      // See the ECMA script spec: http://www.ecma-international.org/ecma-262/5.1/#sec-12.4
      data['callback'] = '(function(){})';
    }
  }

  let args: any = {};
  args['ip'] = getConfig('ip') ? 1 : 0;
  args['_'] = new Date().getTime().toString();

  if (usePost) {
    if (Array.isArray(data)) {
      bodyData = 'data=' + data;
    } else {
      bodyData = 'data=' + data['data'];
    }
    delete data['data'];
  }

  url += '?' + HTTPBuildQuery(args);

  // TODO: add ability to send to websocket?
  // console.log({data, useSendBeacon, usePost, verboseMode, url, bodyData});

  if ('img' in data) {
    const img = document.createElement('img');
    img.src = url;
    document.body.appendChild(img);
  } else if (useSendBeacon) {
    // beacon documentation https://w3c.github.io/beacon/
    // beacons format the message and use the type property
    // also no need to try catch as sendBeacon does not report errors
    //   and is defined as best effort attempt
    const body = new Blob([bodyData || ''], {
      type: 'application/x-www-form-urlencoded',
    });
    sendBeacon(url, body);
  } else if (USE_XHR) {
    try {
      let req = new XMLHttpRequest();
      req.open(options.method, url, true);
      let headers = getConfig('xhr_headers');
      if (usePost) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      each(headers, function (headerValue: any, headerName: string) {
        req.setRequestHeader(headerName, headerValue);
      });

      // withCredentials cannot be modified until after calling .open on Android and Mobile Safari
      req.withCredentials = true;
      req.onreadystatechange = function () {
        if (req.readyState === 4) {
          // XMLHttpRequest.DONE == 4, except in safari 4
          if (req.status === 200) {
            console.log(req.responseText);
            if (callback) {
              if (verboseMode) {
                var response;
                try {
                  response = JSONDecode(req.responseText);
                } catch (e) {
                  console.error(e);
                  return;
                }
                callback(response);
              } else {
                callback(Number(req.responseText));
              }
            }
          } else {
            const error =
              'Bad HTTP status: ' + req.status + ' ' + req.statusText;
            console.error(error);
            if (callback) {
              if (verboseMode) {
                callback({status: 0, error: error});
              } else {
                callback(0);
              }
            }
          }
        }
      };
      req.send(bodyData);
    } catch (e) {
      console.error(e);
    }
  } else {
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.defer = true;
    script.src = url;
    let s = document.getElementsByTagName('script')[0];
    s.parentNode?.insertBefore(script, s);
  }
}

export function fetch(
  url: string,
  data: any,
  options: any,
  callback?: (data: any) => void
) {
  const {format = 'base64'} = options;
  const truncated = truncate(data, 255);
  const json = JSONEncode(truncated);
  const encoded = base64Encode(json);

  request(
    url,
    {verbose: true, data: format === 'json' ? json : encoded},
    options,
    callback
  );
}
