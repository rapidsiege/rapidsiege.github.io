// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════
const UNITS = ['spear','sword','axe','spy','light','heavy','ram','catapult','knight','snob'];
const UNIT_LABELS = ['Spear','Sword','Axe','Spy','Light','Heavy','Ram','Cat','Knight','Snob'];

// Attack / Def-inf / Def-cav values (standard TW)
const ATT  = { spear:10,  sword:25,  axe:40,  spy:35,  light:130, heavy:150, ram:2,   catapult:100, knight:150, snob:30  };
const DINF = { spear:15,  sword:50,  axe:10,  spy:200, light:30,  heavy:200, ram:20,  catapult:100, knight:250, snob:100 };
const DCAV = { spear:45,  sword:25,  axe:10,  spy:200, light:40,  heavy:80,  ram:50,  catapult:50,  knight:400, snob:100 };

const UNIT_TYPE = { // off / def / misc
  spear:'def', sword:'def', axe:'off', spy:'misc',
  light:'off', heavy:'def', ram:'off', catapult:'misc',
  knight:'def', snob:'misc'
};

// Base travel speed in minutes per field (at world speed 1, unit speed 1)
const UNIT_BASE_MIN = { spear:18, sword:22, axe:18, spy:9, light:10, heavy:11, ram:30, catapult:30, knight:10, snob:35 };
const TRAVEL_ICON = { spear:'🗡', sword:'⚔', axe:'🪓', spy:'🔍', light:'🏹', heavy:'🐴', ram:'🐏', catapult:'💣', knight:'🐴', snob:'👑' };

// Target tab modes: relevant power, unit-count columns, travel-time columns
const TARGET_MODES = {
  off: { power:'offPow', units:['axe','light','ram','catapult','snob'], travel:['light','axe','sword','ram','snob'] },
  def: { power:'defInf', units:['spear','sword','heavy','light','spy','knight'], travel:['spy','knight','light','heavy','spear','sword'] },
};
