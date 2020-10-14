import {each, trim, includes, extend, isUndefined} from './helpers';
import {getEventTarget} from './events';
import {
  usefulElements,
  isTag,
  isTextNode,
  isElementNode,
  getClassName,
  previousElementSibling,
} from './elements';

function shouldCaptureValue(value: any) {
  if (value === null || isUndefined(value)) {
    return false;
  }

  if (typeof value === 'string') {
    value = trim(value);

    // check to see if input value looks like a credit card number
    // see: https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9781449327453/ch04s20.html
    const ccRegex = /^(?:(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11}))$/;

    if (ccRegex.test((value || '').replace(/[- ]/g, ''))) {
      return false;
    }

    // check to see if input value looks like a social security number
    const ssnRegex = /(^\d{3}-?\d{2}-?\d{4}$)/;

    if (ssnRegex.test(value)) {
      return false;
    }
  }

  return true;
}

function getSafeText(el: any) {
  let elText = '';

  if (shouldCaptureElement(el) && el.childNodes && el.childNodes.length) {
    each(el.childNodes, function (child: any) {
      if (isTextNode(child) && child.textContent) {
        elText += trim(child.textContent)
          // scrub potentially sensitive values
          .split(/(\s+)/)
          .filter(shouldCaptureValue)
          .join('')
          // normalize whitespace
          .replace(/[\r\n]/g, ' ')
          .replace(/[ ]+/g, ' ')
          // truncate
          .substring(0, 255);
      }
    });
  }

  return trim(elText);
}

function getPropertiesFromElement(elem: any) {
  let tagName = elem.tagName.toLowerCase();
  let props: any = {tag_name: tagName};
  if (usefulElements.indexOf(tagName) > -1) {
    props['$el_text'] = getSafeText(elem);
  }

  let elementId = elem.id;
  if (elementId && elementId.length > 0) {
    props['id'] = elementId;
  }

  let classes = getClassName(elem);
  if (classes.length > 0) {
    props['classes'] = classes.split(' ');
  }

  let elementType = elem.type;
  if (elementType && elementType.length > 0) {
    props['$el_type'] = elementType;
  }

  let elementName = elem.name;
  if (elementName && elementName.length > 0) {
    props['$el_name'] = elementName;
  }

  if (shouldCaptureElement(elem)) {
    each(elem.attributes, function (attr: any) {
      if (shouldCaptureValue(attr.value)) {
        props['attr__' + attr.name] = attr.value;
      }
    });
  }

  let nthChild = 1;
  let nthOfType = 1;
  let currentElem = elem;

  while ((currentElem = previousElementSibling(currentElem))) {
    // eslint-disable-line no-cond-assign
    nthChild++;
    if (currentElem.tagName === elem.tagName) {
      nthOfType++;
    }
  }
  props['nth_child'] = nthChild;
  props['nth_of_type'] = nthOfType;

  return props;
}

function extractCustomPropertyValue(customProperty: any) {
  let propValues: Array<any> = [];
  each(document.querySelectorAll(customProperty['css_selector']), function (
    matchedElem: any
  ) {
    let value;

    if (['input', 'select'].indexOf(matchedElem.tagName.toLowerCase()) > -1) {
      value = matchedElem['value'];
    } else if (matchedElem['textContent']) {
      value = matchedElem['textContent'];
    }

    if (shouldCaptureValue(value)) {
      propValues.push(value);
    }
  });
  return propValues.join(', ');
}

function getDefaultProperties(eventType: string) {
  // TODO
  return {
    $event_type: eventType,
    $ce_version: 1,
  };
}

function getCustomProperties(
  this: any,
  targetElementList: any,
  customProperties: Array<any> = []
) {
  let props: any = {};

  each(
    customProperties,
    function (this: any, customProperty: any) {
      each(
        customProperty['event_selectors'],
        function (this: any, eventSelector: any) {
          const eventElements = document.querySelectorAll(eventSelector);
          each(
            eventElements,
            function (this: any, eventElement: any) {
              if (
                includes(targetElementList, eventElement) &&
                shouldCaptureElement(eventElement)
              ) {
                props[customProperty['name']] = extractCustomPropertyValue(
                  customProperty
                );
              }
            },
            this
          );
        },
        this
      );
    },
    this
  );

  return props;
}

