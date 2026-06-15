// ══════════════════════════════════════════════════════════════
// MAP — canvas render shell (v2.0.0 Phase 1)
// ══════════════════════════════════════════════════════════════
// DOM/canvas only. NOTHING here runs at load time; initMap() is called lazily
// from switchTab('map'), so the headless test sandbox (no real canvas) never
// touches it. Pure geometry/data logic lives in map.js (harness-tested).

let mapInited = false;
let mapFitted = false;
let mapCanvas = null, mapCtx = null;
let mapOffscreen = null, mapOffCtx = null;
let mapHoverCoord = null;
let mapDrag = null; // { x, y, panX0, panY0, moved }

// ── Phase 2 state: custom color groups + bonus filter ──
// (Color model lives in map.js: mapGroups / mapGroupIndex / colorForVillage / detectMyTribe.)
let mapBonusOnly = false;            // dim non-bonus villages when true
let mapBarbsOnly = false;            // dim player (non-barbarian) villages when true
let mapExtractMode = false;          // "Extract Coordinates": click villages to collect coords
let mapSelection = new Set();        // selected 'x|y' coords (rings on the map)
let mapPrefsLoaded = false;
let mapMineSeeded = false;           // have we auto-created the "My tribe" group yet?
const MINE_GROUP_ID = '__mine__';    // stable id of the auto-seeded "My tribe" group
const MAP_DIM_ALPHA = 0.12;          // alpha for villages filtered out by the bonus filter
const MAP_GROUP_PRESETS = ['#e0403a','#9b59b6','#1abc9c','#f39c12','#e91e63','#2ecc71','#16a0d0','#d35400'];

const MAP_PREFS_KEY = 'tw_tribe_map';
function loadMapPrefs() {
  if (mapPrefsLoaded || typeof localStorage === 'undefined') { mapPrefsLoaded = true; rebuildGroupIndex(); return; }
  mapPrefsLoaded = true;
  try {
    const p = JSON.parse(localStorage.getItem(MAP_PREFS_KEY) || '{}');
    mapBonusOnly = !!p.bonusOnly;
    mapBarbsOnly = !!p.barbsOnly;
    mapMineSeeded = !!p.mineSeeded;
    if (Array.isArray(p.groups)) mapGroups = p.groups.filter(g => g && g.color).map(g => ({
      id: String(g.id || ''), name: String(g.name || ''), color: String(g.color),
      coords: Array.isArray(g.coords) ? g.coords.map(String) : [],
      players: Array.isArray(g.players) ? g.players.map(String) : [],
      tribes: Array.isArray(g.tribes) ? g.tribes.map(String) : [],
    }));
  } catch (e) { /* corrupt prefs never break the map */ }
  rebuildGroupIndex();
}
function saveMapPrefs() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MAP_PREFS_KEY, JSON.stringify({ bonusOnly: mapBonusOnly, barbsOnly: mapBarbsOnly, mineSeeded: mapMineSeeded, groups: mapGroups }));
  } catch (e) { /* ignore quota/serialization errors */ }
}

// Should this village be dimmed (faded, not hidden)? Combines every filter that fades
// villages, used in both dot AND sprite render. Three independent sources, OR'd together:
//   • Bonus only  → fade non-bonus villages.
//   • Barbs only  → fade player (non-barbarian) villages.
//   • Barb Finder → "isolation": once a player is selected, fade everything that is neither
//                   one of THAT player's villages nor a barbarian matching the bonus filter
//                   (so the candidate barbs + the chosen player's villages stand alone).
// The barb-finder clause only kicks in once a player is actually selected (barbPlayerCoords
// non-empty) — toggling the button before troops load must not grey the whole map.
function isDimmed(v) {
  if (mapBonusOnly && !v.bonus) return true;
  const isBarb = !v.playerId || v.playerId === '0';
  if (mapBarbsOnly && !isBarb) return true;
  if (barbFinderActive && barbPlayerCoords.size) {
    const coord = v.x + '|' + v.y;
    if (!barbPlayerCoords.has(coord) && !barbVillageMatches(v, barbBonusMode, barbBonusType)) return true;
  }
  return false;
}

// Auto-create the editable "My tribe" group ONCE, seeded with the detected tribe's tag.
// After that it's fully user-controlled (add/remove tribes for a multi-tribe alliance,
// rename, recolour, delete) — we never touch it again (mapMineSeeded persists). Needs
// ally.txt to resolve a tag; until then it keeps retrying on later loads.
function seedMineGroup() {
  if (mapMineSeeded || !myAllyId) return;
  const tag = (typeof allyDb !== 'undefined' && allyDb[myAllyId]) ? allyDb[myAllyId].tag : '';
  if (!tag) return; // can't label the tribe without ally.txt — try again next load
  let g = mapGroups.find(x => x.id === MINE_GROUP_ID);
  if (!g) { g = { id: MINE_GROUP_ID, name: t('map_my_tribe'), color: MAP_COLOR_MINE, coords: [], players: [], tribes: [] }; mapGroups.unshift(g); }
  if (!g.tribes.some(x => x.toLowerCase() === tag.toLowerCase())) g.tribes.push(tag);
  mapMineSeeded = true;
  rebuildGroupIndex();
  saveMapPrefs();
}

