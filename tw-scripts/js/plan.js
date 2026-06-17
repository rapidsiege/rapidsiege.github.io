// ── Plan generation ──────────────────────────────────────────
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
  const base = `https://${host}/game.php?village=${sv.id}&screen=place&target=${tv.id}`;
  if (!units || !Object.keys(units).length) return base;
  let url = base;
  for (const [u, n] of Object.entries(units || {})) if (n > 0) url += `&${u}=${n}`;
  return url;
}

function splitNobles(total, nPlayers) {
  const n = Math.max(1, nPlayers), base = Math.floor(total / n), rem = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0)).filter(x => x > 0);
}

function generatePlan() {
  if (!villages.length)   { alert(t('plan_need_data'));    return; }
  if (!offTargets.length) { alert(t('plan_need_targets')); return; }
  offTargets.forEach(normalizeOffTarget);

  const ws      = parseFloat(document.getElementById('plan-world-speed').value) || 1;
  const us      = parseFloat(document.getElementById('plan-unit-speed').value) || 1;
  const maxDist = parseFloat(document.getElementById('plan-max-dist').value) || 0;
  const minDistRaw = parseFloat((document.getElementById('plan-min-dist') || {}).value);
  const minDist = isNaN(minDistRaw) ? 0 : minDistRaw;

  const pool = villages.map(v => ({
    v, c: parseCoordStr(v.coord), tier: getOffTier(v.offPow),
    snobLeft: v.snob, usedOff: false, usedSnob: false,
  })).filter(p => p.c);

  // Off-load fairness (auto pass only): how many off villages each player owns, and how
  // many have been committed so far. Used to spread offs in PROPORTION to roster size, so
  // a small-roster player isn't drained while a big one sits idle (e.g. 9+4, not 7+6).
  const offCapacity = {};
  for (const p of pool) if (p.tier !== 'none') offCapacity[p.v.player] = (offCapacity[p.v.player] || 0) + 1;
  const offUsedByPlayer = {};
  const noteOffUsed = name => { offUsedByPlayer[name] = (offUsedByPlayer[name] || 0) + 1; };

  planRows = []; planWarnings = []; planReserved = [];

  const targets = offTargets.map((tg, i) => ({ tg, i, c: parseCoordStr(tg.coord), offRows: [], snobRows: [] }));
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
  const snobMaxRaw = parseFloat((document.getElementById('plan-snob-max') || {}).value);
  const snobMax = isNaN(snobMaxRaw) ? 70 : snobMaxRaw;
  const okSnobDist = (p, tc) => snobMax <= 0 || distXY(p.c, tc) <= snobMax;

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
  const okTime = (p, T, endMin, baseMin) => {
    if (endMin === null || endMin === undefined) return true;
    const landMs = serverWallMs(otCfg.dateISO, endMin);
    if (landMs === null) return true;
    return landMs - travelTimeMin(distXY(p.c, T.c), baseMin, ws, us) * 60000 >= serverNowMs();
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
  const escortReserved = new Set();
  for (const T of targets) {
    // One reserved escort village per train, in spec order (null = none in range).
    // The snob loop reads these by the SAME train index to tell a needNobles sender
    // WHERE to recruit (a split-off launches off + noble from one village).
    T.escortPicks = [];
    if (!T.c || (T.tg.snobMode || 'solo') !== 'escorted') continue;
    for (const { name: want } of targetTrainSpec(T.tg)) {
      const pick = tiers => pool.filter(p => !p.usedOff && !escortReserved.has(p) && !tooClose.has(p)
        && tiers.includes(p.tier) && okSnobDist(p, T.c) && okSnobTime(p, T)
        && (!want || p.v.player === want))
        .sort((a, b) => (distXY(a.c, T.c) - distXY(b.c, T.c)) || (b.v.offPow - a.v.offPow))[0];
      const p = pick(['complete', 'tq']) || pick(['half']);
      if (p) escortReserved.add(p);
      T.escortPicks.push(p || null);
    }
  }

  // Named senders assigned more nobles (across all targets) than they own
  {
    const agg = senderNobleTotals();
    for (const [nm, used] of Object.entries(agg)) {
      const have = players[nm] ? players[nm].totals.snob : 0;
      if (used > have) planWarnings.push(t('warn_sender_capacity')(decode(nm), used, have));
    }
  }

  // Which players send a noble train, and to which targets — captured AS the snob loop runs
  // (so it covers pinned AND auto-picked senders, in BOTH solo and escorted modes). Every
  // noble sender gets their two closest-to-their-targets villages held out of the offs (see
  // snobReserved below); in escort mode the closest of the two is the escort that rides the
  // noble to its own target, the other is simply kept free. snobSenderTargets keys are RAW
  // (encoded) player names, to match the village pool's p.v.player for the reservation.
  // conquerorByTarget keys are DECODED names (to match offRows.srcPlayer) for the off-side
  // coordination bias — SOLO only, because an escorted target already rides an off with its
  // noble, so it needs no extra off biased toward the conqueror. A pinned sender kept on the
  // plan without a noble yet (needNobles) still counts — they are intended to send.
  const snobSenderTargets = {};  // raw player -> Set of target index (solo + escorted)
  const conquerorByTarget = {};  // target index -> Set of decoded sender (solo trains only)
  const noteSnobSender = (rawName, T) => {
    if (!rawName) return;
    (snobSenderTargets[rawName] || (snobSenderTargets[rawName] = new Set())).add(T.i);
    if ((T.tg.snobMode || 'solo') !== 'escorted')
      (conquerorByTarget[T.i] || (conquerorByTarget[T.i] = new Set())).add(decode(rawName));
  };

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
        p.snobLeft > 0 && okSnobDist(p, T.c) && okSnobTime(p, T) &&
        (want ? p.v.player === want : !chosen.has(p.v.player)) &&
        (mode !== 'escorted' || !p.usedOff));
      if (mode === 'escorted') {
        // train travels with its own off escort → prefer villages with real off power
        const strong = cands.filter(p => TIER_RANK[p.tier] >= 1);
        if (strong.length) cands = strong;
      }
      const enough = cands.filter(p => p.snobLeft >= nc);
      // A pinned sender whose villages can't field a FULL train (some nobles, but fewer
      // than this train needs) is treated like the no-noble case: kept on the plan by
      // name, origin UNASSIGNED, warned to recruit more — never assigned a short village.
      if (want && cands.length && !enough.length) {
        planWarnings.push(t('warn_need_nobles')(decode(want), nc, T.tg.coord));
        T.snobRows.push({ type: 'snob', count: nc, escorted: mode === 'escorted', unassigned: true,
          srcPlayer: decode(want), needNobles: true, recruitCoord, dist: recruitDist, travel: recruitTravel });
        noteSnobSender(want, T);
        return;
      }
      if (enough.length) cands = enough;
      const fresh = cands.filter(p => !p.usedSnob);
      if (fresh.length) cands = fresh;
      if (!cands.length) {
        // pinpoint the blocker: out of noble range / launch in the past /
        // off already split / no snobs
        let msg, needNobles = false;
        if (want) {
          const mine = pool.filter(p => p.snobLeft > 0 && p.v.player === want);
          const inRange = mine.filter(p => okSnobDist(p, T.c));
          if (mine.length && !inRange.length) {
            msg = t('warn_snob_range')(decode(want), T.tg.coord);
            // None of their snob villages reach — recommend the player's OWN villages
            // that ARE within snob range (closest first), where recruiting a noble would
            // put a train in range. By this branch's premise none of these hold snobs yet.
            const recruit = pool.filter(p => p.v.player === want && okSnobDist(p, T.c))
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
            if (recruitCoord && nobleSupply < nc) { msg = t('warn_need_nobles')(decode(want), nc, T.tg.coord); needNobles = true; }
            else msg = t('warn_escort_used')(decode(want), T.tg.coord);
          }
          else {
            // the pinned player simply owns no (free) nobles → keep them on the plan
            // as the sender, flag the origin UNASSIGNED, and tell them to recruit one
            msg = t('warn_need_nobles')(decode(want), nc, T.tg.coord);
            needNobles = true;
          }
        } else {
          const any = pool.filter(p => p.snobLeft > 0 && okSnobDist(p, T.c));
          msg = any.length && !any.some(p => okSnobTime(p, T))
            ? t('warn_snob_too_late')(T.tg.coord)
            : t('warn_missed_snob')(T.tg.coord);
        }
        planWarnings.push(msg);
        // A manually-pinned sender stays named on the plan even when unplaced (so they
        // see their assignment); an auto train that couldn't be filled has no name.
        T.snobRows.push({ type: 'snob', count: nc, escorted: mode === 'escorted', unassigned: true,
          srcPlayer: want ? decode(want) : undefined, needNobles, recruitCoord: needNobles ? recruitCoord : undefined,
          dist: needNobles ? recruitDist : undefined, travel: needNobles ? recruitTravel : undefined });
        if (want) noteSnobSender(want, T);
        return;
      }
      // escorted: strongest escort wins; solo: nearest village, weakest off stays home
      // (so the strongest off is left free for off duty — coordination is handled on the
      // off side now via conquerorByTarget)
      cands.sort(mode === 'escorted'
        ? (a, b) => (b.v.offPow - a.v.offPow) || (distXY(a.c, T.c) - distXY(b.c, T.c))
        : (a, b) => (distXY(a.c, T.c) - distXY(b.c, T.c)) || (a.v.offPow - b.v.offPow));
      const p = cands[0];
      p.snobLeft -= nc; p.usedSnob = true; chosen.add(p.v.player);
      if (mode === 'escorted') p.usedOff = true;
      noteSnobSender(p.v.player, T);
      const d = distXY(p.c, T.c);
      T.snobRows.push({
        type: 'snob', count: nc, escorted: mode === 'escorted',
        srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.snob, ws, us),
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
  const reserveEligible = p => {
    if ((p.v.popUsed || 0) < RESERVE_MIN_POP) return false;
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
  const offBlocked = p => escortReserved.has(p) || snobReserved.has(p);
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
          && okOffDist(p, T.c) && okOffTime(p, T)).sort(byDist(T));
        let got = 0;
        for (const p of cands) {
          if (got >= want) break;
          p.usedOff = true; got++; placed++; noteOffUsed(p.v.player);
          const d = distXY(p.c, T.c);
          T.offRows.push({ type: tier, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
            dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us) });
        }
        if (got < want) {
          placed += want - got; // reserve the shortfall so the auto pass won't backfill it
          const owned = pool.filter(p => p.v.player === a.name && p.tier === tier);
          const inRange = owned.filter(p => okOffDist(p, T.c));
          planWarnings.push(
            owned.length && !inRange.length ? t('warn_off_range')(decode(a.name), t('tier_' + tier), T.tg.coord)
            : inRange.length && !inRange.some(p => okOffTime(p, T)) ? t('warn_off_too_late')(t('tier_' + tier), T.tg.coord)
            : t('warn_sender_short_off')(decode(a.name), t('tier_' + tier), T.tg.coord));
          for (let z = 0; z < want - got; z++) T.offRows.push({ type: tier, unassigned: true });
        }
      }
      namedOffReserved[T.i + '|' + tier] = placed;
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
      const cands = pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier !== 'none' && okOffDist(p, T.c) && okOffTime(p, T))
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
      p.usedOff = true; powSum[T.i] += p.v.offPow; noteOffUsed(p.v.player);
      const d = distXY(p.c, T.c);
      T.offRows.push({ type: p.tier, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us) });
    }
  }

  // A conquered target coordinates its timings best when at least one of its offs comes
  // from the SAME hand that sends the noble. We bias (never force) one auto off toward any
  // of that target's noble senders — using their non-reserved villages (their closest are
  // held for the noble launch). Escort mode already rides an off with the noble, so escorted
  // targets are absent from conquerorByTarget. conquerorOffPlaced is seeded from offs placed
  // by the named + POWER passes, so we don't double up.
  const conquerorOffPlaced = {};
  for (const T of targets) {
    const conq = conquerorByTarget[T.i];
    if (conq && T.offRows.some(r => !r.unassigned && r.srcPlayer && conq.has(r.srcPlayer)))
      conquerorOffPlaced[T.i] = true;
  }

  // Offs: strongest requests claim villages first (complete → 3/4 → 1/2);
  // an exhausted tier auto-bumps to the nearest stronger off (1/2 → 3/4 → Complete)
  // and the row is relabeled to what is actually sent, with a warning. Slots already
  // reserved by named senders above are subtracted so each tier isn't double-filled.
  const TIER_UP = { half: ['tq', 'complete'], tq: ['complete'], complete: [] };
  for (const tier of ['complete', 'tq', 'half']) {
    for (const T of targets) {
      if (!T.c || T.tg.power) continue; // POWER targets are filled by the balanced pass above
      const autoNeed = Math.max(0, (T.tg[TIER_FIELD[tier]] || 0) - (namedOffReserved[T.i + '|' + tier] || 0));
      for (let k = 0; k < autoNeed; k++) {
        const tierCands = tt => pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier === tt && okOffDist(p, T.c) && okOffTime(p, T));
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
        // Until one off from this target's conqueror is placed, prefer the conqueror's
        // own villages among THIS slot's feasible candidates (a reorder of cands — never
        // widens the eligible set, so range/time/tier still hold). Closest of theirs.
        const conq = conquerorByTarget[T.i];
        let p;
        if (conq && !conquerorOffPlaced[T.i]) {
          const own = cands.filter(c => conq.has(decode(c.v.player))).sort(byDist(T));
          if (own.length) p = own[0];
        }
        if (!p) p = cands.sort(byOptimize(T))[0];
        if (conq && conq.has(decode(p.v.player))) conquerorOffPlaced[T.i] = true;
        p.usedOff = true; noteOffUsed(p.v.player);
        const d = distXY(p.c, T.c);
        T.offRows.push({
          type: sent, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
          dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us),
        });
      }
    }
  }

  // Windows: offs land strongest-first (complete → 3/4 → 1/2) across the
  // target's off windows — each window takes its #offs, unset counts share the
  // remainder. Snob trains land in the snob window, independent of the offs.
  for (const T of targets) {
    if (!T.c) continue;
    T.offRows.sort((a, b) => TIER_RANK[b.type] - TIER_RANK[a.type]);
    const wins = T.tg.offWindows.length ? T.tg.offWindows : [{ win: '', count: 0 }];
    const counts = windowOffCounts(wins, T.offRows.length);
    let wi = 0, slot = 0;
    for (const r of T.offRows) {
      while (wi < wins.length - 1 && slot >= counts[wi]) { wi++; slot = 0; }
      r.window = wins[wi].win || T.tg.winSnob || '';
      slot++;
    }
    T.snobRows.forEach(r => { r.window = T.tg.winSnob || (wins[wins.length - 1].win || ''); });
    [...T.offRows, ...T.snobRows].forEach(r => {
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
    if (r.unassigned || r.type === 'snob') continue;
    const pw = parseWindowStr(r.window);
    const landMs = pw ? serverWallMs(otCfg.dateISO, pw.to) : null;
    if (landMs !== null && landMs - r.travel * 60000 < serverNowMs()) {
      r.late = true;
      planWarnings.push(t('warn_row_late')(r.srcCoord, r.tCoord));
    }
  }

  saveOffensive();
  renderPlanTable();
}

function delPlanRow(i) { planRows.splice(i, 1); saveOffensive(); renderPlanTable(); }

// Wipe the generated offensive plan (mirrors clearOffTargets). Confirms only when there's
// a plan to lose; resets the same state generatePlan() rebuilds, then re-renders empty.
function clearPlan() {
  if (planRows.length && !confirm(t('confirm_clear_plan'))) return;
  planRows = []; planWarnings = []; planReserved = [];
  saveOffensive(); renderPlanTable();
}

function renderPlanTable() {
  // Warnings can be many; render them collapsed (count in the summary) so they
  // don't bury the plan table. Native <details> — no JS, works under file://.
  document.getElementById('plan-warnings').innerHTML = planWarnings.length
    ? `<details class="warn-box"><summary>${t('plan_warnings_toggle')(planWarnings.length)}</summary>`
      + `<div class="warn-list">${planWarnings.map(esc).join('<br>')}</div></details>` : '';
  const assigned = planRows.filter(r => !r.unassigned).length;
  document.getElementById('plan-summary').textContent =
    planRows.length ? t('plan_summary')(assigned, planRows.length - assigned) : '';

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
      : `<span class="badge badge-${r.type === 'complete' ? 'complete' : r.type === 'tq' ? 'tq' : 'half'}">${t('tier_' + r.type)}</span>`;
    const trStyle = [
      first && i > 0 ? 'border-top:2px solid #7a5c10' : '',
      r.unassigned ? 'background:rgba(192,64,32,0.08)' : '',
    ].filter(Boolean).join(';');
    // Snob trains never carry a displayed origin (the player prepares the train from
    // a village of their own choosing) — so they show a "Prepare Snob Train" label and
    // no distance/travel/launch/rally/morale, only the arrival window. Offs show timing
    // when assigned. (needNobles is snob-only, so the off path is just assigned/not.)
    const isSnob = r.type === 'snob';
    const showTiming = !isSnob && !r.unassigned;
    return `
    <tr${trStyle ? ` style="${trStyle}"` : ''}>
      <td style="color:#806030;">${first ? r.tIdx : ''}</td>
      <td class="left" style="font-family:monospace;">${first ? esc(r.tCoord) : ''}</td>
      <td class="left">${first && r.tPlayer ? `<span class="player-tag">${esc(r.tPlayer)}</span>` : ''}</td>
      <td>${badge}</td>
      <td class="left" style="font-family:monospace;">${
        isSnob
          ? `<span style="color:#e0a020;font-weight:600;">${esc(t('plan_prepare_snob')(r.escorted))}${r.needNobles ? ` ${t('snobs_need_recruiting')}` : ''}</span>`
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
      <td>${(() => { const url = showTiming ? rallyUrl(r.srcCoord, r.tCoord) : null; return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">⚔</a>` : '—'; })()}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="delPlanRow(${i})">✕</button></td>
    </tr>`;
  }).join('');
}

// ── BB icon helper (shared by both export functions) ──
function planRowIconBB(r) {
  if (r.type === 'snob') return r.escorted ? '[unit]axe[/unit][unit]snob[/unit]' : '[unit]snob[/unit]';
  return `[unit]${r.type === 'half' ? 'axe' : 'ram'}[/unit]`;
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
// A pinned-but-unplaced sender keeps their name (with a "needs nobles" note); a truly
// anonymous unassigned row falls back to the UNASSIGNED label. Snob trains never name an
// origin — just the "Prepare Snob Train" call-out (the target is the group header above).
function planRowForumBB(r, multiSnob) {
  const iconBB = planRowIconBB(r);
  const prefix = r.type === 'snob' && multiSnob ? `${r.count}x ` : '';
  const who    = r.srcPlayer
    ? `[player]${r.srcPlayer}[/player]${r.needNobles ? ` (${t('bb_need_nobles')})` : ''}`
    : t('bb_unassigned');
  const prep   = r.type === 'snob' ? ` ${t('plan_prepare_snob')(r.escorted)}` : '';
  return `${prefix}${iconBB} ${who}${prep} [b][color=#0000a5]${fmtWindow(r.window) || '??:??'}[/color][/b]`;
}

