import { el } from '../../utils/dom.js';
import { todayISO } from '../../utils/date.js';

export function renderSearchFilter({ onChange, showDateFilter = true, showEntitySelect = false, entities = [], entityLabel = 'Select' }) {
  const wrap = el('div', { className: 'filter-bar' });

  const searchInput = el('input', {
    type: 'search',
    placeholder: 'Search...',
    className: 'filter-search'
  });

  const dateFrom = el('input', { type: 'date', className: 'filter-date', value: '' });
  const dateTo = el('input', { type: 'date', className: 'filter-date', value: todayISO() });

  const entitySelect = showEntitySelect
    ? el('select', { className: 'filter-select' }, [
        el('option', { value: '', textContent: `-- ${entityLabel} --` }),
        ...entities.map((e) => el('option', { value: e.id, textContent: e.name }))
      ])
    : null;

  const emitChange = () => {
    onChange({
      search: searchInput.value,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      entityId: entitySelect?.value || ''
    });
  };

  searchInput.addEventListener('input', emitChange);
  dateFrom.addEventListener('change', emitChange);
  dateTo.addEventListener('change', emitChange);
  entitySelect?.addEventListener('change', emitChange);

  wrap.appendChild(searchInput);
  if (showDateFilter) {
    wrap.appendChild(el('label', { className: 'filter-label', textContent: 'From' }));
    wrap.appendChild(dateFrom);
    wrap.appendChild(el('label', { className: 'filter-label', textContent: 'To' }));
    wrap.appendChild(dateTo);
  }
  if (entitySelect) wrap.appendChild(entitySelect);

  wrap.reset = () => {
    searchInput.value = '';
    dateFrom.value = '';
    dateTo.value = todayISO();
    if (entitySelect) entitySelect.value = '';
    emitChange();
  };

  return wrap;
}

export function renderActionBar(buttons) {
  return el('div', { className: 'action-bar' }, buttons);
}

export function createButton(label, className, onClick) {
  return el('button', { className: `btn ${className}`, textContent: label, onclick: onClick });
}
