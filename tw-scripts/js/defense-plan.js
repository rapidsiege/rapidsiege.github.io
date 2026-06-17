// ══════════════════════════════════════════════════════════════
// PLAN DEFENSE  (v3.0.0)
// ══════════════════════════════════════════════════════════════
// Distributes defensive support from the tribe's own villages to the allied villages
// listed in Defensive Targets, to meet each one's per-type objective (spear/sword/spy/
// heavy). Core rules:
//   • Support is intra-tribe only — a sender may only support a target in the SAME tribe
//     (resolved via each village's tribe tag in the world DB). WC→WC, WC.→WC. only.
//   • "Ignore Coordinates" villages are held home (front-line) — never senders.
//   • Bigger defenders carry more: players are loaded toward an EQUAL DRAIN RATIO
//     (weight = remaining def-pop capacity), so a 10k-pop player sends ~10× a 1k-pop one.
//   • Farm-pop weighted (spear 1 / sword 1 / spy 2 / heavy 6) — capacity is pop, not count.
//   • A player's send is spread EVENLY across their villages (re-recruit faster).
//   • Objectives are caps (never over-send); shortfalls are warned.
//   • A village may split across several targets (demand precision over trip count).

// ── Capped, weight-proportional integer apportionment (largest-remainder) ──
// Distributes `n` whole units across items [{weight, cap}] proportional to weight,
// never exceeding any item's cap; overflow from capped items spills to the rest.
// Returns an int array summing to min(n, Σcap). Deterministic (input order breaks ties).
function apportionCapped(n, items) {
  const alloc = items.map(() => 0);
  let remaining = Math.min(n, items.reduce((s, it) => s + Math.max(0, it.cap), 0));
  while (remaining > 0) {
    const active = items.map((it, i) => i).filter(i => items[i].weight > 0 && alloc[i] < items[i].cap);
    if (!active.length) break;
    const wsum = active.reduce((s, i) => s + items[i].weight, 0);
    if (wsum <= 0) break;
    let used = 0;
    const rema = [];
    for (const i of active) {
      const room = items[i].cap - alloc[i];
      const want = remaining * items[i].weight / wsum;
      const give = Math.min(Math.floor(want), room);
      alloc[i] += give; used += give;
      rema.push({ i, frac: want - Math.floor(want), room: room - give });
    }
    remaining -= used;
    if (remaining > 0) {
      // hand out the leftover one at a time, largest fractional part first
      rema.sort((a, b) => b.frac - a.frac);
      let progressed = false;
      for (const r of rema) {
        if (remaining <= 0) break;
        if (r.room > 0) { alloc[r.i]++; remaining--; progressed = true; }
      }
      if (!used && !progressed) break; // safety: nothing could be placed
    }
  }
  return alloc;
}

