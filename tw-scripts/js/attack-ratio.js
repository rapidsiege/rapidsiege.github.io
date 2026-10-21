// ══════════════════════════════════════════════════════════════
// ⚔ ATTACK RATIO (v6.5.0) — the per-world newbie points limit
// ══════════════════════════════════════════════════════════════
// Every world's get_config.xml carries a newbie block: <ratio> (e.g. 20) and <ratio_days> (e.g. 60).
// For ratio_days after a player REGISTERS, nobody with more than `ratio` × that player's points
// may attack them (user, 2026-10-22): only the DEFENDER's account age counts, only big → small is
// refused (a small player may still attack a much bigger one), and it covers every attack command
// (offs, split-off escorts, noble trains, fakes, catapults) — support is never limited.
//
// Registration = the first world snapshot in which the player has points > 0 (pre-registration
// days don't count); the window starts at max(registration, world start). The dates come from the
// mirror's `registered.json` next to village.txt (per world, written by the data pipeline from the
// snapshot history): { world, asOf: unix s, players: { "<id>": unix s } }. A player missing from it
// joined after `asOf` → counted as registered NOW (still protected, the safe side). Without the file
// every player counts as registered at the world start: exact while the world itself is younger
// than ratio_days, unknown after that (a late joiner may still be protected) — warned, never guessed.
//
// Config sources, first present wins: data/worlds.json (prod: ratio / ratioDays / start), the DB
// folder's get_config.xml (dev: ratio / ratio_days — it has no start), then AR_WORLDS below. A
// world whose ratio or ratioDays is 0 has no limit. Points = the owners' village-point totals
// (playerPointsDb, db.js); owner ids via coordDb — a barbarian or unresolved village is never limited.
// Classic script, loaded before plan.js. Everything it reads from db.js (twWorld, twWorldsInfo, coordDb,
// playerPointsDb, villageDb — db.js loads later) is resolved at CALL time, never at load.

// Known facts per world (get_config.xml newbie block + the game's "Fecha de inicio", server time
// 26.08.26 10:00 CEST = 08:00 UTC for es103). The fallback when worlds.json / the XML don't say.
const AR_WORLDS = {
  es100: { ratio: 20, ratioDays: 10 },
  es103: { ratio: 20, ratioDays: 60, start: '2026-08-26T08:00:00Z' },
};
const AR_DAY_MS = 86400000;
let arDevCfg = {};       // world → { ratio, ratioDays } parsed from the connected folder's get_config.xml (dev)
let arRegistered = null; // { world, asOfMs, players: { id: ms }, n } — the loaded world's registered.json, null = none

