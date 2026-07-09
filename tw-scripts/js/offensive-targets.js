// ══════════════════════════════════════════════════════════════
// OFFENSIVE TARGETS + PLAN OFFENSIVE
// ══════════════════════════════════════════════════════════════
const OT_STORE_KEY = 'tw_tribe_offensive';
const TIER_RANK = { complete: 3, tq: 2, half: 1, none: 0 };
// Offs travel at ram pace, noble trains at snob pace (slowest unit dictates)
const PLAN_BASE_MIN = { off: 30, snob: 35 };
const TIER_FIELD = { complete: 'nComplete', tq: 'nTq', half: 'nHalf' };

let otCfg        = { dateLabel: '', defWinOff: '01:00/02:00', defWinSnob: '02:00/02:30', serverUrl: 'es100.guerrastribales.es', serverUtcOffset: 2, defComplete: 1, defTq: 0, defHalf: 0, defSnobMode: 'solo' };
let offTargets   = []; // [{id, coord, player, nComplete, nTq, nHalf, snobPlayers, nobles, offWindows:[{win,count}], winSnob, snobMode, snobAssignees:[{name,count}]}]
let offIgnore        = ''; // raw "Ignore Coordinates" textarea (Offensive Targets) — these villages never send anything
let offIgnorePlayers = []; // raw player names excluded from the whole plan (no off, no snob, no escort)
let mvPairs          = []; // [[rawA, rawB], …] vacation-mode pairs — SHARED by Plan Offensive AND Plan Defense (edited from either the Offensive-Targets or Defensive-Targets picker; persisted here in tw_tribe_offensive). Offensive rule: two paired players can't both attack the SAME enemy player. Defensive rule: they can't both support the SAME target, nor support a village their partner owns.
// Coordinate Filter (Plan Offensive): layered X|Y bounds that a village must ALL satisfy to be
// used as a sender (off OR snob train). [{axis:'x'|'y', op:'>'|'>='|'<'|'<='|'=', val:'<number>'}].
// AND semantics; a row with no axis or a blank/NaN value is inactive; an empty list uses every
// village. Applied to the sender pool in generatePlan() — see passesCoordFilters() in plan.js.
let planCoordFilters = [];
// Draw Coordinate Filter (Map tab): a polygon of world-space {x,y} vertices (TW grid 0..999).
// When it has ≥3 vertices, a village must be INSIDE it (pointInPolygon) to be used as a sender
// — in Plan Offensive on top of any typed planCoordFilters (AND), and (v4.4.0) in Plan Defense
// too (the typed filters stay offensive-only). "Select Reverse" (map draw bar) flips the gate:
// with planCoordPolygonInv true a sender must be OUTSIDE the shape. Drawn/edited on the map;
// persisted here so it survives reload and rides along with the plan. Empty / <3 pts = no
// area constraint either way. Gate = passesCoordPolygon (map.js).
let planCoordPolygon = [];
let planCoordPolygonInv = false;
let planRows     = []; // denormalized so a saved plan renders without the troop file loaded
let planWarnings = [];
let planReserved = []; // coords of noble-launch villages held out of the offs (excluded from Unused Offs)
// Off-pool holdback breakdown for the Plan summary footer, per off tier (off-capable villages only).
function emptyPlanStats() {
  const t = () => ({ assigned: 0, heldDist: 0, heldNoble: 0, heldSplit: 0, heldLate: 0, unused: 0, ignored: 0 });
  return { complete: t(), tq: t(), half: t() };
}
let planStats    = emptyPlanStats();
let otNextId     = 1;

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

// ── Snob (noble-launch) capability — Smithy-level driven when a tribeInfo v3 buildings/everything
// JSON is loaded (buildingsByCoord), else the legacy points heuristic. Shared by the per-target
// snob picker here AND the noble-launch reservations in plan.js. MASTER RULE: smith known → gate on
// SNOB_SMITH_MIN; smith unknown → legacy points (unknown points pass) → with no buildings JSON the
// whole plan behaves byte-for-byte as before. ────────────────────────────────────────────────────
function buildingsLoaded() {
  return typeof buildingsByCoord !== 'undefined' && Object.keys(buildingsByCoord).length > 0;
}
function smithLevelAt(coord) {
  const b = (typeof buildingsByCoord !== 'undefined') ? buildingsByCoord[coord] : null;
  return b && typeof b.smith === 'number' ? b.smith : null;
}
function snobCapable(coord) {
  const lv = smithLevelAt(coord);
  if (lv !== null) return lv >= SNOB_SMITH_MIN;   // smith known → it IS the signal
  const dbv = coordDb[coord];
  const pts = dbv && typeof dbv.points === 'number' ? dbv.points : null;
  return pts === null || pts > SNOB_RANGE_MIN_POINTS;   // unknown → legacy points heuristic
}

function saveOffensive() {
  localStorage.setItem(OT_STORE_KEY, JSON.stringify({
    cfg: otCfg, targets: offTargets, ignore: offIgnore, ignorePlayers: offIgnorePlayers, mvPairs,
    coordFilters: planCoordFilters, coordPolygon: planCoordPolygon, coordPolygonInv: planCoordPolygonInv,
    plan: planRows, warnings: planWarnings, reserved: planReserved, stats: planStats, nextId: otNextId,
  }));
}

function loadOffensive() {
  try {
    const d = JSON.parse(localStorage.getItem(OT_STORE_KEY));
    if (d) {
      otCfg        = { ...otCfg, ...(d.cfg || {}) };
      offTargets   = d.targets || [];
      offIgnore        = typeof d.ignore === 'string' ? d.ignore : '';
      offIgnorePlayers = Array.isArray(d.ignorePlayers) ? d.ignorePlayers : [];
      mvPairs          = Array.isArray(d.mvPairs) ? d.mvPairs.filter(p => Array.isArray(p) && p.length === 2 && p[0] && p[1] && p[0] !== p[1]) : [];
      planCoordFilters = Array.isArray(d.coordFilters) ? d.coordFilters.filter(f => f && (f.axis === 'x' || f.axis === 'y')) : [];
      planCoordPolygonInv = d.coordPolygonInv === true;
      planCoordPolygon = Array.isArray(d.coordPolygon)
        ? d.coordPolygon.filter(p => p && p.x != null && p.y != null && p.x !== '' && p.y !== '' && isFinite(p.x) && isFinite(p.y)).map(p => ({ x: +p.x, y: +p.y }))
        : [];
      planRows     = d.plan || [];
      planWarnings = d.warnings || [];
      planReserved = d.reserved || [];
      planStats    = (d.stats && d.stats.complete) ? d.stats : emptyPlanStats(); // ignore the pre-3.13 flat shape
      otNextId     = d.nextId || (Math.max(0, ...offTargets.map(x => x.id)) + 1);
    }
  } catch {}
  // normalize targets saved by older versions
  offTargets.forEach(normalizeOffTarget);
  document.getElementById('ot-date').value = otCfg.dateISO || '';
  const esInput = document.getElementById('plan-earliest-send'); // Plan Offensive tab, but stored in otCfg (round-trips with the plan)
  if (esInput) esInput.value = otCfg.earliestSendISO || '';
  setWinInputs('ot-def-winoff', otCfg.defWinOff);
  setWinInputs('ot-def-winsnob', otCfg.defWinSnob);
  for (const id of ['ot-def-winoff-fix', 'ot-def-winsnob-fix']) {
    const b = document.getElementById(id);
    if (b) b.title = t('fix_time_title');
  }
  const su = document.getElementById('setting-server-url');
  if (su) su.value = otCfg.serverUrl || '';
  const so = document.getElementById('setting-server-offset');
  if (so) so.value = otCfg.serverUtcOffset ?? 2;
  const dc = document.getElementById('ot-def-complete');
  if (dc) dc.value = otCfg.defComplete ?? 1;
  const dt = document.getElementById('ot-def-tq');
  if (dt) dt.value = otCfg.defTq ?? 0;
  const dh = document.getElementById('ot-def-half');
  if (dh) dh.value = otCfg.defHalf ?? 0;
  const dsm = document.getElementById('ot-def-snobmode');
  if (dsm) dsm.value = otCfg.defSnobMode || 'solo';
  const ign = document.getElementById('ot-ignore-input');
  if (ign) ign.value = offIgnore;
  renderOffIgnorePlayers();
  renderOffMvPlayers();
}

function updOTCfg(k, v) { otCfg[k] = v.trim(); saveOffensive(); }
function updServerUrl(v) { otCfg.serverUrl = v.trim(); saveOffensive(); }
function updServerOffset(v) { const n = parseFloat(v); otCfg.serverUtcOffset = isNaN(n) ? 2 : n; saveOffensive(); updateServerNow(); }
function updOTCfgInt(k, v) { otCfg[k] = parseInt(v, 10) || 0; saveOffensive(); }