function parseDefIgnoreSet() {
  const set = new Set();
  for (const line of String(defIgnore || '').split('\n')) {
    const c = parseCoordStr(line);
    if (c) set.add(`${c.x}|${c.y}`);
  }
  return set;
}
function updDefIgnore() {
  const el = document.getElementById('dp-ignore-input');
  defIgnore = el ? el.value : '';
  saveDefensive();
}
function toggleDefIgnore() {
  const el = document.getElementById('dp-ignore-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

// ── Enemy Tribes: bar senders too close to a hostile tribe's villages ──
// The "Enemy Tribes" textarea holds tribe tags/names (one per line); "Distance from enemy
// tribes" is a field radius. A sender within that radius of ANY village owned by ANY listed
// tribe is held home (front-line), exactly like an Ignore coordinate. Needs the world DB.
function parseDefEnemySet() {
  const set = new Set();
  for (const line of String(defEnemyTribes || '').split('\n')) {
    const s = line.trim().toLowerCase();
    if (s) set.add(s);
  }
  return set;
}
function updDefEnemy() {
  const el = document.getElementById('dp-enemy-input');
  defEnemyTribes = el ? el.value : '';
  saveDefensive();
}
function updDefEnemyDist() {
  const el = document.getElementById('plan-def-enemy-dist');
  defEnemyDist = el ? Math.max(0, parseInt(el.value, 10) || 0) : 0;
  saveDefensive();
}
function toggleDefEnemy() {
  const el = document.getElementById('dp-enemy-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

// {x,y} of every village owned by a tribe in `enemySet` (matched on TAG or NAME, case-
// insensitive). Empty when the DB isn't loaded or nothing matches.
function enemyTribeVillageCoords(enemySet) {
  const coords = [];
  if (!enemySet.size || !villageDb.length) return coords;
  for (const v of villageDb) {
    const a = allyDb[playerAllyDb[v.playerId]];
    if (!a) continue;
    if (enemySet.has(String(a.tag || '').toLowerCase()) || enemySet.has(String(a.name || '').toLowerCase()))
      coords.push({ x: v.x, y: v.y });
  }
  return coords;
}
// The set of tribe tags+names (lowercased) the DB knows — to flag unresolved Enemy Tribes entries.
function knownTribeTokens() {
  const set = new Set();
  for (const id in allyDb) {
    const a = allyDb[id];
    if (a.tag)  set.add(String(a.tag).toLowerCase());
    if (a.name) set.add(String(a.name).toLowerCase());
  }
  return set;
}

// Slowest base travel-min among the unit types present in a packet (a mixed def bundle
// marches at its slowest unit; e.g. spear+heavy → spear pace). Empty → 0.
function defPacketBaseMin(units) {
  let base = 0;
  for (const u of DEF_OBJ_UNITS) if ((units[u] || 0) > 0) base = Math.max(base, UNIT_BASE_MIN[u]);
  return base;
}

// Epoch ms of a target's arrival deadline (server-local date+time → UTC), or null if
// the target has no full date+time set.
function defArrivalMs(tg) {
  const dm = String(tg.arriveDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = String(tg.arriveTime || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!dm || !tm) return null;
  const off = parseFloat(otCfg.serverUtcOffset);
  return Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2], +(tm[3] || 0)) - (isNaN(off) ? 2 : off) * 3600000;
}
// Format an epoch ms as a server-local "YYYY-MM-DD HH:MM:SS" wall-clock string.
function fmtServerDT(ms) {
  if (ms === null || ms === undefined) return '';
  const off = parseFloat(otCfg.serverUtcOffset);
  const d = new Date(ms + (isNaN(off) ? 2 : off) * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function generateDefPlan() {
  if (!villages.length)   { alert(t('plan_need_data'));   return; }
  if (!defTargets.length) { alert(t('def_need_targets')); return; }
  defTargets.forEach(normalizeDefTarget);

  const ws = parseFloat((document.getElementById('plan-def-world-speed') || {}).value) || 1;
  const us = parseFloat((document.getElementById('plan-def-unit-speed')  || {}).value) || 1;
  const minDist = parseFloat((document.getElementById('plan-def-min-dist') || {}).value) || 0;
  const maxDist = parseFloat((document.getElementById('plan-def-max-dist') || {}).value) || 0;
  const ignore  = parseDefIgnoreSet();
  const enemyDist = parseFloat((document.getElementById('plan-def-enemy-dist') || {}).value) || 0;
  const enemySet  = parseDefEnemySet();

  defPlanRows = []; defPlanWarnings = [];

  // ── Enemy Tribes proximity bar. Needs the world DB to locate hostile villages; without
  // it (or with a 0 distance) the filter is a no-op — warn so it doesn't fail silently. ──
  const enemyCoords = enemyDist > 0 ? enemyTribeVillageCoords(enemySet) : [];
  if (enemySet.size) {
    if (enemyDist <= 0)            defPlanWarnings.push(t('warn_def_enemy_no_dist'));
    else if (!villageDb.length)   defPlanWarnings.push(t('warn_def_enemy_no_db'));
    else {
      const known = knownTribeTokens();
      const unresolved = [...enemySet].filter(x => !known.has(x));
      if (unresolved.length) defPlanWarnings.push(t('warn_def_enemy_unresolved')(unresolved.join(', ')));
    }
  }
  const nearEnemy = s => enemyCoords.length > 0 && enemyCoords.some(e => distXY(s.c, e) <= enemyDist);

  // Senders: our troop villages with a parseable coord, not on the ignore list, not within
  // the enemy-tribe radius, holding at least DEF_SENDER_MIN_POP farm pop in defensive troops
  // (small garrisons are left alone). cap = def farm-pop. Ignored / enemy-adjacent / sub-
  // threshold villages are excluded here so they inflate neither the candidate pool NOR a
  // player's capacity weight.
  const senders = villages.map(v => ({
    v, c: parseCoordStr(v.coord), tag: dbTribeAt(v.coord),
    stock: { spear: v.spear || 0, sword: v.sword || 0, spy: v.spy || 0, heavy: v.heavy || 0 },
    cap: defPop(v),
  })).filter(s => s.c && !ignore.has(s.v.coord) && !nearEnemy(s) && s.cap >= DEF_SENDER_MIN_POP);

  const capByPlayer = {};
  for (const s of senders) capByPlayer[s.v.player] = (capByPlayer[s.v.player] || 0) + s.cap;
  const sentByPlayer = {};
  const vSentPop = senders.map(() => 0);

  const tgs = defTargets.map((tg, i) => ({ tg, i, c: parseCoordStr(tg.coord), tag: tg.tribe || dbTribeAt(tg.coord) }));
  tgs.filter(T => !T.c).forEach(T => defPlanWarnings.push(t('warn_invalid_coord')(T.tg.coord)));

  const dbReady = villageDb.length > 0;
  // Same-tribe gate. Without the world DB we can't resolve tribes, so we allow all (dev
  // fallback); with it loaded, BOTH sides must resolve to the SAME tag or the pair is barred.
  const sameTribe = (s, T) => !dbReady || (!!s.tag && !!T.tag && s.tag === T.tag);

  // Loud failure modes (so an empty target explains itself rather than reading as a bug):
  if (dbReady) {
    for (const T of tgs) if (T.c && !T.tag) defPlanWarnings.push(t('warn_def_target_no_tribe')(T.tg.coord));
    const noTag = [...new Set(senders.filter(s => !s.tag).map(s => s.v.coord))];
    if (noTag.length) {
      const CAP = 8;
      const list = noTag.slice(0, CAP).join(', ') + (noTag.length > CAP ? t('warn_def_more')(noTag.length - CAP) : '');
      defPlanWarnings.push(t('warn_def_sender_no_tribe')(noTag.length, list));
    }
  }

  const dist = (s, T) => distXY(s.c, T.c);
  const inBand = (s, T) => (minDist <= 0 || dist(s, T) >= minDist) && (maxDist <= 0 || dist(s, T) <= maxDist);
  // Per-type arrival feasibility, gated at THAT type's own pace (generous). The exact
  // bundled-pace check happens after allocation (a row is late-flagged if its slowest
  // unit can't make the deadline) — mirrors the offensive engine's vet-then-flag split.
  const arrMs = T => defArrivalMs(T.tg);
  const typeArriveOk = (s, T, u) => {
    const a = arrMs(T);
    if (a === null) return true;
    return a - travelTimeMin(dist(s, T), UNIT_BASE_MIN[u], ws, us) * 60000 >= serverNowMs();
  };

  // Targets are filled deadline-first (earliest arrival), then no-deadline by descending
  // total demand — so the tight, time-critical asks claim their reachable senders first.
  const order = tgs.filter(T => T.c).sort((A, B) => {
    const a = arrMs(A), b = arrMs(B);
    if (a !== null && b !== null) return a - b;
    if (a !== null) return -1;
    if (b !== null) return 1;
    const tot = T => DEF_OBJ_UNITS.reduce((s, u) => s + (T.tg[u] || 0), 0);
    return tot(B) - tot(A);
  });

  const packets = {}; // `${senderIdx}#${T.i}` → {si, T, units}
  const commit = (T, si, u, q) => {
    if (q <= 0) return;
    senders[si].stock[u] -= q;
    vSentPop[si] += q * POP[u];
    const key = si + '#' + T.i;
    const pk = packets[key] || (packets[key] = { si, T, units: { spear: 0, sword: 0, spy: 0, heavy: 0 } });
    pk.units[u] += q;
  };

  for (const T of order) {
    // ── Pass A — player-level allocation per unit type. Weight = remaining def-pop
    // capacity (→ equal drain ratio: bigger defenders send proportionally more), capped
    // by each player's reachable stock of that type. Excess that no player can cover is a
    // shortfall. sentByPlayer accrues here so later types/targets see each player's drain. ──
    const playerGive = {}; // player → {spear,sword,spy,heavy}
    const eligByType = {}; // unit → { player → [sender indices eligible for THIS type] }
    for (const u of DEF_OBJ_UNITS) {
      const n = T.tg[u] || 0;
      if (n <= 0) continue;
      const byP = {};
      for (let si = 0; si < senders.length; si++) {
        const s = senders[si];
        if (s.stock[u] > 0 && sameTribe(s, T) && inBand(s, T) && typeArriveOk(s, T, u))
          (byP[s.v.player] || (byP[s.v.player] = [])).push(si);
      }
      eligByType[u] = byP;
      const names = Object.keys(byP);
      const pItems = names.map(P => ({
        weight: Math.max(1e-6, (capByPlayer[P] || 0) - (sentByPlayer[P] || 0)),
        cap: byP[P].reduce((s, si) => s + senders[si].stock[u], 0),
      }));
      const pAlloc = apportionCapped(n, pItems);
      let assigned = 0;
      names.forEach((P, pi) => {
        const give = pAlloc[pi];
        if (give <= 0) return;
        (playerGive[P] || (playerGive[P] = { spear: 0, sword: 0, spy: 0, heavy: 0 }))[u] += give;
        sentByPlayer[P] = (sentByPlayer[P] || 0) + give * POP[u];
        assigned += give;
      });
      if (assigned < n) defPlanWarnings.push(t('warn_def_short')(t('th_' + u), n - assigned, T.tg.coord));
    }

    // ── Pass B — spread each player's allocation across their villages, keeping every
    // emitted order ≥ DEF_MIN_PACKET_POP farm pop (fewer, meatier trips). Use only as many
    // villages as that floor allows — k = ⌊totalPop / minPacket⌋, capped at the count of
    // eligible villages — least-drained first (global per-village evenness). If those few
    // can't hold a type (stock), it spills to the next eligible villages. ──
    for (const P in playerGive) {
      const give = playerGive[P];
      const candSet = new Set();
      for (const u of DEF_OBJ_UNITS) if (eligByType[u] && eligByType[u][P]) for (const si of eligByType[u][P]) candSet.add(si);
      const cand = [...candSet].sort((a, b) => (vSentPop[a] - vSentPop[b]) || (senders[a].v.coord < senders[b].v.coord ? -1 : 1));
      const totalPop = DEF_OBJ_UNITS.reduce((s, u) => s + (give[u] || 0) * POP[u], 0);
      const k = Math.min(cand.length, Math.max(1, Math.floor(totalPop / DEF_MIN_PACKET_POP)));
      for (const u of DEF_OBJ_UNITS) {
        const need = give[u] || 0;
        if (need <= 0) continue;
        const eligSet = new Set(eligByType[u][P]);
        const elig = cand.filter(si => eligSet.has(si));
        const primary = elig.slice(0, k), spill = elig.slice(k);
        const a1 = apportionCapped(need, primary.map(si => ({ weight: 1, cap: senders[si].stock[u] })));
        primary.forEach((si, j) => commit(T, si, u, a1[j]));
        const rem = need - a1.reduce((s, x) => s + x, 0);
        if (rem > 0 && spill.length) {
          const a2 = apportionCapped(rem, spill.map(si => ({ weight: 1, cap: senders[si].stock[u] })));
          spill.forEach((si, j) => commit(T, si, u, a2[j]));
        }
      }
    }
  }

  for (const key in packets) {
    const pk = packets[key], s = senders[pk.si], T = pk.T;
    if (DEF_OBJ_UNITS.reduce((a, u) => a + pk.units[u], 0) <= 0) continue;
    const d = distXY(s.c, T.c);
    const travel = travelTimeMin(d, defPacketBaseMin(pk.units), ws, us);
    const arriveMs = defArrivalMs(T.tg);
    const departMs = arriveMs !== null ? arriveMs - travel * 60000 : null;
    const late = arriveMs !== null && departMs < serverNowMs();
    defPlanRows.push({
      srcCoord: s.v.coord, srcPlayer: decode(s.v.player),
      tCoord: T.tg.coord, tPlayer: T.tg.defender, tribe: T.tg.tribe,
      units: { ...pk.units }, dist: d, travel,
      arriveDate: T.tg.arriveDate, arriveTime: T.tg.arriveTime,
      departMs, arriveMs, late,
    });
    if (late) defPlanWarnings.push(t('warn_def_row_late')(s.v.coord, T.tg.coord));
  }
  // table reads target-first; the per-player BB regroups by sender
  defPlanRows.sort((a, b) => (a.tCoord < b.tCoord ? -1 : a.tCoord > b.tCoord ? 1 : 0)
    || a.srcPlayer.toLowerCase().localeCompare(b.srcPlayer.toLowerCase()));

  saveDefensive();
  renderDefPlanTable();
}

function delDefPlanRow(i) { defPlanRows.splice(i, 1); saveDefensive(); renderDefPlanTable(); }

// Wipe the generated defensive plan (mirrors clearDefTargets). Confirms only when there's
// a plan to lose; resets the same state generateDefPlan() rebuilds, then re-renders empty.
function clearDefPlan() {
  if (defPlanRows.length && !confirm(t('confirm_clear_def_plan'))) return;
  defPlanRows = []; defPlanWarnings = [];
  saveDefensive(); renderDefPlanTable();
}

// Compact per-row troop cell / BB fragment (only non-zero types, in objective order)
function defUnitsCell(units) {
  return DEF_OBJ_UNITS.filter(u => (units[u] || 0) > 0)
    .map(u => `<span style="white-space:nowrap;">${twIcon(u)} ${units[u].toLocaleString()}</span>`).join(' ');
}
function defUnitsBB(units) {
  return DEF_OBJ_UNITS.filter(u => (units[u] || 0) > 0).map(u => `${units[u]}[unit]${u}[/unit]`).join(' ');
}

function renderDefPlanTable() {
  const warnEl = document.getElementById('defplan-warnings');
  if (warnEl) warnEl.innerHTML = defPlanWarnings.length
    ? `<details class="warn-box"><summary>${t('plan_warnings_toggle')(defPlanWarnings.length)}</summary>`
      + `<div class="warn-list">${defPlanWarnings.map(esc).join('<br>')}</div></details>` : '';

  const sumEl = document.getElementById('defplan-summary');
  if (sumEl) sumEl.textContent = defPlanRows.length ? t('def_plan_summary')(defPlanRows.length) : '';

  const tbody = document.getElementById('defplan-tbody');
  if (!tbody) return;
  if (!defPlanRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="11">${t('empty_no_def_plan')}</td></tr>`;
    return;
  }
  let lastT = null;
  tbody.innerHTML = defPlanRows.map((r, i) => {
    const first = r.tCoord !== lastT;
    lastT = r.tCoord;
    const url = rallyUrl(r.srcCoord, r.tCoord, r.units);
    const times = r.arriveMs !== null
      ? `<span style="color:${r.late ? '#e06040' : '#2e7d32'};">${esc(t('def_col_arrive'))} ${esc(fmtServerDT(r.arriveMs))}</span><br>`
        + `<span style="color:#e0a020;${r.late ? 'font-weight:600;' : ''}">${r.late ? '⚠ ' : ''}${esc(t('def_col_depart'))} ${esc(fmtServerDT(r.departMs))}</span>`
      : '—';
    const trStyle = [
      first && i > 0 ? 'border-top:2px solid #7a5c10' : '',
      r.late ? 'background:rgba(192,64,32,0.08)' : '',
    ].filter(Boolean).join(';');
    return `
    <tr${trStyle ? ` style="${trStyle}"` : ''}>
      <td style="color:#806030;">${first ? (i + 1) : ''}</td>
      <td class="left" style="font-family:monospace;">${first ? esc(r.tCoord) : ''}</td>
      <td class="left">${first && r.tPlayer ? `<span class="player-tag">${esc(r.tPlayer)}</span>` : ''}</td>
      <td class="left">${first && r.tribe ? `<span class="player-tag">${esc(r.tribe)}</span>` : ''}</td>
      <td class="left" style="font-family:monospace;">${esc(r.srcCoord)}</td>
      <td class="left"><span class="player-tag">${esc(r.srcPlayer)}</span></td>
      <td class="left">${defUnitsCell(r.units)}</td>
      <td style="color:#f0c040;">${r.dist.toFixed(1)}</td>
      <td>${fmtTime(r.travel)}</td>
      <td style="font-size:11px;font-family:monospace;">${times}</td>
      <td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">🛡</a>` : '—'}<button class="btn btn-ghost btn-sm" style="margin-left:4px;" onclick="delDefPlanRow(${i})">✕</button></td>
    </tr>`;
  }).join('');
}

// ── Per-player BB export: origin → destination support, with the pre-filled rally URL ──
function showDefPlayerBB() {
  if (!defPlanRows.length) { alert(t('empty_no_def_plan')); return; }
  const byPlayer = {};
  for (const r of defPlanRows) (byPlayer[r.srcPlayer] || (byPlayer[r.srcPlayer] = [])).push(r);
  const names = Object.keys(byPlayer).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  let bb = '';
  for (const name of names) {
    const rows = byPlayer[name];
    bb += `========== ${name} (${rows.length}) ==========\n`;
    for (const r of rows) {
      const url     = rallyUrl(r.srcCoord, r.tCoord, r.units);
      const urlPart = url ? ` — [url=${url}]${t('def_bb_send')}[/url]` : '';
      const def     = r.tPlayer ? ` ([player]${r.tPlayer}[/player])` : '';
      const troops  = defUnitsBB(r.units);
      let line = `${r.srcCoord} → [coord]${r.tCoord}[/coord]${def}: ${troops}${urlPart}`;
      if (r.arriveMs !== null) {
        line += ` [b][color=#ff0e0e]${t('def_bb_depart')(fmtServerDT(r.departMs))}[/color][/b]`
              + ` [color=#2e2eff]${t('def_bb_arrive')(fmtServerDT(r.arriveMs))}[/color]`;
      }
      bb += line + '\n';
    }
    bb += '\n';
  }
  document.getElementById('bb-output').value = bb.trimEnd() + '\n';
  document.getElementById('bb-modal').classList.add('open');
}
