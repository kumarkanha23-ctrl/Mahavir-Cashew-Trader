import { APP_NAME, APP_VERSION } from '../config.js';
import { exportAllData, importAllData, clearAllData, initMeta } from './storageAdapter.js';
import { loadAll } from './dataStore.js';
import { setState, resetState } from '../core/state.js';
import { emit, Events } from '../core/eventBus.js';
import { timestampISO, formatDate } from '../utils/date.js';
import { KEYS } from './storageKeys.js';

export function initStorage() {
  initMeta();
  refreshState();
}

export function refreshState() {
  const data = loadAll();
  setState(data);
  return data;
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
      } catch (err) {
        reject(new Error(`Invalid JSON: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read backup file.'));
    reader.readAsText(file);
  });
}

export function exportBackup() {
  const data = exportAllData();
  const payload = JSON.stringify({
    app: APP_NAME,
    version: APP_VERSION,
    exportedAt: timestampISO(),
    data
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  saveLastBackupInfo(blob.size);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = formatBackupFilename();
  a.click();
  URL.revokeObjectURL(url);
}

export function restoreBackupData(parsed) {
  clearAllData();
  importAllData(parsed.data || parsed);
  initMeta();
  refreshState();
  emit(Events.DATA_CHANGED);
}

export function restoreBackup(file) {
  return readBackupPreview(file).then(({ parsed }) => {
    restoreBackupData(parsed);
    return true;
  });
}

export function resetAllData() {
  clearAllData();
  resetState();
  initMeta();
  refreshState();
  emit(Events.DATA_CHANGED);
}

export function formatBackupExportedLabel(exportedAt) {
  if (!exportedAt) return '—';
  return `${formatDate(exportedAt.slice(0, 10))} ${exportedAt.slice(11, 19) || ''}`.trim();
}
