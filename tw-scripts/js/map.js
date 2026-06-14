// ══════════════════════════════════════════════════════════════
// MAP — pure geometry + data helpers (v2.0.0 Phase 1)
// ══════════════════════════════════════════════════════════════
// NO DOM / canvas access in this file. All rendering lives in map-render.js so
// the headless test harness (DOM-stubbed vm) can exercise this logic directly.
// Reads the already-loaded world DB globals (coordDb / villageDb / playerDb /
// allyDb / playerAllyDb / playerPointsDb) defined by the inline app script.

// The TW world is a fixed 0..999 integer grid. mapView maps world↔screen:
//   screen = world * scale + pan ;  world = (screen - pan) / scale
let mapView = { scale: 0.8, panX: 40, panY: 40 };

const MAP_WORLD = 1000;      // grid extent (coords 0..999)
const MAP_MIN_SCALE = 0.3;
const MAP_MAX_SCALE = 40;

function worldToScreen(x, y) {
  return { px: x * mapView.scale + mapView.panX, py: y * mapView.scale + mapView.panY };
}
function screenToWorld(px, py) {
  return { x: (px - mapView.panX) / mapView.scale, y: (py - mapView.panY) / mapView.scale };
}

// Set scale+pan so the whole 0..1000 world fits centered in a w×h canvas.
function fitMapView(w, h) {
  const s = Math.min(w, h) / MAP_WORLD;
  mapView.scale = s;
  mapView.panX = (w - MAP_WORLD * s) / 2;
  mapView.panY = (h - MAP_WORLD * s) / 2;
  return mapView;
}

function clampMapScale(s) { return Math.max(MAP_MIN_SCALE, Math.min(MAP_MAX_SCALE, s)); }

// Continent label, e.g. (523,487) → "K45".
function continentOf(x, y) {
  const k = Math.floor(y / 100) * 10 + Math.floor(x / 100);
  return 'K' + String(k).padStart(2, '0');
}

// Hit-test: a pixel resolves to the village on the nearest integer coord, if any.
// Villages are ≤1 per integer coord, so this is exact and O(1) — no spatial index.
function villageAtPixel(px, py) {
  const w = screenToWorld(px, py);
  const x = Math.round(w.x), y = Math.round(w.y);
  if (x < 0 || y < 0 || x >= MAP_WORLD || y >= MAP_WORLD) return null;
  const coord = x + '|' + y;
  return (typeof coordDb !== 'undefined' && coordDb[coord]) ? coord : null;
}

// Constant screen-pixel dot size by points (stays visible when zoomed out).
function mapDotSize(points) {
  if (points >= 1000000) return 5;
  if (points >= 500000)  return 4;
  if (points >= 150000)  return 3;
  return 2;
}

// Village graphic tier 1..6 by points → picks the map_new sprite (v1-v6 / b1-b6).
// First-pass breakpoints tuned to the es100 point spread; purely visual, easy to retune.
const MAP_TIER_BREAKS = [200, 1000, 3000, 6000, 9000];
function mapVillageTier(points) {
  let tier = 1;
  for (const b of MAP_TIER_BREAKS) { if (points > b) tier++; else break; }
  return tier;
}
// Sprite key for a village: bonus villages use the b* "shine" sprites, all others
// the regular v* sprites; tier 1..6 by points. `v.bonus` (1..9) comes from village.txt's
// 7th column (0 = none); see MAP_BONUS for the type mapping.
function mapSpriteKey(v) {
  return (v.bonus ? 'b' : 'v') + mapVillageTier(v.points);
}

// Bonus-village type (village.txt 7th column) → i18n key. es100 mapping confirmed by the user.
const MAP_BONUS = {
  1: 'bonus_wood', 2: 'bonus_clay', 3: 'bonus_iron', 4: 'bonus_pop', 5: 'bonus_barracks',
  6: 'bonus_stable', 7: 'bonus_workshop', 8: 'bonus_all', 9: 'bonus_storage',
};
function bonusLabel(id) { const k = MAP_BONUS[id]; return k ? t(k) : ''; }

// ── Phase 2: coloring + tribe legend (pure, harness-tested) ──────────────────
// Color the village dots by tribe / player / points so tribes can be picked out
// at overview zoom. Sprite (close) zoom keeps the realistic terrain art — coloring
// is an overview-zoom feature; the render shell only dims sprites for highlight/filter.

