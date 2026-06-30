import { mountPage, confirmDialog } from '../components/modal.js';
import { el } from '../../utils/dom.js';
import { getSettings, updateSettings, getWarehouseStock } from '../../domain/services/settingsService.js';
import { getAllParties, updateParty, deleteParty } from '../../domain/services/partyService.js';
import { getAllFactories, updateFactory, deleteFactory } from '../../domain/services/factoryService.js';
import { showToast } from '../components/toast.js';
import { BUCKET_TO_KG, DEFAULT_COMMISSION_PER_KG } from '../../config.js';
import { formatNumber } from '../../utils/currency.js';

export function renderSettingsPage(container) {
  const settings = getSettings();
  const stock = getWarehouseStock();

  const form = el('form', { className: 'dealBox' });
  form.innerHTML = `
    <h2>Settings</h2>
    <div class="grid grid-3">
      <label>Company Name<input name="companyName" value="${settings.companyName}" /></label>
      <label>Default Commission (₹/KG)<input name="defaultCommissionPerKg" type="number" step="0.01" value="${settings.defaultCommissionPerKg ?? DEFAULT_COMMISSION_PER_KG}" /></label>
      <label>Bucket to KG Ratio<input name="bucketToKg" type="number" step="1" value="${settings.bucketToKg ?? BUCKET_TO_KG}" /></label>
      <label>Warehouse Name<input name="warehouseName" value="${settings.warehouseName || 'Main Warehouse'}" /></label>
      <label>Opening Stock (KG)<input name="openingStockKg" type="number" step="0.001" value="${settings.openingStockKg ?? 0}" /></label>
    </div>
    <p class="hint">Bucket × ${settings.bucketToKg ?? BUCKET_TO_KG} = KG | Party Rate = Factory Rate + Commission</p>
    <button type="submit" class="btn btn-primary">Save Settings</button>
  `;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    updateSettings({
      companyName: form.companyName.value,
      defaultCommissionPerKg: parseFloat(form.defaultCommissionPerKg.value),
      bucketToKg: parseInt(form.bucketToKg.value, 10),
      warehouseName: form.warehouseName.value,
      openingStockKg: parseFloat(form.openingStockKg.value)
    });
    showToast('Settings saved.');
  });

  const stockInfo = el('div', { className: 'card' }, [
    el('h4', { textContent: 'Warehouse' }),
    el('p', { textContent: `${stock.warehouseName} — Opening: ${formatNumber(stock.openingStockKg, 3)} KG | Total Traded: ${formatNumber(stock.totalTradedKg, 3)} KG` })
  ]);

  const partiesSection = buildEntitySection('Parties', getAllParties(), updateParty, deleteParty);
  const factoriesSection = buildEntitySection('Factories', getAllFactories(), updateFactory, deleteFactory);

  const content = el('div', {}, [form, stockInfo, partiesSection, factoriesSection]);
  mountPage(container, 'Settings', content);
}

function buildEntitySection(title, items, onUpdate, onDelete) {
  const box = el('div', { className: 'tableBox' }, [el('h2', { textContent: title })]);
  const table = el('table', {}, [
    el('thead', {}, [el('tr', {}, ['Name', 'Phone', 'Address', 'Actions'].map((h) => el('th', { textContent: h })))]),
    el('tbody', {}, items.map((item) => el('tr', {}, [
      el('td', {}, [el('input', { value: item.name, className: 'inline-input', onchange: (e) => onUpdate(item.id, { name: e.target.value }) })]),
      el('td', {}, [el('input', { value: item.phone || '', className: 'inline-input', onchange: (e) => onUpdate(item.id, { phone: e.target.value }) })]),
      el('td', {}, [el('input', { value: item.address || '', className: 'inline-input', onchange: (e) => onUpdate(item.id, { address: e.target.value }) })]),
      el('td', {}, [
        el('button', {
          className: 'deleteBtn',
          textContent: 'Delete',
          onclick: () => confirmDialog(`Delete ${item.name}?`, () => {
            try {
              onDelete(item.id);
              showToast(`${title.slice(0, -1)} deleted.`);
            } catch (err) {
              showToast(err.message, 'error');
            }
          })
        })
      ])
    ])))
  ]);
  box.appendChild(el('div', { className: 'tableResponsive' }, [table]));
  return box;
}
