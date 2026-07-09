// ── Plan generation ──────────────────────────────────────────
// Noble max travel range (fields), from the Plan Offensive "snob max" input; default 70 (es100),
// 0 = disabled (no distance gate). Shared by generatePlan() and the per-target snob picker so both
// use the same range when deciding who can noble a target.
function getSnobMax() {
  const raw = parseFloat((document.getElementById('plan-snob-max') || {}).value);
  return isNaN(raw) ? 70 : raw;
}
function parseWindowStr(s) {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*[\/\-–]\s*(\d{1,2}):(\d{2})/);
  return m ? { f: +m[1] * 60 + +m[2], to: +m[3] * 60 + +m[4] } : null;
}

// ── Server time (local clock → epoch → server UTC offset) ──
function serverNowMs() { return Date.now(); } // separate so tests can freeze the clock
// Epoch ms of the server-local wall time `minutes` after midnight of dateISO
function serverWallMs(dateISO, minutes) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const off = parseFloat(otCfg.serverUtcOffset);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) + minutes * 60000 - (isNaN(off) ? 2 : off) * 3600000;
}
// Epoch ms of the optional "Earliest send" datetime-local (Plan Offensive), read on the SAME
// server wall clock as the windows. null when unset/malformed → the plan uses serverNowMs() as
// the only send floor (original behaviour). When set, it raises that floor, shrinking range for
// far villages (and snobs): a launch can't be scheduled before this time.
function earliestSendMs() {
  const m = String(otCfg.earliestSendISO || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return serverWallMs(m[1], (+m[2]) * 60 + (+m[3]));
}
function serverNowStr() {
  const off = parseFloat(otCfg.serverUtcOffset);
  const d = new Date(serverNowMs() + (isNaN(off) ? 2 : off) * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
function updateServerNow() {
  const sp = document.getElementById('server-now');
  if (sp) sp.textContent = t('server_now')(serverNowStr());
}

// Launch window = landing window minus travel time (wraps past midnight)
function launchWindowStr(winStr, travelMin) {
  const w = parseWindowStr(winStr);
  if (!w) return '—';
  const tr = Math.round(travelMin);
  const p = n => String(n).padStart(2, '0');
  const fm = m => { const x = ((m % 1440) + 1440 * 100) % 1440; return `${p(Math.floor(x / 60))}:${p(x % 60)}`; };
  const days = w.f - tr < 0 ? Math.ceil((tr - w.f) / 1440) : 0;
  const span = w.f === w.to ? fm(w.f - tr) : `${fm(w.f - tr)}–${fm(w.to - tr)}`;
  if (!days) return span;
  // with an arrival date set, name the actual launch day next to the −Nd marker
  const m = String(otCfg.dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - days * 86400000) : null;
  const ds = d ? ` · ${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` : '';
  return `${span} (−${days}d${ds})`;
}

// Same launch-window math as launchWindowStr, but returns the parts the per-player BB needs
// separately: the time span and the launch day-of-month (null when no arrival date is set).
function launchWindowParts(winStr, travelMin) {
  const w = parseWindowStr(winStr);
  if (!w) return null;
  const tr = Math.round(travelMin);
  const p = n => String(n).padStart(2, '0');
  const fm = m => { const x = ((m % 1440) + 1440 * 100) % 1440; return `${p(Math.floor(x / 60))}:${p(x % 60)}`; };
  const days = w.f - tr < 0 ? Math.ceil((tr - w.f) / 1440) : 0;
  const single = w.f === w.to;
  const span = single ? fm(w.f - tr) : `${fm(w.f - tr)}–${fm(w.to - tr)}`;
  const m = String(otCfg.dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - days * 86400000) : null;
  return { span, single, day: d ? d.getUTCDate() : null };
}

// English ordinal for the launch day (1st, 2nd, 3rd, 4th … 11th–13th th, 21st …).
function ordinalEn(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function orderUnitsFor(mode, pace, v) {
  if (mode === 'off') {
    if (pace === 'any') return {}; // plain rally-point link, no preset units
    if (v[pace] === 0) return null;
    if (pace === 'light') return { light: v.light };
    if (pace === 'axe')   return { axe: v.axe, light: v.light };
    if (pace === 'sword') return { sword: 1, axe: v.axe, light: v.light };
    if (pace === 'ram')   return { ram: v.ram, axe: v.axe, light: v.light };
    return null;
  }
  // def mode
  if (v.knight > 0) {
    const all = {};
    for (const u of UNITS) if (v[u] > 0) all[u] = v[u];
    return all;
  }
  if (pace === 'any') return {}; // plain rally-point link, no preset units
  if (pace === 'knight') return null;
  if (v[pace] === 0) return null;
  if (pace === 'spy')   return { spy: v.spy };
  if (pace === 'light') return { light: v.light };
  if (pace === 'heavy') return { heavy: v.heavy, light: v.light, spy: v.spy };
  if (pace === 'spear') return { spear: v.spear, heavy: v.heavy, light: v.light, spy: v.spy };
  if (pace === 'sword') return { sword: v.sword, spear: v.spear, heavy: v.heavy, light: v.light, spy: v.spy };
  return null;
}

function rallyUrl(srcCoord, tgtCoord, units) {
  const sv = coordDb[srcCoord];
  const tv = coordDb[tgtCoord];
  if (!sv || !tv || !otCfg.serverUrl) return null;
  const host = otCfg.serverUrl.replace(/^https?:\/\//, '');
  let url = `https://${host}/game.php?village=${sv.id}&screen=place&target=${tv.id}`;
  for (const [u, n] of Object.entries(units || {})) if (n > 0) url += `&${u}=${n}`;
  // NOTE: the catapult/off target building is chosen on the CONFIRM screen and is NOT preselectable
  // via the rally-point URL, so we do NOT append &building=. The target building is surfaced as text
  // in the plan + exports (catTargetLabel) instead — that's the actual deliverable.
  return url;
}

// In-game info page for the village at `coord` (needs the world DB for the village id +
// a server URL). null when either is missing → the caller shows plain text, no link.
function villageInfoUrl(coord) {
  const v = coordDb[coord];
  if (!v || !otCfg.serverUrl) return null;
  const host = otCfg.serverUrl.replace(/^https?:\/\//, '');
  return `https://${host}/game.php?screen=info_village&id=${v.id}`;
}

function splitNobles(total, nPlayers) {
  const n = Math.max(1, nPlayers), base = Math.floor(total / n), rem = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0)).filter(x => x > 0);
}

// Pure sender-region gate (Coordinate Filter). Does a village at parsed coord c={x,y}
// satisfy EVERY active filter? Filters AND together. A row is INACTIVE (skipped) when it
// has no axis or a blank/NaN value — so a half-typed row never silently empties the sender
// pool — and an empty filter list passes every village. Applied to `pool` in generatePlan();
// because the whole plan (offs, snob range, fairness, reservations) derives from that pool,
// filtered-out villages are never used as an off OR a snob sender.
function passesCoordFilters(c, filters) {
  if (!c || !Array.isArray(filters) || !filters.length) return true;
  return filters.every(f => {
    if (!f || (f.axis !== 'x' && f.axis !== 'y')) return true; // incomplete row = inactive
    if (f.val === '' || f.val == null) return true;
    const val = Number(f.val);
    if (!isFinite(val)) return true;
    const n = f.axis === 'x' ? c.x : c.y;
    switch (f.op) {
      case '>':  return n >  val;
      case '>=': return n >= val;
      case '<':  return n <  val;
      case '<=': return n <= val;
      case '=':  return n === val;
      default:   return true; // unknown operator = inactive
    }
  });
}

function generatePlan() {
  if (!villages.length)   { alert(t('plan_need_data'));    return; }
  if (!offTargets.length) { alert(t('plan_need_targets')); return; }
  offTargets.forEach(normalizeOffTarget);

  const ws      = twWorldSpeed; // per-world config (World dropdown), not user-editable
  const us      = twUnitSpeed;
  const maxDist = parseFloat(document.getElementById('plan-max-dist').value) || 0;
  const minDistRaw = parseFloat((document.getElementById('plan-min-dist') || {}).value);
  const minDist = isNaN(minDistRaw) ? 0 : minDistRaw;
  // Min. Morale (%) for a conqueror's own coordination off — see the conqueror reservation
  // pass. The field holds a percentage (default 90); convert to the 0–1 morale fraction.
  // 0 disables the gate entirely (the conqueror always keeps their own off, pre-v3.12 behaviour).
  const minMoraleRaw = parseFloat((document.getElementById('plan-min-morale') || {}).value);
  const minMorale = (isNaN(minMoraleRaw) ? 90 : minMoraleRaw) / 100;
  // Min. Morale (%) for ANY regular clearing off (auto pass) — default 100, so the engine
  // only sends offs at full morale and falls back to the best below-threshold sender only
  // when no qualifying village can reach the target (soft gate, mirrors the snob-off gate).
  // A noble sender's OWN coordination off is exempt: it's governed by minMorale (the snob-off
  // gate) and reserved before the auto pass runs, so this gate never re-touches it. 0 disables.
  const minMoraleOffRaw = parseFloat((document.getElementById('plan-min-morale-off') || {}).value);
  const minMoraleOff = (isNaN(minMoraleOffRaw) ? 100 : minMoraleOffRaw) / 100;

  // Ignore lists (Offensive Targets). Ignored COORDINATES are dropped from the pool entirely
  // (those villages never send anything). Ignored PLAYERS stay IN the pool but are barred from
  // every regular-OFF pass (folded into offBlocked below) — they may still be hand-picked as
  // noble (snob) senders, sending the train + its escort, just never a regular clearing off.
  const ignoreCoords  = parseOffIgnoreSet();
  const ignorePlayers = new Set(offIgnorePlayers);
  // Sender region = typed X|Y filters AND (if drawn) the map polygon. Both empty → every
  // village is eligible. See passesCoordFilters (typed) + passesCoordPolygon (drawn, honours
  // "Select Reverse" inversion), both pure world-space.
  const pool = villages.map(v => ({
    v, c: parseCoordStr(v.coord), tier: getOffTier(v.offPow),
    snobLeft: v.snob, usedOff: false, usedSnob: false,
  })).filter(p => p.c && !ignoreCoords.has(p.v.coord)
    && passesCoordFilters(p.c, planCoordFilters)
    && passesCoordPolygon(p.c.x, p.c.y));

  // ── MV (vacation-mode) pairs ──────────────────────────────────────────────
  // Two MV-paired players must not BOTH attack the SAME enemy PLAYER (the defending
  // player, across all their villages) — a game limit during vacation mode + 48h after.
  // Enforced per defender: the first of a pair committed against a defending player CLAIMS
  // it; the partner is then blocked from that defender in every pass. Raw sender namespace
  // throughout (p.v.player) to match mvPairs and the pool; the claim key is the defending
  // player string (never compared to a sender name, only bucketed). Ownerless defenders
  // (no DB / barbarian → blank player) are exempt (no real player to double-attack).
  // mvPairs is the SHARED off/def vacation-mode list (defined in offensive-targets.js).
  const mvPartners = new Map(); // raw player -> Set of its raw MV partners
  for (const pair of (typeof mvPairs !== 'undefined' ? mvPairs : [])) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [a, b] = pair;
    if (!a || !b || a === b) continue;
    let sa = mvPartners.get(a); if (!sa) mvPartners.set(a, sa = new Set()); sa.add(b);
    let sb = mvPartners.get(b); if (!sb) mvPartners.set(b, sb = new Set()); sb.add(a);
  }
  const mvClaims = new Map(); // defending player -> Set of raw sender names committed against them
  const mvDef = T => { const d = T && T.tg && T.tg.player; return d && String(d).trim() ? d : null; };
  const mvBlocked = (p, T) => {
    const def = mvDef(T); if (!def) return false;
    const partners = mvPartners.get(p.v.player); if (!partners) return false;
    const claimed = mvClaims.get(def); if (!claimed) return false;
    for (const x of partners) if (claimed.has(x)) return true;
    return false;
  };
  // Claim by RAW player name (village-less): a MANUALLY-assigned snob sender claims its
  // defender even when the train can't be placed yet (needNobles / out of range / too late).
  // A pinned assignment is a committed intent to attack, so the MV limit must apply to the
  // partner from that moment — not only once an origin village is resolved. See the unassigned
  // snob branches below (they only carry `want`, never a village).
  const noteMvClaimName = (rawName, T) => {
    if (!rawName || !mvPartners.has(rawName)) return; // only paired players can ever block
    const def = mvDef(T); if (!def) return;
    let s = mvClaims.get(def); if (!s) mvClaims.set(def, s = new Set()); s.add(rawName);
  };
  const noteMvClaim = (p, T) => noteMvClaimName(p.v.player, T);
  // Would this pinned sender have had a candidate for T if not for an MV conflict?
  const mvWouldBlockPin = (rawName, T) =>
    mvPartners.has(rawName) && !!mvDef(T) && pool.some(p => p.v.player === rawName && mvBlocked(p, T));

  // Off-load fairness (auto pass only): how many off villages each player owns, and how
  // many have been committed so far. Used to spread offs in PROPORTION to roster size, so
  // a small-roster player isn't drained while a big one sits idle (e.g. 9+4, not 7+6).
  const offCapacity = {};
  for (const p of pool) if (p.tier !== 'none') offCapacity[p.v.player] = (offCapacity[p.v.player] || 0) + 1;
  const offUsedByPlayer = {};
  const noteOffUsed = name => { offUsedByPlayer[name] = (offUsedByPlayer[name] || 0) + 1; };

  planRows = []; planWarnings = []; planReserved = [];
  planStats = emptyPlanStats();

  const targets = offTargets.map((tg, i) => ({ tg, i, c: parseCoordStr(tg.coord), offRows: [], snobRows: [], catRows: [] }));
  targets.filter(T => !T.c).forEach(T => planWarnings.push(t('warn_invalid_coord')(T.tg.coord)));

  // Off distance band. The MINIMUM is a tribe-wide buffer, NOT per-target: an
  // off-capable village within minDist of ANY objective is held back entirely
  // (kept free for a quick second round) — otherwise a village 2 fields from
  // target A would still be flung at target B 40 fields away. The MAXIMUM stays
  // per-target (avoids multi-day marches). 0 disables either bound. Snob trains
  // only obey their own max — nobles usually must come from nearby. (Escort offs
  // are held back too: an escort commits an off, so the buffer applies there.)
  const targetCoords = targets.filter(T => T.c).map(T => T.c);
  const tooClose = new Set(minDist > 0
    ? pool.filter(p => targetCoords.some(tc => distXY(p.c, tc) < minDist))
    : []);
  const okOffDist = (p, tc) => !tooClose.has(p) && (maxDist <= 0 || distXY(p.c, tc) <= maxDist);
  // Nobles have a hard travel limit in the game (70 fields on es100)
  const snobMax = getSnobMax();
  const okSnobDist = (p, tc) => snobMax <= 0 || distXY(p.c, tc) <= snobMax;
  // Snob targets are mostly ASSIGNED to a player who then recruits the noble, so every snob
  // row lists that player's own villages within noble range of the objective that can plausibly
  // hold an Academy. When a buildings JSON is loaded that's a real Smithy ≥ SNOB_SMITH_MIN gate;
  // otherwise it's the legacy > SNOB_RANGE_MIN_POINTS heuristic (unknown → passes). snobCapable
  // (offensive-targets.js) encapsulates both. Closest first. rawName is the encoded pool key.
  const snobAcademyOk = p => snobCapable(p.v.coord);
  // Weaker smith gate for spots that never had a points heuristic (escort picks, the recruit-here
  // hint): a KNOWN Smithy below SNOB_SMITH_MIN disqualifies, unknown passes — so without a
  // buildings JSON these behave exactly as before (no new points gate sneaks in).
  const smithOkOrUnknown = p => { const lv = smithLevelAt(p.v.coord); return lv === null || lv >= SNOB_SMITH_MIN; };
  // Recommended launch villages for a needNobles / out-of-range snob row: the player's own
  // villages within noble range AND still launchable in time (okSnobTime — honours the Earliest
  // send floor / now), academy-plausible. Closest first. Time-gated so we never suggest recruiting
  // a noble somewhere the train couldn't leave early enough to arrive. okSnobTime is defined below
  // but this closure only runs during the snob loop, after it's initialised.
  const snobRangeVills = (rawName, T) =>
    (!rawName || !T || !T.c) ? []
      : pool.filter(p => p.v.player === rawName && okSnobDist(p, T.c) && okSnobTime(p, T) && snobAcademyOk(p))
            .sort((a, b) => distXY(a.c, T.c) - distXY(b.c, T.c))
            .map(p => p.v.coord);

  // Launch feasibility: with an arrival date set, a village whose travel time
  // pushes the launch before the current server time can never make it.
  // Vetted against the target's LATEST possible landing minute; the assigned
  // window may still be earlier — those rows get flagged late after assignment.
  for (const T of targets) {
    if (!T.c) continue;
    const wins = (T.tg.offWindows && T.tg.offWindows.length ? T.tg.offWindows : [{ win: '' }])
      .map(w => w.win || T.tg.winSnob || '');
    T.offEndMin = wins.reduce((best, w) => {
      const pw = parseWindowStr(w);
      return pw && (best === null || pw.to > best) ? pw.to : best;
    }, null);
    const sw = parseWindowStr(T.tg.winSnob || wins[wins.length - 1] || '');
    T.snobEndMin = sw ? sw.to : null;
  }
  // Earliest send floor. A launch can never be scheduled before "now", nor (when the user set
  // an Earliest send time) before that time. The gate below vets each village's latest possible
  // launch (land − travel) against this floor: villages needing more travel than
  // (window END − floor) can't arrive in the window without launching too early → out of range.
  // Applies to offs AND snobs (okOffTime/okSnobTime share okTime). max(now, …) keeps a past
  // earliest-send from ever loosening reality.
  const esMs = earliestSendMs();
  const sendFloorMs = esMs === null ? serverNowMs() : Math.max(serverNowMs(), esMs);
  // If the earliest-send is at/after a target's whole arrival window, nothing can reach it
  // (max travel = window end − floor ≤ 0) — flag it so the target doesn't just silently empty.
  if (esMs !== null) for (const T of targets) {
    if (!T.c || T.offEndMin === null || T.offEndMin === undefined) continue;
    const landMs = serverWallMs(otCfg.dateISO, T.offEndMin);
    if (landMs !== null && esMs >= landMs) planWarnings.push(t('warn_earliest_after_window')(T.tg.coord));
  }
  const okTime = (p, T, endMin, baseMin) => {
    if (endMin === null || endMin === undefined) return true;
    const landMs = serverWallMs(otCfg.dateISO, endMin);
    if (landMs === null) return true;
    return landMs - travelTimeMin(distXY(p.c, T.c), baseMin, ws, us) * 60000 >= sendFloorMs;
  };
  const okOffTime  = (p, T) => okTime(p, T, T.offEndMin,  PLAN_BASE_MIN.off);
  const okSnobTime = (p, T) => okTime(p, T, T.snobEndMin, PLAN_BASE_MIN.snob);

  // ── Sorting: named pins go by distance, auto picks "optimize" ──────────────
  // Morale only helps when the target's defender points are actually known (world
  // DB loaded, non-barbarian); otherwise there's no morale signal and we fall back
  // to plain distance — which also preserves the pre-morale behaviour with no DB.
  const dbReady = villageDb.length > 0;
  const moraleUsable = T => dbReady && !isBarbarian(T.tg.coord) && playerPointsAtCoord(T.tg.coord) > 0;
  // Effective offensive power = morale × off power (the user's metric). A candidate
  // whose own morale can't be resolved counts as 1.0 so it's never zeroed out.
  const effPow = (p, T) => {
    const m = planAttackMorale(p.v.coord, T.tg.coord);
    return (m == null ? 1 : m) * p.v.offPow;
  };
  // Manually-pinned senders: distance only (closest of their own villages first; no
  // morale, no fairness — the pin is the user's explicit choice).
  const byDist = T => (a, b) => (distXY(a.c, T.c) - distXY(b.c, T.c)) || (b.v.offPow - a.v.offPow);
  // Fraction of a player's off roster still unused (1 = untouched, →0 = drained).
  const remOffFrac = name => {
    const cap = offCapacity[name] || 0;
    return cap > 0 ? Math.max(0, (cap - (offUsedByPlayer[name] || 0)) / cap) : 1;
  };
  // Auto "optimize" score for a candidate: effective power per field of travel (so a small
  // morale loss for a much closer village wins — 95% @ 7h beats 100% @ 50h), or pure
  // closeness when there's no morale signal. Then DAMPED by the sender's remaining fraction
  // (0.5–1.0) so already-used players slide down — pulling the split toward equal fractions
  // of each player's roster (≈ proportional balancing) without overriding a real edge.
  const optScore = (p, T) => {
    const d = Math.max(0.1, distXY(p.c, T.c));
    const base = moraleUsable(T) ? effPow(p, T) / d : 1 / d;
    return base * (0.5 + 0.5 * remOffFrac(p.v.player));
  };
  const byOptimize = T => (a, b) => (optScore(b, T) - optScore(a, T)) || (distXY(a.c, T.c) - distXY(b.c, T.c));

  // ════════════════════════════════════════════════════════════════════════
  // NOBLE TRAINS ARE ASSIGNED FIRST (before the offs).
  //
  // A snob sender's launch villages matter more than where their off troops go,
  // so we resolve who nobles each target up front, then hold each sender's TWO
  // villages closest to their own objective(s) out of the off pool (snobReserved
  // below). The offs then coordinate TO the nobles (conquerorByTarget) rather than
  // the old reverse (nobles coordinating to off-holders).
  // ════════════════════════════════════════════════════════════════════════

  // Escort reservation (split-off / "escorted" mode): the noble rides WITH one of the
  // sender's offs to the same target, so hold one noble-capable off village out of the
  // off passes per escorted train — the closest Complete/3-4 off to that target (noble
  // range + pace govern, since the off travels with the noble). Reserved up front so the
  // off passes leave it free for the split-off. Applies even to pinned senders who don't
  // own the noble yet (needNobles): the slot is held until they recruit one.
  // An escort village launches the noble too, so with a buildings JSON loaded a KNOWN Smithy below
  // SNOB_SMITH_MIN disqualifies it (the next closest capable off takes the slot); unknown Smithy
  // passes (smithOkOrUnknown — escorts never had a points gate, don't introduce one).
  const escortReserved = new Set();
  for (const T of targets) {
    // One reserved escort village per train, in spec order (null = none in range).
    // The snob loop reads these by the SAME train index to tell a needNobles sender
    // WHERE to recruit (a split-off launches off + noble from one village).
    T.escortPicks = [];
    if (!T.c || (T.tg.snobMode || 'solo') !== 'escorted') continue;
    for (const { name: want } of targetTrainSpec(T.tg)) {
      const pick = tiers => pool.filter(p => !p.usedOff && !escortReserved.has(p) && !tooClose.has(p)
        && tiers.includes(p.tier) && okSnobDist(p, T.c) && okSnobTime(p, T) && smithOkOrUnknown(p)
        && (want ? p.v.player === want : !ignorePlayers.has(p.v.player)))
        .sort((a, b) => (distXY(a.c, T.c) - distXY(b.c, T.c)) || (b.v.offPow - a.v.offPow))[0];
      const p = pick(['complete', 'tq']) || pick(['half']);
      if (p) escortReserved.add(p);
      T.escortPicks.push(p || null);
    }
  }

  // (No "assigned more nobles than they own" capacity warning here: assigning a snob target to
  // a player BEFORE they've recruited the nobles is the normal workflow, so it's not an error.
  // The per-train "Prepare Snob Train" call-out is the cue instead.)

  // Which players send a noble train, and to which targets — captured AS the snob loop runs
  // (so it covers pinned AND auto-picked senders, in BOTH solo and escorted modes). Every
  // noble sender gets their two closest-to-their-targets villages held out of the offs (see
  // snobReserved below); in escort mode the closest of the two is the escort that rides the
  // noble to its own target, the other is simply kept free. snobSenderTargets keys are RAW
  // (encoded) player names, to match the village pool's p.v.player for the reservation.
  // conquerorByTarget keys are DECODED names (to match offRows.srcPlayer) for the off-side
  // coordination force — populated for BOTH solo and escorted trains: even an escorted
  // conqueror (whose escort rides with the noble) should also send one of the requested
  // CLEARING offs from their own hand, so they can align their snob to the second behind
  // their own last offensive. A pinned sender kept on the plan without a noble yet
  // (needNobles) still counts — they are intended to send.
  const snobSenderTargets = {};  // raw player -> Set of target index (solo + escorted)
  const conquerorByTarget = {};  // target index -> Set of decoded sender (solo + escorted)
  const noteSnobSender = (rawName, T) => {
    if (!rawName) return;
    (snobSenderTargets[rawName] || (snobSenderTargets[rawName] = new Set())).add(T.i);
    (conquerorByTarget[T.i] || (conquerorByTarget[T.i] = new Set())).add(decode(rawName));
  };

  // ── Manual snob MV conflict (explicit, up front) ──────────────────────────
  // Two MV-paired players HAND-ASSIGNED as snob senders against the SAME defender is
  // illegal (both attacking one defender is the exact thing vacation mode forbids).
  // Report it deterministically here — independent of which train the snob loop places
  // first — and remember the senders so the per-target loop doesn't ALSO warn for them.
  const mvSnobConflictPins = new Set(); // 'def|rawName' keys already flagged in a manual snob conflict
  {
    const snobPinsByDef = new Map(); // defender string -> Set of raw manual snob sender names
    for (const T of targets) {
      const def = mvDef(T); if (!def) continue;
      for (const { name } of targetTrainSpec(T.tg)) {
        if (!name) continue; // auto-picked train, not a manual assignment
        let s = snobPinsByDef.get(def); if (!s) snobPinsByDef.set(def, s = new Set());
        s.add(name);
      }
    }
    const reported = new Set();
    for (const [def, names] of snobPinsByDef) {
      const arr = [...names];
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j], pa = mvPartners.get(a);
        if (!pa || !pa.has(b)) continue; // not an MV pair
        const key = def + '|' + [a, b].sort().join('|');
        if (reported.has(key)) continue; reported.add(key);
        mvSnobConflictPins.add(def + '|' + a); mvSnobConflictPins.add(def + '|' + b);
        planWarnings.push(t('warn_mv_snob_conflict')(decode(a), decode(b), decode(def)));
      }
    }
  }

  // Snob trains: pre-assigned senders fill the first trains, the rest are
  // auto-picked from distinct players; escort mode is a per-target setting
  for (const T of targets) {
    if (!T.c || !T.tg.nobles) continue;
    const spec = targetTrainSpec(T.tg);
    if (!spec.length) continue;
    const specSum = spec.reduce((s, x) => s + x.count, 0);
    if (specSum !== T.tg.nobles) planWarnings.push(t('warn_nobles_mismatch')(T.tg.coord, specSum, T.tg.nobles));
    const mode = T.tg.snobMode || 'solo';
    const chosen = new Set();
    spec.forEach(({ name: want, count: nc }, trainIdx) => {
      // For escorted trains, the off held back at reservation time (same train index)
      // is exactly where a needNobles sender should recruit — surface its coord.
      const reservedV = mode === 'escorted' && T.escortPicks ? T.escortPicks[trainIdx] : null;
      const recruitCoord = reservedV ? reservedV.v.coord : undefined;
      // Distance/travel from that reserved off to the target (snob pace) so a needNobles row
      // can still show WHEN to launch the split-off once the noble is recruited.
      const recruitDist = reservedV ? distXY(reservedV.c, T.c) : undefined;
      const recruitTravel = reservedV ? travelTimeMin(recruitDist, PLAN_BASE_MIN.snob, ws, us) : undefined;
      // A village may host several trains while it has snobs left; in split-off
      // mode its off can only be split once (solo trains from it stay fine)
      let cands = pool.filter(p =>
        p.snobLeft > 0 && okSnobDist(p, T.c) && okSnobTime(p, T) && !mvBlocked(p, T) &&
        // a pinned (want) sender may be an ignored player; auto-picks never use ignored players
        (want ? p.v.player === want : (!chosen.has(p.v.player) && !ignorePlayers.has(p.v.player))) &&
        (mode !== 'escorted' || !p.usedOff));
      if (mode === 'escorted') {
        // train travels with its own off escort → prefer villages with real off power
        const strong = cands.filter(p => TIER_RANK[p.tier] >= 1);
        if (strong.length) cands = strong;
      }
      const enough = cands.filter(p => p.snobLeft >= nc);
      // A pinned sender whose villages can't field a FULL train (some nobles, but fewer than
      // this train needs) is treated like the no-noble case: kept on the plan by name, origin
      // UNASSIGNED, never assigned a short village. No "recruit nobles" warning (assigning snobs
      // before recruiting is the normal workflow); the row's "Prepare Snob Train" call-out is the cue.
      if (want && cands.length && !enough.length) {
        T.snobRows.push({ type: 'snob', count: nc, escorted: mode === 'escorted', unassigned: true,
          srcPlayer: decode(want), needNobles: true, recruitCoord, dist: recruitDist, travel: recruitTravel,
          rangeVills: snobRangeVills(want, T) });
        noteSnobSender(want, T);
        noteMvClaimName(want, T); // pinned intent claims the defender even before nobles exist
        return;
      }
      if (enough.length) cands = enough;
      const fresh = cands.filter(p => !p.usedSnob);
      if (fresh.length) cands = fresh;
      if (!cands.length) {
        // pinpoint the blocker: out of noble range / launch in the past /
        // off already split / no snobs
        let msg, needNobles = false;
        if (want && mvWouldBlockPin(want, T)) {
          // an MV-paired partner already attacks this defender → this sender can't (game limit).
          // If this is a manual-vs-manual snob conflict we already reported explicitly up front,
          // don't warn again here — the row still shows unassigned.
          if (!mvSnobConflictPins.has(mvDef(T) + '|' + want)) msg = t('warn_mv')(decode(want), T.tg.coord);
        } else if (want) {
          const mine = pool.filter(p => p.snobLeft > 0 && p.v.player === want);
          const inRange = mine.filter(p => okSnobDist(p, T.c));
          if (mine.length && !inRange.length) {
            msg = t('warn_snob_range')(decode(want), T.tg.coord);
            // None of their snob villages reach — recommend the player's OWN villages
            // that ARE within snob range (closest first), where recruiting a noble would
            // put a train in range. By this branch's premise none of these hold snobs yet.
            // smithOkOrUnknown: never recommend recruiting at a village whose KNOWN Smithy
            // can't take an Academy (mirrors the rangeVills/snobAcademyOk gate).
            const recruit = pool.filter(p => p.v.player === want && okSnobDist(p, T.c) && okSnobTime(p, T) && smithOkOrUnknown(p))
              .sort((a, b) => distXY(a.c, T.c) - distXY(b.c, T.c));
            if (recruit.length) {
              const CAP = 6;
              let coords = recruit.slice(0, CAP).map(p => p.v.coord).join(', ');
              if (recruit.length > CAP) coords += t('warn_snob_range_more')(recruit.length - CAP);
              msg += '. ' + t('warn_snob_range_hint')(decode(want), coords);
            }
          }
          else if (inRange.length && !inRange.some(p => okSnobTime(p, T)))
            msg = t('warn_snob_too_late')(T.tg.coord);
          else if (mode === 'escorted' && inRange.length) {
            // The sender has noble(s) in range but no village can launch the split-off. Two
            // different causes: (a) they're SHORT on nobles for this train — point them at the
            // reserved escort off to recruit there (needNobles); (b) they have ENOUGH nobles
            // but the escort off is already spent — suggest Solo / free an off.
            const nobleSupply = inRange.reduce((s, p) => s + p.snobLeft, 0);
            if (recruitCoord && nobleSupply < nc) needNobles = true; // short on nobles → no warning (see below)
            else msg = t('warn_escort_used')(decode(want), T.tg.coord);
          }
          else {
            // the pinned player simply owns no (free) nobles → keep them on the plan as the
            // sender with the origin flagged UNASSIGNED. No "recruit nobles" warning (assigning
            // snobs before recruiting is the normal workflow); the row's "Prepare Snob Train"
            // call-out is the cue.
            needNobles = true;
          }
        } else {
          const any = pool.filter(p => p.snobLeft > 0 && okSnobDist(p, T.c));
          msg = any.length && !any.some(p => okSnobTime(p, T))
            ? t('warn_snob_too_late')(T.tg.coord)
            : t('warn_missed_snob')(T.tg.coord);
        }
        // needNobles rows carry no warning (recruiting later is expected); the out-of-range /
        // too-late / escort-used / missed-snob cases still warn.
        if (msg && !needNobles) planWarnings.push(msg);
        // A manually-pinned sender stays named on the plan even when unplaced (so they
        // see their assignment); an auto train that couldn't be filled has no name.
        T.snobRows.push({ type: 'snob', count: nc, escorted: mode === 'escorted', unassigned: true,
          srcPlayer: want ? decode(want) : undefined, needNobles, recruitCoord: needNobles ? recruitCoord : undefined,
          dist: needNobles ? recruitDist : undefined, travel: needNobles ? recruitTravel : undefined,
          rangeVills: snobRangeVills(want, T) });
        if (want) { noteSnobSender(want, T); noteMvClaimName(want, T); } // pinned intent claims the defender
        return;
      }
      // escorted: strongest escort wins; solo: nearest village, weakest off stays home
      // (so the strongest off is left free for off duty — coordination is handled on the
      // off side now via conquerorByTarget)
      cands.sort(mode === 'escorted'
        ? (a, b) => (b.v.offPow - a.v.offPow) || (distXY(a.c, T.c) - distXY(b.c, T.c))
        : (a, b) => (distXY(a.c, T.c) - distXY(b.c, T.c)) || (a.v.offPow - b.v.offPow));
      const p = cands[0];
      p.snobLeft -= nc; p.usedSnob = true; chosen.add(p.v.player); noteMvClaim(p, T);
      if (mode === 'escorted') { p.usedOff = true; p.isEscort = true; } // its off rides as the split-off
      noteSnobSender(p.v.player, T);
      const d = distXY(p.c, T.c);
      T.snobRows.push({
        type: 'snob', count: nc, escorted: mode === 'escorted',
        srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.snob, ws, us),
        rangeVills: snobRangeVills(p.v.player, T),
      });
    });
  }

  // ── Launch-village reservation ──────────────────────────────────────────
  // For every player who sends a noble train, hold their TWO villages closest to their
  // OWN objective(s) out of all off passes — regardless of distance, and whether the
  // village is offensive or defensive — so they stay free to launch the noble. Distance
  // is measured to the NEAREST of that sender's targets (a sender nobling 3 targets still
  // reserves only their 2 nearest-to-any-target villages). In escorted mode the closest of
  // the two is the escort, which still rides to its own target (its off is the split-off);
  // the reservation only stops these villages being flung at OTHER targets as plain offs.
  // Only an established village with a real garrison can be a reserved launch village:
  // ≥ RESERVE_MIN_POINTS points AND ≥ RESERVE_MIN_POP farm pop used by troops. Points come
  // from the world DB (coordDb[coord].points); when the DB isn't loaded the points are
  // unknown and treated as passing, so the pop gate alone applies. A close but tiny/empty
  // village is skipped, and the next-closest qualifying village takes the slot instead.
  // When a buildings JSON is loaded, Smithy level is the real Academy signal: a village with a
  // known Smithy < SNOB_SMITH_MIN can't launch a noble and is never reserved (the pop gate still
  // applies first). Unknown Smithy → the legacy points heuristic (RESERVE_MIN_POINTS, unknown → ok).
  const reserveEligible = p => {
    if ((p.v.popUsed || 0) < RESERVE_MIN_POP) return false;
    const lv = smithLevelAt(p.v.coord);
    if (lv !== null) return lv >= SNOB_SMITH_MIN;
    const dbv = coordDb[p.v.coord];
    const pts = dbv && typeof dbv.points === 'number' ? dbv.points : null;
    return pts === null || pts >= RESERVE_MIN_POINTS;
  };
  const snobReserved = new Set();
  for (const [rawName, tset] of Object.entries(snobSenderTargets)) {
    const tcs = [...tset].map(i => targets[i]).filter(T => T && T.c).map(T => T.c);
    if (!tcs.length) continue;
    const mine = pool.filter(p => p.v.player === rawName && reserveEligible(p));
    const dOf = p => Math.min(...tcs.map(tc => distXY(p.c, tc)));
    mine.sort((a, b) => (dOf(a) - dOf(b)) || (b.v.offPow - a.v.offPow) || (a.v.coord < b.v.coord ? -1 : 1));
    for (const p of mine.slice(0, 2)) snobReserved.add(p);
  }
  // Ignored players are barred from every regular-off pass here (all four use offBlocked),
  // but NOT from the snob loop / escort pick — so a hand-picked ignored noble sender still sends.
  const offBlocked = p => escortReserved.has(p) || snobReserved.has(p) || ignorePlayers.has(p.v.player);
  // Persist the reserved launch-village coords so the "Export Unused Offs" list can drop
  // them (they're being kept for a noble, not offered as a free second-wave off).
  planReserved = [...snobReserved].map(p => p.v.coord);

  // Named off senders fill FIRST among the offs (before the auto pass below claims villages
  // globally), so a manual pin can't be stolen by another target's auto-pick. They draw only
  // from their OWN tier-matching villages and never tier-bump — a shortfall is warned and left
  // unassigned (mirrors the snob trains), reserving those slots so auto doesn't backfill.
  // Reserved launch/escort villages are off-limits to everyone, pins included.
  const namedOffReserved = {}; // 'tIdx|tier' → reserved slots (assigned + shortfall)
  for (const tier of ['complete', 'tq', 'half']) {
    for (const T of targets) {
      if (!T.c) continue;
      const N = T.tg[TIER_FIELD[tier]] || 0;
      const assign = targetOffAssign(T.tg, tier);
      if (!assign.length) continue;
      const reqSum = assign.reduce((s, a) => s + a.count, 0);
      if (reqSum > N) planWarnings.push(t('warn_offs_mismatch')(t('tier_' + tier), T.tg.coord, reqSum, N));
      let placed = 0;
      for (const a of assign) {
        const want = Math.min(a.count, Math.max(0, N - placed)); // never exceed the tier request
        if (want <= 0) continue;
        const cands = pool.filter(p => !p.usedOff && !offBlocked(p) && p.v.player === a.name && p.tier === tier
          && okOffDist(p, T.c) && okOffTime(p, T) && !mvBlocked(p, T)).sort(byDist(T));
        let got = 0;
        for (const p of cands) {
          if (got >= want) break;
          p.usedOff = true; got++; placed++; noteOffUsed(p.v.player); noteMvClaim(p, T);
          const d = distXY(p.c, T.c);
          T.offRows.push({ type: tier, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
            dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us) });
        }
        if (got < want) {
          placed += want - got; // reserve the shortfall so the auto pass won't backfill it
          const owned = pool.filter(p => p.v.player === a.name && p.tier === tier);
          const inRange = owned.filter(p => okOffDist(p, T.c));
          const inRangeTime = inRange.filter(p => okOffTime(p, T) && !p.usedOff && !offBlocked(p));
          planWarnings.push(
            owned.length && !inRange.length ? t('warn_off_range')(decode(a.name), t('tier_' + tier), T.tg.coord)
            : inRange.length && !inRange.some(p => okOffTime(p, T)) ? t('warn_off_too_late')(t('tier_' + tier), T.tg.coord)
            // all otherwise-usable villages blocked by an MV pair conflict → say so
            : inRangeTime.length && inRangeTime.every(p => mvBlocked(p, T)) ? t('warn_mv')(decode(a.name), T.tg.coord)
            : t('warn_sender_short_off')(decode(a.name), t('tier_' + tier), T.tg.coord));
          for (let z = 0; z < want - got; z++) T.offRows.push({ type: tier, unassigned: true });
        }
      }
      namedOffReserved[T.i + '|' + tier] = placed;
    }
  }

  // Tier bump map (a need bumps UP to the nearest stronger off when its own tier is empty);
  // shared by the conqueror reservation below and the auto pass further down.
  const TIER_UP = { half: ['tq', 'complete'], tq: ['complete'], complete: [] };

  // ── DESTROYER / VOLADORA targets ──────────────────────────────────────────
  // A target with offs assigned, NO nobles sent by anyone (no snob senders → conquerorByTarget
  // unset), AND catapult attacks enabled is a "destroyer": you flatten the village instead of
  // taking it. For these, off selection PREFERS catapult-carrying off villages (≥ CAT_CLEAR_MIN
  // cats) so the clearing off itself demolishes — applied to EVERY off slot, falling back to a
  // normal off only when no cat-off qualifies (range/time/tier still gate first; a target whose
  // offs end up carrying no cats is warned once, see below). Independent of the EXTRA small cat
  // attacks sourced from defensive villages further down.
  const CAT_CLEAR_MIN = 101; // an off with ≥ this many catapults can serve as the clearing off
  const isDestroyer = T => !conquerorByTarget[T.i] && T.tg.catEnabled && (T.tg.catapult || 0) > 0;
  // Among already-filtered off candidates, keep only the cat-carriers when this is a destroyer
  // target and at least one qualifies; otherwise leave the set untouched (normal-off fallback).
  const preferCatOffs = (T, cands) => {
    if (!isDestroyer(T)) return cands;
    const catOffs = cands.filter(p => (p.v.catapult || 0) >= CAT_CLEAR_MIN);
    return catOffs.length ? catOffs : cands;
  };

  // ── Conqueror off reservation (the force, placed up front) ────────────────
  // A conquered target coordinates best when one of its CLEARING offs comes from the SAME
  // hand that sends the noble — so the conqueror can time their snob to land right behind
  // their own last off. We GUARANTEE that off and place it HERE, before the POWER + auto
  // passes, so another target can't claim the conqueror's only matching village first (the
  // "steal"). Marking it usedOff drops it from the global pool, so the later passes never
  // see it — no per-target bookkeeping needed — and it counts against namedOffReserved so
  // the auto pass fills only the remaining slots. Tier is enforced: we fill the strongest
  // requested tier the conqueror can man, bumping UP only (a stronger village may cover a
  // weaker request, never the reverse). Range/time — INCLUDING the max-distance input, via
  // okOffDist — gate every pick: a conqueror whose every off village is beyond max distance,
  // too late, held for the noble launch, or purely defensive reserves nothing, which is the
  // intended "no village left" exception. Solo AND escorted (escorted rides an escort with
  // the noble, but still wants a separate clearing off in hand). POWER targets are skipped —
  // they take the strongest nukes regardless of who conquers. Runs after the named pins, so
  // an explicit pin still wins (and a pin that already gave the conqueror an off ends it).
  for (const T of targets) {
    if (!T.c || T.tg.power) continue;
    const conq = conquerorByTarget[T.i];
    if (!conq) continue;
    if (T.offRows.some(r => !r.unassigned && r.srcPlayer && conq.has(r.srcPlayer))) continue;

    // ── Min. Morale gate ────────────────────────────────────────────────────
    // A conqueror only KEEPS their own coordination off if their morale on THIS objective
    // clears the Min. Morale field (default 90%). Below it, the slot is instead RESERVED for
    // the highest-morale reachable sender that itself clears the bar — chosen by morale (not
    // morale×distance), so a closer low-morale village can't reclaim it in the auto pass
    // ("ideally 100%" beats proximity here). If no qualifying alternative is reachable, fall
    // back to the conqueror's own off (a low-morale clear still beats an uncleared target).
    // Morale is per-PLAYER (aggregated points), so resolve it once per player via any village.
    // The gate is inert when morale is unresolvable (no DB / barbarian target → moraleUsable
    // false) and when the field is 0 — both keep the pre-v3.12 conqueror-always-keeps behaviour.
    const gate = moraleUsable(T) ? minMorale : 0;
    const playerMorale = name => {
      const rep = pool.find(p => decode(p.v.player) === name);
      const m = rep ? planAttackMorale(rep.v.coord, T.tg.coord) : null;
      return m == null ? 1 : m; // unknown points → treat as 100% (matches effPow's convention)
    };
    const conqOk = new Set([...conq].filter(name => playerMorale(name) >= gate));

    // candidate villages for a tier, restricted by a sender predicate (decoded names)
    const candsFor = (allow, tt) => pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier === tt
      && allow(p) && okOffDist(p, T.c) && okOffTime(p, T) && !mvBlocked(p, T));
    const reserve = (p, tier) => {
      p.usedOff = true; noteOffUsed(p.v.player); noteMvClaim(p, T);
      namedOffReserved[T.i + '|' + tier] = (namedOffReserved[T.i + '|' + tier] || 0) + 1;
      const d = distXY(p.c, T.c);
      // Sent AS the village's own (≥ requested) tier; no "tier bumped" warning — this is a
      // deliberate coordination off, not a shortage fallback. Tagged `conqueror` so the window
      // pass can land it LAST among the offs (the decisive clear right before the noble).
      T.offRows.push({ type: p.tier, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us), conqueror: true });
    };

    for (const tier of ['complete', 'tq', 'half']) {
      if (((T.tg[TIER_FIELD[tier]] || 0) - (namedOffReserved[T.i + '|' + tier] || 0)) <= 0) continue;
      const bump = allow => { // requested tier first, then bump UP only (stronger covers weaker)
        let c = candsFor(allow, tier);
        for (const up of TIER_UP[tier]) { if (c.length) break; c = candsFor(allow, up); }
        return c;
      };
      // 1) A qualifying conqueror keeps the coordination off (closest of their villages).
      if (conqOk.size) {
        const cands = bump(p => conqOk.has(decode(p.v.player)));
        if (!cands.length) continue; // can't man this tier — try the next
        reserve(cands.sort(byDist(T))[0], tier);
        break;
      }
      // 2) No conqueror clears the snob-off bar → reserve the off for a reachable sender that
      //    clears the OFF gate (minMoraleOff, default 100% — this is a regular clearing off now,
      //    not the conqueror's own coordination off), chosen by the same "optimize" score as the
      //    auto pass (morale × off power ÷ distance, damped by roster balance) — so a close 100%
      //    beats a far 100%. Reserving it (usedOff) keeps a closer sub-bar village from reclaiming
      //    the slot in the auto pass. (Inert when morale is unresolvable — see offGate below.)
      const repGate = moraleUsable(T) ? minMoraleOff : 0;
      const repCands = bump(p => playerMorale(decode(p.v.player)) >= repGate);
      if (repCands.length) {
        reserve(repCands.sort(byOptimize(T))[0], tier);
        break;
      }
      // 3) No high-morale alternative reachable → fall back to the conqueror's own off.
      const fallback = bump(p => conq.has(decode(p.v.player)));
      if (!fallback.length) continue;
      reserve(fallback.sort(byDist(T))[0], tier);
      break;
    }
  }

  // POWER targets (per-target tag): ignore the per-tier split and fill each one's
  // remaining off slots with the globally strongest available offs, balancing total
  // raw off power across all POWER targets — the next-strongest off goes to whichever
  // POWER target currently has the lowest assigned power and still has an open slot it
  // can reach (range + launch time). Runs before the auto pass so it isn't starved.
  const powerTargets = targets.filter(T => T.c && T.tg.power);
  if (powerTargets.length) {
    const remaining = {}, powSum = {}, warned = new Set();
    let totalSlots = 0;
    for (const T of powerTargets) {
      const total = ['complete', 'tq', 'half'].reduce((s, tr) => s + (T.tg[TIER_FIELD[tr]] || 0), 0);
      const named = ['complete', 'tq', 'half'].reduce((s, tr) => s + (namedOffReserved[T.i + '|' + tr] || 0), 0);
      remaining[T.i] = Math.max(0, total - named); powSum[T.i] = 0; totalSlots += remaining[T.i];
    }
    for (let s = 0; s < totalSlots; s++) {
      const open = powerTargets.filter(T => remaining[T.i] > 0).sort((a, b) => powSum[a.i] - powSum[b.i]);
      if (!open.length) break;
      const T = open[0];
      const cands = preferCatOffs(T, pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier !== 'none' && okOffDist(p, T.c) && okOffTime(p, T) && !mvBlocked(p, T)))
        .sort((a, b) => b.v.offPow - a.v.offPow);
      remaining[T.i]--;
      if (!cands.length) {
        if (!warned.has(T.i)) {
          const inBand = pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier !== 'none' && okOffDist(p, T.c));
          planWarnings.push(inBand.length && !inBand.some(p => okOffTime(p, T))
            ? t('warn_off_too_late')(t('tier_complete'), T.tg.coord)
            : t('warn_missed_off')(t('tier_complete'), T.tg.coord));
          warned.add(T.i);
        }
        T.offRows.push({ type: 'complete', unassigned: true });
        continue;
      }
      const p = cands[0];
      p.usedOff = true; powSum[T.i] += p.v.offPow; noteOffUsed(p.v.player); noteMvClaim(p, T);
      const d = distXY(p.c, T.c);
      T.offRows.push({ type: p.tier, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us) });
    }
  }

  // Offs: strongest requests claim villages first (complete → 3/4 → 1/2);
  // an exhausted tier auto-bumps to the nearest stronger off (1/2 → 3/4 → Complete)
  // and the row is relabeled to what is actually sent, with a warning. Slots already
  // reserved by named senders + the conqueror reservation above are subtracted so each
  // tier isn't double-filled.
  for (const tier of ['complete', 'tq', 'half']) {
    for (const T of targets) {
      if (!T.c || T.tg.power) continue; // POWER targets are filled by the balanced pass above
      const autoNeed = Math.max(0, (T.tg[TIER_FIELD[tier]] || 0) - (namedOffReserved[T.i + '|' + tier] || 0));
      // Min. Morale (off) gate — once the TIER is resolved (the tier-bump below still fires only
      // when a tier is empty, never for morale), PREFER candidates whose morale on this target
      // clears minMoraleOff (default 100%), and fall back to the best below-gate village only when
      // none qualify (soft — a low-morale clear beats an uncleared target). Inert with no morale
      // signal (offGate = 0) or when the field is 0. Per-PLAYER morale via the source village.
      const offGate = moraleUsable(T) ? minMoraleOff : 0;
      const candMorale = p => { const m = planAttackMorale(p.v.coord, T.tg.coord); return m == null ? 1 : m; };
      for (let k = 0; k < autoNeed; k++) {
        const tierCands = tt => pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier === tt && okOffDist(p, T.c) && okOffTime(p, T) && !mvBlocked(p, T));
        let sent = tier, cands = tierCands(tier);
        for (const up of TIER_UP[tier]) {
          if (cands.length) break;
          cands = tierCands(up);
          if (cands.length) sent = up;
        }
        if (!cands.length) {
          const inBand = pool.filter(p => !p.usedOff && !offBlocked(p) && okOffDist(p, T.c));
          planWarnings.push(inBand.length && !inBand.some(p => okOffTime(p, T))
            ? t('warn_off_too_late')(t('tier_' + tier), T.tg.coord)
            : t('warn_missed_off')(t('tier_' + tier), T.tg.coord));
          T.offRows.push({ type: tier, unassigned: true });
          continue;
        }
        if (sent !== tier) planWarnings.push(t('warn_tier_bumped')(t('tier_' + tier), t('tier_' + sent), T.tg.coord));
        // The conqueror's own off was already reserved up front (see the conqueror reservation
        // above), so the auto pass just fills the remaining slots by optimize — preferring the
        // villages that clear the Min. Morale (off) gate, else falling back to all candidates.
        const hi = cands.filter(p => candMorale(p) >= offGate);
        // Morale gate first (usual requirement), then prefer cat-carriers on a destroyer target.
        const p = preferCatOffs(T, hi.length ? hi : cands).sort(byOptimize(T))[0];
        p.usedOff = true; noteOffUsed(p.v.player); noteMvClaim(p, T);
        const d = distXY(p.c, T.c);
        T.offRows.push({
          type: sent, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
          dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us),
        });
      }
    }
  }

  // Destroyer warning: a destroyer target that got offs but none carrying ≥ CAT_CLEAR_MIN
  // catapults sent a regular off instead of a cat-clearing one — surface it (fall back + warn).
  {
    const vCat = {};
    for (const v of villages) vCat[v.coord] = v.catapult || 0;
    for (const T of targets) {
      if (!T.c || !isDestroyer(T)) continue;
      const assigned = T.offRows.filter(r => !r.unassigned && r.srcCoord);
      if (assigned.length && !assigned.some(r => (vCat[r.srcCoord] || 0) >= CAT_CLEAR_MIN))
        planWarnings.push(t('warn_no_cat_clear')(T.tg.coord));
    }
  }

  // ── Catapult attacks (EXTRA, from defensive villages that own catapults) ──────────
  // Fully independent of the off pool, morale gate, MV pairs and reservations — these are
  // additional demolition attacks, NOT clearing offs. Each target's requested count
  // (`tg.catapult`) is filled from OWN villages classified DEFENSIVE (`type === 'def'`) that
  // own catapults; one attack sends `catsPerAttack` catapults. A source village's budget =
  // floor(its catapults / catsPerAttack), spent across all targets; at most 2 attacks per
  // (source village → the SAME target) — so a player can still send 4 to one target from two
  // villages. Two extra rules:
  //   • Player spread: among eligible sources we pick the player who has sent the FEWEST
  //     attacks to this target so far (ties broken by closest), so we don't repeat a player
  //     while a fresh one is available — only repeating once every distinct player is used.
  //   • Distance lead: a cat source must be at least CAT_OFF_LEAD fields CLOSER to the target
  //     than the farthest assigned off (cats are slow — keep them inside the off ring). With no
  //     assigned off the gate is inert. This can tighten supply, so shortfalls are warned.
  const CAT_OFF_LEAD = 8;
  const catsPerAttack = Math.max(1, parseInt((document.getElementById('plan-cat-count') || {}).value) || 20);
  const catPool = villages
    .map(v => ({ v, c: parseCoordStr(v.coord), budget: Math.floor((v.catapult || 0) / catsPerAttack) }))
    .filter(s => s.c && s.v.type === 'def' && s.budget > 0);
  for (const T of targets) {
    if (!T.c) continue;
    const want = T.tg.catEnabled ? (T.tg.catapult || 0) : 0; // only when the target's catapult toggle is on
    if (want <= 0) continue;
    // Per-attack target building, dealt round-robin (one per building per pass); defaults to all
    // Smithy when no buildings are picked. The k-th placed attack takes catBuildings[k]; a
    // shortfall spreads evenly (5 over 3, 3 sent → 1/1/1).
    const catBuildings = catBuildingTargets(T.tg);
    const offDists = T.offRows.filter(r => !r.unassigned && typeof r.dist === 'number').map(r => r.dist);
    const maxCatDist = offDists.length ? Math.max(...offDists) - CAT_OFF_LEAD : Infinity;
    const perTarget = {}; // source coord → attacks already aimed at THIS target (cap 2)
    const perPlayer = {}; // source player → attacks already aimed at THIS target (spread)
    let placed = 0;
    while (placed < want) {
      const cand = catPool
        .filter(s => s.budget > 0 && (perTarget[s.v.coord] || 0) < 2 && distXY(s.c, T.c) <= maxCatDist)
        .sort((a, b) => (perPlayer[decode(a.v.player)] || 0) - (perPlayer[decode(b.v.player)] || 0)
          || distXY(a.c, T.c) - distXY(b.c, T.c))[0];
      if (!cand) break; // no eligible cat source left (budget/cap hit or none within the distance lead)
      const cp = decode(cand.v.player);
      cand.budget--;
      perTarget[cand.v.coord] = (perTarget[cand.v.coord] || 0) + 1;
      perPlayer[cp] = (perPlayer[cp] || 0) + 1;
      placed++;
      const d = distXY(cand.c, T.c);
      T.catRows.push({ type: 'catapult', cats: catsPerAttack, srcCoord: cand.v.coord, srcPlayer: cp,
        building: catBuildings[placed - 1] || null,
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us) });
    }
    if (placed < want) planWarnings.push(t('warn_cat_short')(T.tg.coord, want - placed));
  }

  // Windows: offs land strongest-first (complete → 3/4 → 1/2) across the
  // target's off windows — each window takes its #offs, unset counts share the
  // remainder. Snob trains land in the snob window, independent of the offs.
  for (const T of targets) {
    if (!T.c) continue;
    T.offRows.sort((a, b) => TIER_RANK[b.type] - TIER_RANK[a.type]);
    // The conqueror's own off lands LAST among this target's offs (immediately before its
    // noble row), so the snob sender owns the final clear→noble handoff. Done after the
    // tier sort and as a single splice so it doesn't disturb the strongest-first order of
    // the rest. (At most one conqueror off per target — see the reservation pass.)
    const ci = T.offRows.findIndex(r => r.conqueror);
    if (ci !== -1) T.offRows.push(T.offRows.splice(ci, 1)[0]);
    const wins = T.tg.offWindows.length ? T.tg.offWindows : [{ win: '', count: 0 }];
    const counts = windowOffCounts(wins, T.offRows.length);
    let wi = 0, slot = 0;
    for (const r of T.offRows) {
      while (wi < wins.length - 1 && slot >= counts[wi]) { wi++; slot = 0; }
      r.window = wins[wi].win || T.tg.winSnob || '';
      slot++;
    }
    T.snobRows.forEach(r => { r.window = T.tg.winSnob || (wins[wins.length - 1].win || ''); });
    // Catapult attacks land in the target's off window(s) too (extra attacks alongside the
    // offs), distributed the same way but as their own stream so they don't disturb off counts.
    const catCounts = windowOffCounts(wins, T.catRows.length);
    let cwi = 0, cslot = 0;
    for (const r of T.catRows) {
      while (cwi < wins.length - 1 && cslot >= catCounts[cwi]) { cwi++; cslot = 0; }
      r.window = wins[cwi].win || T.tg.winSnob || '';
      cslot++;
    }
    // Catapult Mode: every OFF row carries this target's off-sender building objective (the cats
    // riding with the clearing/destroyer/noble-escort off aim here). POWER forces Wall. Catapult
    // attacks keep their own per-attack building (set above); snob trains carry none.
    const offBuilding = effectiveCatMode(T.tg);
    [...T.offRows, ...T.catRows, ...T.snobRows].forEach(r => {
      if (r.type === 'complete' || r.type === 'tq' || r.type === 'half') r.building = offBuilding;
      // Morale of the assigned attack (shown in the plan column); needs the world DB.
      if (r.srcCoord && dbReady) r.morale = planAttackMorale(r.srcCoord, T.tg.coord);
      planRows.push({ tIdx: T.i + 1, tCoord: T.tg.coord, tPlayer: T.tg.player, ...r });
    });
  }

  // A row can still be impossible when its assigned window is earlier than
  // the latest one its source was vetted against — flag it instead of hiding it.
  // Snob trains are skipped: they carry no prescribed origin/launch, so there's
  // no launch-in-the-past to flag (the player picks their own send village).
  for (const r of planRows) {
    // Catapults are slow (they'd false-positive the launch-in-the-past check en masse) and
    // carry no off-pool launch contract — exempt them from the late flag, like snob trains.
    if (r.unassigned || r.type === 'snob' || r.type === 'catapult') continue;
    const pw = parseWindowStr(r.window);
    const landMs = pw ? serverWallMs(otCfg.dateISO, pw.to) : null;
    if (landMs !== null && landMs - r.travel * 60000 < sendFloorMs) {
      r.late = true;
      planWarnings.push(t('warn_row_late')(r.srcCoord, r.tCoord));
    }
  }

  // Off-pool breakdown for the Plan summary footer, split PER OFF TIER (Complete / 3-4 /
  // 1-2) by each village's OWN tier. Computed HERE (after every off pass) so `usedOff` /
  // `isEscort` are final. Over OFF-CAPABLE villages only (tier !== 'none' — a defensive/empty
  // village isn't an off). The buckets PARTITION each tier's gross village count so the footer
  // reconciles exactly: gross[tier] = assigned + heldDist + heldNoble + heldSplit + heldLate + unused + ignored.
  //   • ignored    = excluded from the pool by the Ignore Coordinates / Ignore Players lists
  //   • assigned   = an off committed in the plan (usedOff, not the escort)
  //   • split-off  = the village whose off rides WITH a noble as the escort (usedOff + isEscort)
  //   • noble launch = a launch village held free for the noble (snobReserved, not used)
  //   • distance   = the blanket minDist holdback (tooClose), not otherwise used/reserved
  //   • unused     = in the pool, off-capable, neither used nor reserved (surplus / no
  //                  request for that tier / out of range or time)
  // A village counts as RESERVED for a split-off / noble launch if it's in the reservation
  // set, whether or not the snob loop ended up launching from it — an escort the engine held
  // back is off-limits to the off passes (offBlocked), so it's "reserved", NOT "unused".
  // That's why the held buckets key on escortReserved/snobReserved (plus the actual launched
  // escort via isEscort), so `unused` means genuinely free, and the partition still reconciles.
  // A village is "outside earliest launch date" (heldLate) when it's within off-distance of at
  // least one target but is too LATE for every such target (fails okOffTime) — i.e. timing is the
  // ONLY thing stopping it, so pushing the arrival date (or the Earliest send) later would free
  // it. Villages out of DISTANCE range everywhere are a different reason and stay in `unused`.
  const offLate = p => {
    let reachable = false;
    for (const T of targets) {
      if (!T.c || !okOffDist(p, T.c)) continue;
      reachable = true;
      if (okOffTime(p, T)) return false; // in time for at least one reachable target → not late
    }
    return reachable;
  };
  planStats = emptyPlanStats();
  for (const v of villages) {
    const tier = getOffTier(v.offPow);
    if (tier === 'none') continue;
    if (ignoreCoords.has(v.coord) || ignorePlayers.has(v.player)) planStats[tier].ignored++;
  }
  for (const p of pool) {
    if (p.tier === 'none') continue;                                          // not an off
    if (ignorePlayers.has(p.v.player)) continue;                              // counted under `ignored` above (now in pool, but barred from offs)
    const s = planStats[p.tier];
    if (escortReserved.has(p) || (p.usedOff && p.isEscort)) s.heldSplit++;     // reserved for / riding as a split-off escort
    else if (snobReserved.has(p))                           s.heldNoble++;     // held free for a noble launch
    else if (p.usedOff)                                     s.assigned++;      // an off committed in the plan
    else if (tooClose.has(p))                               s.heldDist++;      // blanket min-distance holdback
    else if (offLate(p))                                    s.heldLate++;      // reachable by distance but too late everywhere
    else                                                    s.unused++;        // genuinely free / not needed / out of distance range
  }

  saveOffensive();
  renderPlanTable();
  if (typeof cloudSyncPlan === 'function') cloudSyncPlan(); // hosted-site cloud save of the JSON snapshot
}

