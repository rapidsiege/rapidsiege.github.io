// ══════════════════════════════════════════════════════════════
// DEFENSIVE TARGETS + PLAN DEFENSE
// ══════════════════════════════════════════════════════════════
// Defensive support planning: set a per-village defensive objective (spears, swords,
// spies, heavy cavalry) for allied villages, then distribute support from the tribe's
// own villages to meet it. State lives under its own localStorage key so it's fully
// independent of the offensive plan. (Plan Defense — the allocation engine + per-player
// BB — lives in js/defense-plan.js; the shared state container is defined here.)
const DT_STORE_KEY = 'tw_tribe_defensive';

// The four objective unit types (the only ones the defensive plan sends). Named
// distinctly from data-load.js's DEF_UNITS (a different, power-scoring list).
const DEF_OBJ_UNITS = ['spear', 'sword', 'spy', 'heavy'];

let dtCfg            = { defSpear: 0, defSword: 0, defSpy: 0, defHeavy: 0 }; // default objectives for new targets
let defTargets       = []; // [{id, coord, defender, tribe, spear, sword, spy, heavy, arriveDate, arriveTime}]
let defIgnore        = ''; // raw "Ignore Coordinates" textarea (Plan Defense) — sender villages held home
let defIgnorePlayers = []; // raw player names whose villages never send support (Plan Defense)
let defEnemyTribes   = ''; // raw "Enemy Tribes" textarea (Plan Defense) — one tribe tag/name per line
let defEnemyDist     = 0;  // "Distance from enemy tribes" (fields); 0 = filter off
let defFarFirst      = false; // "Prioritize Sending From Far Villages" — source each player's share farthest-from-target first
// "Config Support Size" — pack sizing mode for the defensive plan.
//   'eff'   = Max Efficiency (default): the classic DEF_MIN_PACKET_POP / real-POP floor, unchanged.
//   'packs' = Support Packs: cap contributing players per target so each order is ≥ dpPackSize
//             "farm", weighted by dpPackWeights (Overwatch-style: heavy 4, not 6).
let dpMode           = 'eff';
let dpPackSize       = DP_PACK_DEFAULTS.size;
let dpPackMax        = DP_PACK_DEFAULTS.max; // 0 = unlimited; soft per-order farm ceiling
let dpPackWeights    = { ...DP_PACK_DEFAULTS.weights };
// NOTE: MV (vacation-mode) pairs are SHARED with Plan Offensive — the single source of truth is
// `mvPairs` (declared + persisted in offensive-targets.js / tw_tribe_offensive). The Defensive-
// Targets picker below edits that same list; there is deliberately no separate defensive copy.
let defPlanRows      = []; // generated support assignments (Plan Defense)
let defPlanWarnings  = [];
let dtNextId         = 1;

function saveDefensive() {
  localStorage.setItem(DT_STORE_KEY, JSON.stringify({
    cfg: dtCfg, targets: defTargets, ignore: defIgnore, ignorePlayers: defIgnorePlayers, enemyTribes: defEnemyTribes, enemyDist: defEnemyDist, farFirst: defFarFirst,
    packMode: dpMode, packSize: dpPackSize, packMax: dpPackMax, packWeights: dpPackWeights,
    plan: defPlanRows, warnings: defPlanWarnings, nextId: dtNextId,
  }));
}

