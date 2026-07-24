import {
  getState, dashboardMetrics, filterDeals, partyLedger, factoryLedger,
  saveDeal, updateSettings, updateParty, updateFactory, deleteParty, deleteFactory,
  exportBackupFile, importBackupFile, clearAllData,
  getLastBackupInfo, readBackupPreview, showBackupPreviewModal,
  fmtDate, fmtMoney, fmtNum, esc, toast, confirmAction, today,
  DEFAULT_COMMISSION, BUCKET_TO_KG
} from './app.js';
import { exportDealsExcel, exportPaymentsExcel, exportReportCsv, importDealsFromCsv } from './excel.js';
import { printDealsPdf, printHtmlPdf } from './pdf.js';
import { syncToCloud, syncFromCloud, isFirebaseReady } from './firebase.js';

let reportType = 'summary';
let reportFilters = { period: 'custom' };

function getStartOfToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getDateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function getStartOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function getStartOfWeek() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function buildOutstandingRows() {
  const { parties, factories } = getState();
  const partyRows = parties.map((p) => {
    const l = partyLedger(p.id);
    return { name: p.name, total: l.totalSale, paid: l.totalPaid, out: l.outstanding };
  }).filter((r) => r.out > 0);
  const factoryRows = factories.map((f) => {
    const l = factoryLedger(f.id);
    return { name: f.name, total: l.totalPurchase, paid: l.totalPaid, out: l.outstanding };
  }).filter((r) => r.out > 0);
  return { partyRows, factoryRows };
}

