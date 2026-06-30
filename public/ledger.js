import {
  getState, partyLedger, factoryLedger, fmtDate, fmtMoney, fmtNum, esc, navigate, ROUTES, getDealGradeLabel
} from './app.js';
import { exportLedgerExcel } from './excel.js';
import { printLedgerPdf } from './pdf.js';

export function renderPartyLedger(container, partyId = null) {
  const parties = getState().parties.sort((a, b) => a.name.localeCompare(b.name));
  const party = partyId ? parties.find((p) => p.id === partyId) : null;
  const report = party ? partyLedger(partyId) : null;

  container.innerHTML = `
    <section class="filter-bar">
      <label>Select Party
        <select id="partySelect">
          <option value="">-- Select Party --</option>
          ${parties.map((p) => `<option value="${p.id}" ${p.id === partyId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </label>
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

  container.querySelector('#partySelect')?.addEventListener('change', (e) => {
    if (e.target.value) navigate(ROUTES.partyLedger, { partyId: e.target.value });
  });

  if (report && party) {
    container.querySelector('#partyExcel').addEventListener('click', () => exportLedgerExcel(report.rows, `party-${party.name}`));
    container.querySelector('#partyPdf').addEventListener('click', () => printLedgerPdf(`Party Ledger — ${party.name}`, report, 'PARTY'));
  }
}

export function renderFactoryLedger(container, factoryId = null) {
  const factories = getState().factories.sort((a, b) => a.name.localeCompare(b.name));
  const factory = factoryId ? factories.find((f) => f.id === factoryId) : null;
  const report = factory ? factoryLedger(factoryId) : null;

  container.innerHTML = `
    <section class="filter-bar">
      <label>Select Factory
        <select id="factorySelect">
          <option value="">-- Select Factory --</option>
          ${factories.map((f) => `<option value="${f.id}" ${f.id === factoryId ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
        </select>
      </label>
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

  container.querySelector('#factorySelect')?.addEventListener('change', (e) => {
    if (e.target.value) navigate(ROUTES.factoryLedger, { factoryId: e.target.value });
  });

  if (report && factory) {
    container.querySelector('#factoryExcel').addEventListener('click', () => exportLedgerExcel(report.rows, `factory-${factory.name}`));
    container.querySelector('#factoryPdf').addEventListener('click', () => printLedgerPdf(`Factory Ledger — ${factory.name}`, report, 'FACTORY'));
  }
}
