// ── ⚖ Player Share (v6.3.0) ─────────────────────────────────────────────────────────────────
// Per-player cap on how many of their offs Generate Plan may send, as a percentage (default 100
// = no cap), edited in the Offensive Targets popup and kept in its OWN localStorage key
// (tw_tribe_shares) keyed by DECODED player name — deliberately independent of the loaded troop
// files, like the ⏰ Player Schedules: a share set while tribe 2 was loaded is still there on a
// day only tribe 1 is loaded, and applies again whenever that player's file comes back, until
// the user resets it here (or wipes the browser's site data). Only values below 100 are stored.
// The plan engine reads them through pshGet / pshCap (see the ⚖ block in generatePlan, plan.js).
const PSH_STORE_KEY = 'tw_tribe_shares';
let playerShares = null; // decoded name → integer percent 0–99; null = not loaded yet

// A typed / stored value → integer percent 0–100 (100 = no cap). Blank or junk reads as 100.
function pshPct(v) {
  if (v === '' || v == null) return 100;
  const n = Number(v);
  if (!isFinite(n)) return 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}
// Sanitize a stored / imported object: integer percents below 100 only (100 = the default, not stored).
function pshNormalize(d) {
  const out = {};
  if (!d || typeof d !== 'object') return out;
  for (const [name, v] of Object.entries(d)) {
    if (!name || name === '__proto__' || typeof v !== 'number') continue; // never write onto Object.prototype
    const pct = pshPct(v);
    if (pct < 100) out[name] = pct;
  }
  return out;
}
function loadPlayerShares() {
  try { playerShares = pshNormalize(JSON.parse(localStorage.getItem(PSH_STORE_KEY) || '{}')); }
  catch { playerShares = {}; }
  return playerShares;
}
function pshAll() { return playerShares || loadPlayerShares(); }
// Returns whether the save landed. On a quota failure the shares still apply this session (they
// live in memory) — the user is told ONCE per session (every field edit saves).
let pshSaveWarned = false;
function savePlayerShares() {
  try { localStorage.setItem(PSH_STORE_KEY, JSON.stringify(pshAll())); return true; }
  catch (e) {
    if (!pshSaveWarned && typeof alert === 'function') { pshSaveWarned = true; alert(t('warn_save_failed')); }
    return false;
  }
}
// Own properties only — a player called "constructor" / "toString" must not read the prototype.
function pshGet(name) { const all = pshAll(); return Object.prototype.hasOwnProperty.call(all, name) ? all[name] : 100; }
function pshSet(name, v) {
  if (!name || name === '__proto__') return;
  const all = pshAll(), pct = pshPct(v);
  if (pct < 100) all[name] = pct; else delete all[name];
  savePlayerShares();
}
function pshClear(name) { const all = pshAll(); delete all[name]; savePlayerShares(); }
function pshClearAll() { playerShares = {}; savePlayerShares(); }
function pshAny() { return Object.keys(pshAll()).length > 0; }
// "At most pct %" of `base` available offs, rounded DOWN: 50% of 3 = 1, of 1 = 0.
function pshCap(base, pct) { return Math.floor(Math.max(0, base) * pshPct(pct) / 100); }

// ── Popup ────────────────────────────────────────────────────────────────────────────────────
// Rows = every player in the loaded troop files (decoded, A→Z) with their off-village count, then
// — collapsed — the saved players the loaded files don't contain, so a stale entry is visible and
// clearable. Inline handlers address rows by INDEX (names may hold quotes); pshRowNames maps
// index → name.
let pshRowNames = [];
function pshLoadedNames() {
  return [...new Set(Object.keys(players).map(decode))].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}
