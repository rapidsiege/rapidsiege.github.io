// ══════════════════════════════════════════════════════════════
// MANAGE DEFENSE (v4.9.0)
// The defensive twin of Manage Offensive. Tracks how much DEFENSIVE support
// (spear/sword/spy/heavy) each allied village actually holds and has inbound,
// and — when a Defense Plan exists — how much is still owed against it.
//
// Two independent imports (either, both, or neither):
//   1. "Import Support"        — villageSupports.js export: per-village own troops
//      + a per-origin breakdown of the support currently STATIONED in the village.
//   2. "Import Support Orders" — incomingOrders.js export, SUPPORT rows only: the
//      support movements currently EN ROUTE (origin, arrival time, units).
//
// A third, always-available source is the loaded tribe_everything.txt itself
// (defenseByCoord/incomingByCoord/troopByCoord): when no Support Orders are
// imported we ESTIMATE inbound support from the village's "incoming" row (see
// mdInferIncoming) so the table still has an Incoming line to show.
//
// The table is village-keyed (works with or without a plan): every village that
// holds support, has inferred/ordered inbound support, or is a Defense-Plan
// target gets a group — and (v6.6.3) every village the tribe .txt shows holding at
// least 🎚 mdStationedMinPop def pop of ally support (0 = off), also set from the
// tab header's field. When a plan exists, a red "Remaining Incoming Support"
// row shows plan − (stationed + incoming FROM THE TARGET'S PLAN SENDERS), floored
// at 0 — other allied support and the origin-less .txt estimates are shown but
// cover nothing (see mdBuildRows).
// ══════════════════════════════════════════════════════════════
const MD_STORE_KEY = 'tw_tribe_managedef';
let mdSupTargets = []; // villageSupports: [{coord, village, owner, status, ownUnits, supports:[{originCoord,originVillage,originPlayer,units}]}]
let mdOrders     = []; // incomingOrders (support only): [{id, target, originCoord, originVillage, originPlayer, arrival, arrivalMs, units}]
let mdSupAt      = 0;   // unix seconds of the villageSupports import (0 = none)
let mdOrdAt      = 0;   // unix seconds of the incomingOrders import (0 = none)
let mdOrdCoords  = []; // target coords COVERED by the incomingOrders import (incl. scanned-but-empty
                       // villages) — the per-village gate for "Still not sent" rows. A village here has
                       // real inbound-order data; one absent falls back to inferred incoming + aggregate.

// Collapse/expand state for the table. Villages are collapsed by default (one summary row
// each) — detail rows are built ONLY for expanded coords, so a big plan doesn't render
// thousands of rows up front. renderManageDefTable() recomputes mdGroups/mdVmap on a data
// change; renderMdTableBody() paints from them and is re-run cheaply on every toggle.
let mdGroups   = [];    // last-built village groups (mdBuildRows output)
let mdExpanded = {};    // coord → true for expanded villages
let mdVmap     = null;  // Map(order → plan-match verdict) for the current groups
let mdPlanView = 'all'; // 💾 v6.4.0: 'all' = every defense plan slot merged, or one slot id (number) — header <select>, persisted

// Compressed (lsSaveC). Returns false if even the compressed blob won't fit (QuotaExceededError)
// so the import callers can show a clear "storage full" message instead of a bogus parse error.
function saveManageDef() {
  return lsSaveC(MD_STORE_KEY, {
    supTargets: mdSupTargets, orders: mdOrders, supAt: mdSupAt, ordAt: mdOrdAt, ordCoords: mdOrdCoords, planView: mdPlanView,
  });
}
function loadManageDef() {
  try {
    const d = lsLoadC(MD_STORE_KEY); // compressed (LZ1:) or legacy uncompressed JSON
    if (d) {
      const okObj = x => x && typeof x === 'object' && !Array.isArray(x); // drop null / scalar entries, keep the valid siblings
      mdSupTargets = Array.isArray(d.supTargets) ? d.supTargets.filter(okObj) : [];
      mdOrders     = Array.isArray(d.orders) ? d.orders.filter(okObj) : [];
      mdSupAt      = d.supAt || 0;
      mdOrdAt      = d.ordAt || 0;
      // Back-compat: older saves lack ordCoords → derive from the orders' targets.
      mdOrdCoords  = Array.isArray(d.ordCoords) ? d.ordCoords
        : Array.from(new Set(mdOrders.map(o => o.target).filter(Boolean)));
      mdPlanView   = Number.isInteger(d.planView) ? d.planView : 'all';
    }
  } catch {}
}

// ── 💾 Defense plan slots in Manage Defense (v6.4.0) ───────────────────────────────────────
// The plan rows the table checks the imports against. One slot in existence, or one slot picked →
// that slot's rows untouched (the pre-v6.4.0 behaviour). 'all' with several slots → every slot's
// rows together, each tagged with its `slot` id (badge on its "Still not sent" row): every plan's
// orders are real moves, so with Defense 2 active Defense 1's senders must still match (not read as
// "not in plan" / "extra") and still be chased when missing. mdBuildRows / mdClassifyOrders key by
// target + origin, so rows of several slots for one target simply add up like rows of one plan.
function setMdPlanView(v) {
  const n = parseInt(v, 10);
  mdPlanView = v === 'all' || !Number.isInteger(n) ? 'all' : n;
  saveManageDef();
  renderManageDefTable();
}
function mdViewRows() {
  if (typeof defPlans === 'undefined') return (typeof defPlanRows !== 'undefined') ? defPlanRows : [];
  defPlanSync();
  if (mdPlanView !== 'all') {
    const s = defPlans.find(x => x.id === mdPlanView);
    if (s) return s.rows || [];
    mdPlanView = 'all'; // the picked slot was deleted
  }
  if (defPlans.length === 1) return defPlans[0].rows || [];
  return defPlanAllRows();
}
function mdMergedView() { return mdPlanView === 'all' && typeof defPlans !== 'undefined' && defPlans.length > 1; }
// Header <select>: only while there are 2+ defense plan slots (one slot = nothing to pick).
function renderMdPlanView() {
  const host = document.getElementById('md-plan-view-host');
  if (!host) return;
  if (typeof defPlans === 'undefined' || defPlans.length < 2) { host.innerHTML = ''; return; }
  const opt = (v, label) => `<option value="${v}"${String(mdPlanView) === String(v) ? ' selected' : ''}>${esc(label)}</option>`;
  host.innerHTML = `<label class="mo-plan-view">${esc(t('md_plan_view_lbl'))} <select id="md-plan-view" onchange="setMdPlanView(this.value)">`
    + opt('all', t('md_plan_view_all')) + defPlans.map(s => opt(s.id, defPlanLabel(s))).join('')
    + `</select></label><span class="map-tb-sep"></span>`;
}
function mdSlotBadge(r) {
  if (!mdMergedView() || r.slot == null) return '';
  const s = defPlans.find(x => x.id === r.slot);
  if (!s) return '';
  return `<span class="mo-slot" title="${esc(t('mo_slot_badge_t')(defPlanLabel(s)))}">${esc(t('def_slot_short')(defPlanIndex(s.id) + 1))}</span>`;
}

// Empty per-type defensive tally.
function mdZero() { return { spear: 0, sword: 0, spy: 0, heavy: 0 }; }
// Add DEF_OBJ_UNITS of `src` into `dst` (mutates dst, returns it).
function mdAddUnits(dst, src) { for (const u of DEF_OBJ_UNITS) dst[u] += (src && src[u]) || 0; return dst; }
// Total defensive population of a tally (farm-pop weighted, same as the plan engine).
function mdPop(units) { return DEF_OBJ_UNITS.reduce((s, u) => s + ((units && units[u]) || 0) * POP[u], 0); }

