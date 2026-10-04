// ══════════════════════════════════════════════════════════════
// RETURNING OFFS (v6.2.0)
// Offensive → ↩ Returning Offs: which of the tribe's off villages are AWAY right now, read from
// the "Target Village Orders Exporter" userscript (incomingOrders.js) JSON exports — several
// files / batches, plus whatever JSON the Manage Offensive tab imports (moImportText feeds it:
// Manage keeps only the attacks, this tab also needs the return rows it drops).
//   • an ATTACK still in flight from a village → its off is out; survivors are unknown until the
//     hit, so it is never re-admitted to a plan (it only marks the village as outbound);
//   • a RETURN row (type return / cancel) → its arrival IS the moment the off is home again.
// WHICH SIDE IS OURS: `origin_coords` / `origin_player` for BOTH kinds. The game lists a tribe
// mate's returning command on the ATTACKED village's page with the HOME village as its start
// (verified 2026-10-05 on a real export of the enemy target 431|540: `return large … origin
// 582|559 Wujugor menwer, arrival 07.10.26 10:40:04` = that off landing back home), so ONE export
// of the enemy targets, with "returning" ticked, carries both the attacks in flight and the
// returns. Every command carries `coord` / `player` = that side; `target` / `targetPlayer` = the
// attacked village (where a return comes back FROM).
// Only real offs count: size large / medium, a noble aboard, or an icon without a size variant
// ('' — an unknown size is no evidence of a fake). Small attacks (fakes) are dropped, and so is
// every support movement (support, and the game's back / other_back rows = support heading home
// or being sent back — those carry no off).
// Plan Offensive reads it through roHomeFloorMs / roReturning / planOutboundCoords (generatePlan:
// the "Exclude ALL Outbound Offs" / "Include ALL Returning Offs in window" toggles).
// ══════════════════════════════════════════════════════════════
const RO_STORE_KEY = 'tw_tribe_returning_c';
const RO_COORD_RE = /^\d{1,3}\|\d{1,3}$/;
const RO_HOME_TYPES = new Set(['return', 'cancel']); // own off on its way home (cancel = called back)
const RO_SOURCES = ['manageoff', 'file', 'paste'];
let roFiles = [];    // [{id, name, source:'manageoff'|'file'|'paste', exportedAt, importedAt, nOut, nHome}] import order
let roCommands = []; // [{id, fileId, kind:'out'|'home', coord, player, target, targetPlayer, size, snob, label, originCoord, originPlayer, originVillage, arrival, arrivalMs}]
                     //   coord / player = OUR village and its owner (= origin_coords / origin_player, see above)

// Compressed (lsSaveC) like the Manage Offensive import. Never throws: a quota failure keeps the
// data in memory and on screen, and the user is told ONCE per session (md_storage_full). `quiet`
// (the Manage feed) never alerts — the Manage import already warned about the same full storage.
let roSaveWarned = false;
function saveReturning(quiet) {
  const ok = lsSaveC(RO_STORE_KEY, { files: roFiles, commands: roCommands });
  if (!ok && !quiet && !roSaveWarned) { roSaveWarned = true; if (typeof alert === 'function') alert(t('md_storage_full')); }
  return ok;
}
// Validated field by field (like the v6.1.3 loaders): a corrupt / hand-edited save drops the bad
// entries instead of breaking the tab, and a command whose file is gone goes with it.
function loadReturning() {
  roFiles = []; roCommands = [];
  try {
    const d = lsLoadC(RO_STORE_KEY);
    if (!d || typeof d !== 'object' || Array.isArray(d)) return;
    const files = Array.isArray(d.files)
      ? d.files.filter(f => f && typeof f === 'object' && Number.isInteger(f.id) && RO_SOURCES.includes(f.source)) : [];
    const ids = new Set(files.map(f => f.id));
    roCommands = Array.isArray(d.commands)
      ? d.commands.filter(c => c && typeof c === 'object' && ids.has(c.fileId) && (c.kind === 'out' || c.kind === 'home')
          && typeof c.id === 'string' && c.id && typeof c.coord === 'string' && RO_COORD_RE.test(c.coord)
          && (c.arrivalMs === null || (typeof c.arrivalMs === 'number' && isFinite(c.arrivalMs)))) : [];
    roFiles = files;
    roRecount();
  } catch { roFiles = []; roCommands = []; }
}

