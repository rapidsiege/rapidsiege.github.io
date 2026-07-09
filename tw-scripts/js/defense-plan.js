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

// ── "Config Support Size" panel (Max Efficiency vs Support Packs) ──────────────
function toggleDpPackCfg() {
  const el = document.getElementById('dp-packcfg-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
function setDpMode(mode) {
  dpMode = mode === 'packs' ? 'packs' : 'eff';
  saveDefensive(); renderDpPackCfg();
}
function setDpPackSize(v) {
  dpPackSize = Math.max(1, parseInt(v, 10) || DP_PACK_DEFAULTS.size);
  saveDefensive();
  const el = document.getElementById('dp-pack-size'); if (el) el.value = dpPackSize;
}
function setDpPackMax(v) {
  dpPackMax = Math.max(0, parseInt(v, 10) || 0); // 0 = unlimited
  saveDefensive();
  const el = document.getElementById('dp-pack-max'); if (el) el.value = dpPackMax;
}
function setDpPackWeight(u, v) {
  const n = parseFloat(v);
  if (DEF_OBJ_UNITS.includes(u) && Number.isFinite(n) && n > 0) dpPackWeights[u] = n;
  saveDefensive();
  const el = document.getElementById('dp-pack-w-' + u); if (el) el.value = dpPackWeights[u];
}
function resetDpPackWeights() {
  dpPackSize = DP_PACK_DEFAULTS.size;
  dpPackMax = DP_PACK_DEFAULTS.max;
  dpPackWeights = { ...DP_PACK_DEFAULTS.weights };
  saveDefensive(); renderDpPackCfg();
}
// Sync the config panel inputs + mode radios + Support-Packs body visibility to state.
function renderDpPackCfg() {
  const packs = dpMode === 'packs';
  const rEff = document.getElementById('dp-mode-eff'), rPk = document.getElementById('dp-mode-packs');
  if (rEff) rEff.checked = !packs;
  if (rPk) rPk.checked = packs;
  const body = document.getElementById('dp-packcfg-body');
  if (body) body.style.display = packs ? '' : 'none';
  const sz = document.getElementById('dp-pack-size'); if (sz) sz.value = dpPackSize;
  const mx = document.getElementById('dp-pack-max'); if (mx) mx.value = dpPackMax;
  for (const u of DEF_OBJ_UNITS) { const el = document.getElementById('dp-pack-w-' + u); if (el) el.value = dpPackWeights[u]; }
  // Reflect the active mode on the trigger button so it's visible without opening the panel.
  const btn = document.getElementById('dp-packcfg-btn');
  if (btn) btn.textContent = '⚙ ' + t(packs ? 'dp_mode_packs' : 'dp_mode_eff');
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

  // ── MV (vacation-mode) pairs ──────────────────────────────────────────────
  // Two MV-paired players must NOT (rule 1) both support the SAME target village, nor
  // (rule 2) support a village their partner OWNS. Pair members are RAW player names
  // (match senders' s.v.player and the troop-file `players` keys); a DECODED mirror is
  // used to compare against a target's defender (dbOwnerName → decoded). When the pair
  // list is empty this whole block is inert and Pass A runs byte-for-byte as before.
  // mvPairs is the SHARED off/def vacation-mode list (defined in offensive-targets.js).
  const mvPartners = new Map();        // raw player -> Set<raw partner>
  const mvPartnersDecoded = new Map(); // raw player -> Set<decoded partner name>
  for (const pair of (typeof mvPairs !== 'undefined' ? mvPairs : [])) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [a, b] = pair;
    if (!a || !b || a === b) continue;
    const link = (x, y) => {
      let s = mvPartners.get(x); if (!s) mvPartners.set(x, s = new Set()); s.add(y);
      let d = mvPartnersDecoded.get(x); if (!d) mvPartnersDecoded.set(x, d = new Set()); d.add(decode(y));
    };
    link(a, b); link(b, a);
  }

  // "Support Packs" sizing mode — see setDpMode. 'eff' leaves the allocation byte-for-byte.
  const packsMode = dpMode === 'packs';
  // Pack farm weight of a unit. Weights are guaranteed positive by the UI/load guards; the
  // fallback only keeps the math sane should a future path ever write a 0/undefined weight
  // (single definition so remW/pourable/fill can never disagree on the degenerate case).
  const packWOf = u => (dpPackWeights[u] > 0 ? dpPackWeights[u] : 1);
  // One pack of type u = this many units — the fewest whole units whose farm size ≥ dpPackSize
  // (heavy@4 → 125, spear@1 → 500, spy@2 → 250). Allocating in whole packs is what makes each
  // order chunky: a player physically can't receive a sub-pack sliver, so no 20-heavy dribble.
  const packUnitsOf = u => Math.max(1, Math.ceil(dpPackSize / packWOf(u)));

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
    // ── MV exclusions for THIS target (raw player names barred from supporting it) ──
    // Rule 2 (unconditional): a player whose partner OWNS T can't support it. Rule 1:
    // among partners who could BOTH genuinely fill a demanded type of T, keep the one able
    // to send MORE of the DEMANDED types (so a spear-poor/heavy-rich partner doesn't win a
    // spear-only ask), exclude the other from THIS target only; ties → decoded-name order.
    const mvExcluded = new Set();
    if (mvPartners.size) {
      // Reachable demanded-type pop per player for T (the rule-1 keep metric); a player is
      // "eligible" for MV resolution iff this is > 0 (they can actually contribute to T).
      const demandPop = {};
      for (const s of senders) {
        if (!sameTribe(s, T) || !inBand(s, T)) continue;
        let pop = 0;
        for (const u of DEF_OBJ_UNITS)
          if ((T.tg[u] || 0) > 0 && s.stock[u] > 0 && typeArriveOk(s, T, u)) pop += s.stock[u] * POP[u];
        if (pop > 0) demandPop[s.v.player] = (demandPop[s.v.player] || 0) + pop;
      }
      const def = T.tg.defender ? decode(T.tg.defender) : '';
      if (def) for (const P in demandPop) {
        const partners = mvPartnersDecoded.get(P);
        if (partners && partners.has(def)) mvExcluded.add(P);
      }
      for (const pair of mvPairs) {
        const [a, b] = pair;
        if (!(a in demandPop) || !(b in demandPop)) continue;
        if (mvExcluded.has(a) || mvExcluded.has(b)) continue;
        const keepA = demandPop[a] > demandPop[b]
          || (demandPop[a] === demandPop[b] && decode(a).toLowerCase() <= decode(b).toLowerCase());
        mvExcluded.add(keepA ? b : a);
      }
    }

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
        if (s.stock[u] > 0 && sameTribe(s, T) && inBand(s, T) && typeArriveOk(s, T, u) && !mvExcluded.has(s.v.player))
          (byP[s.v.player] || (byP[s.v.player] = [])).push(si);
      }
      eligByType[u] = byP;
      const names = Object.keys(byP);
      const rankP = P => Math.max(1e-6, (capByPlayer[P] || 0) - (sentByPlayer[P] || 0)); // remaining def-pop capacity
      const stockOf = P => byP[P].reduce((s, si) => s + senders[si].stock[u], 0);
      const record = (P, q) => {
        if (q <= 0) return;
        (playerGive[P] || (playerGive[P] = { spear: 0, sword: 0, spy: 0, heavy: 0 }))[u] += q;
        sentByPlayer[P] = (sentByPlayer[P] || 0) + q * POP[u];
      };
      const givenU = P => (playerGive[P] && playerGive[P][u]) || 0;
      // Apportion `qty` across `list` by capacity weight, capped by each player's REMAINING stock
      // (stock − already given this type); records the drain. Returns units placed.
      const apportion = (list, qty) => {
        if (qty <= 0 || !list.length) return 0;
        const alloc = apportionCapped(qty, list.map(P => ({ weight: rankP(P), cap: stockOf(P) - givenU(P) })));
        let placed = 0;
        list.forEach((P, pi) => { if (alloc[pi] > 0) { record(P, alloc[pi]); placed += alloc[pi]; } });
        return placed;
      };
      let assigned = 0;

      if (!packsMode) {
        assigned = apportion(names, n); // Max Efficiency — one capacity-weighted pass (unchanged)
      } else {
        // Support Packs: hand out WHOLE packs first (capacity-weighted, integer packs → no sub-pack
        // slivers), then fold the coverage remainder into existing contributors (their orders stay
        // ≥ a pack), spilling to new senders only when contributors are stock-full. A demand smaller
        // than one pack ships as a single sub-pack order (best-effort "at least this size").
        const target = Math.min(n, names.reduce((s, P) => s + stockOf(P), 0)); // coverage target — identical to Max Efficiency
        const pu = packUnitsOf(u);
        const packs = Math.min(Math.floor(n / pu), names.reduce((s, P) => s + Math.floor(stockOf(P) / pu), 0));
        if (packs > 0) {
          const pa = apportionCapped(packs, names.map(P => ({ weight: rankP(P), cap: Math.floor(stockOf(P) / pu) })));
          names.forEach((P, pi) => { if (pa[pi] > 0) { record(P, pa[pi] * pu); assigned += pa[pi] * pu; } });
        }
        let rem = target - assigned;
        if (rem > 0) { // fold into current contributors first (keeps their order ≥ pack)
          const contribs = names.filter(P => givenU(P) > 0 && stockOf(P) - givenU(P) > 0);
          if (contribs.length) assigned += apportion(contribs, rem);
        }
        rem = target - assigned;
        if (rem > 0) { // concentrate any spill onto the fewest new senders that still form packs
          const rest = names.filter(P => givenU(P) === 0 && stockOf(P) > 0)
            .sort((a, b) => (rankP(b) - rankP(a)) || (decode(a).toLowerCase() < decode(b).toLowerCase() ? -1 : 1));
          const restK = Math.max(1, Math.floor(rem / pu));
          assigned += apportion(rest.slice(0, restK), rem);
          rem = target - assigned;
          if (rem > 0) assigned += apportion(rest.slice(restK), rem); // final coverage spill (over pack-sizing)
        }
      }
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
      // ── Support Packs with a MAX farm size (dpPackMax > 0): bin-fill instead of apportioning.
      // Villages are filled ONE AT A TIME up to the max (weighted farm, all types together), in
      // cand priority order, so each origin→destination order lands in [min, max] by construction.
      // A sub-min tail is FOLDED back into the already-filled villages (softly exceeding the max —
      // it's the softer bound) instead of shipping as a tiny order. Only stock geometry can force
      // an order outside the band: a lone village holding everything (over), or a leftover no
      // filled village has the troops to absorb (under). Coverage always wins — everything Pass A
      // allocated is placed, exactly as in the apportioning paths.
      if (packsMode && dpPackMax > 0) {
        // Ceiling never below the min NOR below any single unit's weight — a binMax smaller than
        // one heavy's farm would let fill() place nothing and silently reroute everything through
        // the fold-back (coverage would still hold, but the [min,max] band would be bypassed).
        const binMax = Math.max(dpPackSize, dpPackMax, ...DEF_OBJ_UNITS.map(packWOf));
        const remGive = { ...give };
        const remW = () => DEF_OBJ_UNITS.reduce((s, u) => s + (remGive[u] || 0) * packWOf(u), 0);
        const eligSets = {};
        for (const u of DEF_OBJ_UNITS) eligSets[u] = new Set((eligByType[u] && eligByType[u][P]) || []);
        // Weighted farm this village could still absorb (stock ∩ remaining give, eligible types).
        const pourable = si => DEF_OBJ_UNITS.reduce((s, u) =>
          s + (eligSets[u].has(si) ? Math.min(senders[si].stock[u], remGive[u] || 0) * packWOf(u) : 0), 0);
        const fill = (si, room) => { // pour ≤ room farm of remGive into si; returns farm poured
          let poured = 0;
          for (const u of DEF_OBJ_UNITS) {
            if ((remGive[u] || 0) <= 0 || !eligSets[u].has(si)) continue;
            const W = packWOf(u);
            const q = Math.min(senders[si].stock[u], remGive[u], Math.floor((room - poured) / W));
            if (q > 0) { commit(T, si, u, q); remGive[u] -= q; poured += q * W; }
          }
          return poured;
        };
        const opened = new Set();
        for (const si of cand) {
          const left = remW();
          if (left <= 0) break;
          if (left < dpPackSize && opened.size) break;             // sub-min tail → fold below
          if (pourable(si) < Math.min(dpPackSize, left)) continue; // stock-poor village: last resort only
          if (fill(si, binMax) > 0) opened.add(si);
        }
        // Remainder: filled villages absorb it first (soft-exceeding max, spread evenly); untouched
        // villages only when the filled ones are out of troops (forced small order — nowhere else).
        const foldInto = list => {
          for (const u of DEF_OBJ_UNITS) {
            if ((remGive[u] || 0) <= 0) continue;
            const l = list.filter(si => eligSets[u].has(si) && senders[si].stock[u] > 0);
            if (!l.length) continue;
            const a = apportionCapped(remGive[u], l.map(si => ({ weight: 1, cap: senders[si].stock[u] })));
            l.forEach((si, j) => { if (a[j] > 0) { commit(T, si, u, a[j]); remGive[u] -= a[j]; } });
          }
        };
        foldInto(cand.filter(si => opened.has(si)));
        foldInto(cand.filter(si => !opened.has(si)));
        continue; // this player is fully placed
      }

      // Village-split floor. Max Efficiency: k villages by the classic real-POP / 400 floor, shared
      // across types. Support Packs: split each type across ⌊give_u / packUnits⌋ villages so each
      // village order carries ≥ one whole pack of that type. Either way, spill onward if stock-short.
      const kEff = Math.min(cand.length, Math.max(1, Math.floor(
        DEF_OBJ_UNITS.reduce((s, u) => s + (give[u] || 0) * POP[u], 0) / DEF_MIN_PACKET_POP)));
      for (const u of DEF_OBJ_UNITS) {
        const need = give[u] || 0;
        if (need <= 0) continue;
        const eligSet = new Set(eligByType[u][P]);
        const elig = cand.filter(si => eligSet.has(si));
        const k = packsMode ? Math.min(elig.length, Math.max(1, Math.floor(need / packUnitsOf(u)))) : kEff;
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
  if (typeof cloudSyncPlan === 'function') cloudSyncPlan(); // hosted-site cloud save of the JSON snapshot
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
function defPmMessagesFrom(planRows, maxBrackets) {
  maxBrackets = maxBrackets || PM_MAX_BRACKETS;
  const byPlayer = {};
  for (const r of (planRows || [])) (byPlayer[r.srcPlayer] || (byPlayer[r.srcPlayer] = [])).push(r);
  return Object.keys(byPlayer).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(name => {
      const rows = byPlayer[name];
      const lines = rows.map((r, i) => `${i + 1}. ${defPlanRowLine(r)}`);
      lines[0] = `========== ${name} (${rows.length}) ==========\n` + lines[0];
      return { player: name, parts: pmSplitParts(lines, maxBrackets) };
    });
}
function defPmMessages(maxBrackets) { return defPmMessagesFrom(defPlanRows, maxBrackets); }

// Modal: one copy-button per message part; clicking copies that PM to the clipboard and
// marks the button done (green + checkmark). Done-state is per-open on purpose — reopening
// rebuilds from the current plan, whose messages may have changed.
let defPmExport = [];
// Shared modal renderer: one copy-button per message part. `messages` is the
// defPmMessagesFrom() shape; `hint` overrides the default header line (Manage
// Defense's "Export Missing PMs" uses its own).
function renderPmModal(messages, hint) {
  defPmExport = messages || [];
  const body = document.getElementById('pm-modal-body');
  if (!body) return;
  body.innerHTML = `<div class="pm-hint">${esc(hint || t('pm_hint'))}</div>` + defPmExport.map((m, pi) =>
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
function showDefPmExport() {
  if (!defPlanRows.length) { alert(t('empty_no_def_plan')); return; }
  renderPmModal(defPmMessages());
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
