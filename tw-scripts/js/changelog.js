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
// ⚠ Only the CURRENT major (v4.x) lives here — v3.x and older were moved to
// js/changelog-archive.js (2026-07-24) and are concatenated below, so the
// rendered Changelog tab is unchanged. When v5.0.0 lands, move the v4 entries
// into the archive and start this array fresh.
// ══════════════════════════════════════════════════════════════
const CHANGELOG_CURRENT = [
  { ver: 'v4.28.1', date: '2026-08-01',
    en: [
      `<b>🟢🔴 Readiness color now sits on the SEND ▶ link only.</b> Live feedback on v4.28.0: coloring the whole order line was too loud. The per-player Orders/PM lines are back to plain text — only the <b>SEND ▶</b> link is <b>green</b> when the order can go right now, or <b>red</b> when part of the army is still returning. Ready-first ordering and the "Send now:" / "Send when your troops return:" group labels are unchanged.`,
    ],
    es: [
      `<b>🟢🔴 El color de disponibilidad ahora va solo en el enlace ENVIAR ▶.</b> Feedback en vivo sobre la v4.28.0: colorear toda la línea de la orden era demasiado. Las líneas de Órdenes/MPs por jugador vuelven a texto normal — solo el enlace <b>ENVIAR ▶</b> es <b>verde</b> cuando la orden puede salir ya, o <b>rojo</b> cuando parte del ejército aún está volviendo. El orden listas-primero y las etiquetas "Enviar ya:" / "Enviar cuando vuelvan tus tropas:" no cambian.`,
    ],
  },
  { ver: 'v4.28.0', date: '2026-08-01',
    en: [
      `<b>🟢🔴 Per-player defense orders are now colored by readiness.</b> In <b>⬇ Export Per-Player Orders</b> and <b>✉ Export PMs</b>, each order line is now <b>green</b> when every unit is home and the order can be sent right now, and <b>red</b> when part of the army is still returning and the order has to wait. The old ⏳ list of returning units is gone from these exports — it made busy lines even busier — the color alone tells the player whether to send or wait (the per-unit ⏳ detail is still shown in the plan table itself). The depart/arrive times ride inside the line color now; the send-by deadline keeps its bold.`,
      `<b>📋 Ready orders come first.</b> Within each player's block the orders are re-ordered: everything they can send <b>right now</b> comes first, then the orders <b>waiting on returning troops</b>. When a player has orders that must wait, the two groups are introduced by short bold labels ("Send now:" / "Send when your troops return:"); a player whose orders are all ready just gets a plain green list. Order numbering in the PMs runs straight through both groups, and the supportSender export is untouched (it keeps the plan's target-first order).`,
    ],
    es: [
      `<b>🟢🔴 Las órdenes de defensa por jugador ahora se colorean según su disponibilidad.</b> En <b>⬇ Exportar Órdenes por Jugador</b> y <b>✉ Exportar MPs</b>, cada línea de orden es ahora <b>verde</b> cuando todas las unidades están en casa y la orden se puede enviar ya, y <b>roja</b> cuando parte del ejército aún está volviendo y la orden tiene que esperar. La antigua lista ⏳ de unidades que vuelven desaparece de estas exportaciones — recargaba aún más unas líneas ya densas — el color por sí solo le dice al jugador si enviar o esperar (el detalle ⏳ por unidad sigue visible en la tabla del plan). Las horas de salida/llegada van ahora dentro del color de la línea; la hora límite de salida conserva su negrita.`,
      `<b>📋 Las órdenes listas van primero.</b> Dentro del bloque de cada jugador las órdenes se reordenan: primero todo lo que puede enviar <b>ya mismo</b>, después las órdenes que <b>esperan tropas que vuelven</b>. Cuando un jugador tiene órdenes que deben esperar, los dos grupos se presentan con etiquetas cortas en negrita ("Enviar ya:" / "Enviar cuando vuelvan tus tropas:"); un jugador con todas sus órdenes listas ve simplemente una lista verde. La numeración de las órdenes en los MPs continúa a través de ambos grupos, y la exportación de supportSender no cambia (mantiene el orden por objetivo del plan).`,
    ],
  },
  { ver: 'v4.27.0', date: '2026-08-01',
    en: [
      `<b>💯 Complete Players in Defensive Targets.</b> A new <b>Complete Players</b> button next to Ignore Players — pick whole players (same chip picker) whose villages send <b>100% of their available defense</b> when you Plan Defense. They are drained <b>before</b> anyone else contributes, with no fair-share rationing, no pack sizing and no small-garrison floor — even a village holding a handful of spears ships them. Their villages still obey the sender holds: anything within the <b>enemy-tribe distance</b>, on Ignore Coordinates or outside a drawn map area stays home, and "available" still means defense at home or returning — deployed troops are never recalled. If a Complete player's defense couldn't all be placed (the reachable targets simply don't ask for that much, or deadlines/range bar them), the plan says so in a warning instead of leaving them quietly half-drained. The list is remembered with the rest of the defensive plan.`,
    ],
    es: [
      `<b>💯 Jugadores Completos en Objetivos Defensivos.</b> Nuevo botón <b>Jugadores Completos</b> junto a Ignorar Jugadores — elige jugadores enteros (mismo selector de fichas) cuyas aldeas envían el <b>100% de su defensa disponible</b> al hacer el Plan de Defensa. Se vacían <b>antes</b> de que nadie más aporte, sin reparto equitativo, sin tamaño de paquetes y sin el mínimo de guarnición — incluso una aldea con un puñado de lanzas las envía. Sus aldeas siguen respetando las retenciones de remitente: lo que esté dentro de la <b>distancia de tribus enemigas</b>, en Ignorar Coordenadas o fuera de un área dibujada en el mapa se queda en casa, y "disponible" sigue siendo la defensa en casa o volviendo — las tropas desplegadas nunca se retiran. Si la defensa de un Jugador Completo no se pudo colocar entera (los objetivos alcanzables no piden tanto, o el rango/los plazos lo impiden), el plan lo avisa en vez de dejarlo a medio vaciar en silencio. La lista se recuerda con el resto del plan defensivo.`,
    ],
  },
  { ver: 'v4.26.0', date: '2026-07-27',
    en: [
      `<b>🏠 Plan Defense now sends defense that is HOME first.</b> Until now the plan treated every unit it could see as sendable — including troops still walking back from an attack, a support or a scavenging run. It now fills each target from defense that is <b>actually home</b>, and only dips into <b>returning</b> troops when home defense can't cover the ask. On a real 3,564-village export that removed <b>108,610 spear, 57,936 sword and 12,440 heavy</b> of orders that quietly depended on troops not being back yet — spread over 189 villages. Total defense assigned is unchanged, and orders came out <b>chunkier</b> (fewer, bigger trips), not more fragmented.`,
      `<b>⏳ Orders that still wait on returning troops are now labelled.</b> When home defense genuinely isn't enough, the order still gets made — but the plan row, the plan summary ("N waiting on returning troops") and the per-player orders/PMs all say how much of it is <b>still returning</b>, so the player knows to wait for those troops instead of sending short. This is separate from the existing red "late" flag: ⏳ means <i>the army isn't home yet</i>, late means <i>the trip can't make the deadline</i>. Note the tribe export contains no return times, so the calculator knows the amount but never the ETA.`,
    ],
    es: [
      `<b>🏠 El Plan Defensivo ahora envía primero la defensa que está EN CASA.</b> Hasta ahora el plan trataba como enviable todo lo que veía — incluidas las tropas que aún volvían de un ataque, un apoyo o una recolección. Ahora reparte cada objetivo desde la defensa que está <b>realmente en casa</b>, y solo recurre a las tropas <b>que vuelven</b> cuando la defensa en casa no llega. En una exportación real de 3.564 aldeas eso eliminó <b>108.610 lanzas, 57.936 espadas y 12.440 caballería pesada</b> en órdenes que dependían en silencio de tropas que aún no habían vuelto — repartidas en 189 aldeas. La defensa total asignada no cambia, y las órdenes salieron <b>más gordas</b> (menos viajes, más grandes), no más fragmentadas.`,
      `<b>⏳ Las órdenes que esperan tropas que vuelven ahora se marcan.</b> Cuando la defensa en casa de verdad no llega, la orden se hace igual — pero la fila del plan, el resumen del plan ("N esperando tropas que vuelven") y las órdenes/MPs por jugador indican cuánto está <b>aún volviendo</b>, para que el jugador espere a esas tropas en vez de enviar de menos. Es distinto de la marca roja "tarde" que ya existía: ⏳ significa <i>el ejército aún no está en casa</i>, tarde significa <i>el viaje no llega a la fecha</i>. Ojo: la exportación de tribu no incluye horas de regreso, así que la calculadora sabe la cantidad pero nunca cuándo llegan.`,
    ],
  },
  { ver: 'v4.25.0', date: '2026-07-27',
    en: [
      `<b>⬇ Export Summary Tables on the Defensive Plan.</b> New button next to Export Per-Player Orders: it opens the familiar copy popup with <b>one 📋 button per player</b>, each copying that player's own compact <b>BB table</b> — ready to paste straight into a PM to them (or into the forum). Columns are <b>Target</b>, <b>Target Player</b> and then <b>one column per unit type</b> (plain numbers, the unit named by the icon in the header), closed by a <b>Total</b> row that sums each column. It's a recap, not an order list: there is no source-village column, and if a player supports the same target from several villages those are <b>merged into one row</b> with the combined troops. For the per-village detail (with send/arrive times and the rally link) keep using <b>⬇ Export Per-Player Orders</b> or <b>📜 Export supportSender</b>.`,
      `<b>📝 New PM-template placeholder: {bb_summary_table}.</b> Drop it anywhere in the <b>Defensive Plan</b>'s PM template (📝 Template inside ✉ Export PMs) and every copied PM gets that player's own summary table inline — e.g. <b>[spoiler=Recap]{bb_summary_table}[/spoiler]</b> above their orders, so one message carries both the recap and the full order list. Each player receives their own table, and the table is always placed on its own line so the forum/game renders it properly.`,
      `<b>📝 The template editor now lists its placeholders.</b> Instead of one dense paragraph, the 📝 Template editor shows a <b>list with one line per placeholder</b> and its explanation. Each plan side lists only the placeholders that actually work there — the Offensive Plan shows {orders}, {date} and {part}; the Defensive Plan shows {orders}, {bb_summary_table} and {part} — so you're never offered a placeholder that would just sit there as literal text.`,
    ],
    es: [
      `<b>⬇ Exportar Tablas Resumen en el Plan Defensivo.</b> Nuevo botón junto a Exportar Órdenes por Jugador: abre la ventana de copiado de siempre con <b>un botón 📋 por jugador</b>, y cada uno copia la <b>tabla BB compacta</b> de ese jugador — lista para pegar directamente en un MP para él (o en el foro). Las columnas son <b>Objetivo</b>, <b>Jugador Objetivo</b> y luego <b>una columna por tipo de unidad</b> (números a secas, con la unidad indicada por el icono de la cabecera), cerrada por una fila de <b>Total</b> que suma cada columna. Es un resumen, no una lista de órdenes: no hay columna de aldea de origen, y si un jugador apoya el mismo objetivo desde varias aldeas, esas se <b>fusionan en una sola fila</b> con las tropas combinadas. Para el detalle por aldea (con horas de salida/llegada y el enlace al punto de reunión) sigue usando <b>⬇ Exportar Órdenes por Jugador</b> o <b>📜 Exportar supportSender</b>.`,
      `<b>📝 Nuevo marcador de plantilla de MP: {bb_summary_table}.</b> Ponlo donde quieras en la plantilla de MP del <b>Plan Defensivo</b> (📝 Plantilla dentro de ✉ Exportar MPs) y cada MP copiado incluirá la tabla resumen de ese jugador — p. ej. <b>[spoiler=Resumen]{bb_summary_table}[/spoiler]</b> encima de sus órdenes, así un solo mensaje lleva el resumen y la lista completa de órdenes. Cada jugador recibe su propia tabla, y la tabla siempre se coloca en su propia línea para que el foro/juego la renderice bien.`,
      `<b>📝 El editor de plantillas ahora lista sus marcadores.</b> En vez de un párrafo denso, el editor 📝 Plantilla muestra una <b>lista con una línea por marcador</b> y su explicación. Cada lado del plan lista solo los marcadores que funcionan ahí — el Plan Ofensivo muestra {orders}, {date} y {part}; el Plan Defensivo muestra {orders}, {bb_summary_table} y {part} — así nunca se te ofrece un marcador que se quedaría como texto literal.`,
    ],
  },
  { ver: 'v4.24.0', date: '2026-07-26',
    en: [
      `<b>📝 PM template for the Defensive Plan too.</b> Plan Defense's <b>✉ Export PMs</b> popup now has the same <b>📝 Template</b> button as the Offensive Plan, with its own separate template (a ready-made defense one is included). New placeholder <b>{part}</b>: when a player's orders are split across several PMs by the bracket limit, it becomes " 1/2", " 2/2"… — so a spoiler titled <b>Support Orders{part}</b> reads "Support Orders 1/2" in the first message and "Support Orders 2/2" in the next; players who fit in one PM just see "Support Orders". Every split part gets the full template, since each one is sent as its own PM.`,
    ],
    es: [
      `<b>📝 Plantilla de MP también para el Plan Defensivo.</b> La ventana <b>✉ Exportar MPs</b> del Plan Defensivo ahora tiene el mismo botón <b>📝 Plantilla</b> que el Plan Ofensivo, con su propia plantilla separada (incluye una de defensa ya preparada). Nuevo marcador <b>{part}</b>: cuando las órdenes de un jugador se dividen en varios MPs por el límite de corchetes, se convierte en " 1/2", " 2/2"… — así un spoiler titulado <b>Órdenes Apoyo{part}</b> se lee "Órdenes Apoyo 1/2" en el primer mensaje y "Órdenes Apoyo 2/2" en el siguiente; los jugadores que caben en un MP ven simplemente "Órdenes Apoyo". Cada parte dividida recibe la plantilla completa, ya que cada una se envía como su propio MP.`,
    ],
  },
  { ver: 'v4.23.0', date: '2026-07-26',
    en: [
      `<b>📝 PM template for Export PMs.</b> Plan Offensive's <b>✉ Export PMs</b> popup has a new <b>📝 Template</b> button: a message template that wraps every copied PM, so each player gets your greeting, arrival-date call-out and launch instructions around their own orders. <b>{orders}</b> is replaced with the player's orders block and <b>{date}</b> with the plan's arrival date (e.g. SATURDAY 25). A ready-made template is included; edit it to your liking and Save — it's remembered on this device. Leave it empty to copy the orders alone, or Reset to get the default back. The wrapped PM still re-imports cleanly into the Attack Planner.`,
    ],
    es: [
      `<b>📝 Plantilla de MP para Exportar MPs.</b> La ventana <b>✉ Exportar MPs</b> del Plan Ofensivo tiene un nuevo botón <b>📝 Plantilla</b>: una plantilla de mensaje que envuelve cada MP copiado, de modo que cada jugador recibe tu saludo, la fecha de llegada y las instrucciones de lanzamiento alrededor de sus propias órdenes. <b>{orders}</b> se sustituye por el bloque de órdenes del jugador y <b>{date}</b> por la fecha de llegada del plan (p. ej. SÁBADO 25). Incluye una plantilla ya preparada; edítala a tu gusto y Guarda — se recuerda en este dispositivo. Déjala vacía para copiar solo las órdenes, o Restaura para recuperar la de por defecto. El MP envuelto se sigue reimportando sin problemas en el Planificador de Ataques.`,
    ],
  },
  { ver: 'v4.22.1', date: '2026-07-22',
    en: [
      `<b>🔗 Clickable coords in By Villages.</b> Each village's coordinate in the <b>By Villages</b> table is now a link to its in-game info page (opens in a new tab), just like the target coords in Outbound Offs. Only active when the world village database is loaded; otherwise the coord stays plain text.`,
    ],
    es: [
      `<b>🔗 Coordenadas clicables en Por Aldeas.</b> La coordenada de cada aldea en la tabla <b>Por Aldeas</b> ahora es un enlace a su página de información en el juego (se abre en una pestaña nueva), igual que las coordenadas de objetivo en Offs Salientes. Solo funciona cuando la base de datos de aldeas del mundo está cargada; si no, la coordenada queda como texto plano.`,
    ],
  },
  { ver: 'v4.22.0', date: '2026-07-22',
    en: [
      `<b>📊 Clearer "unused offs" breakdown.</b> In Plan Offensive, <b>Show Assigned Off Counts</b> used to lump every idle off into one <b>unused</b> number — misleading, since most "unused" offs simply can't reach the still-open targets. It's now split by reason: <b>available</b> (free <i>and</i> actually able to hit an open target — the number to watch), <b>too far</b> (beyond your Max distance from every target), and <b>outside draw area</b> (off-capable villages outside your sender coordinate filter / drawn map area, which were previously counted nowhere). The <b>reserved (distance)</b> min-distance holdback is unchanged, and each off tier's buckets now add up exactly to its total.`,
    ],
    es: [
      `<b>📊 Desglose más claro de offs sin usar.</b> En el Plan Ofensivo, <b>Mostrar Recuento Offs Asignadas</b> juntaba todas las offs ociosas en un único número <b>sin usar</b> — engañoso, porque la mayoría de las offs "sin usar" simplemente no pueden llegar a los objetivos aún abiertos. Ahora se separa por motivo: <b>disponibles</b> (libres <i>y</i> capaces de atacar un objetivo abierto — el número a vigilar), <b>demasiado lejos</b> (fuera de tu distancia máxima de todos los objetivos) y <b>fuera del área</b> (aldeas ofensivas fuera de tu filtro de coordenadas de remitentes / área dibujada, que antes no se contaban en ningún sitio). La reserva por <b>distancia mínima</b> no cambia, y los cubos de cada categoría de off ahora suman exactamente su total.`,
    ],
  },
  { ver: 'v4.21.0', date: '2026-07-21',
    en: [
      `<b>💨 Fake noble trains.</b> Snob Mode has a new <b>💨 Fake</b> option (alongside 👑 Solo and ⚔ Split Off). A fake train sends its nobles as a <b>bare decoy</b> — no escort, no troops — so an assigned sender just launches e.g. 4 lone nobles to bait the enemy's defence. It doesn't need a close village: any village <b>in range</b> works, and the plan now picks the <b>farthest</b> in-range one on purpose, since a longer flight shows up in the enemy's incoming list <b>sooner</b> (more warning = more wasted defence). A fake train consumes the sender's nobles but <b>no off</b>, and never pulls a village off off-duty or forces a clearing off. <b>FAKE-type targets can now carry a noble train too</b> (their Senders / Nobles / Snob Mode cells are no longer greyed out) and default to Fake mode — so <b>bulk-adding coordinates as FAKE</b> starts each one in Fake mode (assign a sender and it fields a fake noble train). In every export the fake train is marked with a bold <b>green (FAKE)</b> tag, the same green regular fake off attacks use.`,
    ],
    es: [
      `<b>💨 Trenes de nobles fake.</b> El Modo Nobles tiene una nueva opción <b>💨 Fake</b> (junto a 👑 Solo y ⚔ Partir Off). Un tren fake envía sus nobles como <b>señuelo vacío</b> — sin escolta ni tropas — así que el remitente asignado simplemente lanza p. ej. 4 nobles solos para cebar la defensa enemiga. No necesita una aldea cercana: sirve cualquier aldea <b>en rango</b>, y ahora el plan elige a propósito la <b>más lejana</b> en rango, porque un vuelo más largo aparece <b>antes</b> en la lista de entrantes del enemigo (más aviso = más defensa desperdiciada). Un tren fake gasta los nobles del remitente pero <b>ningún off</b>, y nunca retira una aldea del servicio ofensivo ni fuerza un off de limpieza. <b>Los objetivos de tipo FAKE ahora también pueden llevar un tren de nobles</b> (sus celdas de Remitentes / Nobles / Modo Nobles ya no están en gris) y usan Fake por defecto — así que <b>añadir coordenadas en bloque como FAKE</b> deja cada una en modo Fake (asigna un remitente y enviará un tren de nobles fake). En cada exportación el tren fake se marca con una etiqueta <b>(FAKE) verde</b> en negrita, el mismo verde que usan los ataques off fake normales.`,
    ],
  },
  { ver: 'v4.20.0', date: '2026-07-21',
    en: [
      `<b>⏱ Cluster launch times (optional).</b> Plan Offensive has a new <b>Cluster launch times</b> checkbox with a <b>± tolerance</b> (default 10 fields). When on, the plan keeps each player's offs at <b>similar distances</b>, so their launches group into a few tighter bursts and no attack strays needlessly far out — meaning offs return home sooner for a quicker second wave. It is the <b>lowest-priority</b> factor: it never overrides morale or off power, only breaks near-ties <b>within the ± tolerance</b>, so a much closer or stronger village is never traded away just to cluster. Off by default; your choice is remembered on this device.`,
    ],
    es: [
      `<b>⏱ Agrupar lanzamientos (opcional).</b> El Plan Ofensivo tiene una nueva casilla <b>Agrupar lanzamientos</b> con una <b>tolerancia ±</b> (por defecto 10 campos). Al activarla, el plan mantiene los offs de cada jugador a <b>distancias similares</b>, para que sus lanzamientos se agrupen en unas pocas tandas más compactas y ningún ataque se aleje innecesariamente — así los offs vuelven a casa antes, para una segunda oleada más rápida. Es el factor de <b>menor prioridad</b>: nunca anula la moral ni la potencia ofensiva, solo desempata opciones casi iguales <b>dentro de la tolerancia ±</b>, así que nunca se sacrifica una aldea mucho más cercana o fuerte solo por agrupar. Desactivado por defecto; tu elección se recuerda en este dispositivo.`,
    ],
  },
  { ver: 'v4.19.0', date: '2026-07-16',
    en: [
      `<b>✉ Send per-player orders with one click.</b> The <b>Offensive Plan</b> tab has a new <b>✉ Export PMs</b> button (next to Export Per-Player Orders), just like the Defensive Plan: a popup lists every player with their own copy button — click it and that player's full orders are copied to the clipboard, ready to paste into an in-game PM or straight back into the Attack Planner. No more selecting text out of one big box.`,
      `<b>🎭 Clearer FAKE attacks in exports.</b> Fake attacks now show a <b>spy icon before the ram</b> and a <b>bold (FAKE)</b> tag in the Forum and Per-Player exports, and their <b>launch time is green</b> instead of red — so a glance tells real attacks and fakes apart. Real offs and noble trains are unchanged.`,
    ],
    es: [
      `<b>✉ Envía las órdenes por jugador con un clic.</b> La pestaña <b>Plan Ofensivo</b> tiene un nuevo botón <b>✉ Exportar MPs</b> (junto a Exportar Órdenes por Jugador), igual que el Plan Defensivo: una ventana lista cada jugador con su propio botón de copiar — púlsalo y todas las órdenes de ese jugador se copian al portapapeles, listas para pegar en un MP del juego o de vuelta en el Planificador de Ataques. Se acabó seleccionar texto de un cuadro enorme.`,
      `<b>🎭 Ataques FAKE más claros en las exportaciones.</b> Los ataques fake ahora muestran un <b>icono de espía antes del ariete</b> y una etiqueta <b>(FAKE) en negrita</b> en las exportaciones de Foro y por Jugador, y su <b>hora de lanzamiento es verde</b> en vez de roja — así, de un vistazo, distingues ataques reales de fakes. Los offs reales y los trenes de nobles no cambian.`,
    ],
  },
  { ver: 'v4.18.0', date: '2026-07-15',
    en: [
      `<b>👁 Choose which columns you see.</b> The Offensive Targets tab has a new <b>👁 Columns</b> button (next to Edit Selected Rows): untick any column — Defender, Points, off tiers, POWER, CATAPULTS, senders, Snob Players, Nobles, windows… — to hide it and free up space. Hiding is display-only: the data stays and the plan keeps using it. Your selection is remembered on this device; <b>Show all</b> brings everything back.`,
    ],
    es: [
      `<b>👁 Elige qué columnas ves.</b> La pestaña Objetivos Ofensivos tiene un nuevo botón <b>👁 Columnas</b> (junto a Editar Filas Seleccionadas): desmarca cualquier columna — Defensor, Puntos, tipos de off, POWER, CATAPULTAS, remitentes, Jug. Nobles, Nobles, ventanas… — para ocultarla y ganar espacio. Ocultar es solo visual: los datos se conservan y el plan los sigue usando. Tu selección se recuerda en este dispositivo; <b>Mostrar todas</b> lo restaura todo.`,
    ],
  },
  { ver: 'v4.17.0', date: '2026-07-15',
    en: [
      `<b>🏷 Explicit target types: OFF, DESTROYER, FAKE.</b> The Offensive Targets bulk-add panel has a <b>type dropdown</b> next to Add Pasted Targets — every pasted coordinate becomes that type, shown as a <b>badge in the new Type column</b> (changeable later via Edit Selected Rows). <b>OFF</b> behaves exactly as before. <b>DESTROYER</b> replaces the old automatic detection: it's now an explicit choice — off selection prefers catapult-carrying offs (≥101 cats) for these targets, and the row starts with the catapult attacks toggle ON at 3 attacks. A destroyer with a snob train configured raises a warning (you probably meant OFF). Targets added any other way (single add, database, map) are plain OFF.`,
      `<b>🎭 FAKE targets — 1-ram pretend attacks that reuse your real offs.</b> A FAKE target's <b>Complete column holds the number of fakes</b>; everything else on the row is ignored. The plan fills fakes AFTER all real assignments, from <b>complete-off villages already sending a real off</b> (escort villages only as a fallback), so every fake origin genuinely attacks somewhere else too — max <b>1 real attack + 1 fake per village</b>, never two fakes. Fake rows show a FAKE badge, land in the target's off windows, skip morale, and their rally link presets <b>exactly 1 ram</b>; exports tag them so nobody sends real troops. If no eligible off remains, the row stays unassigned with a warning.`,
      `<b>⚙ Catapult attacks now default to 3</b> (was 5) when you first enable a target's catapult toggle — including via mass edit.`,
    ],
    es: [
      `<b>🏷 Tipos de objetivo explícitos: OFF, VOLADORA, FAKE.</b> El panel de pegado masivo de Objetivos Ofensivos tiene un <b>desplegable de tipo</b> junto a Añadir Objetivos Pegados — cada coordenada pegada adopta ese tipo, mostrado como <b>insignia en la nueva columna Tipo</b> (modificable después con Editar Filas Seleccionadas). <b>OFF</b> se comporta igual que siempre. <b>VOLADORA</b> sustituye la antigua detección automática: ahora es una elección explícita — la selección de offs prefiere offs con catapultas (≥101 cat.) para estos objetivos, y la fila empieza con los ataques de catapulta activados a 3. Una voladora con tren de nobles configurado genera un aviso (seguramente querías OFF). Los objetivos añadidos por otras vías (añadir individual, base de datos, mapa) son OFF normales.`,
      `<b>🎭 Objetivos FAKE — ataques de 1 ariete que reutilizan tus offs reales.</b> En un objetivo FAKE la <b>columna Completo indica el número de fakes</b>; el resto de la fila se ignora. El plan rellena los fakes DESPUÉS de todas las asignaciones reales, desde <b>aldeas con off completo que ya envían un off real</b> (aldeas escolta solo como último recurso), así cada origen de fake ataca de verdad en otro sitio — máximo <b>1 ataque real + 1 fake por aldea</b>, nunca dos fakes. Las filas fake muestran la insignia FAKE, llegan en las ventanas de off del objetivo, omiten la moral y su enlace de plaza preselecciona <b>exactamente 1 ariete</b>; las exportaciones las etiquetan para que nadie envíe tropas reales. Si no queda ningún off elegible, la fila queda sin asignar con un aviso.`,
      `<b>⚙ Los ataques de catapulta ahora empiezan en 3</b> (antes 5) al activar por primera vez el interruptor de catapultas de un objetivo — también desde la edición masiva.`,
    ],
  },
  { ver: 'v4.16.0', date: '2026-07-11',
    en: [
      `<b>📜 Send your defensive plan in-game with one paste.</b> The <b>Defensive Plan</b> tab has a new <b>📜 Export supportSender</b> button (next to Export PMs): one compact, bracket-free text per player. Each player pastes theirs ONCE into the companion <b>supportSender</b> script on the game's <b>Rally point → Mass support</b> screen — the script remembers it, lists their targets (with arrival deadline and a computed <b>"send by"</b> time), and a <b>Fill current target</b> button types every planned order into the mass-support form, clamped to the troops each village actually has. Missing villages, shortfalls and orders that can no longer arrive in time are flagged; the player just reviews and presses the game's send button, then ticks the target done and moves to the next. Because the format uses no BB brackets, it can ride inside the same PM as the readable orders.`,
    ],
    es: [
      `<b>📜 Envía tu plan defensivo dentro del juego con un solo pegado.</b> La pestaña <b>Plan Defensivo</b> tiene un nuevo botón <b>📜 Exportar supportSender</b> (junto a Exportar MPs): un texto compacto y sin corchetes por jugador. Cada jugador pega el suyo UNA vez en el script acompañante <b>supportSender</b> en la pantalla <b>Plaza → Apoyo masivo</b> del juego — el script lo recuerda, lista sus objetivos (con fecha límite de llegada y una hora calculada de <b>"enviar antes de"</b>), y un botón <b>Rellenar objetivo actual</b> escribe cada orden planificada en el formulario de apoyo masivo, limitada a las tropas que cada pueblo tiene realmente. Se avisa de pueblos ausentes, faltas de tropas y órdenes que ya no llegan a tiempo; el jugador solo revisa y pulsa el botón de enviar del juego, marca el objetivo como hecho y pasa al siguiente. Como el formato no usa corchetes BB, puede ir dentro del mismo MP que las órdenes legibles.`,
    ],
  },
  { ver: 'v4.15.1', date: '2026-07-10',
    en: [
      `<b>♻ Remove duplicate targets in one click.</b> The <b>Offensive Targets</b> tab has a new <b>♻ Remove Duplicates</b> button (next to Export Objectives). If the same coordinate was added more than once, it keeps <b>one row per coordinate</b> — preferring the row that already has <b>noble (snob) senders assigned</b> (then the one with off senders), so assignment work you've already done survives the cleanup. A confirmation shows how many rows would be removed before anything changes.`,
    ],
    es: [
      `<b>♻ Elimina objetivos duplicados con un clic.</b> La pestaña <b>Objetivos Ofensivos</b> tiene un nuevo botón <b>♻ Quitar Duplicados</b> (junto a Exportar Objetivos). Si la misma coordenada se añadió más de una vez, conserva <b>una fila por coordenada</b> — prefiriendo la fila que ya tiene <b>remitentes de noble asignados</b> (y después la que tiene remitentes de off), así el trabajo de asignación ya hecho sobrevive a la limpieza. Una confirmación muestra cuántas filas se eliminarían antes de cambiar nada.`,
    ],
  },
  { ver: 'v4.15.0', date: '2026-07-10',
    en: [
      `<b>🏰 Load building levels from the new "everything" export.</b> The tribe-info script's <b>Read everything (JSON)</b> export now includes every village's building levels. Drop that <b>.json</b> straight onto the troop uploader (or paste it) — the calculator reads the troops <i>and</i> the Smithy levels from it. It's converted to a lightweight form on load, so a big tribe's file doesn't bloat your saved data. A plain <b>.txt</b> troop file still works exactly as before (no building data, previous behavior). You can also drop a buildings-only JSON on top of an already-loaded tribe to just add the Smithy levels.`,
      `<b>👑 Smarter noble senders — see who can actually noble each target.</b> When building levels are loaded, the <b>Offensive Targets</b> noble-sender dropdown becomes per-target: every player is still listed (A–Z), but each option now reads <b>Name (villages with Smithy ≥19 within noble range, closest–farthest distance)</b> instead of the old snob count — <b>(0)</b> means they have no noble-ready village in range of that target, <b>(?)</b> means they don't share building info with the tribe. And when the plan reserves each sender's launch villages (picks split-off escorts, and recommends where to recruit a noble), it now <b>only uses villages with a Smithy ≥19</b>, skipping ones that couldn't build the Academy in time. Without a buildings file loaded, everything falls back to the previous point-based estimate, so nothing changes for a plain troop upload.`,
    ],
    es: [
      `<b>🏰 Carga niveles de edificios desde la nueva exportación "todo".</b> La exportación <b>Leer todo (JSON)</b> del script de info de tribu ahora incluye los niveles de edificios de cada aldea. Arrastra ese <b>.json</b> directamente al cargador de tropas (o pégalo) — la calculadora lee las tropas <i>y</i> los niveles de Herrería de él. Se convierte a una forma ligera al cargarlo, así que el archivo de una tribu grande no infla tus datos guardados. Un archivo de tropas <b>.txt</b> normal sigue funcionando igual que antes (sin datos de edificios, comportamiento previo). También puedes soltar un JSON solo de edificios sobre una tribu ya cargada para añadir únicamente los niveles de Herrería.`,
      `<b>👑 Remitentes de noble más inteligentes — ve quién puede ennoblecer cada objetivo.</b> Cuando hay niveles de edificios cargados, el desplegable de remitente de noble en <b>Objetivos Ofensivos</b> pasa a ser por objetivo: todos los jugadores siguen listados (A–Z), pero cada opción ahora muestra <b>Nombre (aldeas con Herrería ≥19 dentro del rango de noble, distancia más cercana–más lejana)</b> en vez del antiguo recuento de nobles — <b>(0)</b> significa que no tienen ninguna aldea lista para noble en rango de ese objetivo, <b>(?)</b> que no comparten la información de edificios con la tribu. Y cuando el plan reserva las aldeas de lanzamiento de cada remitente (elige las escoltas de partir-off y recomienda dónde reclutar un noble), ahora <b>solo usa aldeas con Herrería ≥19</b>, saltándose las que no podrían construir la Academia a tiempo. Sin un archivo de edificios cargado, todo recurre a la estimación previa por puntos, así que nada cambia para una carga de tropas normal.`,
    ],
  },
  { ver: 'v4.14.0', date: '2026-07-09',
    en: [
      `<b>⏱ Plan Offensive: "Earliest send" time.</b> A new date + time picker at the top of the Plan Offensive controls lets you set the <b>earliest moment you could actually launch</b>. The plan then only uses villages that can still arrive within a target's window when sent no earlier than that — so the maximum travel it allows is <b>(arrival window end − earliest send)</b>. Example: arrival 2026-07-15, window 08:00–10:00, earliest send 2026-07-13 08:00 → only offs within 50 hours of travel are in range. It applies to <b>noble (snob) trains</b> too, so snob range is limited the same way. Leave it blank for the previous behavior (anything launchable from now). If the earliest-send time falls at or after a target's window, you get a clear warning that nothing can reach it in time.`,
      `<b>🧮 "Outside earliest launch date" count.</b> The <b>Show Assigned Off Counts</b> breakdown (under the plan summary) now has a new figure: how many of your offs are in distance range but <b>can't be sent in time</b> given the current dates. A high number is your cue that pushing the arrival date a day later would put more offs in range.`,
    ],
    es: [
      `<b>⏱ Plan Ofensivo: hora de "Envío más temprano".</b> Un nuevo selector de fecha + hora en la parte superior de los controles de Plan Ofensivo te permite fijar el <b>momento más temprano en que podrías lanzar realmente</b>. El plan entonces solo usa pueblos que aún puedan llegar dentro de la ventana de un objetivo si se envían no antes de esa hora — así que el viaje máximo que permite es <b>(fin de la ventana de llegada − envío más temprano)</b>. Ejemplo: llegada 2026-07-15, ventana 08:00–10:00, envío más temprano 2026-07-13 08:00 → solo los offs a 50 horas de viaje o menos están en rango. También aplica a los <b>trenes de noble</b>, así que el rango de noble se limita igual. Déjalo en blanco para el comportamiento anterior (cualquier cosa lanzable desde ahora). Si la hora de envío más temprano cae en o después de la ventana de un objetivo, recibes un aviso claro de que nada puede llegar a tiempo.`,
      `<b>🧮 Recuento "fuera de la fecha de envío más temprano".</b> El desglose de <b>Mostrar Recuento Offs Asignadas</b> (bajo el resumen del plan) ahora tiene una cifra nueva: cuántos de tus offs están en rango de distancia pero <b>no se pueden enviar a tiempo</b> con las fechas actuales. Un número alto es la señal de que retrasar la fecha de llegada un día pondría más offs en rango.`,
    ],
  },
  { ver: 'v4.13.3', date: '2026-07-09',
    en: [
      `<b>🗜️ Storage compression — no more "storage full" errors on big plans.</b> The calculator's saved data (especially the generated Defense Plan, which was by far the largest — around 3 MB on a big operation) is now <b>compressed</b> before it's stored in your browser, typically shrinking it 5–10×. This keeps a whole tribe's worth of plans, troops and imports comfortably under the browser's ~5 MB storage limit that was causing imports to fail. Your plans are kept exactly as generated (nothing is recalculated on reload), and the debug export file gets smaller too. Everything loads back automatically — older saves and older export files still open fine.`,
      `<b>🛡️ Clearer message when storage is genuinely full.</b> If browser storage ever fills up during a Manage Defense import, you now get a plain explanation (the data is still loaded for the session, and on the hosted site it's backed up to the cloud) instead of the old misleading "Could not parse…" error that made it look like a bad file.`,
    ],
    es: [
      `<b>🗜️ Compresión de almacenamiento — se acabaron los errores de "almacenamiento lleno" con planes grandes.</b> Los datos guardados de la calculadora (sobre todo el Plan de Defensa generado, con diferencia el más grande — alrededor de 3 MB en una operación grande) ahora se <b>comprimen</b> antes de guardarse en tu navegador, reduciéndolos normalmente entre 5 y 10 veces. Esto mantiene los planes, tropas e importaciones de toda una tribu holgadamente por debajo del límite de ~5 MB del navegador que hacía fallar las importaciones. Tus planes se conservan tal cual se generaron (no se recalcula nada al recargar), y el archivo de exportación de depuración también se hace más pequeño. Todo se vuelve a cargar automáticamente — los datos y exportaciones antiguos siguen abriéndose sin problema.`,
      `<b>🛡️ Mensaje más claro cuando el almacenamiento está realmente lleno.</b> Si el almacenamiento del navegador llegara a llenarse durante una importación de Gestionar Defensa, ahora recibes una explicación sencilla (los datos siguen cargados en la sesión y, en el sitio alojado, se respaldan en la nube) en lugar del antiguo mensaje engañoso "No se pudo interpretar…" que hacía parecer que el archivo estaba mal.`,
    ],
  },
  { ver: 'v4.13.2', date: '2026-07-09',
    en: [
      `<b>🗄️ Fixed "Import failed (storage may be full)" on large debug files.</b> Two causes, both addressed. (1) Importing kept a full backup copy of your current data <i>in browser storage</i> while writing the new data on top — so for a moment both had to fit at once, doubling the space needed and overflowing the browser's ~5 MB limit when re-importing a big file. The backup is now held in memory instead, roughly halving peak usage (and any leftover backup from an older version is cleaned up). (2) In the hosted version (rapidsiege.github.io), the import no longer stores the bundled world map database — the site always reloads the live es100 map on its own, so that copy was several wasted MB that pushed imports over the limit. Local (double-click) use still embeds the map, since there it's the DB source when no folder is connected. If a local import is still too big, connect the DB folder (which supersedes the embedded copy) or export without the full database.`,
    ],
    es: [
      `<b>🗄️ Corregido "La importación falló (el almacenamiento puede estar lleno)" con archivos de depuración grandes.</b> Dos causas, ambas resueltas. (1) Al importar se guardaba una copia de seguridad completa de tus datos actuales <i>en el almacenamiento del navegador</i> mientras se escribían los nuevos encima — así que por un instante ambos tenían que caber a la vez, duplicando el espacio necesario y desbordando el límite de ~5 MB del navegador al reimportar un archivo grande. La copia de seguridad ahora se mantiene en memoria, reduciendo el pico a casi la mitad (y se limpia cualquier copia sobrante de una versión anterior). (2) En la versión alojada (rapidsiege.github.io), la importación ya no guarda la base de datos del mapa del mundo incluida — el sitio siempre recarga el mapa de es100 en vivo por su cuenta, así que esa copia eran varios MB desperdiciados que empujaban las importaciones por encima del límite. El uso local (doble clic) sigue incluyendo el mapa, ya que ahí es la fuente de la BD cuando no hay carpeta conectada. Si una importación local sigue siendo demasiado grande, conecta la carpeta de la BD (que sustituye a la copia incluida) o exporta sin la base de datos completa.`,
    ],
  },
  { ver: 'v4.13.1', date: '2026-07-09',
    en: [
      `<b>📥 Manage Defense: multi-file import.</b> Import Support and Import Support Orders now accept <b>several files at once</b> — export your villages in small batches (lighter on the game servers), then select all the batch files in one Load File dialog. Files are merged: if a village appears in more than one file, the last file's data wins. CSV and JSON batches can even be mixed. One unreadable file cancels the whole import so nothing half-loads.`,
      `<b>🔧 Hardening pass (code review).</b> Manage Defense imports now validate coordinates in JSON files too (malformed entries are dropped instead of breaking the table) and reject CSVs missing their unit columns instead of silently importing zeros. Faster Manage Defense rendering on big worlds (the inferred-incoming scan no longer walks every village). The summary's "(estimated)" tag now appears whenever any counted incoming is inferred, not only when no orders are loaded. Support Packs: a min/max set below a single unit's farm weight no longer bypasses the pack sizing. No behavior changes to any generated plan — verified order-for-order against v4.13.0.`,
    ],
    es: [
      `<b>📥 Gestionar Defensa: importación multi-archivo.</b> Importar Apoyo e Importar Órdenes de Apoyo ahora aceptan <b>varios archivos a la vez</b> — exporta tus pueblos en lotes pequeños (menos carga para los servidores del juego) y selecciona todos los archivos del lote en un solo diálogo de Cargar Archivo. Los archivos se combinan: si un pueblo aparece en más de un archivo, ganan los datos del último. Incluso se pueden mezclar lotes CSV y JSON. Un archivo ilegible cancela toda la importación para que nada quede cargado a medias.`,
      `<b>🔧 Pase de robustez (revisión de código).</b> Las importaciones de Gestionar Defensa ahora validan las coordenadas también en archivos JSON (las entradas malformadas se descartan en vez de romper la tabla) y rechazan CSVs sin sus columnas de unidades en lugar de importar ceros en silencio. Renderizado más rápido de Gestionar Defensa en mundos grandes (el escaneo de entrante inferido ya no recorre todas las aldeas). La etiqueta "(estimado)" del resumen aparece ahora siempre que algún entrante contado sea inferido, no solo cuando no hay órdenes cargadas. Paquetes de Apoyo: un mín./máx. por debajo del peso de granja de una unidad ya no elude el dimensionado de paquetes. Sin cambios de comportamiento en ningún plan generado — verificado orden por orden contra v4.13.0.`,
    ],
  },
  { ver: 'v4.13.0', date: '2026-07-09',
    en: [
      `<b>📦 Plan Defense: Config Support Size (Support Packs).</b> A new <b>⚙ Config Support Size</b> button (next to Generate Defense) picks how orders are sized. <b>Max Efficiency</b> (default) is the classic precise split. <b>Support Packs</b> makes every support order a chunky "pack" of at least a chosen <b>min farm size</b> (default 500) — and optionally at most a <b>max farm size</b> (0 = unlimited) — weighted by editable per-unit farm counts (Overwatch-style: Spear 1, Sword 1, Scout 2, Heavy Cav 4). So instead of dozens of 20-Heavy orders you get orders of ≥125 Heavy Cav; with a max set, each origin→destination order is capped too (a soft cap: leftovers fold into existing orders, and it's only exceeded when there's nowhere else to send). Coverage is never reduced — the plan still delivers the same troops and only splits differently. On a real 50-target plan this cut total orders roughly in half and dropped tiny orders by ~75%; adding max 1000 further collapsed oversized orders by ~65%.`,
    ],
    es: [
      `<b>📦 Plan de Defensa: Configurar Tamaño de Apoyo (Paquetes de Apoyo).</b> Un nuevo botón <b>⚙ Configurar Tamaño de Apoyo</b> (junto a Generar Defensa) elige cómo se dimensionan las órdenes. <b>Máx. Eficiencia</b> (por defecto) es el reparto preciso de siempre. <b>Paquetes de Apoyo</b> convierte cada orden de apoyo en un "paquete" de al menos un <b>tamaño mín. de granja</b> elegido (500 por defecto) — y opcionalmente de como máximo un <b>tamaño máx. de granja</b> (0 = sin límite) — ponderado por pesos por unidad editables (estilo Vigilancia: Lanza 1, Espada 1, Explorador 2, Caballería Pesada 4). Así, en vez de decenas de órdenes de 20 Pesadas, obtienes órdenes de ≥125 Caballería Pesada; con un máximo definido, cada orden origen→destino también queda limitada (límite flexible: los restos se pliegan en órdenes existentes, y solo se supera cuando no hay dónde más enviar). La cobertura nunca se reduce — el plan entrega las mismas tropas, solo las divide distinto. En un plan real de 50 objetivos esto redujo el total de órdenes casi a la mitad y las órdenes diminutas ~75%; añadir máx. 1000 redujo además las órdenes sobredimensionadas ~65%.`,
    ],
  },
  { ver: 'v4.12.0', date: '2026-07-09',
    en: [
      `<b>🛡 Manage Defense: Support row, collapsible villages + per-sender "Still not sent".</b> The old "Totals" row is now a <b>Support</b> row showing only the <b>ally support</b> in a village (the owner's own troops are no longer mixed in) — a tribe-.txt estimate until you load an <b>Import Support</b> file, then the exact per-origin sum. Each village is now <b>collapsible</b> (▶/▼, plus <b>Expand/Collapse All</b>) so big plans stay light — it keeps a <b>Support</b> + a <b>Remaining</b> summary row (Remaining = plan − support − incoming, with "N not sent" or "X units missing"), and only the per-origin detail expands. For a village whose <b>Import Support Orders</b> you've loaded, expanding shows a red <b>"Still not sent"</b> row per sender who hasn't sent, each with a one-click <b>⚔ Send</b> rally link; villages without their own orders just show the compact Remaining summary. New <b>✉ Export Missing PMs</b> button builds ready-to-paste messages with only the orders each player still owes (for the villages you have order data on).`,
    ],
    es: [
      `<b>🛡 Gestionar Defensa: fila de Apoyo, pueblos plegables + "Aún sin enviar" por remitente.</b> La antigua fila "Totales" es ahora una fila de <b>Apoyo</b> que muestra solo el <b>apoyo aliado</b> en la aldea (las tropas propias del dueño ya no se mezclan) — una estimación del .txt de la tribu hasta que cargas un archivo de <b>Importar Apoyo</b>, y luego la suma exacta por origen. Cada pueblo es ahora <b>plegable</b> (▶/▼, con <b>Expandir/Contraer Todo</b>) para que los planes grandes vayan ligeros — conserva una fila de <b>Apoyo</b> y otra de <b>Restante</b> (Restante = plan − apoyo − entrante, con "N sin enviar" o "X unidades faltan"), y solo se expande el detalle por origen. Para un pueblo del que hayas cargado sus <b>Órdenes de Apoyo</b>, al expandir muestra una fila roja <b>"Aún sin enviar"</b> por cada remitente que no ha enviado, con enlace de <b>⚔ Enviar</b> al punto de reunión; los pueblos sin sus propias órdenes solo muestran el resumen compacto de Restante. El nuevo botón <b>✉ Exportar MPs Faltantes</b> genera mensajes listos para pegar con solo las órdenes que cada jugador todavía debe (para los pueblos de los que tienes datos de órdenes).`,
    ],
  },
  { ver: 'v4.11.0', date: '2026-07-08',
    en: [
      `<b>🏖 MV Players on Defensive Targets.</b> Defensive Targets now has the same <b>MV Players</b> pairing as Offensive Targets — tuned for support. Two players you pair as vacation-mode (MV) partners will never both send support to the <b>same target</b>, and neither will ever send support to a village <b>owned by their partner</b>. Enforced when you Generate the defense plan. The <b>pair list is shared</b> with Offensive Targets — set a pair on either tab and it applies to both plans. Requires the tribe troop file.`,
    ],
    es: [
      `<b>🏖 Jugadores MV en Objetivos Defensivos.</b> Objetivos Defensivos ahora tiene el mismo emparejamiento de <b>Jugadores MV</b> que Objetivos Ofensivos — adaptado al apoyo. Dos jugadores que emparejes como pareja en modo vacaciones (MV) nunca enviarán ambos apoyo al <b>mismo objetivo</b>, y ninguno enviará apoyo a una aldea <b>propiedad de su pareja</b>. Se aplica al Generar el plan de defensa. La <b>lista de parejas es compartida</b> con Objetivos Ofensivos — define una pareja en cualquiera de las dos pestañas y se aplica a ambos planes. Requiere el archivo de tropas de la tribu.`,
    ],
  },
  { ver: 'v4.10.1', date: '2026-07-08',
    en: [
      `<b>🛡 Manage Defense hides self-defense-only villages.</b> The Manage Defense table now lists a village only when it's a <b>Defense Plan target</b> or actually holds/expects <b>ally support</b> (stationed or inbound). Villages showing nothing but their own garrison — no plan, no support in or on the way — are no longer listed, so the table stays focused on what needs coordinating.`,
    ],
    es: [
      `<b>🛡 Gestionar Defensa oculta las aldeas con solo autodefensa.</b> La tabla de Gestionar Defensa ahora muestra una aldea únicamente cuando es <b>objetivo de un Plan de Defensa</b> o realmente tiene/espera <b>apoyo aliado</b> (estacionado o en camino). Las aldeas que solo muestran su propia guarnición — sin plan y sin apoyo entrante o presente — ya no aparecen, de modo que la tabla se centra en lo que hay que coordinar.`,
    ],
  },
  { ver: 'v4.10.0', date: '2026-07-08',
    en: [
      `<b>🗂 Tabs are now grouped into menus.</b> The long single row of tabs has been organised into six top-level menus — <b>Troops Overview</b>, <b>Map</b>, <b>Tribe Timings</b>, <b>Offensive</b>, <b>Defense</b> and <b>Settings</b>. Clicking a menu opens its first tab and reveals that menu's sub-tabs in a second row beneath the menus, so related views sit together and the bar is far less cluttered.`,
      `<b>What's where.</b> <b>Troops Overview</b> holds Overview, By Player, By Villages and Rankings. <b>Offensive</b> gathers Offensive Targets, Plan Offensive, Manage Offensive and Outbound Offs. <b>Defense</b> gathers Defensive Targets, Plan Defense and Manage Defense. <b>Settings</b> now also holds the Changelog and the Database. Map and Tribe Timings each open directly to their single view.`,
    ],
    es: [
      `<b>🗂 Las pestañas ahora se agrupan en menús.</b> La larga fila única de pestañas se ha organizado en seis menús principales — <b>Tropas</b>, <b>Mapa</b>, <b>Tiempos de Tribu</b>, <b>Ofensiva</b>, <b>Defensa</b> y <b>Config.</b> Al pulsar un menú se abre su primera pestaña y aparecen sus sub-pestañas en una segunda fila bajo los menús, de modo que las vistas relacionadas quedan juntas y la barra está mucho menos saturada.`,
      `<b>Qué hay en cada uno.</b> <b>Tropas</b> contiene Resumen, Por Jugador, Por Aldea y Rankings. <b>Ofensiva</b> reúne Objetivos Ofensivos, Planear Ofensiva, Gestionar Ofensiva y Offs Fuera. <b>Defensa</b> reúne Objetivos Defensivos, Planear Defensa y Gestionar Defensa. <b>Config.</b> incluye ahora también el Registro de Cambios y la Base de Datos. Mapa y Tiempos de Tribu abren directamente a su única vista.`,
    ],
  },
  { ver: 'v4.9.0', date: '2026-07-08',
    en: [
      `<b>🛡 New "Manage Defense" tab.</b> The defensive twin of Manage Offensive. <b>Import Support</b> loads the villageSupports.js export (the support currently <b>stationed</b> in each allied village, broken down by origin); <b>Import Support Orders</b> loads the incomingOrders.js export, keeping only <b>support movements en route</b> (attacks ignored). Each Copy-Script button puts the matching quickbar loader on your clipboard. The table is village-keyed and works with or without a plan.`,
      `<b>Tracks stationed + incoming support against your Defense Plan.</b> Each village opens with a gold <b>Totals</b> row (all troops in the village, matching the tribe export's defense row), then every stationed support stack and every inbound support order. Order status is graded against the plan: <b>Matches plan</b>, <b>Different origin</b>, <b>Different target</b>, <b>Duplicate support</b>, <b>Wrong amount</b>, <b>Not in plan</b>, or <b>Extra support</b>. Without the orders file, incoming support is <b>estimated</b> from the tribe export's inbound-troops data. When a Defense Plan exists, a red <b>Remaining Incoming Support</b> row shows what's still owed — plan minus stationed minus incoming.`,
    ],
    es: [
      `<b>🛡 Nueva pestaña "Gestionar Defensa".</b> La gemela defensiva de Gestionar Ofensiva. <b>Importar Apoyos</b> carga la exportación de villageSupports.js (el apoyo actualmente <b>estacionado</b> en cada pueblo aliado, desglosado por origen); <b>Importar Órdenes Apoyo</b> carga la de incomingOrders.js, quedándose solo con los <b>movimientos de apoyo en camino</b> (los ataques se ignoran). Cada botón Copiar Script deja el cargador de barra rápida correspondiente en tu portapapeles. La tabla se organiza por pueblo y funciona con o sin plan.`,
      `<b>Sigue el apoyo estacionado + entrante frente a tu Plan Defensivo.</b> Cada pueblo abre con una fila dorada de <b>Totales</b> (todas las tropas del pueblo, coincide con la fila de defensa de la exportación de tribu), luego cada stack de apoyo estacionado y cada orden de apoyo entrante. El estado de cada orden se evalúa contra el plan: <b>Según plan</b>, <b>Origen distinto</b>, <b>Objetivo distinto</b>, <b>Apoyo duplicado</b>, <b>Cantidad distinta</b>, <b>Fuera del plan</b> o <b>Apoyo extra</b>. Sin el archivo de órdenes, el apoyo entrante se <b>estima</b> a partir de las tropas entrantes de la exportación de tribu. Cuando existe un Plan Defensivo, una fila roja de <b>Apoyo Entrante Restante</b> muestra lo que aún falta — plan menos estacionado menos entrante.`,
    ],
  },
  { ver: 'v4.8.0', date: '2026-07-08',
    en: [
      `<b>💾 Export / Import now round-trips EVERYTHING.</b> Export Data (JSON) captures your full saved state — offensive & defensive targets, the plan, settings, troops, the Manage Offensive orders, map & Overwatch preferences, and now the <b>entire world database</b> — in one file. Import writes it all back and <b>reloads the page</b> to apply it, so the imported situation is reproduced exactly as a fresh session would build it.`,
      `<b>Fixes disappearing map troops on import.</b> Previously an import rebuilt only owned troops, so the map tooltip's <b>Troops In Village</b> and <b>Inbound Troops</b> (and Overwatch stacks) vanished until you reloaded. They now survive the import. Your previous state is still backed up in localStorage first. In production the database keeps loading the live daily mirror (fresher than any snapshot); the exported database is used when reproducing a file locally.`,
    ],
    es: [
      `<b>💾 Exportar / Importar ahora conserva TODO.</b> Exportar datos (JSON) captura todo tu estado guardado — objetivos ofensivos y defensivos, el plan, ajustes, tropas, las órdenes de Gestión Ofensiva, preferencias de mapa y Overwatch, y ahora la <b>base de datos completa del mundo</b> — en un solo archivo. Importar lo escribe todo de vuelta y <b>recarga la página</b> para aplicarlo, reproduciendo la situación importada tal como la construiría una sesión nueva.`,
      `<b>Arregla las tropas del mapa que desaparecían al importar.</b> Antes una importación reconstruía solo las tropas propias, así que las <b>Tropas en la Aldea</b> y <b>Tropas Entrantes</b> del mapa (y los stacks de Overwatch) desaparecían hasta recargar. Ahora sobreviven a la importación. Tu estado anterior se respalda antes en localStorage. En producción la base de datos sigue cargándose del mirror diario en vivo (más reciente que cualquier copia); la base exportada se usa al reproducir un archivo en local.`,
    ],
  },
  { ver: 'v4.7.0', date: '2026-07-07',
    en: [
      `<b>✉ Export PMs (Plan Defense).</b> A new button next to Export Per-Player Orders opens a panel with <b>one button per player</b>: clicking it copies that player's support orders to the clipboard, ready to paste into an in-game message — and the button turns green with a checkmark so you always know who you've already messaged. Orders use the same lines as the forum export (coord links, troops, SEND link, depart/arrive times).`,
      `<b>Numbered orders + automatic splitting at the game's bracket limit.</b> Every order is numbered (1., 2., 3.…) so a player always knows where they are. A message stays under <b>4,500 brackets</b> (the game caps at ~5,000), leaving you room to add a few words of your own; a player whose orders exceed that gets numbered parts — "(1/2)", "(2/2)" — each with its own copy button, with the numbering continuing across parts. Small counters show each message's orders, characters and brackets.`,
    ],
    es: [
      `<b>✉ Exportar MPs (Plan de Defensa).</b> Un nuevo botón junto a Exportar Órdenes por Jugador abre un panel con <b>un botón por jugador</b>: al pulsarlo copia las órdenes de apoyo de ese jugador al portapapeles, listas para pegar en un mensaje del juego — y el botón se pone verde con una marca para que siempre sepas a quién has escrito ya. Las órdenes usan las mismas líneas que el export del foro (enlaces de coordenadas, tropas, enlace ENVIAR, horas de salida/llegada).`,
      `<b>Órdenes numeradas + división automática en el límite de corchetes del juego.</b> Cada orden va numerada (1., 2., 3.…) para que el jugador siempre sepa por dónde va. Cada mensaje se queda por debajo de <b>4.500 corchetes</b> (el juego permite ~5.000), dejándote margen para añadir unas palabras propias; un jugador cuyas órdenes lo superen recibe partes numeradas — "(1/2)", "(2/2)" — cada una con su propio botón de copia, y la numeración continúa entre partes. Unos contadores pequeños muestran las órdenes, caracteres y corchetes de cada mensaje.`,
    ],
  },
  { ver: 'v4.6.0', date: '2026-07-07',
    en: [
      `<b>🛡 Overwatch Mode on the Map.</b> A new toolbar button colors every village with defense data by the <b>stack stationed in it</b> (from the tribe export's garrison info). Zoomed in, each village shows two colored triangles — <b>left = defense stationed now, right = including en-route support</b> — plus its incoming-attack count and the total stack in thousands next to a farm icon. Zoomed out, villages are tinted by the total-stack color, so weak spots on the front read at a glance.`,
      `<b>⚙ Overwatch Config.</b> While the mode is on, a config button opens a panel (top-left, like Heatmap Config) to tune everything: the four stack thresholds (empty / small / medium / big), the five tier colors, and the per-unit weights used to count a stack (spear/sword 1, heavy cav 4, catapult 2, paladin 2 by default). All settings and the mode itself are remembered.`,
    ],
    es: [
      `<b>🛡 Modo Overwatch en el Mapa.</b> Un nuevo botón de la barra colorea cada aldea con datos de defensa según el <b>stack estacionado en ella</b> (de la info de guarnición del export de la tribu). De cerca, cada aldea muestra dos triángulos de color — <b>izquierdo = defensa estacionada ahora, derecho = incluyendo apoyo en camino</b> — más su número de ataques entrantes y el stack total en miles junto a un icono de granja. De lejos, las aldeas se tiñen con el color del stack total, así los puntos débiles del frente se ven de un vistazo.`,
      `<b>⚙ Config Overwatch.</b> Con el modo activo, un botón de configuración abre un panel (arriba a la izquierda, como Config Mapa de Calor) para ajustarlo todo: los cuatro umbrales de stack (vacío / pequeño / medio / grande), los cinco colores por nivel y el peso por unidad con el que se cuenta un stack (lanza/espada 1, cab. pesada 4, catapulta 2, paladín 2 por defecto). Todos los ajustes y el propio modo se recuerdan.`,
    ],
  },
  { ver: 'v4.5.0', date: '2026-07-07',
    en: [
      `<b>📤 Prioritize Sending From Far Villages (Plan Defense).</b> A new checkbox next to Generate Defense: when on, each player's support is drawn from their villages <b>furthest from the target</b> first (instead of most-evenly). Who sends how much doesn't change — the capacity balancing stays — only <b>which of their villages</b> the troops leave from. The point: leftover defense pools in the villages <b>nearest</b> the targets, where it can reinforce fastest and is easiest to replenish. The setting is remembered.`,
    ],
    es: [
      `<b>📤 Priorizar Envío Desde Aldeas Lejanas (Plan de Defensa).</b> Nueva casilla junto a Generar Defensa: al activarla, el apoyo de cada jugador se envía primero desde sus aldeas <b>más alejadas del objetivo</b> (en vez de repartirse de la forma más uniforme). Quién envía cuánto no cambia — el balanceo por capacidad se mantiene — solo <b>desde cuáles de sus aldeas</b> salen las tropas. El objetivo: la defensa sobrante se acumula en las aldeas <b>más cercanas</b> a los objetivos, donde puede reforzar más rápido y es más fácil de reponer. La opción se recuerda.`,
    ],
  },
  { ver: 'v4.4.1', date: '2026-07-07',
    en: [
      `<b>🛡 Plan Defense now allocates only AVAILABLE defense.</b> Support orders are drawn from what each village actually has at home or incoming — defense deployed elsewhere is never assigned, so no order ever implies recalling support. The whole balancing follows suit: a player's capacity share is their <b>available</b> def pop (not their total troops), and the ≥4,000-pop sender floor now means 4,000 pop <b>available</b>. The "Support per Player" summary should no longer show red over-asks. With a plain tribe-info file (no garrison data) everything behaves as before.`,
    ],
    es: [
      `<b>🛡 El Plan de Defensa ahora solo asigna defensa DISPONIBLE.</b> Las órdenes de apoyo salen de lo que cada pueblo tiene realmente en casa o en camino — la defensa desplegada fuera nunca se asigna, así que ninguna orden implica retirar apoyo. Todo el balanceo sigue la misma regla: la cuota de capacidad de un jugador es su pob. def. <b>disponible</b> (no sus tropas totales), y el mínimo de ≥4.000 pob. para remitentes ahora significa 4.000 pob. <b>disponibles</b>. El resumen "Apoyo por Jugador" ya no debería mostrar excesos en rojo. Con un archivo simple de tropas (sin datos de guarnición) todo se comporta como antes.`,
    ],
  },
  { ver: 'v4.4.0', date: '2026-07-07',
    en: [
      `<b>🎯 Draw Coordinate Filter now applies to Plan Defense too.</b> The area you draw on the Map restricts defensive support senders exactly like offensive ones: villages outside it are never asked to send support (they simply drop out of the pool, so they don't skew anyone's capacity share either). A teal note next to the Generate Defense button shows whenever a map area is active, so the shared filter can't surprise you.`,
      `<b>⇄ Select Reverse.</b> A new button in the map's drawing bar (next to Undo point / Clear area) flips the drawn area: senders must be OUTSIDE the shape instead of inside — draw a circle around the front line and reverse it to send only from the safe hinterland. The map tint moves to the selected side, the button stays highlighted while reversed, and every filter chip (Plan Offensive and Plan Defense) switches to "outside map area". Clearing the area also resets the reversal.`,
    ],
    es: [
      `<b>🎯 El Filtro de Coordenadas Dibujado ahora también aplica al Plan de Defensa.</b> El área que dibujas en el Mapa restringe los remitentes de apoyo defensivo igual que los ofensivos: a los pueblos fuera de ella nunca se les pide enviar apoyo (simplemente salen del grupo de candidatos, así que tampoco distorsionan la cuota de capacidad de nadie). Una nota verde azulada junto al botón Generar Defensa aparece siempre que hay un área activa, para que el filtro compartido no te sorprenda.`,
      `<b>⇄ Selección Inversa.</b> Un nuevo botón en la barra de dibujo del mapa (junto a Deshacer punto / Borrar área) invierte el área dibujada: los remitentes deben estar FUERA de la forma en vez de dentro — dibuja un círculo alrededor del frente e inviértelo para enviar solo desde la retaguardia segura. El tinte del mapa se mueve al lado seleccionado, el botón queda resaltado mientras está invertido, y todas las etiquetas del filtro (Plan Ofensivo y Plan de Defensa) cambian a "fuera del área del mapa". Borrar el área también restablece la inversión.`,
    ],
  },
  { ver: 'v4.3.0', date: '2026-07-07',
    en: [
      `<b>👤 Filter Player on the Map.</b> Two new toolbar buttons: <b>Filter Player</b> searches ANY player in the world database (type a name, pick from the matches), and <b>Filter Tribe Player</b> picks among the players in the loaded tribe troop file. Selecting a player works like the Barb Finder's isolation: the map centers on their villages, which stay lit while everyone else fades out. Clear the filter (or close the panel) to light the map back up.`,
    ],
    es: [
      `<b>👤 Filtrar Jugador en el Mapa.</b> Dos botones nuevos en la barra: <b>Filtrar Jugador</b> busca CUALQUIER jugador de la base de datos del mundo (escribe un nombre y elige entre las coincidencias), y <b>Filtrar Jugador de la Tribu</b> elige entre los jugadores del archivo de tropas cargado. Seleccionar un jugador funciona como el aislamiento del Buscador de Bárbaros: el mapa se centra en sus pueblos, que quedan iluminados mientras el resto se atenúa. Quita el filtro (o cierra el panel) para volver a iluminar el mapa.`,
    ],
  },
  { ver: 'v4.2.0', date: '2026-07-07',
    en: [
      `<b>📊 Support per Player summary (Plan Defense).</b> After generating a defense, a new table under the plan shows, per player and unit type, how much they're <b>sending / how much they actually have available</b>. Availability uses the same logic as Outbound Offs: only defense that's at home or incoming counts — own troops deployed elsewhere don't — and support stationed by other players never counts above the village's own troops. A player asked to send more than they have available shows the number in red. With a plain tribe-info file (no garrison data) the right side falls back to owned troops, and the note above the table says so.`,
    ],
    es: [
      `<b>📊 Resumen Apoyo por Jugador (Plan de Defensa).</b> Tras generar una defensa, una nueva tabla bajo el plan muestra, por jugador y tipo de unidad, cuánto <b>envía / cuánto tiene realmente disponible</b>. La disponibilidad usa la misma lógica que Offs Fuera: solo cuenta la defensa que está en casa o en camino — las tropas propias desplegadas fuera no — y el apoyo estacionado por otros jugadores nunca cuenta por encima de las tropas propias del pueblo. Si a un jugador se le pide enviar más de lo que tiene disponible, el número se muestra en rojo. Con un archivo simple de tropas (sin datos de guarnición) el lado derecho vuelve a las tropas que posee, y la nota sobre la tabla lo indica.`,
    ],
  },
  { ver: 'v4.1.0', date: '2026-07-07',
    en: [
      `<b>🙅 Ignore Players in Defensive Targets.</b> A new <b>Ignore Players</b> button next to Ignore Coordinates — pick whole players (same chip picker as the Offensive Targets one) whose villages must keep their defense at home. When you <b>Plan Defense</b>, none of their villages send any support, and they don't inflate anyone's capacity share either. The list is remembered with the rest of the defensive plan.`,
    ],
    es: [
      `<b>🙅 Ignorar Jugadores en Objetivos Defensivos.</b> Nuevo botón <b>Ignorar Jugadores</b> junto a Ignorar Coordenadas — elige jugadores enteros (el mismo selector de fichas que el de Objetivos Ofensivos) cuyas aldeas deben mantener su defensa en casa. Al <b>Planear Defensa</b>, ninguna de sus aldeas envía apoyo, y tampoco inflan la cuota de capacidad de nadie. La lista se recuerda con el resto del plan defensivo.`,
    ],
  },
  { ver: 'v4.0.0', date: '2026-07-06',
    en: [
      `<b>📊 New "Manage Offensive" tab</b> (between Plan Offensive and Defensive Targets) — see how the operation is REALLY going. Run the <b>Target Village Orders Exporter</b> userscript (incomingOrders.js) on the planned target coordinates and import its export (JSON preferred, CSV also works): every visible incoming attack is matched against the generated plan. Each planned attack shows its status — <b>✓ Sent</b> (exact origin village), <b>↷ Sent from another village</b> (same player switched offs), <b>⏳ Not sent yet</b> (launch window still open) or <b>✗ Missing</b> — plus the real origin, distance/travel from it, the millisecond arrival and whether it lands <b>in the window, early or late</b>. A noble train renders <b>one row per noble</b> (👑 Snob 1/4, 2/4, …), each with its own arrival and timing verdict.`,
      `<b>🔗 Everything links into the game.</b> The Target coordinates open the village's info page (all incoming attacks on it, one click), and every matched or extra attack's status opens that command's own info page — command links need the JSON export (only it carries the command id).`,
      `<b>🖱 Hover to see the units</b> travelling in the matched command, in the same style as the map tooltip — on the identifying cells (Type through Actual Player), so the timing columns stay hover-free. A header toggle ("Show units in command when hovering", on by default, remembered) turns it off entirely. The game only shows units for your own commands — tribe mates' cells have no tooltip.`,
      `<b>⚔ New Power column</b> (between Status and Actual Origin): the command's attack icon (small/medium/large, plus 👑 when a noble rides along) and the off power of the units sent, in thousands (438,750 → 439K; hidden units → icon only). The Arrival column now colors the date, wall time and milliseconds separately so the time pops when scanning.`,
      `<b>🚫 Noise filtered out:</b> support and returning commands are ignored outright, and <b>fakes</b> (visible units with essentially no offensive punch, e.g. 1 spy + 1 ram — sent only to inflate the incoming count) are dropped and tallied as "N fakes ignored" instead of polluting the extras. Attacks nobody planned are still listed and labelled: extra send from an assigned player, a player assigned to ANOTHER target, or a player not in the plan — and attacks on coordinates outside the plan get their own block at the end. The import is remembered until you clear or replace it.`,
      `<b>🎯 Export Coordinates</b> (Plan Offensive, above the plan table) — the plan's target coordinates, one per line, exactly what the exporter userscript expects: paste them there, download its export, import it here. Full circle. And if you don't have the userscript yet, the import panel's <b>📋 Copy Script</b> button puts its quickbar loader on your clipboard.`,
    ],
    es: [
      `<b>📊 Nueva pestaña "Gestionar Ofensiva"</b> (entre Planear Ofensiva y Objetivos Defensivos) — mira cómo va la operación DE VERDAD. Ejecuta el userscript <b>Target Village Orders Exporter</b> (incomingOrders.js) sobre las coordenadas de los objetivos del plan e importa su exportación (mejor JSON; el CSV también vale): cada ataque entrante visible se empareja con el plan generado. Cada ataque del plan muestra su estado — <b>✓ Enviado</b> (pueblo de origen exacto), <b>↷ Enviado desde otro pueblo</b> (el mismo jugador cambió de off), <b>⏳ Aún sin enviar</b> (la ventana de salida sigue abierta) o <b>✗ Falta</b> — más el origen real, distancia/viaje desde él, la llegada al milisegundo y si aterriza <b>en ventana, pronto o tarde</b>. Un tren de nobles muestra <b>una fila por noble</b> (👑 Noble 1/4, 2/4, …), cada una con su propia llegada y veredicto de tiempo.`,
      `<b>🔗 Todo enlaza con el juego.</b> Las coordenadas del objetivo abren la página de información del pueblo (todos sus ataques entrantes, a un clic), y el estado de cada ataque emparejado o extra abre la página de ese comando — los enlaces a comandos requieren la exportación JSON (solo ella lleva el id del comando).`,
      `<b>🖱 Pasa el ratón para ver las unidades</b> que viajan en el comando emparejado, con el mismo estilo que el tooltip del mapa — sobre las celdas identificativas (de Tipo a Jugador Real), dejando las columnas de tiempos libres. Un interruptor en la cabecera ("Mostrar unidades del comando al pasar el ratón", activado por defecto, se recuerda) lo desactiva por completo. El juego solo muestra unidades de tus propios comandos — las celdas de compañeros de tribu no tienen tooltip.`,
      `<b>⚔ Nueva columna Poder</b> (entre Estado y Origen Real): el icono del ataque del comando (pequeño/mediano/grande, más 👑 si viaja un noble) y el poder ofensivo de las unidades enviadas, en miles (438.750 → 439K; unidades ocultas → solo icono). La columna Llegada ahora colorea por separado la fecha, la hora y los milisegundos para que la hora destaque al escanear.`,
      `<b>🚫 Ruido filtrado:</b> los comandos de apoyo y regreso se ignoran directamente, y los <b>fakes</b> (unidades visibles sin apenas poder ofensivo, ej. 1 espía + 1 ariete — enviados solo para inflar el contador de ataques entrantes) se descartan y se cuentan como "N fakes ignorados" en vez de ensuciar los extras. Los ataques que nadie planeó se siguen listando y etiquetando: envío extra de un jugador asignado, un jugador asignado a OTRO objetivo, o un jugador que no está en el plan — y los ataques a coordenadas fuera del plan tienen su propio bloque al final. La importación se recuerda hasta que la borres o reemplaces.`,
      `<b>🎯 Exportar Coordenadas</b> (Planear Ofensiva, encima de la tabla del plan) — las coordenadas de los objetivos del plan, una por línea, justo lo que espera el userscript exportador: pégalas allí, descarga su exportación e impórtala aquí. Círculo completo. Y si aún no tienes el userscript, el botón <b>📋 Copiar Script</b> del panel de importación pone su cargador de barra rápida en tu portapapeles.`,
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
