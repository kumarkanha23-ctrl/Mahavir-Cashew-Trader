import { SCHEMA_VERSION, APP_VERSION } from '../config.js';
import { KEYS } from './storageKeys.js';
import { timestampISO } from '../utils/date.js';

function wrap(payload) {
  return JSON.stringify({
    v: SCHEMA_VERSION,
    updatedAt: timestampISO(),
    payload
  });
}

function unwrap(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'payload')) {
      return parsed.payload;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getItem(key, fallback = null) {
  const data = unwrap(localStorage.getItem(key));
  return data ?? fallback;
}

export function setItem(key, payload) {
  try {
    localStorage.setItem(key, wrap(payload));
    return true;
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please export backup and clear old data.');
    }
    throw err;
  }
}

export function removeItem(key) {
  localStorage.removeItem(key);
}

export function initMeta() {
  const meta = getItem(KEYS.META, {});
  if (!meta.schemaVersion) {
    setItem(KEYS.META, {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      createdAt: timestampISO()
    });
  }
}

export function exportAllData() {
  const data = {};
  Object.values(KEYS).forEach((key) => {
    if (key === KEYS.LAST_BACKUP) return;
    const raw = localStorage.getItem(key);
    if (raw) data[key] = raw;
  });
  return data;
}

export function importAllData(data) {
  Object.entries(data).forEach(([key, raw]) => {
    if (key.startsWith('mct:') && key !== KEYS.LAST_BACKUP) {
      localStorage.setItem(key, typeof raw === 'string' ? raw : JSON.stringify(raw));
    }
  });
}

export function clearAllData() {
  Object.values(KEYS).forEach((key) => {
    if (key !== KEYS.LAST_BACKUP) removeItem(key);
  });
}
