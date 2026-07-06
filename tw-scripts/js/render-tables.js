// ══════════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════════
function renderOverview() {
  const playerCount = Object.keys(players).length;
  const totals = Object.fromEntries(UNITS.map(u => [u, villages.reduce((s,v) => s+v[u], 0)]));
  const totalOff = villages.reduce((s,v) => s+v.offPow, 0);
  const totalDefInf = villages.reduce((s,v) => s+v.defInf, 0);
  const totalDefCav = villages.reduce((s,v) => s+v.defCav, 0);

  const offVils   = villages.filter(v => v.type === 'off').length;
  const defVils   = villages.filter(v => v.type === 'def').length;
  const mixedVils = villages.filter(v => v.type === 'mixed').length;
  const emptyVils = villages.filter(v => v.type === 'empty').length;
  const totalSnobs = villages.reduce((s,v) => s+v.snob, 0);
  const totalRams  = villages.reduce((s,v) => s+v.ram,  0);

  // Stat cards
  document.getElementById('stat-cards').innerHTML = `
    <div class="stat-card"><div class="stat-label">${t('stat_players')}</div><div class="stat-value">${playerCount}</div></div>
    <div class="stat-card"><div class="stat-label">${t('stat_villages')}</div><div class="stat-value">${villages.length}</div><div class="stat-sub">${(T[lang]?.vil_type_sub || T.en.vil_type_sub)(offVils,defVils,mixedVils,emptyVils)}</div></div>
    <div class="stat-card"><div class="stat-label">${t('stat_avg')}</div><div class="stat-value">${(villages.length/playerCount).toFixed(1)}</div></div>
    <div class="stat-card"><div class="stat-label">${t('stat_nobles')}</div><div class="stat-value">${fmt(totalSnobs)}</div></div>
    <div class="stat-card"><div class="stat-label">${t('stat_rams')}</div><div class="stat-value">${fmt(totalRams)}</div></div>
    <div class="stat-card"><div class="stat-label">${twIcon('off')}${t('stat_off_power')}</div><div class="stat-value" style="color:#e06040;">${fmtM(totalOff)}</div></div>
    <div class="stat-card"><div class="stat-label">${twIcon('def')}${t('stat_def_inf')}</div><div class="stat-value" style="color:#60a0e0;">${fmtM(totalDefInf)}</div></div>
    <div class="stat-card"><div class="stat-label">${twIcon('def_cav')}${t('stat_def_cav')}</div><div class="stat-value" style="color:#40c080;">${fmtM(totalDefCav)}</div></div>
  `;

  // Power bars
  const maxOff      = Math.max(...Object.values(players).map(p => p.offPow));
  const maxDefTotal = Math.max(...Object.values(players).map(p => p.defInf + p.defCav));
  const topOffPlayer = Object.entries(players).sort((a,b) => b[1].offPow - a[1].offPow)[0];

  document.getElementById('power-bars').innerHTML = `
    <div style="margin-bottom:16px;">
      <div class="power-bar-label"><span>${twIcon('off')}${t('bar_off')}</span><span style="color:#e06040;">${fmtM(totalOff)} pts</span></div>
      <div style="display:grid;gap:5px;">
        ${Object.entries(players).sort((a,b)=>b[1].offPow-a[1].offPow).slice(0,8).map(([name,p]) => `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#806030;margin-bottom:2px;">
              <span>${decode(name)}</span><span style="color:#d0a870;">${fmtM(p.offPow)}</span>
            </div>
            <div class="power-bar-track"><div class="power-bar-fill bar-off" style="width:${maxOff>0?Math.round(p.offPow/maxOff*100):0}%"></div></div>
          </div>
        `).join('')}
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <div class="power-bar-label"><span>${twIcon('def')}${t('bar_def')}</span><span style="color:#60a0e0;">${fmtM(totalDefInf + totalDefCav)} pts</span></div>
      <div style="display:grid;gap:5px;">
        ${Object.entries(players).sort((a,b)=>(b[1].defInf+b[1].defCav)-(a[1].defInf+a[1].defCav)).slice(0,8).map(([name,p]) => {
          const infW = maxDefTotal > 0 ? Math.round(p.defInf / maxDefTotal * 100) : 0;
          const cavW = maxDefTotal > 0 ? Math.round(p.defCav / maxDefTotal * 100) : 0;
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#806030;margin-bottom:2px;">
              <span>${decode(name)}</span><span style="color:#d0a870;">${fmtM(p.defInf + p.defCav)}</span>
            </div>
            <div class="power-bar-track">
              <div class="power-bar-fill bar-def" style="width:${infW}%" title="vs Infantry: ${fmtM(p.defInf)}"></div>
              <div class="power-bar-fill bar-cav" style="width:${cavW}%" title="vs Cavalry: ${fmtM(p.defCav)}"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // Unit cards
  const OFF_ONLY_SET = new Set(['axe','light','ram']);
  const DEF_ONLY_SET = new Set(['spear','sword','heavy','knight']);
  document.getElementById('unit-cards').innerHTML = UNITS.map((u,i) => {
    const total = villages.reduce((s,v) => s+v[u], 0);
    const cls = UNIT_TYPE[u] === 'off' ? 'unit-type-off' : UNIT_TYPE[u] === 'def' ? 'unit-type-def' : 'unit-type-misc';
    let statLine;
    if (OFF_ONLY_SET.has(u))      statLine = `Att: ${ATT[u]}`;
    else if (DEF_ONLY_SET.has(u)) statLine = `Def: ${DINF[u]}/${DCAV[u]}`;
    else if (u === 'catapult')    statLine = `Att: ${ATT[u]} | Def: ${DINF[u]}/${DCAV[u]}`;
    else                          statLine = '—';
    return `<div class="unit-card ${cls}">
      <div class="unit-name">${twIcon(u)}${t('unit_' + UNITS[i])}</div>
      <div class="unit-count">${fmt(total)}</div>
      <div class="stat-sub">${statLine}</div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// PLAYERS TABLE
// ══════════════════════════════════════════════════════════════
function renderPlayersTable() {
  const search = (document.getElementById('player-search').value || '').toLowerCase();
  const typeFilter = document.getElementById('player-filter-type').value;

  let data = Object.entries(players).map(([name, p]) => {
    const offVilCount = p.villages.filter(v => v.type === 'off').length;
    const defVilCount = p.villages.filter(v => v.type === 'def').length;
    const tierComplete = p.villages.filter(v => getOffTier(v.offPow) === 'complete').length;
    const tierTq       = p.villages.filter(v => getOffTier(v.offPow) === 'tq').length;
    const tierHalf     = p.villages.filter(v => getOffTier(v.offPow) === 'half').length;
    return { name, vilCount: p.villages.length, offVilCount, defVilCount, ...p.totals, offPow: p.offPow, defInf: p.defInf, defCav: p.defCav, tierComplete, tierTq, tierHalf };
  });

  if (search) data = data.filter(r => r.name.toLowerCase().includes(search));
  if (typeFilter === 'off') data = data.filter(r => r.offVilCount > 0);
  if (typeFilter === 'def') data = data.filter(r => r.defVilCount > 0);

  // Apply sort
  const { col, dir } = sortState.players;
  if (col >= 0) {
    data.sort((a,b) => {
      const vals = [a.name, a.vilCount, ...UNITS.map(u=>a[u]), a.offPow, a.defInf + a.defCav, a.tierComplete, a.tierTq, a.tierHalf];
      const bvals= [b.name, b.vilCount, ...UNITS.map(u=>b[u]), b.offPow, b.defInf + b.defCav, b.tierComplete, b.tierTq, b.tierHalf];
      const av = vals[col], bv = bvals[col];
      if (typeof av === 'string') return dir * av.localeCompare(bv);
      return dir * (bv - av);
    });
  }

  // Tribe totals
  const tribeTotals = Object.fromEntries(UNITS.map(u => [u, villages.reduce((s,v)=>s+v[u],0)]));
  const tribeOff = villages.reduce((s,v)=>s+v.offPow,0);
  const tribeDef = villages.reduce((s,v)=>s+v.defInf+v.defCav,0);

  const rows = data.map(r => `
    <tr>
      <td class="left"><span class="player-tag">${decode(r.name)}</span></td>
      <td>${r.vilCount}</td>
      ${UNITS.map(u => numCell(r[u])).join('')}
      <td style="color:#e06040;font-weight:600;">${fmtM(r.offPow)}</td>
      <td style="color:#60a0e0;font-weight:600;" title="${fmtM(r.defInf)} inf + ${fmtM(r.defCav)} cav">${fmtM(r.defInf + r.defCav)}</td>
      <td style="color:#ff6040;font-weight:${r.tierComplete>0?'700':'400'};${r.tierComplete===0?'color:#4a3010;':''}">${r.tierComplete||'—'}</td>
      <td style="color:#f0a030;font-weight:${r.tierTq>0?'700':'400'};${r.tierTq===0?'color:#4a3010;':''}">${r.tierTq||'—'}</td>
      <td style="color:#d8d030;font-weight:${r.tierHalf>0?'700':'400'};${r.tierHalf===0?'color:#4a3010;':''}">${r.tierHalf||'—'}</td>
    </tr>
  `).join('');

  const tribeComplete = villages.filter(v => getOffTier(v.offPow) === 'complete').length;
  const tribeTq       = villages.filter(v => getOffTier(v.offPow) === 'tq').length;
  const tribeHalfTier = villages.filter(v => getOffTier(v.offPow) === 'half').length;

  const totalRow = `
    <tr class="total-row">
      <td class="left">${t('tribe_total')}</td>
      <td>${villages.length}</td>
      ${UNITS.map(u => `<td>${fmt(tribeTotals[u])}</td>`).join('')}
      <td>${fmtM(tribeOff)}</td>
      <td>${fmtM(tribeDef)}</td>
      <td>${tribeComplete||'—'}</td>
      <td>${tribeTq||'—'}</td>
      <td>${tribeHalfTier||'—'}</td>
    </tr>
  `;

  document.getElementById('players-tbody').innerHTML = rows + totalRow ||
    `<tr class="empty-row"><td colspan="17">${t('empty_no_players')}</td></tr>`;

  // sync sort arrows
  const { col: pcol, dir: pdir } = sortState.players;
  document.getElementById('players-table').querySelectorAll('th').forEach((th, i) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (i === pcol) th.classList.add(pdir === -1 ? 'sort-desc' : 'sort-asc');
  });
}

