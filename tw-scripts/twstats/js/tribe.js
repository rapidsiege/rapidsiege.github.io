/* Tribe profile page. Classic script; needs common.js + chart.js first.
   Reads ?id=X, loads tribes/X.json (profile/series/memberList/gains/losses). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var CONQ_CAP = 200;

  function qid() {
    var m = /[?&]id=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function row(label, valueHtml, star) {
    return "<tr><th class='pl'>" + TW.esc(label) + (star ? "&nbsp;*" : "") +
      "</th><td>" + valueHtml + "</td></tr>";
  }

  function renderProfile(p) {
    var html = "";
    html += row("Ranking", p.rank + ".");
    html += row("Nombre", TW.esc(p.name));
    html += row("Tag", TW.esc(p.tag));
    html += row("Miembros", TW.commas(p.members));
    html += row("Puntos", TW.commas(p.points));
    html += row("Pueblos", TW.commas(p.villages));
    html += row("Promedio de puntos por pueblo", TW.commas(p.avg));
    html += row("Conquistas", TW.commas(p.conquests));
    html += row("Perdidos", TW.commas(p.lost));
    html += row("Primera vez visto", TW.fmtDate(p.firstSeen), true);
    html += row("Mejor clasificación", p.bestRank + ".", true);
    html += row("Mayoría de puntos", TW.commas(p.maxPoints), true);
    html += row("Mayoría de pueblos", TW.commas(p.maxVillages), true);
    html += row("Adv. vencidos (Totales)", TW.commas(p.od_total));
    html += row("Adv. vencidos (Atacante)", TW.commas(p.od_att));
    html += row("Adv. vencidos (Defensor)", TW.commas(p.od_def));
    html += row("Adv. vencidos (Apoyo)", TW.commas(p.od_sup));
    $("profileBody").innerHTML = html;
  }

  var METRICS = [
    { key: "points", label: "Puntos" },
    { key: "members", label: "Miembros" },
    { key: "villages", label: "Pueblos" },
    { key: "od_total", label: "OD" },
    { key: "od_att", label: "ODA" },
    { key: "od_def", label: "ODD" },
    { key: "od_sup", label: "ODS" },
    { key: "rank", label: "Ranking", invert: true },
  ];

  function renderCharts(series) {
    TW.metricChart($("perfilChart"), series, METRICS, { width: 460, height: 200 });
    TW.metricChart($("histChart"), series, METRICS, { width: 900, height: 280 });
  }

  // History rows newest→oldest; change prefixes vs the previous (older) snapshot.
  function renderHistory(series) {
    var html = "";
    for (var i = series.length - 1, k = 0; i >= 0; i--, k++) {
      var s = series[i], prev = i > 0 ? series[i - 1] : null;
      html += "<tr class='" + (k % 2 ? "r2" : "r1") + "'>" +
        "<td>" + TW.fmtDate(s.t) + "</td>" +
        TW.changeCell(s.rank, prev && prev.rank, { invert: true }) +
        TW.changeCell(s.members, prev && prev.members) +
        TW.changeCell(s.points, prev && prev.points) +
        TW.changeCell(s.villages, prev && prev.villages) +
        TW.changeCell(s.od_total, prev && prev.od_total) +
        TW.changeCell(s.od_att, prev && prev.od_att) +
        TW.changeCell(s.od_def, prev && prev.od_def) +
        TW.changeCell(s.od_sup, prev && prev.od_sup) +
        "</tr>";
    }
    $("historyBody").innerHTML = html || "<tr class='r1'><td colspan='9' class='status'>Sin datos.</td></tr>";
  }

  function renderMembers(list) {
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      html += "<tr class='" + (i % 2 ? "r2" : "r1") + "'>" +
        "<td class='col-rank'>" + m.rank + ".</td>" +
        "<td>" + TW.playerLink(m.id, m.name) + "</td>" +
        "<td class='col-pts'>" + TW.commas(m.points) + "</td>" +
        "<td class='col-pts'>" + TW.commas(m.villages) + "</td></tr>";
    }
    $("membersBody").innerHTML = html || "<tr class='r1'><td colspan='4' class='status'>Sin miembros.</td></tr>";
  }

  function conquestRows(list) {
    var html = "";
    var slice = list.slice(0, CONQ_CAP);
    for (var i = 0; i < slice.length; i++) {
      var r = slice[i];
      var pts = r.village.points != null ? TW.commas(r.village.points) : "?";
      html += "<tr class='" + (i % 2 ? "r2" : "r1") + "'>" +
        "<td>" + TW.villageCell(r.village) + "</td>" +
        "<td class='col-pts'>" + pts + "</td>" +
        "<td>" + TW.ownerCell(r.oldOwner) + "</td>" +
        "<td>" + TW.ownerCell(r.newOwner) + "</td>" +
        "<td class='col-date'>" + TW.fmtStamp(r.t) + "</td></tr>";
    }
    return html || "<tr class='r1'><td colspan='5' class='status'>Ninguno.</td></tr>";
  }

  function countNote(list) {
    if (list.length > CONQ_CAP) return "(mostrando " + CONQ_CAP + " de " + TW.commas(list.length) + ")";
    return "(" + TW.commas(list.length) + ")";
  }

  function fail(msg) {
    $("status").textContent = msg + "  (¿sirviendo por HTTP? file:// bloquea fetch)";
    $("status").style.display = "block";
  }

  function init() {
    TW.renderNav("tribus");
    var id = qid();
    if (!id) { fail("Tribu no encontrada: falta el parámetro ?id."); return; }

    TW.loadJSON("tribes/" + encodeURIComponent(id) + ".json")
      .then(function (d) {
        var p = d.profile;
        document.title = "es100 · " + p.tag;
        var badge = p.current ? "" :
          ' <span class="archived">(tribu archivada / ya no existe)</span>';
        $("pageTitle").innerHTML = "Perfil de la Tribu: " + TW.esc(p.name) +
          ' <span class="tag-br">[' + TW.esc(p.tag) + "]</span>" + badge;
        renderProfile(p);
        renderCharts(d.series || []);
        renderHistory(d.series || []);
        renderMembers(d.memberList || []);
        $("memberCount").textContent = "(" + TW.commas((d.memberList || []).length) + ")";
        $("gainsBody").innerHTML = conquestRows(d.gains || []);
        $("lossesBody").innerHTML = conquestRows(d.losses || []);
        $("gainsCount").textContent = countNote(d.gains || []);
        $("lossesCount").textContent = countNote(d.losses || []);
        $("status").style.display = "none";
        $("content").hidden = false;
        TW.initTabs();
      })
      .catch(function (e) {
        if (/HTTP 404/.test(e.message)) fail("Tribu no encontrada (id " + id + ").");
        else fail("No se pudieron cargar los datos: " + e.message);
      });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
