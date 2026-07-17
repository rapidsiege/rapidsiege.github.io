// attack-planner — mass target import (BB parsers — see the FORMAT CONTRACT in tribe-calculator js/plan.js).
// Classic script (5/8): no modules, shared global scope, load order matters — must work
// by double-click (file://). See the <script src> order in attack-planner.html.
'use strict';

// ══════════════════════════════════════════════
// MASS TARGET IMPORT
// ══════════════════════════════════════════════

function parseOffPlanBB(text) {
  const targets = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    // Village line: "N. X|Y - Player." (optional spaces/trailing dot)
    const vm = line.match(/^\d+\.\s+(\d+)\|(\d+)\s*-\s*(.+?)\.?\s*$/);
    if (vm) {
      if (current) targets.push(current);
      current = { x: parseInt(vm[1]), y: parseInt(vm[2]), player: vm[3].trim().replace(/\[\/?[^\]]+\]/g, '').trim(), requirements: [] };
      continue;
    }
    if (!current) continue;
    // Attack line: [unit]TYPE[/unit] [player]NAME[/player] [b]HH:MM/HH:MM[/b]
    // The trailing time may be a window (HH:MM/HH:MM) or a single exact time (HH:MM).
    const am = line.match(/\[unit\](\w+)\[\/unit\].*?\[player\](.+?)\[\/player\].*?(\d{1,2}:\d{2})(?:\s*[\/\-–]\s*(\d{1,2}:\d{2}))?/);
    // Catapult demolition rows (tribe-calculator) aren't clearing-off / noble requirements —
    // they belong to a separate workflow, so the attack planner skips them on import.
    if (am && am[1].toLowerCase() !== 'catapult') {
      // FAKE rows lead with the spy icon ([unit]spy[/unit][unit]ram[/unit] in the forum export);
      // record them as a 'fake' requirement so importOffTargets can mark an all-fake target.
      const unitType = am[1].toLowerCase() === 'spy' ? 'fake' : am[1];
      current.requirements.push({ unitType, attacker: am[2].trim(), timeFrom: am[3], timeTo: am[4] || '' });
    }
  }
  if (current) targets.push(current);
  return targets;
}

// ── Per-player plan BB (tribe-calculator "Per-Player Orders" / combined "Per-Player All") ──
//
// ⚠ FORMAT CONTRACT with tribe-calculator js/plan.js: this parser consumes the BB emitted by
// playerPlanBBBlock / snobOrderLineBB / unassignedPlanBBBlock (and bbDateLabel for the date
// header). Whenever that export changes shape, update this parser + .omc/test_attack_import.js
// in the same change — there is a matching contract note above those functions in plan.js.
// To stay robust across cosmetic tweaks, anchor only on STRUCTURE (unit tags, "→ [coord]",
// [coord] targets, line order) — never on presentation such as [color=…] hexes or [b] nesting.
//
// Lines are grouped under a "========== SENDER (n) ==========" header naming the player who
// must SEND them. Each attack line becomes a REQUIREMENT on its target, attributed to the
// header sender. The user then sets "My Player" to their own name and runs Auto-Generate,
// which assigns their villages. The in-line "([player]…[/player])" is the TARGET owner
// (defender); a bare "src" coord before the arrow pins the exact origin village.
//
// Line shapes handled (EN and ES):
//   header  ========== Vanquished (4) ==========
//   date    [b][u]ARRIVAL DATE:[/u][/b] Thursday 18            → arrivalDay (day-of-month)
//   off     [unit]ram[/unit] 547|552 → [coord]583|524[/coord] ([player]Def[/player]) [b]…01:00…
//   fake    [unit]spy[/unit][unit]ram[/unit] [b](FAKE)[/b] 547|552 → [coord]583|524[/coord] …  (parses like an
//           off but classified 'fake' — the spy icon is its only reliable structural marker)
//   launch  …LAUNCH TIME:… — [url=…]ATTACK URL▶[/url][/b]      (continuation line: rally URL
//           carrying the village=/target= IDs; old single-line exports put it on the off line)
//   snob    4x [unit]snob[/unit] ⚠ Prepare Snob Train for [coord]572|521[/coord] ⚠ ([player]Def[/player]) [b]…02:00-03:00…
//
// Ignored on purpose: the "Objective N." context dump (its off rows have no "→ [coord]" and its
// snob rows carry no [coord] at all), "Villages in snob range" lines (bare coords), the
// UNASSIGNED block (bare "label → coord", no [coord] tag), Per-Player Table [table] rows (no
// "→", no [unit]snob[/unit]), and [unit]catapult[/unit] rows — catapult demolition belongs to a
// separate workflow and must not import as a phantom off requirement.

