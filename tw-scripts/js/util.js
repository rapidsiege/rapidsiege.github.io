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
  else if (tableId === 'outbound') renderOutboundTable();
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
// Build the full debug snapshot object (separated from the download so it's unit-testable).
// opts.includeDbRaw adds the FULL world-DB raw text (village/player/ally) so a manual export
// round-trips the whole database, not just the referenced-coord subset. It's off by default
// so the prod cloud-sync plan dump (which calls this with no args) stays lean.
function buildDebugDump(opts) {
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
  const dump = {
    _meta: {
      tool: 'tribe-calculator', version: appVersion(), env: TW_ENV, lang,
      exportedAt: new Date().toISOString(), troopVillages: villages.length, dbVillages: villageDb.length,
    },
    storage,
    settings: {
      thresholds: { complete: val('thresh-complete'), tq: val('thresh-tq'), half: val('thresh-half') },
      plan: { worldSpeed: twWorldSpeed, unitSpeed: twUnitSpeed, // world config (same dump shape as pre-3.30)
              minDist: val('plan-min-dist'), maxDist: val('plan-max-dist'), snobMax: val('plan-snob-max'),
              minMorale: val('plan-min-morale'), minMoraleOff: val('plan-min-morale-off'),
              catCount: val('plan-cat-count') },
      lang,
    },
    troops: villages.length ? { villages } : null,
    db,
  };
  // Full world-DB raw text (manual export only). On import this becomes tw_tribe_db and the
  // page reload re-derives the whole DB from it (dev), so the database "sits the same".
  if (opts && opts.includeDbRaw && typeof dbRawText !== 'undefined' && dbRawText && dbRawText.village) {
    dump.dbRaw = dbRawText;
  }
  return dump;
}

function exportDebugData() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadFile(JSON.stringify(buildDebugDump({ includeDbRaw: true }), null, 2), `tribe-calculator-debug-${stamp}.json`, 'application/json');
}

function importDebugData(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { importDebugDataFromText(String(reader.result)); input.value = ''; };
  reader.readAsText(file);
}

// Write an imported dump's saved state into localStorage, REPLACING the user's current
// tw_tribe* state wholesale (a backup is taken first). Data only — no in-memory rebuild and
// no rendering: the caller reloads the page so the normal page-init autoloaders
// (loadSettings / loadOffensive / loadManage / loadDefensive / autoloadTroops / autoloadDb)
// re-derive EVERYTHING from these keys through the exact same path a fresh session uses.
// That one code path is why the map's stationed/inbound troops (defenseByCoord/incomingByCoord),
// Overwatch prefs and the Manage Offensive tab now survive an import — the old bespoke
// re-derive rebuilt only owned troops and silently dropped them. Split out from
// importDebugDataFromText so it is unit-testable without triggering a real reload.
function applyDebugImport(dump) {
  const isOurs = k => k && k.indexOf('tw_tribe') === 0 && k.indexOf('tw_tribe_backup') !== 0;
  const ourKeys = () => { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isOurs(k)) ks.push(k); } return ks; };
  // Snapshot the current tw_tribe* state for rollback, IN MEMORY (not a tw_tribe_backup
  // localStorage key). Persisting the backup meant the old and new state were both resident
  // during the write, ~doubling peak usage and tripping the ~5 MB localStorage quota when
  // re-importing a large dump (QuotaExceededError → this returns false → "storage may be
  // full"). Then CLEAR the old state so a subsystem absent from the dump (e.g. no defensive
  // targets) doesn't linger — faithful replace. Also drop any stale tw_tribe_backup a prior
  // version persisted, reclaiming that space.
  const backup = {};
  try {
    for (const k of ourKeys()) backup[k] = localStorage.getItem(k);
    try { localStorage.removeItem('tw_tribe_backup'); } catch {}
    for (const k of Object.keys(backup)) localStorage.removeItem(k);
  } catch {}
  // Write the new state as one unit. If any write throws (e.g. localStorage quota exceeded on
  // a big DB), roll back to the pre-import state and fail — never reload into a half-written
  // mix that would silently drop whole subsystems (troops gone → blank map, no error).
  try {
    for (const [k, v] of Object.entries(dump.storage || {})) {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    // full world-DB snapshot (raw text) → tw_tribe_db, re-derived on reload by autoloadDb —
    // DEV ONLY. In prod autoloadDb reloads the live es100 mirror and NEVER reads tw_tribe_db,
    // so writing it there is multiple wasted MB that needlessly trips the quota. Present only
    // in manual exports. Skip the write entirely in prod.
    if (dump.dbRaw && dump.dbRaw.village && (typeof TW_ENV === 'undefined' || TW_ENV !== 'production'))
      localStorage.setItem('tw_tribe_db', JSON.stringify(dump.dbRaw));
    // Back-compat: very old dumps kept settings only in the structured `settings` block with no
    // tw_tribe_settings key. Synthesize it (mapping to saveSettings' shape) so loadSettings()
    // restores thresholds/plan/lang on reload.
    if (!(dump.storage && dump.storage.tw_tribe_settings) && dump.settings) {
      const s = dump.settings, p = s.plan || {}, plan = {};
      const map = { 'plan-min-dist': p.minDist, 'plan-max-dist': p.maxDist, 'plan-snob-max': p.snobMax,
        'plan-min-morale-off': p.minMoraleOff, 'plan-min-morale': p.minMorale, 'plan-cat-count': p.catCount };
      for (const k in map) if (map[k] != null) plan[k] = map[k];
      localStorage.setItem('tw_tribe_settings', JSON.stringify({
        lang: s.lang, speeds: { world: p.worldSpeed, unit: p.unitSpeed },
        thresholds: s.thresholds || {}, plan,
      }));
    }
  } catch (e) {
    try { // roll back: drop the partial write, restore the pre-import keys
      for (const k of ourKeys()) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(backup)) localStorage.setItem(k, v);
    } catch {}
    return false;
  }
  return true;
}

