// ══════════════════════════════════════════════════════════════
// MANAGE OFFENSIVE (v4.0.0)
// Assess the generated Plan Offensive against the REAL incoming commands
// exported by the "Target Village Orders Exporter" userscript
// (incomingOrders.js): paste/load its CSV or JSON export and every visible
// attack heading to a planned target is matched against the plan rows —
// exact origin village first, then same-player-other-village (players may
// switch offs when timings suit them better). Leftover attacks on planned
// targets are listed as EXTRAS (with a why), attacks on coords the plan
// doesn't know become an "unplanned targets" block at the end.
// Support/returning commands and FAKES (see moIsFake) are ignored outright.
// ══════════════════════════════════════════════════════════════
const MO_STORE_KEY = 'tw_tribe_manageoff';
let moTargets    = []; // [{coord, village, owner, status}] one per exported target, import order
let moCommands   = []; // [{id, target, type, size, snob, label, originCoord, originVillage, originPlayer, arrival, arrivalMs, units|null}]
let moImportedAt = 0;  // unix seconds of the export (JSON) or of the import (CSV); 0 = nothing imported
let moShowUnitTip = true; // "show units in command when hovering" header toggle (persisted)

function saveManage() {
  localStorage.setItem(MO_STORE_KEY, JSON.stringify({ targets: moTargets, commands: moCommands, importedAt: moImportedAt, showUnitTip: moShowUnitTip }));
}
function loadManage() {
  try {
    const d = JSON.parse(localStorage.getItem(MO_STORE_KEY));
    if (d) {
      moTargets = d.targets || []; moCommands = d.commands || []; moImportedAt = d.importedAt || 0;
      moShowUnitTip = d.showUnitTip !== false; // default ON
    }
  } catch {}
  const tt = document.getElementById('mo-tip-toggle');
  if (tt) tt.checked = moShowUnitTip;
}
function updMoTipToggle(on) {
  moShowUnitTip = !!on;
  saveManage();
  renderManageTable();
}

// Player names in planRows come decoded from the troop file, names in the export come
// from live game pages — compare them case-insensitively and trimmed.
function moNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

// "06.07.26 11:52:50:343" (dd.mm.yy[yy] hh:mm:ss[:ms], SERVER wall time — the
// info_command arrival format) → epoch ms via the configured server UTC offset.
// Anything else (phase-1 fallback text, countdowns) → null: shown raw, no verdict.
function moParseArrivalMs(str) {
  const m = String(str || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?$/);
  if (!m) return null;
  const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  const off = parseFloat(otCfg.serverUtcOffset);
  return Date.UTC(y, +m[2] - 1, +m[1], +m[4], +m[5], +m[6], +(m[7] || 0)) - (isNaN(off) ? 2 : off) * 3600000;
}

// A FAKE: units are visible, no noble aboard, and the army has essentially no
// offensive punch — e.g. 1 spy + 1 ram, sent only to inflate the incoming count
// so the defender has more trouble dodging. Attack power = Σ count × ATT value;
// under 1000 with fewer than 5 catapults it can't dent anything (any real off is
// far above, and a planned 20-catapult strike alone scores 2000 — the ≥5-cat
// exemption keeps small demolition attacks matchable). Hidden units (a tribe
// mate's command) → can't judge → treated as real.
const MO_FAKE_MAX_ATT = 1000, MO_FAKE_MIN_CATS = 5;
function moIsFake(units) {
  if (!units) return false;
  if ((units.snob || 0) > 0) return false;
  if ((units.catapult || 0) >= MO_FAKE_MIN_CATS) return false;
  return moCmdPower(units) < MO_FAKE_MAX_ATT;
}

// Off power of the units travelling in a command (Σ count × ATT). null = hidden.
function moCmdPower(units) {
  if (!units) return null;
  let p = 0;
  for (const u in units) p += (units[u] || 0) * (ATT[u] || 0);
  return p;
}

