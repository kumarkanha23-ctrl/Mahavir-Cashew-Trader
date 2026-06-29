import { renderDashboard } from './dashboard.js';
import { renderRateMaster, renderNewDeal, renderRecentDeals } from './deals.js';
import { renderPartyLedger, renderFactoryLedger } from './ledger.js';
import { renderPartyPayment, renderFactoryPayment } from './payment.js';
import { renderReports, renderSettings, renderBackup } from './reports.js';
import { initFirebase } from './firebase.js';

export const APP_NAME = 'Mahavir Cashew Trader';
export const BUCKET_TO_KG = 10;
export const DEFAULT_COMMISSION = 5;

export const KEYS = {
  META: 'mct:meta',
  SETTINGS: 'mct:settings',
  PARTIES: 'mct:parties',
  FACTORIES: 'mct:factories',
  DEALS: 'mct:deals',
  PAYMENTS: 'mct:payments',
  RATES: 'mct:rates',
  SEQUENCES: 'mct:sequences',
  LAST_BACKUP: 'mct:lastBackup'
};

export const ROUTES = {
  dashboard: 'dashboard',
  rateMaster: 'rate-master',
  newDeal: 'new-deal',
  recentDeals: 'recent-deals',
  partyLedger: 'party-ledger',
  factoryLedger: 'factory-ledger',
  partyPayment: 'party-payment',
  factoryPayment: 'factory-payment',
  reports: 'reports',
  settings: 'settings',
  backup: 'backup'
};

export const NAV = [
  { route: ROUTES.dashboard, label: 'Dashboard', icon: '📊' },
  { route: ROUTES.rateMaster, label: 'Rate Master', icon: '💰' },
  { route: ROUTES.newDeal, label: 'New Deal', icon: '➕' },
  { route: ROUTES.recentDeals, label: 'Recent Deals', icon: '📋' },
  { route: ROUTES.partyLedger, label: 'Party Ledger', icon: '👤' },
  { route: ROUTES.factoryLedger, label: 'Factory Ledger', icon: '🏭' },
  { route: ROUTES.partyPayment, label: 'Party Payment', icon: '💵' },
  { route: ROUTES.factoryPayment, label: 'Factory Payment', icon: '🏦' },
  { route: ROUTES.reports, label: 'Reports', icon: '📈' },
  { route: ROUTES.settings, label: 'Settings', icon: '⚙️' },
  { route: ROUTES.backup, label: 'Backup & Restore', icon: '💾' }
];

export const PAYMENT_MODES = ['CASH', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'];

const DEFAULT_SETTINGS = {
  companyName: APP_NAME,
  defaultCommissionPerKg: DEFAULT_COMMISSION,
  bucketToKg: BUCKET_TO_KG,
  openingStockKg: 0,
  warehouseName: 'Main Warehouse',
  firebaseEnabled: false,
  firebaseConfig: null
};

let state = {
  settings: { ...DEFAULT_SETTINGS },
  parties: [],
  factories: [],
  deals: [],
  payments: [],
  rates: [],
  sequences: { deal: 0, payment: 0 }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn());
}

