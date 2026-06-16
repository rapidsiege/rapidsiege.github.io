// ══════════════════════════════════════════════════════════════
// FILE HANDLING
// ══════════════════════════════════════════════════════════════
function handleFileInput(input) {
  if (input.files && input.files.length) loadFiles(input.files);
}
function onDragOver(e)  { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
}
function loadFiles(fileList) {
  const files = [...fileList];
  const results = new Array(files.length);
  let done = 0;
  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = ev => {
      results[i] = ev.target.result;
      if (++done === files.length) {
        // merge: keep first header, strip headers from subsequent files
        const isHeader = line => /^coords?[,\t]/i.test(line.trim());
        const merged = results.map((text, idx) =>
          idx === 0 ? text : text.split('\n').filter(l => !isHeader(l)).join('\n')
        ).join('\n');
        const label = files.length === 1 ? files[0].name : `${files.length} files`;
        parseData(merged, label);
        persistTroops(merged, label);
      }
    };
    reader.readAsText(file);
  });
}
function loadFromPaste() {
  const text = document.getElementById('paste-input').value.trim();
  if (!text) return;
  parseData(text, 'pasted data');
  persistTroops(text, 'pasted data');
}

// ── Persist the uploaded/pasted troop text so it survives across sessions ──
// Stored as raw text (re-parsed on next load); replaced only when new files are
// uploaded or new data pasted, and cleared by the ✕ Clear button. Wrapped so a
// quota failure (very large troop file) never breaks the load itself.
const TROOP_KEY = 'tw_tribe_troops';
function persistTroops(text, filename) {
  if (!villages.length) return; // don't persist a parse that produced nothing
  try { localStorage.setItem(TROOP_KEY, JSON.stringify({ text, filename, savedAt: new Date().toISOString() })); } catch {}
}
function autoloadTroops() {
  if (villages.length) return; // a real upload this session takes precedence
  let d;
  try { d = JSON.parse(localStorage.getItem(TROOP_KEY)); } catch { return; }
  if (!d || !d.text) return;
  parseData(d.text, d.filename || t('imported_troops'));
  if (villages.length) {
    const txt = document.getElementById('file-status-text');
    if (txt) txt.textContent += ` · ${t('troops_restored')}`;
  }
}

function clearData() {
  villages = []; players = {};
  try { localStorage.removeItem(TROOP_KEY); } catch {} // also drop the persisted copy
  document.getElementById('file-dot').className = 'file-status-dot dot-off';
  document.getElementById('file-status-text').textContent = t('status_no_file');
  document.getElementById('file-status-text').className = '';
  document.getElementById('file-summary').textContent = '';
  document.getElementById('paste-input').value = '';
  document.getElementById('overview-drop').style.display = '';
  document.getElementById('overview-content').style.display = 'none';
  document.getElementById('players-tbody').innerHTML = `<tr class="empty-row"><td colspan="17">${t('empty_load_players')}</td></tr>`;
  document.getElementById('byvillages-tbody').innerHTML = `<tr class="empty-row"><td colspan="12">${t('empty_load_byvillages')}</td></tr>`;
  document.getElementById('villages-tbody').innerHTML = `<tr class="empty-row"><td colspan="15">${t('empty_load_villages')}</td></tr>`;
  document.getElementById('rankings-content').innerHTML = `<div style="color:#5a3a18;padding:36px;text-align:center;">${t('empty_load_rankings')}</div>`;
  renderTargetTable();
}

// ══════════════════════════════════════════════════════════════
// PARSING
// ══════════════════════════════════════════════════════════════
// Off/def power + type classification for a troop-village row, derived from its unit
// counts. Used by parseData (initial parse) AND the By-Villages manual edit, so the two
// never diverge. Mutates vil in place (sets offPow / defInf / defCav / type).
const OFF_UNITS = ['axe','light','ram','catapult'];
const DEF_UNITS = ['spear','sword','heavy','catapult','knight','light','spy'];
function applyVilDerived(vil) {
  vil.offPow = OFF_UNITS.reduce((s,u) => s + (vil[u] || 0) * ATT[u],  0);
  vil.defInf = DEF_UNITS.reduce((s,u) => s + (vil[u] || 0) * DINF[u], 0);
  vil.defCav = DEF_UNITS.reduce((s,u) => s + (vil[u] || 0) * DCAV[u], 0);
  const totalUnits = UNITS.reduce((s,u) => s + (vil[u] || 0), 0);
  let type = 'empty';
  if (totalUnits > 0) {
    const offScore = vil.axe + vil.light + vil.ram;
    const defScore = vil.spear + vil.sword + vil.heavy + vil.knight;
    if (offScore > defScore * 2)      type = 'off';
    else if (defScore > offScore * 2) type = 'def';
    else                              type = 'mixed';
  }
  vil.type = type;
}
// Re-sum a player's aggregate (totals + off/def power) from its villages — called after a
// manual edit changes one of them. Idempotent.
function recomputePlayerAggregate(name) {
  const p = players[name];
  if (!p) return;
  p.totals = Object.fromEntries(UNITS.map(u => [u, 0]));
  p.offPow = 0; p.defInf = 0; p.defCav = 0;
  for (const v of p.villages) {
    UNITS.forEach(u => { p.totals[u] += (v[u] || 0); });
    p.offPow += v.offPow; p.defInf += v.defInf; p.defCav += v.defCav;
  }
}

function parseData(text, filename) {
  villages = [];
  players  = {};
  troopByCoord = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim());
    if (!cols[0] || cols[0].toLowerCase() === 'coords') continue; // skip header
    if (!cols[0].includes('|') && !cols[0].match(/^\d+\|\d+$/)) {
      // Try to handle malformed coord like "002|7" — keep as-is
    }

    const coord  = cols[0];
    const player = cols[1] || 'Unknown';
    const units  = {};
    UNITS.forEach((u, i) => { units[u] = parseInt(cols[2 + i]) || 0; });

    const vil = { coord, player, ...units };
    applyVilDerived(vil); // offPow / defInf / defCav / type
    villages.push(vil);
    troopByCoord[coord] = vil; // index for the map hover/badges

    if (!players[player]) {
      players[player] = { villages: [], totals: Object.fromEntries(UNITS.map(u => [u,0])), offPow:0, defInf:0, defCav:0 };
    }
    players[player].villages.push(vil);
    UNITS.forEach(u => { players[player].totals[u] += units[u]; });
    players[player].offPow += vil.offPow;
    players[player].defInf += vil.defInf;
    players[player].defCav += vil.defCav;
  }

  // Status bar
  const playerCount = Object.keys(players).length;
  document.getElementById('file-dot').className = 'file-status-dot dot-ok';
  const txt = document.getElementById('file-status-text');
  txt.textContent = filename;
  txt.className = 'connected';
  document.getElementById('file-summary').textContent =
    `${villages.length} villages · ${playerCount} players`;

  renderOverview();
  renderPlayersTable();
  renderByVillagesTable();
  renderVillagesTable();
  renderRankings();
  renderTargetTable();
  renderOffTargets(); // sender picker depends on the troop data
  if (typeof mapDetectAndSeed === 'function') mapDetectAndSeed(); // map: detect uploading tribe + seed My-tribe group
  if (typeof mapRefresh === 'function') mapRefresh();             // recolor map if it's open

  document.getElementById('overview-drop').style.display = 'none';
  document.getElementById('overview-content').style.display = '';
}

