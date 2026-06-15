// ══════════════════════════════════════════════════════════════
// MAP — pure geometry + data helpers (v2.0.0 Phase 1)
// ══════════════════════════════════════════════════════════════
// NO DOM / canvas access in this file. All rendering lives in map-render.js so
// the headless test harness (DOM-stubbed vm) can exercise this logic directly.
// Reads the already-loaded world DB globals (coordDb / villageDb / playerDb /
// allyDb / playerAllyDb / playerPointsDb) defined by the inline app script.

// The TW world is a fixed 0..999 integer grid. mapView maps world↔screen.
// `mapView.scale` is the canonical HORIZONTAL scale; the vertical scale is DERIVED
// (mapScaleY = scale · mapYRatio()).  The vertical:horizontal aspect depends on zoom:
//   • Zoomed OUT (dot mode, scale < MAP_SPRITE_MIN_SCALE) → ratio 1 (true SQUARE), so the
//     overview keeps the world's real circular shape instead of looking flattened.
//   • Zoomed IN (sprite mode) → ratio 38/53, the native aspect of the in-game 53×38 tile
//     (TWMap.tileSize), so the sprites tile edge-to-edge both ways like the real map.
// The aspect switch is keyed to the SAME threshold as the dot→sprite switch, so it flips
// exactly when the .png sprites start rendering (a small vertical "snap" there is intended).
//   px = x*scale + panX ;  py = y*scaleY + panY
let mapView = { scale: 0.8, panX: 40, panY: 40 };

const MAP_WORLD = 1000;          // grid extent (coords 0..999)
const MAP_MIN_SCALE = 0.3;
const MAP_MAX_SCALE = 80;        // allow a couple more zoom-in steps (was 40)
const MAP_SPRITE_MIN_SCALE = 12; // ≥ this scale → sprite mode + the squished (38/53) view
const MAP_Y_RATIO = 38 / 53;     // sprite-mode vertical:horizontal aspect (in-game tile 53×38)

// Vertical:horizontal ratio for the CURRENT zoom (square when zoomed out, 38/53 in sprite mode).
function mapYRatio() { return mapView.scale >= MAP_SPRITE_MIN_SCALE ? MAP_Y_RATIO : 1; }
function mapScaleY() { return mapView.scale * mapYRatio(); }
function worldToScreen(x, y) {
  return { px: x * mapView.scale + mapView.panX, py: y * mapScaleY() + mapView.panY };
}
function screenToWorld(px, py) {
  return { x: (px - mapView.panX) / mapView.scale, y: (py - mapView.panY) / mapScaleY() };
}

// Min/max occupied coords across the loaded villages (null when none). Pure.
function villageBounds() {
  if (typeof villageDb === 'undefined' || !villageDb.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of villageDb) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
  }
  return { minX, maxX, minY, maxY };
}

// Default / "Reset view": frame the actual village cloud so the northernmost village sits at
// the top and the southernmost at the bottom (not the empty 0..999 grid). Centers the village
// bounding box and fits it to the canvas. This is always a zoomed-out overview → SQUARE aspect
// (ratio 1), so the cloud keeps its real circular shape. Falls back to the full grid if no DB.
function fitMapView(w, h) {
  const pad = 8;
  const b = villageBounds();
  const minX = b ? b.minX : 0, maxX = b ? b.maxX : MAP_WORLD;
  const minY = b ? b.minY : 0, maxY = b ? b.maxY : MAP_WORLD;
  const wWorld = (maxX - minX) || 1, hWorld = (maxY - minY) || 1;
  // ratio 1 here (overview is below MAP_SPRITE_MIN_SCALE); clamp keeps us in range
  const s = clampMapScale(Math.min((w - 2 * pad) / wWorld, (h - 2 * pad) / hWorld));
  mapView.scale = s;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  mapView.panX = w / 2 - cx * mapView.scale;
  mapView.panY = h / 2 - cy * mapScaleY();
  return mapView;
}

function clampMapScale(s) { return Math.max(MAP_MIN_SCALE, Math.min(MAP_MAX_SCALE, s)); }