// ── Import parsing (both incomingOrders.js export formats) ───────────────────
// JSON: {exported_at, targets:[{coords, village, player, status, commands:[…]}]}.
// CSV : header-driven (column NAMES, not positions), so the v1.0 header
//   Target,TargetVillage,TargetOwner,Type,Size,Command,OriginCoords,OriginVillage,OriginPlayer,Arrival,ArrivesIn,<units…>
// and the pre-1.0 one (no Size/ArrivesIn/units) both parse. Unit columns = every
// header after ArrivesIn (or after Arrival when ArrivesIn is absent).
// ONLY type 'attack' commands are kept — support/returning/cancel are ignored per
// design (they never match a plan row). Noble flag: JSON carries contains_snob
// (from the phase-1 icon — visible for tribe mates too); CSV can only infer it
// from a snob unit count, which the game hides on other players' commands. The
// command id (→ clickable info_command link) exists ONLY in the JSON export —
// two reasons the import hint says "JSON preferred".
// Returns {targets, commands, exportedAt} or null when nothing parseable.
function moParseImport(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (s[0] === '{') {
    let data;
    try { data = JSON.parse(s); } catch { return null; }
    if (!data || !Array.isArray(data.targets)) return null;
    const targets = [], commands = [];
    for (const tg of data.targets) {
      targets.push({ coord: tg.coords || '', village: tg.village || '', owner: tg.player || '', status: tg.status || 'ok' });
      for (const c of (tg.commands || [])) {
        if (c.type !== 'attack') continue;
        const units = c.units && Object.values(c.units).some(n => n > 0) ? c.units : null; // all-zero = hidden (tribe mate)
        commands.push({
          id: c.id || '', target: tg.coords || '', type: 'attack', size: c.size || '',
          snob: !!c.contains_snob || !!(units && units.snob > 0),
          label: c.label || '', originCoord: c.origin_coords || '', originVillage: c.origin_village || '',
          originPlayer: c.origin_player || '', arrival: c.arrival || '',
          arrivalMs: moParseArrivalMs(c.arrival), units,
        });
      }
    }
    return { targets, commands, exportedAt: data.exported_at || 0 };
  }
  // CSV
  const lines = s.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
  if (!lines.length) return null;
  const head = lines[0].split(',');
  const col = name => head.indexOf(name);
  if (col('Target') !== 0 || col('Type') === -1 || col('OriginCoords') === -1) return null;
  const unitStart = (col('ArrivesIn') !== -1 ? col('ArrivesIn') : col('Arrival')) + 1;
  const unitNames = head.slice(unitStart);
  const CMD_TYPES = new Set(['attack', 'support', 'return', 'cancel', 'other']); // command row vs target-status row
  const targets = [], commands = [], seen = {};
  const f = (row, name) => { const i = col(name); return i === -1 ? '' : (row[i] || '').trim(); };
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(','); // ioCsvField flattened commas out of every text field
    const coord = (row[0] || '').trim();
    if (!/^\d{1,3}\|\d{1,3}$/.test(coord)) continue;
    const type = f(row, 'Type');
    if (!seen[coord]) {
      seen[coord] = true;
      targets.push({ coord, village: f(row, 'TargetVillage'), owner: f(row, 'TargetOwner'),
                     status: CMD_TYPES.has(type) ? 'ok' : (type || 'none') });
    }
    if (type !== 'attack') continue; // status rows + support/returning/cancel all ignored
    let units = null;
    if (unitNames.length) {
      const u = {};
      let any = false;
      unitNames.forEach((name, k) => { const n = parseInt(row[unitStart + k], 10) || 0; u[name] = n; if (n > 0) any = true; });
      if (any) units = u; // all blank/zero = units not visible (tribe mate's command)
    }
    const arrival = f(row, 'Arrival');
    commands.push({
      id: '', target: coord, type: 'attack', size: f(row, 'Size'),
      snob: !!(units && units.snob > 0),
      label: f(row, 'Command'), originCoord: f(row, 'OriginCoords'), originVillage: f(row, 'OriginVillage'),
      originPlayer: f(row, 'OriginPlayer'), arrival,
      arrivalMs: moParseArrivalMs(arrival), units,
    });
  }
  return (targets.length || commands.length) ? { targets, commands, exportedAt: 0 } : null;
}

