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

// ── Phase 2 state: color mode + tribe highlight + bonus filter ──
let mapColorMode = 'tribe';          // 'tribe' | 'player' | 'points' | 'none'
let mapHighlight = new Set();        // allyIds to emphasize (others dimmed); empty = all shown
let mapBonusOnly = false;            // dim non-bonus villages when true
let mapPrefsLoaded = false;
const MAP_DIM_ALPHA = 0.12;          // alpha for villages filtered out by highlight/bonus

const MAP_PREFS_KEY = 'tw_tribe_map';
function loadMapPrefs() {
  if (mapPrefsLoaded || typeof localStorage === 'undefined') { mapPrefsLoaded = true; return; }
  mapPrefsLoaded = true;
  try {
    const p = JSON.parse(localStorage.getItem(MAP_PREFS_KEY) || '{}');
    if (['tribe','player','points','none'].includes(p.colorMode)) mapColorMode = p.colorMode;
    if (Array.isArray(p.highlightedAllies)) mapHighlight = new Set(p.highlightedAllies.map(String));
    mapBonusOnly = !!p.bonusOnly;
  } catch (e) { /* corrupt prefs never break the map */ }
}
function saveMapPrefs() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MAP_PREFS_KEY, JSON.stringify({
      colorMode: mapColorMode, highlightedAllies: [...mapHighlight], bonusOnly: mapBonusOnly,
    }));
  } catch (e) { /* ignore quota/serialization errors */ }
}

// One predicate for both highlight and bonus-filter; villages that fail are dimmed
// (not hidden) so the highlight interaction stays visually consistent. Used in dot
// AND sprite rendering.
function isEmphasized(v) {
  if (mapBonusOnly && !v.bonus) return false;
  if (mapHighlight.size) {
    const ally = (typeof playerAllyDb !== 'undefined') ? playerAllyDb[v.playerId] : null;
    if (!ally || !mapHighlight.has(String(ally))) return false;
  }
  return true;
}

// ── Village sprites (map_new graphics, downloaded locally to icons/map/) ──
const MAP_SPRITE_KEYS = ['v1','v2','v3','v4','v5','v6','b1','b2','b3','b4','b5','b6'];
const MAP_GRASS = '#5c701b';   // the sprites' baked-in grass background (exact)
const MAP_SPRITE_MIN_SCALE = 12; // show sprites once a field is ≥12px; dots below
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
  const margin = spriteMode ? mapView.scale : 6;
  mapOffCtx.clearRect(0, 0, w, h);
  if (spriteMode) { mapOffCtx.fillStyle = MAP_GRASS; mapOffCtx.fillRect(0, 0, w, h); } // continuous terrain
  drawMapGrid(mapOffCtx, w, h);
  const dw = mapView.scale, dh = dw * 38 / 53; // one sprite ≈ one field
  const dimming = mapHighlight.size > 0 || mapBonusOnly;
  for (const v of villageDb) {
    const s = worldToScreen(v.x, v.y);
    if (s.px < -margin || s.py < -margin || s.px > w + margin || s.py > h + margin) continue; // cull
    mapOffCtx.globalAlpha = (dimming && !isEmphasized(v)) ? MAP_DIM_ALPHA : 1;
    if (spriteMode) {
      const img = mapSprites[mapSpriteKey(v)];
      if (img && img.complete && img.naturalWidth) mapOffCtx.drawImage(img, s.px - dw / 2, s.py - dh / 2, dw, dh);
    } else {
      const sz = mapDotSize(v.points) + (v.bonus ? 1 : 0);
      mapOffCtx.fillStyle = colorForVillage(v, mapColorMode); // tribe/player/points/none
      mapOffCtx.fillRect(s.px - sz / 2, s.py - sz / 2, sz, sz);
    }
  }
  mapOffCtx.globalAlpha = 1;
  const count = document.getElementById('map-count');
  if (count) count.textContent = t('map_villages_shown')(villageDb.length);
}

function drawMapGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(120,90,40,0.16)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= MAP_WORLD; k += 100) {
    const a = worldToScreen(k, 0), b = worldToScreen(k, MAP_WORLD);
    ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    const c = worldToScreen(0, k), d = worldToScreen(MAP_WORLD, k);
    ctx.beginPath(); ctx.moveTo(c.px, c.py); ctx.lineTo(d.px, d.py); ctx.stroke();
  }
}

