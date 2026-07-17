// attack-planner — attacks CRUD, countdowns, dropdowns, settings, village import.
// Classic script (7/8): no modules, shared global scope, load order matters — must work
// by double-click (file://). See the <script src> order in attack-planner.html.
'use strict';

// ══════════════════════════════════════════════
// ATTACKS CRUD
// ══════════════════════════════════════════════

function addAttack() {
  const fromId     = document.getElementById('aa-from').value;
  const targetId   = document.getElementById('aa-target').value;
  const type       = document.getElementById('aa-type').value;
  const speed      = document.getElementById('aa-speed').value;
  const nobleCount = parseInt(document.getElementById('aa-nobles').value) || 1;
  const landingVal = document.getElementById('aa-landing').value;

  if (!fromId)     { alert(t('alert_select_from'));   return; }
  if (!targetId)   { alert(t('alert_select_target')); return; }
  if (!landingVal) { alert(t('alert_set_landing'));   return; }

  DATA.attacks.push({
    id:          uid(),
    fromId,
    targetId,
    type,
    speed:       speed || '',   // '' = travel at the type's pace; sword/axe/lc override timing only
    nobleCount:  type === 'snob' ? nobleCount : 1,
    landingTime: new Date(landingVal).toISOString(),
    manual:      true,   // survives Auto-Generate (which replaces generated attacks)
    sent:        false
  });

  document.getElementById('add-attack-panel').classList.remove('open');
  saveData();
  renderAttacks();
}

function editAttack(id) {
  const a = DATA.attacks.find(a => a.id === id);
  if (!a) return;
  document.getElementById('ma-id').value      = a.id;
  document.getElementById('ma-type').value    = a.type;
  document.getElementById('ma-speed').value   = a.speed || '';
  document.getElementById('ma-nobles').value  = a.nobleCount || 1;
  document.getElementById('ma-landing').value = localDatetimeValue(new Date(a.landingTime).getTime());

  // populate dropdowns
  refreshModalDropdowns();
  document.getElementById('ma-from').value   = a.fromId;
  document.getElementById('ma-target').value = a.targetId;

  // show/hide noble row
  const nobleRow = document.getElementById('ma-noble-row');
  nobleRow.classList.toggle('hidden', a.type !== 'snob');

  openModal('modal-attack');
}

function saveAttack() {
  const id = document.getElementById('ma-id').value;
  const a  = DATA.attacks.find(a => a.id === id);
  if (!a) return;
  const landingVal = document.getElementById('ma-landing').value;
  a.fromId     = document.getElementById('ma-from').value;
  a.targetId   = document.getElementById('ma-target').value;
  a.type       = document.getElementById('ma-type').value;
  a.speed      = document.getElementById('ma-speed').value || '';
  a.nobleCount = parseInt(document.getElementById('ma-nobles').value) || 1;
  a.landingTime = new Date(landingVal).toISOString();
  closeModal('modal-attack');
  saveData();
  renderAttacks();
}

function deleteAttack(id) {
  if (!confirm(t('alert_delete_attack'))) return;
  DATA.attacks = DATA.attacks.filter(a => a.id !== id);
  saveData();
  renderAttacks();
}

function toggleSent(id) {
  const a = DATA.attacks.find(a => a.id === id);
  if (!a) return;
  a.sent = !a.sent;
  saveData();
  renderAttacks();
}

function clearAllAttacks() {
  if (!confirm(t('alert_delete_all'))) return;
  DATA.attacks = [];
  saveData();
  renderAttacks();
}

