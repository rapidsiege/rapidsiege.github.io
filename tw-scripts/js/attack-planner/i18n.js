// attack-planner — translations (LANG dict, t(), applyLang).
// Classic script (1/8): no modules, shared global scope, load order matters — must work
// by double-click (file://). See the <script src> order in attack-planner.html.
'use strict';

// ══════════════════════════════════════════════
// i18n
// ══════════════════════════════════════════════

const LANG = {
  en: {
    // Header
    lang_label: 'Lang',
    lbl_server: 'Server',
    lbl_world_speed: 'World Speed',
    lbl_unit_speed: 'Unit Speed',
    lbl_my_player: 'My Player',

    // File bar
    file_not_connected: 'No file connected',
    file_connected: 'Connected',
    btn_connect_file: '⟁ Connect File',
    btn_export: '↓ Export',
    btn_import: '↑ Import',

    // Tabs
    tab_attack_plan: '⚔ Attack Plan',
    tab_my_villages: '🏰 My Villages',
    tab_targets: '🎯 Targets',
    tab_village_db: '🗃 Village DB',
    tab_guide: '📖 Guide',

    // Section / modal titles
    sec_new_attack: 'New Attack',
    sec_add_village: 'Add Village',
    sec_add_target: 'Add Target',
    sec_import_off: '⚔ Import Off Targets',
    sec_import_fake: '💨 Import Fake Targets',
    modal_edit_village: 'Edit Village',
    modal_edit_target: 'Edit Target',
    modal_autogen: '⚡ Auto-Generate Attacks',
    modal_export: '📋 Export to Notepad',
    modal_edit_attack: 'Edit Attack',

    // Buttons
    btn_export_notepad: '📋 Export BB Code',
    btn_clear_all: '🗑 Clear All',
    btn_clear_sent: '🗑 Clear Sent',
    btn_auto_generate: '⚡ Auto-Generate',
    btn_add_attack: '+ Add Attack',
    btn_add_village: '+ Add Village',
    btn_clear_villages: '🗑 Clear Villages',
    btn_add_target: '+ Add Target',
    btn_add_req: '+ Add requirement',
    btn_assign_me: '👤 Assign all to me',
    btn_clear_targets: '🗑 Clear Targets',
    btn_paste_villages: '📋 Paste Villages',
    btn_import_off: 'Import Off Targets',
    btn_import_fake: 'Import Fake Targets',
    btn_enrich: '✦ Enrich from DB',
    btn_enrich_title: 'Fill missing data from Village DB',
    btn_fake_targets: '💨 Fake Targets',
    btn_off_targets: '⚔ Off Targets',
    btn_connect_db: '⟁ Connect DB Folder',
    btn_generate: 'Generate',
    btn_copy_all: 'Copy All',
    btn_close: 'Close',
    btn_save: 'Save',
    btn_cancel: 'Cancel',
    btn_copy: 'Copy',
    btn_copied: '✓ Copied!',
    btn_send: '⚔ Send',
    btn_copy_url: '⎘ Copy',
    btn_mark_sent: '✓ Sent',
    btn_unmark_sent: '↩ Unmark',

    // Bookmarklet
    bm_drag: '🔖 Drag to bookmarks bar',
    bm_drag_title: 'Drag this to your bookmarks bar',
    bm_note: '1. Drag the gold button to your bookmarks bar. 2. Open TW → Recruit → Mass Recruit tab. 3. Click the bookmark — your troops are copied to clipboard. 4. Come back here and click "📋 Paste Villages". This script only reads troop data already visible on the page — it does not interact with the game or send anything to the server.',
    bm_opt1_title: '⚡ Option 1 — Script (automatic)',
    bm_opt2_title: '📄 Option 2 — Save HTML manually',
    btn_select_html: '📄 Select HTML File',
    bm_opt2_note: '1. Open TW → Recruit → Mass Recruit tab. 2. Press Ctrl+S → Save As → save the page as HTML Only. 3. Click "Select HTML File" and pick the saved file — villages are imported automatically. This is the safest option: no script runs on TW at all — you are simply feeding the saved HTML to the planner so it can read your units.',

    // Form labels
    lbl_from_village: 'From Village',
    lbl_target: 'Target',
    lbl_type: 'Type',
    lbl_noble_count: 'Noble Count',
    lbl_landing_time: 'Landing Time',
    lbl_landing_date: 'Landing Date',
    lbl_options: 'Options',
    ag_criteria_label: 'Off Assignment Criteria',
    ag_criteria_hint: '(priority order: Power → Distance → Window)',
    ag_crit_power: 'Power — strongest for complete offs, weakest qualifying for 1/2 offs',
    ag_crit_distance: 'Distance — prefer closest available village',
    ag_crit_window: 'Send window — prefer send times closest to the target arrival window',
    ag_include_fakes: 'Include fakes',
    ag_divided_off_label: '<strong>Divided Off</strong> — for selected villages: split troops evenly with nobles, exclude from separate off plan',
    ag_note: 'Landing times are taken from each target\'s requirements (e.g. 02:00).<br>• <strong>Off villages</strong> (≥1/2 power): 1 real off per assigned target.<br>• <strong>Fakes</strong> (when enabled): up to 10 per village with rams, to fake &amp; off targets.<br>• <strong>Snobs</strong>: trains of 4 from the village with most nobles.',
    ag_no_nobles: 'No villages with nobles',
    lbl_name: 'Name',
    lbl_village_id: 'Village ID',
    lbl_player: 'Player',
    lbl_axes: 'Axes',
    lbl_lc: 'LC',
    lbl_rams: 'Rams',
    lbl_catapults: 'Catapults',
    lbl_nobles: 'Nobles',
    lbl_x: 'X',
    lbl_y: 'Y',

    // Table headers
    lbl_from: 'From',
    lbl_village_name: 'Village Name',
    lbl_off_power: 'Off Power',
    lbl_dist: 'Dist',
    lbl_travel: 'Travel',
    lbl_landing: 'Landing',
    lbl_send_at: 'Send At',
    lbl_countdown: 'Countdown',
    lbl_attack: 'Attack',
    lbl_actions: 'Actions',
    lbl_id: 'ID',
    lbl_coords: 'Coords',
    lbl_cats: 'Cats',
    lbl_requirements: 'Requirements',
    mt_no_reqs: 'No requirements yet — add one below.',
    mt_reqs_hint: 'One row per attack. The player must match “My Player” to be picked up by Auto-Generate. Source is the origin coord X|Y that pins the sender (optional).',
    mt_count: 'Count (noble-train size for snobs)',
    mt_src: 'src',
    mt_src_title: 'Origin village coord X|Y — pins which village sends this attack (optional)',
    lbl_points: 'Points',

    // Select options
    opt_off: 'Off (Rams)',
    opt_fake: 'Fake (1 spy/1 ram)',
    opt_snob: 'Snob (Nobleman)',
    lbl_speed: 'Speed (timing)',
    opt_speed_auto: 'Auto (by type)',
    opt_speed_axe: 'Axe (18)',
    opt_speed_sword: 'Sword (22)',
    opt_speed_lc: 'Light Cavalry (10)',
    opt_target_off: 'Off',
    opt_target_fake: 'Fake',

    // Placeholders
    ph_filter: 'Filter\u2026',
    ph_db_search: 'Search by name, ID, or player\u2026',
    ph_off_paste: 'Paste BB-code here\u2026',

    // Empty states
    empty_attacks: 'No attacks planned yet. Click \u201c+ Add Attack\u201d to begin.',
    empty_attacks_filtered: 'No attacks match the current filters.',
    empty_villages: 'No villages added yet.',
    empty_targets: 'No targets added yet.',
    empty_db: 'Connect a DB folder to load village data.',
    db_not_connected: 'No folder connected',

    // DB
    db_showing: 'Showing 200 of {total}',
    db_error_loading: 'Error loading files',
    db_web_updated: '— auto-loaded from web mirror (updated {ts})',
    db_web_failed: 'Could not load map data from the web — reload the page to retry.',
    db_no_data: 'No data loaded.',
    empty_no_results: 'No results.',

    // Countdown statuses
    status_sent: 'SENT',
    status_send_now: 'SEND NOW!',
    status_late: 'LATE',

    // Alerts & confirms
    alert_invalid_json: 'Invalid JSON file.',
    alert_already_target: 'This village is already in your targets list.',
    alert_no_db: 'No village DB loaded. Connect a DB folder first (Village DB tab).',
    alert_enriched: 'Enriched {n} target(s).',
    alert_coords_required: 'Coordinates are required.',
    alert_no_my_player: 'Set “My Player” in the top bar first.',
    alert_delete_village: 'Delete this village?',
    alert_delete_target: 'Delete this target?',
    alert_delete_attack: 'Delete this attack?',
    alert_delete_all: 'DELETE ALL attacks? This cannot be undone.',
    alert_clear_sent: 'Remove all sent attacks?',
    alert_clear_villages: 'DELETE ALL villages? This cannot be undone.',
    alert_clear_targets: 'DELETE ALL targets? This cannot be undone.',
    alert_no_targets_found: 'No targets found. Check the format.',
    alert_off_imported: 'Off targets: {added} added, {updated} updated.',
    alert_plan_imported: 'Per-player plan: {added} target(s) added, {updated} updated — requirements for {players} player(s): {senders}.\nSet "My Player" to your exact name (above), then Auto-Generate to assign your villages.',
    alert_plan_date: 'Arrival date {date} — pre-filled in Auto-Generate.',
    alert_fake_imported: 'Fake targets: {added} added, {skipped} skipped.',
    alert_no_targets: 'No targets added. Import targets first.',
    alert_no_villages: 'No villages added. Add your villages first.',
    alert_pick_date: 'Pick a landing date.',
    alert_no_attacks_generated: 'No attacks could be generated.\nCheck that villages have troops and targets have requirements.',
    alert_generated: 'Generated {total} attacks:\n\u2022 {offs} off(s)\n\u2022 {snobs} snob train(s)\n\u2022 {fakes} fake(s)',
    alert_generated_unassigned: '\n\n\u26a0 {n} requirement(s) unassigned \u2014 shown as red rows in My Attacks.',
    alert_select_from: 'Select a From Village.',
    alert_select_target: 'Select a Target.',
    alert_set_landing: 'Set a Landing Time.',
    alert_no_attacks_export: 'No attacks to export.',
    alert_bm_copied: 'Bookmarklet code copied to clipboard!',
    alert_invalid_format: 'Invalid format \u2014 expected {villages: [...]}',
    alert_import_villages_ok: 'Import complete: {added} added, {updated} updated.',
    alert_parse_error: 'Could not parse JSON: ',
  },

  es: {
    // Header
    lang_label: 'Idioma',
    lbl_server: 'Servidor',
    lbl_world_speed: 'Velocidad Mundo',
    lbl_unit_speed: 'Vel. Unidades',
    lbl_my_player: 'Mi Jugador',

    // File bar
    file_not_connected: 'Sin archivo conectado',
    file_connected: 'Conectado',
    btn_connect_file: '⟁ Conectar Archivo',
    btn_export: '↓ Exportar',
    btn_import: '↑ Importar',

    // Tabs
    tab_attack_plan: '⚔ Plan de Ataque',
    tab_my_villages: '🏰 Mis Pueblos',
    tab_targets: '🎯 Objetivos',
    tab_village_db: '🗃 Base de Datos',
    tab_guide: '📖 Guía',

    // Section / modal titles
    sec_new_attack: 'Nuevo Ataque',
    sec_add_village: 'Añadir Pueblo',
    sec_add_target: 'Añadir Objetivo',
    sec_import_off: '⚔ Importar Objetivos Off',
    sec_import_fake: '💨 Importar Objetivos Fake',
    modal_edit_village: 'Editar Pueblo',
    modal_edit_target: 'Editar Objetivo',
    modal_autogen: '⚡ Generar Ataques',
    modal_export: '📋 Exportar al Bloc',
    modal_edit_attack: 'Editar Ataque',

    // Buttons
    btn_export_notepad: '📋 Exportar BB Code',
    btn_clear_all: '🗑 Borrar Todo',
    btn_clear_sent: '🗑 Borrar Enviados',
    btn_auto_generate: '⚡ Auto-Generar',
    btn_add_attack: '+ Añadir Ataque',
    btn_add_village: '+ Añadir Pueblo',
    btn_clear_villages: '🗑 Borrar Pueblos',
    btn_add_target: '+ Añadir Objetivo',
    btn_add_req: '+ Añadir requisito',
    btn_assign_me: '👤 Asignármelos todos',
    btn_clear_targets: '🗑 Borrar Objetivos',
    btn_paste_villages: '📋 Pegar Pueblos',
    btn_import_off: 'Importar Obj. Off',
    btn_import_fake: 'Importar Obj. Fake',
    btn_enrich: '✦ Completar desde BD',
    btn_enrich_title: 'Rellenar datos faltantes desde la Base de Datos',
    btn_fake_targets: '💨 Obj. Fake',
    btn_off_targets: '⚔ Obj. Off',
    btn_connect_db: '⟁ Conectar Carpeta BD',
    btn_generate: 'Generar',
    btn_copy_all: 'Copiar Todo',
    btn_close: 'Cerrar',
    btn_save: 'Guardar',
    btn_cancel: 'Cancelar',
    btn_copy: 'Copiar',
    btn_copied: '✓ Copiado!',
    btn_send: '⚔ Enviar',
    btn_copy_url: '⎘ Copiar',
    btn_mark_sent: '✓ Enviado',
    btn_unmark_sent: '↩ Deshacer',

    // Bookmarklet
    bm_drag: '🔖 Arrastra a marcadores',
    bm_drag_title: 'Arrastra este botón a la barra de marcadores',
    bm_note: '1. Arrastra el botón dorado a la barra de marcadores. 2. Abre GT → Reclutar → Reclutamiento Masivo. 3. Haz clic en el marcador — las tropas se copian al portapapeles. 4. Vuelve aquí y haz clic en "📋 Pegar Pueblos". Este script solo lee los datos de tropas ya visibles en la página — no interactúa con el juego ni envía nada al servidor.',
    bm_opt1_title: '⚡ Opción 1 — Script (automático)',
    bm_opt2_title: '📄 Opción 2 — Guardar HTML manualmente',
    btn_select_html: '📄 Seleccionar archivo HTML',
    bm_opt2_note: '1. Abre GT → Reclutar → Reclutamiento Masivo. 2. Pulsa Ctrl+S → Guardar como → guarda la página como "Sólo HTML". 3. Haz clic en "Seleccionar archivo HTML" y elige el archivo guardado — los pueblos se importan automáticamente. Esta es la opción más segura: no se ejecuta ningún script en GT — simplemente le estás dando al planificador el HTML guardado para que lea tus unidades.',

    // Form labels
    lbl_from_village: 'Desde Pueblo',
    lbl_target: 'Objetivo',
    lbl_type: 'Tipo',
    lbl_noble_count: 'Nº Nobles',
    lbl_landing_time: 'Hora de Llegada',
    lbl_landing_date: 'Fecha de Llegada',
    lbl_options: 'Opciones',
    ag_criteria_label: 'Criterios de Asignación Off',
    ag_criteria_hint: '(orden de prioridad: Poder → Distancia → Ventana)',
    ag_crit_power: 'Poder — el más fuerte para offs completos, el más débil para offs 1/2',
    ag_crit_distance: 'Distancia — preferir el pueblo disponible más cercano',
    ag_crit_window: 'Ventana de envío — preferir horarios de envío cercanos a la ventana de llegada',
    ag_include_fakes: 'Incluir fakes',
    ag_divided_off_label: '<strong>Off Dividido</strong> — para los pueblos seleccionados: dividir tropas con nobles, excluir del plan off separado',
    ag_note: 'Los horarios de llegada se toman de los requisitos de cada objetivo (ej. 02:00).<br>• <strong>Pueblos off</strong> (≥1/2 poder): 1 off real por objetivo asignado.<br>• <strong>Fakes</strong> (si están activados): hasta 10 por pueblo con arietes, a objetivos fake y off.<br>• <strong>Nobles</strong>: trenes de 4 desde el pueblo con más nobles.',
    ag_no_nobles: 'Sin pueblos con nobles',
    lbl_name: 'Nombre',
    lbl_village_id: 'ID de Pueblo',
    lbl_player: 'Jugador',
    lbl_axes: 'Hachas',
    lbl_lc: 'Lijas',
    lbl_rams: 'Arietes',
    lbl_catapults: 'Catapultas',
    lbl_nobles: 'Nobles',
    lbl_x: 'X',
    lbl_y: 'Y',

    // Table headers
    lbl_from: 'Desde',
    lbl_village_name: 'Nombre',
    lbl_off_power: 'Poder Off',
    lbl_dist: 'Dist.',
    lbl_travel: 'Viaje',
    lbl_landing: 'Llegada',
    lbl_send_at: 'Enviar a',
    lbl_countdown: 'Cuenta Atrás',
    lbl_attack: 'Atacar',
    lbl_actions: 'Acciones',
    lbl_id: 'ID',
    lbl_coords: 'Coords',
    lbl_cats: 'Catas',
    lbl_requirements: 'Requisitos',
    mt_no_reqs: 'Sin requisitos todavía — añade uno abajo.',
    mt_reqs_hint: 'Una fila por ataque. El jugador debe coincidir con “Mi Jugador” para que Auto-Generar lo tenga en cuenta. Origen es la coordenada X|Y que fija la aldea emisora (opcional).',
    mt_count: 'Cantidad (tamaño del tren de nobles)',
    mt_src: 'orig',
    mt_src_title: 'Coordenada de aldea de origen X|Y — fija qué aldea envía este ataque (opcional)',
    lbl_points: 'Puntos',

    // Select options
    opt_off: 'Off (Arietes)',
    opt_fake: 'Fake (1 esp/1 ariete)',
    opt_snob: 'Noble (Tren de nobles)',
    lbl_speed: 'Velocidad (horario)',
    opt_speed_auto: 'Auto (según tipo)',
    opt_speed_axe: 'Hacha (18)',
    opt_speed_sword: 'Espada (22)',
    opt_speed_lc: 'Caballería Ligera (10)',
    opt_target_off: 'Off',
    opt_target_fake: 'Fake',

    // Placeholders
    ph_filter: 'Filtrar\u2026',
    ph_db_search: 'Buscar por nombre, ID o jugador\u2026',
    ph_off_paste: 'Pega el BB-code aquí\u2026',

    // Empty states
    empty_attacks: 'No hay ataques planificados. Haz clic en \u201c+ Añadir Ataque\u201d para comenzar.',
    empty_attacks_filtered: 'Ningún ataque coincide con los filtros.',
    empty_villages: 'No hay pueblos añadidos.',
    empty_targets: 'No hay objetivos añadidos.',
    empty_db: 'Conecta una carpeta BD para cargar los datos.',
    db_not_connected: 'Sin carpeta conectada',

    // DB
    db_showing: 'Mostrando 200 de {total}',
    db_error_loading: 'Error al cargar archivos',
    db_web_updated: '— carga automática del espejo web (actualizado {ts})',
    db_web_failed: 'No se pudieron cargar los datos del mapa desde la web — recarga la página para reintentar.',
    db_no_data: 'Sin datos cargados.',
    empty_no_results: 'Sin resultados.',

    // Countdown statuses
    status_sent: 'ENVIADO',
    status_send_now: '¡ENVIAR AHORA!',
    status_late: 'TARDE',

    // Alerts & confirms
    alert_invalid_json: 'Archivo JSON inválido.',
    alert_already_target: 'Este pueblo ya está en tu lista de objetivos.',
    alert_no_db: 'No hay BD cargada. Conecta una carpeta en la pestaña Base de Datos.',
    alert_enriched: '{n} objetivo(s) completado(s).',
    alert_coords_required: 'Las coordenadas son obligatorias.',
    alert_no_my_player: 'Primero indica “Mi Jugador” en la barra superior.',
    alert_delete_village: '¿Eliminar este pueblo?',
    alert_delete_target: '¿Eliminar este objetivo?',
    alert_delete_attack: '¿Eliminar este ataque?',
    alert_delete_all: '¿ELIMINAR TODOS los ataques? Esta acción no se puede deshacer.',
    alert_clear_sent: '¿Eliminar todos los ataques enviados?',
    alert_clear_villages: '¿ELIMINAR TODOS los pueblos? Esta acción no se puede deshacer.',
    alert_clear_targets: '¿ELIMINAR TODOS los objetivos? Esta acción no se puede deshacer.',
    alert_no_targets_found: 'No se encontraron objetivos. Comprueba el formato.',
    alert_off_imported: 'Obj. off: {added} añadidos, {updated} actualizados.',
    alert_plan_imported: 'Plan por jugador: {added} objetivo(s) añadidos, {updated} actualizados — requisitos para {players} jugador(es): {senders}.\nPon "Mi Jugador" con tu nombre exacto (arriba) y usa Auto-Generar para asignar tus pueblos.',
    alert_plan_date: 'Fecha de llegada {date} — pre-rellenada en Auto-Generar.',
    alert_fake_imported: 'Obj. fake: {added} añadidos, {skipped} omitidos.',
    alert_no_targets: 'No hay objetivos. Importa primero los objetivos.',
    alert_no_villages: 'No hay pueblos. Añade primero tus pueblos.',
    alert_pick_date: 'Selecciona una fecha de llegada.',
    alert_no_attacks_generated: 'No se pudieron generar ataques.\nComprueba que los pueblos tienen tropas y los objetivos tienen requisitos.',
    alert_generated: 'Generados {total} ataques:\n\u2022 {offs} off(s)\n\u2022 {snobs} tren(es) de nobles\n\u2022 {fakes} fake(s)',
    alert_generated_unassigned: '\n\n\u26a0 {n} requisito(s) sin asignar \u2014 mostrados como filas rojas en Mi Plan.',
    alert_select_from: 'Selecciona un pueblo de origen.',
    alert_select_target: 'Selecciona un objetivo.',
    alert_set_landing: 'Establece una hora de llegada.',
    alert_no_attacks_export: 'No hay ataques para exportar.',
    alert_bm_copied: '¡Código del script copiado al portapapeles!',
    alert_invalid_format: 'Formato inválido \u2014 se esperaba {villages: [...]}',
    alert_import_villages_ok: 'Importación completa: {added} añadidos, {updated} actualizados.',
    alert_parse_error: 'No se pudo parsear el JSON: ',
  }
};

let currentLang = 'en';

function t(key) {
  return (LANG[currentLang] && LANG[currentLang][key] !== undefined)
    ? LANG[currentLang][key]
    : (LANG.en[key] !== undefined ? LANG.en[key] : key);
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.body.dataset.lang = currentLang;
  updateLangButtons();
}

function updateLangButtons() {
  ['en', 'es'].forEach(l => {
    const btn = document.getElementById('lang-btn-' + l);
    if (btn) btn.classList.toggle('lang-active', l === currentLang);
  });
}

function changeLang(lang) {
  currentLang = lang;
  DATA.settings.lang = lang;
  saveData();
  applyTranslations();
  renderAll();
}

