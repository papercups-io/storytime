export const usefulElements = [
  'a',
  'button',
  'form',
  'input',
  'select',
  'textarea',
  'label',
];

// TODO: figure out actual types

export function isTextNode(el: any) {
  return el && el.nodeType === 3; // Node.TEXT_NODE - use integer constant for browser portability
}

export function isTag(el: any, tag: string) {
  return el && el.tagName && el.tagName.toLowerCase() === tag.toLowerCase();
}

export function isElementNode(el: any) {
  return el && el.nodeType === 1; // Node.ELEMENT_NODE - use integer constant for browser portability
}

export function previousElementSibling(el: any) {
  if (el.previousElementSibling) {
    return el.previousElementSibling;
  } else {
    do {
      el = el.previousSibling;
    } while (el && !isElementNode(el));
    return el;
  }
}

export function getClassName(el: any) {
  switch (typeof el.className) {
    case 'string':
      return el.className;
    case 'object': // handle cases where className might be SVGAnimatedString or some other type
      return el.className.baseVal || el.getAttribute('class') || '';
    default:
      // future proof
      return '';
  }
}
