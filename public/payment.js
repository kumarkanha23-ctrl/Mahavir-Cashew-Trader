import {
  getState, savePayment, deletePayment, partyLedger, factoryLedger,
  fmtDate, fmtMoney, esc, toast, confirmAction, today, PAYMENT_MODES
} from './app.js';
import { exportPaymentsExcel } from './excel.js';

export function renderPartyPayment(container) {
  const parties = getState().parties.sort((a, b) => a.name.localeCompare(b.name));
  const payments = getState().payments.filter((p) => p.type === 'PARTY').sort((a, b) => b.date.localeCompare(a.date));
  const total = payments.reduce((a, p) => a + p.amount, 0);

  container.innerHTML = `
    <section class="dealBox">
      <h2>Record Party Payment (Received)</h2>
      <form id="partyPayForm" class="grid grid-4">
        <select name="partyId" id="partyPaySelect" required>
          <option value="">-- Select Party --</option>
          ${parties.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
        </select>
        <input name="date" type="date" value="${today()}" required />
        <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount (₹)" required />
        <select name="mode">${PAYMENT_MODES.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
        <input name="referenceNo" placeholder="Reference / UTR" />
        <input name="remarks" placeholder="Remarks" class="span-2" />
        <div class="outstanding-box" id="partyOut">Outstanding: —</div>
        <button type="submit" class="btn btn-primary">Save Payment</button>
      </form>
    </section>
    <section class="summaryGrid">
      <div class="summaryCard"><h3>Total Received</h3><h2>${fmtMoney(total)}</h2></div>
      <div class="summaryCard"><h3>Payment Count</h3><h2>${payments.length}</h2></div>
    </section>
    <section class="tableBox">
      <div class="table-header-row">
        <h2>Party Payment History</h2>
        <button type="button" class="btn btn-secondary" id="exportPartyPay">Excel Export</button>
      </div>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Date</th><th>Payment No</th><th>Party</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Remarks</th><th>Actions</th></tr></thead>
          <tbody>
            ${payments.length ? payments.map((p) => `
              <tr>
                <td>${fmtDate(p.date)}</td><td>${esc(p.paymentNo)}</td><td>${esc(p.entityName)}</td>
                <td>${fmtMoney(p.amount)}</td><td>${esc(p.mode)}</td>
                <td>${esc(p.referenceNo || '—')}</td><td>${esc(p.remarks || '—')}</td>
                <td><button type="button" class="deleteBtn" data-del="${p.id}">Delete</button></td>
              </tr>`).join('') : '<tr><td colspan="8" class="empty">No payments recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`;

  const form = container.querySelector('#partyPayForm');
  const outEl = container.querySelector('#partyOut');

  container.querySelector('#partyPaySelect').addEventListener('change', (e) => {
    if (e.target.value) {
      const r = partyLedger(e.target.value);
      outEl.textContent = `Outstanding: ${fmtMoney(r.outstanding)}`;
    } else outEl.textContent = 'Outstanding: —';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      savePayment(Object.fromEntries(new FormData(form)), 'PARTY');
      toast('Payment recorded.');
      form.reset();
      form.date.value = today();
      outEl.textContent = 'Outstanding: —';
    } catch (err) { toast(err.message, 'error'); }
  });

  container.querySelector('#exportPartyPay').addEventListener('click', () => exportPaymentsExcel(payments, 'party-payments'));
  container.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      confirmAction('Delete this payment?', () => { deletePayment(b.dataset.del); toast('Payment deleted.'); });
    });
  });
}

export function renderFactoryPayment(container) {
  const factories = getState().factories.sort((a, b) => a.name.localeCompare(b.name));
  const payments = getState().payments.filter((p) => p.type === 'FACTORY').sort((a, b) => b.date.localeCompare(a.date));
  const total = payments.reduce((a, p) => a + p.amount, 0);

  container.innerHTML = `
    <section class="dealBox">
      <h2>Record Factory Payment (Paid)</h2>
      <form id="factoryPayForm" class="grid grid-4">
        <select name="factoryId" id="factoryPaySelect" required>
          <option value="">-- Select Factory --</option>
          ${factories.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
        </select>
        <input name="date" type="date" value="${today()}" required />
        <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount (₹)" required />
        <select name="mode">${PAYMENT_MODES.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
        <input name="referenceNo" placeholder="Reference / UTR" />
        <input name="remarks" placeholder="Remarks" class="span-2" />
        <div class="outstanding-box" id="factoryOut">Outstanding: —</div>
        <button type="submit" class="btn btn-primary">Save Payment</button>
      </form>
    </section>
    <section class="summaryGrid">
      <div class="summaryCard"><h3>Total Paid</h3><h2>${fmtMoney(total)}</h2></div>
      <div class="summaryCard"><h3>Payment Count</h3><h2>${payments.length}</h2></div>
    </section>
    <section class="tableBox">
      <div class="table-header-row">
        <h2>Factory Payment History</h2>
        <button type="button" class="btn btn-secondary" id="exportFactoryPay">Excel Export</button>
      </div>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Date</th><th>Payment No</th><th>Factory</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Remarks</th><th>Actions</th></tr></thead>
          <tbody>
            ${payments.length ? payments.map((p) => `
              <tr>
                <td>${fmtDate(p.date)}</td><td>${esc(p.paymentNo)}</td><td>${esc(p.entityName)}</td>
                <td>${fmtMoney(p.amount)}</td><td>${esc(p.mode)}</td>
                <td>${esc(p.referenceNo || '—')}</td><td>${esc(p.remarks || '—')}</td>
                <td><button type="button" class="deleteBtn" data-del="${p.id}">Delete</button></td>
              </tr>`).join('') : '<tr><td colspan="8" class="empty">No payments recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`;

  const form = container.querySelector('#factoryPayForm');
  const outEl = container.querySelector('#factoryOut');

  container.querySelector('#factoryPaySelect').addEventListener('change', (e) => {
    if (e.target.value) {
      const r = factoryLedger(e.target.value);
      outEl.textContent = `Outstanding: ${fmtMoney(r.outstanding)}`;
    } else outEl.textContent = 'Outstanding: —';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      savePayment(Object.fromEntries(new FormData(form)), 'FACTORY');
      toast('Payment recorded.');
      form.reset();
      form.date.value = today();
      outEl.textContent = 'Outstanding: —';
    } catch (err) { toast(err.message, 'error'); }
  });

  container.querySelector('#exportFactoryPay').addEventListener('click', () => exportPaymentsExcel(payments, 'factory-payments'));
  container.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      confirmAction('Delete this payment?', () => { deletePayment(b.dataset.del); toast('Payment deleted.'); });
    });
  });
}
