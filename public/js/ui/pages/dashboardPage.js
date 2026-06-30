import { mountPage } from '../components/modal.js';
import { statGrid, statCard } from '../components/statCard.js';
import { getDashboardReport } from '../../domain/services/reportService.js';
import { getAllDeals } from '../../domain/services/dealService.js';
import { formatCurrency, formatNumber } from '../../utils/currency.js';
import { formatDate } from '../../utils/date.js';
import { el } from '../../utils/dom.js';
import { on, Events } from '../../core/eventBus.js';
import { exportBackup, getLastBackupInfo } from '../../storage/backupService.js';
import { showToast } from '../components/toast.js';

let unsubscribe = null;

function buildContent() {
  const metrics = getDashboardReport();
  const recentDeals = getAllDeals().slice(0, 10);
  const last = getLastBackupInfo();

  const toolbar = el('section', { className: 'dashboard-toolbar' }, [
    el('button', {
      className: 'btn btn-primary btn-quick-backup',
      textContent: '💾 Quick Backup',
      onclick: () => {
        exportBackup();
        showToast('Backup downloaded.');
        renderDashboardPage(document.getElementById('mainContent'));
      }
    }),
    el('span', {
      className: 'dashboard-backup-hint',
      textContent: last
        ? `Last backup: ${formatDate(last.date)} at ${last.time} (${last.sizeLabel})`
        : 'No backup taken yet'
    })
  ]);

  const cards = statGrid([
    statCard('Total Deals', metrics.totalDeals),
    statCard('Total KG', formatNumber(metrics.totalKg, 3)),
    statCard('Purchase', formatCurrency(metrics.totalPurchase)),
    statCard('Sale', formatCurrency(metrics.totalSale)),
    statCard('Profit', formatCurrency(metrics.totalProfit)),
    statCard('Commission', formatCurrency(metrics.totalCommission)),
    statCard('Outstanding Party', formatCurrency(metrics.outstandingParty)),
    statCard('Outstanding Factory', formatCurrency(metrics.outstandingFactory))
  ]);

  const table = el('div', { className: 'tableBox' }, [
    el('h2', { textContent: 'Recent Deals' }),
    el('div', { className: 'tableResponsive' }, [
      el('table', {}, [
        el('thead', {}, [
          el('tr', {}, ['Deal No', 'Date', 'Party', 'Factory', 'Grade', 'KG', 'Sale', 'Profit'].map(
            (h) => el('th', { textContent: h })
          ))
        ]),
        el('tbody', {}, recentDeals.length
          ? recentDeals.map((d) => el('tr', {}, [
              el('td', { textContent: d.dealNo }),
              el('td', { textContent: formatDate(d.date) }),
              el('td', { textContent: d.partyName }),
              el('td', { textContent: d.factoryName }),
              el('td', { textContent: d.grade }),
              el('td', { textContent: formatNumber(d.kg, 3) }),
              el('td', { textContent: formatCurrency(d.saleAmount) }),
              el('td', { textContent: formatCurrency(d.profit) })
            ]))
          : [el('tr', {}, [el('td', { colSpan: '8', textContent: 'No deals yet.' })])]
        )
      ])
    ])
  ]);

  return el('div', {}, [toolbar, cards, table]);
}

export function renderDashboardPage(container) {
  mountPage(container, 'Dashboard', buildContent());
  if (unsubscribe) unsubscribe();
  unsubscribe = on(Events.DATA_CHANGED, () => renderDashboardPage(container));
}

export function destroyDashboardPage() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
