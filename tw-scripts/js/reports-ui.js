// ══════════════════════════════════════════════════════════════
// ENEMY VILLAGES TAB (Troops Overview → Enemy Villages)
// ──────────────────────────────────────────────────────────────
// UI for the reports-intel store (js/reports-intel.js): load/paste
// reportsExport.js JSON exports, merge them into a persisted local store,
// and render one two-row group per enemy village — row 1 = troops seen IN
// the village, row 2 = troops AWAY (or "not seen" / "nothing outside").
// Local-only prototype: nothing leaves the browser; the store persists in
// localStorage (compressed) like the troop upload does.
// ══════════════════════════════════════════════════════════════

const REPORTS_KEY = 'tw_tribe_reports';
let riStore = riEmptyStore();
let riShared = null; // shared DB (everyone's merged uploads) — hosted site only
let riSort = { key: 'last', dir: 1 }; // 'last' | 'coord' | 'player' | 'type'

function riAutoload() {
  const d = lsLoadC(REPORTS_KEY);
  if (d && d.villages && d.ids) riStore = d;
  riInvalidateView();
  renderEnemyVillagesTable();
  riFetchShared();
}

// ── Shared DB (fetch + push) ──
// The table renders the UNION of the local store and the shared DB (per
// village, newest section wins via riCombineVillages). Local processing keeps
// working offline/file://; sharing lights up on the hosted site only.
function riFetchShared() {
  const el = document.getElementById('ev-shared');
  if (typeof TW_ENV === 'undefined' || TW_ENV !== 'production') {
    if (el) el.textContent = t('ev_shared_dev');
    return;
  }
  if (el) el.textContent = '☁ …';
  cloudFetchReportsDb().then(db => {
    if (db) {
      riShared = db;
      riInvalidateView();
      if (el) el.textContent = t('ev_shared')(
        Object.keys(db.villages).length, Object.keys(db.ids).length,
        db.updated ? riAge(Date.now(), Date.parse(db.updated)) : '?');
      renderEnemyVillagesTable();
    } else if (el) {
      el.textContent = t('ev_shared_err');
    }
  });
}

function riShareReports(reports) {
  if (!reports || !reports.length) return;
  if (typeof TW_ENV === 'undefined' || TW_ENV !== 'production') return;
  if (typeof cloudSyncReports !== 'function') return;
  cloudSyncReports(JSON.stringify(reports)).then(res => {
    if (res && res.ok && res.db && !res.db.error) {
      riStatus(t('ev_shared_pushed')(res.db.added, res.db.villages));
      riFetchShared();
    } else if (res) {
      // endpoint reachable but upload/merge failed — the local copy is intact
      riStatus(t('ev_share_failed'), true);
    }
    // res === null (no token / network / dev) → stay quiet; the local
    // processing message is already showing
  });
}

// Union view of local + shared facts, keyed by coord. Cached — the map render
// loop reads it per village per frame (riMapView), so it must be O(1) after the
// first build. riInvalidateView() runs at every mutation point (process/clear/
// shared-fetch) and also repaints the map so badges track the data.
let riViewCache = null;
function riViewVillages() {
  if (riViewCache) return riViewCache;
  const out = {};
  for (const c in riStore.villages) out[c] = riStore.villages[c];
  if (riShared && riShared.villages) {
    for (const c in riShared.villages) out[c] = riCombineVillages(out[c], riShared.villages[c]);
  }
  riViewCache = out;
  return out;
}
function riMapView() { return riViewVillages(); }
function riInvalidateView() {
  riViewCache = null;
  if (typeof repaintMapData === 'function') repaintMapData();
}

function riPersist() {
  if (!lsSaveC(REPORTS_KEY, riStore)) riStatus(t('ev_quota'), true);
}

