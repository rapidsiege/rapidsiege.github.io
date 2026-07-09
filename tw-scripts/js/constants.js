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

// A village is only eligible to be a reserved noble-launch village if it's an established
// village with a real garrison: at least this many points AND this much farm pop used by
// troops. (Points need the world DB; when it isn't loaded points are treated as unknown→ok.)
const RESERVE_MIN_POINTS = 4000;
const RESERVE_MIN_POP    = 4000;

// A snob target's assigned player will usually RECRUIT a noble rather than send an existing
// one, so the plan lists which of that player's villages sit within noble range of the
// objective and are big enough to plausibly hold an Academy. Villages at or below this many
// points are hidden (probably no Academy). Points need the world DB; unknown → shown.
const SNOB_RANGE_MIN_POINTS = 5000;

// When a tribeInfo v3 buildings/everything JSON is loaded, per-village Smithy level is the REAL
// signal for whether a village can launch a noble (the Academy — snob building — needs Smithy 20,
// and 19 is one level away → treated as ready-in-time per the user's rule). Villages at or below
// this Smithy level are never used as noble-launch / escort / recommended villages, nor listed as
// eligible snob senders. When the buildings JSON isn't loaded, smith is UNKNOWN → the legacy points
// heuristics (SNOB_RANGE_MIN_POINTS / RESERVE_MIN_POINTS) apply, so behaviour is unchanged.
const SNOB_SMITH_MIN = 19;

// Plan Defense: a village only sends support if it has at least this much farm pop in
// defensive troops (spear/sword/spy/heavy) — small garrisons are left alone. And every
// emitted support order carries at least this much farm pop, so a player's contribution
// is consolidated into a few meaningful trips rather than dribbled across many villages.
const DEF_SENDER_MIN_POP = 4000;
const DEF_MIN_PACKET_POP = 400;

// Plan Defense "Support Packs" mode: instead of Max Efficiency's real-pop packet floor
// (DEF_MIN_PACKET_POP with POP weights), each support order targets a minimum "farm size"
// using configurable per-unit farm weights — so orders come in chunky packs (e.g. ≥125 heavy
// at weight 4 / size 500) rather than many tiny ones. Weights mirror Overwatch's convention
// (heavy = 4, not its real 6). Spy defaults to its real pop (2). User-editable in the UI.
// `max` = 0 → unlimited (no per-order cap). When > 0 it's a SOFT ceiling on the farm size of a
// single origin→destination order: excess spills to the player's other villages, and is only
// exceeded when no eligible village has room left (coverage always wins).
const DP_PACK_DEFAULTS = { size: 500, max: 0, weights: { spear: 1, sword: 1, spy: 2, heavy: 4 } };

// Catapult target buildings offered in the Offensive Targets catapult cell, in display order.
// Values are the in-game building keys (the rally-point confirm-page <select name="building">
// option values), so they drop straight into the rally URL's &building= param. Labels are i18n
// (`catb_<key>`). Used by both offensive-targets.js (the picker) and plan.js (display + URL).
const CAT_BUILDING_KEYS = ['smith', 'farm', 'wood', 'stone', 'iron'];
// "Catapult Mode" column (per target): the building objective for the OFF SENDERS' attacks
// (clearing offs / destroyer offs / offs accompanying a noble) — distinct from CAT_BUILDING_KEYS
// (the extra def-sourced catapult attacks). Default 'smith'; POWER forces 'wall'.
const CAT_MODE_KEYS = ['smith', 'farm', 'wall'];
// Union of every building key that can appear as a row's target building (picker ∪ mode) — used
// to validate the label lookup (`catb_<key>`) and the rally URL's best-effort &building= param.
const BUILDING_TARGET_KEYS = ['smith', 'farm', 'wood', 'stone', 'iron', 'wall'];

// Base travel speed in minutes per field (at world speed 1, unit speed 1)
const UNIT_BASE_MIN = { spear:18, sword:22, axe:18, spy:9, light:10, heavy:11, ram:30, catapult:30, knight:10, snob:35 };
const TRAVEL_ICON = { spear:'🗡', sword:'⚔', axe:'🪓', spy:'🔍', light:'🏹', heavy:'🐴', ram:'🐏', catapult:'💣', knight:'🐴', snob:'👑' };

// Target tab modes: relevant power, unit-count columns, travel-time columns
const TARGET_MODES = {
  off: { power:'offPow', units:['axe','light','ram','catapult','snob'], travel:['light','axe','sword','ram','snob'] },
  def: { power:'defInf', units:['spear','sword','heavy','light','spy','knight'], travel:['spy','knight','light','heavy','spear','sword'] },
};
