// ══════════════════════════════════════════════════════════════
// DEFENSIVE TARGETS + PLAN DEFENSE
// ══════════════════════════════════════════════════════════════
// Defensive support planning: set a per-village defensive objective (spears, swords,
// spies, heavy cavalry) for allied villages, then distribute support from the tribe's
// own villages to meet it. State lives under its own localStorage key so it's fully
// independent of the offensive plan. (Plan Defense — the allocation engine + per-player
// BB — lives in js/defense-plan.js; the shared state container is defined here.)
// v6.4.0: the 💾 defense plan slots live under their OWN key. The pre-v6.4.0 key (DT_LEGACY_KEY) is
// only READ — and only while DT_STORE_KEY is absent — never written: an older build sharing this
// storage (a file:// copy of prod, the es103 dist) keeps reading and writing its own copy, so it can
// never rewrite the slots it does not know about (review HIGH — the 6.1.3 lesson of the offensive
// slots). The first successful save removes the legacy key (quota relief); an old copy opened after
// that boots empty, and its fresh legacy save is ignored while DT_STORE_KEY exists.
const DT_STORE_KEY  = 'tw_tribe_defensive_slots';
const DT_LEGACY_KEY = 'tw_tribe_defensive';

// The four objective unit types (the only ones the defensive plan sends). Named
// distinctly from data-load.js's DEF_UNITS (a different, power-scoring list).
const DEF_OBJ_UNITS = ['spear', 'sword', 'spy', 'heavy'];

let dtCfg            = { defSpear: 0, defSword: 0, defSpy: 0, defHeavy: 0 }; // default objectives for new targets
let defTargets       = []; // [{id, coord, defender, tribe, spear, sword, spy, heavy, arriveDate, arriveTime}]
let defIgnore        = ''; // raw "Ignore Coordinates" textarea (Plan Defense) — sender villages held home
let defIgnorePlayers = []; // raw player names whose villages never send support (Plan Defense)
let defCompletePlayers = []; // raw player names drained to 100% of their available defense (Plan Defense)
// "Snip Players" (v5.6.0) — the mirror image of Complete Players: raw player names who must
// keep free defense at home. They are the LAST pool Plan Defense draws from and keep a
// defSnipPct % reserve against targets within defSnipDist fields. MUTUALLY EXCLUSIVE with
// defCompletePlayers (100% drained vs. reserve kept) — enforced in the pickers AND re-checked
// in generateDefPlan, where Complete wins a stale contradiction.
let defSnipPlayers   = [];
// Snip reserve + Support Packs sizing start from the 🎚 PARAMS defaults — read in loadDefensive
// (after loadSettings applied the saved parameters), not here at parse time when PARAMS still
// holds the built-in values.
let defSnipPct       = defSnipDefaults().pct;  // % of available def pop kept home
let defSnipDist      = defSnipDefaults().dist; // fields; reserve respected for targets within this radius
// "Enemy Tribes" (v5.7.0): selected tribes are stored as world-DB ALLY IDs, not tags/names —
// tribes rename freely and a stored tag would silently stop matching. Labels are resolved live
// from allyDb at render time (allyLabel), so a rename just shows up.
let defEnemyIds      = []; // ally ids (strings) whose villages bar nearby senders
// LEGACY: the pre-v5.7.0 free-text "Enemy Tribes" textarea, one tag/name per line. Kept ONLY as
// a migration carrier — migrateDefEnemyTribes() converts each line to an id as soon as a world
// DB is loaded and strips it from here. ⚠ It must keep round-tripping through saveDefensive
// while unresolved: a session that never loads the DB would otherwise persist '' and lose the
// user's tribes. Whatever never resolves stays here and is shown as a note next to the picker.
let defEnemyTribes   = '';
let defEnemyDist     = 0;  // "Distance from enemy tribes" (fields); 0 = filter off
let defFarFirst      = false; // "Prioritize Sending From Far Villages" — source each player's share farthest-from-target first
let defSkipKnight    = false; // "Ignore Village with Knight" (v6.0.1) — a village that OWNS a knight never sends support
// "Config Support Size" — pack sizing mode for the defensive plan.
//   'eff'   = Max Efficiency (default): the classic PARAMS.defMinPacketPop / real-POP floor, unchanged.
//   'packs' = Support Packs: cap contributing players per target so each order is ≥ dpPackSize
//             "farm", weighted by dpPackWeights (Overwatch-style: heavy 4, not 6).
let dpMode           = 'eff';
let dpPackSize       = dpPackDefaults().size;
let dpPackMax        = dpPackDefaults().max; // 0 = unlimited; soft per-order farm ceiling
let dpPackWeights    = { ...dpPackDefaults().weights };
// NOTE: MV (vacation-mode) pairs are SHARED with Plan Offensive — the single source of truth is
// `mvPairs` (declared + persisted in offensive-targets.js / OT_STORE_KEY). The Defensive-
// Targets picker below edits that same list; there is deliberately no separate defensive copy.
let defPlanRows      = []; // generated support assignments (Plan Defense) — the ACTIVE defense plan slot
let defPlanWarnings  = [];
let dtNextId         = 1;

