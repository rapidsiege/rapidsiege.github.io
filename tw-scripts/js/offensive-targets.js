// ══════════════════════════════════════════════════════════════
// OFFENSIVE TARGETS + PLAN OFFENSIVE
// ══════════════════════════════════════════════════════════════
const OT_STORE_KEY = 'tw_tribe_offensive';
const TIER_RANK = { complete: 3, tq: 2, half: 1, none: 0 };
// Offs travel at ram pace, noble trains at snob pace (slowest unit dictates)
const PLAN_BASE_MIN = { off: 30, snob: 35 };
const TIER_FIELD = { complete: 'nComplete', tq: 'nTq', half: 'nHalf' };

let otCfg        = { dateLabel: '', defWinOff: '01:00/02:00', defWinSnob: '02:00/02:30', serverUrl: 'es100.guerrastribales.es', serverUtcOffset: 2, defComplete: 1, defTq: 0, defHalf: 0, defSnobMode: 'solo', groups: [], nextGroupId: 1 };
// [{id, coord, player, groupOffs:{<groupId>:{nComplete,nTq,nHalf}}, group, snobPlayers, nobles,
//   snobMode, snobAssignees:[{name,count}], offAssignees:[{tier,name,count,group}]}]
// `group` = the target's PRIMARY window group (its noble train's wave); `groupOffs` says how
// many offs of each tier it wants in each window group.
let offTargets   = [];
let offIgnore        = ''; // raw "Ignore Coordinates" textarea (Offensive Targets) — these villages never send anything
let offIgnorePlayers = []; // raw player names excluded from the whole plan (no off, no snob, no escort)
// "Enemy Tribes" (v5.10.0, offensive side): ally IDs whose villages bar nearby SENDERS from
// launching offs — the front line keeps its offs at home. Deliberately INDEPENDENT of the
// defensive `defEnemyIds`/`defEnemyDist` (defensive-targets.js): the two plans are run at
// different moments with different intents, so picking a tribe for one must not silently
// re-shape the other. IDs (never tags/names), same as the defensive picker since v5.7.0, so a
// rename can't break the filter; labels resolve from allyDb at render time. There is no legacy
// free-text form to migrate here — the offensive filter never had one.
let offEnemyIds      = []; // ally ids (strings) whose villages bar nearby senders
let offEnemyDist     = 0;  // "Distance from enemy tribes" (fields); 0 = filter off
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
  // `unused` (pre-v4.22) is split into three geometry-reasoned buckets: `far` (beyond max
  // distance of every target), `outside` (off-capable but outside the sender area — typed
  // coord filters / drawn polygon), and `avail` (free, in-area, in-band, in-time → deployable).
  // `heldEnemy` (v5.10.0) is its OWN bucket, not folded into `heldDist`: both are distance
  // holdbacks but they answer different questions ("too close to an objective" vs "too close to
  // an enemy tribe"), and a user who sees the footer needs to know which knob to turn.
  const t = () => ({ assigned: 0, heldDist: 0, heldEnemy: 0, heldNoble: 0, heldSplit: 0, heldLate: 0, far: 0, outside: 0, avail: 0, ignored: 0 });
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

// ── OFF WINDOW GROUPS ────────────────────────────────────────────────────────
// A group is one coordinated wave: its own ARRIVAL DATE, off window and snob window.
// Groups are INDEPENDENT — a plan can span several days by giving each group its own
// date. Every target then says, per group, how many Complete / 3-4 / 1-2 offs it wants
// (tg.groupOffs), so one target can be hit on Friday and again on Saturday.
//
// Stored in otCfg.groups (so they ride along with the offensive export/import) as
// [{id, dateISO, winOff, winSnob}] — `id` is stable, the A/B/C label is DERIVED from the
// position (otGroupLabel) so deleting B re-letters C into B instead of leaving a hole.
// The legacy single-date/multi-window model (otCfg.dateISO + tg.offWindows + tg.winSnob)
// migrates in otMigrateGroups(); with one group everything behaves exactly as before.
const GROUP_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function otGroupLabel(idx) {
  if (idx < 0) return '?';
  let s = '';
  for (let n = idx; ; n = Math.floor(n / 26) - 1) { s = GROUP_LABELS[n % 26] + s; if (n < 26) break; }
  return s;
}
// The group list, never empty: a calculator with no groups yet gets group A seeded from
// the legacy defaults so every caller can assume groups[0] exists.
function otGroups() {
  if (!Array.isArray(otCfg.groups)) otCfg.groups = [];
  if (!otCfg.groups.length) {
    otCfg.groups.push({ id: otCfg.nextGroupId ? otCfg.nextGroupId++ : (otCfg.nextGroupId = 2, 1),
      dateISO: otCfg.dateISO || '', winOff: otCfg.defWinOff || '', winSnob: otCfg.defWinSnob || '' });
  }
  return otCfg.groups;
}
function otGroupIndex(gid) { return otGroups().findIndex(g => g.id === gid); }
function otGroupById(gid) { const i = otGroupIndex(gid); return i < 0 ? otGroups()[0] : otGroups()[i]; }
// Label of the group a row/plan-row belongs to ('A', 'B', …); '?' for an unknown id.
function otLabelOf(gid) { const i = otGroupIndex(gid); return i < 0 ? '?' : otGroupLabel(i); }
// The target's PRIMARY group: the one its noble train uses (snob window + arrival date),
// and the anchor its catapult attacks fall back to. Defaults to the first group.
function otPrimaryGroupId(tg) {
  return (tg && otGroupIndex(tg.group) >= 0) ? tg.group : otGroups()[0].id;
}
// Per-group off request. tg.groupOffs is keyed by String(groupId) — JSON object keys are
// strings, so every read/write goes through these two so the key type can never drift.
function otTierCount(tg, gid, tier) {
  const e = tg && tg.groupOffs && tg.groupOffs[String(gid)];
  return e ? (e[TIER_FIELD[tier]] || 0) : 0;
}
function otSetTierCount(tg, gid, tier, n) {
  if (!tg.groupOffs) tg.groupOffs = {};
  const k = String(gid);
  if (!tg.groupOffs[k]) tg.groupOffs[k] = { nComplete: 0, nTq: 0, nHalf: 0 };
  tg.groupOffs[k][TIER_FIELD[tier]] = Math.max(0, parseInt(n) || 0);
}
// Offs of `tier` this target wants across ALL groups (the summary line, capacity warnings
// and any "how many offs does this row cost" question use this, never a single group).
function otTierTotal(tg, tier) {
  return otGroups().reduce((s, g) => s + otTierCount(tg, g.id, tier), 0);
}
function otAllTiersTotal(tg) {
  return ['complete', 'tq', 'half'].reduce((s, tr) => s + otTierTotal(tg, tr), 0);
}
// Groups this target actually attacks in (any tier > 0), in group order. A target with no
// offs anywhere still reports its primary group so its catapults/nobles have a window.
function otActiveGroups(tg) {
  const act = otGroups().filter(g => ['complete', 'tq', 'half'].some(tr => otTierCount(tg, g.id, tr) > 0));
  return act.length ? act : [otGroupById(otPrimaryGroupId(tg))];
}