function shouldCaptureDomEvent(el: any, event: any) {
  if (!el || isTag(el, 'html') || !isElementNode(el)) {
    return false;
  }

  let parentIsUsefulElement = false;
  let targetElementList = [el];
  let curEl = el;

  while (curEl.parentNode && !isTag(curEl, 'body')) {
    if (usefulElements.indexOf(curEl.parentNode.tagName.toLowerCase()) > -1)
      parentIsUsefulElement = true;
    targetElementList.push(curEl.parentNode);
    curEl = curEl.parentNode;
  }

  let tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'html':
      return false;
    case 'form':
      return event.type === 'submit';
    case 'input':
      return event.type === 'change' || event.type === 'click';
    case 'select':
    case 'textarea':
      return event.type === 'change' || event.type === 'click';
    default:
      if (parentIsUsefulElement) return event.type == 'click';
      return (
        event.type === 'click' &&
        (usefulElements.indexOf(tag) > -1 ||
          el.getAttribute('contenteditable') === 'true')
      );
  }
}

function shouldCaptureElement(el: any) {
  for (
    let curEl = el;
    curEl.parentNode && !isTag(curEl, 'body');
    curEl = curEl.parentNode
  ) {
    let classes = getClassName(curEl).split(' ');
    if (
      includes(classes, 'st-sensitive') ||
      includes(classes, 'st-no-capture')
    ) {
      return false;
    }
  }

  if (includes(getClassName(el).split(' '), 'st-include')) {
    return true;
  }

  // don't send data from inputs or similar elements since there will always be
  // a risk of clientside javascript placing sensitive data in attributes
  if (
    (isTag(el, 'input') && el.type != 'button') ||
    isTag(el, 'select') ||
    isTag(el, 'textarea') ||
    el.getAttribute('contenteditable') === 'true'
  ) {
    return false;
  }

  // don't include hidden or password fields
  let type = el.type || '';
  if (typeof type === 'string') {
    // it's possible for el.type to be a DOM element if el is a form with a child input[name="type"]
    switch (type.toLowerCase()) {
      case 'hidden':
        return false;
      case 'password':
        return false;
    }
  }

  // filter out data from fields that look like sensitive fields
  let name = el.name || el.id || '';
  if (typeof name === 'string') {
    // it's possible for el.name or el.id to be a DOM element if el is a form with a child input[name="name"]
    const sensitiveNameRegex = /^cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn/i;

    if (sensitiveNameRegex.test(name.replace(/[^a-zA-Z0-9]/g, ''))) {
      return false;
    }
  }

  return true;
}

export function captureEvent(this: any, e: any, callback: any) {
  /*** Don't mess with this code without running IE8 tests on it ***/
  let target = getEventTarget(e);
  if (isTextNode(target)) {
    // defeat Safari bug (see: http://www.quirksmode.org/js/events_properties.html)
    target = target.parentNode;
  }

  if (!shouldCaptureDomEvent(target, e)) {
    return false;
  }

  let targetElementList = [target];
  let curEl = target;

  while (curEl.parentNode && !isTag(curEl, 'body')) {
    targetElementList.push(curEl.parentNode);
    curEl = curEl.parentNode;
  }

  let elementsJson: Array<any> = [];
  let href;
  let explicitNoCapture = false;

  each(
    targetElementList,
    function (el: any) {
      let shouldCaptureEl = shouldCaptureElement(el);

      // if the element or a parent element is an anchor tag
      // include the href as a property
      if (el.tagName.toLowerCase() === 'a') {
        href = el.getAttribute('href');
        href = shouldCaptureEl && shouldCaptureValue(href) && href;
      }

      // allow users to programatically prevent captureing of elements by adding class 'st-no-capture'
      let classes = getClassName(el).split(' ');
      if (includes(classes, 'st-no-capture')) {
        explicitNoCapture = true;
      }

      elementsJson.push(getPropertiesFromElement(el));
    },
    this
  );

  elementsJson[0]['$el_text'] = getSafeText(target);

  if (explicitNoCapture) {
    return false;
  }

  // only populate text content from target element (not parents)
  // to prevent text within a sensitive element from being collected
  // as part of a parent's el.textContent
  let elementText;
  let safeElementText = getSafeText(target);
  if (safeElementText && safeElementText.length) {
    elementText = safeElementText;
  }

  let props = extend(
    getDefaultProperties(e.type),
    {
      $elements: elementsJson,
    },
    getCustomProperties(targetElementList)
  );

  // TODO: figure out what we want to do here
  // instance.capture('$autocapture', props);
  // console.log('Properties!', info.properties());
  callback(props);

  return true;
}
