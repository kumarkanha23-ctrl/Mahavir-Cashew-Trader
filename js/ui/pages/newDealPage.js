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
    type: form.type.value,
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
    
    <div class="deal-type-selector">
      <label>Transaction Type:</label>
      <div class="type-buttons">
        <button type="button" class="type-btn ${(existing?.type || 'SALE') === 'PURCHASE' ? 'active' : ''}" data-type="PURCHASE" onclick="this.parentElement.parentElement.dataset.selectedType = 'PURCHASE'; document.querySelector('input[name=type]').value = 'PURCHASE'; this.parentElement.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active')); this.classList.add('active');">
          🔄 Purchase (Factory→Party)
        </button>
        <button type="button" class="type-btn ${(existing?.type || 'SALE') === 'SALE' ? 'active' : ''}" data-type="SALE" onclick="this.parentElement.parentElement.dataset.selectedType = 'SALE'; document.querySelector('input[name=type]').value = 'SALE'; this.parentElement.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active')); this.classList.add('active');">
          💰 Sale (Party→Customer)
        </button>
      </div>
      <input type="hidden" name="type" value="${existing?.type || 'SALE'}" />
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label for="date">Date</label>
        <input id="date" name="date" type="date" value="${existing?.date || todayISO()}" required />
      </div>
      <div class="form-group">
        <label for="partyName">Party Name</label>
        <input id="partyName" name="partyName" list="partyList" placeholder="Select or add party" value="${existing?.partyName || ''}" required />
      </div>
      <div class="form-group">
        <label for="factoryName">Factory Name</label>
        <input id="factoryName" name="factoryName" list="factoryList" placeholder="Select or add factory" value="${existing?.factoryName || ''}" required />
      </div>
      <div class="form-group">
        <label for="grade">Grade</label>
        <input id="grade" name="grade" list="gradeList" placeholder="W180, W210, W240, W320, JH, K, 1st SW, 2nd SW" value="${existing?.grade || ''}" required />
      </div>
      <div class="form-group">
        <label for="bucket">Bucket (Units)</label>
        <input id="bucket" name="bucket" type="number" step="0.01" min="0" placeholder="Bucket" value="${existing?.bucket ?? ''}" />
      </div>
      <div class="form-group">
        <label for="kg">KG <span class="hint">(auto-calc: Bucket × ${settings.bucketToKg || BUCKET_TO_KG})</span></label>
        <input id="kg" name="kg" type="number" step="0.001" min="0" placeholder="KG" value="${existing?.kg ?? ''}" />
      </div>
      <div class="form-group">
        <label for="factoryRate">Factory Rate (₹/KG)</label>
        <input id="factoryRate" name="factoryRate" type="number" step="0.01" min="0" placeholder="Factory Rate" value="${existing?.factoryRate ?? ''}" required />
      </div>
      <div class="form-group">
        <label for="commissionPerKg">Commission (₹/KG)</label>
        <input id="commissionPerKg" name="commissionPerKg" type="number" step="0.01" min="0" placeholder="Commission" value="${existing?.commissionPerKg ?? settings.defaultCommissionPerKg ?? DEFAULT_COMMISSION_PER_KG}" required />
      </div>
      <div class="form-group">
        <label for="partyRate">Party Rate (₹/KG) <span class="hint">Auto-calculated</span></label>
        <input id="partyRate" name="partyRate" type="number" step="0.01" readonly class="readonly" placeholder="Party Rate" value="${existing?.partyRate ?? ''}" />
      </div>
      <div class="form-group">
        <label for="purchaseAmount">Purchase Amount <span class="hint">Auto-calculated</span></label>
        <input id="purchaseAmount" name="purchaseAmount" readonly class="readonly" placeholder="Purchase Amount" />
      </div>
      <div class="form-group">
        <label for="saleAmount">Sale Amount <span class="hint">Auto-calculated</span></label>
        <input id="saleAmount" name="saleAmount" readonly class="readonly" placeholder="Sale Amount" />
      </div>
      <div class="form-group">
        <label for="profit">Profit <span class="hint">Auto-calculated</span></label>
        <input id="profit" name="profit" readonly class="readonly" placeholder="Profit" />
      </div>
      <div class="form-group full-width">
        <label for="remarks">Remarks</label>
        <input id="remarks" name="remarks" placeholder="Add optional notes" value="${existing?.remarks || ''}" />
      </div>
    </div>
    
    <datalist id="partyList">${getAllParties().map((p) => `<option value="${p.name}">`).join('')}</datalist>
    <datalist id="factoryList">${getAllFactories().map((f) => `<option value="${f.name}">`).join('')}</datalist>
    <datalist id="gradeList">${getState().rates.map((r) => `<option value="${r.grade}">`).join('')}</datalist>
    
    <div class="form-actions">
      <button type="submit" class="btn btn-primary" id="saveDeal">${existing ? 'Update Deal' : 'Save Deal'}</button>
      ${existing ? '' : '<button type="button" class="btn btn-secondary" id="resetDeal">Reset</button>'}
      <button type="button" class="btn btn-secondary" id="cancelDeal" onclick="window.history.back()">Cancel</button>
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
        document.querySelector('input[name=type]').value = 'SALE';
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
    document.querySelector('input[name=type]').value = 'SALE';
    applyCalc(form);
  });

  applyCalc(form);
  return form;
}

export function renderNewDealPage(container, params = {}) {
  const editId = params.id || null;
  mountPage(container, editId ? 'Edit Deal' : 'New Deal', buildDealForm(editId));
}