// ── 💾 Defense plan slots (v6.4.0) — the mirror of the offensive slots (v6.1.0) ─────────────
// Several defense plans ("Defense 1", "Defense 2", …) live side by side, like save slots. The
// defPlanRows / defPlanWarnings globals ALWAYS hold the ACTIVE slot, so every existing reader (the
// plan table, the exports, the map overlays) keeps working unchanged; defPlans holds every slot,
// the active one included — its record is refreshed from the globals by defPlanSync() whenever the
// plan is saved or another slot is read. generateDefPlan() fills the active slot from what the
// OTHER slots left (defPlanPriorUsage): every unit another plan already sends is gone from its
// village — home troops from the home bucket, returning troops from the returning one — so a
// second plan never counts support that is already moving. Targets and the Plan Defense settings
// stay global (the user edits them for the next plan); a slot is a frozen snapshot of its rows.
// What reads EVERY slot: the engine's consumption, Available Defense (both tables) and Manage
// Defense (all plans merged by default — each slot's real orders keep matching).
// 📦 Already sent (user decision on review HIGH-3): a slot whose support has really left can be
// ticked `sent`. A troop file loaded AFTER that no longer has those troops, so subtracting them again
// would count them twice: a sent slot is no longer subtracted anywhere (engine, Available Defense,
// Support per Player) but stays in Manage Defense (its orders are real moves). Each slot stamps the
// troop file it was built on (`troopsAt` = troopsSavedAt at Generate); a newer file loaded since →
// the slot bar and Generate's warnings name it (defPlanStale). Generate resets the active slot's tick.
let defPlans      = []; // [{ id, name, createdISO, rows, warnings, sent, troopsAt }]
let defPlanActive = 1;  // id of the slot the plan globals show
let defPlanNextId = 2;