// ── Legacy → groups migration ────────────────────────────────────────────────
// Pre-v5.9 saves had ONE global arrival date (otCfg.dateISO), per-target off windows
// (tg.offWindows = [{win, count}]) and a per-target snob window (tg.winSnob). Each distinct
// (off window, snob window) pair becomes a group on that one date, and the target's tier
// counts are dealt across its windows with the old windowOffCounts rule.
//
// ⚠ This is APPROXIMATE by construction and cannot be otherwise: the old counts split the
// target's off rows with all tiers MIXED (a window took "3 offs", not "3 Complete"), while a
// group's counts are per tier. A multi-window target therefore comes back with its per-tier
// counts spread proportionally rather than in the exact old order. Single-window targets —
// the overwhelming majority — convert exactly.
function otMigrateGroups() {
  const legacy = offTargets.filter(tg => tg && !tg.groupOffs);
  if (!legacy.length) { otGroups(); return; }
  if (!Array.isArray(otCfg.groups)) otCfg.groups = [];
  if (!otCfg.nextGroupId) otCfg.nextGroupId = 1;
  // A group seeded before the legacy date was known (an empty session that then loaded an old
  // save) adopts it now — otherwise the whole migrated plan would land on no date at all.
  for (const g of otCfg.groups) if (!g.dateISO && otCfg.dateISO) g.dateISO = otCfg.dateISO;
  const findOrAdd = (winOff, winSnob) => {
    let g = otCfg.groups.find(x => (x.winOff || '') === (winOff || '') && (x.winSnob || '') === (winSnob || ''));
    if (!g) {
      g = { id: otCfg.nextGroupId++, dateISO: otCfg.dateISO || '', winOff: winOff || '', winSnob: winSnob || '' };
      otCfg.groups.push(g);
    }
    return g;
  };
  for (const tg of legacy) {
    // Old shapes: offWindows list, or the even older single winOff string, or nothing at all.
    let wins = Array.isArray(tg.offWindows) && tg.offWindows.length
      ? tg.offWindows.map(w => typeof w === 'string' ? { win: w, count: 0 } : { win: w.win || '', count: Math.max(0, parseInt(w.count) || 0) })
      : [{ win: tg.winOff !== undefined ? tg.winOff : (otCfg.defWinOff || ''), count: 0 }];
    const snob = tg.winSnob !== undefined ? tg.winSnob : (otCfg.defWinSnob || '');
    const gids = wins.map(w => findOrAdd(w.win, snob).id);
    tg.groupOffs = {};
    // The old window counts split the target's offs with all tiers MIXED, and the engine filled
    // the windows from a strongest-first row list. Replay exactly that: build the tier-ordered
    // stream, then deal it into the groups using the same windowOffCounts shares. Applying the
    // shares per tier instead would multiply the counts (a "2 offs here" window would demand 2
    // Completes AND 2 3-4s AND 2 1-2s).
    const per = tier => Math.max(0, parseInt(tg[TIER_FIELD[tier]]) || 0);
    const stream = [];
    for (const tier of ['complete', 'tq', 'half']) for (let i = 0; i < per(tier); i++) stream.push(tier);
    const share = windowOffCounts(wins, stream.length);
    let gi = 0, used = 0;
    for (const tier of stream) {
      while (gi < gids.length - 1 && used >= share[gi]) { gi++; used = 0; }
      otSetTierCount(tg, gids[gi], tier, otTierCount(tg, gids[gi], tier) + 1);
      used++;
    }
    tg.group = gids[0];
    // Pinned off senders were per (target, tier); they now also name a group — the first one.
    if (Array.isArray(tg.offAssignees)) tg.offAssignees.forEach(a => { if (a && a.group === undefined) a.group = gids[0]; });
    delete tg.nComplete; delete tg.nTq; delete tg.nHalf;
    delete tg.offWindows; delete tg.winOff; delete tg.winSnob;
  }
  otGroups(); // guarantee at least one even if every legacy target somehow produced none
}

// Add a group after the last one, seeded from it (same windows, blank date so the user is
// forced to say WHICH day this wave lands — that's the whole point of a second group).
function addOffWindowGroup() {
  const gs = otGroups();
  const last = gs[gs.length - 1];
  if (!otCfg.nextGroupId) otCfg.nextGroupId = Math.max(0, ...gs.map(g => g.id)) + 1;
  gs.push({ id: otCfg.nextGroupId++, dateISO: '', winOff: last.winOff || '', winSnob: last.winSnob || '' });
  saveOffensive(); renderOffWindowGroups(); renderOffTargets();
}
// Removing a group drops every target's offs in it (they have nowhere to land) and re-points
// any target whose primary group it was. The last group can never be removed.
function removeOffWindowGroup(gid) {
  const gs = otGroups();
  if (gs.length <= 1) return;
  const idx = otGroupIndex(gid);
  if (idx < 0) return;
  const offs = offTargets.reduce((s, tg) => s + ['complete', 'tq', 'half'].reduce((x, tr) => x + otTierCount(tg, gid, tr), 0), 0);
  if (!confirm(t('confirm_del_group')(otGroupLabel(idx), offs))) return;
  otCfg.groups.splice(idx, 1);
  const fallback = otCfg.groups[0].id;
  for (const tg of offTargets) {
    if (tg.groupOffs) delete tg.groupOffs[String(gid)];
    if (tg.group === gid) tg.group = fallback;
    if (Array.isArray(tg.offAssignees)) tg.offAssignees = tg.offAssignees.filter(a => a.group !== gid);
  }
  // Orders already generated for that wave describe attacks that no longer exist — drop them so
  // the plan table, the exports and Manage Offensive can't disagree about what is still planned.
  planRows = planRows.filter(r => r.group !== gid);
  saveOffensive(); renderOffWindowGroups(); renderOffTargets();
  if (typeof renderPlanTable === 'function') renderPlanTable();
}
function updGroupDate(gid, v) {
  const g = otGroups().find(x => x.id === gid);
  if (!g) return;
  g.dateISO = String(v || '').trim();
  saveOffensive(); renderOffWindowGroups(); renderOffTargets();
}
// Window edits do NOT re-render the group rows: rebuilding the <input type="time"> mid-edit
// would drop focus after each keystroke (same rule as the coordinate-filter rows).
function updGroupWin(gid, kind) {
  const g = otGroups().find(x => x.id === gid);
  if (!g) return;
  g[kind === 'snob' ? 'winSnob' : 'winOff'] = readWinInputs(`otg-${gid}-${kind}`);
  saveOffensive(); renderOffTargets();
}
function fixGroupWin(gid, kind) {
  const s = document.getElementById(`otg-${gid}-${kind}-s`), e = document.getElementById(`otg-${gid}-${kind}-e`);
  if (s && e) { e.value = s.value; updGroupWin(gid, kind); }
}
// A group's arrival date as the localized "Miércoles 10" label used by the BB exports.
function groupDateLabel(g) { return bbDateLabelOf(g && g.dateISO); }
// True once the plan really spans several days — the exports section themselves per group
// only then, so a normal single-wave plan keeps its exact historical output.
function otMultiGroup() { return otGroups().length > 1; }

