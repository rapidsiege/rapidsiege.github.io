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
  { ver: 'v5.13.0', date: '2026-08-29',
    en: [
      `<b>🎭 Morale strategy (Plan Offensive).</b> A new <b>🎭 Morale strategy</b> button next to the morale fields opens a panel with three ways of sharing the tribe's limited <b>high-morale offs</b> between targets. <b>Highest morale first</b> is what the planner did until now: targets are filled in list order, each off preferring senders at or above Min. morale (off) — so the first targets land at 100% and, once those offs run out, the last ones get 30–40%. <b>Balanced</b> hands every off to the target whose assigned offs currently average the <b>lowest</b> morale, so the 100% offs are spread across all targets and every one of them gets a comparable mix. <b>By target points</b> fills targets of at least <b>N points</b> (default 5000) first, so they get first pick of the high-morale offs; the smaller targets follow and take the best morale still available. The choice and the points threshold are remembered on this device and travel with the Backup &amp; Debug export.`,
      `<b>👑 "Assign 1 off to snob sender" (Plan Offensive), off by default.</b> A checkbox next to "Don't reserve villages": when ticked, <b>every noble sender is handed one of their own clearing offs</b> to time right before their train, <b>regardless of their morale</b> on the target — the Min. morale (snob off) gate is skipped everywhere. Leave it off and the gate works as before (a low-morale sender's off goes to a higher-morale player). Remembered on this device like the other Plan Offensive controls.`,
    ],
    es: [
      `<b>🎭 Estrategia de moral (Planear Ofensiva).</b> Un nuevo botón <b>🎭 Estrategia de moral</b> junto a los campos de moral abre un panel con tres formas de repartir entre los objetivos los <b>offs de moral alta</b>, que son limitados. <b>Moral más alta primero</b> es lo que hacía el planificador hasta ahora: los objetivos se rellenan en el orden de la lista y cada off prefiere remitentes con la Moral mín. (off) o más — así los primeros objetivos caen al 100 % y, cuando esos offs se agotan, los últimos reciben 30–40 %. <b>Equilibrado</b> entrega cada off al objetivo cuyos offs asignados tienen ahora la media de moral <b>más baja</b>, de modo que los offs al 100 % se reparten entre todos los objetivos y cada uno recibe una mezcla parecida. <b>Por puntos del objetivo</b> rellena primero los objetivos de al menos <b>N puntos</b> (por defecto 5000), así que eligen antes los offs de moral alta; los objetivos más pequeños se rellenan después con la mejor moral que quede. La elección y el umbral de puntos se recuerdan en este dispositivo y viajan con la exportación de Copia y Depuración.`,
      `<b>👑 «Asignar 1 off al emisor de nobles» (Planear Ofensiva), desactivado por defecto.</b> Una casilla junto a «No reservar aldeas»: al marcarla, <b>cada emisor de nobles recibe uno de sus propios offs de limpieza</b> para cronometrarlo justo antes de su tren, <b>sin importar su moral</b> en el objetivo — el umbral de Moral mín. (off del noble) se omite en todos los objetivos. Sin marcar, el umbral funciona como antes (el off de un emisor con moral baja pasa a un jugador con más moral). Se recuerda en este dispositivo como los demás controles de Planear Ofensiva.`,
    ],
  },
  { ver: 'v5.12.4', date: '2026-08-23',
    en: [
      `<b>🖱 Shift+click range selection (Offensive Targets).</b> Click one row checkbox, then Shift+click another: every row between them is selected — or deselected — in one go, file-manager style. It follows the on-screen row order, works upwards or downwards, and the anchor survives mass edits.`,
      `<b>📅 The group date box no longer throws you out mid-typing (Window Groups).</b> Typing a day like 18 into a group's arrival date used to kick focus out of the box after the first digit, because the row rebuilt itself on every valid keystroke. The box now stays put while you type — only the "Wednesday 18" preview and the group pickers refresh.`,
    ],
    es: [
      `<b>🖱 Selección por rango con Mayús+clic (Objetivos Ofensivos).</b> Marca la casilla de una fila y luego haz Mayús+clic en otra: todas las filas entre ambas se seleccionan — o deseleccionan — de golpe, como en un explorador de archivos. Sigue el orden de filas en pantalla, funciona hacia arriba o hacia abajo, y el ancla sobrevive a las ediciones masivas.`,
      `<b>📅 La caja de fecha del grupo ya no te expulsa a mitad de escribir (Grupos de Ventanas).</b> Al teclear un día como 18 en la fecha de llegada de un grupo, la caja te sacaba el foco tras el primer dígito, porque la fila se reconstruía con cada pulsación válida. Ahora la caja se queda quieta mientras escribes — solo se refrescan la vista previa «Miércoles 18» y los selectores de grupo.`,
    ],
  },
  { ver: 'v5.12.3', date: '2026-08-22',
    en: [
      `<b>📍 Force Coords (Offensive Targets).</b> The coordinate twin of Force Players: paste the coordinates of the ONLY villages allowed to send in this offensive, and every other village in the loaded troop file is left out completely — no offs, no snob trains, no escorts, no fakes, no catapult attacks, and dropped from Export Unused Offs. Any separator works, just like the other coordinate boxes. Empty = every village may send, exactly as before. It combines with Force Players (a village must pass both whitelists) and the ignore lists still apply on top; the offs summary counts the villages left out.`,
    ],
    es: [
      `<b>📍 Forzar Coordenadas (Objetivos Ofensivos).</b> El gemelo por coordenadas de Forzar Jugadores: pega las coordenadas de las ÚNICAS aldeas que pueden enviar en esta ofensiva, y todas las demás aldeas del archivo de tropas quedan fuera por completo — ni offs, ni trenes de nobles, ni escoltas, ni fakes, ni ataques de catapulta, y fuera de Exportar Offs Sin Usar. Vale cualquier separador, como en las demás cajas de coordenadas. Vacío = puede enviar cualquier aldea, exactamente como antes. Se combina con Forzar Jugadores (una aldea debe pasar ambas listas blancas) y las listas de ignorados se aplican igualmente encima; el resumen de offs cuenta las aldeas que quedan fuera.`,
    ],
  },
  { ver: 'v5.12.2', date: '2026-08-22',
    en: [
      `<b>✅ Force Players (Offensive Targets).</b> A whitelist next to Ignore Players: pick the ONLY players who take part in this offensive, and everyone else in the loaded troop file is left out completely — no offs, no snob trains, no escorts, no fakes, no catapult attacks, hidden from every sender picker, and dropped from Export Unused Offs. Perfect for small player-specific operations without ignoring the rest of the tribe one by one. Empty list = everyone participates, exactly as before; the ignore lists still apply on top of the whitelist.`,
      `<b>🏃 "Don't reserve villages" toggle (Plan Offensive), off by default.</b> Normally each noble sender's two villages closest to their objective are held out of the off passes, kept free to launch the nobles. With the toggle on, that hold is skipped: <b>every off in range is sent</b>, and players keep a few units at home themselves to send their solo snob trains. Split-off escort reservations still apply — that off genuinely rides with the noble. The setting survives a refresh like the other Plan Offensive controls.`,
    ],
    es: [
      `<b>✅ Forzar Jugadores (Objetivos Ofensivos).</b> Una lista blanca junto a Ignorar Jugadores: elige los ÚNICOS jugadores que participan en esta ofensiva, y todos los demás del archivo de tropas quedan fuera por completo — ni offs, ni trenes de nobles, ni escoltas, ni fakes, ni ataques de catapulta, ocultos de todos los selectores de remitentes y fuera de Exportar Offs Sin Usar. Perfecto para operaciones pequeñas de jugadores concretos sin ignorar al resto de la tribu uno a uno. Lista vacía = participan todos, exactamente como antes; las listas de ignorados se aplican igualmente encima.`,
      `<b>🏃 Interruptor «No reservar aldeas» (Planear Ofensiva), desactivado por defecto.</b> Normalmente las dos aldeas de cada emisor de nobles más cercanas a su objetivo se apartan de las pasadas de offs, libres para lanzar los nobles. Con el interruptor activado esa reserva se salta: <b>se envía todo off al alcance</b>, y los jugadores se guardan ellos mismos unas pocas unidades en casa para enviar sus trenes de nobles solos. Las reservas de escolta split-off siguen aplicándose — ese off viaja de verdad con el noble. El ajuste sobrevive a un refresco como los demás controles de Planear Ofensiva.`,
    ],
  },
  { ver: 'v5.12.1', date: '2026-08-22',
    en: [
      `<b>📋 Paste coordinates with any separator.</b> The coordinate paste boxes — <b>Add multiple</b> in Offensive and Defensive Targets and the two <b>Ignore coordinates</b> lists — used to read one coordinate per line. They now take any number of <b>x|y</b> coords per line, separated by anything: spaces, commas, tabs or line breaks. In the bulk-add boxes, text following a coord (up to the next one) is still kept as that village's pasted name, so the old one-per-line format with names keeps working exactly as before.`,
    ],
    es: [
      `<b>📋 Pega coordenadas con cualquier separador.</b> Las cajas de pegado de coordenadas — <b>Añadir varias</b> en Objetivos Ofensivos y Defensivos y las dos listas de <b>Ignorar coordenadas</b> — leían una coordenada por línea. Ahora aceptan cualquier número de coords <b>x|y</b> por línea, separadas por lo que sea: espacios, comas, tabuladores o saltos de línea. En las cajas de añadir en bloque, el texto que sigue a una coord (hasta la siguiente) se conserva como el nombre pegado de ese pueblo, así que el formato antiguo de una por línea con nombres sigue funcionando exactamente igual.`,
    ],
  },
  { ver: 'v5.12.0', date: '2026-08-13',
    en: [
      `<b>📋 One Orders block per player — waves merged, sorted by departure.</b> A multi-day plan used to give each player one block per window group, so someone with attacks landing across waves had to hop between blocks to send in the right order. The per-player Orders, the ✉ PMs and the Per-Player All download now emit a <b>single block per player</b> with every attack <b>sorted by launch time</b> across the whole operation, and the header lists every landing day at the top: <b>ARRIVAL DATE: Thursday 13 & Friday 14</b>. The PM template's {date} names each player's own day(s) too. Single-wave plans keep their exact old output; two waves that share one day now merge as well.`,
      `<b>📋 Each attack says which day it lands.</b> When a player's block spans several days, every order line's blue arrival window is prefixed with its landing day-of-month — <b>13 · 01:00-02:00</b> — noble-train lines included, so the red launch call-out says when to send and the blue window says when (and now which day) it hits. Blocks that land on a single day stay clean, with no prefix.`,
      `<b>⚔ The attack planner imports multi-day plans correctly — no more one wave at a time.</b> The import reads the multi-day header and the per-line day stamps and gives <b>every attack its own arrival date</b>; Auto-Generate lands each one on its day, and its date field only covers attacks without one. Old per-wave pastes (v5.9–v5.11) now import fully dated as well, since each of their blocks carries its own header. The target editor gains a per-attack date field, and the import summary says when a day couldn't be recognized (those fall back to the Auto-Generate date).`,
    ],
    es: [
      `<b>📋 Un bloque de Órdenes por jugador — oleadas fusionadas, ordenadas por salida.</b> Un plan de varios días daba a cada jugador un bloque por grupo de ventana, así que alguien con ataques en varias oleadas tenía que saltar entre bloques para enviar en el orden correcto. Las Órdenes por jugador, los ✉ MPs y la descarga Todo por Jugador emiten ahora un <b>único bloque por jugador</b> con todos los ataques <b>ordenados por hora de lanzamiento</b> a lo largo de toda la operación, y la cabecera lista todos los días de llegada arriba: <b>FECHA DE LLEGADA: Jueves 13 & Viernes 14</b>. El {date} de la plantilla de MP también nombra los días propios de cada jugador. Los planes de una sola oleada conservan su salida exacta de antes; dos oleadas que comparten un día ahora también se fusionan.`,
      `<b>📋 Cada ataque dice qué día cae.</b> Cuando el bloque de un jugador abarca varios días, la ventana azul de llegada de cada línea lleva delante su día del mes — <b>13 · 01:00-02:00</b> — incluidas las líneas de trenes de nobles, así que el aviso rojo de lanzamiento dice cuándo enviar y la ventana azul cuándo (y ahora qué día) golpea. Los bloques que caen en un solo día quedan limpios, sin prefijo.`,
      `<b>⚔ El planificador de ataques importa bien los planes de varios días — se acabó una oleada cada vez.</b> La importación lee la cabecera multi-día y los días por línea y da a <b>cada ataque su propia fecha de llegada</b>; Auto-Generar hace caer cada uno en su día, y su campo de fecha solo cubre los ataques sin ella. Los pegados antiguos por oleada (v5.9–v5.11) también importan ahora con todas sus fechas, porque cada bloque lleva su propia cabecera. El editor de objetivos gana un campo de fecha por ataque, y el resumen de importación avisa cuando un día no se pudo reconocer (esos caen en la fecha de Auto-Generar).`,
    ],
  },
  { ver: 'v5.11.0', date: '2026-08-13',
    en: [
      `<b>⚡ Morale now outranks the POWER tag.</b> The pass that fills <b>POWER</b> targets picked the globally strongest available offs by raw offensive power and ignored morale completely — so a low-point defender could be hit exclusively by the tribe's giants at 50–80% morale while full-morale offs sat unused. Every POWER slot now applies the same <b>Min. morale (off)</b> gate as regular targets first: only senders at or above the threshold (default 100%) compete, and raw off power ranks <b>those</b>. Only when no reachable sender clears the bar does the slot fall back to the strongest off regardless of morale — the same soft-gate rule regular clearing offs already follow.`,
      `<b>⚡ Everything else about POWER targets is unchanged.</b> The strongest-offs balancing across all POWER targets, the catapult preference on destroyer targets and the launch-distance clustering all still apply — they just choose among the morale-cleared senders now. Set <b>Min. morale (off)</b> to 0 to get the old take-the-biggest-nuke behaviour back.`,
    ],
    es: [
      `<b>⚡ La moral manda ahora sobre la etiqueta POWER.</b> La pasada que rellena los objetivos <b>POWER</b> elegía los offs disponibles más fuertes por poder ofensivo bruto e ignoraba la moral por completo — así que un defensor con pocos puntos podía recibir solo a los gigantes de la tribu con 50–80% de moral mientras offs con moral al 100% se quedaban sin usar. Cada hueco POWER aplica ahora primero la misma puerta de <b>Moral mín. (off)</b> que los objetivos normales: solo compiten los remitentes con esa moral o más (por defecto 100), y el poder bruto ordena <b>esos</b>. Solo cuando ningún remitente alcanzable supera el umbral, el hueco recurre al off más fuerte sin mirar la moral — la misma regla blanda que ya siguen los offs de limpieza normales.`,
      `<b>⚡ Todo lo demás de los objetivos POWER sigue igual.</b> El reparto equilibrado de los offs más fuertes entre todos los objetivos POWER, la preferencia por catapultas en objetivos demoledores y el agrupado por distancia de lanzamiento siguen aplicándose — solo que ahora eligen entre los remitentes que pasan la puerta de moral. Pon <b>Moral mín. (off)</b> a 0 para recuperar el comportamiento antiguo de «el nuke más grande».`,
    ],
  },
  { ver: 'v5.10.0', date: '2026-08-10',
    en: [
      `<b>⚔ Enemy Tribes, now on the offensive side too.</b> <b>Offensive Targets</b> gains the <b>⚔ Enemy Tribes</b> picker and its <b>“Distance from enemy tribes”</b> field, the twin of the one Plan Defense has had since v3.2.0. Pick the tribes you're at war with, set a radius, and any of your villages within that many fields of <b>any village those tribes own</b> keeps its off at home — it is never assigned a clearing off or a split-off escort. The front line stops being stripped by the plan.`,
      `<b>⚔ It stacks with “Off min distance” instead of replacing it.</b> The two gates measure different things — <b>Off min distance</b> is your <b>objectives</b>, Enemy Tribes is the <b>enemy's territory</b> — so they're set separately and a village held by either one is held. "Send everything except what's within 20 fields of a target or 10 fields of tribe X" is now a single plan.`,
      `<b>⚔ Noble trains are exempt, on purpose.</b> A snob train still obeys only its own <b>Snob max distance</b>: nobles almost always have to launch from close by, and a village on the front line is usually exactly where the academy is. Only the offs (and the escorts riding with a noble) are held back.`,
      `<b>📊 The plan footer says which knob held a village.</b> The off-pool breakdown gains its own <b>reserved (enemy tribes)</b> count next to <b>reserved (distance)</b>, so a village kept home by the new filter is never miscounted as an objective-distance holdback.`,
      `<b>📊 The Offensive Targets footer counts them too.</b> Villages held home by the filter leave the <b>available</b> off pool right there in the tab footer — with their own note, separate from the ignore-list one — so the offs-per-tier figure you plan against is the number Generate will really assign, not a promise it can't keep.`,
      `<b>⚔ Independent from the defensive list.</b> The offensive selection and radius are their own setting — picking a tribe here does not change Plan Defense's Enemy Tribes, and vice versa. Like the defensive one, tribes are remembered by <b>database ID</b>, so a tribe that renames keeps filtering; the plan warns if the radius is 0, if no village database is loaded, or if a picked tribe has vanished from the database.`,
    ],
    es: [
      `<b>⚔ Tribus Enemigas, ahora también en la ofensiva.</b> <b>Objetivos Ofensivos</b> gana el selector <b>⚔ Tribus Enemigas</b> y su campo <b>«Distancia de tribus enemigas»</b>, el gemelo del que Planear Defensa tiene desde la v3.2.0. Elige las tribus con las que estás en guerra, fija un radio, y cualquier aldea tuya a esa distancia de <b>cualquier aldea de esas tribus</b> se queda en casa con su off — nunca se le asigna un off de limpieza ni una escolta split-off. El plan deja de desnudar la primera línea.`,
      `<b>⚔ Se suma a la «Distancia mín. offs», no la sustituye.</b> Las dos puertas miden cosas distintas — la <b>Distancia mín. offs</b> son tus <b>objetivos</b>, Tribus Enemigas es el <b>territorio enemigo</b> — así que se configuran por separado y una aldea retenida por cualquiera de las dos se retiene. «Envía todo menos lo que esté a 20 campos de un objetivo o a 10 de la tribu X» ya es un solo plan.`,
      `<b>⚔ Los trenes de nobles están exentos, a propósito.</b> Un tren de nobles sigue obedeciendo solo a su <b>Distancia máx. nobles</b>: los nobles casi siempre tienen que salir de cerca, y una aldea de primera línea suele ser justo donde está la academia. Solo se retienen los offs (y las escoltas que viajan con un noble).`,
      `<b>📊 El pie del plan dice qué ajuste retuvo cada aldea.</b> El desglose de la reserva de offs gana su propio contador <b>reservadas (tribus enemigas)</b> junto a <b>reservadas (distancia)</b>, así que una aldea que se queda en casa por el filtro nuevo nunca se cuenta como retención por distancia a objetivos.`,
      `<b>📊 El pie de Objetivos Ofensivos también las cuenta.</b> Las aldeas retenidas en casa por el filtro salen del grupo <b>disponible</b> de offs en el propio pie de la pestaña — con su propia nota, aparte de la de ignorados — así que la cifra de offs por nivel con la que planificas es la que Generar va a asignar de verdad, no una promesa que no puede cumplir.`,
      `<b>⚔ Independiente de la lista defensiva.</b> La selección y el radio ofensivos son su propio ajuste — elegir una tribu aquí no cambia las Tribus Enemigas de Planear Defensa, ni al revés. Como en la defensiva, las tribus se recuerdan por <b>ID de la base de datos</b>, así que una tribu que se renombra sigue filtrando; el plan avisa si el radio es 0, si no hay base de datos de aldeas cargada, o si una tribu elegida ha desaparecido de la base de datos.`,
    ],
  },
  { ver: 'v5.9.0', date: '2026-08-09',
    en: [
      `<b>🎯 Off window groups — one plan, several days.</b> The arrival date was a single field, so a plan could only ever land on one day. <b>Offensive Targets</b> now opens with a list of <b>window groups</b>, labelled A, B, C…: each group is an <b>independent wave</b> with its <b>own arrival date, off window and snob window</b>. Add as many as the operation needs; delete one and the rest re-letter so the labels are always A, B, C in order. A plan with a single group behaves exactly as before.`,
      `<b>🎯 Every row says how many offs it wants per wave.</b> The <b>Complete / 3-4 / 1-2</b> columns now hold one box per group, so a target can take two Completes on Friday and a 3-4 on Saturday — the counts are independent and the summary line counts them all (a village can only send one off, so the same target hit twice really does cost twice). <b>Off Windows</b> shows the waves a row attacks in, <b>Snob Window</b> picks which wave its noble train lands in, and pinned off senders are pinned to a wave. <b>Edit Selected Rows</b> gained a window-group picker for the offs and for the noble train, so a whole wave can be filled in one go.`,
      `<b>🎯 Timing is judged per wave, not per plan.</b> Whether a village can still launch in time is now asked against the arrival date and window of <b>its own group</b>, so a village that cannot make Friday but can make Saturday is used for Saturday instead of being written off — and an unreachable wave is reported as unfillable up front rather than filled and then flagged late. Send/arrival times, launch dates and the <b>Manage Offensive</b> early/late verdicts all read each row's own date.`,
      `<b>📋 Exports repeat the ARRIVAL DATE header once per wave.</b> The Forum post and the per-player Orders are sectioned per group, each under its own date, so no attack is ever listed beneath a date that is not its own. The attack planner keeps <b>one</b> arrival date per paste, so importing a multi-wave plan applies the first wave's date and now says so — <b>import one wave at a time</b> to give each its right date.`,
      `<b>♻ Your existing targets convert automatically.</b> The old arrival date and per-target windows become window groups on load: each distinct off-window/snob-window pair gets its own group, and each target's off counts move across with it. A target that used several off windows is split across the matching groups — with the old counts being a mixed-tier split and the new ones per tier, that share is an approximation, so give a multi-window target a quick look.`,
    ],
    es: [
      `<b>🎯 Grupos de ventana off — un plan, varios días.</b> La fecha de llegada era un único campo, así que un plan solo podía caer en un día. <b>Objetivos Ofensivos</b> empieza ahora con una lista de <b>grupos de ventana</b>, etiquetados A, B, C…: cada grupo es una <b>oleada independiente</b> con su <b>propia fecha de llegada, ventana off y ventana de nobles</b>. Añade los que haga falta; si borras uno, los demás se reetiquetan para que las letras sigan siendo A, B, C en orden. Un plan con un solo grupo se comporta exactamente como antes.`,
      `<b>🎯 Cada fila indica cuántos offs quiere por oleada.</b> Las columnas <b>Completo / 3-4 / 1-2</b> tienen ahora una casilla por grupo, así que un objetivo puede llevarse dos Completos el viernes y un 3-4 el sábado — las cantidades son independientes y la línea de resumen las suma todas (una aldea solo puede enviar un off, así que golpear el mismo objetivo dos veces cuesta el doble de verdad). <b>Ventanas Off</b> muestra las oleadas en las que ataca la fila, <b>Ventana Nobles</b> elige en qué oleada cae su tren de nobles, y los remitentes de off fijados quedan fijados a una oleada. <b>Editar Filas Seleccionadas</b> gana un selector de grupo para los offs y para el tren de nobles, de modo que una oleada entera se rellena de una vez.`,
      `<b>🎯 Los tiempos se juzgan por oleada, no por plan.</b> Si una aldea llega a tiempo se comprueba ahora contra la fecha de llegada y la ventana de <b>su propio grupo</b>, así que una aldea que no llega al viernes pero sí al sábado se usa para el sábado en vez de descartarse — y una oleada inalcanzable se avisa como imposible de cubrir en vez de cubrirse y marcarse tarde después. Las horas de envío/llegada, las fechas de lanzamiento y los veredictos de pronto/tarde de <b>Gestionar Ofensiva</b> leen la fecha propia de cada fila.`,
      `<b>📋 Las exportaciones repiten la cabecera FECHA DE LLEGADA una vez por oleada.</b> El post del foro y las Órdenes por jugador se dividen en secciones por grupo, cada una bajo su propia fecha, así que ningún ataque aparece bajo una fecha que no es la suya. El planificador de ataques admite <b>una</b> fecha de llegada por pegado, así que importar un plan de varias oleadas aplica la fecha de la primera y ahora te lo dice — <b>importa una oleada cada vez</b> para que cada una tenga su fecha correcta.`,
      `<b>♻ Tus objetivos actuales se convierten solos.</b> La fecha de llegada antigua y las ventanas por objetivo pasan a ser grupos de ventana al cargar: cada par distinto de ventana off/ventana de nobles obtiene su grupo, y las cantidades de offs de cada objetivo se mueven con él. Un objetivo que usaba varias ventanas off se reparte entre los grupos correspondientes — como las cantidades antiguas eran un reparto con los tipos mezclados y las nuevas son por tipo, ese reparto es aproximado: échale un vistazo a los objetivos con varias ventanas.`,
    ],
  },
  { ver: 'v5.8.1', date: '2026-08-07',
    en: [
      `<b>🎯 "Nothing outside (confirmed by espionage)" now requires an intact spy run.</b> The game only shows a report's "Units outside" block when at least 90% of the attacking spies survive — below that the block is hidden even though resources and buildings still show. Village Reports treated every spied report without an away block as proof that nothing was outside, so a village scouted through heavy spy losses could read "Nothing outside (confirmed by espionage)" when its army simply wasn't seen. Such reports now leave the away row as "never seen", the report modal no longer shows an all-zero "Units outside" table for them, and the shared DB was rebuilt under the new rule — ~115 wrongly-confirmed-empty villages went back to unknown (with the DEF? caveat restored where it applies).`,
    ],
    es: [
      `<b>🎯 "Nada fuera (confirmado por espionaje)" ahora exige que los espías volvieran casi intactos.</b> El juego solo muestra el bloque "Unidades fuera" de un informe cuando sobrevive al menos el 90% de los espías atacantes — por debajo de eso el bloque se oculta aunque los recursos y edificios sí se vean. Informes de Aldeas trataba cualquier informe espiado sin bloque de fuera como prueba de que no había nada fuera, así que una aldea espiada perdiendo muchos espías podía decir "Nada fuera (confirmado por espionaje)" cuando su ejército simplemente no se vio. Esos informes ahora dejan la fila de fuera como "nunca vistas", el modal de informe ya no muestra una tabla "Unidades fuera" a ceros para ellos, y la BD compartida se reconstruyó con la nueva regla — unas 115 aldeas mal confirmadas como vacías vuelven a desconocido (recuperando el aviso DEF? donde toca).`,
    ],
  },
  { ver: 'v5.8.0', date: '2026-08-06',
    en: [
      `<b>🎯 Enemy Villages is now Village Reports — and it shows the biggest army sent, whatever its type.</b> The ⚔ Sent row used to appear only when a real off (≥500 off-pool) had been seen leaving the village. But a defensive village never fires an off — what it fires is heavy cavalry + catapults to shave your buildings, and that army was invisible. The row now shows the <b>biggest army ever seen leaving the village, by farm size, regardless of composition</b>, and known catapult strikers carry a purple <b>💥N</b> tail (N = the most catapults seen in one non-ram-off attack; hover for how many such attacks are on record). The map hover's sent section follows the same rule.`,
      `<b>🔒 Our own tribes' report data is no longer served to whoever finds the URL.</b> The shared reports DB inevitably accumulates data about OUR villages (every defense report describes them). From today the shared endpoints <b>strip everything about WC.. / WC villages before serving it</b> — the stored history keeps everything, but a leaked link hands out nothing about us — and the calculator additionally hides those villages from the Village Reports table, the map badges/hover and the report modal. Your own locally-processed report files still show everything (you are not the person being defended against), and our players appearing inside another village's report (as its attacker, say) stay visible as before.`,
    ],
    es: [
      `<b>🎯 Aldeas Enemigas ahora es Informes de Aldeas — y muestra el mayor ejército enviado, sea del tipo que sea.</b> La fila ⚔ Enviado solo aparecía cuando se había visto salir un off de verdad (≥500 de pool ofensivo). Pero una aldea defensiva nunca lanza un off — lo que lanza es caballería pesada + catapultas para tirarte edificios, y ese ejército era invisible. La fila ahora muestra el <b>mayor ejército visto salir de la aldea, por tamaño de granja, sin importar su composición</b>, y los lanzadores de catapultas conocidos llevan una cola morada <b>💥N</b> (N = las catapultas máximas vistas en un ataque que no era un off normal con arietes; pasa el ratón para ver cuántos ataques así hay registrados). La sección de enviado del hover del mapa sigue la misma regla.`,
      `<b>🔒 Los datos de informes de nuestras propias tribus ya no se sirven a quien encuentre la URL.</b> La BD compartida de informes acumula inevitablemente datos de NUESTROS pueblos (cada informe de defensa los describe). Desde hoy los endpoints compartidos <b>eliminan todo lo relativo a pueblos de WC.. / WC antes de servirlo</b> — el historial guardado lo conserva todo, pero un enlace filtrado no entrega nada nuestro — y la calculadora además oculta esos pueblos de la tabla de Informes de Aldeas, de las insignias/hover del mapa y del modal de informe. Tus propios archivos de informes procesados en local lo siguen mostrando todo (tú no eres la persona de la que hay que defenderse), y nuestros jugadores apareciendo dentro del informe de otro pueblo (como su atacante, por ejemplo) siguen visibles como antes.`,
    ],
  },
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
