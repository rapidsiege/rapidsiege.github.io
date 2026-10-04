// ── ⏰ Player Schedules (v6.1.2) ─────────────────────────────────────────────────────────────
// Per-player PREFERRED and BLOCKED launch times on the server clock ('HH:MM/HH:MM', may wrap past
// midnight), edited in the Offensive Targets popup and kept in their OWN localStorage key
// (tw_tribe_schedules) keyed by DECODED player name — deliberately independent of the loaded
// troop files, so a schedule set while tribe 2 was loaded is still there on a day only tribe 1
// is loaded, until the user clears it here (or the browser's site data). The plan engine reads
// them through the pure psLaunchTier() below (see the ⏰ block in generatePlan, plan.js); the
// 🎚 scheduleMode parameter decides how much they steer the picks.
const PS_STORE_KEY = 'tw_tribe_schedules';
let playerSchedules = null; // decoded name → { pref: 'HH:MM/HH:MM' | '', block: 'HH:MM/HH:MM' | '' }; null = not loaded yet

// 'HH:MM/HH:MM' normalised (zero-padded, '/' separator) or '' when unparseable.
function psRangeStr(s) {
  const [a, b] = winParts(s);
  return a ? `${a}/${b}` : '';
}
// Sanitize a stored / imported object: valid ranges only, entries with neither range dropped.
function psNormalize(d) {
  const out = {};
  if (!d || typeof d !== 'object') return out;
  for (const [name, sc] of Object.entries(d)) {
    if (!name || name === '__proto__' || !sc || typeof sc !== 'object') continue; // never write onto Object.prototype
    const pref = psRangeStr(sc.pref), block = psRangeStr(sc.block);
    if (pref || block) out[name] = { pref, block };
  }
  return out;
}
function loadPlayerSchedules() {
  try { playerSchedules = psNormalize(JSON.parse(localStorage.getItem(PS_STORE_KEY) || '{}')); }
  catch { playerSchedules = {}; }
  return playerSchedules;
}
function psAll() { return playerSchedules || loadPlayerSchedules(); }
function savePlayerSchedules() { try { localStorage.setItem(PS_STORE_KEY, JSON.stringify(psAll())); } catch {} }
// Own properties only — a player called "constructor" / "toString" must not read the prototype.
function psGet(name) { const all = psAll(); return Object.prototype.hasOwnProperty.call(all, name) ? all[name] : null; }
function psSet(name, kind, winStr) {
  if (!name || name === '__proto__' || (kind !== 'pref' && kind !== 'block')) return;
  const all = psAll();
  const cur = psGet(name) || { pref: '', block: '' };
  cur[kind] = psRangeStr(winStr);
  if (cur.pref || cur.block) all[name] = cur; else delete all[name];
  savePlayerSchedules();
}
function psClear(name) { const all = psAll(); delete all[name]; savePlayerSchedules(); }
function psClearAll() { playerSchedules = {}; savePlayerSchedules(); }
function psAnySchedule() { return Object.keys(psAll()).length > 0; }

// ── Pure time math (minutes of the server day) ───────────────────────────────────────────────
// A daily range {f, to} as closed segments inside [0, 1440]: [[f, to]] or, wrapping midnight,
// [[f, 1440], [0, to]]. f === to is a single instant.
function psSegments(r) { return r.f <= r.to ? [[r.f, r.to]] : [[r.f, 1440], [0, r.to]]; }
// The LAUNCH range of an attack landing inside `win` ({f, to} minutes) after `travel` minutes: the
// same span shifted earlier by the travel time, as a daily range (a 24h+ window covers the day).
function psLaunchRange(win, travel) {
  const span = win.to >= win.f ? win.to - win.f : win.to + 1440 - win.f;
  if (span >= 1440) return { f: 0, to: 1440 };
  const f = ((win.f - Math.round(travel || 0)) % 1440 + 1440) % 1440;
  const e = f + span;
  return { f, to: e > 1440 ? e - 1440 : e }; // a range ending exactly at midnight ends at 1440, not at the instant 0
}
const psSegOverlap = (a, b) => a[0] <= b[1] && b[0] <= a[1];
const psSegCoveredBy = (seg, segs) => segs.some(s => s[0] <= seg[0] && seg[1] <= s[1]);
// A saved schedule range as segments, parsed once per distinct string (the engine asks per
// candidate × slot). An end of 23:59 means the end of the day — a minute-only <input type="time">
// cannot express 24:00, and "until 23:59" is how users spell it.
const psSegCache = new Map();
function psSchedSegs(s) {
  let v = psSegCache.get(s);
  if (!v) {
    const r = parseWindowStr(s);
    if (r && r.to === 1439) r.to = 1440;
    v = r ? psSegments(r) : [];
    psSegCache.set(s, v);
  }
  return v;
}
// 0 = EVERY launch moment falls inside the player's blocked time (no free moment), 1 = neutral (no
// schedule, or a free moment outside both ranges), 2 = some free launch moment lies inside the
// preferred time. `mode` is the 🎚 scheduleMode: 'preferredThenBlocked' | 'blockedOnly' | 'off'.
function psLaunchTier(name, win, travel, mode) {
  if (mode === 'off' || !win) return 1;
  const sc = psGet(name);
  if (!sc) return 1;
  const L = psSegments(psLaunchRange(win, travel));
  const B = sc.block ? psSchedSegs(sc.block) : [];
  if (B.length && L.every(l => psSegCoveredBy(l, B))) return 0;
  if (mode === 'blockedOnly' || !sc.pref) return 1;
  const P = psSchedSegs(sc.pref);
  for (const l of L) for (const p of P) { // a preferred piece of the launch range not swallowed by the blocked time
    if (!psSegOverlap(l, p)) continue;
    const piece = [Math.max(l[0], p[0]), Math.min(l[1], p[1])];
    if (!B.length || !psSegCoveredBy(piece, B)) return 2;
  }
  return 1;
}