function defPlanNew(id) {
  const now = typeof serverNowMs === 'function' ? serverNowMs() : Date.now();
  return { id, name: '', createdISO: new Date(now).toISOString().slice(0, 10), rows: [], warnings: [], sent: false, troopsAt: '' };
}
// Guarantee at least one slot and a valid active id (fresh install, pre-v6.4.0 save, deleted slot).
function defPlanEnsure() {
  if (!Array.isArray(defPlans)) defPlans = [];
  if (!defPlans.length) defPlans.push(defPlanNew(defPlanActive || 1));
  if (!defPlans.some(s => s.id === defPlanActive)) defPlanActive = defPlans[0].id;
  defPlanNextId = Math.max(defPlanNextId || 1, ...defPlans.map(s => s.id + 1));
}
function defPlanIndex(id) { return defPlans.findIndex(s => s.id === id); }
function defPlanActiveSlot() { defPlanEnsure(); return defPlans.find(s => s.id === defPlanActive); }
// Globals → the active record (before saving, before reading the other slots).
function defPlanSync() {
  const s = defPlanActiveSlot();
  s.rows = defPlanRows; s.warnings = defPlanWarnings;
}
// A record → the globals.
function defPlanLoad(s) {
  defPlanRows     = Array.isArray(s.rows) ? s.rows : [];
  defPlanWarnings = Array.isArray(s.warnings) ? s.warnings : [];
}
// "Defense 2" (by position) unless the user named it.
function defPlanLabel(s) {
  const n = String((s && s.name) || '').trim();
  return n || t('def_slot_default')(defPlanIndex(s.id) + 1);
}
function defPlanOthers() { defPlanSync(); return defPlans.filter(s => s.id !== defPlanActive); }
// Every slot's rows in slot order, each tagged with its slot id (Available Defense, Manage Defense).
function defPlanAllRows() { defPlanSync(); return defPlans.flatMap(s => (s.rows || []).map(r => ({ ...r, slot: s.id }))); }
function defPlanAnyRows() { defPlanSync(); return defPlans.some(s => (s.rows || []).length > 0); }
// The rows still to be subtracted from the loaded troops: every slot not ticked 📦 Already sent.
function defPlanCountedRows() { defPlanSync(); return defPlans.filter(s => !s.sent).flatMap(s => s.rows || []); }
// Slots with rows, not ticked sent, built on an OLDER troop file than the one loaded now (both stamps
// known) — if their support already left, the loaded file no longer has it. ISO strings compare in order.
function defPlanStale(slots) {
  const now = typeof troopsSavedAt === 'string' ? troopsSavedAt : '';
  return (slots || defPlans).filter(s => !s.sent && (s.rows || []).length && s.troopsAt && now && s.troopsAt < now);
}
function setDefPlanSent(id, on) {
  const s = defPlans.find(x => x.id === parseInt(id, 10));
  if (!s) return;
  s.sent = !!on;
  saveDefensive();
  if (typeof renderDefPlanTable === 'function') renderDefPlanTable(); // slot bar, summaries, Manage Defense
}
// What the OTHER slots already send, per sender village — generateDefPlan() starts its sender stock
// from here. now / fut = per-unit totals drawn from the village's home troops / its returning troops
// (a row's futUnits is the returning share of its units) — slots ticked 📦 Already sent are left out
// (the loaded troop file already lacks those troops). targets = target coord → orders already headed
// there (every other slot, sent or not). nOrders / nVillages / pop feed the slot-bar hint; nSent =
// other slots ticked sent.
function defPlanPriorUsage(others) {
  const u = { now: {}, fut: {}, targets: {}, nSlots: 0, nSent: 0, nOrders: 0, nVillages: 0, pop: 0 };
  const zero = () => ({ spear: 0, sword: 0, spy: 0, heavy: 0 });
  for (const s of (others || defPlanOthers())) {
    u.nSlots++;
    if (s.sent) {
      u.nSent++;
      for (const r of (s.rows || [])) if (r && r.tCoord) u.targets[r.tCoord] = (u.targets[r.tCoord] || 0) + 1;
      continue;
    }
    for (const r of (s.rows || [])) {
      if (!r || !r.srcCoord || !r.units) continue;
      const now = u.now[r.srcCoord] || (u.now[r.srcCoord] = zero());
      const fut = u.fut[r.srcCoord] || (u.fut[r.srcCoord] = zero());
      for (const k of DEF_OBJ_UNITS) {
        const q = Math.max(0, r.units[k] || 0), f = Math.min(q, Math.max(0, (r.futUnits && r.futUnits[k]) || 0));
        now[k] += q - f; fut[k] += f;
        u.pop += q * POP[k];
      }
      u.nOrders++;
      if (r.tCoord) u.targets[r.tCoord] = (u.targets[r.tCoord] || 0) + 1;
    }
  }
  u.nVillages = Object.keys(u.now).length;
  return u;
}
// A sender village's home / returning stock minus what other plans already take from it (pure).
// Each prior share comes off its own bucket first; whatever a bucket can't cover spills onto the
// other one (troop files re-imported between plans move units between home and returning), so per
// unit the remaining total is always max(0, available − already sent). Returns fresh objects.
function defStockAfterPrior(stockNow, stockFut, pNow, pFut) {
  const now = {}, fut = {};
  for (const k of DEF_OBJ_UNITS) {
    let n = stockNow[k] || 0, f = stockFut[k] || 0;
    let restNow = (pNow && pNow[k]) || 0, restFut = (pFut && pFut[k]) || 0;
    let take = Math.min(n, restNow); n -= take; restNow -= take;
    take = Math.min(f, restFut); f -= take; restFut -= take;
    take = Math.min(f, restNow); f -= take; restNow -= take;
    take = Math.min(n, restFut); n -= take; restFut -= take;
    now[k] = n; fut[k] = f;
  }
  return { now, fut };
}
function defPlanAfterSwitch() {
  saveDefensive();
  if (typeof renderDefPlanTable === 'function') renderDefPlanTable(); // also re-renders the summaries + Manage Defense
  if (typeof repaintMapData === 'function') repaintMapData();         // map overlays read the active slot
}
// Show another slot (the plan table, exports and map follow; Manage Defense keeps its own view).
function setDefPlanActive(id) {
  id = parseInt(id, 10);
  if (defPlanIndex(id) < 0 || id === defPlanActive) return;
  defPlanSync();
  defPlanActive = id;
  defPlanLoad(defPlanActiveSlot());
  defPlanAfterSwitch();
}
// Start an empty defense plan next to the existing ones and make it active. Targets and settings
// are left as they are — the user edits them, then Generate Defense fills the new slot with what
// the other plans left free.
function newDefPlan() {
  defPlanSync();
  const s = defPlanNew(defPlanNextId++);
  defPlans.push(s);
  defPlanActive = s.id;
  defPlanLoad(s);
  defPlanAfterSwitch();
}
function renameDefPlan(id, name) {
  const s = defPlans.find(x => x.id === parseInt(id, 10));
  if (!s) return;
  s.name = String(name || '').trim().slice(0, 40);
  saveDefensive();
  if (typeof renderDefPlanSlots === 'function') renderDefPlanSlots();
  if (typeof renderManageDefTable === 'function') renderManageDefTable(); // view options + badge tooltips carry the name
}
// The last slot can never be deleted (Clear All empties it instead).
function deleteDefPlan(id) {
  id = parseInt(id, 10);
  defPlanEnsure();
  if (defPlans.length <= 1) return;
  const s = defPlans.find(x => x.id === id);
  if (!s) return;
  defPlanSync();
  if (!confirm(t('confirm_del_def_slot')(defPlanLabel(s), (s.rows || []).length))) return;
  defPlans = defPlans.filter(x => x.id !== id);
  if (defPlanActive === id) { defPlanActive = defPlans[0].id; defPlanLoad(defPlans[0]); }
  defPlanAfterSwitch();
}

