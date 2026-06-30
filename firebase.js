/** Default Firebase project config (Firestore + Auth). Settings JSON still overrides when provided. */
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAWiGtIeDHA-Oi0YzMbiw5tQHAXlPC84Xc',
  authDomain: 'mahavir-cashew-trader.firebaseapp.com',
  projectId: 'mahavir-cashew-trader',
  storageBucket: 'mahavir-cashew-trader.firebasestorage.app',
  messagingSenderId: '480689356965',
  appId: '1:480689356965:web:e3c9911fc9e2f72f738d4c',
  measurementId: 'G-FTGLYK334E'
};

export const FIRESTORE_COLLECTION = 'erp';
export const MIGRATION_FLAG = 'mct:firestoreMigrated';

/** Maps localStorage keys to Firestore document IDs. */
export const DOC_IDS = {
  'mct:meta': 'meta',
  'mct:settings': 'settings',
  'mct:parties': 'parties',
  'mct:factories': 'factories',
  'mct:deals': 'deals',
  'mct:payments': 'payments',
  'mct:rates': 'rates',
  'mct:sequences': 'sequences'
};

const FIREBASE_SDK_VERSION = '10.12.0';
const FIREBASE_SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

const SDK_MODULES = [
  `${FIREBASE_SDK_BASE}/firebase-app-compat.js`,
  `${FIREBASE_SDK_BASE}/firebase-auth-compat.js`,
  `${FIREBASE_SDK_BASE}/firebase-firestore-compat.js`,
  `${FIREBASE_SDK_BASE}/firebase-database-compat.js`
];

let firebaseApp = null;
let database = null;
let firestore = null;
let auth = null;
let ready = false;
let firestoreReady = false;
let authReady = false;
let persistenceEnabled = false;
let lastConfig = null;
let sdkLoadPromise = null;

let dataProvider = null;
let cloudImportHandler = null;
let listenerUnsubs = [];
let isSaving = false;
let syncCallbacks = null;
let onlineStatus = navigator.onLine;

const CLOUD_PATH = 'mahavir_cashew_trader';

function resolveConfig(config) {
  if (config && config.apiKey) return config;
  return DEFAULT_FIREBASE_CONFIG;
}

/** Realtime Database cloud backup (existing feature — unchanged). */
export function isFirebaseReady() {
  return ready && !!database;
}

/** Firestore connection status. */
export function isFirestoreReady() {
  return firestoreReady && !!firestore;
}

/** Firebase Authentication connection status. */
export function isAuthReady() {
  return authReady && !!auth;
}

export function isOnline() {
  return onlineStatus;
}

export function getFirebaseApp() {
  return firebaseApp;
}

export function getFirestore() {
  return firestore;
}

export function getAuth() {
  return auth;
}

export function registerDataProvider(fn) {
  dataProvider = fn;
}

export function registerCloudImportHandler(fn) {
  cloudImportHandler = fn;
}

function wrapPayload(data) {
  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    payload: data
  };
}

function unwrapPayload(raw) {
  if (raw == null) return null;
  if (raw.payload !== undefined) return raw.payload;
  return raw;
}

export function initFirebase(config) {
  if (config !== undefined) lastConfig = config;

  const effectiveConfig = resolveConfig(lastConfig);
  ready = false;
  firestoreReady = false;
  authReady = false;
  database = null;
  firestore = null;
  auth = null;

  if (!effectiveConfig?.apiKey) return;

  try {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded. Cloud services will init when SDK is ready.');
      return;
    }

    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(effectiveConfig);
    } else {
      firebaseApp = firebase.app();
    }

    if (firebase.firestore) {
      firestore = firebase.firestore();
      firestoreReady = true;
      enableOfflinePersistence();
    }

    if (firebase.auth) {
      auth = firebase.auth();
      authReady = true;
    }

    /* Existing Realtime Database cloud backup — only when databaseURL is configured. */
    if (effectiveConfig.databaseURL && firebase.database) {
      database = firebase.database();
      ready = true;
    }
  } catch (err) {
    console.warn('Firebase init failed:', err.message);
  }
}

function enableOfflinePersistence() {
  if (!firestore || persistenceEnabled) return;
  firestore.enablePersistence({ synchronizeTabs: true })
    .then(() => { persistenceEnabled = true; })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence unavailable (multiple tabs open).');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported in this browser.');
      }
    });
}

function erpRef(docId) {
  return firestore.collection(FIRESTORE_COLLECTION).doc(docId);
}

function collectWrappedData() {
  const data = {};
  if (dataProvider) {
    const snapshot = dataProvider();
    Object.entries(DOC_IDS).forEach(([key, docId]) => {
      if (snapshot[docId] !== undefined) {
        data[key] = JSON.stringify(wrapPayload(snapshot[docId]));
      }
    });
    return data;
  }
  Object.keys(DOC_IDS).forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw) data[key] = raw;
  });
  return data;
}

export async function syncToCloud() {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured. Add config in Settings.');
  const payload = {
    exportedAt: new Date().toISOString(),
    data: collectWrappedData()
  };
  await database.ref(CLOUD_PATH).set(payload);
}

