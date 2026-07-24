import {
  getState, partyLedger, factoryLedger, fmtDate, fmtMoney, fmtNum, esc, navigate, ROUTES, getDealGradeLabel,
  buildLedgerWhatsAppMessage, openWhatsApp
} from './app.js';
import { exportLedgerExcel } from './excel.js';
import { printLedgerPdf } from './pdf.js';

function parseHashParams() {
  const hash = window.location.hash.slice(1).replace(/^\//, '');
  const [, qs] = hash.split('?');
  const params = new URLSearchParams(qs || '');
  return {
    search: params.get('search') || '',
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || ''
  };
}

export function renderPartyLedger(container, partyId = null) {
  const parties = getState().parties.sort((a, b) => a.name.localeCompare(b.name));
  const party = partyId ? parties.find((p) => p.id === partyId) : null;
  const { search, dateFrom, dateTo } = parseHashParams();
  const report = party ? partyLedger(partyId, { search, dateFrom, dateTo }) : null;

  container.innerHTML = `
    <section class="filter-bar">
      <label>Select Party
        <select id="partySelect">
          <option value="">-- Select Party --</option>
          ${parties.map((p) => `<option value="${p.id}" ${p.id === partyId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </label>
      <label>Search<input id="partySearch" type="search" placeholder="Search deal no, grade, remarks" value="${esc(search)}" /></label>
      <label>From<input id="partyDateFrom" type="date" value="${esc(dateFrom)}" /></label>
      <label>To<input id="partyDateTo" type="date" value="${esc(dateTo)}" /></label>
    </section>
    ${report ? `
    <section class="summaryGrid">
      <div class="summaryCard"><h3>Total KG</h3><h2>${fmtNum(report.totalKg, 3)}</h2></div>
      <div class="summaryCard"><h3>Total Sale</h3><h2>${fmtMoney(report.totalSale)}</h2></div>
      <div class="summaryCard"><h3>Total Paid</h3><h2>${fmtMoney(report.totalPaid)}</h2></div>
      <div class="summaryCard"><h3>Outstanding</h3><h2>${fmtMoney(report.outstanding)}</h2></div>
      <div class="summaryCard"><h3>Balance</h3><h2>${fmtMoney(report.balance)}</h2></div>
    </section>
    <section class="action-bar">
      <button type="button" class="btn btn-secondary" id="partyExcel">Excel</button>
      <button type="button" class="btn btn-secondary" id="partyPdf">PDF / Print</button>
      <button type="button" class="whatsapp-btn" id="partyWhatsAppBtn" title="Share party ledger via WhatsApp">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2A10.01 10.01 0 0 0 2.03 12.02c0 1.76.47 3.46 1.35 4.95L2 22l5.2-1.37a9.98 9.98 0 0 0 4.84 1.18h.01c5.52 0 10.01-4.49 10.01-10.01S17.56 2 12.04 2Zm0 18.3h-.01a8.27 8.27 0 0 1-4.22-1.15l-.3-.18-3.09.81.82-3.01-.19-.31a8.25 8.25 0 0 1 1.3-10.23 8.25 8.25 0 0 1 10.34 0 8.25 8.25 0 0 1 0 11.65 8.25 8.25 0 0 1-4.65 2.42Zm4.73-6.2c-.26-.13-1.53-.76-1.77-.84-.24-.09-.42-.13-.59.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.1-.4-2.09-1.28-.77-.69-1.3-1.54-1.45-1.8-.15-.26-.02-.4.11-.53.11-.11.26-.29.39-.43.13-.14.18-.24.27-.4.09-.16.04-.3-.02-.43-.06-.13-.59-1.42-.81-1.94-.21-.51-.43-.44-.59-.45h-.51c-.17 0-.43.06-.66.3-.23.24-.87.85-.87 2.07 0 1.22.9 2.4 1.03 2.56.13.17 1.78 2.72 4.32 3.81.6.26 1.07.42 1.44.54.6.19 1.14.17 1.57.1.48-.07 1.53-.63 1.75-1.24.22-.61.22-1.14.15-1.25-.07-.11-.24-.17-.5-.3Z"></path></svg>
        <span>WhatsApp</span>
      </button>
    </section>
    <section class="tableBox">
      <h2>All Deals</h2>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Date</th><th>Deal No</th><th>Grades</th><th>KG</th><th>Sale Amount</th><th>Remarks</th></tr></thead>
          <tbody>
            ${report.deals.length ? report.deals.map((d) => `
              <tr><td>${fmtDate(d.date)}</td><td>${esc(d.dealNo)}</td><td>${esc(getDealGradeLabel(d))}</td>
              <td>${fmtNum(d.totalKg, 3)}</td><td>${fmtMoney(d.totalSale)}</td><td>${esc(d.remarks || '—')}</td></tr>`).join('')
              : '<tr><td colspan="6" class="empty">No deals.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="tableBox">
      <h2>Payment History</h2>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Date</th><th>Payment No</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Remarks</th></tr></thead>
          <tbody>
            ${report.payments.length ? report.payments.map((p) => `
              <tr><td>${fmtDate(p.date)}</td><td>${esc(p.paymentNo)}</td><td>${fmtMoney(p.amount)}</td>
              <td>${esc(p.mode)}</td><td>${esc(p.referenceNo || '—')}</td><td>${esc(p.remarks || '—')}</td></tr>`).join('')
              : '<tr><td colspan="6" class="empty">No payments.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="tableBox">
      <h2>Combined Ledger</h2>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Date</th><th>Ref</th><th>Description</th><th>KG</th><th>Sale (Dr)</th><th>Payment (Cr)</th><th>Balance</th></tr></thead>
          <tbody>
            ${report.rows.map((r) => `
              <tr><td>${fmtDate(r.date)}</td><td>${esc(r.ref)}</td><td>${esc(r.desc)}</td>
              <td>${r.kg != null ? fmtNum(r.kg, 3) : '—'}</td>
              <td>${r.debit ? fmtMoney(r.debit) : '—'}</td>
              <td>${r.credit ? fmtMoney(r.credit) : '—'}</td>
              <td>${fmtMoney(r.balance)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>` : '<p class="empty-msg">Select a party to view ledger.</p>'}`;

  const updatePartyRoute = () => {
    const params = {};
    if (partyId) params.partyId = partyId;
    const searchValue = container.querySelector('#partySearch')?.value.trim();
    const dateFromValue = container.querySelector('#partyDateFrom')?.value;
    const dateToValue = container.querySelector('#partyDateTo')?.value;
    if (searchValue) params.search = searchValue;
    if (dateFromValue) params.dateFrom = dateFromValue;
    if (dateToValue) params.dateTo = dateToValue;
    navigate(ROUTES.partyLedger, params);
  };

  container.querySelector('#partySelect')?.addEventListener('change', (e) => {
    partyId = e.target.value;
    updatePartyRoute();
  });

  container.querySelector('#partySearch')?.addEventListener('input', updatePartyRoute);
  container.querySelector('#partyDateFrom')?.addEventListener('change', updatePartyRoute);
  container.querySelector('#partyDateTo')?.addEventListener('change', updatePartyRoute);

  if (report && party) {
    container.querySelector('#partyExcel').addEventListener('click', () => exportLedgerExcel(report.rows, `party-${party.name}`));
    container.querySelector('#partyPdf').addEventListener('click', () => printLedgerPdf(`Party Ledger — ${party.name}`, report, 'PARTY'));
    container.querySelector('#partyWhatsAppBtn').addEventListener('click', () => {
      openWhatsApp(party, buildLedgerWhatsAppMessage('PARTY', party, report));
    });
  }
}

export function renderFactoryLedger(container, factoryId = null) {
  const factories = getState().factories.sort((a, b) => a.name.localeCompare(b.name));
  const factory = factoryId ? factories.find((f) => f.id === factoryId) : null;
  const { search, dateFrom, dateTo } = parseHashParams();
  const report = factory ? factoryLedger(factoryId, { search, dateFrom, dateTo }) : null;

  container.innerHTML = `
    <section class="filter-bar">
      <label>Select Factory
        <select id="factorySelect">
          <option value="">-- Select Factory --</option>
          ${factories.map((f) => `<option value="${f.id}" ${f.id === factoryId ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
        </select>
      </label>
      <label>Search<input id="factorySearch" type="search" placeholder="Search deal no, grade, remarks" value="${esc(search)}" /></label>
      <label>From<input id="factoryDateFrom" type="date" value="${esc(dateFrom)}" /></label>
      <label>To<input id="factoryDateTo" type="date" value="${esc(dateTo)}" /></label>
    </section>
    ${report ? `
    <section class="summaryGrid">
      <div class="summaryCard"><h3>Total KG</h3><h2>${fmtNum(report.totalKg, 3)}</h2></div>
      <div class="summaryCard"><h3>Total Purchase</h3><h2>${fmtMoney(report.totalPurchase)}</h2></div>
      <div class="summaryCard"><h3>Total Paid</h3><h2>${fmtMoney(report.totalPaid)}</h2></div>
      <div class="summaryCard"><h3>Outstanding</h3><h2>${fmtMoney(report.outstanding)}</h2></div>
      <div class="summaryCard"><h3>Balance</h3><h2>${fmtMoney(report.balance)}</h2></div>
    </section>
    <section class="action-bar">
      <button type="button" class="btn btn-secondary" id="factoryExcel">Excel</button>
      <button type="button" class="btn btn-secondary" id="factoryPdf">PDF / Print</button>
      <button type="button" class="whatsapp-btn" id="factoryWhatsAppBtn" title="Share factory ledger via WhatsApp">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2A10.01 10.01 0 0 0 2.03 12.02c0 1.76.47 3.46 1.35 4.95L2 22l5.2-1.37a9.98 9.98 0 0 0 4.84 1.18h.01c5.52 0 10.01-4.49 10.01-10.01S17.56 2 12.04 2Zm0 18.3h-.01a8.27 8.27 0 0 1-4.22-1.15l-.3-.18-3.09.81.82-3.01-.19-.31a8.25 8.25 0 0 1 1.3-10.23 8.25 8.25 0 0 1 10.34 0 8.25 8.25 0 0 1 0 11.65 8.25 8.25 0 0 1-4.65 2.42Zm4.73-6.2c-.26-.13-1.53-.76-1.77-.84-.24-.09-.42-.13-.59.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.1-.4-2.09-1.28-.77-.69-1.3-1.54-1.45-1.8-.15-.26-.02-.4.11-.53.11-.11.26-.29.39-.43.13-.14.18-.24.27-.4.09-.16.04-.3-.02-.43-.06-.13-.59-1.42-.81-1.94-.21-.51-.43-.44-.59-.45h-.51c-.17 0-.43.06-.66.3-.23.24-.87.85-.87 2.07 0 1.22.9 2.4 1.03 2.56.13.17 1.78 2.72 4.32 3.81.6.26 1.07.42 1.44.54.6.19 1.14.17 1.57.1.48-.07 1.53-.63 1.75-1.24.22-.61.22-1.14.15-1.25-.07-.11-.24-.17-.5-.3Z"></path></svg>
        <span>WhatsApp</span>
      </button>
    </section>
    <section class="tableBox">
      <h2>All Purchases</h2>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Date</th><th>Deal No</th><th>Party</th><th>Grades</th><th>KG</th><th>Purchase Amount</th><th>Remarks</th></tr></thead>
          <tbody>
            ${report.deals.length ? report.deals.map((d) => `
              <tr><td>${fmtDate(d.date)}</td><td>${esc(d.dealNo)}</td><td>${esc(d.partyName)}</td>
              <td>${esc(getDealGradeLabel(d))}</td><td>${fmtNum(d.totalKg, 3)}</td><td>${fmtMoney(d.totalPurchase)}</td><td>${esc(d.remarks || '—')}</td></tr>`).join('')
              : '<tr><td colspan="7" class="empty">No purchases.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="tableBox">
      <h2>Payment History</h2>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Date</th><th>Payment No</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Remarks</th></tr></thead>
          <tbody>
            ${report.payments.length ? report.payments.map((p) => `
              <tr><td>${fmtDate(p.date)}</td><td>${esc(p.paymentNo)}</td><td>${fmtMoney(p.amount)}</td>
              <td>${esc(p.mode)}</td><td>${esc(p.referenceNo || '—')}</td><td>${esc(p.remarks || '—')}</td></tr>`).join('')
              : '<tr><td colspan="6" class="empty">No payments.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="tableBox">
      <h2>Combined Ledger</h2>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Date</th><th>Ref</th><th>Description</th><th>KG</th><th>Purchase (Cr)</th><th>Payment (Dr)</th><th>Balance</th></tr></thead>
          <tbody>
            ${report.rows.map((r) => `
              <tr><td>${fmtDate(r.date)}</td><td>${esc(r.ref)}</td><td>${esc(r.desc)}</td>
              <td>${r.kg != null ? fmtNum(r.kg, 3) : '—'}</td>
              <td>${r.credit ? fmtMoney(r.credit) : '—'}</td>
              <td>${r.debit ? fmtMoney(r.debit) : '—'}</td>
              <td>${fmtMoney(r.balance)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>` : '<p class="empty-msg">Select a factory to view ledger.</p>'}`;

  const updateFactoryRoute = () => {
    const params = {};
    if (factoryId) params.factoryId = factoryId;
    const searchValue = container.querySelector('#factorySearch')?.value.trim();
    const dateFromValue = container.querySelector('#factoryDateFrom')?.value;
    const dateToValue = container.querySelector('#factoryDateTo')?.value;
    if (searchValue) params.search = searchValue;
    if (dateFromValue) params.dateFrom = dateFromValue;
    if (dateToValue) params.dateTo = dateToValue;
    navigate(ROUTES.factoryLedger, params);
  };

  container.querySelector('#factorySelect')?.addEventListener('change', (e) => {
    factoryId = e.target.value;
    updateFactoryRoute();
  });

  container.querySelector('#factorySearch')?.addEventListener('input', updateFactoryRoute);
  container.querySelector('#factoryDateFrom')?.addEventListener('change', updateFactoryRoute);
  container.querySelector('#factoryDateTo')?.addEventListener('change', updateFactoryRoute);

  if (report && factory) {
    container.querySelector('#factoryExcel').addEventListener('click', () => exportLedgerExcel(report.rows, `factory-${factory.name}`));
    container.querySelector('#factoryPdf').addEventListener('click', () => printLedgerPdf(`Factory Ledger — ${factory.name}`, report, 'FACTORY'));
    container.querySelector('#factoryWhatsAppBtn').addEventListener('click', () => {
      openWhatsApp(factory, buildLedgerWhatsAppMessage('FACTORY', factory, report));
    });
  }
}