// ══════════════════════════════════════════════════════════════
// TIER-DEPENDENT TABLES (re-rendered when the off thresholds change)
// ══════════════════════════════════════════════════════════════
function renderTierTables() {
  renderVillagesTable();   // shows the per-village Tier column
  renderPlayersTable();
  if (typeof renderOutboundTable === 'function') renderOutboundTable(); // Outbound Offs Tier column
}

function getOffTier(offPow) {
  const tc  = parseInt(document.getElementById('thresh-complete')?.value) || 500000;
  const ttq = parseInt(document.getElementById('thresh-tq')?.value)       || 350000;
  const th  = parseInt(document.getElementById('thresh-half')?.value)     || 250000;
  if (offPow >= tc)  return 'complete';
  if (offPow >= ttq) return 'tq';
  if (offPow >= th)  return 'half';
  return 'none';
}

// ── Settings persistence (Settings tab + Plan Offensive inputs + language) ──
// These are plain DOM fields / the language global, so a refresh reset them to the
// HTML defaults. Persist them under tw_tribe_settings on every edit (saveSettings,
// wired to each control's oninput/onchange + to changeLang) and restore on load
// (loadSettings, called from the init block before the first render). The tw_tribe*
// prefix means the debug export/import already round-trips this key.
const TRIBE_SETTINGS_KEY = 'tw_tribe_settings';
// Plan Offensive controls that should survive a refresh (keyed by element id).
const PLAN_SETTING_IDS = ['plan-min-dist', 'plan-max-dist',
  'plan-snob-max', 'plan-min-morale-off', 'plan-min-morale', 'plan-cat-count'];
