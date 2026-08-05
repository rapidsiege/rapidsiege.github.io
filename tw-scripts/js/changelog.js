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
  { ver: 'v5.7.1', date: '2026-08-06',
    en: [
      `<b>🎯 Snip reserve now concentrates across multiple targets too.</b> With several targets drawing on a Snip Player, the plan could leave their reserve scattered over two half-drained villages instead of pooling it in one: each target preferred the sniper's least-drained village, so target 2 opened a fresh village while target 1's was still half full. A sniper's villages are now emptied most-drained-first — a village is finished before the next one is opened — so the leftover ends up in as few villages as possible, exactly as promised in v5.6.0.`,
    ],
    es: [
      `<b>🎯 La reserva Snip ahora también se concentra con varios objetivos.</b> Con varios objetivos tirando de un Jugador Snip, el plan podía dejar su reserva repartida entre dos aldeas a medio vaciar en vez de juntarla en una: cada objetivo prefería la aldea menos vaciada del sniper, así que el objetivo 2 abría una aldea nueva con la del objetivo 1 aún a medias. Las aldeas de un sniper ahora se vacían primero la más vaciada — una aldea se termina antes de abrir la siguiente — de modo que lo que queda se concentra en las menos aldeas posibles, tal y como prometía la v5.6.0.`,
    ],
  },
  { ver: 'v5.7.0', date: '2026-08-05',
    en: [
      `<b>⚔ Enemy Tribes is now a picker, not a text box.</b> In <b>Defensive Targets</b>, enemy tribes are chosen from a dropdown of every tribe in the village database, <b>biggest first by total points</b> (each option shows its points), and added as chips like Ignore / Complete / Snip Players. No more typing a tag and hoping it matches — and no more silent misses from a typo, a trailing space, or two tribes with confusingly similar tags.`,
      `<b>⚔ Tribes are remembered by ID, so renames can't break your filter.</b> A picked tribe is stored by its database ID instead of its tag or name, so when a tribe renames or re-tags mid-war the filter keeps working and the chip just shows the new name. Anything you typed in the old box is converted automatically the moment the database loads; whatever matches no tribe stays visible with a Discard button instead of vanishing, and Generate Defense tells you it isn't filtering anything.`,
    ],
    es: [
      `<b>⚔ Tribus Enemigas ahora es un selector, no una caja de texto.</b> En <b>Objetivos Defensivos</b>, las tribus enemigas se eligen de un desplegable con todas las tribus de la base de datos de aldeas, <b>de mayor a menor por puntos totales</b> (cada opción muestra sus puntos), y se añaden como fichas igual que Ignorar / Completos / Snip. Se acabó escribir un tag y cruzar los dedos — y se acabaron los fallos silenciosos por una errata, un espacio de más o dos tribus con tags casi idénticos.`,
      `<b>⚔ Las tribus se guardan por ID, así que un renombre no te rompe el filtro.</b> Una tribu elegida se guarda por su ID de la base de datos en vez de por su tag o nombre, así que si una tribu se renombra o se cambia el tag en plena guerra el filtro sigue funcionando y la ficha simplemente muestra el nombre nuevo. Lo que tuvieras escrito en la caja antigua se convierte solo en cuanto carga la base de datos; lo que no coincida con ninguna tribu se queda a la vista con un botón Descartar en vez de desaparecer, y Generar Defensa te avisa de que no está filtrando nada.`,
    ],
  },
  { ver: 'v5.6.0', date: '2026-08-05',
    en: [
      `<b>🎯 Snip Players — keep free defense at home.</b> A new picker in <b>Defensive Targets</b>, the mirror image of 💯 Complete Players: pick whole players who must always have defense ready to snipe or react. Plan Defense draws from them <b>last</b> — Complete Players, then everyone else's home defense, then everyone else's returning troops, and only then the snipers. A player can't be on both lists (draining 100% and keeping a reserve are opposites), and the picker says so.`,
      `<b>🎯 A reserve that is actually reserved.</b> Two new fields in <b>Plan Defense</b>: <b>Snip reserve %</b> (default 35) is the share of a sniper's available defense that stays home, and <b>Snip max distance</b> (default 100 fields) is how far out that reserve is respected — a target beyond it may drain the village fully, because a snipe reserve is only worth keeping for the theatre it can reach. Scouts never count toward the reserve. The budget is per player across the WHOLE plan, so ten targets can't each take "just 65%" and leave the sniper empty.`,
      `<b>🎯 One real garrison beats three slivers — and you're told when the reserve breaks.</b> A sniper's villages are drained one at a time instead of evenly, so what stays home piles up in as few villages as possible (one village at 30% is worth more than three at 10%). If nearby targets simply can't be covered any other way the plan still ships the troops — coverage always wins — but it warns per player with the exact amount and pops one alert at the end, so a dry sniper is never a surprise.`,
    ],
    es: [
      `<b>🎯 Jugadores Snip — defensa libre en casa.</b> Nuevo selector en <b>Objetivos Defensivos</b>, la imagen especular de 💯 Jugadores Completos: elige jugadores enteros que deben tener defensa siempre lista para snipear o reaccionar. El Plan de Defensa tira de ellos <b>el último</b> — Jugadores Completos, luego la defensa en casa de todos los demás, luego las tropas que vuelven de todos los demás, y solo entonces los snipers. Un jugador no puede estar en las dos listas (vaciar el 100% y guardar reserva son opuestos), y el selector lo avisa.`,
      `<b>🎯 Una reserva que se reserva de verdad.</b> Dos campos nuevos en el <b>Plan de Defensa</b>: <b>% reserva Snip</b> (35 por defecto) es la parte de la defensa disponible del sniper que se queda en casa, y <b>Distancia máx. Snip</b> (100 campos por defecto) es hasta dónde se respeta esa reserva — un objetivo más lejano sí puede vaciar la aldea del todo, porque una reserva de snip solo vale para el frente al que llega a tiempo. Los exploradores nunca cuentan para la reserva. El presupuesto es por jugador y para TODO el plan, así que diez objetivos no pueden llevarse "solo el 65%" cada uno y dejar al sniper a cero.`,
      `<b>🎯 Una guarnición de verdad vale más que tres migajas — y te avisamos si se rompe la reserva.</b> Las aldeas de un sniper se vacían de una en una en vez de a partes iguales, así que lo que queda en casa se concentra en las menos aldeas posibles (una aldea al 30% vale más que tres al 10%). Si los objetivos cercanos no se pueden cubrir de otra forma, el plan envía las tropas igualmente — la cobertura siempre gana — pero avisa por jugador con la cantidad exacta y lanza una alerta al final, para que un sniper seco nunca sea una sorpresa.`,
    ],
  },
  { ver: 'v5.5.0', date: '2026-08-04',
    en: [
      `<b>🎨 Tribe Colors gets its own toolbar button.</b> The tribe color-groups panel (customize which tribes get which color on the map) used to sit permanently in the map's top-right corner — and still went unnoticed. It now opens on demand from a new <b>🎨 Tribe Colors</b> toolbar button (with a ✕ to close), so filtering and coloring tribes is one click away.`,
      `<b>🧹 Leaner map toolbar.</b> The Zoom In / Zoom Out / Reset View buttons are gone — the mouse wheel and drag already do it better. And <b>Heatmap Config is now called Map Enhancements</b>: it long ago outgrew heatmaps (plan overlays, report badges, off-power tiers…).`,
    ],
    es: [
      `<b>🎨 Colores de Tribu tiene su propio botón en la barra.</b> El panel de grupos de color (personaliza qué tribus llevan qué color en el mapa) vivía fijo en la esquina superior derecha del mapa — y aun así pasaba desapercibido. Ahora se abre bajo demanda con el nuevo botón <b>🎨 Colores de Tribu</b> (con ✕ para cerrar), así que filtrar y colorear tribus queda a un clic.`,
      `<b>🧹 Barra del mapa más limpia.</b> Los botones Acercar / Alejar / Restablecer vista desaparecen — la rueda del ratón y el arrastre ya lo hacen mejor. Y <b>Config Mapa de Calor pasa a llamarse Mejoras del Mapa</b>: hace tiempo que va mucho más allá de los mapas de calor (capas de planes, insignias de informes, niveles de poder ofensivo…).`,
    ],
  },
  { ver: 'v5.4.3', date: '2026-08-03',
    en: [
      `<b>🕐 Report times now match the in-game report exactly.</b> Report timestamps turn out to already BE the server wall-clock as shown on the game page (the exporter stores that string as-is), so v5.4.2's timezone conversion shifted them +2h — and the old device-clock rendering was equally off. The stored time is now shown back 1:1: battle time, Send ≈ and Return ≈ read exactly like the in-game report from any device, and timezone/DST changes never need any handling. The twstats report views shared the same bug since they shipped and are fixed the same way.`,
    ],
    es: [
      `<b>🕐 Las horas de los informes ahora coinciden exactamente con el informe del juego.</b> Resulta que las marcas de tiempo YA SON la hora del servidor tal y como aparece en la página del juego (el exportador guarda esa cadena tal cual), así que la conversión de zona horaria de la v5.4.2 las desplazaba +2h — y el renderizado anterior con el reloj del dispositivo estaba igual de mal. La hora guardada se muestra ahora 1:1: la hora de batalla, Envío ≈ y Regreso ≈ se leen exactamente como en el informe del juego desde cualquier dispositivo, y los cambios de hora (verano/invierno) nunca necesitan tratamiento. Las vistas de informes de twstats compartían el mismo fallo desde su estreno y quedan corregidas igual.`,
    ],
  },
  { ver: 'v5.4.2', date: '2026-08-03',
    en: [
      `<b>🕐 Report times are always server time.</b> Battle time and the derived Send ≈ / Return ≈ in the report modal were formatted with your device's clock — correct only while your device sits in the server's timezone. They now always render in the world's server time (es100 = Spanish time), no matter where you open the tool from. The "Last" age tooltip in Enemy Villages shows server time too (it was UTC). The twstats report views share the renderer, so they're fixed the same way.`,
    ],
    es: [
      `<b>🕐 Las horas de los informes son siempre hora del servidor.</b> La hora de batalla y las derivadas Envío ≈ / Regreso ≈ del modal de informe se formateaban con el reloj de tu dispositivo — correcto solo mientras tu dispositivo esté en la zona horaria del servidor. Ahora se muestran siempre en hora del servidor del mundo (es100 = hora española), desde donde sea que abras la herramienta. El tooltip de antigüedad "Último" en Aldeas Enemigas también muestra hora del servidor (era UTC). Las vistas de informes de twstats comparten el renderizador, así que quedan corregidas igual.`,
    ],
  },
  { ver: 'v5.4.1', date: '2026-08-03',
    en: [
      `<b>🐛 Report modal now renders exactly like twstats.</b> The calculator's own dark table theme was leaking into the in-game report (tan text instead of black, UPPERCASE right-aligned headers, and the subject line refusing to wrap — which pushed the report past the modal's edge). The report's tables are now fully shielded from the surrounding theme.`,
    ],
    es: [
      `<b>🐛 El modal de informe ahora se ve exactamente como en twstats.</b> El tema oscuro de las tablas de la calculadora se colaba en el informe (texto tostado en vez de negro, cabeceras en MAYÚSCULAS alineadas a la derecha, y el asunto sin poder partirse en líneas — lo que empujaba el informe fuera del borde del modal). Las tablas del informe quedan ahora totalmente aisladas del tema circundante.`,
    ],
  },
  { ver: 'v5.4.0', date: '2026-08-03',
    en: [
      `<b>📄 View the full report from Enemy Villages.</b> Each village's second row now carries a <b>View report</b> link that opens the stored report rendered like in the game — subject, battle time, luck + morale, attacker/defender troop tables, espionage (resources + buildings) and units outside, plus the derived <b>Send ≈ / Return ≈</b> times. It shows the newest report on the village and the biggest attack it ever sent, from the shared full-report DB (hosted version only; loaded on first click). Strictly current-owner: a village that changed hands shows nothing from the previous owner — everything resets on a conquest. Same renderer as the twstats Entrantes page, so the two always match.`,
    ],
    es: [
      `<b>📄 Ver el informe completo desde Aldeas Enemigas.</b> La segunda fila de cada aldea lleva ahora un enlace <b>Ver informe</b> que abre el informe guardado renderizado como en el juego — asunto, hora de batalla, suerte + moral, tablas de tropas de atacante/defensor, espionaje (recursos + edificios) y unidades fuera, más las horas derivadas de <b>Envío ≈ / Regreso ≈</b>. Muestra el informe más reciente sobre la aldea y el mayor ataque que haya enviado, desde la BD compartida de informes completos (solo versión alojada; se carga al primer clic). Estrictamente del dueño actual: una aldea que cambió de manos no muestra nada del dueño anterior — todo se resetea con la conquista. Mismo renderizador que la página Entrantes de twstats, así que siempre coinciden.`,
    ],
  },
  { ver: 'v5.3.1', date: '2026-08-03',
    en: [
      `<b>🗺 Old-owner intel trimmed on the map hover.</b> When a village changed hands after its last report, the hover card no longer shows the previous owner's troops (in village / outside / sent) — everything resets on a conquest. The spied <b>building levels</b> survive the new owner, so that block stays.`,
    ],
    es: [
      `<b>🗺 La info del dueño anterior se recorta en el hover del mapa.</b> Cuando una aldea cambió de dueño después de su último informe, la tarjeta ya no muestra las tropas del dueño anterior (en la aldea / fuera / enviadas) — todo se resetea con la conquista. Los <b>niveles de edificios</b> espiados sobreviven al nuevo dueño, así que ese bloque se queda.`,
    ],
  },
  { ver: 'v5.3.0', date: '2026-08-03',
    en: [
      `<b>🛡 Plan Defense: spies stopped being confetti.</b> Spies only screen a village against enemy scouting — they add nothing to raw defense — so they no longer ride the spread-and-balance allocation that dribbled 1-spy orders across the whole tribe. Spy support now concentrates on few senders: <b>every spy order carries at least ~50 spies</b> (an ask smaller than that ships as one single order), a village too spy-poor to form such an order keeps its scouts home, and leftover sub-50 tails are dropped silently instead of spraying new mini-orders.`,
      `<b>🐏 Spies reserved for fakes.</b> Every village now keeps as many spies home as it has rams — they leave together later as [spy]+[ram] fakes, so the planner never assigns them as support. Reserved spies are invisible to the whole allocation (sender pool, capacity weights, per-player summary).`,
      `<b>💯 Complete Players drain fully first.</b> New fill order: Complete players' home defense → their returning troops → everyone else's home defense → everyone else's returning troops. Before, a Complete player's returning troops waited until everyone's at-home defense had been used.`,
    ],
    es: [
      `<b>🛡 Planificar Defensa: los espías dejan de ser confeti.</b> Los espías solo protegen una aldea del espionaje enemigo — no aportan nada a la defensa real — así que ya no pasan por el reparto equilibrado que regaba órdenes de 1 espía por toda la tribu. El apoyo de espías ahora se concentra en pocos remitentes: <b>cada orden de espías lleva al menos ~50</b> (una petición menor sale en una sola orden), una aldea sin espías suficientes para formar una orden así se los queda en casa, y los restos de menos de 50 se descartan en silencio en vez de generar nuevas mini-órdenes.`,
      `<b>🐏 Espías reservados para fakes.</b> Cada aldea se queda ahora en casa tantos espías como arietes tenga — saldrán juntos más tarde como fakes [espía]+[ariete], así que el planificador nunca los asigna como apoyo. Los espías reservados son invisibles para todo el reparto (pool de remitentes, pesos de capacidad, resumen por jugador).`,
      `<b>💯 Los Jugadores Completos se vacían del todo primero.</b> Nuevo orden de llenado: defensa en casa de los Completos → sus tropas que vuelven → defensa en casa del resto → tropas que vuelven del resto. Antes, las tropas que vuelven de un Jugador Completo esperaban a que se usara la defensa en casa de todos.`,
    ],
  },
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
