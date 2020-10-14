import {isFunction} from './helpers';

export function getEventTarget(e: any) {
  // https://developer.mozilla.org/en-US/docs/Web/API/Event/target#Compatibility_notes
  if (typeof e.target === 'undefined') {
    return e.srcElement;
  } else {
    return e.target;
  }
}

export const registerEvent = (function () {
  // written by Dean Edwards, 2005
  // with input from Tino Zijdel - crisp@xs4all.nl
  // with input from Carl Sverre - mail@carlsverre.com
  // with input from PostHog
  // http://dean.edwards.name/weblog/2005/10/add-event/
  // https://gist.github.com/1930440

  /**
   * @param {Object} element
   * @param {string} type
   * @param {function(...*)} handler
   * @param {boolean=} oldSchool
   * @param {boolean=} useCapture
   */
  const register = function (
    element: any,
    type: string,
    handler: any,
    oldSchool: boolean,
    useCapture: boolean
  ) {
    if (!element) {
      console.error('No valid element provided to register');
      return;
    }

    if (element.addEventListener && !oldSchool) {
      element.addEventListener(type, handler, !!useCapture);
    } else {
      const ontype = 'on' + type;
      const oldHandler = element[ontype]; // can be undefined

      element[ontype] = makeHandler(element, handler, oldHandler);
    }
  };

  function makeHandler(element: any, newHandler: any, oldHandlers: any) {
    const handler = (event: any) => {
      event = event || fixEvent(window.event);

      // this basically happens in firefox whenever another script
      // overwrites the onload callback and doesn't pass the event
      // object to previously defined callbacks.  All the browsers
      // that don't define window.event implement addEventListener
      // so the dom_loaded handler will still be fired as usual.
      if (!event) {
        return undefined;
      }

      let ret = true;
      let oldResult, newResult;

      if (isFunction(oldHandlers)) {
        oldResult = oldHandlers(event);
      }

      newResult = newHandler.call(element, event);

      if (false === oldResult || false === newResult) {
        ret = false;
      }

      return ret;
    };

    return handler;
  }

  function fixEvent(event: any) {
    if (event) {
      event.preventDefault = fixEvent.preventDefault;
      event.stopPropagation = fixEvent.stopPropagation;
    }

    return event;
  }

  fixEvent.preventDefault = function (this: any) {
    this.returnValue = false;
  };

  fixEvent.stopPropagation = function (this: any) {
    this.cancelBubble = true;
  };

  return register;
})();