export function renderReports(container) {
  container.innerHTML = `
    <section class="filter-bar">
      <label>Report Type
        <select id="reportType">
          <option value="summary">Business Summary</option>
          <option value="deals">Deal Register</option>
          <option value="profit">Profit Report</option>
          <option value="outstanding">Outstanding Report</option>
          <option value="party-pay">Party Payments</option>
          <option value="factory-pay">Factory Payments</option>
        </select>
      </label>
      <label>Period
        <select id="reportPeriod">
          <option value="custom">Custom</option>
          <option value="daily">Today</option>
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
        </select>
      </label>
      <input type="search" id="reportSearch" placeholder="Search..." value="${esc(reportFilters.search || '')}" />
      <label>From <input type="date" id="reportFrom" value="${reportFilters.dateFrom || ''}" /></label>
      <label>To <input type="date" id="reportTo" value="${reportFilters.dateTo || today()}" /></label>
    </section>
    <section class="action-bar">
      <label class="btn btn-secondary file-btn">
        <span aria-hidden="true">⬆</span> Import Deals from CSV
        <input type="file" accept=".csv" id="importDealsCsv" hidden />
      </label>
      <button type="button" class="btn btn-secondary" id="reportExcel">Excel Export</button>
      <button type="button" class="btn btn-secondary" id="reportPdf">PDF / Print</button>
    </section>
    <section class="tableBox" id="reportPreview"></section>`;

  const preview = container.querySelector('#reportPreview');
  const typeSel = container.querySelector('#reportType');
  const periodSel = container.querySelector('#reportPeriod');
  typeSel.value = reportType;
  periodSel.value = reportFilters.period || 'custom';

  const applyPeriod = () => {
    const period = periodSel.value;
    const todayDate = getStartOfToday();
    let fromDate = reportFilters.dateFrom || '';
    let toDate = reportFilters.dateTo || todayDate;

    if (period === 'daily') {
      fromDate = todayDate;
      toDate = todayDate;
    } else if (period === 'weekly') {
      fromDate = getStartOfWeek();
      toDate = todayDate;
    } else if (period === 'monthly') {
      fromDate = getStartOfMonth();
      toDate = todayDate;
    }

    reportFilters.period = period;
    reportFilters.dateFrom = fromDate;
    reportFilters.dateTo = toDate;
    container.querySelector('#reportFrom').value = fromDate;
    container.querySelector('#reportTo').value = toDate;
  };

  const renderPreview = () => {
    reportType = typeSel.value;
    reportFilters.period = periodSel.value;
    reportFilters.search = container.querySelector('#reportSearch').value;
    reportFilters.dateFrom = container.querySelector('#reportFrom').value;
    reportFilters.dateTo = container.querySelector('#reportTo').value;

    if (reportType === 'summary') {
      const m = dashboardMetrics();
      preview.innerHTML = `
        <h2>Business Summary</h2>
        <div class="report-grid">
          <div><strong>Total Deals:</strong> ${m.totalDeals}</div>
          <div><strong>Total KG:</strong> ${fmtNum(m.totalKg, 3)}</div>
          <div><strong>Purchase:</strong> ${fmtMoney(m.totalPurchase)}</div>
          <div><strong>Sale:</strong> ${fmtMoney(m.totalSale)}</div>
          <div><strong>Profit:</strong> ${fmtMoney(m.totalProfit)}</div>
          <div><strong>Commission:</strong> ${fmtMoney(m.totalCommission)}</div>
          <div><strong>Outstanding Party:</strong> ${fmtMoney(m.outstandingParty)}</div>
          <div><strong>Outstanding Factory:</strong> ${fmtMoney(m.outstandingFactory)}</div>
        </div>`;
      preview._deals = null;
      preview._payments = null;
      preview._rows = [
        { Metric: 'Total Deals', Value: m.totalDeals },
        { Metric: 'Total KG', Value: fmtNum(m.totalKg, 3) },
        { Metric: 'Purchase', Value: fmtMoney(m.totalPurchase) },
        { Metric: 'Sale', Value: fmtMoney(m.totalSale) },
        { Metric: 'Profit', Value: fmtMoney(m.totalProfit) },
        { Metric: 'Commission', Value: fmtMoney(m.totalCommission) },
        { Metric: 'Outstanding Party', Value: fmtMoney(m.outstandingParty) },
        { Metric: 'Outstanding Factory', Value: fmtMoney(m.outstandingFactory) }
      ];
      preview._exportType = 'summary';
      return;
    }

    if (reportType === 'outstanding') {
      const { partyRows, factoryRows } = buildOutstandingRows();
      preview.innerHTML = `
        <h2>Outstanding Report</h2>
        <h3>Party Outstanding</h3>
        <table><thead><tr><th>Party</th><th>Total Sale</th><th>Paid</th><th>Outstanding</th></tr></thead>
        <tbody>${partyRows.length ? partyRows.map((r) => `<tr><td>${esc(r.name)}</td><td>${fmtMoney(r.total)}</td><td>${fmtMoney(r.paid)}</td><td>${fmtMoney(r.out)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">None</td></tr>'}</tbody></table>
        <h3>Factory Outstanding</h3>
        <table><thead><tr><th>Factory</th><th>Total Purchase</th><th>Paid</th><th>Outstanding</th></tr></thead>
        <tbody>${factoryRows.length ? factoryRows.map((r) => `<tr><td>${esc(r.name)}</td><td>${fmtMoney(r.total)}</td><td>${fmtMoney(r.paid)}</td><td>${fmtMoney(r.out)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">None</td></tr>'}</tbody></table>`;
      preview._deals = null;
      preview._payments = null;
      preview._rows = [
        ...partyRows.map((r) => ({ Name: r.name, Type: 'Party', Total: fmtMoney(r.total), Paid: fmtMoney(r.paid), Outstanding: fmtMoney(r.out) })),
        ...factoryRows.map((r) => ({ Name: r.name, Type: 'Factory', Total: fmtMoney(r.total), Paid: fmtMoney(r.paid), Outstanding: fmtMoney(r.out) }))
      ];
      preview._exportType = 'outstanding';
      return;
    }

    if (reportType === 'deals' || reportType === 'profit') {
      const deals = filterDeals(reportFilters);
      const totals = {
        kg: deals.reduce((a, d) => a + d.totalKg, 0),
        purchase: deals.reduce((a, d) => a + d.totalPurchase, 0),
        sale: deals.reduce((a, d) => a + d.totalSale, 0),
        profit: deals.reduce((a, d) => a + d.totalProfit, 0),
        commission: deals.reduce((a, d) => a + d.totalCommission, 0)
      };
      preview.innerHTML = `
        <h2>${reportType === 'profit' ? 'Profit Report' : 'Deal Register'}</h2>
        <p class="hint">Total Profit: ${fmtMoney(totals.profit)} | Total KG: ${fmtNum(totals.kg, 3)} | Commission: ${fmtMoney(totals.commission)}</p>
        <div class="tableResponsive"><table>
          <thead><tr><th>Deal No</th><th>Date</th><th>Party</th><th>Factory</th><th>Grades</th><th>KG</th><th>Purchase</th><th>Sale</th><th>Profit</th></tr></thead>
          <tbody>${deals.length ? deals.map((d) => `<tr><td>${esc(d.dealNo)}</td><td>${fmtDate(d.date)}</td><td>${esc(d.partyName)}</td><td>${esc(d.factoryName)}</td><td>${esc(d.grade)}</td><td>${fmtNum(d.totalKg, 3)}</td><td>${fmtMoney(d.totalPurchase)}</td><td>${fmtMoney(d.totalSale)}</td><td>${fmtMoney(d.totalProfit)}</td></tr>`).join('') : '<tr><td colspan="9" class="empty">No data</td></tr>'}</tbody>
        </table></div>`;
      preview._deals = deals;
      preview._totals = totals;
      return;
    }

    const type = reportType === 'party-pay' ? 'PARTY' : 'FACTORY';
    let payments = getState().payments.filter((p) => p.type === type).sort((a, b) => b.date.localeCompare(a.date));
    if (reportFilters.dateFrom) payments = payments.filter((p) => p.date >= reportFilters.dateFrom);
    if (reportFilters.dateTo) payments = payments.filter((p) => p.date <= reportFilters.dateTo);
    preview.innerHTML = `
      <h2>${type === 'PARTY' ? 'Party' : 'Factory'} Payment Register</h2>
      <p class="hint">Total: ${fmtMoney(payments.reduce((a, p) => a + p.amount, 0))}</p>
      <div class="tableResponsive"><table>
        <thead><tr><th>Date</th><th>Payment No</th><th>Name</th><th>Amount</th><th>Mode</th></tr></thead>
        <tbody>${payments.map((p) => `<tr><td>${fmtDate(p.date)}</td><td>${esc(p.paymentNo)}</td><td>${esc(p.entityName)}</td><td>${fmtMoney(p.amount)}</td><td>${esc(p.mode)}</td></tr>`).join('')}</tbody>
      </table></div>`;
    preview._payments = payments;
    preview._deals = null;
    preview._rows = [];
    return;
  };

  typeSel.addEventListener('change', renderPreview);
  periodSel.addEventListener('change', () => {
    applyPeriod();
    renderPreview();
  });
  container.querySelector('#reportSearch').addEventListener('input', renderPreview);
  container.querySelector('#reportFrom').addEventListener('change', () => {
    reportFilters.period = 'custom';
    renderPreview();
  });
  container.querySelector('#reportTo').addEventListener('change', () => {
    reportFilters.period = 'custom';
    renderPreview();
  });

  const exportCurrent = () => {
    renderPreview();
    if (preview._deals) {
      exportDealsExcel(preview._deals, reportType);
      return;
    }
    if (preview._payments) {
      exportPaymentsExcel(preview._payments, reportType);
      return;
    }
    if (preview._rows && preview._rows.length) {
      exportReportCsv(preview._rows, reportType);
      return;
    }
    toast('Nothing to export for this report.');
  };

  const printCurrent = () => {
    renderPreview();
    if (preview._deals) {
      printDealsPdf(reportType, preview._deals, preview._totals);
      return;
    }
    printHtmlPdf(`Report — ${reportType}`, preview.innerHTML);
  };

  container.querySelector('#reportExcel').addEventListener('click', exportCurrent);
  container.querySelector('#reportPdf').addEventListener('click', printCurrent);

  const importDealsInput = container.querySelector('#importDealsCsv');
  importDealsInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    importDealsInput.value = '';
    if (!file) return;
    try {
      const result = await importDealsFromCsv(file);
      result.dealsData.forEach((deal) => {
        try { saveDeal(deal); }
        catch (err) { console.warn('Imported deal skipped:', err.message); }
      });
      toast(`Imported ${result.imported} deals successfully.`);
      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }
      renderPreview();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  renderPreview();
}

export function renderSettings(container) {
  const s = getState().settings;
  const parties = getState().parties;
  const factories = getState().factories;

  container.innerHTML = `
    <section class="dealBox">
      <h2>Settings</h2>
      <form id="settingsForm" class="grid grid-3">
        <label>Company Name<input name="companyName" value="${esc(s.companyName)}" /></label>
        <label>Default Commission (₹/KG)<input name="defaultCommissionPerKg" type="number" step="0.01" value="${s.defaultCommissionPerKg ?? DEFAULT_COMMISSION}" /></label>
        <label>Bucket to KG<input name="bucketToKg" type="number" step="1" value="${s.bucketToKg ?? BUCKET_TO_KG}" /></label>
        <label>Warehouse Name<input name="warehouseName" value="${esc(s.warehouseName || 'Main Warehouse')}" /></label>
        <label>Opening Stock (KG)<input name="openingStockKg" type="number" step="0.001" value="${s.openingStockKg ?? 0}" /></label>
        <label class="checkbox-label"><input name="firebaseEnabled" type="checkbox" ${s.firebaseEnabled ? 'checked' : ''} /> Enable Firebase Cloud Backup</label>
        <label class="span-full">Firebase Config (JSON)<textarea name="firebaseConfigJson" rows="3" placeholder='{"apiKey":"...","authDomain":"...","databaseURL":"...","projectId":"..."}'>${s.firebaseConfig ? esc(JSON.stringify(s.firebaseConfig)) : ''}</textarea></label>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
      <p class="hint">Bucket × ${s.bucketToKg || BUCKET_TO_KG} = KG | Data syncs in real time via Firestore. Optional RTDB cloud backup above.</p>
    </section>
    ${renderEntityTable('Parties', parties, 'party')}
    ${renderEntityTable('Factories', factories, 'factory')}`;

  container.querySelector('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let firebaseConfig = null;
    const cfgText = fd.get('firebaseConfigJson')?.toString().trim();
    if (cfgText) {
      try { firebaseConfig = JSON.parse(cfgText); }
      catch { toast('Invalid Firebase config JSON.', 'error'); return; }
    }
    updateSettings({
      companyName: fd.get('companyName'),
      defaultCommissionPerKg: parseFloat(fd.get('defaultCommissionPerKg')),
      bucketToKg: parseInt(fd.get('bucketToKg'), 10),
      warehouseName: fd.get('warehouseName'),
      openingStockKg: parseFloat(fd.get('openingStockKg')),
      firebaseEnabled: fd.get('firebaseEnabled') === 'on',
      firebaseConfig
    });
    toast('Settings saved.');
  });

  bindEntityEdits(container, 'party');
  bindEntityEdits(container, 'factory');
}

function renderEntityTable(title, items, type) {
  return `
    <section class="tableBox">
      <h2>${title}</h2>
      <div class="tableResponsive">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>WhatsApp Number</th><th>Address</th><th>Actions</th></tr></thead>
          <tbody>
            ${items.length ? items.map((item) => `
              <tr data-entity="${type}" data-id="${item.id}">
                <td><input class="inline-input" data-field="name" value="${esc(item.name)}" /></td>
                <td><input class="inline-input" data-field="phone" value="${esc(item.phone || '')}" /></td>
                <td><input class="inline-input" data-field="whatsappNumber" value="${esc(item.whatsappNumber || '')}" /></td>
                <td><input class="inline-input" data-field="address" value="${esc(item.address || '')}" /></td>
                <td><button type="button" class="deleteBtn" data-del-entity="${type}" data-id="${item.id}">Delete</button></td>
              </tr>`).join('') : `<tr><td colspan="5" class="empty">No ${title.toLowerCase()} yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;
}

function bindEntityEdits(container, type) {
  const updater = type === 'party' ? updateParty : updateFactory;
  const deleter = type === 'party' ? deleteParty : deleteFactory;

  container.querySelectorAll(`tr[data-entity="${type}"]`).forEach((row) => {
    row.querySelectorAll('.inline-input').forEach((input) => {
      input.addEventListener('change', () => {
        updater(row.dataset.id, { [input.dataset.field]: input.value });
      });
    });
  });

  container.querySelectorAll(`[data-del-entity="${type}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      confirmAction(`Delete this ${type}?`, () => {
        try { deleter(btn.dataset.id); toast('Deleted.'); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
  });
}

export function renderBackup(container) {
  const st = getState();
  const last = getLastBackupInfo();
  const lastDate = last?.date ? fmtDate(last.date) : '—';
  const lastTime = last?.time || '—';
  const lastSize = last?.sizeLabel || '—';

  container.innerHTML = `
    <section class="backup-page">
      <div class="backup-hero dealBox">
        <div class="backup-hero-text">
          <h2>Backup & Restore</h2>
          <p class="hint">Export your data regularly. All information is stored in browser localStorage.</p>
        </div>
        <div class="backup-hero-icon" aria-hidden="true">💾</div>
      </div>

      <div class="backup-info-grid">
        <div class="backup-info-card">
          <span class="backup-info-label">Last Backup Date</span>
          <strong class="backup-info-value">${esc(lastDate)}</strong>
        </div>
        <div class="backup-info-card">
          <span class="backup-info-label">Last Backup Time</span>
          <strong class="backup-info-value">${esc(lastTime)}</strong>
        </div>
        <div class="backup-info-card">
          <span class="backup-info-label">Backup Size</span>
          <strong class="backup-info-value">${esc(lastSize)}</strong>
        </div>
      </div>

      <div class="backup-data-grid">
        <div class="backup-data-card">
          <span class="backup-data-icon">📋</span>
          <div>
            <span class="backup-data-label">Total Deals</span>
            <strong class="backup-data-value">${st.deals.length}</strong>
          </div>
        </div>
        <div class="backup-data-card">
          <span class="backup-data-icon">👤</span>
          <div>
            <span class="backup-data-label">Total Parties</span>
            <strong class="backup-data-value">${st.parties.length}</strong>
          </div>
        </div>
        <div class="backup-data-card">
          <span class="backup-data-icon">🏭</span>
          <div>
            <span class="backup-data-label">Total Factories</span>
            <strong class="backup-data-value">${st.factories.length}</strong>
          </div>
        </div>
        <div class="backup-data-card">
          <span class="backup-data-icon">💵</span>
          <div>
            <span class="backup-data-label">Total Payments</span>
            <strong class="backup-data-value">${st.payments.length}</strong>
          </div>
        </div>
        <div class="backup-data-card backup-data-card-muted">
          <span class="backup-data-icon">💰</span>
          <div>
            <span class="backup-data-label">Rates</span>
            <strong class="backup-data-value">${st.rates.length}</strong>
          </div>
        </div>
      </div>

      <section class="dealBox backup-actions-box">
        <h3 class="backup-actions-title">Actions</h3>
        <p class="hint backup-filename-hint">Backup files are saved as <code>Mahavir_Backup_YYYY-MM-DD_HH-MM-SS.json</code></p>
        <div class="form-actions backup-form-actions">
          <button type="button" class="btn btn-primary btn-backup-export" id="exportBtn">
            <span aria-hidden="true">⬇</span> Export Backup (JSON)
          </button>
          <label class="btn btn-secondary file-btn">
            <span aria-hidden="true">⬆</span> Restore Backup
            <input type="file" accept=".json,application/json" id="restoreInput" hidden />
          </label>
          ${isFirebaseReady() ? '<button type="button" class="btn btn-secondary" id="cloudPush"><span aria-hidden="true">☁</span> Push to Cloud</button><button type="button" class="btn btn-secondary" id="cloudPull"><span aria-hidden="true">☁</span> Pull from Cloud</button>' : ''}
          <button type="button" class="btn btn-danger" id="clearBtn">Clear All Data</button>
        </div>
      </section>
    </section>`;

  container.querySelector('#exportBtn').addEventListener('click', () => {
    exportBackupFile();
    toast('Backup downloaded.');
    renderBackup(container);
  });

  const restoreInput = container.querySelector('#restoreInput');
  restoreInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    restoreInput.value = '';
    if (!file) return;
    try {
      const preview = await readBackupPreview(file);
      showBackupPreviewModal(preview, async () => {
        try {
          await importBackupFile(file);
          toast('Backup restored successfully.');
          renderBackup(container);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  container.querySelector('#clearBtn')?.addEventListener('click', () => {
    confirmAction('Permanently delete ALL data?', () => { clearAllData(); toast('Data cleared.'); });
  });

  container.querySelector('#cloudPush')?.addEventListener('click', async () => {
    try { await syncToCloud(); toast('Synced to cloud.'); }
    catch (err) { toast(err.message, 'error'); }
  });

  container.querySelector('#cloudPull')?.addEventListener('click', async () => {
    confirmAction('Pull cloud data and overwrite local?', async () => {
      try { await syncFromCloud(); toast('Synced from cloud.'); }
      catch (err) { toast(err.message, 'error'); }
    });
  });
}
