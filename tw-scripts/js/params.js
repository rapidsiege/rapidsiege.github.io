// ══════════════════════════════════════════════════════════════
// 🎚 PARAMETERS (v6.0.0) — ⚙ Settings → 🎚 Parameters + the per-tab panels
// ──────────────────────────────────────────────────────────────
// Renders PARAM_DEFS (constants.js) as one editable row per parameter. The central tab
// (#params-host) shows every section; each planning tab carries a collapsible 🎚 panel
// (the Map keeps its own dock inputs and prefs — its values are not parameters, user decision 2026-09-24)
// with the sections that concern it (PARAM_PANELS). All of them are views of the SAME
// PARAMS object: a control writes through paramSet(), saveSettings() persists the
// overrides, and every panel is re-rendered — so a value edited anywhere shows up
// everywhere at once. A ↺ button per row and "Reset all" restore the defaults. Most
// parameters are read by the engines at the next Generate; the few that shape a table
// already on screen re-render it right away (paramsChanged). changeLang re-renders the
// panels so the labels follow the language.
// ══════════════════════════════════════════════════════════════
// host element id → sections shown there. `full` = the central tab (section headers +
// intro, no <details> wrapper); the rest are the inline collapsible panels.
const PARAM_PANELS = [
  { host: 'params-host',      secs: null, full: true }, // null = every section (PARAM_SECTIONS)
  { host: 'villages-params',  secs: ['tiers', 'overview'] },
  { host: 'outbound-params',  secs: ['outbound'] },
  { host: 'target-params',    secs: ['time'] },
  { host: 'plan-params',      secs: ['off'] },
  { host: 'defplan-params',   secs: ['def'] },
  { host: 'manageoff-params', secs: ['manageoff'] },
  { host: 'managedef-params', secs: ['managedef'] },
];
// Inline panels that the user has opened this session (survives the re-render on every edit).
const paramPanelOpen = new Set();

function paramInputId(host, key) { return host + '-' + key; }

// Human form of a parameter value for the ↺ tooltip ("Reset to default (101)").
function paramDisplayValue(d, v) {
  if (d.type === 'bool') return t(v ? 'param_on' : 'param_off');
  if (d.type === 'select') return t('po_' + d.key + '_' + v);
  return typeof v === 'number' ? v.toLocaleString() : String(v);
}

// One parameter row. `host` prefixes the control id so the same key can be on screen in
// several panels at once.
function paramRowHtml(host, d) {
  const id = paramInputId(host, d.key), v = PARAMS[d.key];
  let ctl;
  if (d.type === 'bool') {
    ctl = `<input type="checkbox" id="${id}"${v ? ' checked' : ''} onchange="setParam('${d.key}', this.checked)">`;
  } else if (d.type === 'select') {
    ctl = `<select id="${id}" onchange="setParam('${d.key}', this.value)">` +
      d.opts.map(o => `<option value="${o}"${o === v ? ' selected' : ''}>${esc(t('po_' + d.key + '_' + o))}</option>`).join('') + `</select>`;
  } else {
    const attrs = (d.min != null ? ` min="${d.min}"` : '') + (d.max != null ? ` max="${d.max}"` : '') + (d.step != null ? ` step="${d.step}"` : '');
    ctl = `<input type="number" id="${id}" value="${v}"${attrs} onchange="setParam('${d.key}', this.value)">`;
  }
  const unit = d.unit ? `<span class="param-unit">${esc(t('pu_' + d.unit))}</span>` : '';
  const isDef = paramIsDefault(d.key);
  return `<div class="param-row${isDef ? '' : ' param-changed'}">` +
    `<label for="${id}">${esc(t('p_' + d.key))}</label>` +
    `<div class="param-ctl">${ctl}${unit}` +
    `<button class="param-reset" title="${esc(t('param_reset_t')(paramDisplayValue(d, d.def)))}"${isDef ? ' disabled' : ''} onclick="resetParam('${d.key}')">↺</button></div>` +
    `<div class="param-tip">${esc(t('pt_' + d.key))}</div>` +
    `</div>`;
}