// ── Ignore Coordinates / Ignore Players (Offensive Targets) ──────────────────
// Villages whose coord is listed here, or whose owner is on the ignore-players list,
// are dropped from the sender pool in generatePlan() — so they're never assigned an
// off, a snob train, or a split-off escort. (Ignore = senders held out, mirroring
// Plan Defense; targets are entered separately in the table and are unaffected.)
function parseOffIgnoreSet() {
  const set = new Set();
  for (const line of String(offIgnore || '').split('\n')) {
    const c = parseCoordStr(line);
    if (c) set.add(`${c.x}|${c.y}`);
  }
  return set;
}
function updOffIgnore() {
  const el = document.getElementById('ot-ignore-input');
  offIgnore = el ? el.value : '';
  saveOffensive();
  renderOtOffsSummary(); // ignored coords shrink the summary's available pool
}
function toggleOffIgnore() {
  const el = document.getElementById('ot-ignore-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

// ── Coordinate Filter (Plan Offensive) ─────────────────────────────────────
// Layered X|Y bounds; a village must satisfy EVERY active row to be used as a
// sender (off + snob). See passesCoordFilters() (plan.js) for the gate itself.
const COORD_FILTER_OPS = ['>', '>=', '<', '<=', '='];      // stored op values
const COORD_FILTER_OP_LABEL = { '>': '>', '>=': '≥', '<': '<', '<=': '≤', '=': '=' };
function toggleCoordFilter() {
  const el = document.getElementById('pcf-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
function addCoordFilter() {
  planCoordFilters.push({ axis: 'x', op: '>', val: '' });
  saveOffensive();
  renderCoordFilters();
}
function removeCoordFilter(idx) {
  planCoordFilters.splice(idx, 1);
  saveOffensive();
  renderCoordFilters();
}
// Store the raw string for `val` so a blank/half-typed row stays inactive (never empties the pool).
// NOTE: never rebuild the rows here — that would recreate the <input>/<select> mid-edit and drop
// focus after each keystroke. The controls already hold the user's value; we only refresh the
// summary chip. Row rebuilds happen solely on add/remove (structural changes).
function updCoordFilter(idx, field, value) {
  const f = planCoordFilters[idx];
  if (!f) return;
  if (field === 'axis') f.axis = (value === 'y') ? 'y' : 'x';
  else if (field === 'op') f.op = COORD_FILTER_OPS.includes(value) ? value : '>';
  else if (field === 'val') f.val = value;
  saveOffensive();
  updCoordFilterSummary();
}
// Refresh only the button-side summary chip (no row rebuild → no focus loss). Includes the
// map-drawn area so a collapsed panel still advertises every active sender constraint.
function updCoordFilterSummary() {
  renderCoordPolygonStatus();
  const sum = document.getElementById('pcf-summary');
  if (!sum) return;
  const parts = [];
  const s = coordFilterSummary();
  if (s) parts.push(s);
  if (coordPolygonActive()) parts.push(coordPolygonLabel());
  sum.textContent = parts.length ? t('coord_filter_active')(parts.join('  ∧  ')) : '';
}
// True when the drawn filter area is a usable region (≥3 vertices → has interior).
function coordPolygonActive() {
  return Array.isArray(planCoordPolygon) && planCoordPolygon.length >= 3;
}
// Chip/label text for the drawn area — says "outside" when Select Reverse is on, so every
// place that advertises the filter (Plan-Off chip + panel line, Plan-Def note) agrees.
function coordPolygonLabel() {
  return t(planCoordPolygonInv ? 'coord_filter_poly_inv' : 'coord_filter_poly')(planCoordPolygon.length);
}
// Panel line reflecting the map-drawn area (with a Clear button) so the typed rows AND the
// polygon are visible in one place — AND-composition is otherwise invisible/surprising.
function renderCoordPolygonStatus() {
  const el = document.getElementById('pcf-poly');
  if (!el) return;
  if (coordPolygonActive()) {
    el.innerHTML = `<span style="color:#4fd0c0;font-weight:600;">${esc(coordPolygonLabel())}</span> `
      + `<button class="btn btn-ghost btn-sm" onclick="clearCoordPolygon()">${esc(t('coord_filter_clear_area'))}</button>`
      + `<span style="font-size:12px;color:#5a3a18;margin-left:6px;">${esc(t('coord_filter_poly_hint'))}</span>`;
  } else {
    el.innerHTML = `<span style="font-size:12px;color:#5a3a18;">${esc(t('coord_filter_poly_none'))}</span>`;
  }
}
// Clear the drawn area (from the plan panel OR the map). Repaints the map + refreshes the map's
// draw bar when those are present (both guarded — headless/inactive-tab safe).
function clearCoordPolygon() {
  planCoordPolygon = [];
  planCoordPolygonInv = false; // no area → nothing to reverse; a stale inversion would surprise
  saveOffensive();
  updCoordFilterSummary();
  if (typeof updateDrawFilterBar === 'function') updateDrawFilterBar();
  if (typeof updDefPolyNote === 'function') updDefPolyNote();
  if (typeof repaintMapData === 'function') repaintMapData();
}
// One-line summary of the active filters (blank/incomplete rows omitted). '' when none active.
function coordFilterSummary() {
  const parts = (planCoordFilters || [])
    .filter(f => f && (f.axis === 'x' || f.axis === 'y') && f.val !== '' && f.val != null && isFinite(Number(f.val)))
    .map(f => `${f.axis.toUpperCase()} ${COORD_FILTER_OP_LABEL[f.op] || f.op} ${Number(f.val)}`);
  return parts.length ? parts.join('  ∧  ') : '';
}
function renderCoordFilters() {
  const host = document.getElementById('pcf-host');
  if (!host) return; // headless test sandbox / not on this tab
  const axisOpts = (sel) =>
    `<option value="x"${sel === 'x' ? ' selected' : ''}>X</option><option value="y"${sel === 'y' ? ' selected' : ''}>Y</option>`;
  const opOpts = (sel) =>
    COORD_FILTER_OPS.map(op => `<option value="${op}"${op === sel ? ' selected' : ''}>${COORD_FILTER_OP_LABEL[op]}</option>`).join('');
  host.innerHTML = planCoordFilters.map((f, i) => `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <select class="cell-input" style="width:60px;" onchange="updCoordFilter(${i},'axis',this.value)">${axisOpts(f.axis)}</select>
      <select class="cell-input" style="width:60px;" onchange="updCoordFilter(${i},'op',this.value)">${opOpts(f.op)}</select>
      <input type="number" class="cell-input" style="width:90px;" value="${esc(f.val)}" oninput="updCoordFilter(${i},'val',this.value)">
      <button class="btn btn-ghost btn-sm" onclick="removeCoordFilter(${i})" title="${esc(t('btn_remove') || 'Remove')}">✕</button>
    </div>`).join('') || `<div style="font-size:12px;color:#5a3a18;" data-i18n="coord_filter_empty">${t('coord_filter_empty')}</div>`;
  updCoordFilterSummary();
}
function toggleOffIgnorePlayers() {
  const el = document.getElementById('ot-ignore-players-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
// Loaded troop-file players not already ignored, alphabetical (label shows village count).
function ignorePlayerOptions() {
  const ig = new Set(offIgnorePlayers);
  return Object.keys(players)
    .filter(name => !ig.has(name))
    .map(name => ({ name, villages: players[name].villages.length }))
    .sort((a, b) => decode(a.name).toLowerCase().localeCompare(decode(b.name).toLowerCase()));
}
function addIgnorePlayer(name) {
  if (!name || offIgnorePlayers.includes(name)) return;
  offIgnorePlayers.push(name);
  saveOffensive(); renderOffIgnorePlayers(); renderOffTargets(); // refresh the sender dropdowns
}
function removeIgnorePlayer(idx) {
  offIgnorePlayers.splice(idx, 1);
  saveOffensive(); renderOffIgnorePlayers(); renderOffTargets();
}
// Chip list of ignored players + a snob-sender-style picker (same chip/select markup).
function renderOffIgnorePlayers() {
  const host = document.getElementById('ot-ignore-players-host');
  if (!host) return;
  if (!Object.keys(players).length && !offIgnorePlayers.length) {
    host.innerHTML = `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    return;
  }
  const chips = offIgnorePlayers.map((name, i) =>
    `<span class="chip">${esc(decode(name))}<span class="chip-x" onclick="removeIgnorePlayer(${i})">✕</span></span>`).join('');
  const opts = ignorePlayerOptions();
  const picker = `<select class="cell-input" style="width:170px;" onchange="addIgnorePlayer(this.value)">
       <option value="">${t('opt_pick_ignore_player')}</option>
       ${opts.map(s => `<option value="${esc(s.name)}">${esc(decode(s.name))} (${s.villages})</option>`).join('')}
     </select>`;
  host.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${chips}${picker}</div>`;
}

// ── MV (vacation-mode) pairs: two players who can't both attack the same enemy player ──
function toggleOffMvPlayers() {
  const el = document.getElementById('ot-mv-players-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
// Every loaded player, alphabetical (a player may be in several pairs, so nothing is filtered out).
function mvPlayerOptions() {
  return Object.keys(players)
    .map(name => ({ name, villages: players[name].villages.length }))
    .sort((a, b) => decode(a.name).toLowerCase().localeCompare(decode(b.name).toLowerCase()));
}
function mvPairExists(a, b) {
  return mvPairs.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
}
function addMvPairFromSelects() {
  const a = (document.getElementById('ot-mv-a') || {}).value;
  const b = (document.getElementById('ot-mv-b') || {}).value;
  if (!a || !b || a === b || mvPairExists(a, b)) return;
  mvPairs.push([a, b]);
  saveOffensive(); renderOffMvPlayers();
  if (typeof renderDefMvPlayers === 'function') renderDefMvPlayers(); // shared list — keep the Defensive-Targets picker in sync
}
function removeMvPair(idx) {
  mvPairs.splice(idx, 1);
  saveOffensive(); renderOffMvPlayers();
  if (typeof renderDefMvPlayers === 'function') renderDefMvPlayers();
}
// Chip list of pairs ("A ↔ B") + two player pickers and an Add Pair button.
function renderOffMvPlayers() {
  const host = document.getElementById('ot-mv-players-host');
  if (!host) return;
  if (!Object.keys(players).length && !mvPairs.length) {
    host.innerHTML = `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    return;
  }
  const chips = mvPairs.map((pr, i) =>
    `<span class="chip">${esc(decode(pr[0]))} ↔ ${esc(decode(pr[1]))}<span class="chip-x" onclick="removeMvPair(${i})">✕</span></span>`).join('');
  const optHtml = mvPlayerOptions().map(s => `<option value="${esc(s.name)}">${esc(decode(s.name))} (${s.villages})</option>`).join('');
  const sel = id => `<select id="${id}" class="cell-input" style="width:150px;"><option value="">${t('opt_pick_mv_player')}</option>${optHtml}</select>`;
  host.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${chips}`
    + `${sel('ot-mv-a')}<span style="color:#806030;">↔</span>${sel('ot-mv-b')}`
    + `<button class="btn btn-ghost btn-sm" onclick="addMvPairFromSelects()">${t('btn_add_mv_pair')}</button></div>`;
}

// ── Time-window helpers (windows stored as 'HH:MM/HH:MM'; start === end = fixed time) ──
function winParts(s) {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*[\/\-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return ['', ''];
  const p = n => String(n).padStart(2, '0');
  return [`${p(+m[1])}:${m[2]}`, `${p(+m[3])}:${m[4]}`];
}
function winStrFrom(s, e) { return s ? `${s}/${e || s}` : ''; }
function fmtWindow(s) {
  const [a, b] = winParts(s);
  return a ? (a === b ? a : `${a}/${b}`) : (s || '');
}
function setWinInputs(prefix, winStr) {
  const [s, e] = winParts(winStr);
  const si = document.getElementById(prefix + '-s'), ei = document.getElementById(prefix + '-e');
  if (si) si.value = s;
  if (ei) ei.value = e;
}
function readWinInputs(prefix) {
  const si = document.getElementById(prefix + '-s'), ei = document.getElementById(prefix + '-e');
  return winStrFrom(si ? si.value : '', ei ? ei.value : '');
}
function updDefWin(key) {
  otCfg[key] = readWinInputs(key === 'defWinOff' ? 'ot-def-winoff' : 'ot-def-winsnob');
  saveOffensive();
}
function fixDefWin(key) {
  const prefix = key === 'defWinOff' ? 'ot-def-winoff' : 'ot-def-winsnob';
  const si = document.getElementById(prefix + '-s'), ei = document.getElementById(prefix + '-e');
  if (si && ei) { ei.value = si.value; updDefWin(key); }
}

// ── Mass-apply the top default inputs to EVERY existing target ────────────────
// Normally the defaults only seed targets at add-time (newOffTarget). These three buttons
// push the current inputs onto the targets already in the list. Each overwrites only its
// own slice and asks first (it can't be undone). The arrival date is global (otCfg.dateISO)
// so it already applies to every target; "arrival" here pushes the per-target windows.
function applyDefArrivalToAll() {
  if (!offTargets.length) return;
  if (!confirm(t('confirm_apply_arrival')(offTargets.length))) return;
  for (const tg of offTargets) {
    tg.offWindows = [{ win: otCfg.defWinOff || '', count: 0 }]; // collapses to the single default window
    tg.winSnob = otCfg.defWinSnob || '';
  }
  saveOffensive(); renderOffTargets();
}
function applyDefOffsSnobToAll() {
  if (!offTargets.length) return;
  if (!confirm(t('confirm_apply_offssnob')(offTargets.length))) return;
  for (const tg of offTargets) {
    tg.nComplete = otCfg.defComplete ?? 1;
    tg.nTq       = otCfg.defTq ?? 0;
    tg.nHalf     = otCfg.defHalf ?? 0;
    tg.snobMode  = otCfg.defSnobMode || 'solo';
  }
  saveOffensive(); renderOffTargets();
}

// Normalize a target saved by (or pasted from) older versions:
// winOff string → offWindows list, assignee names → {name, count} objects
function normalizeOffTarget(tg) {
  if (typeof tg.power !== 'boolean') tg.power = false;
  if (typeof tg.catapult !== 'number' || !(tg.catapult >= 0)) tg.catapult = Math.max(0, parseInt(tg.catapult) || 0);
  if (typeof tg.catEnabled !== 'boolean') tg.catEnabled = tg.catapult > 0; // migrate a prior count>0 to the new toggle
  // Catapult target buildings: drop anything not on the 5-building allowlist (stale/corrupt saves)
  if (!Array.isArray(tg.catBuildings)) tg.catBuildings = [];
  tg.catBuildings = tg.catBuildings
    .filter(b => b && CAT_BUILDING_KEYS.includes(b.building))
    .map(b => ({ building: b.building, count: Math.max(0, parseInt(b.count) || 0) }));
  if (!CAT_MODE_KEYS.includes(tg.catMode)) tg.catMode = 'smith'; // Catapult Mode (off-sender building objective)
  if (!tg.snobMode) tg.snobMode = 'solo';
  if (!Array.isArray(tg.snobAssignees)) tg.snobAssignees = [];
  tg.snobAssignees = tg.snobAssignees.filter(Boolean).map(a => typeof a === 'string'
    ? { name: a, count: 0 }
    : { name: a.name, count: Math.max(0, parseInt(a.count) || 0) });
  if (!Array.isArray(tg.offAssignees)) tg.offAssignees = [];
  tg.offAssignees = tg.offAssignees
    .filter(a => a && a.name && ['complete', 'tq', 'half'].includes(a.tier))
    .map(a => ({ tier: a.tier, name: a.name, count: Math.max(0, parseInt(a.count) || 0) }));
  if (!Array.isArray(tg.offWindows) || !tg.offWindows.length) {
    tg.offWindows = [{ win: tg.winOff !== undefined ? tg.winOff : (otCfg.defWinOff || ''), count: 0 }];
  }
  tg.offWindows = tg.offWindows.map(w => typeof w === 'string'
    ? { win: w, count: 0 }
    : { win: w.win || '', count: Math.max(0, parseInt(w.count) || 0) });
  delete tg.winOff;
  return tg;
}

function newOffTarget(coord, player) {
  return {
    id: otNextId++, coord, player, power: false, catEnabled: false, catapult: 0, catBuildings: [], catMode: 'smith',
    nComplete: otCfg.defComplete ?? 1, nTq: otCfg.defTq ?? 0, nHalf: otCfg.defHalf ?? 0, snobPlayers: 0, nobles: 4,
    snobMode: otCfg.defSnobMode || 'solo', snobAssignees: [], offAssignees: [],
    offWindows: [{ win: otCfg.defWinOff, count: 0 }], winSnob: otCfg.defWinSnob,
  };
}

function addOffTarget() {
  const coordEl = document.getElementById('ot-add-coord');
  const c = parseCoordStr(coordEl.value);
  if (!c) { coordEl.focus(); return; }
  const coord = `${c.x}|${c.y}`;
  offTargets.push(newOffTarget(coord, dbOwnerName(coord)));
  coordEl.value = ''; coordEl.focus();
  saveOffensive(); renderOffTargets();
}

function toggleBulkAdd() {
  const el = document.getElementById('ot-bulk-wrap');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function bulkAddTargets() {
  const input = document.getElementById('ot-bulk-input');
  let added = 0;
  for (const line of input.value.split('\n')) {
    const m = line.match(/(\d{1,3})\s*\|\s*(\d{1,3})\s*(.*)/);
    if (!m) continue;
    const pastedName = m[3].replace(/\[\/?player\]/g, '').replace(/^[-–—.\s]+|[-–—.\s]+$/g, '').trim();
    const coord = `${m[1]}|${m[2]}`;
    offTargets.push(newOffTarget(coord, dbOwnerName(coord) || pastedName));
    added++;
  }
  if (added) { input.value = ''; saveOffensive(); renderOffTargets(); }
}

function updOT(id, field, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  if (['nComplete','nTq','nHalf','snobPlayers','nobles','catapult'].includes(field)) tg[field] = Math.max(0, parseInt(val) || 0);
  else tg[field] = val.trim();
  if (field === 'coord') {
    // defender is DB-derived; refresh it (clear if the DB doesn't know the new coord)
    tg.player = dbOwnerName(tg.coord) || (villageDb.length ? '' : tg.player);
    renderOffTargets();
  }
  saveOffensive();
  renderOtOffsSummary(); // off/snob count cells feed the summary but updOT doesn't rebuild the table
}

function delOffTarget(id) {
  offTargets = offTargets.filter(x => x.id !== id);
  otSelected.delete(id);
  saveOffensive(); renderOffTargets();
}

// POWER tag (per target): send the strongest offs here, balanced across all POWER targets
function setOTPower(id, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.power = !!val;
  saveOffensive(); renderOffTargets();
}

// CATAPULT toggle (per target): when ticked, reveal the attack-count input (defaulting to 5
// the first time it's enabled); when unticked, no catapult attacks are planned for this target.
function setOTCatapult(id, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.catEnabled = !!val;
  if (tg.catEnabled && !(tg.catapult > 0)) tg.catapult = 5;
  saveOffensive(); renderOffTargets();
}

// ── Catapult target buildings (per target): pick which buildings the catapult attacks
// demolish, and how many attacks each gets — mirrors the snob-sender count UI. A building
// with an explicit count > 0 is honored; buildings left at 0 split the remaining attacks
// evenly (earlier buildings absorb the rounding via splitNobles, e.g. 5 over 3 → 2,2,1).
function addCatBuilding(id, building) {
  if (!building || !CAT_BUILDING_KEYS.includes(building)) return;
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  if (!Array.isArray(tg.catBuildings)) tg.catBuildings = [];
  if (tg.catBuildings.some(b => b.building === building)) return; // each building at most once
  tg.catBuildings.push({ building, count: 0 });
  saveOffensive(); renderOffTargets();
}
function removeCatBuilding(id, idx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.catBuildings[idx]) return;
  tg.catBuildings.splice(idx, 1);
  saveOffensive(); renderOffTargets();
}
function updCatBuildingCount(id, idx, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.catBuildings[idx]) return;
  tg.catBuildings[idx].count = Math.max(0, parseInt(val) || 0);
  saveOffensive();
}

// Resolve a target's catapult buildings to [{building, count}] (pure — no DOM, headless-testable).
// `want` = the target's catapult-attack count (0 / toggle off → no buildings). Explicit counts are
// honored; count-0 buildings share the remaining attacks evenly. Mirrors targetTrainSpec/targetOffAssign.
function targetCatBuildingSpec(tg) {
  const want = tg.catEnabled ? (tg.catapult || 0) : 0;
  if (!want) return [];
  const list = (tg.catBuildings || []).filter(b => b && CAT_BUILDING_KEYS.includes(b.building));
  if (!list.length) return [{ building: 'smith', count: want }]; // no buildings picked → all attacks default to Smithy
  const explicitSum = list.reduce((s, b) => s + (b.count > 0 ? b.count : 0), 0);
  const auto = list.filter(b => !(b.count > 0));
  const shares = auto.length ? splitNobles(Math.max(0, want - explicitSum), auto.length) : [];
  let ai = 0;
  return list
    .map(b => ({ building: b.building, count: b.count > 0 ? b.count : (shares[ai++] || 0) }))
    .filter(x => x.count > 0);
}
// Flat list of building keys, one per catapult attack, dealt ROUND-ROBIN (one per building per
// pass, each building's resolved count as a cap) so the k-th planned attack targets
// catBuildingTargets(tg)[k]. Round-robin means a supply shortfall spreads evenly rather than
// starving the trailing building — e.g. 5 wanted over 3 buildings but only 3 sent → 1/1/1, not
// 2/1/0. Full allocation totals are unchanged (5 over 3 → 2/2/1). Length ≤ want; when no
// buildings are picked the spec defaults to all-Smithy, so every catapult attack carries one.
function catBuildingTargets(tg) {
  const spec = targetCatBuildingSpec(tg);
  const remaining = spec.map(s => s.count);
  const out = [];
  for (let dealt = true; dealt;) {
    dealt = false;
    for (let i = 0; i < spec.length; i++) {
      if (remaining[i] > 0) { out.push(spec[i].building); remaining[i]--; dealt = true; }
    }
  }
  return out;
}

// ── Catapult Mode (per target): the building objective for this target's OFF SENDERS ──
// A single dropdown (Smithy / Farm / Wall) right of Snob Mode, default Smithy. POWER forces Wall
// (the picker is locked while POWER is on). The stored `catMode` is left untouched while POWER is
// on, so releasing POWER restores whatever was chosen before — and a manually-chosen Wall stays
// Wall. `effectiveCatMode` is the value actually used (display + plan + rally URL): wall iff POWER.
function effectiveCatMode(tg) {
  if (tg.power) return 'wall';
  return CAT_MODE_KEYS.includes(tg.catMode) ? tg.catMode : 'smith';
}
function updCatMode(id, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !CAT_MODE_KEYS.includes(val)) return;
  tg.catMode = val; // only reachable when POWER is off (the select is disabled under POWER)
  saveOffensive();
}

function clearOffTargets() {
  if (offTargets.length && !confirm(t('confirm_clear_targets'))) return;
  offTargets = [];
  otSelected.clear();
  saveOffensive(); renderOffTargets();
}

// ── Row selection + "Edit Selected Rows" mass edit ────────────────────────────
// Selection is EPHEMERAL (in-memory only, never persisted): it's a working set for
// one mass edit, and stale ids restored from an old session would silently edit the
// wrong rows. The row checkboxes are re-rendered from this set, so a full table
// rebuild (every mass apply triggers one) keeps the selection.
let otSelected = new Set(); // ids of the selected offTargets

function otPruneSelection() {
  const ids = new Set(offTargets.map(tg => tg.id));
  for (const id of [...otSelected]) if (!ids.has(id)) otSelected.delete(id);
}
// Header select-all checkbox mirrors the set (indeterminate on a partial selection)
function syncOtSelAll() {
  const el = document.getElementById('ot-sel-all');
  if (!el) return;
  el.checked = offTargets.length > 0 && otSelected.size === offTargets.length;
  el.indeterminate = otSelected.size > 0 && otSelected.size < offTargets.length;
}
// Checkbox change: flip the id + restyle just that row — no tbody rebuild, ticking
// a box must stay instant on a big target list.
function toggleOTSelect(id, on, cb) {
  if (on) otSelected.add(id); else otSelected.delete(id);
  const tr = cb && cb.closest ? cb.closest('tr') : null;
  if (tr) tr.classList.toggle('ot-row-sel', !!on);
  syncOtSelAll();
}
function toggleOTSelectAll(on) {
  otSelected = on ? new Set(offTargets.map(tg => tg.id)) : new Set();
  for (const cb of document.querySelectorAll('#offtargets-tbody input.ot-sel')) {
    cb.checked = !!on;
    const tr = cb.closest('tr');
    if (tr) tr.classList.toggle('ot-row-sel', !!on);
  }
  syncOtSelAll();
}

function openMassEdit() {
  otPruneSelection();
  if (!otSelected.size) { alert(t('mass_none_selected')); return; }
  document.getElementById('ot-mass-count').textContent = `(${otSelected.size})`;
  // input-based sections start from the current tab defaults; staging lists reset
  document.getElementById('ot-mass-complete').value = otCfg.defComplete ?? 1;
  document.getElementById('ot-mass-tq').value       = otCfg.defTq ?? 0;
  document.getElementById('ot-mass-half').value     = otCfg.defHalf ?? 0;
  document.getElementById('ot-mass-cat-count').value = 5;
  massCatBuildings = [];
  renderMassCatBuildings();
  massOffWins = [{ win: otCfg.defWinOff || '', count: 0 }];
  renderMassOffWins();
  setWinInputs('ot-mass-winsnob', otCfg.defWinSnob);
  document.getElementById('ot-mass-status').textContent = '';
  document.getElementById('ot-mass-modal').classList.add('open');
}
function closeMassEdit() {
  document.getElementById('ot-mass-modal').classList.remove('open');
}
function fixMassWin(prefix) {
  const s = document.getElementById(prefix + '-s'), e = document.getElementById(prefix + '-e');
  if (s && e) e.value = s.value;
}

// ── Mass-edit staging lists (catapult buildings + off windows) ────────────────
// Both are LOCAL drafts for the modal: openMassEdit resets them, their Apply copies
// them onto every selected target (same shapes as tg.catBuildings / tg.offWindows).
let massCatBuildings = []; // [{building, count}] — mirrors the per-target Catapults cell
let massOffWins      = []; // [{win, count}]      — mirrors the per-target Off Windows cell

function renderMassCatBuildings() {
  const host = document.getElementById('ot-mass-catb-host');
  if (!host) return;
  const chosen = new Set(massCatBuildings.map(b => b.building));
  const opts = CAT_BUILDING_KEYS.filter(k => !chosen.has(k));
  const chips = massCatBuildings.map((b, j) =>
    `<span class="chip">${esc(t('catb_' + b.building))} ×<input type="number" min="0" value="${b.count || 0}" title="${esc(t('cat_building_count_title'))}" style="width:28px;background:transparent;border:none;border-bottom:1px solid #7a5c10;color:inherit;font-size:11px;text-align:center;" onchange="massUpdCatBuildingCount(${j},this.value)"><span class="chip-x" onclick="massRemoveCatBuilding(${j})">✕</span></span>`).join('');
  const picker = opts.length
    ? `<select class="cell-input" style="width:104px;" onchange="massAddCatBuilding(this.value)"><option value="">${t('opt_pick_building')}</option>${opts.map(k => `<option value="${k}">${esc(t('catb_' + k))}</option>`).join('')}</select>`
    : '';
  host.innerHTML = chips + picker;
}
function massAddCatBuilding(b) {
  if (!b || !CAT_BUILDING_KEYS.includes(b) || massCatBuildings.some(x => x.building === b)) return;
  massCatBuildings.push({ building: b, count: 0 });
  renderMassCatBuildings();
}
function massRemoveCatBuilding(j) { massCatBuildings.splice(j, 1); renderMassCatBuildings(); }
function massUpdCatBuildingCount(j, v) { if (massCatBuildings[j]) massCatBuildings[j].count = Math.max(0, parseInt(v) || 0); }
// Applying buildings means catapult attacks ARE wanted here → also turns Catapults ON
// with the modal's attack count. An empty list is valid: it clears the selected rows'
// picks → targetCatBuildingSpec's default all-Smithy.
function massSetCatBuildings() {
  const cnt = massCatCount();
  massApply(tg => {
    tg.catEnabled = true;
    tg.catapult = cnt;
    tg.catBuildings = massCatBuildings.map(b => ({ building: b.building, count: b.count || 0 }));
  });
}

// Off-window staging — same editor as the per-target cell (time / = / time, count +
// ✕ only when >1 windows, trailing + to add). Ids `ot-mass-winoff-<k>-s/-e` so the
// shared winParts/readWinInputs helpers work; onchange keeps the staging list in
// sync so add/remove re-renders don't lose typed times.
function renderMassOffWins() {
  const host = document.getElementById('ot-mass-winoff-host');
  if (!host) return;
  const multi = massOffWins.length > 1;
  host.innerHTML = massOffWins.map((w, k) => {
    const [ws, we] = winParts(w.win);
    return `<div style="display:flex;gap:2px;align-items:center;">
      <input type="time" id="ot-mass-winoff-${k}-s" class="cell-input mono" style="width:78px;" value="${ws}" onchange="updMassOffWin(${k})">
      <button class="btn btn-ghost btn-sm" style="padding:1px 5px;" title="${esc(t('fix_time_title'))}" onclick="fixMassWin('ot-mass-winoff-${k}');updMassOffWin(${k})">=</button>
      <input type="time" id="ot-mass-winoff-${k}-e" class="cell-input mono" style="width:78px;" value="${we}" onchange="updMassOffWin(${k})">
      ${multi ? `<input type="number" min="0" value="${w.count || 0}" title="${esc(t('win_count_title'))}" class="cell-input num" style="width:38px;" onchange="updMassOffWinCount(${k},this.value)">` : ''}
      ${multi ? `<span class="chip-x" title="${esc(t('del_window_title'))}" onclick="massDelOffWin(${k})">✕</span>` : ''}
    </div>`;
  }).join('')
  + `<button class="btn btn-ghost btn-sm" style="padding:0 6px;align-self:flex-start;" title="${esc(t('add_window_title'))}" onclick="massAddOffWin()">+</button>`;
}
function updMassOffWin(k) { if (massOffWins[k]) massOffWins[k].win = readWinInputs(`ot-mass-winoff-${k}`); }
function updMassOffWinCount(k, v) { if (massOffWins[k]) massOffWins[k].count = Math.max(0, parseInt(v) || 0); }
function massAddOffWin() {
  const last = massOffWins[massOffWins.length - 1];
  massOffWins.push({ win: last ? last.win : (otCfg.defWinOff || ''), count: 0 });
  renderMassOffWins();
}
function massDelOffWin(k) {
  massOffWins.splice(k, 1);
  if (!massOffWins.length) massOffWins.push({ win: otCfg.defWinOff || '', count: 0 });
  renderMassOffWins();
}
// Run `fn` on every selected target, save + re-render (the selection survives the
// rebuild), and confirm in the modal footer. The modal stays open so several mass
// edits can be chained on the same selection.
function massApply(fn) {
  otPruneSelection();
  const sel = offTargets.filter(tg => otSelected.has(tg.id));
  if (!sel.length) return;
  sel.forEach(fn);
  saveOffensive(); renderOffTargets();
  const st = document.getElementById('ot-mass-status');
  if (st) {
    st.textContent = t('mass_applied')(sel.length);
    clearTimeout(massApply._t);
    massApply._t = setTimeout(() => { st.textContent = ''; }, 2500);
  }
}
function massSetPower(v)    { massApply(tg => { tg.power = !!v; }); }
// The modal's catapult attack count (default 5, like the row toggle's first enable).
// Both Turn ON and the buildings Apply stamp it onto every selected row.
function massCatCount() {
  const n = parseInt((document.getElementById('ot-mass-cat-count') || {}).value, 10);
  return n > 0 ? n : 5;
}
function massSetCatapult(v) {
  const cnt = massCatCount();
  massApply(tg => { tg.catEnabled = !!v; if (v) tg.catapult = cnt; });
}
function massSetOffs() {
  const n = id => Math.max(0, parseInt(document.getElementById(id).value) || 0);
  const c = n('ot-mass-complete'), q = n('ot-mass-tq'), h = n('ot-mass-half');
  massApply(tg => { tg.nComplete = c; tg.nTq = q; tg.nHalf = h; });
}
function massSetSnobMode(v) { massApply(tg => { tg.snobMode = v === 'escorted' ? 'escorted' : 'solo'; }); }
function massSetCatMode(v)  { if (CAT_MODE_KEYS.includes(v)) massApply(tg => { tg.catMode = v; }); }
// Replaces ALL of each selected row's off windows with the staged list
function massSetOffWin() {
  massApply(tg => { tg.offWindows = massOffWins.map(w => ({ win: w.win || '', count: w.count || 0 })); });
}
function massSetSnobWin() {
  const win = readWinInputs('ot-mass-winsnob');
  massApply(tg => { tg.winSnob = win; });
}
function massDeleteSelected() {
  otPruneSelection();
  if (!otSelected.size) return;
  if (!confirm(t('confirm_mass_delete')(otSelected.size))) return;
  offTargets = offTargets.filter(tg => !otSelected.has(tg.id));
  otSelected.clear();
  saveOffensive(); renderOffTargets();
  closeMassEdit();
}

// All players from the loaded tribe troop file as potential train senders. Players with
// no nobles yet are still listed (shown as "(0)") so they can be pinned — generatePlan
// then flags them to recruit a noble in time, which is exactly the intended signal.
function snobSenderOptions() {
  // Ignored players ARE listed here (unlike the off-sender picker): an ignored player can still
  // be hand-picked to send a noble train; they're only barred from regular off assignment.
  return Object.entries(players)
    .map(([name, p]) => ({ name, snob: p.totals.snob }))
    .sort((a, b) => decode(a.name).toLowerCase().localeCompare(decode(b.name).toLowerCase()));
}

// Per-target snob senders (buildings JSON loaded): ALL loaded players, A–Z, each annotated with
// how many villages with a KNOWN Smithy ≥ SNOB_SMITH_MIN they have within noble range (getSnobMax
// fields, 0 = no distance gate) of `tg`'s coord. Returns [{name, n, minDist, maxDist, unknown}]:
// n/min/max count ONLY smith-known-capable villages (the label's whole point is real smith data —
// no points fallback here, unlike the plan engine's snobCapable); `unknown` is true when the player
// has in-range villages but NONE with building info (they don't share it → label "(?)"), so n === 0
// with unknown false genuinely means "no Smithy-ready village in range" ("(0)"). Returns null when
// there's no buildings data at all or `tg`'s coord doesn't parse → the caller falls back to the
// legacy full list (snob counts). Pure (no DOM) → headless-testable.
function snobSenderOptionsForTarget(tg) {
  if (!buildingsLoaded()) return null;
  const tc = tg && parseCoordStr(tg.coord);
  if (!tc) return null;
  const snobMax = (typeof getSnobMax === 'function') ? getSnobMax() : 70;
  const out = [];
  for (const [name, p] of Object.entries(players)) {
    let n = 0, unknownInRange = 0, min = Infinity, max = 0;
    for (const v of p.villages) {
      const c = parseCoordStr(v.coord);
      if (!c) continue;
      const d = distXY(c, tc);
      if (snobMax > 0 && d > snobMax) continue;
      const lv = smithLevelAt(v.coord);
      if (lv === null) { unknownInRange++; continue; }
      if (lv < SNOB_SMITH_MIN) continue;
      n++;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    out.push({ name, n, minDist: min, maxDist: max, unknown: n === 0 && unknownInRange > 0 });
  }
  out.sort((a, b) => decode(a.name).toLowerCase().localeCompare(decode(b.name).toLowerCase()));
  return out;
}

function addSnobAssignee(id, name) {
  if (!name) return;
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.snobAssignees.push({ name, count: 0 });
  if (tg.snobAssignees.length > (tg.snobPlayers || 0)) tg.snobPlayers = tg.snobAssignees.length;
  saveOffensive(); renderOffTargets();
}

function removeSnobAssignee(id, idx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.snobAssignees.splice(idx, 1);
  // mirror the +1-per-sender bump: removing a sender drops the train count by one
  // (floored at the remaining assignee count, and at 0), so the count tracks senders
  tg.snobPlayers = Math.max(tg.snobAssignees.length, (tg.snobPlayers || 0) - 1);
  saveOffensive(); renderOffTargets();
}

function updSnobCount(id, idx, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.snobAssignees[idx]) return;
  tg.snobAssignees[idx].count = Math.max(0, parseInt(val) || 0);
  saveOffensive(); renderOffTargets();
}

// ── Off senders (per tier): manually pin who sends each target's offs ──
// How many off villages of each tier a player owns (drives the picker counts)
function playerOffTierCounts(name) {
  const out = { complete: 0, tq: 0, half: 0 };
  const p = players[name];
  if (!p) return out;
  for (const v of p.villages) { const tr = getOffTier(v.offPow); if (tr in out) out[tr]++; }
  return out;
}
// Loaded troop-file players that own ≥1 off of `tier`, richest first (label shows the count)
function offSenderOptions(tier) {
  const ig = new Set(offIgnorePlayers);
  return Object.keys(players)
    .filter(name => !ig.has(name))
    .map(name => ({ name, count: playerOffTierCounts(name)[tier] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
}
// Resolve a target tier's named off senders to [{name, count}] (explicit counts honored;
// count-0 senders auto-share the tier's remaining slots evenly, like snob trains).
function targetOffAssign(tg, tier) {
  const N = tg[TIER_FIELD[tier]] || 0;
  const assignees = (tg.offAssignees || []).filter(a => a && a.name && a.tier === tier);
  if (!N || !assignees.length) return [];
  const explicitSum = assignees.reduce((s, a) => s + (a.count > 0 ? a.count : 0), 0);
  const auto = assignees.filter(a => !(a.count > 0));
  const shares = auto.length ? splitNobles(Math.max(0, N - explicitSum), auto.length) : [];
  let ai = 0;
  return assignees
    .map(a => ({ name: a.name, count: a.count > 0 ? a.count : (shares[ai++] || 0) }))
    .filter(x => x.count > 0);
}
function addOffAssignee(id, tier, name) {
  if (!name) return;
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  if (!Array.isArray(tg.offAssignees)) tg.offAssignees = [];
  tg.offAssignees.push({ tier, name, count: 0 });
  // assigning a sender implies at least one off of that tier is wanted
  const cnt = tg.offAssignees.filter(a => a.tier === tier).length;
  if ((tg[TIER_FIELD[tier]] || 0) < cnt) tg[TIER_FIELD[tier]] = cnt;
  saveOffensive(); renderOffTargets();
}
function removeOffAssignee(id, idx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.offAssignees[idx]) return;
  tg.offAssignees.splice(idx, 1);
  saveOffensive(); renderOffTargets();
}
function updOffCount(id, idx, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.offAssignees[idx]) return;
  tg.offAssignees[idx].count = Math.max(0, parseInt(val) || 0);
  saveOffensive(); renderOffTargets();
}

// Per-target window editing (inputs are looked up by id prefix; no re-render
// on time changes so the picker keeps focus)
function updTgWin(id, kind, widx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  if (kind === 'snob') tg.winSnob = readWinInputs(`otsw-${id}`);
  else if (tg.offWindows[widx]) tg.offWindows[widx].win = readWinInputs(`otw-${id}-${widx}`);
  saveOffensive();
}
function fixTgWin(id, kind, widx) {
  const prefix = kind === 'snob' ? `otsw-${id}` : `otw-${id}-${widx}`;
  const si = document.getElementById(prefix + '-s'), ei = document.getElementById(prefix + '-e');
  if (si && ei) { ei.value = si.value; updTgWin(id, kind, widx); }
}
function addOffWin(id) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  const last = tg.offWindows[tg.offWindows.length - 1];
  tg.offWindows.push({ win: last ? last.win : otCfg.defWinOff, count: 0 });
  saveOffensive(); renderOffTargets();
}
function delOffWin(id, widx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.offWindows.splice(widx, 1);
  if (!tg.offWindows.length) tg.offWindows.push({ win: otCfg.defWinOff, count: 0 });
  saveOffensive(); renderOffTargets();
}
function updOffWinCount(id, widx, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.offWindows[widx]) return;
  tg.offWindows[widx].count = Math.max(0, parseInt(val) || 0);
  saveOffensive();
}

// Effective noble count per train: explicit sender counts are honored, the
// remaining nobles are split evenly across the trains without a fixed count
function targetTrainSpec(tg) {
  const assignees = (tg.snobAssignees || []).filter(a => a && a.name);
  const nTrains = Math.max(tg.snobPlayers || 0, assignees.length);
  if (!nTrains || !tg.nobles) return [];
  const explicitSum = assignees.reduce((s, a) => s + (a.count > 0 ? a.count : 0), 0);
  const nAuto = nTrains - assignees.filter(a => a.count > 0).length;
  const auto = nAuto > 0 ? splitNobles(Math.max(0, tg.nobles - explicitSum), nAuto) : [];
  let ai = 0;
  const spec = [];
  for (let ti = 0; ti < nTrains; ti++) {
    const a = assignees[ti] || null;
    const count = a && a.count > 0 ? a.count : (auto[ai++] || 0);
    spec.push({ name: a ? a.name : null, count });
  }
  return spec.filter(x => x.count > 0);
}

// player name → nobles assigned across all targets (named senders only)
function senderNobleTotals() {
  const agg = {};
  for (const tg of offTargets) {
    for (const s of targetTrainSpec(tg)) {
      if (s.name) agg[s.name] = (agg[s.name] || 0) + s.count;
    }
  }
  return agg;
}

// How many offs each window takes: explicit counts first, windows with
// count 0 share the remainder evenly (earlier windows absorb the rounding)
function windowOffCounts(wins, total) {
  const counts = wins.map(w => w.count > 0 ? w.count : 0);
  let left = total - counts.reduce((s, x) => s + x, 0);
  if (left > 0) {
    const zeros = wins.map((w, i) => w.count > 0 ? -1 : i).filter(i => i >= 0);
    if (zeros.length) {
      const base = Math.floor(left / zeros.length), rem = left % zeros.length;
      zeros.forEach((idx, j) => { counts[idx] += base + (j < rem ? 1 : 0); });
    } else {
      counts[counts.length - 1] += left; // explicit counts under-cover → rest lands last
    }
  }
  return counts;
}

// Localized "Miércoles 10"-style label derived from the arrival date picker.
// ⚠ FORMAT CONTRACT: the attack-planner import reads the trailing day-of-month from the
// "ARRIVAL DATE: <weekday> <day>" header this feeds — see the contract note in js/plan.js.
function bbDateLabel() {
  if (otCfg.dateISO) {
    const d = new Date(otCfg.dateISO + 'T00:00:00');
    if (!isNaN(d)) {
      const days = lang === 'es'
        ? ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
        : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return `${days[d.getDay()]} ${d.getDate()}`;
    }
  }
  return otCfg.dateLabel || ''; // legacy free-text fallback
}

function updateDatePreview() {
  const el = document.getElementById('ot-date-preview');
  if (el) el.textContent = bbDateLabel();
}

// Option HTML for the sender pickers, rebuilt by renderOffTargets() once per render and
// injected per-<select> on demand by otFillPicker().
let otPickerOptsHtml = { snob: '', complete: '', tq: '', half: '', snobByTarget: {} };

// Fill a sender <select> with its option list only when the user actually opens it.
// onfocus + onmousedown both point here: whichever fires first fills the list before the
// native dropdown paints; the dataset guard makes every later call a no-op. The options
// reset naturally on the next re-render (the tbody — and thus the select — is rebuilt).
// The snob picker is PER-TARGET when a buildings JSON is loaded (only in-range Smithy-≥19
// senders, labeled with village count + closest–farthest distance); its HTML is computed once
// per target and cached in otPickerOptsHtml.snobByTarget[tgId]. Without buildings (or a bad
// coord) it falls back to the shared legacy list (otPickerOptsHtml.snob).
function otFillPicker(sel, kind, tgId) {
  if (sel.dataset.filled) return;
  sel.dataset.filled = '1';
  let html = otPickerOptsHtml[kind] || '';
  if (kind === 'snob' && tgId != null) {
    if (otPickerOptsHtml.snobByTarget[tgId] === undefined) {
      const tg = offTargets.find(x => x.id === tgId);
      const opts = tg ? snobSenderOptionsForTarget(tg) : null;
      if (opts === null) {
        html = otPickerOptsHtml.snob; // no buildings loaded / unparseable coord → legacy full list
      } else {
        // All players, A–Z: (n, closest–farthest) = Smithy-≥19 villages in noble range;
        // (0) = none in range; (?) = the player doesn't share building info.
        html = opts.map(s => {
          let info;
          if (s.unknown) info = '?';
          else if (!s.n) info = '0';
          else if (s.n === 1) info = `1, ${Math.round(s.minDist)}`;
          else info = `${s.n}, ${Math.round(s.minDist)}–${Math.round(s.maxDist)}`;
          return `<option value="${esc(s.name)}">${esc(decode(s.name))} (${info})</option>`;
        }).join('');
        sel.title = t('snob_picker_filtered_title');
      }
      otPickerOptsHtml.snobByTarget[tgId] = html;
    } else {
      html = otPickerOptsHtml.snobByTarget[tgId];
    }
  }
  sel.insertAdjacentHTML('beforeend', html);
}

// ── "Offs assigned" summary (the line under the table) ───────────────────────
// Assigned = offs the targets request, per tier (each split-off/escorted train rides
// with one Complete off, so it counts as +1 Complete — same per-train count the escort
// reservation uses, incl. needNobles pins). Available = off villages in the loaded
// troop file MINUS the Ignore Coordinates / Ignore Players holdouts — the pool
// generatePlan actually draws from. Distance, morale and noble-launch reservations
// only resolve at Generate Plan (its summary footer shows that breakdown), so
// "available" here is the static upper bound. Kept separate from renderOffTargets so
// the cheap edits that DON'T rebuild the table (off-count cells via updOT, the ignore
// textarea) can refresh just this line without stealing focus; the ↻ button re-runs
// it on demand as well.
function renderOtOffsSummary() {
  const el = document.getElementById('ot-offs-summary');
  if (!el) return;
  if (!offTargets.length && !villages.length) { el.innerHTML = ''; return; }
  const escortOffs = offTargets.reduce((s, tg) =>
    s + (tg.snobMode === 'escorted' ? targetTrainSpec(tg).length : 0), 0);
  const ignoreCoords = parseOffIgnoreSet();
  const ignorePl = new Set(offIgnorePlayers);
  const stat = { complete: { total: 0, ign: 0 }, tq: { total: 0, ign: 0 }, half: { total: 0, ign: 0 } };
  for (const v of villages) {
    const s = stat[getOffTier(v.offPow)];
    if (!s) continue;
    s.total++;
    if (ignoreCoords.has(v.coord) || ignorePl.has(v.player)) s.ign++;
  }
  const tierMeta = [['complete', 'badge-complete', 'th_complete'], ['tq', 'badge-tq', 'th_tq'], ['half', 'badge-half', 'th_half']];
  let ignTotal = 0;
  const parts = tierMeta.map(([tier, cls, label]) => {
    const used = offTargets.reduce((s, tg) => s + (tg[TIER_FIELD[tier]] || 0), 0) + (tier === 'complete' ? escortOffs : 0);
    const avail = stat[tier].total - stat[tier].ign;
    ignTotal += stat[tier].ign;
    const usedHtml = used > avail ? `<span style="color:#e06040;">${used}</span>` : `${used}`;
    return `<span class="badge ${cls}">${t(label)}</span> ${usedHtml} / ${avail}`;
  });
  const notes = [];
  if (ignTotal > 0) notes.push(t('offs_ignored_note')(ignTotal));
  if (escortOffs > 0) notes.push(t('offs_escort_note')(escortOffs));
  const note = notes.length ? ` <span style="color:#806030;font-weight:400;">${notes.join(' ')}</span>` : '';
  el.innerHTML =
    `<button class="btn btn-ghost btn-sm" style="padding:1px 7px;margin-right:6px;" title="${esc(t('refresh_offs_title'))}" onclick="renderOtOffsSummary()">↻</button>`
    + `<span title="${esc(t('offs_summary_title'))}">${t('offs_assigned_label')} ${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}${note}</span>`;
}

function renderOffTargets() {
  updateDatePreview();
  offTargets.forEach(normalizeOffTarget);
  otPruneSelection();
  const warnEl = document.getElementById('ot-warnings');
  const warns = (villageDb.length ? offTargets.filter(tg => !coordDb[tg.coord]) : [])
    .map(tg => t('warn_target_not_in_db')(tg.coord));
  // senders assigned more nobles (across all targets) than they actually own
  if (Object.keys(players).length) {
    const agg = senderNobleTotals();
    for (const [nm, used] of Object.entries(agg)) {
      const have = players[nm] ? players[nm].totals.snob : 0;
      if (used > have) warns.push(t('warn_sender_capacity')(decode(nm), used, have));
    }
  }
  // collapsible alert box (native <details>, collapsed by default) — same as Plan Offensive
  if (warnEl) warnEl.innerHTML = warns.length
    ? `<details class="warn-box"><summary>${t('plan_warnings_toggle')(warns.length)}</summary>`
      + `<div class="warn-list">${warns.map(esc).join('<br>')}</div></details>` : '';

  renderOtOffsSummary();

  const tbody = document.getElementById('offtargets-tbody');
  if (!offTargets.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="19">${t('empty_no_targets')}</td></tr>`;
    syncOtSelAll();
    return;
  }
  // ── Sender pickers are LAZY: each row renders its <select>s with only the placeholder,
  // and otFillPicker() injects the (identical, potentially huge) option list the moment one
  // is opened. A full tbody rebuild used to create every option for every row — targets ×
  // players × 4 pickers ≈ tens of thousands of DOM nodes — which made ANY re-rendering
  // action (delete row, toggle, count edit) take seconds on a big plan. The option HTML per
  // picker kind is built ONCE per render here; offSenderOptions() is likewise hoisted out
  // of the row loop (it walks every player's villages — it used to run per row × 3 tiers).
  const senders = snobSenderOptions();
  otPickerOptsHtml.snob = senders.map(s => `<option value="${esc(s.name)}">${esc(decode(s.name))} (${s.snob})</option>`).join('');
  otPickerOptsHtml.snobByTarget = {}; // per-target snob lists are rebuilt lazily — reset (targets/villages/smith may have changed)
  const tierHasSenders = {};
  for (const tier of ['complete', 'tq', 'half']) {
    const opts = offSenderOptions(tier);
    tierHasSenders[tier] = opts.length > 0;
    otPickerOptsHtml[tier] = opts.map(s => `<option value="${esc(s.name)}">${esc(decode(s.name))} (${s.count})</option>`).join('');
  }
  tbody.innerHTML = offTargets.map((tg, i) => {
    const isUnknown = villageDb.length && !coordDb[tg.coord];
    const dbTitle = esc(dbOwnerLabel(tg.coord));
    const chips = tg.snobAssignees.map((a, j) =>
      `<span class="chip">${esc(decode(a.name))} ×<input type="number" min="0" value="${a.count || 0}" title="${esc(t('snob_count_title'))}" style="width:32px;background:transparent;border:none;border-bottom:1px solid #7a5c10;color:inherit;font-size:11px;text-align:center;" onchange="updSnobCount(${tg.id},${j},this.value)"><span class="chip-x" onclick="removeSnobAssignee(${tg.id},${j})">✕</span></span>`).join('');
    const senderPicker = senders.length
      ? `<select class="cell-input" style="width:118px;" onfocus="otFillPicker(this,'snob',${tg.id})" onmousedown="otFillPicker(this,'snob',${tg.id})" onchange="addSnobAssignee(${tg.id}, this.value)">
           <option value="">${t('opt_pick_sender')}</option>
         </select>`
      : `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    // Off senders: one labeled picker per tier (Complete / 3-4 / 1-2); option labels show
    // how many offs of THAT tier the player owns. Chips = assignees of that tier (editable count).
    const TIER_BADGE_CLS = { complete: 'badge-complete', tq: 'badge-tq', half: 'badge-half' };
    const TIER_TH = { complete: 'th_complete', tq: 'th_tq', half: 'th_half' };
    const offSenderCell = Object.keys(players).length
      ? ['complete', 'tq', 'half'].map(tier => {
          const tierChips = tg.offAssignees.map((a, j) => a.tier !== tier ? '' :
            `<span class="chip">${esc(decode(a.name))} ×<input type="number" min="0" value="${a.count || 0}" title="${esc(t('off_count_title'))}" style="width:30px;background:transparent;border:none;border-bottom:1px solid #7a5c10;color:inherit;font-size:11px;text-align:center;" onchange="updOffCount(${tg.id},${j},this.value)"><span class="chip-x" onclick="removeOffAssignee(${tg.id},${j})">✕</span></span>`).join('');
          const picker = tierHasSenders[tier]
            ? `<select class="cell-input" style="width:104px;" onfocus="otFillPicker(this,'${tier}')" onmousedown="otFillPicker(this,'${tier}')" onchange="addOffAssignee(${tg.id},'${tier}',this.value)">
                 <option value="">${t('opt_pick_sender')}</option>
               </select>`
            : `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
          return `<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:1px 0;">
                    <span class="badge ${TIER_BADGE_CLS[tier]}" style="font-size:9px;padding:0 4px;">${t(TIER_TH[tier])}</span>${picker}${tierChips}
                  </div>`;
        }).join('')
      : `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    const winEditor = (prefix, winStr, chgJs, fixJs) => {
      const [ws, we] = winParts(winStr);
      return `<input type="time" id="${prefix}-s" class="cell-input mono" style="width:78px;" value="${ws}" onchange="${chgJs}">` +
             `<button class="btn btn-ghost btn-sm" style="padding:1px 5px;" title="${esc(t('fix_time_title'))}" onclick="${fixJs}">=</button>` +
             `<input type="time" id="${prefix}-e" class="cell-input mono" style="width:78px;" value="${we}" onchange="${chgJs}">`;
    };
    const multiWin = tg.offWindows.length > 1;
    const offWinCell = tg.offWindows.map((w, k) =>
      `<div style="display:flex;gap:2px;align-items:center;justify-content:center;margin:1px 0;">
        ${winEditor(`otw-${tg.id}-${k}`, w.win, `updTgWin(${tg.id},'off',${k})`, `fixTgWin(${tg.id},'off',${k})`)}
        ${multiWin ? `<input type="number" min="0" value="${w.count || 0}" title="${esc(t('win_count_title'))}" class="cell-input num" style="width:38px;" onchange="updOffWinCount(${tg.id},${k},this.value)">` : ''}
        ${multiWin ? `<span class="chip-x" title="${esc(t('del_window_title'))}" onclick="delOffWin(${tg.id},${k})">✕</span>` : ''}
      </div>`).join('')
      + `<button class="btn btn-ghost btn-sm" style="padding:0 6px;margin-top:1px;" title="${esc(t('add_window_title'))}" onclick="addOffWin(${tg.id})">+</button>`;
    const snobWinCell = `<div style="display:flex;gap:2px;align-items:center;justify-content:center;">
        ${winEditor(`otsw-${tg.id}`, tg.winSnob, `updTgWin(${tg.id},'snob',0)`, `fixTgWin(${tg.id},'snob',0)`)}
      </div>`;
    const sel = otSelected.has(tg.id);
    return `
    <tr${sel ? ' class="ot-row-sel"' : ''}>
      <td><input type="checkbox" class="ot-sel"${sel ? ' checked' : ''} onchange="toggleOTSelect(${tg.id},this.checked,this)"></td>
      <td style="color:#806030;">${i + 1}</td>
      <td class="left"><input class="cell-input mono" style="width:74px;${isUnknown ? 'border-color:#b02010;' : ''}" value="${esc(tg.coord)}" title="${dbTitle}" onchange="updOT(${tg.id},'coord',this.value)"></td>
      <td class="left" title="${dbTitle}">${tg.player ? `<span class="player-tag">${esc(tg.player)}</span>` : '<span class="num-zero">—</span>'}</td>
      <td>${(() => {
        const dbv = coordDb[tg.coord];
        const pts = dbv && typeof dbv.points === 'number' ? dbv.points : null;
        if (pts == null) return '<span class="num-zero">—</span>';
        const url = villageInfoUrl(tg.coord);
        const txt = pts.toLocaleString();
        return url ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:#c8a060;">${txt}</a>` : `<span style="color:#c8a060;">${txt}</span>`;
      })()}</td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nComplete}" onchange="updOT(${tg.id},'nComplete',this.value)"></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nTq}" onchange="updOT(${tg.id},'nTq',this.value)"></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nHalf}" onchange="updOT(${tg.id},'nHalf',this.value)"></td>
      <td title="${esc(t('ot_power_title'))}"><label class="ot-power"><input type="checkbox" ${tg.power ? 'checked' : ''} onchange="setOTPower(${tg.id},this.checked)">⚡</label></td>
      <td title="${esc(t('ot_catapult_title'))}"><div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
        <label class="ot-power"><input type="checkbox" ${tg.catEnabled ? 'checked' : ''} onchange="setOTCatapult(${tg.id},this.checked)">${twIcon('catapult')}</label>
        ${tg.catEnabled ? `<input type="number" min="0" class="cell-input num" style="width:46px;" value="${tg.catapult}" onchange="updOT(${tg.id},'catapult',this.value)">` : ''}
        ${tg.catEnabled ? (() => {
          // Target-building picker + editable-count chips (which buildings the cats demolish, how
          // many attacks each). Buildings not yet chosen are offered; default 0 = split evenly.
          const chosen = new Set((tg.catBuildings || []).map(b => b.building));
          const opts = CAT_BUILDING_KEYS.filter(k => !chosen.has(k));
          const bChips = (tg.catBuildings || []).map((b, j) =>
            `<span class="chip">${esc(t('catb_' + b.building))} ×<input type="number" min="0" value="${b.count || 0}" title="${esc(t('cat_building_count_title'))}" style="width:28px;background:transparent;border:none;border-bottom:1px solid #7a5c10;color:inherit;font-size:11px;text-align:center;" onchange="updCatBuildingCount(${tg.id},${j},this.value)"><span class="chip-x" onclick="removeCatBuilding(${tg.id},${j})">✕</span></span>`).join('');
          const bPicker = opts.length
            ? `<select class="cell-input" style="width:104px;" onchange="addCatBuilding(${tg.id},this.value)"><option value="">${t('opt_pick_building')}</option>${opts.map(k => `<option value="${k}">${esc(t('catb_' + k))}</option>`).join('')}</select>`
            : '';
          return `<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;justify-content:center;max-width:180px;">${bChips}${bPicker}</div>`;
        })() : ''}
      </div></td>
      <td class="left"><div style="max-width:280px;">${offSenderCell}</div></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.snobPlayers}" onchange="updOT(${tg.id},'snobPlayers',this.value)"></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nobles}" onchange="updOT(${tg.id},'nobles',this.value)"></td>
      <td class="left"><div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;max-width:250px;">${chips}${senderPicker}</div></td>
      <td>
        <select class="cell-input" onchange="updOT(${tg.id},'snobMode',this.value)">
          <option value="escorted"${tg.snobMode === 'escorted' ? ' selected' : ''}>${t('opt_escort_yes')}</option>
          <option value="solo"${tg.snobMode !== 'escorted' ? ' selected' : ''}>${t('opt_escort_no')}</option>
        </select>
      </td>
      <td title="${esc(t('catmode_title'))}">
        <select class="cell-input" ${tg.power ? 'disabled' : ''} onchange="updCatMode(${tg.id},this.value)">
          ${CAT_MODE_KEYS.map(k => `<option value="${k}"${effectiveCatMode(tg) === k ? ' selected' : ''}>${esc(t('catb_' + k))}</option>`).join('')}
        </select>
      </td>
      <td>${offWinCell}</td>
      <td>${snobWinCell}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="delOffTarget(${tg.id})">✕</button></td>
    </tr>`;
  }).join('');
  syncOtSelAll();
}

// ── Export Objectives: plain X|Y coords (one per line), in table order ──
// Three kinds: 'snob' = targets with a noble (snobPlayers > 0), 'off' = targets
// without (snobPlayers === 0), 'all' = every target. Snob+off partition the list,
// so 'all' is their union. Pure logic (no DOM) so it's headless-testable.
function objectiveCoords(kind) {
  return offTargets
    .filter(tg => {
      const hasSnob = (tg.snobPlayers || 0) > 0;
      if (kind === 'snob') return hasSnob;
      if (kind === 'off')  return !hasSnob;
      return true; // 'all'
    })
    .map(tg => tg.coord)
    .join('\n');
}

let objExportKind = 'all'; // last-picked option in the Export Objectives modal
function openObjectivesExport() {
  if (!offTargets.length) { alert(t('empty_no_targets')); return; }
  objExportKind = 'all';
  renderObjectivesExport();
  document.getElementById('obj-modal').classList.add('open');
}
function pickObjectivesExport(kind) {
  objExportKind = kind;
  renderObjectivesExport();
}
function renderObjectivesExport() {
  for (const k of ['snob', 'off', 'all']) {
    const b = document.getElementById('obj-opt-' + k);
    if (b) b.className = 'btn btn-sm ' + (k === objExportKind ? 'btn-primary' : 'btn-ghost');
  }
  const out = document.getElementById('obj-output');
  if (out) out.value = objectiveCoords(objExportKind);
}
function closeObjectivesExport() {
  document.getElementById('obj-modal').classList.remove('open');
}
function copyObjectives() {
  const ta = document.getElementById('obj-output');
  ta.select();
  document.execCommand('copy');
  const btn = document.getElementById('obj-copy-btn');
  btn.textContent = '✓ Copied!';
  setTimeout(() => { btn.textContent = t('bb_copy_btn'); }, 2000);
}

