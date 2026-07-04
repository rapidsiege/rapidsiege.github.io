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

// Point-in-polygon (Draw Coordinate Filter). Pure, WORLD-space: (x,y) and every vertex are
// TW grid coords (0..999), so this is pan/zoom-independent — the render aspect (mapYRatio /
// mapScaleY) must never enter here. Canonical half-open ray-casting (PNPOLY): even-odd rule,
// so winding order and self-intersections don't matter, and a vertex sitting exactly on the
// horizontal ray resolves consistently. Boundary/on-edge villages are NOT guaranteed "inside"
// (grid coords land on edges often) — a user who wants a border village included draws slightly
// wider. Fewer than 3 vertices → no area → returns false. `poly` = [{x,y}, …].
function pointInPolygon(x, y, poly) {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
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

// ── "My tribe(s)" auto-detection (from the loaded tribe-troop file `villages[]`) ──
// The troop file lists my tribemates' villages, each row tagged with its OWNER'S PLAYER
// NAME (col 1). We resolve EVERY ally present among those owners: we only ever have troop
// data for our OWN tribes, so all tribes in the file are "ours" (we run several). The render
// shell seeds an editable "My tribe" colour group with each of those tags (see seedMineGroup),
// and the cloud-sync filename uses the same set — detection only identifies the tribes; the
// blue colouring then flows through the normal custom-group path, so the user can add/remove
// tribes or recolour it like any other group.
//
// Resolution goes player NAME → playerId → allyId (via the world DB), NOT village coord →
// owner. Coord→owner reads the *stale* world-map snapshot, so a village we just CONQUERED
// still resolves to its previous (enemy) owner until the mirror refreshes — which polluted
// the my-tribe set (and the cloud filename) with enemy tags. The troop file's owner name is
// current by construction, so name-based resolution is conquest-proof. Names are matched
// through decodeName(): the troop export writes the player.txt name field with only `+`→space
// (leaving `%XX` escapes intact, e.g. Spanish "vakeri%C3%B1o"), while playerDb is already
// fully decoded — so we decode the troop side to line the two up (verified: all es100 names
// match). Falls back to no detection when the DB isn't loaded (nothing resolves) — the
// cloud-sync label then uses its own top-player fallback.
let myAllyIds = [];              // all distinct allyIds among troop-file owners (your tribes)
function detectMyTribe() {
  myAllyIds = [];
  if (typeof villages === 'undefined' || !villages.length) return;
  if (typeof playerDb === 'undefined' || typeof playerAllyDb === 'undefined') return;
  // Invert playerDb (id→name) into name→id. playerDb names are already decoded, so key on the
  // lowercased/trimmed name; first id wins (names are unique per world). Rebuilt per call —
  // detectMyTribe runs only on load / cloud push, so the scan is not hot.
  const idByName = {};
  for (const id in playerDb) {
    const nm = String(playerDb[id] || '').toLowerCase().trim();
    if (nm && !(nm in idByName)) idByName[nm] = id;
  }
  const dec = (typeof decodeName === 'function') ? decodeName : (s => s);
  const seen = {};
  for (const tv of villages) {
    if (!tv.player) continue;
    const nm = String(dec(tv.player) || '').toLowerCase().trim();
    const id = nm ? idByName[nm] : null;
    if (id == null) continue;
    const a = playerAllyDb[id];
    if (a && !seen[a]) { seen[a] = true; myAllyIds.push(a); }
  }
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
  let html = '';
  // First row, only when this village has incoming attacks (from the loaded troop file's
  // optional Incoming column). The name/coord/continent title still shows when there are none.
  const inc = (typeof troopByCoord !== 'undefined' && troopByCoord[coord]) ? (troopByCoord[coord].incoming || 0) : 0;
  if (inc >= 1) {
    const tier = (typeof incomingTier === 'function' && incomingTier(inc)) || 'red';
    html += `<div class="map-tt-incoming map-tt-inc-${tier}"><img class="tw-ic" src="icons/map/att.webp" alt="">${t('map_tt_incoming')(inc)}</div>`;
  }
  html += `<div class="map-tt-title">${esc(v.name)} <span class="map-tt-coord">${coord}</span> <span class="map-tt-cont">${continentOf(v.x, v.y)}</span></div>`;
  html += row(t('map_tt_player'), esc(playerName));
  if (tag) html += row(t('map_tt_tribe'), esc(tag));
  html += row(t('map_tt_points'), v.points.toLocaleString() + ' ' + t('map_pts'));
  if (!barb) html += row(t('map_tt_total'), totalPts.toLocaleString() + ' ' + t('map_pts'));
  if (v.bonus) html += row(t('map_tt_bonus'), `<span class="map-tt-bonus">${esc(bonusLabel(v.bonus))}</span>`);
  html += troopTooltipHtml(coord); // our tribe's loaded troops, if any
  html += plannedAttacksTooltipHtml(coord); // Plan Offensive: attacks targeting this village
  html += plannedSupportTooltipHtml(coord); // Plan Defense: support sent to this village
  return html;
}

// ── Phase 3: loaded-troop overlay (from the tribe info.txt → troopByCoord) ──────
// troopByCoord (built in parseData) maps 'x|y' → the parsed troop row. These are pure
// reads of that global, so the harness can exercise them by setting troopByCoord.

// Does a parsed troop row carry any units at all? (skips empty stationed/inbound sections)
function troopRowHasUnits(row) {
  if (!row) return false;
  return (typeof UNITS !== 'undefined' ? UNITS : []).some(u => (row[u] || 0) > 0);
}

// One tooltip troop block: a header, one or more power lines, and the per-unit chips.
// powerLines is [[iconKey, label, value], …]; entry is the parsed troop row (for the chips).
function troopBlockHtml(title, powerLines, entry) {
  const ic = (typeof twIcon === 'function') ? twIcon : () => '';
  let h = `<div class="map-tt-troops"><div class="map-tt-troops-h">${title}</div>`;
  for (const [icon, label, val] of powerLines)
    h += `<div class="map-tt-row"><span class="map-tt-k">${ic(icon)}${label}</span><span class="map-tt-v">${(val || 0).toLocaleString()}</span></div>`;
  const units = (typeof UNITS !== 'undefined' ? UNITS : []).filter(u => (entry[u] || 0) > 0);
  if (units.length)
    h += `<div class="map-tt-units">` + units.map(u => `<span class="map-tt-unit">${ic(u)}${entry[u].toLocaleString()}</span>`).join('') + `</div>`;
  return h + `</div>`;
}

// Up to three stacked troop blocks appended to the hover tooltip (from tribe_everything.txt):
//  • Owned Village Troops — the village's own troops. Off Power for an off (red-axe) village,
//    Def Power for a def (blue-sword) one — the role from villageTroopBadge (mixed→dominant).
//  • Troops In Village — troops currently stationed there (own + foreign support): both powers.
//  • Inbound Troops — troops returning/incoming to the village: Def Power only.
// Each section renders only when its data is loaded (stationed/inbound need ≥1 unit).
function troopTooltipHtml(coord) {
  let h = '';
  const owned = (typeof troopByCoord !== 'undefined') ? troopByCoord[coord] : null;
  if (owned) {
    const badge = (typeof villageTroopBadge === 'function') ? villageTroopBadge(coord) : null;
    const role = badge ? badge.offdef : null; // 'off' | 'def' | null
    const line = (role === 'def')
      ? ['def', t('map_tt_def'), (owned.defInf || 0) + (owned.defCav || 0)]
      : ['off', t('map_tt_off'), owned.offPow || 0]; // off / mixed→off / empty default to off
    h += troopBlockHtml(t('map_tt_troops'), [line], owned);
  }
  const stationed = (typeof defenseByCoord !== 'undefined') ? defenseByCoord[coord] : null;
  if (troopRowHasUnits(stationed))
    h += troopBlockHtml(t('map_tt_stationed'), [
      ['off', t('map_tt_off'), stationed.offPow || 0],
      ['def', t('map_tt_def'), (stationed.defInf || 0) + (stationed.defCav || 0)],
    ], stationed);
  const inbound = (typeof incomingByCoord !== 'undefined') ? incomingByCoord[coord] : null;
  if (troopRowHasUnits(inbound))
    h += troopBlockHtml(t('map_tt_inbound'), [
      ['def', t('map_tt_def'), (inbound.defInf || 0) + (inbound.defCav || 0)],
    ], inbound);
  return h;
}

// ── Plan overlays (Plan Offensive / Plan Defense → map halos + hover) ──────────
// Pure reads of the persisted plan globals (planRows / defPlanRows), so the headless
// harness exercises them directly. Each planRows entry is ONE attack order (a snob train
// counts as one, regardless of noble count); each defPlanRows entry is ONE support packet
// from a village. The map shows a per-target halo + a hover breakdown; the "Show …"
// toolbar toggles gate only the halos — the hover info is always available (task 10).

// Label for one planned-attack row (mirrors the Plan-Offensive table badge text).
function planAttackLabel(r) {
  if (r.type === 'snob') {
    const kind = t(r.escorted ? 'type_snob_split' : 'type_snob');
    return ((r.count || 1) > 1 ? (r.count + 'x ') : '') + kind;
  }
  return t('tier_' + r.type) || r.type;
}

// Planned attacks targeting `coord` (from Plan Offensive). null when none. count = number
// of attack orders; rows = [{label, player|null, unassigned}] in plan order.
function plannedAttacksFor(coord) {
  if (typeof planRows === 'undefined' || !planRows.length) return null;
  const rows = planRows.filter(r => r.tCoord === coord);
  if (!rows.length) return null;
  return { count: rows.length, rows: rows.map(r => ({
    label: planAttackLabel(r), player: r.srcPlayer || null, unassigned: !!r.unassigned,
  })) };
}

// 'x|y' → planned-attack count, across all objectives (one halo per coord). Pure.
function planAttackCountByCoord() {
  const out = {};
  if (typeof planRows === 'undefined') return out;
  for (const r of planRows) out[r.tCoord] = (out[r.tCoord] || 0) + 1;
  return out;
}

// Planned-attack travel segments for the map: one entry per attack order that has a KNOWN
// origin village. Snob trains and still-unassigned offs carry no prescribed origin (no
// srcCoord) → skipped (they show as a halo + tooltip only, never a line). Degenerate
// src===tgt rows are dropped too. Endpoints stay as 'x|y' coords; the render layer resolves
// them to pixels via worldToScreen. Pure read of planRows (harness-tested).
function plannedAttackLines() {
  if (typeof planRows === 'undefined') return [];
  const out = [];
  for (const r of planRows) {
    if (!r.srcCoord || !r.tCoord || r.srcCoord === r.tCoord) continue;
    out.push({ from: r.srcCoord, to: r.tCoord, type: r.type, player: r.srcPlayer || null });
  }
  return out;
}

// Planned support sent to `coord` (from Plan Defense). null when none. count = number of
// support packets; units = summed per-unit totals across those packets.
function plannedSupportFor(coord) {
  if (typeof defPlanRows === 'undefined' || !defPlanRows.length) return null;
  const rows = defPlanRows.filter(r => r.tCoord === coord);
  if (!rows.length) return null;
  const units = {};
  for (const r of rows) for (const u in (r.units || {})) units[u] = (units[u] || 0) + (r.units[u] || 0);
  return { count: rows.length, units };
}

// 'x|y' → planned-support packet count, across all support targets. Pure.
function defSupportCountByCoord() {
  const out = {};
  if (typeof defPlanRows === 'undefined') return out;
  for (const r of defPlanRows) out[r.tCoord] = (out[r.tCoord] || 0) + 1;
  return out;
}

// Planned-support travel segments for the map: one entry per support packet (sender village →
// supported village). Every defPlanRows entry carries a srcCoord, so none are skipped except
// degenerate src===tgt rows. Mirror of plannedAttackLines for the defensive plan. Pure read of
// defPlanRows (harness-tested); endpoints stay 'x|y' coords, resolved to pixels by the renderer.
function plannedSupportLines() {
  if (typeof defPlanRows === 'undefined') return [];
  const out = [];
  for (const r of defPlanRows) {
    if (!r.srcCoord || !r.tCoord || r.srcCoord === r.tCoord) continue;
    out.push({ from: r.srcCoord, to: r.tCoord, player: r.srcPlayer || null });
  }
  return out;
}

// ── Snob-reserved + unused-off halos (one marker per village, not a count) ──────────
// 'x|y' → 1 for every village held back for a noble launch (planReserved, set by the plan).
// One halo per reserved village. Pure read of planReserved (harness-tested).
function snobReservedCountByCoord() {
  const out = {};
  if (typeof planReserved === 'undefined') return out;
  for (const coord of planReserved) out[coord] = 1;
  return out;
}

// 'x|y' → 1 for every offensive village NOT committed by the current plan (see unusedOffs()
// in plan.js — sent, escort, or held-for-noble all count as committed). One halo per such
// village. Pure read of the plan + village pool (harness-tested).
function unusedOffCountByCoord() {
  const out = {};
  if (typeof unusedOffs !== 'function') return out;
  for (const v of unusedOffs()) out[v.coord] = 1;
  return out;
}

// 'x|y' → number of outgoing OFF orders launched FROM that village (offensive plan). One halo
// per sending village; count blooms the halo. Mirrors the origins of the attack-travel lines
// (any planRows row with a srcCoord — solo snob trains have none, so they don't count). Pure.
function offSenderCountByCoord() {
  const out = {};
  if (typeof planRows === 'undefined') return out;
  for (const r of planRows) if (r.srcCoord) out[r.srcCoord] = (out[r.srcCoord] || 0) + 1;
  return out;
}

// 'x|y' → number of outgoing SUPPORT packets sent FROM that village (defensive plan). One halo
// per sending village; count blooms the halo. Mirrors the origins of the support-travel lines.
// Pure read of defPlanRows (harness-tested).
function supportSenderCountByCoord() {
  const out = {};
  if (typeof defPlanRows === 'undefined') return out;
  for (const r of defPlanRows) if (r.srcCoord) out[r.srcCoord] = (out[r.srcCoord] || 0) + 1;
  return out;
}

// Off-tier visibility filter (Heatmap Config): true when this village's off tier is toggled
// OFF, so isDimmed() fades it. Only the three real off tiers (complete/tq/half) are governed;
// a village with no loaded troops, or a sub-1/2 ('none') off, is never filtered here — we can
// only filter offs we actually know about. Pure read of troopByCoord + the mapShowTier*
// toggles + getOffTier (harness-tested).
function offTierFiltered(v) {
  if (typeof troopByCoord === 'undefined' || typeof getOffTier !== 'function') return false;
  const tt = troopByCoord[v.x + '|' + v.y];
  if (!tt) return false;
  const tier = getOffTier(tt.offPow);
  if (tier === 'complete') return !mapShowTierComplete;
  if (tier === 'tq')       return !mapShowTierTq;
  if (tier === 'half')     return !mapShowTierHalf;
  return false;
}

// Role focus filters (Heatmap Config): isolate one side by fading everything else. Uses the
// SAME off/def classification as the on-map troop badge (villageTroopBadge → 'off' red-axe /
// 'def' blue-sword / null) so what fades matches what you see — no second classifier.
//  • "Defensive Villages Only" → show ONLY def-badge villages; fade the rest, EXCEPT villages
//    receiving support while the defensive plan is shown.
//  • "Offensive Villages Only" → show ONLY off-badge villages; fade the rest, EXCEPT
//    snob-reserved (noble-launch) villages.
// The filter applies ONLY to villages we have troop info for (a troopByCoord entry); every
// other village (enemy, barbarian, unloaded) is always shown. Among the troop-info villages,
// only the matching badge role stays — the rest fade (an off-only/def-only/empty village under
// the opposite filter). Pure read of troopByCoord + villageTroopBadge + the toggles + plans.
function villageRoleFiltered(v) {
  if (!mapShowDefVillagesOnly && !mapShowOffVillagesOnly) return false; // no focus filter active
  const coord = v.x + '|' + v.y;
  if (typeof troopByCoord === 'undefined' || !troopByCoord[coord]) return false; // no troop info → always shown
  const badge = (typeof villageTroopBadge === 'function') ? villageTroopBadge(coord) : null;
  const role = badge ? badge.offdef : null; // 'off' | 'def' | null
  if (mapShowDefVillagesOnly && role !== 'def') {
    const isSupportTarget = mapShowDefPlan && typeof defPlanRows !== 'undefined' && defPlanRows.some(r => r.tCoord === coord);
    if (!isSupportTarget) return true;
  }
  if (mapShowOffVillagesOnly && role !== 'off') {
    const isSnobReserved = typeof planReserved !== 'undefined' && planReserved.indexOf(coord) !== -1;
    if (!isSnobReserved) return true;
  }
  return false;
}

// Hover block: planned attacks (att.webp + count + per-order type/player). Always shown
// when this coord is an objective, regardless of the Show Offensive Plan halo toggle.
function plannedAttacksTooltipHtml(coord) {
  const pa = plannedAttacksFor(coord);
  if (!pa) return '';
  let h = `<div class="map-tt-plan map-tt-planoff"><img class="tw-ic" src="icons/map/att.webp" alt="">${t('map_tt_planoff')(pa.count)}</div>`;
  h += `<div class="map-tt-planlist">` + pa.rows.map(r =>
    `<div class="map-tt-planrow"><span class="map-tt-plantype">${esc(r.label)}</span>`
    + `<span class="map-tt-planwho">${r.player ? esc(r.player) : t('bb_unassigned')}</span></div>`
  ).join('') + `</div>`;
  return h;
}

// Hover block: planned support (support.webp + packet count + summed troop totals). Always
// shown when this coord is a support target, regardless of the Show Defensive Plan toggle.
function plannedSupportTooltipHtml(coord) {
  const ps = plannedSupportFor(coord);
  if (!ps) return '';
  const ic = (typeof twIcon === 'function') ? twIcon : () => '';
  const units = (typeof UNITS !== 'undefined' ? UNITS : []).filter(u => (ps.units[u] || 0) > 0);
  let h = `<div class="map-tt-plan map-tt-plandef"><img class="tw-ic" src="icons/map/support.webp" alt="">${t('map_tt_plandef')(ps.count)}</div>`;
  if (units.length)
    h += `<div class="map-tt-units">` + units.map(u => `<span class="map-tt-unit">${ic(u)}${ps.units[u].toLocaleString()}</span>`).join('') + `</div>`;
  return h;
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

// Does village v qualify as a Barb-Finder candidate barbarian under the bonus filter?
// bonusMode: 'all' | 'bonus' | 'nobonus'. bonusType: 0 = any bonus, else a MAP_BONUS id
// (only applied when bonusMode === 'bonus'). Pure — shared by barbFinderResults (the ranked
// list) AND the map's dim logic (Barb-Finder isolation), so both agree on "matching barb".
function barbVillageMatches(v, bonusMode, bonusType) {
  if (!v) return false;
  if (v.playerId && v.playerId !== '0') return false;    // barbarians only
  bonusMode = bonusMode || 'all';
  bonusType = parseInt(bonusType) || 0;
  if (bonusMode === 'bonus'   && !v.bonus) return false;
  if (bonusMode === 'nobonus' &&  v.bonus) return false;
  if (bonusMode === 'bonus'   && bonusType && v.bonus !== bonusType) return false;
  return true;
}

// Barbarian villages ranked by smallest distance to any of the player's snob villages.
// bonusMode: 'all' | 'bonus' | 'nobonus'. bonusType: 0 = any bonus, else a MAP_BONUS id
// (only applied when bonusMode === 'bonus'). Returns ascending-by-distance
// [{coord, x, y, points, bonus, dist, fromCoord}], capped at `limit` (0/undefined = all).
function barbFinderResults(playerName, bonusMode, bonusType, limit) {
  const snobVils = snobVillagesOf(playerName);
  if (!snobVils.length || typeof villageDb === 'undefined') return [];
  const out = [];
  for (const v of villageDb) {
    if (!barbVillageMatches(v, bonusMode, bonusType)) continue;
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
