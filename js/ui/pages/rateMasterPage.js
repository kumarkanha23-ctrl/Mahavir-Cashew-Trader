import { mountPage, confirmDialog } from '../components/modal.js';
import { el } from '../../utils/dom.js';
import { formatCurrency } from '../../utils/currency.js';
import { getAllRates, upsertRate, deleteRate } from '../../domain/services/rateService.js';
import { showToast } from '../components/toast.js';
import { on, Events } from '../../core/eventBus.js';
import { DEFAULT_COMMISSION_PER_KG } from '../../config.js';

let unsubscribe = null;

function buildForm(onSaved) {
  const form = el('form', { className: 'dealBox' });
  form.innerHTML = `
    <h2>Add / Update Rate</h2>
    <div class="grid grid-4">
      <input name="grade" placeholder="Grade" required />
      <input name="factoryRate" type="number" step="0.01" min="0" placeholder="Factory Rate (₹/KG)" required />
      <input name="commissionPerKg" type="number" step="0.01" min="0" placeholder="Commission (₹/KG)" value="${DEFAULT_COMMISSION_PER_KG}" required />
      <input name="partyRate" type="number" step="0.01" readonly placeholder="Party Rate" class="readonly" />
    </div>
    <button type="submit" class="btn btn-primary" id="saveRate">Save Rate</button>
  `;

  const factoryRate = form.querySelector('[name=factoryRate]');
  const commission = form.querySelector('[name=commissionPerKg]');
  const partyRate = form.querySelector('[name=partyRate]');

  const updatePreview = () => {
    partyRate.value = (parseFloat(factoryRate.value || 0) + parseFloat(commission.value || 0)).toFixed(2);
  };
  factoryRate.addEventListener('input', updatePreview);
  commission.addEventListener('input', updatePreview);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      upsertRate({
        grade: form.grade.value,
        factoryRate: form.factoryRate.value,
        commissionPerKg: form.commissionPerKg.value
      });
      showToast('Rate saved successfully.');
      form.reset();
      form.commissionPerKg.value = DEFAULT_COMMISSION_PER_KG;
      onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  return form;
}

function buildTable(onSaved) {
  const rates = getAllRates();
  const box = el('div', { className: 'tableBox' });
  box.innerHTML = '<h2>Rate Master</h2>';

  const table = el('table', {}, [
    el('thead', {}, [
      el('tr', {}, ['Grade', 'Factory Rate', 'Commission/KG', 'Party Rate', 'Updated', 'Actions'].map(
        (h) => el('th', { textContent: h })
      ))
    ]),
    el('tbody', {}, rates.length ? rates.map((r) => el('tr', {}, [
      el('td', { textContent: r.grade }),
      el('td', { textContent: formatCurrency(r.factoryRate) }),
      el('td', { textContent: formatCurrency(r.commissionPerKg) }),
      el('td', { textContent: formatCurrency(r.partyRate) }),
      el('td', { textContent: new Date(r.updatedAt).toLocaleDateString('en-IN') }),
      el('td', {}, [
        el('button', {
          className: 'editBtn',
          textContent: 'Edit',
          onclick: () => {
            document.querySelector('[name=grade]').value = r.grade;
            document.querySelector('[name=factoryRate]').value = r.factoryRate;
            document.querySelector('[name=commissionPerKg]').value = r.commissionPerKg;
            document.querySelector('[name=partyRate]').value = r.partyRate;
          }
        }),
        ' ',
        el('button', {
          className: 'deleteBtn',
          textContent: 'Delete',
          onclick: () => confirmDialog(`Delete rate for grade "${r.grade}"?`, () => {
            deleteRate(r.id);
            showToast('Rate deleted.');
            onSaved();
          })
        })
      ])
    ])) : [el('tr', {}, [el('td', { colSpan: '6', textContent: 'No rates defined.' })])])
  ]);

  box.appendChild(el('div', { className: 'tableResponsive' }, [table]));
  return box;
}

export function renderRateMasterPage(container) {
  const content = el('div');
  const refresh = () => {
    content.innerHTML = '';
    content.appendChild(buildForm(refresh));
    content.appendChild(buildTable(refresh));
  };
  refresh();
  mountPage(container, 'Rate Master', content);

  if (unsubscribe) unsubscribe();
  unsubscribe = on(Events.DATA_CHANGED, refresh);
}
