// ══════════════════════════════════════════════════════════════
// FILE HANDLING
// ══════════════════════════════════════════════════════════════
function handleFileInput(input) {
  if (input.files && input.files.length) loadFiles(input.files);
}
function onDragOver(e)  { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
}
function loadFiles(fileList) {
  const files = [...fileList];
  const results = new Array(files.length);
  let done = 0;
  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = ev => {
      results[i] = ev.target.result;
      if (++done === files.length) {
        // A tribeInfo v3 JSON export (everything / all_troops / buildings / single-view) is
        // converted to the tribe_all_troops CSV shape parseData already reads, and any building
        // levels are collected into a batch-local map. Later JSON files win on overlapping coords
        // (Object.assign), mirroring the multi-file last-file-wins convention elsewhere.
        const bldgs = {};
        let sawJson = false;
        const texts = results.map(text => {
          const ej = (typeof parseEverythingJson === 'function') ? parseEverythingJson(text) : null;
          if (!ej) return text;
          sawJson = true;
          Object.assign(bldgs, ej.buildings);
          return ej.csv;
        });
        // merge: keep first header, strip headers from subsequent files
        const isHeader = line => /^coords?[,\t]/i.test(line.trim());
        const merged = texts.map((text, idx) =>
          idx === 0 ? text : text.split('\n').filter(l => !isHeader(l)).join('\n')
        ).join('\n');
        const label = files.length === 1 ? files[0].name : `${files.length} files`;
        finishTroopLoad(merged, label, sawJson, bldgs);
      }
    };
    reader.readAsText(file);
  });
}
function loadFromPaste() {
  const text = document.getElementById('paste-input').value.trim();
  if (!text) return;
  const ej = (typeof parseEverythingJson === 'function') ? parseEverythingJson(text) : null;
  const bldgs = {};
  let merged = text, sawJson = false;
  if (ej) { sawJson = true; Object.assign(bldgs, ej.buildings); merged = ej.csv; }
  finishTroopLoad(merged, 'pasted data', sawJson, bldgs);
}

// Shared tail of loadFiles/loadFromPaste. `merged` is already in the CSV shape parseData reads
// (any JSON exports converted upstream); `sawJson`/`bldgs` carry building levels from a tribeInfo
// v3 JSON in the batch. Rule for buildingsByCoord: a buildings-ONLY drop (JSON with no troop rows,
// no accompanying troop text) ENRICHES the existing troops with building levels without re-parsing
// (which would wipe the loaded army); ANY other batch sets buildingsByCoord to exactly this batch's
// buildings ({} when the batch had none — stale smith levels never linger to silently gate a plan).
function finishTroopLoad(merged, label, sawJson, bldgs) {
  const isHeaderLine = line => /^coords?[,\t]/i.test(line.trim());
  const hasTroopData = merged.split('\n').some(l => { const s = l.trim(); return s && !isHeaderLine(l); });
  if (sawJson && !hasTroopData && Object.keys(bldgs).length) {
    buildingsByCoord = bldgs;            // enrichment-only: keep troops, attach/refresh smith levels
    persistBuildings();
    updateBuildingsStatus();
    if (typeof renderOffTargets === 'function') renderOffTargets(); // snob picker labels depend on smith levels
    return;
  }
  buildingsByCoord = sawJson ? bldgs : {};
  parseData(merged, label);
  persistTroops(merged, label);
  updateBuildingsStatus();
  if (typeof cloudSyncData === 'function') cloudSyncData(merged); // hosted-site cloud save (CSV; the raw JSON is not synced)
}

// Append/refresh a "🏰 buildings: N villages" note on the file-summary line (idempotent — strips a
// prior 🏰 suffix first, so repeated loads never stack). No-op suffix when no buildings are loaded.
function updateBuildingsStatus() {
  const el = document.getElementById('file-summary');
  if (!el) return;
  const base = (el.textContent || '').replace(/\s*·\s*🏰.*$/, '');
  const n = Object.keys(buildingsByCoord).length;
  el.textContent = n ? (base ? `${base} · 🏰 ${t('buildings_loaded')(n)}` : `🏰 ${t('buildings_loaded')(n)}`) : base;
}

