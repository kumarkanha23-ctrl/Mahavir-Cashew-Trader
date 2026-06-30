import {
  getState, calcDeal, calcDealTotals, saveDeal, deleteDeal, saveRate, deleteRate,
  fmtDate, fmtMoney, fmtNum, esc, toast, confirmAction, navigate, uid,
  ROUTES, today, DEFAULT_COMMISSION, filterDeals,
  normalizeDeal, getDealGrades
} from './app.js';
import { exportDealsExcel } from './excel.js';
import { printDealsPdf } from './pdf.js';

export function renderRateMaster(container) {
  const rates = [...getState().rates].sort((a, b) => a.grade.localeCompare(b.grade));

  container.innerHTML = `
    <section class="dealBox">
      <h2>Add / Update Rate</h2>
      <form id="rateForm" class="grid grid-4">
        <input name="grade" placeholder="Grade" required />
        <input name="factoryRate" type="number" step="0.01" min="0" placeholder="Factory Rate (₹/KG)" required />
        <input name="commissionPerKg" type="number" step="0.01" min="0" placeholder="Commission (₹/KG)" value="${DEFAULT_COMMISSION}" required />
        <input name="partyRate" type="number" step="0.01" readonly class="readonly" placeholder="Party Rate" />
        <button type="submit" class="btn btn-primary">Save Rate</button>
      </form>
    </section>
    <section class="tableBox">
      <h2>Rate Master</h2>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Grade</th><th>Factory Rate</th><th>Commission/KG</th><th>Party Rate</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            ${rates.length ? rates.map((r) => `
              <tr>
                <td>${esc(r.grade)}</td>
                <td>${fmtMoney(r.factoryRate)}</td>
                <td>${fmtMoney(r.commissionPerKg)}</td>
                <td>${fmtMoney(r.partyRate)}</td>
                <td>${fmtDate(r.updatedAt?.slice(0, 10))}</td>
                <td class="actions">
                  <button type="button" class="editBtn" data-rate-id="${r.id}">Edit</button>
                  <button type="button" class="deleteBtn" data-del-rate="${r.id}">Delete</button>
                </td>
              </tr>`).join('') : '<tr><td colspan="6" class="empty">No rates defined.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`;

  const form = container.querySelector('#rateForm');
  const preview = () => {
    const c = calcDeal({
      bucket: 1,
      factoryRate: form.factoryRate.value,
      commissionPerKg: form.commissionPerKg.value
    });
    form.partyRate.value = c.partyRate;
  };
  form.factoryRate.addEventListener('input', preview);
  form.commissionPerKg.addEventListener('input', preview);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      saveRate(Object.fromEntries(new FormData(form)));
      toast('Rate saved.');
      form.reset();
      form.commissionPerKg.value = DEFAULT_COMMISSION;
    } catch (err) { toast(err.message, 'error'); }
  });

  container.querySelectorAll('[data-rate-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = getState().rates.find((x) => x.id === btn.dataset.rateId);
      if (!r) return;
      form.grade.value = r.grade;
      form.factoryRate.value = r.factoryRate;
      form.commissionPerKg.value = r.commissionPerKg;
      preview();
    });
  });

  container.querySelectorAll('[data-del-rate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      confirmAction('Delete this rate?', () => { deleteRate(btn.dataset.delRate); toast('Rate deleted.'); });
    });
  });
}

function defaultGradeRow(s, data = {}) {
  return {
    id: data.id || uid('line'),
    grade: data.grade || '',
    bucket: data.bucket ?? '',
    kg: data.kg ?? '',
    factoryRate: data.factoryRate ?? '',
    commissionPerKg: data.commissionPerKg ?? (s.defaultCommissionPerKg ?? DEFAULT_COMMISSION)
  };
}