function loadDefensive() {
  try {
    const d = JSON.parse(localStorage.getItem(DT_STORE_KEY));
    if (d) {
      dtCfg           = { ...dtCfg, ...(d.cfg || {}) };
      defTargets      = d.targets || [];
      defIgnore       = typeof d.ignore === 'string' ? d.ignore : '';
      defIgnorePlayers = Array.isArray(d.ignorePlayers) ? d.ignorePlayers : [];
      defEnemyTribes  = typeof d.enemyTribes === 'string' ? d.enemyTribes : '';
      defEnemyDist    = Math.max(0, parseInt(d.enemyDist, 10) || 0);
      defFarFirst     = d.farFirst === true;
      dpMode          = d.packMode === 'packs' ? 'packs' : 'eff';
      dpPackSize      = Math.max(1, parseInt(d.packSize, 10) || DP_PACK_DEFAULTS.size);
      dpPackMax       = Math.max(0, parseInt(d.packMax, 10) || 0);
      dpPackWeights   = { ...DP_PACK_DEFAULTS.weights };
      if (d.packWeights) for (const u of DEF_OBJ_UNITS) {
        const n = parseFloat(d.packWeights[u]);
        if (Number.isFinite(n) && n > 0) dpPackWeights[u] = n;
      }
      defPlanRows     = d.plan || [];
      defPlanWarnings = d.warnings || [];
      dtNextId        = d.nextId || (Math.max(0, ...defTargets.map(x => x.id)) + 1);
    }
  } catch {}
  defTargets.forEach(normalizeDefTarget);
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  setVal('dt-def-spear', dtCfg.defSpear ?? 0);
  setVal('dt-def-sword', dtCfg.defSword ?? 0);
  setVal('dt-def-spy',   dtCfg.defSpy   ?? 0);
  setVal('dt-def-heavy', dtCfg.defHeavy ?? 0);
  const ign = document.getElementById('dp-ignore-input');
  if (ign) ign.value = defIgnore;
  const enm = document.getElementById('dp-enemy-input');
  if (enm) enm.value = defEnemyTribes;
  setVal('plan-def-enemy-dist', defEnemyDist || 0);
  const ff = document.getElementById('plan-def-far-first');
  if (ff) ff.checked = defFarFirst;
  renderDpPackCfg();
  renderDefIgnorePlayers();
  renderDefMvPlayers();
  updDefPolyNote(); // a saved map-area filter must be visible from the first paint
}

function updDTCfgInt(k, v) { dtCfg[k] = Math.max(0, parseInt(v, 10) || 0); saveDefensive(); }

// Normalize a target saved by (or pasted from) an older/partial version.
function normalizeDefTarget(tg) {
  DEF_OBJ_UNITS.forEach(u => { tg[u] = Math.max(0, parseInt(tg[u]) || 0); });
  tg.coord      = String(tg.coord || '');
  tg.defender   = tg.defender || '';
  tg.tribe      = tg.tribe || '';
  tg.arriveDate = tg.arriveDate || '';
  tg.arriveTime = tg.arriveTime || '';
  return tg;
}

// Tribe tag for a coord, from the world DB (empty when the DB isn't loaded / unknown coord).
function dbTribeAt(coord) {
  const v = coordDb[coord];
  return v && typeof dbTribeTag === 'function' ? dbTribeTag(v) : '';
}

function newDefTarget(coord, defender) {
  return {
    id: dtNextId++, coord, defender: defender || '', tribe: dbTribeAt(coord),
    spear: dtCfg.defSpear ?? 0, sword: dtCfg.defSword ?? 0, spy: dtCfg.defSpy ?? 0, heavy: dtCfg.defHeavy ?? 0,
    arriveDate: '', arriveTime: '',
  };
}

function addDefTarget() {
  const coordEl = document.getElementById('dt-add-coord');
  const c = parseCoordStr(coordEl.value);
  if (!c) { coordEl.focus(); return; }
  const coord = `${c.x}|${c.y}`;
  defTargets.push(newDefTarget(coord, dbOwnerName(coord)));
  coordEl.value = ''; coordEl.focus();
  saveDefensive(); renderDefTargets();
}