function saveSettings() {
  const v = id => document.getElementById(id)?.value;
  const plan = {};
  for (const id of PLAN_SETTING_IDS) { const val = v(id); if (val != null) plan[id] = val; }
  try {
    localStorage.setItem(TRIBE_SETTINGS_KEY, JSON.stringify({
      lang: (typeof lang === 'string') ? lang : undefined,
      world: (typeof twWorld === 'string') ? twWorld : undefined,
      speeds: { world: twWorldSpeed, unit: twUnitSpeed }, // cache; worlds.json is authoritative
      thresholds: { complete: v('thresh-complete'), tq: v('thresh-tq'), half: v('thresh-half') },
      plan,
    }));
  } catch {}
}
function loadSettings() {
  let s;
  try { s = JSON.parse(localStorage.getItem(TRIBE_SETTINGS_KEY) || 'null'); } catch {}
  if (!s) return;
  const set = (id, val) => { const e = document.getElementById(id); if (e && val != null && val !== '') e.value = val; };
  if (s.thresholds) { set('thresh-complete', s.thresholds.complete); set('thresh-tq', s.thresholds.tq); set('thresh-half', s.thresholds.half); }
  if (s.plan) for (const id of PLAN_SETTING_IDS) set(id, s.plan[id]);
  // The init block applies this via changeLang(lang) after loadSettings() sets the global.
  if (s.lang === 'en' || s.lang === 'es') lang = s.lang;
  // Restore the selected world before the init block builds the dropdown / loads the DB,
  // and its cached speeds for the window until worlds.json (prod) / the folder's
  // get_config.xml (dev) delivers the authoritative values.
  if (s.world && typeof s.world === 'string') twWorld = s.world;
  if (s.speeds) {
    if (parseFloat(s.speeds.world) > 0) twWorldSpeed = parseFloat(s.speeds.world);
    if (parseFloat(s.speeds.unit)  > 0) twUnitSpeed  = parseFloat(s.speeds.unit);
  }
}

