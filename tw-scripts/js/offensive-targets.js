// ══════════════════════════════════════════════════════════════
// OFFENSIVE TARGETS + PLAN OFFENSIVE
// ══════════════════════════════════════════════════════════════
const OT_STORE_KEY = 'tw_tribe_offensive';
const TIER_RANK = { complete: 3, tq: 2, half: 1, none: 0 };
// Offs travel at ram pace, noble trains at snob pace (slowest unit dictates)
const PLAN_BASE_MIN = { off: 30, snob: 35 };
const TIER_FIELD = { complete: 'nComplete', tq: 'nTq', half: 'nHalf' };

let otCfg        = { dateLabel: '', defWinOff: '01:00/02:00', defWinSnob: '02:00/02:30', serverUrl: 'es100.guerrastribales.es', serverUtcOffset: 2, defComplete: 1, defTq: 0, defHalf: 0, defSnobMode: 'solo' };
let offTargets   = []; // [{id, coord, player, nComplete, nTq, nHalf, snobPlayers, nobles, offWindows:[{win,count}], winSnob, snobMode, snobAssignees:[{name,count}]}]
let planRows     = []; // denormalized so a saved plan renders without the troop file loaded
let planWarnings = [];
let planReserved = []; // coords of noble-launch villages held out of the offs (excluded from Unused Offs)
let otNextId     = 1;

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function saveOffensive() {
  localStorage.setItem(OT_STORE_KEY, JSON.stringify({
    cfg: otCfg, targets: offTargets, plan: planRows, warnings: planWarnings, reserved: planReserved, nextId: otNextId,
  }));
}

function loadOffensive() {
  try {
    const d = JSON.parse(localStorage.getItem(OT_STORE_KEY));
    if (d) {
      otCfg        = { ...otCfg, ...(d.cfg || {}) };
      offTargets   = d.targets || [];
      planRows     = d.plan || [];
      planWarnings = d.warnings || [];
      planReserved = d.reserved || [];
      otNextId     = d.nextId || (Math.max(0, ...offTargets.map(x => x.id)) + 1);
    }
  } catch {}
  // normalize targets saved by older versions
  offTargets.forEach(normalizeOffTarget);
  document.getElementById('ot-date').value = otCfg.dateISO || '';
  setWinInputs('ot-def-winoff', otCfg.defWinOff);
  setWinInputs('ot-def-winsnob', otCfg.defWinSnob);
  for (const id of ['ot-def-winoff-fix', 'ot-def-winsnob-fix']) {
    const b = document.getElementById(id);
    if (b) b.title = t('fix_time_title');
  }
  const su = document.getElementById('setting-server-url');
  if (su) su.value = otCfg.serverUrl || '';
  const so = document.getElementById('setting-server-offset');
  if (so) so.value = otCfg.serverUtcOffset ?? 2;
  const dc = document.getElementById('ot-def-complete');
  if (dc) dc.value = otCfg.defComplete ?? 1;
  const dt = document.getElementById('ot-def-tq');
  if (dt) dt.value = otCfg.defTq ?? 0;
  const dh = document.getElementById('ot-def-half');
  if (dh) dh.value = otCfg.defHalf ?? 0;
  const dsm = document.getElementById('ot-def-snobmode');
  if (dsm) dsm.value = otCfg.defSnobMode || 'solo';
}

function updOTCfg(k, v) { otCfg[k] = v.trim(); saveOffensive(); }
function updServerUrl(v) { otCfg.serverUrl = v.trim(); saveOffensive(); }
function updServerOffset(v) { const n = parseFloat(v); otCfg.serverUtcOffset = isNaN(n) ? 2 : n; saveOffensive(); updateServerNow(); }
function updOTCfgInt(k, v) { otCfg[k] = parseInt(v, 10) || 0; saveOffensive(); }