function saveOffensive() {
  localStorage.setItem(OT_STORE_KEY, JSON.stringify({
    cfg: otCfg, targets: offTargets, ignore: offIgnore, ignorePlayers: offIgnorePlayers, mvPairs,
    enemyIds: offEnemyIds, enemyDist: offEnemyDist,
    coordFilters: planCoordFilters, coordPolygon: planCoordPolygon, coordPolygonInv: planCoordPolygonInv,
    plan: planRows, warnings: planWarnings, reserved: planReserved, stats: planStats, nextId: otNextId,
  }));
}

function loadOffensive() {
  try {
    const d = JSON.parse(localStorage.getItem(OT_STORE_KEY));
    if (d) {
      otCfg        = { ...otCfg, ...(d.cfg || {}) };
      // A pre-v5.9 save has no groups: drop whatever placeholder group this session may already
      // have seeded so otMigrateGroups() rebuilds them from the stored date + per-target windows.
      if (!Array.isArray((d.cfg || {}).groups) || !(d.cfg || {}).groups.length) otCfg.groups = [];
      offTargets   = d.targets || [];
      offIgnore        = typeof d.ignore === 'string' ? d.ignore : '';
      offIgnorePlayers = Array.isArray(d.ignorePlayers) ? d.ignorePlayers : [];
      offEnemyIds      = Array.isArray(d.enemyIds) ? d.enemyIds.map(String) : [];
      offEnemyDist     = Math.max(0, parseInt(d.enemyDist, 10) || 0);
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
  // normalize targets saved by older versions (this is also what migrates a pre-v5.9 save's
  // single arrival date + per-target windows into window groups)
  offTargets.forEach(normalizeOffTarget);
  renderOffWindowGroups();
  const esInput = document.getElementById('plan-earliest-send'); // Plan Offensive tab, but stored in otCfg (round-trips with the plan)
  if (esInput) esInput.value = otCfg.earliestSendISO || '';
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
  const oed = document.getElementById('ot-enemy-dist');
  if (oed) oed.value = offEnemyDist || 0;
  renderOffIgnorePlayers();
  renderOffMvPlayers();
  renderOffEnemyTribes();
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

// ── Enemy Tribes (Offensive Targets, v5.10.0) ────────────────────────────────
// The offensive twin of the Plan-Defense filter: a village within "Distance from enemy tribes"
// fields of ANY village owned by ANY picked tribe keeps its off at home. It is a SECOND,
// independent gate alongside "Off min distance" (Plan Offensive) — that one measures against
// the plan's own objectives, this one against the enemy's whole territory, and a village barred
// by either is held. Sender-side only: the targets in the table are untouched (attacking an
// enemy tribe is the point). Needs the world DB, both to pick a tribe and to locate its
// villages; the tribe-troop file alone is not enough.
//
// State/UI here in offensive-targets.js, applied in plan.js (generatePlan). Village lookup
// reuses enemyTribeVillageCoords() from defense-plan.js — every js/ file shares one flat global
// scope and functions are hoisted, so the cross-file call is safe and load order is irrelevant.
function parseOffEnemySet() {
  return new Set(offEnemyIds.map(String));
}
// Tribes not already picked, BIGGEST FIRST by total points (same sort as the defensive picker:
// the tribe worth worrying about is the big one), ties broken by label so the order is stable.
function offEnemyTribeOptions() {
  return Object.keys(allyDb)
    .filter(id => !offEnemyIds.includes(String(id)))
    .map(id => ({ id: String(id), label: allyLabel(id), points: allyPointsOf(allyDb[id]) }))
    .sort((a, b) => (b.points - a.points) || a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
}
function addOffEnemyTribe(id) {
  id = String(id || '');
  if (!id || offEnemyIds.includes(id)) return;
  offEnemyIds.push(id);
  saveOffensive(); renderOffEnemyTribes();
  renderOtOffsSummary(); // barred villages leave the summary's available pool
}
function removeOffEnemyTribe(idx) {
  offEnemyIds.splice(idx, 1);
  saveOffensive(); renderOffEnemyTribes();
  renderOtOffsSummary(); // barred villages leave the summary's available pool
}
// Chip list + points-sorted picker. PURE PAINT — no save (saveOffensive serializes the whole
// offensive blob, so writing from a repaint would couple correctness to caller ordering).
// Chips resolve their label from allyDb every paint, so a renamed tribe follows automatically;
// an id the DB no longer knows keeps its place as "?<id>" so it can be seen and removed rather
// than silently filtering nothing.
function renderOffEnemyTribes() {
  const host = document.getElementById('ot-enemy-host');
  if (!host) return;
  const haveDb = Object.keys(allyDb).length > 0;
  if (!haveDb && !offEnemyIds.length) {
    host.innerHTML = `<span class="num-zero" title="${esc(t('def_enemy_need_db'))}">—</span>`;
    return;
  }
  const chips = offEnemyIds.map((id, i) => {
    const label = allyLabel(id);
    const unknown = !label;
    return `<span class="chip"${unknown ? ` title="${esc(t('def_enemy_unknown_id'))}"` : ''}>`
      + `${unknown ? '?' + esc(id) : esc(label)}<span class="chip-x" onclick="removeOffEnemyTribe(${i})">✕</span></span>`;
  }).join('');
  const picker = haveDb
    ? `<select class="cell-input" style="width:230px;" onchange="addOffEnemyTribe(this.value)">
         <option value="">${t('opt_pick_enemy_tribe')}</option>
         ${offEnemyTribeOptions().map(o =>
           `<option value="${esc(o.id)}">${esc(o.label)} (${o.points.toLocaleString()})</option>`).join('')}
       </select>`
    : `<span class="num-zero" title="${esc(t('def_enemy_need_db'))}">${esc(t('def_enemy_need_db'))}</span>`;
  host.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${chips}${picker}</div>`;
}
// The live radius: the DOM is the source of truth (like every other plan field), with the
// persisted value as fallback so a headless run — where inputs read '' — still sees it.
function offEnemyDistLive() {
  const raw = parseFloat((document.getElementById('ot-enemy-dist') || {}).value);
  return Math.max(0, Number.isFinite(raw) ? raw : (typeof offEnemyDist === 'number' ? offEnemyDist : 0));
}

// Coord strings of OUR villages barred by the Enemy Tribes filter — THE single definition of
// "too close to an enemy tribe", used by BOTH generatePlan (plan.js) and the Offensive Targets
// footer (renderOtOffsSummary), so the count the footer shows can never disagree with the
// number of offs Generate actually holds back.
//
// Computed fresh on every call (no memo): the plan must never be able to run off a stale
// snapshot of the world DB, and the footer is repainted on every keystroke in the Ignore box.
// Naive "every village × every enemy village" is O(N×M) and would make that repaint drag on a
// big war, so enemy villages go into a grid of `dist`-sized cells and each of ours only tests
// the 3×3 cells around it — the only cells that can hold a village within the radius.
function offEnemyExcludedCoords() {
  const excl = new Set();
  const dist = offEnemyDistLive();
  if (dist <= 0) return excl;
  const enemyCoords = enemyTribeVillageCoords(parseOffEnemySet()); // defense-plan.js (flat global scope)
  if (!enemyCoords.length) return excl;
  const cell = Math.max(1, Math.ceil(dist));
  const grid = new Map();
  const key = (cx, cy) => cx + ':' + cy;
  for (const e of enemyCoords) {
    const k = key(Math.floor(e.x / cell), Math.floor(e.y / cell));
    let b = grid.get(k); if (!b) grid.set(k, b = []);
    b.push(e);
  }
  for (const v of villages) {
    const c = parseCoordStr(v.coord);
    if (!c) continue;
    const cx = Math.floor(c.x / cell), cy = Math.floor(c.y / cell);
    let near = false;
    for (let dx = -1; dx <= 1 && !near; dx++) {
      for (let dy = -1; dy <= 1 && !near; dy++) {
        const b = grid.get(key(cx + dx, cy + dy));
        if (b) for (const e of b) if (distXY(c, e) <= dist) { near = true; break; }
      }
    }
    if (near) excl.add(v.coord);
  }
  return excl;
}

function updOffEnemyDist() {
  const el = document.getElementById('ot-enemy-dist');
  offEnemyDist = el ? Math.max(0, parseInt(el.value, 10) || 0) : 0;
  saveOffensive();
  renderOtOffsSummary(); // the radius shrinks the summary's available pool
}
function toggleOffEnemy() {
  const el = document.getElementById('ot-enemy-wrap');
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
// ── The "Default offs" row ────────────────────────────────────────────────────
// The default counts seed new targets (newOffTarget) and can be pushed onto every existing
// target with the ↻ button. Both act on ONE group — the one picked in `defGroup` — so you can
// build wave B by switching the picker, then adding or mass-updating rows. Windows and arrival
// dates are NOT here any more: they belong to the group itself (the Window Groups editor).
function otDefGroupId() {
  return otGroupIndex(otCfg.defGroup) >= 0 ? otCfg.defGroup : otGroups()[0].id;
}
function updDefGroup(v) {
  const gid = parseInt(v, 10);
  if (otGroupIndex(gid) >= 0) otCfg.defGroup = gid;
  saveOffensive(); renderOffWindowGroups();
}
// Overwrites the picked group's Complete / 3-4 / 1-2 counts AND the snob mode on every target.
// Other groups' counts are untouched — that's the point of groups being independent.
function applyDefOffsSnobToAll() {
  if (!offTargets.length) return;
  const gid = otDefGroupId();
  if (!confirm(t('confirm_apply_offssnob')(offTargets.length, otLabelOf(gid)))) return;
  for (const tg of offTargets) {
    otSetTierCount(tg, gid, 'complete', otCfg.defComplete ?? 1);
    otSetTierCount(tg, gid, 'tq', otCfg.defTq ?? 0);
    otSetTierCount(tg, gid, 'half', otCfg.defHalf ?? 0);
    tg.snobMode = otCfg.defSnobMode || 'solo';
  }
  saveOffensive(); renderOffTargets();
}

// Normalize a target saved by (or pasted from) older versions: legacy windows/date → window
// groups (otMigrateGroups, which sweeps EVERY legacy target on its first call and then
// early-returns), assignee names → {name, count} objects, and the various type/catapult fields.
function normalizeOffTarget(tg) {
  otMigrateGroups();
  if (!TARGET_TYPES.includes(tg.type)) tg.type = 'off'; // pre-v4.17 saves had no type
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
  // A pinned off sender names a (group, tier) pair. Entries from a deleted group would pin
  // offs nowhere, so they fall back to the primary group rather than silently disappearing.
  tg.offAssignees = tg.offAssignees
    .filter(a => a && a.name && ['complete', 'tq', 'half'].includes(a.tier))
    .map(a => ({ tier: a.tier, name: a.name, count: Math.max(0, parseInt(a.count) || 0),
      group: otGroupIndex(a.group) >= 0 ? a.group : otPrimaryGroupId(tg) }));
  // Per-group off requests, keyed by String(groupId); drop entries for groups that no longer
  // exist and coerce every count to a non-negative integer.
  if (!tg.groupOffs || typeof tg.groupOffs !== 'object') tg.groupOffs = {};
  for (const k of Object.keys(tg.groupOffs)) {
    if (otGroupIndex(Number(k)) < 0) { delete tg.groupOffs[k]; continue; }
    const e = tg.groupOffs[k] || {};
    tg.groupOffs[k] = { nComplete: Math.max(0, parseInt(e.nComplete) || 0),
      nTq: Math.max(0, parseInt(e.nTq) || 0), nHalf: Math.max(0, parseInt(e.nHalf) || 0) };
  }
  tg.group = otPrimaryGroupId(tg);
  return tg;
}

// `type` ∈ TARGET_TYPES (default 'off'); only the bulk-add dropdown and the mass edit set
// anything else. A DESTROYER starts with the catapult toggle ON at the default attack count.
// The default off counts seed ONE group — the one picked in the "Default offs" row. A fresh
// target that silently requested offs in every group would quietly multiply the whole plan, so
// later waves are always something you opt into per row.
function newOffTarget(coord, player, type) {
  if (!TARGET_TYPES.includes(type)) type = 'off';
  const destroyer = type === 'destroyer';
  const g0 = otDefGroupId();
  return {
    id: otNextId++, coord, player, type, power: false,
    catEnabled: destroyer, catapult: destroyer ? CAT_ATTACKS_DEFAULT : 0, catBuildings: [], catMode: 'smith',
    groupOffs: { [String(g0)]: { nComplete: otCfg.defComplete ?? 1, nTq: otCfg.defTq ?? 0, nHalf: otCfg.defHalf ?? 0 } },
    group: g0, snobPlayers: 0, nobles: 4,
    // A FAKE target's noble train, if any, defaults to a bare fake decoy; everything else uses
    // the configured default snob mode. (Bulk-add as FAKE therefore lands on 'fake' automatically.)
    snobMode: type === 'fake' ? 'fake' : (otCfg.defSnobMode || 'solo'), snobAssignees: [], offAssignees: [],
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
  // Whole batch takes the panel's type dropdown (Off / Destroyer / Fake); missing element → 'off'.
  const type = (document.getElementById('ot-bulk-type') || {}).value || 'off';
  let added = 0;
  for (const line of input.value.split('\n')) {
    const m = line.match(/(\d{1,3})\s*\|\s*(\d{1,3})\s*(.*)/);
    if (!m) continue;
    const pastedName = m[3].replace(/\[\/?player\]/g, '').replace(/^[-–—.\s]+|[-–—.\s]+$/g, '').trim();
    const coord = `${m[1]}|${m[2]}`;
    offTargets.push(newOffTarget(coord, dbOwnerName(coord) || pastedName, type));
    added++;
  }
  if (added) { input.value = ''; saveOffensive(); renderOffTargets(); }
}

// Per-group off count cell (Complete / 3-4 / 1-2 × window group). No re-render: the summary
// line is refreshed on its own so typing in one cell can't steal focus from it.
function updOTGroupCount(id, gid, tier, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || otGroupIndex(gid) < 0) return;
  otSetTierCount(tg, gid, tier, val);
  saveOffensive();
  renderOtOffsSummary();
}
// The target's primary group — the one its noble train (and, when it requests offs nowhere,
// its catapults) lands in. Changing it re-renders: the row's snob window text follows.
function updOTGroup(id, val) {
  const tg = offTargets.find(x => x.id === id);
  const gid = parseInt(val, 10);
  if (!tg || otGroupIndex(gid) < 0) return;
  tg.group = gid;
  saveOffensive(); renderOffTargets();
}
function updOT(id, field, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  if (['snobPlayers','nobles','catapult'].includes(field)) tg[field] = Math.max(0, parseInt(val) || 0);
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

// CATAPULT toggle (per target): when ticked, reveal the attack-count input (defaulting to
// CAT_ATTACKS_DEFAULT the first time it's enabled); when unticked, no catapult attacks are
// planned for this target.
function setOTCatapult(id, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.catEnabled = !!val;
  if (tg.catEnabled && !(tg.catapult > 0)) tg.catapult = CAT_ATTACKS_DEFAULT;
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

// Remove duplicate targets (same coord), keeping ONE row per coordinate. The kept row is
// the one with the most snob senders assigned (then most off senders), so manual assignment
// work survives the cleanup; on a full tie the first-listed row wins.
function dedupOffTargets() {
  const score = tg => tg.snobAssignees.length * 1000 + tg.offAssignees.length; // snob senders dominate
  const best = new Map(); // coord → row to keep
  for (const tg of offTargets) {
    const cur = best.get(tg.coord);
    if (!cur || score(tg) > score(cur)) best.set(tg.coord, tg);
  }
  const removed = offTargets.length - best.size;
  if (!removed) { alert(t('dedup_none')); return; }
  if (!confirm(t('confirm_dedup_targets')(removed))) return;
  const keep = new Set([...best.values()].map(tg => tg.id));
  offTargets = offTargets.filter(tg => keep.has(tg.id));
  otPruneSelection();
  saveOffensive(); renderOffTargets();
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
  // Both group pickers start on the "Default offs" group, and the whole group row is hidden
  // while there is only one group — nothing to choose.
  for (const id of ['ot-mass-group', 'ot-mass-snobgroup']) {
    const s = document.getElementById(id);
    if (s) s.innerHTML = otGroupOptionsHtml(otDefGroupId());
  }
  for (const id of ['ot-mass-group-row', 'ot-mass-snobgroup-row']) {
    const r = document.getElementById(id);
    if (r) r.style.display = otMultiGroup() ? '' : 'none';
  }
  document.getElementById('ot-mass-status').textContent = '';
  document.getElementById('ot-mass-modal').classList.add('open');
}
function closeMassEdit() {
  document.getElementById('ot-mass-modal').classList.remove('open');
}

// ── Mass-edit staging list (catapult buildings) ───────────────────────────────
// A LOCAL draft for the modal: openMassEdit resets it, its Apply copies it onto every
// selected target (same shape as tg.catBuildings).
let massCatBuildings = []; // [{building, count}] — mirrors the per-target Catapults cell

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
// Target type (OFF / DESTROYER / FAKE) for every selected row. Switching TO destroyer also
// turns the catapult attacks on (default count) — mirrors the bulk-add creation path; switching
// away leaves the rest of the row's config untouched (a fake row simply ignores it in the plan).
function massSetType(type) {
  if (!TARGET_TYPES.includes(type)) return;
  massApply(tg => {
    tg.type = type;
    if (type === 'destroyer' && !tg.catEnabled) { tg.catEnabled = true; if (!(tg.catapult > 0)) tg.catapult = CAT_ATTACKS_DEFAULT; }
  });
}
// The modal's catapult attack count (default CAT_ATTACKS_DEFAULT, like the row toggle's first
// enable). Both Turn ON and the buildings Apply stamp it onto every selected row.
function massCatCount() {
  const n = parseInt((document.getElementById('ot-mass-cat-count') || {}).value, 10);
  return n > 0 ? n : CAT_ATTACKS_DEFAULT;
}
function massSetCatapult(v) {
  const cnt = massCatCount();
  massApply(tg => { tg.catEnabled = !!v; if (v) tg.catapult = cnt; });
}
// The modal's group picker, defaulting to the "Default offs" group when the row is hidden
// (single-group plan) or somehow stale.
function massGroupId(id) {
  const gid = parseInt((document.getElementById(id) || {}).value, 10);
  return otGroupIndex(gid) >= 0 ? gid : otDefGroupId();
}
// Writes the three counts into ONE window group on every selected row; the other groups'
// counts are left alone, so this is how you fill wave B without disturbing wave A.
function massSetOffs() {
  const n = id => Math.max(0, parseInt(document.getElementById(id).value) || 0);
  const c = n('ot-mass-complete'), q = n('ot-mass-tq'), h = n('ot-mass-half');
  const gid = massGroupId('ot-mass-group');
  massApply(tg => {
    otSetTierCount(tg, gid, 'complete', c);
    otSetTierCount(tg, gid, 'tq', q);
    otSetTierCount(tg, gid, 'half', h);
  });
}
function massSetSnobMode(v) { massApply(tg => { tg.snobMode = (v === 'escorted' || v === 'fake') ? v : 'solo'; }); }
function massSetCatMode(v)  { if (CAT_MODE_KEYS.includes(v)) massApply(tg => { tg.catMode = v; }); }
// Moves every selected row's noble train to one window group (its snob window + arrival date).
function massSetSnobGroup() {
  const gid = massGroupId('ot-mass-snobgroup');
  massApply(tg => { tg.group = gid; });
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
// Resolve a target tier's named off senders IN ONE WINDOW GROUP to [{name, count}] (explicit
// counts honored; count-0 senders auto-share that group's remaining slots evenly, like snob
// trains). A pin belongs to exactly one (group, tier) pair, so pinning Bob to Complete in
// group A leaves group B's Completes free for the auto pass.
function targetOffAssign(tg, tier, gid) {
  const N = otTierCount(tg, gid, tier);
  const assignees = (tg.offAssignees || []).filter(a => a && a.name && a.tier === tier && a.group === gid);
  if (!N || !assignees.length) return [];
  const explicitSum = assignees.reduce((s, a) => s + (a.count > 0 ? a.count : 0), 0);
  const auto = assignees.filter(a => !(a.count > 0));
  const shares = auto.length ? splitNobles(Math.max(0, N - explicitSum), auto.length) : [];
  let ai = 0;
  return assignees
    .map(a => ({ name: a.name, count: a.count > 0 ? a.count : (shares[ai++] || 0) }))
    .filter(x => x.count > 0);
}
function addOffAssignee(id, gid, tier, name) {
  if (!name) return;
  const tg = offTargets.find(x => x.id === id);
  if (!tg || otGroupIndex(gid) < 0) return;
  if (!Array.isArray(tg.offAssignees)) tg.offAssignees = [];
  tg.offAssignees.push({ tier, name, count: 0, group: gid });
  // assigning a sender implies at least one off of that tier is wanted IN THAT GROUP
  const cnt = tg.offAssignees.filter(a => a.tier === tier && a.group === gid).length;
  if (otTierCount(tg, gid, tier) < cnt) otSetTierCount(tg, gid, tier, cnt);
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

// How many offs each window takes: explicit counts first, windows with count 0 share the
// remainder evenly (earlier windows absorb the rounding). Since v5.9 windows live on window
// groups and this rule no longer drives the plan — it survives only to deal a legacy
// multi-window target's counts across the groups it migrates into (otMigrateGroups).
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

// Localized "Miércoles 10"-style label for an arrival date.
// ⚠ FORMAT CONTRACT: the attack-planner import reads every day-of-month from the
// "ARRIVAL DATE: <weekday> <day>[ & <weekday> <day>…]" header this feeds (the per-player
// header " & "-joins one label per date since v5.12) — see the contract note in js/plan.js.
function bbDateLabelOf(dateISO) {
  if (dateISO) {
    const d = new Date(dateISO + 'T00:00:00');
    if (!isNaN(d)) {
      const days = lang === 'es'
        ? ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
        : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return `${days[d.getDay()]} ${d.getDate()}`;
    }
  }
  return otCfg.dateLabel || ''; // legacy free-text fallback
}
// The plan's headline arrival date — the FIRST group's. With one group (the usual case) this
// is the plan's only date; with several, exports that name a single date name this one and the
// per-group sections carry their own (see planGroupDateLabel in plan.js).
function bbDateLabel() { return bbDateLabelOf(otGroups()[0].dateISO); }

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
// ── Column visibility (Offensive Targets table) ──────────────────────────────
// 👁 Columns panel next to Edit Selected Rows: untick a column to hide it. The four
// structural columns (select-checkbox, #, Coord, ✕) are not toggleable. Hiding is pure
// CSS — applyOtColVis() writes nth-child display:none rules into the static
// #ot-colvis-style element, so it survives every tbody rebuild with no per-render work
// (the empty-row placeholder td spans all columns and is never nth-matched). The hidden
// set persists per device in tw_tribe_settings (saveSettings/loadSettings,
// render-tables.js) — deliberately NOT in the offensive export: it's a view preference,
// not plan data.
const OT_COLS = [ // [key, 1-based nth-child in #offtargets-table, header i18n key]
  ['type',        3,  'th_ttype'],
  ['defender',    5,  'th_def_player'],
  ['points',      6,  'th_points'],
  ['complete',    7,  'th_complete'],
  ['tq',          8,  'th_tq'],
  ['half',        9,  'th_half'],
  ['power',       10, 'th_power'],
  ['catapults',   11, 'th_catapults'],
  ['offSenders',  12, 'th_off_senders'],
  ['snobPlayers', 13, 'th_snob_players'],
  ['nobles',      14, 'th_nobles'],
  ['senders',     15, 'th_snob_senders'],
  ['snobMode',    16, 'th_escort'],
  ['catMode',     17, 'th_catmode'],
  ['winOff',      18, 'th_win_off'],
  ['winSnob',     19, 'th_win_snob'],
];
let otHiddenCols = new Set(); // keys from OT_COLS; restored by loadSettings()

// Pure: the CSS that hides the given column keys (unknown keys ignored) — headless-testable.
function otColVisCss(hidden) {
  return OT_COLS.filter(([key]) => hidden.has(key))
    .map(([, nth]) => `#offtargets-table th:nth-child(${nth}), #offtargets-table td:nth-child(${nth}) { display: none; }`)
    .join('\n');
}
function applyOtColVis() {
  const el = document.getElementById('ot-colvis-style');
  if (el) el.textContent = otColVisCss(otHiddenCols);
}
function toggleOtColVis() {
  const el = document.getElementById('ot-colvis-wrap');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
  renderOtColVis();
}
function toggleOtCol(key, visible) {
  if (!OT_COLS.some(([k]) => k === key)) return;
  if (visible) otHiddenCols.delete(key); else otHiddenCols.add(key);
  applyOtColVis(); saveSettings();
}
function otShowAllCols() {
  otHiddenCols.clear();
  applyOtColVis(); saveSettings(); renderOtColVis();
}
function renderOtColVis() {
  const host = document.getElementById('ot-colvis-host');
  if (!host) return;
  host.innerHTML = OT_COLS.map(([key, , label]) =>
    `<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#d4b483;white-space:nowrap;cursor:pointer;">
       <input type="checkbox" ${otHiddenCols.has(key) ? '' : 'checked'} onchange="toggleOtCol('${key}',this.checked)">${esc(t(label))}
     </label>`).join('')
    + `<button class="btn btn-ghost btn-sm" style="padding:1px 8px;" onclick="otShowAllCols()">${esc(t('colvis_show_all'))}</button>`;
}

// ── Window Groups editor (top of the Offensive Targets tab) ───────────────────
// One row per group: its letter, arrival date (+ the localized "Miércoles 10" preview the BB
// exports use), off window and snob window, and a ✕ that is only offered from the second group
// on. Below the rows, the picker that says which group the "Default offs" inputs write to.
// Time inputs deliberately do NOT re-render this block on change (updGroupWin) — rebuilding an
// <input type="time"> mid-edit drops focus after every keystroke.
function renderOffWindowGroups() {
  const host = document.getElementById('ot-groups-host');
  if (!host) return; // headless test sandbox / not on this tab
  const gs = otGroups();
  const multi = gs.length > 1;
  const winCell = (g, kind) => {
    const [s, e] = winParts(kind === 'snob' ? g.winSnob : g.winOff);
    return `<span style="display:inline-flex;gap:3px;align-items:center;">
      <input type="time" id="otg-${g.id}-${kind}-s" class="cell-input mono" style="width:88px;" value="${s}" onchange="updGroupWin(${g.id},'${kind}')">
      <button class="btn btn-ghost btn-sm" style="padding:1px 6px;" title="${esc(t('fix_time_title'))}" onclick="fixGroupWin(${g.id},'${kind}')">=</button>
      <input type="time" id="otg-${g.id}-${kind}-e" class="cell-input mono" style="width:88px;" value="${e}" onchange="updGroupWin(${g.id},'${kind}')">
    </span>`;
  };
  host.innerHTML = gs.map((g, i) => `
    <div class="filter-row" style="gap:8px;align-items:center;margin:0 0 6px 0;">
      <span class="badge badge-complete" style="min-width:22px;text-align:center;" title="${esc(t('group_label_title'))}">${esc(otGroupLabel(i))}</span>
      <label data-i18n="lbl_date_label">${esc(t('lbl_date_label'))}</label>
      <input type="date" value="${esc(g.dateISO || '')}" onchange="updGroupDate(${g.id},this.value)">
      <span style="font-size:12px;color:#f0c040;font-weight:600;min-width:90px;">${esc(groupDateLabel(g))}</span>
      <label>${esc(t('lbl_group_winoff'))}</label>${winCell(g, 'off')}
      <label>${esc(t('lbl_group_winsnob'))}</label>${winCell(g, 'snob')}
      ${multi ? `<button class="btn btn-ghost btn-sm" title="${esc(t('del_group_title'))}" onclick="removeOffWindowGroup(${g.id})">✕</button>` : ''}
    </div>`).join('')
    + `<div class="filter-row" style="gap:8px;align-items:center;margin:0;">
         <button class="btn btn-ghost btn-sm" onclick="addOffWindowGroup()" title="${esc(t('add_group_title'))}">${esc(t('btn_add_group'))}</button>
         <span style="font-size:12px;color:#5a3a18;">${esc(t('groups_hint'))}</span>
       </div>`;
  const sel = document.getElementById('ot-def-group');
  if (sel) {
    sel.innerHTML = otGroupOptionsHtml(otDefGroupId());
    sel.style.display = multi ? '' : 'none';
  }
  const lbl = document.getElementById('ot-def-group-lbl');
  if (lbl) lbl.style.display = multi ? '' : 'none';
}
// <option> list for every group picker: "A · 01:00/02:00 · Wednesday 10" (the parts that exist).
function otGroupOptionsHtml(selectedId) {
  return otGroups().map((g, i) => {
    const bits = [otGroupLabel(i)];
    if (fmtWindow(g.winOff)) bits.push(fmtWindow(g.winOff));
    const dl = groupDateLabel(g);
    if (dl) bits.push(dl);
    return `<option value="${g.id}"${g.id === selectedId ? ' selected' : ''}>${esc(bits.join(' · '))}</option>`;
  }).join('');
}

function renderOtOffsSummary() {
  const el = document.getElementById('ot-offs-summary');
  if (!el) return;
  if (!offTargets.length && !villages.length) { el.innerHTML = ''; return; }
  // FAKE targets are excluded throughout: their Complete column is a REUSE count (1-ram fakes
  // from villages already sending a real off), so they consume no offs and send no escorts.
  const realTargets = offTargets.filter(tg => tg.type !== 'fake');
  const escortOffs = realTargets.reduce((s, tg) =>
    s + (tg.snobMode === 'escorted' ? targetTrainSpec(tg).length : 0), 0);
  const ignoreCoords = parseOffIgnoreSet();
  const ignorePl = new Set(offIgnorePlayers);
  // Villages the Enemy Tribes filter holds home are unavailable exactly like ignored ones, so
  // they come out of the pool here too — otherwise this footer promises offs that Generate
  // will not assign. Same set generatePlan uses, so the two can't disagree. A village that is
  // BOTH ignored and enemy-adjacent counts once, under `ign` (the order plan.js's stats use).
  const enemyExcl = offEnemyExcludedCoords();
  const stat = { complete: { total: 0, ign: 0, enemy: 0 }, tq: { total: 0, ign: 0, enemy: 0 }, half: { total: 0, ign: 0, enemy: 0 } };
  for (const v of villages) {
    const s = stat[getOffTier(v.offPow)];
    if (!s) continue;
    s.total++;
    if (ignoreCoords.has(v.coord) || ignorePl.has(v.player)) s.ign++;
    else if (enemyExcl.has(v.coord)) s.enemy++;
  }
  const tierMeta = [['complete', 'badge-complete', 'th_complete'], ['tq', 'badge-tq', 'th_tq'], ['half', 'badge-half', 'th_half']];
  let ignTotal = 0, enemyTotal = 0;
  const parts = tierMeta.map(([tier, cls, label]) => {
    // Summed across EVERY window group: a village can only send one off, so a target asking
    // for 2 Completes on Friday and 2 more on Saturday really does cost 4 Completes.
    const used = realTargets.reduce((s, tg) => s + otTierTotal(tg, tier), 0) + (tier === 'complete' ? escortOffs : 0);
    const avail = stat[tier].total - stat[tier].ign - stat[tier].enemy;
    ignTotal += stat[tier].ign;
    enemyTotal += stat[tier].enemy;
    const usedHtml = used > avail ? `<span style="color:#e06040;">${used}</span>` : `${used}`;
    return `<span class="badge ${cls}">${t(label)}</span> ${usedHtml} / ${avail}`;
  });
  const notes = [];
  if (ignTotal > 0) notes.push(t('offs_ignored_note')(ignTotal));
  if (enemyTotal > 0) notes.push(t('offs_enemy_note')(enemyTotal));
  if (escortOffs > 0) notes.push(t('offs_escort_note')(escortOffs));
  const note = notes.length ? ` <span style="color:#806030;font-weight:400;">${notes.join(' ')}</span>` : '';
  el.innerHTML =
    `<button class="btn btn-ghost btn-sm" style="padding:1px 7px;margin-right:6px;" title="${esc(t('refresh_offs_title'))}" onclick="renderOtOffsSummary()">↻</button>`
    + `<span title="${esc(t('offs_summary_title'))}">${t('offs_assigned_label')} ${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}${note}</span>`;
}

function renderOffTargets() {
  offTargets.forEach(normalizeOffTarget);
  renderOffWindowGroups();
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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="20">${t('empty_no_targets')}</td></tr>`;
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
  const multiGroup = otMultiGroup(); // hoisted: every row asks, and the answer can't change mid-render
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
    // With several groups a pin has to say WHICH wave it sends in, so each tier row repeats
    // per group the row actually attacks in (otActiveGroups) — pinning a sender to a wave this
    // target isn't part of would be a pin that can never fire. The group letter is only shown
    // when there is more than one, so a single-wave plan looks exactly as it always did.
    const offSenderCell = Object.keys(players).length
      ? ['complete', 'tq', 'half'].map(tier =>
          otActiveGroups(tg).map(g => {
            const tierChips = tg.offAssignees.map((a, j) => (a.tier !== tier || a.group !== g.id) ? '' :
              `<span class="chip">${esc(decode(a.name))} ×<input type="number" min="0" value="${a.count || 0}" title="${esc(t('off_count_title'))}" style="width:30px;background:transparent;border:none;border-bottom:1px solid #7a5c10;color:inherit;font-size:11px;text-align:center;" onchange="updOffCount(${tg.id},${j},this.value)"><span class="chip-x" onclick="removeOffAssignee(${tg.id},${j})">✕</span></span>`).join('');
            const picker = tierHasSenders[tier]
              ? `<select class="cell-input" style="width:104px;" onfocus="otFillPicker(this,'${tier}')" onmousedown="otFillPicker(this,'${tier}')" onchange="addOffAssignee(${tg.id},${g.id},'${tier}',this.value)">
                   <option value="">${t('opt_pick_sender')}</option>
                 </select>`
              : `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
            const gTag = multiGroup ? `<span class="badge" style="font-size:9px;padding:0 4px;background:#2a1e08;color:#c8a060;">${esc(otLabelOf(g.id))}</span>` : '';
            return `<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:1px 0;">
                      <span class="badge ${TIER_BADGE_CLS[tier]}" style="font-size:9px;padding:0 4px;">${t(TIER_TH[tier])}</span>${gTag}${picker}${tierChips}
                    </div>`;
          }).join('')).join('')
      : `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    const isFakeTg = tg.type === 'fake';
    // Off Windows column: read-only, one line per group this target attacks in — the windows
    // themselves are edited once, up in the Window Groups editor, not per row.
    const offWinCell = otActiveGroups(tg).map(g =>
      `<div style="display:flex;gap:4px;align-items:center;justify-content:center;margin:1px 0;white-space:nowrap;">
        ${multiGroup ? `<span class="badge" style="font-size:9px;padding:0 4px;background:#2a1e08;color:#c8a060;">${esc(otLabelOf(g.id))}</span>` : ''}
        <span class="mono" style="font-size:11px;color:#c8a060;">${esc(fmtWindow(g.winOff) || '—')}</span>
        ${multiGroup ? `<span style="font-size:10px;color:#806030;">${esc(groupDateLabel(g))}</span>` : ''}
      </div>`).join('');
    // Snob Window column: the picker for this target's PRIMARY group — the wave its noble train
    // lands in. Shown as a plain window read-out while there is only one group to choose from.
    const primary = otGroupById(otPrimaryGroupId(tg));
    const snobWinCell = multiGroup
      ? `<select class="cell-input" style="width:150px;" title="${esc(t('snob_group_title'))}" onchange="updOTGroup(${tg.id},this.value)">${otGroupOptionsHtml(primary.id)}</select>
         <div class="mono" style="font-size:11px;color:#c8a060;margin-top:2px;">${esc(fmtWindow(primary.winSnob) || '—')}</div>`
      : `<span class="mono" style="font-size:11px;color:#c8a060;">${esc(fmtWindow(primary.winSnob) || '—')}</span>`;
    // One number input per group in each tier cell. Single group → a bare input, exactly the
    // pre-v5.9 cell; several → a letter-tagged input per group, stacked.
    const tierCell = (tier) => otGroups().map(g =>
      `<div style="display:flex;gap:3px;align-items:center;justify-content:center;">
        ${multiGroup ? `<span class="badge" style="font-size:9px;padding:0 4px;background:#2a1e08;color:#c8a060;" title="${esc(groupDateLabel(g))}">${esc(otLabelOf(g.id))}</span>` : ''}
        <input type="number" min="0" class="cell-input num" value="${otTierCount(tg, g.id, tier)}"${isFakeTg && tier === 'complete' ? ` title="${esc(t('fake_count_title'))}"` : ''} onchange="updOTGroupCount(${tg.id},${g.id},'${tier}',this.value)">
      </div>`).join('');
    const sel = otSelected.has(tg.id);
    // FAKE rows use the type, coord, Complete (= number of 1-ram fakes) and Off Windows cells,
    // PLUS the noble-train cells (Snob Players / Nobles / Senders / Snob Mode / Snob Window) so a
    // fake target can also field a FAKE noble train (a bare decoy — mode defaults to 'fake'). The
    // remaining cells (other off tiers, POWER, catapults, off senders, Catapult Mode) are ignored
    // by the plan for a fake target, so they render an inert dash (type changes go through mass edit).
    const dash = '<span class="num-zero">—</span>';
    return `
    <tr${sel ? ' class="ot-row-sel"' : ''}>
      <td><input type="checkbox" class="ot-sel"${sel ? ' checked' : ''} onchange="toggleOTSelect(${tg.id},this.checked,this)"></td>
      <td style="color:#806030;">${i + 1}</td>
      <td><span class="badge ttype-${tg.type}" title="${esc(t('ttype_title'))}">${t('ttype_' + tg.type)}</span></td>
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
      <td>${tierCell('complete')}</td>
      <td>${isFakeTg ? dash : tierCell('tq')}</td>
      <td>${isFakeTg ? dash : tierCell('half')}</td>
      <td title="${esc(t('ot_power_title'))}">${isFakeTg ? dash : `<label class="ot-power"><input type="checkbox" ${tg.power ? 'checked' : ''} onchange="setOTPower(${tg.id},this.checked)">⚡</label>`}</td>
      <td title="${esc(t('ot_catapult_title'))}">${isFakeTg ? dash : ''}<div style="display:${isFakeTg ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:3px;">
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
      <td class="left">${isFakeTg ? dash : `<div style="max-width:280px;">${offSenderCell}</div>`}</td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.snobPlayers}" onchange="updOT(${tg.id},'snobPlayers',this.value)"></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nobles}" onchange="updOT(${tg.id},'nobles',this.value)"></td>
      <td class="left"><div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;max-width:250px;">${chips}${senderPicker}</div></td>
      <td>
        <select class="cell-input" onchange="updOT(${tg.id},'snobMode',this.value)">
          <option value="escorted"${tg.snobMode === 'escorted' ? ' selected' : ''}>${t('opt_escort_yes')}</option>
          <option value="solo"${tg.snobMode === 'solo' ? ' selected' : ''}>${t('opt_escort_no')}</option>
          <option value="fake"${tg.snobMode === 'fake' ? ' selected' : ''}>${t('opt_escort_fake')}</option>
        </select>
      </td>
      <td title="${esc(t('catmode_title'))}">${isFakeTg ? dash : `
        <select class="cell-input" ${tg.power ? 'disabled' : ''} onchange="updCatMode(${tg.id},this.value)">
          ${CAT_MODE_KEYS.map(k => `<option value="${k}"${effectiveCatMode(tg) === k ? ' selected' : ''}>${esc(t('catb_' + k))}</option>`).join('')}
        </select>`}
      </td>
      <td>${offWinCell}</td>
      <td>${snobWinCell}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="delOffTarget(${tg.id})">✕</button></td>
    </tr>`;
  }).join('');
  syncOtSelAll();
  // Column visibility: refresh the panel labels (language switches re-render through here)
  // and re-stamp the hide rules — both idempotent and cheap.
  renderOtColVis();
  applyOtColVis();
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

