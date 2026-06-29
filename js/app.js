import { initStorage } from './storage/backupService.js';
import { initRouter, registerRoute, navigate } from './core/router.js';
import { ROUTES } from './config.js';
import { renderHeader } from './ui/layout/header.js';
import { renderSidebar, updateSidebarActive } from './ui/layout/sidebar.js';
import { initToast, showToast } from './ui/components/toast.js';
import { on, emit, Events } from './core/eventBus.js';

import { renderDashboardPage } from './ui/pages/dashboardPage.js';
import { renderRateMasterPage } from './ui/pages/rateMasterPage.js';
import { renderNewDealPage } from './ui/pages/newDealPage.js';
import { renderRecentDealsPage } from './ui/pages/recentDealsPage.js';
import { renderPartyLedgerPage } from './ui/pages/partyLedgerPage.js';
import { renderFactoryLedgerPage } from './ui/pages/factoryLedgerPage.js';
import { renderPartyPaymentPage } from './ui/pages/partyPaymentPage.js';
import { renderFactoryPaymentPage } from './ui/pages/factoryPaymentPage.js';
import { renderReportsPage } from './ui/pages/reportsPage.js';
import { renderSettingsPage } from './ui/pages/settingsPage.js';
import { renderBackupPage } from './ui/pages/backupPage.js';

const mainContent = document.getElementById('main-content');
const sidebarContainer = document.getElementById('sidebar');
const headerContainer = document.getElementById('header');

function mountShell() {
  headerContainer.appendChild(renderHeader());
  sidebarContainer.appendChild(renderSidebar(navigate));

  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
}

function registerRoutes() {
  registerRoute(ROUTES.dashboard, (c, p) => renderDashboardPage(c, p));
  registerRoute(ROUTES.rateMaster, (c, p) => renderRateMasterPage(c, p));
  registerRoute(ROUTES.newDeal, (c, p) => renderNewDealPage(c, p));
  registerRoute(ROUTES.recentDeals, (c, p) => renderRecentDealsPage(c, p));
  registerRoute(ROUTES.partyLedger, (c, p) => renderPartyLedgerPage(c, p));
  registerRoute(ROUTES.factoryLedger, (c, p) => renderFactoryLedgerPage(c, p));
  registerRoute(ROUTES.partyPayment, (c, p) => renderPartyPaymentPage(c, p));
  registerRoute(ROUTES.factoryPayment, (c, p) => renderFactoryPaymentPage(c, p));
  registerRoute(ROUTES.reports, (c, p) => renderReportsPage(c, p));
  registerRoute(ROUTES.settings, (c, p) => renderSettingsPage(c, p));
  registerRoute(ROUTES.backup, (c, p) => renderBackupPage(c, p));
}

function handleRoute(path, params, handler) {
  updateSidebarActive(path);
  document.body.classList.remove('sidebar-open');
  mainContent.innerHTML = '';
  handler(mainContent, params);
  emit(Events.ROUTE_CHANGED, { path, params });
}

function bindGlobalEvents() {
  on(Events.DATA_CHANGED, () => {
    // Pages self-refresh via their own listeners
  });

  window.addEventListener('error', (e) => {
    console.error(e.error || e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    showToast(e.reason?.message || 'An unexpected error occurred.', 'error');
  });
}

function bootstrap() {
  initToast();
  initStorage();
  mountShell();
  registerRoutes();
  bindGlobalEvents();
  initRouter(handleRoute);
}

bootstrap();
