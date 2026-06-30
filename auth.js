import {
  ensureFirebaseReady,
  getAuth,
  isAuthReady
} from './firebase.js';

let currentUser = null;
const authListeners = new Set();
let authScreenEl = null;
let authInitPromise = null;

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function showAuthError(msg) {
  const el = authScreenEl?.querySelector('#authError');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

function showAuthSuccess(msg) {
  const el = authScreenEl?.querySelector('#authSuccess');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
  if (msg) setTimeout(() => el.classList.add('hidden'), 3200);
}

export function getCurrentUser() {
  return currentUser;
}

export function isAuthenticated() {
  return !!currentUser;
}

export function onAuthChange(fn) {
  authListeners.add(fn);
  fn(currentUser);
  return () => authListeners.delete(fn);
}

let authReady = false;

function notifyAuth(user) {
  currentUser = user;
  authListeners.forEach((fn) => fn(user));
}

export async function signIn(email, password) {
  await ensureFirebaseReady();
  if (!isAuthReady()) throw new Error('Authentication is not available.');
  const cred = await getAuth().signInWithEmailAndPassword(email.trim(), password);
  return cred.user;
}

export async function signUp(email, password) {
  await ensureFirebaseReady();
  if (!isAuthReady()) throw new Error('Authentication is not available.');
  const cred = await getAuth().createUserWithEmailAndPassword(email.trim(), password);
  return cred.user;
}

export async function signOutUser() {
  if (!isAuthReady()) return;
  await getAuth().signOut();
}

export async function initAuth() {
  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    await ensureFirebaseReady();
    if (!isAuthReady()) {
      authReady = true;
      notifyAuth(null);
      return;
    }

    const authInstance = getAuth();
    if (typeof authInstance?.authStateReady === 'function') {
      await authInstance.authStateReady();
    }
    authReady = true;
    notifyAuth(authInstance?.currentUser ?? null);
    authInstance?.onAuthStateChanged((user) => {
      notifyAuth(user);
    });
  })();

  return authInitPromise;
}

function setAuthMode(mode) {
  const loginForm = authScreenEl?.querySelector('#loginForm');
  const signupForm = authScreenEl?.querySelector('#signupForm');
  const loginTab = authScreenEl?.querySelector('[data-auth-tab="login"]');
  const signupTab = authScreenEl?.querySelector('[data-auth-tab="signup"]');
  if (!loginForm || !signupForm) return;

  const isLogin = mode === 'login';
  loginForm.classList.toggle('hidden', !isLogin);
  signupForm.classList.toggle('hidden', isLogin);
  loginTab?.classList.toggle('active', isLogin);
  signupTab?.classList.toggle('active', !isLogin);
}

function bindAuthForms() {
  authScreenEl.querySelector('[data-auth-tab="login"]')?.addEventListener('click', () => setAuthMode('login'));
  authScreenEl.querySelector('[data-auth-tab="signup"]')?.addEventListener('click', () => setAuthMode('signup'));

  authScreenEl.querySelector('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email')?.toString() || '';
    const password = fd.get('password')?.toString() || '';
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await signIn(email, password);
      showAuthError('');
      showAuthSuccess('Signed in successfully.');
    } catch (err) {
      showAuthSuccess('');
      showAuthError(friendlyAuthError(err));
    } finally {
      btn.disabled = false;
    }
  });

  authScreenEl.querySelector('#signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email')?.toString() || '';
    const password = fd.get('password')?.toString() || '';
    const confirm = fd.get('confirmPassword')?.toString() || '';
    if (password !== confirm) {
      showAuthError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      showAuthError('Password must be at least 6 characters.');
      return;
    }
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await signUp(email, password);
      showAuthError('');
      showAuthSuccess('Account created. You are now signed in.');
    } catch (err) {
      showAuthSuccess('');
      showAuthError(friendlyAuthError(err));
    } finally {
      btn.disabled = false;
    }
  });
}

function friendlyAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password is too weak.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  return map[code] || err?.message || 'Authentication failed.';
}

export function renderAuthPage() {
  authScreenEl = document.getElementById('authScreen');
  if (!authScreenEl) return;

  authScreenEl.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <span class="brand-icon">🥜</span>
        <div>
          <strong>Mahavir</strong>
          <small>Cashew Trader ERP</small>
        </div>
      </div>
      <p class="auth-subtitle">Sign in to access your synced business data</p>
      <div id="authError" class="auth-message auth-error hidden"></div>
      <div id="authSuccess" class="auth-message auth-success hidden"></div>
      <div class="auth-tabs">
        <button type="button" class="auth-tab active" data-auth-tab="login">Login</button>
        <button type="button" class="auth-tab" data-auth-tab="signup">Sign Up</button>
      </div>
      <form id="loginForm" class="auth-form">
        <label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com" /></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••" /></label>
        <button type="submit" class="btn btn-primary auth-submit">Login</button>
      </form>
      <form id="signupForm" class="auth-form hidden">
        <label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com" /></label>
        <label>Password<input name="password" type="password" autocomplete="new-password" required placeholder="Min. 6 characters" /></label>
        <label>Confirm Password<input name="confirmPassword" type="password" autocomplete="new-password" required placeholder="Repeat password" /></label>
        <button type="submit" class="btn btn-primary auth-submit">Create Account</button>
      </form>
      <p class="auth-hint">Data syncs in real time across all your devices via Firebase.</p>
    </div>`;

  bindAuthForms();
}

export function showAuthScreen() {
  document.getElementById('appShell')?.classList.add('hidden');
  document.getElementById('authScreen')?.classList.remove('hidden');
  renderAuthPage();
}

export function hideAuthScreen() {
  document.getElementById('authScreen')?.classList.add('hidden');
  document.getElementById('appShell')?.classList.remove('hidden');
}

export function updateAuthHeader() {
  const el = document.getElementById('userEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  if (el) el.textContent = currentUser?.email || '';
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !currentUser);
}