// ── Time-window helpers (windows stored as 'HH:MM/HH:MM'; start === end = fixed time) ──
function winParts(s) {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*[\/\-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return ['', ''];
  const p = n => String(n).padStart(2, '0');
  return [`${p(+m[1])}:${m[2]}`, `${p(+m[3])}:${m[4]}`];
}
function winStrFrom(s, e) { return s ? `${s}/${e || s}` : ''; }
function fmtWindow(s) {
  const [a, b] = winParts(s);
  return a ? (a === b ? a : `${a}/${b}`) : (s || '');
}
function setWinInputs(prefix, winStr) {
  const [s, e] = winParts(winStr);
  const si = document.getElementById(prefix + '-s'), ei = document.getElementById(prefix + '-e');
  if (si) si.value = s;
  if (ei) ei.value = e;
}
function readWinInputs(prefix) {
  const si = document.getElementById(prefix + '-s'), ei = document.getElementById(prefix + '-e');
  return winStrFrom(si ? si.value : '', ei ? ei.value : '');
}
function updDefWin(key) {
  otCfg[key] = readWinInputs(key === 'defWinOff' ? 'ot-def-winoff' : 'ot-def-winsnob');
  saveOffensive();
}
function fixDefWin(key) {
  const prefix = key === 'defWinOff' ? 'ot-def-winoff' : 'ot-def-winsnob';
  const si = document.getElementById(prefix + '-s'), ei = document.getElementById(prefix + '-e');
  if (si && ei) { ei.value = si.value; updDefWin(key); }
}

// Normalize a target saved by (or pasted from) older versions:
// winOff string → offWindows list, assignee names → {name, count} objects
function normalizeOffTarget(tg) {
  if (typeof tg.power !== 'boolean') tg.power = false;
  if (!tg.snobMode) tg.snobMode = 'solo';
  if (!Array.isArray(tg.snobAssignees)) tg.snobAssignees = [];
  tg.snobAssignees = tg.snobAssignees.filter(Boolean).map(a => typeof a === 'string'
    ? { name: a, count: 0 }
    : { name: a.name, count: Math.max(0, parseInt(a.count) || 0) });
  if (!Array.isArray(tg.offAssignees)) tg.offAssignees = [];
  tg.offAssignees = tg.offAssignees
    .filter(a => a && a.name && ['complete', 'tq', 'half'].includes(a.tier))
    .map(a => ({ tier: a.tier, name: a.name, count: Math.max(0, parseInt(a.count) || 0) }));
  if (!Array.isArray(tg.offWindows) || !tg.offWindows.length) {
    tg.offWindows = [{ win: tg.winOff !== undefined ? tg.winOff : (otCfg.defWinOff || ''), count: 0 }];
  }
  tg.offWindows = tg.offWindows.map(w => typeof w === 'string'
    ? { win: w, count: 0 }
    : { win: w.win || '', count: Math.max(0, parseInt(w.count) || 0) });
  delete tg.winOff;
  return tg;
}

function newOffTarget(coord, player) {
  return {
    id: otNextId++, coord, player, power: false,
    nComplete: otCfg.defComplete ?? 1, nTq: otCfg.defTq ?? 0, nHalf: otCfg.defHalf ?? 0, snobPlayers: 0, nobles: 4,
    snobMode: otCfg.defSnobMode || 'solo', snobAssignees: [], offAssignees: [],
    offWindows: [{ win: otCfg.defWinOff, count: 0 }], winSnob: otCfg.defWinSnob,
  };
}

function addOffTarget() {
  const coordEl = document.getElementById('ot-add-coord');
  const c = parseCoordStr(coordEl.value);
  if (!c) { coordEl.focus(); return; }
  const coord = `${c.x}|${c.y}`;
  offTargets.push(newOffTarget(coord, dbOwnerName(coord)));
  coordEl.value = ''; coordEl.focus();
  saveOffensive(); renderOffTargets();
}

function toggleBulkAdd() {
  const el = document.getElementById('ot-bulk-wrap');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function bulkAddTargets() {
  const input = document.getElementById('ot-bulk-input');
  let added = 0;
  for (const line of input.value.split('\n')) {
    const m = line.match(/(\d{1,3})\s*\|\s*(\d{1,3})\s*(.*)/);
    if (!m) continue;
    const pastedName = m[3].replace(/\[\/?player\]/g, '').replace(/^[-–—.\s]+|[-–—.\s]+$/g, '').trim();
    const coord = `${m[1]}|${m[2]}`;
    offTargets.push(newOffTarget(coord, dbOwnerName(coord) || pastedName));
    added++;
  }
  if (added) { input.value = ''; saveOffensive(); renderOffTargets(); }
}

function updOT(id, field, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  if (['nComplete','nTq','nHalf','snobPlayers','nobles'].includes(field)) tg[field] = Math.max(0, parseInt(val) || 0);
  else tg[field] = val.trim();
  if (field === 'coord') {
    // defender is DB-derived; refresh it (clear if the DB doesn't know the new coord)
    tg.player = dbOwnerName(tg.coord) || (villageDb.length ? '' : tg.player);
    renderOffTargets();
  }
  saveOffensive();
}

function delOffTarget(id) {
  offTargets = offTargets.filter(x => x.id !== id);
  saveOffensive(); renderOffTargets();
}

// POWER tag (per target): send the strongest offs here, balanced across all POWER targets
function setOTPower(id, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.power = !!val;
  saveOffensive(); renderOffTargets();
}

function clearOffTargets() {
  if (offTargets.length && !confirm(t('confirm_clear_targets'))) return;
  offTargets = [];
  saveOffensive(); renderOffTargets();
}

// All players from the loaded tribe troop file as potential train senders. Players with
// no nobles yet are still listed (shown as "(0)") so they can be pinned — generatePlan
// then flags them to recruit a noble in time, which is exactly the intended signal.
function snobSenderOptions() {
  return Object.entries(players)
    .map(([name, p]) => ({ name, snob: p.totals.snob }))
    .sort((a, b) => (b.snob - a.snob) || decode(a.name).toLowerCase().localeCompare(decode(b.name).toLowerCase()));
}

function addSnobAssignee(id, name) {
  if (!name) return;
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.snobAssignees.push({ name, count: 0 });
  if (tg.snobAssignees.length > (tg.snobPlayers || 0)) tg.snobPlayers = tg.snobAssignees.length;
  saveOffensive(); renderOffTargets();
}

function removeSnobAssignee(id, idx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.snobAssignees.splice(idx, 1);
  // mirror the +1-per-sender bump: removing a sender drops the train count by one
  // (floored at the remaining assignee count, and at 0), so the count tracks senders
  tg.snobPlayers = Math.max(tg.snobAssignees.length, (tg.snobPlayers || 0) - 1);
  saveOffensive(); renderOffTargets();
}

function updSnobCount(id, idx, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.snobAssignees[idx]) return;
  tg.snobAssignees[idx].count = Math.max(0, parseInt(val) || 0);
  saveOffensive(); renderOffTargets();
}

// ── Off senders (per tier): manually pin who sends each target's offs ──
// How many off villages of each tier a player owns (drives the picker counts)
function playerOffTierCounts(name) {
  const out = { complete: 0, tq: 0, half: 0 };
  const p = players[name];
  if (!p) return out;
  for (const v of p.villages) { const tr = getOffTier(v.offPow); if (tr in out) out[tr]++; }
  return out;
}
// Loaded troop-file players that own ≥1 off of `tier`, richest first (label shows the count)
function offSenderOptions(tier) {
  return Object.keys(players)
    .map(name => ({ name, count: playerOffTierCounts(name)[tier] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
}
// Resolve a target tier's named off senders to [{name, count}] (explicit counts honored;
// count-0 senders auto-share the tier's remaining slots evenly, like snob trains).
function targetOffAssign(tg, tier) {
  const N = tg[TIER_FIELD[tier]] || 0;
  const assignees = (tg.offAssignees || []).filter(a => a && a.name && a.tier === tier);
  if (!N || !assignees.length) return [];
  const explicitSum = assignees.reduce((s, a) => s + (a.count > 0 ? a.count : 0), 0);
  const auto = assignees.filter(a => !(a.count > 0));
  const shares = auto.length ? splitNobles(Math.max(0, N - explicitSum), auto.length) : [];
  let ai = 0;
  return assignees
    .map(a => ({ name: a.name, count: a.count > 0 ? a.count : (shares[ai++] || 0) }))
    .filter(x => x.count > 0);
}
function addOffAssignee(id, tier, name) {
  if (!name) return;
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  if (!Array.isArray(tg.offAssignees)) tg.offAssignees = [];
  tg.offAssignees.push({ tier, name, count: 0 });
  // assigning a sender implies at least one off of that tier is wanted
  const cnt = tg.offAssignees.filter(a => a.tier === tier).length;
  if ((tg[TIER_FIELD[tier]] || 0) < cnt) tg[TIER_FIELD[tier]] = cnt;
  saveOffensive(); renderOffTargets();
}
function removeOffAssignee(id, idx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.offAssignees[idx]) return;
  tg.offAssignees.splice(idx, 1);
  saveOffensive(); renderOffTargets();
}
function updOffCount(id, idx, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.offAssignees[idx]) return;
  tg.offAssignees[idx].count = Math.max(0, parseInt(val) || 0);
  saveOffensive(); renderOffTargets();
}

// Per-target window editing (inputs are looked up by id prefix; no re-render
// on time changes so the picker keeps focus)
function updTgWin(id, kind, widx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  if (kind === 'snob') tg.winSnob = readWinInputs(`otsw-${id}`);
  else if (tg.offWindows[widx]) tg.offWindows[widx].win = readWinInputs(`otw-${id}-${widx}`);
  saveOffensive();
}
function fixTgWin(id, kind, widx) {
  const prefix = kind === 'snob' ? `otsw-${id}` : `otw-${id}-${widx}`;
  const si = document.getElementById(prefix + '-s'), ei = document.getElementById(prefix + '-e');
  if (si && ei) { ei.value = si.value; updTgWin(id, kind, widx); }
}
function addOffWin(id) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  const last = tg.offWindows[tg.offWindows.length - 1];
  tg.offWindows.push({ win: last ? last.win : otCfg.defWinOff, count: 0 });
  saveOffensive(); renderOffTargets();
}
function delOffWin(id, widx) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg) return;
  tg.offWindows.splice(widx, 1);
  if (!tg.offWindows.length) tg.offWindows.push({ win: otCfg.defWinOff, count: 0 });
  saveOffensive(); renderOffTargets();
}
function updOffWinCount(id, widx, val) {
  const tg = offTargets.find(x => x.id === id);
  if (!tg || !tg.offWindows[widx]) return;
  tg.offWindows[widx].count = Math.max(0, parseInt(val) || 0);
  saveOffensive();
}

