export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'className') node.className = val;
    else if (key === 'textContent') node.textContent = val;
    else if (key === 'innerHTML') node.innerHTML = val;
    else if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (val !== undefined && val !== null) {
      node.setAttribute(key, val);
    }
  });
  const list = Array.isArray(children) ? children : [children];
  list.flat().forEach((child) => {
    if (child == null) return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}
