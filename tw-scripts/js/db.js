// ══════════════════════════════════════════════════════════════
// VILLAGE DATABASE (village.txt + player.txt world map exports)
// ══════════════════════════════════════════════════════════════
const IDB = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('tw-tribe-calculator', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  },
  async get(k) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const rq = db.transaction('kv').objectStore('kv').get(k);
      rq.onsuccess = () => res(rq.result);
      rq.onerror   = () => rej(rq.error);
    });
  },
  async set(k, v) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  },
};

let villageDb     = []; // [{id, name, x, y, playerId, points}]
let playerDb      = {}; // playerId → name
let playerAllyDb  = {}; // playerId → allyId
let allyDb        = {}; // allyId  → {name, tag}
let coordDb       = {}; // "x|y" → village record
let playerPointsDb = {}; // playerId → total village points (for offensive morale)
let dbDirHandle   = null;
let dbSearchTimer = null;

// ── Environment: 'production' when served over http(s) (the GitHub Pages site,
//    where a scheduled Action mirrors the world data under data/es100/);
//    'development' when opened from disk (file://) — uses local files instead.
const TW_ENV = (typeof location !== 'undefined' && /^https?:$/.test(location.protocol))
  ? 'production' : 'development';
const TW_DATA_URL = 'data/es100/';

// Format the mirror's last-updated ISO timestamp as UTC + browser-local + game-server clocks.
// Falls back to the raw text if it doesn't parse.
function fmtUpdatedStamp(raw) {
  const d = new Date(String(raw).trim());
  if (isNaN(d)) return String(raw).trim();
  const p = n => String(n).padStart(2, '0');
  const utc = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
  const local = `${p(d.getHours())}:${p(d.getMinutes())} ${t('upd_local')}`;
  const off = parseFloat(otCfg.serverUtcOffset);
  const s = new Date(d.getTime() + (isNaN(off) ? 2 : off) * 3600000);
  const server = `${p(s.getUTCHours())}:${p(s.getUTCMinutes())} ${t('upd_server')} (UTC+${isNaN(off) ? 2 : off})`;
  return `${utc} · ${local} · ${server}`;
}

async function loadDbFromWeb() {
  try {
    const [vText, pText, updated, aText] = await Promise.all([
      fetch(TW_DATA_URL + 'village.txt').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
      fetch(TW_DATA_URL + 'player.txt').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
      fetch(TW_DATA_URL + 'last-updated.txt').then(r => r.ok ? r.text() : '').catch(() => ''),
      fetch(TW_DATA_URL + 'ally.txt').then(r => r.ok ? r.text() : '').catch(() => ''),
    ]);
    setDbData(vText, pText, aText);
    if (updated.trim()) {
      document.getElementById('db-status').textContent += ` — ${t('db_web_updated')(fmtUpdatedStamp(updated))}`;
    }
  } catch (e) {
    document.getElementById('db-status').textContent = t('db_web_failed');
  }
}

function decodeName(s) { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch { return s; } }

function parsePlayerDb(text) { // id,name,tribe,villages,points,rank
  const names = {}, allies = {};
  for (const line of text.split('\n')) {
    const p = line.trim().split(',');
    if (p.length >= 2 && p[0]) {
      const id = p[0].trim();
      names[id] = decodeName(p[1]);
      if (p.length >= 3) allies[id] = p[2].trim();
    }
  }
  return { names, allies };
}

function parseVillageDb(text) { // id,name,x,y,playerId,points,bonusId
  const out = [];
  for (const line of text.split('\n')) {
    const p = line.trim().split(',');
    if (p.length >= 6 && p[0]) out.push({
      id: p[0].trim(), name: decodeName(p[1]),
      x: +p[2], y: +p[3], playerId: p[4].trim(), points: parseInt(p[5]) || 0,
      bonus: parseInt(p[6]) || 0, // 7th col = bonus-village type (0 = none, 1..9 = bonus types)
    });
  }
  return out;
}

function parseAllyDb(text) { // id,name,tag,members,villages,points,all_points,rank
  const out = {};
  for (const line of text.split('\n')) {
    const p = line.trim().split(',');
    if (p.length >= 3 && p[0]) out[p[0].trim()] = { name: decodeName(p[1]), tag: decodeName(p[2]) };
  }
  return out;
}

function dbTribeTag(v) {
  const a = allyDb[playerAllyDb[v.playerId]];
  return a ? a.tag : '';
}