// ── Parsing (pure — harness-tested) ───────────────────────────────────────────
function roQualifies(c) {
  if (c.snob) return true;
  return c.size === 'large' || c.size === 'medium' || c.size === '';
}
// incomingOrders JSON → {commands, exportedAt}, or null when the text is not one ({…} with a
// `targets` array). CSV is NOT read: it has no command ids (no dedupe across batches) and no
// epoch arrival. Arrival: arrival_epoch_ms when it is a finite number, else the server-wall
// `arrival` text (moParseArrivalMs), else null. A command without an id gets a synthetic one
// (origin>target@arrival) so a re-import still dedupes. `coord` / `player` = OUR side = the
// origin (header note) — a command whose origin is not X|Y is dropped.
function roParseImport(text) {
  const s = String(text || '').trim();
  if (!s || s[0] !== '{') return null;
  let data;
  try { data = JSON.parse(s); } catch { return null; }
  if (!data || typeof data !== 'object' || !Array.isArray(data.targets)) return null;
  const commands = [];
  for (const tg of data.targets) {
    if (!tg || typeof tg !== 'object') continue;
    const target = String(tg.coords || '').trim();
    const targetPlayer = String(tg.player || '');
    for (const c of (Array.isArray(tg.commands) ? tg.commands : [])) {
      if (!c || typeof c !== 'object') continue;
      const kind = c.type === 'attack' ? 'out' : RO_HOME_TYPES.has(c.type) ? 'home' : null;
      if (!kind) continue; // support / back / other_back / other — never an off
      const size = typeof c.size === 'string' ? c.size : '';
      const snob = !!c.contains_snob || !!(c.units && c.units.snob > 0);
      if (!roQualifies({ size, snob })) continue; // small = fake
      const originCoord = String(c.origin_coords || '').trim();
      const originPlayer = String(c.origin_player || '');
      const coord = originCoord, player = originPlayer;       // our village, for attacks AND returns (header note)
      if (!RO_COORD_RE.test(coord)) continue;
      const epoch = c.arrival_epoch_ms;
      const arrival = String(c.arrival || '');
      const arrivalMs = (typeof epoch === 'number' && isFinite(epoch)) ? epoch
        : (typeof moParseArrivalMs === 'function' ? moParseArrivalMs(arrival) : null);
      const id = (c.id != null && String(c.id)) ? String(c.id) : `${originCoord}>${target}@${arrivalMs}`;
      commands.push({ id, fileId: null, kind, coord, player, target, targetPlayer, size, snob, label: String(c.label || ''),
        originCoord, originPlayer, originVillage: String(c.origin_village || ''),
        arrival, arrivalMs });
    }
  }
  return { commands, exportedAt: Number(data.exported_at) || 0 };
}

// ── Merged state (pure over the module globals — harness-tested) ──────────────
function roNewFileId() { return roFiles.reduce((m, f) => Math.max(m, f.id || 0), 0) + 1; }
// Per-file live counts: an older file loses the commands a newer import re-delivered.
function roRecount() {
  const by = {};
  for (const c of roCommands) { const b = by[c.fileId] || (by[c.fileId] = { out: 0, home: 0 }); b[c.kind]++; }
  for (const f of roFiles) { const b = by[f.id] || { out: 0, home: 0 }; f.nOut = b.out; f.nHome = b.home; }
}
// Add one parsed file. Dedupe by command id across ALL files: the newly imported copy wins. (Whether
// the game keeps an attack's id for its return trip is not verified — if it does, a later export's
// return row replaces the attack; if not, the attack stays "in flight" until its file is removed.)
// The Manage feed is single-slot: a new Manage import replaces the previous Manage entry + commands.
function roMergeImport(fileEntry, commands) {
  if (fileEntry.source === 'manageoff')
    for (const f of roFiles.filter(x => x.source === 'manageoff')) roRemoveFile(f.id);
  if (!Number.isInteger(fileEntry.id)) fileEntry.id = roNewFileId();
  const byId = new Map();
  for (const c of (commands || [])) byId.set(c.id, { ...c, fileId: fileEntry.id }); // a repeat inside one file: last wins
  roCommands = roCommands.filter(c => !byId.has(c.id)).concat([...byId.values()]);
  roFiles.push(fileEntry);
  roRecount();
  return fileEntry;
}
function roRemoveFile(fileId) {
  const n = roFiles.length;
  roFiles = roFiles.filter(f => f.id !== fileId);
  roCommands = roCommands.filter(c => c.fileId !== fileId);
  roRecount();
  return roFiles.length !== n;
}