// Validate BEFORE touching localStorage so a malformed/foreign file can't half-write and
// corrupt the user's own saved state. On success, write the state and reload so every
// subsystem re-derives from storage exactly as on a normal load. Returns true on success
// (the test harness relies on this; it has no `location`, so no reload fires there).
function importDebugDataFromText(text) {
  let dump;
  try { dump = JSON.parse(text); }
  catch { alert(t('import_bad_json')); return false; }
  if (!dump || !dump._meta || dump._meta.tool !== 'tribe-calculator' || typeof dump.storage !== 'object') {
    alert(t('import_not_ours')); return false;
  }
  if (!confirm(t('import_confirm'))) return false;
  if (!applyDebugImport(dump)) { alert(t('import_failed')); return false; } // rolled back to pre-import state
  alert(t('import_done'));
  if (typeof location !== 'undefined' && location && typeof location.reload === 'function') location.reload();
  return true;
}

// ══════════════════════════════════════════════════════════════
// TABS (two-level: menu groups → sub-tabs)
// ──────────────────────────────────────────────────────────────
// TAB_GROUPS is the single source of truth for the group→sub mapping — keep it
// in sync with the .tab-groups / .tab-subs markup in tribe-calculator.html.
// Clicking a group opens its FIRST sub-tab; switchTab activates the parent group,
// shows that group's sub-tabs (hiding the sub-bar entirely for single-tab groups),
// highlights the selected sub-tab, and reveals the matching content.
// ══════════════════════════════════════════════════════════════
const TAB_GROUPS = [
  { id: 'overview',  tabs: ['overview', 'players', 'villages', 'rankings'] },
  { id: 'map',       tabs: ['map'] },
  { id: 'timings',   tabs: ['target'] },
  { id: 'offensive', tabs: ['offtargets', 'plan', 'manageoff', 'outbound'] },
  { id: 'defense',   tabs: ['deftargets', 'defplan', 'managedef'] },
  { id: 'settings',  tabs: ['settings', 'changelog', 'db'] },
];
function tabGroupOf(id) {
  const g = TAB_GROUPS.find(grp => grp.tabs.indexOf(id) !== -1);
  return g ? g.id : null;
}
function switchGroup(gid) {
  const g = TAB_GROUPS.find(grp => grp.id === gid);
  if (g) switchTab(g.tabs[0]);
}
function switchTab(id) {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const gid = tabGroupOf(id);
  const group = TAB_GROUPS.find(grp => grp.id === gid);
  document.querySelectorAll('.tabgroup').forEach(t =>
    t.classList.toggle('active', t.dataset.group === gid));
  document.querySelectorAll('.tab-subs .tab').forEach(t => {
    t.classList.toggle('grp-active', t.dataset.group === gid);  // visible within the active group
    t.classList.toggle('active', t.dataset.tab === id);         // the selected sub-tab
  });
  const subs = document.getElementById('tab-subs');
  if (subs) subs.classList.toggle('single', !group || group.tabs.length < 2);
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
  // Reset the title in case an opener overrode it (e.g. Export Coordinates),
  // so the next BB export shows the default again.
  const h = document.getElementById('bb-modal-title');
  if (h) {
    if (h.dataset) h.dataset.i18n = 'bb_modal_title';
    h.textContent = t('bb_modal_title');
  }
}

function copyBBTable() {
  const ta = document.getElementById('bb-output');
  ta.select();
  document.execCommand('copy');
  const btn = document.getElementById('bb-copy-btn');
  btn.textContent = '✓ Copied!';
  setTimeout(() => { btn.textContent = t('bb_copy_btn'); }, 2000);
}