function riStatus(msg, isErr) {
  const el = document.getElementById('ev-status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isErr ? '#c04020' : '#3a7a3a';
}

// ── Ingestion ──
function riProcessText(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { riStatus(t('ev_bad_json'), true); return; }
  if (!Array.isArray(data)) data = [data];
  const stats = riMergeReports(riStore, data);
  riPersist();
  riInvalidateView();
  riStatus(t('ev_added')(stats.added, stats.dupes, Object.keys(riStore.villages).length));
  renderEnemyVillagesTable();
  riShareReports(data);
}

function riProcessFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  Promise.all(list.map(f => f.text())).then(texts => {
    let added = 0, dupes = 0, bad = 0;
    const all = [];
    for (const txt of texts) {
      try {
        let data = JSON.parse(txt);
        if (!Array.isArray(data)) data = [data];
        const s = riMergeReports(riStore, data);
        added += s.added; dupes += s.dupes;
        all.push(...data);
      } catch (e) { bad++; }
    }
    riPersist();
    riInvalidateView();
    riStatus(bad ? t('ev_bad_files')(bad) : t('ev_added')(added, dupes, Object.keys(riStore.villages).length), !!bad);
    renderEnemyVillagesTable();
    riShareReports(all);
  });
}

function riProcessPaste() {
  const ta = document.getElementById('ev-paste');
  if (!ta || !ta.value.trim()) return;
  riProcessText(ta.value);
  ta.value = '';
}

function riClearReports() {
  if (Object.keys(riStore.villages).length && !confirm(t('ev_clear_confirm'))) return;
  riStore = riEmptyStore();
  try { localStorage.removeItem(REPORTS_KEY); } catch (e) {}
  riInvalidateView();
  riStatus('');
  renderEnemyVillagesTable();
}

function riSortBy(key) {
  if (riSort.key === key) riSort.dir = -riSort.dir; else riSort = { key, dir: 1 };
  renderEnemyVillagesTable();
}

// ── Rendering ──
// Own-tribe villages and current barbarians are hidden when the world DB can
// tell us (barb scouting floods the store; own villages aren't "enemy").
// Without a world DB everything is shown.

// Protected-tribe obscuring (v5.8.0): report intel about villages currently owned
// by RI_PROTECTED_ALLIES is hidden from every direct lookup — INDEPENDENT of the
// myAllyIds own-tribe filter, which needs a loaded troop file and is therefore
// empty exactly in the leak scenario (someone opening the bare hosted URL). A
// village present in the LOCAL reports store stays visible: the operator who
// processed their own exports is not the person being defended against. The
// shared-DB endpoints are stripped server-side too; this layer keeps the rule
// even for data that reached the browser some other way.
function riProtected(coord) {
  if (typeof RI_PROTECTED_ALLIES === 'undefined' || !RI_PROTECTED_ALLIES.length) return false;
  if (riStore.villages[coord]) return false; // locally uploaded → the operator's own data
  if (typeof coordDb === 'undefined' || typeof playerAllyDb === 'undefined') return false;
  const cv = coordDb[coord];
  if (!cv || !cv.playerId) return false;
  return RI_PROTECTED_ALLIES.includes(String(playerAllyDb[cv.playerId] || ''));
}

function riHidden(coord, v) {
  if (riProtected(coord)) return true;
  if (typeof coordDb === 'undefined') return false;
  const cv = coordDb[coord];
  if (!cv) return false;
  if (!cv.playerId || cv.playerId === '0') return true; // barbarian now
  if (typeof myAllyIds !== 'undefined' && myAllyIds.length &&
      typeof playerAllyDb !== 'undefined' && myAllyIds.includes(playerAllyDb[cv.playerId])) return true;
  return false;
}

const RI_BADGE = {
  off:     s => `<span class="badge badge-off">OFF${s ? '' : '?'}</span>`,
  def:     s => `<span class="badge badge-def">DEF${s ? '' : '?'}</span>`,
  mixed:   s => `<span class="badge badge-mixed">MIX${s ? '' : '?'}</span>`,
  spy:     () => `<span class="badge" style="background:#2a2a4a;color:#a0a0e0;">👁 SPY</span>`,
  empty:   () => `<span class="badge badge-empty">—</span>`,
  unknown: () => `<span class="badge badge-empty">?</span>`,
};