// ── Off-power tier badge (shown in the Villages table's Tier column) ────────────
const TIER_BADGE = {
  complete: '<span class="badge badge-complete">Complete Off</span>',
  tq:       '<span class="badge badge-tq">3/4</span>',
  half:     '<span class="badge badge-half">1/2</span>',
  none:     '<span class="badge badge-empty">—</span>',
};

// ── Manual edit of a village's troops (Villages "Edit") ─────────────────────
// Lets you adjust a village's units in place — e.g. add snobs you know will be
// recruited soon — so the plan accounts for them. SESSION-ONLY: the edit lives on
// the in-memory village object; reloading or re-pasting the troop file resets it.
const BV_EDIT_UNITS = ['axe','light','heavy','knight','ram','catapult','snob'];
function editByVillage(coord) {
  const v = troopByCoord[coord];
  if (!v) return;
  document.getElementById('bvm-coord').value = coord;
  document.getElementById('bvm-where').textContent = coord + ' · ' + decode(v.player);
  BV_EDIT_UNITS.forEach(u => { document.getElementById('bvm-' + u).value = v[u] || 0; });
  document.getElementById('byvillage-modal').classList.add('open');
}
function closeByVillageModal() {
  document.getElementById('byvillage-modal').classList.remove('open');
}
function saveByVillage() {
  const coord = document.getElementById('bvm-coord').value;
  const v = troopByCoord[coord];
  if (!v) { closeByVillageModal(); return; }
  BV_EDIT_UNITS.forEach(u => { v[u] = Math.max(0, parseInt(document.getElementById('bvm-' + u).value) || 0); });
  applyVilDerived(v);              // recompute offPow / def / type from the new counts
  recomputePlayerAggregate(v.player); // re-sum the owner's totals
  closeByVillageModal();
  // Re-render everything parseData refreshes (minus the status bar) so nothing is stale:
  // Villages table, Players, Overview, Rankings, Tribe Timings off badge, the off/snob
  // sender pickers (counts depend on tier/snobs), and the map.
  renderOverview();
  renderPlayersTable();
  renderVillagesTable();
  renderRankings();
  renderTargetTable();
  renderOffTargets();
  if (typeof mapRefresh === 'function') mapRefresh();
}