// Map coord (OUR village) → {out, home, outLatestMs, homeMs, state}. `homeMs` = the LATEST return
// time (several offs coming home → the village is whole again only after the last one); `state` =
// 'out' while any qualifying attack is in flight (even next to return rows), else 'home' while the
// latest return still lies ahead of nowMs, else 'back' (returned — or a return row without a time).
function roVillageStates(commands, nowMs) {
  const map = new Map();
  for (const c of (commands || [])) {
    let s = map.get(c.coord);
    if (!s) map.set(c.coord, s = { out: 0, home: 0, outLatestMs: null, homeMs: null, state: 'back' });
    const ms = typeof c.arrivalMs === 'number' && isFinite(c.arrivalMs) ? c.arrivalMs : null;
    if (c.kind === 'out') { s.out++; if (ms !== null && (s.outLatestMs === null || ms > s.outLatestMs)) s.outLatestMs = ms; }
    else { s.home++; if (ms !== null && (s.homeMs === null || ms > s.homeMs)) s.homeMs = ms; }
  }
  for (const s of map.values()) s.state = s.out > 0 ? 'out' : (s.homeMs !== null && s.homeMs > nowMs) ? 'home' : 'back';
  return map;
}
// Engine lookups, called once per pool village by generatePlan: the per-coord index is built once
// per roCommands array (every mutation above reassigns it) instead of rescanning the commands.
// The index ignores `state` (built at nowMs 0) — the lookups below read only counts and times.
let roIdxCache = null;
function roIndex() {
  if (!roIdxCache || roIdxCache.src !== roCommands || roIdxCache.n !== roCommands.length)
    roIdxCache = { src: roCommands, n: roCommands.length, map: roVillageStates(roCommands, 0) };
  return roIdxCache.map;
}
// The village's home time when ALL its qualifying commands are return rows (≥ 1 home row, 0 in
// flight), else null. Can lie in the past (the off is back). null when the rows carry no time.
function roHomeFloorMs(coord) {
  const s = roIndex().get(coord);
  return s && s.home > 0 && s.out === 0 ? s.homeMs : null;
}
function roInFlight(coord) {
  const s = roIndex().get(coord);
  return !!(s && s.out > 0);
}
// Still on its way home at nowMs (a known home time ahead of it, nothing in flight).
function roReturning(coord, nowMs) {
  const h = roHomeFloorMs(coord);
  return h !== null && h > nowMs;
}
// Coords the plan treats as OUTBOUND: the Outbound Offs tab's station rule (owned − home −
// returning, per village with station data) ∪ the villages with an attack in flight here.
// Every global is typeof-guarded: no troops / no station data / no import → just fewer coords.
function planOutboundCoords() {
  const set = new Set();
  if (typeof computeOutboundOffs === 'function' && typeof villages !== 'undefined' && typeof defenseByCoord !== 'undefined'
      && typeof incomingByCoord !== 'undefined' && typeof PARAMS !== 'undefined') {
    for (const r of computeOutboundOffs(villages, defenseByCoord, incomingByCoord, PARAMS.outboundMinAxe, PARAMS.outboundFraction))
      set.add(r.coord);
  }
  for (const [coord, s] of roIndex()) if (s.out > 0) set.add(coord);
  return set;
}
// Re-importable JSON of the merged state in the exporters' own field names — the cloud copy of a
// multi-file import (the N raw files no longer exist as one text). Return rows come back as type
// 'return' under their home village's block (with its owner), so roParseImport round-trips every
// command — ids (synthetic ones included), both sides and the epoch arrivals.
function roToJson() {
  const byTarget = new Map();
  for (const c of roCommands) { if (!byTarget.has(c.target)) byTarget.set(c.target, []); byTarget.get(c.target).push(c); }
  return JSON.stringify({ exported_at: roFiles.reduce((m, f) => Math.max(m, f.exportedAt || 0), 0),
    targets: [...byTarget].map(([coords, cmds]) => ({ coords, player: (cmds.find(c => c.targetPlayer) || {}).targetPlayer || '', commands: cmds.map(c => ({
      id: c.id, type: c.kind === 'out' ? 'attack' : 'return', size: c.size, contains_snob: !!c.snob, label: c.label,
      origin_coords: c.originCoord, origin_village: c.originVillage, origin_player: c.originPlayer,
      arrival: c.arrival, arrival_epoch_ms: c.arrivalMs })) })) });
}

