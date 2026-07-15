import {
  dashboardMetrics, filterDeals, fmtDate, fmtMoney, fmtNum, esc, getState, getDealGradeLabel,
  exportBackupFile, getLastBackupInfo, toast
} from './app.js';

export function renderDashboard(container) {
  const m = dashboardMetrics();
  const recent = filterDeals({}).slice(0, 10);
  const last = getLastBackupInfo();
  const state = getState();
  const companyName = state.settings.companyName || 'Mahavir Cashew Trader';
  const recentActivities = recent.slice(0, 6).map((d) => `
    <li class="activity-item">
      <div>
        <strong>${esc(d.dealNo)}</strong>
        <span>${esc(d.partyName)} • ${esc(d.factoryName)}</span>
      </div>
      <em>${fmtMoney(d.totalSale)}</em>
    </li>`).join('');
  const topParties = (state.parties || []).slice(0, 6).map((party) => `
    <li class="stack-item">
      <span>${esc(party.name || 'Party')}</span>
      <strong>${esc(party.phone || '—')}</strong>
    </li>`).join('');
  const topFactories = (state.factories || []).slice(0, 6).map((factory) => `
    <li class="stack-item">
      <span>${esc(factory.name || 'Factory')}</span>
      <strong>${esc(factory.phone || '—')}</strong>
    </li>`).join('');

  container.innerHTML = `
    <section class="dashboard-hero">
      <div class="hero-copy">
        <span class="hero-pill">Premium ERP Workspace</span>
        <h2>Welcome back to ${esc(companyName)}</h2>
        <p>Monitor deals, payments, commissions and ledgers from a refined command center built for daily trading operations.</p>
        <div class="hero-actions">
          <button type="button" class="btn btn-primary" id="quickBackupBtn">
            <span aria-hidden="true">💾</span> Quick Backup
          </button>
          <button type="button" class="btn btn-secondary" id="goToDealsBtn">
            <span aria-hidden="true">📋</span> Open Deals
          </button>
        </div>
        ${last ? `<div class="hero-meta">Last backup: ${esc(fmtDate(last.date))} • ${esc(last.time)} • ${esc(last.sizeLabel)}</div>` : '<div class="hero-meta">No backup taken yet</div>'}
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><span>Today's Deals</span><strong>${recent.length}</strong></div>
        <div class="hero-stat"><span>Units</span><strong>${fmtNum(m.totalKg, 3)} KG</strong></div>
        <div class="hero-stat"><span>Profit</span><strong>${fmtMoney(m.totalProfit)}</strong></div>
      </div>
    </section>

    <section class="dashboard-grid">
      <div class="dashboard-panel">
        <div class="panel-head">
          <h3>Performance overview</h3>
          <span class="panel-badge">Live</span>
        </div>
        <div class="metric-grid">
          <div class="metric-card"><h4>Total Deals</h4><h2>${m.totalDeals}</h2></div>
          <div class="metric-card"><h4>Total KG</h4><h2>${fmtNum(m.totalKg, 3)}</h2></div>
          <div class="metric-card"><h4>Purchase</h4><h2>${fmtMoney(m.totalPurchase)}</h2></div>
          <div class="metric-card"><h4>Sale</h4><h2>${fmtMoney(m.totalSale)}</h2></div>
          <div class="metric-card"><h4>Profit</h4><h2>${fmtMoney(m.totalProfit)}</h2></div>
          <div class="metric-card"><h4>Commission</h4><h2>${fmtMoney(m.totalCommission)}</h2></div>
          <div class="metric-card highlight"><h4>Outstanding Party</h4><h2>${fmtMoney(m.outstandingParty)}</h2></div>
          <div class="metric-card highlight-warn"><h4>Outstanding Factory</h4><h2>${fmtMoney(m.outstandingFactory)}</h2></div>
        </div>
      </div>
      <div class="dashboard-panel">
        <div class="panel-head">
          <h3>Payment pulse</h3>
          <span class="panel-badge muted">Overview</span>
        </div>
        <div class="mini-chart">
          <div class="chart-row"><span>Parties</span><div class="bar"><i style="width:${Math.min(100, Math.round((m.outstandingParty / Math.max(1, m.totalSale)) * 100))}%"></i></div></div>
          <div class="chart-row"><span>Factories</span><div class="bar"><i style="width:${Math.min(100, Math.round((m.outstandingFactory / Math.max(1, m.totalPurchase)) * 100))}%"></i></div></div>
          <div class="chart-row"><span>Commission</span><div class="bar"><i style="width:${Math.min(100, Math.round((m.totalCommission / Math.max(1, m.totalSale)) * 100))}%"></i></div></div>
        </div>
        <div class="info-strip">
          <div><strong>${state.parties.length}</strong><span>Parties</span></div>
          <div><strong>${state.factories.length}</strong><span>Factories</span></div>
          <div><strong>${state.payments.length}</strong><span>Payments</span></div>
        </div>
      </div>
    </section>

    <section class="dashboard-grid secondary">
      <div class="dashboard-panel">
        <div class="panel-head">
          <h3>Recent activities</h3>
          <span class="panel-badge">Latest</span>
        </div>
        <ul class="activity-list">${recentActivities || '<li class="activity-item"><span>No recent deals yet</span></li>'}</ul>
      </div>
      <div class="dashboard-panel">
        <div class="panel-head">
          <h3>Top parties</h3>
          <span class="panel-badge">Priority</span>
        </div>
        <ul class="stack-list">${topParties || '<li class="stack-item"><span>No party data yet</span></li>'}</ul>
      </div>
      <div class="dashboard-panel">
        <div class="panel-head">
          <h3>Top factories</h3>
          <span class="panel-badge">Priority</span>
        </div>
        <ul class="stack-list">${topFactories || '<li class="stack-item"><span>No factory data yet</span></li>'}</ul>
      </div>
    </section>

    <section class="dashboard-panel wide-panel">
      <div class="panel-head">
        <h3>Recent deals</h3>
        <span class="panel-badge">Operations</span>
      </div>
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
    </section>`;

  container.querySelector('#quickBackupBtn')?.addEventListener('click', () => {
    exportBackupFile();
    toast('Backup downloaded.');
    renderDashboard(container);
  });

  container.querySelector('#goToDealsBtn')?.addEventListener('click', () => {
    window.location.hash = '#/recent-deals';
  });
}