// ══════════════════════════════════════════════════════════════
// VILLAGES TABLE
// ══════════════════════════════════════════════════════════════
function renderVillagesTable() {
  const search     = (document.getElementById('village-search').value || '').toLowerCase();
  const typeFilter = document.getElementById('village-filter-type').value;

  let data = villages.map(v => ({ ...v, tier: getOffTier(v.offPow) }));

  if (search) data = data.filter(v => v.player.toLowerCase().includes(search) || v.coord.includes(search));
  if (typeFilter !== 'all') data = data.filter(v => v.type === typeFilter);

  const { col, dir } = sortState.villages;
  if (col >= 0) {
    // Index layout must match the <th> order: coord, player, type, TIER, 10 units, off, def, edit.
    // Tier (3) + edit (16) aren't clickable, but keep placeholders so clickable columns line up.
    data.sort((a, b) => {
      const vilVals = v => [v.coord, v.player, v.type, v.tier, ...UNITS.map(u => v[u]), v.offPow, v.defInf + v.defCav, ''];
      const av = vilVals(a)[col], bv = vilVals(b)[col];
      if (typeof av === 'string') return dir * av.localeCompare(bv);
      return dir * (bv - av);
    });
  } else {
    data.sort((a,b) => a.player.localeCompare(b.player) || a.coord.localeCompare(b.coord));
  }

  const typeBadge = {
    off: '<span class="badge badge-off">OFF</span>',
    def: '<span class="badge badge-def">DEF</span>',
    mixed: '<span class="badge badge-mixed">MIX</span>',
    empty: '<span class="badge badge-empty">—</span>',
  };

  const rows = data.map(v => `
    <tr>
      <td class="left" style="font-family:monospace;">${v.coord}</td>
      <td class="left"><span class="player-tag">${decode(v.player)}</span></td>
      <td>${typeBadge[v.type]}</td>
      <td>${TIER_BADGE[v.tier]}</td>
      ${UNITS.map(u => numCell(v[u])).join('')}
      <td style="color:#e06040;">${fmtM(v.offPow)}</td>
      <td style="color:#60a0e0;" title="${fmtM(v.defInf)} inf + ${fmtM(v.defCav)} cav">${fmtM(v.defInf + v.defCav)}</td>
      <td><button class="btn btn-edit btn-sm" onclick="editByVillage('${v.coord}')">✎ ${t('btn_edit')}</button></td>
    </tr>
  `).join('');

  document.getElementById('villages-tbody').innerHTML = rows ||
    `<tr class="empty-row"><td colspan="17">${t('empty_no_villages')}</td></tr>`;

  const { col: vcol, dir: vdir } = sortState.villages;
  document.getElementById('villages-table').querySelectorAll('th').forEach((th, i) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (i === vcol) th.classList.add(vdir === -1 ? 'sort-desc' : 'sort-asc');
  });
}

