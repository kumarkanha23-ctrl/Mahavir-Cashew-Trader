import { mountPage } from '../components/modal.js';
import { renderActionBar, createButton } from '../components/searchFilter.js';
import { summaryGrid } from '../components/statCard.js';
import { el } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { formatCurrency, formatNumber } from '../../utils/currency.js';
import { getAllFactories } from '../../domain/services/factoryService.js';
import { getFactoryLedgerReport } from '../../domain/services/reportService.js';
import { exportLedgerToExcel, buildLedgerPrintHtml, exportToPdf } from '../../domain/services/exportService.js';
import { navigate } from '../../core/router.js';
import { ROUTES } from '../../config.js';

function renderLedgerContent(factoryId) {
  const wrap = el('div');
  const factories = getAllFactories();

  const selector = el('div', { className: 'filter-bar' }, [
    el('label', { className: 'filter-label', textContent: 'Select Factory' }),
    el('select', { className: 'filter-select' }, [
      el('option', { value: '', textContent: '-- Select Factory --' }),
      ...factories.map((f) => {
        const opt = el('option', { value: f.id, textContent: f.name });
        if (f.id === factoryId) opt.selected = true;
        return opt;
      })
    ])
  ]);

  selector.querySelector('select').addEventListener('change', (e) => {
    if (e.target.value) navigate(ROUTES.factoryLedger, { factoryId: e.target.value });
  });

  wrap.appendChild(selector);

  if (!factoryId) {
    wrap.appendChild(el('p', { className: 'empty-msg', textContent: 'Select a factory to view ledger.' }));
    return wrap;
  }

  const report = getFactoryLedgerReport(factoryId);

  wrap.appendChild(summaryGrid([
    ['Total KG', formatNumber(report.totalKg, 3)],
    ['Total Purchase', formatCurrency(report.totalPurchase)],
    ['Total Paid', formatCurrency(report.totalPaid)],
    ['Outstanding', formatCurrency(report.outstanding)],
    ['Balance', formatCurrency(report.balance)]
  ]));

  wrap.appendChild(renderActionBar([
    createButton('Excel', 'btn-secondary', () => exportLedgerToExcel(report.rows, `factory-ledger-${report.entity.name}`)),
    createButton('PDF', 'btn-secondary', () => exportToPdf(report.title, buildLedgerPrintHtml(report, 'FACTORY'))),
    createButton('Print', 'btn-secondary', () => exportToPdf(report.title, buildLedgerPrintHtml(report, 'FACTORY')))
  ]));

  wrap.appendChild(el('div', { className: 'tableBox' }, [
    el('h2', { textContent: 'All Purchases' }),
    el('div', { className: 'tableResponsive' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Date', 'Deal No', 'Party', 'Grade', 'KG', 'Purchase Amount', 'Remarks'].map((h) => el('th', { textContent: h })))]),
        el('tbody', {}, report.deals.length ? report.deals.map((d) => el('tr', {}, [
          el('td', { textContent: formatDate(d.date) }),
          el('td', { textContent: d.dealNo }),
          el('td', { textContent: d.partyName }),
          el('td', { textContent: d.grade }),
          el('td', { textContent: formatNumber(d.kg, 3) }),
          el('td', { textContent: formatCurrency(d.purchaseAmount) }),
          el('td', { textContent: d.remarks || '—' })
        ])) : [el('tr', {}, [el('td', { colSpan: '7', textContent: 'No purchases.' })])])
      ])
    ])
  ]));

  wrap.appendChild(el('div', { className: 'tableBox' }, [
    el('h2', { textContent: 'Payment History' }),
    el('div', { className: 'tableResponsive' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Date', 'Payment No', 'Amount', 'Mode', 'Reference', 'Remarks'].map((h) => el('th', { textContent: h })))]),
        el('tbody', {}, report.payments.length ? report.payments.map((p) => el('tr', {}, [
          el('td', { textContent: formatDate(p.date) }),
          el('td', { textContent: p.paymentNo }),
          el('td', { textContent: formatCurrency(p.amount) }),
          el('td', { textContent: p.mode }),
          el('td', { textContent: p.referenceNo || '—' }),
          el('td', { textContent: p.remarks || '—' })
        ])) : [el('tr', {}, [el('td', { colSpan: '6', textContent: 'No payments.' })])])
      ])
    ])
  ]));

  wrap.appendChild(el('div', { className: 'tableBox' }, [
    el('h2', { textContent: 'Combined Ledger' }),
    el('div', { className: 'tableResponsive' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Date', 'Ref', 'Description', 'KG', 'Purchase (Cr)', 'Payment (Dr)', 'Balance'].map((h) => el('th', { textContent: h })))]),
        el('tbody', {}, report.rows.map((r) => el('tr', {}, [
          el('td', { textContent: formatDate(r.date) }),
          el('td', { textContent: r.reference }),
          el('td', { textContent: r.description }),
          el('td', { textContent: r.kg != null ? formatNumber(r.kg, 3) : '—' }),
          el('td', { textContent: r.credit ? formatCurrency(r.credit) : '—' }),
          el('td', { textContent: r.debit ? formatCurrency(r.debit) : '—' }),
          el('td', { textContent: formatCurrency(r.balance) })
        ])))
      ])
    ])
  ]));

  return wrap;
}

export function renderFactoryLedgerPage(container, params = {}) {
  mountPage(container, 'Factory Ledger', renderLedgerContent(params.factoryId));
}