// ── Persist the uploaded/pasted troop text so it survives across sessions ──
// Stored as raw text (re-parsed on next load); replaced only when new files are
// uploaded or new data pasted, and cleared by the ✕ Clear button. Wrapped so a
// quota failure (very large troop file) never breaks the load itself.
const TROOP_KEY = 'tw_tribe_troops';
function persistTroops(text, filename) {
  if (!villages.length) return; // don't persist a parse that produced nothing
  const payload = { text, filename, savedAt: new Date().toISOString() };
  if (Object.keys(buildingsByCoord).length) payload.buildings = buildingsByCoord; // building levels ride along (from a tribeInfo v3 JSON)
  lsSaveC(TROOP_KEY, payload); // compressed — raw troop text is highly compressible
}
// Attach the current building levels to the already-stored troop payload (buildings-only JSON drop).
// If nothing is stored yet there's no army to enrich, so it stays session-only (no synthetic save).
function persistBuildings() {
  const d = lsLoadC(TROOP_KEY);
  if (!d || !d.text) return;
  d.buildings = buildingsByCoord;
  lsSaveC(TROOP_KEY, d);
}
function autoloadTroops() {
  if (villages.length) return; // a real upload this session takes precedence
  const d = lsLoadC(TROOP_KEY); // compressed (LZ1:) or legacy uncompressed JSON
  if (!d || !d.text) return;
  parseData(d.text, d.filename || t('imported_troops'));
  if (villages.length) {
    buildingsByCoord = d.buildings || {}; // restore smith levels alongside the troops (empty if the save predates buildings)
    updateBuildingsStatus();
    const txt = document.getElementById('file-status-text');
    if (txt) txt.textContent += ` · ${t('troops_restored')}`;
  }
}

function clearData() {
  villages = []; players = {}; buildingsByCoord = {};
  try { localStorage.removeItem(TROOP_KEY); } catch {} // also drop the persisted copy
  document.getElementById('file-dot').className = 'file-status-dot dot-off';
  document.getElementById('file-status-text').textContent = t('status_no_file');
  document.getElementById('file-status-text').className = '';
  document.getElementById('file-summary').textContent = '';
  document.getElementById('paste-input').value = '';
  document.getElementById('overview-drop').style.display = '';
  document.getElementById('overview-content').style.display = 'none';
  document.getElementById('players-tbody').innerHTML = `<tr class="empty-row"><td colspan="17">${t('empty_load_players')}</td></tr>`;
  document.getElementById('villages-tbody').innerHTML = `<tr class="empty-row"><td colspan="17">${t('empty_load_villages')}</td></tr>`;
  const outboundTbody = document.getElementById('outbound-tbody');
  if (outboundTbody) outboundTbody.innerHTML = `<tr class="empty-row"><td colspan="13">${t('empty_load_villages')}</td></tr>`;
  const outboundSummary = document.getElementById('outbound-summary');
  if (outboundSummary) outboundSummary.textContent = '';
  document.getElementById('rankings-content').innerHTML = `<div style="color:#5a3a18;padding:36px;text-align:center;">${t('empty_load_rankings')}</div>`;
  renderTargetTable();
}

