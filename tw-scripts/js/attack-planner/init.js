// attack-planner — render-all + init.
// Classic script (8/8): no modules, shared global scope, load order matters — must work
// by double-click (file://). See the <script src> order in attack-planner.html.
'use strict';

// ══════════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════════

function renderAll() {
  renderVillages();
  renderTargets();
  renderAttacks();
  refreshDropdowns();
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════

(async function init() {
  loadData();
  applySettings();
  applyTranslations();
  bindSettings();
  renderAll();
  initBookmarklet();
  setInterval(updateCountdowns, 1000);
  await tryAutoConnect();
  // Village DB: production (live site) fetches the web mirror,
  // development restores the locally connected folder
  if (TW_ENV === 'production') {
    const btn = document.getElementById('db-connect-btn');
    if (btn) btn.style.display = 'none';
    await loadDbFromWeb();
  } else {
    await tryAutoConnectDb();
  }
})();
