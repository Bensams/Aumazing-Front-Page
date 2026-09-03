// Public browser configuration for the homepage reviews feature.
// These values are safe to expose in a browser; database access is enforced by
// RLS and the CAPTCHA secret lives only in Supabase Auth settings (never here).
export const SUPABASE_URL = 'https://jwjedzfibiaxrpteprfu.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_HgcpUVTMIgAORDeNzprOBg_wAhdLarO';

export const REVIEWS_TABLE = 'reviews';
export const REVIEWS_MAX_COMMENT_LENGTH = 1000;
export const REVIEWS_COOLDOWN_MS = 30 * 1000;

// ── Cloudflare Turnstile CAPTCHA ────────────────────────────────────────────
// Only the public site key lives here. Enable Turnstile in the Supabase
// dashboard (Authentication → Settings → Bot & Abuse Protection) and paste the
// matching *secret* key there — never in this file. Add every serving origin
// (e.g. bensams.github.io and localhost for testing) to the Turnstile site's
// allowed domains, or the widget will report an invalid-domain error.
const TURNSTILE_SITE_KEY = '0x4AAAAAAEmKdscHaXzDfsEJ';
const TURNSTILE_API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let apiPromise = null;
function loadTurnstileApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = TURNSTILE_API;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile loaded but is unavailable'));
    };
    script.onerror = () => reject(new Error('Could not load Turnstile'));
    document.head.appendChild(script);
  });
  return apiPromise;
}

let widgetId = null;
let latestToken = '';
let waiters = [];

function resolveWaiters(token) {
  latestToken = token;
  waiters.forEach(w => w.resolve(token));
  waiters = [];
}
function rejectWaiters(error) {
  waiters.forEach(w => w.reject(error));
  waiters = [];
}

// Render the widget once, into #review-captcha if the page provides it,
// otherwise a container inserted just above the submit button.
async function ensureWidget() {
  const turnstile = await loadTurnstileApi();
  if (widgetId !== null) return turnstile;

  let container = document.getElementById('review-captcha');
  if (!container) {
    container = document.createElement('div');
    container.id = 'review-captcha';
    container.className = 'review-captcha';
    const submit = document.getElementById('review-submit');
    if (submit && submit.parentNode) submit.parentNode.insertBefore(container, submit);
    else document.body.appendChild(container);
  }

  widgetId = turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    callback: token => resolveWaiters(token),
    'error-callback': () => rejectWaiters(new Error('CAPTCHA verification failed. Please try again.')),
    'expired-callback': () => { latestToken = ''; }
  });
  return turnstile;
}

const TURNSTILE_TIMEOUT_MS = 60000;

// Returns a fresh single-use Turnstile token, waiting for the widget if needed.
// Rejects after a timeout so a misconfigured widget can never hang the submit.
async function verifyTurnstile() {
  const turnstile = await ensureWidget();
  if (latestToken) {
    const token = latestToken;
    latestToken = '';
    // Prime a fresh token for any subsequent attempt.
    turnstile.reset(widgetId);
    return token;
  }
  return new Promise((resolve, reject) => {
    const waiter = { resolve, reject };
    waiters.push(waiter);
    setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index !== -1) {
        waiters.splice(index, 1);
        reject(new Error('CAPTCHA did not complete in time. Please try again.'));
      }
    }, TURNSTILE_TIMEOUT_MS);
  });
}

export const CAPTCHA = {
  provider: 'turnstile',
  siteKey: TURNSTILE_SITE_KEY,
  verify: verifyTurnstile
};

// Render the widget up front so it's visible while the visitor fills the form,
// rather than popping in only on submit.
function preRender() {
  ensureWidget().catch(() => { /* surfaced on submit via verify() */ });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', preRender, { once: true });
} else {
  preRender();
}