function renderGradeRowHtml(row, s, grades) {
  const c = calcDeal(row);
  return `
    <tr class="grade-row" data-line-id="${row.id}">
      <td><input type="text" class="grade-input" list="gradeList" value="${esc(row.grade)}" placeholder="Grade" required /></td>
      <td><input type="number" class="bucket-input" step="0.01" min="0" value="${row.bucket}" placeholder="Bucket" /></td>
      <td><input type="number" class="kg-input" step="0.001" min="0" value="${row.kg}" placeholder="KG" data-manual="${row.kg ? '1' : ''}" /></td>
      <td><input type="number" class="factory-rate-input" step="0.01" min="0" value="${row.factoryRate}" placeholder="Rate" required /></td>
      <td><input type="number" class="commission-input" step="0.01" min="0" value="${row.commissionPerKg}" placeholder="Comm" required /></td>
      <td class="calc-cell party-rate-cell">${fmtMoney(c.partyRate)}</td>
      <td class="calc-cell purchase-cell">${fmtMoney(c.purchaseAmount)}</td>
      <td class="calc-cell sale-cell">${fmtMoney(c.saleAmount)}</td>
      <td class="calc-cell profit-cell">${fmtMoney(c.profit)}</td>
      <td class="actions">
        <button type="button" class="deleteBtn remove-grade-btn" title="Remove row" ${grades.length <= 1 ? 'disabled' : ''}>✕</button>
      </td>
    </tr>`;
}

function collectGradeRows(tbody) {
  return [...tbody.querySelectorAll('.grade-row')].map((tr) => ({
    id: tr.dataset.lineId,
    grade: tr.querySelector('.grade-input').value,
    bucket: tr.querySelector('.bucket-input').value,
    kg: tr.querySelector('.kg-input').value,
    factoryRate: tr.querySelector('.factory-rate-input').value,
    commissionPerKg: tr.querySelector('.commission-input').value
  }));
}

function updateRowCalc(tr, s) {
  const row = {
    bucket: tr.querySelector('.bucket-input').value,
    kg: tr.querySelector('.kg-input').value,
    factoryRate: tr.querySelector('.factory-rate-input').value,
    commissionPerKg: tr.querySelector('.commission-input').value
  };
  const kgInput = tr.querySelector('.kg-input');
  const c = calcDeal(row);
  if (!kgInput.dataset.manual && tr.querySelector('.bucket-input').value) {
    kgInput.value = c.kg;
    row.kg = c.kg;
  }
  const cFinal = calcDeal({
    ...row,
    kg: kgInput.value
  });
  tr.querySelector('.party-rate-cell').textContent = fmtMoney(cFinal.partyRate);
  tr.querySelector('.purchase-cell').textContent = fmtMoney(cFinal.purchaseAmount);
  tr.querySelector('.sale-cell').textContent = fmtMoney(cFinal.saleAmount);
  tr.querySelector('.profit-cell').textContent = fmtMoney(cFinal.profit);
}

function updateDealTotals(container) {
  const tbody = container.querySelector('#gradeTableBody');
  const rows = collectGradeRows(tbody);
  const lines = rows.map((r) => calcDeal(r));
  const totals = calcDealTotals(lines.map((c, i) => ({ ...c, grade: rows[i].grade })));
  container.querySelector('#totalBucket').textContent = fmtNum(totals.totalBucket, 2);
  container.querySelector('#totalKg').textContent = fmtNum(totals.totalKg, 3);
  container.querySelector('#totalPurchase').textContent = fmtMoney(totals.totalPurchase);
  container.querySelector('#totalSale').textContent = fmtMoney(totals.totalSale);
  container.querySelector('#totalProfit').textContent = fmtMoney(totals.totalProfit);
  container.querySelector('#totalCommission').textContent = fmtMoney(totals.totalCommission);
}

function bindGradeTable(container, s) {
  const tbody = container.querySelector('#gradeTableBody');

  const refreshAll = () => {
    tbody.querySelectorAll('.grade-row').forEach((tr) => updateRowCalc(tr, s));
    updateDealTotals(container);
    tbody.querySelectorAll('.remove-grade-btn').forEach((btn) => {
      btn.disabled = tbody.querySelectorAll('.grade-row').length <= 1;
    });
  };

  tbody.addEventListener('input', (e) => {
    const tr = e.target.closest('.grade-row');
    if (!tr) return;
    if (e.target.classList.contains('kg-input')) {
      e.target.dataset.manual = e.target.value ? '1' : '';
    }
    updateRowCalc(tr, s);
    updateDealTotals(container);
  });

  tbody.addEventListener('change', (e) => {
    if (!e.target.classList.contains('grade-input')) return;
    const tr = e.target.closest('.grade-row');
    const r = getState().rates.find((x) => x.grade.toLowerCase() === e.target.value.trim().toLowerCase());
    if (r) {
      tr.querySelector('.factory-rate-input').value = r.factoryRate;
      tr.querySelector('.commission-input').value = r.commissionPerKg;
      updateRowCalc(tr, s);
      updateDealTotals(container);
    }
  });

  tbody.addEventListener('click', (e) => {
    if (!e.target.classList.contains('remove-grade-btn')) return;
    if (tbody.querySelectorAll('.grade-row').length <= 1) return;
    e.target.closest('.grade-row').remove();
    refreshAll();
  });

  container.querySelector('#addGradeBtn').addEventListener('click', () => {
    const row = defaultGradeRow(s);
    tbody.insertAdjacentHTML('beforeend', renderGradeRowHtml(row, s, [...tbody.querySelectorAll('.grade-row'), {}]));
    refreshAll();
  });

  refreshAll();
}

