import { mountPage, confirmDialog, renderModal } from '../components/modal.js';
import { el } from '../../utils/dom.js';
import {
  exportBackup, restoreBackup, resetAllData, getLastBackupInfo,
  readBackupPreview, formatBackupExportedLabel
} from '../../storage/backupService.js';
import { showToast } from '../components/toast.js';
import { getState } from '../../core/state.js';
import { APP_NAME } from '../../config.js';
import { formatDate } from '../../utils/date.js';

function showRestorePreview(preview, onConfirm) {
  const { stats, fileName, fileSizeLabel, parsed } = preview;
  const content = el('div', { className: 'backup-preview-modal' }, [
    el('p', { className: 'hint', textContent: 'Review the backup contents below. Restoring will replace all current data on this device.' }),
    el('div', { className: 'backup-preview-meta' }, [
      el('div', {}, [el('span', { className: 'label', textContent: 'File' }), el('strong', { textContent: fileName })]),
      el('div', {}, [el('span', { className: 'label', textContent: 'Size' }), el('strong', { textContent: fileSizeLabel })]),
      el('div', {}, [el('span', { className: 'label', textContent: 'Exported' }), el('strong', { textContent: formatBackupExportedLabel(stats.exportedAt) })]),
      el('div', {}, [el('span', { className: 'label', textContent: 'App' }), el('strong', { textContent: stats.app || APP_NAME })])
    ]),
    el('div', { className: 'backup-preview-stats' }, [
      ['Deals', stats.deals], ['Parties', stats.parties], ['Factories', stats.factories],
      ['Payments', stats.payments], ['Rates', stats.rates]
    ].map(([label, value]) => el('div', { className: 'backup-stat-card' }, [
      el('span', { textContent: label }),
      el('strong', { textContent: String(value) })
    ]))),
    el('details', { className: 'backup-json-preview' }, [
      el('summary', { textContent: 'View raw JSON (first 2 KB)' }),
      el('pre', { textContent: JSON.stringify(parsed, null, 2).slice(0, 2048) + (JSON.stringify(parsed).length > 2048 ? '\n…' : '') })
    ]),
    el('div', { className: 'modal-actions' }, [
      el('button', { className: 'btn btn-secondary', textContent: 'Cancel', onclick: (e) => e.target.closest('.modal-overlay')?.remove() }),
      el('button', {
        className: 'btn btn-danger',
        textContent: 'Restore Backup',
        onclick: () => {
          document.querySelector('.modal-overlay')?.remove();
          onConfirm();
        }
      })
    ])
  ]);
  renderModal('Restore Backup Preview', content);
}

export function renderBackupPage(container) {
  const stats = getState();
  const last = getLastBackupInfo();
  const lastDate = last?.date ? formatDate(last.date) : '—';
  const lastTime = last?.time || '—';
  const lastSize = last?.sizeLabel || '—';

  const content = el('div', { className: 'backup-page' }, [
    el('div', { className: 'backup-hero dealBox' }, [
      el('div', { className: 'backup-hero-text' }, [
        el('h2', { textContent: 'Backup & Restore' }),
        el('p', { className: 'hint', textContent: 'All data is stored locally in your browser. Export regularly to avoid data loss.' })
      ]),
      el('div', { className: 'backup-hero-icon', textContent: '💾', 'aria-hidden': 'true' })
    ]),
    el('div', { className: 'backup-info-grid' }, [
      el('div', { className: 'backup-info-card' }, [
        el('span', { className: 'backup-info-label', textContent: 'Last Backup Date' }),
        el('strong', { className: 'backup-info-value', textContent: lastDate })
      ]),
      el('div', { className: 'backup-info-card' }, [
        el('span', { className: 'backup-info-label', textContent: 'Last Backup Time' }),
        el('strong', { className: 'backup-info-value', textContent: lastTime })
      ]),
      el('div', { className: 'backup-info-card' }, [
        el('span', { className: 'backup-info-label', textContent: 'Backup Size' }),
        el('strong', { className: 'backup-info-value', textContent: lastSize })
      ])
    ]),
    el('div', { className: 'backup-data-grid' }, [
      el('div', { className: 'backup-data-card' }, [
        el('span', { className: 'backup-data-icon', textContent: '📋' }),
        el('div', {}, [
          el('span', { className: 'backup-data-label', textContent: 'Total Deals' }),
          el('strong', { className: 'backup-data-value', textContent: String(stats.deals.length) })
        ])
      ]),
      el('div', { className: 'backup-data-card' }, [
        el('span', { className: 'backup-data-icon', textContent: '👤' }),
        el('div', {}, [
          el('span', { className: 'backup-data-label', textContent: 'Total Parties' }),
          el('strong', { className: 'backup-data-value', textContent: String(stats.parties.length) })
        ])
      ]),
      el('div', { className: 'backup-data-card' }, [
        el('span', { className: 'backup-data-icon', textContent: '🏭' }),
        el('div', {}, [
          el('span', { className: 'backup-data-label', textContent: 'Total Factories' }),
          el('strong', { className: 'backup-data-value', textContent: String(stats.factories.length) })
        ])
      ]),
      el('div', { className: 'backup-data-card' }, [
        el('span', { className: 'backup-data-icon', textContent: '💵' }),
        el('div', {}, [
          el('span', { className: 'backup-data-label', textContent: 'Total Payments' }),
          el('strong', { className: 'backup-data-value', textContent: String(stats.payments.length) })
        ])
      ]),
      el('div', { className: 'backup-data-card backup-data-card-muted' }, [
        el('span', { className: 'backup-data-icon', textContent: '💰' }),
        el('div', {}, [
          el('span', { className: 'backup-data-label', textContent: 'Rates' }),
          el('strong', { className: 'backup-data-value', textContent: String(stats.rates.length) })
        ])
      ])
    ]),
    el('div', { className: 'dealBox backup-actions-box' }, [
      el('h3', { className: 'backup-actions-title', textContent: 'Actions' }),
      el('p', { className: 'hint backup-filename-hint' }, [
        'Backup files are saved as ',
        el('code', { textContent: 'Mahavir_Backup_YYYY-MM-DD_HH-MM-SS.json' })
      ]),
      el('div', { className: 'form-actions backup-form-actions' }, [
        el('button', {
          className: 'btn btn-primary btn-backup-export',
          textContent: '⬇ Export Backup (JSON)',
          onclick: () => {
            exportBackup();
            showToast('Backup downloaded.');
            renderBackupPage(container);
          }
        }),
        el('label', { className: 'btn btn-secondary file-label' }, [
          '⬆ Restore Backup',
          el('input', {
            type: 'file',
            accept: '.json,application/json',
            style: 'display:none',
            onchange: async (e) => {
              const file = e.target.files[0];
              e.target.value = '';
              if (!file) return;
              try {
                const preview = await readBackupPreview(file);
                showRestorePreview(preview, async () => {
                  try {
                    await restoreBackup(file);
                    showToast('Backup restored successfully.');
                    renderBackupPage(container);
                  } catch (err) {
                    showToast(err.message, 'error');
                  }
                });
              } catch (err) {
                showToast(err.message, 'error');
              }
            }
          })
        ]),
        el('button', {
          className: 'btn btn-danger',
          textContent: 'Clear All Data',
          onclick: () => confirmDialog('Delete ALL data permanently?', () => {
            resetAllData();
            showToast('All data cleared.');
            renderBackupPage(container);
          })
        })
      ])
    ])
  ]);

  mountPage(container, 'Backup & Restore', content);
}