// ══════════════════════════════════════════════════════════════
// OUTBOUND OFFS (v3.24.0)
// ──────────────────────────────────────────────────────────────
// Offensive villages whose off army is currently DEPLOYED AWAY. Needs the
// tribe_everything export (troops/defense/incoming rows): the "troops" row is the
// village's own army, "defense" is what's home right now, "incoming" is its own
// away-troops returning. So outbound = troops − defense − incoming per unit. Mirrors
// find_outbound_offs.py: list a village when its own axe ≥ OUTBOUND_MIN_AXE and the
// outbound axe is ≥ OUTBOUND_FRACTION of that axe body. The unit columns show the
// approximate amounts CURRENTLY OUT (not home, not returning).
const OUTBOUND_MIN_AXE  = 2000; // village's own axe must be at least this to count as an off
const OUTBOUND_FRACTION = 0.5;  // outbound axe must be ≥ this share of the village's axe body
// Unit columns shown in the Outbound Offs table — pure defensive units (spear/sword/heavy)
// and the knight are dropped since this tab is about offs on the move. Column indices below
// assume this list; keep the <th> order in the HTML and sortState.outbound in sync.
const OUTBOUND_UNITS = UNITS.filter(u => !['spear', 'sword', 'heavy', 'knight'].includes(u));

// Pure (no DOM): given owned villages + the station dicts, return the outbound-off rows.
// Each row carries the per-unit outbound counts, the off/def power of THAT outbound army
// (the Tier badge is derived from outOffPow — the strength of what's out right now), and
// the village's own off power (kept for callers that want the identity tier). A village
// with no defense/incoming row falls back to zeros → read as fully deployed (correct for a
// real export). The caller guards the empty-station case so a plain tribe-info file — where
// every off would falsely read as 100% out — shows an explanatory state instead of rows.
function computeOutboundOffs(vils, defByCoord, incByCoord, minAxe, fraction) {
  const rows = [];
  for (const v of vils) {
    if ((v.axe || 0) < minAxe) continue;
    const de  = defByCoord[v.coord] || {};
    const inc = incByCoord[v.coord] || {};
    const out = {};
    UNITS.forEach(u => { out[u] = Math.max(0, (v[u] || 0) - (de[u] || 0) - (inc[u] || 0)); });
    if (v.axe > 0 && out.axe / v.axe >= fraction) {
      rows.push({
        coord: v.coord, player: v.player, type: v.type, ownOffPow: v.offPow, out,
        outOffPow: OFF_UNITS.reduce((s, u) => s + out[u] * ATT[u],  0),
        outDefInf: DEF_UNITS.reduce((s, u) => s + out[u] * DINF[u], 0),
        outDefCav: DEF_UNITS.reduce((s, u) => s + out[u] * DCAV[u], 0),
      });
    }
  }
  return rows;
}

// Is there any station data at all? Without defense/incoming rows the computation is
// meaningless (every off reads as fully outbound), so the tab shows a hint instead.
function hasStationData() {
  return Object.keys(defenseByCoord).length > 0 || Object.keys(incomingByCoord).length > 0;
}

// Pure (no DOM): map each Plan-Offensive SENDER coord → its assigned target
// ({coord, player}) for the Off Target / Target Player columns — the 1-click check
// that an outbound off is actually flying at its assigned coordinates. Only real
// off rows count (complete/tq/half — catapult attacks come from def villages and
// snob trains carry no prescribed origin); unassigned rows are skipped. First row
// wins (a village's off is assigned at most once).
function outboundOffTargets(rows) {
  const by = {};
  for (const r of rows || []) {
    if (r.unassigned || !r.srcCoord) continue;
    if (r.type !== 'complete' && r.type !== 'tq' && r.type !== 'half') continue;
    if (by[r.srcCoord] == null) by[r.srcCoord] = { coord: r.tCoord, player: r.tPlayer || '' };
  }
  return by;
}