export function renderNewDeal(container, editId = null) {
  const s = getState().settings;
  const raw = editId ? getState().deals.find((x) => x.id === editId) : null;
  const d = raw ? normalizeDeal(raw) : null;
  const parties = getState().parties.map((p) => `<option value="${esc(p.name)}">`).join('');
  const factories = getState().factories.map((f) => `<option value="${esc(f.name)}">`).join('');
  const grades = getState().rates.map((r) => `<option value="${esc(r.grade)}">`).join('');
  const initialRows = d ? getDealGrades(d).map((g) => defaultGradeRow(s, g)) : [defaultGradeRow(s)];
  const dealType = d?.type || 'SALE';

  container.innerHTML = `
    <section class="dealBox">
      <h2>${d ? 'Edit Deal' : 'New Deal'}</h2>
      
      <div class="deal-type-selector">
        <label>Transaction Type:</label>
        <div class="type-buttons">
          <button type="button" class="type-btn ${dealType === 'PURCHASE' ? 'active' : ''}" data-type="PURCHASE" onclick="document.querySelector('input[name=dealType]').value = 'PURCHASE'; this.parentElement.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active')); this.classList.add('active');">
            🔄 Purchase (Factory→Party)
          </button>
          <button type="button" class="type-btn ${dealType === 'SALE' ? 'active' : ''}" data-type="SALE" onclick="document.querySelector('input[name=dealType]').value = 'SALE'; this.parentElement.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active')); this.classList.add('active');">
            💰 Sale (Party→Customer)
          </button>
        </div>
        <input type="hidden" name="dealType" value="${dealType}" />
      </div>
      
      <form id="dealForm">
        <div class="deal-header grid grid-4">
          ${d ? `<label>Deal No<input type="text" readonly class="readonly" value="${esc(d.dealNo)}" /></label>` : ''}
          <label>Date<input name="date" type="date" value="${d?.date || today()}" required /></label>
          <label>Party<input name="partyName" list="partyList" placeholder="Party Name" value="${esc(d?.partyName || '')}" required /></label>
          <label>Factory<input name="factoryName" list="factoryList" placeholder="Factory Name" value="${esc(d?.factoryName || '')}" required /></label>
        </div>

        <div class="grade-table-wrap">
          <div class="table-header-row">
            <h3>Grade Lines</h3>
            <button type="button" class="btn btn-secondary" id="addGradeBtn">+ Add Grade</button>
          </div>
          <div class="tableResponsive">
            <table class="grade-table">
              <thead>
                <tr>
                  <th>Grade</th><th>Bucket</th><th>KG</th><th>Factory Rate</th><th>Commission</th>
                  <th>Party Rate</th><th>Purchase Amount</th><th>Sale Amount</th><th>Profit</th><th></th>
                </tr>
              </thead>
              <tbody id="gradeTableBody">
                ${initialRows.map((row) => renderGradeRowHtml(row, s, initialRows)).join('')}
              </tbody>
              <tfoot>
                <tr class="grade-totals-row">
                  <td colspan="2"><strong>Total Bucket</strong><br /><span id="totalBucket">0</span></td>
                  <td><strong>Total KG</strong><br /><span id="totalKg">0</span></td>
                  <td colspan="3"></td>
                  <td><strong>Total Purchase</strong><br /><span id="totalPurchase">₹0.00</span></td>
                  <td><strong>Total Sale</strong><br /><span id="totalSale">₹0.00</span></td>
                  <td><strong>Total Profit</strong><br /><span id="totalProfit">₹0.00</span></td>
                  <td><strong>Total Commission</strong><br /><span id="totalCommission">₹0.00</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="deal-footer">
          <input name="remarks" placeholder="Remarks" value="${esc(d?.remarks || '')}" />
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${d ? 'Update Deal' : 'Save Deal'}</button>
            ${d ? '' : '<button type="button" class="btn btn-secondary" id="resetDeal">Reset</button>'}
            <button type="button" class="btn btn-secondary" id="cancelDeal" onclick="window.history.back()">Cancel</button>
          </div>
        </div>

        <datalist id="partyList">${parties}</datalist>
        <datalist id="factoryList">${factories}</datalist>
        <datalist id="gradeList">${grades}</datalist>
      </form>
      <p class="hint">Party Rate = Factory Rate + Commission | Purchase = KG × Factory Rate | Sale = KG × Party Rate | Profit = KG × Commission. All grades save under one deal number.</p>
    </section>`;

  bindGradeTable(container, s);

  const form = container.querySelector('#dealForm');
  const dealTypeInput = container.querySelector('input[name=dealType]');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(form);
      saveDeal({
        type: dealTypeInput.value || 'SALE',
        date: fd.get('date'),
        partyName: fd.get('partyName'),
        factoryName: fd.get('factoryName'),
        remarks: fd.get('remarks'),
        grades: collectGradeRows(container.querySelector('#gradeTableBody'))
      }, editId || null);
      toast(d ? 'Deal updated.' : 'Deal saved.');
      navigate(ROUTES.recentDeals);
    } catch (err) { toast(err.message, 'error'); }
  });

  container.querySelector('#resetDeal')?.addEventListener('click', () => {
    renderNewDeal(container, null);
  });
}