function delPlanRow(i) { planRows.splice(i, 1); saveOffensive(); renderPlanTable(); }

// Wipe the generated offensive plan (mirrors clearOffTargets). Confirms only when there's
// a plan to lose; resets the same state generatePlan() rebuilds, then re-renders empty.
function clearPlan() {
  if (planRows.length && !confirm(t('confirm_clear_plan'))) return;
  planRows = []; planWarnings = []; planReserved = [];
  planStats = emptyPlanStats();
  saveOffensive(); renderPlanTable();
}

function renderPlanTable() {
  // Rebuild the Coordinate Filter rows (also refreshes them on a language switch, since
  // renderPlanTable runs from changeLang). Guarded + no-ops without its host element.
  if (typeof renderCoordFilters === 'function') renderCoordFilters();
  // Warnings can be many; render them collapsed (count in the summary) so they
  // don't bury the plan table. Native <details> — no JS, works under file://.
  document.getElementById('plan-warnings').innerHTML = planWarnings.length
    ? `<details class="warn-box"><summary>${t('plan_warnings_toggle')(planWarnings.length)}</summary>`
      + `<div class="warn-list">${planWarnings.map(esc).join('<br>')}</div></details>` : '';
  const assigned = planRows.filter(r => !r.unassigned).length;
  // Per-tier off breakdown next to the attack tally. Every number comes from planStats
  // (computed in generatePlan), whose six buckets partition each tier's gross village count,
  // so each segment reconciles: assigned + held(distance/noble/split) + unused + ignored = [N].
  const TIER_BADGE = { complete: 'badge-complete', tq: 'badge-tq', half: 'badge-half' };
  let summary = planRows.length ? esc(t('plan_summary')(assigned, planRows.length - assigned)) : '';
  if (planRows.length && planStats) {
    // One line per off tier, behind a collapsible toggle (native <details>, file://-safe).
    const segs = ['complete', 'tq', 'half'].map(tier => {
      const s = planStats[tier] || { assigned: 0, heldDist: 0, heldNoble: 0, heldSplit: 0, heldLate: 0, unused: 0, ignored: 0 };
      // [N] = gross count of villages of this tier tribe-wide (same denominator as the
      // Offensive Targets footer — total selectable offs, before any holdback/reservation).
      const gross = villages.filter(v => getOffTier(v.offPow) === tier).length;
      return `<span class="badge ${TIER_BADGE[tier]}">${t('tier_' + tier)} [${gross}]</span> `
        + esc(t('plan_offs_summary')(s.assigned, s.heldDist, s.heldNoble, s.heldSplit, s.unused, s.ignored, s.heldLate));
    });
    summary += `<details style="margin-top:6px;"><summary style="cursor:pointer;">${esc(t('btn_show_off_counts'))}</summary>`
      + `<div style="margin-top:4px;line-height:1.9;">${segs.join('<br>')}</div></details>`;
  }
  document.getElementById('plan-summary').innerHTML = summary;

  const tbody = document.getElementById('plan-tbody');
  if (!planRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="13">${t('empty_no_plan')}</td></tr>`;
    return;
  }
  let lastIdx = null;
  tbody.innerHTML = planRows.map((r, i) => {
    const first = r.tIdx !== lastIdx;
    lastIdx = r.tIdx;
    const badge = r.type === 'snob'
      ? `<span class="badge badge-snob">${r.count > 1 ? r.count + 'x ' : ''}👑 ${t(r.escorted ? 'type_snob_split' : 'type_snob')}</span>`
      : r.type === 'catapult'
      ? `<span class="badge" style="background:#5a3f6a;color:#e8d8f0;">${twIcon('catapult')} ${r.cats}</span>`
      : `<span class="badge badge-${r.type === 'complete' ? 'complete' : r.type === 'tq' ? 'tq' : 'half'}">${t('tier_' + r.type)}</span>`;
    const trStyle = [
      first && i > 0 ? 'border-top:2px solid #7a5c10' : '',
      r.unassigned ? 'background:rgba(192,64,32,0.08)' : '',
    ].filter(Boolean).join(';');
    // Snob trains never carry a displayed origin (the player prepares the train from a village
    // of their own choosing) — so the Source cell shows a "Prepare Snob Train" label plus the
    // new "Villages in snob range: …" list (the assigned player's in-range, Academy-sized
    // villages), and no distance/travel/launch/rally/morale, only the arrival window. Offs
    // show timing when assigned. (needNobles is snob-only, so the off path is just assigned/not.)
    const isSnob = r.type === 'snob';
    const showTiming = !isSnob && !r.unassigned;
    const snobRangeTxt = snobRangeText(r);
    const snobRange = snobRangeTxt
      ? `<div style="color:#c8a060;font-size:12px;margin-top:2px;">${esc(snobRangeTxt)}</div>` : '';
    return `
    <tr${trStyle ? ` style="${trStyle}"` : ''}>
      <td style="color:#806030;">${first ? r.tIdx : ''}</td>
      <td class="left" style="font-family:monospace;">${first ? esc(r.tCoord) : ''}</td>
      <td class="left">${first && r.tPlayer ? `<span class="player-tag">${esc(r.tPlayer)}</span>` : ''}</td>
      <td>${badge}${r.type !== 'snob' && catTargetLabel(r) ? ` <span style="color:#c8a0e0;font-size:11px;white-space:nowrap;">→ ${esc(catTargetLabel(r))}</span>` : ''}</td>
      <td class="left" style="font-family:monospace;">${
        isSnob
          ? `<span style="color:#e0a020;font-weight:600;">${esc(t('plan_prepare_snob')(r.escorted))}</span>${snobRange}`
          : (r.unassigned
              ? `<span style="color:#e06040;">${t('bb_unassigned')}</span>`
              : esc(r.srcCoord))
      }</td>
      <td class="left">${r.srcPlayer ? `<span class="player-tag">${esc(r.srcPlayer)}</span>` : '—'}</td>
      <td style="color:${moraleColor(r.morale)};font-weight:600;">${isSnob ? '—' : fmtMorale(r.morale)}</td>
      <td style="color:#60a0e0;font-weight:600;font-family:monospace;">${esc(fmtWindow(r.window) || '—')}</td>
      <td style="color:#f0c040;">${showTiming ? r.dist.toFixed(1) : '—'}</td>
      <td>${showTiming ? fmtTime(r.travel) : '—'}</td>
      <td style="font-family:monospace;${r.late ? 'color:#e06040;font-weight:600;' : ''}">${showTiming ? (r.late ? '⚠ ' : '') + launchWindowStr(r.window, r.travel) : '—'}</td>
      <td>${(() => { const url = showTiming ? rallyUrl(r.srcCoord, r.tCoord, r.type === 'catapult' ? { catapult: r.cats } : undefined) : null; return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">⚔</a>` : '—'; })()}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="delPlanRow(${i})">✕</button></td>
    </tr>`;
  }).join('');
  // The Outbound Offs tab shows each sender's assigned target (Off Target / Target
  // Player columns), so any plan change must repaint it too. Cheap + idempotent.
  if (typeof renderOutboundTable === 'function') renderOutboundTable();
  // Manage Offensive matches the imported incoming orders against this plan — same deal.
  if (typeof renderManageTable === 'function') renderManageTable();
}

// The snob-range text for a snob row, or '' when there's no assigned player to attribute
// villages to (an anonymous unfilled auto-train). Coordinates are listed ONLY when the player
// has 1 or 2 in-range Academy-sized villages — a tight squeeze worth spelling out. With 3+ they
// have plenty of room to coordinate their own train, so we list nothing. 0 in range keeps the
// "No villages …" warning. Shared by the Plan Offensive table and the per-player exports so the
// message is identical. Plain text (no "→"/[coord]), so it stays invisible to both importers.
function snobRangeText(r) {
  if (r.type !== 'snob' || !r.srcPlayer) return '';
  const v = r.rangeVills || [];
  if (v.length === 0) return t('snob_range_none');
  if (v.length === 1) return t('snob_range_one')(v[0]);
  if (v.length === 2) return t('snob_range_two')(v.join(', '));
  return ''; // 3+ in range → plenty of room to coordinate; no coords listed
}

// Localized target-building label for a plan row ('' when none / not a valid key). Covers both
// the catapult-attack picker buildings and the Catapult Mode (off-sender) buildings.
function catTargetLabel(r) {
  return r && r.building && BUILDING_TARGET_KEYS.includes(r.building) ? t('catb_' + r.building) : '';
}

// ── BB icon helper (shared by both export functions) ──
function planRowIconBB(r) {
  if (r.type === 'snob') return r.escorted ? '[unit]axe[/unit][unit]snob[/unit]' : '[unit]snob[/unit]';
  if (r.type === 'catapult') return '[unit]catapult[/unit]';
  // Complete offs stay rams; 3/4 and 1/2 use axe with the tier tagged in parens.
  if (r.type === 'complete') return '[unit]ram[/unit]';
  return `[unit]axe[/unit] (${t('tier_' + r.type)})`;
}

// ── Export the plan's target coordinates (one per line) ──
// Exactly the paste format the "Target Village Orders Exporter" userscript
// (incomingOrders.js) expects; its .txt/.json export then feeds the Manage
// Offensive tab. Unique coords, plan order.
function exportPlanCoords() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }
  const coords = [...new Set(planRows.map(r => r.tCoord))];
  // Not a BB table — retitle the shared modal (closeBBModal restores the default)
  const h = document.getElementById('bb-modal-title');
  if (h) {
    if (h.dataset) h.dataset.i18n = 'coord_modal_title';
    h.textContent = t('coord_modal_title');
  }
  document.getElementById('bb-output').value = coords.join('\n');
  document.getElementById('bb-modal').classList.add('open');
}

// ── Build objective groups from the plan (one per target, in plan order) ──
function planGroups() {
  const groups = [];
  for (const r of planRows) {
    let g = groups.find(x => x.idx === r.tIdx);
    if (!g) { g = { idx: r.tIdx, coord: r.tCoord, player: r.tPlayer, rows: [] }; groups.push(g); }
    g.rows.push(r);
  }
  return groups;
}

// ── Forum-style BB row (shared by the Forum export and the per-player objective context) ──
// A pinned-but-unplaced sender keeps their name; a truly anonymous unassigned row falls back
// to the UNASSIGNED label. Snob trains never name an origin — just the "Prepare Snob Train"
// call-out (the target is the group header above). `bare` (the Plan Offensive Forum export)
// drops the "Villages in snob range" trailing line — that detail lives in the Per-Player Orders
// export, so the tribe-wide Forum post shows just the snob + the assigned player + window. The
// per-player objective-context dump leaves `bare` false and keeps the range line.
function planRowForumBB(r, multiSnob, bare) {
  const iconBB = planRowIconBB(r);
  const prefix = r.type === 'snob' && multiSnob ? `${r.count}x ` : '';
  const who    = r.srcPlayer ? `[player]${r.srcPlayer}[/player]` : t('bb_unassigned');
  const prep   = r.type === 'snob' ? ` ${t('plan_prepare_snob')(r.escorted)}`
               : catTargetLabel(r) ? ` (→ ${catTargetLabel(r)})` : ''; // cat-attack or off-sender building objective
  // Snob trains list the assigned player's in-range, Academy-sized villages on a TRAILING
  // line (kept off the attack line so the off-plan re-import still parses the attack, and so
  // the bare X|Y coords — no "→"/[coord] — are ignored by both BB importers).
  const rt     = bare ? '' : snobRangeText(r);
  const range  = rt ? `\n${rt}` : '';
  return `${prefix}${iconBB} ${who}${prep} [b][color=#0000a5]${fmtWindow(r.window) || '??:??'}[/color][/b]${range}`;
}

// ── Forum BB export (matches the tribe's offensive post format) ──
function showPlanBB() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }

  const nobleCounts = [...new Set(offTargets.map(x => x.nobles).filter(Boolean))].sort((a, b) => a - b);
  const noblesLabel = nobleCounts.length ? nobleCounts.join(' ó ') : '4';

  let bb = `[size=16][b][u]${t('bb_arrival_date')}:[/u][/b] ${bbDateLabel()}[/size]\n\n`;
  bb += `[unit]ram[/unit] --> ${t('bb_legend_ram')}\n`;
  if (planRows.some(r => r.type === 'tq')) bb += `[unit]axe[/unit] (${t('tier_tq')}) --> ${t('bb_legend_tq')}\n`;
  if (planRows.some(r => r.type === 'half')) bb += `[unit]axe[/unit] (${t('tier_half')}) --> ${t('bb_legend_axe')}\n`;
  if (planRows.some(r => r.type === 'catapult')) bb += `[unit]catapult[/unit] --> ${t('bb_legend_cat')}\n`;
  if (planRows.some(r => r.type === 'snob' && !r.escorted)) bb += `[unit]snob[/unit] --> ${t('bb_legend_snob')(noblesLabel)}\n`;
  if (planRows.some(r => r.type === 'snob' && r.escorted)) bb += `[unit]axe[/unit][unit]snob[/unit] --> ${t('bb_legend_split')(noblesLabel)}\n`;
  bb += '\n';

  const groups = planGroups();
  groups.forEach((g, gi) => {
    bb += `${gi + 1}. ${g.coord}${g.player ? ` - [player]${g.player}[/player]` : ''}\n`;
    const multiSnob = g.rows.filter(x => x.type === 'snob').length > 1;
    for (const r of g.rows) bb += planRowForumBB(r, multiSnob, true) + '\n';
    bb += '\n';
  });

  document.getElementById('bb-output').value = bb.trimEnd() + '\n';
  document.getElementById('bb-modal').classList.add('open');
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ FORMAT CONTRACT — attack-planner.html IMPORTS the exports below.
// parsePlayerPlanBB() in attack-planner.html parses the Per-Player Orders / Per-Player All
// output line by line: the "========== NAME (n) ==========" sender headers, the ARRIVAL DATE
// header (bbDateLabel — it reads the trailing day-of-month), off lines ("src → [coord]tgt
// [/coord] (defender) window"), the LAUNCH TIME continuation line (rally URL → village-ID
// pins), and snob order lines ("Prepare Snob Train for [coord]…", detected by
// [unit]snob[/unit] + a [coord] tag). parseOffPlanBB() likewise parses the Forum BB export
// (showPlanBB's "N. X|Y - Player." groups). Lines meant to be IGNORED by the importer rely on
// staying structurally distinct: objective-context rows have no "→ [coord]" and their snob
// rows have no [coord]; snob-range and UNASSIGNED lines use bare coords only.
// → If you change the SHAPE of anything emitted here (playerPlanBBBlock, snobOrderLineBB,
//   planRowForumBB, unassignedPlanBBBlock, bbDateLabel, showPlanBB), update the attack-planner
//   importer + .omc/test_attack_import.js in the same change. Cosmetic changes (colors, bold,
//   labels) are safe — the importer anchors on structure, never on presentation tags.
// ═══════════════════════════════════════════════════════════════════════════════════════

// ── Grouping shared by all three per-player exports (Orders BB, Table, combined All):
//    rows-with-a-sender (incl. pinned-but-unplaced "needs nobles") bucket by player; truly
//    anonymous unassigned rows are handled separately by the caller. ──
function groupPlanRowsByPlayer(named) {
  const byPlayer = {};
  for (const r of named) {
    if (!byPlayer[r.srcPlayer]) byPlayer[r.srcPlayer] = [];
    byPlayer[r.srcPlayer].push(r);
  }
  return byPlayer;
}
function playerNamesAZ(byPlayer) {
  return Object.keys(byPlayer).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// ── A snob train's per-player instruction line(s): a "Prepare Snob Train for <target>"
//    call-out (no origin village, no rally URL — so the importers skip it) + the arrival
//    window, then a trailing "Villages in snob range: …" line (bare X|Y coords, also skipped).
//    Shared by the Per-Player Orders BB and the Per-Player Table export (snobs sit BELOW the
//    [table] there, since a noble train has no launch village to fill the table columns). ──
function snobOrderLineBB(r) {
  const iconBB   = planRowIconBB(r);
  const prefix   = r.count > 1 ? `${r.count}x ` : '';
  const prep     = t('plan_prepare_snob')(r.escorted, `[coord]${r.tCoord}[/coord]`);
  const defender = r.tPlayer ? ` ([player]${r.tPlayer}[/player])` : '';
  const rt       = snobRangeText(r);
  const range    = rt ? `\n${rt}` : '';
  const win      = (fmtWindow(r.window) || '??:??').replace('/', '-');
  // needNobles rows are no longer flagged — "Prepare Snob Train" already implies recruiting one.
  return `${prefix}${iconBB} ${prep}${defender} [b][color=#2e2eff]${win}[/color][/b]${range}`;
}

// ── One player's Orders block: header + arrival date + order lines + (if they send a snob)
//    the full objective-context dump. `allGroups` = planGroups() (passed in so the caller
//    builds it once). Ends with a trailing blank line, matching the legacy layout. Shared by
//    the on-screen Per-Player Orders export and the combined Per-Player All download. ──
function playerPlanBBBlock(name, rows, allGroups) {
  let bb = `========== ${name} (${rows.length}) ==========\n`;
  bb += `[b][u]${t('bb_arrival_date')}:[/u][/b] ${bbDateLabel()}\n\n`;
  // Order lines come out send-time-sorted (earliest launch first), matching the Per-Player
  // Table, with a blank line between each attack. planRowsBySendTime is side-effect free.
  const lines = [];
  for (const r of planRowsBySendTime(rows)) {
    const iconBB   = planRowIconBB(r);
    const prefix   = r.type === 'snob' && r.count > 1 ? `${r.count}x ` : '';
    const defender = r.tPlayer ? ` ([player]${r.tPlayer}[/player])` : '';

    if (r.type === 'snob') {
      // Snob trains never name an origin village — just a "Prepare Snob Train for <target>"
      // call-out + arrival window + the in-range village list (shared with the Table export).
      lines.push(snobOrderLineBB(r));
      continue;
    }

    // ── Offs (always assigned in this per-player section; unassigned offs have no
    //    sender and fall to the UNASSIGNED block below) ──
    // Catapult attacks preset their catapult count in the rally link and show it in bold parens.
    const url     = rallyUrl(r.srcCoord, r.tCoord, r.type === 'catapult' ? { catapult: r.cats } : undefined);
    const urlPart = url ? ` — [url=${url}]${t('bb_pp_attack_url')}▶[/url]` : '';
    // Catapult rows show their cat count (+ target building); off rows show their Catapult Mode
    // building objective alone. Both render as a bold parenthetical after the unit icon.
    const bldg    = catTargetLabel(r);
    const catPart = r.type === 'catapult'
      ? ` [b](${r.cats}${bldg ? ` → ${bldg}` : ''})[/b]`
      : (bldg ? ` [b](→ ${bldg})[/b]` : '');
    const win     = (fmtWindow(r.window) || '??:??').replace('/', '-');
    const lp      = launchWindowParts(r.window, r.travel);
    // Line 1 = village → target + arrival window; line 2 = the red launch-time call-out
    // (carries the rally link). [b] opens on line 1 and closes after the launch line.
    const launch  = lp
      ? `\n${t('bb_pp_launchline')(lp.day, `[color=#ff0e0e]${lp.span}[/color]`, lp.single)}${urlPart}[/b]`
      : `${urlPart}[/b]`;
    lines.push(`${prefix}${iconBB}${catPart} ${r.srcCoord} → [coord]${r.tCoord}[/coord]${defender} [b][color=#2e2eff]${win}[/color]${launch}`);
  }
  bb += lines.join('\n\n');
  if (lines.length) bb += '\n';

  // ── Objective context: paste the full objective(s) this player sends a snob to, so
  //    they see the whole train (who else hits it + arrival windows). Forum-BB format,
  //    numbered per-player (1..N). None of these lines carry "→"/[url=], so the
  //    attack-planner per-player import skips every one — no phantom attacks. ──
  const snobTIdx = [];
  for (const r of rows) if (r.type === 'snob' && !snobTIdx.includes(r.tIdx)) snobTIdx.push(r.tIdx);
  if (snobTIdx.length) {
    bb += '\n\n'; // two blank lines separate the player's instructions from the context dump
    snobTIdx.forEach((tIdx, oi) => {
      const g = allGroups.find(x => x.idx === tIdx);
      if (!g) return;
      const multiSnob = g.rows.filter(x => x.type === 'snob').length > 1;
      bb += `${t('bb_objective')} ${oi + 1}. ${g.coord}${g.player ? ` - [player]${g.player}[/player]` : ''}\n`;
      for (const gr of g.rows) bb += planRowForumBB(gr, multiSnob) + '\n';
      bb += '\n';
    });
  }
  bb += '\n';
  return bb;
}

// Anonymous-unassigned Orders block (no sender) — simple "label → coord" lines.
function unassignedPlanBBBlock(unassigned) {
  let bb = `========== ${t('bb_unassigned')} ==========\n`;
  for (const r of unassigned) {
    const label = r.type === 'snob' ? t('type_snob') : t('tier_' + r.type);
    bb += `${label} → ${r.tCoord}\n`;
  }
  bb += '\n';
  return bb;
}

// ── Per-player BB export (Per-Player Orders) ──
function showPlayerPlanBB() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }

  const named      = planRows.filter(r => r.srcPlayer);
  const unassigned = planRows.filter(r => !r.srcPlayer);
  const byPlayer   = groupPlanRowsByPlayer(named);
  const names      = playerNamesAZ(byPlayer);
  const allGroups  = planGroups(); // for the per-player "objective context" dump

  let bb = '';
  for (const name of names) bb += playerPlanBBBlock(name, byPlayer[name], allGroups);
  if (unassigned.length) bb += unassignedPlanBBBlock(unassigned);

  document.getElementById('bb-output').value = bb.trimEnd() + '\n';
  document.getElementById('bb-modal').classList.add('open');
}

// ── Per-player attack TABLE export (BB [table], one section per player) ─────────
// Type column = unit icon(s) + text: offs → "[unit]ram[/unit] Off" (half offs keep the
// axe icon), solo snob → "[unit]snob[/unit] Snob", escorted → "[unit]axe[/unit][unit]snob[/unit] Split Off Snob".
function planRowTableType(r) {
  if (r.type === 'snob') {
    return r.escorted
      ? `[unit]axe[/unit][unit]snob[/unit] ${t('tbl_type_split')}`
      : `[unit]snob[/unit] ${t('tbl_type_snob')}`;
  }
  if (r.type === 'catapult') return `[unit]catapult[/unit] ${t('tbl_type_cat')} (${r.cats}${catTargetLabel(r) ? ` → ${catTargetLabel(r)}` : ''})`;
  return `${planRowIconBB(r)} ${t('tbl_type_off')}${catTargetLabel(r) ? ` (→ ${catTargetLabel(r)})` : ''}`;
}

// Absolute send/arrival server-wall times for a plan row. Arrival = the window's START
// (a single value for the table cell, matching the in-game export shape); send = arrival −
// travel (minute-rounded, like launchWindowStr, so times end in :00). Day-wrap is handled
// by working in absolute epoch ms. Returns null if no arrival date is set or the window is
// unparseable — the caller then leaves the time cells blank.
function planRowAbsTimes(r) {
  const md = String(otCfg.dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const w  = parseWindowStr(r.window);
  if (!md || !w) return null;
  const p = n => String(n).padStart(2, '0');
  const fmt = ms => { const d = new Date(ms);
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} `
         + `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`; };
  const arrMs  = Date.UTC(+md[1], +md[2] - 1, +md[3]) + w.f * 60000;
  const sendMs = arrMs - Math.round(r.travel || 0) * 60000;
  return { sendMs, send: fmt(sendMs), arrival: fmt(arrMs) };
}

// One BB [table] row for a plan row. Snob trains have no origin village in this tool, so
// Source is blank and the Attack URL cell shows the Prepare-Snob-Train note instead of a
// rally link (the target coord already lives in its own column). Offs link to the bare
// rally point (no preset troops, per the chosen format). Cells joined by [|] with a
// trailing [|] (matches the in-game export); empty cells stay as adjacent [|][|].
function planTableRowBB(r, n) {
  const cs = '[|]';
  const abs = planRowAbsTimes(r);
  let urlBB;
  if (r.type === 'snob') {
    urlBB = t('plan_prepare_snob')(r.escorted);
  } else {
    const url = r.srcCoord ? rallyUrl(r.srcCoord, r.tCoord, r.type === 'catapult' ? { catapult: r.cats } : undefined) : null;
    urlBB = url ? `[url=${url}]${t('bb_tbl_open')}[/url]` : '';
  }
  const cells = [
    n,
    r.type === 'snob' || !r.srcCoord ? '' : `[coord]${r.srcCoord}[/coord]`,
    `[coord]${r.tCoord}[/coord]`,
    r.tPlayer ? `[player]${r.tPlayer}[/player]` : '',
    planRowTableType(r),
    abs ? abs.send : '',
    abs ? abs.arrival : '',
    urlBB,
  ];
  return `[*]${cells.join(cs)}${cs}`;
}

// Rows sorted by absolute send time (epoch ms); rows with no computable time sort last.
// Side-effect free — wraps each row, never mutates the shared planRows.
function planRowsBySendTime(rows) {
  return rows
    .map(r => ({ r, t: (planRowAbsTimes(r) || { sendMs: Infinity }).sendMs }))
    .sort((a, b) => a.t - b.t)
    .map(x => x.r);
}

// One BB [table] (header + send-time-sorted rows) for a set of plan rows. No
// "========== player ==========" banner — callers add that. Shared by the on-screen
// Per-Player Table export and the combined Per-Player All download.
function planTableBlock(rows) {
  const sep = '[||]';
  const header = `[**]#${sep}${t('th_source')}${sep}${t('th_target')}${sep}${t('th_target_player')}`
               + `${sep}${t('th_type')}${sep}${t('th_send_time')}${sep}${t('th_arrival_time')}${sep}${t('th_attack_url')}[/**]`;
  // Noble trains have no origin/launch village, so they're never table rows — the table is
  // OFFS ONLY. The standalone Per-Player Table export appends them as text below the [table]
  // (see showPlayerPlanTable); in the combined Per-Player All download the Orders block already
  // lists them, so keeping the table offs-only avoids showing each train twice.
  let bb = `[table]\n${header}\n`;
  planRowsBySendTime(rows.filter(r => r.type !== 'snob')).forEach((r, i) => { bb += planTableRowBB(r, i + 1) + '\n'; });
  bb += '[/table]';
  return bb;
}

// Noble-train text lines for a set of plan rows (send-time-sorted), or '' if none — the snob
// half of the Per-Player Table export, shown below the offs-only [table].
function planTableSnobLines(rows) {
  const snobs = rows.filter(r => r.type === 'snob');
  return snobs.length ? planRowsBySendTime(snobs).map(snobOrderLineBB).join('\n') : '';
}

function showPlayerPlanTable() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }

  const named      = planRows.filter(r => r.srcPlayer);
  const unassigned = planRows.filter(r => !r.srcPlayer);
  const byPlayer   = groupPlanRowsByPlayer(named);
  const names      = playerNamesAZ(byPlayer);

  // Each section = the offs-only [table] + (if the player sends nobles) the snob text lines below it.
  const section = rows => {
    const snobLines = planTableSnobLines(rows);
    return planTableBlock(rows) + (snobLines ? `\n\n${snobLines}` : '');
  };
  let bb = '';
  for (const name of names) {
    const rows = byPlayer[name];
    bb += `========== ${name} (${rows.length}) ==========\n\n${section(rows)}\n\n`;
  }
  if (unassigned.length) {
    bb += `========== ${t('bb_unassigned')} ==========\n\n${section(unassigned)}\n\n`;
  }

  document.getElementById('bb-output').value = bb.trimEnd() + '\n';
  document.getElementById('bb-modal').classList.add('open');
}

// One combined-download section: the "========== name (n) ==========" banner stays OUTSIDE
// (a visible separator), then everything else (Orders body + the attack table) is wrapped in
// a [code]…[/code] block so the forum renders it verbatim (monospace, no BBCode/smiley
// interpretation, easy one-click copy per player). Two blank lines glue Orders→table.
function codeWrapPlanSection(ordersBlock, tableBlock) {
  const trimmed = ordersBlock.trimEnd();
  const nl      = trimmed.indexOf('\n');
  const banner  = nl >= 0 ? trimmed.slice(0, nl) : trimmed;
  const body    = nl >= 0 ? trimmed.slice(nl + 1) : '';
  return `${banner}\n[code]\n${body}\n\n\n${tableBlock}\n[/code]\n\n\n`;
}

// ── Combined per-player export: each player's Orders block immediately followed by their
//    attack table, one [code]-wrapped section per player, as a single downloadable .txt.
//    Stitches the two on-screen exports together; the banner is the visible per-player
//    separator and the Orders+table live inside [code]…[/code]. ──
function buildPlayerPlanAll() {
  const named      = planRows.filter(r => r.srcPlayer);
  const unassigned = planRows.filter(r => !r.srcPlayer);
  const byPlayer   = groupPlanRowsByPlayer(named);
  const names      = playerNamesAZ(byPlayer);
  const allGroups  = planGroups();

  let out = '';
  for (const name of names) {
    const rows = byPlayer[name];
    out += codeWrapPlanSection(playerPlanBBBlock(name, rows, allGroups), planTableBlock(rows));
  }
  if (unassigned.length) {
    out += codeWrapPlanSection(unassignedPlanBBBlock(unassigned), planTableBlock(unassigned));
  }
  return out.trimEnd() + '\n';
}

function exportPlayerPlanAll() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }
  downloadFile(buildPlayerPlanAll(), 'tribe_plan_per_player.txt', 'text/plain;charset=utf-8');
}

// ── Unused offs BB table: every offensive village NOT committed by the current plan ──
// "Committed" = sent as an off, used as a split-off escort, or held in reserve for a
// pending split-off (needNobles recruitCoord). A SOLO snob train leaves the village's
// off free, so it does NOT count as used. Sorted by off power, strongest first.
function planUsedOffCoords() {
  const used = new Set();
  for (const r of planRows) {
    if (r.type === 'catapult') continue; // catapults come from def villages, not the off pool
    if (r.unassigned) { if (r.needNobles && r.recruitCoord) used.add(r.recruitCoord); continue; }
    if (r.type === 'snob') { if (r.escorted && r.srcCoord) used.add(r.srcCoord); }
    else if (r.srcCoord) used.add(r.srcCoord);
  }
  return used;
}

function unusedOffs() {
  const used = planUsedOffCoords();
  const reserved = new Set(planReserved); // launch villages held for nobles — not free offs
  return villages
    .filter(v => getOffTier(v.offPow) !== 'none' && !used.has(v.coord) && !reserved.has(v.coord))
    .sort((a, b) => b.offPow - a.offPow);
}

function showUnusedOffsBB() {
  if (!villages.length) { alert(t('plan_need_data')); return; }
  const offs = unusedOffs();
  if (!offs.length) { alert(t('empty_no_unused_offs')); return; }
  const sep = '[||]', cs = '[|]';
  let bb = '[table]\n';
  bb += `[**]#${sep}${t('th_coord')}${sep}${t('th_player')}${sep}${t('th_type')}${sep}`
      + `[unit]axe[/unit]${sep}[unit]light[/unit]${sep}[unit]ram[/unit]${sep}[unit]catapult[/unit]${sep}${t('th_off_power')}[/**]\n`;
  offs.forEach((v, i) => {
    bb += `[*]${i + 1}${cs}[coord]${v.coord}[/coord]${cs}[player]${decode(v.player)}[/player]${cs}`
        + `${t('tier_' + getOffTier(v.offPow))}${cs}${v.axe || 0}${cs}${v.light || 0}${cs}`
        + `${v.ram || 0}${cs}${v.catapult || 0}${cs}${(v.offPow || 0).toLocaleString()}\n`;
  });
  bb += '[/table]';
  document.getElementById('bb-output').value = bb;
  document.getElementById('bb-modal').classList.add('open');
}