// ══════════════════════════════════════════════════════════════
// PARSING
// ══════════════════════════════════════════════════════════════
// Off/def power + type classification for a troop-village row, derived from its unit
// counts. Used by parseData (initial parse) AND the By-Villages manual edit, so the two
// never diverge. Mutates vil in place (sets offPow / defInf / defCav / type).
// Power is scored from a simple fixed unit list each (v3.7.1). Off = the clearing/siege
// units + the noble; Def = only the dedicated defensive units. Hybrid/offensive units
// (light cav, catapult, scout) are deliberately kept OUT of def power so a full off
// village doesn't read as having large phantom defence.
const OFF_UNITS = ['axe','light','ram','catapult','snob'];
const DEF_UNITS = ['spear','sword','heavy','knight'];
function applyVilDerived(vil) {
  vil.offPow = OFF_UNITS.reduce((s,u) => s + (vil[u] || 0) * ATT[u],  0);
  vil.defInf = DEF_UNITS.reduce((s,u) => s + (vil[u] || 0) * DINF[u], 0);
  vil.defCav = DEF_UNITS.reduce((s,u) => s + (vil[u] || 0) * DCAV[u], 0);
  vil.popUsed = UNITS.reduce((s,u) => s + (vil[u] || 0) * POP[u], 0); // farm pop used by troops
  const totalUnits = UNITS.reduce((s,u) => s + (vil[u] || 0), 0);
  let type = 'empty';
  if (totalUnits > 0) {
    const offScore = vil.axe + vil.light + vil.ram;
    const defScore = vil.spear + vil.sword + vil.heavy + vil.knight;
    if (offScore > defScore * 2)      type = 'off';
    else if (defScore > offScore * 2) type = 'def';
    else                              type = 'mixed';
  }
  vil.type = type;
}
// Re-sum a player's aggregate (totals + off/def power) from its villages — called after a
// manual edit changes one of them. Idempotent.
function recomputePlayerAggregate(name) {
  const p = players[name];
  if (!p) return;
  p.totals = Object.fromEntries(UNITS.map(u => [u, 0]));
  p.offPow = 0; p.defInf = 0; p.defCav = 0;
  for (const v of p.villages) {
    UNITS.forEach(u => { p.totals[u] += (v[u] || 0); });
    p.offPow += v.offPow; p.defInf += v.defInf; p.defCav += v.defCav;
  }
}

// Build a stationed/inbound troops row (defense / incoming types) from parsed unit counts.
// Mirrors the owned-troop derived fields (offPow / defInf / defCav) via applyVilDerived so
// the map tooltip can show the same power numbers. NOT pushed to villages/players — those
// stay owned-troop-only; this is map-tooltip data keyed by coord.
function deriveStationRow(coord, player, units) {
  const r = { coord, player, ...units };
  applyVilDerived(r); // offPow / defInf / defCav (+ type / popUsed, harmless here)
  return r;
}

// Convert a tribeInfo v3 JSON export ("everything" / "all_troops" / "buildings" / single-view) into
// the tribe_all_troops CSV shape parseData already understands, plus a compact per-village building
// map — so the calculator ingests the JSON without ever storing the (multi-MB) raw text: it's parsed
// on load into the same lightweight village rows a .txt would produce. Returns null for anything
// that isn't a tribeInfo v3 JSON (leading '{' + a `villages` array), so plain-CSV loads fall through
// unchanged. Each present block maps to a CSV row type: troops→troops (+ trailing incoming_attacks),
// in_village→defense, enroute→incoming. Units are read by OUR UNITS keys (extra archer-world units
// are ignored, matching the CSV path); missing keys → 0. Pure — no DOM. { csv, buildings, nTroops,
// nBuildings }.
function parseEverythingJson(text) {
  const s = String(text || '').trim();
  if (s[0] !== '{') return null;
  let obj;
  try { obj = JSON.parse(s); } catch { return null; }
  if (!obj || !Array.isArray(obj.villages)) return null;
  const COORD_RE = /^\d{1,3}\|\d{1,3}$/;
  const unitCsv = block => UNITS.map(u => (block && block[u] != null ? (parseInt(block[u]) || 0) : 0)).join(',');
  const rows = [];
  const buildings = {};
  let nTroops = 0, nBuildings = 0;
  for (const v of obj.villages) {
    const coord = (v && typeof v.coords === 'string') ? v.coords.trim() : '';
    if (!COORD_RE.test(coord)) continue;
    const player = (v.player != null ? v.player : '').toString();
    if (v.troops) {
      const inc = v.incoming_attacks != null ? (parseInt(v.incoming_attacks) || 0) : '';
      rows.push(`${coord},${player},troops,${unitCsv(v.troops)},${inc},`);
      nTroops++;
    }
    if (v.in_village) rows.push(`${coord},${player},defense,${unitCsv(v.in_village)},,`);
    if (v.enroute)    rows.push(`${coord},${player},incoming,${unitCsv(v.enroute)},,`);
    if (v.buildings && typeof v.buildings === 'object') {
      const b = {};
      for (const k in v.buildings) { const n = parseInt(v.buildings[k]); if (!isNaN(n)) b[k] = n; }
      buildings[coord] = b;
      nBuildings++;
    }
  }
  const csv = 'Coords,Player,Type,' + UNITS.join(',') + ',IncomingAttacks,\n' + rows.join('\n');
  return { csv, buildings, nTroops, nBuildings };
}