let dealFilters = {};

function renderDealDetailRows(deal) {
  const d = normalizeDeal(deal);
  if (d.grades.length <= 1) {
    const g = d.grades[0];
    return `<tr>
      <td>${esc(d.dealNo)}</td><td>${fmtDate(d.date)}</td>
      <td>${esc(d.partyName)}</td><td>${esc(d.factoryName)}</td>
      <td>${esc(g?.grade || '—')}</td><td>${g?.bucket ?? '—'}</td><td>${fmtNum(d.totalKg, 3)}</td>
      <td>${g ? fmtMoney(g.factoryRate) : '—'}</td><td>${g ? fmtMoney(g.commissionPerKg) : '—'}</td>
      <td>${g ? fmtMoney(g.partyRate) : '—'}</td>
      <td>${fmtMoney(d.totalPurchase)}</td><td>${fmtMoney(d.totalSale)}</td><td>${fmtMoney(d.totalProfit)}</td>
      <td>${esc(d.remarks || '—')}</td>
      <td class="actions">
        <button type="button" class="editBtn" data-edit="${d.id}">Edit</button>
        <button type="button" class="deleteBtn" data-del="${d.id}">Delete</button>
      </td>
    </tr>`;
  }
  const gradeRows = d.grades.map((g, i) => `
    <tr class="grade-sub-row">
      <td>${i === 0 ? esc(d.dealNo) : ''}</td>
      <td>${i === 0 ? fmtDate(d.date) : ''}</td>
      <td>${i === 0 ? esc(d.partyName) : ''}</td>
      <td>${i === 0 ? esc(d.factoryName) : ''}</td>
      <td>${esc(g.grade)}</td><td>${g.bucket}</td><td>${fmtNum(g.kg, 3)}</td>
      <td>${fmtMoney(g.factoryRate)}</td><td>${fmtMoney(g.commissionPerKg)}</td>
      <td>${fmtMoney(g.partyRate)}</td>
      <td>${fmtMoney(g.purchaseAmount)}</td><td>${fmtMoney(g.saleAmount)}</td><td>${fmtMoney(g.profit)}</td>
      <td>${i === 0 ? esc(d.remarks || '—') : ''}</td>
      <td class="actions">${i === 0 ? `
        <button type="button" class="editBtn" data-edit="${d.id}">Edit</button>
        <button type="button" class="deleteBtn" data-del="${d.id}">Delete</button>` : ''}</td>
    </tr>`).join('');
  const totalRow = `
    <tr class="deal-total-row">
      <td colspan="5"><strong>Deal Total</strong></td>
      <td><strong>${fmtNum(d.totalBucket, 2)}</strong></td>
      <td><strong>${fmtNum(d.totalKg, 3)}</strong></td>
      <td colspan="3"></td>
      <td><strong>${fmtMoney(d.totalPurchase)}</strong></td>
      <td><strong>${fmtMoney(d.totalSale)}</strong></td>
      <td><strong>${fmtMoney(d.totalProfit)}</strong></td>
      <td></td><td></td>
    </tr>`;
  return gradeRows + totalRow;
}

