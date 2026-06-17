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