function parseData(text, filename) {
  villages = [];
  players  = {};
  troopByCoord = {};
  defenseByCoord = {};
  incomingByCoord = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // tribe_everything.txt (from tribeInfo.js) inserts a "Type" column (troops/defense/
  // incoming) at index 2, shifting the unit columns right by one. Detect it per-row
  // (cols[2] is a type label, not a unit count) so a multi-file upload can mix the
  // everything format with the plain tribe info.txt format in any order. "troops" rows
  // feed villages/players (owned troops); "defense" (stationed in the village) and
  // "incoming" (inbound/returning) rows feed the map tooltip only.
  const TYPE_LABELS = ['troops', 'defense', 'incoming'];

  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim());
    if (!cols[0] || cols[0].toLowerCase() === 'coords') continue; // skip header

    const rowType = (cols[2] || '').toLowerCase();
    const hasType = TYPE_LABELS.includes(rowType);
    const base = hasType ? 3 : 2; // index of the first unit column

    const coord  = cols[0];
    const player = cols[1] || 'Unknown';
    const units  = {};
    UNITS.forEach((u, i) => { units[u] = parseInt(cols[base + i]) || 0; });

    // defense / incoming rows: map-tooltip data only — never touch villages/players.
    if (hasType && rowType === 'defense')  { defenseByCoord[coord]  = deriveStationRow(coord, player, units); continue; }
    if (hasType && rowType === 'incoming') { incomingByCoord[coord] = deriveStationRow(coord, player, units); continue; }
    // Optional "Incoming" column (incoming attacks), read positionally from the slot right
    // after the last unit. Read per-row (NOT from the header) so a multi-file upload that
    // mixes files WITH and WITHOUT the column works in any order: a row missing the column
    // lands on the trailing-comma empty string → parseInt → NaN → 0. See tribeInfo.js export.
    const incoming = parseInt(cols[base + UNITS.length]) || 0;

    const vil = { coord, player, ...units, incoming };
    applyVilDerived(vil); // offPow / defInf / defCav / type
    villages.push(vil);
    troopByCoord[coord] = vil; // index for the map hover/badges

    if (!players[player]) {
      players[player] = { villages: [], totals: Object.fromEntries(UNITS.map(u => [u,0])), offPow:0, defInf:0, defCav:0 };
    }
    players[player].villages.push(vil);
    UNITS.forEach(u => { players[player].totals[u] += units[u]; });
    players[player].offPow += vil.offPow;
    players[player].defInf += vil.defInf;
    players[player].defCav += vil.defCav;
  }

  // Status bar
  const playerCount = Object.keys(players).length;
  document.getElementById('file-dot').className = 'file-status-dot dot-ok';
  const txt = document.getElementById('file-status-text');
  txt.textContent = filename;
  txt.className = 'connected';
  document.getElementById('file-summary').textContent =
    `${villages.length} villages · ${playerCount} players`;

  renderOverview();
  renderPlayersTable();
  renderVillagesTable();
  if (typeof renderOutboundTable === 'function') renderOutboundTable(); // needs the station rows
  renderRankings();
  renderTargetTable();
  renderOffTargets(); // sender picker depends on the troop data
  if (typeof renderOffIgnorePlayers === 'function') renderOffIgnorePlayers(); // ignore-players picker too
  if (typeof renderDefIgnorePlayers === 'function') renderDefIgnorePlayers(); // Plan-Defense ignore-players picker too
  if (typeof renderOffMvPlayers === 'function') renderOffMvPlayers(); // MV-pairs picker too
  if (typeof renderDefMvPlayers === 'function') renderDefMvPlayers(); // Plan-Defense MV-pairs picker too
  if (typeof mapDetectAndSeed === 'function') mapDetectAndSeed(); // map: detect uploading tribe + seed My-tribe group
  if (typeof mapRefresh === 'function') mapRefresh();             // recolor map if it's open

  document.getElementById('overview-drop').style.display = 'none';
  document.getElementById('overview-content').style.display = '';
}