function renderOutboundTable() {
  const tbody = document.getElementById('outbound-tbody');
  if (!tbody) return;
  const summary = document.getElementById('outbound-summary');

  if (!hasStationData()) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="13">${t('outbound_need_everything')}</td></tr>`;
    if (summary) summary.textContent = '';
    return;
  }

  const search = (document.getElementById('outbound-search')?.value || '').toLowerCase();
  // Tier reflects the OUTBOUND army's off power (what's flying right now), not the
  // village's identity tier. tgt = the Plan-Offensive target this village's off was
  // assigned to (null when no plan / not a sender in it).
  const tgtBy = outboundOffTargets(typeof planRows !== 'undefined' ? planRows : []);
  let data = computeOutboundOffs(villages, defenseByCoord, incomingByCoord, OUTBOUND_MIN_AXE, OUTBOUND_FRACTION)
    .map(r => ({ ...r, tier: getOffTier(r.outOffPow), tgt: tgtBy[r.coord] || null }));
  const totalOut = data.length;

  if (search) data = data.filter(r => r.player.toLowerCase().includes(search) || r.coord.includes(search));

  // Sort — column layout mirrors the <th> order: coord, player, Off Target, Target
  // Player, type, TIER, 6 units, Off (out). Tier (5) isn't clickable but keeps its
  // slot so indices line up.
  const { col, dir } = sortState.outbound;
  if (col >= 0) {
    data.sort((a, b) => {
      const vals = r => [r.coord, r.player, r.tgt ? r.tgt.coord : '', r.tgt ? r.tgt.player : '',
                         r.type, r.tier, ...OUTBOUND_UNITS.map(u => r.out[u]), r.outOffPow];
      const av = vals(a)[col], bv = vals(b)[col];
      if (typeof av === 'string') return dir * av.localeCompare(bv);
      return dir * (bv - av);
    });
  } else {
    data.sort((a, b) => a.player.localeCompare(b.player) || a.coord.localeCompare(b.coord));
  }

  const typeBadge = {
    off: '<span class="badge badge-off">OFF</span>',
    def: '<span class="badge badge-def">DEF</span>',
    mixed: '<span class="badge badge-mixed">MIX</span>',
    empty: '<span class="badge badge-empty">—</span>',
  };

  // Off Target links to the target's in-game info page when the world DB is loaded
  // (villageInfoUrl, plan.js) so "is this off really flying there?" is one click.
  // The link keeps the Coord column's plain text color — only the underline marks it.
  const tgtCell = tgt => {
    if (!tgt) return '—';
    const url = (typeof villageInfoUrl === 'function') ? villageInfoUrl(tgt.coord) : null;
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:inherit;">${esc(tgt.coord)}</a>` : esc(tgt.coord);
  };
  const rows = data.map(r => `
    <tr>
      <td class="left" style="font-family:monospace;">${r.coord}</td>
      <td class="left"><span class="player-tag">${decode(r.player)}</span></td>
      <td style="font-family:monospace;">${tgtCell(r.tgt)}</td>
      <td class="left">${r.tgt && r.tgt.player ? `<span class="player-tag">${esc(r.tgt.player)}</span>` : '—'}</td>
      <td>${typeBadge[r.type]}</td>
      <td>${TIER_BADGE[r.tier]}</td>
      ${OUTBOUND_UNITS.map(u => numCell(r.out[u])).join('')}
      <td style="color:#e06040;">${fmtM(r.outOffPow)}</td>
    </tr>
  `).join('');

  tbody.innerHTML = rows || `<tr class="empty-row"><td colspan="13">${t('outbound_none')}</td></tr>`;
  if (summary) {
    const players = new Set(data.map(r => r.player)).size;
    summary.textContent = t('outbound_summary')(totalOut, players);
  }

  const { col: ocol, dir: odir } = sortState.outbound;
  document.getElementById('outbound-table').querySelectorAll('th').forEach((th, i) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (i === ocol) th.classList.add(odir === -1 ? 'sort-desc' : 'sort-asc');
  });
}

// "Export Coords" — copy every outbound village's X|Y (one per line) to the clipboard,
// ready to paste into Offensive Targets → Ignore Coordinates. Always the FULL list (the
// search box is a find-aid, not an export scoper), in the same order the table renders.
function exportOutboundCoords() {
  if (!hasStationData()) { alert(t('outbound_need_everything')); return; }
  const rows = computeOutboundOffs(villages, defenseByCoord, incomingByCoord, OUTBOUND_MIN_AXE, OUTBOUND_FRACTION)
    .sort((a, b) => a.player.localeCompare(b.player) || a.coord.localeCompare(b.coord));
  if (!rows.length) { alert(t('outbound_none')); return; }
  const txt = rows.map(r => r.coord).join('\n');
  const done = () => alert(t('outbound_copied')(rows.length));
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(txt).then(done).catch(() => outboundFallbackCopy(txt, done));
  else outboundFallbackCopy(txt, done);
}
function outboundFallbackCopy(txt, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    done();
  } catch (e) { alert(txt); }
}

