import { mountPage } from '../components/modal.js';
import { renderSearchFilter, createButton, renderActionBar } from '../components/searchFilter.js';
import { el, clearElement } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { formatCurrency, formatNumber } from '../../utils/currency.js';
import {
  getDashboardReport,
  getOutstandingReport,
  getDealRegisterReport,
  getProfitReport,
  getPaymentRegisterReport
} from '../../domain/services/reportService.js';
import { exportDealsToExcel, exportPaymentsToExcel, buildDealsPrintHtml, exportToPdf } from '../../domain/services/exportService.js';
import { PAYMENT_TYPES } from '../../config.js';
import { on, Events } from '../../core/eventBus.js';

let unsubscribe = null;
let reportType = 'dashboard';
let filters = {};

function buildSimpleTable(headers, rows) {
  return el('div', { className: 'tableResponsive' }, [
    el('table', {}, [
      el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { textContent: h })))]),
      el('tbody', {}, rows.length ? rows.map((row) => el('tr', {}, row.map((c) => el('td', { textContent: c })))) : [el('tr', {}, [el('td', { colSpan: String(headers.length), textContent: 'No data.' })])])
    ])
  ]);
}

function buildPreview() {
  const wrap = el('div', { className: 'tableBox' });

  if (reportType === 'dashboard') {
    const m = getDashboardReport();
    wrap.appendChild(el('h2', { textContent: 'Business Summary' }));
    const grid = el('div', { className: 'report-grid' });
    [
      ['Total Deals', m.totalDeals],
      ['Total KG', formatNumber(m.totalKg, 3)],
      ['Purchase', formatCurrency(m.totalPurchase)],
      ['Sale', formatCurrency(m.totalSale)],
      ['Profit', formatCurrency(m.totalProfit)],
      ['Commission', formatCurrency(m.totalCommission)],
      ['Outstanding Party', formatCurrency(m.outstandingParty)],
      ['Outstanding Factory', formatCurrency(m.outstandingFactory)]
    ].forEach(([label, val]) => {
      grid.appendChild(el('div', { innerHTML: `<strong>${label}:</strong> ${val}` }));
    });
    wrap.appendChild(grid);
    return { wrap };
  }

  if (reportType === 'outstanding') {
    const r = getOutstandingReport();
    wrap.appendChild(el('h2', { textContent: 'Outstanding Report' }));
    wrap.appendChild(el('h3', { textContent: 'Party Outstanding' }));
    wrap.appendChild(buildSimpleTable(
      ['Party', 'Total Sale', 'Paid', 'Outstanding'],
      r.parties.map((p) => [p.name, formatCurrency(p.totalSale), formatCurrency(p.totalPaid), formatCurrency(p.outstanding)])
    ));
    wrap.appendChild(el('h3', { textContent: 'Factory Outstanding' }));
    wrap.appendChild(buildSimpleTable(
      ['Factory', 'Total Purchase', 'Paid', 'Outstanding'],
      r.factories.map((f) => [f.name, formatCurrency(f.totalPurchase), formatCurrency(f.totalPaid), formatCurrency(f.outstanding)])
    ));
    return { wrap };
  }

  if (reportType === 'deals' || reportType === 'profit') {
    const r = reportType === 'profit' ? getProfitReport(filters) : getDealRegisterReport(filters);
    wrap.appendChild(el('h2', { textContent: r.title }));
    if (reportType === 'profit') {
      wrap.appendChild(el('p', { textContent: `Total Profit: ${formatCurrency(r.totals.profit)} | Total KG: ${formatNumber(r.totals.kg, 3)}` }));
    }
    wrap.appendChild(buildSimpleTable(
      ['Deal No', 'Date', 'Party', 'Factory', 'KG', 'Purchase', 'Sale', 'Profit'],
      r.deals.map((d) => [d.dealNo, formatDate(d.date), d.partyName, d.factoryName, formatNumber(d.kg, 3), formatCurrency(d.purchaseAmount), formatCurrency(d.saleAmount), formatCurrency(d.profit)])
    ));
    return { wrap, report: r };
  }

  if (reportType === 'party-payments' || reportType === 'factory-payments') {
    const type = reportType === 'party-payments' ? PAYMENT_TYPES.PARTY : PAYMENT_TYPES.FACTORY;
    const r = getPaymentRegisterReport(type, filters);
    wrap.appendChild(el('h2', { textContent: r.title }));
    wrap.appendChild(buildSimpleTable(
      ['Date', 'Payment No', 'Name', 'Amount', 'Mode'],
      r.payments.map((p) => [formatDate(p.date), p.paymentNo, p.entityName, formatCurrency(p.amount), p.mode])
    ));
    return { wrap, payments: r.payments, title: r.title };
  }

  return { wrap };
}

function renderContent(container) {
  const content = el('div');
  const previewHost = el('div');

  const typeSelect = el('select', { className: 'filter-select' });
  [
    ['dashboard', 'Business Summary'],
    ['deals', 'Deal Register'],
    ['profit', 'Profit Report'],
    ['outstanding', 'Outstanding Report'],
    ['party-payments', 'Party Payments'],
    ['factory-payments', 'Factory Payments']
  ].forEach(([val, label]) => {
    const opt = el('option', { value: val, textContent: label });
    if (val === reportType) opt.selected = true;
    typeSelect.appendChild(opt);
  });

  const refreshPreview = () => {
    clearElement(previewHost);
    const { wrap } = buildPreview();
    previewHost.appendChild(wrap);
  };

  typeSelect.addEventListener('change', () => {
    reportType = typeSelect.value;
    refreshPreview();
  });

  const filterBar = renderSearchFilter({
    onChange: (f) => {
      filters = { search: f.search, dateFrom: f.dateFrom, dateTo: f.dateTo };
      refreshPreview();
    }
  });

  const actions = renderActionBar([
    createButton('Excel', 'btn-secondary', () => {
      const result = buildPreview();
      if (result.report) exportDealsToExcel(result.report.deals, reportType);
      else if (result.payments) exportPaymentsToExcel(result.payments, reportType);
    }),
    createButton('PDF / Print', 'btn-secondary', () => {
      const result = buildPreview();
      if (result.report) exportToPdf(result.report.title, buildDealsPrintHtml(result.report.deals, result.report.totals));
      else exportToPdf(result.title || 'Report', result.wrap.innerHTML);
    })
  ]);

  content.appendChild(el('div', { className: 'filter-bar' }, [
    el('label', { className: 'filter-label', textContent: 'Report Type' }),
    typeSelect
  ]));
  content.appendChild(filterBar);
  content.appendChild(actions);
  content.appendChild(previewHost);
  refreshPreview();

  mountPage(container, 'Reports', content);
}

export function renderReportsPage(container) {
  renderContent(container);
  if (unsubscribe) unsubscribe();
  unsubscribe = on(Events.DATA_CHANGED, () => renderContent(container));
}