// Effective noble count per train: explicit sender counts are honored, the
// remaining nobles are split evenly across the trains without a fixed count
function targetTrainSpec(tg) {
  const assignees = (tg.snobAssignees || []).filter(a => a && a.name);
  const nTrains = Math.max(tg.snobPlayers || 0, assignees.length);
  if (!nTrains || !tg.nobles) return [];
  const explicitSum = assignees.reduce((s, a) => s + (a.count > 0 ? a.count : 0), 0);
  const nAuto = nTrains - assignees.filter(a => a.count > 0).length;
  const auto = nAuto > 0 ? splitNobles(Math.max(0, tg.nobles - explicitSum), nAuto) : [];
  let ai = 0;
  const spec = [];
  for (let ti = 0; ti < nTrains; ti++) {
    const a = assignees[ti] || null;
    const count = a && a.count > 0 ? a.count : (auto[ai++] || 0);
    spec.push({ name: a ? a.name : null, count });
  }
  return spec.filter(x => x.count > 0);
}

// player name → nobles assigned across all targets (named senders only)
function senderNobleTotals() {
  const agg = {};
  for (const tg of offTargets) {
    for (const s of targetTrainSpec(tg)) {
      if (s.name) agg[s.name] = (agg[s.name] || 0) + s.count;
    }
  }
  return agg;
}