// Dot-mode square (zoomed out): fill the village's field so adjacent villages tile
// edge-to-edge and colors read as solid blocks from a distance. Dot mode always runs at the
// SQUARE aspect (ratio 1), so width = height = the field size; a small minimum keeps a lone
// village visible at extreme zoom-out. Pure (harness-tested).
function mapDotRectSize(scaleX) {
  const s = Math.max(2, scaleX);
  return { dw: s, dh: s };
}

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
// Breakpoints = the upper bound of each tier (user-set 2026-06-15):
//   t1 ≤299 · t2 300-999 · t3 1000-2999 · t4 3000-8999 · t5 9000-10999 · t6 11000+
const MAP_TIER_BREAKS = [299, 999, 2999, 8999, 10999];
function mapVillageTier(points) {
  let tier = 1;
  for (const b of MAP_TIER_BREAKS) { if (points > b) tier++; else break; }
  return tier;
}
// Sprite key for a village: prefix b* (bonus, "shine") / v* (regular), tier 1..6 by
// points, and a `_left` suffix for BARBARIAN villages (the abandoned-village art).
// So an owned bonus village of tier 4 = b4; a barbarian regular tier 3 = v3_left;
// a barbarian bonus tier 1 = b1_left. `v.bonus` (1..9) is village.txt's 7th column.
function mapSpriteKey(v) {
  const barb = !v.playerId || v.playerId === '0';
  return (v.bonus ? 'b' : 'v') + mapVillageTier(v.points) + (barb ? '_left' : '');
}

// Bonus-village type (village.txt 7th column) → i18n key. es100 mapping confirmed by the user.
const MAP_BONUS = {
  1: 'bonus_wood', 2: 'bonus_clay', 3: 'bonus_iron', 4: 'bonus_pop', 5: 'bonus_barracks',
  6: 'bonus_stable', 7: 'bonus_workshop', 8: 'bonus_all', 9: 'bonus_storage',
};
function bonusLabel(id) { const k = MAP_BONUS[id]; return k ? t(k) : ''; }

// ── Phase 2: coloring + custom color groups (pure, harness-tested) ────────────
// Default scheme: barbarians grey, all other players brown, and the villages of
// YOUR tribe (auto-detected from the loaded tribe-troop file) blue. On top of that,
// the user defines named "color groups" — each a color plus a set of members
// (individual coords, players, or tribe tags) — which override the defaults.
// Sprite (close) zoom keeps the realistic terrain art; coloring is an overview-zoom
// feature, so the render shell only dims sprites for the bonus filter.

const MAP_COLOR_BARB  = '#8d8d8d';  // barbarian / abandoned → grey
const MAP_COLOR_OWNED = '#a06a2c';  // any other player → brown
const MAP_COLOR_MINE  = '#3f7fe0';  // default colour of the auto-seeded "My tribe" group

// ── "My tribe" auto-detection (from the loaded tribe-troop file `villages[]`) ──
// The troop file lists my tribemates' villages by coord (no ids). Join coord→DB to find
// the dominant ally = my tribe; the render shell seeds an editable "My tribe" color group
// with that tribe's tag (see seedMineGroup). Detection only identifies which tribe — the
// actual blue colouring then flows through the normal custom-group path, so the user can
// add/remove tribes (e.g. a multi-tribe alliance) or recolour it like any other group.
let myAllyId = null;             // dominant allyId among troop-file villages (or null)
function detectMyTribe() {
  myAllyId = null;
  if (typeof villages === 'undefined' || !villages.length) return;
  const allyCount = {};
  for (const tv of villages) {
    if (!tv.coord) continue;
    const dbv = (typeof coordDb !== 'undefined') ? coordDb[tv.coord] : null;
    if (!dbv) continue;
    const a = (typeof playerAllyDb !== 'undefined') ? playerAllyDb[dbv.playerId] : null;
    if (a) allyCount[a] = (allyCount[a] || 0) + 1;
  }
  let best = null, bestN = 0;
  for (const a in allyCount) if (allyCount[a] > bestN) { bestN = allyCount[a]; best = a; }
  myAllyId = best;
}

// ── Custom color groups ──
// mapGroups: [{ id, name, color, coords:[], players:[], tribes:[] }] (persisted in prefs).
// For speed (re-coloured every pan frame over 12k villages) we precompute lowercase
// lookup maps once via rebuildGroupIndex(); colorForVillage reads the index, not the
// raw arrays. Precedence within the index = coord > player > tribe; first group wins.
let mapGroups = [];
let mapGroupIndex = { coords: {}, playersLc: {}, tribesLc: {} };
function rebuildGroupIndex() {
  const ix = { coords: {}, playersLc: {}, tribesLc: {} };
  for (const g of mapGroups) {
    (g.coords  || []).forEach(c  => { if (ix.coords[c]            == null) ix.coords[c]            = g.color; });
    (g.players || []).forEach(p  => { const k = String(p).toLowerCase();  if (ix.playersLc[k] == null) ix.playersLc[k] = g.color; });
    (g.tribes  || []).forEach(tt => { const k = String(tt).toLowerCase(); if (ix.tribesLc[k]  == null) ix.tribesLc[k]  = g.color; });
  }
  mapGroupIndex = ix;
}