function riUnitCells(units, style) {
  return UNITS.map(u => {
    const n = (units && units[u]) || 0;
    if (!units) return '<td class="num-zero">?</td>';
    if (n === 0) return '<td class="num-zero">0</td>';
    return `<td${style ? ` style="${style}"` : ''}>${n.toLocaleString()}</td>`;
  }).join('');
}
function riOffPow(units) {
  if (!units) return 0;
  return OFF_UNITS.reduce((s, u) => s + ((units[u] || 0) * ATT[u]), 0);
}

function renderEnemyVillagesTable() {
  const tbody = document.getElementById('ev-tbody');
  if (!tbody) return;
  const summary = document.getElementById('ev-summary');
  const search = (document.getElementById('ev-search')?.value || '').toLowerCase();
  const now = Date.now();

  let rows = Object.entries(riViewVillages()).map(([coord, v]) => {
    const cv = (typeof coordDb !== 'undefined' && coordDb[coord]) || null;
    const ownerName = cv ? (dbOwnerName(coord) || v.playerName || '') : (v.playerName || '');
    const verdict = riClassify(v);
    return { coord, v, cv, ownerName, verdict, stale: cv ? riStale(v, cv.playerId) : false };
  }).filter(r => !riHidden(r.coord, r.v));

  if (search) {
    rows = rows.filter(r => r.coord.includes(search) ||
      (r.ownerName || '').toLowerCase().includes(search) ||
      (r.v.playerName || '').toLowerCase().includes(search));
  }

  const dir = riSort.dir;
  const cmp = {
    last:   (a, b) => dir * ((b.v.lastT || 0) - (a.v.lastT || 0)),
    coord:  (a, b) => dir * a.coord.localeCompare(b.coord),
    player: (a, b) => dir * (a.ownerName || '').localeCompare(b.ownerName || ''),
    type:   (a, b) => dir * (a.verdict.cls + (a.verdict.sure ? 0 : 1)).localeCompare(b.verdict.cls + (b.verdict.sure ? 0 : 1)),
  }[riSort.key] || ((a, b) => (b.v.lastT || 0) - (a.v.lastT || 0));
  rows.sort(cmp);

  const cells = [];
  let first = true;
  for (const r of rows) {
    const { coord, v, cv, verdict } = r;
    const url = (typeof villageInfoUrl === 'function') ? villageInfoUrl(coord) : null;
    const coordHtml = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:inherit;">${coord}</a>`
      : coord;
    const name = cv ? decode(cv.name) : (v.name || '');
    const badge = r.stale
      ? `<span class="badge badge-empty" title="${esc(t('ev_stale_tip'))}">⌛ ${esc(t('ev_stale'))}</span>`
      : RI_BADGE[verdict.cls](verdict.sure);
    // Tooltip in SERVER time (TWRR.fmtT), like every time the game shows.
    const ageHtml = `<span title="${v.lastT && typeof TWRR !== 'undefined' ? TWRR.fmtT(v.lastT) : ''}">${riAge(now, v.lastT)}</span>`;
    const dim = r.stale ? 'opacity:0.55;' : '';

    // Row 1 — troops seen in the village (or the sent-army note when that's all we have)
    const homeUnits = v.home ? v.home.units : null;
    cells.push(`<tr style="${dim}${first ? '' : 'border-top:2px solid #7a5c10;'}">`
      + `<td class="left" style="font-family:monospace;">${coordHtml}`
      + (name ? `<div style="color:#806030;font-size:11px;">${esc(name)}</div>` : '') + `</td>`
      + `<td class="left">${r.ownerName ? `<span class="player-tag">${esc(decode(r.ownerName))}</span>` : '—'}`
      + (r.stale && v.playerName ? `<div style="color:#a06030;font-size:11px;" title="${esc(t('ev_stale_tip'))}">${esc(t('ev_seen_under'))} ${esc(v.playerName)}</div>` : '') + `</td>`
      + `<td>${badge}</td>`
      + `<td>${ageHtml}</td>`
      + `<td class="left" style="white-space:nowrap;color:#5a3a18;">🏠 ${esc(t('ev_row_home'))}</td>`
      + riUnitCells(homeUnits)
      + `<td style="color:#e06040;">${homeUnits ? fmtM(riOffPow(homeUnits)) : '—'}</td></tr>`);
    first = false;

    // Row 2 — troops away (seen / confirmed empty / not seen), or what it sent.
    // Its Village cell carries the "View report" link → full in-game-style
    // report modal (same renderer as the twstats Entrantes page).
    const blank = `<td></td><td></td><td></td><td></td>`;
    const rep2 = `<td class="left"><a href="#" class="ev-viewrep" onclick="riOpenReportModal('${coord}');return false;">📄 ${esc(t('ev_view_report'))}</a></td><td></td><td></td><td></td>`;
    if (v.away && !v.away.empty) {
      cells.push(`<tr style="${dim}">${rep2}`
        + `<td class="left" style="white-space:nowrap;color:#5a3a18;">🚶 ${esc(t('ev_row_away'))}</td>`
        + riUnitCells(v.away.units, 'color:#4a70b0;')
        + `<td style="color:#e06040;">${fmtM(riOffPow(v.away.units))}</td></tr>`);
    } else {
      const note = v.away && v.away.empty ? t('ev_away_empty') : t('ev_away_unknown');
      const color = v.away && v.away.empty ? '#5a8a5a' : '#a08050';
      cells.push(`<tr style="${dim}">${rep2}`
        + `<td class="left" style="white-space:nowrap;color:#5a3a18;">🚶 ${esc(t('ev_row_away'))}</td>`
        + `<td class="left" colspan="11" style="color:${color};font-size:12px;">${esc(note)}</td></tr>`);
    }

    // Row 3 — the biggest army seen leaving this village, REGARDLESS of type
    // (v5.8.0 user decision): a def village never fires an off, but its
    // heavy+cats building-strike is exactly what must be visible at first
    // glance — the old off-only gate (sent.off ≥ 500) hid it. `sentBig` is the
    // largest army by farm pop; records merged before v5.8.0 (old local store /
    // stale shared DB) lack it, so the classic real-off row is the fallback.
    // A 💥 tail flags a known cata striker (sentCat) with its strike count.
    const big = v.sentBig || (v.sent && v.sent.off >= RI_MIN ? v.sent : null);
    if (big) {
      const catTail = v.sentCat
        ? ` <span style="color:#b07fd0;font-weight:600;white-space:nowrap;" title="${esc(t('ev_catas_tip')(v.sentCat.cat, v.sentCat.n))}">💥${v.sentCat.cat}</span>`
        : '';
      cells.push(`<tr style="${dim}">${blank}`
        + `<td class="left" style="white-space:nowrap;color:#5a3a18;">⚔ ${esc(t('ev_row_sent'))}${catTail}</td>`
        + riUnitCells(big.units, 'color:#c05040;')
        + `<td style="color:#e06040;">${fmtM(riOffPow(big.units))}</td></tr>`);
    }
  }

  const anyKnown = Object.keys(riStore.villages).length ||
    (riShared && Object.keys(riShared.villages).length);
  tbody.innerHTML = cells.join('') ||
    `<tr class="empty-row"><td colspan="16">${t(anyKnown ? 'ev_none_match' : 'ev_none')}</td></tr>`;

  if (summary) {
    const nRep = Object.keys(riStore.ids).length +
      (riShared ? Object.keys(riShared.ids).filter(k => !riStore.ids[k]).length : 0);
    summary.textContent = nRep ? t('ev_summary')(rows.length, nRep) : '';
  }
}