export function getState() {
  return state;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function fmtMoney(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

export function fmtNum(n, d = 2) {
  return (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

export function num(v, fb = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fb;
}

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function wrap(data) {
  return JSON.stringify({ v: 1, updatedAt: new Date().toISOString(), payload: data });
}

function unwrap(raw) {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return p.payload !== undefined ? p.payload : p;
  } catch {
    return null;
  }
}

function lsGet(key, fb) {
  const v = unwrap(localStorage.getItem(key));
  return v ?? fb;
}

function lsSet(key, data) {
  localStorage.setItem(key, wrap(data));
}

export function loadAll() {
  state.settings = { ...DEFAULT_SETTINGS, ...lsGet(KEYS.SETTINGS, DEFAULT_SETTINGS) };
  state.parties = lsGet(KEYS.PARTIES, []);
  state.factories = lsGet(KEYS.FACTORIES, []);
  const rawDeals = lsGet(KEYS.DEALS, []);
  state.deals = migrateDeals(rawDeals);
  if (rawDeals.some((d) => !Array.isArray(d.grades) || !d.grades.length)) {
    lsSet(KEYS.DEALS, state.deals);
  }
  state.payments = lsGet(KEYS.PAYMENTS, []);
  state.rates = lsGet(KEYS.RATES, []);
  state.sequences = lsGet(KEYS.SEQUENCES, { deal: 0, payment: 0 });
  if (!localStorage.getItem(KEYS.META)) lsSet(KEYS.META, { schemaVersion: 2 });
}

export function persist() {
  lsSet(KEYS.SETTINGS, state.settings);
  lsSet(KEYS.PARTIES, state.parties);
  lsSet(KEYS.FACTORIES, state.factories);
  lsSet(KEYS.DEALS, state.deals);
  lsSet(KEYS.PAYMENTS, state.payments);
  lsSet(KEYS.RATES, state.rates);
  lsSet(KEYS.SEQUENCES, state.sequences);
  notify();
  if (state.settings.firebaseEnabled) {
    import('./firebase.js').then((m) => m.syncToCloud().catch(() => {}));
  }
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatBackupFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `Mahavir_Backup_${y}-${m}-${d}_${h}-${min}-${s}.json`;
}

export function getLastBackupInfo() {
  try {
    const raw = localStorage.getItem(KEYS.LAST_BACKUP);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastBackupInfo(sizeBytes) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const info = {
    iso: now.toISOString(),
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    sizeBytes,
    sizeLabel: formatFileSize(sizeBytes)
  };
  localStorage.setItem(KEYS.LAST_BACKUP, JSON.stringify(info));
  return info;
}

function parseStoredArray(data, key) {
  const raw = data[key];
  if (!raw) return [];
  try {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(text);
    const unwrapped = parsed?.payload ?? parsed;
    return Array.isArray(unwrapped) ? unwrapped : [];
  } catch {
    return [];
  }
}

export function extractBackupStats(parsed) {
  const data = parsed.data || parsed;
  return {
    parties: parseStoredArray(data, KEYS.PARTIES).length,
    factories: parseStoredArray(data, KEYS.FACTORIES).length,
    deals: parseStoredArray(data, KEYS.DEALS).length,
    payments: parseStoredArray(data, KEYS.PAYMENTS).length,
    rates: parseStoredArray(data, KEYS.RATES).length,
    exportedAt: parsed.exportedAt || null,
    app: parsed.app || null
  };
}

export function readBackupPreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('Invalid backup: not a valid JSON object.'));
          return;
        }
        const data = parsed.data || parsed;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          reject(new Error('Invalid backup: missing data section.'));
          return;
        }
        const hasValidKey = Object.keys(data).some((k) => k.startsWith('mct:'));
        if (!hasValidKey) {
          reject(new Error('Invalid backup: no Mahavir Cashew Trader data found.'));
          return;
        }
        resolve({
          parsed,
          stats: extractBackupStats(parsed),
          fileName: file.name,
          fileSize: file.size,
          fileSizeLabel: formatFileSize(file.size)
        });
      } catch (e) {
        reject(new Error(`Invalid JSON: ${e.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

export function importBackupData(parsed) {
  const data = parsed.data || parsed;
  Object.entries(data).forEach(([k, v]) => {
    if (k.startsWith('mct:') && k !== KEYS.LAST_BACKUP) {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  });
  loadAll();
  notify();
}

export function exportBackupFile() {
  const data = {};
  Object.values(KEYS).forEach((k) => {
    if (k === KEYS.LAST_BACKUP) return;
    const raw = localStorage.getItem(k);
    if (raw) data[k] = raw;
  });
  const payload = JSON.stringify({ app: APP_NAME, exportedAt: new Date().toISOString(), data }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  saveLastBackupInfo(blob.size);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = formatBackupFilename();
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importBackupFile(file) {
  return readBackupPreview(file).then(({ parsed }) => {
    importBackupData(parsed);
  });
}

export function showBackupPreviewModal(preview, onConfirm) {
  const { stats, fileName, fileSizeLabel, parsed } = preview;
  const exportedLabel = stats.exportedAt ? fmtDate(stats.exportedAt.slice(0, 10)) + ' ' + (stats.exportedAt.slice(11, 19) || '') : '—';
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box modal-box-lg backup-preview-modal">
      <h3>Restore Backup Preview</h3>
      <p class="hint">Review the backup contents below. Restoring will replace all current data on this device.</p>
      <div class="backup-preview-meta">
        <div><span class="label">File</span><strong>${esc(fileName)}</strong></div>
        <div><span class="label">Size</span><strong>${esc(fileSizeLabel)}</strong></div>
        <div><span class="label">Exported</span><strong>${esc(exportedLabel.trim() || '—')}</strong></div>
        <div><span class="label">App</span><strong>${esc(stats.app || APP_NAME)}</strong></div>
      </div>
      <div class="backup-preview-stats">
        <div class="backup-stat-card"><span>Deals</span><strong>${stats.deals}</strong></div>
        <div class="backup-stat-card"><span>Parties</span><strong>${stats.parties}</strong></div>
        <div class="backup-stat-card"><span>Factories</span><strong>${stats.factories}</strong></div>
        <div class="backup-stat-card"><span>Payments</span><strong>${stats.payments}</strong></div>
        <div class="backup-stat-card"><span>Rates</span><strong>${stats.rates}</strong></div>
      </div>
      <details class="backup-json-preview">
        <summary>View raw JSON (first 2 KB)</summary>
        <pre>${esc(JSON.stringify(parsed, null, 2).slice(0, 2048))}${JSON.stringify(parsed).length > 2048 ? '\n…' : ''}</pre>
      </details>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
        <button type="button" class="btn btn-danger" data-ok>Restore Backup</button>
      </div>
    </div>`;
  ov.querySelector('[data-cancel]').onclick = () => ov.remove();
  ov.querySelector('[data-ok]').onclick = () => { ov.remove(); onConfirm(); };
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

export function clearAllData() {
  Object.values(KEYS).forEach((k) => {
    if (k !== KEYS.LAST_BACKUP) localStorage.removeItem(k);
  });
  state = {
    settings: { ...DEFAULT_SETTINGS },
    parties: [],
    factories: [],
    deals: [],
    payments: [],
    rates: [],
    sequences: { deal: 0, payment: 0 }
  };
  lsSet(KEYS.META, { schemaVersion: 1 });
  notify();
}

export function toast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

export function confirmAction(message, onOk) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box">
      <h3>Confirm</h3>
      <p>${esc(message)}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
        <button type="button" class="btn btn-danger" data-ok>Confirm</button>
      </div>
    </div>`;
  ov.querySelector('[data-cancel]').onclick = () => ov.remove();
  ov.querySelector('[data-ok]').onclick = () => { ov.remove(); onOk(); };
  document.body.appendChild(ov);
}

export function calcDeal(input) {
  const s = state.settings;
  const bucketToKg = s.bucketToKg || BUCKET_TO_KG;
  const bucket = num(input.bucket);
  const kg = input.kg !== '' && input.kg != null ? num(input.kg) : round(bucket * bucketToKg, 3);
  const factoryRate = num(input.factoryRate);
  const commissionPerKg = input.commissionPerKg !== '' && input.commissionPerKg != null
    ? num(input.commissionPerKg) : (s.defaultCommissionPerKg ?? DEFAULT_COMMISSION);
  const partyRate = round(factoryRate + commissionPerKg, 2);
  return {
    bucket, kg, factoryRate, commissionPerKg, partyRate,
    purchaseAmount: round(kg * factoryRate, 2),
    saleAmount: round(kg * partyRate, 2),
    profit: round(kg * commissionPerKg, 2),
    commission: round(kg * commissionPerKg, 2)
  };
}

/** Sum line totals for a multi-grade deal. */
export function calcDealTotals(grades) {
  const totals = grades.reduce((acc, g) => {
    acc.totalBucket = round(acc.totalBucket + num(g.bucket), 2);
    acc.totalKg = round(acc.totalKg + num(g.kg), 3);
    acc.totalPurchase = round(acc.totalPurchase + num(g.purchaseAmount), 2);
    acc.totalSale = round(acc.totalSale + num(g.saleAmount), 2);
    acc.totalProfit = round(acc.totalProfit + num(g.profit), 2);
    acc.totalCommission = round(acc.totalCommission + num(g.commission ?? g.profit), 2);
    return acc;
  }, {
    totalBucket: 0, totalKg: 0, totalPurchase: 0, totalSale: 0, totalProfit: 0, totalCommission: 0
  });
  return totals;
}

/** Convert legacy single-grade deal to multi-grade shape. */
export function normalizeDeal(deal) {
  if (!deal) return deal;
  let grades = deal.grades;
  if (!Array.isArray(grades) || !grades.length) {
    grades = [{
      id: deal.lineId || uid('line'),
      grade: deal.grade || '',
      bucket: num(deal.bucket),
      kg: num(deal.kg),
      factoryRate: num(deal.factoryRate),
      commissionPerKg: num(deal.commissionPerKg),
      partyRate: num(deal.partyRate),
      purchaseAmount: num(deal.purchaseAmount),
      saleAmount: num(deal.saleAmount),
      profit: num(deal.profit),
      commission: num(deal.profit)
    }];
  }
  const totals = calcDealTotals(grades);
  const gradeLabel = grades.map((g) => g.grade).filter(Boolean).join(', ');
  return {
    ...deal,
    grades,
    ...totals,
    grade: gradeLabel,
    bucket: totals.totalBucket,
    kg: totals.totalKg,
    purchaseAmount: totals.totalPurchase,
    saleAmount: totals.totalSale,
    profit: totals.totalProfit,
    commission: totals.totalCommission
  };
}

export function getDealGrades(deal) {
  return normalizeDeal(deal).grades;
}

export function getDealGradeLabel(deal) {
  const grades = getDealGrades(deal);
  const names = grades.map((g) => g.grade).filter(Boolean);
  if (!names.length) return '—';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

function migrateDeals(deals) {
  return deals.map(normalizeDeal);
}

function nextSeq(key) {
  state.sequences[key] = (state.sequences[key] || 0) + 1;
  return state.sequences[key];
}

function docNo(type, seq) {
  const p = type === 'deal' ? 'D' : 'PMT';
  return `${p}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
}

export function findOrCreateParty(name) {
  const n = (name || '').trim();
  if (!n) throw new Error('Party name is required.');
  let p = state.parties.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!p) {
    p = { id: uid('party'), name: n, phone: '', address: '', createdAt: new Date().toISOString() };
    state.parties.push(p);
  }
  return p;
}

export function findOrCreateFactory(name) {
  const n = (name || '').trim();
  if (!n) throw new Error('Factory name is required.');
  let f = state.factories.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!f) {
    f = { id: uid('factory'), name: n, phone: '', address: '', createdAt: new Date().toISOString() };
    state.factories.push(f);
  }
  return f;
}