// ── Import UI ─────────────────────────────────────────────────────────────────
function toggleRoImport() {
  const el = document.getElementById('ro-import-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
// files = [{name, text}] in selection order. Any unparseable file aborts the WHOLE import (state
// untouched) with a filename-specific alert — no silent partial imports. Inside one batch the
// files merge oldest export first, so the newest export's copy of a command wins the dedupe.
function roImportFiles(files) {
  const parsedList = [];
  for (const f of files) {
    const parsed = roParseImport(f.text);
    if (!parsed) { alert(f.name ? t('ro_import_fail_file')(f.name) : t('ro_import_fail')); return; }
    parsedList.push({ name: f.name || '', parsed, i: parsedList.length });
  }
  if (!parsedList.length) return;
  const nowSec = Math.floor(Date.now() / 1000);
  parsedList.sort((a, b) => ((a.parsed.exportedAt || 0) - (b.parsed.exportedAt || 0)) || (a.i - b.i))
    .forEach(x => roMergeImport({ name: x.name, source: x.name ? 'file' : 'paste', exportedAt: x.parsed.exportedAt,
      importedAt: nowSec, nOut: 0, nHome: 0 }, x.parsed.commands));
  saveReturning();
  renderReturningTable();
  if (typeof cloudSyncReturning === 'function') // hosted-site cloud save — the original text for a
    cloudSyncReturning(files.length === 1 ? files[0].text : roToJson()); // single source, merged JSON otherwise
  const el = document.getElementById('ro-import-wrap');
  if (el) el.style.display = 'none';
}
function roLoadPaste() {
  const el = document.getElementById('ro-import-text');
  roImportFiles([{ name: '', text: el ? el.value : '' }]);
}
function roLoadFiles(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  Promise.all(files.map(f => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve({ name: f.name, text: e.target.result });
    reader.onerror = () => reject(f.name);
    reader.readAsText(f);
  }))).then(roImportFiles)
    .catch(name => alert(t('ro_import_fail_file')(name)));
  input.value = '';
}
function roRemoveFileUi(fileId) {
  if (!roRemoveFile(fileId)) return;
  saveReturning();
  renderReturningTable();
}
function clearReturning() {
  if (roFiles.length && !confirm(t('ro_confirm_clear'))) return;
  roFiles = []; roCommands = [];
  saveReturning();
  renderReturningTable();
}
// Manage Offensive feed (moImportText, after its own successful parse). Manage accepts CSV too —
// this tab is JSON-only, so anything roParseImport rejects is ignored silently (no alert: the
// Manage import itself succeeded), and the previous Manage entry stays. No cloud push either:
// Manage already backed up the same raw text.
function roIngestFromManage(text) {
  const parsed = roParseImport(text);
  if (!parsed) return;
  roMergeImport({ name: '', source: 'manageoff', exportedAt: parsed.exportedAt, importedAt: Math.floor(Date.now() / 1000),
    nOut: 0, nHome: 0 }, parsed.commands);
  saveReturning(true);
  renderReturningTable();
}
// Manage Offensive ✕ Clear Import (clearManage) drops the Manage-sourced entry with it.
function roDropManageFeed() {
  const ids = roFiles.filter(f => f.source === 'manageoff').map(f => f.id);
  if (!ids.length) return;
  for (const id of ids) roRemoveFile(id);
  saveReturning(true);
  renderReturningTable();
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function roFmtTime(ms) {
  if (ms === null || ms === undefined) return '—';
  return (typeof fmtServerDT === 'function') ? fmtServerDT(ms) : new Date(ms).toISOString();
}
// Countdown to `ms` from the server clock as HH:MM:SS — hours keep counting past 24 (a two-day
// return reads 50:12:07), like the game's own command timers (— once it has passed / unknown).
function roFmtIn(ms, nowMs) {
  if (ms === null || ms === undefined || ms <= nowMs) return '—';
  const sec = Math.floor((ms - nowMs) / 1000);
  const p2 = n => String(n).padStart(2, '0');
  return `${p2(Math.floor(sec / 3600))}:${p2(Math.floor(sec / 60) % 60)}:${p2(sec % 60)}`;
}
function roStateBadge(state) {
  if (state === 'out')  return `<span class="badge ro-state-out">🚀 ${esc(t('ro_state_out'))}</span>`;
  if (state === 'home') return `<span class="badge ro-state-home">↩ ${esc(t('ro_state_home'))}</span>`;
  return `<span class="badge ro-state-back">🏠 ${esc(t('ro_state_back'))}</span>`;
}
function renderReturningTable() {
  const tbody = document.getElementById('ro-tbody');
  if (!tbody) return;
  const now = serverNowMs();
  const stamp = sec => sec ? new Date(sec * 1000).toLocaleString() : '?';

  const filesEl = document.getElementById('ro-files');
  if (filesEl) filesEl.innerHTML = roFiles.map(f => {
    const name = f.source === 'manageoff' ? t('ro_file_manage') : (f.name || t('ro_file_paste'));
    return `<div class="ro-file"><span>${esc(t('ro_file_line')(name, stamp(f.exportedAt || f.importedAt), f.nOut || 0, f.nHome || 0))}</span>`
      + ` <button class="btn btn-ghost btn-sm" onclick="roRemoveFileUi(${Number(f.id)})" title="${esc(t('btn_remove'))}">✕</button></div>`;
  }).join('');
  const impEl = document.getElementById('ro-import-status');
  if (impEl) impEl.textContent = roFiles.length ? t('ro_imported')(roFiles.length, roCommands.length) : '';

  const states = roVillageStates(roCommands, now);
  let nOut = 0, nHome = 0, nBack = 0, nextHome = null;
  for (const s of states.values()) {
    if (s.state === 'out') nOut++;
    else if (s.state === 'home') { nHome++; if (nextHome === null || s.homeMs < nextHome) nextHome = s.homeMs; }
    else nBack++;
  }
  const sumEl = document.getElementById('ro-summary');
  if (sumEl) sumEl.textContent = roFiles.length ? t('ro_summary')(nOut, nHome, nBack, nextHome === null ? '—' : roFmtTime(nextHome)) : t('ro_empty_hint');

  // Per OUR village: the reporting player (first named command, else the troop file's owner), the
  // distinct targets its in-flight attacks are heading to, and the attacked villages its return
  // rows come back from (shown as "← X|Y" when nothing is in flight).
  const info = new Map();
  for (const c of roCommands) {
    let x = info.get(c.coord);
    if (!x) info.set(c.coord, x = { player: '', targets: [], from: [] });
    if (!x.player && c.player) x.player = c.player;
    if (c.kind === 'out' && c.target && !x.targets.includes(c.target)) x.targets.push(c.target);
    if (c.kind === 'home' && c.target && !x.from.includes(c.target)) x.from.push(c.target);
  }
  const troops = (typeof troopByCoord !== 'undefined') ? troopByCoord : {};
  const stationOut = new Set((typeof computeOutboundOffs === 'function' && typeof villages !== 'undefined')
    ? computeOutboundOffs(villages, defenseByCoord, incomingByCoord, PARAMS.outboundMinAxe, PARAMS.outboundFraction).map(r => r.coord) : []);
  const q = (document.getElementById('ro-search')?.value || '').trim().toLowerCase();
  const RANK = { out: 0, home: 1, back: 2 };
  const rows = [...states].map(([coord, s]) => {
    const x = info.get(coord);
    const own = troops[coord];
    const player = x.player || (own ? own.player : '');
    return { coord, s, player: decode(player), targets: x.targets, from: x.from, own, time: s.state === 'out' ? s.outLatestMs : s.homeMs };
  }).filter(r => !q || r.player.toLowerCase().includes(q) || r.coord.includes(q))
    .sort((a, b) => (RANK[a.s.state] - RANK[b.s.state])
      || ((a.time === null ? Infinity : a.time) - (b.time === null ? Infinity : b.time))
      || (a.coord < b.coord ? -1 : a.coord > b.coord ? 1 : 0));

  const coordCell = coord => (typeof moCoordLink === 'function') ? moCoordLink(coord) : esc(coord);
  tbody.innerHTML = rows.map(r => {
    const list = r.targets.length ? r.targets : r.from; // in flight → where to; else where the return comes from
    const tgt = (r.targets.length ? '' : (list.length ? '← ' : '')) + list.slice(0, 4).map(esc).join(', ') + (list.length > 4 ? ` +${list.length - 4}` : '');
    const tier = r.own ? tierBadge(getOffTier(r.own.offPow)) : `<span title="${esc(t('ro_not_in_troops'))}" style="cursor:help;">—</span>`;
    return `
    <tr>
      <td class="left" style="font-family:monospace;">${coordCell(r.coord)}</td>
      <td class="left">${r.player ? `<span class="player-tag">${esc(r.player)}</span>` : '—'}</td>
      <td>${tier}</td>
      <td>${roStateBadge(r.s.state)}</td>
      <td>${esc(t('ro_cmds')(r.s.out, r.s.home))}</td>
      <td class="left" style="font-family:monospace;">${tgt || '—'}</td>
      <td style="font-family:monospace;color:#60a0e0;">${esc(roFmtTime(r.time))}</td>
      <td style="font-family:monospace;">${roFmtIn(r.time, now)}</td>
      <td>${stationOut.has(r.coord) ? '✓' : ''}</td>
    </tr>`;
  }).join('') || `<tr class="empty-row"><td colspan="9">${esc(t('ro_table_empty'))}</td></tr>`;
}
