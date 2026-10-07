import {
  getState, calcDeal, calcDealTotals, saveDeal, deleteDeal, saveRate, saveRates, deleteRate,
  fmtDate, fmtMoney, fmtNum, round, num, esc, toast, confirmAction, navigate, uid,
  ROUTES, today, DEFAULT_COMMISSION, filterDeals,
  findOrCreateFactory, copyRatesBetweenFactories, getRateForFactory,
  normalizeDeal, getDealGrades, dashboardMetrics, buildRecentDealsWhatsAppMessage,
  openWhatsApp, openWhatsAppForDeal
} from './app.js';
import { exportDealsExcel, importRatesFromCsv } from './excel.js';

const LEGACY_RATE_FACTORY = '__legacy_rates__';
let activeRateFilter = 'all';

function renderCopyLotModal() {
  const { factories, rates } = getState();
  const sourceFactories = factories.filter((factory) => rates.some((rate) => rate.factoryId === factory.id));
  if (factories.length < 2) {
    toast('Add at least two factories before copying rates.', 'error');
    return;
  }
  if (!sourceFactories.length) {
    toast('Add factory-specific rates before copying a lot.', 'error');
    return;
  }

  const sourceFactoryId = sourceFactories[0].id;
  const targetFactoryId = factories.find((factory) => factory.id !== sourceFactoryId)?.id || '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box copy-lot-modal" role="dialog" aria-modal="true" aria-labelledby="copyLotTitle">
      <h3 id="copyLotTitle">Copy Lot</h3>
      <div class="copy-lot-factories">
        <label>Copy From
          <select id="copyLotSource">${sourceFactories.map((factory) => `<option value="${esc(factory.id)}">${esc(factory.name)}</option>`).join('')}</select>
        </label>
        <label>Copy To
          <select id="copyLotTarget">${factories.map((factory) => `<option value="${esc(factory.id)}" ${factory.id === targetFactoryId ? 'selected' : ''}>${esc(factory.name)}</option>`).join('')}</select>
        </label>
      </div>
      <p class="copy-lot-intro">Choose how existing destination grades should be handled. New grades are always added.</p>
      <div class="copy-lot-modes" role="group" aria-label="Existing rate handling">
        <button type="button" class="btn btn-primary" data-copy-mode="missing">Add Missing Only</button>
        <button type="button" class="btn btn-secondary" data-copy-mode="keep">Keep Existing</button>
        <button type="button" class="btn btn-secondary" data-copy-mode="replace">Replace Existing</button>
      </div>
      <div class="copy-lot-table tableResponsive">
        <table>
          <thead><tr><th>Grade</th><th>Source Rate</th><th>Target Rate</th><th>Action</th></tr></thead>
          <tbody id="copyLotRows"></tbody>
        </table>
      </div>
      <div class="copy-lot-summary" id="copyLotSummary"></div>
      <p class="copy-lot-error" id="copyLotError"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-copy-cancel>Cancel</button>
        <button type="button" class="btn btn-primary" data-copy-confirm>Copy Rates</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const sourceSelect = overlay.querySelector('#copyLotSource');
  const targetSelect = overlay.querySelector('#copyLotTarget');
  const rows = overlay.querySelector('#copyLotRows');
  const summary = overlay.querySelector('#copyLotSummary');
  const error = overlay.querySelector('#copyLotError');
  const replaceGrades = new Set();
  let copyMode = 'missing';
  let sourceRates = [];
  let conflicts = [];

  const renderPreview = () => {
    const state = getState();
    sourceRates = state.rates.filter((rate) => rate.factoryId === sourceSelect.value)
      .sort((a, b) => a.grade.localeCompare(b.grade));
    const targetRates = state.rates.filter((rate) => rate.factoryId === targetSelect.value);
    conflicts = sourceRates.map((rate) => ({
      rate,
      target: targetRates.find((target) => target.grade.toLowerCase() === rate.grade.toLowerCase())
    })).filter((entry) => entry.target);

    if (copyMode === 'replace') {
      replaceGrades.clear();
      conflicts.forEach(({ rate }) => replaceGrades.add(rate.grade.toLowerCase()));
    } else {
      const currentConflicts = new Set(conflicts.map(({ rate }) => rate.grade.toLowerCase()));
      [...replaceGrades].forEach((grade) => {
        if (!currentConflicts.has(grade)) replaceGrades.delete(grade);
      });
    }

    rows.innerHTML = sourceRates.length ? sourceRates.map((rate, index) => {
      const target = targetRates.find((item) => item.grade.toLowerCase() === rate.grade.toLowerCase());
      const replacing = target && replaceGrades.has(rate.grade.toLowerCase());
      return `<tr>
        <td>${esc(rate.grade)}</td>
        <td>${fmtMoney(rate.factoryRate)}</td>
        <td>${target ? fmtMoney(target.factoryRate) : '—'}</td>
        <td>${target
          ? `<button type="button" class="btn btn-secondary copy-lot-grade-action" data-copy-index="${index}">${replacing ? 'Keep Existing' : 'Replace Existing'}</button>`
          : '<span class="copy-lot-new">New grade</span>'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="empty">No source factory rates found.</td></tr>';

    const newCount = sourceRates.length - conflicts.length;
    const willReplace = conflicts.filter(({ rate }) => replaceGrades.has(rate.grade.toLowerCase())).length;
    const sourceName = state.factories.find((factory) => factory.id === sourceSelect.value)?.name || '—';
    const targetName = state.factories.find((factory) => factory.id === targetSelect.value)?.name || '—';
    summary.innerHTML = `<strong>Copy rates from ${esc(sourceName)} to ${esc(targetName)}</strong>
      <span>Total Grades: ${sourceRates.length}</span>
      <span>New Grades: ${newCount}</span>
      <span>Already Existing: ${conflicts.length}</span>
      <span>Will Replace: ${willReplace}</span>`;

    const sameFactory = sourceSelect.value === targetSelect.value;
    error.textContent = sameFactory ? 'Choose different source and destination factories.' : '';
    overlay.querySelector('[data-copy-confirm]').disabled = sameFactory || sourceRates.length === 0;
    overlay.querySelectorAll('[data-copy-mode]').forEach((button) => {
      const selected = button.dataset.copyMode === copyMode;
      button.classList.toggle('btn-primary', selected);
      button.classList.toggle('btn-secondary', !selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  sourceSelect.addEventListener('change', () => {
    replaceGrades.clear();
    renderPreview();
  });
  targetSelect.addEventListener('change', () => {
    replaceGrades.clear();
    renderPreview();
  });
  overlay.querySelectorAll('[data-copy-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      copyMode = button.dataset.copyMode;
      if (copyMode !== 'replace') replaceGrades.clear();
      renderPreview();
    });
  });
  rows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy-index]');
    if (!button) return;
    const rate = sourceRates[Number(button.dataset.copyIndex)];
    if (!rate) return;
    const grade = rate.grade.toLowerCase();
    if (replaceGrades.has(grade)) replaceGrades.delete(grade);
    else replaceGrades.add(grade);
    copyMode = 'custom';
    renderPreview();
  });
  overlay.querySelector('[data-copy-cancel]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-copy-confirm]').addEventListener('click', () => {
    try {
      const result = copyRatesBetweenFactories(sourceSelect.value, targetSelect.value, [...replaceGrades]);
      overlay.remove();
      toast(`Copy Completed. Added: ${result.added} | Skipped: ${result.skipped} | Replaced: ${result.replaced}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  renderPreview();
}

export function renderRateMaster(container) {
  const { rates, factories } = getState();
  const filteredRates = [...rates]
    .filter((rate) => activeRateFilter === 'all'
      || (activeRateFilter === LEGACY_RATE_FACTORY ? !rate.factoryId : rate.factoryId === activeRateFilter))
    .sort((a, b) => a.grade.localeCompare(b.grade));
  const factoryOptions = factories.map((factory) => `<option value="${esc(factory.id)}">${esc(factory.name)}</option>`).join('');
  const rateFilterOptions = factories.map((factory) => `<option value="${esc(factory.id)}" ${activeRateFilter === factory.id ? 'selected' : ''}>${esc(factory.name)}</option>`).join('');
  const legacySelected = activeRateFilter === LEGACY_RATE_FACTORY ? 'selected' : '';

  container.innerHTML = `
    <section class="dealBox">
      <h2>Add / Update Rate</h2>
      <form id="rateForm" class="grid grid-4">
        <label>Factory
          <select name="factoryId" required>
            <option value="">Select factory</option>
            <option value="${LEGACY_RATE_FACTORY}">Unassigned (legacy / all factories)</option>
            ${factoryOptions}
          </select>
        </label>
        <input name="grade" placeholder="Grade" required />
        <input name="factoryRate" type="number" step="0.01" min="0" placeholder="Factory Rate (₹/KG)" required />
        <input name="commissionPerKg" type="number" step="0.01" min="0" placeholder="Commission (₹/KG)" value="${DEFAULT_COMMISSION}" required />
        <input name="partyRate" type="number" step="0.01" readonly class="readonly" placeholder="Party Rate" />
        <input name="rateId" type="hidden" />
        <button type="submit" class="btn btn-primary">Add / Update Rate</button>
      </form>
    </section>
    <section class="action-bar">
      <label class="btn btn-secondary file-btn">
        <span aria-hidden="true">⬆</span> Import Rates from CSV
        <input type="file" accept=".csv" id="importRatesCsv" hidden />
      </label>
      <button type="button" class="btn btn-secondary" id="copyLotBtn">Copy Lot</button>
    </section>
    <section class="tableBox">
      <h2>Rate Master</h2>
      <label class="rate-factory-filter">Factory
        <select id="rateFactoryFilter">
          <option value="all">All Factories</option>
          <option value="${LEGACY_RATE_FACTORY}" ${legacySelected}>Unassigned (legacy)</option>
          ${rateFilterOptions}
        </select>
      </label>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Factory</th><th>Grade</th><th>Factory Rate</th><th>Commission/KG</th><th>Party Rate</th><th>Updated Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${filteredRates.length ? filteredRates.map((r) => `
              <tr>
                <td>${esc(factories.find((factory) => factory.id === r.factoryId)?.name || 'Unassigned (legacy)')}</td>
                <td>${esc(r.grade)}</td>
                <td>${fmtMoney(r.factoryRate)}</td>
                <td>${fmtMoney(r.commissionPerKg)}</td>
                <td>${fmtMoney(r.partyRate)}</td>
                <td>${fmtDate(r.updatedAt?.slice(0, 10))}</td>
                <td class="actions">
                  <button type="button" class="editBtn" data-rate-id="${r.id}">Edit</button>
                  <button type="button" class="deleteBtn" data-del-rate="${r.id}">Delete</button>
                </td>
              </tr>`).join('') : '<tr><td colspan="7" class="empty">No rates defined.</td></tr>'}
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
      const input = Object.fromEntries(new FormData(form));
      if (input.factoryId === LEGACY_RATE_FACTORY) delete input.factoryId;
      input.id = input.rateId || undefined;
      delete input.rateId;
      saveRate(input);
      toast('Rate saved.');
    } catch (err) { toast(err.message, 'error'); }
  });

  form.querySelector('[name=factoryId]').value = activeRateFilter === LEGACY_RATE_FACTORY
    ? LEGACY_RATE_FACTORY
    : (activeRateFilter === 'all' ? '' : activeRateFilter);
  container.querySelector('#rateFactoryFilter').addEventListener('change', (event) => {
    activeRateFilter = event.target.value;
    renderRateMaster(container);
  });
  container.querySelector('#copyLotBtn').addEventListener('click', renderCopyLotModal);

  container.querySelectorAll('[data-rate-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = getState().rates.find((x) => x.id === btn.dataset.rateId);
      if (!r) return;
      form.factoryId.value = r.factoryId || LEGACY_RATE_FACTORY;
      form.rateId.value = r.id;
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

  const importInput = container.querySelector('#importRatesCsv');
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    importInput.value = '';
    if (!file) return;
    try {
      const result = await importRatesFromCsv(file);
      if (result.ratesData && result.ratesData.length > 0) {
        const importedRates = result.ratesData.map((rate) => {
          if (!rate.factoryName) return rate;
          const factory = findOrCreateFactory(rate.factoryName);
          return { ...rate, factoryId: factory.id };
        });
        saveRates(importedRates);
      }
      toast(`Imported ${result.imported} rates successfully.`);
      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }
      renderRateMaster(container);
    } catch (err) {
      toast(err.message, 'error');
    }
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

function formatRemarkHtml(remark) {
  const r = (remark || '').trim();
  if (!r) return '—';
  const display = r.length > 40 ? `${esc(r.slice(0, 40))}...` : esc(r);
  const title = esc(r);
  return `<span title="${title}">${display}</span>`;
}

function renderGradeRowHtml(row, s, grades) {
  const bucketToKg = s.bucketToKg || 10;
  const bucketValue = row.bucket !== '' && row.bucket != null
    ? row.bucket
    : (row.kg !== '' && row.kg != null ? round(num(row.kg) / bucketToKg, 2) : '');
  const kgValue = row.kg !== '' && row.kg != null
    ? row.kg
    : (bucketValue !== '' ? round(num(bucketValue) * bucketToKg, 3) : '');
  const c = calcDeal({ ...row, bucket: bucketValue, kg: kgValue });
  return `
    <tr class="grade-row" data-line-id="${row.id}">
      <td><input type="text" class="grade-input" list="gradeList" value="${esc(row.grade)}" placeholder="Grade" required /></td>
      <td><input type="number" class="bucket-input" step="0.01" min="0" value="${bucketValue}" placeholder="Bucket" /></td>
      <td><input type="number" class="kg-input" step="0.001" min="0" value="${kgValue}" placeholder="KG" /></td>
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

function updateRowCalc(tr, s, changedField = null) {
  const bucketInput = tr.querySelector('.bucket-input');
  const kgInput = tr.querySelector('.kg-input');
  const bucketToKg = s.bucketToKg || 10;
  let nextBucket = bucketInput.value;
  let nextKg = kgInput.value;

  if (changedField === 'bucket') {
    if (bucketInput.value === '' || bucketInput.value == null) {
      nextKg = '';
    } else {
      nextKg = round(num(bucketInput.value) * bucketToKg, 3);
    }
  } else if (changedField === 'kg') {
    if (kgInput.value === '' || kgInput.value == null) {
      nextBucket = '';
    } else {
      nextBucket = round(num(kgInput.value) / bucketToKg, 2);
    }
  } else if (nextBucket !== '' && nextBucket != null) {
    nextKg = round(num(nextBucket) * bucketToKg, 3);
  } else if (nextKg !== '' && nextKg != null) {
    nextBucket = round(num(nextKg) / bucketToKg, 2);
  } else {
    nextBucket = '';
    nextKg = '';
  }

  bucketInput.value = nextBucket;
  kgInput.value = nextKg;

  const row = {
    bucket: nextBucket,
    kg: nextKg,
    factoryRate: tr.querySelector('.factory-rate-input').value,
    commissionPerKg: tr.querySelector('.commission-input').value
  };

  const cFinal = calcDeal(row);
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

  const findFactoryRate = (grade) => {
    const currentState = getState();
    const factoryName = container.querySelector('[name=factoryName]').value.trim().toLowerCase();
    const factory = currentState.factories.find((item) => item.name.trim().toLowerCase() === factoryName);
    return getRateForFactory(grade, factory?.id);
  };

  const refreshAll = () => {
    tbody.querySelectorAll('.grade-row').forEach((tr) => updateRowCalc(tr, s));
    updateDealTotals(container);
    tbody.querySelectorAll('.remove-grade-btn').forEach((btn) => {
      btn.disabled = tbody.querySelectorAll('.grade-row').length <= 1;
    });
  };

  // Named handlers so they can be removed/rebound when rows change
  function onInput(e) {
    const tr = e.target.closest('.grade-row');
    if (!tr) return;
    const changedField = e.target.classList.contains('bucket-input') ? 'bucket'
      : e.target.classList.contains('kg-input') ? 'kg'
      : null;
    updateRowCalc(tr, s, changedField);
    updateDealTotals(container);
  }

  function onChange(e) {
    if (!e.target.classList.contains('grade-input')) return;
    const tr = e.target.closest('.grade-row');
    const r = findFactoryRate(e.target.value);
    if (r) {
      tr.querySelector('.factory-rate-input').value = r.factoryRate;
      tr.querySelector('.commission-input').value = r.commissionPerKg;
      updateRowCalc(tr, s);
      updateDealTotals(container);
    }
  }

  function onClick(e) {
    if (!e.target.classList.contains('remove-grade-btn')) return;
    if (tbody.querySelectorAll('.grade-row').length <= 1) return;
    e.target.closest('.grade-row').remove();
    refreshAll();
  }

  // Attach delegation handlers once
  tbody.addEventListener('input', onInput);
  tbody.addEventListener('change', onChange);
  tbody.addEventListener('click', onClick);

  container.querySelector('[name=factoryName]').addEventListener('change', () => {
    tbody.querySelectorAll('.grade-row').forEach((tr) => {
      const grade = tr.querySelector('.grade-input').value;
      if (!grade.trim()) return;
      const rate = findFactoryRate(grade);
      tr.querySelector('.factory-rate-input').value = rate?.factoryRate ?? '';
      tr.querySelector('.commission-input').value = rate?.commissionPerKg ?? (s.defaultCommissionPerKg ?? DEFAULT_COMMISSION);
    });
    refreshAll();
  });

  // Helper: attach direct listeners to a specific row for immediate two-way sync
  function attachRowListeners(tr) {
    const bucketInput = tr.querySelector('.bucket-input');
    const kgInput = tr.querySelector('.kg-input');
    const bucketToKg = s.bucketToKg || 10;
    if (!bucketInput || !kgInput) return;

    // Ensure KG is editable
    kgInput.removeAttribute('readonly');
    kgInput.disabled = false;

    const onBucket = () => {
      if (bucketInput.value === '' || bucketInput.value == null) {
        kgInput.value = '';
      } else {
        kgInput.value = round(num(bucketInput.value) * bucketToKg, 3);
      }
      updateRowCalc(tr, s, 'bucket');
      updateDealTotals(container);
    };

    const onKg = () => {
      if (kgInput.value === '' || kgInput.value == null) {
        bucketInput.value = '';
      } else {
        bucketInput.value = round(num(kgInput.value) / bucketToKg, 2);
      }
      updateRowCalc(tr, s, 'kg');
      updateDealTotals(container);
    };

    bucketInput.addEventListener('input', onBucket);
    kgInput.addEventListener('input', onKg);
  }

  container.querySelector('#addGradeBtn').addEventListener('click', () => {
    const row = defaultGradeRow(s);
    tbody.insertAdjacentHTML('beforeend', renderGradeRowHtml(row, s, [...tbody.querySelectorAll('.grade-row'), {}]));

    // Rebind delegation handlers (remove then re-add) to satisfy rebinding requirement
    tbody.removeEventListener('input', onInput);
    tbody.removeEventListener('change', onChange);
    tbody.removeEventListener('click', onClick);
    tbody.addEventListener('input', onInput);
    tbody.addEventListener('change', onChange);
    tbody.addEventListener('click', onClick);

    // Attach direct listeners to the newly added row
    const newTr = tbody.querySelector('.grade-row:last-child');
    if (newTr) attachRowListeners(newTr);

    refreshAll();
  });

  // Attach direct listeners to existing rows
  tbody.querySelectorAll('.grade-row').forEach((tr) => attachRowListeners(tr));

  refreshAll();
}

export function renderNewDeal(container, editId = null) {
  const s = getState().settings;
  const raw = editId ? getState().deals.find((x) => x.id === editId) : null;
  const d = raw ? normalizeDeal(raw) : null;
  const parties = getState().parties.map((p) => `<option value="${esc(p.name)}">`).join('');
  const factories = getState().factories
    .filter((factory) => factory.active !== false || factory.name === d?.factoryName)
    .map((f) => `<option value="${esc(f.name)}">`).join('');
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
      const partyName = fd.get('partyName');
      const factoryName = fd.get('factoryName');
      const date = fd.get('date');
      const grades = collectGradeRows(container.querySelector('#gradeTableBody'));
      
      // Validation
      if (!partyName || !partyName.trim()) {
        toast('Please select or enter a party name.', 'error');
        form.querySelector('[name=partyName]').focus();
        return;
      }
      if (!factoryName || !factoryName.trim()) {
        toast('Please select or enter a factory name.', 'error');
        form.querySelector('[name=factoryName]').focus();
        return;
      }
      if (!date) {
        toast('Please select a deal date.', 'error');
        form.querySelector('[name=date]').focus();
        return;
      }
      if (!grades || grades.length === 0) {
        toast('Please add at least one grade.', 'error');
        return;
      }
      
      for (let i = 0; i < grades.length; i++) {
        const g = grades[i];
        if (!g.grade || !g.grade.trim()) {
          toast(`Grade ${i + 1}: Please enter a grade name.`, 'error');
          return;
        }
        if (!g.bucket || num(g.bucket) <= 0) {
          toast(`Grade ${i + 1}: Please enter a valid bucket quantity.`, 'error');
          return;
        }
        if (!g.kg || num(g.kg) <= 0) {
          toast(`Grade ${i + 1}: Please enter a valid KG quantity.`, 'error');
          return;
        }
        if (!g.factoryRate || num(g.factoryRate) <= 0) {
          toast(`Grade ${i + 1}: Please enter a valid factory rate.`, 'error');
          return;
        }
        if (!g.commissionPerKg || num(g.commissionPerKg) < 0) {
          toast(`Grade ${i + 1}: Please enter a valid commission rate.`, 'error');
          return;
        }
      }
      
      saveDeal({
        type: dealTypeInput.value || 'SALE',
        date: date,
        partyName: partyName,
        factoryName: factoryName,
        remarks: fd.get('remarks'),
        grades: grades
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
      <td><span class="status-badge completed">✓ Completed</span></td>
      <td>${formatRemarkHtml(d.remarks)}</td>
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
      <td>${i === 0 ? '<span class="status-badge completed">✓ Completed</span>' : ''}</td>
      <td>${i === 0 ? formatRemarkHtml(d.remarks) : ''}</td>
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
      <td></td><td></td><td></td>
    </tr>`;
  return gradeRows + totalRow;
}

function renderRecentDealsOld(container) {
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
  const factoryOpts = getState().factories.map((f) => `<option value="${f.id}" ${dealFilters.factoryId === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
  const gradeOpts = [...new Set(getState().rates.map((r) => r.grade))].map((g) => `<option value="${g}" ${dealFilters.grade === g ? 'selected' : ''}>${esc(g)}</option>`).join('');

  container.innerHTML = `
    <section class="recent-deals-hero">
      <h2>Recent Deals</h2>
      <div class="recent-deals-badge">${deals.length} deals</div>
    </section>

    <section class="dashboard">
      <div class="card">
        <div class="card-icon">📊</div>
        <div class="card-content">
          <h4>Total Deals</h4>
          <h2>${deals.length}</h2>
        </div>
      </div>
      <div class="card">
        <div class="card-icon">🛒</div>
        <div class="card-content">
          <h4>Total Purchase</h4>
          <h2>${fmtMoney(totals.purchase)}</h2>
        </div>
      </div>
      <div class="card">
        <div class="card-icon">📦</div>
        <div class="card-content">
          <h4>Total Sale</h4>
          <h2>${fmtMoney(totals.sale)}</h2>
        </div>
      </div>
      <div class="card">
        <div class="card-icon">📈</div>
        <div class="card-content">
          <h4>Total Profit</h4>
          <h2>${fmtMoney(totals.profit)}</h2>
        </div>
      </div>
    </section>

    <main>
        <section class="filter-bar">
          <input type="search" id="dealSearch" placeholder="Search deals, party, factory, grade..." value="${esc(dealFilters.search || '')}" />
          <label>From <input type="date" id="dealFrom" value="${dealFilters.dateFrom || ''}" /></label>
          <label>To <input type="date" id="dealTo" value="${dealFilters.dateTo || today()}" /></label>
          <select id="dealFactory"><option value="">All Factories</option>${factoryOpts}</select>
          <select id="dealGrade"><option value="">All Grades</option>${gradeOpts}</select>
          <select id="dealParty"><option value="">All Parties</option>${partyOpts}</select>
          <button type="button" class="btn btn-primary" id="searchBtn" style="min-width: 100px;">Search</button>
          <button type="button" class="btn btn-secondary" id="resetBtn" style="min-width: 80px;">Reset</button>
        </section>

        <section class="tableBox">
          <div class="table-header-row">
            <div>
              <h2>Deal Ledger</h2>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <div class="table-status-pill">${deals.length} ${deals.length === 1 ? 'deal' : 'deals'}</div>
              <button type="button" class="btn btn-secondary" id="exportDealsExcel" style="font-size: 12px; padding: 8px 12px;">📥 Excel Export</button>
            </div>
          </div>
          <div class="tableResponsive">
            <table>
              <thead>
                <tr>
                  <th>Deal No</th><th>Date</th><th>Party</th><th>Factory</th><th>Grade</th>
                  <th>Bucket</th><th>KG</th><th>Factory Rate</th><th>Comm/KG</th><th>Party Rate</th>
                  <th>Purchase</th><th>Sale</th><th>Profit</th><th>Status</th><th>Remarks</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${deals.length ? deals.map((d) => renderDealDetailRows(d)).join('') : '<tr><td colspan="16" class="empty">No deals found. Adjust filters or create a new deal.</td></tr>'}
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
        </section>
      </main>
    `;

  const applyFilters = () => {
    dealFilters = {
      search: container.querySelector('#dealSearch').value,
      dateFrom: container.querySelector('#dealFrom').value,
      dateTo: container.querySelector('#dealTo').value,
      factoryId: container.querySelector('#dealFactory').value || undefined,
      grade: container.querySelector('#dealGrade').value || undefined,
      partyId: container.querySelector('#dealParty').value || undefined
    };
    renderRecentDeals(container);
  };

  const resetFilters = () => {
    dealFilters = {
      dateFrom: '',
      dateTo: today()
    };
    renderRecentDeals(container);
  };

  container.querySelector('#dealSearch').addEventListener('input', applyFilters);
  container.querySelector('#dealFrom').addEventListener('change', applyFilters);
  container.querySelector('#dealTo').addEventListener('change', applyFilters);
  container.querySelector('#dealFactory').addEventListener('change', applyFilters);
  container.querySelector('#dealGrade').addEventListener('change', applyFilters);
  container.querySelector('#dealParty').addEventListener('change', applyFilters);
  container.querySelector('#searchBtn').addEventListener('click', applyFilters);
  container.querySelector('#resetBtn').addEventListener('click', resetFilters);

  container.querySelector('#exportDealsExcel').addEventListener('click', () => exportDealsExcel(deals, 'recent-deals'));

  container.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', () => navigate(ROUTES.newDeal, { id: b.dataset.edit }));
  });
  container.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      confirmAction('Delete this deal?', () => {
        deleteDeal(b.dataset.del);
        toast('Deal deleted.');
        renderRecentDeals(container);
      });
    });
  });
}

function renderRecentDealRowsModern(deal) {
  const d = normalizeDeal(deal);
  const actionButtons = `
    <button type="button" class="iconAction editBtn" data-edit="${d.id}" aria-label="Edit deal" title="Edit deal">Edit</button>
    <button type="button" class="iconAction deleteBtn" data-del="${d.id}" aria-label="Delete deal" title="Delete deal">Delete</button>
    <button type="button" class="iconAction detailBtn" aria-label="View details" title="View details">Details</button>
    <button type="button" class="whatsapp-btn" data-whatsapp-deal="${d.id}" data-deal-type="${d.type || 'SALE'}" aria-label="Send to WhatsApp" title="Send to WhatsApp">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2A10.01 10.01 0 0 0 2.03 12.02c0 1.76.47 3.46 1.35 4.95L2 22l5.2-1.37a9.98 9.98 0 0 0 4.84 1.18h.01c5.52 0 10.01-4.49 10.01-10.01S17.56 2 12.04 2Zm0 18.3h-.01a8.27 8.27 0 0 1-4.22-1.15l-.3-.18-3.09.81.82-3.01-.19-.31a8.25 8.25 0 0 1 1.3-10.23 8.25 8.25 0 0 1 10.34 0 8.25 8.25 0 0 1 0 11.65 8.25 8.25 0 0 1-4.65 2.42Zm4.73-6.2c-.26-.13-1.53-.76-1.77-.84-.24-.09-.42-.13-.59.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.1-.4-2.09-1.28-.77-.69-1.3-1.54-1.45-1.8-.15-.26-.02-.4.11-.53.11-.11.26-.29.39-.43.13-.14.18-.24.27-.4.09-.16.04-.3-.02-.43-.06-.13-.59-1.42-.81-1.94-.21-.51-.43-.44-.59-.45h-.51c-.17 0-.43.06-.66.3-.23.24-.87.85-.87 2.07 0 1.22.9 2.4 1.03 2.56.13.17 1.78 2.72 4.32 3.81.6.26 1.07.42 1.44.54.6.19 1.14.17 1.57.1.48-.07 1.53-.63 1.75-1.24.22-.61.22-1.14.15-1.25-.07-.11-.24-.17-.5-.3Z"></path></svg>
      <span>Send to WhatsApp</span>
    </button>`;

  const gradeRows = d.grades.map((g) => `
    <tr>
      <td>${esc(g.grade || '—')}</td>
      <td>${g.bucket ?? '—'}</td>
      <td>${fmtNum(g.kg, 3)}</td>
      <td>${fmtMoney(g.factoryRate)}</td>
      <td>${fmtMoney(g.commissionPerKg)}</td>
      <td>${fmtMoney(g.partyRate)}</td>
      <td>${fmtMoney(g.purchaseAmount)}</td>
      <td>${fmtMoney(g.saleAmount)}</td>
      <td class="profit-cell">${fmtMoney(g.profit)}</td>
    </tr>`).join('');

  const summaryCards = [
    { label: 'Factory Purchase', value: fmtMoney(d.totalPurchase) },
    { label: 'Party Sale', value: fmtMoney(d.totalSale) },
    { label: 'Profit', value: fmtMoney(d.totalProfit) },
    { label: 'Commission', value: fmtMoney(d.totalCommission) },
    { label: 'Buckets', value: fmtNum(d.totalBucket, 2) },
    { label: 'KG', value: fmtNum(d.totalKg, 3) },
    { label: 'Grades', value: d.grades.length }
  ].map((item) => `
    <div class="summary-mini-card">
      <span class="summary-mini-label">${item.label}</span>
      <span class="summary-mini-value">${item.value}</span>
    </div>`).join('');

  return `
    <article class="recent-deal-card">
      <details class="deal-accordion">
        <summary class="deal-card-summary">
          <div class="deal-card-summary-main">
            <div class="deal-card-title-group">
              <span class="deal-number-pill">${esc(d.dealNo || '—')}</span>
              <span class="deal-date-pill">${fmtDate(d.date)}</span>
            </div>
            <div class="deal-card-identity">
              <span>${esc(d.partyName || '—')}</span>
              <span>${esc(d.factoryName || '—')}</span>
            </div>
          </div>
          <div class="deal-card-summary-side">
            <span class="status-badge completed">Completed</span>
            <div class="remark-inline">${formatRemarkHtml(d.remarks)}</div>
            <span class="deal-expand-icon" aria-hidden="true">▾</span>
          </div>
        </summary>

        <div class="deal-card-body">
          <div class="deal-card-subheader">
            <div class="deal-card-subheader-left">
              <span class="subheader-label">Deal Overview</span>
              <span class="subheader-text">Premium grade breakdown and deal summary</span>
            </div>
            <div class="deal-card-actions">${actionButtons}</div>
          </div>

          <div class="deal-grade-shell">
            <div class="deal-grade-table-wrap">
              <table class="deal-grade-table">
                <thead>
                  <tr>
                    <th>Grade</th><th>Buckets</th><th>KG</th><th>Factory Rate</th><th>Comm</th><th>Party Rate</th><th>Purchase</th><th>Sale</th><th>Profit</th>
                  </tr>
                </thead>
                <tbody>${gradeRows}</tbody>
              </table>
            </div>
            <div class="deal-summary-grid">${summaryCards}</div>
          </div>
        </div>
      </details>
    </article>`;
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
  const factoryOpts = getState().factories.map((f) => `<option value="${f.id}" ${dealFilters.factoryId === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
  const gradeOpts = [...new Set(getState().rates.map((r) => r.grade))].map((g) => `<option value="${g}" ${dealFilters.grade === g ? 'selected' : ''}>${esc(g)}</option>`).join('');
  const rangeStart = deals.length ? 1 : 0;

  const metrics = dashboardMetrics();

  container.innerHTML = `
    <div class="recent-deals-page">
      <section class="recent-hero-card">
        <div class="recent-hero-copy">
          <div class="recent-hero-eyebrow">ERP Ledger · Premium Overview</div>
          <h2>Recent Deals</h2>
          <p>Monitor the latest deal flow, profitability, and outstanding balances with a refined operational view.</p>
        </div>
        <div class="recent-hero-badges">
          <span class="hero-badge hero-badge-primary"><span class="hero-dot"></span> Live Sync</span>
          <span class="hero-badge">${deals.length} Deals</span>
          <span class="hero-badge">Updated ${fmtDate(today())}</span>
          <button type="button" class="whatsapp-btn whatsapp-btn-inline" id="recentDealsWhatsAppBtn" title="Share recent deals via WhatsApp">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2A10.01 10.01 0 0 0 2.03 12.02c0 1.76.47 3.46 1.35 4.95L2 22l5.2-1.37a9.98 9.98 0 0 0 4.84 1.18h.01c5.52 0 10.01-4.49 10.01-10.01S17.56 2 12.04 2Zm0 18.3h-.01a8.27 8.27 0 0 1-4.22-1.15l-.3-.18-3.09.81.82-3.01-.19-.31a8.25 8.25 0 0 1 1.3-10.23 8.25 8.25 0 0 1 10.34 0 8.25 8.25 0 0 1 0 11.65 8.25 8.25 0 0 1-4.65 2.42Zm4.73-6.2c-.26-.13-1.53-.76-1.77-.84-.24-.09-.42-.13-.59.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.1-.4-2.09-1.28-.77-.69-1.3-1.54-1.45-1.8-.15-.26-.02-.4.11-.53.11-.11.26-.29.39-.43.13-.14.18-.24.27-.4.09-.16.04-.3-.02-.43-.06-.13-.59-1.42-.81-1.94-.21-.51-.43-.44-.59-.45h-.51c-.17 0-.43.06-.66.3-.23.24-.87.85-.87 2.07 0 1.22.9 2.4 1.03 2.56.13.17 1.78 2.72 4.32 3.81.6.26 1.07.42 1.44.54.6.19 1.14.17 1.57.1.48-.07 1.53-.63 1.75-1.24.22-.61.22-1.14.15-1.25-.07-.11-.24-.17-.5-.3Z"></path></svg>
            <span>Send to WhatsApp</span>
          </button>
        </div>
      </section>

      <section class="recent-toolbar">
        <div class="toolbar-grid">
          <div class="toolbar-item toolbar-search">
            <div class="recent-search-wrap">
              <input type="search" id="dealSearch" placeholder="Search Deal..." value="${esc(dealFilters.search || '')}" />
              <span class="recent-search-icon" aria-hidden="true">🔍</span>
            </div>
          </div>

          <div class="toolbar-item toolbar-dates">
            <label class="toolbar-label">From Date<input type="date" id="dealFrom" value="${dealFilters.dateFrom || ''}" /></label>
            <label class="toolbar-label">To Date<input type="date" id="dealTo" value="${dealFilters.dateTo || today()}" /></label>
          </div>

          <div class="toolbar-item toolbar-filters">
            <div class="filter-control"><label>Party<select id="dealParty"><option value="">All Parties</option>${partyOpts}</select></label></div>
            <div class="filter-control"><label>Factory<select id="dealFactory"><option value="">All Factories</option>${factoryOpts}</select></label></div>
            <div class="filter-control"><label>Grade<select id="dealGrade"><option value="">All Grades</option>${gradeOpts}</select></label></div>
          </div>

          <div class="toolbar-item toolbar-actions">
            <button type="button" class="btn btn-primary" id="searchBtn">Search</button>
            <button type="button" class="btn btn-secondary" id="resetBtn">Reset</button>
            <button type="button" class="btn btn-secondary" id="exportDealsExcel">Excel</button>
            <button type="button" class="btn btn-secondary" disabled>PDF</button>
            <button type="button" class="btn btn-secondary" disabled>Columns</button>
          </div>
        </div>
      </section>

      <section class="recent-kpi-bar">
        <div class="kpi-card"><div class="kpi-icon">📊</div><div class="kpi-label">Total Deals</div><div class="kpi-value">${metrics.totalDeals}</div><div class="kpi-trend positive">Live</div></div>
        <div class="kpi-card"><div class="kpi-icon">⚖️</div><div class="kpi-label">Total KG</div><div class="kpi-value">${fmtNum(metrics.totalKg, 3)} KG</div><div class="kpi-trend positive">Updated</div></div>
        <div class="kpi-card"><div class="kpi-icon">🧾</div><div class="kpi-label">Purchase</div><div class="kpi-value">${fmtMoney(metrics.totalPurchase)}</div><div class="kpi-trend neutral">Tracked</div></div>
        <div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-label">Sale</div><div class="kpi-value">${fmtMoney(metrics.totalSale)}</div><div class="kpi-trend positive">Healthy</div></div>
        <div class="kpi-card"><div class="kpi-icon">📈</div><div class="kpi-label">Profit</div><div class="kpi-value">${fmtMoney(metrics.totalProfit)}</div><div class="kpi-trend positive">Stable</div></div>
        <div class="kpi-card"><div class="kpi-icon">💼</div><div class="kpi-label">Commission</div><div class="kpi-value">${fmtMoney(metrics.totalCommission)}</div><div class="kpi-trend neutral">Settled</div></div>
        <div class="kpi-card"><div class="kpi-icon">👤</div><div class="kpi-label">Outstanding Party</div><div class="kpi-value">${fmtMoney(metrics.outstandingParty)}</div><div class="kpi-trend neutral">Pending</div></div>
        <div class="kpi-card"><div class="kpi-icon">🏭</div><div class="kpi-label">Outstanding Factory</div><div class="kpi-value">${fmtMoney(metrics.outstandingFactory)}</div><div class="kpi-trend neutral">Pending</div></div>
      </section>

      <section class="recent-deals-stack-area">
        <div class="recent-deals-stack">
          ${deals.length ? deals.map((d) => renderRecentDealRowsModern(d)).join('') : '<div class="empty-state">No deals found. Adjust filters or create a new deal.</div>'}
        </div>
      </section>

      <section class="recent-pagination">
        <span class="pagination-summary">Showing ${rangeStart} to ${deals.length} of ${deals.length} records</span>
        <div class="recent-page-controls">
          <button type="button" disabled>Prev</button>
          <button type="button" class="active">1</button>
          <button type="button" disabled>Next</button>
        </div>
        <label>Rows per page<select><option>10</option><option>25</option><option>50</option></select></label>
      </section>
    </div>`;

  const applyFilters = () => {
    dealFilters = {
      search: container.querySelector('#dealSearch').value,
      dateFrom: container.querySelector('#dealFrom').value,
      dateTo: container.querySelector('#dealTo').value,
      factoryId: container.querySelector('#dealFactory').value || undefined,
      grade: container.querySelector('#dealGrade').value || undefined,
      partyId: container.querySelector('#dealParty').value || undefined
    };
    renderRecentDeals(container);
  };

  const resetFilters = () => {
    dealFilters = {
      dateFrom: '',
      dateTo: today()
    };
    renderRecentDeals(container);
  };

  container.querySelector('#dealSearch').addEventListener('input', applyFilters);
  container.querySelector('#dealFrom').addEventListener('change', applyFilters);
  container.querySelector('#dealTo').addEventListener('change', applyFilters);
  container.querySelector('#dealFactory').addEventListener('change', applyFilters);
  container.querySelector('#dealGrade').addEventListener('change', applyFilters);
  container.querySelector('#dealParty').addEventListener('change', applyFilters);
  container.querySelector('#searchBtn').addEventListener('click', applyFilters);
  container.querySelector('#resetBtn').addEventListener('click', resetFilters);

  container.querySelector('#exportDealsExcel').addEventListener('click', () => exportDealsExcel(deals, 'recent-deals'));

  container.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', () => navigate(ROUTES.newDeal, { id: b.dataset.edit }));
  });
  container.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      confirmAction('Delete this deal?', () => {
        deleteDeal(b.dataset.del);
        toast('Deal deleted.');
        renderRecentDeals(container);
      });
    });
  });
}
