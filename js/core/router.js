import { ROUTES } from '../config.js';

const routes = new Map();
let currentRoute = null;
let currentParams = {};

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function getCurrentRoute() {
  return { path: currentRoute, params: { ...currentParams } };
}

function parseHash() {
  const hash = window.location.hash.slice(1) || ROUTES.dashboard;
  const [pathPart, queryPart] = hash.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const params = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((val, key) => {
      params[key] = val;
    });
  }
  return { path, params };
}

function matchRoute(path) {
  if (routes.has(path)) return { handler: routes.get(path), params: {} };

  for (const [pattern, handler] of routes) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params };
  }
  return null;
}

export function navigate(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  window.location.hash = query ? `${path}?${query}` : path;
}

export function initRouter(onRouteChange) {
  const handle = () => {
    const { path, params } = parseHash();
    const match = matchRoute(path);
    if (!match) {
      navigate(ROUTES.dashboard);
      return;
    }
    currentRoute = path;
    currentParams = { ...params, ...match.params };
    onRouteChange(currentRoute, currentParams, match.handler);
  };

  window.addEventListener('hashchange', handle);
  handle();
}

export function getNavItems() {
  return [
    { path: ROUTES.dashboard, label: 'Dashboard', icon: '📊' },
    { path: ROUTES.rateMaster, label: 'Rate Master', icon: '💰' },
    { path: ROUTES.newDeal, label: 'New Deal', icon: '➕' },
    { path: ROUTES.recentDeals, label: 'Recent Deals', icon: '📋' },
    { path: ROUTES.partyLedger, label: 'Party Ledger', icon: '👤' },
    { path: ROUTES.factoryLedger, label: 'Factory Ledger', icon: '🏭' },
    { path: ROUTES.partyPayment, label: 'Party Payment', icon: '💵' },
    { path: ROUTES.factoryPayment, label: 'Factory Payment', icon: '🏦' },
    { path: ROUTES.reports, label: 'Reports', icon: '📈' },
    { path: ROUTES.settings, label: 'Settings', icon: '⚙️' },
    { path: ROUTES.backup, label: 'Backup & Restore', icon: '💾' }
  ];
}