function buildGradeLines(rawGrades) {
  if (!Array.isArray(rawGrades) || !rawGrades.length) {
    throw new Error('Add at least one grade row.');
  }
  return rawGrades.map((row, i) => {
    const grade = (row.grade || '').trim();
    if (!grade) throw new Error(`Grade is required on row ${i + 1}.`);
    const c = calcDeal(row);
    if (c.kg <= 0) throw new Error(`KG must be greater than zero on row ${i + 1}.`);
    if (c.factoryRate < 0) throw new Error(`Factory rate cannot be negative on row ${i + 1}.`);
    return {
      id: row.id || uid('line'),
      grade,
      bucket: c.bucket,
      kg: c.kg,
      factoryRate: c.factoryRate,
      commissionPerKg: c.commissionPerKg,
      partyRate: c.partyRate,
      purchaseAmount: c.purchaseAmount,
      saleAmount: c.saleAmount,
      profit: c.profit,
      commission: c.commission
    };
  });
}

export function saveDeal(input, editId = null) {
  if (!input.date) throw new Error('Date is required.');
  const party = findOrCreateParty(input.partyName);
  const factory = findOrCreateFactory(input.factoryName);
  const grades = buildGradeLines(input.grades);
  const totals = calcDealTotals(grades);
  const gradeLabel = grades.map((g) => g.grade).join(', ');
  const base = {
    date: input.date.slice(0, 10),
    partyId: party.id,
    partyName: party.name,
    factoryId: factory.id,
    factoryName: factory.name,
    grades,
    ...totals,
    grade: gradeLabel,
    bucket: totals.totalBucket,
    kg: totals.totalKg,
    purchaseAmount: totals.totalPurchase,
    saleAmount: totals.totalSale,
    profit: totals.totalProfit,
    commission: totals.totalCommission,
    remarks: (input.remarks || '').trim(),
    updatedAt: new Date().toISOString()
  };

  if (editId) {
    const i = state.deals.findIndex((d) => d.id === editId);
    if (i < 0) throw new Error('Deal not found.');
    state.deals[i] = { ...state.deals[i], ...base };
  } else {
    const seq = nextSeq('deal');
    state.deals.push({
      id: uid('deal'),
      dealNo: docNo('deal', seq),
      ...base,
      createdAt: new Date().toISOString()
    });
  }
  persist();
}