// Off-capable villages per decoded player in the loaded files (the popup's Offs column). The cap
// itself is taken at Generate, from what is still free there (see plan.js).
function pshOffCounts() { // a Map — a player called "constructor" must not read Object.prototype
  const n = new Map();
  for (const v of villages) if (getOffTier(v.offPow) !== 'none') { const k = decode(v.player); n.set(k, (n.get(k) || 0) + 1); }
  return n;
}
function pshRowHtml(i, name, pct, tribe, offs) {
  return `<tr id="psh-row-${i}" class="psc-row${pct < 100 ? ' psc-set' : ''}">
      <td><span class="player-tag">${esc(name)}</span>${tribe ? ` <span class="psc-tribe">${esc(tribe)}</span>` : ''}</td>
      <td class="psh-offs psh-num mono">${offs == null ? '—' : offs}</td>
      <td class="psc-cell psh-num"><input type="number" id="psh-${i}" class="cell-input mono psh-pct" min="0" max="100" step="1" value="${pct}" onchange="pshRowChanged(${i})"> %</td>
      <td><button class="btn btn-ghost btn-sm" onclick="pshClearRow(${i})" title="${esc(t('psh_clear_row'))}">✕</button></td>
    </tr>`;
}
function renderPlayerSharesModal() {
  const host = document.getElementById('psh-host');
  if (!host) return;
  const all = pshAll();
  const loaded = pshLoadedNames();
  const loadedSet = new Set(loaded);
  const extra = Object.keys(all).filter(n => !loadedSet.has(n)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  pshRowNames = [...loaded, ...extra];
  const tribes = (typeof defPlayerTribes === 'function') ? defPlayerTribes(villages) : {};
  const offs = pshOffCounts();
  const head = `<thead><tr><th>${esc(t('psh_col_player'))}</th><th class="psh-num" title="${esc(t('psh_col_offs_title'))}">${esc(t('psh_col_offs'))}</th><th class="psh-num">${esc(t('psh_col_share'))}</th><th></th></tr></thead>`;
  const rows = (names, off, withOffs) => names.map((n, k) => pshRowHtml(off + k, n, pshGet(n), tribes[n] || '', withOffs ? (offs.get(n) || 0) : null)).join('');
  const extraEl = document.getElementById('psh-extra'), keepOpen = !!(extraEl && extraEl.open); // a re-render keeps the list unfolded
  let html = loaded.length
    ? `<table class="psc-table">${head}<tbody>${rows(loaded, 0, true)}</tbody></table>`
    : `<div class="psc-empty">${esc(t('psh_none_loaded'))}</div>`;
  if (extra.length) html += `<details id="psh-extra" class="psc-extra"${keepOpen ? ' open' : ''}><summary>${esc(t('psh_not_loaded')(extra.length))}</summary><table class="psc-table">${head}<tbody>${rows(extra, loaded.length, false)}</tbody></table></details>`;
  host.innerHTML = html;
  pshRenderFooter();
}
function pshRenderFooter() {
  const note = document.getElementById('psh-footer-note');
  if (note) note.textContent = t('psh_summary')(Object.keys(pshAll()).length);
}
function pshRowChanged(i) {
  const name = pshRowNames[i];
  if (!name) return;
  const inp = document.getElementById('psh-' + i);
  pshSet(name, inp ? inp.value : '');
  const pct = pshGet(name);
  if (inp) inp.value = String(pct); // 150 → 100, 33.4 → 33, blank → 100 (the value that applies)
  const row = document.getElementById('psh-row-' + i);
  if (row && row.classList) row.classList.toggle('psc-set', pct < 100);
  pshRenderFooter(); // never re-render the row being edited — it would drop the input's focus
  if (typeof renderOtOffsSummary === 'function') renderOtOffsSummary(); // its count estimates the ⚖ caps
}
function pshClearRow(i) {
  const name = pshRowNames[i];
  if (!name) return;
  pshClear(name);
  renderPlayerSharesModal();
  if (typeof renderOtOffsSummary === 'function') renderOtOffsSummary();
}
function clearPlayerShares() {
  if (!pshAny() || !confirm(t('psh_clear_all_confirm'))) return;
  pshClearAll();
  renderPlayerSharesModal();
  if (typeof renderOtOffsSummary === 'function') renderOtOffsSummary();
}
function openPlayerShares() {
  renderPlayerSharesModal();
  document.getElementById('psh-modal').classList.add('open');
}
function closePlayerShares() {
  document.getElementById('psh-modal').classList.remove('open');
}