function setDbData(vText, pText, aText) {
  const { names, allies } = parsePlayerDb(pText);
  playerDb     = names;
  playerAllyDb = allies;
  allyDb       = aText ? parseAllyDb(aText) : {};
  villageDb = parseVillageDb(vText);
  coordDb   = {};
  playerPointsDb = {};
  for (const v of villageDb) {
    coordDb[`${v.x}|${v.y}`] = v;
    playerPointsDb[v.playerId] = (playerPointsDb[v.playerId] || 0) + v.points;
  }
  document.getElementById('db-dot').className = 'file-status-dot dot-ok';
  document.getElementById('db-status').textContent =
    t('db_status_loaded')(villageDb.length.toLocaleString(), Object.keys(playerDb).length.toLocaleString());
  renderDbTable();
  refreshTargetsFromDb();
  if (typeof refreshDefTargetsFromDb === 'function') refreshDefTargetsFromDb(); // defenders + tribe on defensive targets
  renderTargetTable(); // refresh owner info in Tribe Timings
  renderPlanTable();   // materialize rally links once DB arrives
  if (typeof mapDetectAndSeed === 'function') mapDetectAndSeed(); // detect my tribe now the DB resolves coords
  if (typeof mapRefresh === 'function') mapRefresh(); // repaint map if it's open
}

function dbOwnerName(coord) {
  const v = coordDb[coord];
  return v ? (playerDb[v.playerId] || '') : '';
}

function dbOwnerLabel(coord) {
  if (!villageDb.length) return '';
  const v = coordDb[coord];
  if (!v) return t('db_unknown_village');
  // points/name may be absent when the DB came from a debug import's trimmed subset
  return `${v.name || '?'} · ${playerDb[v.playerId] || '—'} · ${(v.points || 0).toLocaleString()} pts`;
}

// Defenders are DB-derived: refresh every target the database knows about
function refreshTargetsFromDb() {
  if (!villageDb.length) return;
  let changed = false;
  for (const tg of offTargets) {
    const n = dbOwnerName(tg.coord);
    if (n && tg.player !== n) { tg.player = n; changed = true; }
  }
  if (changed) saveOffensive();
  renderOffTargets();
}

async function loadDbFromDir() {
  if (!dbDirHandle) return;
  try {
    const [vFile, pFile, aFile] = await Promise.all([
      dbDirHandle.getFileHandle('village.txt').then(h => h.getFile()),
      dbDirHandle.getFileHandle('player.txt').then(h => h.getFile()),
      dbDirHandle.getFileHandle('ally.txt').then(h => h.getFile()).catch(() => null),
    ]);
    setDbData(await vFile.text(), await pFile.text(), aFile ? await aFile.text() : '');
  } catch (e) {
    document.getElementById('db-status').textContent = t('db_not_found');
  }
}

async function connectDbFolder() {
  if (!window.showDirectoryPicker) { alert(t('alert_no_db_api')); return; }
  try {
    dbDirHandle = await window.showDirectoryPicker({ id: 'tw-db-dir', mode: 'read' });
    await IDB.set('dbDirHandle', dbDirHandle).catch(() => {});
    await loadDbFromDir();
    updateDbConnectBtn();
  } catch (e) { /* picker cancelled */ }
}

async function refreshDbFiles() {
  if (!dbDirHandle) { connectDbFolder(); return; }
  try {
    const perm = await dbDirHandle.requestPermission({ mode: 'read' });
    if (perm === 'granted') await loadDbFromDir();
  } catch (e) {}
}

// Restore the remembered folder handle; permission re-grant needs a user gesture (Re-sync)
async function tryAutoLoadDb() {
  if (typeof window === 'undefined' || !window.showDirectoryPicker || typeof indexedDB === 'undefined') return;
  try {
    const dh = await IDB.get('dbDirHandle');
    if (!dh) return;
    dbDirHandle = dh;
    updateDbConnectBtn();
    const perm = await dh.queryPermission({ mode: 'read' });
    if (perm === 'granted') await loadDbFromDir();
    else document.getElementById('db-status').textContent = t('db_connected_refresh');
  } catch (e) {}
}

function updateDbConnectBtn() {
  document.getElementById('db-connect-btn').textContent = dbDirHandle ? t('btn_change_db') : t('btn_connect_db');
  document.getElementById('db-refresh-btn').style.display = dbDirHandle ? '' : 'none';
}

// Fallback for browsers without the File System Access API
function loadDbFromFileInput(input) {
  const files = [...(input.files || [])];
  if (!files.length) return;
  Promise.all(files.map(f => new Promise(res => {
    const r = new FileReader();
    r.onload = e => res({ name: f.name.toLowerCase(), text: e.target.result });
    r.readAsText(f);
  }))).then(rs => {
    let vText = null, pText = null, aText = null;
    for (const r of rs) {
      if (/ally/.test(r.name)) aText = r.text;
      else if (/village/.test(r.name)) vText = r.text;
      else if (/player/.test(r.name)) pText = r.text;
    }
    if (vText === null || pText === null) {
      // sniff by column count: village rows have ≥7 columns; skip already-claimed ally file
      for (const r of rs) {
        if (r.text === aText) continue;
        const cols = (r.text.split('\n').find(l => l.trim()) || '').split(',');
        if (cols.length >= 7 && vText === null) vText = r.text;
        else if (pText === null) pText = r.text;
      }
    }
    if (vText === null || pText === null) { alert(t('alert_select_both')); return; }
    setDbData(vText, pText, aText || '');
  });
  input.value = '';
}