// Detect which tribe loaded the troop file, then seed the My-tribe group. Idempotent.
// IMPORTANT: this runs from parseData/setDbData, which can fire before the map tab is ever
// opened (esp. production auto-load) — i.e. before initMap()'s loadMapPrefs(). Load prefs
// FIRST (guarded/idempotent, no DOM) so seedMineGroup appends to the SAVED groups instead
// of clobbering them with a fresh [__mine__] on the next saveMapPrefs().
function mapDetectAndSeed() {
  loadMapPrefs();
  if (typeof detectMyTribe === 'function') detectMyTribe();
  seedMineGroup();
}

// ── Village sprites (map_new graphics, downloaded locally to icons/map/) ──
const MAP_SPRITE_KEYS = [
  'v1','v2','v3','v4','v5','v6','b1','b2','b3','b4','b5','b6',                          // owned
  'v1_left','v2_left','v3_left','v4_left','v5_left','v6_left',                          // barbarian (regular)
  'b1_left','b2_left','b3_left','b4_left','b5_left','b6_left',                          // barbarian (bonus)
];
const MAP_GRASS = '#5c701b';   // the sprites' baked-in grass background (exact)
// MAP_SPRITE_MIN_SCALE (= 12) lives in map.js — it also gates the square↔38/53 aspect switch.
let mapSprites = {};
let mapSpritesReady = false;

function loadMapSprites() {
  if (Object.keys(mapSprites).length || typeof Image === 'undefined') return;
  let done = 0;
  const onSettle = () => {
    if (++done < MAP_SPRITE_KEYS.length) return;
    mapSpritesReady = MAP_SPRITE_KEYS.every(k => mapSprites[k] && mapSprites[k].naturalWidth);
    if (mapSpritesReady && mapInited && isMapTabActive() && villageDb.length) { renderMapOffscreen(); paintMap(); }
  };
  for (const k of MAP_SPRITE_KEYS) {
    const img = new Image();
    img.onload = onSettle;
    img.onerror = onSettle; // any failure → stay in dot mode (graceful)
    img.src = 'icons/map/' + k + '.png';
    mapSprites[k] = img;
  }
}

// ── Troop-type badge icons (axe/sword/snob) drawn on zoomed-in villages ──
const MAP_BADGE_KEYS = ['axe','sword','snob'];
let mapBadgeIcons = {};
function loadMapBadges() {
  if (Object.keys(mapBadgeIcons).length || typeof Image === 'undefined') return;
  const repaint = () => { if (mapInited && isMapTabActive() && villageDb.length) { renderMapOffscreen(); paintMap(); } };
  for (const k of MAP_BADGE_KEYS) {
    const img = new Image();
    img.onload = repaint;
    img.onerror = () => {}; // missing icon → badge shows as a plain colored square
    img.src = 'icons/' + k + '.png';
    mapBadgeIcons[k] = img;
  }
}

function mapEls() {
  return {
    wrap:    document.getElementById('map-wrap'),
    canvas:  document.getElementById('map-canvas'),
    empty:   document.getElementById('map-empty'),
    tip:     document.getElementById('map-tooltip'),
    count:   document.getElementById('map-count'),
    toolbar: document.getElementById('map-toolbar'),
  };
}

function isMapTabActive() {
  const c = document.getElementById('tab-map');
  return !!(c && c.classList && c.classList.contains('active'));
}