// ── Import parsing: villageSupports.js (both formats) ─────────────────────────
// JSON: {exported_at, targets:[{coords, village, player, status, own_units, supports:[{origin_coords, origin_village, origin_player, units}]}]}.
// CSV : header Target,TargetVillage,TargetOwner,Type,OriginCoords,OriginVillage,OriginPlayer,<unit cols…>
//       where Type 'own' = the village's own_units row, 'support' = one stationed support stack.
// Returns {targets, exportedAt} or null when nothing parseable.
// Coords land in HTML ids/inline handlers, so BOTH import formats gate them through this
// (the CSV paths always did; the JSON paths now match — a malformed/corrupt export is dropped
// per-target instead of flowing quote-unescaped into the markup).
const MD_COORD_RE = /^\d{1,3}\|\d{1,3}$/;
function mdParseSupports(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const mkUnits = obj => { const u = {}; for (const k of UNITS) u[k] = (obj && +obj[k]) || 0; return u; };
  if (s[0] === '{') {
    let data;
    try { data = JSON.parse(s); } catch { return null; }
    if (!data || !Array.isArray(data.targets)) return null;
    const targets = data.targets.filter(tg => MD_COORD_RE.test(tg.coords || '')).map(tg => ({
      coord: tg.coords, village: tg.village || '', owner: tg.player || '', status: tg.status || 'ok',
      ownUnits: tg.own_units ? mkUnits(tg.own_units) : null,
      supports: (tg.supports || []).map(sp => ({
        originCoord: sp.origin_coords || '', originVillage: sp.origin_village || '',
        originPlayer: sp.origin_player || '', units: mkUnits(sp.units),
      })),
    }));
    return targets.length ? { targets, exportedAt: data.exported_at || 0 } : null;
  }
  // CSV
  const lines = s.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
  if (!lines.length) return null;
  const head = lines[0].split(',');
  const col = name => head.indexOf(name);
  if (col('Target') !== 0 || col('Type') === -1 || col('OriginCoords') === -1 || col('OriginPlayer') === -1) return null;
  // Unit columns = every header after OriginPlayer.
  const unitStart = col('OriginPlayer') + 1;
  const unitNames = head.slice(unitStart);
  const f = (row, name) => { const i = col(name); return i === -1 ? '' : (row[i] || '').trim(); };
  const byCoord = {};
  const order = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const coord = (row[0] || '').trim();
    if (!/^\d{1,3}\|\d{1,3}$/.test(coord)) continue;
    const type = f(row, 'Type');
    let tg = byCoord[coord];
    if (!tg) {
      tg = byCoord[coord] = { coord, village: f(row, 'TargetVillage'), owner: f(row, 'TargetOwner'),
        status: (type === 'own' || type === 'support') ? 'ok' : (type || 'ok'), ownUnits: null, supports: [] };
      order.push(coord);
    }
    if (type !== 'own' && type !== 'support') continue; // status rows (not_visible…) carry no units
    const u = {};
    unitNames.forEach((name, k) => { u[name] = parseInt(row[unitStart + k], 10) || 0; });
    if (type === 'own') tg.ownUnits = u;
    else tg.supports.push({ originCoord: f(row, 'OriginCoords'), originVillage: f(row, 'OriginVillage'),
      originPlayer: f(row, 'OriginPlayer'), units: u });
  }
  const targets = order.map(c => byCoord[c]);
  return targets.length ? { targets, exportedAt: 0 } : null;
}

// ── Import parsing: incomingOrders.js, SUPPORT rows only ──────────────────────
// Mirror of moParseImport but keeps type 'support' (Manage Offensive keeps 'attack').
// Returns {orders, exportedAt} or null.
function mdParseOrders(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const mkUnits = obj => { const u = {}; for (const k of UNITS) u[k] = (obj && +obj[k]) || 0; return u; };
  if (s[0] === '{') {
    let data;
    try { data = JSON.parse(s); } catch { return null; }
    if (!data || !Array.isArray(data.targets)) return null;
    const orders = [];
    const coords = new Set(); // every village the scan visited (even with 0 support en route)
    for (const tg of data.targets) {
      if (!MD_COORD_RE.test(tg.coords || '')) continue; // malformed coord → drop the whole target
      coords.add(tg.coords);
      for (const c of (tg.commands || [])) {
        if (c.type !== 'support') continue;
        orders.push({
          id: c.id || '', target: tg.coords,
          originCoord: c.origin_coords || '', originVillage: c.origin_village || '',
          originPlayer: c.origin_player || '', arrival: c.arrival || '',
          arrivalMs: moParseArrivalMs(c.arrival), units: mkUnits(c.units),
        });
      }
    }
    return { orders, exportedAt: data.exported_at || 0, coords: [...coords] };
  }
  // CSV
  const lines = s.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
  if (!lines.length) return null;
  const head = lines[0].split(',');
  const col = name => head.indexOf(name);
  if (col('Target') !== 0 || col('Type') === -1 || col('OriginCoords') === -1
    || (col('ArrivesIn') === -1 && col('Arrival') === -1)) return null;
  const unitStart = (col('ArrivesIn') !== -1 ? col('ArrivesIn') : col('Arrival')) + 1;
  const unitNames = head.slice(unitStart);
  const f = (row, name) => { const i = col(name); return i === -1 ? '' : (row[i] || '').trim(); };
  const orders = [];
  const coordSet = {}; // every Target coord seen in the CSV (any row type = scanned)
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const coord = (row[0] || '').trim();
    if (!/^\d{1,3}\|\d{1,3}$/.test(coord)) continue;
    coordSet[coord] = true;
    if (f(row, 'Type') !== 'support') continue;
    const u = {};
    unitNames.forEach((name, k) => { u[name] = parseInt(row[unitStart + k], 10) || 0; });
    const arrival = f(row, 'Arrival');
    orders.push({
      id: '', target: coord, originCoord: f(row, 'OriginCoords'), originVillage: f(row, 'OriginVillage'),
      originPlayer: f(row, 'OriginPlayer'), arrival, arrivalMs: moParseArrivalMs(arrival), units: u,
    });
  }
  const coords = Object.keys(coordSet);
  // Accept an import that scanned villages even if none had support en route (all "not sent").
  return (orders.length || coords.length) ? { orders, exportedAt: 0, coords } : null;
}

// ── Inferred inbound support from tribe_everything.txt ────────────────────────
// The "incoming" row of a village mixes (a) the owner's own troops returning from
// attacks/support/scavenging with (b) ally support en route. Own returning troops
// can't exceed what the village owns at home, so the per-type EXCESS of incoming
// over own-home troops is (heuristically) ally support inbound. Defensive types
// only — an incoming axe/light stack is not defensive support. Needs the village's
// OWN station row (gated per village — a batch can mix files with and without them);
// without one (plain tribe-info file) there is no incoming row → all zeros.
// (This intentionally uses own-home troops, not "own − defense" — validated against
// real es100 snapshots where "own − defense" false-positived a village's own
// returning army as support. Easy to retune here if the game data shifts.)
function mdInferIncoming(coord) {
  const z = mdZero();
  if (!mdHasStation(coord)) return z;
  const inc = (typeof incomingByCoord !== 'undefined' && incomingByCoord[coord]) || null;
  if (!inc) return z;
  const own = (typeof troopByCoord !== 'undefined' && troopByCoord[coord]) || {};
  for (const u of DEF_OBJ_UNITS) z[u] = Math.max(0, (inc[u] || 0) - (own[u] || 0));
  return z;
}

