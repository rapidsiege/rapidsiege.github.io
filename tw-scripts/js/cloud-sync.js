// ══════════════════════════════════════════════════════════════
// CLOUD SYNC (hosted site only)
// ──────────────────────────────────────────────────────────────
// Cloud-saves a copy of the tribe data a player loads — and the plans they
// generate — so their work isn't lost to a browser/cache wipe and can be
// picked back up from another device. Uploaded data and generated plans are
// mirrored to cloud storage via a small Cloudflare endpoint.
//
// Classic <script src> (no modules) so double-click / file:// still works.
// When opened locally (file://) this is a COMPLETE NO-OP: nothing is injected
// and no network request is made, so the tool keeps its "works by double-click,
// zero external dependencies" contract. Everything network-related is gated
// behind `TW_ENV === 'production'` (TW_ENV is defined in db.js, which MUST load
// before this file).
//
// The endpoint runs a lightweight Cloudflare check that the caller is a real
// browser, so we mint a fresh (single-use, ~5-min) token on demand via an
// unobtrusive, execute-on-demand widget.
'use strict';

const CLOUD_SYNC_URL = 'https://tw-calc-uploads.gdqshd.workers.dev';
const CLOUD_SYNC_SITEKEY = '0x4AAAAAADvKZN-ZLjRH8UQe'; // public site key (safe in client)

let _guardId = null;
let _guardReady = false;
let _guardPending = null; // resolver for the currently-executing token request

// Inject the Cloudflare check's api.js and render one execute-on-demand widget.
// Runs after DOM ready (see the bottom of this file). Hosted-site only.
function _initCloudSync() {
  if (typeof TW_ENV === 'undefined' || TW_ENV !== 'production') return; // local = no-op
  if (typeof document === 'undefined') return;

  // Do NOT hide with display:none — a zero-size/hidden container makes the
  // check's telemetry (getBoundingClientRect on the widget) read all-zeros,
  // which the server rejects (400) and then retries every few seconds forever.
  // With appearance:'interaction-only' the widget stays out of the way on its
  // own; we only pin the container to a corner so that IF a rare interactive
  // check is ever required it's reachable, not hidden.
  const container = document.createElement('div');
  container.id = 'cloud-sync-guard';
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
      _guardId = turnstile.render('#cloud-sync-guard', {
        sitekey: CLOUD_SYNC_SITEKEY,
        execution: 'execute',        // don't run the check until we call execute()
        appearance: 'interaction-only', // stays hidden unless a check needs interaction
        retry: 'never',              // a failed check fails once — never spam-retry
        callback: (token) => { if (_guardPending) { const r = _guardPending; _guardPending = null; r(token); } },
        'error-callback': () => { if (_guardPending) { const r = _guardPending; _guardPending = null; r(null); } },
      });
      _guardReady = true;
    } catch (_) { /* widget failed to render — sync just stays off */ }
  };
  document.head.appendChild(s);
}

// Resolve to a fresh single-use verification token, or null if unobtainable.
function _getSyncToken() {
  return new Promise((resolve) => {
    if (!_guardReady || _guardId === null || typeof turnstile === 'undefined') { resolve(null); return; }
    _guardPending = resolve;
    try { turnstile.reset(_guardId); } catch (_) {}
    try {
      turnstile.execute('#cloud-sync-guard');
    } catch (_) {
      _guardPending = null; resolve(null); return;
    }
    // Safety net: never let a stuck check hang the flow.
    setTimeout(() => { if (_guardPending) { const r = _guardPending; _guardPending = null; r(null); } }, 20000);
  });
}

// Fallback label = the player with the most villages in the loaded data (a decent
// proxy for whose export it is). Used only when no tribe can be resolved.
function _cloudLabelFallback() {
  try {
    let top = '', max = -1;
    for (const k in players) {
      const n = (players[k] && players[k].villages) ? players[k].villages.length : 0;
      if (n > max) { max = n; top = k; }
    }
    return top || 'tribe';
  } catch (_) { return 'tribe'; }
}