export function deleteDeal(id) {
  state.deals = state.deals.filter((d) => d.id !== id);
  persist();
}

export function saveRate(input) {
  const grade = (input.grade || '').trim();
  if (!grade) throw new Error('Grade is required.');
  const c = calcDeal({ bucket: 1, factoryRate: input.factoryRate, commissionPerKg: input.commissionPerKg });
  const ex = state.rates.find((r) => r.grade.toLowerCase() === grade.toLowerCase());
  const rate = {
    id: ex?.id || uid('rate'), grade,
    factoryRate: c.factoryRate, commissionPerKg: c.commissionPerKg, partyRate: c.partyRate,
    updatedAt: new Date().toISOString()
  };
  if (ex) state.rates = state.rates.map((r) => (r.id === ex.id ? rate : r));
  else state.rates.push(rate);
  persist();
}

export function deleteRate(id) {
  state.rates = state.rates.filter((r) => r.id !== id);
  persist();
}

export function savePayment(input, type) {
  const amount = num(input.amount);
  if (amount <= 0) throw new Error('Amount must be greater than zero.');
  if (!input.date) throw new Error('Date is required.');
  let entityName = '';
  if (type === 'PARTY') {
    const p = state.parties.find((x) => x.id === input.partyId);
    if (!p) throw new Error('Select a party.');
    entityName = p.name;
  } else {
    const f = state.factories.find((x) => x.id === input.factoryId);
    if (!f) throw new Error('Select a factory.');
    entityName = f.name;
  }
  const seq = nextSeq('payment');
  state.payments.push({
    id: uid('payment'), paymentNo: docNo('payment', seq),
    date: input.date.slice(0, 10), type,
    partyId: type === 'PARTY' ? input.partyId : null,
    factoryId: type === 'FACTORY' ? input.factoryId : null,
    entityName, amount,
    mode: input.mode || 'CASH',
    referenceNo: (input.referenceNo || '').trim(),
    remarks: (input.remarks || '').trim(),
    createdAt: new Date().toISOString()
  });
  persist();
}

