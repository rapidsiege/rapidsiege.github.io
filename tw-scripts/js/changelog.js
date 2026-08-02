// ══════════════════════════════════════════════════════════════
// CHANGELOG (current major + renderer)
// ──────────────────────────────────────────────────────────────
// Classic <script src> (NOT a module / not fetched) so it works under file://
// in dev and over https in prod with zero CORS. The big HTML file stays small:
// on a version bump, add ONE entry at the TOP of CHANGELOG_CURRENT below
// (newest first) and bump the footer/#app-version — no need to touch the
// static markup.
//
// Each entry: { ver, date, tagEn?, tagEs?, en:[<li> inner HTML…], es:[…] }.
// Strings are template literals so the HTML's ' and " need no escaping. Keep the
// en[] and es[] arrays the same length (one bullet each). renderChangelog() builds
// the cards into #cl-list-host and is called on load + on every language switch.
//
// ⚠ Only the CURRENT major (v5.x) lives here — v4.x and older were moved to
// js/changelog-archive.js (v4.x on 2026-08-02, older on 2026-07-24) and are concatenated below, so the
// rendered Changelog tab is unchanged. When v6.0.0 lands, move the v5 entries
// into the archive and start this array fresh.
// ══════════════════════════════════════════════════════════════
const CHANGELOG_CURRENT = [
  { ver: 'v5.2.2', date: '2026-08-02',
    en: [
      `<b>🐛 Fully-emptied villages now show their away troops on the hover card.</b> A spied village with its whole garrison out supporting (zero units at home) rendered only its Buildings — the "Units outside" block was skipped whenever home troops were missing. Two fixes: the card's sections now render independently, and a spied report with no troops row is stored as a <b>known-empty garrison</b> ("no units seen" · the spy proves it) instead of unknown. The shared DB was rebuilt so already-uploaded reports pick this up.`,
    ],
    es: [
      `<b>🐛 Las aldeas totalmente vaciadas ahora muestran sus tropas fuera en la tarjeta.</b> Una aldea espiada con toda su guarnición fuera apoyando (cero unidades en casa) solo mostraba sus Edificios — el bloque "Unidades fuera" se omitía cuando faltaban las tropas en casa. Dos arreglos: las secciones de la tarjeta ahora se muestran de forma independiente, y un informe espiado sin fila de tropas se guarda como <b>guarnición confirmada vacía</b> ("sin unidades vistas" · el espionaje lo demuestra) en vez de desconocida. La BD compartida se reconstruyó para que los informes ya subidos lo reflejen.`,
    ],
  },
  { ver: 'v5.2.1', date: '2026-08-02',
    en: [
      `<b>🗺 Report hover card now renders like the own-village blocks.</b> Live feedback on v5.2.0: "Troops in village", "Units outside" and "Sent off seen" use the same block style as your own villages' hover info — with <b>Off Power / Def Power lines</b> computed from the seen army (both shown when both exist, e.g. a spied off village's home troops get their Off Power). And the spied <b>buildings</b> section now shows exactly the five levels that matter as icons — HQ, Academy, Smithy, Farm, Wall — with a red <b>0</b> when the spy data lacks one (unbuilt/destroyed).`,
    ],
    es: [
      `<b>🗺 La tarjeta de informe ahora se muestra como los bloques de aldeas propias.</b> Feedback en vivo sobre la v5.2.0: "En la aldea", "Unidades fuera" y "Off enviado visto" usan el mismo estilo de bloque que la info de tus propias aldeas — con líneas de <b>Poder Ofensivo / Poder Defensivo</b> calculadas del ejército visto (ambas cuando existen ambas, p. ej. las tropas en casa de una aldea off espiada muestran su Poder Ofensivo). Y la sección de <b>edificios</b> espiados ahora muestra exactamente los cinco niveles que importan como iconos — Edificio Principal, Academia, Herrería, Granja, Muralla — con un <b>0</b> rojo cuando el espionaje no encontró uno (sin construir/destruido).`,
    ],
  },
  { ver: 'v5.2.0', date: '2026-08-02',
    en: [
      `<b>🗺 Report intel on the Map.</b> Villages known to the Enemy Villages reports DB (yours + the shared one) now carry an <b>OFF/DEF badge</b> on the map — axe on red / sword on blue at the bottom-right of the tile when zoomed in, red/blue halos when zoomed out. An unsure verdict (defence seen at home but away troops never seen) shows a <b>?</b> tag. The new <b>📄 Village Reports → "Show Village Reports Info"</b> toggle (ON by default) controls the icons only.`,
      `<b>📄 Report-style hover card.</b> Hovering a non-tribe village always shows its report intel (toggle or not): verdict + report age, <b>troops seen in the village</b>, <b>units outside</b> (seen / "nothing outside (spied)" / "not seen"), the <b>biggest off army it ever sent</b> (how villages that attacked you get labelled OFF — away troops and buildings unknowable there), and <b>spied building levels</b>. Villages that changed hands since the report show ⌛ OLD instead of a verdict. Spied buildings are now stored in the reports DB (they were parsed but dropped before).`,
    ],
    es: [
      `<b>🗺 Inteligencia de informes en el Mapa.</b> Las aldeas conocidas por la BD de informes de Aldeas Enemigas (la tuya + la compartida) ahora llevan una <b>insignia OFF/DEF</b> en el mapa — hacha en rojo / espada en azul abajo a la derecha de la casilla con zoom, halos rojos/azules alejado. Un veredicto inseguro (defensa vista en casa pero tropas fuera nunca vistas) muestra una etiqueta <b>?</b>. El nuevo interruptor <b>📄 Informes de Aldeas → "Mostrar info de informes"</b> (activado por defecto) controla solo los iconos.`,
      `<b>📄 Tarjeta de informe al pasar el ratón.</b> Al pasar sobre una aldea que no es de tu tribu siempre se muestra su inteligencia (con o sin el interruptor): veredicto + antigüedad del informe, <b>tropas vistas en la aldea</b>, <b>unidades fuera</b> (vistas / "nada fuera (espiado)" / "no vistas"), el <b>mayor off que haya enviado</b> (así se etiquetan OFF las aldeas que te atacaron — allí tropas fuera y edificios son incognoscibles), y <b>niveles de edificios espiados</b>. Las aldeas que cambiaron de dueño tras el informe muestran ⌛ ANTIGUO en vez de veredicto. Los edificios espiados ahora se guardan en la BD de informes (antes se parseaban pero se descartaban).`,
    ],
  },
  { ver: 'v5.1.0', date: '2026-08-02',
    en: [
      `<b>☁ Enemy Villages intel is now shared with your tribe.</b> On the hosted version, processing report JSONs also uploads them to the shared database: the server merges every member's reports (deduplicated per report) and the response confirms the result on the spot — "+N new reports, the shared DB now covers M villages". The tab shows the shared DB's size and freshness next to a 🔄 refresh button, and the table transparently blends your local store with everyone else's intel (per village, the newest observation wins; a recorded nuke launch is never displaced by a later fake). Opened locally (file://) everything keeps working offline — sharing simply stays off.`,
    ],
    es: [
      `<b>☁ La inteligencia de Aldeas Enemigas ahora se comparte con tu tribu.</b> En la versión alojada, procesar JSONs de informes también los sube a la base de datos compartida: el servidor fusiona los informes de todos los miembros (deduplicados por informe) y la respuesta confirma el resultado al momento — "+N informes nuevos, la BD compartida ya cubre M aldeas". La pestaña muestra el tamaño y frescura de la BD compartida junto a un botón 🔄 de actualizar, y la tabla combina de forma transparente tu almacén local con la inteligencia de los demás (por aldea gana la observación más reciente; un lanzamiento de nuke registrado nunca es desplazado por un fake posterior). Abierto en local (file://) todo sigue funcionando sin conexión — simplemente no se comparte.`,
    ],
  },
  { ver: 'v5.0.0', date: '2026-08-02',
    en: [
      `<b>🎯 New tab: Troops Overview → Enemy Villages.</b> Load the JSON exports produced by <b>reportsExport.js</b> (run it on the in-game Reports overview, save the tw-reports-*.json) and the tab builds a per-village intel table: the troops <b>seen in</b> each enemy village, the troops <b>seen away</b>, the biggest <b>off army it ever sent</b>, and an <b>OFF/DEF verdict</b> with an age stamp. A verdict marked <b>?</b> means the away troops were never seen — a village showing only defence at home could still be an off village whose army was outbound. Espionage counts: a scouted report with no "units outside" table <i>confirms</i> nothing was away. Reports are deduped and persist locally between sessions; own-tribe villages and current barbarians are filtered out when the world DB is loaded, and villages that changed hands since the report are marked <b>OLD</b>.`,
    ],
    es: [
      `<b>🎯 Nueva pestaña: Resumen de Tropas → Aldeas Enemigas.</b> Carga las exportaciones JSON de <b>reportsExport.js</b> (ejecútalo en la vista de Informes del juego y guarda el tw-reports-*.json) y la pestaña construye una tabla de inteligencia por aldea: las tropas <b>vistas dentro</b> de cada aldea enemiga, las tropas <b>vistas fuera</b>, el mayor <b>off que haya enviado</b>, y un <b>veredicto OFF/DEF</b> con su antigüedad. Un veredicto con <b>?</b> significa que las tropas fuera nunca se vieron — una aldea que solo muestra defensa en casa aún podría ser ofensiva con su ejército de viaje. El espionaje cuenta: un informe espiado sin tabla de "unidades fuera" <i>confirma</i> que no había nada fuera. Los informes se deduplican y persisten localmente entre sesiones; las aldeas de tu propia tribu y las bárbaras actuales se filtran cuando la BD del mundo está cargada, y las aldeas que cambiaron de dueño tras el informe se marcan como <b>ANTIGUO</b>.`,
    ],
  },
];