function initMap() {
  if (mapInited) return;
  if (typeof document === 'undefined' || !document.getElementById) return;
  const canvas = document.getElementById('map-canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return; // sandbox-safe
  mapCanvas = canvas;
  mapCtx = canvas.getContext('2d');
  mapOffscreen = document.createElement('canvas');
  mapOffCtx = mapOffscreen.getContext('2d');

  canvas.addEventListener('mousedown', onMapMouseDown);
  canvas.addEventListener('mousemove', onMapMouseMove);
  canvas.addEventListener('mouseup', onMapMouseUp);
  canvas.addEventListener('mouseleave', onMapMouseLeave);
  canvas.addEventListener('wheel', onMapWheel, { passive: false });
  if (typeof window !== 'undefined' && window.addEventListener)
    window.addEventListener('resize', () => {
      if (mapInited && isMapTabActive() && villageDb.length) { resizeMapCanvas(); renderMapOffscreen(); paintMap(); }
    });

  mapInited = true;
  loadMapPrefs();
  syncMapToolbar();
  loadMapSprites();
  loadMapBadges();
  resizeMapCanvas();
}

function resizeMapCanvas() {
  if (!mapCanvas) return;
  const wrap = document.getElementById('map-wrap');
  const w = Math.max(200, wrap ? wrap.clientWidth : 800);
  const h = Math.max(200, wrap ? wrap.clientHeight : 600);
  mapCanvas.width = w; mapCanvas.height = h;
  mapOffscreen.width = w; mapOffscreen.height = h;
}

// Render all village dots to the offscreen buffer for the CURRENT view.
// Called on view change (zoom / pan / resize) and data load — NOT on hover.
function renderMapOffscreen() {
  if (!mapOffCtx || !mapOffscreen) return;
  const w = mapOffscreen.width, h = mapOffscreen.height;
  const spriteMode = mapSpritesReady && mapView.scale >= MAP_SPRITE_MIN_SCALE;
  const margin = Math.max(6, mapView.scale); // field-filling dots/sprites can be ~scale wide
  mapOffCtx.clearRect(0, 0, w, h);
  if (spriteMode) { mapOffCtx.fillStyle = MAP_GRASS; mapOffCtx.fillRect(0, 0, w, h); } // continuous terrain
  drawMapGrid(mapOffCtx, w, h, spriteMode);
  const dw = mapView.scale, dh = dw * MAP_Y_RATIO; // one sprite = one (anisotropic) field
  const dot = mapDotRectSize(mapView.scale);       // dot-mode field rectangle (tiles edge-to-edge)
  for (const v of villageDb) {
    const s = worldToScreen(v.x, v.y);
    if (s.px < -margin || s.py < -margin || s.px > w + margin || s.py > h + margin) continue; // cull
    mapOffCtx.globalAlpha = isDimmed(v) ? MAP_DIM_ALPHA : 1;
    if (spriteMode) {
      const img = mapSprites[mapSpriteKey(v)];
      if (img && img.complete && img.naturalWidth) mapOffCtx.drawImage(img, s.px - dw / 2, s.py - dh / 2, dw, dh);
      // zoomed-in: a small group-color dot on the top-left of each NON-barbarian village
      if (v.playerId && v.playerId !== '0') drawMapColorDot(mapOffCtx, s.px - dw / 2, s.py - dh / 2, dw, dh, colorForVillage(v));
      // zoomed-in: off/def + snob badges for villages whose troops we've loaded
      const badge = villageTroopBadge(v.x + '|' + v.y);
      if (badge) drawMapTroopBadges(mapOffCtx, s.px - dw / 2, s.py - dh / 2, dw, dh, badge);
    } else {
      // zoomed out: fill the field so dots tile edge-to-edge → colors read from a distance
      mapOffCtx.fillStyle = colorForVillage(v); // group → barb → other
      mapOffCtx.fillRect(s.px - dot.dw / 2, s.py - dot.dh / 2, dot.dw, dot.dh);
    }
  }
  mapOffCtx.globalAlpha = 1;
  const count = document.getElementById('map-count');
  if (count) count.textContent = t('map_villages_shown')(villageDb.length);
}

// Small filled circle (group color) at the top-left of a village sprite, like the
// in-game map's tribe-color marker. left/top = sprite origin; dw/dh = sprite size.
function drawMapColorDot(ctx, left, top, dw, dh, color) {
  const r = Math.max(2.5, Math.min(7, dw * 0.16));
  const cx = left + dw * 0.30, cy = top + dh * 0.22;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.4);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.stroke();
}

// Grid: continent boundaries every 100 cells (thicker) and 5×5 "block" boundaries
// (thinner, only when zoomed in). A boundary sits BETWEEN cells, at world `step*k-0.5`
// (e.g. 499.5 splits col 499|500), so it lands exactly between two village centers.
function drawGridLines(ctx, w, h, step) {
  const wl = screenToWorld(0, 0), wr = screenToWorld(w, h);
  const kx0 = Math.floor((wl.x + 0.5) / step), kx1 = Math.ceil((wr.x + 0.5) / step);
  for (let k = kx0; k <= kx1; k++) {
    const px = (step * k - 0.5) * mapView.scale + mapView.panX;
    if (px < 0 || px > w) continue;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }
  const ky0 = Math.floor((wl.y + 0.5) / step), ky1 = Math.ceil((wr.y + 0.5) / step);
  for (let k = ky0; k <= ky1; k++) {
    const py = (step * k - 0.5) * mapScaleY() + mapView.panY; // vertical axis is compressed
    if (py < 0 || py > h) continue;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }
}