// Never throws. On a quota failure the plan stays in memory and on screen; the user is told ONCE
// per session (warn_def_save_failed) — the setting handlers save on every keystroke. Returns whether
// the save landed; only then is the pre-v6.4.0 key removed (on a failure it may be the only copy).
let dtSaveWarned = false;
function saveDefensive() {
  defPlanSync(); // the active slot's record mirrors the plan globals
  // Compressed (lsSaveC): this key holds the generated plans and is by far the largest
  // tribe-calculator localStorage tenant (~3 MB uncompressed per big op) — LZ keeps it
  // well under the ~5 MB quota. The plans are KEPT verbatim (not regenerated) so a distributed
  // plan stays byte-stable across reloads.
  const ok = lsSaveC(DT_STORE_KEY, {
    cfg: dtCfg, targets: defTargets, ignore: defIgnore, ignorePlayers: defIgnorePlayers, completePlayers: defCompletePlayers, enemyIds: defEnemyIds, enemyTribes: defEnemyTribes, enemyDist: defEnemyDist, farFirst: defFarFirst, skipKnight: defSkipKnight,
    snipPlayers: defSnipPlayers, snipPct: defSnipPct, snipDist: defSnipDist,
    packMode: dpMode, packSize: dpPackSize, packMax: dpPackMax, packWeights: dpPackWeights,
    plans: defPlans, planActive: defPlanActive, planNextId: defPlanNextId, nextId: dtNextId,
  });
  if (!ok) {
    console.warn('saveDefensive failed (storage full)');
    if (!dtSaveWarned && typeof alert === 'function') { dtSaveWarned = true; alert(t('warn_def_save_failed')); }
  } else {
    try { localStorage.removeItem(DT_LEGACY_KEY); } catch {}
  }
  return ok;
}