// How many offs each window takes: explicit counts first, windows with
// count 0 share the remainder evenly (earlier windows absorb the rounding)
function windowOffCounts(wins, total) {
  const counts = wins.map(w => w.count > 0 ? w.count : 0);
  let left = total - counts.reduce((s, x) => s + x, 0);
  if (left > 0) {
    const zeros = wins.map((w, i) => w.count > 0 ? -1 : i).filter(i => i >= 0);
    if (zeros.length) {
      const base = Math.floor(left / zeros.length), rem = left % zeros.length;
      zeros.forEach((idx, j) => { counts[idx] += base + (j < rem ? 1 : 0); });
    } else {
      counts[counts.length - 1] += left; // explicit counts under-cover → rest lands last
    }
  }
  return counts;
}

// Localized "Miércoles 10"-style label derived from the arrival date picker
function bbDateLabel() {
  if (otCfg.dateISO) {
    const d = new Date(otCfg.dateISO + 'T00:00:00');
    if (!isNaN(d)) {
      const days = lang === 'es'
        ? ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
        : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return `${days[d.getDay()]} ${d.getDate()}`;
    }
  }
  return otCfg.dateLabel || ''; // legacy free-text fallback
}

function updateDatePreview() {
  const el = document.getElementById('ot-date-preview');
  if (el) el.textContent = bbDateLabel();
}