// Distinct, saturated palette cycled by a stable hash of the ally/player id, so the
// same tribe always gets the same color across renders (stability is tested).
const MAP_PALETTE = [
  '#e6194b','#3cb44b','#4363d8','#f58231','#911eb4','#42d4f4','#f032e6',
  '#bfef45','#fa8072','#469990','#c8a2ff','#9a6324','#d8c23a','#a05028',
  '#7fd6a0','#9aa000','#e0843a','#5878d8','#d04fa0','#52b0c0',
];
const MAP_COLOR_BARB    = '#5a4a2a';  // barbarian / abandoned
const MAP_COLOR_OWNED   = '#e0b04a';  // owned but no tribe, and the "none" color mode
const MAP_COLOR_NEUTRAL = '#c8a85a';

// FNV-1a → non-negative int; deterministic across runs (no Math.random / Date).
function mapHash(str) {
  let h = 2166136261;
  str = String(str);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mapPaletteColor(key) { return MAP_PALETTE[mapHash(key) % MAP_PALETTE.length]; }

// Points → green→amber→red ramp (visual buckets, easy to retune). Endpoints tested.
function mapPointsColor(points) {
  if (points >= 9000) return '#e0403a';
  if (points >= 6000) return '#e07a30';
  if (points >= 3000) return '#e0b040';
  if (points >= 1000) return '#b0c040';
  return '#6cc070';
}

// Single source of truth for a village's fill color in dot mode.
// modes: 'tribe' (default) | 'player' | 'points' | 'none'.
function colorForVillage(v, mode) {
  if (!v) return MAP_COLOR_NEUTRAL;
  const barb = !v.playerId || v.playerId === '0';
  switch (mode) {
    case 'player':
      return barb ? MAP_COLOR_BARB : mapPaletteColor('p' + v.playerId);
    case 'points':
      return mapPointsColor(v.points);
    case 'none':
      return barb ? MAP_COLOR_BARB : MAP_COLOR_OWNED;
    case 'tribe':
    default: {
      if (barb) return MAP_COLOR_BARB;
      const ally = (typeof playerAllyDb !== 'undefined') ? playerAllyDb[v.playerId] : null;
      return ally ? mapPaletteColor('a' + ally) : MAP_COLOR_OWNED; // tribeless owned = gold
    }
  }
}

// Tribes present in the world DB, with village counts, sorted by count desc.
// Drives the legend / tribe-highlight panel. Pure: reads villageDb/playerAllyDb/allyDb.
function mapTribeList() {
  if (typeof villageDb === 'undefined') return [];
  const counts = {};
  for (const v of villageDb) {
    const ally = playerAllyDb[v.playerId];
    if (!ally) continue; // barbarian / tribeless
    counts[ally] = (counts[ally] || 0) + 1;
  }
  return Object.keys(counts).map(a => {
    const info = (typeof allyDb !== 'undefined' && allyDb[a]) || {};
    return { allyId: a, tag: info.tag || ('#' + a), name: info.name || '', count: counts[a], color: mapPaletteColor('a' + a) };
  }).sort((x, y) => y.count - x.count || (x.tag < y.tag ? -1 : 1));
}

// Tooltip HTML for a village coord. Pure: reads the loaded DB; names are already
// decoded (decodeName at parse time), so no decode here — just esc for safety.
function villageTooltipHtml(coord) {
  const v = coordDb[coord];
  if (!v) return '';
  const barb = isBarbarian(coord);
  const playerName = barb ? t('map_barbarian') : (playerDb[v.playerId] || '—');
  const tag = barb ? '' : dbTribeTag(v);
  const totalPts = playerPointsDb[v.playerId] || 0;
  const row = (label, val) =>
    `<div class="map-tt-row"><span class="map-tt-k">${label}</span><span class="map-tt-v">${val}</span></div>`;
  let html = `<div class="map-tt-title">${esc(v.name)} <span class="map-tt-coord">${coord}</span> <span class="map-tt-cont">${continentOf(v.x, v.y)}</span></div>`;
  html += row(t('map_tt_player'), esc(playerName));
  if (tag) html += row(t('map_tt_tribe'), esc(tag));
  html += row(t('map_tt_points'), v.points.toLocaleString() + ' ' + t('map_pts'));
  if (!barb) html += row(t('map_tt_total'), totalPts.toLocaleString() + ' ' + t('map_pts'));
  if (v.bonus) html += row(t('map_tt_bonus'), `<span class="map-tt-bonus">${esc(bonusLabel(v.bonus))}</span>`);
  return html;
}
