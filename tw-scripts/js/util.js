// ══════════════════════════════════════════════════════════════
// SORTING
// ══════════════════════════════════════════════════════════════
function sortTable(tableId, col) {
  const state = sortState[tableId];
  if (state.col === col) state.dir *= -1;
  else { state.col = col; state.dir = -1; }

  // Update header arrows
  const table = document.getElementById(tableId + '-table');
  table.querySelectorAll('th').forEach((th, i) => {
    th.classList.remove('sort-asc','sort-desc');
    if (i === col) th.classList.add(state.dir === -1 ? 'sort-desc' : 'sort-asc');
  });

  if (tableId === 'players') renderPlayersTable();
  else if (tableId === 'villages') renderVillagesTable();
}

// ══════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════
function exportTable(tableId, filename) {
  const table = document.getElementById(tableId);
  const rows = [...table.querySelectorAll('tr')];
  const csv = rows.map(row =>
    [...row.querySelectorAll('th,td')].map(cell => {
      const t = cell.innerText.replace(/[,\n]/g, ' ').trim();
      return `"${t}"`;
    }).join(',')
  ).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ══════════════════════════════════════════════════════════════
// DEBUG SNAPSHOT — export / import everything saved locally
// ══════════════════════════════════════════════════════════════
function downloadFile(text, filename, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
}
// Footer version string, whitespace-normalized (nbsp → space) for the dump meta.
function appVersion() {
  const el = document.getElementById('app-version');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}
// Rebuild villages/players/troopByCoord from a flat villages array (import path),
// reusing the same derived-field + aggregate helpers as parseData so they never diverge.
// Data only — the caller repaints (via changeLang).
function rebuildTroopsFromVillages(vils) {
  villages = vils.map(v => { const u = { ...v }; applyVilDerived(u); return u; });
  players = {}; troopByCoord = {}; defenseByCoord = {}; incomingByCoord = {};
  for (const v of villages) {
    troopByCoord[v.coord] = v;
    if (!players[v.player]) players[v.player] = { villages: [], totals: Object.fromEntries(UNITS.map(u => [u, 0])), offPow: 0, defInf: 0, defCav: 0 };
    players[v.player].villages.push(v);
  }
  Object.keys(players).forEach(recomputePlayerAggregate);
  if (villages.length) {
    document.getElementById('file-dot').className = 'file-status-dot dot-ok';
    const txt = document.getElementById('file-status-text');
    txt.textContent = t('imported_troops'); txt.className = 'connected';
    document.getElementById('file-summary').textContent = `${villages.length} villages · ${Object.keys(players).length} players`;
    document.getElementById('overview-drop').style.display = 'none';
    document.getElementById('overview-content').style.display = '';
  }
}

// Build the full debug snapshot object (separated from the download so it's unit-testable).
function buildDebugDump() {
  // every tw_tribe* localStorage key (forward-compatible if more are added later)
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('tw_tribe') === 0 && k.indexOf('tw_tribe_backup') !== 0) {
      try { storage[k] = JSON.parse(localStorage.getItem(k)); }
      catch { storage[k] = localStorage.getItem(k); }
    }
  }
  const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  // World-DB subset: the es100 mirror changes daily and Optimize/morale depend on it, so
  // capture the DB records for just the coords this state references (troop villages +
  // targets) plus the points of every player and the names of the referenced ones —
  // enough to reproduce morale, defenders and tooltips after the live mirror has moved on.
  let db = null;
  if (villageDb.length) {
    const coords = new Set([...villages.map(v => v.coord), ...offTargets.map(tg => tg.coord),
      ...(typeof defTargets !== 'undefined' ? defTargets.map(tg => tg.coord) : [])]);
    const coord = {}, names = {};
    for (const c of coords) {
      const v = coordDb[c];
      if (v) { coord[c] = v; if (playerDb[v.playerId] != null) names[v.playerId] = playerDb[v.playerId]; }
    }
    db = { coord, players: names, points: playerPointsDb, status: (document.getElementById('db-status') || {}).textContent || '' };
  }
  return {
    _meta: {
      tool: 'tribe-calculator', version: appVersion(), env: TW_ENV, lang,
      exportedAt: new Date().toISOString(), troopVillages: villages.length, dbVillages: villageDb.length,
    },
    storage,
    settings: {
      thresholds: { complete: val('thresh-complete'), tq: val('thresh-tq'), half: val('thresh-half') },
      plan: { worldSpeed: val('plan-world-speed'), unitSpeed: val('plan-unit-speed'),
              minDist: val('plan-min-dist'), maxDist: val('plan-max-dist'), snobMax: val('plan-snob-max'),
              minMorale: val('plan-min-morale') },
      lang,
    },
    troops: villages.length ? { villages } : null,
    db,
  };
}