// ── Popup ────────────────────────────────────────────────────────────────────────────────────
// Rows = every player in the loaded troop files (decoded, A→Z), then — collapsed — the saved
// players the loaded files don't contain, so a stale entry is visible and clearable. Inline
// handlers address rows by INDEX (names may hold quotes); psRowNames maps index → name.
let psRowNames = [];
function psLoadedNames() {
  return [...new Set(Object.keys(players).map(decode))].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}
function psRowHtml(i, name, sc, tribe) {
  const [ps, pe] = winParts(sc && sc.pref), [bs, be] = winParts(sc && sc.block);
  const tin = (kind, which, v) => `<input type="time" id="ps-${i}-${kind}-${which}" class="cell-input mono psc-time" value="${v}" onchange="psRowChanged(${i})">`;
  return `<tr id="ps-row-${i}" class="psc-row${sc ? ' psc-set' : ''}">
      <td><span class="player-tag">${esc(name)}</span>${tribe ? ` <span class="psc-tribe">${esc(tribe)}</span>` : ''}</td>
      <td class="psc-cell">${tin('pref', 's', ps)} – ${tin('pref', 'e', pe)}</td>
      <td class="psc-cell">${tin('block', 's', bs)} – ${tin('block', 'e', be)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="psClearRow(${i})" title="${esc(t('psc_clear_row'))}">✕</button></td>
    </tr>`;
}
function renderPlayerSchedulesModal() {
  const host = document.getElementById('ps-host');
  if (!host) return;
  const all = psAll();
  const loaded = psLoadedNames();
  const loadedSet = new Set(loaded);
  const extra = Object.keys(all).filter(n => !loadedSet.has(n)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  psRowNames = [...loaded, ...extra];
  const tribes = (typeof defPlayerTribes === 'function') ? defPlayerTribes(villages) : {};
  const head = `<thead><tr><th>${esc(t('psc_col_player'))}</th><th>${esc(t('psc_col_pref'))}</th><th>${esc(t('psc_col_block'))}</th><th></th></tr></thead>`;
  const rows = (names, off) => names.map((n, k) => psRowHtml(off + k, n, psGet(n), tribes[n] || '')).join('');
  const extraEl = document.getElementById('ps-extra'), keepOpen = !!(extraEl && extraEl.open); // a re-render keeps the list unfolded
  let html = loaded.length
    ? `<table class="psc-table">${head}<tbody>${rows(loaded, 0)}</tbody></table>`
    : `<div class="psc-empty">${esc(t('psc_none_loaded'))}</div>`;
  if (extra.length) html += `<details id="ps-extra" class="psc-extra"${keepOpen ? ' open' : ''}><summary>${esc(t('psc_not_loaded')(extra.length))}</summary><table class="psc-table">${head}<tbody>${rows(extra, loaded.length)}</tbody></table></details>`;
  host.innerHTML = html;
  psRenderFooter();
}
function psRenderFooter() {
  const note = document.getElementById('ps-footer-note');
  if (note) note.textContent = t('psc_summary')(Object.keys(psAll()).length);
}
// Both fields of a range are needed; a half-filled range reads as blank (nothing saved yet).
function psReadRange(i, kind) {
  const s = document.getElementById(`ps-${i}-${kind}-s`), e = document.getElementById(`ps-${i}-${kind}-e`);
  const a = s ? s.value : '', b = e ? e.value : '';
  return a && b ? `${a}/${b}` : '';
}
function psRowChanged(i) {
  const name = psRowNames[i];
  if (!name) return;
  psSet(name, 'pref', psReadRange(i, 'pref'));
  psSet(name, 'block', psReadRange(i, 'block'));
  const row = document.getElementById('ps-row-' + i);
  if (row && row.classList) row.classList.toggle('psc-set', !!psGet(name));
  psRenderFooter(); // never re-render the row being edited — it would drop the input's focus
}
function psClearRow(i) {
  const name = psRowNames[i];
  if (!name) return;
  psClear(name);
  renderPlayerSchedulesModal();
}
function clearPlayerSchedules() {
  if (!psAnySchedule() || !confirm(t('psc_clear_all_confirm'))) return;
  psClearAll();
  renderPlayerSchedulesModal();
}
function openPlayerSchedules() {
  renderPlayerSchedulesModal();
  document.getElementById('ps-modal').classList.add('open');
}
function closePlayerSchedules() {
  document.getElementById('ps-modal').classList.remove('open');
}
