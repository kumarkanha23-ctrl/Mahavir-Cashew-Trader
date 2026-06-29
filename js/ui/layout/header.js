import { el } from '../../utils/dom.js';
import { APP_NAME } from '../../config.js';

export function renderHeader() {
  return el('header', { className: 'header app-header' }, [
    el('div', { className: 'header-left' }, [
      el('button', { className: 'menu-toggle', id: 'menuToggle', textContent: '☰' }),
      el('div', { className: 'logo', textContent: APP_NAME })
    ]),
    el('div', { className: 'headerRight' }, [
      el('span', { className: 'header-badge', textContent: 'Offline ERP v1' })
    ])
  ]);
}