function fmtDatetimeExport(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function exportToNotepad() {
  const rows = DATA.attacks
    .map(a => ({ atk: a, c: computeAttackRow(a) }))
    .filter(r => r.c)
    .sort((a, b) => a.c.sendMs - b.c.sendMs);

  if (!rows.length) { alert(t('alert_no_attacks_export')); return; }

  let out = '[table]\n';
  out += '[**]#[||]Source[||]Target[||]Target Player[||]Type[||]Send time[||]Arrival time[||]Attack URL[/**]\n';

  rows.forEach(({ atk, c }, i) => {
    const village = DATA.villages.find(v => v.id === atk.fromId);
    const target  = DATA.targets.find(t => t.id === atk.targetId);
    const src     = `[coord]${village.x}|${village.y}[/coord]`;
    const tgt     = `[coord]${target.x}|${target.y}[/coord]`;
    const player  = target.player ? `[player]${target.player}[/player]` : '-';
    const url     = `[url=${c.url}]open[/url]`;
    out += `[*]${i+1}[|]${src}[|]${tgt}[|]${player}[|]${atk.type}[|]${fmtDatetimeExport(c.sendMs)}[|]${fmtDatetimeExport(c.landMs)}[|]${url}[|]\n`;
  });

  out += '[/table]';

  document.getElementById('export-text').value = out;
  openModal('modal-export');
}

function copyExportText() {
  const ta = document.getElementById('export-text');
  navigator.clipboard.writeText(ta.value)
    .then(() => { const btn = event.target; const orig = btn.textContent; btn.textContent = t('btn_copied'); setTimeout(() => btn.textContent = orig, 1500); })
    .catch(() => { ta.select(); document.execCommand('copy'); });
}

function clearSent() {
  if (!confirm(t('alert_clear_sent'))) return;
  DATA.attacks = DATA.attacks.filter(a => !a.sent);
  saveData();
  renderAttacks();
}

function clearVillages() {
  if (!confirm(t('alert_clear_villages'))) return;
  DATA.villages = [];
  saveData();
  renderVillages();
  refreshDropdowns();
}

function clearTargets() {
  if (!confirm(t('alert_clear_targets'))) return;
  DATA.targets = [];
  saveData();
  renderTargets();
  refreshDropdowns();
}

function copyUrl(id) {
  const a = DATA.attacks.find(a => a.id === id);
  if (!a) return;
  const row = computeAttackRow(a);
  if (!row) return;
  navigator.clipboard.writeText(row.url).then(() => {
    const btn = document.getElementById('copy-btn-' + id);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    }
  });
}

function fmtDistNum(d) {
  return d.toFixed(1);
}

function setAttackSort(col) {
  if (attackSortCol === col) attackSortDir = -attackSortDir;
  else { attackSortCol = col; attackSortDir = 1; }
  renderAttacks();
}