// Off/def + snob badges (colored squares with a unit icon) stacked at the top-right of a
// village sprite. off = axe on red, def = sword on blue (mutually exclusive); snob = snob
// on yellow (additional). Mirrors the in-game troop markers.
function drawMapTroopBadges(ctx, left, top, dw, dh, badge) {
  const sz = Math.max(9, Math.min(20, dw * 0.42));
  const x = left + dw - sz - dw * 0.05;
  let y = top + dh * 0.08;
  if (badge.offdef) {
    drawMapBadge(ctx, x, y, sz, badge.offdef === 'off' ? '#c0392b' : '#2e6fc0',
      badge.offdef === 'off' ? mapBadgeIcons.axe : mapBadgeIcons.sword);
    y += sz + 2;
  }
  if (badge.snob) drawMapBadge(ctx, x, y, sz, '#d4a017', mapBadgeIcons.snob);
}
function drawMapBadge(ctx, x, y, sz, bg, img) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, sz, sz);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeRect(x, y, sz, sz);
  if (img && img.complete && img.naturalWidth) {
    const pad = sz * 0.14;
    ctx.drawImage(img, x + pad, y + pad, sz - 2 * pad, sz - 2 * pad);
  }
}

function drawMapGrid(ctx, w, h, spriteMode) {
  if (spriteMode) { // 5×5 blocks — only legible zoomed in (over the grass terrain)
    ctx.strokeStyle = 'rgba(0,0,0,0.20)';
    ctx.lineWidth = 1;
    drawGridLines(ctx, w, h, 5);
  }
  // continents (100×100) — thicker; light tan over the dark overview, darker over grass
  ctx.strokeStyle = spriteMode ? 'rgba(0,0,0,0.45)' : 'rgba(160,148,120,0.38)';
  ctx.lineWidth = spriteMode ? 2.5 : 1.5;
  drawGridLines(ctx, w, h, 100);
}

// Blit cached offscreen + draw the hover ring. Cheap → safe on every mousemove.
function paintMap() {
  if (!mapCtx || !mapOffscreen) return;
  const w = mapCanvas.width, h = mapCanvas.height;
  mapCtx.clearRect(0, 0, w, h);
  mapCtx.fillStyle = '#0b0802';
  mapCtx.fillRect(0, 0, w, h);
  mapCtx.drawImage(mapOffscreen, 0, 0);
  // Extract-mode selection rings (overlay; cheap — only the selected coords)
  if (mapSelection.size) {
    mapCtx.strokeStyle = '#ff3b6b';
    mapCtx.lineWidth = 2;
    const r = Math.max(6, mapView.scale * 0.55);
    for (const c of mapSelection) {
      const v = coordDb[c];
      if (!v) continue;
      const s = worldToScreen(v.x, v.y);
      if (s.px < -r || s.py < -r || s.px > w + r || s.py > h + r) continue;
      mapCtx.beginPath();
      mapCtx.arc(s.px, s.py, r, 0, Math.PI * 2);
      mapCtx.stroke();
    }
  }
  // Barb Finder overlay: orange rings on candidate barbs, blue rings on the snob origins.
  if (barbFinderActive) {
    for (const r of barbResults) drawMapRing(r.coord, w, h, '#ff9d2e', 2);
    for (const c of barbSnobCoords) drawMapRing(c, w, h, '#3f7fe0', 2.5);
  }
  if (mapHoverCoord && coordDb[mapHoverCoord]) {
    const v = coordDb[mapHoverCoord];
    const s = worldToScreen(v.x, v.y);
    mapCtx.strokeStyle = '#ffffff';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.arc(s.px, s.py, 7, 0, Math.PI * 2);
    mapCtx.stroke();
  }
}

// Called from switchTab('map'). Lazy-inits, toggles empty state, first-fit, paints.
function onMapTabShown() {
  initMap();
  if (!mapInited) return;
  const { canvas, empty, toolbar } = mapEls();
  const has = villageDb.length > 0;
  if (empty)   empty.style.display   = has ? 'none' : '';
  if (canvas)  canvas.style.display  = has ? '' : 'none';
  if (toolbar) toolbar.style.display = has ? '' : 'none';
  if (!has) return;
  resizeMapCanvas();
  if (!mapFitted) { fitMapView(mapCanvas.width, mapCanvas.height); mapFitted = true; }
  mapDetectAndSeed();
  renderMapOffscreen();
  paintMap();
  renderMapGroups(); // panel AFTER the canvas paints — a panel error can't blank the map
  if (barbFinderActive) renderBarbFinder();
}