// ── Estimated STATIONED ally support from tribe_everything.txt ────────────────
// Symmetric to mdInferIncoming, but for support already sitting in the village: the
// per-type EXCESS of the "defense" row (troops stationed in the village) over the
// owner's own troops is (heuristically) allied support. It reads ~0 when the export only
// sees the exporting account's own troops, but a leader's tribe export carries the real
// stacks (es103 2026-10-25: ~5.9M def pop over 259 villages). It is REPLACED by the exact
// per-origin sum the moment an "Import Support" (villageSupports.js) file covers the village,
// and since v6.6.3 it also decides whether a village is listed at all (🎚 mdStationedMinPop,
// mdBuildRows). Defensive types only. No station row for the village (plain tribe-info file) → all zeros.
function mdEstimateStationed(coord) {
  const z = mdZero();
  if (!mdHasStation(coord)) return z;
  const def = (typeof defenseByCoord !== 'undefined' && defenseByCoord[coord]) || null;
  if (!def) return z;
  const own = (typeof troopByCoord !== 'undefined' && troopByCoord[coord]) || {};
  for (const u of DEF_OBJ_UNITS) z[u] = Math.max(0, (def[u] || 0) - (own[u] || 0));
  return z;
}

// Does the loaded tribe .txt carry a defense or incoming row for THIS village? (Per village,
// like Plan Defense's defAvailUnits — never the batch-wide hasStationData() switch.)
function mdHasStation(coord) {
  return (typeof defenseByCoord !== 'undefined' && coord in defenseByCoord)
      || (typeof incomingByCoord !== 'undefined' && coord in incomingByCoord);
}

// Owner of a village per the loaded tribe .txt (its owned-troop row, else a station row), DECODED
// for display: the troop export leaves %XX escapes in names ("vakeri%C3%B1o"). '' = not in the file.
function mdTxtOwner(coord) {
  const row = (typeof troopByCoord !== 'undefined' && troopByCoord[coord])
    || (typeof defenseByCoord !== 'undefined' && defenseByCoord[coord])
    || (typeof incomingByCoord !== 'undefined' && incomingByCoord[coord]) || null;
  return row && row.player ? decode(row.player) : '';
}

// ── "Who has already sent?" (pure) ────────────────────────────────────────────
// A plan row (src→tgt) counts as SENT once any support carrying defensive units has
// left that origin for that target — whether it has arrived (stationed, villageSupports)
// or is still en route (incoming order). Returns tCoord → Set(originCoord). Amount/timing
// are deliberately ignored: a partial or wrong-amount sender is "sent" (and still surfaces
// on its own incoming row via the classifier); only true non-senders become "Still not sent".
function mdSentOrigins(supTargets, orders) {
  const map = {};
  const add = (tgt, origin) => { (map[tgt] || (map[tgt] = new Set())).add(origin); };
  for (const tg of (supTargets || [])) {
    if (!tg.coord) continue;
    for (const sp of (tg.supports || [])) if (mdPop(sp.units) > 0) add(tg.coord, sp.originCoord);
  }
  for (const o of (orders || [])) if (o.target && mdPop(o.units) > 0) add(o.target, o.originCoord);
  return map;
}

// v6.4.0: def pop already at / heading to each target, per origin (stationed + inbound orders) — pure.
function mdSentPop(supTargets, orders) {
  const map = {};
  const add = (tgt, origin, units) => {
    const p = mdPop(units);
    if (!tgt || p <= 0) return;
    const m = map[tgt] || (map[tgt] = {});
    m[origin] = (m[origin] || 0) + p;
  };
  for (const tg of (supTargets || [])) for (const sp of (tg.supports || [])) add(tg.coord, sp.originCoord, sp.units);
  for (const o of (orders || [])) add(o.target, o.originCoord, o.units);
  return map;
}
// The plan rows whose sender has NOT sent yet (pure). One plan holds at most one row per
// sender→target, and it counts as sent as soon as ANY def units from that sender reached or head to
// the target (amount ignored, like mdSentOrigins). Several 💾 defense plans (v6.4.0) can each hold a
// row for the same pair: the pair's sent pop is handed to its rows in plan order — a row counts as
// sent while some is left, and takes its own pop out of it — so one arrived order no longer clears a
// second plan's row as well (review HIGH).
function mdMissingFrom(rows, sentPop) {
  const left = {};
  return (rows || []).filter(r => {
    const k = r.tCoord + '>' + r.srcCoord;
    if (!(k in left)) left[k] = (sentPop[r.tCoord] && sentPop[r.tCoord][r.srcCoord]) || 0;
    if (left[k] > 0) { left[k] -= mdPop(r.units); return false; }
    return true;
  });
}
// The deadline an inbound order is timed against. One plan: every row of a target shares one arrival,
// so this is the target's deadline as before. Several defense plans can reinforce one target in waves
// (Defense 1 at 10:00, Defense 2 at 18:00): the order is timed against the LATEST arrival among its own
// sender's rows there (else among all the target's rows), so a second wave never reads late against
// the first wave's deadline.
function mdOrderDeadline(g, o) {
  const timed = (g.planList || []).filter(r => r.arriveMs != null);
  const own = timed.filter(r => r.srcCoord === o.originCoord);
  const pool = own.length ? own : timed;
  return pool.length ? Math.max(...pool.map(r => r.arriveMs)) : g.deadlineMs;
}