function renderAttacks() {
  const tbody = document.getElementById('attack-tbody');

  const rows = DATA.attacks.map(a => {
    const computed = computeAttackRow(a);
    const village  = DATA.villages.find(v => v.id === a.fromId);
    const target   = DATA.targets.find(t => t.id === a.targetId);
    return { atk: a, computed, village, target };
  });

  // ── Filter ──
  const fv = id => { const el = document.getElementById(id); return el ? el.value.trim().toLowerCase() : ''; };
  const fFrom   = fv('af-from');
  const fTarget = fv('af-target');
  const fVname  = fv('af-villageName');
  const fPlayer = fv('af-playerName');
  const fType   = fv('af-type');

  const filtered = rows.filter(({ atk, village, target }) => {
    if (fFrom   && !(village?.name  || '').toLowerCase().includes(fFrom))        return false;
    if (fTarget && !`${target?.x||''}|${target?.y||''}`.includes(fTarget))       return false;
    if (fVname  && !(target?.name   || '').toLowerCase().includes(fVname))       return false;
    if (fPlayer && !(target?.player || '').toLowerCase().includes(fPlayer))      return false;
    if (fType   && !atk.type.toLowerCase().includes(fType))                      return false;
    return true;
  });

  // ── Sort ──
  const sortVal = ({ atk, computed, village, target }) => {
    switch (attackSortCol) {
      case 'from':        return (village?.name  || '').toLowerCase();
      case 'target':      return target ? `${target.x}|${target.y}` : '';
      case 'villageName': return (target?.name   || '').toLowerCase();
      case 'playerName':  return (target?.player || '').toLowerCase();
      case 'type':        return atk.type;
      case 'offPow':      return (atk.type === 'off' && village) ? calcOffPow(village) : -1;
      case 'dist':        return computed ? computed.d    : Infinity;
      case 'travel':      return computed ? computed.tMs  : Infinity;
      case 'landing':     return new Date(atk.landingTime).getTime();
      case 'sendAt':      return computed ? computed.sendMs : 0;
      default: return 0;
    }
  };

  filtered.sort((a, b) => {
    if (a.atk.sent !== b.atk.sent) return a.atk.sent ? 1 : -1;
    const va = sortVal(a), vb = sortVal(b);
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return cmp * attackSortDir;
  });

  // ── Update sort icons ──
  ['from','target','villageName','playerName','type','offPow','dist','travel','landing','sendAt'].forEach(col => {
    const el = document.getElementById('si-' + col);
    if (el) el.textContent = col === attackSortCol ? (attackSortDir === 1 ? '▲' : '▼') : '';
  });

  if (filtered.length === 0) {
    const hasFilter = fFrom || fTarget || fVname || fPlayer || fType;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="13">${hasFilter ? t('empty_attacks_filtered') : t('empty_attacks')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(({ atk: a, computed: c, village, target }) => {
    const server   = DATA.settings.serverUrl;
    const twLink   = (href, content, cls = '') =>
      `<a href="${escHtml(href)}" target="_blank" rel="noopener" class="tw-link${cls ? ' ' + cls : ''}">${content}</a>`;
    const villageUrl = id => `https://${server}/game.php?screen=info_village&id=${id}`;
    const playerUrl  = id => `https://${server}/game.php?screen=info_player&id=${id}`;

    // From village
    const fromLabel = village ? escHtml(village.name) : `<span class="text-dim">Unknown</span>`;
    const fromName  = village?.villageId ? twLink(villageUrl(village.villageId), fromLabel) : fromLabel;

    // Target coords
    const coordSpan   = target ? `<span class="coords">${target.x}|${target.y}</span>` : `<span class="text-dim">—</span>`;
    const targetCoord = target?.villageId ? twLink(villageUrl(target.villageId), `${target.x}|${target.y}`, 'coords') : coordSpan;

    // Village name — fall back to DB lookup if name is just "X|Y"
    const rawVName = (() => {
      if (!target) return null;
      if (target.name && target.name !== `${target.x}|${target.y}`) return target.name;
      // Live DB lookup: prefer villageId match, fall back to coords
      const db = (target.villageId ? villageDb.find(v => String(v.id) === String(target.villageId)) : null)
              || villageDb.find(v => v.x === parseInt(target.x) && v.y === parseInt(target.y));
      return db ? db.name : null;
    })();
    const vnLabel    = rawVName ? escHtml(rawVName) : `<span class="text-dim">—</span>`;
    const villageName = (rawVName && target?.villageId) ? twLink(villageUrl(target.villageId), escHtml(rawVName)) : vnLabel;

    // Player name — strip BB-code, link via playerMap reverse lookup
    const rawPlayer  = target ? stripBB(target.player) : '';
    const playerId   = rawPlayer ? Object.keys(playerMap).find(id => playerMap[id] === rawPlayer) : null;
    const pLabel     = rawPlayer ? escHtml(rawPlayer) : `<span class="text-dim">—</span>`;
    const playerName = (rawPlayer && playerId) ? twLink(playerUrl(playerId), escHtml(rawPlayer)) : pLabel;
    // ── Unassigned placeholder row ──
    if (a.type === 'unassigned') {
      const unitLabel = a.unitType === 'snob' ? '👑 snob' : a.unitType === 'axe' ? '🪓 1/2' : '⚔ off';
      const unitCls   = a.unitType === 'snob' ? 'req-snob' : a.unitType === 'axe' ? 'req-axe' : 'req-ram';
      const winText   = fmtTimeWindow(a.windowFrom, a.windowTo);
      const winLabel  = winText
        ? `<span style="font-family:monospace;color:#6090c0;font-size:11px">${escHtml(winText)}</span>`
        : '<span class="text-dim">—</span>';
      return `<tr id="row-${a.id}" class="row-unassigned">
        <td><span style="color:#e05050;font-weight:bold">⚠ Unassigned</span></td>
        <td>${targetCoord}</td>
        <td>${villageName}</td>
        <td>${playerName}</td>
        <td><span class="req-badge ${unitCls}">${unitLabel}</span></td>
        <td><span class="text-dim">—</span></td>
        <td><span class="text-dim">—</span></td>
        <td><span class="text-dim">—</span></td>
        <td>${winLabel}</td>
        <td><span class="text-dim">—</span></td>
        <td></td>
        <td><span class="text-dim">—</span></td>
        <td style="white-space:nowrap">
          <button class="btn btn-danger btn-sm" onclick="deleteAttack('${a.id}')">✕</button>
        </td>
      </tr>`;
    }

    const typeBadge   = `<span class="badge badge-${a.type}">${a.type.toUpperCase()}</span>`;

    let distCell = '-', travelCell = '-', landingCell = '-', sendCell = '-';
    if (c) {
      distCell    = fmtDistNum(c.d);
      travelCell  = fmtMs(c.tMs);
      // Show the window sub-label only for a real window; an exact time is already the landing.
      const winSub = (a.windowFrom && a.windowTo && a.windowFrom !== a.windowTo)
        ? `<br><small style="color:#6090c0;font-size:10px">${escHtml(a.windowFrom)}–${escHtml(a.windowTo)}</small>` : '';
      landingCell = fmtDateLocal(a.landingTime) + winSub;
      const sd = new Date(c.sendMs);
      const sp = n => String(n).padStart(2,'0');
      sendCell = `${sp(sd.getDate())}/${sp(sd.getMonth()+1)} ${sp(sd.getHours())}:${sp(sd.getMinutes())}:${sp(sd.getSeconds())}`;
    }

    const attackBtns = c
      ? `<a class="btn btn-attack btn-sm" href="${escHtml(c.url)}" target="_blank" rel="noopener">${t('btn_send')}</a>
         <button class="btn btn-copy btn-sm" id="copy-btn-${a.id}" onclick="copyUrl('${a.id}')">${t('btn_copy_url')}</button>`
      : `<span class="text-dim">—</span>`;

    const sentLabel = a.sent ? t('btn_unmark_sent') : t('btn_mark_sent');
    const sentClass = a.sent ? 'btn-ghost' : 'btn-sent';

    return `<tr id="row-${a.id}" class="${a.sent ? 'row-sent' : ''}">
      <td>${fromName}</td>
      <td>${targetCoord}</td>
      <td>${villageName}</td>
      <td>${playerName}</td>
      <td>${typeBadge}${a.type === 'snob' ? ` <small style="color:#6090e0">×${a.nobleCount}</small>` : ''}${a.speed && BASE_MIN[a.speed] ? ` <small style="color:#c0a060">@${SPEED_LABEL[a.speed] || a.speed}</small>` : ''}</td>
      <td>${a.type === 'off' && village ? `${calcOffPow(village).toLocaleString()} ${offTierBadge(calcOffPow(village))}` : '<span class="text-dim">—</span>'}</td>
      <td>${distCell}</td>
      <td style="font-family:monospace;font-size:12px">${travelCell}</td>
      <td style="font-family:monospace;font-size:12px">${landingCell}</td>
      <td style="font-family:monospace;font-size:12px">${sendCell}</td>
      <td id="cd-${a.id}"></td>
      <td style="white-space:nowrap">${attackBtns}</td>
      <td style="white-space:nowrap">
        <button class="btn ${sentClass} btn-sm" onclick="toggleSent('${a.id}')">${sentLabel}</button>
        <button class="btn btn-edit btn-sm" onclick="editAttack('${a.id}')">✎</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAttack('${a.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  // immediately tick
  updateCountdowns();
}

// ══════════════════════════════════════════════
// COUNTDOWNS — live, no full re-render
// ══════════════════════════════════════════════

function updateCountdowns() {
  const now = Date.now();
  DATA.attacks.forEach(a => {
    const cdEl  = document.getElementById('cd-' + a.id);
    const rowEl = document.getElementById('row-' + a.id);
    if (!cdEl || !rowEl) return;

    if (a.sent) {
      cdEl.textContent  = t('status_sent');
      cdEl.className    = 'cd-sent';
      rowEl.className   = 'row-sent';
      return;
    }

    const c = computeAttackRow(a);
    if (!c) {
      cdEl.textContent = '—';
      cdEl.className   = '';
      return;
    }

    const diff = c.sendMs - now; // ms until send time

    // Remove existing state classes
    rowEl.className = '';

    if (diff > 30 * 60000) {
      // > 30 min: green
      cdEl.textContent = fmtDuration(diff);
      cdEl.className   = 'cd-ok';
    } else if (diff > 5 * 60000) {
      // 5-30 min: yellow
      cdEl.textContent = fmtDuration(diff);
      cdEl.className   = 'cd-soon';
      rowEl.className  = 'row-urgent';
    } else if (diff > 60000) {
      // 1-5 min: orange
      cdEl.textContent = fmtDuration(diff);
      cdEl.className   = 'cd-urgent';
      rowEl.className  = 'row-urgent';
    } else if (diff > 0) {
      // <1 min: red blinking SEND NOW
      cdEl.textContent = t('status_send_now');
      cdEl.className   = 'cd-now';
      rowEl.className  = 'row-now';
    } else {
      // past send time
      const late = -diff;
      cdEl.textContent = `${t('status_late')} ${fmtDuration(late)}`;
      cdEl.className   = 'cd-late';
      rowEl.className  = 'row-now';
    }
  });
}

// ══════════════════════════════════════════════
// DROPDOWNS
// ══════════════════════════════════════════════

function refreshDropdowns() {
  const villageOptions = DATA.villages.map(v =>
    `<option value="${v.id}">${escHtml(v.name)} (${v.x}|${v.y})</option>`
  ).join('');
  const targetOptions = DATA.targets.map(t =>
    `<option value="${t.id}">${escHtml(t.name)} (${t.x}|${t.y})</option>`
  ).join('');

  const emptyVillage = `<option value="">-- Select Village --</option>`;
  const emptyTarget  = `<option value="">-- Select Target --</option>`;

  document.getElementById('aa-from').innerHTML   = emptyVillage + villageOptions;
  document.getElementById('aa-target').innerHTML = emptyTarget  + targetOptions;
}

function refreshModalDropdowns() {
  const villageOptions = DATA.villages.map(v =>
    `<option value="${v.id}">${escHtml(v.name)} (${v.x}|${v.y})</option>`
  ).join('');
  const targetOptions = DATA.targets.map(t =>
    `<option value="${t.id}">${escHtml(t.name)} (${t.x}|${t.y})</option>`
  ).join('');

  document.getElementById('ma-from').innerHTML   = villageOptions;
  document.getElementById('ma-target').innerHTML = targetOptions;
}

// ══════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════

function applySettings() {
  document.getElementById('cfg-server').value = DATA.settings.serverUrl   || 'es100.guerrastribales.es';
  document.getElementById('cfg-ws').value     = DATA.settings.worldSpeed  || 2;
  document.getElementById('cfg-us').value     = DATA.settings.unitSpeed   || 0.5;
  document.getElementById('cfg-player').value = DATA.settings.playerName  || '';
}

function bindSettings() {
  document.getElementById('cfg-server').addEventListener('input', e => {
    DATA.settings.serverUrl = e.target.value;
    saveData();
    renderAttacks();
  });
  document.getElementById('cfg-ws').addEventListener('change', e => {
    DATA.settings.worldSpeed = parseFloat(e.target.value) || 2;
    saveData();
    renderAttacks();
  });
  document.getElementById('cfg-us').addEventListener('change', e => {
    DATA.settings.unitSpeed = parseFloat(e.target.value) || 0.5;
    saveData();
    renderAttacks();
  });
  document.getElementById('cfg-player').addEventListener('input', e => {
    DATA.settings.playerName = e.target.value.trim();
    saveData();
  });
}

// ══════════════════════════════════════════════
// VILLAGE IMPORT (bookmarklet + paste)
// ══════════════════════════════════════════════

const ATTACK_BOOKMARKLET = `(function(){var tbodies=document.querySelectorAll('tbody.row_marker');if(!tbodies.length){alert('No villages found. Make sure you are on the Mass Recruit page (Overview Villages \u2192 Recruit).');return;}var villages=[];tbodies.forEach(function(tbody){var anyInp=tbody.querySelector('input[name^="units["]');if(!anyInp)return;var m=anyInp.name.match(/units\\[(\\d+)\\]/);if(!m)return;var vid=m[1];var link=tbody.querySelector('td a');if(!link)return;var txt=link.textContent.trim();var cm=txt.match(/\\((\\d+)\\|(\\d+)\\)/);if(!cm)return;var name=txt.replace(/\\s*\\(.*/,'').trim();function get(unit){var inp=tbody.querySelector('input[name="units['+vid+']['+unit+']"]');return inp?parseInt(inp.getAttribute('data-existing'))||0:0;}villages.push({id:vid,name:name,x:parseInt(cm[1]),y:parseInt(cm[2]),axes:get('axe'),lc:get('light'),rams:get('ram'),cats:get('catapult'),nobles:get('snob')});});if(!villages.length){alert('Could not parse any village data.');return;}var json=JSON.stringify({server:location.hostname,villages:villages},null,2);navigator.clipboard.writeText(json).then(function(){alert('Copied '+villages.length+' villages to clipboard! Go paste it in the Attack Planner.');}).catch(function(){alert('Could not copy to clipboard. Try Chrome or Edge.');});})();`;

function initBookmarklet() {
  const link = document.getElementById('bm-link');
  if (link) link.href = 'javascript:' + ATTACK_BOOKMARKLET;
}

function copyBookmarklet() {
  const code = 'javascript:' + ATTACK_BOOKMARKLET;
  navigator.clipboard.writeText(code)
    .then(() => alert(t('alert_bm_copied')))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert(t('alert_bm_copied'));
    });
}

function pasteVillages() {
  navigator.clipboard.readText()
    .then(text => processVillagesJSON(text))
    .catch(() => {
      const text = prompt('Paste the village JSON here:');
      if (text) processVillagesJSON(text);
    });
}

function processVillagesJSON(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed.villages || !Array.isArray(parsed.villages)) {
      alert(t('alert_invalid_format'));
      return;
    }
    if (parsed.server && !DATA.settings.serverUrl) {
      DATA.settings.serverUrl = parsed.server;
      const inp = document.getElementById('server-url');
      if (inp) inp.value = parsed.server;
    }
    let added = 0, updated = 0;
    parsed.villages.forEach(pv => {
      const existing = DATA.villages.find(v =>
        (pv.id && v.villageId === String(pv.id)) ||
        (v.x === parseInt(pv.x) && v.y === parseInt(pv.y))
      );
      if (existing) {
        if (pv.axes   !== undefined) existing.axes   = pv.axes   || 0;
        if (pv.lc     !== undefined) existing.lc     = pv.lc     || 0;
        if (pv.rams   !== undefined) existing.rams   = pv.rams   || 0;
        if (pv.cats   !== undefined) existing.cats   = pv.cats   || 0;
        if (pv.nobles !== undefined) existing.nobles = pv.nobles || 0;
        updated++;
      } else {
        DATA.villages.push({
          id:         uid(),
          name:       pv.name || `(${pv.x}|${pv.y})`,
          villageId:  String(pv.id || ''),
          x:          parseInt(pv.x) || 0,
          y:          parseInt(pv.y) || 0,
          axes:       pv.axes   || 0,
          lc:         pv.lc     || 0,
          rams:       pv.rams   || 0,
          cats:       pv.cats   || 0,
          nobles:     pv.nobles || 0,
        });
        added++;
      }
    });

    // Auto-detect player name from Village DB if not yet set
    if (!DATA.settings.playerName && villageDb.length) {
      const firstId = String(parsed.villages[0]?.id || '');
      const dbEntry = firstId ? villageDb.find(v => v.id === firstId) : null;
      if (dbEntry) {
        const name = playerMap[dbEntry.playerId] || '';
        if (name) {
          DATA.settings.playerName = name;
          document.getElementById('cfg-player').value = name;
        }
      }
    }

    saveData();
    if (typeof cloudSyncPlan === 'function') cloudSyncPlan(); // hosted-site: cloud-save on villages loaded
    renderVillages();
    refreshDropdowns();
    alert(t('alert_import_villages_ok').replace('{added}', added).replace('{updated}', updated));
  } catch(e) {
    alert(t('alert_parse_error') + e.message);
  }
}

function parseRecruitHTML(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const villages = [];
  const seen = new Set();

  doc.querySelectorAll('a[href*="screen=overview"]').forEach(link => {
    const href = link.getAttribute('href') || '';
    const idMatch = href.match(/[?&]village=(\d+)/);
    if (!idMatch) return;
    const villageId = idMatch[1];
    if (seen.has(villageId)) return;
    seen.add(villageId);

    const text = link.textContent.trim();
    const coordMatch = text.match(/\((\d+)\|(\d+)\)/);
    if (!coordMatch) return;

    const getUnit = unit => {
      const inp = doc.querySelector(`input[name="units[${villageId}][${unit}]"]`);
      return inp ? (parseInt(inp.getAttribute('data-existing') || '0') || 0) : 0;
    };

    villages.push({
      id:     villageId,
      name:   text,
      x:      parseInt(coordMatch[1]),
      y:      parseInt(coordMatch[2]),
      axes:   getUnit('axe'),
      lc:     getUnit('light'),
      rams:   getUnit('ram'),
      cats:   getUnit('catapult'),
      nobles: getUnit('snob'),
    });
  });

  return villages;
}

function importFromRecruitHTML(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const villages = parseRecruitHTML(e.target.result);
    if (!villages.length) {
      alert(t('alert_invalid_format'));
      event.target.value = '';
      return;
    }
    let added = 0, updated = 0;
    villages.forEach(pv => {
      const existing = DATA.villages.find(v =>
        (pv.id && v.villageId === pv.id) ||
        (v.x === pv.x && v.y === pv.y)
      );
      if (existing) {
        existing.axes   = pv.axes;
        existing.lc     = pv.lc;
        existing.rams   = pv.rams;
        existing.cats   = pv.cats;
        existing.nobles = pv.nobles;
        updated++;
      } else {
        DATA.villages.push({
          id:        uid(),
          name:      pv.name,
          villageId: pv.id,
          x:         pv.x,
          y:         pv.y,
          axes:      pv.axes,
          lc:        pv.lc,
          rams:      pv.rams,
          cats:      pv.cats,
          nobles:    pv.nobles,
        });
        added++;
      }
    });
    saveData();
    if (typeof cloudSyncPlan === 'function') cloudSyncPlan(); // hosted-site: cloud-save on villages loaded
    renderVillages();
    refreshDropdowns();
    alert(t('alert_import_villages_ok').replace('{added}', added).replace('{updated}', updated));
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