function exportDebugData() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadFile(JSON.stringify(buildDebugDump(), null, 2), `tribe-calculator-debug-${stamp}.json`, 'application/json');
}

function importDebugData(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { importDebugDataFromText(String(reader.result)); input.value = ''; };
  reader.readAsText(file);
}

// Validate BEFORE touching localStorage so a malformed/foreign file can't half-write and
// corrupt the user's own saved state. Returns true on success (used by the test harness).
function importDebugDataFromText(text) {
  let dump;
  try { dump = JSON.parse(text); }
  catch { alert(t('import_bad_json')); return false; }
  if (!dump || !dump._meta || dump._meta.tool !== 'tribe-calculator' || typeof dump.storage !== 'object') {
    alert(t('import_not_ours')); return false;
  }
  if (!confirm(t('import_confirm'))) return false;
  // back up the current tw_tribe* state first (recoverable from devtools if needed);
  // a single key, overwritten each import, so backups can't accumulate
  try {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('tw_tribe') === 0 && k.indexOf('tw_tribe_backup') !== 0) backup[k] = localStorage.getItem(k);
    }
    localStorage.setItem('tw_tribe_backup', JSON.stringify({ savedAt: new Date().toISOString(), keys: backup }));
  } catch {}
  // restore localStorage keys
  for (const [k, v] of Object.entries(dump.storage || {})) {
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  // restore DOM-only settings (tiers + plan params)
  const set = (id, v) => { const e = document.getElementById(id); if (e && v != null && v !== '') e.value = v; };
  const s = dump.settings || {};
  if (s.thresholds) { set('thresh-complete', s.thresholds.complete); set('thresh-tq', s.thresholds.tq); set('thresh-half', s.thresholds.half); }
  if (s.plan) { set('plan-world-speed', s.plan.worldSpeed); set('plan-unit-speed', s.plan.unitSpeed);
                set('plan-min-dist', s.plan.minDist); set('plan-max-dist', s.plan.maxDist); set('plan-snob-max', s.plan.snobMax);
                set('plan-min-morale', s.plan.minMorale); }
  // world-DB subset (coord records + player names/points) so Optimize/morale, defenders
  // and tooltips resolve for the relevant coords without the live mirror
  if (dump.db && dump.db.coord) {
    coordDb = dump.db.coord;
    playerPointsDb = dump.db.points || {};
    playerDb = { ...playerDb, ...(dump.db.players || {}) };
    villageDb = Object.values(coordDb); // non-empty → morale "dbReady"
  }
  // troop data (rebuild via the shared helpers); left untouched when the dump has none
  if (dump.troops && Array.isArray(dump.troops.villages)) rebuildTroopsFromVillages(dump.troops.villages);
  // re-init the offensive + defensive state from the freshly written localStorage, then repaint
  loadOffensive();
  if (typeof loadDefensive === 'function') loadDefensive();
  if (typeof loadMapPrefs === 'function') loadMapPrefs();
  if (typeof syncMapToolbar === 'function') syncMapToolbar();
  changeLang((s.lang === 'es' || s.lang === 'en') ? s.lang : lang); // applyLang + full re-render
  if (typeof mapDetectAndSeed === 'function') mapDetectAndSeed();
  if (typeof mapRefresh === 'function') mapRefresh();
  renderTierTables();
  alert(t('import_done'));
  return true;
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
function switchTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + id));
  if (id === 'map' && typeof onMapTabShown === 'function') onMapTabShown();
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function fmt(n)  { return n === 0 ? '<span class="num-zero">0</span>' : n.toLocaleString(); }
function fmtM(n) { // format large numbers as K/M
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n/1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}
function numCell(n) {
  if (n === 0) return '<td class="num-zero">0</td>';
  if (n >= 2000) return `<td class="num-high">${n.toLocaleString()}</td>`;
  return `<td>${n.toLocaleString()}</td>`;
}
function numCellAccent(n) {
  if (n === 0) return '<td class="num-zero">0</td>';
  const style = n >= 100 ? 'color:#f0c040;font-weight:600;' : 'color:#c8982a;';
  return `<td style="${style}">${n.toLocaleString()}</td>`;
}
function decode(s) { // URL-decode player names like "Vitrocer%C3%A1mica"
  try { return decodeURIComponent(s); } catch { return s; }
}