// ── Plan-match verdicts for inbound support orders (pure — harness-tested) ────
// Treats the Defense Plan as a set of slots {src→tgt : units}, consumed as matched,
// and classifies every order against it. Returns a verdict[] aligned to `orders`:
//   matches      — src + target + units all match an unclaimed plan row
//   duplicate    — identical to an already-matched row (plan wanted it once)
//   diff_origin  — target + units match, but from a different origin village
//   diff_target  — origin + units match a plan row headed to ANOTHER target (misrouted)
//   wrong_amount — origin + target match a plan row, but the unit counts differ
//   not_in_plan  — the destination village isn't a plan target at all
//   extra        — target IS planned, but this order matches no row (unplanned sender)
//   inbound      — neutral: no Defense Plan loaded to compare against
// Units match = per-type equality within 🎚 PARAMS.mdUnitTol units (0 = exact; a resend of the
// same packet is a duplicate).
// Two passes so exact matches claim their slots before looser matches do; orders are
// processed target- then arrival-ordered (🎚 mdSlotOrder 'earliest', the default) so the earliest
// of identical orders "matches" and later ones fall to "duplicate"; 'closestAmount' ranks AND
// claims by the unit gap to the target's slots instead, arrival breaking ties.
function mdClassifyOrders(orders, planRows) {
  const verdicts = (orders || []).map(() => 'inbound');
  if (!orders || !orders.length || !planRows || !planRows.length) return verdicts;
  const eq = (a, b) => DEF_OBJ_UNITS.every(u => Math.abs(((a && a[u]) || 0) - ((b && b[u]) || 0)) <= PARAMS.mdUnitTol);
  const slots = planRows.map(r => ({ src: r.srcCoord, tgt: r.tCoord, units: r.units, filled: false }));
  const plannedTgt = new Set(planRows.map(r => r.tCoord));
  // 🎚 mdSlotOrder (v6.1.1): 'earliest' = earliest arrival claims a slot (today); 'closestAmount' =
  // the order whose units are closest (sum of per-type differences) to any slot of its target goes
  // first, arrival breaks ties. Orders are still grouped per target either way.
  const unitGap = (x, o) => DEF_OBJ_UNITS.reduce((acc, u) => acc + Math.abs(((x.units && x.units[u]) || 0) - ((o.units && o.units[u]) || 0)), 0);
  const gapOf = o => {
    let best = Infinity;
    for (const x of slots) if (x.tgt === o.target) { const d = unitGap(x, o); if (d < best) best = d; }
    return best;
  };
  const byAmount = PARAMS.mdSlotOrder === 'closestAmount';
  // The slot an order claims: the first eligible one in plan order (default), or with 'closestAmount'
  // the eligible slot whose units are closest to the order's — ranking and claiming follow the SAME
  // rule, so a "closer" order never takes the only slot a later order fits (review finding, 2026-10-04).
  const claim = (o, ok) => {
    if (!byAmount) return slots.find(ok);
    let best, bestGap = Infinity;
    for (const x of slots) if (ok(x)) { const d = unitGap(x, o); if (d < bestGap) { best = x; bestGap = d; } }
    return best;
  };
  const idx = orders.map((_, i) => i).sort((a, b) => {
    const A = orders[a], B = orders[b];
    return (A.target < B.target ? -1 : A.target > B.target ? 1 : 0)
      || (byAmount ? (gapOf(A) - gapOf(B)) : 0)
      || ((A.arrivalMs || 0) - (B.arrivalMs || 0)) || (a - b);
  });
  const done = new Array(orders.length).fill(false);
  for (const i of idx) { // pass 1 — exact src+tgt+units
    const o = orders[i];
    const s = claim(o, x => !x.filled && x.tgt === o.target && x.src === o.originCoord && eq(x.units, o.units));
    if (s) { s.filled = true; verdicts[i] = 'matches'; done[i] = true; }
  }
  for (const i of idx) { // pass 2 — everything else
    if (done[i]) continue;
    const o = orders[i];
    if (plannedTgt.has(o.target)) {
      if (slots.some(x => x.filled && x.tgt === o.target && x.src === o.originCoord && eq(x.units, o.units))) { verdicts[i] = 'duplicate'; continue; }
      const s2 = claim(o, x => !x.filled && x.tgt === o.target && x.src !== o.originCoord && eq(x.units, o.units));
      if (s2) { s2.filled = true; verdicts[i] = 'diff_origin'; continue; }
      if (slots.some(x => x.tgt !== o.target && x.src === o.originCoord && eq(x.units, o.units))) { verdicts[i] = 'diff_target'; continue; }
      verdicts[i] = slots.some(x => x.tgt === o.target && x.src === o.originCoord) ? 'wrong_amount' : 'extra';
    } else {
      verdicts[i] = slots.some(x => x.src === o.originCoord && eq(x.units, o.units)) ? 'diff_target' : 'not_in_plan';
    }
  }
  return verdicts;
}

// ── Pure aggregator (harness-tested): fold the three sources into per-village rows ─
// Returns [{coord, owner, village, hasPlan, hasOrders, planNeed, stationed, incoming, remaining,
//           supportRows:[…], orderRows:[…], missingRows:[…], inferredIncoming, deadlineMs,
//           byStationed}] village-keyed (byStationed = listed only by the stationed floor, v6.6.3).
// PER-VILLAGE order awareness: a village whose coord is in opts.ordCoords (covered by the
// incomingOrders import — even if 0 support was en route) shows real per-order incoming +
// per-sender "not sent"; every OTHER village falls back to inferred incoming (mdInferIncoming)
// and the aggregate Remaining. So importing orders for one village never expands the rest.
// opts.stationCoords + opts.stationedMinPop (v6.6.3) also list villages holding that much estimated
// ally support (see below); without them (direct callers, tests) the rule is off.
function mdBuildRows(supTargets, orders, planRows, opts) {
  opts = opts || {};
  // Villages with real inbound-order data. Fallback (tests/back-compat): the orders' own targets.
  const ordCoords = new Set(opts.ordCoords || (orders || []).map(o => o.target).filter(Boolean));
  const byCoord = {}; const order = [];
  const get = coord => {
    if (!byCoord[coord]) {
      byCoord[coord] = {
        coord, owner: '', village: '', hasPlan: false, hasSupImport: false, hasOrders: false,
        planNeed: mdZero(), stationed: mdZero(), incoming: mdZero(), remaining: mdZero(),
        ownUnits: mdZero(), support: mdZero(), supportEst: mdZero(),
        supportRows: [], orderRows: [], inferredIncoming: mdZero(), deadlineMs: null,
        planList: [], missingRows: [], byStationed: false,
      };
      order.push(coord);
    }
    return byCoord[coord];
  };

  // Stationed support (villageSupports) — one supportRow per origin that carries any def unit.
  for (const tg of (supTargets || [])) {
    if (!tg.coord) continue;
    const g = get(tg.coord);
    g.hasSupImport = true; // this village WAS seen by an Import Support file → g.stationed is authoritative
    g.owner = g.owner || tg.owner; g.village = g.village || tg.village;
    if (tg.ownUnits) mdAddUnits(g.ownUnits, tg.ownUnits); // own troops at home (villageSupports own_units row)
    for (const sp of (tg.supports || [])) {
      if (mdPop(sp.units) <= 0) continue; // skip pure-offensive (axe/light-only) support stacks
      g.supportRows.push(sp);
      mdAddUnits(g.stationed, sp.units);
    }
  }

  // Plan need + deadline (defPlanRows already carry arriveMs). Keep the per-row list so we
  // can show which individual senders still owe support (missing rows) — not just the net.
  for (const r of (planRows || [])) {
    const g = get(r.tCoord);
    g.hasPlan = true;
    g.owner = g.owner || r.tPlayer;
    g.planList.push(r);
    mdAddUnits(g.planNeed, r.units);
    if (r.arriveMs != null && (g.deadlineMs == null || r.arriveMs < g.deadlineMs)) g.deadlineMs = r.arriveMs;
  }

  // Inbound support — per village. Villages covered by the orders import get real per-order rows;
  // every other village infers its incoming from the tribe .txt (defense/incoming rows).
  for (const o of (orders || [])) {
    if (!o.target || mdPop(o.units) <= 0) continue; // support order with no def units → skip
    const g = get(o.target);
    g.orderRows.push(o);
    mdAddUnits(g.incoming, o.units);
  }
  for (const coord of Object.keys(byCoord)) {
    if (ordCoords.has(coord)) continue; // real order data → don't infer
    const est = mdInferIncoming(coord);
    byCoord[coord].inferredIncoming = est;
    mdAddUnits(byCoord[coord].incoming, est);
  }
  // A village with inferred inbound support but no station/plan/orders yet still deserves a row.
  if (opts.allCoords) for (const coord of opts.allCoords) {
    if (byCoord[coord] || ordCoords.has(coord)) continue;
    const est = mdInferIncoming(coord);
    if (mdPop(est) > 0) { const g = get(coord); g.inferredIncoming = est; mdAddUnits(g.incoming, est); }
  }
  // v6.6.3: a village the tribe .txt shows holding at least opts.stationedMinPop def pop of ALLY
  // support (mdEstimateStationed, its "Support (est.)" line) gets a group too — no plan, no import,
  // nothing inbound needed. Runs last, so it only adds villages nothing above listed: one an Import
  // Support file has seen keeps its exact figure and is never re-added from the estimate. 0 = off.
  // Only a village with an OWNED-troop row too: without one (a lone tribe_defense.txt, a rejected
  // row) "defense − own" is the owner's whole garrison, not ally support.
  const minSt = opts.stationedMinPop > 0 ? opts.stationedMinPop : 0;
  if (minSt && opts.stationCoords) for (const coord of opts.stationCoords) {
    if (byCoord[coord] || !(typeof troopByCoord !== 'undefined' && troopByCoord[coord])) continue;
    if (mdPop(mdEstimateStationed(coord)) < minSt) continue;
    const g = get(coord);
    g.byStationed = true;
    if (!ordCoords.has(coord)) { g.inferredIncoming = mdInferIncoming(coord); mdAddUnits(g.incoming, g.inferredIncoming); }
  }

  // Remaining = plan − what the target's PLANNED senders already have there or on the way,
  // floored at 0. The engine plans each objective as NEW sends and never subtracts support
  // already sitting in (or heading to) the target, so only support that can be traced to one
  // of this target's plan senders covers the plan: imported stationed support (Import
  // Support) and imported orders (Import Support Orders) whose origin is a plan sender here.
  // Other allied support — and the origin-less estimates from the tribe .txt (support est.,
  // inferred incoming) — is still SHOWN on its own rows but covers nothing.
  // Support = ally support stationed in the village (NOT the owner's own troops). When an
  // Import Support file has been loaded for the village, g.stationed is the exact per-origin
  // sum; otherwise we show a placeholder ESTIMATE inferred from the tribe .txt (defense − own,
  // ~0 in practice — the .txt can't see foreign support), replaced the moment support is imported.
  // Missing rows = the individual plan senders that have NOT sent yet (neither stationed nor incoming);
  // only meaningful/rendered for order-covered villages (g.hasOrders).
  const sentPop = mdSentPop(supTargets, orders);
  for (const coord of order) {
    const g = byCoord[coord];
    g.hasOrders = ordCoords.has(coord);
    // Villages listed from the tribe .txt alone (inferred incoming, stationed support) carry no owner
    // from an import or plan row — take it from the troop file (v6.6.3; the Defender cell was blank).
    if (!g.owner) g.owner = mdTxtOwner(coord);
    g.support = g.hasSupImport ? g.stationed : mdZero();
    g.supportEst = g.hasSupImport ? mdZero() : mdEstimateStationed(coord);
    const planned = new Set(g.planList.map(r => r.srcCoord));
    const covering = mdZero();
    for (const sp of g.supportRows) if (planned.has(sp.originCoord)) mdAddUnits(covering, sp.units);
    for (const o of g.orderRows)    if (planned.has(o.originCoord))  mdAddUnits(covering, o.units);
    for (const u of DEF_OBJ_UNITS) g.remaining[u] = Math.max(0, g.planNeed[u] - covering[u]);
    g.missingRows = mdMissingFrom(g.planList, sentPop);
  }
  // Only surface villages actually relevant to defense coordination: a Defense-Plan
  // target, OR a village holding ally support (imported, or estimated ≥ the stationed floor),
  // OR one with inbound support (ordered or inferred). A village showing only its OWNER'S
  // troops (self-defense — no plan, no ally support stationed or inbound) is dropped; its
  // lone Totals row is just noise here.
  return order.map(c => byCoord[c])
    .filter(g => g.hasPlan || g.supportRows.length > 0 || mdPop(g.incoming) > 0 || g.byStationed);
}