// Single source of truth for a village's fill colour: custom group (coord→player→tribe,
// which includes the auto-seeded "My tribe" group) → barbarian grey → other player brown.
function colorForVillage(v) {
  if (!v) return MAP_COLOR_OWNED;
  const coord = v.x + '|' + v.y;
  if (mapGroupIndex.coords[coord] != null) return mapGroupIndex.coords[coord];
  const pname = (typeof playerDb !== 'undefined' && playerDb[v.playerId]) || '';
  if (pname && mapGroupIndex.playersLc[pname.toLowerCase()] != null) return mapGroupIndex.playersLc[pname.toLowerCase()];
  const tag = (typeof dbTribeTag === 'function') ? dbTribeTag(v) : '';
  if (tag && mapGroupIndex.tribesLc[tag.toLowerCase()] != null) return mapGroupIndex.tribesLc[tag.toLowerCase()];
  return (!v.playerId || v.playerId === '0') ? MAP_COLOR_BARB : MAP_COLOR_OWNED;
}

// Is a village coloured by a custom group (used to decide whether to draw the
// zoomed-in color circle for non-barbarian villages)? Pure: reads mapGroupIndex.
function villageGroupColor(v) {
  if (!v) return null;
  const coord = v.x + '|' + v.y;
  if (mapGroupIndex.coords[coord] != null) return mapGroupIndex.coords[coord];
  const pname = (typeof playerDb !== 'undefined' && playerDb[v.playerId]) || '';
  if (pname && mapGroupIndex.playersLc[pname.toLowerCase()] != null) return mapGroupIndex.playersLc[pname.toLowerCase()];
  const tag = (typeof dbTribeTag === 'function') ? dbTribeTag(v) : '';
  if (tag && mapGroupIndex.tribesLc[tag.toLowerCase()] != null) return mapGroupIndex.tribesLc[tag.toLowerCase()];
  return null;
}

// Classify a user-typed group-member token: a coord (x|y), a known tribe tag, else a player.
function classifyGroupToken(tok) {
  tok = String(tok || '').trim();
  if (!tok) return null;
  if (/^\d{1,3}\|\d{1,3}$/.test(tok)) return { type: 'coords', val: tok };
  if (typeof allyDb !== 'undefined') {
    for (const a in allyDb) {
      if (allyDb[a].tag && allyDb[a].tag.toLowerCase() === tok.toLowerCase()) return { type: 'tribes', val: allyDb[a].tag };
    }
  }
  return { type: 'players', val: tok };
}

// Tribes present in the world DB, with village counts, sorted by count desc.
// Feeds a tribe-tag suggestion list for the group editor. Pure.
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
    return { allyId: a, tag: info.tag || ('#' + a), name: info.name || '', count: counts[a] };
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
  html += troopTooltipHtml(coord); // our tribe's loaded troops, if any
  return html;
}

// ── Phase 3: loaded-troop overlay (from the tribe info.txt → troopByCoord) ──────
// troopByCoord (built in parseData) maps 'x|y' → the parsed troop row. These are pure
// reads of that global, so the harness can exercise them by setting troopByCoord.

// Troop block appended to the hover tooltip when we have this village's troops loaded:
// off power, total def, and the per-unit counts (with icons when twIcon is available).
function troopTooltipHtml(coord) {
  const tt = (typeof troopByCoord !== 'undefined') ? troopByCoord[coord] : null;
  if (!tt) return '';
  const ic = (typeof twIcon === 'function') ? twIcon : () => '';
  const totalDef = (tt.defInf || 0) + (tt.defCav || 0);
  const units = (typeof UNITS !== 'undefined' ? UNITS : []).filter(u => (tt[u] || 0) > 0);
  let h = `<div class="map-tt-troops"><div class="map-tt-troops-h">${t('map_tt_troops')}</div>`;
  h += `<div class="map-tt-row"><span class="map-tt-k">${ic('off')}${t('map_tt_off')}</span><span class="map-tt-v">${(tt.offPow || 0).toLocaleString()}</span></div>`;
  h += `<div class="map-tt-row"><span class="map-tt-k">${ic('def')}${t('map_tt_def')}</span><span class="map-tt-v">${totalDef.toLocaleString()}</span></div>`;
  if (units.length)
    h += `<div class="map-tt-units">` + units.map(u => `<span class="map-tt-unit">${ic(u)}${tt[u].toLocaleString()}</span>`).join('') + `</div>`;
  return h + `</div>`;
}

