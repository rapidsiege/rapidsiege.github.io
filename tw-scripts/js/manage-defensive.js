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
// target gets a group. When a plan exists, a red "Remaining Incoming Support"
// row shows plan − (stationed + incoming), floored at 0.
// ══════════════════════════════════════════════════════════════
const MD_STORE_KEY = 'tw_tribe_managedef';
let mdSupTargets = []; // villageSupports: [{coord, village, owner, status, ownUnits, supports:[{originCoord,originVillage,originPlayer,units}]}]
let mdOrders     = []; // incomingOrders (support only): [{id, target, originCoord, originVillage, originPlayer, arrival, arrivalMs, units}]
let mdSupAt      = 0;   // unix seconds of the villageSupports import (0 = none)
let mdOrdAt      = 0;   // unix seconds of the incomingOrders import (0 = none)

function saveManageDef() {
  localStorage.setItem(MD_STORE_KEY, JSON.stringify({
    supTargets: mdSupTargets, orders: mdOrders, supAt: mdSupAt, ordAt: mdOrdAt,
  }));
}
function loadManageDef() {
  try {
    const d = JSON.parse(localStorage.getItem(MD_STORE_KEY));
    if (d) {
      mdSupTargets = Array.isArray(d.supTargets) ? d.supTargets : [];
      mdOrders     = Array.isArray(d.orders) ? d.orders : [];
      mdSupAt      = d.supAt || 0;
      mdOrdAt      = d.ordAt || 0;
    }
  } catch {}
}

// Player names come from two clocks (troop-file raw, live-page decoded) — compare trimmed+lowercased.
function mdNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
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
function mdParseSupports(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const mkUnits = obj => { const u = {}; for (const k of UNITS) u[k] = (obj && +obj[k]) || 0; return u; };
  if (s[0] === '{') {
    let data;
    try { data = JSON.parse(s); } catch { return null; }
    if (!data || !Array.isArray(data.targets)) return null;
    const targets = data.targets.map(tg => ({
      coord: tg.coords || '', village: tg.village || '', owner: tg.player || '', status: tg.status || 'ok',
      ownUnits: tg.own_units ? mkUnits(tg.own_units) : null,
      supports: (tg.supports || []).map(sp => ({
        originCoord: sp.origin_coords || '', originVillage: sp.origin_village || '',
        originPlayer: sp.origin_player || '', units: mkUnits(sp.units),
      })),
    }));
    return { targets, exportedAt: data.exported_at || 0 };
  }
  // CSV
  const lines = s.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
  if (!lines.length) return null;
  const head = lines[0].split(',');
  const col = name => head.indexOf(name);
  if (col('Target') !== 0 || col('Type') === -1 || col('OriginCoords') === -1) return null;
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
    for (const tg of data.targets) {
      for (const c of (tg.commands || [])) {
        if (c.type !== 'support') continue;
        orders.push({
          id: c.id || '', target: tg.coords || '',
          originCoord: c.origin_coords || '', originVillage: c.origin_village || '',
          originPlayer: c.origin_player || '', arrival: c.arrival || '',
          arrivalMs: moParseArrivalMs(c.arrival), units: mkUnits(c.units),
        });
      }
    }
    return { orders, exportedAt: data.exported_at || 0 };
  }
  // CSV
  const lines = s.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
  if (!lines.length) return null;
  const head = lines[0].split(',');
  const col = name => head.indexOf(name);
  if (col('Target') !== 0 || col('Type') === -1 || col('OriginCoords') === -1) return null;
  const unitStart = (col('ArrivesIn') !== -1 ? col('ArrivesIn') : col('Arrival')) + 1;
  const unitNames = head.slice(unitStart);
  const f = (row, name) => { const i = col(name); return i === -1 ? '' : (row[i] || '').trim(); };
  const orders = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const coord = (row[0] || '').trim();
    if (!/^\d{1,3}\|\d{1,3}$/.test(coord)) continue;
    if (f(row, 'Type') !== 'support') continue;
    const u = {};
    unitNames.forEach((name, k) => { u[name] = parseInt(row[unitStart + k], 10) || 0; });
    const arrival = f(row, 'Arrival');
    orders.push({
      id: '', target: coord, originCoord: f(row, 'OriginCoords'), originVillage: f(row, 'OriginVillage'),
      originPlayer: f(row, 'OriginPlayer'), arrival, arrivalMs: moParseArrivalMs(arrival), units: u,
    });
  }
  return orders.length ? { orders, exportedAt: 0 } : null;
}

