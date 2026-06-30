import { el } from '../../utils/dom.js';

export function statCard(label, value, extraClass = '') {
  return el('div', { className: `card stat-card ${extraClass}`.trim() }, [
    el('h4', { textContent: label }),
    el('h2', { textContent: value })
  ]);
}

export function statGrid(cards) {
  return el('div', { className: 'dashboard' }, cards);
}

export function summaryGrid(cards) {
  return el('div', { className: 'summaryGrid' }, cards.map(([label, value]) =>
    el('div', { className: 'summaryCard' }, [
      el('h3', { textContent: label }),
      el('h2', { textContent: value })
    ])
  ));
}
