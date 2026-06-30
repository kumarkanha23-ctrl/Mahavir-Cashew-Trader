import { mountPage } from '../components/modal.js';
import { renderActionBar, createButton } from '../components/searchFilter.js';
import { summaryGrid } from '../components/statCard.js';
import { el } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { formatCurrency, formatNumber } from '../../utils/currency.js';
import { getAllParties } from '../../domain/services/partyService.js';
import { getPartyLedgerReport } from '../../domain/services/reportService.js';
import { exportLedgerToExcel, buildLedgerPrintHtml, exportToPdf } from '../../domain/services/exportService.js';
import { navigate } from '../../core/router.js';
import { ROUTES } from '../../config.js';

function renderLedgerContent(partyId) {
  const wrap = el('div');
  const parties = getAllParties();

  const selector = el('div', { className: 'filter-bar' }, [
    el('label', { className: 'filter-label', textContent: 'Select Party' }),
    el('select', { className: 'filter-select' }, [
      el('option', { value: '', textContent: '-- Select Party --' }),
      ...parties.map((p) => {
        const opt = el('option', { value: p.id, textContent: p.name });
        if (p.id === partyId) opt.selected = true;
        return opt;
      })
    ])
  ]);

  selector.querySelector('select').addEventListener('change', (e) => {
    if (e.target.value) navigate(ROUTES.partyLedger, { partyId: e.target.value });
  });

  wrap.appendChild(selector);

  if (!partyId) {
    wrap.appendChild(el('p', { className: 'empty-msg', textContent: 'Select a party to view ledger.' }));
    return wrap;
  }

  const report = getPartyLedgerReport(partyId);

  wrap.appendChild(summaryGrid([
    ['Total KG', formatNumber(report.totalKg, 3)],
    ['Total Sale', formatCurrency(report.totalSale)],
    ['Total Paid', formatCurrency(report.totalPaid)],
    ['Outstanding', formatCurrency(report.outstanding)],
    ['Balance', formatCurrency(report.balance)]
  ]));

  wrap.appendChild(renderActionBar([
    createButton('Excel', 'btn-secondary', () => exportLedgerToExcel(report.rows, `party-ledger-${report.entity.name}`)),
    createButton('PDF', 'btn-secondary', () => exportToPdf(report.title, buildLedgerPrintHtml(report, 'PARTY'))),
    createButton('Print', 'btn-secondary', () => exportToPdf(report.title, buildLedgerPrintHtml(report, 'PARTY')))
  ]));

  wrap.appendChild(el('div', { className: 'tableBox' }, [
    el('h2', { textContent: 'All Deals' }),
    el('div', { className: 'tableResponsive' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Date', 'Deal No', 'Grade', 'KG', 'Sale Amount', 'Remarks'].map((h) => el('th', { textContent: h })))]),
        el('tbody', {}, report.deals.length ? report.deals.map((d) => el('tr', {}, [
          el('td', { textContent: formatDate(d.date) }),
          el('td', { textContent: d.dealNo }),
          el('td', { textContent: d.grade }),
          el('td', { textContent: formatNumber(d.kg, 3) }),
          el('td', { textContent: formatCurrency(d.saleAmount) }),
          el('td', { textContent: d.remarks || '—' })
        ])) : [el('tr', {}, [el('td', { colSpan: '6', textContent: 'No deals.' })])])
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
        el('thead', {}, [el('tr', {}, ['Date', 'Ref', 'Description', 'KG', 'Sale (Dr)', 'Payment (Cr)', 'Balance'].map((h) => el('th', { textContent: h })))]),
        el('tbody', {}, report.rows.map((r) => el('tr', {}, [
          el('td', { textContent: formatDate(r.date) }),
          el('td', { textContent: r.reference }),
          el('td', { textContent: r.description }),
          el('td', { textContent: r.kg != null ? formatNumber(r.kg, 3) : '—' }),
          el('td', { textContent: r.debit ? formatCurrency(r.debit) : '—' }),
          el('td', { textContent: r.credit ? formatCurrency(r.credit) : '—' }),
          el('td', { textContent: formatCurrency(r.balance) })
        ])))
      ])
    ])
  ]));

  return wrap;
}

export function renderPartyLedgerPage(container, params = {}) {
  mountPage(container, 'Party Ledger', renderLedgerContent(params.partyId));
}
