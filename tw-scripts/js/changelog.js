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
