import { el, clearElement } from '../../utils/dom.js';

export function confirmDialog(message, onConfirm) {
  const overlay = el('div', { className: 'modal-overlay' });
  const box = el('div', { className: 'modal-box' }, [
    el('h3', { textContent: 'Confirm' }),
    el('p', { textContent: message }),
    el('div', { className: 'modal-actions' }, [
      el('button', {
        className: 'btn btn-secondary',
        textContent: 'Cancel',
        onclick: () => overlay.remove()
      }),
      el('button', {
        className: 'btn btn-danger',
        textContent: 'Confirm',
        onclick: () => {
          overlay.remove();
          onConfirm();
        }
      })
    ])
  ]);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export function renderModal(title, contentNode, onClose) {
  const overlay = el('div', { className: 'modal-overlay' });
  const box = el('div', { className: 'modal-box modal-lg' });
  const header = el('div', { className: 'modal-header' }, [
    el('h3', { textContent: title }),
    el('button', {
      className: 'modal-close',
      textContent: '×',
      onclick: () => { overlay.remove(); onClose?.(); }
    })
  ]);
  const body = el('div', { className: 'modal-body' });
  body.appendChild(contentNode);
  box.appendChild(header);
  box.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  return overlay;
}

export function mountPage(container, title, content) {
  clearElement(container);
  const page = el('div', { className: 'page' }, [
    el('div', { className: 'page-header' }, [
      el('h1', { className: 'page-title', textContent: title })
    ]),
    el('div', { className: 'page-content' }, [content])
  ]);
  container.appendChild(page);
  return page;
}
