// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════
const UNITS = ['spear','sword','axe','spy','light','heavy','ram','catapult','knight','snob'];
const UNIT_LABELS = ['Spear','Sword','Axe','Spy','Light','Heavy','Ram','Cat','Knight','Snob'];

// Attack / Def-inf / Def-cav values (standard TW)
const ATT  = { spear:10,  sword:25,  axe:40,  spy:35,  light:130, heavy:150, ram:2,   catapult:100, knight:150, snob:30  };
const DINF = { spear:15,  sword:50,  axe:10,  spy:2,   light:30,  heavy:200, ram:20,  catapult:100, knight:250, snob:100 };
const DCAV = { spear:45,  sword:25,  axe:10,  spy:1,   light:40,  heavy:80,  ram:50,  catapult:50,  knight:400, snob:100 };

const UNIT_TYPE = { // off / def / misc
  spear:'def', sword:'def', axe:'off', spy:'misc',
  light:'off', heavy:'def', ram:'off', catapult:'misc',
  knight:'def', snob:'misc'
};

// Farm population (provisions) each unit uses — standard TW. Drives `popUsed` per village.
const POP = { spear:1, sword:1, axe:1, spy:2, light:4, heavy:6, ram:5, catapult:8, knight:10, snob:100 };

// ══════════════════════════════════════════════════════════════
// PARAMETERS (v6.0.0) — every tunable number the engines used to hardcode.
// ──────────────────────────────────────────────────────────────
// One registry (PARAM_DEFS, display order) drives the ⚙ Settings → 🎚 Parameters tab, the
// persistence (only values that differ from their default are saved under tw_tribe_settings
// `params`, so a future default change reaches users who never touched that knob) and every
// consumer, which reads `PARAMS.<key>` AT CALL TIME (never at parse time — the saved overrides
// only land after loadSettings()). Labels/tooltips are i18n: `p_<key>` / `pt_<key>`, sections
// `ps_<sec>`. Field notes:
//   sec   — section (PARAM_SECTIONS): each is shown on the central tab AND on the inline 🎚
//           panel of the tab it concerns (PARAM_PANELS in params.js).
//   type  — 'num' (default; integer unless `step` is fractional, clamped to min/max),
//           'bool' (checkbox) or 'select' (`opts` = allowed values, i18n `po_<key>_<opt>`).
//   unit  — i18n suffix key shown after the input (`pu_<unit>`), purely cosmetic.
const PARAM_DEFS = [
  // ── Offensive power tiers (moved here from the old Settings block) ──
  { key: 'tierComplete', sec: 'tiers', def: 500000, min: 0, step: 10000, unit: 'pow' },
  { key: 'tierTq',       sec: 'tiers', def: 350000, min: 0, step: 10000, unit: 'pow' },
  { key: 'tierHalf',     sec: 'tiers', def: 250000, min: 0, step: 10000, unit: 'pow' },
  // ── Plan Offensive ──
  // Destroyer targets: an off with ≥ this many catapults can serve as the clearing off.
  { key: 'catClearMin',        sec: 'off', def: 101,  min: 1, unit: 'cats' },
  // Extra catapult attacks: a cat source must be at least this many fields CLOSER to the
  // target than the farthest assigned off (cats are slow — keep them inside the off ring).
  { key: 'catOffLead',         sec: 'off', def: 8,    min: 0, unit: 'fields' },
  // At most this many catapult attacks from one source village at the SAME target.
  { key: 'catPerSourceMax',    sec: 'off', def: 2,    min: 1, unit: 'attacks' },
  // Number of extra catapult attacks when a target's catapult toggle first turns on (row
  // toggle, mass edit, and the destroyer auto-enable all share it).
  { key: 'catAttacksDefault',  sec: 'off', def: 3,    min: 0, unit: 'attacks' },
  // Noble train a new target asks for in its default group (also the mass-edit seed and the
  // Forum export legend fallback).
  { key: 'noblesDefault',      sec: 'off', def: 4,    min: 0, unit: 'nobles' },
  { key: 'snobPlayersDefault', sec: 'off', def: 0,    min: 0, unit: 'players' },
  // Villages held back per noble sender for launching nobles (closest to their targets).
  { key: 'reserveVillages',    sec: 'off', def: 2,    min: 0, unit: 'villages' },
  // A village is only eligible to be a reserved noble-launch village if it's an established
  // village with a real garrison: at least this many points AND this much farm pop used by
  // troops. (Points need the world DB; when it isn't loaded points are treated as unknown→ok.)
  { key: 'reserveMinPoints',   sec: 'off', def: 4000, min: 0, step: 100, unit: 'points' },
  { key: 'reserveMinPop',      sec: 'off', def: 4000, min: 0, step: 100, unit: 'pop' },
  // A snob target's assigned player will usually RECRUIT a noble rather than send an existing
  // one, so the plan lists which of that player's villages sit within noble range of the
  // objective and are big enough to plausibly hold an Academy. Villages at or below this many
  // points are hidden (probably no Academy). Points need the world DB; unknown → shown.
  { key: 'snobRangeMinPoints', sec: 'off', def: 5000, min: 0, step: 100, unit: 'points' },
  // When a tribeInfo v3 buildings/everything JSON is loaded, per-village Smithy level is the REAL
  // signal for whether a village can launch a noble (the Academy needs Smithy 20, and 19 is one
  // level away → treated as ready-in-time per the user's rule). Villages BELOW this Smithy level
  // are never used as noble-launch / escort / recommended villages, nor listed as eligible snob
  // senders. Unknown smith → the points heuristics above apply.
  { key: 'snobSmithMin',       sec: 'off', def: 19,   min: 0, max: 20, unit: 'level' },
  // Escorted trains prefer sender villages of at least this off tier ('none' = any village).
  { key: 'escortMinTier',      sec: 'off', def: 'half', type: 'select', opts: ['none', 'half', 'tq', 'complete'] },
  // A missing tier gets filled by a stronger one (half → 3/4 → Complete), never a weaker one.
  { key: 'tierBump',           sec: 'off', def: true, type: 'bool' },
  // ── Engine STRATEGY selects (v6.1.1): each decision the engine used to make silently is a
  // named option; the FIRST option of every list is today's behaviour and the default. ──
  // Weaker-tier fallback (auto pass): 'never' = a slot with no off of its tier (or stronger, see
  // tierBump) stays unassigned; 'whenEmpty' = fall back to the next weaker tier, normal score picks (warned).
  { key: 'tierBumpDown',       sec: 'off', def: 'never', type: 'select', opts: ['never', 'whenEmpty'] },
  // Destroyer targets — ranking INSIDE the qualifying set (offs with ≥ catClearMin catapults):
  // 'power' = the normal optimize score (today), 'catsFirst' = more catapults first, score breaks ties.
  { key: 'destroyerRank',      sec: 'off', def: 'power', type: 'select', opts: ['power', 'catsFirst'] },
  // Destroyer targets — when NO candidate reaches catClearMin: 'power' = the best regular off
  // (today), 'mostCats' = the off with the most catapults (≥ destroyerFallbackMinCats), 'unassigned'
  // = leave the slot open for the tribe to fill by hand (warned).
  { key: 'destroyerFallback',  sec: 'off', def: 'power', type: 'select', opts: ['power', 'mostCats', 'unassigned'] },
  { key: 'destroyerFallbackMinCats', sec: 'off', def: 0, min: 0, unit: 'cats' },
  // Split-off escort reservation: 'closest' = nearest eligible off, power breaks ties (today);
  // 'strongest' = most off power, distance breaks ties.
  { key: 'escortPick',         sec: 'off', def: 'closest', type: 'select', opts: ['closest', 'strongest'] },
  // Fakes: rams a village needs to send a fake (also the size preset in the rally link), the
  // minimum off tier of the villages reused for fakes, and how many fakes one village sends.
  { key: 'fakeRams',           sec: 'off', def: 1,    min: 0, unit: 'rams' },
  { key: 'fakeSourceTier',     sec: 'off', def: 'complete', type: 'select', opts: ['complete', 'tq', 'half'] },
  { key: 'fakesPerVillage',    sec: 'off', def: 1,    min: 1, unit: 'fakes' },
  // Fake source pool: 'offsThenEscorts' = villages already sending a real off, else escorts
  // (today); 'escortsThenOffs' = the reverse; 'any' = EVERY village with ≥ fakeRams rams, whatever
  // its tier and whether it sends a real off or not (closest first).
  { key: 'fakePool',           sec: 'off', def: 'offsThenEscorts', type: 'select', opts: ['offsThenEscorts', 'escortsThenOffs', 'any'] },
  // Extra catapult attacks — which def village sends the next one: 'playerSpread' = fewest attacks
  // per player first, then closest (today); 'closest'; 'mostCats' = most catapult attacks left.
  { key: 'catSpread',          sec: 'off', def: 'playerSpread', type: 'select', opts: ['playerSpread', 'closest', 'mostCats'] },
  // ⏰ Player Schedules (v6.1.2) — how the per-player preferred / blocked LAUNCH times (Offensive
  // Targets popup, player-schedules.js) steer the automatic picks (offs, fakes, catapult attacks,
  // escorts, noble senders): 'preferredThenBlocked' = a sender launching inside a preferred time
  // first, then anyone outside their blocked time, then a blocked launch (the plan always fills —
  // such rows get ⏰ + a warning); 'blockedOnly' = only avoid blocked times; 'off' = ignore them.
  // Inert while no player has a schedule.
  { key: 'scheduleMode',       sec: 'off', def: 'preferredThenBlocked', type: 'select', opts: ['preferredThenBlocked', 'blockedOnly', 'off'] },
  // Roster balance: the auto "optimize" score is damped by (1 − d) + d × remaining fraction of
  // the sender's roster, so already-used players slide down. 0 = off, 1 = strongest.
  { key: 'rosterDamping',      sec: 'off', def: 0.5,  min: 0, max: 1, step: 0.05 },
  // ── Plan Defense ──
  // Support may only go to villages of the SENDER'S OWN TRIBE (the es100 / es103 rule; the
  // pre-v6.0.3 behaviour). Off: any tribe may be supported, for worlds that allow cross-tribe
  // support. Tribes come from the world DB — without it every pair is allowed either way.
  { key: 'defSameTribeOnly',   sec: 'def', def: true, type: 'bool' },
  // Fill order of the sender pools (Complete → normal → snip far → snip near → snip over):
  // 'perPool' = each pool drains troops AT HOME then RETURNING before the next pool (today);
  // 'homeFirst' = every pool's troops at home first, returning troops of any pool only after.
  { key: 'defPoolOrder',       sec: 'def', def: 'perPool', type: 'select', opts: ['perPool', 'homeFirst'] },
  // A village only sends support if it has at least this much farm pop in defensive troops
  // (spear/sword/spy/heavy) — small garrisons are left alone. And every emitted support order
  // carries at least this much farm pop (Max Efficiency), so a player's contribution is
  // consolidated into a few meaningful trips rather than dribbled across many villages.
  { key: 'defSenderMinPop',    sec: 'def', def: 4000, min: 0, step: 100, unit: 'pop' },
  { key: 'defMinPacketPop',    sec: 'def', def: 400,  min: 1, step: 10, unit: 'pop' },
  // Spies add nothing to raw defense (they only screen against scouting), so every spy support
  // order tries to carry at least this many spies: allocation is concentrated onto few senders.
  { key: 'defSpyMinOrder',     sec: 'def', def: 50,   min: 0, unit: 'spies' },
  // Each village keeps this many spies HOME per ram it owns — they leave together later as
  // [spy+ram] fakes, so they are never assignable as support. 0 = no reserve.
  { key: 'spyPerRam',          sec: 'def', def: 1,    min: 0, step: 0.1 },
  // Snip Players defaults (the Plan Defense inputs start here; a saved plan keeps its own).
  { key: 'snipPctDefault',     sec: 'def', def: 35,   min: 0, max: 100, unit: 'pct' },
  { key: 'snipDistDefault',    sec: 'def', def: 100,  min: 0, unit: 'fields' },
  // Support Packs defaults: farm size per order, soft per-order ceiling (0 = unlimited) and
  // the per-unit farm weights (Overwatch convention: heavy = 4, not its real 6).
  { key: 'packSizeDefault',    sec: 'def', def: 500,  min: 1, unit: 'farm' },
  { key: 'packMaxDefault',     sec: 'def', def: 0,    min: 0, unit: 'farm' },
  { key: 'packWeightSpear',    sec: 'def', def: 1,    min: 0.1, step: 0.1 },
  { key: 'packWeightSword',    sec: 'def', def: 1,    min: 0.1, step: 0.1 },
  { key: 'packWeightSpy',      sec: 'def', def: 2,    min: 0.1, step: 0.1 },
  { key: 'packWeightHeavy',    sec: 'def', def: 4,    min: 0.1, step: 0.1 },
  // Bracket budget per in-game PM part (the game's limit is about 5,000; keep headroom).
  { key: 'pmMaxBrackets',      sec: 'def', def: 4500, min: 100, step: 100, unit: 'brackets' },
  // ── Manage Offensive / Manage Defense (the matchers) ──
  // An incoming attack with visible units, no noble, fewer than `moFakeMinCats` catapults and
  // total attack power below `moFakeMaxAtt` is a fake and is ignored by the matcher.
  { key: 'moFakeMaxAtt',       sec: 'manageoff', def: 1000, min: 0, step: 100, unit: 'pow' },
  { key: 'moFakeMinCats',      sec: 'manageoff', def: 5,    min: 0, unit: 'cats' },
  // A real incoming may land this many minutes outside the plan window and still count as in.
  { key: 'moWindowTol',        sec: 'manageoff', def: 0,    min: 0, unit: 'min' },
  // A plan row stays "pending" this many minutes past its latest launch moment before "missing".
  { key: 'moPendingGrace',     sec: 'manageoff', def: 0,    min: 0, unit: 'min' },
  // Manage Defense: a support order matches a plan row when every unit count is within this
  // many units of the planned amount (0 = exact), and it is "in time" when it lands at most
  // this many minutes after the target's deadline.
  { key: 'mdUnitTol',          sec: 'managedef', def: 0,    min: 0, unit: 'units' },
  { key: 'mdArrivalGrace',     sec: 'managedef', def: 0,    min: 0, unit: 'min' },
  // Which incoming order claims a plan slot first when several could: 'earliest' = earliest
  // arrival (today); 'closestAmount' = the order whose units are closest to a slot of that target.
  { key: 'mdSlotOrder',        sec: 'managedef', def: 'earliest', type: 'select', opts: ['earliest', 'closestAmount'] },
  // ── Overview / Outbound ──
  // Outbound Offs: a village counts as an off out when its own axe is ≥ this and at least this
  // share of that axe body is away.
  { key: 'outboundMinAxe',     sec: 'outbound', def: 2000, min: 0, step: 100, unit: 'axe' },
  { key: 'outboundFraction',   sec: 'outbound', def: 0.5,  min: 0, max: 1, step: 0.05 },
  // Village type: off when off units > ratio × def units, def when the reverse, else mixed.
  { key: 'typeRatio',          sec: 'overview', def: 2,    min: 1, step: 0.1 },
  // Unit counts at or above this are highlighted (bold) in the tables.
  { key: 'numHigh',            sec: 'overview', def: 2000, min: 0, step: 100, unit: 'units' },
  // ── Time ──
  // Safety margin: an off / support / Tribe Timings unit only "makes it" if it can leave at
  // least this many minutes from now (feasibility gates and the late flags).
  { key: 'departMargin',       sec: 'time', def: 0,    min: 0, unit: 'min' },
  // Server UTC offset used whenever the Settings value is blank or not a number.
  { key: 'serverUtcOffsetDefault', sec: 'time', def: 2, min: -12, max: 14, unit: 'hours' },
];
const PARAM_SECTIONS = ['tiers', 'overview', 'outbound', 'off', 'def', 'manageoff', 'managedef', 'time'];
const PARAM_BY_KEY   = Object.fromEntries(PARAM_DEFS.map(d => [d.key, d]));
const PARAM_DEFAULTS = Object.fromEntries(PARAM_DEFS.map(d => [d.key, d.def]));
let PARAMS = { ...PARAM_DEFAULTS }; // the live values — read at call time, never cached

