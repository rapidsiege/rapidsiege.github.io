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
        // levels are collected into a batch-local map (Object.assign: a later JSON's levels win
        // for a coord two JSONs both carry). Troop rows are deduplicated by coord in parseData
        // itself — the LAST row for a coord wins, whichever file it came from.
        const bldgs = {};
        let sawJson = false;
        const texts = results.map((text, idx) => {
          const ej = (typeof parseEverythingJson === 'function') ? parseEverythingJson(text) : null;
          if (!ej) return typeStationFile(text, files[idx].name); // untyped tribe_defense/_incoming.txt → typed station rows
          sawJson = true;
          Object.assign(bldgs, ej.buildings);
          return ej.csv;
        });
        // Merge: every file KEEPS its own header line — parseData maps each file's unit columns
        // by the header above them (column order differs between exports and on archer worlds).
        const merged = texts.join('\n');
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
// Exception: a batch WITHOUT a single owned-troop row but with station rows (a lone tribe_defense /
// tribe_incoming file, a station-only JSON) or rejected rows (a buildings .txt) is merged into the
// army already loaded instead of blanking it — see below.
// The raw text + label of the army currently loaded (set by every load that produced villages,
// '' = none): what such a station-only batch is merged into.
let troopText = '', troopLabel = '';
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
  const prevBldgs = buildingsByCoord, hadArmy = villages.length > 0 && !!troopText;
  buildingsByCoord = sawJson ? bldgs : {};
  parseData(merged, label);
  let text = merged, lbl = label;
  const newDef = defenseByCoord, newInc = incomingByCoord;
  const nStation = Object.keys(newDef).length + Object.keys(newInc).length, nBldgs = Object.keys(bldgs).length;
  if (!villages.length && (nStation || nBldgs || lastParseStats.rejected)) {
    if (hadArmy) {
      // No owned troops in this batch: it used to blank the army on screen while the stored copy
      // (persistTroops skips an empty parse) brought it back on reload WITHOUT these rows. Merge
      // instead: what is shown is a parse of (the loaded army's text + this batch's station rows)
      // and that exact text is what gets persisted, so a reload shows the same thing. The army's
      // own rows for the same coord + type are dropped first (the new ones would win anyway), so
      // dropping the same file again replaces its rows instead of piling them up.
      const stale = l => { const c = l.split(','), co = (c[0] || '').trim(), ty = (c[2] || '').trim().toLowerCase();
        return (ty === 'defense' && co in newDef) || (ty === 'incoming' && co in newInc); };
      if (nStation) text = troopText.split('\n').filter(l => !stale(l)).join('\n') + '\n' + merged;
      else text = troopText; // a buildings .txt (rows rejected) / buildings-only levels: nothing to add to the text
      lbl = troopLabel; // never the station file's name: parseData re-types rows by a tribe_defense / tribe_incoming label
      buildingsByCoord = nBldgs ? { ...prevBldgs, ...bldgs } : prevBldgs;
      parseData(text, lbl);
      lastParseStats.merged = { file: label, n: nStation };
      renderFileSummary();
      if (!nStation && !nBldgs) { updateBuildingsStatus(); return; } // the stored army is unchanged
    } else if (nStation || nBldgs) {
      lastParseStats.alone = true; // no army to merge into: shown for now, not persisted (0 villages)
      renderFileSummary();
    }
  }
  persistTroops(text, lbl);
  troopText = villages.length ? text : ''; troopLabel = villages.length ? lbl : '';
  updateBuildingsStatus();
  // hosted-site cloud save (CSV; the raw JSON is not synced) — like persistTroops, never for a
  // batch that parsed to no villages (a lone buildings .txt, a junk paste): it would overwrite
  // the cloud copy of the last real troop file. A merged batch pushes the merged text.
  if (villages.length && typeof cloudSyncData === 'function') cloudSyncData(text);
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
// uploaded or new data pasted, and cleared by the ✕ Clear button. A quota failure
// (very large troop file) never breaks the load itself — the data stays shown for
// this session and the user is told it won't survive a reload.
const TROOP_KEY = 'tw_tribe_troops';
function persistTroops(text, filename) {
  if (!villages.length) return; // don't persist a parse that produced nothing
  const payload = { text, filename, savedAt: new Date().toISOString() };
  if (Object.keys(buildingsByCoord).length) payload.buildings = buildingsByCoord; // building levels ride along (from a tribeInfo v3 JSON)
  // compressed — raw troop text is highly compressible; false = even that didn't fit
  if (!lsSaveC(TROOP_KEY, payload) && typeof alert === 'function') alert(t('md_storage_full'));
}
// Attach the current building levels to the already-stored troop payload (buildings-only JSON drop).
// If nothing is stored yet there's no army to enrich, so it stays session-only (no synthetic save).
function persistBuildings() {
  const d = lsLoadC(TROOP_KEY);
  if (!d || !d.text) return;
  d.buildings = buildingsByCoord;
  if (!lsSaveC(TROOP_KEY, d) && typeof alert === 'function') alert(t('md_storage_full'));
}
function autoloadTroops() {
  if (villages.length) return; // a real upload this session takes precedence
  const d = lsLoadC(TROOP_KEY); // compressed (LZ1:) or legacy uncompressed JSON
  if (!d || typeof d.text !== 'string' || !d.text) return;
  const label = d.filename || t('imported_troops');
  let text = d.text;
  parseData(text, label);
  // A text saved before 6.1.3 kept only the FIRST file's header. With a buildings export first,
  // that header now rejects every row below it — the troop rows of the later files included — and
  // the save loads as 0 villages. Re-read it without the rejected header (the positional layout the
  // old build used), skipping the buildings rows themselves: under a rejected header a row with that
  // header's column count, or whose 3rd column is neither a count nor a row type (a village name), is
  // dropped. Kept only if it yields villages; otherwise the original parse (and its notes) is shown.
  if (!villages.length && lastParseStats && lastParseStats.rejected) {
    let rej = null; // column count of the rejected header above the current row (null = none)
    const fixed = text.split('\n').filter(line => {
      const cols = line.split(',').map(c => c.trim());
      if (/^coords?$/i.test(cols[0])) { rej = troopHeaderLayout(cols).reject ? cols.length : null; return rej === null; }
      if (rej === null || !cols[0]) return true;
      const c2 = (cols[2] || '').toLowerCase();
      return cols.length !== rej && (TROOP_TYPE_LABELS.includes(c2) || !parseTroopCount(c2).bad);
    }).join('\n');
    parseData(fixed, label);
    if (villages.length) text = fixed; else parseData(text, label);
  }
  if (villages.length) {
    troopText = text; troopLabel = label; // what a later lone station file is merged into
    buildingsByCoord = d.buildings || {}; // restore smith levels alongside the troops (empty if the save predates buildings)
    updateBuildingsStatus();
    const txt = document.getElementById('file-status-text');
    if (txt) txt.textContent += ` · ${t('troops_restored')}`;
  }
}