// ── Rendering ─────────────────────────────────────────────────────────────────
// Per-type cell set (4 <td>): only used defensive types shown, zeros muted.
function mdUnitCells(units, style) {
  return DEF_OBJ_UNITS.map(u => {
    const n = (units && units[u]) || 0;
    return `<td style="${style || ''}">${n ? n.toLocaleString() : '<span class="num-zero">0</span>'}</td>`;
  }).join('');
}
function mdCoordLink(coord) {
  const url = (typeof villageInfoUrl === 'function') ? villageInfoUrl(coord) : null;
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:inherit;">${esc(coord)}</a>` : esc(coord);
}
// Inbound-order arrival vs the target's plan deadline (single moment, not a window); 🎚
// PARAMS.mdArrivalGrace minutes past it still count as in time.
function mdTimingCell(arrivalMs, deadlineMs) {
  if (arrivalMs == null || deadlineMs == null) return '—';
  if (arrivalMs <= deadlineMs + PARAMS.mdArrivalGrace * 60000) return `<span style="color:#40c060;font-weight:600;">${esc(t('md_tm_in'))}</span>`;
  return `<span style="color:#e06040;font-weight:600;">${esc(t('md_tm_late')(fmtTime(Math.round((arrivalMs - deadlineMs) / 60000))))}</span>`;
}
function mdArrivalCell(order) {
  const s = order.arrival || '';
  const m = s.match(/^(\d{1,2}\.\d{1,2}\.\d{2,4})\s+(\d{1,2}:\d{2}:\d{2})(?::(\d{1,3}))?$/);
  if (!m) return `<span style="font-family:monospace;font-size:11px;">${esc(s || '—')}</span>`;
  return `<span style="font-family:monospace;font-size:11px;">`
    + `<span style="color:#806030;">${esc(m[1])}</span> `
    + `<span style="color:#60a0e0;font-weight:600;">${esc(m[2])}</span>`
    + (m[3] != null ? `<span style="color:#60d0a0;">:${esc(m[3])}</span>` : '')
    + `</span>`;
}
// verdict → {color, key}. Green = as planned; amber = acceptable deviation; red = misrouted/duplicate; blue = neutral/unplanned target.
const MD_VERDICT_STYLE = {
  matches:      { c: '#40c060', b: true,  k: 'md_st_matches' },
  diff_origin:  { c: '#e0a020', b: true,  k: 'md_st_diff_origin' },
  diff_target:  { c: '#e06040', b: true,  k: 'md_st_diff_target' },
  duplicate:    { c: '#e06040', b: true,  k: 'md_st_duplicate' },
  wrong_amount: { c: '#e0a020', b: true,  k: 'md_st_wrong_amount' },
  extra:        { c: '#e0a020', b: true,  k: 'md_st_extra' },
  not_in_plan:  { c: '#60a0e0', b: false, k: 'md_st_not_in_plan' },
  inbound:      { c: '#60a0e0', b: false, k: 'md_st_inbound' },
};
function mdOrderStatus(verdict) {
  const s = MD_VERDICT_STYLE[verdict] || MD_VERDICT_STYLE.inbound;
  return `<span style="color:${s.c};${s.b ? 'font-weight:600;' : ''}">${esc(t(s.k))}</span>`;
}
// Planned arrival moment for a missing sender (server date-time, from defPlanRows.arriveMs).
function mdPlanArrivalCell(ms) {
  const s = (typeof fmtServerDT === 'function') ? fmtServerDT(ms) : '';
  return `<span style="font-family:monospace;font-size:11px;color:#60a0e0;">${esc(s || '—')}</span>`;
}
// "Still not sent" verdict for a missing plan row, with the pre-filled rally-point send link
// (degrades to plain text when the world DB / server URL isn't available — same as the plan table).
// A dated order whose departure (minus 🎚 departMargin) has passed by now can no longer arrive on
// time: said in red under the label, so a laggard isn't chased with a link that is already too late.
function mdNotSentStatus(r) {
  let label = `<span style="color:#e69090;font-weight:600;">${esc(t('md_st_not_sent'))}</span>`;
  if (r.departMs != null && typeof serverNowMs === 'function') {
    const now = serverNowMs();
    if (r.departMs < now + PARAMS.departMargin * 60000) {
      const note = r.departMs < now ? t('md_st_depart_passed')(fmtTime((now - r.departMs) / 60000)) : t('md_st_depart_now');
      label += `<br><span style="color:#e06040;font-weight:600;">⚠ ${esc(note)}</span>`;
    }
  }
  const url = (typeof rallyUrl === 'function') ? rallyUrl(r.srcCoord, r.tCoord, r.units) : null;
  return url
    ? label + `<br><a href="${esc(url)}" target="_blank" rel="noopener" style="color:#7fb8e6;">${esc(t('md_send'))}</a>`
    : label;
}

