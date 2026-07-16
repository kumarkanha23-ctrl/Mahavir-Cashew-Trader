import {
  dashboardMetrics, filterDeals, fmtDate, fmtMoney, fmtNum, esc, getState, getDealGradeLabel,
  exportBackupFile, getLastBackupInfo, toast, today, getUserProfile, ROLE_LABELS
} from './app.js';

export function renderDashboard(container) {
  const m = dashboardMetrics();
  const recent = filterDeals({}).slice(0, 10);
  const last = getLastBackupInfo();
  const state = getState();
  const companyName = state.settings.companyName || 'Mahavir Cashew Trader';
  const profile = getUserProfile();
  const userDisplay = profile?.role ? (ROLE_LABELS[profile.role] || 'Admin') : 'Admin';
  const backupLabel = last ? `${esc(fmtDate(last.date))} • ${esc(last.time)}` : 'No backup yet';
  const completedPercent = Math.max(0, Math.min(100, Math.round((m.totalSale > 0 ? 100 - (m.outstandingParty / m.totalSale) * 100 : 100))));
  const pendingPercent = 100 - completedPercent;

  const recentActivities = recent.slice(0, 5).map((d, index) => `
    <li class="timeline-item">
      <span class="timeline-dot"></span>
      <div>
        <strong>${index === 0 ? 'New Deal' : index === 1 ? 'Party Update' : 'Deal Activity'}</strong>
        <span>${esc(d.dealNo)} • ${esc(d.partyName || '—')}</span>
      </div>
      <em>${fmtMoney(d.totalSale)}</em>
    </li>`).join('');

  const partyMetrics = (state.parties || []).map((party) => {
    const partyDeals = recent.filter((d) => d.partyName === party.name || d.partyId === party.id);
    const amount = partyDeals.reduce((sum, d) => sum + d.totalSale, 0);
    const dealCount = partyDeals.length;
    return { party, amount, dealCount };
  }).sort((a, b) => b.amount - a.amount).slice(0, 4);

  const factoryMetrics = (state.factories || []).map((factory) => {
    const factoryDeals = recent.filter((d) => d.factoryName === factory.name || d.factoryId === factory.id);
    const amount = factoryDeals.reduce((sum, d) => sum + d.totalPurchase, 0);
    const dealCount = factoryDeals.length;
    return { factory, amount, dealCount };
  }).sort((a, b) => b.amount - a.amount).slice(0, 4);

  const topParties = partyMetrics.map(({ party, amount, dealCount }) => {
    const progress = partyMetrics.length ? Math.max(20, Math.round((amount / Math.max(1, partyMetrics[0].amount)) * 100)) : 0;
    return `
      <li class="stack-card">
        <div class="stack-card-top">
          <div>
            <strong>${esc(party.name || 'Party')}</strong>
            <span>${dealCount} deals</span>
          </div>
          <em>${fmtMoney(amount)}</em>
        </div>
        <div class="progress-bar"><i style="width:${progress}%"></i></div>
      </li>`;
  }).join('');

  const topFactories = factoryMetrics.map(({ factory, amount, dealCount }) => {
    const progress = factoryMetrics.length ? Math.max(20, Math.round((amount / Math.max(1, factoryMetrics[0].amount)) * 100)) : 0;
    return `
      <li class="stack-card">
        <div class="stack-card-top">
          <div>
            <strong>${esc(factory.name || 'Factory')}</strong>
            <span>${dealCount} deals</span>
          </div>
          <em>${fmtMoney(amount)}</em>
        </div>
        <div class="progress-bar"><i style="width:${progress}%"></i></div>
      </li>`;
  }).join('');

  const kpiCards = [
    { label: 'Total Deals', value: m.totalDeals, icon: '📊', trend: '+12%' },
    { label: 'Total KG', value: `${fmtNum(m.totalKg, 3)} KG`, icon: '⚖️', trend: '+8%' },
    { label: 'Purchase', value: fmtMoney(m.totalPurchase), icon: '🧾', trend: '+6%' },
    { label: 'Sale', value: fmtMoney(m.totalSale), icon: '💰', trend: '+9%' },
    { label: 'Profit', value: fmtMoney(m.totalProfit), icon: '📈', trend: '+11%' },
    { label: 'Commission', value: fmtMoney(m.totalCommission), icon: '💼', trend: '+4%' },
    { label: 'Outstanding Party', value: fmtMoney(m.outstandingParty), icon: '👤', trend: 'Pending' },
    { label: 'Outstanding Factory', value: fmtMoney(m.outstandingFactory), icon: '🏭', trend: 'Pending' }
  ].map((card) => `
    <article class="kpi-card premium-kpi-card">
      <div class="kpi-card-top">
        <div class="kpi-icon">${card.icon}</div>
        <span class="kpi-pill">${card.trend}</span>
      </div>
      <div class="kpi-card-body">
        <h4>${card.label}</h4>
        <strong>${card.value}</strong>
      </div>
      <svg class="kpi-trend-line" viewBox="0 0 80 32" preserveAspectRatio="none">
        <path d="M0 24C8 18 16 16 24 17C34 18 38 10 47 9C58 8 67 6 80 4" />
      </svg>
    </article>`).join('');

  container.innerHTML = `
    <section class="dashboard-hero premium-dashboard-hero">
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
      <div class="hero-visual-card">
        <div class="hero-ring">
          <strong>${recent.length}</strong>
          <span>Live deals</span>
        </div>
      </div>
    </section>

    <section class="status-strip">
      <article class="status-card"><span>Today's Date</span><strong>${fmtDate(today())}</strong></article>
      <article class="status-card"><span>Live Sync</span><strong>Online</strong></article>
      <article class="status-card"><span>Last Backup</span><strong>${backupLabel}</strong></article>
      <article class="status-card"><span>Logged User</span><strong>${esc(userDisplay)}</strong></article>
    </section>

    <section class="kpi-grid">${kpiCards}</section>

    <section class="dashboard-grid premium-grid">
      <article class="dashboard-panel analytics-panel">
        <div class="panel-head">
          <h3>Payment Pulse</h3>
          <span class="panel-badge">Live</span>
        </div>
        <div class="payment-pulse-wrap">
          <div class="donut-chart" style="--value:${completedPercent};">
            <div class="donut-inner">
              <strong>${completedPercent}%</strong>
              <span>Completed</span>
            </div>
          </div>
          <div class="pulse-stats">
            <div class="pulse-stat"><span>Completed</span><strong>${completedPercent}%</strong></div>
            <div class="pulse-stat"><span>Pending</span><strong>${pendingPercent}%</strong></div>
            <div class="pulse-stat"><span>Total Payments</span><strong>${state.payments.length}</strong></div>
          </div>
        </div>
      </article>

      <article class="dashboard-panel">
        <div class="panel-head">
          <h3>Recent Activity</h3>
          <span class="panel-badge muted">Timeline</span>
        </div>
        <ul class="timeline-list">${recentActivities || '<li class="timeline-item"><span class="timeline-dot"></span><div><strong>No activity yet</strong><span>Create your first deal to start the timeline.</span></div></li>'}</ul>
      </article>
    </section>

    <section class="dashboard-grid secondary premium-grid">
      <article class="dashboard-panel">
        <div class="panel-head">
          <h3>Top Parties</h3>
          <span class="panel-badge">Priority</span>
        </div>
        <ul class="stack-list">${topParties || '<li class="stack-card"><div class="stack-card-top"><div><strong>No party data yet</strong><span>Create deals to see party metrics.</span></div></div></li>'}</ul>
      </article>
      <article class="dashboard-panel">
        <div class="panel-head">
          <h3>Top Factories</h3>
          <span class="panel-badge">Priority</span>
        </div>
        <ul class="stack-list">${topFactories || '<li class="stack-card"><div class="stack-card-top"><div><strong>No factory data yet</strong><span>Create deals to see factory metrics.</span></div></div></li>'}</ul>
      </article>
    </section>

    <section class="dashboard-panel wide-panel premium-table-card">
      <div class="panel-head">
        <h3>Latest Deals</h3>
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