// Pure: <ratio> / <ratio_days> of a get_config.xml (the newbie block; <MerchantExchange_ratio> never
// matches — the tag must open right after '<'). 0 is a real value (no limit). null when neither parses.
function parseWorldRatio(xml) {
  const num = tag => {
    const m = String(xml || '').match(new RegExp('<' + tag + '>\\s*([0-9.]+)\\s*</' + tag + '>'));
    const v = m ? parseFloat(m[1]) : NaN;
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  const ratio = num('ratio'), ratioDays = num('ratio_days');
  return ratio == null && ratioDays == null ? null : { ratio, ratioDays };
}

// The current world's rule: { ratio, days, startMs } (startMs null = unknown), or null = no limit.
function arWorldCfg(world) {
  const w = world || (typeof twWorld !== 'undefined' ? twWorld : '');
  const info = (typeof twWorldsInfo !== 'undefined' && twWorldsInfo && twWorldsInfo[w]) || {};
  const dev = arDevCfg[w] || {}, fb = AR_WORLDS[w] || {};
  const pick = k => [info[k], dev[k], fb[k]].find(v => v !== undefined && v !== null && v !== '');
  const ratio = Number(pick('ratio')), days = Number(pick('ratioDays'));
  if (!(ratio > 0) || !(days > 0)) return null;
  const startMs = Date.parse(pick('start') || '');
  return { ratio, days, startMs: Number.isFinite(startMs) ? startMs : null };
}

// registered.json (text or parsed object) → the store; anything malformed or for another world
// clears it (no partial trust). Returns whether a store is now loaded.
function arSetRegistered(src, world) {
  arRegistered = null;
  let d = src;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
  if (!d || typeof d !== 'object' || !d.players || typeof d.players !== 'object' || Array.isArray(d.players)) return false;
  const w = world || (typeof twWorld !== 'undefined' ? twWorld : '');
  if (d.world && d.world !== w) return false;
  const asOf = Number(d.asOf);
  if (!(asOf > 0)) return false;
  const players = {};
  let n = 0;
  for (const id in d.players) {
    const s = Number(d.players[id]);
    if (s > 0) { players[String(id)] = s * 1000; n++; }
  }
  arRegistered = { world: w, asOfMs: asOf * 1000, players, n };
  return true;
}
function arRegReady() { return !!arRegistered && arRegistered.world === (typeof twWorld !== 'undefined' ? twWorld : ''); }

// One plan's view of the rule: null when there is no limit or no world DB to resolve owners.
// `unknownEnd` collects the world-start window end whenever a pair could not be judged (no
// registration data, launch after that end) — generatePlan warns once.
function arCtx(nowMs) {
  const r = arWorldCfg();
  if (!r || typeof villageDb === 'undefined' || !villageDb.length) return null;
  // Attacker = the troop file's sender (decoded name → DB player id): a village conquered after the
  // DB snapshot still reads as its old owner (a barbarian '0' would be "never limited") — the troop
  // row is the truth for our own senders. The village's DB owner is only the fallback.
  const nameToId = {};
  if (typeof playerDb !== 'undefined') for (const id in playerDb) { const n = String(playerDb[id] || '').trim().toLowerCase(); if (n && !(n in nameToId)) nameToId[n] = id; }
  return { ...r, nowMs, reg: arRegReady() ? arRegistered : null, unknownEnd: null, unjudged: false, nameToId };
}
// When the defender's protection ends: { end, exact } — exact with registration data, a lower
// bound (the world-start window) without it — or null when nothing is known (no data, no start).
function arProtEnd(ctx, defId) {
  const span = ctx.days * AR_DAY_MS;
  if (ctx.reg) {
    const reg = ctx.reg.players[defId];
    const regMs = reg != null ? reg : ctx.nowMs; // joined after asOf → registered "now" (protected)
    return { end: Math.max(regMs, ctx.startMs || 0) + span, exact: true };
  }
  if (ctx.startMs != null) return { end: ctx.startMs + span, exact: false };
  return null;
}
// Is an attack from srcCoord's owner on tgtCoord's owner, launched at launchMs, refused? Returns the
// defender's protection end (ms, truthy) when it is, 0 when it isn't. Never limits a barbarian /
// unresolved / own village, nor an attacker within `ratio` × the defender's points. `attRaw` = the
// troop file's sender name (raw); it wins over the village's DB owner when it resolves.
function arBlockedAt(ctx, srcCoord, tgtCoord, launchMs, attRaw) {
  if (!ctx) return 0;
  const tv = coordDb[tgtCoord], sv = coordDb[srcCoord];
  if (!tv) return 0;
  const byName = attRaw && ctx.nameToId ? ctx.nameToId[String(typeof decode === 'function' ? decode(attRaw) : attRaw).trim().toLowerCase()] : undefined;
  const def = String(tv.playerId || ''), att = String(byName || (sv && sv.playerId) || '');
  if (!def || def === '0' || !att || att === '0' || def === att) return 0;
  const aPts = playerPointsDb[att] || 0, dPts = playerPointsDb[def] || 0;
  if (!aPts || !dPts || aPts <= ctx.ratio * dPts) return 0;
  const pe = arProtEnd(ctx, def);
  if (!pe) { ctx.unjudged = true; return 0; }
  if (launchMs < pe.end) return pe.end;
  if (!pe.exact) ctx.unknownEnd = pe.end; // past the world-start window: a late joiner can't be judged
  return 0;
}

// "⚔ Attack ratio" note under the Plan Offensive slot bar: the rule in force for the current world
// and what the registration dates are based on. Empty when the world has no limit.
function renderRatioNote() {
  const host = document.getElementById('plan-ratio-note');
  if (!host) return;
  const r = arWorldCfg();
  if (!r) { host.innerHTML = ''; host.style.display = 'none'; return; }
  const fmt = ms => (typeof fmtServerDT === 'function' ? fmtServerDT(ms) : new Date(ms).toISOString()).slice(0, 16);
  const rule = t('ratio_note_rule')(twWorld, r.ratio, r.days);
  let basis;
  if (arRegReady()) basis = t('ratio_note_reg')(arRegistered.n, fmt(arRegistered.asOfMs));
  else if (r.startMs != null) {
    const end = r.startMs + r.days * AR_DAY_MS;
    basis = t((typeof serverNowMs === 'function' ? serverNowMs() : Date.now()) < end ? 'ratio_note_start' : 'ratio_note_start_over')(fmt(r.startMs), fmt(end));
  } else basis = t('ratio_note_none');
  host.style.display = '';
  host.innerHTML = `⚔ ${esc(rule)} <span style="color:#806030;">${esc(basis)}</span>`;
}