// ── Full-report modal (📄 View report on row 2) ──
// Mirror of the twstats Entrantes badge-click modal: the shared FULL-report
// store (db-full.json — newest raw report per village: rep = newest
// defender-side report, sentRep = largest off it sent) is heavier than the
// facts DB, so it is fetched lazily on the first click and cached for the
// session. Rendered by js/report-render.js (TWRR) — the same file the twstats
// pages load, so the two sites render identically. Hosted site only (the
// facts-store table keeps working offline; this modal needs the Worker).
let riFullDbP = null;
function riFullDb() {
  if (!riFullDbP) {
    riFullDbP = cloudFetchReportsFullDb().then(villages => {
      if (!villages) riFullDbP = null; // failed — retry on the next click
      return villages;
    });
  }
  return riFullDbP;
}

// STRICTLY current-owner records (same rule as the twstats modal + riStale):
// the store keeps intel across conquests (`sentRep` especially holds the
// largest attack EVER sent), but everything resets on a conquest, so a past
// owner's report is DROPPED, not shown. rep is checked on its defender side,
// sentRep on its attacker side; curId == null (no world DB) keeps both.
// A sentRep that IS the rep (same reportId) is deduped away.
function riFreshFullReports(v, curId) {
  const fresh = pid => curId == null || pid == null || String(pid) === String(curId);
  const rep = (v && v.rep && fresh(v.rep.defenderPlayerId)) ? v.rep : null;
  let sentRep = (v && v.sentRep && fresh(v.sentRep.attackerPlayerId)) ? v.sentRep : null;
  if (rep && sentRep && sentRep.reportId === rep.reportId) sentRep = null;
  return { rep, sentRep };
}