// ── Arrival vs the row's landing window ───────────────────────────────────────
// {status:'in'|'early'|'late'|'unknown', deltaMin}. Window times live on the plan
// date (otCfg.dateISO) in server wall time, same clock the arrival was parsed on.
function moTimingVerdict(windowStr, arrivalMs) {
  const w = parseWindowStr(windowStr);
  if (!w || arrivalMs == null) return { status: 'unknown', deltaMin: 0 };
  const from = serverWallMs(otCfg.dateISO, w.f), to = serverWallMs(otCfg.dateISO, w.to);
  if (from === null) return { status: 'unknown', deltaMin: 0 };
  if (arrivalMs < from) return { status: 'early', deltaMin: (from - arrivalMs) / 60000 };
  if (arrivalMs > to)   return { status: 'late',  deltaMin: (arrivalMs - to) / 60000 };
  return { status: 'in', deltaMin: 0 };
}

// Preference score when several commands could fill the same plan row (lower wins):
// size fit first — an off row wants the big attack, a catapult row the small one —
// then the arrival closest to the row's landing window.
function moCmdScore(cmd, r) {
  const SIZE = { large: 0, medium: 1, small: 2 };
  let sz = cmd.size in SIZE ? SIZE[cmd.size] : 1.5;
  if (r.type === 'catapult') sz = 2 - sz;
  const v = moTimingVerdict(r.window, cmd.arrivalMs);
  return sz * 10000 + (v.status === 'unknown' ? 5000 : v.deltaMin);
}

// ── The matcher (pure — harness-tested) ───────────────────────────────────────
// rows = planRows, commands = imported commands. Fakes are dropped up front
// (tallied for the summary); anything not type 'attack' is ignored defensively
// (the parser already keeps attacks only). Per planned target, three passes:
//   1 exact  — an off/catapult row with a prescribed source claims a non-noble
//              attack launched from EXACTLY that village
//   2 snob   — a snob row soaks up to `count` noble attacks from its assigned
//              player (named trains first, engine-unassigned trains take leftovers)
//   3 player — an unmatched off/catapult row claims a non-noble attack from its
//              player's OTHER villages (off-switching for better timings is fine)
// Returns:
//   rowMatch  — aligned to rows: null | {kind:'exact'|'player', cmd} | {kind:'snob', cmds:[…]}
//   extrasBy  — tCoord → [{cmd, reason:'extra_assigned'|'extra_other_target'|'extra_foreign'}]
//   unplanned — [{coord, cmds}] attacks on coords the plan doesn't target
//   nAttacks / nFakes — import tallies for the summary
function moMatchPlan(rows, commands) {
  const atk = commands.filter(c => c.type === 'attack' && !moIsFake(c.units));
  const nFakes = commands.filter(c => c.type === 'attack' && moIsFake(c.units)).length;
  const used = new Array(atk.length).fill(false);
  const rowMatch = rows.map(r => (r.type === 'snob' ? { kind: 'snob', cmds: [] } : null));

  const rowsBy = {}, cmdsBy = {};
  rows.forEach((r, i) => { (rowsBy[r.tCoord] = rowsBy[r.tCoord] || []).push(i); });
  atk.forEach((c, i) => { (cmdsBy[c.target] = cmdsBy[c.target] || []).push(i); });
  const senderAll = new Set(rows.map(r => moNorm(r.srcPlayer)).filter(Boolean));

  const extrasBy = {};
  for (const coord of Object.keys(rowsBy)) {
    const ri = rowsBy[coord];
    const ci = cmdsBy[coord] || [];
    const free = () => ci.filter(k => !used[k]);
    const claim = (i, cand, kind) => {
      if (!cand.length) return;
      let best = cand[0];
      for (const k of cand) if (moCmdScore(atk[k], rows[i]) < moCmdScore(atk[best], rows[i])) best = k;
      used[best] = true;
      rowMatch[i] = { kind, cmd: atk[best] };
    };

    for (const i of ri) { // pass 1 — exact origin village
      const r = rows[i];
      if (r.type === 'snob' || !r.srcCoord) continue;
      claim(i, free().filter(k => !atk[k].snob && atk[k].originCoord === r.srcCoord), 'exact');
    }
    for (const named of [true, false]) { // pass 2 — noble trains
      for (const i of ri) {
        const r = rows[i];
        if (r.type !== 'snob' || !!r.srcPlayer !== named) continue;
        const cand = free().filter(k => atk[k].snob && (!named || moNorm(atk[k].originPlayer) === moNorm(r.srcPlayer)));
        cand.sort((a, b) => (atk[a].arrivalMs || 0) - (atk[b].arrivalMs || 0));
        for (const k of cand.slice(0, r.count || 1)) { used[k] = true; rowMatch[i].cmds.push(atk[k]); }
      }
    }
    for (const i of ri) { // pass 3 — same player, another of their villages
      const r = rows[i];
      if (r.type === 'snob' || rowMatch[i] || !r.srcPlayer) continue;
      claim(i, free().filter(k => !atk[k].snob && moNorm(atk[k].originPlayer) === moNorm(r.srcPlayer)), 'player');
    }
    // leftovers on this planned target = extra attacks nobody planned
    const here = new Set(ri.map(i => moNorm(rows[i].srcPlayer)).filter(Boolean));
    for (const k of free()) {
      const who = moNorm(atk[k].originPlayer);
      const reason = here.has(who) ? 'extra_assigned' : senderAll.has(who) ? 'extra_other_target' : 'extra_foreign';
      (extrasBy[coord] = extrasBy[coord] || []).push({ cmd: atk[k], reason });
    }
  }
  const unplanned = [];
  for (const coord of Object.keys(cmdsBy)) {
    if (rowsBy[coord]) continue;
    unplanned.push({ coord, cmds: cmdsBy[coord].map(k => atk[k]) });
  }
  return { rowMatch, extrasBy, unplanned, nAttacks: atk.length, nFakes };
}