// Arrival window = the FIRST "HH:MM" or "HH:MM-HH:MM" after the target's [/coord] on the
// attack/snob line itself, with every BB tag stripped first — so color hexes, [b] nesting, or
// any future presentation tag can neither gate nor pollute the match. Launch/continuation
// lines are never scanned for times, so the red launch span can't be mistaken for the arrival.
function windowAfterCoord(line) {
  const i = line.indexOf('[/coord]');
  if (i < 0) return { timeFrom: '', timeTo: '' };
  const tail = line.slice(i + 8).replace(/\[[^\]]*\]/g, ' ');
  const m = tail.match(/(\d{1,2}:\d{2})(?:\s*[\/\-–]\s*(\d{1,2}:\d{2}))?/);
  return { timeFrom: m ? m[1] : '', timeTo: m && m[2] ? m[2] : '' };
}

function parsePlayerPlanBB(text) {
  const targets = [];        // [{ x, y, villageId, player, requirements }] — plus a non-JSON
                             // .arrivalDay property (day-of-month from the ARRIVAL DATE header)
  const byKey   = {};        // coord/id key → target (merge lines that hit the same target)
  let sender = '';           // current "========== SENDER (n) ==========" block owner
  let arrivalDay = null;

  const attackRe = /→\s*\[coord\](\d{1,3}\|\d{1,3})\[\/coord\]/;   // off / cat attack line
  const coordRe  = /\[coord\](\d{1,3}\|\d{1,3})\[\/coord\]/;       // any tagged coord (snob line)

  // Pass 1 — classify lines into attack records. Newer exports span TWO lines per off: the
  // "village → target + window" line followed by a "LAUNCH TIME" line carrying the rally URL.
  // Coalesce the URL line into its record so the village-ID pins still bind; the arrival
  // window is captured from the attack line itself, up front, so nothing on a continuation
  // line can ever corrupt it. Old single-line exports parse identically.
  const records = [];        // [{ sender, kind: 'attack'|'snob', text, timeFrom, timeTo }]
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const hm = line.match(/^=+\s*(.+?)\s*\(\d+\)\s*=+$/);
    if (hm) { sender = hm[1].trim(); cur = null; continue; }
    if (/^=+.*=+$/.test(line)) { sender = ''; cur = null; continue; } // other dividers (UNASSIGNED)
    const dm = line.match(/(?:ARRIVAL DATE|FECHA DE LLEGADA)[^0-9]*(\d{1,2})\s*$/i);
    if (dm) { arrivalDay = parseInt(dm[1], 10); continue; }
    if (attackRe.test(line)) {
      cur = { sender, kind: 'attack', text: line, ...windowAfterCoord(line) };
      records.push(cur);                                             // start of a new attack
    } else if (/\[unit\]snob\[\/unit\]/i.test(line) && coordRe.test(line)
               && !/SNOBS NEED RECRUITING|NECESITAS RECLUTAR NOBLES/i.test(line)) {
      // Snob-train order line ("Prepare Snob Train for [coord]…"). No origin, no URL — the
      // requirement stays unpinned and Auto-Generate picks a noble village. The objective-
      // context dump's snob rows carry NO [coord] (their target is the group header line),
      // so they can never match here and double-import. Legacy v2.4–v3.11 exports flagged
      // display-only recruiting notes with [SNOBS NEED RECRUITING] / [NECESITAS RECLUTAR
      // NOBLES] (sometimes with a [coord]); those are never orders, so old pastes skip them.
      records.push({ sender, kind: 'snob', text: line, ...windowAfterCoord(line) });
      cur = null;
    } else if (cur && line.includes('[url=')) {
      cur.text += ' ' + line;                                        // continuation: the LAUNCH TIME line carrying the rally URL
      cur = null;                                                    // an attack has exactly one launch line — close it so a later
                                                                     // URL-bearing line (e.g. a "needs recruiting" note) can't attach here
    }
    // Any other line (objective context, snob-range list, display-only notes) is ignored —
    // never folded into the previous attack, so it can't corrupt its unit/time.
  }

  // Pass 2 — records → targets + requirements
  for (const rec of records) {
    const line = rec.text, sender = rec.sender;

    // Catapult demolition rows (tribe-calculator) carry "→ [coord]" + a rally URL like an off,
    // but they're not clearing-off / noble requirements — skip them so they don't import as
    // phantom axe offs (the unit-classify below has no catapult tier and would fall to 'axe').
    if (/\[unit\]catapult\[\/unit\]/i.test(line)) continue;

    let tx, ty, srcCoord = '', unitType;
    if (rec.kind === 'snob') {
      const tm = line.match(coordRe);
      [tx, ty] = tm[1].split('|').map(Number);
      unitType = 'snob';
    } else {
      const tm = line.match(attackRe);                               // target coord
      [tx, ty] = tm[1].split('|').map(Number);
      const sm = line.match(/(\d{1,3}\|\d{1,3})\s*→\s*\[coord\]/);   // pinned source coord — must
      srcCoord = sm ? sm[1] : '';                                    // precede "[coord]" so a
                                                                     // "(→ Building)" label can't match
      // Unit: FAKE first — tribe-calculator's fake rows ride a lone ram behind a spy icon
      // ([unit]spy[/unit][unit]ram[/unit]), so the spy tag (which no other row type uses) must
      // be tested BEFORE ram or a fake would mis-type as a real ram off. Then snob (incl.
      // old-format escorted "[unit]axe[/unit][unit]snob[/unit]" attack lines), else ram, else
      // axe. Ram vs axe stay distinct — different power tiers.
      unitType = /\[unit\]spy\[\/unit\]/i.test(line)  ? 'fake'
               : /\[unit\]snob\[\/unit\]/i.test(line) ? 'snob'
               : /\[unit\]ram\[\/unit\]/i.test(line)  ? 'ram'
               : 'axe';
    }

    const cm    = line.match(/^(\d+)\s*x\s+/i);            // "4x " train size
    const count = cm ? parseInt(cm[1], 10) : 1;

    const pm = line.match(/\(\[player\](.+?)\[\/player\]\)/);          // target owner (defender)
    const defender = pm ? pm[1].trim() : '';

    const timeFrom = rec.timeFrom;                         // captured from the attack line in pass 1
    const timeTo   = rec.timeTo;

    let srcVid = '', tgtVid = '';                                    // village IDs from rally URL
    const um = line.match(/\[url=([^\]]+)\]/);
    if (um) {
      const vM = um[1].match(/[?&]village=(\d+)/);
      const tM = um[1].match(/[?&]target=(\d+)/);
      srcVid = vM ? vM[1] : '';
      tgtVid = tM ? tM[1] : '';
    }

    // Merge by rally-URL village ID when present, and ALWAYS by coords too — a URL-less snob
    // order and a URL-carrying off on the SAME target must land on one entry (two entries
    // would upsert the same coords twice in importPlayerPlan, the second wiping the first's
    // requirements).
    let tg = (tgtVid && byKey['id:' + tgtVid]) || byKey[`${tx}|${ty}`];
    if (!tg) {
      tg = { x: tx, y: ty, villageId: tgtVid, player: defender, requirements: [] };
      targets.push(tg);
    } else {
      if (tgtVid && !tg.villageId) tg.villageId = tgtVid;
      if (defender && !tg.player)  tg.player = defender;
    }
    byKey[`${tx}|${ty}`] = tg;
    if (tgtVid) byKey['id:' + tgtVid] = tg;
    // srcCoord + srcVillageId pin the exact origin so Auto-Generate sends from this village.
    tg.requirements.push({ unitType, attacker: sender, timeFrom, timeTo, count, srcCoord, srcVillageId: srcVid });
  }

  targets.arrivalDay = arrivalDay;   // array property — invisible to JSON/length, callers opt in
  return targets;
}