// ══════════════════════════════════════════════════════════════
// BB TABLE EXPORT
// ══════════════════════════════════════════════════════════════
function showPlayersBBTable() {
  const search    = (document.getElementById('player-search').value || '').toLowerCase();
  const typeFilter = document.getElementById('player-filter-type').value;

  let data = Object.entries(players).map(([name, p]) => ({
    name,
    tierComplete: p.villages.filter(v => getOffTier(v.offPow) === 'complete').length,
    tierTq:       p.villages.filter(v => getOffTier(v.offPow) === 'tq').length,
    tierHalf:     p.villages.filter(v => getOffTier(v.offPow) === 'half').length,
    snob:         p.totals.snob,
    offVilCount:  p.villages.filter(v => v.type === 'off').length,
    defVilCount:  p.villages.filter(v => v.type === 'def').length,
  }));

  if (search) data = data.filter(r => decode(r.name).toLowerCase().includes(search));
  if (typeFilter === 'off') data = data.filter(r => r.offVilCount > 0);
  if (typeFilter === 'def') data = data.filter(r => r.defVilCount > 0);

  data.sort((a, b) => decode(a.name).localeCompare(decode(b.name)));

  const completeLabel = t('opt_complete');
  const sep = '[||]';
  let bb = '[table]\n';
  bb += `[**]${t('th_player')}${sep}${completeLabel}${sep}3/4${sep}1/2${sep}${t('th_snob')}[/**]\n`;
  for (const r of data) {
    bb += `[*][player]${decode(r.name)}[/player][|]${r.tierComplete||0}[|]${r.tierTq||0}[|]${r.tierHalf||0}[|]${r.snob||0}\n`;
  }
  bb += '[/table]';

  document.getElementById('bb-output').value = bb;
  document.getElementById('bb-modal').classList.add('open');
}

function showBBTable(tableId = 'villages-table') {
  const table = document.getElementById(tableId);
  const headers = [...table.querySelectorAll('thead th')].map(th => th.innerText.replace(/[▲▼⬍]/g,'').trim());
  const rows    = [...table.querySelectorAll('tbody tr')].filter(tr => !tr.classList.contains('empty-row'));

  const sep = '[||]';
  const cellSep = '[|]';
  let bb = '[table]\n';
  bb += '[**]' + headers.join(sep) + '[/**]\n';
  for (const row of rows) {
    const cells = [...row.querySelectorAll('td')].map(td => td.innerText.replace(/\s*\n\s*/g, ' ').trim());
    cells[0] = `[coord]${cells[0]}[/coord]`;
    cells[1] = `[player]${cells[1]}[/player]`;
    bb += '[*]' + cells.join(cellSep) + '\n';
  }
  bb += '[/table]';

  document.getElementById('bb-output').value = bb;
  document.getElementById('bb-modal').classList.add('open');
}

function closeBBModal() {
  document.getElementById('bb-modal').classList.remove('open');
}

function copyBBTable() {
  const ta = document.getElementById('bb-output');
  ta.select();
  document.execCommand('copy');
  const btn = document.getElementById('bb-copy-btn');
  btn.textContent = '✓ Copied!';
  setTimeout(() => { btn.textContent = t('bb_copy_btn'); }, 2000);
}