// Validate a raw value against its definition → the stored value, or undefined when unusable
// (blank / NaN / unknown option). Numbers clamp to [min, max] and round unless `step` is fractional.
function paramCoerce(d, val) {
  if (!d) return undefined;
  if (d.type === 'bool') return typeof val === 'boolean' ? val : (val === 'true' ? true : val === 'false' ? false : undefined);
  if (d.type === 'select') return d.opts.includes(val) ? val : undefined;
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (!Number.isFinite(n)) return undefined;
  let x = n;
  if (d.min != null && x < d.min) x = d.min;
  if (d.max != null && x > d.max) x = d.max;
  if (d.step == null || Number.isInteger(d.step)) x = Math.round(x);
  else x = Math.round(x * 1000) / 1000;
  return x;
}
// Set one parameter from user input; an unusable value falls back to the default. Returns
// whether the value was accepted as given.
function paramSet(key, val) {
  const d = PARAM_BY_KEY[key];
  if (!d) return false;
  const v = paramCoerce(d, val);
  PARAMS[key] = v === undefined ? d.def : v;
  return v !== undefined;
}
function paramReset(key) { if (PARAM_BY_KEY[key]) PARAMS[key] = PARAM_BY_KEY[key].def; }
function paramsResetAll() { PARAMS = { ...PARAM_DEFAULTS }; }
function paramIsDefault(key) { return PARAM_BY_KEY[key] ? PARAMS[key] === PARAM_BY_KEY[key].def : true; }
// Apply a saved `params` object (unknown keys and unusable values are ignored, so a stale or
// corrupt save can never poison the live values).
function paramsApply(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    const v = paramCoerce(PARAM_BY_KEY[k], obj[k]);
    if (v !== undefined) PARAMS[k] = v;
  }
}
// Only the values that differ from their default — what saveSettings persists.
function paramsOverrides() {
  const o = {};
  for (const d of PARAM_DEFS) if (PARAMS[d.key] !== d.def) o[d.key] = PARAMS[d.key];
  return o;
}
// Off tier ≥ minimum tier (ranks: none 0 < half 1 < tq 2 < complete 3). TIER_RANK lives in
// offensive-targets.js (loads later), so resolve at call time.
function tierAtLeast(tier, minTier) {
  const r = (typeof TIER_RANK !== 'undefined') ? TIER_RANK : { complete: 3, tq: 2, half: 1, none: 0 };
  return (r[tier] || 0) >= (r[minTier] || 0);
}
// Server UTC offset: the Settings value, or the parameter default when blank / not a number.
function serverUtcOffset() {
  const off = (typeof otCfg !== 'undefined' && otCfg) ? parseFloat(otCfg.serverUtcOffset) : NaN;
  return isNaN(off) ? PARAMS.serverUtcOffsetDefault : off;
}
// Plan Defense defaults derived from the parameters (a saved defensive plan keeps its own values).
function defSnipDefaults() { return { pct: PARAMS.snipPctDefault, dist: PARAMS.snipDistDefault }; }
function dpPackDefaults() {
  return { size: PARAMS.packSizeDefault, max: PARAMS.packMaxDefault,
    weights: { spear: PARAMS.packWeightSpear, sword: PARAMS.packWeightSword, spy: PARAMS.packWeightSpy, heavy: PARAMS.packWeightHeavy } };
}

