import { mountPage, confirmDialog } from '../components/modal.js';
import { renderSearchFilter, renderActionBar, createButton } from '../components/searchFilter.js';
import { el } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { formatCurrency, formatNumber } from '../../utils/currency.js';
import { filterDeals, deleteDeal } from '../../domain/services/dealService.js';
import { exportDealsToExcel, buildDealsPrintHtml, exportToPdf } from '../../domain/services/exportService.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../../core/router.js';
import { ROUTES } from '../../config.js';
import { on, Events } from '../../core/eventBus.js';
import { getAllParties } from '../../domain/services/partyService.js';

let unsubscribe = null;
let currentFilters = {};

function buildTable(deals) {
  const totals = {
    kg: deals.reduce((a, d) => a + d.kg, 0),
    purchase: deals.reduce((a, d) => a + d.purchaseAmount, 0),
    sale: deals.reduce((a, d) => a + d.saleAmount, 0),
    profit: deals.reduce((a, d) => a + d.profit, 0)
  };

  const tbody = deals.length ? deals.map((d) => el('tr', {}, [
    el('td', { textContent: d.dealNo }),
    el('td', { textContent: formatDate(d.date) }),
    el('td', { textContent: d.partyName }),
    el('td', { textContent: d.factoryName }),
    el('td', { textContent: d.grade }),
    el('td', { textContent: d.bucket }),
    el('td', { textContent: formatNumber(d.kg, 3) }),
    el('td', { textContent: formatCurrency(d.factoryRate) }),
    el('td', { textContent: formatCurrency(d.commissionPerKg) }),
    el('td', { textContent: formatCurrency(d.partyRate) }),
    el('td', { textContent: formatCurrency(d.purchaseAmount) }),
    el('td', { textContent: formatCurrency(d.saleAmount) }),
    el('td', { textContent: formatCurrency(d.profit) }),
    el('td', { textContent: d.remarks || '—' }),
    el('td', {}, [
      el('button', {
        className: 'editBtn',
        textContent: 'Edit',
        onclick: () => navigate(ROUTES.newDeal, { id: d.id })
      }),
      ' ',
      el('button', {
        className: 'deleteBtn',
        textContent: 'Delete',
        onclick: () => confirmDialog(`Delete deal ${d.dealNo}?`, () => {
          try {
            deleteDeal(d.id);
            showToast('Deal deleted.');
          } catch (err) {
            showToast(err.message, 'error');
          }
        })
      })
    ])
  ])) : [el('tr', {}, [el('td', { colSpan: '15', textContent: 'No deals found.' })])];

  const tableBox = el('div', { className: 'tableBox' }, [
    el('h2', { textContent: `Recent Deals (${deals.length})` }),
    el('div', { className: 'tableResponsive' }, [
      el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            'Deal No', 'Date', 'Party', 'Factory', 'Grade', 'Bucket', 'KG',
            'Factory Rate', 'Comm/KG', 'Party Rate', 'Purchase', 'Sale', 'Profit', 'Remarks', 'Actions'
          ].map((h) => el('th', { textContent: h })))
        ]),
        el('tbody', {}, tbody)
      ])
    ]),
    el('div', { className: 'table-totals' }, [
      el('span', { textContent: `Total KG: ${formatNumber(totals.kg, 3)}` }),
      el('span', { textContent: `Purchase: ${formatCurrency(totals.purchase)}` }),
      el('span', { textContent: `Sale: ${formatCurrency(totals.sale)}` }),
      el('span', { textContent: `Profit: ${formatCurrency(totals.profit)}` })
    ])
  ]);

  tableBox._deals = deals;
  tableBox._totals = totals;
  return tableBox;
}

function renderContent(container) {
  const content = el('div');
  const deals = filterDeals(currentFilters);
  const table = buildTable(deals);

  const filter = renderSearchFilter({
    onChange: (f) => {
      currentFilters = {
        search: f.search,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
        partyId: f.entityId || undefined
      };
      renderContent(container);
    },
    showEntitySelect: true,
    entities: getAllParties(),
    entityLabel: 'Party'
  });

  const actions = renderActionBar([
    createButton('Excel Export', 'btn-secondary', () => exportDealsToExcel(deals, 'recent-deals')),
    createButton('PDF Export', 'btn-secondary', () => exportToPdf('Recent Deals', buildDealsPrintHtml(deals, table._totals))),
    createButton('Print', 'btn-secondary', () => exportToPdf('Recent Deals', buildDealsPrintHtml(deals, table._totals)))
  ]);

  content.appendChild(filter);
  content.appendChild(actions);
  content.appendChild(table);
  mountPage(container, 'Recent Deals', content);
}

export function renderRecentDealsPage(container) {
  renderContent(container);
  if (unsubscribe) unsubscribe();
  unsubscribe = on(Events.DATA_CHANGED, () => renderContent(container));
}
