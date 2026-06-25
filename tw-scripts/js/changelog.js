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
  { ver: 'v3.18.0', date: '2026-06-25',
    en: [
      `<b>🧨 "Destroyer" targets prefer catapult offs.</b> A target with offs assigned, <b>no noble senders</b>, and <b>catapult attacks turned on</b> is treated as a <b>destroyer (voladora)</b> — you flatten the village instead of taking it. For these, the planner now <b>prefers offensive villages that carry 101+ catapults</b> when choosing the clearing off(s), so the off itself demolishes buildings. The usual requirements still come first (tier, range, launch time, morale); catapult count then decides among the qualifying villages, and it applies to <b>every</b> off slot on the target, not just one. If no catapult-carrying off can reach the target, a normal off is sent instead and a warning is raised. The extra small catapult attacks from your defensive villages are unchanged and still added on top.`,
    ],
    es: [
      `<b>🧨 Objetivos "voladora" priorizan offs con catapultas.</b> Un objetivo con offs asignados, <b>sin emisores de nobles</b> y con <b>ataques de catapulta activados</b> se trata como una <b>voladora (destroyer)</b> — arrasas la aldea en vez de conquistarla. Para estos, el planificador ahora <b>prefiere aldeas ofensivas que lleven 101+ catapultas</b> al elegir el/los off(s) de limpieza, para que el propio off demuela edificios. Los requisitos habituales siguen primero (tipo, alcance, hora de salida, moral); el número de catapultas decide luego entre las aldeas válidas, y aplica a <b>cada</b> off del objetivo, no solo a uno. Si ningún off con catapultas alcanza el objetivo, se envía un off normal y se muestra un aviso. Los ataques de catapulta pequeños desde tus aldeas defensivas no cambian y se siguen añadiendo además.`,
    ],
  },
  { ver: 'v3.17.0', date: '2026-06-25',
    en: [
      `<b>🪨 Smarter catapult-attack sourcing.</b> Two changes to how the extra catapult attacks pick their source villages. <b>(1) More players per target:</b> the attacks on a single target now spread across <b>different players</b> first — a player isn't repeated while another catapult-owning player is still available (the limit of <b>2 attacks from the same village to the same target</b> still holds). <b>(2) Closer than the offs:</b> a catapult source must now be at least <b>8 fields closer</b> to the target than the farthest off assigned to it, so the slow catapults stay inside the off ring and can land in the window. This can reduce supply, so any shortfall is flagged in the warnings.`,
    ],
    es: [
      `<b>🪨 Selección de origen más inteligente para los ataques de catapulta.</b> Dos cambios en cómo los ataques de catapulta extra eligen sus aldeas de origen. <b>(1) Más jugadores por objetivo:</b> los ataques sobre un mismo objetivo ahora se reparten primero entre <b>jugadores distintos</b> — no se repite un jugador mientras haya otro jugador con catapultas disponible (el límite de <b>2 ataques desde la misma aldea al mismo objetivo</b> se mantiene). <b>(2) Más cerca que los offs:</b> un origen de catapulta debe estar ahora al menos <b>8 campos más cerca</b> del objetivo que el off más lejano asignado a él, para que las lentas catapultas se queden dentro del anillo de offs y lleguen en la ventana. Esto puede reducir la oferta, así que cualquier déficit se avisa.`,
    ],
  },
  { ver: 'v3.16.0', date: '2026-06-25',
    en: [
      `<b>📊 Points column in Offensive Targets.</b> A new <b>Points</b> column (right of Defender) shows each target village's points from the world database, and links straight to that village's in-game info page in a new tab. Shows <b>—</b> until the database is loaded.`,
      `<b>🪨 Catapult attacks (extra demolition runs).</b> Two new controls drive a brand-new attack type. In <b>Offensive Targets</b>, a <b>CATAPULTS</b> column (right of POWER) has a checkbox — tick it to set <b>how many catapult attacks</b> you want on that target (default <b>5</b>); untick to send none. On <b>Plan Offensive</b>, a new <b>"Number of catapults"</b> input (default <b>20</b>) sets how many catapults each attack carries. When you generate the plan, those catapult attacks are added <b>on top of the offs</b> — and they come <b>only from your DEFENSIVE villages that own catapults</b> (a village reads as defensive when its spears/swords/heavy/knights outweigh its offensive units; catapults count toward neither). A source village can launch <b>floor(its catapults ÷ Number of catapults)</b> attacks — e.g. 300 catapults at 25 each = 12 attacks — closest targets first, with a working pre-filled rally link on each. At most <b>2 catapult attacks from the same village to the same target</b>, so a player can still hit one target with 4 (two from each of two villages). Catapults have <b>no distance limit</b> and land in the target's off window. If there aren't enough catapult-owning defensive villages, the shortfall is flagged in the warnings. Catapult attacks also flow into <b>every export</b>: catapult rows below the offs in <b>Export Objectives (Forum)</b>, and in <b>Per-Player Orders</b> / <b>Per-Player Table</b> / <b>Per-Player All</b> with the catapult count shown (e.g. <b>(25)</b>) and a pre-filled rally link.`,
    ],
    es: [
      `<b>📊 Columna de Puntos en Objetivos Off.</b> Una nueva columna <b>Puntos</b> (a la derecha de Defensor) muestra los puntos de cada aldea objetivo desde la base de datos del mundo, y enlaza directamente a la página de información de esa aldea en el juego (nueva pestaña). Muestra <b>—</b> hasta que se carga la base de datos.`,
      `<b>🪨 Ataques de catapulta (demoliciones extra).</b> Dos controles nuevos activan un tipo de ataque totalmente nuevo. En <b>Objetivos Off</b>, una columna <b>CATAPULTAS</b> (a la derecha de PODER) tiene una casilla — márcala para indicar <b>cuántos ataques de catapulta</b> quieres en ese objetivo (por defecto <b>5</b>); desmárcala para no enviar ninguno. En <b>Plan Ofensivo</b>, un nuevo campo <b>"Número de catapultas"</b> (por defecto <b>20</b>) define cuántas catapultas lleva cada ataque. Al generar el plan, esos ataques de catapulta se añaden <b>además de los offs</b> — y salen <b>solo de tus aldeas DEFENSIVAS que tienen catapultas</b> (una aldea cuenta como defensiva cuando sus lanceros/espadas/pesada/paladines superan a sus unidades ofensivas; las catapultas no cuentan para ninguno). Una aldea origen puede lanzar <b>floor(sus catapultas ÷ Número de catapultas)</b> ataques — p. ej. 300 catapultas a 25 cada uno = 12 ataques — objetivos más cercanos primero, con un enlace al punto de reunión ya rellenado en cada uno. Como máximo <b>2 ataques de catapulta desde la misma aldea al mismo objetivo</b>, así un jugador puede golpear un objetivo con 4 (dos desde cada una de dos aldeas). Las catapultas <b>no tienen límite de distancia</b> y llegan en la ventana off del objetivo. Si no hay suficientes aldeas defensivas con catapultas, el déficit se avisa. Los ataques de catapulta también aparecen en <b>todas las exportaciones</b>: filas de catapulta debajo de los offs en <b>Exportar Objetivos (Foro)</b>, y en <b>Órdenes por Jugador</b> / <b>Tabla por Jugador</b> / <b>Todo por Jugador</b> con el número de catapultas indicado (p. ej. <b>(25)</b>) y un enlace al punto de reunión ya rellenado.`,
    ],
  },
  { ver: 'v3.15.0', date: '2026-06-25',
    en: [
      `<b>🎯 Min. morale (off).</b> A new <b>"Min. morale (off)"</b> field on <b>Plan Offensive</b> (default <b>100</b>) makes the planner send regular clearing offs only from players whose morale on the target is <b>at or above</b> the threshold — so by default every off lands at full morale. The tier is resolved first exactly as before (a stronger tier still only fills in when the requested one is empty); the gate then picks among <i>that</i> tier's villages, so troop composition is never downgraded for morale. It's a <b>soft</b> gate: if no qualifying village can reach a target, it falls back to the best available sender rather than leaving the off unassigned (a low-morale clear still beats an uncleared target). Set it to <b>0</b> to switch the gate off. The gate only applies when the world DB is loaded (otherwise there's no morale signal). A noble sender's <b>own coordination off is exempt</b> — that one keeps using <b>Min. morale (snob off)</b> (default 90): a snob sender on 96% morale sends both their noble <i>and</i> their own off, while one on 89% sends only the noble and hands the clearing off to a player that clears the off gate.`,
    ],
    es: [
      `<b>🎯 Moral mín. (off).</b> Un nuevo campo <b>"Moral mín. (off)"</b> en <b>Plan Ofensivo</b> (por defecto <b>100</b>) hace que el planificador envíe los offs de limpieza normales solo desde jugadores cuya moral sobre el objetivo alcanza el umbral <b>o más</b> — así, por defecto, cada off llega con moral completa. El tipo de off se resuelve primero igual que antes (un tipo más fuerte solo cubre cuando el pedido está vacío); el filtro elige luego entre las aldeas de <i>ese</i> tipo, de modo que la composición de tropas nunca se rebaja por la moral. Es un filtro <b>flexible</b>: si ninguna aldea válida alcanza el objetivo, recurre al mejor remitente disponible en lugar de dejar el off sin asignar (una limpieza con poca moral sigue siendo mejor que un objetivo sin limpiar). Ponlo en <b>0</b> para desactivarlo. El filtro solo aplica con la base de datos del mundo cargada (si no, no hay señal de moral). El off <b>propio de un emisor de noble está exento</b> — ese sigue usando <b>Moral mín. (off del noble)</b> (por defecto 90): un emisor con 96% de moral envía su noble <i>y</i> su propio off, mientras que uno con 89% envía solo el noble y cede el off de limpieza a un jugador que supere el umbral de off.`,
    ],
  },
  { ver: 'v3.14.0', date: '2026-06-25',
    en: [
      `<b>🏖 MV Players (vacation-mode pairs).</b> A new <b>"MV Players"</b> button in <b>Offensive Targets</b> lets you pair up players who are in vacation mode. Two paired players will <b>never both attack the same enemy player</b> (across all that player's villages) — the game forbids it during vacation mode and for 48h after. Whoever the plan assigns to that defender first claims it; the partner is steered to other targets. The pairing only affects who lands on the same defender — both players stay fully usable everywhere else. (Covers offensive attacks; defensive support isn't included.)`,
      `<b>🙅 Ignore Players now allows nobling.</b> A player on the Ignore Players list is no longer assigned any regular clearing off — but they <b>can still be hand-picked as a noble (snob) sender</b> and will send their train (and its escort). They now appear in the noble-sender dropdown; they're still hidden from the off-sender dropdown and never auto-assigned an off.`,
    ],
    es: [
      `<b>🏖 Jugadores MV (parejas de modo vacaciones).</b> Un nuevo botón <b>"Jugadores MV"</b> en <b>Objetivos Off</b> permite emparejar jugadores que están en modo vacaciones. Dos jugadores emparejados <b>nunca atacarán ambos al mismo jugador enemigo</b> (en ninguna de sus aldeas) — el juego lo prohíbe durante el modo vacaciones y hasta 48h después. El primero que el plan asigne a ese defensor lo reclama; a la pareja se le dirige a otros objetivos. El emparejamiento solo afecta a quién cae sobre el mismo defensor — ambos siguen plenamente utilizables en todo lo demás. (Cubre ataques ofensivos; el apoyo defensivo no está incluido.)`,
      `<b>🙅 Ignorar Jugadores ahora permite enviar nobles.</b> Un jugador en la lista de Ignorar Jugadores ya no recibe ningún off de limpieza normal — pero <b>sí puede elegirse a mano como emisor de nobles</b> y enviará su tren (y su escolta). Ahora aparece en el desplegable de emisores de nobles; sigue oculto del desplegable de emisores de offs y nunca se le asigna un off automáticamente.`,
    ],
  },
  { ver: 'v3.13.0', date: '2026-06-25',
    en: [
      `<b>📊 Plan Offensive: per-tier off-pool breakdown in the summary.</b> Next to the usual <i>"N attacks assigned · M unassigned"</i> line there's now a collapsible <b>"Show Assigned Off Counts"</b> toggle with one line <b>per off tier</b> (Complete / 3-4 / 1-2), each labelled with the tier's <b>gross village count</b> in brackets (e.g. "Complete [356]" — the same total as the Offensive Targets footer). Every village of that tier is accounted for, so the numbers <b>add up to that total</b>: <b>offs assigned</b>, <b>reserved (distance)</b> (within the min-distance buffer of a target, kept home for a fast second wave), <b>reserved (noble launch)</b> (held free so a noble sender can launch its train), <b>reserved (split-off)</b> (riding with a noble as its escort), <b>unused</b> (off-capable but not needed / out of range / no request for that tier) and <b>ignored</b> (excluded via Ignore Coordinates / Ignore Players). So it explains exactly why an <b>Offensive Targets</b> per-tier total like "3/4 111 / 159" can look like plenty while the plan still runs short — you can see precisely how much is reserved, unused or ignored.`,
    ],
    es: [
      `<b>📊 Plan Ofensivo: desglose del fondo de offs por tipo en el resumen.</b> Junto a la línea habitual de <i>"N ataques asignados · M sin asignar"</i> ahora hay un desplegable <b>"Mostrar Recuento Offs Asignadas"</b> con una línea <b>por tipo de off</b> (Completo / 3-4 / 1-2), cada uno etiquetado con el <b>total bruto de aldeas</b> de ese tipo entre corchetes (p. ej. "Completo [356]" — el mismo total que el pie de Objetivos Off). Cada aldea de ese tipo está contabilizada, así que los números <b>suman ese total</b>: <b>offs asignados</b>, <b>reservadas (distancia)</b> (dentro del margen de distancia mínima de un objetivo, guardadas para una segunda oleada rápida), <b>reservadas (lanzamiento de nobles)</b> (libres para que un emisor de noble lance su tren), <b>reservadas (escolta split-off)</b> (acompañando a un noble como su escolta), <b>sin usar</b> (con off pero no necesarias / fuera de alcance / sin petición de ese tipo) e <b>ignoradas</b> (excluidas con Ignorar Coordenadas / Ignorar Jugadores). Así explica exactamente por qué un total por tipo de <b>Objetivos Off</b> como "3/4 111 / 159" puede parecer de sobra mientras el plan se queda corto — se ve con precisión cuánto está reservado, sin usar o ignorado.`,
    ],
  },
  { ver: 'v3.12.0', date: '2026-06-25',
    en: [
      `<b>↻ Apply the default inputs to all existing targets.</b> In <b>Offensive Targets</b>, the inputs at the top (arrival windows, default offs, snob mode) only seeded <i>new</i> targets as you added them — changing them later didn't touch targets already in the list. The defaults are now split across two rows — <b>arrival date + windows</b> on top, <b>default offs + snob mode</b> below — each ending with an apply button (after a divider) that pushes those defaults onto <b>every</b> existing target: <b>"Update arrival times"</b> (off + snob windows — the arrival date is already shared; replaces each target's windows with the single default) and <b>"Update offs &amp; snob mode"</b> (the Complete / 3-4 / 1-2 counts plus Solo / Split Off). Each asks for confirmation first and changes only its own fields.`,
      `<b>🎯 Min. morale for a noble sender's own off.</b> Until now, a target's noble sender was always handed one of its clearing offs from their own villages (so they could time the noble right behind it), <i>regardless of morale</i> — a sender on 60% morale still got the off. A new <b>"Min. morale (snob off)"</b> field on <b>Plan Offensive</b> (default <b>90</b>) changes that: a noble sender keeps their own clearing off only when their morale on that objective is <b>at or above</b> the threshold. Below it, that off is reserved for the <b>best</b> player that can reach the target and also clears the bar — chosen by the same optimize score as the rest of the plan (morale × off power ÷ distance), so a <b>close 96%</b> is preferred over a far 100% rather than morale overriding distance outright. If no qualifying alternative is in range, the noble sender keeps the off after all (a low-morale clear still beats leaving the target uncleared). Set the field to <b>0</b> to switch the gate off and always keep the noble sender's own off. The gate only applies when the world DB is loaded (otherwise there's no morale signal).`,
    ],
    es: [
      `<b>↻ Aplicar los valores por defecto a todos los objetivos existentes.</b> En <b>Objetivos Off</b>, los campos de arriba (ventanas de llegada, offs por defecto, modo noble) solo se aplicaban a los objetivos <i>nuevos</i> al añadirlos — cambiarlos después no tocaba los que ya estaban en la lista. Ahora los valores por defecto se reparten en dos filas — <b>fecha + ventanas de llegada</b> arriba, <b>offs por defecto + modo noble</b> debajo — cada una terminada con un botón (tras un separador) que aplica esos valores a <b>todos</b> los objetivos existentes: <b>"Actualizar horarios de llegada"</b> (ventanas de off + noble — la fecha de llegada ya es común; reemplaza las ventanas de cada objetivo por la única por defecto) y <b>"Actualizar offs y modo noble"</b> (las cantidades Completo / 3-4 / 1-2 más Solo / Split Off). Cada uno pide confirmación y cambia solo sus propios campos.`,
      `<b>🎯 Moral mínima para el off propio del emisor de noble.</b> Hasta ahora, al emisor del noble de un objetivo siempre se le asignaba uno de los offs de limpieza desde sus propias aldeas (para poder cronometrar el noble justo detrás), <i>sin importar la moral</i> — un emisor con 60% de moral igual recibía el off. Un nuevo campo <b>"Moral mín. (off del noble)"</b> en <b>Plan Ofensivo</b> (por defecto <b>90</b>) lo cambia: el emisor del noble conserva su propio off de limpieza solo cuando su moral en ese objetivo alcanza el umbral <b>o más</b>. Por debajo, ese off se reserva para el <b>mejor</b> jugador que pueda alcanzar el objetivo y también supere el umbral — elegido con el mismo criterio de optimización que el resto del plan (moral × poder off ÷ distancia), de modo que un <b>96% cercano</b> se prefiere a un 100% lejano en vez de que la moral pase por encima de la distancia. Si no hay alternativa válida en alcance, el emisor del noble conserva el off de todas formas (una limpieza con poca moral sigue siendo mejor que dejar el objetivo sin limpiar). Pon el campo en <b>0</b> para desactivar el filtro y conservar siempre el off propio del emisor del noble. El filtro solo aplica con la base de datos del mundo cargada (si no, no hay señal de moral).`,
    ],
  },
  { ver: 'v3.11.1', date: '2026-06-20',
    en: [
      `<b>👑 Cleaner noble-train lines.</b> Noble trains now read as just the unit, the assigned player and the arrival window — the redundant <b>"[SNOBS NEED RECRUITING]"</b> flag and <b>"recruit noble — none yet"</b> note are gone everywhere (knowing they have to <i>prepare a noble train</i> already implies it). The <b>Export Objectives (Forum)</b> post also drops the in-range village list, which lives in the per-player exports.`,
      `<b>👑 Snob range list only when it's tight.</b> The <b>"Villages in snob range: …"</b> line now appears <b>only when a player has 1 or 2</b> villages in range — shown as <b>"Only one village in snob range: X"</b> / <b>"Only two villages in snob range: X, Y"</b>. With <b>3 or more</b> in range no coordinates are listed (they have plenty of room to coordinate their own train); with none, the "No villages in snob range" note still shows.`,
      `<b>🔤 Noble-sender dropdown sorted A-Z.</b> In <b>Offensive Targets</b>, the noble-sender assignment dropdown is now sorted alphabetically (case-insensitive), matching the Ignore Players picker, instead of by noble count. Each option still shows the player's noble count as "(N)".`,
    ],
    es: [
      `<b>👑 Líneas de tren de nobles más limpias.</b> Los trenes de nobles ahora se leen como solo la unidad, el jugador asignado y la ventana de llegada — la etiqueta redundante <b>"[NECESITAS RECLUTAR NOBLES]"</b> y la nota <b>"reclutar noble — aún ninguno"</b> desaparecen de todas partes (saber que hay que <i>preparar un tren de nobles</i> ya lo implica). El export <b>Exportar Objetivos (Foro)</b> también deja de listar las aldeas en alcance, que viven en los exports por jugador.`,
      `<b>👑 Lista de alcance de noble solo cuando es ajustado.</b> La línea <b>"Aldeas en alcance de noble: …"</b> ahora aparece <b>solo cuando un jugador tiene 1 o 2</b> aldeas en alcance — mostrada como <b>"Solo una aldea en alcance de noble: X"</b> / <b>"Solo dos aldeas en alcance de noble: X, Y"</b>. Con <b>3 o más</b> en alcance no se listan coordenadas (tienen margen de sobra para coordinar su propio tren); sin ninguna, la nota "Sin aldeas en alcance de noble" sigue apareciendo.`,
      `<b>🔤 Desplegable de emisor de noble ordenado A-Z.</b> En <b>Objetivos Off</b>, el desplegable de asignación de emisor de noble ahora se ordena alfabéticamente (sin distinguir mayúsculas), igual que el selector de Ignorar Jugadores, en vez de por cantidad de nobles. Cada opción sigue mostrando la cantidad de nobles del jugador como "(N)".`,
    ],
  },
  { ver: 'v3.11.0', date: '2026-06-20',
    en: [
      `<b>👑 Snob trains now list the villages in noble range.</b> Since a noble target is usually <i>assigned to a player who then recruits the noble</i> (rather than sent from an existing one), every noble train now shows a <b>"Villages in snob range: …"</b> line — that player's own villages within noble range (≤ the Snob Max distance, 70 by default) of the objective. Villages of <b>5,000 points or fewer are hidden</b> (likely no Academy); if the world DB isn't loaded, points are unknown so all in-range villages are shown. When none qualify it shows <b>"No villages in snob range (>5,000 pts)"</b> instead. The list appears in the <b>Plan Offensive</b> table (under the "Prepare Snob Train" note) and in the <b>Export Objectives (Forum)</b>, <b>Export Per-Player Orders</b> and <b>Export Per-Player Table</b> outputs.`,
      `<b>👑 Noble trains leave the export table.</b> In <b>Export Per-Player Table</b>, noble trains are no longer rows inside the <code>[table]</code> (they have no launch village to fill the Source/Send/URL columns) — they're listed as text <b>below</b> the table, like the Per-Player Orders. The Plan Offensive on-screen table is unchanged: noble trains stay as rows there.`,
      `<b>⏱ Tribe Timings: village points column + Min Points filter.</b> The Tribe Timings table now shows a <b>Points</b> column (the village's own points, from the world DB) between <b>Player</b> and <b>Distance</b>, and a <b>Min Points</b> filter sits next to Min Power. Villages with unknown points (no DB loaded) show "—" and are hidden when a Min Points threshold is set. The column also flows into the Export Forum Table and Export CSV outputs.`,
      `<b>👑 Fewer Plan Offensive warnings.</b> The "<i>X has not enough nobles: N assigned, but only M available</i>" and "<i>X has no noble for Y — recruit N nobles…</i>" alerts no longer appear in Plan Offensive — assigning a noble target to a player before they've recruited the nobles is the normal workflow, not an error. The train still shows with its "⚠ Prepare Snob Train ⚠ [SNOBS NEED RECRUITING]" label and the in-range village list. Real problems still warn — e.g. "<i>X's snob villages are beyond the noble travel range for Y</i>", trains that can't arrive in time, and config mismatches.`,
    ],
    es: [
      `<b>👑 Los trenes de nobles ahora listan las aldeas en alcance de noble.</b> Como un objetivo de noble normalmente se <i>asigna a un jugador que luego recluta el noble</i> (en vez de enviarlo desde uno existente), cada tren de nobles ahora muestra una línea <b>"Aldeas en alcance de noble: …"</b> — las aldeas propias de ese jugador dentro del alcance de noble (≤ la distancia Máx Noble, 70 por defecto) del objetivo. Se <b>ocultan las aldeas de 5.000 puntos o menos</b> (probablemente sin Academia); si la BD del mundo no está cargada, los puntos son desconocidos y se muestran todas las aldeas en alcance. Si ninguna cumple, muestra <b>"Sin aldeas en alcance de noble (>5.000 ptos)"</b>. La lista aparece en la tabla de <b>Planear Ofensiva</b> (bajo la nota "Prepara el Tren de Nobles") y en los exports <b>Exportar Objetivos (Foro)</b>, <b>Exportar Órdenes por Jugador</b> y <b>Exportar Tabla por Jugador</b>.`,
      `<b>👑 Los trenes de nobles salen de la tabla de exportación.</b> En <b>Exportar Tabla por Jugador</b>, los trenes de nobles ya no son filas dentro de la <code>[table]</code> (no tienen aldea de salida con la que rellenar las columnas Origen/Envío/Enlace) — se listan como texto <b>debajo</b> de la tabla, igual que las Órdenes por Jugador. La tabla en pantalla de Planear Ofensiva no cambia: ahí los trenes de nobles siguen siendo filas.`,
      `<b>⏱ Tiempos de Tribu: columna de puntos + filtro Puntos mín.</b> La tabla de Tiempos de Tribu ahora muestra una columna <b>Puntos</b> (los puntos propios de la aldea, de la BD del mundo) entre <b>Jugador</b> y <b>Distancia</b>, y un filtro <b>Puntos mín.</b> junto a Poder mín. Las aldeas con puntos desconocidos (sin BD cargada) muestran "—" y se ocultan si se fija un umbral de Puntos mín. La columna también aparece en los exports Exportar Tabla de Foro y Exportar CSV.`,
      `<b>👑 Menos avisos en Planear Ofensiva.</b> Los avisos "<i>X no tiene suficientes nobles: N asignados, pero solo M disponibles</i>" y "<i>X no tiene noble para Y — recluta N nobles…</i>" ya no aparecen en Planear Ofensiva — asignar un objetivo de noble a un jugador antes de que haya reclutado los nobles es el flujo normal, no un error. El tren sigue apareciendo con su etiqueta "⚠ Prepara el Tren de Nobles ⚠ [NECESITAS RECLUTAR NOBLES]" y la lista de aldeas en alcance. Los problemas reales siguen avisando — p. ej. "<i>Las aldeas con nobles de X están fuera del alcance de los nobles para Y</i>", trenes que no llegan a tiempo y desajustes de configuración.`,
    ],
  },
  { ver: 'v3.10.2', date: '2026-06-19',
    en: [
      `<b>🪓 Plan Offensive exports tag partial offs as axe.</b> In every Plan Offensive export, a <b>Complete</b> off still shows <code>[unit]ram[/unit]</code>, but a <b>3/4</b> or <b>1/2</b> off now shows <code>[unit]axe[/unit] (3/4)</code> / <code>[unit]axe[/unit] (1/2)</code> so the off size is clear at a glance. Split offs stay <code>[unit]axe[/unit][unit]snob[/unit]</code> and solo nobles stay <code>[unit]snob[/unit]</code>.`,
    ],
    es: [
      `<b>🪓 Los exports de Planear Ofensiva marcan los offs parciales como hacha.</b> En cada export de Planear Ofensiva, un off <b>Completo</b> sigue mostrando <code>[unit]ram[/unit]</code>, pero un off <b>3/4</b> o <b>1/2</b> ahora muestra <code>[unit]axe[/unit] (3/4)</code> / <code>[unit]axe[/unit] (1/2)</code> para que el tamaño del off se vea de un vistazo. Las offs partidas siguen siendo <code>[unit]axe[/unit][unit]snob[/unit]</code> y los nobles solos siguen siendo <code>[unit]snob[/unit]</code>.`,
    ],
  },
  { ver: 'v3.10.1', date: '2026-06-19',
    en: [
      `<b>⬇ Export Per-Player Orders — sorted by send time, easier to read.</b> Each player's attack lines now come out <b>in send-time order</b> (earliest launch first), matching the Per-Player Table, and a <b>blank line</b> separates each attack so the orders are easier to scan and copy. This also flows into <b>Export Per-Player All</b>.`,
    ],
    es: [
      `<b>⬇ Exportar Órdenes por Jugador — ordenadas por hora de envío, más fáciles de leer.</b> Las líneas de ataque de cada jugador ahora salen <b>ordenadas por hora de envío</b> (la salida más temprana primero), igual que la Tabla por Jugador, y una <b>línea en blanco</b> separa cada ataque para que las órdenes se lean y copien mejor. Esto también se aplica a <b>Exportar Todo por Jugador</b>.`,
    ],
  },
  { ver: 'v3.10.0', date: '2026-06-19',
    en: [
      `<b>📋 Export Per-Player Table (Plan Offensive).</b> A new <b>Export Per-Player Table</b> button (next to Export Per-Player Orders) outputs a forum <code>[table]</code> per player — columns <b>#, Source, Target, Target Player, Type, Send time, Arrival time, Attack URL</b> — with each player's rows sorted by send time. Type shows the unit icon + name (Off / Snob / Split Off Snob); offs carry an "open" rally link, while noble trains (which have no fixed launch village) show a "Prepare Snob Train" note instead.`,
      `<b>📥 Export Per-Player All (Plan Offensive).</b> A new <b>Export Per-Player All</b> button downloads a single <code>.txt</code> where each player's section combines, in order: their Per-Player Orders (arrival date + attack lines + the full objective if they send a noble) <i>and</i> their Per-Player attack table — so you can hand one file straight to each player. Each player's content is wrapped in a forum <code>[code]…[/code]</code> block (the <code>====== name ======</code> header stays outside it) for clean one-click copy.`,
      `<b>🧹 Clearer export buttons.</b> The export/action buttons on every plan tab are now grouped with thin <code>|</code> dividers (like the map toolbar) and given clearer names: Plan Offensive's <b>Export Forum BB → Export Objectives (Forum)</b> and <b>Export Per-Player BB → Export Per-Player Orders</b> (Plan Defense too); Tribe Timings now leads with <b>Export Forum Table</b>; and the <b>Bulk Add</b> buttons on both Targets tabs are now <b>Bulk Add Coordinates</b>.`,
    ],
    es: [
      `<b>📋 Exportar Tabla por Jugador (Planear Ofensiva).</b> Un nuevo botón <b>Exportar Tabla por Jugador</b> (junto a Exportar Órdenes por Jugador) genera una <code>[table]</code> de foro por jugador — columnas <b>#, Origen, Objetivo, Jugador Objetivo, Tipo, Hora de envío, Hora de llegada, Enlace de ataque</b> — con las filas de cada jugador ordenadas por hora de envío. El Tipo muestra el icono de unidad + nombre (Off / Noble / Noble Partir Off); los offs llevan un enlace "abrir" al punto de reunión, mientras que los trenes de nobles (que no tienen aldea de salida fija) muestran una nota "Prepara el Tren de Nobles".`,
      `<b>📥 Exportar Todo por Jugador (Planear Ofensiva).</b> Un nuevo botón <b>Exportar Todo por Jugador</b> descarga un único <code>.txt</code> donde la sección de cada jugador combina, en orden: sus Órdenes por Jugador (fecha de llegada + líneas de ataque + el objetivo completo si envía un noble) <i>y</i> su tabla de ataques por jugador — para que puedas entregar un solo archivo a cada jugador. El contenido de cada jugador va envuelto en un bloque de foro <code>[code]…[/code]</code> (la cabecera <code>====== nombre ======</code> queda fuera) para copiarlo de un clic.`,
      `<b>🧹 Botones de exportación más claros.</b> Los botones de exportación/acción de cada pestaña de plan ahora se agrupan con finos divisores <code>|</code> (como la barra del mapa) y tienen nombres más claros: en Planear Ofensiva <b>Exportar BB Foro → Exportar Objetivos (Foro)</b> y <b>Exportar BB por Jugador → Exportar Órdenes por Jugador</b> (también en Planear Defensa); Tiempos de Tribu ahora empieza con <b>Exportar Tabla de Foro</b>; y los botones <b>Añadir en Masa</b> de ambas pestañas de Objetivos pasan a <b>Añadir Coordenadas</b>.`,
    ],
  },
  { ver: 'v3.9.0', date: '2026-06-18',
    en: [
      `<b>🚫 Ignore Coordinates (Offensive Targets).</b> A new <b>Ignore Coordinates</b> box on the Offensive Targets tab lets you list your own villages that must <b>never send anything</b> — no off, no noble train, no split-off escort. Listed villages are dropped from the planner entirely, so they stay free for whatever you're holding them for.`,
      `<b>🙅 Ignore Players (Offensive Targets).</b> A new <b>Ignore Players</b> picker (same chip style as the snob senders) lets you exclude whole players from the plan in one click — none of their villages are ever assigned, and they're hidden from the off- and snob-sender selectors so you can't pin them by accident.`,
      `<b>🛡️ Ignore Coordinates &amp; Enemy Tribes moved to Defensive Targets.</b> The defensive <b>Ignore Coordinates</b> box and the <b>Enemy Tribes</b> control (with its distance field) now live on the <b>Defensive Targets</b> tab (next to where you set objectives) instead of Plan Defense — same behaviour, just a more natural home.`,
    ],
    es: [
      `<b>🚫 Ignorar Coordenadas (Objetivos Ofensivos).</b> Una nueva caja <b>Ignorar Coordenadas</b> en la pestaña de Objetivos Ofensivos te deja listar tus propias aldeas que <b>nunca deben enviar nada</b> — ni off, ni tren de nobles, ni escolta. Las aldeas listadas se excluyen por completo del planificador, así que quedan libres para lo que sea que las estés reservando.`,
      `<b>🙅 Ignorar Jugadores (Objetivos Ofensivos).</b> Un nuevo selector <b>Ignorar Jugadores</b> (con el mismo estilo de fichas que los remitentes de nobles) te deja excluir jugadores enteros del plan con un clic — ninguna de sus aldeas se asigna jamás, y se ocultan de los selectores de remitentes de off y de nobles para que no los fijes por error.`,
      `<b>🛡️ Ignorar Coordenadas y Tribus Enemigas movidos a Objetivos Defensivos.</b> La caja defensiva <b>Ignorar Coordenadas</b> y el control <b>Tribus Enemigas</b> (con su campo de distancia) ahora viven en la pestaña <b>Objetivos Defensivos</b> (junto a donde defines los objetivos) en vez de en Planear Defensa — mismo comportamiento, solo un sitio más natural.`,
    ],
  },
  { ver: 'v3.8.0', date: '2026-06-18',
    en: [
      `<b>🗺️ All three troop categories in the map tooltip.</b> Hovering a village now shows up to three stacked sections from the combined <b>tribe_everything.txt</b> export: <b>Owned Village Troops</b> (the village's own army), <b>Troops In Village</b> (everything currently stationed there — its own plus any foreign support), and <b>Inbound Troops</b> (troops returning/incoming to the village). Each section lists its per-unit counts.`,
      `<b>⚔️🛡️ Role-aware power lines.</b> <b>Owned Village Troops</b> shows <b>Off Power</b> for an offensive village (red axe) and <b>Def Power</b> for a defensive one (blue sword). <b>Troops In Village</b> shows <b>both</b> Off and Def Power, and <b>Inbound Troops</b> shows <b>Def Power</b> only. Empty stationed/inbound sections are hidden.`,
    ],
    es: [
      `<b>🗺️ Las tres categorías de tropas en el tooltip del mapa.</b> Al pasar el ratón por una aldea ahora se muestran hasta tres secciones apiladas desde el export combinado <b>tribe_everything.txt</b>: <b>Tropas Propias de la Aldea</b> (el ejército propio de la aldea), <b>Tropas en la Aldea</b> (todo lo que está estacionado allí — las propias más cualquier apoyo externo) y <b>Tropas Entrantes</b> (tropas que regresan/entran a la aldea). Cada sección lista sus unidades una a una.`,
      `<b>⚔️🛡️ Líneas de poder según el rol.</b> <b>Tropas Propias de la Aldea</b> muestra <b>Pod. Off</b> para una aldea ofensiva (hacha roja) y <b>Pod. Def</b> para una defensiva (espada azul). <b>Tropas en la Aldea</b> muestra <b>ambos</b> Pod. Off y Pod. Def, y <b>Tropas Entrantes</b> muestra solo <b>Pod. Def</b>. Las secciones vacías de estacionadas/entrantes se ocultan.`,
    ],
  },
  { ver: 'v3.7.1', date: '2026-06-18',
    en: [
      `<b>🛡️⚔️ Cleaner Off / Def Power.</b> Power is now scored from a simple unit list each. <b>Defensive Power = spears + swords + heavy cavalry + paladins</b> only — the dedicated defensive units. <b>Offensive Power = axes + light cavalry + rams + catapults + nobles.</b> Offensive/hybrid units (light cav, catapults, scouts) no longer leak into Defensive Power, so a full off village no longer reads as having hundreds of thousands of phantom "defence".`,
    ],
    es: [
      `<b>🛡️⚔️ Poder Ofensivo / Defensivo más limpio.</b> El poder se calcula ahora con una lista simple de unidades para cada uno. <b>Poder Defensivo = lanceros + espadas + caballería pesada + paladines</b> únicamente — las unidades puramente defensivas. <b>Poder Ofensivo = hachas + caballería ligera + arietes + catapultas + nobles.</b> Las unidades ofensivas/híbridas (caballería ligera, catapultas, exploradores) ya no se cuelan en el Poder Defensivo, así que una aldea puramente ofensiva ya no muestra cientos de miles de "defensa" fantasma.`,
    ],
  },
  { ver: 'v3.7.0', date: '2026-06-18',
    en: [
      `<b>👑 The conqueror always sends one of its target's offs.</b> When a player is set to noble a village, the planner now <b>guarantees</b> one of that target's requested clearing offs comes from the conqueror's own villages — reserved up front so another target can't grab it first — and it lands <b>last, right before the noble</b>, so they control the final clear→snob handoff. The tier is respected (a lower-tier off never substitutes for a higher one); if all their offs are out of range or held for the launch, none is forced. Works for solo and split-off (escorted) trains.`,
      `<b>🗺️ New “Heatmap Config” menu.</b> All the map's overlay controls now live in one tidy fly-out (button in the map toolbar), grouped into collapsible <b>Incoming Attacks / Defensive Plan / Offensive Plan</b> sections — each with an <b>All</b> button to flip its whole group on or off.`,
      `<b>✨ Four new village halos.</b> <b>Snob Reserved</b> (yellow) on villages held back for a noble launch, <b>Unused Offs</b> (red) on offensive villages your plan didn't commit, and <b>Villages Sending Support</b> (white) / <b>Villages Sending Off</b> (black) on the origins of your plans. All off by default.`,
      `<b>🔎 Focus filters.</b> <b>Defensive / Offensive Villages Only</b> fade the opposite side so you can read support or attack flow at a glance, and the <b>Complete / 3-4 / 1-2</b> chips hide off villages by tier. Plus a <b>Show Barbs</b> toggle to declutter barbarians.`,
      `<b>🎨 Config Colors.</b> Every plan line and halo colour is now editable to your taste (with a one-click reset), saved in your browser.`,
    ],
    es: [
      `<b>👑 El conquistador siempre envía una de las ofensivas de su objetivo.</b> Cuando un jugador va a noblear una aldea, el planificador ahora <b>garantiza</b> que una de las ofensivas de limpieza pedidas para ese objetivo salga de las propias aldeas del conquistador — reservada de antemano para que otro objetivo no la tome primero — y aterriza <b>la última, justo antes del noble</b>, para controlar el relevo limpieza→noble. Se respeta el tier (una ofensiva de menor tier nunca sustituye a una mayor); si todas sus ofensivas están fuera de rango o reservadas para el lanzamiento, no se fuerza ninguna. Funciona en trenes solo y con escolta (split-off).`,
      `<b>🗺️ Nuevo menú “Config Mapa de Calor”.</b> Todos los controles de superposición del mapa viven ahora en un único panel desplegable (botón en la barra del mapa), agrupados en secciones plegables de <b>Ataques Entrantes / Plan Defensivo / Plan Ofensivo</b> — cada una con un botón <b>Todo</b> para encender o apagar todo su grupo.`,
      `<b>✨ Cuatro nuevos halos de aldea.</b> <b>Reservados Snob</b> (amarillo) en aldeas guardadas para lanzar un noble, <b>Ofensivas sin Usar</b> (rojo) en aldeas ofensivas que tu plan no usó, y <b>Aldeas Enviando Apoyo</b> (blanco) / <b>Aldeas Enviando Ofensiva</b> (negro) en los orígenes de tus planes. Todos desactivados por defecto.`,
      `<b>🔎 Filtros de enfoque.</b> <b>Solo Aldeas Defensivas / Ofensivas</b> atenúan el lado contrario para leer de un vistazo el flujo de apoyo o de ataque, y los chips <b>Completa / 3-4 / 1-2</b> ocultan aldeas ofensivas por tier. Además un interruptor <b>Mostrar Bárbaros</b> para despejar las bárbaras.`,
      `<b>🎨 Config Colores.</b> Cada color de línea y halo del plan es ahora editable a tu gusto (con reinicio de un clic), guardado en tu navegador.`,
    ],
  },
  { ver: 'v3.6.0', date: '2026-06-17',
    en: [
      `<b>📥 Reads the new combined troop export.</b> The troop-file box now also accepts <b>tribe_everything.txt</b> (the combined export from the troop-counter script), reading its <b>troops</b> rows. The usual <b>tribe info.txt</b> still loads exactly as before — with or without the incoming-attacks column — and you can even drop both kinds of file together. (Defense and incoming-troop rows are recognised but not used yet — coming soon.)`,
      `<b>🗺️ Barbarian villages no longer flagged for incoming attacks on the map.</b> The incoming-attack halo is now skipped on barbarian / abandoned villages.`,
    ],
    es: [
      `<b>📥 Lee el nuevo export combinado de tropas.</b> La caja de archivo de tropas ahora también acepta <b>tribe_everything.txt</b> (el export combinado del script contador de tropas), leyendo sus filas de <b>tropas</b>. El <b>tribe info.txt</b> de siempre se sigue cargando igual que antes — con o sin la columna de ataques entrantes — e incluso puedes soltar ambos tipos de archivo juntos. (Las filas de defensa y de tropas entrantes se reconocen pero aún no se usan — próximamente.)`,
      `<b>🗺️ Las aldeas bárbaras ya no se marcan por ataques entrantes en el mapa.</b> El halo de ataques entrantes ahora se omite en las aldeas bárbaras / abandonadas.`,
    ],
  },
  { ver: 'v3.5.0', date: '2026-06-17',
    en: [
      `<b>➡️ Attack routes drawn on the map.</b> With a <b>Plan Offensive</b> generated, each attack with a known origin now draws a faint <b>green line from the sending village to its target</b> (matching the green objective halos), arrow-tipped at the target — so you can see at a glance where every blow comes from. <b>Hover a village</b> and the lines touching it light up <b>bold and bright</b> (its incoming attacks if it's a target, or where its attacks go if it's a sender). Snob trains and still-unassigned attacks have no fixed origin, so they show no line.`,
      `<b>🩷 Support routes too.</b> A <b>Plan Defense</b> now draws the same lines in <b>pink</b> (matching the pink support halos), from each sending village to the village it reinforces — with the same hover highlight.`,
      `<b>New “Show Attack Lines” / “Show Support Lines” toggles</b> in the map toolbar (both off by default) turn the routes on/off independently.`,
    ],
    es: [
      `<b>➡️ Rutas de ataque dibujadas en el mapa.</b> Con un <b>Plan Ofensivo</b> generado, cada ataque con origen conocido dibuja ahora una <b>línea verde tenue desde la aldea atacante hasta su objetivo</b> (a juego con los halos verdes de objetivo), con punta de flecha en el objetivo — para ver de un vistazo de dónde sale cada golpe. <b>Pasa el ratón por una aldea</b> y las líneas que la tocan se resaltan <b>en grueso y brillante</b> (sus ataques entrantes si es un objetivo, o adónde van sus ataques si es una atacante). Los trenes de noble y los ataques aún sin asignar no tienen origen fijo, así que no muestran línea.`,
      `<b>🩷 También las rutas de apoyo.</b> Un <b>Plan Defensivo</b> dibuja ahora las mismas líneas en <b>rosa</b> (a juego con los halos rosas de apoyo), desde cada aldea emisora hasta la aldea que refuerza — con el mismo resaltado al pasar el ratón.`,
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