// The export's ARRIVAL DATE header only carries a weekday + day-of-month ("Thursday 18") —
// resolve the day to the NEXT calendar date with that day-of-month (today counts), which is
// always right for an op pasted up to ~4 weeks ahead. `now` is injectable for the test harness.
function arrivalDayToISO(day, now = new Date()) {
  if (!day || day < 1 || day > 31) return '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let m = 0; m < 3; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, day);
    if (d.getDate() !== day || d < today) continue;   // month overflow (Feb 31st) or already past
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  return '';
}

// A target's type from its imported requirements: 'fake' only when it has requirements and
// every one is a fake (tribe-calculator's per-player/forum exports never mix a real off/snob
// with a fake on one target); otherwise 'off'. An empty list stays 'off' (the legacy default).
function targetTypeFor(requirements) {
  const reqs = requirements || [];
  return reqs.length && reqs.every(r => r.unitType === 'fake') ? 'fake' : 'off';
}

function importPlayerPlan(text) {
  const parsed = parsePlayerPlanBB(text);
  if (!parsed.length) { alert(t('alert_no_targets_found')); return; }

  // Resolve the plan's ARRIVAL DATE (day-of-month) to a real date and remember it —
  // openAutoGenerate pre-fills its landing date from this instead of defaulting to today.
  const planDateISO = arrivalDayToISO(parsed.arrivalDay);
  if (planDateISO) DATA.settings.planDateISO = planDateISO;

  // A paste of just YOUR OWN block usually lacks the "========== NAME ==========" header, so
  // its requirements come back with a blank attacker — and the My-Player filter in
  // Auto-Generate would then silently drop every one of them. Attribute blanks to My Player.
  const me = (DATA.settings.playerName || '').trim();
  if (me) parsed.forEach(p => p.requirements.forEach(r => { if (!r.attacker) r.attacker = me; }));

  let added = 0, updated = 0, fakes = 0;
  parsed.forEach(p => {
    // A target whose every requirement is a fake is a FAKE target (tribe-calculator never mixes
    // real offs and fakes on one target); anything with a real off/snob stays an off target.
    const tt = targetTypeFor(p.requirements);
    if (tt === 'fake') fakes++;   // counted for the summary regardless of added-vs-updated
    const existing = (p.villageId && DATA.targets.find(t => String(t.villageId) === String(p.villageId)))
                  || DATA.targets.find(t => t.x === p.x && t.y === p.y);
    if (existing) {
      if (p.villageId && !existing.villageId) existing.villageId = p.villageId;
      if (p.player) existing.player = p.player;
      existing.targetType   = tt;
      existing.requirements = p.requirements;
      updated++;
    } else {
      DATA.targets.push({
        id: uid(), name: `${p.x}|${p.y}`, villageId: p.villageId || '',
        x: p.x, y: p.y, player: p.player || '',
        targetType: tt, requirements: p.requirements
      });
      added++;
    }
  });

  const senders = new Set();
  parsed.forEach(p => p.requirements.forEach(r => { if (r.attacker) senders.add(r.attacker); }));
  const names = [...senders];
  const senderList = names.slice(0, 6).join(', ') + (names.length > 6 ? ` (+${names.length - 6})` : '');

  enrichTargetsSilent();
  saveData();
  if (typeof cloudSyncPlan === 'function') cloudSyncPlan(); // hosted-site: cloud-save on targets loaded
  renderTargets();
  refreshDropdowns();
  document.getElementById('import-off-text').value = '';
  closePanel('import-off-panel');
  alert(t('alert_plan_imported')
    .replace('{added}', added)
    .replace('{updated}', updated)
    .replace('{fakes}', fakes)
    .replace('{players}', senders.size)
    .replace('{senders}', senderList)
    + (planDateISO ? '\n' + t('alert_plan_date').replace('{date}', planDateISO) : ''));
}

