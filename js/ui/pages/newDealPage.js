import { mountPage } from '../components/modal.js';
import { el } from '../../utils/dom.js';
import { todayISO } from '../../utils/date.js';
import { formatCurrency, formatNumber } from '../../utils/currency.js';
import { createDeal, updateDeal, previewDeal, getDealById } from '../../domain/services/dealService.js';
import { getAllParties } from '../../domain/services/partyService.js';
import { getAllFactories } from '../../domain/services/factoryService.js';
import { getRateForGrade } from '../../domain/services/rateService.js';
import { getState } from '../../core/state.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../../core/router.js';
import { ROUTES } from '../../config.js';
import { DEFAULT_COMMISSION_PER_KG, BUCKET_TO_KG } from '../../config.js';

function getFormData(form) {
  return {
    date: form.date.value,
    partyName: form.partyName.value,
    factoryName: form.factoryName.value,
    grade: form.grade.value,
    bucket: form.bucket.value,
    kg: form.kg.value,
    factoryRate: form.factoryRate.value,
    commissionPerKg: form.commissionPerKg.value,
    remarks: form.remarks.value
  };
}

function applyCalc(form) {
  const calc = previewDeal(getFormData(form));
  form.kg.value = calc.kg;
  form.partyRate.value = calc.partyRate.toFixed(2);
  form.purchaseAmount.value = formatCurrency(calc.purchaseAmount);
  form.saleAmount.value = formatCurrency(calc.saleAmount);
  form.profit.value = formatCurrency(calc.profit);
}

function buildDealForm(editId = null) {
  const existing = editId ? getDealById(editId) : null;
  const settings = getState().settings;

  const form = el('form', { className: 'dealBox' });
  form.innerHTML = `
    <h2>${existing ? 'Edit Deal' : 'New Deal'}</h2>
    <div class="grid grid-5">
      <input name="date" type="date" value="${existing?.date || todayISO()}" required />
      <input name="partyName" list="partyList" placeholder="Party Name" value="${existing?.partyName || ''}" required />
      <input name="factoryName" list="factoryList" placeholder="Factory Name" value="${existing?.factoryName || ''}" required />
      <input name="grade" list="gradeList" placeholder="Grade" value="${existing?.grade || ''}" required />
      <input name="bucket" type="number" step="0.01" min="0" placeholder="Bucket" value="${existing?.bucket ?? ''}" />
      <input name="kg" type="number" step="0.001" min="0" placeholder="KG (auto: Bucket × ${settings.bucketToKg || BUCKET_TO_KG})" value="${existing?.kg ?? ''}" />
      <input name="factoryRate" type="number" step="0.01" min="0" placeholder="Factory Rate (₹/KG)" value="${existing?.factoryRate ?? ''}" required />
      <input name="commissionPerKg" type="number" step="0.01" min="0" placeholder="Commission (₹/KG)" value="${existing?.commissionPerKg ?? settings.defaultCommissionPerKg ?? DEFAULT_COMMISSION_PER_KG}" required />
      <input name="partyRate" type="number" step="0.01" readonly class="readonly" placeholder="Party Rate" value="${existing?.partyRate ?? ''}" />
      <input name="purchaseAmount" readonly class="readonly" placeholder="Purchase Amount" />
      <input name="saleAmount" readonly class="readonly" placeholder="Sale Amount" />
      <input name="profit" readonly class="readonly" placeholder="Profit" />
      <input name="remarks" placeholder="Remarks" value="${existing?.remarks || ''}" class="grid-span-2" />
    </div>
    <datalist id="partyList">${getAllParties().map((p) => `<option value="${p.name}">`).join('')}</datalist>
    <datalist id="factoryList">${getAllFactories().map((f) => `<option value="${f.name}">`).join('')}</datalist>
    <datalist id="gradeList">${getState().rates.map((r) => `<option value="${r.grade}">`).join('')}</datalist>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary" id="saveDeal">${existing ? 'Update Deal' : 'Save Deal'}</button>
      ${existing ? '' : '<button type="button" class="btn btn-secondary" id="resetDeal">Reset</button>'}
    </div>
  `;

  ['bucket', 'kg', 'factoryRate', 'commissionPerKg'].forEach((field) => {
    form[field].addEventListener('input', () => applyCalc(form));
  });

  form.grade.addEventListener('change', () => {
    const rate = getRateForGrade(form.grade.value);
    if (rate) {
      form.factoryRate.value = rate.factoryRate;
      form.commissionPerKg.value = rate.commissionPerKg;
      applyCalc(form);
    }
  });

  form.bucket.addEventListener('input', () => {
    if (form.bucket.value && !form.kg.dataset.manual) {
      form.kg.value = '';
    }
  });

  form.kg.addEventListener('input', () => {
    form.kg.dataset.manual = form.kg.value ? '1' : '';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const data = getFormData(form);
      if (existing) {
        updateDeal(existing.id, data);
        showToast('Deal updated successfully.');
      } else {
        createDeal(data);
        showToast('Deal saved successfully.');
        form.reset();
        form.date.value = todayISO();
        form.commissionPerKg.value = settings.defaultCommissionPerKg ?? DEFAULT_COMMISSION_PER_KG;
      }
      navigate(ROUTES.recentDeals);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  form.querySelector('#resetDeal')?.addEventListener('click', () => {
    form.reset();
    form.date.value = todayISO();
    form.commissionPerKg.value = settings.defaultCommissionPerKg ?? DEFAULT_COMMISSION_PER_KG;
    applyCalc(form);
  });

  applyCalc(form);
  return form;
}

export function renderNewDealPage(container, params = {}) {
  const editId = params.id || null;
  mountPage(container, editId ? 'Edit Deal' : 'New Deal', buildDealForm(editId));
}