// Called by setDbData() (world DB load) and parseData() (troop file load). Guarded:
// no-op until the map tab has been opened (and in the test sandbox, mapInited stays false).
function mapRefresh() {
  if (!mapInited) return;
  if (isMapTabActive() && villageDb.length) {
    resizeMapCanvas();
    if (!mapFitted) { fitMapView(mapCanvas.width, mapCanvas.height); mapFitted = true; }
    mapDetectAndSeed();
    renderMapOffscreen();
    paintMap();
    renderMapGroups();
    if (barbFinderActive) renderBarbFinder();
  }
}

// ── Pointer / wheel handlers ──
function mapEventXY(e) {
  const r = mapCanvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onMapMouseDown(e) {
  const p = mapEventXY(e);
  mapDrag = { x: p.x, y: p.y, panX0: mapView.panX, panY0: mapView.panY, moved: false };
}

function onMapMouseMove(e) {
  const p = mapEventXY(e);
  if (mapDrag) {
    const dx = p.x - mapDrag.x, dy = p.y - mapDrag.y;
    // Ignore sub-threshold jitter so a slightly-shaky click still counts as a click
    // (not a 1px pan) — important for Extract-mode village selection.
    if (!mapDrag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    mapView.panX = mapDrag.panX0 + dx;
    mapView.panY = mapDrag.panY0 + dy;
    mapDrag.moved = true;
    hideMapTip();
    renderMapOffscreen();
    paintMap();
    return;
  }
  const coord = villageAtPixel(p.x, p.y);
  if (coord !== mapHoverCoord) { mapHoverCoord = coord; paintMap(); }
  if (coord) showMapTip(coord, e); else hideMapTip();
}

function onMapMouseUp() {
  // a click (mousedown→up without panning) in Extract mode toggles the village under it
  if (mapExtractMode && mapDrag && !mapDrag.moved) {
    const coord = villageAtPixel(mapDrag.x, mapDrag.y);
    if (coord) toggleExtractCoord(coord);
  }
  mapDrag = null;
}
function onMapMouseLeave() { mapDrag = null; mapHoverCoord = null; hideMapTip(); paintMap(); }

function onMapWheel(e) {
  e.preventDefault();
  const p = mapEventXY(e);
  const wpt = screenToWorld(p.x, p.y);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  mapView.scale = clampMapScale(mapView.scale * factor);
  mapView.panX = p.x - wpt.x * mapView.scale; // keep world point under cursor fixed
  mapView.panY = p.y - wpt.y * mapScaleY();   // (vertical uses the compressed scale)
  hideMapTip();
  renderMapOffscreen();
  paintMap();
}

function showMapTip(coord, e) {
  const tip = document.getElementById('map-tooltip');
  const wrap = document.getElementById('map-wrap');
  if (!tip || !wrap) return;
  tip.innerHTML = villageTooltipHtml(coord);
  tip.style.display = 'block';
  const wr = wrap.getBoundingClientRect();
  tip.style.left = (e.clientX - wr.left + 14) + 'px';
  tip.style.top  = (e.clientY - wr.top + 14) + 'px';
}

function hideMapTip() {
  const tip = document.getElementById('map-tooltip');
  if (tip) tip.style.display = 'none';
}

// ── Toolbar actions ──
function mapZoom(factor) {
  if (!mapInited) return;
  const cx = mapCanvas.width / 2, cy = mapCanvas.height / 2;
  const wpt = screenToWorld(cx, cy);
  mapView.scale = clampMapScale(mapView.scale * factor);
  mapView.panX = cx - wpt.x * mapView.scale;
  mapView.panY = cy - wpt.y * mapScaleY();
  renderMapOffscreen(); paintMap();
}

function mapResetView() {
  if (!mapInited) return;
  fitMapView(mapCanvas.width, mapCanvas.height);
  renderMapOffscreen(); paintMap();
}

// ── Phase 2: bonus filter + custom color groups ──
function repaintMapData() { if (mapInited) { renderMapOffscreen(); paintMap(); } }

function setMapBonusOnly(on) {
  mapBonusOnly = !!on;
  saveMapPrefs();
  repaintMapData();
}

function setMapBarbsOnly(on) {
  mapBarbsOnly = !!on;
  saveMapPrefs();
  repaintMapData();
}

// Reflect persisted state into the toolbar controls (called after prefs load).
function syncMapToolbar() {
  const cb = document.getElementById('map-bonus-only');
  if (cb) cb.checked = mapBonusOnly;
  const bb = document.getElementById('map-barbs-only');
  if (bb) bb.checked = mapBarbsOnly;
}

// ── Extract Coordinates: click villages to collect coords, then copy them ──
function toggleExtractMode() {
  mapExtractMode = !mapExtractMode;
  if (mapExtractMode && barbFinderActive) closeBarbFinder(); // one click-panel at a time
  const btn = document.getElementById('map-extract-btn');
  if (btn) btn.classList.toggle('active', mapExtractMode);
  const bar = document.getElementById('map-extract-bar');
  if (bar) bar.style.display = mapExtractMode ? '' : 'none';
  if (mapCanvas) mapCanvas.style.cursor = mapExtractMode ? 'crosshair' : '';
  updateExtractBar();
  repaintMapData(); // closing the barb finder here must clear its isolation dimming
}
function toggleExtractCoord(coord) {
  if (mapSelection.has(coord)) mapSelection.delete(coord); else mapSelection.add(coord);
  updateExtractBar();
  paintMap();
}
function updateExtractBar() {
  const cnt = document.getElementById('map-extract-count');
  if (cnt) cnt.textContent = t('map_sel_count')(mapSelection.size);
}
function clearMapExtract() {
  if (!mapSelection.size) return;
  mapSelection.clear();
  updateExtractBar();
  paintMap();
}
function copyMapExtract() {
  const txt = extractCoords([...mapSelection]);
  if (!txt) { alert(t('map_no_sel')); return; }
  const done = () => alert(t('map_copied')(mapSelection.size));
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(txt).then(done).catch(() => mapFallbackCopy(txt, done));
  else mapFallbackCopy(txt, done);
}
function mapFallbackCopy(txt, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    done();
  } catch (e) { alert(txt); }
}

// ── Barb Finder: pick a player who owns snobs → rank nearby barbarians by distance ──
// Pure ranking lives in map.js (barbFinderResults). This shell drives the panel + draws
// origin/candidate rings on the canvas. Mutually exclusive with Extract mode (both are
// click-driven panels). Browser-only — never runs in the test sandbox.
let barbFinderActive = false;
let barbPlayer = '';
let barbBonusMode = 'all';     // 'all' | 'bonus' | 'nobonus'
let barbBonusType = 0;         // 0 = any bonus, else a MAP_BONUS id
let barbResults = [];          // current ranked list (also drawn as candidate rings)
let barbSnobCoords = [];       // the selected player's snob villages (origin rings)
let barbPlayerCoords = new Set(); // ALL of the selected player's village coords (kept lit during isolation)
const BARB_LIMIT = 50;         // cap the list (visible count, no silent truncation)

function toggleBarbFinder() {
  barbFinderActive = !barbFinderActive;
  if (barbFinderActive && mapExtractMode) toggleExtractMode(); // one click-panel at a time
  const btn = document.getElementById('map-barb-btn');
  if (btn) btn.classList.toggle('active', barbFinderActive);
  const panel = document.getElementById('map-barb-finder');
  if (panel) panel.style.display = barbFinderActive ? '' : 'none';
  if (barbFinderActive) renderBarbFinder();
  else { barbResults = []; barbSnobCoords = []; barbPlayerCoords = new Set(); }
  repaintMapData(); // re-render the offscreen so isolation dimming applies / clears
}
function closeBarbFinder() {
  barbFinderActive = false;
  const btn = document.getElementById('map-barb-btn'); if (btn) btn.classList.remove('active');
  const panel = document.getElementById('map-barb-finder'); if (panel) panel.style.display = 'none';
  barbResults = []; barbSnobCoords = []; barbPlayerCoords = new Set();
}
function setBarbPlayer(v) { barbPlayer = v; updateBarbResults(); }
function setBarbBonusMode(v) {
  barbBonusMode = v;
  const ts = document.getElementById('map-barb-type');
  if (ts) ts.disabled = (v !== 'bonus'); // bonus-type only narrows when filtering to bonus villages
  updateBarbResults();
}
function setBarbBonusType(v) { barbBonusType = parseInt(v) || 0; updateBarbResults(); }

// Build the panel controls (player + bonus filters), then fill the list via updateBarbResults.
function renderBarbFinder() {
  const body = document.getElementById('map-barb-body');
  if (!body) return;
  const snobPlayers = playersWithSnobs();
  if (!snobPlayers.length) {
    body.innerHTML = `<div class="map-barb-empty">${esc(t('barb_need_troops'))}</div>`;
    barbResults = []; barbSnobCoords = []; barbPlayerCoords = new Set(); repaintMapData();
    return;
  }
  if (!snobPlayers.includes(barbPlayer)) barbPlayer = snobPlayers[0];
  const playerOpts = snobPlayers.map(p => `<option value="${esc(p)}"${p === barbPlayer ? ' selected' : ''}>${esc(p)}</option>`).join('');
  const modeOpts = [['all', 'barb_bonus_all'], ['bonus', 'barb_bonus_only'], ['nobonus', 'barb_bonus_none']]
    .map(([v, k]) => `<option value="${v}"${v === barbBonusMode ? ' selected' : ''}>${esc(t(k))}</option>`).join('');
  let typeOpts = `<option value="0"${!barbBonusType ? ' selected' : ''}>${esc(t('barb_type_all'))}</option>`;
  for (const id in MAP_BONUS) typeOpts += `<option value="${id}"${+id === barbBonusType ? ' selected' : ''}>${esc(bonusLabel(+id))}</option>`;
  body.innerHTML =
      `<label class="map-barb-lbl">${esc(t('barb_player'))}</label>`
    + `<select class="map-barb-sel" onchange="setBarbPlayer(this.value)">${playerOpts}</select>`
    + `<div class="map-barb-filters">`
    +   `<select class="map-barb-sel" onchange="setBarbBonusMode(this.value)">${modeOpts}</select>`
    +   `<select id="map-barb-type" class="map-barb-sel" onchange="setBarbBonusType(this.value)"${barbBonusMode !== 'bonus' ? ' disabled' : ''}>${typeOpts}</select>`
    + `</div>`
    + `<div id="map-barb-count" class="map-barb-count"></div>`
    + `<div id="map-barb-list" class="map-barb-list"></div>`
    + `<button class="btn btn-ghost btn-sm map-barb-copy" onclick="copyBarbCoords()">${esc(t('barb_copy'))}</button>`;
  updateBarbResults();
}

// Recompute the ranked list from the current selections; refresh list + count + map rings.
function updateBarbResults() {
  barbSnobCoords = snobVillagesOf(barbPlayer).map(s => s.coord);
  // ALL of the selected player's villages (not just snobs) stay lit during isolation.
  const pv = (typeof players !== 'undefined' && players[barbPlayer]) ? players[barbPlayer].villages : [];
  barbPlayerCoords = new Set(pv.map(v => v.coord));
  barbResults = barbFinderResults(barbPlayer, barbBonusMode, barbBonusType, BARB_LIMIT);
  const list = document.getElementById('map-barb-list');
  if (list) {
    if (!barbResults.length) {
      list.innerHTML = `<div class="map-barb-empty">${esc(t('barb_no_results'))}</div>`;
    } else {
      list.innerHTML = barbResults.map(r => {
        const bonus = r.bonus ? ` · <span class="map-barb-bonus">🎁 ${esc(bonusLabel(r.bonus))}</span>` : '';
        return `<div class="map-barb-row" onclick="focusBarb('${r.coord}')" title="${esc(t('barb_from'))} ${r.fromCoord}">`
          + `<span class="map-barb-coord">${r.coord}</span>`
          + `<span class="map-barb-dist">${r.dist.toFixed(1)}</span>`
          + `<span class="map-barb-meta">${r.points.toLocaleString()} ${esc(t('map_pts'))}${bonus}</span>`
          + `</div>`;
      }).join('');
    }
  }
  const cnt = document.getElementById('map-barb-count');
  if (cnt) cnt.textContent = t('barb_count')(barbResults.length, barbSnobCoords.length);
  repaintMapData(); // re-render offscreen so isolation dimming tracks the selected player/filter
}

// Center the view on a barb and flash its hover ring (does not change zoom).
function focusBarb(coord) {
  const v = coordDb[coord];
  if (!v || !mapCanvas) return;
  mapView.panX = mapCanvas.width / 2 - v.x * mapView.scale;
  mapView.panY = mapCanvas.height / 2 - v.y * mapScaleY();
  mapHoverCoord = coord;
  renderMapOffscreen();
  paintMap();
}

function copyBarbCoords() {
  const txt = extractCoords(barbResults.map(r => r.coord));
  if (!txt) { alert(t('map_no_sel')); return; }
  const done = () => alert(t('map_copied')(barbResults.length));
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(txt).then(done).catch(() => mapFallbackCopy(txt, done));
  else mapFallbackCopy(txt, done);
}

// Stroke a ring around a village coord (used for barb-finder origin/candidate markers).
function drawMapRing(coord, w, h, color, lw) {
  const v = coordDb[coord];
  if (!v) return;
  const s = worldToScreen(v.x, v.y);
  const r = Math.max(5, mapView.scale * 0.5);
  if (s.px < -r || s.py < -r || s.px > w + r || s.py > h + r) return;
  mapCtx.beginPath();
  mapCtx.arc(s.px, s.py, r, 0, Math.PI * 2);
  mapCtx.lineWidth = lw;
  mapCtx.strokeStyle = color;
  mapCtx.stroke();
}

// Commit a group change: rebuild the fast index, persist, recolor, re-render the panel.
function commitMapGroups() { rebuildGroupIndex(); saveMapPrefs(); repaintMapData(); renderMapGroups(); }

function mapGroupById(id) { return mapGroups.find(g => g.id === String(id)); }

function addMapGroup() {
  const id = 'g' + (typeof Date !== 'undefined' ? Date.now().toString(36) : mapGroups.length);
  const color = MAP_GROUP_PRESETS[mapGroups.length % MAP_GROUP_PRESETS.length];
  mapGroups.push({ id, name: t('map_group_default')(mapGroups.length + 1), color, coords: [], players: [], tribes: [] });
  commitMapGroups();
}
function deleteMapGroup(id) {
  mapGroups = mapGroups.filter(g => g.id !== String(id));
  commitMapGroups();
}
function setMapGroupColor(id, color) { const g = mapGroupById(id); if (g) { g.color = color; commitMapGroups(); } }
function renameMapGroup(id, name) { const g = mapGroupById(id); if (g) { g.name = name; saveMapPrefs(); /* no recolor needed */ } }

function addMapGroupMember(id) {
  const g = mapGroupById(id);
  const inp = document.getElementById('map-grp-add-' + id);
  if (!g || !inp) return;
  const cls = classifyGroupToken(inp.value);
  if (!cls) return;
  const arr = g[cls.type];
  if (!arr.some(x => x.toLowerCase() === cls.val.toLowerCase())) arr.push(cls.val);
  inp.value = '';
  commitMapGroups();
  const again = document.getElementById('map-grp-add-' + id);
  if (again) again.focus();
}
function removeMapGroupMember(id, type, val) {
  const g = mapGroupById(id);
  if (!g || !g[type]) return;
  g[type] = g[type].filter(x => x !== val);
  commitMapGroups();
}

// Build the color-groups panel. DOM-only (browser); never runs in the test sandbox.
function renderMapGroups() {
  const panel = document.getElementById('map-groups');
  const body = document.getElementById('map-groups-body');
  if (!panel || !body) return;
  panel.style.display = villageDb.length ? '' : 'none';
  if (!villageDb.length) return;

  // The auto-seeded "My tribe" group is just a normal group (id __mine__, rendered first
  // since it's unshifted) — fully editable here like any other.
  let html = '';
  // NOTE (beta): the remove-onclick escapes val for the HTML attr + JS string; a member
  // name containing a literal apostrophe could mis-round-trip vs the raw value stored in
  // the group array. Rare for real TW names; revisit (e.g. remove-by-index) if it bites.
  const memberChip = (id, type, val, icon) =>
    `<span class="map-chip">${icon} ${esc(val)}<a class="map-chip-x" title="${esc(t('map_remove'))}" onclick="removeMapGroupMember('${esc(id)}','${type}','${esc(val).replace(/'/g, "\\'")}')">✕</a></span>`;

  for (const g of mapGroups) {
    const chips = []
      .concat((g.coords  || []).map(c  => memberChip(g.id, 'coords',  c,  '📍')))
      .concat((g.players || []).map(p  => memberChip(g.id, 'players', p,  '👤')))
      .concat((g.tribes  || []).map(tt => memberChip(g.id, 'tribes',  tt, '🛡')))
      .join('');
    html += `<div class="map-grp">`
      + `<div class="map-grp-head">`
      +   `<input type="color" class="map-grp-color" value="${esc(g.color)}" onchange="setMapGroupColor('${esc(g.id)}',this.value)">`
      +   `<input type="text" class="map-grp-name" value="${esc(g.name)}" oninput="renameMapGroup('${esc(g.id)}',this.value)">`
      +   `<button class="map-grp-del" title="${esc(t('map_remove'))}" onclick="deleteMapGroup('${esc(g.id)}')">🗑</button>`
      + `</div>`
      + `<div class="map-grp-members">${chips || '<span class="map-grp-empty">—</span>'}</div>`
      + `<div class="map-grp-add">`
      +   `<input id="map-grp-add-${esc(g.id)}" class="map-grp-add-in" placeholder="${esc(t('map_add_member_ph'))}" list="map-tribe-list" onkeydown="if(event.key==='Enter'){event.preventDefault();addMapGroupMember('${esc(g.id)}');}">`
      +   `<button class="map-grp-add-btn" onclick="addMapGroupMember('${esc(g.id)}')">＋</button>`
      + `</div></div>`;
  }
  body.innerHTML = html;

  // tribe-tag suggestions for the member inputs
  const dl = document.getElementById('map-tribe-list');
  if (dl) dl.innerHTML = mapTribeList().slice(0, 80).map(tr => `<option value="${esc(tr.tag)}">`).join('');
}