// Blit cached offscreen + draw the hover ring. Cheap → safe on every mousemove.
function paintMap() {
  if (!mapCtx || !mapOffscreen) return;
  const w = mapCanvas.width, h = mapCanvas.height;
  mapCtx.clearRect(0, 0, w, h);
  mapCtx.fillStyle = '#0b0802';
  mapCtx.fillRect(0, 0, w, h);
  mapCtx.drawImage(mapOffscreen, 0, 0);
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
  renderMapLegend();
  renderMapOffscreen();
  paintMap();
}

// Called by setDbData() when the world DB (re)loads. Guarded: no-op until the
// map tab has been opened (and in the test sandbox, where mapInited stays false).
function mapRefresh() {
  if (!mapInited) return;
  if (isMapTabActive() && villageDb.length) {
    resizeMapCanvas();
    if (!mapFitted) { fitMapView(mapCanvas.width, mapCanvas.height); mapFitted = true; }
    renderMapLegend();
    renderMapOffscreen();
    paintMap();
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
    mapView.panX = mapDrag.panX0 + (p.x - mapDrag.x);
    mapView.panY = mapDrag.panY0 + (p.y - mapDrag.y);
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

function onMapMouseUp() { mapDrag = null; }
function onMapMouseLeave() { mapDrag = null; mapHoverCoord = null; hideMapTip(); paintMap(); }

function onMapWheel(e) {
  e.preventDefault();
  const p = mapEventXY(e);
  const wpt = screenToWorld(p.x, p.y);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  mapView.scale = clampMapScale(mapView.scale * factor);
  mapView.panX = p.x - wpt.x * mapView.scale; // keep world point under cursor fixed
  mapView.panY = p.y - wpt.y * mapView.scale;
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
  mapView.panY = cy - wpt.y * mapView.scale;
  renderMapOffscreen(); paintMap();
}

function mapResetView() {
  if (!mapInited) return;
  fitMapView(mapCanvas.width, mapCanvas.height);
  renderMapOffscreen(); paintMap();
}

// ── Phase 2: color-mode / bonus-filter / tribe-highlight controls ──
function repaintMapData() { if (mapInited) { renderMapOffscreen(); paintMap(); } }

function setMapColorMode(mode) {
  mapColorMode = ['tribe','player','points','none'].includes(mode) ? mode : 'tribe';
  saveMapPrefs();
  repaintMapData();
}

function setMapBonusOnly(on) {
  mapBonusOnly = !!on;
  saveMapPrefs();
  repaintMapData();
}

function toggleTribeHighlight(allyId) {
  allyId = String(allyId);
  if (mapHighlight.has(allyId)) mapHighlight.delete(allyId); else mapHighlight.add(allyId);
  saveMapPrefs();
  renderMapLegend();
  repaintMapData();
}

function clearMapHighlight() {
  if (!mapHighlight.size) return;
  mapHighlight.clear();
  saveMapPrefs();
  renderMapLegend();
  repaintMapData();
}

// Reflect persisted state into the toolbar controls (called after prefs load).
function syncMapToolbar() {
  const sel = document.getElementById('map-color-mode');
  if (sel) sel.value = mapColorMode;
  const cb = document.getElementById('map-bonus-only');
  if (cb) cb.checked = mapBonusOnly;
}

// Build the tribe legend / highlight panel from mapTribeList(). DOM-only (browser).
function renderMapLegend() {
  const list = document.getElementById('map-legend-list');
  const panel = document.getElementById('map-legend');
  if (!list || !panel) return;
  const tribes = mapTribeList();
  if (!tribes.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  const filter = (document.getElementById('map-legend-search')?.value || '').toLowerCase();
  const clearBtn = document.getElementById('map-legend-clear');
  if (clearBtn) clearBtn.style.visibility = mapHighlight.size ? 'visible' : 'hidden';
  const shown = filter
    ? tribes.filter(tr => tr.tag.toLowerCase().includes(filter) || tr.name.toLowerCase().includes(filter))
    : tribes;
  list.innerHTML = shown.slice(0, 60).map(tr => {
    const on = mapHighlight.has(String(tr.allyId));
    return `<div class="map-lg-item${on ? ' on' : ''}" onclick="toggleTribeHighlight('${esc(tr.allyId)}')" title="${esc(tr.name)}">`
      + `<span class="map-lg-sw" style="background:${tr.color}"></span>`
      + `<span class="map-lg-tag">${esc(tr.tag)}</span>`
      + `<span class="map-lg-cnt">${tr.count}</span></div>`;
  }).join('');
}