// ── Forum BB export (matches the tribe's offensive post format) ──
function showPlanBB() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }

  const nobleCounts = [...new Set(offTargets.map(x => x.nobles).filter(Boolean))].sort((a, b) => a - b);
  const noblesLabel = nobleCounts.length ? nobleCounts.join(' ó ') : '4';

  let bb = `[size=16][b][u]${t('bb_arrival_date')}:[/u][/b] ${bbDateLabel()}[/size]\n\n`;
  bb += `[unit]ram[/unit] --> ${t('bb_legend_ram')}\n`;
  if (planRows.some(r => r.type === 'half')) bb += `[unit]axe[/unit] --> ${t('bb_legend_axe')}\n`;
  if (planRows.some(r => r.type === 'snob' && !r.escorted)) bb += `[unit]snob[/unit] --> ${t('bb_legend_snob')(noblesLabel)}\n`;
  if (planRows.some(r => r.type === 'snob' && r.escorted)) bb += `[unit]axe[/unit][unit]snob[/unit] --> ${t('bb_legend_split')(noblesLabel)}\n`;
  bb += '\n';

  const groups = planGroups();
  groups.forEach((g, gi) => {
    bb += `${gi + 1}. ${g.coord}${g.player ? ` - [player]${g.player}[/player]` : ''}\n`;
    const multiSnob = g.rows.filter(x => x.type === 'snob').length > 1;
    for (const r of g.rows) bb += planRowForumBB(r, multiSnob) + '\n';
    bb += '\n';
  });

  document.getElementById('bb-output').value = bb.trimEnd() + '\n';
  document.getElementById('bb-modal').classList.add('open');
}

