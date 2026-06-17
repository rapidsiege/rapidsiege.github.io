// ══════════════════════════════════════════════════════════════
// TARGET VILLAGE (distance calculator)
// ══════════════════════════════════════════════════════════════
function parseCoordStr(s) {
  const m = String(s || '').trim().match(/(\d{1,3})\s*[|:., ]\s*(\d{1,3})/);
  return m ? { x: +m[1], y: +m[2] } : null;
}
function distXY(a, b) { return Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2); }

// Travel time in minutes for a given distance and unit base speed
function travelTimeMin(d, baseMin, ws, us) { return d * baseMin / (ws * (us || 1)); }

function fmtTime(minutes) {
  if (minutes < 1) return '<1m';
  const tot = Math.round(minutes);
  const h = Math.floor(tot / 60), m = tot % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtArrivalTime(travelMinutes) {
  // server-time arrival, consistent with the "Arrive by" deadline and the planner
  const off = parseFloat(otCfg.serverUtcOffset);
  const d = new Date(serverNowMs() + travelMinutes * 60000 + (isNaN(off) ? 2 : off) * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

// ── Morale (points-based, offensive only) ──
// Total village points of the player owning the village at `coord` (0 if unknown).
function playerPointsAtCoord(coord) {
  const v = coordDb[coord];
  return v ? (playerPointsDb[v.playerId] || 0) : 0;
}
// morale = 3 · defenderPoints / attackerPoints + 0.3, clamped to [30%, 100%].
// Fitted exactly (to the integer %) against in-game simulations in morale_simulations.csv.
// null when either side's points are unknown (DB not loaded / village not in map).
function moraleValue(defPts, attPts) {
  if (!defPts || !attPts) return null;
  return Math.min(1, Math.max(0.3, 3 * defPts / attPts + 0.3));
}
// Barbarian / abandoned villages (playerId 0) have no owner → no morale penalty (always 100%).
function isBarbarian(coord) {
  const v = coordDb[coord];
  return !!v && (!v.playerId || v.playerId === '0');
}
function fmtMorale(m) { return m == null ? '—' : Math.round(m * 100) + '%'; }
function moraleColor(m) {
  if (m == null) return '#806030';
  return m >= 1 ? '#6cc070' : m >= 0.75 ? '#d0c040' : m >= 0.5 ? '#d0a040' : '#e06040';
}
// Morale of an offensive from srcCoord's owner against tgtCoord's owner. Mirrors Tribe
// Timings exactly: barbarian target → 100% (no penalty), else moraleValue on the two
// players' aggregated points. null when the world DB can't resolve either side's points.
function planAttackMorale(srcCoord, tgtCoord) {
  if (isBarbarian(tgtCoord)) return 1;
  return moraleValue(playerPointsAtCoord(tgtCoord), playerPointsAtCoord(srcCoord));
}

// "Arrive by" deadline (Day + HH:MM:SS, server time) → epoch ms, or null when unset
function targetArrivalMs() {
  const day = document.getElementById('target-arrival-date')?.value;
  const tm  = String(document.getElementById('target-arrival-time')?.value || '').match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!day || !tm) return null;
  return serverWallMs(day, +tm[1] * 60 + +tm[2] + (+tm[3] || 0) / 60);
}

function targetCols() {
  const mode = document.getElementById('target-mode')?.value || 'off';
  const m = TARGET_MODES[mode];
  return [
    { key:'coord',  label:t('th_coord'),    left:true, str:true, defDir:1 },
    { key:'player', label:t('th_player'),   left:true, str:true, defDir:1 },
    { key:'dist',   label:t('th_distance'), defDir:1 },
    { key:m.power,  label: twIcon(mode === 'off' ? 'off' : 'def') + (mode === 'off' ? t('th_off_power') : t('th_def_power')), defDir:-1 },
    ...(mode === 'off' ? [{ key:'morale', label:t('th_morale'), title:t('morale_title'), defDir:-1 }] : []),
    ...m.units.map(u => ({ key:u, label:twIcon(u) + t('th_' + (u === 'catapult' ? 'cat' : u)), defDir:-1 })),
    ...m.travel.map(u => ({ key:'tt_'+u, label:`${TRAVEL_ICON[u]} ${t('unit_'+u)}`, defDir:1, travel:true })),
    { key:'order', label:t('th_order'), noSort:true },
  ];
}

// Shared data pipeline for Tribe Timings — used by both renderTargetTable and the
// per-player BB export so they always show exactly the same (filtered, sorted) rows.
// Returns { ..., data: null } when there's nothing to render (no villages / no target).
function targetTimingData() {
  const mode = document.getElementById('target-mode')?.value || 'off';
  const m    = TARGET_MODES[mode];
  const target = parseCoordStr(document.getElementById('target-coord').value);

  const paceOpts = mode === 'off' ? ['any','light','axe','sword','ram'] : ['any','spy','light','heavy','spear','sword','knight'];
  const paceEl = document.getElementById('target-pace-unit');
  let pace = paceEl ? paceEl.value : 'any';
  if (!paceOpts.includes(pace)) pace = 'any';

  if (!villages.length || !target) return { mode, m, pace, target, data: null };

  const ws     = parseFloat(document.getElementById('target-world-speed').value) || 1;
  const us     = parseFloat(document.getElementById('target-unit-speed').value) || 1;
  const search = (document.getElementById('target-search').value || '').toLowerCase();
  const minPow = parseInt(document.getElementById('target-min-power').value) || 0;

  const tgtCoord = `${target.x}|${target.y}`;
  const tgtPts   = playerPointsAtCoord(tgtCoord); // defender's aggregated points (off mode morale)
  const tgtBarb  = isBarbarian(tgtCoord);         // barbarian target → morale always 100%

  let data = villages.map(v => {
    const c = parseCoordStr(v.coord);
    const row = { ...v, dist: c ? distXY(c, target) : Infinity };
    m.travel.forEach(u => { row['tt_'+u] = travelTimeMin(row.dist, UNIT_BASE_MIN[u], ws, us); });
    if (mode === 'off') row.morale = tgtBarb ? 1 : moraleValue(tgtPts, playerPointsAtCoord(v.coord));
    return row;
  });

  // Exclude the target village itself (distance 0, not a sender).
  data = data.filter(v => v.coord !== tgtCoord);

  if (search) data = data.filter(v =>
    decode(v.player).toLowerCase().includes(search) || v.coord.includes(search));
  if (minPow > 0) data = data.filter(v => v[m.power] >= minPow);

  // Arrival deadline: keep only villages that can land in time — with the chosen
  // pace unit, or any owned unit when pace is "Any". In def mode an in-time
  // knight overrides the pace check (it carries all the village's units along).
  const deadlineMs = targetArrivalMs();
  if (deadlineMs !== null) {
    data = data.filter(row => pace === 'any'
      ? m.travel.some(u => unitMakesDeadline(row, u, deadlineMs))
      : unitMakesDeadline(row, pace, deadlineMs) || (mode === 'def' && unitMakesDeadline(row, 'knight', deadlineMs)));
  }

  const cols   = targetCols();
  const colDef = cols.find(c => c.key === targetSort.key) || cols[2];
  data.sort((a, b) => {
    const av = a[colDef.key], bv = b[colDef.key];
    if (colDef.str) return targetSort.dir * String(av).localeCompare(String(bv));
    return targetSort.dir * (av - bv);
  });

  return { mode, m, pace, target, tgtCoord, tgtPts, tgtBarb, deadlineMs, data };
}

// A village's unit lands by the deadline: owns the unit, finite travel, arrives in time (launch = now).
function unitMakesDeadline(row, u, deadlineMs) {
  return row[u] > 0 && isFinite(row['tt_'+u]) && serverNowMs() + row['tt_'+u] * 60000 <= deadlineMs;
}
// A unit's arrival time only exceeds the deadline (used to grey out a cell; ignores ownership).
function unitLateForDeadline(row, u, deadlineMs) {
  return deadlineMs !== null && isFinite(row['tt_'+u]) && serverNowMs() + row['tt_'+u] * 60000 > deadlineMs;
}
// Off-power tier badge (off mode Tribe Timings), matching the By Villages tier styling.
function offTierBadge(tier) {
  const cls = { complete:'badge-complete', tq:'badge-tq', half:'badge-half', none:'badge-empty' }[tier] || 'badge-empty';
  const lbl = tier === 'none' ? '—' : t(tier === 'complete' ? 'tier_complete' : tier === 'tq' ? 'tier_tq' : 'tier_half');
  return `<span class="badge ${cls}">${lbl}</span>`;
}

// Clear the Tribe Timings tab: this tab keeps no stored list (the table is derived live from
// the target coord + filters), so "Clear All" empties the per-run inputs — target coord,
// search, min-power and the arrival deadline — leaving the mode/speed settings. Confirms only
// when a target is actually set. Re-renders → no target → empty table.
function clearTimings() {
  const coordEl = document.getElementById('target-coord');
  if (coordEl && coordEl.value.trim() && !confirm(t('confirm_clear_timings'))) return;
  ['target-coord', 'target-search', 'target-min-power', 'target-arrival-date', 'target-arrival-time']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderTargetTable();
}

function renderTargetTable() {
  const mode = document.getElementById('target-mode')?.value || 'off';

  // Rebuild pace-unit select options, preserving current selection when still valid
  const paceOpts = mode === 'off' ? ['any','light','axe','sword','ram'] : ['any','spy','light','heavy','spear','sword','knight'];
  const paceEl = document.getElementById('target-pace-unit');
  if (paceEl) {
    const curPace = paceEl.value;
    paceEl.innerHTML = paceOpts.map(u => `<option value="${u}">${t('unit_'+u)}</option>`).join('');
    paceEl.value = paceOpts.includes(curPace) ? curPace : 'any';
  }

  const cols = targetCols();
  document.getElementById('target-thead-row').innerHTML = cols.map(c => {
    if (c.noSort) return `<th class="${c.left ? 'left' : ''}">${c.label}</th>`;
    const sortCls = targetSort.key === c.key ? (targetSort.dir === -1 ? ' sort-desc' : ' sort-asc') : '';
    const titleAttr = c.travel ? ` title="${t('tt_title')}"` : (c.title ? ` title="${esc(c.title)}"` : '');
    return `<th class="${c.left ? 'left' : ''}${sortCls}"${titleAttr} onclick="sortTarget('${c.key}')">${c.label} <span class="sort-arrow"></span></th>`;
  }).join('');

  const tbody = document.getElementById('target-tbody');
  const ctx = targetTimingData();
  const ownerEl = document.getElementById('target-owner-info');
  if (ownerEl) ownerEl.textContent = ctx.target ? dbOwnerLabel(`${ctx.target.x}|${ctx.target.y}`) : '';
  if (!villages.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols.length}">${t('empty_load_byvillages')}</td></tr>`;
    return;
  }
  if (!ctx.target) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols.length}">${t('empty_no_target')}</td></tr>`;
    return;
  }

  const { m, pace, tgtCoord, tgtPts, tgtBarb, deadlineMs, data } = ctx;
  const powColor = mode === 'off' ? '#e06040' : '#60a0e0';
  const rows = data.map(v => {
    const units = orderUnitsFor(mode, pace, v);
    const orderUrl = units && rallyUrl(v.coord, tgtCoord, units);
    const orderCell = orderUrl ? `<a href="${esc(orderUrl)}" target="_blank" rel="noopener">${mode === 'off' ? '⚔' : '🛡'}</a>` : '—';
    const attPts = mode === 'off' ? playerPointsAtCoord(v.coord) : 0;
    const moraleTip = mode !== 'off' ? ''
      : tgtBarb ? t('morale_barb')
      : (tgtPts && attPts) ? t('morale_tip')(tgtPts.toLocaleString(), attPts.toLocaleString())
      : '';
    const moraleCell = mode === 'off'
      ? `<td style="color:${moraleColor(v.morale)};font-weight:600;"${moraleTip ? ` title="${esc(moraleTip)}"` : ''}>${fmtMorale(v.morale)}</td>`
      : '';
    return `
    <tr>
      <td class="left" style="font-family:monospace;">${v.coord}</td>
      <td class="left"><span class="player-tag">${decode(v.player)}</span></td>
      <td style="color:#f0c040;font-weight:600;">${isFinite(v.dist) ? v.dist.toFixed(1) : '—'}</td>
      <td style="color:${powColor};font-weight:600;">${fmtM(v[m.power])}${mode === 'off' ? ` ${offTierBadge(getOffTier(v.offPow))}` : ''}</td>
      ${moraleCell}
      ${m.units.map(u => numCell(v[u])).join('')}
      ${m.travel.map(u => isFinite(v['tt_'+u])
        ? `<td${unitLateForDeadline(v, u, deadlineMs) ? ' class="tt-late"' : ''}>${fmtTime(v['tt_'+u])}<br><span style="font-size:11px;color:#a08850;">${fmtArrivalTime(v['tt_'+u])}</span></td>`
        : '<td class="num-zero">—</td>').join('')}
      <td>${orderCell}</td>
    </tr>
  `;
  }).join('');

  tbody.innerHTML = rows ||
    `<tr class="empty-row"><td colspan="${cols.length}">${t('empty_no_byvillages')}</td></tr>`;
}

