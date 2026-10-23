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
// The arrival DATE a plan row lands on. Since v5.9 the row carries it (stamped from its window
// group at generation time); rows restored from a pre-v5.9 save have none, and fall back to the
// first group's date — which is exactly the single global date those saves were built with.
function planRowDateISO(r) {
  if (r && r.dateISO) return r.dateISO;
  if (r && r.group != null && otGroupIndex(r.group) >= 0) return otGroupById(r.group).dateISO || '';
  return otGroups()[0].dateISO || '';
}

// ── Server time (local clock → epoch → server UTC offset) ──
function serverNowMs() { return Date.now(); } // separate so tests can freeze the clock
// Epoch ms of the server-local wall time `minutes` after midnight of dateISO
function serverWallMs(dateISO, minutes) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return serverWallToMs(Date.UTC(+m[1], +m[2] - 1, +m[3]) + minutes * 60000); // offset at that moment (DST-aware when automatic)
}
// A landing window that wraps past midnight ('23:30/00:30') STARTS on its arrival date and ENDS
// on the next day, so its end minute counts from that date's midnight + 1440. The one place the
// gates read a window's end (launch feasibility, the late flag, the Manage verdicts) — the
// display (launchWindowStr / planRowAbsTimes) and the schedules (psLaunchRange) wrap the same way.
function windowEndMin(w) { return w ? w.to + (w.to < w.f ? 1440 : 0) : null; }
// Epoch ms of that end on the server clock (null without a valid date / window).
function windowEndMs(dateISO, w) { return w ? serverWallMs(dateISO, windowEndMin(w)) : null; }
// True when minute `min` of dateISO does not exist on the server clock: the hour a spring DST
// switch skips (02:00–02:59 when the clocks jump to 03:00, automatic offset only). serverWallMs
// reads such a time an hour late, onto the same instant as 03:xx.
function serverWallSkipped(dateISO, min) {
  if (!(min >= 0 && min < 1440)) return false;
  const ms = serverWallMs(dateISO, min);
  if (ms === null) return false;
  const p = n => String(n).padStart(2, '0');
  return fmtServerDT(ms).slice(0, 16) !== `${dateISO} ${p(Math.floor(min / 60))}:${p(min % 60)}`;
}
// Epoch ms of a landing window's START — the one reading for the display (launch times,
// planRowAbsTimes), the engine (the ⚔ ratio launch moment, the ⏰ schedule trim and psLaunchRange)
// and Manage Offensive (moTimingVerdict). A start inside the skipped spring hour starts at the
// first valid instant after it — the switch itself, 03:00 — instead of serverWallMs's hour-late
// reading (which collapsed '02:48/03:48' onto 03:48 and showed a reversed launch span). Every
// other start is serverWallMs's; generatePlan warns about such a window (warn_window_skipped).
function windowStartMs(dateISO, w) {
  const ms = w ? serverWallMs(dateISO, w.f) : null;
  if (ms === null || !serverWallSkipped(dateISO, w.f)) return ms;
  let lo = ms - 3 * 3600000, hi = ms; // the offset changes somewhere in between: find the minute it does
  const offLo = serverUtcOffset(lo);
  if (offLo === serverUtcOffset(hi)) return ms;
  while (hi - lo > 60000) {
    const mid = lo + Math.floor((hi - lo) / 120000) * 60000;
    if (serverUtcOffset(mid) === offLo) lo = mid; else hi = mid;
  }
  return hi;
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
  const now = serverNowMs();
  const d = new Date(now + serverUtcOffset(now) * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
function updateServerNow() {
  const sp = document.getElementById('server-now');
  if (sp) sp.textContent = t('server_now')(serverNowStr());
}

// Launch window = landing window minus travel time (wraps past midnight). `dateISO` is the
// arrival date the window sits on — the row's own window group's since v5.9; omitted, it falls
// back to the first group's, which is the only date a single-wave plan has.
// With a date, the edges are server-clock INSTANTS (arrival instant − travel), so a travel that
// crosses a DST switch shifts the launch by that hour exactly as the gates (serverWallMs /
// windowEndMs) see it, and the −Nd count + launch day are the server calendar's. The edges round
// TOWARD the window — start up, end down to the minute — so a launch at either shown edge still
// lands inside it; a single exact-time window (f === to) shows its nearest minute. Without a
// date: the same arithmetic on wall minutes, and no launch day.
// Returns { span, single, days, launchISO } (launchISO null without a date) or null.
function launchWindowCalc(winStr, travelMin, dateISO) {
  const w = parseWindowStr(winStr);
  if (!w) return null;
  const single = w.f === w.to;
  const trSec = Math.round((travelMin || 0) * 60); // the game's travel times are whole seconds (also drops float noise)
  const iso = String(dateISO === undefined ? (otGroups()[0].dateISO || '') : (dateISO || ''));
  const arrMs = windowStartMs(iso, w);
  if (arrMs === null) {
    const p = n => String(n).padStart(2, '0');
    const fm = m => { const x = ((m % 1440) + 1440 * 100) % 1440; return `${p(Math.floor(x / 60))}:${p(x % 60)}`; };
    const f = single ? w.f - Math.round(travelMin || 0) : Math.ceil((w.f * 60 - trSec) / 60);
    const span = single ? fm(f) : `${fm(f)}–${fm(Math.floor((w.to * 60 - trSec) / 60))}`;
    return { span, single, days: f < 0 ? Math.ceil(-f / 1440) : 0, launchISO: null };
  }
  const startMs = launchStartMs(arrMs, w, travelMin), S = fmtServerDT(startMs);
  // the end never precedes the start (a window squeezed by the skipped spring hour)
  const span = single ? S.slice(11, 16)
    : `${S.slice(11, 16)}–${fmtServerDT(Math.max(startMs, Math.floor((windowEndMs(iso, w) - trSec * 1000) / 60000) * 60000)).slice(11, 16)}`;
  const day = x => Date.parse(`${x}T00:00:00Z`);
  return { span, single, days: Math.round((day(iso) - day(S.slice(0, 10))) / 86400000), launchISO: S.slice(0, 10) };
}
// Epoch ms of the launch for a window START that lands at `arrMs`: rounded UP to the minute (into
// the window), or to the nearest minute for a single exact time. Shared by launchWindowCalc and
// planRowAbsTimes so the plan table, the BB and the Per-Player Table agree.
function launchStartMs(arrMs, w, travelMin) {
  return w.f === w.to ? arrMs - Math.round(travelMin || 0) * 60000
    : Math.ceil((arrMs - Math.round((travelMin || 0) * 60) * 1000) / 60000) * 60000;
}
function launchWindowStr(winStr, travelMin, dateISO) {
  const c = launchWindowCalc(winStr, travelMin, dateISO);
  if (!c) return '—';
  if (!c.days) return c.span;
  // with an arrival date set, name the actual launch day next to the −Nd marker
  return `${c.span} (−${c.days}d${c.launchISO ? ` · ${c.launchISO}` : ''})`;
}

// Same launch-window math as launchWindowStr, but returns the parts the per-player BB needs
// separately: the time span and the launch day-of-month (null when no arrival date is set).
function launchWindowParts(winStr, travelMin, dateISO) {
  const c = launchWindowCalc(winStr, travelMin, dateISO);
  return c ? { span: c.span, single: c.single, day: c.launchISO ? +c.launchISO.slice(8, 10) : null } : null;
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

// Account sitting (v6.3.1): a source village of the SITTED player of an mvPairs pair
// ([main, sitted]) gets that account's id as t=, so the main player opens the link on the
// sitted account — without it the game opens it as their own. The id is the world DB's owner
// of the village, used only when that owner IS the sitted player and the troop file doesn't
// name someone else there (a stale DB never hands out another player's id). Names line up
// through decodeName, as in detectMyTribe. '' = a plain link.
function sittedAccountId(srcCoord, sv) {
  if (typeof mvPairs === 'undefined' || !mvPairs.length || !sv) return '';
  const id = String(sv.playerId || '');
  if (!/^[1-9]\d*$/.test(id)) return '';
  const owner = String(playerDb[id] || '').toLowerCase().trim();
  if (!owner) return '';
  const norm = s => decodeName(s).toLowerCase().trim();
  const tv = (typeof troopByCoord !== 'undefined') ? troopByCoord[srcCoord] : null;
  if (tv && norm(tv.player) !== owner) return '';
  return mvPairs.some(p => Array.isArray(p) && p[1] && norm(p[1]) === owner) ? id : '';
}

function rallyUrl(srcCoord, tgtCoord, units) {
  const sv = coordDb[srcCoord];
  const tv = coordDb[tgtCoord];
  if (!sv || !tv || !otCfg.serverUrl) return null;
  const host = otCfg.serverUrl.replace(/^https?:\/\//, '');
  const sit = sittedAccountId(srcCoord, sv); // first, as in the game's own links
  let url = `https://${host}/game.php?${sit ? `t=${sit}&` : ''}village=${sv.id}&screen=place&target=${tv.id}`;
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
  // Min. Morale (%) for ANY clearing off — auto pass AND POWER pass (v5.11.0) — default 100,
  // so the engine only sends offs at full morale and falls back to the best below-threshold
  // sender only when no qualifying village can reach the target (soft gate, mirrors the
  // snob-off gate).
  // A noble sender's OWN coordination off is exempt: it's governed by minMorale (the snob-off
  // gate) and reserved before the auto pass runs, so this gate never re-touches it. 0 disables.
  const minMoraleOffRaw = parseFloat((document.getElementById('plan-min-morale-off') || {}).value);
  const minMoraleOff = (isNaN(minMoraleOffRaw) ? 100 : minMoraleOffRaw) / 100;

  // ── Morale strategy (v5.13.0, 🎭 Morale strategy panel) ─────────────────────
  // How the finite pool of HIGH-morale offs is shared between targets:
  //  'priority' — legacy: targets are filled in list order, each pick preferring senders that
  //               clear the off gate; once the high-morale offs are used up, later targets get
  //               whatever is left (100/100/… then 30/40/…).
  //  'balanced' — every off slot goes to the target whose already-assigned offs have the LOWEST
  //               average morale, so the high-morale offs are spread over all targets instead of
  //               exhausted on the first ones (each target ends up hit by a comparable mix).
  //  'points'   — targets of at least `moralePts` village points are filled FIRST, BALANCED among
  //               themselves (lowest average morale first, like 'balanced'), so the high-morale
  //               offs are shared evenly across the big targets; the smaller targets follow, again
  //               balanced among themselves, taking the best morale the optimizer can still find.
  //               The gates are the same everywhere — this mode only changes the ORDER.
  const moraleModeRaw = (document.getElementById('plan-morale-mode') || {}).value;
  //  'distance'  — (v6.1.1) like 'priority' but the targets are served NEAREST to the tribe's off
  //               villages first (distance from the pool's off centroid), list order breaks ties.
  const moraleMode = MORALE_MODES.includes(moraleModeRaw) ? moraleModeRaw : 'priority';
  const moralePtsRaw = parseFloat((document.getElementById('plan-morale-pts') || {}).value);
  const moralePts = isNaN(moralePtsRaw) ? 5000 : Math.max(0, moralePtsRaw);

  // ── Launch-distance clustering (opt-in, LOWEST priority) ────────────────────
  // When on, the off passes add a soft tiebreaker that keeps each player's off distances tight
  // (fewer, closer launch bursts + a lower max distance → offs return sooner → faster tribe
  // re-attack). It NEVER overrides morale/power: it only ever swaps among candidates within
  // `clusterTol` fields of the primary (morale×power)-optimal pick, so a genuinely closer or
  // stronger village is never traded away just to cluster. clusterTol default 10 fields (a
  // "15↔20 yes, 15↔40 no" tolerance). Inert unless the checkbox is on. See pickClustered below.
  const clusterMode   = !!(document.getElementById('plan-cluster') || {}).checked;
  const clusterTolRaw = parseFloat((document.getElementById('plan-cluster-tol') || {}).value);
  const clusterTol    = isNaN(clusterTolRaw) ? 10 : Math.max(0, clusterTolRaw);

  // "Don't reserve villages" (v5.12.2): skip the noble-sender launch-village holdback
  // (snobReserved stays empty) — every off in range is sent, and noble senders are trusted
  // to keep a token escort at home for their solo trains. Escort (split-off) reservations
  // are NOT affected: an escorted train's off really rides with the noble, so that hold stays.
  const noReserve = !!(document.getElementById('plan-no-reserve') || {}).checked;
  // "Assign 1 off to snob sender" (v5.13.0): every noble sender keeps one of their OWN clearing
  // offs regardless of morale — the snob-off gate is forced to 0 for every target (equivalent to
  // Min. morale (snob off) = 0, but explicit).
  const snobOwnOff = !!(document.getElementById('plan-snob-own-off') || {}).checked;

  // Ignore lists (Offensive Targets). Ignored COORDINATES are dropped from the pool entirely
  // (those villages never send anything). Ignored PLAYERS stay IN the pool but are barred from
  // every regular-OFF pass (folded into offBlocked below) — they may still be hand-picked as
  // noble (snob) senders, sending the train + its escort, just never a regular clearing off.
  const ignoreCoords  = parseOffIgnoreSet();
  const ignorePlayers = new Set(offIgnorePlayers);
  // Force Players (v5.12.2) / Force Coords (v5.12.3): a non-empty whitelist drops everything
  // outside it from the pool entirely (like ignored coords) — no pass (offs, snobs, escorts,
  // fakes) ever sees it, and a pinned sender outside a list simply finds no candidates
  // (warned as usual). A village must pass BOTH lists (owner forced AND coord forced).
  const forcePlayers  = new Set(offForcePlayers);
  const forceCoords   = parseOffForceSet();
  const inForce = v => (!forcePlayers.size || forcePlayers.has(v.player))
    && (!forceCoords.size || forceCoords.has(v.coord));
  // Sender region = typed X|Y filters AND (if drawn) the map polygon. Both empty → every
  // village is eligible. See passesCoordFilters (typed) + passesCoordPolygon (drawn, honours
  // "Select Reverse" inversion), both pure world-space.
  // 💾 Other offensive plan slots (v6.1.0): what they already committed starts this pool as spent
  // — an off sent there stays sent (usedOff + `prior`, planUsedOffCoords; a 1-ram fake does NOT
  // spend the off, it only counts against fakesPerVillage via fakesSent), its nobles are gone (snobLeft), its launch reservations stay held
  // (priorReserved → offBlocked, escort pick, escorted-train pick, launch reservation, fairness)
  // and its catapults come off the def budget (catPool below). A village whose off went in another
  // offensive keeps its remaining nobles, so it may still send a SOLO train here (exactly as a
  // village already used in THIS plan may). `prior` villages never fake here either: their off left
  // in the other offensive, they're not a cheap decoy source. Time plays no part: a village spent
  // on Friday stays spent for an offensive planned a week later (by design — the user frees it by
  // deleting or regenerating the earlier offensive).
  const prior = offPlanPriorUsage();
  const priorReserved = prior.reserved;
  // ↩ Returning Offs (v6.2.0) — two Plan Offensive toggles, both ON in the HTML (a headless run
  // reads them OFF = exactly the pre-6.2.0 engine), independent of each other:
  //  • Exclude ALL Outbound Offs (exclOutbound): a village whose off is AWAY is held out of every
  //    off pass — `heldOut` (usedOff from the start, like a `prior` off, but its own footer bucket).
  //    Away = the Outbound Offs tab flags it (station data: owned − home − returning), OR Returning
  //    Offs has a qualifying attack from it still in flight (planOutboundCoords), OR its off is
  //    still on the way home (roReturning — station data never flags that: it subtracts the
  //    returning troops).
  //  • Include ALL Returning Offs in window (inclReturning): a village whose ONLY qualifying
  //    commands are return rows gets a per-village send floor = its home time (`floorMs`, from
  //    roHomeFloorMs) — it stays in the pool, or is RE-ADMITTED when toggle 1 would hold it, but an
  //    off / fake / split-off from it may only launch once it is home (floorFor → okOffTime,
  //    okEscortTime, the schedule trim and the late flag). An attack still in flight is never
  //    re-admitted: its survivors are unknown until the hit.
  // Toggle 1 off + toggle 2 on = the floor only; toggle 1 on + toggle 2 off = every away village held,
  // returning ones included. Nobles stay home: snob trains ignore heldOut and keep the global floor.
  // The catapult pool (defensive villages) is untouched.
  // The toggles are read by planAwayState (returning-offs.js) — the SAME call the Offensive Targets
  // footer makes (v6.3.0), so its "away" count and this plan's heldOut can't drift apart.
  const roNowMs = serverNowMs();
  const awayOf = typeof planAwayState === 'function' ? planAwayState(roNowMs) : () => ({ floorMs: null, away: false, heldOut: false });
  const pool = villages.map(v => {
    const { floorMs, away, heldOut } = awayOf(v.coord);
    return {
      v, c: parseCoordStr(v.coord), tier: getOffTier(v.offPow),
      snobLeft: Math.max(0, (v.snob || 0) - (prior.nobles[v.coord] || 0)),
      usedOff: prior.offCoords.has(v.coord) || heldOut, prior: prior.offCoords.has(v.coord), usedSnob: false,
      heldOut, readmitted: away && !heldOut, floorMs,
      fakesSent: prior.fakes[v.coord] || 0, // fakes the other offensives already send from it (fakesPerVillage spans them)
    };
  }).filter(p => p.c && !ignoreCoords.has(p.v.coord) && inForce(p.v)
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
  // ── Block Pairs (v5.17) ──────────────────────────────────────────────────
  // [rawOwnPlayer, defenderName]: that player never attacks that defender — no off, escort, noble
  // train, fake or catapult attack. Unconditional (unlike MV, which is a claim between partners),
  // so it is folded into mvBlocked (every pass already asks it) and asked separately where a
  // pinned sender needs its own warning. Same namespaces as MV: raw sender, display defender.
  const blockDefs = new Map(); // raw player -> Set of defender names they never attack
  for (const pair of (typeof blockPairs !== 'undefined' ? blockPairs : [])) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair[0] || !pair[1]) continue;
    let s = blockDefs.get(pair[0]); if (!s) blockDefs.set(pair[0], s = new Set()); s.add(pair[1]);
  }
  const pairBlocked = (rawName, T) => { const s = blockDefs.get(rawName); const def = mvDef(T); return !!(s && def && s.has(def)); };
  const mvBlocked = (p, T) => {
    if (pairBlocked(p.v.player, T)) return true;
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
  for (const p of pool) if (p.tier !== 'none' && !p.prior && !p.heldOut && !priorReserved.has(p.v.coord)) offCapacity[p.v.player] = (offCapacity[p.v.player] || 0) + 1;
  const offUsedByPlayer = {};
  const noteOffUsed = name => {
    offUsedByPlayer[name] = (offUsedByPlayer[name] || 0) + 1;
    const k = shareKey.get(name); if (k !== undefined) shareUsed.set(k, (shareUsed.get(k) || 0) + 1); // ⚖ per decoded name
  };
  // ⚖ Player Share (v6.3.0): shareKey = raw name → decoded name, only for players below 100%;
  // shareCap / shareBase / shareUsed are keyed by that DECODED name. Filled after the reservations
  // (see the ⚖ block below the launch-village reservation); declared here for noteOffUsed / remOffFrac.
  const shareKey = new Map(), shareCap = new Map(), shareBase = new Map(), shareUsed = new Map();

  planRows = []; planWarnings = []; planReserved = [];
  planStats = emptyPlanStats();

  const targets = offTargets.map((tg, i) => ({ tg, i, c: parseCoordStr(tg.coord), offRows: [], snobRows: [], catRows: [] }));
  targets.filter(T => !T.c).forEach(T => planWarnings.push(t('warn_invalid_coord')(T.tg.coord)));

  // ── Target types (explicit per row since v4.17.0, set at add time / mass edit) ──
  // FAKE targets consume nothing real: they're excluded from every off/snob/catapult pass and
  // filled by their own pass (1-ram rows REUSING villages already sending a real off — see the
  // fake pass after the auto offs). DESTROYER only changes off SELECTION (prefer cat-carriers,
  // see destroyerPick + 🎚 destroyerRank / destroyerFallback) — the old implicit "no nobles + cats
  // on" heuristic is gone.
  const isFake      = T => T.tg.type === 'fake';
  const isDestroyer = T => T.tg.type === 'destroyer';
  // A destroyer is for flattening, not conquering — snob trains assigned to one are almost
  // certainly a configuration slip. Warn, but still plan the nobles as configured.
  for (const T of targets) {
    if (T.c && isDestroyer(T) && otSnobGroups(T.tg).some(g => targetTrainSpec(T.tg, g.id).length))
      planWarnings.push(t('warn_destroyer_snobs')(T.tg.coord));
  }

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

  // ── Enemy Tribes proximity bar (v5.10.0) — a SECOND, independent holdback ──────────────
  // minDist above measures against this plan's own objectives; this one measures against the
  // enemy's whole territory, so "hold everything within 20 of a target AND everything within 10
  // of tribe X" is one plan, not two runs. A village barred by either is held. Same shape as
  // tooClose (holds offs + escorts, snob trains exempt — a noble launch is governed by
  // okSnobDist/snobMax, and nobles usually have to come from close by, front line or not).
  // Selection + radius live on the Offensive Targets tab (offensive-targets.js) and are
  // deliberately independent of the Plan-Defense Enemy Tribes filter. Needs the world DB to
  // locate hostile villages.
  //
  // The barred set comes from offEnemyExcludedCoords() (offensive-targets.js) — the SAME call
  // the Offensive Targets footer makes, so the "N held by enemy tribes" it shows and the offs
  // this plan actually holds back can never drift apart. It reads the radius DOM-first with the
  // persisted offEnemyDist as fallback, so a headless run (inputs read '') still filters.
  const enemyDist = offEnemyDistLive();
  const enemySet = parseOffEnemySet();
  if (enemySet.size) {
    // Fail loudly rather than silently planning as if the filter were on.
    if (enemyDist <= 0)          planWarnings.push(t('warn_off_enemy_no_dist'));
    else if (!villageDb.length)  planWarnings.push(t('warn_off_enemy_no_db'));
    else {
      const unresolved = [...enemySet].filter(id => !allyDb[id]);
      if (unresolved.length) planWarnings.push(t('warn_off_enemy_unresolved')(unresolved.join(', ')));
    }
  }
  const enemyExcl = offEnemyExcludedCoords();
  const nearEnemy = new Set(enemyExcl.size ? pool.filter(p => enemyExcl.has(p.v.coord)) : []);
  const okOffDist = (p, tc) => !tooClose.has(p) && !nearEnemy.has(p) && (maxDist <= 0 || distXY(p.c, tc) <= maxDist);
  // Nobles have a hard travel limit in the game (70 fields on es100)
  const snobMax = getSnobMax();
  const okSnobDist = (p, tc) => snobMax <= 0 || distXY(p.c, tc) <= snobMax;
  // Snob targets are mostly ASSIGNED to a player who then recruits the noble, so every snob
  // row lists that player's own villages within noble range of the objective that can plausibly
  // hold an Academy. When a buildings JSON is loaded that's a real Smithy ≥ PARAMS.snobSmithMin gate;
  // otherwise it's the legacy > PARAMS.snobRangeMinPoints heuristic (unknown → passes). snobCapable
  // (offensive-targets.js) encapsulates both. Closest first. rawName is the encoded pool key.
  const snobAcademyOk = p => snobCapable(p.v.coord);
  // Weaker smith gate for spots that never had a points heuristic (escort picks, the recruit-here
  // hint): a KNOWN Smithy below PARAMS.snobSmithMin disqualifies, unknown passes — so without a
  // buildings JSON these behave exactly as before (no new points gate sneaks in).
  const smithOkOrUnknown = p => { const lv = smithLevelAt(p.v.coord); return lv === null || lv >= PARAMS.snobSmithMin; };
  // Recommended launch villages for a needNobles / out-of-range snob row: the player's own
  // villages within noble range AND still launchable in time (okSnobTime — honours the Earliest
  // send floor / now), academy-plausible. Closest first. Time-gated so we never suggest recruiting
  // a noble somewhere the train couldn't leave early enough to arrive. okSnobTime is defined below
  // but this closure only runs during the snob loop, after it's initialised. `g` = the wave the
  // train lands in (its snob window + date gate the launch).
  const snobRangeVills = (rawName, T, g) =>
    (!rawName || !T || !T.c) ? []
      : pool.filter(p => p.v.player === rawName && okSnobDist(p, T.c) && okSnobTime(p, T, g) && snobAcademyOk(p))
            .sort((a, b) => distXY(a.c, T.c) - distXY(b.c, T.c))
            .map(p => p.v.coord);

  // Launch feasibility: with an arrival date set, a village whose travel time
  // pushes the launch before the current server time can never make it.
  // Vetted against the target's LATEST possible landing minute; the assigned
  // window may still be earlier — those rows get flagged late after assignment.
  // Each window group is an independent wave with its own arrival DATE and landing window, so
  // "can this village still launch in time?" is answered per (target, group), not per target.
  // T.gEnd[gid] = the latest landing minute for that group's off window; T.snobEnd[gid] the same
  // for its SNOB window — a target's noble trains land in whichever waves it nobles in (v5.16),
  // each gated by its own group's window and date.
  for (const T of targets) {
    if (!T.c) continue;
    T.gEnd = {}; T.snobEnd = {};
    for (const g of otActiveGroups(T.tg)) {
      const pw = parseWindowStr(g.winOff || g.winSnob || '');
      T.gEnd[g.id] = windowEndMin(pw); // a window wrapping past midnight ends the next day (+1440)
    }
    for (const g of otGroups()) {
      const sw = parseWindowStr(g.winSnob || g.winOff || '');
      T.snobEnd[g.id] = windowEndMin(sw);
    }
  }
  // Earliest send floor. A launch can never be scheduled before "now", nor (when the user set
  // an Earliest send time) before that time. The gate below vets each village's latest possible
  // launch (land − travel) against this floor: villages needing more travel than
  // (window END − floor) can't arrive in the window without launching too early → out of range.
  // Applies to offs AND snobs (okOffTime/okSnobTime share okTime). max(now, …) keeps a past
  // earliest-send from ever loosening reality.
  const esMs = earliestSendMs();
  // 🎚 departMargin: nothing can launch sooner than this many minutes from now.
  const nowFloorMs = serverNowMs() + PARAMS.departMargin * 60000;
  const sendFloorMs = esMs === null ? nowFloorMs : Math.max(nowFloorMs, esMs);
  // If the earliest-send is at/after a target's whole arrival window, nothing can reach it
  // (max travel = window end − floor ≤ 0) — flag it so the target doesn't just silently empty.
  if (esMs !== null) for (const T of targets) {
    if (!T.c) continue;
    for (const g of otActiveGroups(T.tg)) {
      const endMin = T.gEnd[g.id];
      if (endMin === null || endMin === undefined) continue;
      const landMs = serverWallMs(g.dateISO, endMin);
      if (landMs !== null && esMs >= landMs) planWarnings.push(t('warn_earliest_after_window')(T.tg.coord));
    }
  }
  // ↩ Per-village floor (v6.2.0): a returning off (pool `floorMs`, see the pool build) can't launch
  // before it is home, so its OFF gates use the later of the global floor and its home time. A
  // village without one — and every catapult-pool source, which carries no floorMs — keeps
  // sendFloorMs, so with both toggles off nothing changes.
  const floorFor = p => Math.max(sendFloorMs, (p && p.floorMs) || 0);
  // `dateISO` is the group's arrival date — with several groups the same window minute means a
  // different epoch in each, so it must travel with the gate rather than be read globally.
  const okTime = (p, T, endMin, baseMin, dateISO, floorMs) => {
    if (endMin === null || endMin === undefined) return true;
    const landMs = serverWallMs(dateISO, endMin);
    if (landMs === null) return true;
    return landMs - travelTimeMin(distXY(p.c, T.c), baseMin, ws, us) * 60000 >= floorMs;
  };
  const okOffTime  = (p, T, g) => okTime(p, T, T.gEnd[g.id], PLAN_BASE_MIN.off, g.dateISO, floorFor(p));
  // Nobles stay home while the off is away → a solo train keeps the global floor…
  const okSnobTime = (p, T, g) => okTime(p, T, T.snobEnd[g.id], PLAN_BASE_MIN.snob, g.dateISO, sendFloorMs);
  // …but a split-off ESCORT rides the village's off with the noble (snob pace, snob window), so the
  // off has to be home first: the escort reservation and escorted-train origins take the village floor.
  const okEscortTime = (p, T, g) => okTime(p, T, T.snobEnd[g.id], PLAN_BASE_MIN.snob, g.dateISO, floorFor(p));

  // ⚔ Attack ratio (v6.5.0, attack-ratio.js) — the world's newbie points limit: while the DEFENDER
  // is within ratioDays of registering, nobody with more than ratio × their points may attack them.
  // A hard gate on EVERY attack pick (offs, escorts, noble trains, fakes, catapults), judged at the
  // EARLIEST moment the sender could launch into the wave — the window start minus its travel, never
  // before its send floor. Conservative on purpose: a launch range that straddles the end of the
  // protection is barred, so the game never refuses a planned attack. Always the LAST clause of a
  // pick's filter, so ratioHits (target index → { players: raw names, end }) only lists senders that
  // were otherwise eligible — one warning per target after the passes. ratioCtx is null when the
  // world has no limit or no DB is loaded: every check is then false and the plan byte-identical.
  // kind: 'off' (off pace + window, village floor), 'snob' (noble pace + window, global floor),
  // 'escort' (a split-off: noble pace + window, the village's own floor — like okEscortTime).
  const ratioCtx = typeof arCtx === 'function' ? arCtx(serverNowMs()) : null;
  const ratioHits = new Map();
  const ratioLaunchMs = (p, T, g, kind) => {
    const floor = kind === 'snob' ? sendFloorMs : floorFor(p);
    if (!g) return floor;
    const pw = parseWindowStr(kind === 'off' ? (g.winOff || g.winSnob || '') : (g.winSnob || g.winOff || ''));
    const startMs = pw ? windowStartMs(g.dateISO, pw) : null; // the shown start (03:00 for one in the skipped spring hour)
    if (startMs === null) return floor;
    const tr = travelTimeMin(distXY(p.c, T.c), kind === 'off' ? PLAN_BASE_MIN.off : PLAN_BASE_MIN.snob, ws, us);
    return Math.max(floor, startMs - tr * 60000);
  };
  // Every recorded player IS barred from T (for that village's launch) — the diagnostic re-checks in
  // the warning branches may add one that was also share-capped: still a player who can't attack it.
  const ratioBlk = (p, T, g, kind) => {
    if (!ratioCtx || !p.c || !T.c) return false;
    const end = arBlockedAt(ratioCtx, p.v.coord, T.tg.coord, ratioLaunchMs(p, T, g, kind), p.v.player);
    if (!end) return false;
    let h = ratioHits.get(T.i); if (!h) ratioHits.set(T.i, h = { players: new Set(), end }); h.players.add(p.v.player);
    return true;
  };
  // A pinned sender barred outright: every village of theirs that could otherwise go is ratio-blocked.
  const ratioPin = (vills, T, g, kind) => !!ratioCtx && vills.length > 0 && vills.every(p => ratioBlk(p, T, g, kind));
  const ratioEnd = T => { const h = ratioHits.get(T.i); return h ? fmtServerDT(h.end).slice(0, 16) : ''; };

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
  // Min. Morale (off) soft gate, shared by the POWER pass and the regular auto pass (v5.11.0:
  // morale leads EVERYWHERE, POWER targets included): keep only the candidates whose per-player
  // morale on this target clears minMoraleOff (default 100%), falling back to the full set when
  // none qualify (a low-morale clear still beats an uncleared target). Inert when there is no
  // morale signal (no DB / barbarian target — moraleUsable) or the field is 0. A candidate whose
  // own morale can't be resolved counts as 1.0 so it's never gated out.
  // Per-target gates. Both are inert (0) without a morale signal; the snob-off gate is also
  // forced to 0 by the 👑 "Assign 1 off to snob sender" checkbox.
  const offGateFor  = T => moraleUsable(T) ? minMoraleOff : 0;
  const snobGateFor = T => (snobOwnOff || !moraleUsable(T)) ? 0 : minMorale;
  // Off-pass target order: 'points' mode serves the big targets (≥ moralePts village points, from
  // the world-DB record — not the owner's total) first so they get first pick of the high-morale
  // offs, list order kept within each band; 'distance' (v6.1.1) sorts nearest-to-the-off-pool first
  // (below); the other modes keep the list order ('balanced' then re-orders dynamically per slot —
  // see the auto pass).
  const targetPoints = T => { const v = coordDb[T.tg.coord]; return v ? (parseInt(v.points, 10) || 0) : 0; };
  const bigTarget = T => moraleMode !== 'points' || targetPoints(T) >= moralePts;
  // 'distance' (v6.1.1): nearest to the off pool's centroid first (stable; unparseable coords last).
  // The centroid is the centre of the AVAILABLE offs: ignored players and villages spent or held by
  // other offensives don't pull it (they can't send anything here).
  const poolCentroid = (() => {
    const offs = pool.filter(p => p.tier !== 'none' && !p.prior && !p.heldOut && !priorReserved.has(p.v.coord) && !ignorePlayers.has(p.v.player));
    return offs.length ? { x: offs.reduce((a, p) => a + p.c.x, 0) / offs.length, y: offs.reduce((a, p) => a + p.c.y, 0) / offs.length } : null;
  })();
  const centroidDist = T => (T.c && poolCentroid) ? distXY(poolCentroid, T.c) : Infinity;
  const orderedTargets = moraleMode === 'points'
    ? [...targets.filter(T => bigTarget(T)), ...targets.filter(T => !bigTarget(T))]
    : moraleMode === 'distance'
    ? targets.slice().sort((a, b) => centroidDist(a) - centroidDist(b))
    : targets;
  // Average morale of a target's assigned offs so far (rows from every pass); -1 = none yet, so
  // an untouched target is always served before one that already has an off ('balanced' mode).
  const targetAvgMorale = T => {
    const ms = T.offRows.filter(r => !r.unassigned && r.srcCoord)
      .map(r => { const m = planAttackMorale(r.srcCoord, T.tg.coord); return m == null ? 1 : m; });
    return ms.length ? ms.reduce((a, x) => a + x, 0) / ms.length : -1;
  };
  const moraleFirst = (T, cands) => {
    const gate = offGateFor(T);
    if (!gate) return cands;
    const hi = cands.filter(p => { const m = planAttackMorale(p.v.coord, T.tg.coord); return (m == null ? 1 : m) >= gate; });
    return hi.length ? hi : cands;
  };
  // ⏰ Player Schedules (v6.1.2, 🎚 scheduleMode): a soft tiering on top of every automatic pick.
  // Each candidate's LAUNCH range for the slot = the group's landing window shifted back by its
  // travel time (off pace for offs / fakes / catapults, noble pace for escorts and noble senders);
  // psLaunchTier (player-schedules.js) grades it 2 = a free launch moment inside the sender's
  // preferred time, 1 = neutral (no schedule, or outside both ranges), 0 = every launch moment
  // inside their blocked time. schedFirst keeps only the best grade present (like moraleFirst, it
  // never empties a set — the plan always fills), schedThen prefixes a comparator with the grade;
  // both grade each candidate ONCE per pick (memo — a sort asks n·log n times). Order inside a
  // pick: morale gate → destroyer strategy (the cat-off filter is never traded for a nicer launch)
  // → schedule → score. Both helpers are the identity while no player has a schedule or the mode
  // is 'off', so the defaults are byte-identical. Rows are graded again after the merge (⏰ flag +
  // warning) by their final window. Named off pins are never moved by this (only flagged); a
  // pinned noble / escort sender keeps the assignment while the schedule may pick WHICH of their
  // villages launches.
  const schedMode = PARAMS.scheduleMode;
  const schedActive = schedMode !== 'off' && typeof psAnySchedule === 'function' && psAnySchedule();
  const schedWin = (g, kind) => g ? parseWindowStr(kind === 'snob' ? (g.winSnob || g.winOff || '') : (g.winOff || g.winSnob || '')) : null;
  // Minutes at the START of a launch range that already lie behind the send floor (now / Earliest
  // send): trimmed before grading, so a past sliver of free time never makes a blocked player look
  // free (0 without an arrival date — then nothing is known to be past).
  // `floorMs` = the sender's own floor (a returning off's home time, v6.2.0) — the launch moments
  // before it are just as impossible as those before now.
  const schedSkip = (dateISO, pw, travel, floorMs) => {
    const startMs = windowStartMs(dateISO, pw); // the shown start, like psLaunchRange
    if (startMs === null) return 0;
    const past = floorMs - (startMs - Math.round(travel || 0) * 60000);
    return past > 0 ? Math.ceil(past / 60000) : 0;
  };
  const schedTierOf = (p, T, pw, kind, dateISO) => {
    if (!pw) return 1;
    const tr = travelTimeMin(distXY(p.c, T.c), kind === 'snob' ? PLAN_BASE_MIN.snob : PLAN_BASE_MIN.off, ws, us);
    return psLaunchTier(decode(p.v.player), pw, tr, schedMode, schedSkip(dateISO, pw, tr, kind === 'snob' ? sendFloorMs : floorFor(p)), dateISO);
  };
  const schedGrader = (T, g, kind) => { // one grade per candidate per pick
    const pw = schedWin(g, kind), memo = new Map();
    return p => { let tr = memo.get(p); if (tr === undefined) { tr = schedTierOf(p, T, pw, kind, g && g.dateISO); memo.set(p, tr); } return tr; };
  };
  const schedFirst = (T, g, cands, kind) => {
    if (!schedActive || cands.length < 2) return cands;
    const grade = schedGrader(T, g, kind);
    let best = -1, out = [];
    for (const p of cands) { const tr = grade(p); if (tr > best) { best = tr; out = [p]; } else if (tr === best) out.push(p); }
    return out;
  };
  const schedThen = (T, g, kind, cmp) => {
    if (!schedActive) return cmp;
    const grade = schedGrader(T, g, kind);
    return (a, b) => (grade(b) - grade(a)) || cmp(a, b);
  };
  // Manually-pinned senders: distance only (closest of their own villages first; no
  // morale, no fairness — the pin is the user's explicit choice).
  const byDist = T => (a, b) => (distXY(a.c, T.c) - distXY(b.c, T.c)) || (b.v.offPow - a.v.offPow);
  // Fraction of a player's off roster still unused (1 = untouched, →0 = drained). A ⚖ Player Share
  // (v6.3.0) shrinks the roster to the cap, so a capped player is balanced like a smaller one.
  const remOffFrac = name => {
    const k = shareKey.get(name);
    const cap = k !== undefined ? shareCap.get(k) : (offCapacity[name] || 0);
    const used = k !== undefined ? (shareUsed.get(k) || 0) : (offUsedByPlayer[name] || 0);
    return cap > 0 ? Math.max(0, (cap - used) / cap) : 1;
  };
  // Auto "optimize" score for a candidate: effective power per field of travel (so a small
  // morale loss for a much closer village wins — 95% @ 7h beats 100% @ 50h), or pure
  // closeness when there's no morale signal. Then DAMPED by the sender's remaining fraction
  // ((1−d)–1.0, d = PARAMS.rosterDamping) so already-used players slide down — pulling the split toward equal fractions
  // of each player's roster (≈ proportional balancing) without overriding a real edge.
  const optScore = (p, T) => {
    const d = Math.max(0.1, distXY(p.c, T.c));
    const base = moraleUsable(T) ? effPow(p, T) / d : 1 / d;
    const dmp = PARAMS.rosterDamping;
    return base * ((1 - dmp) + dmp * remOffFrac(p.v.player));
  };
  const byOptimize = T => (a, b) => (optScore(b, T) - optScore(a, T)) || (distXY(a.c, T.c) - distXY(b.c, T.c));

  // ── Per-player launch-distance clustering (nudge; see clusterMode above) ────
  // Tracks the off distances already committed for each DECODED player (across the named,
  // conqueror, POWER and auto passes) so later picks can favour a distance that fits the
  // player's existing cluster. clusterFit = how far a candidate strays from that player's mean
  // committed distance (0 when the player has no off yet → neutral, free to seed a cluster).
  const playerOffDists = {};
  const noteClusterDist = (name, d) => { (playerOffDists[name] || (playerOffDists[name] = [])).push(d); };
  const clusterFit = (p, T) => {
    const arr = playerOffDists[decode(p.v.player)];
    if (!arr || !arr.length) return 0;
    const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
    return Math.abs(distXY(p.c, T.c) - mean);
  };
  // Pick the best candidate by `primary` (morale×power, or raw power on POWER targets); then, in
  // cluster mode only, swap in the tightest-fitting candidate that is still within clusterTol
  // fields of the primary pick's distance. So clustering breaks near-ties without ever sacrificing
  // real closeness/strength. Pure `primary[0]` when the mode is off — the exact legacy behaviour.
  const pickClustered = (cands, T, primary) => {
    const sorted = cands.slice().sort(primary);
    if (!clusterMode || sorted.length < 2) return sorted[0];
    const dCap = distXY(sorted[0].c, T.c) + clusterTol;
    const swap = sorted.filter(p => distXY(p.c, T.c) <= dCap);
    if (swap.length < 2) return sorted[0];
    return swap.sort((a, b) => (clusterFit(a, T) - clusterFit(b, T)) || primary(a, b))[0];
  };

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
  // off passes per escorted train — by default the closest Complete/3-4 off to that target
  // (🎚 escortPick 'strongest' takes the most powerful instead; noble range + pace govern,
  // since the off travels with the noble). Reserved up front so the
  // off passes leave it free for the split-off. Applies even to pinned senders who don't
  // own the noble yet (needNobles): the slot is held until they recruit one.
  // An escort village launches the noble too, so with a buildings JSON loaded a KNOWN Smithy below
  // PARAMS.snobSmithMin disqualifies it (the next closest capable off takes the slot); unknown Smithy
  // passes (smithOkOrUnknown — escorts never had a points gate, don't introduce one).
  // A pinned train reserves among the pinned player's own villages (nobles or not — needNobles
  // recruits there); an AUTO train only among villages that own a noble, since that is the only
  // place an auto train can leave from. The snob loop picks the train's real origin itself (the
  // strongest escort); when that is NOT the reserved village, the reservation is released there
  // so it rejoins the off passes — one escorted train never costs two offs.
  const escortReserved = new Set();
  // 🎚 escortPick (v6.1.1): 'closest' = nearest eligible off, power breaks ties (today); 'strongest' =
  // most off power, distance breaks ties. Tier preference (Complete/3-4 before 1/2) stays either way.
  const escortCmp = T => PARAMS.escortPick === 'strongest'
    ? (a, b) => (b.v.offPow - a.v.offPow) || (distXY(a.c, T.c) - distXY(b.c, T.c))
    : (a, b) => (distXY(a.c, T.c) - distXY(b.c, T.c)) || (b.v.offPow - a.v.offPow);
  for (const T of targets) {
    // One reserved escort village per (wave, train), in spec order (null = none in range).
    // The snob loop reads these by the SAME group id + train index to tell a needNobles sender
    // WHERE to recruit (a split-off launches off + noble from one village). Escort mode is a
    // per-wave setting since v5.16: a target can be Split Off on Friday and Solo on Saturday.
    T.escortPicks = {}; // gid → [village | null] per train of that wave
    if (!T.c || isFake(T)) continue;
    for (const g of otSnobGroups(T.tg)) {
      if (otSnobMode(T.tg, g.id) !== 'escorted') continue;
      const picks = T.escortPicks[g.id] = [];
      for (const { name: want } of targetTrainSpec(T.tg, g.id)) {
        const pick = tiers => pool.filter(p => !p.usedOff && !escortReserved.has(p) && !priorReserved.has(p.v.coord) && !tooClose.has(p) && !pairBlocked(p.v.player, T)
          && tiers.includes(p.tier) && okSnobDist(p, T.c) && okEscortTime(p, T, g) && smithOkOrUnknown(p)
          && (want ? p.v.player === want : (!ignorePlayers.has(p.v.player) && p.snobLeft > 0)) && !ratioBlk(p, T, g, 'escort')) // ⚔ last (v6.5.0)
          .sort(schedThen(T, g, 'snob', escortCmp(T)))[0]; // ⏰ schedules lead (v6.1.2; identity without any)
        const p = pick(['complete', 'tq']) || pick(['half']);
        if (p) escortReserved.add(p);
        picks.push(p || null);
      }
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
  // Conquerors are keyed per (target, WAVE) since v5.16: the coordination off must ride in the
  // wave the conqueror's train lands in, and a target nobled in two waves gets one such clear
  // per wave (the launch-village reservation above stays per target — the villages are the same).
  const conquerorByTarget = {};  // `${target index}|${group id}` -> Set of decoded sender (solo + escorted)
  const conqKey = (T, g) => `${T.i}|${g.id}`;
  const noteSnobSender = (rawName, T, g) => {
    if (!rawName) return;
    (snobSenderTargets[rawName] || (snobSenderTargets[rawName] = new Set())).add(T.i);
    (conquerorByTarget[conqKey(T, g)] || (conquerorByTarget[conqKey(T, g)] = new Set())).add(decode(rawName));
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
      if (isFake(T)) continue; // fake targets never field a snob train
      const def = mvDef(T); if (!def) continue;
      for (const g of otSnobGroups(T.tg)) for (const { name } of targetTrainSpec(T.tg, g.id)) {
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
  // auto-picked from distinct players; escort mode is a per-(target, wave) setting.
  // FAKE-type targets ARE included now (no isFake skip): a fake target can field a
  // FAKE noble train (snobMode 'fake') as a bare decoy — see the fake branch below.
  // Since v5.16 a target may field a train in SEVERAL waves — each (target, group) is planned
  // on its own: its own nobles / senders / mode, its own snob window and date (okSnobTime), its
  // own escort picks; the rows carry `group` from birth. Auto-picked senders are distinct
  // WITHIN a wave (`chosen`); the same player may well noble the target on both days.
  for (const T of targets) {
    if (!T.c) continue;
    for (const g of otSnobGroups(T.tg)) {
    const nobles = otSnobCount(T.tg, g.id, 'nobles');
    if (!nobles) continue;
    const spec = targetTrainSpec(T.tg, g.id);
    if (!spec.length) continue;
    const specSum = spec.reduce((s, x) => s + x.count, 0);
    if (specSum !== nobles) planWarnings.push(t('warn_nobles_mismatch')(T.tg.coord, specSum, nobles));
    const mode = otSnobMode(T.tg, g.id);
    const chosen = new Set();
    spec.forEach(({ name: want, count: nc }, trainIdx) => {
      // For escorted trains, the off held back at reservation time (same wave, same train
      // index) is exactly where a needNobles sender should recruit — surface its coord.
      const reservedV = mode === 'escorted' && T.escortPicks[g.id] ? T.escortPicks[g.id][trainIdx] : null;
      const recruitCoord = reservedV ? reservedV.v.coord : undefined;
      // Distance/travel from that reserved off to the target (snob pace) so a needNobles row
      // can still show WHEN to launch the split-off once the noble is recruited.
      const recruitDist = reservedV ? distXY(reservedV.c, T.c) : undefined;
      const recruitTravel = reservedV ? travelTimeMin(recruitDist, PLAN_BASE_MIN.snob, ws, us) : undefined;
      // A village may host several trains while it has snobs left; in split-off
      // mode its off can only be split once (solo trains from it stay fine)
      let cands = pool.filter(p =>
        p.snobLeft > 0 && okSnobDist(p, T.c) && okSnobTime(p, T, g) && !mvBlocked(p, T) &&
        // a pinned (want) sender may be an ignored player; auto-picks never use ignored players
        (want ? p.v.player === want : (!chosen.has(p.v.player) && !ignorePlayers.has(p.v.player))) &&
        (mode !== 'escorted' || (!p.usedOff && !priorReserved.has(p.v.coord) && okEscortTime(p, T, g))) && // a split-off also spends the off — never one another offensive holds for a launch, nor one still on its way home (v6.2.0)
        !ratioBlk(p, T, g, mode === 'escorted' ? 'escort' : 'snob')); // ⚔ attack ratio (v6.5.0), last
      if (mode === 'escorted') {
        // train travels with its own off escort → prefer villages with real off power
        const strong = cands.filter(p => tierAtLeast(p.tier, PARAMS.escortMinTier)); // 🎚 escortMinTier ('none' keeps every candidate)
        if (strong.length) cands = strong;
      }
      const enough = cands.filter(p => p.snobLeft >= nc);
      // A pinned sender whose villages can't field a FULL train (some nobles, but fewer than
      // this train needs) is treated like the no-noble case: kept on the plan by name, origin
      // UNASSIGNED, never assigned a short village. No "recruit nobles" warning (assigning snobs
      // before recruiting is the normal workflow); the row's "Prepare Snob Train" call-out is the cue.
      if (want && cands.length && !enough.length) {
        T.snobRows.push({ type: 'snob', group: g.id, count: nc, escorted: mode === 'escorted', fake: mode === 'fake', unassigned: true,
          srcPlayer: decode(want), needNobles: true, recruitCoord, dist: recruitDist, travel: recruitTravel,
          rangeVills: snobRangeVills(want, T, g) });
        // A FAKE train never reserves launch villages or forces a clearing off (it's a bare
        // decoy), so it stays out of snobSenderTargets/conquerorByTarget — but it still CLAIMS
        // the defender for MV (a fake noble is a real in-game attack).
        if (mode !== 'fake') noteSnobSender(want, T, g);
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
        if (want && pairBlocked(want, T)) {
          msg = t('warn_block_pair')(decode(want), T.tg.coord, mvDef(T)); // a Block Pair forbids this sender → defender outright
        } else if (want && ratioPin(pool.filter(p => p.v.player === want && okSnobDist(p, T.c) && okSnobTime(p, T, g)), T, g, mode === 'escorted' ? 'escort' : 'snob')) {
          // ⚔ every village of theirs in noble range is barred by the attack ratio (v6.5.0) — no
          // amount of recruiting helps (so never a needNobles row), and it isn't an MV conflict
          msg = t('warn_ratio_pin')(decode(want), T.tg.coord, ratioEnd(T));
        } else if (want && mvWouldBlockPin(want, T)) {
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
            const recruit = pool.filter(p => p.v.player === want && okSnobDist(p, T.c) && okSnobTime(p, T, g) && smithOkOrUnknown(p))
              .sort((a, b) => distXY(a.c, T.c) - distXY(b.c, T.c));
            if (recruit.length) {
              const CAP = 6;
              let coords = recruit.slice(0, CAP).map(p => p.v.coord).join(', ');
              if (recruit.length > CAP) coords += t('warn_snob_range_more')(recruit.length - CAP);
              msg += '. ' + t('warn_snob_range_hint')(decode(want), coords);
            }
          }
          else if (inRange.length && !inRange.some(p => okSnobTime(p, T, g)))
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
          msg = any.length && !any.some(p => okSnobTime(p, T, g))
            ? t('warn_snob_too_late')(T.tg.coord)
            : t('warn_missed_snob')(T.tg.coord);
        }
        // needNobles rows carry no warning (recruiting later is expected); the out-of-range /
        // too-late / escort-used / missed-snob cases still warn.
        if (msg && !needNobles) planWarnings.push(msg);
        // A manually-pinned sender stays named on the plan even when unplaced (so they
        // see their assignment); an auto train that couldn't be filled has no name.
        T.snobRows.push({ type: 'snob', group: g.id, count: nc, escorted: mode === 'escorted', fake: mode === 'fake', unassigned: true,
          srcPlayer: want ? decode(want) : undefined, needNobles, recruitCoord: needNobles ? recruitCoord : undefined,
          dist: needNobles ? recruitDist : undefined, travel: needNobles ? recruitTravel : undefined,
          rangeVills: snobRangeVills(want, T, g) });
        if (want) { if (mode !== 'fake') noteSnobSender(want, T, g); noteMvClaimName(want, T); } // pinned intent claims the defender
        // An AUTO train that can't be placed has no one to recruit at its reserved escort (only a
        // pinned sender's hold doubles as the recruit hint) → release it for the off passes.
        else if (reservedV) escortReserved.delete(reservedV);
        return;
      }
      // escorted: strongest escort wins; solo: nearest village, weakest off stays home
      // (so the strongest off is left free for off duty — coordination is handled on the
      // off side now via conquerorByTarget); fake: FARTHEST in-range village wins — a bare
      // decoy doesn't care about proximity, and a longer flight shows up in the enemy's
      // incoming list sooner (more warning = more wasted defence), ties to the weakest off.
      const snobCmp = mode === 'escorted'
        ? (a, b) => (b.v.offPow - a.v.offPow) || (distXY(a.c, T.c) - distXY(b.c, T.c))
        : mode === 'fake'
        ? (a, b) => (distXY(b.c, T.c) - distXY(a.c, T.c)) || (a.v.offPow - b.v.offPow)
        : (a, b) => (distXY(a.c, T.c) - distXY(b.c, T.c)) || (a.v.offPow - b.v.offPow);
      cands.sort(schedThen(T, g, 'snob', snobCmp)); // ⏰ schedules lead (v6.1.2; identity without any)
      const p = cands[0];
      p.snobLeft -= nc; p.usedSnob = true; chosen.add(p.v.player); noteMvClaim(p, T);
      if (mode === 'escorted') { p.usedOff = true; p.isEscort = true; } // its off rides as the split-off
      // The train left from another village than the one reserved for it → free the reserved one
      // for the off passes (it was only held for THIS train; offBlocked reads escortReserved).
      if (reservedV && reservedV !== p) escortReserved.delete(reservedV);
      // A FAKE train sends bare nobles (real ones, so snobLeft is spent above) but NO escort
      // and consumes no off — so it never reserves launch villages or forces a clearing off.
      if (mode !== 'fake') noteSnobSender(p.v.player, T, g);
      const d = distXY(p.c, T.c);
      T.snobRows.push({
        type: 'snob', group: g.id, count: nc, escorted: mode === 'escorted', fake: mode === 'fake',
        srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.snob, ws, us),
        rangeVills: snobRangeVills(p.v.player, T, g),
      });
    });
    }
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
  // ≥ PARAMS.reserveMinPoints points AND ≥ PARAMS.reserveMinPop farm pop used by troops. Points come
  // from the world DB (coordDb[coord].points); when the DB isn't loaded the points are
  // unknown and treated as passing, so the pop gate alone applies. A close but tiny/empty
  // village is skipped, and the next-closest qualifying village takes the slot instead.
  // When a buildings JSON is loaded, Smithy level is the real Academy signal: a village with a
  // known Smithy < PARAMS.snobSmithMin can't launch a noble and is never reserved (the pop gate still
  // applies first). Unknown Smithy → the legacy points heuristic (PARAMS.reserveMinPoints, unknown → ok).
  const reserveEligible = p => {
    if ((p.v.popUsed || 0) < PARAMS.reserveMinPop) return false;
    const lv = smithLevelAt(p.v.coord);
    if (lv !== null) return lv >= PARAMS.snobSmithMin;
    const dbv = coordDb[p.v.coord];
    const pts = dbv && typeof dbv.points === 'number' ? dbv.points : null;
    return pts === null || pts >= PARAMS.reserveMinPoints;
  };
  const snobReserved = new Set();
  if (!noReserve) for (const [rawName, tset] of Object.entries(snobSenderTargets)) {
    const tcs = [...tset].map(i => targets[i]).filter(T => T && T.c).map(T => T.c);
    if (!tcs.length) continue;
    const mine = pool.filter(p => p.v.player === rawName && reserveEligible(p) && !p.prior && !p.heldOut && !priorReserved.has(p.v.coord)); // spent / held by another offensive / off away (v6.2.0) → not a launch village here
    const dOf = p => Math.min(...tcs.map(tc => distXY(p.c, tc)));
    mine.sort((a, b) => (dOf(a) - dOf(b)) || (b.v.offPow - a.v.offPow) || (a.v.coord < b.v.coord ? -1 : 1));
    for (const p of mine.slice(0, PARAMS.reserveVillages)) snobReserved.add(p);
  }
  // Ignored players are barred from every regular-off pass here (all four use offBlocked),
  // but NOT from the snob loop / escort pick — so a hand-picked ignored noble sender still sends.
  // An away off (heldOut, v6.2.0) is already usedOff from the pool build; listed here too so the gate says it.
  const offBlocked = p => escortReserved.has(p) || snobReserved.has(p) || priorReserved.has(p.v.coord) || ignorePlayers.has(p.v.player) || p.heldOut;
  // Persist the reserved launch-village coords so the "Export Unused Offs" list can drop
  // them (they're being kept for a noble, not offered as a free second-wave off).
  planReserved = [...snobReserved].map(p => p.v.coord);

  // A village is "outside earliest launch date" (heldLate) when it's within off-distance of at
  // least one target but is too LATE for every such target (fails okOffTime) — i.e. timing is the
  // ONLY thing stopping it, so pushing the arrival date (or the Earliest send) later would free
  // it. Villages out of DISTANCE range everywhere go to `far`; the rest (reachable + in time) to `avail`.
  // With several window groups a village is only "too late" when it misses EVERY wave of every
  // reachable target — making wave B on Saturday is reason enough not to call it late.
  // A returning off (v6.2.0) is judged from its home time (okOffTime → floorFor), so one that
  // gets home too late for every reachable target lands here too.
  const offLate = p => {
    let reachable = false;
    for (const T of targets) {
      if (!T.c || !okOffDist(p, T.c)) continue;
      reachable = true;
      for (const g of otActiveGroups(T.tg)) if (okOffTime(p, T, g)) return false;
    }
    return reachable;
  };
  // Beyond MAX distance of every target — can't reach anything (the pool loop reaches this
  // check only after tooClose is already handled, so okOffDist here is pure max-distance).
  const offFar = p => !targets.some(T => T.c && okOffDist(p, T.c));

  // ── ⚖ Player Share (v6.3.0) ─────────────────────────────────────────────────
  // A per-player cap on the offs this plan sends (Offensive Targets popup, player-shares.js).
  // Keyed by the DECODED name (shareKey maps each raw troop-file spelling to it), so one player
  // spelt two ways in the files gets ONE cap over both. Base = the player's off villages that can
  // actually go HERE — after the noble-launch / split-off reservations, the other offensives, away
  // offs, ignored players, the tribe-wide distance holdbacks (min distance, Enemy Tribes) and the
  // villages that reach no target in range (offFar) or in time (offLate): what the plan footer
  // would otherwise count as "unused [available]". Cap = pshCap(base, share) = floor ("at most":
  // 50% of 3 = 1, of 1 = 0). Counted in shareUsed (noteOffUsed: named, conqueror, POWER and auto
  // passes — never escorts or fakes, which spend no off of the base). HARD: shareCapped bars the
  // player from the conqueror, POWER and auto picks even when that leaves a slot open
  // (warn_share_open). Named pins are the user's explicit choice — never barred, but they count
  // (warn_share_pins when they pass the cap). Empty while no player is below 100%, so the
  // defaults are byte-identical.
  if (typeof pshAny === 'function' && pshAny()) {
    for (const raw of new Set(pool.map(p => p.v.player))) {
      const name = decode(raw);
      if (pshGet(name) < 100) shareKey.set(raw, name);
    }
    for (const p of pool) {
      const k = shareKey.get(p.v.player);
      if (k === undefined || p.tier === 'none' || p.usedOff || offBlocked(p) || tooClose.has(p) || nearEnemy.has(p) || offFar(p) || offLate(p)) continue;
      shareBase.set(k, (shareBase.get(k) || 0) + 1);
    }
    for (const k of new Set(shareKey.values())) shareCap.set(k, pshCap(shareBase.get(k) || 0, pshGet(k)));
  }
  const shareCapped = p => { const k = shareKey.get(p.v.player); return k !== undefined && (shareUsed.get(k) || 0) >= shareCap.get(k); };

  // Named off senders fill FIRST among the offs (before the auto pass below claims villages
  // globally), so a manual pin can't be stolen by another target's auto-pick. They draw only
  // from their OWN tier-matching villages and never tier-bump — a shortfall is warned and left
  // unassigned (mirrors the snob trains), reserving those slots so auto doesn't backfill.
  // Reserved launch/escort villages are off-limits to everyone, pins included.
  // Reservations are keyed per (target, tier, window group) — asking for 2 Completes on Friday
  // and 2 on Saturday is two independent requests that must not consume each other's slots.
  const namedOffReserved = {}; // 'tIdx|tier|groupId' → reserved slots (assigned + shortfall)
  const resKey = (T, tier, g) => `${T.i}|${tier}|${g.id}`;
  for (const tier of ['complete', 'tq', 'half']) {
    for (const T of targets) {
      if (!T.c || isFake(T)) continue; // a fake's Complete column is its fake count, not an off request
      for (const g of otActiveGroups(T.tg)) {
      const N = otTierCount(T.tg, g.id, tier);
      const assign = targetOffAssign(T.tg, tier, g.id);
      if (!assign.length) continue;
      const reqSum = assign.reduce((s, a) => s + a.count, 0);
      if (reqSum > N) planWarnings.push(t('warn_offs_mismatch')(t('tier_' + tier), T.tg.coord, reqSum, N));
      let placed = 0;
      for (const a of assign) {
        const want = Math.min(a.count, Math.max(0, N - placed)); // never exceed the tier request
        if (want <= 0) continue;
        const cands = pool.filter(p => !p.usedOff && !offBlocked(p) && p.v.player === a.name && p.tier === tier
          && okOffDist(p, T.c) && okOffTime(p, T, g) && !mvBlocked(p, T) && !ratioBlk(p, T, g, 'off')).sort(byDist(T)); // ⚔ last (v6.5.0)
        let got = 0;
        for (const p of cands) {
          if (got >= want) break;
          p.usedOff = true; got++; placed++; noteOffUsed(p.v.player); noteMvClaim(p, T);
          const d = distXY(p.c, T.c);
          noteClusterDist(decode(p.v.player), d);
          T.offRows.push({ type: tier, group: g.id, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
            dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us) });
        }
        if (got < want) {
          placed += want - got; // reserve the shortfall so the auto pass won't backfill it
          const owned = pool.filter(p => p.v.player === a.name && p.tier === tier);
          const inRange = owned.filter(p => okOffDist(p, T.c));
          const inRangeTime = inRange.filter(p => okOffTime(p, T, g) && !p.usedOff && !offBlocked(p));
          planWarnings.push(
            pairBlocked(a.name, T) ? t('warn_block_pair')(decode(a.name), T.tg.coord, mvDef(T))
            : owned.length && !inRange.length ? t('warn_off_range')(decode(a.name), t('tier_' + tier), T.tg.coord)
            : inRange.length && !inRange.some(p => okOffTime(p, T, g)) ? t('warn_off_too_late')(t('tier_' + tier), T.tg.coord)
            // ⚔ every otherwise-usable village barred by the attack ratio (v6.5.0) — before the MV test
            : ratioPin(inRangeTime, T, g, 'off') ? t('warn_ratio_pin')(decode(a.name), T.tg.coord, ratioEnd(T))
            // all otherwise-usable villages blocked by an MV pair conflict → say so
            : inRangeTime.length && inRangeTime.every(p => mvBlocked(p, T)) ? t('warn_mv')(decode(a.name), T.tg.coord)
            : t('warn_sender_short_off')(decode(a.name), t('tier_' + tier), T.tg.coord));
          for (let z = 0; z < want - got; z++) T.offRows.push({ type: tier, group: g.id, unassigned: true });
        }
      }
      namedOffReserved[resKey(T, tier, g)] = placed;
      }
    }
  }

  // Tier bump map (a need bumps UP to the nearest stronger off when its own tier is empty);
  // shared by the conqueror reservation below and the auto pass further down.
  // 🎚 tierBump off → no bumping at all (a missing tier stays unassigned).
  const TIER_UP = PARAMS.tierBump ? { half: ['tq', 'complete'], tq: ['complete'], complete: [] } : { half: [], tq: [], complete: [] };
  // 🎚 tierBumpDown 'whenEmpty' (v6.1.1): the AUTO pass may fall back to the next WEAKER tier when
  // the tier and every stronger tier are empty (tried AFTER the upward bumps). Auto pass only — the
  // conqueror reservation stays bump-up-only (a snob sender's clearing off must not get weaker).
  // Tiers are processed Complete → 3/4 → 1/2, so a weaker off taken this way is no longer there for
  // its own tier's requests later in the pass — documented in the parameter's tooltip.
  const TIER_DOWN = PARAMS.tierBumpDown === 'whenEmpty' ? { complete: ['tq', 'half'], tq: ['half'], half: [] } : { complete: [], tq: [], half: [] };

  // ── DESTROYER / VOLADORA targets ──────────────────────────────────────────
  // An explicit per-row type (see isDestroyer above): you flatten the village instead of
  // taking it. Off selection PREFERS catapult-carrying off villages (≥ CAT_CLEAR_MIN cats)
  // so the clearing off itself demolishes — applied to EVERY off slot; by default falling back
  // to a normal off when no cat-off qualifies (🎚 destroyerFallback can send the most-cats off or
  // leave the slot open instead, 🎚 destroyerRank can rank the qualifiers catapults-first — see
  // destroyerPick). Range/time/tier still gate first: the strategy runs INSIDE the resolved tier,
  // after the morale gate. A target whose offs end up carrying no cats is warned once, see
  // below. Independent of the EXTRA small cat
  // attacks sourced from defensive villages further down (a destroyer also gets those by
  // default: its catapult toggle starts ON at PARAMS.catAttacksDefault attacks).
  const CAT_CLEAR_MIN = PARAMS.catClearMin; // an off with ≥ this many catapults can serve as the clearing off
  // 🎚 Destroyer strategy (v6.1.1) — the ONE place the two selects act. Takes the (morale-gated)
  // candidates and the pass's ranking comparator, returns the set to pick from + the comparator:
  //  · qualifying set non-empty → that set; destroyerRank 'catsFirst' ranks more catapults first,
  //    the pass's own comparator breaks ties ('power' = today: the comparator alone).
  //  · nobody reaches catClearMin → destroyerFallback: 'power' = the whole set, unchanged (today);
  //    'mostCats' = the whole set (minus offs under destroyerFallbackMinCats) ranked catapults-first;
  //    'unassigned' = nothing — the slot stays open (warn_destroyer_open) for the tribe to fill by hand.
  // Defaults reproduce the pre-6.1.1 "keep only the cat-carriers when any qualifies" filter + the
  // comparator byte-for-byte. pickClustered keeps its "within clusterTol of the primary pick"
  // contract on top of whatever comparator comes back. Runs INSIDE the resolved tier and after the
  // morale gate (so 'unassigned' can leave a slot open although a cat-off of another tier, or a
  // low-morale one, exists — documented in the tooltip + warning).
  const catsOf = p => p.v.catapult || 0;
  const destroyerOpenWarned = new Set(); // warn_destroyer_open once per target, not once per open slot
  const catsFirst = cmp => (a, b) => (catsOf(b) - catsOf(a)) || cmp(a, b);
  const destroyerPick = (T, cands, cmp) => {
    if (!isDestroyer(T)) return { cands, cmp };
    const catOffs = cands.filter(p => catsOf(p) >= CAT_CLEAR_MIN);
    if (catOffs.length) return { cands: catOffs, cmp: PARAMS.destroyerRank === 'catsFirst' ? catsFirst(cmp) : cmp };
    if (PARAMS.destroyerFallback === 'mostCats') return { cands: cands.filter(p => catsOf(p) >= PARAMS.destroyerFallbackMinCats), cmp: catsFirst(cmp) };
    if (PARAMS.destroyerFallback === 'unassigned') return { cands: [], cmp };
    return { cands, cmp };
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
  for (const T of orderedTargets) {
    if (!T.c || T.tg.power || isFake(T)) continue;
    for (const cg of otSnobGroups(T.tg)) {
    const conq = conquerorByTarget[conqKey(T, cg)];
    if (!conq) continue;
    // a pin that already gave a conqueror an off IN THIS WAVE ends it
    if (T.offRows.some(r => r.group === cg.id && !r.unassigned && r.srcPlayer && conq.has(r.srcPlayer))) continue;

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
    // (The 👑 "Assign 1 off to snob sender" checkbox forces it to 0 — see snobGateFor.)
    const gate = snobGateFor(T);
    const playerMorale = name => {
      const rep = pool.find(p => decode(p.v.player) === name);
      const m = rep ? planAttackMorale(rep.v.coord, T.tg.coord) : null;
      return m == null ? 1 : m; // unknown points → treat as 100% (matches effPow's convention)
    };
    const conqOk = new Set([...conq].filter(name => playerMorale(name) >= gate));

    // candidate villages for a tier, restricted by a sender predicate (decoded names)
    // The coordination off rides in the SAME wave (`cg`) as the noble it clears for, so the
    // clear and the train can't end up on different days.
    const candsFor = (allow, tt) => pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier === tt
      && allow(p) && okOffDist(p, T.c) && okOffTime(p, T, cg) && !mvBlocked(p, T) && !shareCapped(p) // ⚖ a capped conqueror reserves nothing — the auto pass fills the slot
      && !ratioBlk(p, T, cg, 'off')); // ⚔ attack ratio (v6.5.0), last
    const reserve = (p, tier) => {
      p.usedOff = true; noteOffUsed(p.v.player); noteMvClaim(p, T);
      namedOffReserved[resKey(T, tier, cg)] = (namedOffReserved[resKey(T, tier, cg)] || 0) + 1;
      const d = distXY(p.c, T.c);
      noteClusterDist(decode(p.v.player), d);
      // Sent AS the village's own (≥ requested) tier; no "tier bumped" warning — this is a
      // deliberate coordination off, not a shortage fallback. Tagged `conqueror` so the window
      // pass can land it LAST among the offs (the decisive clear right before the noble).
      T.offRows.push({ type: p.tier, group: cg.id, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us), conqueror: true });
    };

    for (const tier of ['complete', 'tq', 'half']) {
      if ((otTierCount(T.tg, cg.id, tier) - (namedOffReserved[resKey(T, tier, cg)] || 0)) <= 0) continue;
      const bump = allow => { // requested tier first, then bump UP only (stronger covers weaker)
        let c = candsFor(allow, tier);
        for (const up of TIER_UP[tier]) { if (c.length) break; c = candsFor(allow, up); }
        return c;
      };
      // 1) A qualifying conqueror keeps the coordination off (closest of their villages).
      if (conqOk.size) {
        const cands = bump(p => conqOk.has(decode(p.v.player)));
        if (!cands.length) continue; // can't man this tier — try the next
        reserve(cands.sort(schedThen(T, cg, 'off', byDist(T)))[0], tier); // ⏰ schedules lead (identity without any), then closest
        break;
      }
      // 2) No conqueror clears the snob-off bar → reserve the off for a reachable sender that
      //    clears the OFF gate (minMoraleOff, default 100% — this is a regular clearing off now,
      //    not the conqueror's own coordination off), chosen by the same "optimize" score as the
      //    auto pass (morale × off power ÷ distance, damped by roster balance) — so a close 100%
      //    beats a far 100%. Reserving it (usedOff) keeps a closer sub-bar village from reclaiming
      //    the slot in the auto pass. (Inert when morale is unresolvable — see offGate below.)
      const repGate = offGateFor(T);
      const repCands = bump(p => playerMorale(decode(p.v.player)) >= repGate);
      if (repCands.length) {
        reserve(schedFirst(T, cg, repCands, 'off').sort(byOptimize(T))[0], tier); // ⏰ schedules (v6.1.2): the one free pick in this reservation
        break;
      }
      // 3) No high-morale alternative reachable → fall back to the conqueror's own off.
      const fallback = bump(p => conq.has(decode(p.v.player)));
      if (!fallback.length) continue;
      reserve(fallback.sort(schedThen(T, cg, 'off', byDist(T)))[0], tier); // ⏰ schedules lead (identity without any), then closest
      break;
    }
    }
  }

  // POWER targets (per-target tag): ignore the per-tier split and fill each one's
  // remaining off slots with the globally strongest available offs, balancing total
  // raw off power across all POWER targets — the next-strongest off goes to whichever
  // POWER target currently has the lowest assigned power and still has an open slot it
  // can reach (range + launch time). Runs before the auto pass so it isn't starved.
  // The Min. Morale (off) gate still leads (v5.11.0): each pick prefers candidates that
  // clear minMoraleOff and only ranks by raw power among those (moraleFirst, soft).
  // A POWER target's slots are counted per window group (each wave asks for its own offs), but
  // the power BALANCE is still per target — the point is to spread the strongest offs evenly
  // over the POWER targets, whichever wave they belong to.
  const powerTargets = targets.filter(T => T.c && T.tg.power && !isFake(T));
  if (powerTargets.length) {
    const remaining = {}, powSum = {}, warned = new Set();
    const slots = []; // {T, g} — one entry per (POWER target, group) with open slots
    let totalSlots = 0;
    for (const T of powerTargets) {
      powSum[T.i] = 0;
      for (const g of otActiveGroups(T.tg)) {
        const total = ['complete', 'tq', 'half'].reduce((s, tr) => s + otTierCount(T.tg, g.id, tr), 0);
        const named = ['complete', 'tq', 'half'].reduce((s, tr) => s + (namedOffReserved[resKey(T, tr, g)] || 0), 0);
        const open = Math.max(0, total - named);
        remaining[T.i + '|' + g.id] = open;
        totalSlots += open;
        if (open > 0) slots.push({ T, g });
      }
    }
    for (let s = 0; s < totalSlots; s++) {
      const open = slots.filter(x => remaining[x.T.i + '|' + x.g.id] > 0).sort((a, b) => powSum[a.T.i] - powSum[b.T.i]);
      if (!open.length) break;
      const { T, g } = open[0];
      // Min. Morale (off) gate leads even here (v5.11.0) — morale outranks the POWER tag: only
      // when no reachable candidate clears minMoraleOff does the pick fall back to the full set
      // (soft, via moraleFirst). Raw off power then ranks the survivors — that's the tag's job.
      const powCands = (share, ratio = true) => pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier !== 'none' && okOffDist(p, T.c) && okOffTime(p, T, g) && !mvBlocked(p, T) && (!share || !shareCapped(p))
        && (!ratio || !ratioBlk(p, T, g, 'off'))); // ⚔ attack ratio (v6.5.0), last
      const rawCands = powCands(true); // ⚖ Player Share caps apply (v6.3.0)
      const cands = moraleFirst(T, rawCands);
      remaining[T.i + '|' + g.id]--;
      if (!cands.length) {
        if (!warned.has(T.i)) {
          const inBand = pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier !== 'none' && okOffDist(p, T.c));
          planWarnings.push(shareCap.size && powCands(false).length ? t('warn_share_open')(t('tier_complete'), T.tg.coord) // only the ⚖ caps left it open
            : ratioHits.has(T.i) && powCands(false, false).length ? t('warn_ratio_open')(t('tier_complete'), T.tg.coord, ratioEnd(T)) // ⚔ only the attack ratio (+ caps) left it open
            : inBand.length && !inBand.some(p => okOffTime(p, T, g))
            ? t('warn_off_too_late')(t('tier_complete'), T.tg.coord)
            : t('warn_missed_off')(t('tier_complete'), T.tg.coord));
          warned.add(T.i);
        }
        T.offRows.push({ type: 'complete', group: g.id, unassigned: true });
        continue;
      }
      // Raw off power leads on POWER targets; clustering is only a within-tolerance tiebreaker.
      // A destroyer target applies its 🎚 strategy on top (cat-carriers first; the fallback may leave the slot open).
      const dp0 = destroyerPick(T, cands, (a, b) => b.v.offPow - a.v.offPow);
      const dp = { cands: schedFirst(T, g, dp0.cands, 'off'), cmp: dp0.cmp }; // ⏰ schedules (v6.1.2) INSIDE the destroyer's chosen set — a preferred launch never costs the cat-off
      if (!dp.cands.length) {
        if (!destroyerOpenWarned.has(T.i)) { planWarnings.push(t('warn_destroyer_open')(T.tg.coord)); destroyerOpenWarned.add(T.i); }
        T.offRows.push({ type: 'complete', group: g.id, unassigned: true });
        continue;
      }
      const p = pickClustered(dp.cands, T, dp.cmp);
      p.usedOff = true; powSum[T.i] += p.v.offPow; noteOffUsed(p.v.player); noteMvClaim(p, T);
      const d = distXY(p.c, T.c);
      noteClusterDist(decode(p.v.player), d);
      T.offRows.push({ type: p.tier, group: g.id, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us) });
    }
  }

  // Offs: strongest requests claim villages first (complete → 3/4 → 1/2);
  // an exhausted tier auto-bumps to the nearest stronger off (1/2 → 3/4 → Complete; 🎚 tierBump),
  // then — only with 🎚 tierBumpDown 'whenEmpty' — falls back to the next weaker one (3/4 before 1/2),
  // and the row is relabeled to what is actually sent, with a warning. Slots already
  // reserved by named senders + the conqueror reservation above are subtracted so each
  // tier isn't double-filled.
  // Slot order (morale strategy, v5.13.0/v5.13.1): each tier's open (target, group) slots form a
  // queue in `orderedTargets` order. 'priority' drains it front-to-back (identical to the old nested
  // target → group → slot loops); 'balanced' hands EVERY slot to the target whose assigned offs
  // currently average the lowest morale (untouched targets first, list order on ties), so the
  // high-morale offs are spread across the targets rather than exhausted on the first ones;
  // 'points' does the same but within the big band first (band rank, then lowest average) — so the
  // big targets share the high-morale offs evenly and the small ones share what is left;
  // 'distance' (v6.1.1) drains front-to-back like 'priority', over the nearest-first `orderedTargets`.
  for (const tier of ['complete', 'tq', 'half']) {
    const queue = [];
    for (const T of orderedTargets) {
      if (!T.c || T.tg.power || isFake(T)) continue; // POWER targets are filled by the balanced pass above; fakes by their own pass below
      for (const g of otActiveGroups(T.tg)) {
        const autoNeed = Math.max(0, otTierCount(T.tg, g.id, tier) - (namedOffReserved[resKey(T, tier, g)] || 0));
        if (autoNeed > 0) queue.push({ T, g, left: autoNeed });
      }
    }
    for (;;) {
      const open = queue.filter(sl => sl.left > 0);
      if (!open.length) break;
      const bandRank = sl => bigTarget(sl.T) ? 0 : 1; // 0 for every target outside 'points' mode
      const slot = (moraleMode === 'priority' || moraleMode === 'distance') // 'distance' already ordered the queue
        ? open[0]
        : open.slice().sort((a, b) => (bandRank(a) - bandRank(b)) || (targetAvgMorale(a.T) - targetAvgMorale(b.T)))[0];
      slot.left--;
      const { T, g } = slot;
      // Min. Morale (off) gate — once the TIER is resolved (the tier-bump below still fires only
      // when a tier is empty, never for morale), PREFER candidates whose morale on this target
      // clears minMoraleOff (default 100%), and fall back to the best below-gate village only when
      // none qualify (soft — a low-morale clear beats an uncleared target; see moraleFirst).
      // Per-PLAYER morale via the source village.
      {
        // ⚖ Player Share caps (v6.3.0) apply inside tierCands, so a tier bump sees the capped set too.
        const tierCands = (tt, share = true, ratio = true) => pool.filter(p => !p.usedOff && !offBlocked(p) && p.tier === tt && okOffDist(p, T.c) && okOffTime(p, T, g) && !mvBlocked(p, T) && (!share || !shareCapped(p))
          && (!ratio || !ratioBlk(p, T, g, 'off'))); // ⚔ attack ratio (v6.5.0), last
        let sent = tier, cands = tierCands(tier);
        for (const alt of [...TIER_UP[tier], ...TIER_DOWN[tier]]) { // stronger first, then (🎚 tierBumpDown) weaker
          if (cands.length) break;
          cands = tierCands(alt);
          if (cands.length) sent = alt;
        }
        if (!cands.length) {
          const inBand = pool.filter(p => !p.usedOff && !offBlocked(p) && okOffDist(p, T.c));
          planWarnings.push(shareCap.size && [tier, ...TIER_UP[tier], ...TIER_DOWN[tier]].some(tt => tierCands(tt, false).length)
            ? t('warn_share_open')(t('tier_' + tier), T.tg.coord) // only the ⚖ caps left it open
            : ratioHits.has(T.i) && [tier, ...TIER_UP[tier], ...TIER_DOWN[tier]].some(tt => tierCands(tt, false, false).length)
            ? t('warn_ratio_open')(t('tier_' + tier), T.tg.coord, ratioEnd(T)) // ⚔ only the attack ratio (+ caps) left it open
            : inBand.length && !inBand.some(p => okOffTime(p, T, g))
            ? t('warn_off_too_late')(t('tier_' + tier), T.tg.coord)
            : t('warn_missed_off')(t('tier_' + tier), T.tg.coord));
          T.offRows.push({ type: tier, group: g.id, unassigned: true });
          continue;
        }
        // The conqueror's own off was already reserved up front (see the conqueror reservation
        // above), so the auto pass just fills the remaining slots by optimize — preferring the
        // villages that clear the Min. Morale (off) gate, else falling back to all candidates.
        // Morale gate first (usual requirement), then the destroyer 🎚 strategy (cat-carriers first;
        // the fallback may leave the slot open); clustering (if on) breaks near-ties among the
        // survivors without overriding morale/power.
        const dp0 = destroyerPick(T, moraleFirst(T, cands), byOptimize(T));
        const dp = { cands: schedFirst(T, g, dp0.cands, 'off'), cmp: dp0.cmp }; // ⏰ schedules (v6.1.2) INSIDE the destroyer's chosen set — a preferred launch never costs the cat-off
        if (!dp.cands.length) {
          if (!destroyerOpenWarned.has(T.i)) { planWarnings.push(t('warn_destroyer_open')(T.tg.coord)); destroyerOpenWarned.add(T.i); }
          T.offRows.push({ type: tier, group: g.id, unassigned: true });
          continue;
        }
        // The bump / downgrade warning only once an off is actually sent — an open destroyer slot
        // above would otherwise read "bumped to Complete" AND "left open" for nothing sent.
        // ⚖ When the asked tier has offs that only the Player Share caps hold, say so (the bump itself stands).
        if (sent !== tier) planWarnings.push(shareCap.size && tierCands(tier, false).length
          ? t('warn_share_bumped')(t('tier_' + tier), t('tier_' + sent), T.tg.coord)
          : t(TIER_RANK[sent] > TIER_RANK[tier] ? 'warn_tier_bumped' : 'warn_tier_bumped_down')(t('tier_' + tier), t('tier_' + sent), T.tg.coord));
        const p = pickClustered(dp.cands, T, dp.cmp);
        p.usedOff = true; noteOffUsed(p.v.player); noteMvClaim(p, T);
        const d = distXY(p.c, T.c);
        noteClusterDist(decode(p.v.player), d);
        T.offRows.push({
          type: sent, group: g.id, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
          dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us),
        });
      }
    }
  }

  // ── FAKE targets (1-ram pretend attacks) ──────────────────────────────────
  // Runs AFTER every real off pass so `usedOff`/`isEscort` are final. Each fake target wants
  // `nComplete` fake rows (the Complete column doubles as the fake count — a fake consumes no
  // off). By default (🎚 fakePool 'offsThenEscorts') sources are villages of at least
  // PARAMS.fakeSourceTier that already send a real off in this plan — the village "attacks twice":
  // once for real, once with 1 ram — preferring non-escorts, then falling back to escort villages
  // (reserved or launched); 'escortsThenOffs' reverses that, 'any' opens the pool to every village
  // with rams (tier and assignment ignored). A village fakes at most PARAMS.fakesPerVillage times
  // (fakesSent), needs ≥ PARAMS.fakeRams rams, and the usual distance/launch-time/MV gates apply (a fake IS an
  // in-game attack, so the vacation-mode limit still binds; morale is irrelevant and skipped).
  for (const T of targets) {
    if (!T.c || !isFake(T)) continue;
    for (const g of otActiveGroups(T.tg)) {
    const want = otTierCount(T.tg, g.id, 'complete');
    for (let k = 0; k < want; k++) {
      // 🎚 fakePool (v6.1.1): 'offsThenEscorts' = assigned real offs, else escorts (today);
      // 'escortsThenOffs' = the reverse; 'any' = EVERY village with ≥ fakeRams rams, whatever its
      // tier (fakeSourceTier is not applied) and whether it sends a real off or not. The other gates
      // (fakesPerVillage, ignore, other offensives, noble-launch reservations, distance, launch time,
      // MV / Block Pairs) always hold.
      const anyPool = PARAMS.fakePool === 'any';
      const candsOf = filt => pool.filter(p => (anyPool || tierAtLeast(p.tier, PARAMS.fakeSourceTier)) && (p.fakesSent || 0) < PARAMS.fakesPerVillage
        && (p.v.ram || 0) >= Math.max(1, PARAMS.fakeRams) && !ignorePlayers.has(p.v.player) && !p.prior && !p.heldOut && filt(p) // never a ram-less village (fakeRams min 1); an away off's rams are away too (v6.2.0)
        && okOffDist(p, T.c) && okOffTime(p, T, g) && !mvBlocked(p, T) && !ratioBlk(p, T, g, 'off')); // ⚔ a fake is an attack too (v6.5.0), last
      const realOffs = p => p.usedOff && !p.isEscort;               // assigned real offs
      const escorts  = p => p.isEscort || escortReserved.has(p);    // split-off escorts (riding or reserved)
      let cands;
      if (anyPool) cands = candsOf(p => !snobReserved.has(p) && !priorReserved.has(p.v.coord)); // never a village held for a noble launch (this or another offensive)
      else if (PARAMS.fakePool === 'escortsThenOffs') { cands = candsOf(escorts); if (!cands.length) cands = candsOf(realOffs); }
      else { cands = candsOf(realOffs); if (!cands.length) cands = candsOf(escorts); }
      if (!cands.length) {
        planWarnings.push(t('warn_missed_fake')(T.tg.coord));
        T.offRows.push({ type: 'fake', group: g.id, unassigned: true });
        continue;
      }
      const p = schedFirst(T, g, cands, 'off').sort(byDist(T))[0]; // ⏰ schedules (v6.1.2): best grade first, then closest
      p.usedFake = true; p.fakesSent = (p.fakesSent || 0) + 1; noteMvClaim(p, T);
      const d = distXY(p.c, T.c);
      T.offRows.push({ type: 'fake', group: g.id, srcCoord: p.v.coord, srcPlayer: decode(p.v.player),
        dist: d, travel: travelTimeMin(d, PLAN_BASE_MIN.off, ws, us) });
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
        planWarnings.push(t('warn_no_cat_clear')(T.tg.coord, CAT_CLEAR_MIN));
    }
  }

  // ── Catapult attacks (EXTRA, from defensive villages that own catapults) ──────────
  // Independent of the off pool, the morale gate and the noble/escort reservations — these are
  // additional demolition attacks, NOT clearing offs. They ARE real in-game attacks sent by the
  // tribe, so the sender-side rules still bind: Ignore Coordinates / Ignore Players, the Force
  // lists, the sender area (typed coord filters + drawn polygon), MV pairs + Block Pairs (claimed
  // like any attack) and the launch-time gate of the wave each attack lands in. Each target's requested count
  // (`tg.catapult`) is filled from OWN villages classified DEFENSIVE (`type === 'def'`) that
  // own catapults; one attack sends `catsPerAttack` catapults. A source village's budget =
  // floor(its catapults / catsPerAttack), spent across all targets; at most catPerSourceMax attacks per
  // (source village → the SAME target) — so a player can still send 4 to one target from two
  // villages. Two extra rules:
  //   • Player spread (🎚 catSpread default): among eligible sources we pick the player who has
  //     sent the FEWEST attacks to this target so far (ties broken by closest), so we don't repeat
  //     a player while a fresh one is available — only repeating once every distinct player is
  //     used. 'closest' / 'mostCats' replace this rule (see catCmp below).
  //   • Distance lead: a cat source must be at least CAT_OFF_LEAD fields CLOSER to the target
  //     than the farthest assigned off (cats are slow — keep them inside the off ring). With no
  //     assigned off the gate is inert. This can tighten supply, so shortfalls are warned.
  const CAT_OFF_LEAD = PARAMS.catOffLead;
  const catsPerAttack = Math.max(1, parseInt((document.getElementById('plan-cat-count') || {}).value) || 20);
  const catPool = villages
    .map(v => ({ v, c: parseCoordStr(v.coord), budget: Math.floor(Math.max(0, (v.catapult || 0) - (prior.cats[v.coord] || 0)) / catsPerAttack) })) // minus the catapults other offensives already send
    .filter(s => s.c && s.v.type === 'def' && s.budget > 0 && inForce(s.v)
      && !ignoreCoords.has(s.v.coord) && !ignorePlayers.has(s.v.player) // "excluded from the whole plan"
      && passesCoordFilters(s.c, planCoordFilters) && passesCoordPolygon(s.c.x, s.c.y)); // same sender area as the off pool
  for (const T of targets) {
    if (!T.c || isFake(T)) continue; // fake targets get 1-ram rows only, never real demolition
    const want = T.tg.catEnabled ? (T.tg.catapult || 0) : 0; // only when the target's catapult toggle is on
    if (want <= 0) continue;
    // Per-attack target building, dealt round-robin (one per building per pass); defaults to all
    // Smithy when no buildings are picked. The k-th placed attack takes catBuildings[k]; a
    // shortfall spreads evenly (5 over 3, 3 sent → 1/1/1).
    const catBuildings = catBuildingTargets(T.tg);
    const offDists = T.offRows.filter(r => !r.unassigned && typeof r.dist === 'number').map(r => r.dist);
    const maxCatDist = offDists.length ? Math.max(...offDists) - CAT_OFF_LEAD : Infinity;
    const perTarget = {}; // source coord → attacks already aimed at THIS target (cap PARAMS.catPerSourceMax)
    const perPlayer = {}; // source player → attacks already aimed at THIS target (spread)
    // 🎚 catSpread (v6.1.1): 'playerSpread' = fewest attacks per player at this target first, then
    // closest (today); 'closest' = nearest source; 'mostCats' = most catapult attacks LEFT in its
    // budget, distance breaks ties. budget / perTarget caps apply in every mode.
    const dT = s => distXY(s.c, T.c);
    const catGroups = otActiveGroups(T.tg); // ⏰ schedules (v6.1.2) grade each cat source by the wave THIS attack is dealt to (catRows[k] → catGroups[k % n], see the window pass)
    const catCmp = PARAMS.catSpread === 'closest' ? (a, b) => dT(a) - dT(b)
      : PARAMS.catSpread === 'mostCats' ? (a, b) => (b.budget - a.budget) || (dT(a) - dT(b))
      : (a, b) => ((perPlayer[decode(a.v.player)] || 0) - (perPlayer[decode(b.v.player)] || 0)) || (dT(a) - dT(b));
    let placed = 0;
    while (placed < want) {
      // The wave THIS attack is dealt to (catRows[k] → catGroups[k % n] in the window pass): its
      // launch must still be possible (same gate + pace as an off — the row travels at off pace).
      const cg = catGroups[placed % catGroups.length];
      const cand = catPool
        .filter(s => s.budget > 0 && (perTarget[s.v.coord] || 0) < PARAMS.catPerSourceMax && distXY(s.c, T.c) <= maxCatDist
          && !mvBlocked(s, T) && okOffTime(s, T, cg) // MV pairs + Block Pairs (mvBlocked folds pairBlocked in); launch not in the past
          && !ratioBlk(s, T, cg, 'off')) // ⚔ attack ratio (v6.5.0), last
        .sort(schedThen(T, cg, 'off', catCmp))[0];
      if (!cand) break; // no eligible cat source left (budget/cap hit, none within the distance lead, MV / too late)
      const cp = decode(cand.v.player);
      noteMvClaim(cand, T); // a catapult attack IS an in-game attack: it claims the defender for MV
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
    // Group order first (wave A's offs before wave B's), then strongest-first within a wave.
    // 'fake' has no tier rank → 0, so fakes land last inside their group.
    // The conqueror's own off lands LAST among ITS WAVE's offs (immediately before that wave's
    // noble row), so the snob sender owns the final clear→noble handoff — a sort key rather
    // than a splice since v5.16, because a target nobled in two waves has one such off per
    // wave. (At most one conqueror off per (target, wave) — see the reservation pass.) The sort
    // is stable, so the strongest-first order of the rest is untouched.
    T.offRows.sort((a, b) => (otGroupIndex(a.group) - otGroupIndex(b.group))
      || ((a.conqueror ? 1 : 0) - (b.conqueror ? 1 : 0))
      || ((TIER_RANK[b.type] || 0) - (TIER_RANK[a.type] || 0)));
    // Every off row already knows its window group (the group WAS the request), so its landing
    // window and arrival date come straight off that group — no post-hoc splitting.
    const stamp = (r, g) => { r.group = g.id; r.window = g.winOff || g.winSnob || ''; r.dateISO = g.dateISO || ''; };
    for (const r of T.offRows) stamp(r, otGroupById(r.group));
    // A noble train lands in the wave it was planned for, in that group's SNOB window.
    T.snobRows.forEach(r => {
      const sg = otGroupById(r.group);
      r.group = sg.id;
      r.window = sg.winSnob || sg.winOff || '';
      r.dateISO = sg.dateISO || '';
    });
    // Catapult attacks are extra demolition alongside the offs, so they follow the offs: dealt
    // round-robin across the groups this target actually attacks in (a target with no offs
    // anywhere falls back to its primary group, which is what otActiveGroups returns there).
    const catGroups = otActiveGroups(T.tg);
    T.catRows.forEach((r, k) => stamp(r, catGroups[k % catGroups.length]));
    // Catapult Mode: every OFF row carries this target's off-sender building objective (the cats
    // riding with the clearing/destroyer/noble-escort off aim here). POWER forces Wall. Catapult
    // attacks keep their own per-attack building (set above); snob trains carry none.
    const offBuilding = effectiveCatMode(T.tg);
    [...T.offRows, ...T.catRows, ...T.snobRows].forEach(r => {
      if (r.type === 'complete' || r.type === 'tq' || r.type === 'half') r.building = offBuilding;
      // Morale of the assigned attack (shown in the plan column); needs the world DB.
      // Fakes skip it — 1 ram does no damage, so morale is meaningless noise there.
      if (r.srcCoord && dbReady && r.type !== 'fake') r.morale = planAttackMorale(r.srcCoord, T.tg.coord);
      planRows.push({ tIdx: T.i + 1, tCoord: T.tg.coord, tPlayer: T.tg.player, ...r });
    });
  }

  // ↩ Returning offs (v6.2.0): an off / fake row whose sender is still on its way home at Generate
  // carries `returning` + `homeMs` (the ↩ marker in the Source cell, and the floor of the two
  // passes below). One stamp pass instead of one per push site; catapult rows come from the
  // defensive catapult pool, which never takes a floor. A home time already past constrains
  // nothing (sendFloorMs ≥ now), so such a sender's rows stay unmarked.
  const homeFloorBy = new Map(pool.filter(p => p.floorMs != null && p.floorMs > roNowMs).map(p => [p.v.coord, p.floorMs]));
  if (homeFloorBy.size) for (const r of planRows) {
    if (r.unassigned || !r.srcCoord || !['complete', 'tq', 'half', 'fake'].includes(r.type)) continue;
    const h = homeFloorBy.get(r.srcCoord);
    if (h != null) { r.returning = true; r.homeMs = h; }
  }
  const rowFloorMs = r => r.returning ? Math.max(sendFloorMs, r.homeMs || 0) : sendFloorMs;
  // A window group with orders but neither an off nor a snob window: the gates let every pick
  // through (no end to miss), but its orders print ??:?? with no launch time — say so, once per group.
  const noWindow = new Set(planRows.filter(r => !parseWindowStr(r.window)).map(r => otGroupIndex(r.group)));
  [...noWindow].sort((a, b) => a - b).forEach(i => planWarnings.push(t('warn_no_window')(otGroupLabel(i))));
  // A window that STARTS inside the hour a spring DST switch skips: its launch times are shown
  // from the switch (03:00, windowStartMs) — say so, once per window and date.
  const skippedWin = new Set();
  for (const r of planRows) {
    const w = parseWindowStr(r.window), iso = planRowDateISO(r), key = `${r.window}|${iso}`;
    if (!w || skippedWin.has(key) || !serverWallSkipped(iso, w.f)) continue;
    skippedWin.add(key);
    planWarnings.push(t('warn_window_skipped')(r.window, iso, fmtServerDT(windowStartMs(iso, w)).slice(11, 16)));
  }
  // A row can still be impossible when its assigned window is earlier than
  // the latest one its source was vetted against — flag it instead of hiding it.
  // Snob trains are skipped: they carry no prescribed origin/launch, so there's
  // no launch-in-the-past to flag (the player picks their own send village).
  for (const r of planRows) {
    // Catapult attacks are flagged like offs: their travel is computed at off (ram) pace and the
    // pick is gated by the same launch-time check (okOffTime), so a late one is a real problem.
    if (r.unassigned || r.type === 'snob') continue;
    const landMs = windowEndMs(planRowDateISO(r), parseWindowStr(r.window));
    if (landMs !== null && landMs - r.travel * 60000 < rowFloorMs(r)) {
      r.late = true;
      planWarnings.push(t('warn_row_late')(r.srcCoord, r.tCoord));
    }
  }
  // ⏰ Player Schedules (v6.1.2): grade every assigned row by its FINAL window + travel (same math
  // as the picks above, now on the row the player will actually see). 'blocked' → ⏰ on the row +
  // one warning per player; 'preferred' is kept on the row for the UI. Frozen at Generate like
  // `late` — a schedule changed afterwards applies at the next Generate.
  if (schedActive) {
    const blockedBy = {};
    for (const r of planRows) {
      if (r.unassigned || !r.srcCoord || !r.srcPlayer || typeof r.travel !== 'number') continue;
      const pw = parseWindowStr(r.window);
      if (!pw) continue;
      const tier = psLaunchTier(r.srcPlayer, pw, r.travel, schedMode, schedSkip(planRowDateISO(r), pw, r.travel, rowFloorMs(r)), planRowDateISO(r)); // same past-trim as the picks
      if (tier === 0) { r.sched = 'blocked'; blockedBy[r.srcPlayer] = (blockedBy[r.srcPlayer] || 0) + 1; }
      else if (tier === 2) r.sched = 'preferred';
    }
    for (const name of Object.keys(blockedBy)) planWarnings.push(t('warn_sched_blocked')(name, blockedBy[name]));
  }
  // ⚔ Attack ratio (v6.5.0): one line per target whose otherwise-eligible senders the limit barred
  // (who and until when), and one if some pair could not be judged — no registration dates and the
  // launch is past the world-start window (a later joiner may still be protected).
  for (const T of targets) {
    const h = ratioHits.get(T.i);
    if (h) planWarnings.push(t('warn_ratio_target')(T.tg.coord, T.tg.player || '', h.players.size, ratioCtx.ratio, ratioCtx.days, fmtServerDT(h.end).slice(0, 16)));
  }
  if (ratioCtx && ratioCtx.unknownEnd) planWarnings.push(t('warn_ratio_unknown')(twWorld, ratioCtx.ratio, fmtServerDT(ratioCtx.unknownEnd).slice(0, 16)));
  else if (ratioCtx && ratioCtx.unjudged) planWarnings.push(t('warn_ratio_unjudged')(twWorld, ratioCtx.ratio));
  // ⚖ Player Share (v6.3.0): one line per capped player whose cap was reached (the rest of their
  // free offs stay home) or passed by their own named pins (pins are never barred).
  for (const [name, cap] of shareCap) {
    const used = shareUsed.get(name) || 0, base = shareBase.get(name) || 0, pct = pshGet(name);
    if (used > cap) planWarnings.push(t('warn_share_pins')(name, pct, used, cap));
    else if (used === cap && base > cap) planWarnings.push(t('warn_share_reached')(name, pct, used, base));
  }

  // Off-pool breakdown for the Plan summary footer, split PER OFF TIER (Complete / 3-4 /
  // 1-2) by each village's OWN tier. Computed HERE (after every off pass) so `usedOff` /
  // `isEscort` are final. Over OFF-CAPABLE villages only (tier !== 'none' — a defensive/empty
  // village isn't an off). The buckets PARTITION each tier's gross village count so the footer
  // reconciles exactly: gross[tier] = assigned + heldDist + heldEnemy + heldNoble + heldSplit + heldLate + far + outside + avail + ignored
  //   + heldPrior + heldOut + heldShare.
  //   • ignored    = excluded from the pool by the Ignore Coordinates / Ignore Players lists
  //   • heldOut    = (v6.2.0) its off is away — held by "Exclude ALL Outbound Offs" (outbound on the
  //                  Outbound Offs tab, in flight or still returning in Returning Offs, and not
  //                  re-admitted by a home-time floor). Tested FIRST: it is usedOff, but not assigned.
  //   • heldPrior  = committed / held by another offensive plan slot (v6.1.0)
  //   • outside    = off-capable, NOT ignored, but outside the sender area (typed coord filters
  //                  or the drawn polygon) — so it never enters the pool at all. Counted from the
  //                  full roster here since the pool is already area-filtered. (was uncounted pre-v4.22)
  //   • assigned   = an off committed in the plan (usedOff, not the escort)
  //   • split-off  = the village whose off rides WITH a noble as the escort (usedOff + isEscort)
  //   • noble launch = a launch village held free for the noble (snobReserved, not used)
  //   • distance   = the blanket minDist holdback (tooClose), not otherwise used/reserved
  //   • enemy tribes = held by the Enemy Tribes radius (nearEnemy) — a SEPARATE bucket from
  //                  `distance` so the footer says which of the two knobs held the village
  //   • far        = free, in-area, but beyond MAX distance of every target (can't reach anything)
  //   • heldShare  = (v6.3.0) would be `avail`, but its player reached their ⚖ Player Share cap
  //   • avail      = free, in-area, in-band AND in time for some target → genuinely deployable now
  //                  (the "did I leave usable offs on the table?" number; ideally near 0)
  // A village counts as RESERVED for a split-off / noble launch if it's in the reservation
  // set, whether or not the snob loop ended up launching from it — an escort the engine held
  // back is off-limits to the off passes (offBlocked), so it's "reserved", NOT "unused".
  // That's why the held buckets key on escortReserved/snobReserved (plus the actual launched
  // escort via isEscort), so `unused` means genuinely free, and the partition still reconciles.
  // (offLate / offFar — the heldLate / far tests — are defined above the ⚖ Player Share block, which uses them too.)
  planStats = emptyPlanStats();
  for (const v of villages) {
    const tier = getOffTier(v.offPow);
    if (tier === 'none') continue;
    if (ignoreCoords.has(v.coord) || ignorePlayers.has(v.player)) { planStats[tier].ignored++; continue; }
    // Off-capable, not ignored, but the typed coord filters / drawn polygon keep it out of the
    // (already area-filtered) pool → "outside draw area". Counted here from the full roster.
    const c = parseCoordStr(v.coord);
    if (!c || !passesCoordFilters(c, planCoordFilters) || !passesCoordPolygon(c.x, c.y)) planStats[tier].outside++;
  }
  for (const p of pool) {
    if (p.tier === 'none') continue;                                          // not an off
    if (ignorePlayers.has(p.v.player)) continue;                              // counted under `ignored` above (now in pool, but barred from offs)
    const s = planStats[p.tier];
    if (p.heldOut)                                          s.heldOut++;       // its off is away — Exclude ALL Outbound Offs (v6.2.0)
    else if (p.prior || priorReserved.has(p.v.coord))       s.heldPrior++;     // committed / held by another offensive slot (v6.1.0)
    else if (escortReserved.has(p) || (p.usedOff && p.isEscort)) s.heldSplit++; // reserved for / riding as a split-off escort
    else if (snobReserved.has(p))                           s.heldNoble++;     // held free for a noble launch
    else if (p.usedOff)                                     s.assigned++;      // an off committed in the plan
    else if (tooClose.has(p))                               s.heldDist++;      // blanket min-distance holdback
    else if (nearEnemy.has(p))                              s.heldEnemy++;     // inside the Enemy Tribes radius
    else if (offLate(p))                                    s.heldLate++;      // reachable by distance but too late everywhere
    else if (offFar(p))                                     s.far++;           // free, in-area, but beyond max distance of every target
    else if (shareCapped(p))                                s.heldShare++;     // deployable, but its player is at their ⚖ Player Share (v6.3.0)
    else                                                    s.avail++;         // free, in-area, in-band, in time → deployable now
  }
  // ↩ Informational, last in the list (v6.2.0): what the two Returning Offs toggles did. Counted
  // over the same villages as the footer (off-capable, not an ignored player), so the first count
  // equals the summed heldOut buckets; the second = held-away villages a home-time floor let back in.
  const roCounted = p => p.tier !== 'none' && !ignorePlayers.has(p.v.player);
  const nHeldOut = pool.filter(p => p.heldOut && roCounted(p)).length;
  const nReadmitted = pool.filter(p => p.readmitted && roCounted(p)).length;
  if (nHeldOut) planWarnings.push(t('warn_outbound_excluded')(nHeldOut));
  if (nReadmitted) planWarnings.push(t('warn_returning_floor')(nReadmitted));

  saveOffensive();
  renderPlanTable();
  if (typeof cloudSyncPlan === 'function') cloudSyncPlan(); // hosted-site cloud save of the JSON snapshot
}

function delPlanRow(i) { planRows.splice(i, 1); saveOffensive(); renderPlanTable(); }

// Wipe the generated offensive plan — the ACTIVE slot only (mirrors clearOffTargets). Confirms
// only when there's a plan to lose; resets the same state generatePlan() rebuilds, then re-renders empty.
function clearPlan() {
  if (planRows.length && !confirm(t('confirm_clear_plan'))) return;
  planRows = []; planWarnings = []; planReserved = [];
  planStats = emptyPlanStats();
  saveOffensive(); renderPlanTable();
}

// ── 💾 Offensive plan slot bar (Plan Offensive, v6.1.0) ─────────────────────────────────────
// Active-slot <select>, an optional name, ➕ New offensive / 🗑 Delete offensive and a hint line
// saying what the OTHER slots hold back from this one. Re-rendered with the plan table (so it
// follows a language switch too). No-op without its host (headless harness, attack-planner).
function renderOffPlanSlots() {
  const host = document.getElementById('plan-slots');
  if (!host) return;
  offPlanSync();
  const act = offPlanActiveSlot();
  const nAtt = s => (s.rows || []).filter(r => !r.unassigned).length;
  const opts = offPlans.map(s => `<option value="${s.id}"${s.id === offPlanActive ? ' selected' : ''}>${esc(t('plan_slot_opt')(offPlanLabel(s), nAtt(s)))}</option>`).join('');
  const prior = offPlanPriorUsage();
  const hint = offPlans.length > 1 ? t('plan_slot_hint')(prior.nSlots, prior.nOffs, prior.nNobles, prior.nCats) : t('plan_slot_hint_single');
  host.innerHTML = `<span class="plan-slots-lbl">${esc(t('plan_slot_lbl'))}</span>`
    + `<select id="plan-slot-select" onchange="setOffPlanActive(this.value)" title="${esc(t('plan_slot_select_t'))}">${opts}</select>`
    + `<input id="plan-slot-name" type="text" maxlength="40" value="${esc(act.name || '')}" placeholder="${esc(t('plan_slot_name_ph'))}" title="${esc(t('plan_slot_name_t'))}" onchange="renameOffPlan(${act.id}, this.value)">`
    + `<button class="btn btn-ghost btn-sm" onclick="newOffPlan()" title="${esc(t('btn_plan_slot_new_t'))}">${esc(t('btn_plan_slot_new'))}</button>`
    + (offPlans.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="deleteOffPlan(${act.id})" title="${esc(t('btn_plan_slot_del_t'))}">${esc(t('btn_plan_slot_del'))}</button>` : '')
    + `<span class="plan-slots-hint">${esc(hint)}</span>`;
}

function renderPlanTable() {
  // Rebuild the Coordinate Filter rows (also refreshes them on a language switch, since
  // renderPlanTable runs from changeLang). Guarded + no-ops without its host element.
  if (typeof renderCoordFilters === 'function') renderCoordFilters();
  renderOffPlanSlots();
  if (typeof renderRatioNote === 'function') renderRatioNote(); // ⚔ the world's attack ratio (v6.5.0)
  // Warnings can be many; render them collapsed (count in the summary) so they
  // don't bury the plan table. Native <details> — no JS, works under file://.
  document.getElementById('plan-warnings').innerHTML = planWarnings.length
    ? `<details class="warn-box"><summary>${t('plan_warnings_toggle')(planWarnings.length)}</summary>`
      + `<div class="warn-list">${planWarnings.map(esc).join('<br>')}</div></details>` : '';
  const assigned = planRows.filter(r => !r.unassigned).length;
  // Per-tier off breakdown next to the attack tally. Every number comes from planStats
  // (computed in generatePlan), whose six buckets partition each tier's gross village count,
  // so each segment reconciles: assigned + held(distance/noble/split/other offensives) + unused + ignored = [N].
  const TIER_BADGE = { complete: 'badge-complete', tq: 'badge-tq', half: 'badge-half' };
  let summary = planRows.length ? esc(t('plan_summary')(assigned, planRows.length - assigned)) : '';
  if (planRows.length && planStats) {
    // One line per off tier, behind a collapsible toggle (native <details>, file://-safe).
    const segs = ['complete', 'tq', 'half'].map(tier => {
      // A plan saved before v5.10.0 has no `heldEnemy` — the string treats it as 0.
      const s = planStats[tier] || { assigned: 0, heldDist: 0, heldEnemy: 0, heldNoble: 0, heldSplit: 0, heldLate: 0, far: 0, outside: 0, avail: 0, ignored: 0, heldPrior: 0, heldOut: 0, heldShare: 0 };
      // [N] = gross count of villages of this tier tribe-wide (same denominator as the
      // Offensive Targets footer — total selectable offs, before any holdback/reservation).
      const gross = villages.filter(v => getOffTier(v.offPow) === tier).length;
      return `<span class="badge ${TIER_BADGE[tier]}">${t('tier_' + tier)} [${gross}]</span> `
        + esc(t('plan_offs_summary')(s.assigned, s.heldDist, s.heldNoble, s.heldSplit, s.heldLate, s.far, s.outside, s.avail, s.ignored, s.heldEnemy, s.heldPrior, s.heldOut, s.heldShare));
    });
    summary += `<details style="margin-top:6px;"><summary style="cursor:pointer;">${esc(t('btn_show_off_counts'))}</summary>`
      + `<div style="margin-top:4px;line-height:1.9;">${segs.join('<br>')}</div></details>`;
  }
  document.getElementById('plan-summary').innerHTML = summary;

  const tbody = document.getElementById('plan-tbody');
  if (!planRows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="13">${t('empty_no_plan')}</td></tr>`;
    renderPlanDependents(); // an EMPTY active slot (new / cleared / deleted-to-empty) must reach Manage + Outbound too (v6.1.0)
    return;
  }
  let lastIdx = null;
  tbody.innerHTML = planRows.map((r, i) => {
    const first = r.tIdx !== lastIdx;
    lastIdx = r.tIdx;
    const badge = r.type === 'snob'
      ? `<span class="badge badge-snob"${r.fake ? ' style="background:#0a1828;color:#5fb85f;border:1px solid #2e7d2e;"' : ''}>${r.count > 1 ? r.count + 'x ' : ''}👑 ${t(r.fake ? 'type_snob_fake' : r.escorted ? 'type_snob_split' : 'type_snob')}</span>`
      : r.type === 'catapult'
      ? `<span class="badge" style="background:#5a3f6a;color:#e8d8f0;">${twIcon('catapult')} ${r.cats}</span>`
      : r.type === 'fake'
      ? `<span class="badge ttype-fake">${t('ttype_fake')}</span>`
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
          ? `<span style="color:#e0a020;font-weight:600;">${esc(t('plan_prepare_snob')(r.escorted))}${r.fake ? ` <span style="color:#0e8f0e;">(${esc(t('ttype_fake'))})</span>` : ''}</span>${snobRange}`
          : (r.unassigned
              ? `<span style="color:#e06040;">${t('bb_unassigned')}</span>`
              : esc(r.srcCoord) + (r.returning
                  ? ` <span class="plan-returning" title="${esc(t('plan_returning_title')(typeof fmtServerDT === 'function' ? fmtServerDT(r.homeMs) : ''))}">↩</span>` : ''))
      }</td>
      <td class="left">${r.srcPlayer ? `<span class="player-tag">${esc(r.srcPlayer)}</span>` : '—'}</td>
      <td style="color:${moraleColor(r.morale)};font-weight:600;">${isSnob ? '—' : fmtMorale(r.morale)}</td>
      <td style="color:#60a0e0;font-weight:600;font-family:monospace;">${
        // With several window groups the window alone is ambiguous — 01:00 on which day? — so the
        // cell also names the wave and its date. Single-group plans keep the bare window.
        otMultiGroup() && r.group != null
          ? `<span class="badge" style="font-size:9px;padding:0 4px;background:#2a1e08;color:#c8a060;">${esc(otLabelOf(r.group))}</span> ${esc(fmtWindow(r.window) || '—')}`
            + `<div style="font-size:10px;color:#806030;font-weight:400;">${esc(bbDateLabelOf(planRowDateISO(r)))}</div>`
          : esc(fmtWindow(r.window) || '—')
      }</td>
      <td style="color:#f0c040;">${showTiming ? r.dist.toFixed(1) : '—'}</td>
      <td>${showTiming ? fmtTime(r.travel) : '—'}</td>
      <td style="font-family:monospace;${r.late ? 'color:#e06040;font-weight:600;' : r.sched === 'blocked' ? 'color:#e0a040;font-weight:600;' : ''}"${r.sched === 'blocked' ? ` title="${esc(t('psc_blocked_title'))}"` : ''}>${showTiming ? (r.late ? '⚠ ' : '') + (r.sched === 'blocked' ? '⏰ ' : '') + launchWindowStr(r.window, r.travel, planRowDateISO(r)) : (r.sched === 'blocked' ? '⏰ ' : '') + '—'}</td>
      <td>${(() => { const url = showTiming ? rallyUrl(r.srcCoord, r.tCoord, planRowRallyUnits(r)) : null; return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">⚔</a>` : '—'; })()}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="delPlanRow(${i})">✕</button></td>
    </tr>`;
  }).join('');
  renderPlanDependents();
}
// The Outbound Offs tab shows each sender's assigned target (Off Target / Target Player columns),
// so any plan change must repaint it too; Manage Offensive matches the imported incoming orders
// against the plan (all slots) — same deal. Cheap + idempotent.
function renderPlanDependents() {
  if (typeof renderOutboundTable === 'function') renderOutboundTable();
  if (typeof renderManageTable === 'function') renderManageTable();
  if (typeof renderReturningTable === 'function') renderReturningTable(); // ↩ v6.2.0 (repaints with every plan / language render)
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

// Rally-link unit preset for a plan row: catapult attacks preset their cat count, fakes preset
// their single ram; regular offs and snob trains preset nothing (the player picks the troops).
// Shared by the plan table's ⚔ link and both per-player exports.
function planRowRallyUnits(r) {
  if (r.type === 'catapult') return { catapult: r.cats };
  if (r.type === 'fake') return { ram: Math.max(1, PARAMS.fakeRams) }; // same floor as the fake source gate (≥ 1 ram)
  return undefined;
}

// ── BB icon helper (shared by both export functions) ──
function planRowIconBB(r) {
  if (r.type === 'snob') {
    // A FAKE noble train is a bare decoy — mark it with a bold GREEN "(FAKE)" tag (the same
    // green fake OFFs use on their launch line) so nobody sends a real escort with it. Snob
    // lines have no launch-time line to carry the colour, so it rides on the tag here.
    if (r.fake) return `[unit]snob[/unit] [b][color=#0e8f0e](${t('ttype_fake')})[/color][/b]`;
    return r.escorted ? '[unit]axe[/unit][unit]snob[/unit]' : '[unit]snob[/unit]';
  }
  if (r.type === 'catapult') return '[unit]catapult[/unit]';
  // A fake rides a lone ram behind a spy icon, with the tag in bold so nobody sends real troops.
  if (r.type === 'fake') return `[unit]spy[/unit][unit]ram[/unit] [b](${t('ttype_fake')})[/b]`;
  // Complete offs stay rams; 3/4 and 1/2 use axe with the tier tagged in parens.
  if (r.type === 'complete') return '[unit]ram[/unit]';
  return `[unit]axe[/unit] (${t('tier_' + r.type)})`;
}

// ── Export the plan's target coordinates (one per line) ──
// Exactly the paste format the "Target Village Orders Exporter" userscript
// (incomingOrders.js) expects; its .txt/.json export then feeds the Manage
// Offensive tab. Unique coords, plan order — across EVERY offensive slot (v6.1.0), since Manage
// Offensive checks all of them together.
function exportPlanCoords() {
  const all = offPlanAllRows();
  if (!all.length) { alert(t('empty_no_plan')); return; }
  const coords = [...new Set(all.map(r => r.tCoord))];
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
function planGroups(rows) {
  const groups = [];
  for (const r of (rows || planRows)) {
    let g = groups.find(x => x.idx === r.tIdx);
    if (!g) { g = { idx: r.tIdx, coord: r.tCoord, player: r.tPlayer, rows: [] }; groups.push(g); }
    g.rows.push(r);
  }
  return groups;
}
// ── Window groups present in the plan, as export sections ─────────────────────
// Returns [{g, label, rows}] in group order, skipping groups this plan has no rows for.
// A single-group plan yields exactly one section. Since v6.6.1 no export prints a section per
// wave any more — the Forum export only uses the section order to list each objective's rows
// wave by wave, and every export dates its lines with planRowDatesOf() / planRowsMultiDate().
function planWindowSections(rows) {
  const src = rows || planRows;
  const known = new Set(otGroups().map(g => g.id));
  // Rows saved before v5.9 carry no group, and a plan generated before a group was deleted can
  // carry an id that no longer exists. Either way they are real orders, so they join the FIRST
  // section rather than being silently dropped from every export.
  const orphan = r => r.group == null || !known.has(r.group);
  return otGroups()
    .map((g, i) => ({
      g, label: otGroupLabel(i),
      rows: src.filter(r => r.group === g.id || (i === 0 && orphan(r))),
    }))
    .filter(s => s.rows.length);
}
// Distinct arrival dates of a set of plan rows, chronological (ISO strings sort right).
// Dateless rows (no group date set) contribute nothing — callers fall back to bbDateLabel().
function planRowDatesOf(rows) {
  return [...new Set((rows || []).map(planRowDateISO).filter(Boolean))].sort();
}
// TRUE when a set of rows must stamp each order line with its landing day-of-month: more
// than one distinct date, or dated rows mixed with dateless ones (a group missing its date).
// In the mixed case the dateless lines come out visibly UNSTAMPED next to stamped ones,
// instead of silently reading as if they landed on the header's date. All-dateless plans
// (legacy free-text label) never stamp — that keeps their output byte-identical.
function planRowsMultiDate(rows) {
  const dates = planRowDatesOf(rows);
  return dates.length > 1 || (dates.length > 0 && (rows || []).some(r => !planRowDateISO(r)));
}

// ── Forum-style BB row (shared by the Forum export and the per-player objective context) ──
// A pinned-but-unplaced sender keeps their name; a truly anonymous unassigned row falls back
// to the UNASSIGNED label. Snob trains never name an origin — just the "Prepare Snob Train"
// call-out (the target is the group header above). `bare` (the Plan Offensive Forum export)
// drops the "Villages in snob range" trailing line — that detail lives in the Per-Player Orders
// export, so the tribe-wide Forum post shows just the snob + the assigned player + window. The
// per-player objective-context dump leaves `bare` false and keeps the range line. `withDay`
// prefixes the window with its landing day-of-month ("25 · 10:00/20:00", planRowDayStamp) —
// the Forum post lists every wave of an objective together, so a multi-date plan must say per
// line which day it lands on.
function planRowForumBB(r, multiSnob, bare, withDay) {
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
  return `${prefix}${iconBB} ${who}${prep} [b][color=#0000a5]${planRowDayStamp(r, fmtWindow(r.window) || '??:??', withDay)}[/color][/b]${range}`;
}

// ── Forum BB export (matches the tribe's offensive post format) ──
// Pure seam: the post as [{text, rows}] — one block per objective, in post order, `rows` = its
// order lines. The ARRIVAL DATE header + legend are GLUED onto objective 1 (like the player
// header in defPmMessagesFrom), so they open the first post and never become a post of their
// own. Every block text ends in '\n', so joining them with '\n' rebuilds the unsplit post
// byte for byte. [] when the plan has no rows.
function planForumBlocks(rows) {
  const sections = planWindowSections(rows);
  if (!sections.length) return [];

  const nobleCounts = [...new Set(offTargets.flatMap(x => otGroups().map(g => otSnobCount(x, g.id, 'nobles'))).filter(Boolean))].sort((a, b) => a - b);
  const noblesLabel = nobleCounts.length ? nobleCounts.join(' ó ') : String(PARAMS.noblesDefault);

  // Every target is ONE objective, whatever the number of window groups (v6.6.1 — the per-wave
  // sections repeated an objective once per wave it is hit in). The single ARRIVAL DATE header
  // lists every date the plan lands on (" & "-joined, chronological, like the per-player blocks),
  // and when there are several, each line's window carries its landing day-of-month. The dates
  // are the ones the ROWS were stamped with at generation (planRowDateISO), so a frozen offensive
  // slot (v6.1.0) keeps its own dates after the groups were re-dated for the next offensive.
  // A single-date plan prints no day prefixes; a single-group plan's output is unchanged.
  const dates   = planRowDatesOf(rows);
  const withDay = planRowsMultiDate(rows);
  let head = `[size=16][b][u]${t('bb_arrival_date')}:[/u][/b] ${dates.length ? dates.map(bbDateLabelOf).join(' & ') : bbDateLabelOf(sections[0].g.dateISO)}[/size]\n\n`;
  head += `[unit]ram[/unit] --> ${t('bb_legend_ram')}\n`;
  if (rows.some(r => r.type === 'tq')) head += `[unit]axe[/unit] (${t('tier_tq')}) --> ${t('bb_legend_tq')}\n`;
  if (rows.some(r => r.type === 'half')) head += `[unit]axe[/unit] (${t('tier_half')}) --> ${t('bb_legend_axe')}\n`;
  if (rows.some(r => r.type === 'catapult')) head += `[unit]catapult[/unit] --> ${t('bb_legend_cat')}\n`;
  if (rows.some(r => r.type === 'fake')) head += `[unit]spy[/unit][unit]ram[/unit] [b](${t('ttype_fake')})[/b] --> ${t('bb_legend_fake')}\n`;
  if (rows.some(r => r.type === 'snob' && !r.escorted && !r.fake)) head += `[unit]snob[/unit] --> ${t('bb_legend_snob')(noblesLabel)}\n`;
  if (rows.some(r => r.type === 'snob' && r.escorted)) head += `[unit]axe[/unit][unit]snob[/unit] --> ${t('bb_legend_split')(noblesLabel)}\n`;
  if (rows.some(r => r.type === 'snob' && r.fake)) head += `[unit]snob[/unit] [b][color=#0e8f0e](${t('ttype_fake')})[/color][/b] --> ${t('bb_legend_snob_fake')(noblesLabel)}\n`;
  head += '\n';

  // Objectives keep the plan's target order; inside one, its rows run wave by wave in group
  // order (planWindowSections — rows of a deleted or pre-v5.9 group count as the first wave).
  const wave = new Map();
  sections.forEach((sec, si) => sec.rows.forEach(r => wave.set(r, si)));
  return planGroups(rows).map((g, gi) => {
    g.rows.sort((a, b) => wave.get(a) - wave.get(b)); // stable: a wave keeps its own row order
    let bb = gi === 0 ? head : '';
    bb += `${gi + 1}. ${g.coord}${g.player ? ` - [player]${g.player}[/player]` : ''}\n`;
    const multiSnob = g.rows.filter(x => x.type === 'snob').length > 1;
    for (const r of g.rows) bb += planRowForumBB(r, multiSnob, true, withDay) + '\n';
    return { text: bb, rows: g.rows.length };
  });
}

// The post packed into forum messages under the bracket budget (v6.6.2, 🎚 PARAMS.forumMaxBrackets,
// default 4950 — the game refuses a post with more than 5,000 "[", "Demasiados corchetes").
// Same greedy packer as the defense PMs (pmSplitParts), on whole objectives only, so an objective
// never straddles two posts and the numbering runs straight through them. The FEWEST posts the
// budget allows, then evened out: the smallest budget that still packs into that many, so the
// last post isn't a stub of a few objectives. An objective alone over the budget ships as its own
// post (nothing smaller to split to) — then plain greedy, since evening out would start above the
// budget. Returns [{text, orders}] (orders = order lines in that post). Pure.
function planForumParts(blocks, maxBrackets) {
  maxBrackets = maxBrackets || PARAMS.forumMaxBrackets;
  const texts = blocks.map(b => b.text);
  let parts = pmSplitParts(texts, maxBrackets);
  const biggest = texts.reduce((m, s) => Math.max(m, pmBracketCount(s)), 0);
  if (parts.length > 1 && biggest <= maxBrackets) {
    let lo = biggest, hi = maxBrackets;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (pmSplitParts(texts, mid).length <= parts.length) hi = mid; else lo = mid + 1;
    }
    parts = pmSplitParts(texts, lo);
  }
  // A post is consecutive blocks joined by '\n': walk the blocks by length to count its orders.
  let bi = 0;
  return parts.map(text => {
    let len = -1, orders = 0;
    while (bi < blocks.length && len < text.length) { len += blocks[bi].text.length + 1; orders += blocks[bi++].rows; }
    return { text, orders };
  });
}

function showPlanBB() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }
  const blocks = planForumBlocks(planRows);
  if (!blocks.length) { alert(t('empty_no_plan')); return; }
  const posts = planForumParts(blocks);
  if (posts.length === 1) {
    document.getElementById('bb-output').value = posts[0].text.trimEnd() + '\n';
    document.getElementById('bb-modal').classList.add('open');
    return;
  }
  // Too many brackets for one post: one copy button per post, in posting order, plus the whole
  // list in one piece — the Attack Planner import has no bracket limit and reads it in one paste.
  renderPmModal([
    { player: t('forum_post_label'), parts: posts.map(p => p.text.trimEnd()), orderCounts: posts.map(p => p.orders) },
    { player: t('forum_whole_label'), parts: [blocks.map(b => b.text).join('\n').trimEnd()], orderCount: blocks.reduce((n, b) => n + b.rows, 0) },
  ], t('forum_split_hint')(posts.length, PARAMS.forumMaxBrackets), '', 'forum_split_title');
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ FORMAT CONTRACT — attack-planner.html IMPORTS the exports below.
// parsePlayerPlanBB() in attack-planner.html parses the Per-Player Orders / Per-Player All
// output line by line: the "========== NAME (n) ==========" sender headers (ONE per player —
// since v5.12 a multi-wave plan merges every wave into the player's single block), the ARRIVAL
// DATE header (bbDateLabelOf labels, " & "-joined when the block spans several dates — the
// importer reads every day-of-month on the line), off lines ("src → [coord]tgt [/coord]
// (defender) window" — in a multi-date block the blue window carries a "<day> · " day-of-month
// prefix, see planRowWindowBB, which dates that attack individually), the LAUNCH TIME
// continuation line (rally URL → village-ID pins), and snob order lines ("Prepare Snob Train
// for [coord]…", detected by [unit]snob[/unit] + a [coord] tag; same "<day> · " prefix rule).
// parseOffPlanBB() likewise parses the Forum BB export (showPlanBB's "N. X|Y - Player."
// groups — one per target since v6.6.1, under ONE ARRIVAL DATE header that " & "-joins every
// date; in a multi-date plan each row's blue window carries the same "<day> · " prefix, see
// planRowDayStamp, which dates that row individually). Lines meant to be IGNORED by the
// importer rely on staying structurally distinct: objective-context rows have no "→ [coord]"
// and their snob rows have no [coord]; snob-range and UNASSIGNED lines use bare coords only.
// → If you change the SHAPE of anything emitted here (playerPlanBBBlock, planRowWindowBB,
//   planRowDayStamp, snobOrderLineBB, planRowForumBB, unassignedPlanBBBlock, bbDateLabelOf,
//   showPlanBB), update the attack-planner importer + tests/test_attack_import.js in the same
//   change. Cosmetic changes (colors, bold, labels) are safe — the importer anchors on
//   structure, never on presentation tags.
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
function snobOrderLineBB(r, withDay) {
  const iconBB   = planRowIconBB(r);
  const prefix   = r.count > 1 ? `${r.count}x ` : '';
  const prep     = t('plan_prepare_snob')(r.escorted, `[coord]${r.tCoord}[/coord]`);
  const defender = r.tPlayer ? ` ([player]${r.tPlayer}[/player])` : '';
  const rt       = snobRangeText(r);
  const range    = rt ? `\n${rt}` : '';
  // needNobles rows are no longer flagged — "Prepare Snob Train" already implies recruiting one.
  return `${prefix}${iconBB} ${prep}${defender} [b][color=#2e2eff]${planRowWindowBB(r, withDay)}[/color][/b]${range}`;
}

// A plan row's blue arrival window for the per-player order lines ("01:00-02:00"), prefixed
// with its landing day-of-month ("12 · 01:00-02:00") when `withDay` — a block that spans
// several arrival dates must say per line which day each attack lands on. Single-date blocks
// never carry the prefix, keeping their output identical to the pre-v5.12 shape.
// ⚠ FORMAT CONTRACT: windowAfterCoord() in the attack-planner importer parses this exact
// "<day> · " prefix to date each requirement individually — change the two in lockstep.
function planRowWindowBB(r, withDay) {
  return planRowDayStamp(r, (fmtWindow(r.window) || '??:??').replace('/', '-'), withDay);
}
// `win` prefixed with the row's landing day-of-month ("12 · …") when `withDay`. Shared by the
// per-player lines (planRowWindowBB) and the Forum rows (planRowForumBB, which keep their "/").
// ⚠ FORMAT CONTRACT: windowAfterCoord() and parseOffPlanBB() in the attack-planner importer
// read this "<day> · " prefix.
function planRowDayStamp(r, win, withDay) {
  const day = withDay ? parseInt(String(planRowDateISO(r) || '').slice(8), 10) : NaN;
  return isNaN(day) ? win : `${day} · ${win}`;
}

// ── One player's Orders block: header + arrival date(s) + order lines + (if they send a
//    snob) the full objective-context dump. `allGroups` = planGroups() (passed in so the
//    caller builds it once). Ends with a trailing blank line, matching the legacy layout.
//    Shared by the on-screen Per-Player Orders export, the ✉ PM export and the combined
//    Per-Player All download. ──
// Whatever the number of window groups, a player gets exactly ONE block (v5.12 — the per-wave
// blocks made players hop between blocks to send in departure order): the ARRIVAL DATE header
// lists every date the player's orders land on (" & "-joined, chronological) and the lines are
// sorted by absolute departure time across the whole set. When the block spans several dates,
// every order line's blue arrival window carries its landing day-of-month ("12 · 05:00-06:00",
// planRowWindowBB) — the attack-planner importer dates each requirement from that prefix. A
// single-date plan emits no prefixes and stays byte-identical to the pre-v5.9 output.
function playerPlanBBBlock(name, rows, allGroups) {
  const dates    = planRowDatesOf(rows);
  const withDay  = planRowsMultiDate(rows);
  let bb = `========== ${name} (${rows.length}) ==========\n`;
  bb += `[b][u]${t('bb_arrival_date')}:[/u][/b] ${dates.length ? dates.map(bbDateLabelOf).join(' & ') : bbDateLabel()}\n\n`;
  // Order lines come out send-time-sorted (earliest launch first) ACROSS dates, matching the
  // Per-Player Table, with a blank line between each attack. planRowsBySendTime keys on the
  // absolute epoch (each row's own arrival date − travel), so a two-day plan interleaves
  // correctly. Side-effect free.
  const lines = [];
  for (const r of planRowsBySendTime(rows)) {
    const iconBB   = planRowIconBB(r);
    const prefix   = r.type === 'snob' && r.count > 1 ? `${r.count}x ` : '';
    const defender = r.tPlayer ? ` ([player]${r.tPlayer}[/player])` : '';

    if (r.type === 'snob') {
      // Snob trains never name an origin village — just a "Prepare Snob Train for <target>"
      // call-out + arrival window + the in-range village list (shared with the Table export).
      lines.push(snobOrderLineBB(r, withDay));
      continue;
    }

    // ── Offs (always assigned in this per-player section; unassigned offs have no
    //    sender and fall to the UNASSIGNED block below) ──
    // Catapult attacks preset their catapult count in the rally link and show it in bold parens.
    const url     = rallyUrl(r.srcCoord, r.tCoord, planRowRallyUnits(r));
    const urlPart = url ? ` — [url=${url}]${t('bb_pp_attack_url')}▶[/url]` : '';
    // Catapult rows show their cat count (+ target building); off rows show their Catapult Mode
    // building objective alone. Both render as a bold parenthetical after the unit icon.
    const bldg    = catTargetLabel(r);
    const catPart = r.type === 'catapult'
      ? ` [b](${r.cats}${bldg ? ` → ${bldg}` : ''})[/b]`
      : (bldg ? ` [b](→ ${bldg})[/b]` : '');
    const win     = planRowWindowBB(r, withDay);
    const lp      = launchWindowParts(r.window, r.travel, planRowDateISO(r));
    // Line 1 = village → target + arrival window; line 2 = the launch-time call-out (carries the
    // rally link) — red for real attacks, green for fakes. [b] opens on line 1, closes after it.
    const launchColor = r.type === 'fake' ? '#0e8f0e' : '#ff0e0e';
    const launch  = lp
      ? `\n${t('bb_pp_launchline')(lp.day, `[color=${launchColor}]${lp.span}[/color]`, lp.single, launchColor)}${urlPart}[/b]`
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
    const label = r.type === 'snob' ? (r.fake ? t('type_snob_fake') : t('type_snob')) : t('tier_' + r.type);
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

// ── Per-player Orders as one-click PM buttons (mirrors Plan Defense's ✉ Export PMs) ──
// Pure seam: [{player, parts:[blockText], orderCount}] from the current plan, players A→Z
// (same grouping/content as showPlayerPlanBB). Each player's FULL Orders block (header +
// send-time-sorted order lines + objective-context dump) ships as ONE clipboard message —
// never bracket-split, so the attack-planner re-import always sees a complete block (a single
// player never approaches the ~5,000-bracket PM limit). orderCount is the player's real
// attack/snob count for the meta line — the block's raw line count would over-report it
// (header + blank lines + objective context). Unassigned rows ride a final catch-all entry so
// nothing is lost vs the textarea export (there's no one to PM, but the list stays copyable).
function offPmMessagesFrom(planRows, allGroups) {
  const rows0      = planRows || [];
  const named      = rows0.filter(r => r.srcPlayer);
  const unassigned = rows0.filter(r => !r.srcPlayer);
  const byPlayer   = groupPlanRowsByPlayer(named);
  const msgs = playerNamesAZ(byPlayer).map(name => {
    const rows = byPlayer[name];
    // `dates` = the player's own arrival dates (ISO, chronological) — the PM template's {date}
    // placeholder names THIS player's day(s), not the whole plan's.
    return { player: name, parts: [playerPlanBBBlock(name, rows, allGroups).trimEnd()], orderCount: rows.length, dates: planRowDatesOf(rows) };
  });
  if (unassigned.length)
    msgs.push({ player: t('bb_unassigned'), parts: [unassignedPlanBBBlock(unassigned).trimEnd()], orderCount: unassigned.length, unassigned: true });
  return msgs;
}
function showPlayerPlanPm() {
  if (!planRows.length) { alert(t('empty_no_plan')); return; }
  // Named players get the PM template wrapper; the UNASSIGNED catch-all stays raw (there is
  // no one to greet). Wrapping happens here, at render time, so the meta line (chars /
  // brackets) always reports the real message being copied.
  pmTplCtx = 'off';
  const tpl  = pmTemplateCurrent('off');
  // {date} substitutes each player's OWN arrival date(s) (" & "-joined like the block header);
  // a plan with no date set keeps the legacy free-text label.
  const dateFor = m => ((m.dates || []).length ? m.dates.map(bbDateLabelOf).join(' & ') : bbDateLabel()).toUpperCase();
  const msgs = offPmMessagesFrom(planRows, planGroups()).map(m =>
    m.unassigned ? m : { ...m, parts: m.parts.map((p, k) => pmApplyTemplate(tpl, p, dateFor(m), pmPartLabel(k, m.parts.length))) });
  renderPmModal(msgs, t('pm_hint_off'), pmTemplateBarHtml());
}

// ── 📝 PM template (v4.23.0 offensive / v4.24.0 defensive): optional wrapper around each
// copied per-player PM. Plain text with three placeholders: {orders} → the player's full
// Orders block, {date} → the plan's arrival date as an uppercase bbDateLabel ("SÁBADO 25",
// offensive only — the defensive plan has no date input), {part} → " k/n" when a player's
// orders split across several PMs (defense's bracket packing), '' otherwise. One template
// per plan side, each stored raw under its own localStorage key shared by both UI languages
// (ops are written in the tribe's language); nothing stored = the current language's
// default. Saving an EMPTY template disables wrapping without losing the default (Reset
// brings it back). The editor UI (pmTemplateBarHtml + handlers) is shared — pmTplCtx says
// which side's template it edits, set by the show*Pm opener that built the modal.
// v5.14.1: keys carry the tw_tribe prefix so the templates ride along in the Backup & Debug
// export, its import AND the hosted cloud snapshot (all three collect tw_tribe* wholesale).
// Pre-v5.14.1 saves used tw_pm_template / tw_pm_template_def — pmTplMigrateKeys() moves them
// once at startup (init block), so a customized template is never lost by the rename.
const PM_TPL_KEYS     = { off: 'tw_tribe_pm_template', def: 'tw_tribe_pm_template_def' };
const PM_TPL_KEYS_OLD = { off: 'tw_pm_template', def: 'tw_pm_template_def' };
const PM_TPL_DEFAULTS = { off: 'pm_tpl_default', def: 'pm_tpl_def_default' };
let pmTplCtx = 'off';
// One-time move of each old-key template to its new key. A template already under the new key
// wins (the old copy is just dropped) — an imported backup must not be overwritten by a stale
// local leftover. Returns the number of templates moved (headless-testable).
function pmTplMigrateKeys() {
  let moved = 0;
  for (const ctx of Object.keys(PM_TPL_KEYS_OLD)) {
    try {
      const old = localStorage.getItem(PM_TPL_KEYS_OLD[ctx]);
      if (old == null) continue;
      if (localStorage.getItem(PM_TPL_KEYS[ctx]) == null) { localStorage.setItem(PM_TPL_KEYS[ctx], old); moved++; }
      localStorage.removeItem(PM_TPL_KEYS_OLD[ctx]);
    } catch (e) {}
  }
  return moved;
}
function pmTemplateCurrent(ctx) {
  ctx = ctx || pmTplCtx;
  let s = null;
  try { s = localStorage.getItem(PM_TPL_KEYS[ctx]); } catch (e) {}
  return s == null ? t(PM_TPL_DEFAULTS[ctx]) : s;
}
// " k/n" spoiler/label suffix for part k (0-based) of n; single-part players get ''. Pure.
function pmPartLabel(k, n) { return n > 1 ? ` ${k + 1}/${n}` : ''; }
// Substitute the placeholders. {orders} is forced onto its own line(s) even when the template
// glues it inline ("[spoiler=…]{orders}[/spoiler]") — the attack-planner re-import anchors the
// "========== NAME (n) ==========" header at line START, so the block must never share a line
// with template text. {date} only substitutes when a label exists (no arrival date set → the
// literal {date} stays visible as a fill-me-in flag). A template without {orders} appends the
// block at the end — orders must never be lost; a blank template returns them unwrapped. Pure.
// Splice `block` in at every occurrence of `token`, forcing it onto its own line(s) even when
// the template glues it inline. Returns null when the token isn't present, so callers can pick
// their own fallback (append vs skip). Pure.
function pmSpliceBlock(tpl, token, block) {
  const parts = tpl.split(token);
  if (parts.length === 1) return null;
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    if (out && !out.endsWith('\n')) out += '\n';
    out += block;
    if (parts[i] && !parts[i].startsWith('\n')) out += '\n';
    out += parts[i];
  }
  return out;
}
function pmApplyTemplate(tpl, orders, dateLabel, partLabel, summaryTable) {
  tpl = String(tpl == null ? '' : tpl);
  if (!tpl.trim()) return orders;
  tpl = tpl.split('{part}').join(partLabel || '');
  if (dateLabel) tpl = tpl.split('{date}').join(dateLabel);
  // {bb_summary_table} (v4.25.0, defensive plan): the player's Export Summary Tables BB table.
  // Substituted BEFORE {orders} so its own line-anchoring is independent; a [table] must start
  // at line start to render in-game. Optional — unlike {orders} it is never appended when
  // absent, and with no table to insert (offensive PMs) the literal token stays visible as a
  // fill-me-in flag, exactly like {date} on the defensive side.
  if (summaryTable) tpl = pmSpliceBlock(tpl, '{bb_summary_table}', summaryTable) || tpl;
  return pmSpliceBlock(tpl, '{orders}', orders) || (tpl.trimEnd() + '\n\n' + orders);
}
// The 📝 Template button + collapsed editor injected at the top of the PM modal body
// (offensive export only — renderPmModal's topHtml hook). Handlers are globals below.
// The placeholders that actually DO something on a given plan side, as [token, explanation]
// pairs — {date} is offensive-only (the defensive plan has no arrival-date input) and
// {bb_summary_table} is defensive-only, so each side lists only its own: a token that silently
// stays literal is worse than not being offered. Built fresh per call so a language switch is
// picked up, and the t() calls are literal so find_orphan_i18n.js can see the keys. Pure.
function pmTplVars(ctx) {
  const orders = ['{orders}', t('pm_tpl_var_orders')];
  const part   = ['{part}',   t('pm_tpl_var_part')];
  return ctx === 'def'
    ? [orders, ['{bb_summary_table}', t('pm_tpl_var_summary')], part]
    : [orders, ['{date}', t('pm_tpl_var_date')], part];
}
function pmTemplateBarHtml() {
  const vars = pmTplVars(pmTplCtx).map(([token, desc]) =>
    `<li><code>${esc(token)}</code><span>${esc(desc)}</span></li>`).join('');
  return `<div class="pm-tpl-bar"><button class="btn btn-ghost btn-sm" onclick="pmTplToggle()">${esc(t('btn_pm_template'))}</button></div>
<div class="pm-tpl-editor" id="pm-tpl-editor" style="display:none">
  <div class="pm-hint">${esc(t('pm_tpl_hint'))}</div>
  <div class="pm-tpl-vars">${esc(t('pm_tpl_vars_title'))}<ul>${vars}</ul></div>
  <textarea id="pm-tpl-text" class="pm-tpl-text" spellcheck="false"></textarea>
  <div class="pm-tpl-actions">
    <button class="btn btn-sm" onclick="pmTplSave()">${esc(t('btn_save'))}</button>
    <button class="btn btn-ghost btn-sm" onclick="pmTplReset()">${esc(t('pm_tpl_reset'))}</button>
  </div>
</div>`;
}
function pmTplToggle() {
  const ed = document.getElementById('pm-tpl-editor');
  if (!ed) return;
  const opening = ed.style.display === 'none';
  ed.style.display = opening ? '' : 'none';
  if (opening) document.getElementById('pm-tpl-text').value = pmTemplateCurrent();
}
function pmTplSave() {
  const ta = document.getElementById('pm-tpl-text');
  if (!ta) return;
  try {
    // Saving the untouched default stores nothing — the template keeps following the UI
    // language (and future default tweaks) until the user actually customizes it.
    if (ta.value === t(PM_TPL_DEFAULTS[pmTplCtx])) localStorage.removeItem(PM_TPL_KEYS[pmTplCtx]);
    else localStorage.setItem(PM_TPL_KEYS[pmTplCtx], ta.value);
  } catch (e) {}
  // Re-render with the new wrapper (meta counts update; copy-done marks reset).
  if (pmTplCtx === 'def') showDefPmExport(); else showPlayerPlanPm();
}
function pmTplReset() {
  const ta = document.getElementById('pm-tpl-text');
  if (ta) ta.value = t(PM_TPL_DEFAULTS[pmTplCtx]); // fills the editor only — Save persists it
}

// ── Per-player attack TABLE export (BB [table], one section per player) ─────────
// Type column = unit icon(s) + text: offs → "[unit]ram[/unit] Off" (half offs keep the
// axe icon), solo snob → "[unit]snob[/unit] Snob", escorted → "[unit]axe[/unit][unit]snob[/unit] Split Off Snob".
function planRowTableType(r) {
  if (r.type === 'snob') {
    if (r.fake) return `[unit]snob[/unit] ${t('tbl_type_snob_fake')}`;
    return r.escorted
      ? `[unit]axe[/unit][unit]snob[/unit] ${t('tbl_type_split')}`
      : `[unit]snob[/unit] ${t('tbl_type_snob')}`;
  }
  if (r.type === 'catapult') return `[unit]catapult[/unit] ${t('tbl_type_cat')} (${r.cats}${catTargetLabel(r) ? ` → ${catTargetLabel(r)}` : ''})`;
  if (r.type === 'fake') return `[unit]ram[/unit] ${t('tbl_type_fake')}`;
  return `${planRowIconBB(r)} ${t('tbl_type_off')}${catTargetLabel(r) ? ` (→ ${catTargetLabel(r)})` : ''}`;
}

// Absolute send/arrival server-wall times for a plan row. Arrival = the window's START
// (a single value for the table cell, matching the in-game export shape); send = arrival −
// travel, rounded like launchWindowStr's start (up into the window; nearest for a single
// exact time), so times end in :00. Both are real epoch instants shown on the server clock at
// that instant (DST-aware, like the gates); day-wrap falls out of the epoch math. Returns null
// if no arrival date is set or the window is unparseable — the caller then leaves the time
// cells blank.
function planRowAbsTimes(r) {
  const w = parseWindowStr(r.window);
  const arrMs = w ? windowStartMs(planRowDateISO(r), w) : null;
  if (arrMs === null) return null;
  const sendMs = launchStartMs(arrMs, w, r.travel);
  return { sendMs, send: fmtServerDT(sendMs), arrival: fmtServerDT(arrMs) };
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
    const url = r.srcCoord ? rallyUrl(r.srcCoord, r.tCoord, planRowRallyUnits(r)) : null;
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
// half of the Per-Player Table export, shown below the offs-only [table]. The day-of-month
// prefix follows the same rule as the Orders block: only when the PLAYER's full row set
// (passed in — not just the snobs) spans several arrival dates.
function planTableSnobLines(rows) {
  const snobs = rows.filter(r => r.type === 'snob');
  const withDay = planRowsMultiDate(rows);
  return snobs.length ? planRowsBySendTime(snobs).map(r => snobOrderLineBB(r, withDay)).join('\n') : '';
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
// off free, so it does NOT count as used — nor does a 1-ram FAKE (with 🎚 fakePool 'any' a
// village may fake without sending its off; the off is still there for another offensive).
// Sorted by off power, strongest first.
// `rows` defaults to the active plan; offPlanPriorUsage() passes the other slots' rows.
function planUsedOffCoords(rows) {
  const used = new Set();
  for (const r of (rows || planRows)) {
    if (r.type === 'catapult' || r.type === 'fake') continue; // catapults come from def villages; a fake spends 1 ram, not the off
    if (r.unassigned) { if (r.needNobles && r.recruitCoord) used.add(r.recruitCoord); continue; }
    if (r.type === 'snob') { if (r.escorted && r.srcCoord) used.add(r.srcCoord); }
    else if (r.srcCoord) used.add(r.srcCoord);
  }
  return used;
}

function unusedOffs() {
  // Across EVERY offensive slot (v6.1.0): an off committed or held in any offensive isn't free.
  offPlanSync();
  const used = new Set(), reserved = new Set(); // reserved = launch villages held for nobles — not free offs
  for (const s of offPlans) {
    for (const c of planUsedOffCoords(s.rows || [])) used.add(c);
    for (const c of (s.reserved || [])) reserved.add(c);
  }
  // With Force Players / Force Coords on, non-forced villages aren't part of the operation,
  // so they're not "unused offs" to offer as a second wave.
  const force = new Set(offForcePlayers);
  const forceCo = parseOffForceSet();
  return villages
    .filter(v => getOffTier(v.offPow) !== 'none' && !used.has(v.coord) && !reserved.has(v.coord)
      && (!force.size || force.has(v.player)) && (!forceCo.size || forceCo.has(v.coord)))
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

// ── 🎭 Morale strategy panel (Plan Offensive, v5.13.0) ──────────────────────
// The hidden #plan-morale-mode input is the source of truth (persisted by saveSettings via
// PLAN_SETTING_IDS, read by generatePlan); the radios, points inputs and the chip next to the
// button mirror it. See the "Morale strategy" block in generatePlan for what each mode does.
const MORALE_MODES = ['priority', 'balanced', 'points', 'distance']; // 'distance' since v6.1.1
function currentMoraleMode() {
  const v = (document.getElementById('plan-morale-mode') || {}).value;
  return MORALE_MODES.includes(v) ? v : 'priority';
}
function toggleMoraleMode() {
  const el = document.getElementById('pmm-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
function setMoraleMode(mode) {
  const el = document.getElementById('plan-morale-mode');
  if (el) el.value = MORALE_MODES.includes(mode) ? mode : 'priority';
  if (typeof saveSettings === 'function') saveSettings();
  syncMoraleModeUi();
}
function syncMoraleModeUi() {
  const mode = currentMoraleMode();
  if (document.querySelectorAll) {
    document.querySelectorAll('input[name="pmm-mode"]').forEach(r => { r.checked = r.value === mode; });
  }
  const chip = document.getElementById('pmm-chip');
  if (!chip) return;
  if (mode === 'points') {
    const pts = (document.getElementById('plan-morale-pts') || {}).value;
    chip.textContent = t('mm_chip_points')(pts === '' || pts == null ? 5000 : pts);
  } else {
    chip.textContent = t('mm_chip_' + mode);
  }
}