// Off/def/snob classification for the zoomed-in village badges. Returns null when we
// have no troop data for the coord. offdef is mutually exclusive (off OR def); snob is
// independent. 'mixed' troop villages fall to whichever power dominates. Pure.
function villageTroopBadge(coord) {
  const tt = (typeof troopByCoord !== 'undefined') ? troopByCoord[coord] : null;
  if (!tt) return null;
  let offdef = null;
  if (tt.type === 'off') offdef = 'off';
  else if (tt.type === 'def') offdef = 'def';
  else if (tt.type === 'mixed') offdef = (tt.offPow || 0) >= ((tt.defInf || 0) + (tt.defCav || 0)) ? 'off' : 'def';
  return { offdef, snob: (tt.snob || 0) > 0 };
}

// Selected map coords → newline-joined 'x|y' string (row-major sorted, stable) for the
// Extract Coordinates button. Output pastes straight into Offensive Targets / the planner.
function extractCoords(coords) {
  const arr = Array.from(coords || []);
  arr.sort((a, b) => {
    const pa = String(a).split('|').map(Number), pb = String(b).split('|').map(Number);
    return (pa[1] - pb[1]) || (pa[0] - pb[0]);
  });
  return arr.join('\n');
}

// ── Barb Finder (pure, harness-tested) ───────────────────────────────────────
// Pick a loaded tribe-troop player who owns snobs, then rank barbarian villages by how
// close they are to that player's nearest snob village (= fastest to conquer). Reads the
// troop globals (`players` from the troop file) + `villageDb` (world map). Optional bonus
// filter (all / bonus-only / no-bonus) + a bonus-type narrow (0 = any) using MAP_BONUS ids.

// Loaded troop-file players that own at least one snob-bearing village, sorted A→Z.
function playersWithSnobs() {
  if (typeof players === 'undefined') return [];
  return Object.keys(players)
    .filter(name => players[name].villages.some(v => (v.snob || 0) > 0))
    .sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);
}

// A player's snob-bearing villages as {coord, x, y, snob} (coords parsed from the troop row).
function snobVillagesOf(playerName) {
  const p = (typeof players !== 'undefined') ? players[playerName] : null;
  if (!p) return [];
  const out = [];
  for (const v of p.villages) {
    if ((v.snob || 0) <= 0) continue;
    const c = parseCoordStr(v.coord);
    if (c) out.push({ coord: v.coord, x: c.x, y: c.y, snob: v.snob });
  }
  return out;
}

// Barbarian villages ranked by smallest distance to any of the player's snob villages.
// bonusMode: 'all' | 'bonus' | 'nobonus'. bonusType: 0 = any bonus, else a MAP_BONUS id
// (only applied when bonusMode === 'bonus'). Returns ascending-by-distance
// [{coord, x, y, points, bonus, dist, fromCoord}], capped at `limit` (0/undefined = all).
function barbFinderResults(playerName, bonusMode, bonusType, limit) {
  const snobVils = snobVillagesOf(playerName);
  if (!snobVils.length || typeof villageDb === 'undefined') return [];
  bonusMode = bonusMode || 'all';
  bonusType = parseInt(bonusType) || 0;
  const out = [];
  for (const v of villageDb) {
    if (v.playerId && v.playerId !== '0') continue;      // barbarians only
    if (bonusMode === 'bonus'   && !v.bonus) continue;
    if (bonusMode === 'nobonus' &&  v.bonus) continue;
    if (bonusMode === 'bonus'   && bonusType && v.bonus !== bonusType) continue;
    let best = Infinity, from = null;
    for (const s of snobVils) {
      const d = Math.sqrt((v.x - s.x) ** 2 + (v.y - s.y) ** 2);
      if (d < best) { best = d; from = s.coord; }
    }
    out.push({ coord: v.x + '|' + v.y, x: v.x, y: v.y, points: v.points, bonus: v.bonus, dist: best, fromCoord: from });
  }
  out.sort((a, b) => a.dist - b.dist);
  return limit ? out.slice(0, limit) : out;
}
