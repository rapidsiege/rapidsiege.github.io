// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
let villages = [];   // [{coord, player, spear, sword, axe, spy, light, heavy, ram, catapult, knight, snob, offPow, defInf, defCav, type}]
let troopByCoord = {};  // 'x|y' → owned-troop row (map hover/badges); rebuilt in parseData
let defenseByCoord = {};  // 'x|y' → stationed-troops row (defense type from tribe_everything.txt)
let incomingByCoord = {}; // 'x|y' → inbound/returning troops row (incoming type)
let players  = {};   // {playerName: {villages:[], totals:{...}, offPow, defInf, defCav}}
let sortState = { players: {col:0,dir:1}, villages: {col:14,dir:1}, outbound: {col:11,dir:1} }; // villages: Off Power desc (col 14); outbound: Off desc (col 11)
let targetSort = { key: 'dist', dir: 1 }; // default: distance asc


function changeLang(l) {
  lang = l;
  document.getElementById('lang-btn-en').classList.toggle('lang-active', l === 'en');
  document.getElementById('lang-btn-es').classList.toggle('lang-active', l === 'es');
  applyLang();
  if (villages.length) {
    renderOverview();
    renderPlayersTable();
    renderVillagesTable();
    renderRankings();
  }
  renderTargetTable();
  renderOffTargets();
  renderPlanTable();
  if (typeof renderDefTargets === 'function') renderDefTargets();
  if (typeof renderDefPlanTable === 'function') renderDefPlanTable();
  renderDbTable();
  updateDbConnectBtn();
  if (typeof renderChangelog === 'function') renderChangelog();
  if (typeof saveSettings === 'function') saveSettings(); // persist the language choice
}

// ── Unit/stat icons (icons/ folder; see .claude/PLAN.md for the deploy note) ──
const ICON_KEYS = new Set(['spear','sword','axe','spy','light','heavy','ram','catapult','knight','snob','off','def','def_cav']);
function twIcon(key, cls) {
  return ICON_KEYS.has(key) ? `<img class="tw-ic${cls ? ' ' + cls : ''}" src="icons/${key}.png" alt="">` : '';
}
// Map data-i18n-th header keys → icon file key
const TH_ICON = {
  th_spear:'spear', th_sword:'sword', th_axe:'axe', th_spy:'spy', th_light:'light',
  th_heavy:'heavy', th_ram:'ram', th_cat:'catapult', th_knight:'knight', th_snob:'snob',
  th_off_power:'off', th_def_power:'def', th_off:'off', th_def:'def',
};
// Prepend the matching icon to every static table header once (idempotent, DOM-safe for the test sandbox)
function injectThIcons() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  try {
    document.querySelectorAll('[data-i18n-th]').forEach(el => {
      const ic = TH_ICON[el.dataset && el.dataset.i18nTh];
      if (ic && el.insertAdjacentHTML && !(el.querySelector && el.querySelector('.tw-ic')))
        el.insertAdjacentHTML('afterbegin', twIcon(ic));
    });
  } catch (e) {}
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n);
    if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-th]').forEach(el => {
    const v = t(el.dataset.i18nTh);
    if (!v) return;
    // Update the label text node, leaving any prepended .tw-ic <img> and the trailing sort-arrow span intact
    const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()) || [...el.childNodes].find(n => n.nodeType === 3);
    if (tn) tn.textContent = v + ' ';
    else if (el.childNodes[0]) el.childNodes[0].textContent = v + ' ';
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const v = t(el.dataset.i18nPlaceholder);
    if (v) el.placeholder = v;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const v = t(el.dataset.i18nTitle);
    if (v) el.title = v;
  });
  if (!villages.length) {
    const txt = document.getElementById('file-status-text');
    if (txt && !txt.classList.contains('connected')) txt.textContent = t('status_no_file');
  }
}