function loadDefensive() {
  try {
    // The slots key; else the pre-v6.4.0 key, read WITHOUT lsLoadC's in-place rewrite (lsPeekC): loading
    // never writes it, so an older build sharing this storage keeps its copy as it was.
    const d = lsLoadC(DT_STORE_KEY) || lsPeekC(DT_LEGACY_KEY);
    if (d) {
      dtCfg           = { ...dtCfg, ...(d.cfg || {}) };
      defTargets      = d.targets || [];
      defIgnore       = typeof d.ignore === 'string' ? d.ignore : '';
      defIgnorePlayers = Array.isArray(d.ignorePlayers) ? d.ignorePlayers : [];
      defCompletePlayers = Array.isArray(d.completePlayers) ? d.completePlayers : [];
      defSnipPlayers  = Array.isArray(d.snipPlayers) ? d.snipPlayers : [];
      // 0 is a legitimate reserve (= "no reserve"), so don't let `|| default` swallow it.
      const sPct = parseFloat(d.snipPct), sDist = parseFloat(d.snipDist);
      defSnipPct  = Number.isFinite(sPct)  ? Math.min(100, Math.max(0, sPct)) : defSnipDefaults().pct;
      defSnipDist = Number.isFinite(sDist) ? Math.max(0, sDist) : defSnipDefaults().dist;
      defEnemyIds     = Array.isArray(d.enemyIds) ? d.enemyIds.map(String) : [];
      defEnemyTribes  = typeof d.enemyTribes === 'string' ? d.enemyTribes : '';
      defEnemyDist    = Math.max(0, parseInt(d.enemyDist, 10) || 0);
      defFarFirst     = d.farFirst === true;
      defSkipKnight   = d.skipKnight === true;
      dpMode          = d.packMode === 'packs' ? 'packs' : 'eff';
      dpPackSize      = Math.max(1, parseInt(d.packSize, 10) || dpPackDefaults().size);
      dpPackMax       = Math.max(0, parseInt(d.packMax, 10) || 0);
      dpPackWeights   = { ...dpPackDefaults().weights };
      if (d.packWeights) for (const u of DEF_OBJ_UNITS) {
        const n = parseFloat(d.packWeights[u]);
        if (Number.isFinite(n) && n > 0) dpPackWeights[u] = n;
      }
      // 💾 Slots (v6.4.0): each saved slot coerced (integer id, DEDUPED — first copy wins —,
      // string name, arrays); a pre-v6.4.0 save's single plan (or a save whose slots are all junk)
      // becomes slot 1.
      const seen = new Set();
      defPlans = (Array.isArray(d.plans) ? d.plans : [])
        .filter(s => s && typeof s === 'object' && Number.isInteger(s.id) && s.id > 0 && !seen.has(s.id) && seen.add(s.id))
        .map(s => ({ id: s.id, name: typeof s.name === 'string' ? s.name.slice(0, 40) : '', createdISO: typeof s.createdISO === 'string' ? s.createdISO : '',
          rows: Array.isArray(s.rows) ? s.rows.filter(r => r && typeof r === 'object') : [], warnings: Array.isArray(s.warnings) ? s.warnings : [],
          sent: s.sent === true, troopsAt: typeof s.troopsAt === 'string' ? s.troopsAt : '' }));
      defPlanActive = parseInt(d.planActive, 10) || 1;
      defPlanNextId = parseInt(d.planNextId, 10) || 2;
      if (!defPlans.length) {
        defPlans = [{ ...defPlanNew(1), rows: Array.isArray(d.plan) ? d.plan.filter(r => r && typeof r === 'object') : [], warnings: Array.isArray(d.warnings) ? d.warnings : [] }];
        defPlanActive = 1;
      }
      dtNextId        = d.nextId;
    } else {
      // No defensive save yet: the snip / pack starting values come from the 🎚 PARAMS defaults,
      // which loadSettings() has applied by now (the declarations above ran before it).
      defSnipPct    = defSnipDefaults().pct;
      defSnipDist   = defSnipDefaults().dist;
      dpPackSize    = dpPackDefaults().size;
      dpPackMax     = dpPackDefaults().max;
      dpPackWeights = { ...dpPackDefaults().weights };
    }
  } catch {}
  // No save at all → one slot holding whatever plan is in memory (empty on a fresh boot); a stale
  // active id → the first slot. A save always leaves defPlans non-empty, so its slot is loaded.
  const freshSlots = !Array.isArray(defPlans) || !defPlans.length;
  defPlanEnsure();
  if (freshSlots) defPlanSync(); else defPlanLoad(defPlanActiveSlot());
  if (!Array.isArray(defTargets)) defTargets = [];
  defTargets = defTargets.filter(tg => tg && typeof tg === 'object');
  // Target ids are interpolated into the row handlers (updDT(${tg.id}, …)) and matched with ===:
  // coerce each to a positive integer, give a duplicate or non-numeric id a fresh one, and keep
  // dtNextId above every id in use — a hand-edited / imported blob can neither inject nor collide.
  const usedIds = new Set();
  let nextId = Math.max(1, parseInt(dtNextId, 10) || 1,
    ...defTargets.map(tg => (parseInt(tg.id, 10) || 0) + 1));
  for (const tg of defTargets) {
    let id = parseInt(tg.id, 10);
    if (!(id > 0) || usedIds.has(id)) id = nextId++;
    tg.id = id;
    usedIds.add(id);
  }
  dtNextId = nextId;
  defTargets.forEach(normalizeDefTarget);
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  setVal('dt-def-spear', dtCfg.defSpear ?? 0);
  setVal('dt-def-sword', dtCfg.defSword ?? 0);
  setVal('dt-def-spy',   dtCfg.defSpy   ?? 0);
  setVal('dt-def-heavy', dtCfg.defHeavy ?? 0);
  const ign = document.getElementById('dp-ignore-input');
  if (ign) ign.value = defIgnore;
  setVal('plan-def-enemy-dist', defEnemyDist || 0);
  setVal('plan-def-snip-pct',  defSnipPct);
  setVal('plan-def-snip-dist', defSnipDist);
  const ff = document.getElementById('plan-def-far-first');
  if (ff) ff.checked = defFarFirst;
  const sk = document.getElementById('plan-def-skip-knight');
  if (sk) sk.checked = defSkipKnight;
  renderDpPackCfg();
  renderDefIgnorePlayers();
  renderDefCompletePlayers();
  renderDefSnipPlayers();
  refreshDefEnemyTribes(); // migrates any legacy free-text tribes once a DB is present, then paints
  renderDefMvPlayers();
  updDefPolyNote(); // a saved map-area filter must be visible from the first paint
  // Def min/max distance persist with the plan settings (PLAN_SETTING_IDS — loadSettings restores
  // them before this runs). Their inline oninput repaints the filtered summary; the save is
  // attached here (re-adding the same listener on a later loadDefensive is a DOM no-op).
  for (const id of ['plan-def-min-dist', 'plan-def-max-dist']) {
    const e = document.getElementById(id);
    if (e && e.addEventListener && typeof saveSettings === 'function') e.addEventListener('input', saveSettings);
  }
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
// The tribe tag Plan Defense gates a TARGET on: the live world DB whenever it knows the
// village — an owner who left the tribe reads '' there, never the stale tag stored on the
// target (which would let the same-tribe gate send support the game refuses) — and the
// stored tag only as the offline fallback (no DB loaded / village not in it).
function defTargetTag(tg) {
  const c = parseCoordStr(tg.coord);
  const key = c ? `${c.x}|${c.y}` : String(tg.coord || '');
  return coordDb[key] ? dbTribeAt(key) : (tg.tribe || '');
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
    // v5.12.1: a line may carry several coords (any separator — spaces, commas, tabs);
    // each keeps the text trailing it as its pasted name
    for (const e of lineCoordEntries(line)) {
      const pastedName = e.rest.replace(/\[\/?player\]/g, '').replace(/^[-–—.,;\s]+|[-–—.,;\s]+$/g, '').trim();
      const coord = `${e.x}|${e.y}`;
      defTargets.push(newDefTarget(coord, dbOwnerName(coord) || pastedName));
      added++;
    }
  }
  if (added) { input.value = ''; saveDefensive(); renderDefTargets(); }
}