export function deletePayment(id) {
  state.payments = state.payments.filter((p) => p.id !== id);
  persist();
}

export function partyLedger(partyId) {
  const deals = state.deals.filter((d) => d.partyId === partyId).map(normalizeDeal).sort((a, b) => b.date.localeCompare(a.date));
  const payments = state.payments.filter((p) => p.type === 'PARTY' && p.partyId === partyId).sort((a, b) => b.date.localeCompare(a.date));
  const totalKg = round(deals.reduce((a, d) => a + d.totalKg, 0), 3);
  const totalSale = round(deals.reduce((a, d) => a + d.totalSale, 0), 2);
  const totalPaid = round(payments.reduce((a, p) => a + p.amount, 0), 2);
  const outstanding = round(totalSale - totalPaid, 2);
  const rows = [];
  deals.forEach((d) => rows.push({
    date: d.date,
    sort: d.date + d.createdAt,
    ref: d.dealNo,
    desc: `Sale — ${getDealGradeLabel(d)} — ${fmtNum(d.totalKg, 3)} KG`,
    kg: d.totalKg,
    debit: d.totalSale,
    credit: 0
  }));
  payments.forEach((p) => rows.push({ date: p.date, sort: p.date + p.createdAt, ref: p.paymentNo, desc: `Payment — ${p.mode}`, kg: null, debit: 0, credit: p.amount }));
  rows.sort((a, b) => a.sort.localeCompare(b.sort));
  let bal = 0;
  rows.forEach((r) => { bal = round(bal + r.debit - r.credit, 2); r.balance = bal; });
  return { deals, payments, totalKg, totalSale, totalPaid, outstanding, balance: outstanding, rows };
}