function sortTarget(key) {
  if (targetSort.key === key) targetSort.dir *= -1;
  else {
    const c = targetCols().find(c => c.key === key);
    targetSort = { key, dir: c ? c.defDir : 1 };
  }
  renderTargetTable();
}

// ── Per-player BB export for Tribe Timings ──
// Groups the currently-shown rows by player so each member can be told which of their
// villages reach the target (and when). Honors the same filters as the table.
function showTargetTimingBB() {
  const ctx = targetTimingData();
  if (!ctx.target) { alert(t('empty_no_target')); return; }
  if (!ctx.data || !ctx.data.length) { alert(t('alert_no_tt_rows')); return; }
  const { mode, m, pace, tgtCoord, deadlineMs, data } = ctx;
  const defender = dbOwnerName(tgtCoord);

  // For "Any" pace, name a concrete unit per village so the line is actionable: the
  // fastest owned unit that still lands in time, else the fastest owned, else the fastest.
  const pickUnit = v => {
    // Honor the chosen pace when the village actually owns it.
    if (pace !== 'any' && v[pace] > 0) return pace;
    // Otherwise ("Any", or a specific pace the village lacks but was kept by the def-mode
    // knight override) name a real owned unit: fastest owned in-time, else fastest owned.
    const owned = m.travel.filter(u => v[u] > 0);
    if (deadlineMs !== null) {
      const inTime = owned.find(u => unitMakesDeadline(v, u, deadlineMs));
      if (inTime) return inTime;
    }
    return owned[0] || (pace !== 'any' ? pace : m.travel[0]);
  };

  const byPlayer = {};
  for (const v of data) {
    const name = decode(v.player) || '—';
    (byPlayer[name] = byPlayer[name] || []).push(v);
  }
  const names = Object.keys(byPlayer).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  let bb = '';
  for (const name of names) {
    const rows = byPlayer[name];
    bb += `========== ${name} (${rows.length}) ==========\n`;
    bb += `[b]${t('bb_tt_target')}:[/b] [coord]${tgtCoord}[/coord]${defender ? ` ([player]${defender}[/player])` : ''}\n\n`;
    for (const v of rows) {
      const u   = pickUnit(v);
      const tt  = v['tt_'+u];
      const arr = isFinite(tt) ? fmtArrivalTime(tt) : '—';
      const dur = isFinite(tt) ? fmtTime(tt) : '—';
      const url = rallyUrl(v.coord, tgtCoord, orderUnitsFor(mode, pace, v));
      const urlPart = url ? ` — [url=${url}]▶[/url]` : '';
      bb += `${v.coord} [b][color=#0000a5]${arr}[/color][/b] (${t('unit_'+u)} · ${dur})${urlPart}\n`;
    }
    bb += '\n';
  }

  document.getElementById('bb-output').value = bb.trimEnd() + '\n';
  document.getElementById('bb-modal').classList.add('open');
}