// Structural routing between the two BB importers: per-player exports have
// "========== NAME (n) ==========" sender headers and/or "src → [coord]tgt[/coord]" attack
// lines; the forum export has neither (its only arrows are inside "(→ Building)" catapult-mode
// labels, with no [coord] after them). A bare "includes('→')" check would misroute those.
function looksLikePlayerPlan(text) {
  return /^=+\s*.+\(\d+\)\s*=+\s*$/m.test(text)
      || /→\s*\[coord\]\d{1,3}\|\d{1,3}\[\/coord\]/.test(text);
}

function importOffTargets() {
  const text = document.getElementById('import-off-text').value.trim();
  if (!text) return;
  if (looksLikePlayerPlan(text)) { importPlayerPlan(text); return; }
  const parsed = parseOffPlanBB(text);
  if (!parsed.length) { alert(t('alert_no_targets_found')); return; }
  let added = 0, updated = 0;
  parsed.forEach(p => {
    const tt = targetTypeFor(p.requirements);
    const existing = DATA.targets.find(t => t.x === p.x && t.y === p.y);
    if (existing) {
      if (p.player) existing.player = p.player;
      existing.targetType   = tt;
      existing.requirements = p.requirements;
      updated++;
    } else {
      DATA.targets.push({
        id: uid(), name: `${p.x}|${p.y}`, villageId: '',
        x: p.x, y: p.y, player: p.player,
        targetType: tt, requirements: p.requirements
      });
      added++;
    }
  });
  enrichTargetsSilent();
  saveData();
  if (typeof cloudSyncPlan === 'function') cloudSyncPlan(); // hosted-site: cloud-save on targets loaded
  renderTargets();
  refreshDropdowns();
  document.getElementById('import-off-text').value = '';
  closePanel('import-off-panel');
  alert(t('alert_off_imported').replace('{added}', added).replace('{updated}', updated));
}