// ── Inferred inbound support from tribe_everything.txt ────────────────────────
// The "incoming" row of a village mixes (a) the owner's own troops returning from
// attacks/support/scavenging with (b) ally support en route. Own returning troops
// can't exceed what the village owns at home, so the per-type EXCESS of incoming
// over own-home troops is (heuristically) ally support inbound. Defensive types
// only — an incoming axe/light stack is not defensive support. Needs station data;
// without it (plain tribe-info file) there is no incoming row → all zeros.
// (This intentionally uses own-home troops, not "own − defense" — validated against
// real es100 snapshots where "own − defense" false-positived a village's own
// returning army as support. Easy to retune here if the game data shifts.)
function mdInferIncoming(coord) {
  const z = mdZero();
  if (typeof hasStationData !== 'function' || !hasStationData()) return z;
  const inc = (typeof incomingByCoord !== 'undefined' && incomingByCoord[coord]) || null;
  if (!inc) return z;
  const own = (typeof troopByCoord !== 'undefined' && troopByCoord[coord]) || {};
  for (const u of DEF_OBJ_UNITS) z[u] = Math.max(0, (inc[u] || 0) - (own[u] || 0));
  return z;
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
// Units match = exact per-type equality (a resend of the same packet is a duplicate).
// Two passes so exact matches claim their slots before looser matches do; orders are
// processed target- then arrival-ordered so the earliest of identical orders "matches"
// and later ones fall to "duplicate".
function mdClassifyOrders(orders, planRows) {
  const verdicts = (orders || []).map(() => 'inbound');
  if (!orders || !orders.length || !planRows || !planRows.length) return verdicts;
  const eq = (a, b) => DEF_OBJ_UNITS.every(u => ((a && a[u]) || 0) === ((b && b[u]) || 0));
  const slots = planRows.map(r => ({ src: r.srcCoord, tgt: r.tCoord, units: r.units, filled: false }));
  const plannedTgt = new Set(planRows.map(r => r.tCoord));
  const idx = orders.map((_, i) => i).sort((a, b) => {
    const A = orders[a], B = orders[b];
    return (A.target < B.target ? -1 : A.target > B.target ? 1 : 0)
      || ((A.arrivalMs || 0) - (B.arrivalMs || 0)) || (a - b);
  });
  const done = new Array(orders.length).fill(false);
  for (const i of idx) { // pass 1 — exact src+tgt+units
    const o = orders[i];
    const s = slots.find(x => !x.filled && x.tgt === o.target && x.src === o.originCoord && eq(x.units, o.units));
    if (s) { s.filled = true; verdicts[i] = 'matches'; done[i] = true; }
  }
  for (const i of idx) { // pass 2 — everything else
    if (done[i]) continue;
    const o = orders[i];
    if (plannedTgt.has(o.target)) {
      if (slots.some(x => x.filled && x.tgt === o.target && x.src === o.originCoord && eq(x.units, o.units))) { verdicts[i] = 'duplicate'; continue; }
      const s2 = slots.find(x => !x.filled && x.tgt === o.target && x.src !== o.originCoord && eq(x.units, o.units));
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
// Returns [{coord, owner, village, hasPlan, planNeed, stationed, incoming, remaining,
//           supportRows:[…], orderRows:[…], inferredIncoming, deadlineMs}] village-keyed.
// `estimate` = true when no Support Orders were imported (→ incoming from mdInferIncoming).
function mdBuildRows(supTargets, orders, planRows, opts) {
  opts = opts || {};
  const estimate = !orders || !orders.length;
  const byCoord = {}; const order = [];
  const get = coord => {
    if (!byCoord[coord]) {
      byCoord[coord] = {
        coord, owner: '', village: '', hasPlan: false,
        planNeed: mdZero(), stationed: mdZero(), incoming: mdZero(), remaining: mdZero(),
        ownUnits: mdZero(), totals: mdZero(),
        supportRows: [], orderRows: [], inferredIncoming: mdZero(), deadlineMs: null,
      };
      order.push(coord);
    }
    return byCoord[coord];
  };

  // Stationed support (villageSupports) — one supportRow per origin that carries any def unit.
  for (const tg of (supTargets || [])) {
    if (!tg.coord) continue;
    const g = get(tg.coord);
    g.owner = g.owner || tg.owner; g.village = g.village || tg.village;
    if (tg.ownUnits) mdAddUnits(g.ownUnits, tg.ownUnits); // own troops at home (villageSupports own_units row)
    for (const sp of (tg.supports || [])) {
      if (mdPop(sp.units) <= 0) continue; // skip pure-offensive (axe/light-only) support stacks
      g.supportRows.push(sp);
      mdAddUnits(g.stationed, sp.units);
    }
  }

  // Plan need + deadline (defPlanRows already carry arriveMs).
  for (const r of (planRows || [])) {
    const g = get(r.tCoord);
    g.hasPlan = true;
    g.owner = g.owner || r.tPlayer;
    mdAddUnits(g.planNeed, r.units);
    if (r.arriveMs != null && (g.deadlineMs == null || r.arriveMs < g.deadlineMs)) g.deadlineMs = r.arriveMs;
  }

  // Inbound support: per-order rows when imported, else one inferred estimate per village.
  if (!estimate) {
    for (const o of orders) {
      if (!o.target || mdPop(o.units) <= 0) continue; // support order with no def units → skip
      const g = get(o.target);
      g.orderRows.push(o);
      mdAddUnits(g.incoming, o.units);
    }
  } else {
    for (const coord of Object.keys(byCoord)) {
      const est = mdInferIncoming(coord);
      byCoord[coord].inferredIncoming = est;
      mdAddUnits(byCoord[coord].incoming, est);
    }
    // A village with inferred inbound support but no station/plan yet still deserves a row.
    if (opts.allCoords) for (const coord of opts.allCoords) {
      if (byCoord[coord]) continue;
      const est = mdInferIncoming(coord);
      if (mdPop(est) > 0) { const g = get(coord); g.inferredIncoming = est; mdAddUnits(g.incoming, est); }
    }
  }

  // Remaining = plan − (stationed + incoming), floored at 0.
  // Totals = all troops physically in the village (own + support) — the tribe export's
  // "defense" row (defenseByCoord) is authoritative and matches the .txt; without station
  // data, fall back to own_units + stationed support from the villageSupports import.
  const de = (typeof defenseByCoord !== 'undefined') ? defenseByCoord : {};
  for (const coord of order) {
    const g = byCoord[coord];
    for (const u of DEF_OBJ_UNITS) g.remaining[u] = Math.max(0, g.planNeed[u] - g.stationed[u] - g.incoming[u]);
    const station = de[coord];
    for (const u of DEF_OBJ_UNITS) g.totals[u] = station ? (station[u] || 0) : (g.ownUnits[u] + g.stationed[u]);
  }
  return order.map(c => byCoord[c]);
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
// Inbound-order arrival vs the target's plan deadline (single moment, not a window).
function mdTimingCell(arrivalMs, deadlineMs) {
  if (arrivalMs == null || deadlineMs == null) return '—';
  if (arrivalMs <= deadlineMs) return `<span style="color:#40c060;font-weight:600;">${esc(t('md_tm_in'))}</span>`;
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

function renderManageDefTable() {
  const sumEl = document.getElementById('md-summary');
  const tbody = document.getElementById('md-tbody');
  if (!tbody) return;
  const impEl = document.getElementById('md-import-status');

  const planRows = (typeof defPlanRows !== 'undefined') ? defPlanRows : [];
  const estimate = !mdOrders.length;
  // Every coord we might infer inbound support for (villages present in the troop file).
  const allCoords = (estimate && typeof villages !== 'undefined') ? villages.map(v => v.coord) : null;
  const groups = mdBuildRows(mdSupTargets, mdOrders, planRows, { allCoords });

  // Import status line
  if (impEl) {
    const parts = [];
    if (mdSupAt) parts.push(t('md_imp_sup')(mdSupTargets.length, new Date(mdSupAt * 1000).toLocaleString()));
    if (mdOrdAt) parts.push(t('md_imp_ord')(mdOrders.length, new Date(mdOrdAt * 1000).toLocaleString()));
    impEl.textContent = parts.join('  ·  ');
  }

  if (!groups.length) {
    if (sumEl) sumEl.innerHTML = `<span style="color:#a08050;">${esc(t('md_need_import'))}</span>`;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="12">${t('md_need_import')}</td></tr>`;
    return;
  }

  // Summary tallies
  let nSupport = 0, nIncoming = 0;
  const totStationed = mdZero(), totIncoming = mdZero(), totRemaining = mdZero();
  for (const g of groups) {
    if (g.supportRows.length) nSupport++;
    if (mdPop(g.incoming) > 0) nIncoming++;
    mdAddUnits(totStationed, g.stationed); mdAddUnits(totIncoming, g.incoming); mdAddUnits(totRemaining, g.remaining);
  }
  const anyPlan = groups.some(g => g.hasPlan);
  if (sumEl) {
    const chips = [
      t('md_sum_support')(nSupport),
      t('md_sum_incoming')(nIncoming, estimate ? t('md_sum_est') : ''),
      t('md_sum_stationed')(Math.round(mdPop(totStationed)).toLocaleString()),
    ];
    if (anyPlan && mdPop(totRemaining) > 0)
      chips.push(`<span style="color:#e06040;font-weight:600;">${esc(t('md_sum_remaining')(Math.round(mdPop(totRemaining)).toLocaleString()))}</span>`);
    sumEl.innerHTML = chips.map(c => c.startsWith('<span') ? c : esc(c)).join(' · ');
  }

  // Classify every inbound order against the plan once (consumes slots across all targets),
  // then look each order's verdict up by reference (g.orderRows hold the same objects).
  const verdicts = mdClassifyOrders(mdOrders, planRows);
  const vmap = new Map();
  mdOrders.forEach((o, i) => vmap.set(o, verdicts[i]));

  const cells = [];
  let firstGroup = true, groupNum = 0;
  for (const g of groups) {
    const rowsHtml = [];
    const myNum = ++groupNum; // sequential per rendered village (rolled back below if the group is empty)
    let head = true; // #/Target/Owner only on the group's first line
    const meta = () => {
      const c = `<td style="color:#806030;">${head ? myNum : ''}</td>`
        + `<td class="left" style="font-family:monospace;">${head ? mdCoordLink(g.coord) : ''}</td>`
        + `<td class="left">${head && g.owner ? `<span class="player-tag">${esc(g.owner)}</span>` : ''}</td>`;
      head = false;
      return c;
    };

    // Totals (main row) — all troops physically in the village (own + support), matching
    // the tribe export's "defense" row. Carries the #/Target/Owner header for the group.
    if (mdPop(g.totals) > 0) {
      rowsHtml.push(`<tr style="background:rgba(240,192,64,0.05);">${meta()}`
        + `<td><span class="badge" style="background:#3a2c0a;color:#f0c040;">Σ ${esc(t('md_ty_totals'))}</span></td>`
        + `<td class="left" colspan="2" style="color:#806030;font-size:12px;">${esc(t('md_totals_note'))}</td>`
        + mdUnitCells(g.totals, 'color:#f0c040;font-weight:600;')
        + `<td>—</td><td>—</td></tr>`);
    }

    // Stationed support rows (one per origin)
    for (const sp of g.supportRows) {
      rowsHtml.push(`<tr>${meta()}`
        + `<td><span class="badge" style="background:#1d3a24;color:#7fdca0;">🛡 ${esc(t('md_ty_stationed'))}</span></td>`
        + `<td class="left" style="font-family:monospace;">${esc(sp.originCoord || '—')}`
          + (sp.originVillage ? `<div style="color:#806030;font-size:11px;">${esc(sp.originVillage)}</div>` : '') + `</td>`
        + `<td class="left">${sp.originPlayer ? `<span class="player-tag">${esc(sp.originPlayer)}</span>` : '—'}</td>`
        + mdUnitCells(sp.units)
        + `<td>—</td><td><span style="color:#7fdca0;">${esc(t('md_st_here'))}</span></td></tr>`);
    }

    // Inbound support rows
    if (!estimate) {
      for (const o of g.orderRows) {
        const verdict = vmap.get(o) || 'inbound';
        rowsHtml.push(`<tr>${meta()}`
          + `<td><span class="badge" style="background:#14263a;color:#7fb8e6;">⏳ ${esc(t('md_ty_incoming'))}</span></td>`
          + `<td class="left" style="font-family:monospace;">${esc(o.originCoord || '—')}`
            + (o.originVillage ? `<div style="color:#806030;font-size:11px;">${esc(o.originVillage)}</div>` : '') + `</td>`
          + `<td class="left">${o.originPlayer ? `<span class="player-tag">${esc(o.originPlayer)}</span>` : '—'}</td>`
          + mdUnitCells(o.units)
          + `<td>${mdArrivalCell(o)}</td>`
          + `<td>${mdOrderStatus(verdict)}${g.deadlineMs != null ? '<br>' + mdTimingCell(o.arrivalMs, g.deadlineMs) : ''}</td></tr>`);
      }
    } else if (mdPop(g.incoming) > 0) {
      rowsHtml.push(`<tr>${meta()}`
        + `<td><span class="badge" style="background:#14263a;color:#7fb8e6;">⏳ ${esc(t('md_ty_incoming_est'))}</span></td>`
        + `<td class="left" style="color:#806030;">—</td><td class="left">—</td>`
        + mdUnitCells(g.incoming)
        + `<td>—</td><td><span style="color:#60a0e0;">${esc(t('md_st_estimated'))}</span></td></tr>`);
    }

    // Remaining (only meaningful with a plan) — red when anything is still owed, green when covered.
    if (g.hasPlan) {
      const owed = mdPop(g.remaining) > 0;
      rowsHtml.push(`<tr style="background:${owed ? 'rgba(192,64,32,0.08)' : 'rgba(64,192,96,0.06)'};">${meta()}`
        + `<td><span class="badge" style="background:${owed ? '#3a1414' : '#1d3a24'};color:${owed ? '#e69090' : '#7fdca0'};">${owed ? '⚠' : '✓'} ${esc(t('md_ty_remaining'))}</span></td>`
        + `<td class="left" colspan="2" style="color:${owed ? '#e0a020' : '#5a8a5a'};font-size:12px;">${esc(owed ? t('md_remaining_note') : t('md_covered_note'))}</td>`
        + mdUnitCells(g.remaining, owed ? 'color:#e69090;font-weight:600;' : 'color:#5a8a5a;')
        + `<td>—</td><td>—</td></tr>`);
    }

    if (!rowsHtml.length) { groupNum--; continue; } // nothing to show → don't consume a number
    if (!firstGroup) rowsHtml[0] = rowsHtml[0].replace('<tr>', '<tr style="border-top:2px solid #7a5c10">')
      .replace('<tr style="background', '<tr style="border-top:2px solid #7a5c10;background');
    firstGroup = false;
    cells.push(...rowsHtml);
  }

  tbody.innerHTML = cells.join('') || `<tr class="empty-row"><td colspan="12">${t('md_need_import')}</td></tr>`;
}

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

function mdImportSup(text) {
  const parsed = mdParseSupports(text);
  if (!parsed || !parsed.targets.length) { alert(t('md_sup_fail')); return; }
  mdSupTargets = parsed.targets;
  mdSupAt = parsed.exportedAt || Math.floor(Date.now() / 1000);
  saveManageDef(); renderManageDefTable();
  const el = document.getElementById('md-sup-wrap'); if (el) el.style.display = 'none';
}
function mdImportOrd(text) {
  const parsed = mdParseOrders(text);
  if (!parsed || !parsed.orders.length) { alert(t('md_ord_fail')); return; }
  mdOrders = parsed.orders;
  mdOrdAt = parsed.exportedAt || Math.floor(Date.now() / 1000);
  saveManageDef(); renderManageDefTable();
  const el = document.getElementById('md-ord-wrap'); if (el) el.style.display = 'none';
}
function mdLoadSupPaste() { const el = document.getElementById('md-sup-text'); mdImportSup(el ? el.value : ''); }
function mdLoadOrdPaste() { const el = document.getElementById('md-ord-text'); mdImportOrd(el ? el.value : ''); }
function mdLoadFile(input, which) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => (which === 'ord' ? mdImportOrd : mdImportSup)(e.target.result);
  reader.readAsText(file);
  input.value = '';
}
function clearManageDef() {
  if ((mdSupTargets.length || mdOrders.length) && !confirm(t('md_confirm_clear'))) return;
  mdSupTargets = []; mdOrders = []; mdSupAt = 0; mdOrdAt = 0;
  saveManageDef(); renderManageDefTable();
}