function riCloseReportModal() {
  const bg = document.getElementById('ev-report-modal');
  if (bg) bg.parentNode.removeChild(bg);
}

function riOpenReportModal(coord) {
  riCloseReportModal();
  const bg = document.createElement('div');
  bg.id = 'ev-report-modal';
  bg.className = 'twrr-modal-bg';
  bg.innerHTML = `<div class="twrr-modal"><div class="twrr-modal-title"><span>${t('ev_rep_title')(esc(coord))}</span>`
    + `<button type="button" class="twrr-modal-close" onclick="riCloseReportModal()">✕</button></div>`
    + `<div id="ev-report-body"></div></div>`;
  bg.addEventListener('click', e => { if (e.target === bg) riCloseReportModal(); });
  document.body.appendChild(bg);
  const body = document.getElementById('ev-report-body');
  // Protected village (v5.8.0): don't even ask the Worker — the endpoint is
  // stripped anyway; this shows an honest message instead of "no reports".
  if (riProtected(coord)) {
    body.textContent = t('ev_rep_protected');
    return;
  }
  if (typeof TW_ENV === 'undefined' || TW_ENV !== 'production') {
    body.textContent = t('ev_shared_dev');
    return;
  }
  body.textContent = t('ev_rep_loading');
  riFullDb().then(villages => {
    const b = document.getElementById('ev-report-body');
    if (!b) return; // modal already closed
    if (!villages) { b.textContent = t('ev_rep_db_err'); return; }
    const v = villages[coord];
    if (!v || (!v.rep && !v.sentRep) || typeof TWRR === 'undefined') {
      b.textContent = t('ev_rep_none');
      return;
    }
    const cv = (typeof coordDb !== 'undefined' && coordDb[coord]) || null;
    const curId = (cv && cv.playerId != null) ? String(cv.playerId) : null;
    const { rep, sentRep } = riFreshFullReports(v, curId);
    TWRR.setIconBase('icons/'); // calculator sits next to icons/, not one level below
    let h = '';
    if (rep) h += `<div class="twrr-srchead">${esc(t('ev_rep_last'))}</div>` + TWRR.reportHtml(rep);
    if (sentRep) h += `<div class="twrr-srchead">${esc(t('ev_rep_sent'))}</div>` + TWRR.reportHtml(sentRep);
    if (!h) { b.textContent = t('ev_rep_none_owner'); return; }
    b.innerHTML = h;
  });
}