// A still-unmatched row is PENDING while its latest launch moment (window end minus
// travel; window end alone for origin-free snob trains) is in the future — the attack
// may simply not exist yet. Past that moment it's MISSING. No window/date = pending.
function moRowPending(r) {
  const w = parseWindowStr(r.window);
  const landMs = w ? serverWallMs(otCfg.dateISO, w.to) : null;
  if (landMs === null) return true;
  return serverNowMs() < landMs - (typeof r.travel === 'number' ? r.travel : 0) * 60000;
}

// ── In-game links ─────────────────────────────────────────────────────────────
// info_command page of a matched command — needs the command id, which only the
// JSON export carries. `&type=other` mirrors the game's own command links.
function moCommandUrl(cmd) {
  if (!cmd || !cmd.id || !otCfg.serverUrl) return null;
  const host = otCfg.serverUrl.replace(/^https?:\/\//, '');
  return `https://${host}/game.php?screen=info_command&id=${cmd.id}&type=other`;
}
// Target coord → its info_village page (shows ALL incoming attacks on it). Plain
// Coord-colored text, underline only — same treatment as the Outbound Offs link.
function moCoordLink(coord) {
  const url = (typeof villageInfoUrl === 'function') ? villageInfoUrl(coord) : null;
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:inherit;">${esc(coord)}</a>` : esc(coord);
}
// Wrap a status span in its command's info_command link (keeps the status color,
// underline signals clickability). No id (CSV import) → plain span.
function moStatusLink(inner, cmd) {
  const url = moCommandUrl(cmd);
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">${inner}</a>` : inner;
}

// ── Units hover tooltip (same look as the map's village tooltip) ──────────────
// Rebuilt on every render: cells whose row's matched command has visible units
// get mouse handlers with an index into moTipData — only on the Type→Actual
// Player columns (the identifying cells), not the whole row, and only while the
// header toggle is ON. Tribe mates' commands hide their units → no tooltip.
let moTipData = [];
function moTipAttrs(cmd) {
  if (!moShowUnitTip || !cmd || !cmd.units) return '';
  moTipData.push(cmd.units);
  return ` onmouseenter="moTipShow(event,${moTipData.length - 1})" onmousemove="moTipMove(event)" onmouseleave="moTipHide()"`;
}
function moTipHtml(units) {
  const ic = (typeof twIcon === 'function') ? twIcon : () => '';
  const keys = [...new Set([...(typeof UNITS !== 'undefined' ? UNITS : []), ...Object.keys(units)])];
  const chips = keys.filter(u => (units[u] || 0) > 0)
    .map(u => `<span class="map-tt-unit">${ic(u) || esc(u) + ' '}${(+units[u]).toLocaleString()}</span>`).join('');
  return `<div class="map-tt-troops-h">${esc(t('mo_tt_units'))}</div><div class="map-tt-units">${chips}</div>`;
}
function moTipShow(e, i) {
  const tip = document.getElementById('mo-tooltip');
  if (!tip || !moTipData[i]) return;
  tip.innerHTML = moTipHtml(moTipData[i]);
  tip.style.display = 'block';
  moTipMove(e);
}
function moTipMove(e) {
  const tip = document.getElementById('mo-tooltip');
  if (!tip || tip.style.display !== 'block') return;
  tip.style.left = (e.clientX + 14) + 'px';
  tip.style.top  = (e.clientY + 14) + 'px';
}
function moTipHide() {
  const tip = document.getElementById('mo-tooltip');
  if (tip) tip.style.display = 'none';
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function moFmtDelta(min) { return fmtTime(Math.round(min)); }
function moTimingCell(windowStr, arrivalMs) {
  const v = moTimingVerdict(windowStr, arrivalMs);
  if (v.status === 'in')    return `<span style="color:#40c060;font-weight:600;">${esc(t('mo_tm_in'))}</span>`;
  if (v.status === 'early') return `<span style="color:#e0a020;font-weight:600;">${esc(t('mo_tm_early')(moFmtDelta(v.deltaMin)))}</span>`;
  if (v.status === 'late')  return `<span style="color:#e06040;font-weight:600;">${esc(t('mo_tm_late')(moFmtDelta(v.deltaMin)))}</span>`;
  return '—';
}
// Same badge look as the Plan Offensive table so types read identically across
// tabs. A snob train renders one row PER NOBLE (j/n suffix when n > 1).
function moTypeBadge(r, j, n) {
  if (r.type === 'snob')
    return `<span class="badge badge-snob">👑 ${t(r.escorted ? 'type_snob_split' : 'type_snob')}${n > 1 ? ` ${j + 1}/${n}` : ''}</span>`;
  if (r.type === 'catapult')
    return `<span class="badge" style="background:#5a3f6a;color:#e8d8f0;">${twIcon('catapult')} ${r.cats}</span>`;
  return `<span class="badge badge-${r.type === 'complete' ? 'complete' : r.type === 'tq' ? 'tq' : 'half'}">${t('tier_' + r.type)}</span>`;
}
// Actual distance · travel from a real origin (base pace: snob for nobles, ram/off
// otherwise — mirrors the plan engine, which times catapult rows at off pace too).
function moDistTravel(originCoord, tCoord, type) {
  const a = parseCoordStr(originCoord), b = parseCoordStr(tCoord);
  if (!a || !b) return '—';
  const d = distXY(a, b);
  const tr = travelTimeMin(d, PLAN_BASE_MIN[type === 'snob' ? 'snob' : 'off'], twWorldSpeed, twUnitSpeed);
  return `${d.toFixed(1)} · ${fmtTime(tr)}`;
}
function moOriginCell(cmd) {
  return `<span style="font-family:monospace;">${esc(cmd.originCoord || '?')}</span>`
    + (cmd.originVillage ? `<div style="color:#806030;font-size:11px;">${esc(cmd.originVillage)}</div>` : '');
}
// Arrival with the date, time and milliseconds in distinct colors so the part
// that matters when scanning (the wall time) pops: h:m:s in the Window-column
// blue, milliseconds in light teal, date muted. Unparseable strings stay plain.
function moArrivalCell(cmd) {
  const s = cmd.arrival || '';
  const m = s.match(/^(\d{1,2}\.\d{1,2}\.\d{2,4})\s+(\d{1,2}:\d{2}:\d{2})(?::(\d{1,3}))?$/);
  if (!m) return `<span style="font-family:monospace;font-size:11px;">${esc(s || '—')}</span>`;
  return `<span style="font-family:monospace;font-size:11px;">`
    + `<span style="color:#806030;">${esc(m[1])}</span> `
    + `<span style="color:#60a0e0;font-weight:600;">${esc(m[2])}</span>`
    + (m[3] != null ? `<span style="color:#60d0a0;">:${esc(m[3])}</span>` : '')
    + `</span>`;
}
// Power column: the command's attack icon(s) (size variant from the phase-1 icon,
// plus the snob icon when a noble rides along) and the off power of the units
// sent, in thousands (438,750 → 439K). Hidden units → icons only.
function moCmdIcons(cmd) {
  let h = '';
  if (cmd.size) h += `<img class="tw-ic" src="icons/units/attack_${esc(cmd.size)}.webp" alt="${esc(cmd.size)}">`;
  if (cmd.snob) h += twIcon('snob');
  return h;
}
function moPowerCell(cmd) {
  if (!cmd) return '—';
  const p = moCmdPower(cmd.units);
  const num = p == null ? '' : ` <span style="color:#f0c040;font-weight:600;">${Math.round(p / 1000)}K</span>`;
  return (moCmdIcons(cmd) + num) || '—';
}

function renderManageTable() {
  const sumEl = document.getElementById('mo-summary');
  const tbody = document.getElementById('mo-tbody');
  if (!sumEl || !tbody) return;
  const impEl = document.getElementById('mo-import-status');
  moTipData = [];

  const rows = (typeof planRows !== 'undefined') ? planRows : [];
  if (!rows.length) {
    sumEl.innerHTML = '';
    if (impEl) impEl.textContent = '';
    tbody.innerHTML = `<tr class="empty-row"><td colspan="14">${t('mo_need_plan')}</td></tr>`;
    return;
  }

  const ownerBy = {};
  for (const tg of moTargets) ownerBy[tg.coord] = tg;
  const M = moMatchPlan(rows, moCommands);

  // summary tallies — snob trains count PER NOBLE (they render per noble too)
  let nExact = 0, nPlayer = 0, nNoble = 0, nMiss = 0, nPend = 0, total = 0;
  const tm = { in: 0, early: 0, late: 0, unknown: 0 };
  const tally = (windowStr, arrivalMs) => { tm[moTimingVerdict(windowStr, arrivalMs).status]++; };
  rows.forEach((r, i) => {
    const m = M.rowMatch[i];
    if (r.type === 'snob') {
      const want = r.count || 1;
      total += want;
      nNoble += m.cmds.length;
      const unfilled = want - m.cmds.length;
      if (unfilled > 0) (moRowPending(r) ? nPend += unfilled : nMiss += unfilled);
      m.cmds.forEach(c => tally(r.window, c.arrivalMs));
    } else {
      total++;
      if (m) { (m.kind === 'exact' ? nExact++ : nPlayer++); tally(r.window, m.cmd.arrivalMs); }
      else (moRowPending(r) ? nPend++ : nMiss++);
    }
  });
  const nExtras = Object.values(M.extrasBy).reduce((s, a) => s + a.length, 0);

  if (impEl) impEl.textContent = moCommands.length
    ? t('mo_imported')(moCommands.length, moTargets.length, moImportedAt ? new Date(moImportedAt * 1000).toLocaleString() : '?')
    : '';
  if (!moCommands.length) {
    sumEl.innerHTML = `<span style="color:#a08050;">${esc(t('mo_need_import'))}</span>`;
  } else {
    const parts = [
      t('mo_sum_attacks')(nExact + nPlayer + nNoble, total),
      t('mo_sum_detail')(nExact, nPlayer, nNoble),
      nPend ? t('mo_sum_pending')(nPend) : '',
      nMiss ? `<span style="color:#e06040;font-weight:600;">${esc(t('mo_sum_missing')(nMiss))}</span>` : '',
      nExtras ? `<span style="color:#e0a020;font-weight:600;">${esc(t('mo_sum_extras')(nExtras))}</span>` : '',
      M.unplanned.length ? t('mo_sum_unplanned')(M.unplanned.length) : '',
      M.nFakes ? t('mo_sum_fakes')(M.nFakes) : '',
    ].filter(Boolean).map(x => x.startsWith('<span') ? x : esc(x));
    const timing = t('mo_sum_timing')(tm.in, tm.early, tm.late, tm.unknown);
    sumEl.innerHTML = parts.join(' · ') + `<br>${esc(timing)}`;
  }

  const cells = [];
  let lastIdx = null;
  rows.forEach((r, i) => {
    const first = r.tIdx !== lastIdx;
    lastIdx = r.tIdx;
    const m = M.rowMatch[i];
    const isSnob = r.type === 'snob';
    const nSub = isSnob ? (r.count || 1) : 1; // one display row per noble in a train

    for (let j = 0; j < nSub; j++) {
      const cmd  = isSnob ? (m.cmds[j] || null) : (m ? m.cmd : null);
      const kind = isSnob ? (cmd ? 'snob' : null) : (m ? m.kind : null);
      const head = first && j === 0; // #/Target/Defender only on the target's first line

      let status, origin = '—', originPlayer = '—', distTravel = '—', arrival = '—', timing = '—';
      if (cmd) {
        const label = kind === 'player'
          ? `<span style="color:#e0a020;font-weight:600;">${esc(t('mo_st_player'))}</span>`
          : `<span style="color:#40c060;font-weight:600;">${esc(t('mo_st_exact'))}</span>`;
        status = moStatusLink(label, cmd);
        origin = moOriginCell(cmd);
        originPlayer = cmd.originPlayer ? `<span class="player-tag">${esc(cmd.originPlayer)}</span>` : '—';
        distTravel = moDistTravel(cmd.originCoord, r.tCoord, r.type);
        arrival = moArrivalCell(cmd);
        timing = moTimingCell(r.window, cmd.arrivalMs);
      } else {
        status = moRowPending(r)
          ? `<span style="color:#a08050;">${esc(t('mo_st_pending'))}</span>`
          : `<span style="color:#e06040;font-weight:600;">${esc(t('mo_st_missing'))}</span>`;
      }

      // conquered mid-operation? flag when the import saw a different owner
      const imp = ownerBy[r.tCoord];
      const ownerWarn = head && imp && imp.owner && r.tPlayer && moNorm(imp.owner) !== moNorm(r.tPlayer)
        ? ` <span title="${esc(t('mo_owner_mismatch')(imp.owner))}" style="color:#e0a020;cursor:help;">⚠</span>` : '';

      const tip = moTipAttrs(cmd); // same handler attrs on every identifying cell (Type → Actual Player)
      cells.push(`
    <tr${head && i > 0 ? ' style="border-top:2px solid #7a5c10"' : ''}>
      <td style="color:#806030;">${head ? r.tIdx : ''}</td>
      <td class="left" style="font-family:monospace;">${head ? moCoordLink(r.tCoord) : ''}</td>
      <td class="left">${head && r.tPlayer ? `<span class="player-tag">${esc(r.tPlayer)}</span>` : ''}${ownerWarn}</td>
      <td${tip}>${moTypeBadge(r, j, nSub)}</td>
      <td class="left" style="font-family:monospace;"${tip}>${isSnob ? `<span style="color:#e0a020;">👑</span>` : (r.unassigned ? `<span style="color:#e06040;">${t('bb_unassigned')}</span>` : esc(r.srcCoord || '—'))}</td>
      <td class="left"${tip}>${r.srcPlayer ? `<span class="player-tag">${esc(r.srcPlayer)}</span>` : '—'}</td>
      <td style="color:#60a0e0;font-weight:600;font-family:monospace;"${tip}>${esc(fmtWindow(r.window) || '—')}</td>
      <td${tip}>${status}</td>
      <td style="white-space:nowrap;"${tip}>${moPowerCell(cmd)}</td>
      <td class="left"${tip}>${origin}</td>
      <td class="left"${tip}>${originPlayer}</td>
      <td style="color:#f0c040;">${distTravel}</td>
      <td class="left">${arrival}</td>
      <td>${timing}</td>
    </tr>`);
    }

    // extras ride under the LAST row of their target's group
    const nx = rows[i + 1];
    if ((!nx || nx.tIdx !== r.tIdx) && M.extrasBy[r.tCoord]) {
      for (const ex of M.extrasBy[r.tCoord]) cells.push(moExtraRow(ex.cmd, ex.reason, r.tCoord));
    }
  });

  // attacks on coords the plan doesn't target at all
  for (const up of M.unplanned) {
    const imp = ownerBy[up.coord];
    up.cmds.forEach((cmd, k) => {
      const tip = moTipAttrs(cmd);
      cells.push(`
    <tr${k === 0 ? ' style="border-top:2px solid #7a5c10"' : ''}>
      <td style="color:#806030;">${k === 0 ? '—' : ''}</td>
      <td class="left" style="font-family:monospace;">${k === 0 ? moCoordLink(up.coord) : ''}</td>
      <td class="left">${k === 0 && imp && imp.owner ? `<span class="player-tag">${esc(imp.owner)}</span>` : ''}</td>
      <td${tip}><span class="badge" style="background:#4a3010;color:#e0a020;">${cmd.snob ? '👑 ' : ''}${esc(t('mo_st_unplanned'))}</span></td>
      <td class="left"${tip}>—</td><td class="left"${tip}>—</td><td${tip}>—</td>
      <td${tip}>${moStatusLink(`<span style="color:#e0a020;font-weight:600;">${esc(t('mo_st_extra'))}</span>`, cmd)}</td>
      <td style="white-space:nowrap;"${tip}>${moPowerCell(cmd)}</td>
      <td class="left"${tip}>${moOriginCell(cmd)}</td>
      <td class="left"${tip}>${cmd.originPlayer ? `<span class="player-tag">${esc(cmd.originPlayer)}</span>` : '—'}</td>
      <td style="color:#f0c040;">${moDistTravel(cmd.originCoord, up.coord, cmd.snob ? 'snob' : 'off')}</td>
      <td class="left">${moArrivalCell(cmd)}</td>
      <td>—</td>
    </tr>`);
    });
  }

  tbody.innerHTML = cells.join('') || `<tr class="empty-row"><td colspan="14">${t('mo_need_import')}</td></tr>`;
}

// One EXTRA attack row (an unclaimed attack on a planned target), amber-tinted like
// the plan table tints unassigned rows red.
function moExtraRow(cmd, reason, tCoord) {
  const tip = moTipAttrs(cmd);
  return `
    <tr style="background:rgba(224,160,32,0.06);">
      <td></td><td></td><td></td>
      <td${tip}><span class="badge" style="background:#4a3010;color:#e0a020;">${cmd.snob ? '👑 ' : ''}${esc(t('mo_st_extra'))}${cmd.size ? ' ' + esc(t('mo_size_' + cmd.size)) : ''}</span></td>
      <td class="left" colspan="2"${tip}><span style="color:#e0a020;font-size:12px;">${esc(t('mo_ex_' + reason.replace('extra_', '')))}</span></td>
      <td${tip}>—</td>
      <td${tip}>${moStatusLink(`<span style="color:#e0a020;font-weight:600;">${esc(t('mo_st_extra'))}</span>`, cmd)}</td>
      <td style="white-space:nowrap;"${tip}>${moPowerCell(cmd)}</td>
      <td class="left"${tip}>${moOriginCell(cmd)}</td>
      <td class="left"${tip}>${cmd.originPlayer ? `<span class="player-tag">${esc(cmd.originPlayer)}</span>` : '—'}</td>
      <td style="color:#f0c040;">${moDistTravel(cmd.originCoord, tCoord, cmd.snob ? 'snob' : 'off')}</td>
      <td class="left">${moArrivalCell(cmd)}</td>
      <td>—</td>
    </tr>`;
}

// ── Import UI ─────────────────────────────────────────────────────────────────
// Quickbar loader for the exporter userscript — the "Copy Script" button puts it
// on the clipboard, ready to paste into a game quickbar entry (or the URL bar).
const MO_SCRIPT_SNIPPET = "javascript:$.getScript('https://rapidsiege.github.io/tw-scripts/incomingOrders.js?dl=0');";
function moCopyScript() {
  const done = () => alert(t('mo_script_copied'));
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(MO_SCRIPT_SNIPPET).then(done).catch(() => moFallbackCopy(MO_SCRIPT_SNIPPET, done));
  else moFallbackCopy(MO_SCRIPT_SNIPPET, done);
}
function moFallbackCopy(txt, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    done();
  } catch (e) { alert(txt); }
}
function toggleMoImport() {
  const el = document.getElementById('mo-import-wrap');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
function moImportText(text) {
  const parsed = moParseImport(text);
  if (!parsed || (!parsed.targets.length && !parsed.commands.length)) { alert(t('mo_import_fail')); return; }
  moTargets = parsed.targets;
  moCommands = parsed.commands;
  moImportedAt = parsed.exportedAt || Math.floor(Date.now() / 1000);
  saveManage();
  renderManageTable();
  if (typeof cloudSyncManageOff === 'function') cloudSyncManageOff(text); // hosted-site cloud save
  const el = document.getElementById('mo-import-wrap');
  if (el) el.style.display = 'none';
}
function moLoadPaste() {
  const el = document.getElementById('mo-import-text');
  moImportText(el ? el.value : '');
}
function moLoadFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => moImportText(e.target.result);
  reader.readAsText(file);
  input.value = '';
}
function clearManage() {
  if (moCommands.length && !confirm(t('mo_confirm_clear'))) return;
  moTargets = []; moCommands = []; moImportedAt = 0;
  saveManage();
  renderManageTable();
}