// Village Reports / map obscuring (v5.8.0, user decision 2026-08-06): report-derived intel
// about villages CURRENTLY owned by the active world's ally ids (es100: 13 = WC.. War Club,
// 27 = WC; es103: 1 and 20, added 2026-09-21 for the private es103 copy) is
// hidden from the direct lookups — the Village Reports table, the map badges/hover and the
// Ver-informe modal — so a leaked tool URL can't hand out the tribe's own data. Villages
// present in the LOCALLY processed reports store stay visible (the operator uploading their
// own files is not the leak scenario), and a protected player appearing inside ANOTHER
// village's report is deliberately not scrubbed. The tw-calc-uploads Worker enforces the
// same rule on the shared-DB endpoints themselves (the real gate; this is the UI layer).
const RI_PROTECTED_ALLIES_BY_WORLD = { es100: ['13', '27'], es103: ['1', '20'] };
// The active world's list. twWorld lives in db.js (loads later), so resolve at call time.
function riProtectedAllies() {
  const w = (typeof twWorld === 'string' && twWorld) ? twWorld : 'es100';
  return RI_PROTECTED_ALLIES_BY_WORLD[w] || [];
}

// Catapult target buildings offered in the Offensive Targets catapult cell, in display order.
// Values are the in-game building keys (the rally-point confirm-page <select name="building">
// option values), so they drop straight into the rally URL's &building= param. Labels are i18n
// (`catb_<key>`). Used by both offensive-targets.js (the picker) and plan.js (display + URL).
// v6.0.2: + Rally Point ('place') and Warehouse ('storage') in both this list and CAT_MODE_KEYS.
// v6.0.4: these two lists are now the DEFAULT selections of the 🏛 Buildings popup (Offensive
// Targets) — the live lists come from catBuildingKeys() / catModeKeys() in offensive-targets.js.
const CAT_BUILDING_KEYS = ['smith', 'farm', 'place', 'storage', 'wood', 'stone', 'iron'];
// "Catapult Mode" column (per target): the building objective for the OFF SENDERS' attacks
// (clearing offs / destroyer offs / offs accompanying a noble) — distinct from CAT_BUILDING_KEYS
// (the extra def-sourced catapult attacks). Default 'smith'; POWER forces 'wall'.
const CAT_MODE_KEYS = ['smith', 'farm', 'place', 'storage', 'wall'];
// v6.0.4: every building catapults can hit, in the game's own build-screen order — the candidates
// of the 🏛 Buildings popup and the validation set for a stored row value. Hiding Place and First
// Church are not catapultable (user, 2026-10-04) and are left out.
const BUILDING_KEYS_ALL = ['main', 'barracks', 'stable', 'garage', 'church', 'watchtower', 'snob', 'smith', 'place', 'statue', 'market', 'wood', 'stone', 'iron', 'farm', 'storage', 'wall'];
// Every building key that can appear as a row's target building — used to validate the label
// lookup (`catb_<key>`) and the rally URL's best-effort &building= param. Since v6.0.4 any
// catapultable building can be picked, so this is the full list (it used to be picker ∪ mode).
const BUILDING_TARGET_KEYS = BUILDING_KEYS_ALL;

