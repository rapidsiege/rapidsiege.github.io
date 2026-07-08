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

// Anti-surprise (v4.4.0): the map-drawn coordinate filter is SHARED with Plan Offensive and
// silently restricts defense senders too — advertise it next to the Generate button whenever
// an area is active (mirrors the Plan-Off #pcf-summary chip).
function updDefPolyNote() {
  const el = document.getElementById('dp-poly-note');
  if (!el) return;
  el.textContent = (typeof coordPolygonActive === 'function' && coordPolygonActive())
    ? t('coord_filter_active')(coordPolygonLabel()) : '';
}

// ── Ignore Players (Plan Defense): whole players held home — none of their villages
// send support. Mirrors the Offensive Targets picker (chips + select); state lives in
// defensive-targets.js (defIgnorePlayers) and is applied to the sender pool in
// generateDefPlan(). ──
function toggleDefIgnorePlayers() {
  const el = document.getElementById('dp-ignore-players-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
// Loaded troop-file players not already ignored, alphabetical (label shows village count).
function defIgnorePlayerOptions() {
  const ig = new Set(defIgnorePlayers);
  return Object.keys(players)
    .filter(name => !ig.has(name))
    .map(name => ({ name, villages: players[name].villages.length }))
    .sort((a, b) => decode(a.name).toLowerCase().localeCompare(decode(b.name).toLowerCase()));
}
function addDefIgnorePlayer(name) {
  if (!name || defIgnorePlayers.includes(name)) return;
  defIgnorePlayers.push(name);
  saveDefensive(); renderDefIgnorePlayers();
}
function removeDefIgnorePlayer(idx) {
  defIgnorePlayers.splice(idx, 1);
  saveDefensive(); renderDefIgnorePlayers();
}
// Chip list of ignored players + picker (same chip/select markup as the offensive one).
function renderDefIgnorePlayers() {
  const host = document.getElementById('dp-ignore-players-host');
  if (!host) return;
  if (!Object.keys(players).length && !defIgnorePlayers.length) {
    host.innerHTML = `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    return;
  }
  const chips = defIgnorePlayers.map((name, i) =>
    `<span class="chip">${esc(decode(name))}<span class="chip-x" onclick="removeDefIgnorePlayer(${i})">✕</span></span>`).join('');
  const opts = defIgnorePlayerOptions();
  const picker = `<select class="cell-input" style="width:170px;" onchange="addDefIgnorePlayer(this.value)">
       <option value="">${t('opt_pick_ignore_player')}</option>
       ${opts.map(s => `<option value="${esc(s.name)}">${esc(decode(s.name))} (${s.villages})</option>`).join('')}
     </select>`;
  host.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${chips}${picker}</div>`;
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
function updDefFarFirst() {
  const el = document.getElementById('plan-def-far-first');
  defFarFirst = !!(el && el.checked);
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

  const ws = twWorldSpeed; // per-world config (World dropdown), not user-editable
  const us = twUnitSpeed;
  const minDist = parseFloat((document.getElementById('plan-def-min-dist') || {}).value) || 0;
  const maxDist = parseFloat((document.getElementById('plan-def-max-dist') || {}).value) || 0;
  const ignore  = parseDefIgnoreSet();
  const ignorePl = new Set(defIgnorePlayers);
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

  // Senders: our troop villages with a parseable coord, not on the ignore list (coords OR
  // whole ignored players), inside the map-drawn area if one exists (passesCoordPolygon —
  // shared with Plan Offensive, honours "Select Reverse"; typed X|Y filters stay
  // offensive-only), not within the enemy-tribe radius, holding at least
  // DEF_SENDER_MIN_POP farm pop of AVAILABLE defense (small garrisons are left alone).
  // v4.5.0: stock AND cap are the AVAILABLE units (defAvailUnits — at home or incoming,
  // capped at own troops), not the player's total troops: defense that is deployed
  // elsewhere is never assigned, so no order ever implies recalling support. Without
  // station data defAvailUnits falls back to raw troops (pre-4.5 behavior). Ignored /
  // filtered / enemy-adjacent / sub-threshold villages are excluded here so they inflate
  // neither the candidate pool NOR a player's capacity weight.
  const senders = villages.map(v => {
    const stock = defAvailUnits(v);
    return {
      v, c: parseCoordStr(v.coord), tag: dbTribeAt(v.coord),
      stock, cap: DEF_OBJ_UNITS.reduce((s, u) => s + stock[u] * POP[u], 0),
    };
  }).filter(s => s.c && !ignore.has(s.v.coord) && !ignorePl.has(s.v.player)
    && passesCoordPolygon(s.c.x, s.c.y)
    && !nearEnemy(s) && s.cap >= DEF_SENDER_MIN_POP);

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
    // eligible villages — least-drained first (global per-village evenness). With
    // "Prioritize Sending From Far Villages" (defFarFirst) the pick order is instead
    // FARTHEST-from-this-target first (drain ties, then coord), so leftover defense pools
    // in the villages nearest the targets, ready to reinforce fastest. Player shares
    // (Pass A) are untouched either way. If the chosen few can't hold a type (stock), it
    // spills to the next eligible villages. ──
    for (const P in playerGive) {
      const give = playerGive[P];
      const candSet = new Set();
      for (const u of DEF_OBJ_UNITS) if (eligByType[u] && eligByType[u][P]) for (const si of eligByType[u][P]) candSet.add(si);
      const cand = [...candSet].sort(defFarFirst
        ? ((a, b) => (dist(senders[b], T) - dist(senders[a], T)) || (vSentPop[a] - vSentPop[b]) || (senders[a].v.coord < senders[b].v.coord ? -1 : 1))
        : ((a, b) => (vSentPop[a] - vSentPop[b]) || (senders[a].v.coord < senders[b].v.coord ? -1 : 1)));
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
    renderDefPlayerSummary(); // clears the per-player summary too
    updDefPolyNote();
    if (typeof renderManageDefTable === 'function') renderManageDefTable(); // Manage Defense reads the plan
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
  renderDefPlayerSummary();
  updDefPolyNote();
  if (typeof renderManageDefTable === 'function') renderManageDefTable(); // Manage Defense reads the plan
}

// ── Per-player support summary (v4.2.0): sending vs actually-available defense ──────────
// "Available" mirrors Outbound Offs' station math (troops − defense − incoming = deployed):
// per unit, available = stationed defense + incoming, capped at the village's OWN troops —
// so own troops deployed elsewhere don't count, and support from other players garrisoned
// in the village never inflates the owner's numbers. Without station data (a plain
// tribe-info file, no defense/incoming rows) the math is meaningless — fall back to own
// troops (the rendered note says so).
function defAvailUnits(v) {
  const station = hasStationData();
  const de  = station ? (defenseByCoord[v.coord]  || {}) : null;
  const inc = station ? (incomingByCoord[v.coord] || {}) : null;
  const avail = {};
  for (const u of DEF_OBJ_UNITS)
    avail[u] = station ? Math.min(v[u] || 0, (de[u] || 0) + (inc[u] || 0)) : (v[u] || 0);
  return avail;
}

// Pure seam: [{player, avail:{spear,sword,spy,heavy}, sending:{…}}] for every player with
// any available defense or any assigned send, biggest available def-pop first. Keyed by
// DECODED name — plan rows carry a decoded srcPlayer while troop rows are raw.
function computeDefPlayerSummary(rows, vils) {
  const by = {};
  const entry = name => by[name] || (by[name] = {
    player: name,
    avail:   { spear: 0, sword: 0, spy: 0, heavy: 0 },
    sending: { spear: 0, sword: 0, spy: 0, heavy: 0 },
  });
  for (const v of vils || []) {
    const a = defAvailUnits(v), e = entry(decode(v.player));
    for (const u of DEF_OBJ_UNITS) e.avail[u] += a[u];
  }
  for (const r of rows || []) {
    const e = entry(r.srcPlayer);
    for (const u of DEF_OBJ_UNITS) e.sending[u] += (r.units && r.units[u]) || 0;
  }
  const pop = tally => DEF_OBJ_UNITS.reduce((s, u) => s + tally[u] * POP[u], 0);
  return Object.values(by)
    .filter(e => pop(e.avail) > 0 || pop(e.sending) > 0)
    .sort((a, b) => (pop(b.avail) - pop(a.avail)) || a.player.toLowerCase().localeCompare(b.player.toLowerCase()));
}

// Rendered under the plan table (tail-called from renderDefPlanTable, so it refreshes on
// generate / row delete / clear / language switch). Needs the troop file — a plan restored
// from localStorage alone has nothing to summarize against.
function renderDefPlayerSummary() {
  const host = document.getElementById('defplan-player-summary');
  if (!host) return;
  if (!defPlanRows.length || !villages.length) { host.innerHTML = ''; return; }
  const data = computeDefPlayerSummary(defPlanRows, villages);
  if (!data.length) { host.innerHTML = ''; return; }
  const totals = { player: t('def_sum_total'), avail: { spear: 0, sword: 0, spy: 0, heavy: 0 }, sending: { spear: 0, sword: 0, spy: 0, heavy: 0 } };
  for (const e of data) for (const u of DEF_OBJ_UNITS) { totals.avail[u] += e.avail[u]; totals.sending[u] += e.sending[u]; }
  const cells = e => DEF_OBJ_UNITS.map(u => {
    const over = e.sending[u] > e.avail[u];
    return `<td><span style="${over ? 'color:#e06040;font-weight:600;' : ''}"${over ? ` title="${esc(t('def_sum_over_title'))}"` : ''}>${e.sending[u].toLocaleString()}</span><span style="color:#5a3a18;"> / ${e.avail[u].toLocaleString()}</span></td>`;
  }).join('');
  host.innerHTML = `
    <div style="font-size:13px;color:#a08050;font-weight:600;margin:16px 0 4px;">${esc(t('def_sum_title'))}</div>
    <div style="font-size:12px;color:#5a3a18;margin-bottom:8px;">${esc(t(hasStationData() ? 'def_sum_note' : 'def_sum_note_nostation'))}</div>
    <div class="table-wrap"><table>
      <thead><tr><th class="left">${t('th_player')}</th>${DEF_OBJ_UNITS.map(u => `<th>${twIcon(u)}</th>`).join('')}</tr></thead>
      <tbody>
        ${data.map(e => `<tr><td class="left"><span class="player-tag">${esc(e.player)}</span></td>${cells(e)}</tr>`).join('')}
        <tr style="font-weight:600;"><td class="left" style="border-top:2px solid #7a5c10;">${esc(totals.player)}</td>${cells(totals).replace(/<td>/g, '<td style="border-top:2px solid #7a5c10;">')}</tr>
      </tbody>
    </table></div>`;
}

// One order line of the per-player export (shared by the forum BB dump AND the PM export,
// so a player reads the same line either way).
function defPlanRowLine(r) {
  const url     = rallyUrl(r.srcCoord, r.tCoord, r.units);
  const urlPart = url ? ` — [url=${url}]${t('def_bb_send')}[/url]` : '';
  const def     = r.tPlayer ? ` ([player]${r.tPlayer}[/player])` : '';
  let line = `${r.srcCoord} → [coord]${r.tCoord}[/coord]${def}: ${defUnitsBB(r.units)}${urlPart}`;
  if (r.arriveMs !== null) {
    line += ` [b][color=#ff0e0e]${t('def_bb_depart')(fmtServerDT(r.departMs))}[/color][/b]`
          + ` [color=#2e2eff]${t('def_bb_arrive')(fmtServerDT(r.arriveMs))}[/color]`;
  }
  return line;
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
    for (const r of rows) bb += defPlanRowLine(r) + '\n';
    bb += '\n';
  }
  document.getElementById('bb-output').value = bb.trimEnd() + '\n';
  document.getElementById('bb-modal').classList.add('open');
}

// ── ✉ Export PMs (v4.7.0): one in-game message per player, split at the bracket limit ──
// A TW message allows ~5,000 of each bracket character; we pack to 4,500 so the user has
// room to prepend their own text. Brackets are the ONLY split criterion (user-confirmed —
// PMs are not character-limited in practice). Splitting is by whole order lines (BB never
// breaks mid-tag); a player whose plan exceeds the limit gets "(1/2), (2/2)…" parts, each
// its own copy button.
const PM_MAX_BRACKETS = 4500;

// The limiting bracket count of a text: max of '[' and ']' occurrences. Pure.
function pmBracketCount(text) {
  let open = 0, close = 0;
  for (const ch of String(text || '')) { if (ch === '[') open++; else if (ch === ']') close++; }
  return Math.max(open, close);
}

// Greedy line packing under the bracket limit. A line that alone exceeds it still ships
// as its own part (nothing smaller to split to). Counts are tracked incrementally. Pure.
function pmSplitParts(lines, maxBrackets) {
  const parts = [];
  let cur = [], open = 0, close = 0;
  for (const line of lines) {
    let lo = 0, lc = 0;
    for (const ch of line) { if (ch === '[') lo++; else if (ch === ']') lc++; }
    if (cur.length && Math.max(open + lo, close + lc) > maxBrackets) {
      parts.push(cur.join('\n'));
      cur = [line]; open = lo; close = lc;
    } else {
      cur.push(line); open += lo; close += lc;
    }
  }
  if (cur.length) parts.push(cur.join('\n'));
  return parts;
}

// Pure seam: [{player, parts: [messageText…]}] from the current plan, players A→Z (same
// grouping as showDefPlayerBB). Every order line is numbered ("1. ", "2. "…) continuing
// across parts, so a player reading message 2/2 knows which order they're at. The
// "===== name (N) =====" header opens the FIRST part only (user decision) — glued to the
// first order line so the packer can never orphan it into a part of its own.
function defPmMessages(maxBrackets) {
  maxBrackets = maxBrackets || PM_MAX_BRACKETS;
  const byPlayer = {};
  for (const r of defPlanRows) (byPlayer[r.srcPlayer] || (byPlayer[r.srcPlayer] = [])).push(r);
  return Object.keys(byPlayer).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(name => {
      const rows = byPlayer[name];
      const lines = rows.map((r, i) => `${i + 1}. ${defPlanRowLine(r)}`);
      lines[0] = `========== ${name} (${rows.length}) ==========\n` + lines[0];
      return { player: name, parts: pmSplitParts(lines, maxBrackets) };
    });
}

// Modal: one copy-button per message part; clicking copies that PM to the clipboard and
// marks the button done (green + checkmark). Done-state is per-open on purpose — reopening
// rebuilds from the current plan, whose messages may have changed.
let defPmExport = [];
function showDefPmExport() {
  if (!defPlanRows.length) { alert(t('empty_no_def_plan')); return; }
  defPmExport = defPmMessages();
  const body = document.getElementById('pm-modal-body');
  if (!body) return;
  body.innerHTML = `<div class="pm-hint">${esc(t('pm_hint'))}</div>` + defPmExport.map((m, pi) =>
    m.parts.map((text, k) => {
      const label = m.parts.length > 1 ? `${m.player} (${k + 1}/${m.parts.length})` : m.player;
      return `<div class="pm-row">
        <button class="btn btn-ghost btn-sm pm-player-btn" onclick="copyDefPm(${pi}, ${k}, this)">📋 ${esc(label)}</button>
        <span class="pm-meta">${esc(t('pm_meta')(text.split('\n').length, text.length, pmBracketCount(text)))}</span>
      </div>`;
    }).join('')
  ).join('');
  document.getElementById('pm-modal').classList.add('open');
}
function closePmModal() { document.getElementById('pm-modal').classList.remove('open'); }
function copyDefPm(pi, k, btn) {
  const m = defPmExport[pi];
  if (!m || m.parts[k] == null) return;
  const text = m.parts[k];
  const mark = () => {
    if (!btn) return;
    btn.classList.add('pm-done');
    btn.textContent = btn.textContent.replace(/^📋/, '✓');
  };
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(text).then(mark).catch(() => mapFallbackCopy(text, mark));
  else mapFallbackCopy(text, mark); // shared hidden-textarea fallback (map-render.js)
}
