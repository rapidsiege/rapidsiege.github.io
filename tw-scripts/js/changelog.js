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
// ⚠ Only the CURRENT major (v6.x) lives here — v5.x and older were moved to
// js/changelog-archive.js (v5.x on 2026-09-24, v4.x on 2026-08-02, older on 2026-07-24) and are
// concatenated below, so the rendered Changelog tab is unchanged. When v7.0.0 lands, move the
// v6 entries into the archive and start this array fresh.
// ══════════════════════════════════════════════════════════════
const CHANGELOG_CURRENT = [
  { ver: 'v6.1.0', date: '2026-10-04',
    en: [
      `<b>💾 Offensive plan slots (Plan Offensive).</b> Offensive plans now live in <b>save slots</b> — "Offensive 1", "Offensive 2", … — picked from a selector above the plan settings. The usual flow (load files → set targets → Generate Plan) fills the selected slot; <b>➕ New offensive</b> starts an empty second one next to it: change the targets, windows or settings and Generate Plan again — the engine only uses what the <b>other offensives left free</b>: an off sent there stays sent, nobles already on a train are gone, catapults already sending come off the budget, launch villages held for a noble stay held, and their senders don't fake here either. The hint line says how much the other offensives hold; the off counts footer gets an "in other offensives" bucket. Slots are frozen snapshots (their rows keep their own windows and dates), so reshaping the window groups for the next offensive never touches an earlier one. Rename a slot inline, delete it to free its villages; Export Unused Offs and Export Coordinates work across every offensive. Existing saves become "Offensive 1".`,
      `<b>Manage Offensive — all offensives together.</b> With two or more slots an <b>Offensive</b> selector in the header shows <b>All offensives</b> merged (rows aimed at the same target sit together, each row tagged with its slot) or one offensive alone; the incoming orders are matched against whatever is shown. The map and the exports follow the slot selected in Plan Offensive.`,
    ],
    es: [
      `<b>💾 Ranuras de plan ofensivo (Planear Ofensiva).</b> Los planes ofensivos viven ahora en <b>ranuras de guardado</b> — "Ofensiva 1", "Ofensiva 2", … — elegidas desde un selector sobre los ajustes del plan. El flujo de siempre (cargar archivos → fijar objetivos → Generar Plan) rellena la ranura seleccionada; <b>➕ Nueva ofensiva</b> abre una segunda vacía a su lado: cambia los objetivos, las ventanas o los ajustes y vuelve a Generar Plan — el motor solo usa lo que las <b>demás ofensivas dejaron libre</b>: un off enviado allí sigue enviado, los nobles ya en un tren se han ido, las catapultas que ya envían se descuentan del presupuesto, las aldeas de lanzamiento retenidas para un noble siguen retenidas, y sus remitentes tampoco hacen fakes aquí. La línea de ayuda dice cuánto retienen las demás ofensivas; el pie de recuento de offs gana una categoría "en otras ofensivas". Las ranuras son instantáneas congeladas (sus filas conservan sus ventanas y fechas), así que reorganizar los grupos de ventanas para la siguiente ofensiva nunca toca una anterior. Renombra una ranura en línea, bórrala para liberar sus aldeas; Exportar Offs Sin Usar y Exportar Coordenadas funcionan sobre todas las ofensivas. Los guardados existentes pasan a ser "Ofensiva 1".`,
      `<b>Gestionar Ofensiva — todas las ofensivas juntas.</b> Con dos o más ranuras, un selector <b>Ofensiva</b> en la cabecera muestra <b>Todas las ofensivas</b> fusionadas (las filas al mismo objetivo van juntas, cada fila etiquetada con su ranura) o una sola ofensiva; las órdenes entrantes se cotejan con lo que se muestra. El mapa y las exportaciones siguen la ranura seleccionada en Planear Ofensiva.`,
    ],
  },
  { ver: 'v6.0.4', date: '2026-10-04',
    en: [
      `<b>🏛 Buildings (Offensive Targets).</b> A new button left of Filter / Columns / Edit Selected Rows opens a popup with two checkbox columns: <b>Catapult target buildings</b> (what the per-attack picker of the Catapults column offers) and <b>Offensive target building</b> (what the Catapult Mode dropdown and its Edit Selected Rows buttons offer). Every building catapults can hit is available — Headquarters, Barracks, Stable, Workshop, Church, Watchtower, Academy, Smithy, Rally Point, Statue, Market, Timber Camp, Clay Pit, Iron Mine, Farm, Warehouse, Wall — and the defaults are exactly today's lists. A row already using a building you untick keeps it and still lists it in its own dropdown; the popup shows how many rows use each building. Remembered with the offensive plan; ↺ Reset defaults restores the original lists.`,
    ],
    es: [
      `<b>🏛 Edificios (Objetivos Ofensivos).</b> Un botón nuevo a la izquierda de Filtro / Columnas / Editar Filas Seleccionadas abre una ventana con dos columnas de casillas: <b>Edificios objetivo de catapulta</b> (lo que ofrece el selector por ataque de la columna Catapultas) y <b>Edificio objetivo de la ofensiva</b> (lo que ofrecen el desplegable Modo Catapulta y sus botones de Editar Filas Seleccionadas). Están todos los edificios que las catapultas pueden golpear — Edificio Principal, Cuartel, Cuadra, Taller, Iglesia, Torre de vigilancia, Academia, Herrería, Plaza de Reuniones, Estatua, Mercado, Leñador, Barrera, Mina de Hierro, Granja, Almacén, Muralla — y por defecto están marcados exactamente los de hoy. Una fila que ya usa un edificio que desmarques lo conserva y sigue listándolo en su propio desplegable; la ventana muestra cuántas filas usan cada edificio. Se recuerda con el plan ofensivo; ↺ Restablecer vuelve a las listas originales.`,
    ],
  },
  { ver: 'v6.0.3', date: '2026-10-04',
    en: [
      `<b>📊 Available Defense (filtered).</b> A third summary table under Plan Defense: the leftover defense <b>another plan could still draw on</b>. A village only counts while it could still send right now — it passes every sender hold (Ignore Coordinates / Players, the map-drawn area, the enemy-tribe radius, Ignore Village with Knight, the sender min def pop), lies inside the Def min/max distance of at least one target and, with the same-tribe rule on, shares a tribe with a target. The existing <b>Available Defense</b> table keeps showing everything left at home, holds included.`,
      `<b>▸ Collapsible summaries.</b> <b>Support per Player</b>, <b>Available Defense</b> and the new filtered table fold into click-to-open panels (collapsed by default — they're tall); the header line keeps the headline (players listed / def pop left), and the panels you open stay open across reloads.`,
      `<b>🏷 Tribes in the summaries.</b> When the loaded troop file spans two or more tribes, a <b>Tribes</b> selector above the summaries shows them <b>combined</b>, <b>separated</b> (one block per tribe, each with its own Total) or <b>one tribe only</b> — on es100 / es103 support can't cross tribes, so mixed numbers were misleading. With a single tribe nothing changes.`,
      `<b>🎚 Support only within the same tribe</b> — new Plan Defense parameter, <b>on</b> by default (the rule the engine always applied: both sides resolved in the world DB, same tag or the pair is barred). Switch it <b>off</b> on worlds that allow cross-tribe support: any target may then be supported and the "tribe unresolved" warnings go quiet.`,
    ],
    es: [
      `<b>📊 Defensa Disponible (filtrada).</b> Una tercera tabla resumen bajo Planificar Defensa: la defensa sobrante de la que <b>otro plan aún podría tirar</b>. Una aldea solo cuenta mientras aún podría enviar ahora mismo — pasa todos los filtros de remitente (Ignorar Coordenadas / Jugadores, el área dibujada en el mapa, el radio de tribus enemigas, Ignorar Pueblo con Paladín, la granja def. mín. del remitente), está dentro de la distancia def. mín./máx. de al menos un objetivo y, con la regla de misma tribu activa, comparte tribu con un objetivo. La tabla <b>Defensa Disponible</b> de siempre sigue mostrando todo lo que queda en casa, filtros incluidos.`,
      `<b>▸ Resúmenes plegables.</b> <b>Apoyo por Jugador</b>, <b>Defensa Disponible</b> y la nueva tabla filtrada se pliegan en paneles que se abren con un clic (cerrados por defecto — son altos); la línea de cabecera conserva el titular (jugadores listados / pob. def. libre), y los paneles que abras se quedan abiertos entre recargas.`,
      `<b>🏷 Tribus en los resúmenes.</b> Cuando el archivo de tropas cargado abarca dos o más tribus, un selector <b>Tribus</b> sobre los resúmenes las muestra <b>juntas</b>, <b>separadas</b> (un bloque por tribu, cada uno con su Total) o <b>una sola tribu</b> — en es100 / es103 el apoyo no puede cruzar tribus, así que los números mezclados confundían. Con una sola tribu nada cambia.`,
      `<b>🎚 Apoyo solo dentro de la misma tribu</b> — nuevo parámetro de Planificar Defensa, <b>activado</b> por defecto (la regla que el motor siempre aplicó: ambos lados resueltos en la BD del mundo, misma etiqueta o el par queda vetado). Desactívalo en mundos que permiten apoyo entre tribus: entonces se puede apoyar cualquier objetivo y los avisos de "tribu sin resolver" se callan.`,
    ],
  },
  { ver: 'v6.0.2', date: '2026-10-04',
    en: [
      `<b>🏰 Rally Point and Warehouse as catapult objectives.</b> Both buildings join the <b>Catapult Mode</b> dropdown (the building this target's off senders aim at — now Smithy / Farm / Rally Point / Warehouse / Wall; POWER still forces Wall) and the per-attack building picker of the <b>Catapults</b> column (Smithy / Farm / Rally Point / Warehouse / Timber Camp / Clay Pit / Iron Mine). The Edit Selected Rows modal offers them too, and they show up in the plan and every export like the other buildings.`,
    ],
    es: [
      `<b>🏰 Plaza de Reuniones y Almacén como objetivos de catapulta.</b> Ambos edificios se suman al desplegable <b>Modo Catapulta</b> (el edificio al que apuntan los remitentes de off de este objetivo — ahora Herrería / Granja / Plaza de Reuniones / Almacén / Muralla; POWER sigue forzando Muralla) y al selector de edificios por ataque de la columna <b>Catapultas</b> (Herrería / Granja / Plaza de Reuniones / Almacén / Leñador / Barrera / Mina de Hierro). El modal Editar Filas Seleccionadas también los ofrece, y aparecen en el plan y en todas las exportaciones como los demás edificios.`,
    ],
  },
  { ver: 'v6.0.1', date: '2026-10-03',
    en: [
      `<b>🐴 Ignore Village with Knight (Plan Defense).</b> A new checkbox next to <b>Prioritize Sending From Far Villages</b>: when on, any of your villages that <b>owns a knight</b> keeps all its defense home — it leaves the sender pool entirely (so it doesn't inflate its player's capacity share either), whether the knight is home or out. Ownership is read from the village's own troop row; a village that merely hosts another player's knight is not affected. Remembered with the rest of the defensive plan.`,
      `<b>📊 Available Defense.</b> Below <b>Support per Player</b> a second table lists, per player, the defense left <b>unassigned</b> after the plan — available minus sending for each unit, plus its total def pop — closed by a Total row. It follows the same availability rules as the table above (defense at home or incoming only, never above the village's own troops; owned troops when the file has no garrison data).`,
    ],
    es: [
      `<b>🐴 Ignorar Pueblo con Paladín (Planificar Defensa).</b> Una casilla nueva junto a <b>Priorizar Envío Desde Aldeas Lejanas</b>: activada, cualquier pueblo tuyo que <b>posea un paladín</b> se queda toda su defensa en casa — sale por completo del grupo de remitentes (así tampoco infla la cuota de capacidad de su jugador), esté el paladín en casa o fuera. La propiedad se lee de la propia fila de tropas del pueblo; un pueblo que solo aloja el paladín de otro jugador no se ve afectado. Se recuerda con el resto del plan defensivo.`,
      `<b>📊 Defensa Disponible.</b> Debajo de <b>Apoyo por Jugador</b>, una segunda tabla lista, por jugador, la defensa que queda <b>sin asignar</b> tras el plan — disponible menos enviado por cada unidad, más su población defensiva total — cerrada por una fila Total. Sigue las mismas reglas de disponibilidad que la tabla de arriba (solo defensa en casa o en camino, nunca por encima de las tropas propias del pueblo; tropas que posee cuando el archivo no tiene datos de guarnición).`,
    ],
  },
  { ver: 'v6.0.0', date: '2026-09-24',
    en: [
      `<b>🎚 Parameters.</b> A new <b>⚙ Settings → 🎚 Parameters</b> tab collects every threshold, default and limit the tool used to carry as a fixed number — 45 of them — so a tribe can tune the planners to its own doctrine without touching the code. Among them: the catapults an off needs to count as a destroyer's clearing off (101), the distance lead and per-village cap of the extra catapult attacks, the default nobles / catapult attacks of a new target, how many launch villages a noble sender keeps back and how big they must be, the Smithy level that makes a village snob-capable, the escort tier, whether a missing off tier may be filled by a stronger one, the size and source tier of fakes, the roster-balance weight, the small-garrison and packet floors of Plan Defense, the spy reserve per ram, the Snip / Support Packs defaults, the PM bracket budget, what the matchers treat as a fake, the Outbound Offs axe rule, the off / def village classification ratio, a departure safety margin and the server-offset fallback. The <b>Offensive Power Thresholds</b> moved here too. Rows in gold differ from their default; ↺ restores one, <b>Reset all</b> restores everything; values persist and ride along in the Export Data backup.`,
      `<b>🎚 …and on every tab that uses them.</b> By Villages, Outbound Offs, Tribe Timings, Plan Offensive, Plan Defense, Manage Offensive and Manage Defense each open with a collapsed <b>🎚 Parameters</b> panel holding just their own subset. They are views of the same values as the central tab — edit a number on either side and every panel, table and the next plan see it at once; a badge on the panel counts the values that differ from their default.`,
      `<b>⏱ Tolerances that did not exist before.</b> Four new parameters start at 0 (= the old behaviour) and add slack where the tool was strict: minutes an incoming may land outside its plan window and still match (Manage Offensive), minutes a plan row stays pending after its latest launch moment, the per-unit tolerance and arrival grace of the Manage Defense verdicts, plus the departure safety margin above, which every "can it still make it" check honours.`,
      `<b>🔧 Fixes.</b> The Edit Selected Rows modal seeded the catapult-attack count with 5 while the row toggle used 3 — both now follow the parameter. The Ver informe send / return estimates in Village Reports assumed es100's unit speeds; they now use the selected world's.`,
    ],
    es: [
      `<b>🎚 Parámetros.</b> Una nueva pestaña <b>⚙ Config. → 🎚 Parámetros</b> reúne todos los umbrales, valores por defecto y límites que la herramienta llevaba como número fijo — 45 — para que una tribu ajuste los planificadores a su propia doctrina sin tocar el código. Entre ellos: las catapultas que necesita una off para contar como off de limpieza de un destructor (101), la ventaja de distancia y el tope por aldea de los ataques de catapultas extra, los nobles / ataques de catapultas por defecto de un objetivo nuevo, cuántas aldeas de lanzamiento reserva un remitente de nobles y qué tamaño deben tener, el nivel de herrería que hace a una aldea capaz de noblar, el tier de la escolta, si un tier de off que falta puede cubrirse con uno más fuerte, el tamaño y el tier de origen de los fakes, el peso del reparto por plantilla, los mínimos de guarnición y de paquete de Planificar Defensa, la reserva de espías por ariete, los valores por defecto de Snip / Paquetes de Apoyo, el presupuesto de corchetes del MP, lo que los comparadores consideran fake, la regla de hachas de Offs Enviadas, la proporción que clasifica una aldea como off / def, un margen de seguridad de salida y el desfase horario de reserva. Los <b>Umbrales de Poder Ofensivo</b> también se han movido aquí. Las filas en dorado difieren de su valor por defecto; ↺ restaura una, <b>Restablecer todo</b> restaura todas; los valores se guardan y viajan en la copia de Exportar Datos.`,
      `<b>🎚 …y en cada pestaña que los usa.</b> Aldeas, Offs Enviadas, Tiempos de Tribu, Planificar Ofensiva, Planificar Defensa, Gestionar Ofensiva y Gestionar Defensa abren con un panel <b>🎚 Parámetros</b> plegado que contiene solo su propio subconjunto. Son vistas de los mismos valores que la pestaña central — cambia un número en cualquiera de los dos sitios y todos los paneles, tablas y el siguiente plan lo ven al instante; una insignia en el panel cuenta los valores que difieren de su valor por defecto.`,
      `<b>⏱ Tolerancias que antes no existían.</b> Cuatro parámetros nuevos empiezan en 0 (= el comportamiento anterior) y añaden holgura donde la herramienta era estricta: minutos que un ataque entrante puede llegar fuera de su ventana del plan y aun así coincidir (Gestionar Ofensiva), minutos que una fila del plan sigue pendiente tras su último momento de lanzamiento, la tolerancia por unidad y la gracia de llegada de los veredictos de Gestionar Defensa, más el margen de seguridad de salida anterior, que respetan todas las comprobaciones de «¿llega a tiempo?».`,
      `<b>🔧 Correcciones.</b> El modal Editar Filas Seleccionadas sembraba el número de ataques de catapultas con 5 mientras el interruptor de fila usaba 3 — ahora ambos siguen el parámetro. Las estimaciones de envío / regreso de Ver informe en Aldeas Enemigas asumían las velocidades de unidad de es100; ahora usan las del mundo seleccionado.`,
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