function updDT(id, field, val) {
  const tg = defTargets.find(x => x.id === id);
  if (!tg) return;
  if (field === 'coord') {
    // Stored in the canonical "x|y" form (the DB lookups, the plan keys and Manage Defense all
    // match on it) — "605 600" / "605:600" are accepted as typed; anything unparseable is
    // refused and the cell repainted with the previous value.
    const c = parseCoordStr(val);
    if (!c) {
      if (typeof alert === 'function') alert(t('warn_invalid_coord')(String(val).trim()));
      renderDefTargets();
      return;
    }
    val = `${c.x}|${c.y}`;
  }
  if (DEF_OBJ_UNITS.includes(field)) tg[field] = Math.max(0, parseInt(val) || 0);
  else if (field === 'arriveDate' || field === 'arriveTime') tg[field] = val; // raw <input> value
  else tg[field] = String(val).trim();
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
// `mvPairs` list defined in offensive-targets.js (persisted in OT_STORE_KEY via
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
// Chip list of pairs ("Main – 🏖 Sitted") + the Main / Sitted pickers and an Add Pair button,
// built by the offensive mvPairChip / mvPairPickersHtml (every loaded player, alphabetical) —
// pairs are raw names, [main, sitted] since v6.3.1.
function renderDefMvPlayers() {
  const host = document.getElementById('dp-mv-players-host');
  if (!host) return;
  if (!Object.keys(players).length && !mvPairs.length) {
    host.innerHTML = `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    return;
  }
  const chips = mvPairs.map((pr, i) => mvPairChip(pr, i, 'removeDefMvPair')).join('');
  host.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${chips}`
    + `${mvPairPickersHtml('dp-mv', 'addDefMvPairFromSelects')}</div>`;
}

function refreshDefTargetsFromDb() {
  if (!villageDb.length) return;
  let changed = false;
  for (const tg of defTargets) {
    const n = dbOwnerName(tg.coord);
    if (n && tg.defender !== n) { tg.defender = n; changed = true; }
    // A village the DB knows takes its tag from it even when that tag is EMPTY (the owner left
    // the tribe); an unknown coord keeps its stored tag.
    if (coordDb[tg.coord]) {
      const tr = dbTribeAt(tg.coord);
      if (tg.tribe !== tr) { tg.tribe = tr; changed = true; }
    }
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