export function renderRecentDeals(container) {
  const deals = filterDeals(dealFilters);
  const totals = {
    bucket: deals.reduce((a, d) => a + d.totalBucket, 0),
    kg: deals.reduce((a, d) => a + d.totalKg, 0),
    purchase: deals.reduce((a, d) => a + d.totalPurchase, 0),
    sale: deals.reduce((a, d) => a + d.totalSale, 0),
    profit: deals.reduce((a, d) => a + d.totalProfit, 0),
    commission: deals.reduce((a, d) => a + d.totalCommission, 0)
  };
  const partyOpts = getState().parties.map((p) => `<option value="${p.id}" ${dealFilters.partyId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

  container.innerHTML = `
    <section class="filter-bar">
      <input type="search" id="dealSearch" placeholder="Search deals..." value="${esc(dealFilters.search || '')}" />
      <label>From <input type="date" id="dealFrom" value="${dealFilters.dateFrom || ''}" /></label>
      <label>To <input type="date" id="dealTo" value="${dealFilters.dateTo || today()}" /></label>
      <select id="dealParty"><option value="">All Parties</option>${partyOpts}</select>
    </section>
    <section class="action-bar">
      <button type="button" class="btn btn-secondary" id="exportDealsExcel">Excel Export</button>
      <button type="button" class="btn btn-secondary" id="exportDealsPdf">PDF / Print</button>
    </section>
    <section class="tableBox">
      <h2>Recent Deals (${deals.length})</h2>
      <div class="tableResponsive">
        <table>
          <thead>
            <tr>
              <th>Deal No</th><th>Date</th><th>Party</th><th>Factory</th><th>Grade</th>
              <th>Bucket</th><th>KG</th><th>Factory Rate</th><th>Comm/KG</th><th>Party Rate</th>
              <th>Purchase</th><th>Sale</th><th>Profit</th><th>Remarks</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${deals.length ? deals.map((d) => renderDealDetailRows(d)).join('') : '<tr><td colspan="15" class="empty">No deals found.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="table-totals">
        <span>Total Bucket: ${fmtNum(totals.bucket, 2)}</span>
        <span>Total KG: ${fmtNum(totals.kg, 3)}</span>
        <span>Purchase: ${fmtMoney(totals.purchase)}</span>
        <span>Sale: ${fmtMoney(totals.sale)}</span>
        <span>Profit: ${fmtMoney(totals.profit)}</span>
        <span>Commission: ${fmtMoney(totals.commission)}</span>
      </div>
    </section>`;

  const applyFilters = () => {
    dealFilters = {
      search: container.querySelector('#dealSearch').value,
      dateFrom: container.querySelector('#dealFrom').value,
      dateTo: container.querySelector('#dealTo').value,
      partyId: container.querySelector('#dealParty').value || undefined
    };
    renderRecentDeals(container);
  };

  container.querySelector('#dealSearch').addEventListener('input', applyFilters);
  container.querySelector('#dealFrom').addEventListener('change', applyFilters);
  container.querySelector('#dealTo').addEventListener('change', applyFilters);
  container.querySelector('#dealParty').addEventListener('change', applyFilters);

  container.querySelector('#exportDealsExcel').addEventListener('click', () => exportDealsExcel(deals, 'recent-deals'));
  container.querySelector('#exportDealsPdf').addEventListener('click', () => printDealsPdf('Recent Deals', deals, totals));

  container.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', () => navigate(ROUTES.newDeal, { id: b.dataset.edit }));
  });
  container.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      confirmAction('Delete this deal?', () => { deleteDeal(b.dataset.del); toast('Deal deleted.'); });
    });
  });
}