// ══════════════════════════════════════════════════════════════
// RANKINGS
// ══════════════════════════════════════════════════════════════
function renderRankings() {
  const playerList = Object.entries(players).map(([name, p]) => ({ name, ...p.totals, offPow: p.offPow, defInf: p.defInf, defCav: p.defCav, defPow: p.defInf + p.defCav, vilCount: p.villages.length }));

  const rankSection = (title, sorted, valueKey, fmt_fn, color, tooltipFn, iconKey) => {
    const ttl = (iconKey ? twIcon(iconKey) : '') + title;
    const top = sorted.slice(0, 10);
    const rows = top.map((r, i) => `
      <tr>
        <td class="left" style="color:#806030;">${i+1}</td>
        <td class="left"><span class="player-tag">${decode(r.name)}</span></td>
        <td style="color:${color};font-weight:600;"${tooltipFn ? ` title="${tooltipFn(r)}"` : ''}>${fmt_fn(r[valueKey])}</td>
      </tr>
    `).join('');
    return `
      <div style="margin-bottom:28px;">
        <div class="section-header"><h2>${ttl}</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th class="left">#</th><th class="left">Player</th><th>${ttl}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  };

  const grid = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;">`;
  let html = grid;
  html += rankSection(t('rank_off'),      [...playerList].sort((a,b)=>b.offPow-a.offPow),   'offPow',   fmtM, '#e06040', null, 'off');
  html += rankSection(t('rank_def'),      [...playerList].sort((a,b)=>b.defPow-a.defPow),   'defPow',   fmtM, '#60a0e0', r => `${fmtM(r.defInf)} inf + ${fmtM(r.defCav)} cav`, 'def');
  html += rankSection(t('rank_villages'), [...playerList].sort((a,b)=>b.vilCount-a.vilCount),'vilCount', fmt,  '#f0c040');
  html += rankSection(t('rank_spear'),    [...playerList].sort((a,b)=>b.spear-a.spear),      'spear',    fmt,  '#60a0e0', null, 'spear');
  html += rankSection(t('rank_sword'),    [...playerList].sort((a,b)=>b.sword-a.sword),      'sword',    fmt,  '#4090d0', null, 'sword');
  html += rankSection(t('rank_axe'),      [...playerList].sort((a,b)=>b.axe-a.axe),          'axe',      fmt,  '#c04020', null, 'axe');
  html += rankSection(t('rank_spy'),      [...playerList].sort((a,b)=>b.spy-a.spy),           'spy',      fmt,  '#a0a060', null, 'spy');
  html += rankSection(t('rank_light'),    [...playerList].sort((a,b)=>b.light-a.light),       'light',    fmt,  '#d4b483', null, 'light');
  html += rankSection(t('rank_heavy'),    [...playerList].sort((a,b)=>b.heavy-a.heavy),       'heavy',    fmt,  '#2080c0', null, 'heavy');
  html += rankSection(t('rank_rams'),     [...playerList].sort((a,b)=>b.ram-a.ram),           'ram',      fmt,  '#c08020', null, 'ram');
  html += rankSection(t('rank_cat'),      [...playerList].sort((a,b)=>b.catapult-a.catapult), 'catapult', fmt,  '#c06030', null, 'catapult');
  html += rankSection(t('rank_nobles'),   [...playerList].sort((a,b)=>b.snob-a.snob),         'snob',     fmt,  '#f0c040', null, 'snob');
  html += '</div>';

  document.getElementById('rankings-content').innerHTML = html;
}