// Full history = current major + the frozen archive, resolved at CALL time (not at
// load time) so changelog-archive.js can load in any order relative to this file —
// keeping the "inter-file order doesn't matter" invariant the rest of the app relies
// on. The typeof guard also keeps the page working (current major only) if the
// archive ever fails to load: a deploy that copies the HTML but misses the new js/
// file must not blank the tab.
function changelogEntries() {
  return CHANGELOG_CURRENT.concat(
    typeof CHANGELOG_ARCHIVE !== 'undefined' ? CHANGELOG_ARCHIVE : []);
}

// Build the changelog cards into #cl-list-host for the current language. Called on
// load and from changeLang(). Guarded so the headless test sandbox (no host element)
// is a no-op.
function renderChangelog() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const host = document.getElementById('cl-list-host');
  if (!host) return;
  const L = (typeof lang !== 'undefined' && lang === 'es') ? 'es' : 'en';
  const footer = L === 'es'
    ? 'v1.0.x – v1.3.x — versiones iniciales (anteriores al registro de versiones).'
    : 'v1.0.x – v1.3.x — initial releases (predate version tracking).';
  const cards = changelogEntries().map(e => {
    const tag = L === 'es' ? e.tagEs : e.tagEn;
    const date = e.date + (tag ? ' · ' + tag : '');
    const items = (e[L] || e.en).map(li => `<li>${li}</li>`).join('');
    return `<div class="cl-entry"><div class="cl-head"><span class="cl-ver">${e.ver}</span>`
      + `<span class="cl-date">${date}</span></div><ul class="cl-list">${items}</ul></div>`;
  }).join('');
  host.innerHTML = cards + `<p style="font-size:12px;color:#5a3a18;margin-top:6px;">${footer}</p>`;
}