export function factoryLedger(factoryId) {
  const deals = state.deals.filter((d) => d.factoryId === factoryId).map(normalizeDeal).sort((a, b) => b.date.localeCompare(a.date));
  const payments = state.payments.filter((p) => p.type === 'FACTORY' && p.factoryId === factoryId).sort((a, b) => b.date.localeCompare(a.date));
  const totalKg = round(deals.reduce((a, d) => a + d.totalKg, 0), 3);
  const totalPurchase = round(deals.reduce((a, d) => a + d.totalPurchase, 0), 2);
  const totalPaid = round(payments.reduce((a, p) => a + p.amount, 0), 2);
  const outstanding = round(totalPurchase - totalPaid, 2);
  const rows = [];
  deals.forEach((d) => rows.push({
    date: d.date,
    sort: d.date + d.createdAt,
    ref: d.dealNo,
    desc: `Purchase — ${getDealGradeLabel(d)} — ${fmtNum(d.totalKg, 3)} KG`,
    kg: d.totalKg,
    credit: d.totalPurchase,
    debit: 0
  }));
  payments.forEach((p) => rows.push({ date: p.date, sort: p.date + p.createdAt, ref: p.paymentNo, desc: `Payment — ${p.mode}`, kg: null, credit: 0, debit: p.amount }));
  rows.sort((a, b) => a.sort.localeCompare(b.sort));
  let bal = 0;
  rows.forEach((r) => { bal = round(bal + r.credit - r.debit, 2); r.balance = bal; });
  return { deals, payments, totalKg, totalPurchase, totalPaid, outstanding, balance: outstanding, rows };
}

export function dashboardMetrics() {
  const deals = state.deals.map(normalizeDeal);
  const totalDeals = deals.length;
  const totalKg = round(deals.reduce((a, d) => a + d.totalKg, 0), 3);
  const totalPurchase = round(deals.reduce((a, d) => a + d.totalPurchase, 0), 2);
  const totalSale = round(deals.reduce((a, d) => a + d.totalSale, 0), 2);
  const totalProfit = round(deals.reduce((a, d) => a + d.totalProfit, 0), 2);
  const totalCommission = round(deals.reduce((a, d) => a + d.totalCommission, 0), 2);
  let outstandingParty = 0;
  let outstandingFactory = 0;
  state.parties.forEach((p) => { outstandingParty += partyLedger(p.id).outstanding; });
  state.factories.forEach((f) => { outstandingFactory += factoryLedger(f.id).outstanding; });
  return {
    totalDeals, totalKg, totalPurchase, totalSale,
    totalProfit, totalCommission,
    outstandingParty: round(outstandingParty, 2),
    outstandingFactory: round(outstandingFactory, 2)
  };
}

export function filterDeals(f = {}) {
  let list = [...state.deals].map(normalizeDeal).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  if (f.search) {
    const q = f.search.toLowerCase();
    list = list.filter((d) =>
      d.dealNo.toLowerCase().includes(q) || d.partyName.toLowerCase().includes(q) ||
      d.factoryName.toLowerCase().includes(q) || d.grade.toLowerCase().includes(q) ||
      d.grades.some((g) => g.grade.toLowerCase().includes(q)) ||
      (d.remarks && d.remarks.toLowerCase().includes(q))
    );
  }
  if (f.dateFrom) list = list.filter((d) => d.date >= f.dateFrom);
  if (f.dateTo) list = list.filter((d) => d.date <= f.dateTo);
  if (f.partyId) list = list.filter((d) => d.partyId === f.partyId);
  if (f.factoryId) list = list.filter((d) => d.factoryId === f.factoryId);
  return list;
}

export function updateSettings(data) {
  state.settings = { ...state.settings, ...data };
  lsSet(KEYS.SETTINGS, state.settings);
  initFirebase(state.settings.firebaseConfig);
  notify();
}

