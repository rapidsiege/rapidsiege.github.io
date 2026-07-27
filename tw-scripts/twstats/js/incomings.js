/* "Entrantes" — paste what is attacking you and flag the likely fakes: villages
   with too few points, or conquered recently (troops not rebuilt yet).
   Classic script; needs common.js first.

   Two input formats, auto-detected:
     · coords    — a bare list of coordinates ("573|525 572|527 …"). The
                   conquest test is relative to NOW.
     · attacks   — the in-game incomings BB-code dump ([b]Pueblo:[/b] headers +
                   [command]attack[/command] lines). One row per attack command,
                   and the conquest test is relative to that attack's SENT time,
                   which is the whole point: an attack with 60 h of travel was
                   launched from a village whose state 60 h ago is what matters.

   In attack mode the dump is mined for everything it will give, so this page
   covers most of what RedAlert's in-game "Incomings Overview" shows (see
   Tribalwars/.claude/PLAN-twstats-es100.md §5.1 for the full comparison):
     · troop class per attack, from duration ÷ distance — the icon is NOT in the
       dump, but min/field identifies the SLOWEST unit exactly, which is more
       useful: it makes noble trains unambiguous (they are the slowest thing in
       the game) and separates ram nukes from fast fakes.
     · command trains (same target, consecutive arrivals ~attack_gap apart)
     · AS i/n duplicate numbering per origin village
     · totals, arrival histogram, origin/destination combinations
     · your attacked villages' wall / loyalty / troops, straight from the dump

   Data: villages.json + conquers.json (twstats data, fetched once on page load)
   and the world's get_config.xml / get_unit_info.xml, which live one level up in
   the calculators' data folder and are what make the speed maths possible. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var LS_POINTS = "tw.entrantes.minPoints";
  var LS_DAYS = "tw.entrantes.maxDays";
  // The static world files are served from the calculators' data dir, a sibling
  // of twstats/ — NOT from twstats' own data/ (which the build rsyncs --delete).
  var WORLD_DATA = "../data/" + TW.WORLD + "/";

  var UNIT_ES = {
    spear: "Lanza", sword: "Espada", axe: "Hacha", archer: "Arquero",
    spy: "Explorador", light: "CL", marcher: "Arq. caballo", heavy: "CP",
    ram: "Ariete", catapult: "Catapulta", knight: "Paladín", snob: "Noble",
  };

  var state = {
    ready: null,        // Promise resolved when both datasets are indexed
    byCoord: {},        // "x|y" -> village record {id,name,x,y,points,owner}
    lastConquer: {},    // village id -> {t, oldOwner, newOwner}
    cfg: null,          // world config (speeds, attack_gap, snob max_dist)
    mode: "coords",     // "coords" | "attacks"
    rows: [],           // last analysis result (all rows)
    targets: {},        // attack mode: target coord -> {wall, loyalty, def}
    filters: {},        // attack mode table filters
  };

  // === world config ========================================================
  // Travel minutes per field = base_speed / (world_speed × unit_speed).
  // On es100 that divisor is 1, so min/field IS the raw unit speed.
  function parseWorldConfig(cfgXml, unitXml) {
    function num(doc, tag) {
      var el = doc.getElementsByTagName(tag)[0];
      return el ? parseFloat(el.textContent) : null;
    }
    var speed = num(cfgXml, "speed") || 1;
    var unitSpeed = num(cfgXml, "unit_speed") || 1;
    var snobEl = cfgXml.getElementsByTagName("snob")[0];
    var maxDist = snobEl && snobEl.getElementsByTagName("max_dist")[0]
      ? parseFloat(snobEl.getElementsByTagName("max_dist")[0].textContent) : null;

    var units = [], root = unitXml.documentElement;
    for (var i = 0; i < root.children.length; i++) {
      var u = root.children[i];
      var sp = u.getElementsByTagName("speed")[0];
      if (!sp) continue;
      units.push({
        key: u.tagName,
        name: UNIT_ES[u.tagName] || u.tagName,
        minPerField: parseFloat(sp.textContent) / (speed * unitSpeed),
      });
    }
    // Units sharing a speed are indistinguishable from travel time alone, so
    // classify into speed GROUPS and label them honestly ("Ariete/Catapulta").
    var groups = [], byMpf = {};
    units.forEach(function (u) {
      var k = u.minPerField.toFixed(4);
      if (!byMpf[k]) { byMpf[k] = { minPerField: u.minPerField, units: [], keys: [] }; groups.push(byMpf[k]); }
      byMpf[k].units.push(u.name);
      byMpf[k].keys.push(u.key);
    });
    groups.forEach(function (g) {
      g.label = g.units.join("/");
      g.isNoble = g.keys.indexOf("snob") !== -1;
    });
    groups.sort(function (a, b) { return a.minPerField - b.minPerField; });

    return {
      speed: speed, unitSpeed: unitSpeed,
      attackGap: num(cfgXml, "attack_gap") || 100,
      snobMaxDist: maxDist,
      units: units, groups: groups,
    };
  }

  // Tolerance in min/field. Durations are whole seconds and distances exact, so
  // real commands land within ~0.001 of a unit speed; 0.15 is generous but still
  // far below the smallest gap between adjacent classes (9 → 10).
  var SPEED_TOL = 0.15;
  function classifySpeed(minPerField) {
    if (!state.cfg || !isFinite(minPerField)) return null;
    var best = null, bestD = Infinity;
    state.cfg.groups.forEach(function (g) {
      var d = Math.abs(g.minPerField - minPerField);
      if (d < bestD) { bestD = d; best = g; }
    });
    return bestD <= SPEED_TOL ? best : null;
  }

  // === parsing =============================================================
  // A coord is simply "<1-3 digits>|<1-3 digits>"; any separator works.
  function parseCoords(text) {
    var re = /(\d{1,3})\|(\d{1,3})/g, seen = {}, out = [], m;
    while ((m = re.exec(text)) !== null) {
      var key = Number(m[1]) + "|" + Number(m[2]);
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ key: key, x: Number(m[1]), y: Number(m[2]) });
    }
    return out;
  }

  function isAttackDump(text) { return /\[command\]attack\[\/command\]/i.test(text); }

  // One incoming order. "sent" carries no year (25.07 18:21:05) but the arrival
  // does (28.07.26 04:04:37:057), so the arrival dates it; if the sent month is
  // later than the arrival month the order crossed New Year, so step back one.
  // Arrival milliseconds are captured — they are what reveals command trains.
  var ATTACK_RE = new RegExp(
    "\\[command\\]attack\\[\\/command\\]\\s*(.*?)\\s*\\|" +
    "\\s*player\\s+(.+?)\\s+\\|\\s+sent\\s+(\\d{1,2})\\.(\\d{1,2})\\s+(\\d{1,2}):(\\d{2}):(\\d{2})" +
    "[^\\n]*?duration\\s+(\\d{1,3}):(\\d{2}):(\\d{2})" +
    "[^\\n]*?\\[coord\\](\\d{1,3})\\|(\\d{1,3})\\[\\/coord\\]" +
    "[^\\n]*?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2})\\s+(\\d{1,2}):(\\d{2}):(\\d{2})(?::(\\d{1,3}))?", "i");
  // A "[b]…[/b] [coord]x|y[/coord]" line = the village being attacked. Matched
  // structurally (not by the Spanish word "Pueblo") so other locales still work.
  var TARGET_RE = /\[b\][^\]]*\[\/b\][^\n]*?\[coord\](\d{1,3})\|(\d{1,3})\[\/coord\]/i;
  // "[b]<label>:[/b] <numbers>" — wall level, loyalty, or the defender troop row.
  var TARGET_FIELD_RE = /\[b\]([^\[]*)\[\/b\]\s*([\d\s]+)\s*$/i;

  function parseAttacks(text) {
    var lines = text.split(/\r?\n/), out = [], targets = {}, cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      var a = ATTACK_RE.exec(line);
      if (a) {
        var aYear = 2000 + Number(a[15]);
        var sMonth = Number(a[4]), aMonth = Number(a[14]);
        var sYear = sMonth > aMonth ? aYear - 1 : aYear;
        var ms = a[19] ? Number((a[19] + "00").slice(0, 3)) : 0;
        out.push({
          label: a[1] || "",
          player: a[2].trim(),
          origin: { key: Number(a[11]) + "|" + Number(a[12]), x: Number(a[11]), y: Number(a[12]) },
          target: cur,
          sent: TW.srvEpoch(sYear, sMonth, Number(a[3]), Number(a[5]), Number(a[6]), Number(a[7])),
          durationMin: Number(a[8]) * 60 + Number(a[9]) + Number(a[10]) / 60,
          arrival: TW.srvEpoch(aYear, aMonth, Number(a[13]), Number(a[16]), Number(a[17]), Number(a[18])),
          arrivalMs: ms,
        });
        continue;
      }

      var t = TARGET_RE.exec(line);
      if (t) {
        var key = Number(t[1]) + "|" + Number(t[2]);
        cur = targets[key] || (targets[key] = {
          key: key, x: Number(t[1]), y: Number(t[2]),
          wall: null, loyalty: null, def: null,
        });
        continue;
      }

      // Wall / loyalty / defender rows belong to the target block above them.
      var f = cur && TARGET_FIELD_RE.exec(line);
      if (f) {
        var label = f[1].toLowerCase();
        var nums = f[2].trim().split(/\s+/).map(Number);
        if (nums.length >= 5) cur.def = nums;
        else if (/muralla|wall/.test(label)) cur.wall = nums[0];
        else if (/lealtad|loyalt|moral/.test(label)) cur.loyalty = nums[0];
        else if (cur.wall == null) cur.wall = nums[0];
        else if (cur.loyalty == null) cur.loyalty = nums[0];
      }
    }
    return { attacks: out, targets: targets };
  }

  // === derived attack facts ================================================
  function enrichAttacks(attacks) {
    // distance + troop class
    attacks.forEach(function (a) {
      if (a.target) {
        a.distance = Math.sqrt(Math.pow(a.origin.x - a.target.x, 2) +
                               Math.pow(a.origin.y - a.target.y, 2));
        a.minPerField = a.durationMin / a.distance;
        a.speed = classifySpeed(a.minPerField);
      } else {
        a.distance = null; a.minPerField = null; a.speed = null;
      }
    });

    // AS i/n — duplicates from the same origin village, ordered by arrival.
    // (The dump's own "AS:" labels may be stale; this is recomputed fresh.)
    var byOrigin = {};
    attacks.forEach(function (a) { (byOrigin[a.origin.key] = byOrigin[a.origin.key] || []).push(a); });
    Object.keys(byOrigin).forEach(function (k) {
      var list = byOrigin[k].slice().sort(function (p, q) { return p.arrival - q.arrival; });
      list.forEach(function (a, i) { a.dupIndex = i + 1; a.dupTotal = list.length; });
    });

    // Command trains: same target, consecutive arrivals ~attack_gap apart. This
    // is RedAlert's noble signature, but scoped per target (a global scan pairs
    // unrelated commands) and cross-checked against the troop class below.
    var gap = state.cfg ? state.cfg.attackGap : 100;
    var byTarget = {};
    attacks.forEach(function (a) {
      if (a.target) (byTarget[a.target.key] = byTarget[a.target.key] || []).push(a);
    });
    var trainId = 0;
    Object.keys(byTarget).forEach(function (k) {
      var list = byTarget[k].slice().sort(function (p, q) {
        return (p.arrival - q.arrival) || (p.arrivalMs - q.arrivalMs);
      });
      var run = [list[0]];
      function flush() {
        if (run.length >= 2) {
          trainId++;
          var allNoble = run.every(function (a) { return a.speed && a.speed.isNoble; });
          var inRange = state.cfg && state.cfg.snobMaxDist != null
            ? run.every(function (a) { return a.distance <= state.cfg.snobMaxDist; })
            : true;
          run.forEach(function (a) {
            a.train = { id: trainId, size: run.length, noble: allNoble && inRange };
          });
        }
        run = [];
      }
      for (var i = 1; i < list.length; i++) {
        var prev = list[i - 1], curA = list[i];
        var dMs = (curA.arrival - prev.arrival) * 1000 + (curA.arrivalMs - prev.arrivalMs);
        if (dMs >= 0 && dMs <= gap * 1.5) run.push(curA);
        else { flush(); run = [curA]; }
      }
      flush();
    });
    return attacks;
  }

  // === data ================================================================
  function indexData(villages, conquers) {
    var i, v;
    for (i = 0; i < villages.length; i++) {
      v = villages[i];
      if (v.x == null) continue;
      state.byCoord[v.x + "|" + v.y] = v;
    }
    for (i = 0; i < conquers.length; i++) {
      var c = conquers[i], id = c.village.id;
      var prev = state.lastConquer[id];
      if (!prev || c.t > prev.t) {
        state.lastConquer[id] = { t: c.t, oldOwner: c.oldOwner, newOwner: c.newOwner };
      }
      // Fallback locator: a village missing from villages.json (data lag or
      // deleted) still resolves to an id via its last conquest record.
      if (c.village.x != null && !state.byCoord[c.village.x + "|" + c.village.y]) {
        state.byCoord[c.village.x + "|" + c.village.y] = {
          id: id, name: c.village.name, x: c.village.x, y: c.village.y,
          points: null, owner: c.newOwner, _stale: true,
        };
      }
    }
  }

  function loadXML(name) {
    return fetch(WORLD_DATA + name).then(function (r) {
      if (!r.ok) throw new Error(name + ": HTTP " + r.status);
      return r.text();
    }).then(function (txt) {
      return new DOMParser().parseFromString(txt, "text/xml");
    });
  }

  function loadAll() {
    // The world config is optional: without it the troop-class and train
    // features degrade to "—" rather than taking the whole page down.
    var cfgP = Promise.all([loadXML("get_config.xml"), loadXML("get_unit_info.xml")])
      .then(function (x) { state.cfg = parseWorldConfig(x[0], x[1]); })
      .catch(function (e) {
        state.cfg = null;
        if (window.console) console.warn("Entrantes: sin configuración del mundo:", e.message);
      });

    state.ready = Promise.all([
      TW.loadJSON("villages.json"),
      TW.loadJSON("conquers.json"),
      cfgP,
    ]).then(function (res) {
      indexData(res[0], res[1]);
      $("status").textContent = "Listo. Pega las coordenadas (o tus entrantes) y pulsa «Analizar».";
    }).catch(function (e) {
      $("status").textContent = "No se pudieron cargar los datos: " + e.message +
        "  (¿sirviendo por HTTP? file:// bloquea fetch)";
      throw e;
    });
    return state.ready;
  }

  // === analysis ============================================================
  // `refT` is the instant the conquest is judged against: the attack's sent
  // time in attack mode, "now" in coord mode.
  function analyzeVillage(coord, refT, opts) {
    var v = state.byCoord[coord.key];
    var row = { coord: coord, village: v || null, flags: [], unknown: !v, refT: refT };
    if (!v) return row;

    row.conquer = state.lastConquer[v.id] || null;

    // Resolved only through the conquest log → no current points to judge.
    // Must not read as "OK": it's a partial answer, so it gets its own flag.
    if (v.points == null) {
      row.flags.push({ cls: "stale", text: "Sin puntos actuales (no está en los datos del mundo)" });
    } else if (v.points < opts.minPoints) {
      row.flags.push({
        cls: "low",
        text: "Pocos puntos (" + TW.commas(v.points) + " < " + TW.commas(opts.minPoints) + ")",
      });
    }

    if (row.conquer && opts.maxDays > 0) {
      var age = refT - row.conquer.t;
      if (age < 0) {
        // Conquered after this attack left: the troops in the air belong to the
        // previous owner. Worth knowing, and not the same as "recently taken".
        row.flags.push({ cls: "after", text: "Conquistado tras el envío (" + TW.dur(-age) + " después)" });
      } else if (age < opts.maxDays * 86400) {
        row.flags.push({
          cls: "new",
          text: state.mode === "attacks"
            ? "Conquistado " + TW.dur(age) + " antes del envío"
            : "Conquistado hace " + TW.dur(age),
        });
      }
    }
    return row;
  }

  // === render: table =======================================================
  function conquerCell(row) {
    if (!row.village) return "";
    if (!row.conquer) return '<span class="barb">Nunca (desde el inicio del mundo)</span>';
    var c = row.conquer;
    // Uses the analysis-time reference so the relative age can never disagree
    // with the flag computed from it (a later re-render must not drift).
    var rel = state.mode === "attacks"
      ? (row.refT >= c.t ? TW.dur(row.refT - c.t) + " antes del envío"
                         : TW.dur(c.t - row.refT) + " después del envío")
      : TW.relTime(c.t, row.refT);
    return '<span class="conq-when">' + TW.fmtDateTime(c.t) + "</span>" +
      ' <span class="conq-ago">(' + rel + ")</span>" +
      '<br><span class="conq-who">' + TW.ownerCell(c.oldOwner) + " → " + TW.ownerCell(c.newOwner) + "</span>";
  }

  function verdictCell(row) {
    var out = [];
    if (row.unknown) out.push("<span class='flag flag-unknown'>Desconocido</span>");
    row.flags.forEach(function (f) {
      out.push("<span class='flag flag-" + f.cls + "'>" + TW.esc(f.text) + "</span>");
    });
    if (!out.length) out.push("<span class='flag flag-ok'>OK</span>");
    return out.join(" ");
  }

  function speedCell(a) {
    if (!a.speed) {
      return a.minPerField
        ? '<span class="barb" title="' + a.minPerField.toFixed(2) + ' min/campo">?</span>'
        : '<span class="barb">—</span>';
    }
    return "<span class='flag flag-" + (a.speed.isNoble ? "noble" : "type") + "' title='" +
      a.minPerField.toFixed(2) + " min/campo'>" + TW.esc(a.speed.label) + "</span>";
  }

  function villageCellOf(row) {
    var html;
    if (row.village) html = TW.villageCell(row.village);
    else html = '<span class="coord">' + row.coord.key + '</span> <span class="cont">' +
      TW.continent(row.coord.x, row.coord.y) + "</span>";
    if (row.attack && row.attack.dupTotal > 1) {
      html += " <span class='as-badge' title='Ataques desde este mismo pueblo'>AS " +
        row.attack.dupIndex + "/" + row.attack.dupTotal + "</span>";
    }
    return html;
  }
  function pointsCellOf(row) {
    if (!row.village) return "—";
    return row.village.points != null ? TW.commas(row.village.points) : "?";
  }

  // Column definitions drive both the header (with sort affordances) and the
  // sort comparators, so the two can't drift apart.
  var HEADS = {
    coords: [
      { label: "#", cls: "col-rank" },
      { label: "Pueblo", key: "coord" },
      { label: "Puntos", cls: "col-pts", key: "points" },
      { label: "Dueño", key: "owner" },
      { label: "Última conquista", key: "conquest" },
      { label: "Aviso", cls: "col-verdict", key: "verdict" },
    ],
    attacks: [
      { label: "#", cls: "col-rank" },
      { label: "Origen del ataque", key: "coord" },
      { label: "Puntos", cls: "col-pts", key: "points" },
      { label: "Dueño", key: "owner" },
      { label: "Tropa", key: "speed" },
      { label: "Objetivo", key: "target" },
      { label: "Envío / Llegada", cls: "col-date", key: "arrival", title: "Ordenar por hora de llegada" },
      { label: "Última conquista", key: "conquest" },
      { label: "Aviso", cls: "col-verdict", key: "verdict" },
    ],
  };

  // Each comparator returns [hasValue, value] so missing data always sinks to
  // the bottom, in both directions, instead of clumping at whichever end.
  var SEVERITY = { after: 5, new: 4, low: 3, stale: 2, unknown: 1 };
  var SORTERS = {
    coord: function (r) { return [1, r.coord.x * 1000 + r.coord.y]; },
    points: function (r) {
      var p = r.village && r.village.points;
      return p == null ? [0, 0] : [1, p];
    },
    owner: function (r) {
      var o = r.village && r.village.owner;
      return o && o.name ? [1, o.name.toLowerCase()] : [0, ""];
    },
    speed: function (r) {
      var mpf = r.attack && r.attack.minPerField;
      return mpf ? [1, mpf] : [0, 0];
    },
    target: function (r) {
      var t = r.attack && r.attack.target;
      return t ? [1, t.x * 1000 + t.y] : [0, 0];
    },
    arrival: function (r) { return r.attack ? [1, r.attack.arrival * 1000 + r.attack.arrivalMs] : [0, 0]; },
    conquest: function (r) { return r.conquer ? [1, r.conquer.t] : [0, 0]; },
    verdict: function (r) {
      var best = r.unknown ? SEVERITY.unknown : 0;
      r.flags.forEach(function (f) { best = Math.max(best, SEVERITY[f.cls] || 0); });
      return [1, best];
    },
  };

  function sortRows(rows) {
    var s = state.sort;
    if (!s || !s.key || !SORTERS[s.key]) return rows;
    var fn = SORTERS[s.key], dir = s.dir === "desc" ? -1 : 1;
    // decorate-sort-undecorate keeps the original order as a stable tiebreak
    return rows.map(function (r, i) { return { r: r, i: i, k: fn(r) }; })
      .sort(function (a, b) {
        if (a.k[0] !== b.k[0]) return b.k[0] - a.k[0];          // missing last, always
        if (a.k[1] < b.k[1]) return -1 * dir;
        if (a.k[1] > b.k[1]) return 1 * dir;
        return a.i - b.i;
      })
      .map(function (x) { return x.r; });
  }

  // Grouping is applied AFTER sorting: rows keep their sorted order, and each
  // target's block appears at the position of its first (best-sorted) row.
  function groupRows(rows) {
    var order = [], buckets = {};
    rows.forEach(function (r) {
      var k = r.attack && r.attack.target ? r.attack.target.key : "";
      if (!buckets[k]) { buckets[k] = []; order.push(k); }
      buckets[k].push(r);
    });
    var out = [];
    order.forEach(function (k) { out = out.concat(buckets[k]); });
    return out;
  }

  function renderHead() {
    var defs = HEADS[state.mode], s = state.sort || {};
    $("head").innerHTML = "<tr>" + defs.map(function (d) {
      if (!d.key) return "<th class='" + (d.cls || "") + "'>" + d.label + "</th>";
      var on = s.key === d.key;
      var arrow = on ? (s.dir === "desc" ? " ▼" : " ▲") : "";
      return "<th class='" + (d.cls || "") + " sortable" + (on ? " sorted" : "") +
        "' data-sort='" + d.key + "' title='" + TW.esc(d.title || ("Ordenar por " + d.label)) +
        "'>" + d.label + "<span class='sort-arrow'>" + arrow + "</span></th>";
    }).join("") + "</tr>";

    var ths = $("head").querySelectorAll("th.sortable");
    for (var i = 0; i < ths.length; i++) {
      ths[i].addEventListener("click", function () {
        var key = this.getAttribute("data-sort");
        if (state.sort && state.sort.key === key) {
          state.sort = { key: key, dir: state.sort.dir === "asc" ? "desc" : "asc" };
        } else {
          // Points, conquest recency and severity read best biggest-first;
          // coords, owners and arrival times read best smallest-first.
          var descFirst = { points: 1, conquest: 1, verdict: 1 };
          state.sort = { key: key, dir: descFirst[key] ? "desc" : "asc" };
        }
        render();
      });
    }
  }

  function passesFilters(r) {
    if ($("onlyflagged").checked && !r.flags.length && !r.unknown) return false;
    if (state.mode !== "attacks") return true;
    var f = state.filters, a = r.attack;
    if (f.player && a.player !== f.player) return false;
    if (f.type && (a.speed ? a.speed.label : "?") !== f.type) return false;
    if (f.origin && a.origin.key !== f.origin) return false;
    if (f.dest && (!a.target || a.target.key !== f.dest)) return false;
    if (f.from != null && a.arrival < f.from) return false;
    if (f.to != null && a.arrival > f.to) return false;
    return true;
  }

  function render() {
    var grouped = state.mode === "attacks" && $("groupbytarget").checked;
    var shown = sortRows(state.rows.filter(passesFilters));
    if (grouped) shown = groupRows(shown);
    var cols = HEADS[state.mode].length;
    renderHead();

    var html = "", n = 0, lastTarget = null;
    for (var i = 0; i < shown.length; i++) {
      var r = shown[i];
      var cls = (n % 2 ? "r2" : "r1") + (r.flags.length ? " row-flagged" : "") + (r.unknown ? " row-unknown" : "");
      n++;

      if (grouped) {
        var tKey = r.attack.target ? r.attack.target.key : null;
        if (tKey !== lastTarget) {
          lastTarget = tKey;
          // Resolve the target through the world data so it links to its village
          // page like every other village reference on the site.
          var tv = tKey ? state.byCoord[tKey] : null;
          var label;
          if (tv) label = TW.villageCell(tv);
          else if (tKey) label = "<b>" + tKey + "</b> <span class='cont'>" +
            TW.continent(r.attack.target.x, r.attack.target.y) + "</span>";
          else label = "<span class='barb'>(sin cabecera de pueblo)</span>";
          html += "<tr class='group-row'><td colspan='" + cols + "'>Objetivo: " + label + "</td></tr>";
        }
      }

      var targetCell = "";
      if (state.mode === "attacks") {
        var tg = r.attack.target;
        var tgv = tg ? state.byCoord[tg.key] : null;
        targetCell = "<td>" + (tgv ? TW.villageCell(tgv)
          : tg ? TW.esc(tg.key) : "<span class='barb'>—</span>") + "</td>";
      }

      var timeCell = "";
      if (state.mode === "attacks") {
        var tr = r.attack.train
          ? " <span class='flag flag-" + (r.attack.train.noble ? "noble" : "train") + "'>Tren ×" +
            r.attack.train.size + (r.attack.train.noble ? " ¡nobles!" : "") + "</span>"
          : "";
        // Arrival is shown to the second (plus ms): seconds are what you time a
        // snipe or a dodge against, and dropping them would also make two
        // commands in the same minute look out of order once sorted.
        timeCell = "<td class='col-date'>" + TW.fmtDateTime(r.attack.sent) +
          "<br><span class='conq-ago'>→ " + TW.fmtTime(r.attack.arrival) +
          "." + String(r.attack.arrivalMs).padStart(3, "0") + "</span>" + tr + "</td>";
      }

      html += "<tr class='" + cls + "'>" +
        "<td class='col-rank'>" + n + ".</td>" +
        "<td>" + villageCellOf(r) + "</td>" +
        "<td class='col-pts'>" + pointsCellOf(r) + "</td>" +
        "<td>" + (r.village ? TW.ownerCell(r.village.owner) : "<span class='barb'>—</span>") + "</td>" +
        (state.mode === "attacks" ? "<td>" + speedCell(r.attack) + "</td>" : "") +
        targetCell + timeCell +
        "<td class='col-conq'>" + conquerCell(r) + "</td>" +
        "<td class='col-verdict'>" + verdictCell(r) + "</td></tr>";
    }

    $("rows").innerHTML = html ||
      "<tr class='r1'><td colspan='" + cols + "' class='status'>Sin resultados.</td></tr>";
    $("tableWrap").hidden = false;
    updateShowing(shown.length);
  }

  function updateShowing(shownCount) {
    var el = $("showing");
    if (!el) return;
    el.textContent = shownCount === state.rows.length
      ? ""
      : " · mostrando " + shownCount + " de " + state.rows.length;
  }

  // === render: panels ======================================================
  function countBy(list, keyFn) {
    var m = {};
    list.forEach(function (x) { var k = keyFn(x); if (k != null) m[k] = (m[k] || 0) + 1; });
    return m;
  }
  function sortedEntries(obj) {
    return Object.keys(obj).map(function (k) { return [k, obj[k]]; })
      .sort(function (a, b) { return b[1] - a[1] || String(a[0]).localeCompare(String(b[0])); });
  }

  // Attacker names are resolved to real profile links through players.json when
  // possible (the dump carries no player ids).
  function playerLinkByName(name) {
    var p = state.playersByName && state.playersByName[name];
    return p ? TW.playerLink(p.id, name) : TW.esc(name);
  }

  function buildTotals(attacks) {
    var players = sortedEntries(countBy(attacks, function (a) { return a.player; }));
    var origins = sortedEntries(countBy(attacks, function (a) { return a.origin.key; }));
    var dests = sortedEntries(countBy(attacks, function (a) { return a.target ? a.target.key : null; }));
    var types = sortedEntries(countBy(attacks, function (a) { return a.speed ? a.speed.label : "?"; }));

    var playersHtml = players.map(function (e) {
      return '<span class="player-chip">' + playerLinkByName(e[0]) + " <b>(" + e[1] + ")</b></span>";
    }).join(" ");

    var typesHtml = types.map(function (e) {
      var pct = (100 * e[1] / attacks.length).toFixed(1);
      var isNoble = /Noble/.test(e[0]);
      return "<tr><td><span class='flag flag-" + (isNoble ? "noble" : "type") + "'>" +
        TW.esc(e[0]) + "</span></td><td class='col-pts'>" + e[1] + "/" + attacks.length +
        "</td><td class='col-pts'>" + pct + "%</td></tr>";
    }).join("");

    $("totals").innerHTML =
      '<table class="vis widget"><tbody>' +
      "<tr class='r1'><td><b>Ataques totales</b></td><td>" + TW.commas(attacks.length) + "</td></tr>" +
      "<tr class='r2'><td><b>Jugadores atacantes (" + players.length + ")</b></td><td>" + playersHtml + "</td></tr>" +
      "<tr class='r1'><td><b>Pueblos objetivo (" + dests.length + ")</b></td><td><textarea class='coord-dump' readonly rows='2'>" +
      dests.map(function (e) { return e[0]; }).join(" ") + "</textarea></td></tr>" +
      "<tr class='r2'><td><b>Pueblos de origen (" + origins.length + ")</b></td><td><textarea class='coord-dump' readonly rows='2'>" +
      origins.map(function (e) { return e[0]; }).join(" ") + "</textarea></td></tr>" +
      "<tr class='r1'><td><b>Tipo de tropa</b><br><span class='conq-ago'>deducido de duración ÷ distancia</span></td><td>" +
      (state.cfg ? "<table class='vis inner'><tbody>" + typesHtml + "</tbody></table>"
                 : "<span class='barb'>sin configuración del mundo</span>") +
      "</td></tr></tbody></table>";
  }

  // Arrivals bucketed by day+hour, exactly like RedAlert's "OP Spotter": a wave
  // shows up as a spike. Rendered by quickchart.io (the page's only external
  // dependency — if it fails to load the table below still carries the numbers).
  function buildOpSpotter(attacks) {
    var buckets = {};
    attacks.forEach(function (a) {
      var p = TW.fmtDateTime(a.arrival);            // "YYYY-MM-DD HH:MM"
      var k = p.slice(8, 10) + "/" + p.slice(5, 7) + " " + p.slice(11, 13) + "H";
      buckets[k] = (buckets[k] || 0) + 1;
    });
    var keys = Object.keys(buckets).sort(function (a, b) {
      function ord(s) { return s.slice(3, 5) + s.slice(0, 2) + s.slice(6, 8); }
      return ord(a).localeCompare(ord(b));
    });
    var vals = keys.map(function (k) { return buckets[k]; });

    var chart = {
      type: "bar",
      data: { labels: keys, datasets: [{ label: "Llegadas por hora", data: vals }] },
    };
    var src = "https://quickchart.io/chart?bkg=white&w=500&h=300&c=" +
      encodeURIComponent(JSON.stringify(chart));

    var rows = keys.map(function (k, i) {
      return "<tr class='" + (i % 2 ? "r2" : "r1") + "'><td>" + k +
        "</td><td class='col-pts'>" + vals[i] + "</td></tr>";
    }).join("");

    $("opSpotter").innerHTML =
      '<img class="op-chart" alt="Llegadas por hora" src="' + src + '" ' +
      'onerror="this.style.display=\'none\';var n=document.getElementById(\'opChartNote\');if(n)n.hidden=false;">' +
      '<p class="tz-note" id="opChartNote" hidden>Gráfico no disponible (sin conexión a quickchart.io). La tabla tiene los mismos datos.</p>' +
      '<div class="table-wrap op-table"><table class="vis widget"><thead><tr><th>Llegada</th>' +
      "<th class='col-pts'>Ataques</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
  }

  function buildCombos(attacks) {
    function tbl(title, entries, linkify) {
      var rows = entries.map(function (e, i) {
        var v = state.byCoord[e[0]];
        var cell = linkify && v ? TW.villageCell(v) : TW.esc(e[0]);
        return "<tr class='" + (i % 2 ? "r2" : "r1") + "'><td>" + cell +
          "</td><td class='col-pts'>" + e[1] + "</td></tr>";
      }).join("");
      return '<div class="table-wrap"><table class="vis widget"><thead><tr><th>' + title +
        "</th><th class='col-pts'>Ataques</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
    }
    var origins = sortedEntries(countBy(attacks, function (a) { return a.origin.key; }));
    var dests = sortedEntries(countBy(attacks, function (a) { return a.target ? a.target.key : null; }));
    $("combos").innerHTML =
      tbl("Pueblo de origen (" + origins.length + ")", origins, true) +
      tbl("Pueblo objetivo (" + dests.length + ")", dests, true);
  }

  // Wall / loyalty / troops come from the dump itself — a SNAPSHOT as of export,
  // not live. The troop column order is the world's own unit order
  // (get_unit_info.xml); if the count doesn't line up the raw row is shown.
  function buildOwnVillages(attacks) {
    var counts = countBy(attacks, function (a) { return a.target ? a.target.key : null; });
    var keys = Object.keys(state.targets).sort(function (a, b) {
      return (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b);
    });
    if (!keys.length) { $("ownVillages").innerHTML = ""; $("panelOwn").hidden = true; return; }
    $("panelOwn").hidden = false;

    var units = state.cfg ? state.cfg.units : [];
    var anyDef = keys.some(function (k) { return state.targets[k].def; });
    var mismatch = keys.some(function (k) {
      var d = state.targets[k].def;
      return d && units.length && d.length !== units.length;
    });

    var head = "<tr><th>Pueblo</th><th class='col-pts'>Puntos</th><th class='col-pts'>Ataques</th>" +
      "<th class='col-pts'>Muralla</th><th class='col-pts'>Lealtad</th>" +
      (anyDef && units.length && !mismatch
        ? units.map(function (u) { return "<th class='col-pts' title='" + TW.esc(u.name) + "'>" +
            TW.esc(u.name) + "</th>"; }).join("")
        : (anyDef ? "<th>Defensor (sin descodificar)</th>" : "")) + "</tr>";

    var body = keys.map(function (k, i) {
      var t = state.targets[k], v = state.byCoord[k];
      var defCells;
      if (!anyDef) defCells = "";
      else if (units.length && !mismatch) {
        defCells = units.map(function (u, ui) {
          var n = t.def ? t.def[ui] : null;
          return "<td class='col-pts" + (n ? "" : " zero") + "'>" + (n != null ? TW.commas(n) : "—") + "</td>";
        }).join("");
      } else {
        defCells = "<td>" + (t.def ? t.def.join(" ") : "—") + "</td>";
      }
      return "<tr class='" + (i % 2 ? "r2" : "r1") + "'>" +
        "<td>" + (v ? TW.villageCell(v) : TW.esc(k)) + "</td>" +
        "<td class='col-pts'>" + (v && v.points != null ? TW.commas(v.points) : "—") + "</td>" +
        "<td class='col-pts'>" + (counts[k] || 0) + "</td>" +
        "<td class='col-pts'>" + (t.wall != null ? t.wall : "—") + "</td>" +
        "<td class='col-pts'>" + (t.loyalty != null ? t.loyalty : "—") + "</td>" +
        defCells + "</tr>";
    }).join("");

    $("ownVillages").innerHTML =
      '<p class="tz-note">Muralla, lealtad y tropas salen del propio volcado: son una <b>instantánea del momento en que lo exportaste</b>, no datos en vivo.' +
      (mismatch ? " El número de columnas de tropa no coincide con las unidades del mundo, así que se muestra la fila en bruto." : "") +
      '</p><div class="table-wrap"><table class="vis widget own-villages"><thead>' + head +
      "</thead><tbody>" + body + "</tbody></table></div>";
  }

  function buildAttackFilters(attacks) {
    function opts(entries, fmt) {
      return '<option value="">Todos</option>' + entries.map(function (e) {
        return '<option value="' + TW.esc(e[0]) + '">' + TW.esc(fmt ? fmt(e[0]) : e[0]) +
          " (" + e[1] + ")</option>";
      }).join("");
    }
    var players = sortedEntries(countBy(attacks, function (a) { return a.player; }));
    var types = sortedEntries(countBy(attacks, function (a) { return a.speed ? a.speed.label : "?"; }));
    var origins = sortedEntries(countBy(attacks, function (a) { return a.origin.key; }));
    var dests = sortedEntries(countBy(attacks, function (a) { return a.target ? a.target.key : null; }));

    var arrivals = attacks.map(function (a) { return a.arrival; }).sort(function (p, q) { return p - q; });
    var from = TW.fmtDateTime(arrivals[0]), to = TW.fmtDateTime(arrivals[arrivals.length - 1]);

    $("attackFilters").innerHTML =
      '<div class="filter-grid">' +
      '<div class="f"><label for="fPlayer">Jugador</label><select id="fPlayer">' + opts(players) + "</select></div>" +
      '<div class="f"><label for="fType">Tropa</label><select id="fType">' + opts(types) + "</select></div>" +
      '<div class="f"><label for="fOrigin">Pueblo de origen</label><select id="fOrigin">' + opts(origins) + "</select></div>" +
      '<div class="f"><label for="fDest">Pueblo objetivo</label><select id="fDest">' + opts(dests) + "</select></div>" +
      '<div class="f"><label for="fFrom">Llegada desde</label><input type="text" id="fFrom" value="' + from + '"></div>' +
      '<div class="f"><label for="fTo">Llegada hasta</label><input type="text" id="fTo" value="' + to + '"></div>' +
      '</div><div class="filter-actions"><button type="button" id="fApply">Aplicar filtros</button>' +
      '<button type="button" id="fReset">Quitar filtros</button></div>';

    $("fApply").addEventListener("click", function () {
      state.filters = {
        player: $("fPlayer").value, type: $("fType").value,
        origin: $("fOrigin").value, dest: $("fDest").value,
        from: parseDateTime($("fFrom").value), to: parseDateTime($("fTo").value),
      };
      render();
    });
    $("fReset").addEventListener("click", function () {
      ["fPlayer", "fType", "fOrigin", "fDest"].forEach(function (id) { $(id).value = ""; });
      $("fFrom").value = from; $("fTo").value = to;
      state.filters = {};
      render();
    });
  }

  // "YYYY-MM-DD HH:MM[:SS]" in server time → unix seconds (null if unparseable).
  function parseDateTime(s) {
    var m = /^\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s || "");
    if (!m) return null;
    return TW.srvEpoch(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0));
  }

  // === summary / warnings ==================================================
  function summarize() {
    var total = state.rows.length, flagged = 0, unknown = 0;
    var n = { low: 0, new: 0, after: 0, stale: 0 };
    for (var i = 0; i < total; i++) {
      var r = state.rows[i];
      if (r.unknown) { unknown++; continue; }
      if (r.flags.length) flagged++;
      for (var j = 0; j < r.flags.length; j++) n[r.flags[j].cls]++;
    }
    var parts;
    if (state.mode === "attacks") {
      var targets = {}, origins = {};
      state.rows.forEach(function (r) {
        if (r.attack.target) targets[r.attack.target.key] = 1;
        origins[r.coord.key] = 1;
      });
      parts = [total + " ataque" + (total === 1 ? "" : "s"),
        Object.keys(targets).length + " objetivo" + (Object.keys(targets).length === 1 ? "" : "s"),
        Object.keys(origins).length + " pueblo" + (Object.keys(origins).length === 1 ? "" : "s") + " de origen",
        flagged + " marcado" + (flagged === 1 ? "" : "s")];
    } else {
      parts = [total + " coordenada" + (total === 1 ? "" : "s"),
        flagged + " marcada" + (flagged === 1 ? "" : "s")];
    }
    if (n.low) parts.push(n.low + " con pocos puntos");
    if (n.new) parts.push(n.new + " conquistad" + (state.mode === "attacks" ? "o" : "a") +
      (n.new === 1 ? "" : "s") + " hace poco");
    if (n.after) parts.push(n.after + " conquistad" + (state.mode === "attacks" ? "o" : "a") +
      (n.after === 1 ? "" : "s") + " tras el envío");
    if (n.stale) parts.push(n.stale + " sin puntos actuales");
    if (unknown) parts.push(unknown + " sin datos");
    var el = $("summary");
    el.innerHTML = TW.esc(parts.join(" · ")) + '<span id="showing"></span>';
    el.hidden = false;
  }

  function buildWarnings(attacks) {
    var warns = [];
    var trains = {};
    attacks.forEach(function (a) { if (a.train && a.train.noble) trains[a.train.id] = a.train.size; });
    var nTrains = Object.keys(trains).length;
    if (nTrains) {
      warns.push("⚠ " + nTrains + " posible" + (nTrains === 1 ? "" : "s") + " tren" +
        (nTrains === 1 ? "" : "es") + " de nobles (llegadas espaciadas " +
        (state.cfg ? state.cfg.attackGap : 100) + " ms, a velocidad de noble y dentro del alcance)");
    }
    var untagged = attacks.filter(function (a) { return /^(ataque|attack)$/i.test((a.label || "").trim()); }).length;
    if (untagged) warns.push(untagged + " ataque" + (untagged === 1 ? "" : "s") + " sin etiquetar");
    if (!state.cfg) {
      // Trains still work (attack_gap defaults to the near-universal 100 ms) but
      // without unit speeds none of them can be confirmed as noble trains.
      warns.push("No se pudo cargar la configuración del mundo: sin tipo de tropa; " +
        "los trenes se detectan con el valor por defecto de 100 ms y no pueden confirmarse como nobles");
    }
    var el = $("warnLine");
    el.innerHTML = warns.length ? warns.map(TW.esc).join(" · ") : "";
    el.hidden = !warns.length;
  }

  // === wiring ==============================================================
  function readOpts() {
    var mp = parseFloat($("minpoints").value);
    var md = parseFloat($("maxdays").value);
    if (!isFinite(mp) || mp < 0) mp = 0;
    if (!isFinite(md) || md < 0) md = 0;
    try {
      localStorage.setItem(LS_POINTS, String(mp));
      localStorage.setItem(LS_DAYS, String(md));
    } catch (e) { /* private mode */ }
    return { minPoints: mp, maxDays: md };
  }

  function fail(msg) {
    $("status").textContent = msg;
    $("status").style.display = "";
    $("summary").hidden = true;
    $("modeNote").hidden = true;
    $("warnLine").hidden = true;
    $("panels").hidden = true;
    $("tableWrap").hidden = true;
  }

  // An exception used to escape the click handler and leave the page looking
  // like the button did nothing. Anything that goes wrong must SAY so.
  function reportError(e) {
    if (window.console) console.error("Entrantes:", e);
    var stale = typeof TW.srvEpoch !== "function";
    $("status").textContent = stale
      ? "Tu navegador está usando una versión antigua de js/common.js en caché. " +
        "Recarga con Ctrl+F5 (o Cmd+Shift+R) y vuelve a intentarlo."
      : "Algo falló al analizar: " + (e && e.message ? e.message : e) +
        "  (detalles en la consola del navegador)";
    $("status").style.display = "";
    $("summary").hidden = true;
    $("modeNote").hidden = true;
    $("panels").hidden = true;
    $("tableWrap").hidden = true;
  }

  function analyze() {
    try { analyzeInner(); } catch (e) { reportError(e); }
  }

  function analyzeInner() {
    var text = $("coords").value;
    var parsed = isAttackDump(text) ? parseAttacks(text) : null;
    var coords = parsed ? null : parseCoords(text);

    if (parsed && !parsed.attacks.length) {
      return fail("Se detectaron órdenes de ataque pero no se pudo leer ninguna. " +
        "¿Es el texto completo de la pantalla de entrantes?");
    }
    if (coords && !coords.length) {
      return fail("No se han encontrado coordenadas válidas (formato 500|600).");
    }

    var modeChanged = state.mode !== (parsed ? "attacks" : "coords");
    state.mode = parsed ? "attacks" : "coords";
    state.filters = {};
    // Default: earliest arrival first — what lands next is what you act on.
    // A sort the user picked survives a re-analysis within the same mode.
    if (modeChanged || !state.sort) {
      state.sort = state.mode === "attacks" ? { key: "arrival", dir: "asc" } : { key: null };
    }
    var opts = readOpts();
    $("status").textContent = "Analizando…";
    $("status").style.display = "";

    state.ready.then(function () {
      // Errors thrown in here would otherwise be swallowed by the .catch below.
      try { finish(); } catch (e) { reportError(e); }
    }).catch(function () { /* status already shows the load error */ });

    function finish() {
      var now = Math.floor(Date.now() / 1000);
      if (parsed) {
        state.targets = parsed.targets;
        var attacks = enrichAttacks(parsed.attacks);
        state.rows = attacks.map(function (a) {
          var row = analyzeVillage(a.origin, a.sent, opts);
          row.attack = a;
          return row;
        });
      } else {
        state.targets = {};
        state.rows = coords.map(function (c) { return analyzeVillage(c, now, opts); });
      }

      $("status").style.display = "none";
      $("modeNote").textContent = state.mode === "attacks"
        ? "Modo órdenes de ataque: cada conquista se compara con la hora de ENVÍO de su ataque."
        : "Modo lista de coordenadas: cada conquista se compara con AHORA.";
      $("modeNote").hidden = false;

      if (state.mode === "attacks") {
        var all = state.rows.map(function (r) { return r.attack; });
        buildTotals(all);
        buildOpSpotter(all);
        buildCombos(all);
        buildOwnVillages(all);
        buildAttackFilters(all);
        buildWarnings(all);
        $("panels").hidden = false;
      } else {
        $("panels").hidden = true;
        $("warnLine").hidden = true;
      }

      summarize();
      render();
    }
  }

  function init() {
    TW.renderNav("entrantes");

    // This page needs a common.js new enough to have TW.srvEpoch. The ?v= on the
    // script tags should guarantee that, but a proxy or an odd cache can still
    // pair a new incomings.js with an old common.js — fail loudly, not silently.
    if (typeof TW.srvEpoch !== "function") {
      $("status").textContent = "Tu navegador está usando una versión antigua de " +
        "js/common.js en caché. Recarga con Ctrl+F5 (o Cmd+Shift+R).";
      $("analyze").disabled = true;
      return;
    }

    try {
      var mp = localStorage.getItem(LS_POINTS), md = localStorage.getItem(LS_DAYS);
      if (mp !== null) $("minpoints").value = mp;
      if (md !== null) $("maxdays").value = md;
    } catch (e) { /* private mode */ }

    TW.loadJSON("meta.json").then(function (m) {
      $("worldName").textContent = m.world || TW.WORLD;
      $("metaLine").textContent = TW.commas(m.villageCount) + " pueblos · " +
        TW.commas(m.conquers) + " ennoblecimientos archivados · datos obtenidos " +
        TW.fmtTime(m.pulledUnix);
    }).catch(function () { $("metaLine").textContent = ""; });

    // Attacker names → profile links (the dump carries no player ids).
    state.playersByName = {};
    TW.loadJSON("players.json").then(function (list) {
      list.forEach(function (p) { if (p.name) state.playersByName[p.name] = p; });
    }).catch(function () { /* links degrade to plain text */ });

    loadAll();

    $("analyze").addEventListener("click", analyze);
    $("clear").addEventListener("click", function () {
      $("coords").value = "";
      state.rows = []; state.targets = {}; state.filters = {};
      $("summary").hidden = true;
      $("modeNote").hidden = true;
      $("warnLine").hidden = true;
      $("panels").hidden = true;
      $("tableWrap").hidden = true;
      $("status").style.display = "";
      $("status").textContent = "Pega las coordenadas (o tus entrantes) y pulsa «Analizar».";
      $("coords").focus();
    });
    $("onlyflagged").addEventListener("change", function () {
      if (state.rows.length) render();
    });
    $("groupbytarget").addEventListener("change", function () {
      if (state.rows.length) render();
    });
    // Re-run on setting change so the thresholds feel live once analysed.
    $("minpoints").addEventListener("change", function () { if (state.rows.length) analyze(); });
    $("maxdays").addEventListener("change", function () { if (state.rows.length) analyze(); });
    // Ctrl/Cmd+Enter in the textarea = Analizar.
    $("coords").addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); analyze(); }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