function importFakeTargets() {
  const text = document.getElementById('import-fake-text').value.trim();
  if (!text) return;
  let added = 0, skipped = 0;
  for (const m of text.matchAll(/(\d+)\|(\d+)/g)) {
    const x = parseInt(m[1]), y = parseInt(m[2]);
    if (DATA.targets.find(t => t.x === x && t.y === y)) { skipped++; continue; }
    DATA.targets.push({
      id: uid(), name: `${x}|${y}`, villageId: '',
      x, y, player: '', targetType: 'fake', requirements: []
    });
    added++;
  }
  enrichTargetsSilent();
  saveData();
  if (typeof cloudSyncPlan === 'function') cloudSyncPlan(); // hosted-site: cloud-save on targets loaded
  renderTargets();
  refreshDropdowns();
  document.getElementById('import-fake-text').value = '';
  closePanel('import-fake-panel');
  alert(t('alert_fake_imported').replace('{added}', added).replace('{skipped}', skipped));
}

function enrichTargetsSilent() {
  if (!villageDb.length) return;
  DATA.targets.forEach(t => {
    if (t.villageId) return;
    const match = villageDb.find(v => v.x === t.x && v.y === t.y);
    if (match) {
      t.villageId = match.id;
      if (!t.name || t.name === `${t.x}|${t.y}`) t.name = match.name;
      if (!t.player) t.player = playerMap[match.playerId] || '';
    }
  });
}