export function updateParty(id, data) {
  state.parties = state.parties.map((p) => p.id === id ? { ...p, ...data, name: (data.name || p.name).trim() } : p);
  state.deals = state.deals.map((d) => d.partyId === id && data.name ? { ...d, partyName: data.name.trim() } : d);
  persist();
}

export function updateFactory(id, data) {
  state.factories = state.factories.map((f) => f.id === id ? { ...f, ...data, name: (data.name || f.name).trim() } : f);
  state.deals = state.deals.map((d) => d.factoryId === id && data.name ? { ...d, factoryName: data.name.trim() } : d);
  persist();
}

export function deleteParty(id) {
  if (state.deals.some((d) => d.partyId === id) || state.payments.some((p) => p.partyId === id))
    throw new Error('Party has deals or payments.');
  state.parties = state.parties.filter((p) => p.id !== id);
  persist();
}

export function deleteFactory(id) {
  if (state.deals.some((d) => d.factoryId === id) || state.payments.some((p) => p.factoryId === id))
    throw new Error('Factory has deals or payments.');
  state.factories = state.factories.filter((f) => f.id !== id);
  persist();
}

let currentRoute = ROUTES.dashboard;
let routeParams = {};

export function navigate(route, params = {}) {
  const qs = new URLSearchParams(params).toString();
  window.location.hash = `#/${route}${qs ? '?' + qs : ''}`;
}

function parseHash() {
  const h = window.location.hash.slice(1).replace(/^\//, '');
  const [path, qs] = h.split('?');
  const params = {};
  if (qs) new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
  return { route: path || ROUTES.dashboard, params };
}

function renderNav() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = NAV.map((n) =>
    `<a href="#/${n.route}" class="nav-link${currentRoute === n.route ? ' active' : ''}" data-route="${n.route}">
      <span class="nav-icon">${n.icon}</span><span>${esc(n.label)}</span>
    </a>`
  ).join('');
  nav.querySelectorAll('[data-route]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(a.dataset.route);
    });
  });
}

const TITLES = {
  [ROUTES.dashboard]: 'Dashboard',
  [ROUTES.rateMaster]: 'Rate Master',
  [ROUTES.newDeal]: 'New Deal',
  [ROUTES.recentDeals]: 'Recent Deals',
  [ROUTES.partyLedger]: 'Party Ledger',
  [ROUTES.factoryLedger]: 'Factory Ledger',
  [ROUTES.partyPayment]: 'Party Payment',
  [ROUTES.factoryPayment]: 'Factory Payment',
  [ROUTES.reports]: 'Reports',
  [ROUTES.settings]: 'Settings',
  [ROUTES.backup]: 'Backup & Restore'
};

function render() {
  const el = document.getElementById('mainContent');
  document.getElementById('pageHeading').textContent = routeParams.id ? 'Edit Deal' : (TITLES[currentRoute] || APP_NAME);
  renderNav();
  document.body.classList.remove('sidebar-open');

  switch (currentRoute) {
    case ROUTES.dashboard: renderDashboard(el); break;
    case ROUTES.rateMaster: renderRateMaster(el); break;
    case ROUTES.newDeal: renderNewDeal(el, routeParams.id); break;
    case ROUTES.recentDeals: renderRecentDeals(el); break;
    case ROUTES.partyLedger: renderPartyLedger(el, routeParams.partyId); break;
    case ROUTES.factoryLedger: renderFactoryLedger(el, routeParams.factoryId); break;
    case ROUTES.partyPayment: renderPartyPayment(el); break;
    case ROUTES.factoryPayment: renderFactoryPayment(el); break;
    case ROUTES.reports: renderReports(el); break;
    case ROUTES.settings: renderSettings(el); break;
    case ROUTES.backup: renderBackup(el); break;
    default: navigate(ROUTES.dashboard);
  }
}

function bootstrap() {
  loadAll();
  initFirebase(state.settings.firebaseConfig);
  subscribe(render);
  document.getElementById('menuToggle').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  window.addEventListener('hashchange', () => {
    const { route, params } = parseHash();
    currentRoute = route;
    routeParams = params;
    render();
  });
  const { route, params } = parseHash();
  currentRoute = route;
  routeParams = params;
  render();
}

bootstrap();