function toggleDefBulkAdd() {
  const el = document.getElementById('dt-bulk-wrap');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function bulkAddDefTargets() {
  const input = document.getElementById('dt-bulk-input');
  let added = 0;
  for (const line of input.value.split('\n')) {
    const m = line.match(/(\d{1,3})\s*\|\s*(\d{1,3})\s*(.*)/);
    if (!m) continue;
    const pastedName = m[3].replace(/\[\/?player\]/g, '').replace(/^[-–—.\s]+|[-–—.\s]+$/g, '').trim();
    const coord = `${m[1]}|${m[2]}`;
    defTargets.push(newDefTarget(coord, dbOwnerName(coord) || pastedName));
    added++;
  }
  if (added) { input.value = ''; saveDefensive(); renderDefTargets(); }
}

function updDT(id, field, val) {
  const tg = defTargets.find(x => x.id === id);
  if (!tg) return;
  if (DEF_OBJ_UNITS.includes(field)) tg[field] = Math.max(0, parseInt(val) || 0);
  else if (field === 'arriveDate' || field === 'arriveTime') tg[field] = val; // raw <input> value
  else tg[field] = val.trim();
  if (field === 'coord') {
    // defender + tribe are DB-derived; refresh them (clear if the DB doesn't know the new coord)
    tg.defender = dbOwnerName(tg.coord) || (villageDb.length ? '' : tg.defender);
    tg.tribe = dbTribeAt(tg.coord);
    renderDefTargets();
  }
  saveDefensive();
}

function delDefTarget(id) {
  defTargets = defTargets.filter(x => x.id !== id);
  saveDefensive(); renderDefTargets();
}

function clearDefTargets() {
  if (defTargets.length && !confirm(t('confirm_clear_def_targets'))) return;
  defTargets = [];
  saveDefensive(); renderDefTargets();
}

// Defender + tribe are DB-derived: refresh every target the database knows about
// (called from setDbData when the world DB resolves).
// ── MV (vacation-mode) pairs — SHARED with Plan Offensive. This picker edits the same
// `mvPairs` list defined in offensive-targets.js (persisted in tw_tribe_offensive via
// saveOffensive), so a pair added on either tab applies to BOTH plans. Defensive rule
// (enforced in generateDefPlan): two paired players may not both support the SAME target,
// nor support a village their partner owns. Mirrors the offensive picker markup. ──
function toggleDefMvPlayers() {
  const el = document.getElementById('dp-mv-players-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
function defMvPairExists(a, b) {
  return mvPairs.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
}
function addDefMvPairFromSelects() {
  const a = (document.getElementById('dp-mv-a') || {}).value;
  const b = (document.getElementById('dp-mv-b') || {}).value;
  if (!a || !b || a === b || defMvPairExists(a, b)) return;
  mvPairs.push([a, b]);
  saveOffensive(); renderDefMvPlayers();          // shared list lives in the offensive blob
  if (typeof renderOffMvPlayers === 'function') renderOffMvPlayers(); // keep the Offensive-Targets picker in sync
}
function removeDefMvPair(idx) {
  mvPairs.splice(idx, 1);
  saveOffensive(); renderDefMvPlayers();
  if (typeof renderOffMvPlayers === 'function') renderOffMvPlayers();
}
// Chip list of pairs ("A ↔ B") + two player pickers and an Add Pair button. Reuses the
// offensive mvPlayerOptions() (every loaded player, alphabetical) — pairs are raw names.
function renderDefMvPlayers() {
  const host = document.getElementById('dp-mv-players-host');
  if (!host) return;
  if (!Object.keys(players).length && !mvPairs.length) {
    host.innerHTML = `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    return;
  }
  const chips = mvPairs.map((pr, i) =>
    `<span class="chip">${esc(decode(pr[0]))} ↔ ${esc(decode(pr[1]))}<span class="chip-x" onclick="removeDefMvPair(${i})">✕</span></span>`).join('');
  const optHtml = mvPlayerOptions().map(s => `<option value="${esc(s.name)}">${esc(decode(s.name))} (${s.villages})</option>`).join('');
  const sel = id => `<select id="${id}" class="cell-input" style="width:150px;"><option value="">${t('opt_pick_mv_player')}</option>${optHtml}</select>`;
  host.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${chips}`
    + `${sel('dp-mv-a')}<span style="color:#806030;">↔</span>${sel('dp-mv-b')}`
    + `<button class="btn btn-ghost btn-sm" onclick="addDefMvPairFromSelects()">${t('btn_add_mv_pair')}</button></div>`;
}

function refreshDefTargetsFromDb() {
  if (!villageDb.length) return;
  let changed = false;
  for (const tg of defTargets) {
    const n = dbOwnerName(tg.coord);
    if (n && tg.defender !== n) { tg.defender = n; changed = true; }
    const tr = dbTribeAt(tg.coord);
    if (tr && tg.tribe !== tr) { tg.tribe = tr; changed = true; }
  }
  if (changed) saveDefensive();
  renderDefTargets();
}

function renderDefTargets() {
  defTargets.forEach(normalizeDefTarget);

  // Coords the world DB doesn't recognize (only meaningful once a DB is loaded)
  const warnEl = document.getElementById('dt-warnings');
  const warns = (villageDb.length ? defTargets.filter(tg => !coordDb[tg.coord]) : [])
    .map(tg => t('warn_target_not_in_db')(tg.coord));
  if (warnEl) warnEl.innerHTML = warns.length
    ? `<details class="warn-box"><summary>${t('plan_warnings_toggle')(warns.length)}</summary>`
      + `<div class="warn-list">${warns.map(esc).join('<br>')}</div></details>` : '';

  // Demand summary — total of each objective unit type across all targets
  const sumEl = document.getElementById('dt-demand-summary');
  if (sumEl) {
    const tot = u => defTargets.reduce((s, tg) => s + (tg[u] || 0), 0);
    sumEl.innerHTML = defTargets.length
      ? `${t('def_demand_label')} ${DEF_OBJ_UNITS.map(u => `${twIcon(u)} ${tot(u).toLocaleString()}`).join('&nbsp;&nbsp;·&nbsp;&nbsp;')}`
      : '';
  }

  const tbody = document.getElementById('deftargets-tbody');
  if (!tbody) return;
  if (!defTargets.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">${t('empty_no_def_targets')}</td></tr>`;
    return;
  }
  tbody.innerHTML = defTargets.map((tg, i) => {
    const isUnknown = villageDb.length && !coordDb[tg.coord];
    const dbTitle = esc(dbOwnerLabel(tg.coord));
    const numInput = u =>
      `<td><input type="number" min="0" class="cell-input num" style="width:80px;" value="${tg[u]}" onchange="updDT(${tg.id},'${u}',this.value)"></td>`;
    return `
    <tr>
      <td style="color:#806030;">${i + 1}</td>
      <td class="left"><input class="cell-input mono" style="width:74px;${isUnknown ? 'border-color:#b02010;' : ''}" value="${esc(tg.coord)}" title="${dbTitle}" onchange="updDT(${tg.id},'coord',this.value)"></td>
      <td class="left" title="${dbTitle}">${tg.defender ? `<span class="player-tag">${esc(tg.defender)}</span>` : '<span class="num-zero">—</span>'}</td>
      <td class="left">${tg.tribe ? `<span class="player-tag">${esc(tg.tribe)}</span>` : '<span class="num-zero">—</span>'}</td>
      ${numInput('spear')}${numInput('sword')}${numInput('spy')}${numInput('heavy')}
      <td>
        <div style="display:flex;gap:3px;align-items:center;justify-content:center;">
          <input type="date" class="cell-input mono" style="width:128px;" value="${esc(tg.arriveDate)}" title="${esc(t('dt_arrive_title'))}" onchange="updDT(${tg.id},'arriveDate',this.value)">
          <input type="time" step="1" class="cell-input mono" style="width:92px;" value="${esc(tg.arriveTime)}" title="${esc(t('dt_arrive_title'))}" onchange="updDT(${tg.id},'arriveTime',this.value)">
        </div>
      </td>
      <td><button class="btn btn-ghost btn-sm" onclick="delDefTarget(${tg.id})">✕</button></td>
    </tr>`;
  }).join('');
}