function clearData() {
  villages = []; players = {}; buildingsByCoord = {};
  // Every other per-load index parseData builds goes too: the owned-troop index (map badges,
  // incoming halos, hover), the station dicts (else hasStationData() stays true and Manage
  // Defense keeps inferring support from the cleared file) and the detected own tribes.
  troopByCoord = {}; defenseByCoord = {}; incomingByCoord = {};
  if (typeof myAllyIds !== 'undefined') myAllyIds = [];
  lastParseStats = null;
  troopText = ''; troopLabel = '';
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
  // Plan Defense: its three summaries (and the Manage Defense table it tail-renders) read the
  // troops + station dicts — with them gone the summaries clear and the estimates drop out.
  if (typeof renderDefPlanTable === 'function') renderDefPlanTable();
  if (typeof repaintMapData === 'function') repaintMapData(); // the cleared troops' badges / halos leave the map
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
    const k = PARAMS.typeRatio; // 🎚 off when off units > k × def units (and the reverse)
    if (offScore > defScore * k)      type = 'off';
    else if (defScore > offScore * k) type = 'def';
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
    // The name lands in a CSV cell: a literal comma (or line break) would shift every column after
    // it, so it is written %-encoded — the same form player.txt (and so the .txt export) uses, which
    // decode() turns back for display and the DB name matching already expects.
    const player = (v.player != null ? v.player : '').toString().replace(/[,\r\n]/g, encodeURIComponent);
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

// ── Troop-file layout ─────────────────────────────────────────────────────────
// tribe_all_troops.txt (tribeInfo) inserts a "Type" column (troops/defense/incoming) at
// index 2, shifting the unit columns right by one. The type is detected PER ROW (cols[2]
// is a type label, not a unit count) so a batch can mix typed and plain files in any
// order — and so texts saved before every file kept its own header (one typed header
// over plain rows, or the reverse) still line up. "troops" rows feed villages/players
// (owned troops); "defense" (stationed in the village) and "incoming" (inbound /
// returning) rows feed the station dicts (map tooltip, Outbound Offs, Plan Defense).
const TROOP_TYPE_LABELS = ['troops', 'defense', 'incoming'];
// A troop coordinate. Anything else in the first column (a "Total" line, junk, an injected
// string) is skipped and counted — coords end up in table cells and click handlers.
const TROOP_COORD_RE = /^\d{1,3}\|\d{1,3}$/;
// Before any header line: the classic positional layout — UNITS in order, then the
// optional incoming-attacks slot right after the last unit.
const TROOP_LAYOUT_POSITIONAL = { unit: Object.fromEntries(UNITS.map((u, i) => [u, i])), inc: UNITS.length };
// A header line ("Coords,Player,[Type,]<columns>") → where each unit sits, BY NAME, counted
// from the first column after Coords,Player[,Type] (so a row reads field j at cols[base + j],
// base = 3 for a typed row, 2 otherwise). Unit columns the calculator doesn't model (archer
// worlds' archer/marcher, militia, …) just take their slot. The incoming-attacks column is
// IncomingAttacks (older exports: Incoming); a header without it keeps the old read of the
// slot after the last unit column — the header's trailing-comma (empty-name) slot, so an
// unmodelled unit there is never taken for incoming — where a row lacking the column holds
// '' → 0. A header with Village / Points (the buildings export) or without a single known
// unit is REJECTED: its rows are skipped and counted, never read as troops.
function troopHeaderLayout(cols) {
  const names = cols.map(c => String(c).trim().toLowerCase());
  const fields = names.slice(names[2] === 'type' ? 3 : 2);
  if (fields.includes('village') || fields.includes('points')) return { reject: 'buildings' };
  const unit = {};
  for (const u of UNITS) { const j = fields.indexOf(u); if (j >= 0) unit[u] = j; }
  const idx = Object.values(unit);
  if (!idx.length) return { reject: 'nounits' };
  const named = fields.findIndex(f => f === 'incomingattacks' || f === 'incoming');
  const last = Math.max(...idx);
  const blank = fields.findIndex((f, j) => j > last && f === '');
  return { unit, inc: named >= 0 ? named : blank >= 0 ? blank : last + 1 };
}
// One count cell → { n, bad }. Empty / "." / "-" are a plain 0 (every row ends in a
// trailing-comma ''). Accepts thousands separators ("1.234", "1 234", "1'234") and a k
// suffix ("2k", "2.5k"); anything else is flagged bad and read as its leading integer
// (the old parseInt behaviour), never negative.
function parseTroopCount(s) {
  const raw = String(s == null ? '' : s).trim();
  if (raw === '' || raw === '.' || raw === '-') return { n: 0, bad: false };
  const v = raw.replace(/[\s\u00a0\u202f']/g, '');
  if (/^\d+$/.test(v)) return { n: parseInt(v, 10), bad: false };
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) return { n: parseInt(v.replace(/\./g, ''), 10), bad: false };
  const k = /^(\d+(?:\.\d+)?)k$/i.exec(v);
  if (k) return { n: Math.round(parseFloat(k[1]) * 1000), bad: false };
  const n = parseInt(v, 10);
  return { n: n > 0 ? n : 0, bad: true };
}
// tribeInfo v4/v5 save the single-view station exports as tribe_defense.txt / tribe_incoming.txt
// with an UNTYPED header (Coords,Player,<units>,) — the same shape as an owned-troops file
// without the IncomingAttacks column, so their content can't tell them apart and they used to
// be read as OWNED troops (allied support counted as the owner's army). The FILE NAME is the
// one reliable signal: such a file is rewritten into the typed shape (Type column + a
// defense/incoming label on every row) so its rows feed the station dicts, and the label
// survives persistence / cloud sync. Other names, already-typed rows and pasted text (no
// name) pass through unchanged — a pasted untyped defense view still reads as troops.
function typeStationFile(text, name) {
  const m = /tribe_(defense|incoming)/i.exec(String(name || ''));
  if (!m) return text;
  const type = m[1].toLowerCase();
  return String(text || '').split('\n').map(line => {
    const cols = line.split(',');
    if (cols.length < 3 || !cols[0].trim()) return line;
    const c2 = cols[2].trim().toLowerCase();
    if (/^coords?$/i.test(cols[0].trim())) { if (c2 !== 'type') cols.splice(2, 0, 'Type'); return cols.join(','); }
    if (TROOP_TYPE_LABELS.includes(c2)) return line; // already typed
    cols.splice(2, 0, type);
    return cols.join(',');
  }).join('\n');
}

// Skip/replace counts of the last parseData, for the status line (null = nothing loaded).
let lastParseStats = null;
// The file-summary status line: "N villages · M players", then one ⚠ note per kind of row
// the parse replaced or skipped (so a dropped buildings .txt or a junk line never goes
// unnoticed). updateBuildingsStatus() appends its 🏰 note after this.
function renderFileSummary() {
  const el = document.getElementById('file-summary');
  if (!el) return;
  const s = lastParseStats;
  if (!s) { el.textContent = ''; return; }
  const parts = [t('file_summary')(villages.length, Object.keys(players).length)];
  if (s.dupes)    parts.push(t('load_warn_dupes')(s.dupes));
  if (s.rejected) parts.push(t('load_warn_rejected')(s.rejected));
  if (s.badCoord) parts.push(t('load_warn_bad_coords')(s.badCoord));
  if (s.badNum)   parts.push(t('load_warn_bad_nums')(s.badNum));
  if (s.merged)   parts.push(t('load_merged_into_army')(s.merged.file, s.merged.n)); // finishTroopLoad merge
  if (s.alone)    parts.push(t('load_station_alone'));
  el.textContent = parts.join(' · ');
}

function parseData(text, filename) {
  villages = [];
  players  = {};
  troopByCoord = {};
  defenseByCoord = {};
  incomingByCoord = {};
  // A lone untyped tribe_defense/_incoming.txt (or a save of one made before loadFiles typed
  // files per name) is routed by its label here too — a no-op for any other label.
  const lines = typeStationFile(String(text || ''), filename).split('\n').map(l => l.trim()).filter(l => l);

  const stats = { dupes: 0, rejected: 0, badCoord: 0, badNum: 0 };
  let layout = TROOP_LAYOUT_POSITIONAL; // until a header line maps the columns below it
  // Owned-troop rows by coord. The same village can arrive twice (tribe_all_troops +
  // tribe_troops, a file dropped twice, a player listed under two tribes): the LAST row
  // wins — like the station dicts — and the village is counted once. Map.set keeps the
  // first-seen position, so a batch without duplicates keeps its exact order.
  const owned = new Map();
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim());
    if (/^coords?$/i.test(cols[0])) { layout = troopHeaderLayout(cols); continue; } // each file's header
    if (!cols[0]) continue;
    if (layout.reject) { stats.rejected++; continue; }
    if (!TROOP_COORD_RE.test(cols[0])) { stats.badCoord++; continue; }

    const rowType = (cols[2] || '').toLowerCase();
    const hasType = TROOP_TYPE_LABELS.includes(rowType);
    // The 3rd column of a troop row is a count (plain layout) or a row type (typed layout). Anything
    // else is not a troop row: a pre-6.1.3 save kept only the FIRST file's header, so tribe_buildings
    // rows (Coords,Player,Village,Points,…) can sit under a troop header with the village NAME there —
    // read as troops, such a row would REPLACE the village's real row (the last row of a coord wins).
    // Rejected and counted like the rows under a buildings header (the same test autoloadTroops uses).
    if (!hasType && parseTroopCount(cols[2]).bad) { stats.rejected++; continue; }
    const base = hasType ? 3 : 2; // index of the first column after Coords,Player[,Type]
    const cell = j => {
      if (j == null || j < 0) return 0;
      const r = parseTroopCount(cols[base + j]);
      if (r.bad) stats.badNum++;
      return r.n;
    };

    const coord  = cols[0];
    const player = cols[1] || t('player_unknown');
    const units  = {};
    for (const u of UNITS) units[u] = cell(layout.unit[u]);

    // defense / incoming rows: station data only — never touch villages/players.
    if (hasType && rowType === 'defense')  { defenseByCoord[coord]  = deriveStationRow(coord, player, units); continue; }
    if (hasType && rowType === 'incoming') { incomingByCoord[coord] = deriveStationRow(coord, player, units); continue; }
    // Optional incoming-attacks column — read per row, so a batch mixing files with and
    // without it works in any order (see troopHeaderLayout and the tribeInfo.js export).
    const incoming = cell(layout.inc);

    const vil = { coord, player, ...units, incoming };
    applyVilDerived(vil); // offPow / defInf / defCav / type
    if (owned.has(coord)) stats.dupes++;
    owned.set(coord, vil);
  }

  // villages / players / troopByCoord from the deduplicated rows, so every aggregate
  // counts each village exactly once.
  for (const vil of owned.values()) {
    villages.push(vil);
    troopByCoord[vil.coord] = vil; // index for the map hover/badges
    const p = players[vil.player] || (players[vil.player] =
      { villages: [], totals: Object.fromEntries(UNITS.map(u => [u, 0])), offPow: 0, defInf: 0, defCav: 0 });
    p.villages.push(vil);
    UNITS.forEach(u => { p.totals[u] += vil[u]; });
    p.offPow += vil.offPow;
    p.defInf += vil.defInf;
    p.defCav += vil.defCav;
  }
  lastParseStats = stats;

  // Status bar
  document.getElementById('file-dot').className = 'file-status-dot dot-ok';
  const txt = document.getElementById('file-status-text');
  txt.textContent = filename;
  txt.className = 'connected';
  renderFileSummary();

  renderOverview();
  renderPlayersTable();
  renderVillagesTable();
  if (typeof renderOutboundTable === 'function') renderOutboundTable(); // needs the station rows
  if (typeof renderReturningTable === 'function') renderReturningTable(); // ↩ Tier + Outbound-tab columns read the troops too
  renderRankings();
  renderTargetTable();
  renderOffTargets(); // sender picker depends on the troop data
  if (typeof renderOffIgnorePlayers === 'function') renderOffIgnorePlayers(); // ignore-players picker too
  if (typeof renderOffForcePlayers === 'function') renderOffForcePlayers();   // force-players picker too
  if (typeof renderDefIgnorePlayers === 'function') renderDefIgnorePlayers(); // Plan-Defense ignore-players picker too
  if (typeof renderDefCompletePlayers === 'function') renderDefCompletePlayers(); // Plan-Defense complete-players picker too
  if (typeof renderDefSnipPlayers === 'function') renderDefSnipPlayers();         // Plan-Defense snip-players picker too
  if (typeof renderOffMvPlayers === 'function') renderOffMvPlayers(); // MV-pairs picker too
  if (typeof renderOffBlockPairs === 'function') renderOffBlockPairs(); // Block Pairs picker (own-player side) too
  if (typeof renderDefMvPlayers === 'function') renderDefMvPlayers(); // Plan-Defense MV-pairs picker too
  if (typeof renderPlayerSchedulesModal === 'function') renderPlayerSchedulesModal(); // ⏰ Player Schedules popup lists the loaded players
  // Plan Defense: the three summaries under the plan (Support per Player / Available Defense /
  // filtered) and the Manage Defense estimates it tail-renders read the troops + station dicts.
  if (typeof renderDefPlanTable === 'function') renderDefPlanTable();
  if (typeof mapDetectAndSeed === 'function') mapDetectAndSeed(); // map: detect uploading tribe + seed My-tribe group
  if (typeof mapRefresh === 'function') mapRefresh();             // recolor map if it's open

  document.getElementById('overview-drop').style.display = 'none';
  document.getElementById('overview-content').style.display = '';
}

