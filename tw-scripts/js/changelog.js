// ══════════════════════════════════════════════════════════════
// CHANGELOG (data + renderer)
// ──────────────────────────────────────────────────────────────
// Classic <script src> (NOT a module / not fetched) so it works under file://
// in dev and over https in prod with zero CORS. The big HTML file stays small:
// on a version bump, add ONE entry at the TOP of CHANGELOG below (newest first)
// and bump the footer/#app-version — no need to touch the static markup.
//
// Each entry: { ver, date, tagEn?, tagEs?, en:[<li> inner HTML…], es:[…] }.
// Strings are template literals so the HTML's ' and " need no escaping. Keep the
// en[] and es[] arrays the same length (one bullet each). renderChangelog() builds
// the cards into #cl-list-host and is called on load + on every language switch.
// ══════════════════════════════════════════════════════════════
const CHANGELOG = [
  { ver: 'v3.5.0', date: '2026-06-17',
    en: [
      `<b>➡️ Attack routes drawn on the map.</b> With a <b>Plan Offensive</b> generated, each attack with a known origin now draws a faint <b>white line from the sending village to its target</b>, arrow-tipped at the target — so you can see at a glance where every blow comes from. <b>Hover a village</b> and the lines touching it light up <b>bold and bright</b> (its incoming attacks if it's a target, or where its attacks go if it's a sender). Snob trains and still-unassigned attacks have no fixed origin, so they show no line.`,
      `<b>🔵 Support routes too.</b> A <b>Plan Defense</b> now draws the same lines in <b>blue</b>, from each sending village to the village it reinforces — with the same hover highlight.`,
      `<b>New “Show Attack Lines” / “Show Support Lines” toggles</b> in the map toolbar (both off by default) turn the routes on/off independently.`,
    ],
    es: [
      `<b>➡️ Rutas de ataque dibujadas en el mapa.</b> Con un <b>Plan Ofensivo</b> generado, cada ataque con origen conocido dibuja ahora una <b>línea blanca tenue desde la aldea atacante hasta su objetivo</b>, con punta de flecha en el objetivo — para ver de un vistazo de dónde sale cada golpe. <b>Pasa el ratón por una aldea</b> y las líneas que la tocan se resaltan <b>en grueso y brillante</b> (sus ataques entrantes si es un objetivo, o adónde van sus ataques si es una atacante). Los trenes de noble y los ataques aún sin asignar no tienen origen fijo, así que no muestran línea.`,
      `<b>🔵 También las rutas de apoyo.</b> Un <b>Plan Defensivo</b> dibuja ahora las mismas líneas en <b>azul</b>, desde cada aldea emisora hasta la aldea que refuerza — con el mismo resaltado al pasar el ratón.`,
      `<b>Nuevos interruptores “Mostrar Líneas de Ataque” / “Mostrar Líneas de Apoyo”</b> en la barra del mapa (ambos desactivados por defecto) encienden/apagan las rutas de forma independiente.`,
    ],
  },
  { ver: 'v3.4.1', date: '2026-06-17',
    en: [
      `<b>🧹 Tidier tabs.</b> The old <b>“By Villages”</b> tab was removed — the <b>“Villages”</b> tab already showed everything it did and more, so it now carries the <b>Tier</b> column too (plus the in-place <b>✎ Edit</b> troops button) and has been renamed <b>“By Villages”</b>. The <b>🗺 Map</b> tab also moved up to sit right after Overview.`,
      `<b>🔵 “My tribe” now covers all your tribes.</b> When you upload troop data, the map’s auto-detected <b>“My tribe”</b> colour group now includes <b>every tribe present in the file</b>, not just the biggest one — so if you run several tribes and upload all of them, every one gets painted (you only ever have troop data for your own tribes anyway).`,
    ],
    es: [
      `<b>🧹 Pestañas más ordenadas.</b> Se quitó la antigua pestaña <b>“Por Aldea”</b> — la pestaña <b>“Aldeas”</b> ya mostraba todo lo de aquella y más, así que ahora incluye también la columna <b>Nivel</b> (y el botón <b>✎ Editar</b> tropas in situ) y pasó a llamarse <b>“Por Aldea”</b>. La pestaña <b>🗺 Mapa</b> también subió para quedar justo después de Resumen.`,
      `<b>🔵 “Mi tribu” ahora incluye todas tus tribus.</b> Al subir los datos de tropas, el grupo de color <b>“Mi tribu”</b> autodetectado en el mapa ahora incluye <b>todas las tribus presentes en el archivo</b>, no solo la más grande — así que si gestionas varias tribus y las subes todas, se pintan las aldeas de todas (de todos modos solo tienes datos de tropas de tus propias tribus).`,
    ],
  },
  { ver: 'v3.4.0', date: '2026-06-17',
    en: [
      `<b>🟢 Your offensive &amp; defensive plans, drawn on the map.</b> Once you generate a <b>Plan Offensive</b> / <b>Plan Defense</b>, each target village now shows a halo: <b>neon-green</b> over offensive objectives, <b>neon-pink</b> over support targets. Hovering an objective lists <b>“(N) Planned Attacks”</b> with each order's type (Complete, 3/4, 1/2, “4x Split Off Snobs”…) and the attacking player; hovering a support target lists <b>“(N) Planned Support”</b> with the full troop totals being sent.`,
      `<b>New map toolbar toggles.</b> <b>Show Incoming</b>, <b>Show Offensive Plan</b> and <b>Show Defensive Plan</b> (all on by default) turn their halos on/off — the hover details stay available either way. The old <b>“Bonus only / Barbs only”</b> checkboxes were removed, and the troop tooltip header was renamed <b>“Village Troops”</b>.`,
    ],
    es: [
      `<b>🟢 Tus planes ofensivo y defensivo, dibujados en el mapa.</b> Cuando generas un <b>Plan Ofensivo</b> / <b>Plan Defensa</b>, cada aldea objetivo muestra ahora un halo: <b>verde neón</b> sobre los objetivos ofensivos y <b>rosa neón</b> sobre los objetivos de apoyo. Al pasar el ratón por un objetivo aparece <b>“(N) Ataques Planificados”</b> con el tipo de cada orden (Completo, 3/4, 1/2, “4x Nobles (Partir Off)”…) y el jugador atacante; sobre un objetivo de apoyo aparece <b>“(N) Apoyo Planificado”</b> con los totales de tropas que se envían.`,
      `<b>Nuevos interruptores en la barra del mapa.</b> <b>Mostrar Entrantes</b>, <b>Mostrar Plan Ofensivo</b> y <b>Mostrar Plan Defensivo</b> (todos activados por defecto) encienden/apagan sus halos — la información al pasar el ratón sigue disponible igualmente. Se quitaron las casillas <b>“Solo bonif. / Solo bárbaros”</b> y la cabecera de tropas pasó a llamarse <b>“Tropas de la aldea”</b>.`,
    ],
  },
  { ver: 'v3.3.0', date: '2026-06-17',
    en: [
      `<b>🚨 Incoming attacks on the map.</b> If your uploaded tribe-troop file includes the new <b>“Incoming”</b> column (from the updated troop-counter script), each of your villages under attack now shows a coloured <b>heatmap halo</b> beneath it — visible without hovering. The halo <b>blooms with the attack count when zoomed out</b> (a village taking 80 hits glows far bigger than one taking 5) so you can spot hotspots from across the map, and tucks neatly under the village when zoomed in.`,
      `<b>Colour thresholds you control.</b> Three boxes in the map toolbar set when the halo turns <b>yellow / orange / red</b> (default <b>5 / 10 / 20</b> incoming); anything from 1 up shows a small white halo. Hovering a village under attack now puts <b>“(N) Incoming Attacks”</b> as the very first line of its tooltip.`,
    ],
    es: [
      `<b>🚨 Ataques entrantes en el mapa.</b> Si tu archivo de tropas incluye la nueva columna <b>“Incoming”</b> (del script contador de tropas actualizado), cada una de tus aldeas bajo ataque muestra ahora un <b>halo tipo mapa de calor</b> debajo — visible sin pasar el ratón. El halo <b>crece con el número de ataques al alejar el zoom</b> (una aldea con 80 ataques brilla mucho más que una con 5) para localizar los puntos calientes desde lejos, y se ajusta bajo la aldea al acercar el zoom.`,
      `<b>Umbrales de color configurables.</b> Tres casillas en la barra del mapa fijan cuándo el halo se vuelve <b>amarillo / naranja / rojo</b> (por defecto <b>5 / 10 / 20</b> ataques); desde 1 se muestra un pequeño halo blanco. Al pasar el ratón por una aldea bajo ataque, ahora aparece <b>“(N) Ataques recibidos”</b> como primera línea de la información.`,
    ],
  },
  { ver: 'v3.2.0', date: '2026-06-17',
    en: [
      `<b>⚔ Plan Defense — keep front-line villages off the sender list automatically.</b> New <b>“Enemy Tribes”</b> box (next to Ignore Coordinates): list enemy tribe tags or names, one per line, and set a <b>“Distance from enemy tribes”</b> in fields. Any of your villages within that distance of <b>any village owned by those tribes</b> is held home — never used to send support (just like Ignore Coordinates, but resolved automatically from the map). Tribes match by <b>tag or full name</b>; the warnings box tells you if a tribe didn't match or if the village database isn't loaded.`,
      `<b>Tidy-up:</b> the “intra-tribe support / ≥4,000 def pop / spread evenly” explanation now sits at the bottom of the Plan Defense tab instead of crowding the controls row.`,
    ],
    es: [
      `<b>⚔ Planear Defensa — mantén las aldeas de primera línea fuera de la lista de remitentes automáticamente.</b> Nueva casilla <b>“Tribus Enemigas”</b> (junto a Ignorar Coordenadas): lista tags o nombres de tribus enemigas, uno por línea, y fija una <b>“Distancia de tribus enemigas”</b> en campos. Cualquiera de tus aldeas dentro de esa distancia de <b>cualquier aldea de esas tribus</b> se queda en casa — nunca se usa para enviar apoyo (igual que Ignorar Coordenadas, pero resuelto automáticamente desde el mapa). Las tribus coinciden por <b>tag o nombre completo</b>; el cuadro de avisos te indica si una tribu no coincidió o si la base de datos de aldeas no está cargada.`,
      `<b>Orden:</b> la explicación de “apoyo dentro de la tribu / ≥4.000 pob. def. / reparto equitativo” ahora está al final de la pestaña Planear Defensa en vez de saturar la fila de controles.`,
    ],
  },
  { ver: 'v3.1.0', date: '2026-06-17',
    en: [
      `<b>👑 Per-player plan — nobles-needed lines now show the arrival time.</b> When a player is assigned a noble train but doesn't own the nobles yet, their <b>“Prepare Snob Train”</b> line in the per-player export now carries the same <b>arrival window</b> as the forum plan, so they know exactly when the train has to land.`,
      `<b>📋 Each player now gets the full objective for context.</b> Under their personal orders, the per-player export pastes the <b>complete objective(s) they're nobling</b> — every attacker hitting that target and its arrival times, numbered <b>Objective 1, 2, …</b> — so each member sees the whole plan for their target, not just their own line.`,
    ],
    es: [
      `<b>👑 Plan por jugador — las líneas de nobles pendientes ahora muestran la hora de llegada.</b> Cuando a un jugador se le asigna un tren de nobles pero aún no tiene los nobles, su línea <b>“Prepara el Tren de Nobles”</b> en la exportación por jugador ahora incluye la misma <b>ventana de llegada</b> que el plan del foro, para que sepa exactamente cuándo debe aterrizar el tren.`,
      `<b>📋 Cada jugador recibe ahora el objetivo completo como contexto.</b> Bajo sus órdenes personales, la exportación por jugador pega el <b>objetivo (u objetivos) completo que va a noblear</b> — todos los atacantes que golpean ese objetivo y sus horas de llegada, numerados <b>Objetivo 1, 2, …</b> — para que cada miembro vea el plan completo de su objetivo, no solo su propia línea.`,
    ],
  },
  { ver: 'v3.0.0', date: '2026-06-17',
    en: [
      `<b>🛡 New: Defensive support planning.</b> Two new tabs. In <b>Defensive Targets</b> you list allied villages that need defense and set a per-village objective — how many <b>spears, swords, spies and heavy cavalry</b> each should hold — with the defender and tribe auto-filled from the database and an optional <b>arrival deadline</b> per village.`,
      `<b>🛡 Plan Defense builds the support orders for you.</b> It spreads your tribe's defense to meet those objectives, following real rules: support stays <b>within the same tribe</b> (WC→WC, WC.→WC.), <b>front-line villages you list under “Ignore Coordinates” stay home</b>, players with <b>more defense send more</b>, and each player's troops are <b>spread evenly across their villages</b> so losses re-train fast. Only villages with <b>≥4,000 defensive population</b> are tapped, and every order carries <b>≥400 population</b> (no tiny dribbles).`,
      `<b>One-click sending:</b> export a <b>per-player BB list</b> where each line is an <b>origin → destination</b> with a rally-point link that <b>pre-fills the exact troops</b> — your members just open it and hit Support. When a target has a deadline, the line also shows <b>when to send</b> and <b>when it arrives</b>.`,
    ],
    es: [
      `<b>🛡 Nuevo: planificación de apoyo defensivo.</b> Dos pestañas nuevas. En <b>Objetivos Defensivos</b> listas las aldeas aliadas que necesitan defensa y fijas un objetivo por aldea — cuántas <b>lanzas, espadas, exploradores y caballería pesada</b> debe tener cada una — con el defensor y la tribu rellenados desde la base de datos y una <b>hora de llegada</b> opcional por aldea.`,
      `<b>🛡 Planear Defensa crea las órdenes de apoyo por ti.</b> Reparte la defensa de tu tribu para cumplir esos objetivos siguiendo reglas reales: el apoyo se queda <b>dentro de la misma tribu</b> (WC→WC, WC.→WC.), las <b>aldeas de primera línea que pongas en “Ignorar Coordenadas” se quedan en casa</b>, los jugadores con <b>más defensa envían más</b>, y las tropas de cada jugador se <b>reparten equitativamente entre sus aldeas</b> para que las pérdidas se recluten rápido. Solo se usan aldeas con <b>≥4.000 de población defensiva</b>, y cada orden lleva <b>≥400 de población</b> (sin envíos minúsculos).`,
      `<b>Envío en un clic:</b> exporta una <b>lista BB por jugador</b> donde cada línea es un <b>origen → destino</b> con un enlace al punto de reunión que <b>rellena las tropas exactas</b> — tus miembros solo lo abren y pulsan Apoyar. Si un objetivo tiene fecha límite, la línea también muestra <b>cuándo enviar</b> y <b>cuándo llega</b>.`,
    ],
  },
  { ver: 'v2.6.0', date: '2026-06-16',
    en: [
      `<b>👑 Noble launch villages are now protected:</b> when a player is set to send nobles to a target, their <b>two villages closest to that target are held back from the attack plan</b> — they're never given a regular off, no matter the distance, so they stay free to launch the noble train (and they no longer show up in <i>Export Unused Offs</i>). Only real villages qualify — a held village must have <b>at least 4,000 points and 4,000 farm population in troops</b>, so a tiny or near-empty village next to the target won't eat a slot (the next-closest qualifying village is held instead). A player nobling several targets still keeps only their two nearest. Works in both <b>Solo</b> and <b>Split-Off</b> modes (in Split-Off the closest of the two is the escort that rides the noble).`,
      `<b>Offs now build around the nobles:</b> the plan decides who sends each noble train first, then assigns the offs around them — an off still tries to come from the conqueror's own hand when they have a spare village.`,
    ],
    es: [
      `<b>👑 Las aldeas de lanzamiento de nobles ahora están protegidas:</b> cuando un jugador va a enviar nobles a un objetivo, sus <b>dos aldeas más cercanas a ese objetivo se reservan del plan de ataque</b> — nunca se les asigna un off normal, sin importar la distancia, para que queden libres y puedan lanzar el tren de nobles (y ya no aparecen en <i>Exportar Offs Sin Usar</i>). Solo cuentan aldeas reales — una aldea reservada debe tener <b>al menos 4.000 puntos y 4.000 de población (granja) en tropas</b>, así una aldea pequeña o casi vacía junto al objetivo no ocupa un hueco (se reserva la siguiente más cercana que sí califique). Un jugador que noblea varios objetivos sigue reservando solo sus dos más cercanas. Funciona en modo <b>Solo</b> y <b>Partir Off</b> (en Partir Off la más cercana de las dos es la escolta que acompaña al noble).`,
      `<b>Los offs ahora se organizan en torno a los nobles:</b> el plan decide primero quién envía cada tren de nobles y luego asigna los offs a su alrededor — un off sigue intentando salir de la propia mano del conquistador cuando le sobra una aldea.`,
    ],
  },
  { ver: 'v2.5.3', date: '2026-06-16',
    en: [
      `<b>📌 Offensive Targets — alerts now collapse:</b> the warning box folds into a one-line summary you can click to expand, just like Plan Offensive.`,
      `<b>👑 Default snob mode:</b> new setting in the config bar — pick <b>Solo</b> or <b>Split Off</b> once and every target you add (including pasted coordinates) starts with it.`,
      `<b>Snob players now counts itself:</b> targets start at <b>0</b> snob players and go up <b>+1</b> for each sender you assign (and back down when you remove one) — no more zeroing the count by hand when you don't want a train.`,
    ],
    es: [
      `<b>📌 Objetivos Off — los avisos ahora se pliegan:</b> la caja de avisos se reduce a un resumen de una línea que puedes desplegar al hacer clic, igual que en Planificar Off.`,
      `<b>👑 Modo nobles por defecto:</b> nuevo ajuste en la barra de configuración — elige <b>Solo</b> o <b>Partir Off</b> una vez y cada objetivo que añadas (incluidas las coordenadas pegadas) empieza con ese modo.`,
      `<b>Jugadores con nobles ahora se cuenta solo:</b> los objetivos empiezan en <b>0</b> jugadores con nobles y suben <b>+1</b> por cada remitente que asignas (y bajan al quitarlo) — ya no hay que poner el número a cero a mano cuando no quieres un tren.`,
    ],
  },
  { ver: 'v2.5.2', date: '2026-06-16',
    en: [
      `<b>🧹 Under-the-hood tidy-up:</b> the tool's code was split out of the one giant HTML file into smaller per-feature files (planner, timings, database, map, etc.). <b>Nothing changed for you</b> — every feature works exactly as before; the page is just lighter and easier to maintain.`,
    ],
    es: [
      `<b>🧹 Limpieza interna:</b> el código de la herramienta se dividió, sacándolo del enorme archivo HTML único, en archivos más pequeños por función (planificador, tiempos, base de datos, mapa, etc.). <b>Para ti no cambia nada</b> — todas las funciones siguen igual que antes; la página es solo más ligera y fácil de mantener.`,
    ],
  },
  { ver: 'v2.5.1', date: '2026-06-16',
    en: [
      `<b>🌐 Changelog now in Spanish too:</b> switch the language to <b>ES</b> and the whole change history reads in Spanish. <i>(Under the hood the changelog moved into its own <code>js/changelog.js</code> file, so the main page stays lighter.)</i>`,
    ],
    es: [
      `<b>🌐 Registro de cambios ahora también en español:</b> cambia el idioma a <b>ES</b> y todo el historial de cambios se lee en español. <i>(Por dentro, el registro de cambios se trasladó a su propio archivo <code>js/changelog.js</code>, para que la página principal sea más ligera.)</i>`,
    ] },

  { ver: 'v2.5.0', date: '2026-06-16',
    en: [
      `<b>📏 “Off min distance” is now tribe-wide:</b> a value here (e.g. 10) keeps any offensive village within that many fields of <b>any</b> objective free for a quick second round — it’s held back from <b>every</b> target, not just the one being filled. Previously an off sitting right next to objective A could still be flung at a far objective B; now it stays home.`,
      `<b>🤝 The conqueror gets one of its target’s offs:</b> when a player is set to take a village (nobles), the planner now tries to also send <b>one of that player’s offs to the same target</b>, so they can self-coordinate their timings. (Split-off trains already ride with the player’s own off, so this is unchanged for them.)`,
      `<b>🔽 Collapsible plan warnings:</b> the alerts/errors under <b>Plan Offensive</b> now start collapsed with a count (“⚠ 3 warnings — click to expand”) so they don’t bury the plan table — click to expand.`,
      `<b>👑 Noble trains never show an origin village:</b> a snob train isn’t tied to a specific village any more — the plan table and both BB exports show <b>⚠ Prepare Snob Train for [target] (Split Off) ⚠</b> with only the arrival time, so you prepare the train from whichever of your villages you like and just match the landing window. (The split-off escort off is still reserved per objective behind the scenes — see v2.4.0 — it’s only the displayed origin that’s gone.)`,
    ],
    es: [
      `<b>📏 La “Distancia mínima de off” ahora es de toda la tribu:</b> un valor aquí (p. ej. 10) mantiene libre, para una segunda oleada rápida, cualquier pueblo ofensivo que esté a esa distancia en campos de <b>cualquier</b> objetivo — se reserva frente a <b>todos</b> los objetivos, no solo el que se está rellenando. Antes, un off pegado al objetivo A podía acabar lanzándose contra un objetivo B lejano; ahora se queda en casa.`,
      `<b>🤝 El conquistador recibe uno de los off de su objetivo:</b> cuando un jugador tiene asignado tomar un pueblo (nobles), el planificador ahora intenta enviar también <b>uno de los off de ese jugador al mismo objetivo</b>, para que pueda coordinar sus propios tiempos. (Los trenes de Partir Off ya viajan con el off del propio jugador, así que para ellos no cambia nada.)`,
      `<b>🔽 Avisos del plan plegables:</b> los avisos/errores de <b>Plan Ofensivo</b> ahora empiezan plegados con un contador (“⚠ 3 avisos — clic para expandir”) para no tapar la tabla del plan — haz clic para desplegarlos.`,
      `<b>👑 Los trenes de nobles ya no muestran pueblo de origen:</b> un tren de nobles ya no está atado a un pueblo concreto — la tabla del plan y ambas exportaciones BB muestran <b>⚠ Prepara el Tren de Nobles para [objetivo] (Partir Off) ⚠</b> con solo la hora de llegada, así preparas el tren desde el pueblo que prefieras y solo cuadras la ventana de llegada. (El off de escolta del Partir Off se sigue reservando por objetivo en segundo plano — ver v2.4.0 — solo desaparece el origen mostrado.)`,
    ] },

  { ver: 'v2.4.0', date: '2026-06-16',
    en: [
      `<b>👑 "Snobs need recruiting" — show where:</b> when a player is set as a <b>split-off</b> snob sender but hasn’t recruited the noble(s) yet, the plan now shows the <b>coordinates of the off village reserved for the escort</b> — i.e. exactly where to recruit the noble so it can ride out with that off. The Plan table’s origin cell and the <b>Per-Player BB</b> export show that village + the target, tagged <b>[SNOBS NEED RECRUITING]</b> (ES: <b>[NECESITAS RECLUTAR NOBLES]</b>) instead of a bare “UNASSIGNED”. This now also covers the case where the sender owns a stray noble elsewhere but is short for the train (it points at the reserved off to recruit there); when they have <i>enough</i> nobles and only the escort off is busy, it still suggests Solo. The plan table and Per-Player BB also show the <b>launch time</b> and a <b>rally link</b> for that reserved off (origin → target), so you know exactly when and from where to send the split-off once the noble is in. (These pending lines are still display-only — pasting the Per-Player BB into the Attack Planner imports just the ready attacks.)`,
      `<b>⬇ Export Unused Offs:</b> new button in <b>Plan Offensive</b> that exports a forum <b>[table]</b> of every offensive village <b>not committed</b> by the current plan (i.e. its off wasn’t sent, isn’t a split-off escort, and isn’t reserved for one) — columns: #, Coord, Player, Type, [unit]axe[/unit], [unit]light[/unit], [unit]ram[/unit], [unit]catapult[/unit], Off Power, sorted by off power (strongest first). A <i>solo</i> noble train leaves its village’s off free, so that village still appears.`,
    ],
    es: [
      `<b>👑 "Necesitas reclutar nobles" — muestra dónde:</b> cuando un jugador está como remitente de nobles en modo <b>Partir Off</b> pero aún no ha reclutado el/los noble(s), el plan ahora muestra las <b>coordenadas del pueblo de off reservado para la escolta</b> — es decir, dónde reclutar el noble para que salga con ese off. La celda de origen de la tabla del Plan y la exportación <b>BB por jugador</b> muestran ese pueblo + el objetivo, etiquetados como <b>[SNOBS NEED RECRUITING]</b> (ES: <b>[NECESITAS RECLUTAR NOBLES]</b>) en lugar de un simple “SIN ASIGNAR”. Esto ahora también cubre el caso en que el remitente tiene un noble suelto en otro sitio pero le faltan para el tren (le señala el off reservado para reclutar ahí); cuando tiene <i>suficientes</i> nobles y solo el off de escolta está ocupado, sigue sugiriendo Solo. La tabla del plan y la BB por jugador también muestran la <b>hora de lanzamiento</b> y un <b>enlace de ataque</b> para ese off reservado (origen → objetivo), para que sepas exactamente cuándo y desde dónde enviar el Partir Off una vez tengas el noble. (Estas líneas pendientes siguen siendo solo informativas — al pegar la BB por jugador en el Planificador de Ataques solo se importan los ataques listos.)`,
      `<b>⬇ Exportar Off sin usar:</b> nuevo botón en <b>Plan Ofensivo</b> que exporta una <b>[table]</b> de foro con cada pueblo ofensivo <b>no comprometido</b> por el plan actual (es decir, cuyo off no se envió, no es escolta de un Partir Off ni está reservado para uno) — columnas: #, Coord, Jugador, Tipo, [unit]axe[/unit], [unit]light[/unit], [unit]ram[/unit], [unit]catapult[/unit], Poder ofensivo, ordenadas por poder ofensivo (de mayor a menor). Un tren de nobles <i>Solo</i> deja libre el off de su pueblo, así que ese pueblo sigue apareciendo.`,
    ] },

  { ver: 'v2.3.0', date: '2026-06-16',
    en: [
      `<b>🚀 Clearer Per-Player BB launch line:</b> the <b>Export Per-Player BB</b> output now puts the launch instructions on their own highlighted second line — <i>LAUNCH TIME: on the 17th between 03:16–04:16 — ATTACK URL▶</i> (Spanish: <i>HORA DE LANZAMIENTO: día 17 entre …</i>) — naming the launch day and wrapping the time and rally link in red so senders can’t miss when to launch. The arrival window stays on the first line. Pasting this into the Attack Planner’s per-player import still works (the planner reads both the old and new formats).`,
    ],
    es: [
      `<b>🚀 Línea de lanzamiento más clara en la BB por jugador:</b> la salida de <b>Exportar BB por jugador</b> ahora pone las instrucciones de lanzamiento en su propia segunda línea resaltada — <i>HORA DE LANZAMIENTO: día 17 entre 03:16–04:16 — ENLACE DE ATAQUE▶</i> — indicando el día de lanzamiento y envolviendo la hora y el enlace de ataque en rojo para que los remitentes no se pierdan cuándo lanzar. La ventana de llegada se queda en la primera línea. Pegar esto en la importación por jugador del Planificador de Ataques sigue funcionando (el planificador lee tanto el formato antiguo como el nuevo).`,
    ] },

  { ver: 'v2.2.0', date: '2026-06-16',
    en: [
      `<b>💾 Backup &amp; Debug export/import:</b> a new section in <b>Settings</b> exports everything saved locally — offensive targets, the generated plan, settings, language, the loaded troop data, and the morale inputs for it (the world-DB records for your villages and targets, so morale still reproduces even after the daily map mirror changes) — into one JSON file. Import it on another machine to reproduce a tribemate’s exact situation when debugging. Importing replaces your current saved targets/plan/settings/map prefs (your previous state is backed up in the browser first).`,
      `<b>Split-off counts as a Complete:</b> the offs-assigned counter now adds <b>+1 Complete</b> per split-off (escorted) noble train — since each one rides with a Complete off — so the count reflects what’s really committed.`,
      `<b>Troop data stays loaded:</b> the troop file you upload (or paste) is now remembered across sessions — reopen the calculator and your last-loaded troops are back automatically. Uploading new file(s) replaces it; <b>✕ Clear</b> removes it.`,
    ],
    es: [
      `<b>💾 Exportar/importar copia de seguridad y depuración:</b> una nueva sección en <b>Ajustes</b> exporta todo lo guardado localmente — objetivos ofensivos, el plan generado, los ajustes, el idioma, las tropas cargadas y los datos de moral asociados (los registros de la base de datos del mundo de tus pueblos y objetivos, para que la moral se reproduzca incluso después de que el mirror diario del mapa cambie) — en un único archivo JSON. Impórtalo en otra máquina para reproducir la situación exacta de un compañero de tribu al depurar. Importar reemplaza tus objetivos/plan/ajustes/preferencias de mapa actuales (tu estado anterior se respalda primero en el navegador).`,
      `<b>Partir Off cuenta como un Completo:</b> el contador de off asignados ahora suma <b>+1 Completo</b> por cada tren de nobles Partir Off (con escolta) — ya que cada uno viaja con un off Completo — para que el conteo refleje lo que realmente está comprometido.`,
      `<b>Las tropas se mantienen cargadas:</b> el archivo de tropas que subes (o pegas) ahora se recuerda entre sesiones — reabre la calculadora y tus últimas tropas cargadas vuelven automáticamente. Subir archivo(s) nuevo(s) lo reemplaza; <b>✕ Limpiar</b> lo elimina.`,
    ] },

  { ver: 'v2.1.0', date: '2026-06-16',
    en: [
      `<b>⚡ Morale-aware “Optimize” plan:</b> the <b>Prioritize</b> dropdown is gone — <b>Generate Plan</b> now auto-optimizes. For each off it maximizes <b>effective off power = morale × off power</b> against travel distance, so a slightly lower-morale but much closer village beats a far one (95% @ 7h beats 100% @ 50h). Morale uses the same points-based formula as Tribe Timings; with no world DB loaded it falls back to plain distance. Manually-pinned senders still go by distance only.`,
      `<b>⚖️ Balanced off load:</b> Optimize now also spreads offs across players in <b>proportion to how many each owns</b>, so a small-roster player isn’t drained while a big one sits idle — e.g. a 13-off and a 6-off player split a 13-off job closer to 9+4 than 7+6, instead of maxing out the small one. It still respects morale/distance; this only breaks near-ties.`,
      `<b>👑 Split-off escort reserved:</b> when a snob sender is in <b>split off</b> mode, the planner now <b>holds back one of that player’s offs</b> (the closest Complete/3-4 to the target) so it’s free to escort the noble — even if the player hasn’t recruited the noble yet. So a player with 4 offs + a pending split-off train is planned as 3 offs now, 1 reserved for when the noble lands.`,
      `<b>📊 Morale column in Plan Offensive:</b> every planned attack now shows its morale (between Player and Window), color-coded.`,
      `<b>⚡ POWER tag per target:</b> a new checkbox in Offensive Targets. Tag a target <b>POWER</b> and it’s filled with your <b>strongest offs</b> (regardless of tier). With several POWER targets, the strongest offs are <b>balanced</b> across them.`,
      `<b>👑 Noble senders never disappear:</b> all tribe players now show in the snob-sender picker, including those with <b>(0)</b> nobles. Pin a player who has no noble yet and they <b>stay on the plan</b> — the origin shows UNASSIGNED and a warning tells them to recruit a noble so the train arrives in time.`,
      `<b>🧮 Offs committed counter:</b> Offensive Targets now shows <b>N / Total offs assigned</b> at the bottom — how many offs you’ve allocated vs. how many off villages your tribe has.`,
    ],
    es: [
      `<b>⚡ Plan “Optimizar” según la moral:</b> el desplegable <b>Priorizar</b> desaparece — <b>Generar Plan</b> ahora optimiza solo. Para cada off maximiza el <b>poder ofensivo efectivo = moral × poder ofensivo</b> frente a la distancia de viaje, así un pueblo con algo menos de moral pero mucho más cerca gana a uno lejano (95% a 7h gana a 100% a 50h). La moral usa la misma fórmula basada en puntos que Tiempos de Tribu; sin base de datos del mundo cargada, recurre solo a la distancia. Los remitentes fijados a mano siguen yendo solo por distancia.`,
      `<b>⚖️ Carga de off equilibrada:</b> Optimizar ahora también reparte los off entre jugadores en <b>proporción a cuántos tiene cada uno</b>, para no vaciar a un jugador con pocos pueblos mientras uno grande está parado — p. ej. un jugador de 13 off y otro de 6 reparten un trabajo de 13 off más cerca de 9+4 que de 7+6, en vez de exprimir al pequeño. Sigue respetando moral/distancia; esto solo desempata casos parejos.`,
      `<b>👑 Escolta de Partir Off reservada:</b> cuando un remitente de nobles está en modo <b>Partir Off</b>, el planificador ahora <b>reserva uno de los off de ese jugador</b> (el Completo/3-4 más cercano al objetivo) para que quede libre para escoltar al noble — incluso si el jugador aún no ha reclutado el noble. Así, un jugador con 4 off + un tren Partir Off pendiente se planifica como 3 off ahora, 1 reservado para cuando llegue el noble.`,
      `<b>📊 Columna de moral en Plan Ofensivo:</b> cada ataque planificado ahora muestra su moral (entre Jugador y Ventana), con código de color.`,
      `<b>⚡ Etiqueta POWER por objetivo:</b> una nueva casilla en Objetivos Off. Marca un objetivo como <b>POWER</b> y se rellena con tus <b>off más fuertes</b> (sin importar el nivel). Con varios objetivos POWER, los off más fuertes se <b>reparten equilibradamente</b> entre ellos.`,
      `<b>👑 Los remitentes de nobles nunca desaparecen:</b> todos los jugadores de la tribu aparecen ahora en el selector de remitentes de nobles, incluidos los que tienen <b>(0)</b> nobles. Fija a un jugador que aún no tenga noble y <b>se queda en el plan</b> — el origen muestra SIN ASIGNAR y un aviso le indica que reclute un noble para que el tren llegue a tiempo.`,
      `<b>🧮 Contador de off comprometidos:</b> Objetivos Off ahora muestra <b>N / Total de off asignados</b> abajo — cuántos off has asignado frente a cuántos pueblos ofensivos tiene tu tribu.`,
    ] },

  { ver: 'v2.0.2', date: '2026-06-15',
    en: [
      `<b>✎ Edit villages in “By Villages”:</b> each row now has an <b>Edit</b> button — adjust a village’s troops by hand (axe, light, heavy, knight, ram, catapult, snob) and the off power, tier, and player totals recalculate instantly. Handy for planning around villages you <i>know</i> will have nobles in a few days: bump their snob count and the planner treats them as senders. <i>Edits apply for the current session only</i> — reloading or re-pasting the troop file resets them.`,
    ],
    es: [
      `<b>✎ Editar pueblos en “Por Pueblos”:</b> cada fila tiene ahora un botón <b>Editar</b> — ajusta a mano las tropas de un pueblo (hacha, ligera, pesada, paladín, ariete, catapulta, noble) y el poder ofensivo, el nivel y los totales del jugador se recalculan al instante. Útil para planificar con pueblos que <i>sabes</i> que tendrán nobles en unos días: súbeles el número de nobles y el planificador los trata como remitentes. <i>Las ediciones solo valen para la sesión actual</i> — recargar o volver a pegar el archivo de tropas las restablece.`,
    ] },

  { ver: 'v2.0.1', date: '2026-06-15',
    en: [
      `<b>👤 Assign off senders per target:</b> Offensive Targets now has an <b>Off Senders</b> column with a picker for each tier (Complete / 3-4 / 1-2), just like snob senders. Each option shows <b>how many offs of that tier the player owns</b>, so you can see at a glance who can cover a request. Pinned senders are assigned first from their own villages and split a tier’s slots evenly (set an exact number per sender if you want). If a pinned sender can’t cover — none in distance range, or not enough offs free — the plan says so and leaves the slot open instead of silently using someone else.`,
      `<b>🏰 Noble recruit suggestion:</b> when you pin a snob sender whose noble villages are all out of travel range, the warning now adds <i>which of that player’s villages are within range</i> — i.e. where they should recruit a noble to reach the target.`,
    ],
    es: [
      `<b>👤 Asignar remitentes de off por objetivo:</b> Objetivos Off tiene ahora una columna <b>Remitentes de Off</b> con un selector por cada nivel (Completo / 3-4 / 1-2), igual que los remitentes de nobles. Cada opción muestra <b>cuántos off de ese nivel tiene el jugador</b>, para ver de un vistazo quién puede cubrir una petición. Los remitentes fijados se asignan primero desde sus propios pueblos y se reparten las plazas de un nivel a partes iguales (pon un número exacto por remitente si quieres). Si un remitente fijado no puede cubrir — ninguno dentro del rango de distancia, o no hay suficientes off libres — el plan lo indica y deja la plaza abierta en vez de usar a otro en silencio.`,
      `<b>🏰 Sugerencia de reclutamiento de noble:</b> cuando fijas un remitente de nobles cuyos pueblos con noble están todos fuera del rango de viaje, el aviso ahora añade <i>cuáles de los pueblos de ese jugador están dentro de rango</i> — es decir, dónde debería reclutar un noble para alcanzar el objetivo.`,
    ] },

  { ver: 'v2.0.0-rc1', date: '2026-06-15', tagEn: 'release candidate', tagEs: 'versión candidata',
    en: [
      `<b>🐗 Barb Finder:</b> a new map toolbar button — pick one of your tribe’s players who owns nobles, and it lists the barbarian villages closest to that player’s noble villages (the fastest to conquer), ranked by distance. Filter by bonus / no bonus and narrow to a bonus type. Candidate barbs get an orange ring, the player’s noble villages a blue ring; click a result to center the map, or Copy the whole list. <b>While it’s open the map fades everything except that player’s villages and the matching barbarians</b>, so the targets stand out at a glance.`,
      `<b>“Barbs only” filter:</b> a new map toolbar checkbox (beside “Bonus only”) that fades every player village so only barbarian villages stand out.`,
      `<b>Square overview:</b> zoomed out, the map now keeps a true square shape (no more vertical flattening) so the world looks like its real circular self; it only switches to the tighter in-game vertical packing once you zoom in far enough to see the village graphics.`,
      `<b>Bigger dots when zoomed out:</b> village dots now fill their cell and touch edge-to-edge, so tribe colors read as solid blocks from a distance.`,
      `<b>Default view frames your world:</b> opening the map (and Reset view) now frames the village cloud — northernmost village at the top, southernmost at the bottom — instead of the empty grid.`,
    ],
    es: [
      `<b>🐗 Buscador de Bárbaros:</b> un nuevo botón en la barra del mapa — elige uno de los jugadores de tu tribu que tenga nobles y lista los pueblos bárbaros más cercanos a los pueblos con noble de ese jugador (los más rápidos de conquistar), ordenados por distancia. Filtra por bonus / sin bonus y acota a un tipo de bonus. Los bárbaros candidatos llevan un anillo naranja, los pueblos con noble del jugador un anillo azul; haz clic en un resultado para centrar el mapa, o Copia la lista entera. <b>Mientras está abierto, el mapa atenúa todo salvo los pueblos de ese jugador y los bárbaros coincidentes</b>, para que los objetivos resalten de un vistazo.`,
      `<b>Filtro “Solo bárbaros”:</b> una nueva casilla en la barra del mapa (junto a “Solo bonus”) que atenúa todos los pueblos de jugadores para que solo resalten los pueblos bárbaros.`,
      `<b>Vista general cuadrada:</b> al alejar, el mapa mantiene ahora una forma cuadrada real (sin aplastamiento vertical) para que el mundo se vea con su forma circular real; solo cambia al empaquetado vertical más ajustado del juego cuando acercas lo suficiente como para ver los gráficos de los pueblos.`,
      `<b>Puntos más grandes al alejar:</b> los puntos de los pueblos ahora llenan su celda y se tocan borde con borde, para que los colores de tribu se lean como bloques sólidos desde lejos.`,
      `<b>La vista por defecto encuadra tu mundo:</b> abrir el mapa (y Restablecer vista) ahora encuadra la nube de pueblos — el pueblo más al norte arriba, el más al sur abajo — en vez de la cuadrícula vacía.`,
    ] },

  { ver: 'v2.0.0-b', date: '2026-06-15', tagEn: 'beta', tagEs: 'beta',
    en: [
      `<b>🎨 Map colors:</b> barbarian villages are grey, every other player is brown, and <b>your own tribe is blue</b> — auto-detected from the tribe-troop file you load. It seeds an editable “My tribe” group you can rename and add more tribes to (handy for a multi-tribe alliance).`,
      `<b>Custom color groups:</b> create your own named groups, pick a color for each, and add members — individual villages (<code>X|Y</code>), players, or whole tribes (by tag). Grouped villages take the group’s color, overriding the defaults (a single village beats a player, which beats a tribe).`,
      `<b>Zoomed-in color markers:</b> when zoomed in, each village shows a small colored dot (its group color) on the top-left, so you can tell who’s who at a glance. Barbarians get no dot.`,
      `<b>Barbarian village art:</b> abandoned/barbarian villages now use their own sprites, distinct from owned ones.`,
      `<b>More zoom:</b> you can now zoom in closer on the map.`,
      `<b>Continent &amp; block grid:</b> thicker lines mark the 100×100 continents and thinner lines the in-game 5×5 blocks (shown when zoomed in), so you can tell where you are.`,
      `<b>Extract Coordinates:</b> a toolbar button — click villages to collect them, then Copy to paste straight into Offensive Targets / the planner. Selected villages get a ring.`,
      `<b>Troop overlay:</b> for villages whose troops you’ve loaded (from the tribe info file), hovering shows off/def power and unit counts. Zoomed in, each shows a badge: <b>axe on red</b> for offensive, <b>sword on blue</b> for defensive, plus a <b>snob on yellow</b> if it has nobles.`,
      `<b>Bonus-only filter:</b> a checkbox dims every non-bonus village, leaving just the bonus villages lit.`,
      `<i>Remembered between sessions:</i> your color groups and the bonus filter are saved.`,
    ],
    es: [
      `<b>🎨 Colores del mapa:</b> los pueblos bárbaros son grises, cualquier otro jugador es marrón, y <b>tu propia tribu es azul</b> — detectada automáticamente del archivo de tropas de la tribu que cargues. Crea un grupo editable “Mi tribu” que puedes renombrar y al que puedes añadir más tribus (útil para una alianza de varias tribus).`,
      `<b>Grupos de color personalizados:</b> crea tus propios grupos con nombre, elige un color para cada uno y añade miembros — pueblos sueltos (<code>X|Y</code>), jugadores o tribus enteras (por etiqueta). Los pueblos agrupados toman el color del grupo, anulando los colores por defecto (un pueblo concreto gana a un jugador, que gana a una tribu).`,
      `<b>Marcadores de color al acercar:</b> al acercar, cada pueblo muestra un pequeño punto de color (el de su grupo) arriba a la izquierda, para distinguir quién es quién de un vistazo. Los bárbaros no llevan punto.`,
      `<b>Gráficos de pueblo bárbaro:</b> los pueblos abandonados/bárbaros ahora usan sus propios sprites, distintos de los de jugadores.`,
      `<b>Más zoom:</b> ahora puedes acercar más en el mapa.`,
      `<b>Cuadrícula de continentes y bloques:</b> líneas más gruesas marcan los continentes de 100×100 y líneas más finas los bloques 5×5 del juego (visibles al acercar), para saber dónde estás.`,
      `<b>Extraer coordenadas:</b> un botón de la barra — haz clic en los pueblos para recopilarlos, luego Copia para pegarlos directamente en Objetivos Off / el planificador. Los pueblos seleccionados llevan un anillo.`,
      `<b>Superposición de tropas:</b> para los pueblos cuyas tropas hayas cargado (del archivo de info de la tribu), al pasar el ratón se muestra el poder ofensivo/defensivo y el número de unidades. Al acercar, cada uno muestra una insignia: <b>hacha sobre rojo</b> para ofensivo, <b>espada sobre azul</b> para defensivo, más un <b>noble sobre amarillo</b> si tiene nobles.`,
      `<b>Filtro solo bonus:</b> una casilla atenúa todos los pueblos sin bonus, dejando iluminados solo los pueblos bonus.`,
      `<i>Recordado entre sesiones:</i> tus grupos de color y el filtro de bonus se guardan.`,
    ] },

  { ver: 'v2.0.0-a', date: '2026-06-14', tagEn: 'alpha', tagEs: 'alpha',
    en: [
      `<b>🗺 New Map tab (alpha):</b> an interactive world map rendered from the loaded village database — drag to pan, scroll to zoom, hover any village for its name, coordinate, continent, player, tribe, and points.`,
      `<b>Real village graphics:</b> zoom in and villages become the in-game map sprites, sized by points; zoom out for a fast colored-dot overview.`,
      `<b>Bonus villages identified:</b> bonus villages (e.g. +100% iron, +30% all resources) are detected straight from the map data — shown in cyan on the overview, with the bonus type in the hover tooltip and the “shine” bonus sprite when zoomed in.`,
      `<i>Under the hood:</i> the calculator was split into separate <code>css/</code> and <code>js/</code> files (no behaviour change) to keep it maintainable as the map grows.`,
      `<i>Coming next:</i> colour villages by tribe/player, multi-select to export coordinates into the attack planner, a bonus-village filter, and tribemate troop overlays.`,
    ],
    es: [
      `<b>🗺 Nueva pestaña Mapa (alpha):</b> un mapa del mundo interactivo renderizado desde la base de datos de pueblos cargada — arrastra para desplazar, rueda para hacer zoom, pasa el ratón por cualquier pueblo para ver su nombre, coordenada, continente, jugador, tribu y puntos.`,
      `<b>Gráficos reales de pueblos:</b> acerca y los pueblos se convierten en los sprites del mapa del juego, dimensionados por puntos; aleja para una vista rápida de puntos de color.`,
      `<b>Pueblos bonus identificados:</b> los pueblos bonus (p. ej. +100% hierro, +30% todos los recursos) se detectan directamente de los datos del mapa — mostrados en cian en la vista general, con el tipo de bonus en el tooltip y el sprite de bonus “brillante” al acercar.`,
      `<i>Por dentro:</i> la calculadora se dividió en archivos <code>css/</code> y <code>js/</code> separados (sin cambios de comportamiento) para mantenerla mantenible a medida que el mapa crece.`,
      `<i>Próximamente:</i> colorear pueblos por tribu/jugador, selección múltiple para exportar coordenadas al planificador de ataques, un filtro de pueblos bonus y superposición de tropas de compañeros de tribu.`,
    ] },

  { ver: 'v1.7.4', date: '2026-06-14',
    en: [
      `<b>Tribe Timings — grey out cells that miss the deadline:</b> with an “Arrive by” deadline set, each per-unit travel/arrival cell whose unit can’t land in time is dimmed (in addition to hiding villages where nothing makes it), so you can see at a glance which units of a kept village still arrive.`,
      `<b>Tribe Timings — Export Per-Player BB:</b> new button that groups the shown rows by player (like Plan Offensive’s per-player export), so each member can be told exactly which of their villages reach the target and when (arrival time, pace unit, rally link).`,
      `<b>Tribe Timings — target village excluded:</b> a village sitting on the target coordinate is no longer listed as a sender to itself.`,
      `<b>Tribe Timings — off-power tier badge:</b> the Off Power column now shows the Complete Off / 3/4 / 1/2 tier badge next to the value (offensive mode).`,
      `<b>Database updated time in three clocks:</b> the web-mirror “updated” line now shows the timestamp in UTC, your browser’s local time, and game-server time (UTC + the configured offset).`,
    ],
    es: [
      `<b>Tiempos de Tribu — atenuar las celdas que no llegan a tiempo:</b> con una fecha límite “Llegar antes de”, cada celda de viaje/llegada por unidad cuya unidad no puede aterrizar a tiempo se atenúa (además de ocultar los pueblos donde no llega nada), para ver de un vistazo qué unidades de un pueblo conservado sí llegan.`,
      `<b>Tiempos de Tribu — Exportar BB por jugador:</b> nuevo botón que agrupa las filas mostradas por jugador (como la exportación por jugador de Plan Ofensivo), para decirle a cada miembro exactamente cuáles de sus pueblos alcanzan el objetivo y cuándo (hora de llegada, unidad de ritmo, enlace de ataque).`,
      `<b>Tiempos de Tribu — pueblo objetivo excluido:</b> un pueblo situado en la coordenada del objetivo ya no aparece como remitente hacia sí mismo.`,
      `<b>Tiempos de Tribu — insignia de nivel de poder ofensivo:</b> la columna Poder Ofensivo ahora muestra la insignia de nivel Off Completo / 3/4 / 1/2 junto al valor (modo ofensivo).`,
      `<b>Hora de actualización de la base de datos en tres relojes:</b> la línea “actualizado” del mirror web ahora muestra la marca de tiempo en UTC, la hora local de tu navegador y la hora del servidor del juego (UTC + el desfase configurado).`,
    ] },

  { ver: 'v1.7.3', date: '2026-06-14',
    en: [
      `<b>Corrected morale formula:</b> now <code>morale = 3 × defender points ÷ attacker points + 0.3</code>, clamped between 30% and 100% — fitted exactly to in-game battle simulations (the previous <code>+ 0.25</code> was off by ~5 points across the mid-range).`,
    ],
    es: [
      `<b>Fórmula de moral corregida:</b> ahora <code>moral = 3 × puntos del defensor ÷ puntos del atacante + 0.3</code>, limitada entre 30% y 100% — ajustada con exactitud a simulaciones de combate del juego (el anterior <code>+ 0.25</code> se desviaba ~5 puntos en el rango medio).`,
    ] },

  { ver: 'v1.7.2', date: '2026-06-14',
    en: [
      `<b>Morale column in Tribe Timings (Offensive mode):</b> shows each attacker’s morale against the target, using <code>morale = 3 × defender points ÷ attacker points + 0.25</code> (capped at 100%). Points are each player’s total village points aggregated from the loaded map database; shows “—” until the DB is loaded.`,
    ],
    es: [
      `<b>Columna de moral en Tiempos de Tribu (modo ofensivo):</b> muestra la moral de cada atacante contra el objetivo, usando <code>moral = 3 × puntos del defensor ÷ puntos del atacante + 0.25</code> (limitada al 100%). Los puntos son el total de puntos de pueblos de cada jugador agregados desde la base de datos del mapa cargada; muestra “—” hasta que se cargue la base de datos.`,
    ] },

  { ver: 'v1.7.1', date: '2026-06-14',
    en: [
      `Shortened the <b>“Total Def Power”</b> header to <b>“Def Power”</b> across the Rankings, By&nbsp;Player and Villages tables (fixes the Rankings horizontal scrollbar).`,
      `Added this <b>Changelog</b> tab.`,
    ],
    es: [
      `Se acortó el encabezado <b>“Poder Def. Total”</b> a <b>“Pod. Def.”</b> en las tablas de Clasificaciones, Por&nbsp;Jugador y Pueblos (corrige la barra de desplazamiento horizontal de Clasificaciones).`,
      `Se añadió esta pestaña de <b>Cambios</b>.`,
    ] },

  { ver: 'v1.7.0', date: '2026-06-14',
    en: [
      `<b>Swordsman defense fix:</b> corrected the data (50 vs infantry / 25 vs cavalry). Every Defensive Power figure for armies containing swords was previously wrong.`,
      `<b>Combined Defensive Power:</b> infantry + cavalry defense are now shown as one value (with an “X inf + Y cav” tooltip) on Overview, By&nbsp;Player, By&nbsp;Villages and Rankings; the Overview bar splits into infantry and cavalry segments.`,
      `<b>Sortable Villages table:</b> click any column header to sort (the old Sort dropdown was removed).`,
      `Wired unit/stat <b>icons</b> throughout the Overview, both data tables, Tribe Timings and Rankings.`,
      `Banked the full reverse-engineered TW battle-combat formula spec for a future Battle Simulator.`,
    ],
    es: [
      `<b>Corrección de la defensa de la espada:</b> se corrigieron los datos (50 vs infantería / 25 vs caballería). Antes, toda cifra de Poder Defensivo de ejércitos con espadas estaba mal.`,
      `<b>Poder Defensivo combinado:</b> la defensa de infantería + caballería se muestra ahora como un único valor (con un tooltip “X inf + Y cab”) en Resumen, Por&nbsp;Jugador, Por&nbsp;Pueblos y Clasificaciones; la barra del Resumen se divide en segmentos de infantería y caballería.`,
      `<b>Tabla de Pueblos ordenable:</b> haz clic en cualquier encabezado de columna para ordenar (se quitó el antiguo desplegable de orden).`,
      `Se añadieron <b>iconos</b> de unidades/estadísticas por todo el Resumen, ambas tablas de datos, Tiempos de Tribu y Clasificaciones.`,
      `Se archivó la especificación completa, obtenida por ingeniería inversa, de la fórmula de combate de TW para un futuro Simulador de Batallas.`,
    ] },

  { ver: 'v1.6.3', date: '2026-06-13',
    en: [
      `<b>Tribe Timings “Arrive by” deadline</b> (date + time): hides villages that can’t land in time, adds an “Any” pace option, and shows arrivals in server time.`,
      `Tier <b>badges</b> replace plain text for off tiers in Offensive Targets and Settings.`,
      `<b>Off tier auto-bump:</b> when a requested off tier has no candidates left, the planner upgrades to the nearest stronger tier and warns.`,
    ],
    es: [
      `<b>Fecha límite “Llegar antes de” en Tiempos de Tribu</b> (fecha + hora): oculta los pueblos que no pueden aterrizar a tiempo, añade una opción de ritmo “Cualquiera” y muestra las llegadas en hora del servidor.`,
      `<b>Insignias</b> de nivel reemplazan el texto plano de los niveles de off en Objetivos Off y Ajustes.`,
      `<b>Subida automática de nivel de off:</b> cuando un nivel de off solicitado se queda sin candidatos, el planificador sube al nivel más fuerte más cercano y avisa.`,
    ] },

  { ver: 'v1.6.2', date: '2026-06-12',
    en: [
      `New targets default their <b>Snob Mode</b> to Solo.`,
    ],
    es: [
      `Los nuevos objetivos tienen su <b>Modo Noble</b> por defecto en Solo.`,
    ] },

  { ver: 'v1.6.1', date: '2026-06-12',
    en: [
      `<b>Off min/max distance band</b> — keep close offs free for a quick second round.`,
      `<b>Server time</b> setting (UTC offset) with a live server clock.`,
      `<b>Launch dates</b> on plan windows + a past-launch feasibility guard that drops or flags offs that would have to launch in the past.`,
    ],
    es: [
      `<b>Banda de distancia mín./máx. de off</b> — mantén libres los off cercanos para una segunda oleada rápida.`,
      `Ajuste de <b>hora del servidor</b> (desfase UTC) con un reloj de servidor en vivo.`,
      `<b>Fechas de lanzamiento</b> en las ventanas del plan + una comprobación de viabilidad que descarta o marca los off que tendrían que lanzarse en el pasado.`,
    ] },

  { ver: 'v1.6.0', date: '2026-06-12',
    en: [
      `<b>Server URL</b> setting and <b>rally-point links</b> in the Plan table.`,
      `Configurable <b>default off counts</b> per new target.`,
      `<b>Export Per-Player BB</b> — one forum block per sender.`,
      `Split-off snob icon in the BB exports.`,
      `Light cavalry &amp; spies now counted in defensive power.`,
      `“Send with” <b>pace-unit order links</b> in Tribe Timings.`,
      `Tribe names from <code>ally.txt</code> + a sortable Database table with a Tribe column.`,
    ],
    es: [
      `Ajuste de <b>URL del servidor</b> y <b>enlaces al punto de reunión</b> en la tabla del Plan.`,
      `<b>Recuentos de off por defecto</b> configurables por nuevo objetivo.`,
      `<b>Exportar BB por jugador</b> — un bloque de foro por remitente.`,
      `Icono de noble Partir Off en las exportaciones BB.`,
      `La caballería ligera y los exploradores ahora cuentan en el poder defensivo.`,
      `<b>Enlaces de orden por unidad de ritmo</b> “Enviar con” en Tiempos de Tribu.`,
      `Nombres de tribu desde <code>ally.txt</code> + una tabla de Base de Datos ordenable con una columna de Tribu.`,
    ] },

  { ver: 'v1.5.2', date: '2026-06-12',
    en: [
      `<b>Snob travel range</b> limit (default 70 fields).`,
      `“Escorted” renamed to <b>“Split Off”</b>.`,
      `Fix-time button glyph changed to “=”.`,
    ],
    es: [
      `Límite de <b>rango de viaje del noble</b> (70 campos por defecto).`,
      `“Escoltado” renombrado a <b>“Partir Off”</b>.`,
      `El icono del botón de fijar hora cambió a “=”.`,
    ] },

  { ver: 'v1.5.1', date: '2026-06-12',
    en: [
      `Allow <b>multiple noble trains</b> from the same village.`,
    ],
    es: [
      `Permitir <b>varios trenes de nobles</b> desde el mismo pueblo.`,
    ] },

  { ver: 'v1.5.0', date: '2026-06-12',
    en: [
      `Start/end <b>time-input window editor</b> for off and snob windows.`,
      `Per-target <b>multiple off windows</b> with counts.`,
      `Per-sender <b>noble counts</b>.`,
      `<b>Tier-ordered landings</b> — Completes land earliest, then 3/4, then 1/2.`,
    ],
    es: [
      `<b>Editor de ventanas con entrada de hora</b> de inicio/fin para las ventanas de off y de nobles.`,
      `<b>Varias ventanas de off</b> por objetivo con recuentos.`,
      `<b>Recuentos de nobles</b> por remitente.`,
      `<b>Llegadas ordenadas por nivel</b> — los Completos aterrizan primero, luego 3/4, luego 1/2.`,
    ] },

  { ver: 'v1.4.0', date: '2026-06-12',
    en: [
      `Added the offensive-planning tabs: <b>Tribe Timings</b>, <b>Offensive Targets</b>, <b>Plan Offensive</b> and <b>Database</b>.`,
    ],
    es: [
      `Se añadieron las pestañas de planificación ofensiva: <b>Tiempos de Tribu</b>, <b>Objetivos Off</b>, <b>Plan Ofensivo</b> y <b>Base de Datos</b>.`,
    ] },
];

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
  const cards = CHANGELOG.map(e => {
    const tag = L === 'es' ? e.tagEs : e.tagEn;
    const date = e.date + (tag ? ' · ' + tag : '');
    const items = (e[L] || e.en).map(li => `<li>${li}</li>`).join('');
    return `<div class="cl-entry"><div class="cl-head"><span class="cl-ver">${e.ver}</span>`
      + `<span class="cl-date">${date}</span></div><ul class="cl-list">${items}</ul></div>`;
  }).join('');
  host.innerHTML = cards + `<p style="font-size:12px;color:#5a3a18;margin-top:6px;">${footer}</p>`;
}
