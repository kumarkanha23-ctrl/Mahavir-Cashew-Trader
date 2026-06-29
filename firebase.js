import { KEYS, getState, loadAll, notify } from './app.js';

let firebaseApp = null;
let database = null;
let ready = false;

const CLOUD_PATH = 'mahavir_cashew_trader';

export function isFirebaseReady() {
  return ready && !!database;
}

export function initFirebase(config) {
  ready = false;
  firebaseApp = null;
  database = null;

  if (!config || !config.apiKey || !config.databaseURL) return;

  try {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded. Cloud backup disabled.');
      return;
    }
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(config);
    } else {
      firebaseApp = firebase.app();
    }
    database = firebase.database();
    ready = true;
  } catch (err) {
    console.warn('Firebase init failed:', err.message);
  }
}

function collectLocalData() {
  const data = {};
  Object.values(KEYS).forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw) data[key] = raw;
  });
  return data;
}

export async function syncToCloud() {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured. Add config in Settings.');
  const payload = {
    exportedAt: new Date().toISOString(),
    data: collectLocalData()
  };
  await database.ref(CLOUD_PATH).set(payload);
}

export async function syncFromCloud() {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured.');
  const snap = await database.ref(CLOUD_PATH).once('value');
  const payload = snap.val();
  if (!payload || !payload.data) throw new Error('No cloud data found.');

  Object.entries(payload.data).forEach(([key, raw]) => {
    if (key.startsWith('mct:')) localStorage.setItem(key, raw);
  });

  loadAll();
  notify();
}

export function loadFirebaseSdk() {
  if (document.getElementById('firebase-sdk-0')) return;
  [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'
  ].forEach((src, i) => {
    const s = document.createElement('script');
    s.src = src;
    s.id = `firebase-sdk-${i}`;
    document.head.appendChild(s);
  });
}

loadFirebaseSdk();