function renderOffTargets() {
  updateDatePreview();
  offTargets.forEach(normalizeOffTarget);
  const warnEl = document.getElementById('ot-warnings');
  const warns = (villageDb.length ? offTargets.filter(tg => !coordDb[tg.coord]) : [])
    .map(tg => t('warn_target_not_in_db')(tg.coord));
  // senders assigned more nobles (across all targets) than they actually own
  if (Object.keys(players).length) {
    const agg = senderNobleTotals();
    for (const [nm, used] of Object.entries(agg)) {
      const have = players[nm] ? players[nm].totals.snob : 0;
      if (used > have) warns.push(t('warn_sender_capacity')(decode(nm), used, have));
    }
  }
  // collapsible alert box (native <details>, collapsed by default) — same as Plan Offensive
  if (warnEl) warnEl.innerHTML = warns.length
    ? `<details class="warn-box"><summary>${t('plan_warnings_toggle')(warns.length)}</summary>`
      + `<div class="warn-list">${warns.map(esc).join('<br>')}</div></details>` : '';

  // Offs committed across all targets vs. the tribe's off villages, PER TIER
  // (Complete / 3-4 / 1-2): how many of each you've assigned out of how many exist.
  const offsSummaryEl = document.getElementById('ot-offs-summary');
  if (offsSummaryEl) {
    // Each split-off (escorted) train rides with one Complete off, so it counts as +1
    // Complete here — same per-train count the escort reservation uses (incl. needNobles pins).
    const escortOffs = offTargets.reduce((s, tg) =>
      s + (tg.snobMode === 'escorted' ? targetTrainSpec(tg).length : 0), 0);
    const tierMeta = [['complete', 'badge-complete', 'th_complete'], ['tq', 'badge-tq', 'th_tq'], ['half', 'badge-half', 'th_half']];
    const parts = tierMeta.map(([tier, cls, label]) => {
      const used = offTargets.reduce((s, tg) => s + (tg[TIER_FIELD[tier]] || 0), 0) + (tier === 'complete' ? escortOffs : 0);
      const total = villages.filter(v => getOffTier(v.offPow) === tier).length;
      return `<span class="badge ${cls}">${t(label)}</span> ${used} / ${total}`;
    });
    const note = escortOffs > 0 ? ` <span style="color:#806030;font-weight:400;">${t('offs_escort_note')(escortOffs)}</span>` : '';
    offsSummaryEl.innerHTML = (offTargets.length || villages.length)
      ? `${t('offs_assigned_label')} ${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}${note}` : '';
  }

  const tbody = document.getElementById('offtargets-tbody');
  if (!offTargets.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="15">${t('empty_no_targets')}</td></tr>`;
    return;
  }
  const senders = snobSenderOptions();
  tbody.innerHTML = offTargets.map((tg, i) => {
    const isUnknown = villageDb.length && !coordDb[tg.coord];
    const dbTitle = esc(dbOwnerLabel(tg.coord));
    const chips = tg.snobAssignees.map((a, j) =>
      `<span class="chip">${esc(decode(a.name))} ×<input type="number" min="0" value="${a.count || 0}" title="${esc(t('snob_count_title'))}" style="width:32px;background:transparent;border:none;border-bottom:1px solid #7a5c10;color:inherit;font-size:11px;text-align:center;" onchange="updSnobCount(${tg.id},${j},this.value)"><span class="chip-x" onclick="removeSnobAssignee(${tg.id},${j})">✕</span></span>`).join('');
    const senderPicker = senders.length
      ? `<select class="cell-input" style="width:118px;" onchange="addSnobAssignee(${tg.id}, this.value)">
           <option value="">${t('opt_pick_sender')}</option>
           ${senders.map(s => `<option value="${esc(s.name)}">${esc(decode(s.name))} (${s.snob})</option>`).join('')}
         </select>`
      : `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    // Off senders: one labeled picker per tier (Complete / 3-4 / 1-2); option labels show
    // how many offs of THAT tier the player owns. Chips = assignees of that tier (editable count).
    const TIER_BADGE_CLS = { complete: 'badge-complete', tq: 'badge-tq', half: 'badge-half' };
    const TIER_TH = { complete: 'th_complete', tq: 'th_tq', half: 'th_half' };
    const offSenderCell = Object.keys(players).length
      ? ['complete', 'tq', 'half'].map(tier => {
          const opts = offSenderOptions(tier);
          const tierChips = tg.offAssignees.map((a, j) => a.tier !== tier ? '' :
            `<span class="chip">${esc(decode(a.name))} ×<input type="number" min="0" value="${a.count || 0}" title="${esc(t('off_count_title'))}" style="width:30px;background:transparent;border:none;border-bottom:1px solid #7a5c10;color:inherit;font-size:11px;text-align:center;" onchange="updOffCount(${tg.id},${j},this.value)"><span class="chip-x" onclick="removeOffAssignee(${tg.id},${j})">✕</span></span>`).join('');
          const picker = opts.length
            ? `<select class="cell-input" style="width:104px;" onchange="addOffAssignee(${tg.id},'${tier}',this.value)">
                 <option value="">${t('opt_pick_sender')}</option>
                 ${opts.map(s => `<option value="${esc(s.name)}">${esc(decode(s.name))} (${s.count})</option>`).join('')}
               </select>`
            : `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
          return `<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:1px 0;">
                    <span class="badge ${TIER_BADGE_CLS[tier]}" style="font-size:9px;padding:0 4px;">${t(TIER_TH[tier])}</span>${picker}${tierChips}
                  </div>`;
        }).join('')
      : `<span class="num-zero" title="${esc(t('senders_need_troops'))}">—</span>`;
    const winEditor = (prefix, winStr, chgJs, fixJs) => {
      const [ws, we] = winParts(winStr);
      return `<input type="time" id="${prefix}-s" class="cell-input mono" style="width:78px;" value="${ws}" onchange="${chgJs}">` +
             `<button class="btn btn-ghost btn-sm" style="padding:1px 5px;" title="${esc(t('fix_time_title'))}" onclick="${fixJs}">=</button>` +
             `<input type="time" id="${prefix}-e" class="cell-input mono" style="width:78px;" value="${we}" onchange="${chgJs}">`;
    };
    const multiWin = tg.offWindows.length > 1;
    const offWinCell = tg.offWindows.map((w, k) =>
      `<div style="display:flex;gap:2px;align-items:center;justify-content:center;margin:1px 0;">
        ${winEditor(`otw-${tg.id}-${k}`, w.win, `updTgWin(${tg.id},'off',${k})`, `fixTgWin(${tg.id},'off',${k})`)}
        ${multiWin ? `<input type="number" min="0" value="${w.count || 0}" title="${esc(t('win_count_title'))}" class="cell-input num" style="width:38px;" onchange="updOffWinCount(${tg.id},${k},this.value)">` : ''}
        ${multiWin ? `<span class="chip-x" title="${esc(t('del_window_title'))}" onclick="delOffWin(${tg.id},${k})">✕</span>` : ''}
      </div>`).join('')
      + `<button class="btn btn-ghost btn-sm" style="padding:0 6px;margin-top:1px;" title="${esc(t('add_window_title'))}" onclick="addOffWin(${tg.id})">+</button>`;
    const snobWinCell = `<div style="display:flex;gap:2px;align-items:center;justify-content:center;">
        ${winEditor(`otsw-${tg.id}`, tg.winSnob, `updTgWin(${tg.id},'snob',0)`, `fixTgWin(${tg.id},'snob',0)`)}
      </div>`;
    return `
    <tr>
      <td style="color:#806030;">${i + 1}</td>
      <td class="left"><input class="cell-input mono" style="width:74px;${isUnknown ? 'border-color:#b02010;' : ''}" value="${esc(tg.coord)}" title="${dbTitle}" onchange="updOT(${tg.id},'coord',this.value)"></td>
      <td class="left" title="${dbTitle}">${tg.player ? `<span class="player-tag">${esc(tg.player)}</span>` : '<span class="num-zero">—</span>'}</td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nComplete}" onchange="updOT(${tg.id},'nComplete',this.value)"></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nTq}" onchange="updOT(${tg.id},'nTq',this.value)"></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nHalf}" onchange="updOT(${tg.id},'nHalf',this.value)"></td>
      <td title="${esc(t('ot_power_title'))}"><label class="ot-power"><input type="checkbox" ${tg.power ? 'checked' : ''} onchange="setOTPower(${tg.id},this.checked)">⚡</label></td>
      <td class="left"><div style="max-width:280px;">${offSenderCell}</div></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.snobPlayers}" onchange="updOT(${tg.id},'snobPlayers',this.value)"></td>
      <td><input type="number" min="0" class="cell-input num" value="${tg.nobles}" onchange="updOT(${tg.id},'nobles',this.value)"></td>
      <td class="left"><div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;max-width:250px;">${chips}${senderPicker}</div></td>
      <td>
        <select class="cell-input" onchange="updOT(${tg.id},'snobMode',this.value)">
          <option value="escorted"${tg.snobMode === 'escorted' ? ' selected' : ''}>${t('opt_escort_yes')}</option>
          <option value="solo"${tg.snobMode !== 'escorted' ? ' selected' : ''}>${t('opt_escort_no')}</option>
        </select>
      </td>
      <td>${offWinCell}</td>
      <td>${snobWinCell}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="delOffTarget(${tg.id})">✕</button></td>
    </tr>`;
  }).join('');
}