function renderManageDefTable() {
  const sumEl = document.getElementById('md-summary');
  const tbody = document.getElementById('md-tbody');
  if (!tbody) return;
  const impEl = document.getElementById('md-import-status');
  // The header's stationed-floor field is a second view of 🎚 mdStationedMinPop (setParam writes it,
  // paramsChanged re-renders here) — refreshed on every render so ↺ / Reset all / boot show the value.
  // Not while the user is typing in it (the async world-DB load re-renders this table at boot).
  const minEl = document.getElementById('md-stationed-min');
  if (minEl && document.activeElement !== minEl) minEl.value = PARAMS.mdStationedMinPop;

  renderMdPlanView();
  const planRows = mdViewRows();
  // Every coord we might infer inbound support for — used to surface support-receiving villages
  // that aren't order-covered. mdInferIncoming is nonzero ONLY where the tribe export has an
  // "incoming" row, so iterate exactly those coords instead of every village in the troop file
  // (this render runs on each import/generate/lang-switch; the world scan was thousands of calls).
  const allCoords = (typeof incomingByCoord !== 'undefined') ? Object.keys(incomingByCoord) : null;
  // Likewise the stationed-support estimate is nonzero only where there is a "defense" row.
  const stationCoords = (typeof defenseByCoord !== 'undefined') ? Object.keys(defenseByCoord) : null;
  mdGroups = mdBuildRows(mdSupTargets, mdOrders, planRows,
    { allCoords, ordCoords: mdOrdCoords, stationCoords, stationedMinPop: PARAMS.mdStationedMinPop });

  // Import status line
  if (impEl) {
    const parts = [];
    if (mdSupAt) parts.push(t('md_imp_sup')(mdSupTargets.length, new Date(mdSupAt * 1000).toLocaleString()));
    if (mdOrdAt) parts.push(t('md_imp_ord')(mdOrders.length, new Date(mdOrdAt * 1000).toLocaleString()));
    impEl.textContent = parts.join('  ·  ');
  }

  if (!mdGroups.length) {
    if (sumEl) sumEl.innerHTML = `<span style="color:#a08050;">${esc(t('md_need_import'))}</span>`;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="12">${t('md_need_import')}</td></tr>`;
    return;
  }

  // Summary tallies. Missing (not-sent) counts only order-covered villages; def-pop-owed sums
  // the rest of the plan targets (which show the aggregate Remaining instead of per-sender rows).
  let nSupport = 0, nIncoming = 0, nMissing = 0, nByStationed = 0, anyInferred = false;
  const totStationed = mdZero(), totRemaining = mdZero();
  for (const g of mdGroups) {
    if (g.supportRows.length) nSupport++;
    if (g.byStationed) nByStationed++;
    if (mdPop(g.incoming) > 0) { nIncoming++; if (!g.hasOrders) anyInferred = true; }
    mdAddUnits(totStationed, g.stationed);
    if (g.hasPlan && g.hasOrders) nMissing += g.missingRows.length;
    else if (g.hasPlan) mdAddUnits(totRemaining, g.remaining);
  }
  const anyPlan = mdGroups.some(g => g.hasPlan);
  if (sumEl) {
    const chips = [
      t('md_sum_support')(nSupport),
      // "(est.)" whenever ANY counted village's incoming is inferred (per-village gating means a
      // partial order import can mix real and inferred incoming in the same tally).
      t('md_sum_incoming')(nIncoming, anyInferred ? t('md_sum_est') : ''),
      t('md_sum_stationed')(Math.round(mdPop(totStationed)).toLocaleString()),
    ];
    if (nByStationed) chips.push(t('md_sum_by_stationed')(nByStationed, PARAMS.mdStationedMinPop.toLocaleString()));
    if (anyPlan && nMissing > 0)
      chips.push(`<span style="color:#e06040;font-weight:600;">${esc(t('md_sum_missing')(nMissing))}</span>`);
    if (anyPlan && mdPop(totRemaining) > 0)
      chips.push(`<span style="color:#e06040;font-weight:600;">${esc(t('md_sum_remaining')(Math.round(mdPop(totRemaining)).toLocaleString()))}</span>`);
    sumEl.innerHTML = chips.map(c => c.startsWith('<span') ? c : esc(c)).join(' · ');
  }

  // Classify every inbound order against the plan once (consumes slots across all targets),
  // then look each order's verdict up by reference (g.orderRows hold the same objects).
  const verdicts = mdClassifyOrders(mdOrders, planRows);
  mdVmap = new Map();
  mdOrders.forEach((o, i) => mdVmap.set(o, verdicts[i]));

  // Fresh data render → expand the villages the user actually imported orders for (that's what
  // they want to inspect); everything else collapses to a summary row. A lone group auto-expands.
  mdExpanded = {};
  for (const g of mdGroups) if (g.hasOrders) mdExpanded[g.coord] = true;
  if (mdGroups.length === 1) mdExpanded[mdGroups[0].coord] = true;
  renderMdTableBody();
}

// Paint the tbody from mdGroups + mdExpanded (+ mdVmap). Collapsed villages contribute ONE
// summary row; expanded villages also emit their detail rows. Cheap to re-run on every toggle.
function renderMdTableBody() {
  const tbody = document.getElementById('md-tbody');
  if (!tbody) return;
  const blankMeta = `<td></td><td></td><td></td>`; // detail rows: #/Target/Owner carried by the summary row
  const cells = [];
  let groupNum = 0, firstGroup = true;

  for (const g of mdGroups) {
    const myNum = ++groupNum;
    const expanded = !!mdExpanded[g.coord];
    const supIsEst = !g.hasSupImport;
    const supVal = supIsEst ? g.supportEst : g.support;

    // Support summary row (click to expand/collapse) — carries #/Target/Owner + the Support totals.
    const caret = `<span style="color:#c0a060;">${expanded ? '▼' : '▶'}</span>`;
    const supStatus = supIsEst ? `<span style="color:#60a0e0;">${esc(t('md_st_estimated'))}</span>` : '—';
    // Group head rows toggle by INDEX into mdGroups (the coord comes from imported files / plan
    // rows and is never interpolated into the handler).
    cells.push(`<tr class="md-grp-head" onclick="mdToggleGroup(mdGroups[${myNum - 1}].coord)" title="${esc(t('md_grp_toggle'))}"`
      + ` style="cursor:pointer;background:rgba(240,192,64,0.05);${firstGroup ? '' : 'border-top:2px solid #7a5c10;'}">`
      + `<td style="color:#806030;">${myNum}</td>`
      + `<td class="left" style="font-family:monospace;">${caret} ${mdCoordLink(g.coord)}</td>`
      + `<td class="left">${g.owner ? `<span class="player-tag">${esc(g.owner)}</span>` : ''}</td>`
      + `<td><span class="badge" style="background:#3a2c0a;color:#f0c040;">🛡 ${esc(supIsEst ? t('md_ty_support_est') : t('md_ty_support'))}</span></td>`
      + `<td class="left" colspan="2" style="color:#806030;font-size:12px;">${esc(supIsEst ? t('md_support_est_note') : t('md_support_note'))}</td>`
      + mdUnitCells(supVal, 'color:#f0c040;font-weight:600;')
      + `<td>—</td><td>${supStatus}</td></tr>`);
    firstGroup = false;

    // Remaining summary row (always visible for plan villages) — the aggregate incoming support still
    // needed: plan − support(shown) − incoming, per type. Status = "N not sent" (order-covered) or
    // "X units missing" (aggregate), green "covered" when nothing is left.
    if (g.hasPlan) {
      const owed = mdPop(g.remaining) > 0;
      const covStatus = g.hasOrders
        ? (g.missingRows.length > 0
            ? `<span style="color:#e69090;font-weight:600;">${esc(t('md_grp_not_sent')(g.missingRows.length))}</span>`
            : `<span style="color:#7fdca0;font-weight:600;">${esc(t('md_grp_covered'))}</span>`)
        : (owed
            ? `<span style="color:#e69090;font-weight:600;">${esc(t('md_grp_missing')(Math.round(mdPop(g.remaining)).toLocaleString()))}</span>`
            : `<span style="color:#7fdca0;font-weight:600;">${esc(t('md_grp_covered'))}</span>`);
      cells.push(`<tr class="md-grp-head" onclick="mdToggleGroup(mdGroups[${myNum - 1}].coord)" style="cursor:pointer;background:${owed ? 'rgba(192,64,32,0.06)' : 'rgba(64,192,96,0.05)'};">`
        + blankMeta
        + `<td><span class="badge" style="background:${owed ? '#3a1414' : '#1d3a24'};color:${owed ? '#e69090' : '#7fdca0'};">${owed ? '⚠' : '✓'} ${esc(t('md_ty_remaining'))}</span></td>`
        + `<td class="left" colspan="2" style="color:${owed ? '#e0a020' : '#5a8a5a'};font-size:12px;">${esc(owed ? t('md_remaining_note') : t('md_covered_note'))}</td>`
        + mdUnitCells(g.remaining, owed ? 'color:#e69090;font-weight:600;' : 'color:#5a8a5a;')
        + `<td>—</td><td>${covStatus}</td></tr>`);
    }
    if (!expanded) continue;

    // ── Detail rows (blank #/Target/Owner) ──
    // Stationed support (one per origin)
    for (const sp of g.supportRows) {
      cells.push(`<tr>${blankMeta}`
        + `<td><span class="badge" style="background:#1d3a24;color:#7fdca0;">🛡 ${esc(t('md_ty_stationed'))}</span></td>`
        + `<td class="left" style="font-family:monospace;">${esc(sp.originCoord || '—')}`
          + (sp.originVillage ? `<div style="color:#806030;font-size:11px;">${esc(sp.originVillage)}</div>` : '') + `</td>`
        + `<td class="left">${sp.originPlayer ? `<span class="player-tag">${esc(sp.originPlayer)}</span>` : '—'}</td>`
        + mdUnitCells(sp.units)
        + `<td>—</td><td><span style="color:#7fdca0;">${esc(t('md_st_here'))}</span></td></tr>`);
    }

    // Inbound support (per-order when this village's orders were imported, else one inferred estimate)
    if (g.hasOrders) {
      for (const o of g.orderRows) {
        const verdict = (mdVmap && mdVmap.get(o)) || 'inbound';
        cells.push(`<tr>${blankMeta}`
          + `<td><span class="badge" style="background:#14263a;color:#7fb8e6;">⏳ ${esc(t('md_ty_incoming'))}</span></td>`
          + `<td class="left" style="font-family:monospace;">${esc(o.originCoord || '—')}`
            + (o.originVillage ? `<div style="color:#806030;font-size:11px;">${esc(o.originVillage)}</div>` : '') + `</td>`
          + `<td class="left">${o.originPlayer ? `<span class="player-tag">${esc(o.originPlayer)}</span>` : '—'}</td>`
          + mdUnitCells(o.units)
          + `<td>${mdArrivalCell(o)}</td>`
          + `<td>${mdOrderStatus(verdict)}${g.deadlineMs != null ? '<br>' + mdTimingCell(o.arrivalMs, mdOrderDeadline(g, o)) : ''}</td></tr>`);
      }
    } else if (mdPop(g.incoming) > 0) {
      cells.push(`<tr>${blankMeta}`
        + `<td><span class="badge" style="background:#14263a;color:#7fb8e6;">⏳ ${esc(t('md_ty_incoming_est'))}</span></td>`
        + `<td class="left" style="color:#806030;">—</td><td class="left">—</td>`
        + mdUnitCells(g.incoming)
        + `<td>—</td><td><span style="color:#60a0e0;">${esc(t('md_st_estimated'))}</span></td></tr>`);
    }

    // Plan detail: order-covered village → a red "Still not sent" row per non-sender (rally link).
    // Other villages show no per-sender rows; their aggregate coverage is on the summary Status.
    if (g.hasPlan && g.hasOrders) {
      for (const r of g.missingRows) {
        cells.push(`<tr style="background:rgba(192,64,32,0.08);">${blankMeta}`
          + `<td>${mdSlotBadge(r)}<span class="badge" style="background:#3a1414;color:#e69090;">⚠ ${esc(t('md_ty_not_sent'))}</span></td>`
          + `<td class="left" style="font-family:monospace;">${mdCoordLink(r.srcCoord)}</td>`
          + `<td class="left">${r.srcPlayer ? `<span class="player-tag">${esc(r.srcPlayer)}</span>` : '—'}</td>`
          + mdUnitCells(r.units, 'color:#e69090;')
          + `<td>${r.arriveMs != null ? mdPlanArrivalCell(r.arriveMs) : '—'}</td>`
          + `<td>${mdNotSentStatus(r)}</td></tr>`);
      }
    }
  }

  tbody.innerHTML = cells.join('') || `<tr class="empty-row"><td colspan="12">${t('md_need_import')}</td></tr>`;
}

// Collapse/expand handlers (repaint only — data is already built in mdGroups).
function mdToggleGroup(coord) {
  if (mdExpanded[coord]) delete mdExpanded[coord]; else mdExpanded[coord] = true;
  renderMdTableBody();
}
function mdExpandAll() { mdExpanded = {}; for (const g of mdGroups) mdExpanded[g.coord] = true; renderMdTableBody(); }
function mdCollapseAll() { mdExpanded = {}; renderMdTableBody(); }

// ── Import UI ─────────────────────────────────────────────────────────────────
const MD_SUP_SNIPPET = "javascript:$.getScript('https://rapidsiege.github.io/tw-scripts/villageSupports.js');";
const MD_ORD_SNIPPET = "javascript:$.getScript('https://rapidsiege.github.io/tw-scripts/incomingOrders.js?dl=0');";
function mdCopySup() { mdCopy(MD_SUP_SNIPPET); }
function mdCopyOrd() { mdCopy(MD_ORD_SNIPPET); }
function mdCopy(txt) {
  const done = () => alert(t('mo_script_copied'));
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(txt).then(done).catch(() => mdFallbackCopy(txt, done));
  else mdFallbackCopy(txt, done);
}
function mdFallbackCopy(txt, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    done();
  } catch (e) { alert(txt); }
}
function toggleMdSupImport() { const el = document.getElementById('md-sup-wrap'); if (el) el.style.display = el.style.display === 'none' ? '' : 'none'; }
function toggleMdOrdImport() { const el = document.getElementById('md-ord-wrap'); if (el) el.style.display = el.style.display === 'none' ? '' : 'none'; }

// ── Multi-file merge (pure — harness-tested) ──────────────────────────────────
// Several batch exports selected at once are merged AFTER parsing (text concatenation would
// break JSON files and repeated CSV headers; formats can even be mixed in one selection).
// Per-village the LAST file wins — a later batch re-scanning a village is the fresher snapshot.
// Village order = first-seen across files; exportedAt = the newest file's stamp.
function mdMergeSupImports(parsedList) {
  const byCoord = {}; const order = [];
  let newest = 0;
  for (const p of parsedList) {
    for (const tg of p.targets) {
      if (!byCoord[tg.coord]) order.push(tg.coord);
      byCoord[tg.coord] = tg;
    }
    newest = Math.max(newest, p.exportedAt || 0);
  }
  return { targets: order.map(c => byCoord[c]), exportedAt: newest };
}
// Orders merge: a file re-covering a coord REPLACES that coord's orders (never double-counts a
// movement seen in two overlapping batches); coords = deduped union, first-seen order.
function mdMergeOrdImports(parsedList) {
  const byCoord = {}; const order = [];
  let newest = 0;
  for (const p of parsedList) {
    for (const c of p.coords) {
      if (!byCoord[c]) order.push(c);
      byCoord[c] = []; // this file's snapshot of c starts fresh
    }
    for (const o of p.orders) (byCoord[o.target] || (byCoord[o.target] = [])).push(o);
    newest = Math.max(newest, p.exportedAt || 0);
  }
  return { orders: order.flatMap(c => byCoord[c]), coords: order, exportedAt: newest };
}

// Re-importable JSON of the current state, in the exporters' own field names — what the cloud
// backup receives for a multi-file import (the N raw source files no longer exist as one text).
function mdSupToJson() {
  return JSON.stringify({ exported_at: mdSupAt, targets: mdSupTargets.map(tg => ({
    coords: tg.coord, village: tg.village, player: tg.owner, status: tg.status,
    own_units: tg.ownUnits || undefined,
    supports: (tg.supports || []).map(sp => ({ origin_coords: sp.originCoord,
      origin_village: sp.originVillage, origin_player: sp.originPlayer, units: sp.units })),
  })) });
}
function mdOrdToJson() {
  const byTarget = {};
  for (const o of mdOrders) (byTarget[o.target] || (byTarget[o.target] = [])).push(o);
  return JSON.stringify({ exported_at: mdOrdAt, targets: mdOrdCoords.map(c => ({
    coords: c, commands: (byTarget[c] || []).map(o => ({ id: o.id, type: 'support',
      origin_coords: o.originCoord, origin_village: o.originVillage,
      origin_player: o.originPlayer, arrival: o.arrival, units: o.units })),
  })) });
}

// files = [{name, text}] in selection order. Any unparseable file aborts the WHOLE import
// (state untouched) with a filename-specific alert — no silent partial imports.
function mdImportSupFiles(files) {
  const parsedList = [];
  for (const f of files) {
    const parsed = mdParseSupports(f.text);
    if (!parsed || !parsed.targets.length) { alert(f.name ? t('md_sup_fail_file')(f.name) : t('md_sup_fail')); return; }
    parsedList.push(parsed);
  }
  if (!parsedList.length) return;
  const merged = mdMergeSupImports(parsedList);
  mdSupTargets = merged.targets;
  mdSupAt = merged.exportedAt || Math.floor(Date.now() / 1000);
  const saved = saveManageDef(); renderManageDefTable();
  if (typeof cloudSyncManageDef === 'function') // hosted-site cloud save — original text for a
    cloudSyncManageDef(files.length === 1 ? files[0].text : mdSupToJson(), 'support'); // single source, merged JSON otherwise
  const el = document.getElementById('md-sup-wrap'); if (el) el.style.display = 'none';
  if (!saved) alert(t('md_storage_full')); // data shown this session (+ cloud-backed in prod) but not persisted locally
}
function mdImportOrdFiles(files) {
  const parsedList = [];
  for (const f of files) {
    const parsed = mdParseOrders(f.text);
    if (!parsed || (!parsed.orders.length && !(parsed.coords && parsed.coords.length))) { alert(f.name ? t('md_ord_fail_file')(f.name) : t('md_ord_fail')); return; }
    parsedList.push(parsed);
  }
  if (!parsedList.length) return;
  const merged = mdMergeOrdImports(parsedList);
  mdOrders = merged.orders;
  mdOrdCoords = merged.coords;
  mdOrdAt = merged.exportedAt || Math.floor(Date.now() / 1000);
  const saved = saveManageDef(); renderManageDefTable();
  if (typeof cloudSyncManageDef === 'function')
    cloudSyncManageDef(files.length === 1 ? files[0].text : mdOrdToJson(), 'orders');
  const el = document.getElementById('md-ord-wrap'); if (el) el.style.display = 'none';
  if (!saved) alert(t('md_storage_full')); // data shown this session (+ cloud-backed in prod) but not persisted locally
}
function mdImportSup(text) { mdImportSupFiles([{ name: '', text }]); }
function mdImportOrd(text) { mdImportOrdFiles([{ name: '', text }]); }
function mdLoadSupPaste() { const el = document.getElementById('md-sup-text'); mdImportSup(el ? el.value : ''); }
function mdLoadOrdPaste() { const el = document.getElementById('md-ord-text'); mdImportOrd(el ? el.value : ''); }
function mdLoadFile(input, which) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  Promise.all(files.map(f => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve({ name: f.name, text: e.target.result });
    reader.onerror = () => reject(f.name);
    reader.readAsText(f);
  }))).then(list => (which === 'ord' ? mdImportOrdFiles : mdImportSupFiles)(list))
    .catch(name => alert(t(which === 'ord' ? 'md_ord_fail_file' : 'md_sup_fail_file')(name)));
  input.value = '';
}
function clearManageDef() {
  if ((mdSupTargets.length || mdOrders.length) && !confirm(t('md_confirm_clear'))) return;
  mdSupTargets = []; mdOrders = []; mdSupAt = 0; mdOrdAt = 0; mdOrdCoords = [];
  saveManageDef(); renderManageDefTable();
}

// ── ✉ Export Missing PMs ──────────────────────────────────────────────────────
// The Defense-Plan rows whose sender has NOT sent yet — the same "Still not sent" set as
// the table's red rows. Grouped/split into per-player messages exactly like Plan Defense's
// ✉ Export PMs (shared defPmMessagesFrom + renderPmModal), so a laggard gets a ready-to-paste
// nudge with only the orders they still owe.
function mdMissingPlanRows() {
  const planRows = mdViewRows();
  if (!planRows.length) return [];
  // Only villages whose orders were imported can be judged "not sent" (per-village, matching the
  // table). A plan target with no order data is skipped — we can't tell who is en route there.
  const covered = new Set(mdOrdCoords);
  return mdMissingFrom(planRows.filter(r => covered.has(r.tCoord)), mdSentPop(mdSupTargets, mdOrders));
}
function showMdMissingPmExport() {
  const hasPlan = mdViewRows().length > 0;
  if (!hasPlan) { alert(t('empty_no_def_plan')); return; }
  // "Not sent" can only be judged for villages whose Support Orders were imported (they reveal who
  // is en route); without any, every not-yet-arrived sender would look missing. Require the file.
  if (!mdOrdCoords.length) { alert(t('md_missing_need_orders')); return; }
  const rows = mdMissingPlanRows();
  if (!rows.length) { alert(t('md_no_missing')); return; }
  if (typeof renderPmModal === 'function' && typeof defPmMessagesFrom === 'function')
    renderPmModal(defPmMessagesFrom(rows), t('md_missing_pm_hint'));
}