// ── Per-player BB export ──
function showPlayerPlanBB() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }

  const nobleCounts = [...new Set(offTargets.map(x => x.nobles).filter(Boolean))].sort((a, b) => a - b);
  const noblesLabel = nobleCounts.length ? nobleCounts.join(' ó ') : '4';

  // Rows with a sender (incl. pinned-but-unplaced "needs nobles") group under that
  // player; only truly anonymous unassigned rows go to the bottom section.
  const named      = planRows.filter(r => r.srcPlayer);
  const unassigned = planRows.filter(r => !r.srcPlayer);

  const byPlayer = {};
  for (const r of named) {
    if (!byPlayer[r.srcPlayer]) byPlayer[r.srcPlayer] = [];
    byPlayer[r.srcPlayer].push(r);
  }
  const names = Object.keys(byPlayer).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const allGroups = planGroups(); // for the per-player "objective context" dump below

  let bb = '';
  for (const name of names) {
    const rows = byPlayer[name];
    bb += `========== ${name} (${rows.length}) ==========\n`;
    bb += `[b][u]${t('bb_arrival_date')}:[/u][/b] ${bbDateLabel()}\n\n`;
    for (const r of rows) {
      const iconBB   = planRowIconBB(r);
      const prefix   = r.type === 'snob' && r.count > 1 ? `${r.count}x ` : '';
      const defender = r.tPlayer ? ` ([player]${r.tPlayer}[/player])` : '';

      if (r.type === 'snob') {
        // Snob trains never name an origin village: just a "Prepare Snob Train for
        // <target>" call-out (the player picks their own send village). No "src →",
        // no rally URL — so the attack-planner import correctly skips these lines.
        const prep = t('plan_prepare_snob')(r.escorted, `[coord]${r.tCoord}[/coord]`);
        if (r.needNobles) { // pinned sender with no noble yet → recruit first; still show the arrival window
          const win = (fmtWindow(r.window) || '??:??').replace('/', '-');
          bb += `${prefix}${iconBB} [b][color=#ff0e0e]${t('snobs_need_recruiting')}[/color][/b] ${prep} [b][color=#2e2eff]${win}[/color][/b]\n`;
        } else {
          const win = (fmtWindow(r.window) || '??:??').replace('/', '-');
          bb += `${prefix}${iconBB} ${prep}${defender} [b][color=#2e2eff]${win}[/color][/b]\n`;
        }
        continue;
      }

      // ── Offs (always assigned in this per-player section; unassigned offs have no
      //    sender and fall to the UNASSIGNED block below) ──
      const url     = rallyUrl(r.srcCoord, r.tCoord);
      const urlPart = url ? ` — [url=${url}]${t('bb_pp_attack_url')}▶[/url]` : '';
      const win     = (fmtWindow(r.window) || '??:??').replace('/', '-');
      const lp      = launchWindowParts(r.window, r.travel);
      // Line 1 = village → target + arrival window; line 2 = the red launch-time call-out
      // (carries the rally link). [b] opens on line 1 and closes after the launch line.
      const launch  = lp
        ? `\n${t('bb_pp_launchline')(lp.day, `[color=#ff0e0e]${lp.span}[/color]`, lp.single)}${urlPart}[/b]`
        : `${urlPart}[/b]`;
      bb += `${prefix}${iconBB} ${r.srcCoord} → [coord]${r.tCoord}[/coord]${defender} [b][color=#2e2eff]${win}[/color]${launch}\n`;
    }

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
  }

  if (unassigned.length) {
    bb += `========== ${t('bb_unassigned')} ==========\n`;
    for (const r of unassigned) {
      const label = r.type === 'snob' ? t('type_snob') : t('tier_' + r.type);
      bb += `${label} → ${r.tCoord}\n`;
    }
    bb += '\n';
  }

  document.getElementById('bb-output').value = bb.trimEnd() + '\n';
  document.getElementById('bb-modal').classList.add('open');
}

// ── Unused offs BB table: every offensive village NOT committed by the current plan ──
// "Committed" = sent as an off, used as a split-off escort, or held in reserve for a
// pending split-off (needNobles recruitCoord). A SOLO snob train leaves the village's
// off free, so it does NOT count as used. Sorted by off power, strongest first.
function planUsedOffCoords() {
  const used = new Set();
  for (const r of planRows) {
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