function scheduleDbSearch() {
  clearTimeout(dbSearchTimer);
  dbSearchTimer = setTimeout(renderDbTable, 200);
}

function renderDbTable() {
  const tbody   = document.getElementById('db-tbody');
  const countEl = document.getElementById('db-count');
  if (!villageDb.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('db_no_data')}</td></tr>`;
    countEl.textContent = '';
    return;
  }
  const q = (document.getElementById('db-search').value || '').trim().toLowerCase();
  let results = villageDb;
  if (q) results = villageDb.filter(v => {
    const tribe = allyDb[playerAllyDb[v.playerId]];
    return v.name.toLowerCase().includes(q) ||
      `${v.x}|${v.y}`.includes(q) ||
      (playerDb[v.playerId] || '').toLowerCase().includes(q) ||
      (tribe && (tribe.tag.toLowerCase().includes(q) || tribe.name.toLowerCase().includes(q)));
  });
  if (dbSort !== null) {
    const { key, dir } = dbSort;
    results = [...results].sort((a, b) => {
      if (key === 'coord')  return dir * ((a.x * 1000 + a.y) - (b.x * 1000 + b.y));
      if (key === 'name')   return dir * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (key === 'player') {
        const pa = playerDb[a.playerId] || '', pb = playerDb[b.playerId] || '';
        if (!pa && pb) return dir; if (pa && !pb) return -dir;
        return dir * pa.localeCompare(pb, undefined, { sensitivity: 'base' });
      }
      if (key === 'tribe') {
        const ta = dbTribeTag(a), tb = dbTribeTag(b);
        if (!ta && tb) return dir; if (ta && !tb) return -dir;
        return dir * ta.localeCompare(tb, undefined, { sensitivity: 'base' });
      }
      if (key === 'points') return dir * (a.points - b.points);
      return 0;
    });
    const dbTable = document.getElementById('db-table');
    if (dbTable) {
      const theadRow = dbTable.querySelectorAll('thead tr th');
      for (const th of theadRow) {
        th.classList.remove('sort-asc', 'sort-desc');
        const m = (th.getAttribute('onclick') || '').match(/sortDb\('(\w+)'\)/);
        if (m && m[1] === key) th.classList.add(dir === -1 ? 'sort-desc' : 'sort-asc');
      }
    }
  }
  const capped = results.slice(0, 200);
  countEl.textContent = results.length > capped.length
    ? t('db_showing')(capped.length, results.length.toLocaleString())
    : results.length ? results.length.toLocaleString() : '';
  if (!capped.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${t('empty_no_results')}</td></tr>`;
    return;
  }
  tbody.innerHTML = capped.map(v => {
    const tag = dbTribeTag(v);
    const tribeEntry = allyDb[playerAllyDb[v.playerId]];
    const tribeCell = tag
      ? `<span class="player-tag" title="${esc(tribeEntry ? tribeEntry.name : '')}">${esc(tag)}</span>`
      : '<span class="num-zero">—</span>';
    return `
    <tr>
      <td class="left" style="font-family:monospace;">${v.x}|${v.y}</td>
      <td class="left">${esc(v.name)}</td>
      <td class="left">${playerDb[v.playerId] ? `<span class="player-tag">${esc(playerDb[v.playerId])}</span>` : '<span class="num-zero">—</span>'}</td>
      <td class="left">${tribeCell}</td>
      <td>${(v.points || 0).toLocaleString()}</td>
      <td><button class="btn btn-primary btn-sm" onclick="addTargetFromDb('${v.x}|${v.y}', this)">${t('btn_add_target_short')}</button></td>
    </tr>`;
  }).join('');
}

let dbSort = null;

function sortDb(key) {
  if (dbSort && dbSort.key === key) dbSort.dir *= -1;
  else dbSort = { key, dir: key === 'points' ? -1 : 1 };
  renderDbTable();
}

function addTargetFromDb(coord, btn) {
  offTargets.push(newOffTarget(coord, dbOwnerName(coord)));
  saveOffensive();
  renderOffTargets();
  if (btn) {
    btn.textContent = t('db_added');
    setTimeout(() => { btn.textContent = t('btn_add_target_short'); }, 1500);
  }
}