// Stable label for a synced file = the tribe(s) the loaded troop data belongs to.
// Reuses detectMyTribe()'s myAllyIds (distinct allyIds among the troop villages,
// resolved via the world DB) and turns them into tribe TAGS. A single-tribe
// export → "TAG"; a multi-tribe (coalition) export → the distinct tags sorted
// and joined "TAG1-TAG2" so the SAME set of tribes always yields the SAME
// filename (the newest copy overwrites cleanly; snapshots group under one op).
// Tags (not full names) so the multi-tribe join stays short/path-clean; the
// endpoint caps the slug at 80 chars. Falls back to the top player's name when
// the DB isn't loaded yet / nothing resolves (keeps a sane name in every case).
function _cloudLabel() {
  try {
    if (typeof detectMyTribe === 'function') detectMyTribe(); // refresh myAllyIds from current villages + DB
    if (typeof myAllyIds !== 'undefined' && myAllyIds.length && typeof allyDb !== 'undefined') {
      const tags = [...new Set(
        myAllyIds.map(a => (allyDb[a] && allyDb[a].tag) ? String(allyDb[a].tag).trim() : '').filter(Boolean)
      )].sort((a, b) => a.localeCompare(b));
      if (tags.length) return tags.join('-');
    }
  } catch (_) {}
  return _cloudLabelFallback();
}

// Active game world → the storage folder the sync lands in (kept in sync with the
// World dropdown; twWorld lives in db.js). Falls back to es100 (the only world so
// far) so the path stays stable if the global isn't set yet.
function _cloudWorld() {
  return (typeof twWorld === 'string' && twWorld.trim()) ? twWorld.trim() : 'es100';
}

// File extension for a saved payload: JSON dumps → 'json', everything else → 'txt'.
function _cloudExt(text) {
  const s = String(text || '').trim();
  return (s[0] === '{' || s[0] === '[') ? 'json' : 'txt';
}

// Shared fire-and-forget push to the cloud endpoint. Best-effort: never alerts,
// never blocks the UI, swallows every error. When opened locally it returns
// immediately (no network, keeps file:// clean). `kind` selects the storage
// layout server-side ('txt', 'plan', 'manage_offensive', 'manage_defense');
// opts.ext sets the saved file extension (buckets that accept both .txt/.json),
// opts.nameSuffix keeps sibling saves in one bucket apart (e.g. support/orders).
async function _cloudPush(content, kind, opts) {
  if (typeof TW_ENV === 'undefined' || TW_ENV !== 'production') return; // local = no-op
  if (!content || !content.trim()) return;
  try {
    const token = await _getSyncToken();
    if (!token) return; // couldn't verify a real browser — skip
    const name = _cloudLabel() + ((opts && opts.nameSuffix) ? '_' + opts.nameSuffix : '');
    const payload = { name, content, token, kind, world: _cloudWorld() };
    if (opts && opts.ext) payload.ext = opts.ext;
    // NOTE: do NOT set keepalive:true here. Browsers cap keepalive fetch bodies
    // at 64 KB total; a tribe-info export / plan snapshot is hundreds of KB, so
    // keepalive makes fetch() throw before the request ever leaves the browser
    // (swallowed by the catch below → the endpoint never receives it). A normal
    // fetch has no size cap. The sync fires right after a successful parse/
    // generate while the player is using the tool, so the tab staying open long
    // enough isn't a concern.
    await fetch(CLOUD_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (_) { /* best-effort sync — ignore all failures */ }
}

// Cloud-save the raw uploaded/pasted tribe-info text (called from data-load.js).
async function cloudSyncData(text) {
  return _cloudPush(text, 'txt');
}

// Cloud-save the full "Export Data (JSON)" snapshot (called from generatePlan()
// and generateDefPlan()). Reuses buildDebugDump() — the exact object the manual
// Export button serialises — so the complete state is captured on each generate.
async function cloudSyncPlan() {
  if (typeof TW_ENV === 'undefined' || TW_ENV !== 'production') return; // local = no-op
  if (typeof buildDebugDump !== 'function') return;
  let jsonText;
  try { jsonText = JSON.stringify(buildDebugDump(), null, 2); }
  catch (_) { return; } // couldn't build the snapshot — skip
  return _cloudPush(jsonText, 'plan');
}

// Cloud-save a Manage Offensive tab import (raw .txt/.json the player loads).
async function cloudSyncManageOff(text) {
  return _cloudPush(text, 'manage_offensive', { ext: _cloudExt(text) });
}

// Cloud-save a Manage Defense tab import. `sub` ('support' | 'orders') keeps the
// two imports in the one bucket from overwriting each other's latest file.
async function cloudSyncManageDef(text, sub) {
  return _cloudPush(text, 'manage_defense', { ext: _cloudExt(text), nameSuffix: sub });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initCloudSync);
  } else {
    _initCloudSync();
  }
}