function paramSectionHtml(host, sec, withHeader) {
  const defs = PARAM_DEFS.filter(d => d.sec === sec);
  if (!defs.length) return '';
  return (withHeader ? `<div class="section-header"><h2>${esc(t('ps_' + sec))}</h2></div>` : '') +
    `<div class="param-grid">${defs.map(d => paramRowHtml(host, d)).join('')}</div>`;
}

// Render every panel whose host exists in the DOM (the central tab + the inline ones).
function renderParamPanels() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  for (const P of PARAM_PANELS) {
    const host = document.getElementById(P.host);
    if (!host) continue;
    const secs = P.secs || PARAM_SECTIONS;
    if (P.full) {
      host.innerHTML = secs.map(sec => paramSectionHtml(P.host, sec, true)).join('');
      continue;
    }
    const changed = PARAM_DEFS.filter(d => secs.includes(d.sec) && !paramIsDefault(d.key)).length;
    const title = secs.map(sec => t('ps_' + sec)).join(' · ');
    host.innerHTML =
      `<details class="param-panel"${paramPanelOpen.has(P.host) ? ' open' : ''} ontoggle="paramPanelToggled('${P.host}', this.open)">` +
      `<summary>🎚 ${esc(t('param_panel_title'))} — ${esc(title)}` +
      (changed ? ` <span class="param-changed-badge">${esc(t('param_panel_changed')(changed))}</span>` : '') +
      ` <a class="param-panel-all" href="#" onclick="switchTab('params'); return false;">${esc(t('param_panel_all'))}</a></summary>` +
      `<div class="param-panel-body">${secs.map(sec => paramSectionHtml(P.host, sec, secs.length > 1)).join('')}</div></details>`;
  }
}
// Kept as the historical name (init block / changeLang call it).
function renderParamsTab() { renderParamPanels(); }
function paramPanelToggled(host, open) { if (open) paramPanelOpen.add(host); else paramPanelOpen.delete(host); }

// A parameter changed (from ANY panel): persist, refresh whatever is on screen that reads
// it, and redraw every panel so they all agree.
function setParam(key, val) {
  if (!PARAM_BY_KEY[key]) return;
  paramSet(key, val);
  saveSettings();
  paramsChanged([key]);
  renderParamPanels();
}
function resetParam(key) {
  if (!PARAM_BY_KEY[key]) return;
  paramReset(key);
  saveSettings();
  paramsChanged([key]);
  renderParamPanels();
}
function resetAllParams() {
  if (typeof confirm === 'function' && !confirm(t('params_reset_all_confirm'))) return;
  const changed = Object.keys(paramsOverrides());
  paramsResetAll();
  saveSettings();
  paramsChanged(changed);
  renderParamPanels();
}

// Live consumers. Everything not listed here is read at the next Generate / import / render.
function paramsChanged(keys) {
  const has = re => keys.some(k => re.test(k));
  const troops = (typeof villages !== 'undefined') && villages.length;
  if (has(/^tier/) && typeof renderTierTables === 'function') renderTierTables();
  if (has(/^typeRatio$/) && troops) {
    villages.forEach(applyVilDerived); // re-classify off / def / mixed
    for (const v of villages) if (troopByCoord[v.coord]) troopByCoord[v.coord].type = v.type;
  }
  if (has(/^(typeRatio|numHigh)$/) && troops) {
    renderOverview(); renderPlayersTable(); renderVillagesTable(); renderRankings();
    if (typeof renderOutboundTable === 'function') renderOutboundTable();
    if (typeof renderTargetTable === 'function') renderTargetTable();
  }
  if (has(/^outbound/) && typeof renderOutboundTable === 'function') renderOutboundTable();
}