// Target types (Offensive Targets, per row — badge `ttype_<key>`, style `.ttype-<key>`):
//   off       — a normal offensive target (clearing offs, optional nobles).
//   destroyer — flatten, don't take: off selection prefers cat-carrying offs (≥ PARAMS.catClearMin)
//               and the row defaults to PARAMS.catAttacksDefault extra catapult attacks.
//   fake      — 1-ram pretend attacks REUSING villages already sending a real off elsewhere
//               (the Complete column holds the number of fakes; see the fake pass in plan.js).
const TARGET_TYPES = ['off', 'destroyer', 'fake'];

// Base travel speed in minutes per field (at world speed 1, unit speed 1)
const UNIT_BASE_MIN = { spear:18, sword:22, axe:18, spy:9, light:10, heavy:11, ram:30, catapult:30, knight:10, snob:35 };
const TRAVEL_ICON = { spear:'🗡', sword:'⚔', axe:'🪓', spy:'🔍', light:'🏹', heavy:'🐴', ram:'🐏', catapult:'💣', knight:'🐴', snob:'👑' };

// Target tab modes: relevant power, unit-count columns, travel-time columns
const TARGET_MODES = {
  off: { power:'offPow', units:['axe','light','ram','catapult','snob'], travel:['light','axe','sword','ram','snob'] },
  def: { power:'defInf', units:['spear','sword','heavy','light','spy','knight'], travel:['spy','knight','light','heavy','spear','sword'] },
};
