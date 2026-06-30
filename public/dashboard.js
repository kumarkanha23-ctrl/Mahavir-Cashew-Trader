import {
  dashboardMetrics, filterDeals, fmtDate, fmtMoney, fmtNum, esc, getState, getDealGradeLabel,
  exportBackupFile, getLastBackupInfo, toast
} from './app.js';

export function renderDashboard(container) {
  const m = dashboardMetrics();
  const recent = filterDeals({}).slice(0, 10);
  const last = getLastBackupInfo();

  container.innerHTML = `
    <section class="dashboard-toolbar">
      <button type="button" class="btn btn-primary btn-quick-backup" id="quickBackupBtn">
        <span aria-hidden="true">💾</span> Quick Backup
      </button>
      ${last ? `<span class="dashboard-backup-hint">Last backup: ${esc(fmtDate(last.date))} at ${esc(last.time)} (${esc(last.sizeLabel)})</span>` : '<span class="dashboard-backup-hint">No backup taken yet</span>'}
    </section>
    <section class="dashboard">
      <div class="card"><h4>Total Deals</h4><h2>${m.totalDeals}</h2></div>
      <div class="card"><h4>Total KG</h4><h2>${fmtNum(m.totalKg, 3)}</h2></div>
      <div class="card"><h4>Purchase</h4><h2>${fmtMoney(m.totalPurchase)}</h2></div>
      <div class="card"><h4>Sale</h4><h2>${fmtMoney(m.totalSale)}</h2></div>
      <div class="card"><h4>Profit</h4><h2>${fmtMoney(m.totalProfit)}</h2></div>
      <div class="card"><h4>Commission</h4><h2>${fmtMoney(m.totalCommission)}</h2></div>
      <div class="card highlight"><h4>Outstanding Party</h4><h2>${fmtMoney(m.outstandingParty)}</h2></div>
      <div class="card highlight-warn"><h4>Outstanding Factory</h4><h2>${fmtMoney(m.outstandingFactory)}</h2></div>
    </section>
    <section class="tableBox">
      <h2>Recent Deals</h2>
      <div class="tableResponsive">
        <table>
          <thead>
            <tr>
              <th>Deal No</th><th>Date</th><th>Party</th><th>Factory</th>
              <th>Grades</th><th>KG</th><th>Sale</th><th>Profit</th>
            </tr>
          </thead>
          <tbody>
            ${recent.length ? recent.map((d) => `
              <tr>
                <td>${esc(d.dealNo)}</td>
                <td>${fmtDate(d.date)}</td>
                <td>${esc(d.partyName)}</td>
                <td>${esc(d.factoryName)}</td>
                <td>${esc(getDealGradeLabel(d))}</td>
                <td>${fmtNum(d.totalKg, 3)}</td>
                <td>${fmtMoney(d.totalSale)}</td>
                <td>${fmtMoney(d.totalProfit)}</td>
              </tr>`).join('') : '<tr><td colspan="8" class="empty">No deals yet. Create your first deal.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="info-cards">
      <div class="card">
        <h4>Warehouse</h4>
        <p>${esc(getState().settings.warehouseName || 'Main Warehouse')}</p>
        <p class="muted">Opening Stock: ${fmtNum(getState().settings.openingStockKg || 0, 3)} KG</p>
      </div>
      <div class="card">
        <h4>Quick Stats</h4>
        <p>Parties: ${getState().parties.length} | Factories: ${getState().factories.length}</p>
        <p>Payments: ${getState().payments.length} | Rates: ${getState().rates.length}</p>
      </div>
    </section>`;

  container.querySelector('#quickBackupBtn')?.addEventListener('click', () => {
    exportBackupFile();
    toast('Backup downloaded.');
    renderDashboard(container);
  });
}