export async function syncFromCloud() {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured.');
  const snap = await database.ref(CLOUD_PATH).once('value');
  const payload = snap.val();
  if (!payload || !payload.data) throw new Error('No cloud data found.');

  if (cloudImportHandler) {
    await cloudImportHandler(payload.data);
    return;
  }

  if (syncCallbacks?.onImport) {
    await syncCallbacks.onImport(payload.data);
    return;
  }

  Object.entries(payload.data).forEach(([key, raw]) => {
    if (key.startsWith('mct:')) localStorage.setItem(key, raw);
  });
}

export async function migrateLocalStorageToFirestore(readLocalData) {
  if (localStorage.getItem(MIGRATION_FLAG)) return false;
  if (!isFirestoreReady()) return false;

  const hasLocal = Object.keys(DOC_IDS).some((key) => localStorage.getItem(key));
  if (!hasLocal) {
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return false;
  }

  const metaSnap = await erpRef('meta').get();
  if (metaSnap.exists) {
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return false;
  }

  const localData = readLocalData ? readLocalData() : {};
  const batch = firestore.batch();
  Object.entries(DOC_IDS).forEach(([, docId]) => {
    const payload = localData[docId];
    if (payload !== undefined) {
      batch.set(erpRef(docId), wrapPayload(payload));
    }
  });
  await batch.commit();
  localStorage.setItem(MIGRATION_FLAG, 'true');
  return true;
}

export async function saveAllToFirestore(data) {
  if (!isFirestoreReady()) return;
  isSaving = true;
  try {
    const batch = firestore.batch();
    Object.entries(data).forEach(([docId, payload]) => {
      if (payload !== undefined) {
        batch.set(erpRef(docId), wrapPayload(payload));
      }
    });
    await batch.commit();
  } finally {
    setTimeout(() => { isSaving = false; }, 300);
  }
}

export async function clearFirestoreData() {
  if (!isFirestoreReady()) return;
  isSaving = true;
  try {
    const batch = firestore.batch();
    Object.values(DOC_IDS).forEach((docId) => {
      batch.delete(erpRef(docId));
    });
    await batch.commit();
  } finally {
    setTimeout(() => { isSaving = false; }, 300);
  }
}

export async function importDataToFirestore(wrappedData, applyImport) {
  if (!isFirestoreReady()) {
    if (applyImport) applyImport(wrappedData);
    return;
  }

  isSaving = true;
  try {
    const batch = firestore.batch();
    Object.entries(wrappedData).forEach(([key, raw]) => {
      const docId = DOC_IDS[key];
      if (!docId || key === 'mct:lastBackup') return;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        batch.set(erpRef(docId), parsed.payload !== undefined ? parsed : wrapPayload(parsed));
      } catch {
        /* skip invalid entries */
      }
    });
    await batch.commit();
  } finally {
    setTimeout(() => { isSaving = false; }, 300);
  }

  if (applyImport) applyImport(wrappedData);
}

export function startFirestoreSync(callbacks) {
  stopFirestoreSync();
  if (!isFirestoreReady()) return () => {};

  syncCallbacks = callbacks;
  const totalDocs = Object.keys(DOC_IDS).length;
  let readyFired = false;
  const loadedDocs = new Set();
  const pending = {};

  listenerUnsubs = Object.values(DOC_IDS).map((docId) =>
    erpRef(docId).onSnapshot(
      (snap) => {
        if (isSaving) return;
        const data = snap.data();
        pending[docId] = data ? unwrapPayload(data) : undefined;

        if (!loadedDocs.has(docId)) {
          loadedDocs.add(docId);
          if (loadedDocs.size >= totalDocs && !readyFired) {
            readyFired = true;
            callbacks.onReady?.({ ...pending });
          }
        } else if (readyFired) {
          callbacks.onDocUpdate?.(docId, pending[docId]);
        }
      },
      (err) => {
        console.warn(`Firestore listener error (${docId}):`, err.message);
        if (callbacks.onError) callbacks.onError(err);
      }
    )
  );

  const onOnline = () => {
    onlineStatus = true;
    if (callbacks.onOnline) callbacks.onOnline();
  };
  const onOffline = () => {
    onlineStatus = false;
    if (callbacks.onOffline) callbacks.onOffline();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    stopFirestoreSync();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

export function stopFirestoreSync() {
  listenerUnsubs.forEach((unsub) => {
    try { unsub(); } catch { /* ignore */ }
  });
  listenerUnsubs = [];
  syncCallbacks = null;
}

export function loadFirebaseSdk() {
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = Promise.all(SDK_MODULES.map((src, i) => new Promise((resolve, reject) => {
    const id = `firebase-sdk-${i}`;
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.id = id;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load Firebase SDK: ${src}`));
    document.head.appendChild(script);
  })))
    .then(() => initFirebase(lastConfig))
    .catch((err) => {
      console.warn('Firebase SDK load failed:', err.message);
    });

  return sdkLoadPromise;
}

/** Await SDK load + initialization. */
export function ensureFirebaseReady() {
  return loadFirebaseSdk();
}

loadFirebaseSdk();
