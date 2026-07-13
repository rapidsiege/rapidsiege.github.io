// Refill Defeated Supports by Vanquished
// Version 1.0, 2026-07-13
//
// Run on a defeated-support report ("Your support from N villages in X has been
// attacked" — report_ReportSupportAttack/Merged). The script reads the supported
// village (the target) and every "troop origin" block's LOSSES row, and turns them
// into refill orders: send each origin's dead defense back to the same target.
//
// Orders accumulate across reports in localStorage (per world, deduped by report
// id), so you can walk several reports and export ONE plan at the end. The export
// is a SUPPORTPLAN text for the supportSender script (Rally point → Mass support):
// paste it there and it fills every order target by target.
//
// ⚠ FORMAT CONTRACT with ssParsePlan() in supportSender.js (and defScriptText() in
// tribe-calculator's js/defense-plan.js) — change either side only in lockstep:
//   SUPPORTPLAN;1;<world>;<player>;<unit,unit,...>
//   <target>;<source>;<units...>;<arriveMs epoch or empty>
//
// Parsing is anchored on class names and data-* attributes (village_anchor,
// unit-item-<unit>, data-unit-count), so it is language-independent.
//
// ################# Disclaimer #################
// By uploading a user-generated mod for use with Tribal Wars, the creator grants
// InnoGames a perpetual, irrevocable, worldwide, royalty-free, non-exclusive license
// to use, reproduce, distribute, publicly display, modify, and create derivative
// works of the mod. This license permits InnoGames to incorporate the mod into any
// aspect of the game and its related services, including promotional and commercial
// endeavors, without any requirement for compensation or attribution to the uploader.
// The uploader represents and warrants that they have the legal right to grant this
// license and that the mod does not infringe upon any third-party rights. German law applies.
//

// Units the mass-support form can send (canonical column order). Losses in any
// other unit (axe, light, marcher, knight, snob) can't be refilled there — they
// are reported in the UI and left out of the export.
var RS_SENDABLE_UNITS = ["spear", "sword", "archer", "spy", "heavy", "ram", "catapult"];

// ── pure parsing / plan building (headless-testable, no game globals) ──

// coord is the LAST XXX|YYY in the anchor text: "[A] 016 - Name - (552|567) C55"
function rsAnchorCoord(text) {
    var m = String(text || "").match(/\d{1,3}\|\d{1,3}/g);
    return m ? m[m.length - 1] : null;
}

// Unit table row → {unit: count} from the td.unit-item cells' data-unit-count.
function rsRowUnits(tr) {
    var units = {};
    Array.from(tr.querySelectorAll("td[data-unit-count]")).forEach(function (td) {
        var m = (td.className || "").match(/unit-item-([a-z]+)/);
        if (m) units[m[1]] = parseInt(td.getAttribute("data-unit-count"), 10) || 0;
    });
    return units;
}

// doc → {ok, target:{coord,name,player}, origins:[{coord,name,amounts,losses}]}
// The report td holds one village_anchor per village: the supported village first
// ("Pueblo apoyado"), then one per troop-origin block. Each origin's anchor table
// is followed by a table.vis whose data-unit-count rows are amounts, then losses.
function rsParseReport(doc) {
    var td = doc.querySelector('td[class*="report_ReportSupport"]');
    if (!td) return { ok: false, error: "noreport" };

    var anchors = Array.from(td.querySelectorAll("span.village_anchor"));
    if (!anchors.length) return { ok: false, error: "notarget" };

    function anchorInfo(a) {
        var link = a.querySelector("a");
        var text = link ? link.textContent.trim() : a.textContent.trim();
        return { coord: rsAnchorCoord(text), name: text };
    }

    var target = anchorInfo(anchors[0]);
    if (!target.coord) return { ok: false, error: "notarget" };
    var playerLink = td.querySelector('a[href*="screen=info_player"]');
    target.player = playerLink ? playerLink.textContent.trim() : "";

    var origins = [];
    anchors.slice(1).forEach(function (a) {
        var info = anchorInfo(a);
        if (!info.coord) return;
        // walk from the anchor's table to the next unit table; another
        // village_anchor table first means this origin has no unit table
        var node = a.closest("table");
        var unitTable = null;
        while (node && (node = node.nextElementSibling)) {
            if (node.tagName === "TABLE") {
                if (node.querySelector("span.village_anchor")) break;
                if (node.querySelector("td[data-unit-count]")) { unitTable = node; break; }
            }
        }
        if (!unitTable) return;
        var rows = Array.from(unitTable.querySelectorAll("tr")).filter(function (tr) {
            return tr.querySelector("td[data-unit-count]");
        });
        if (rows.length < 2) return; // need amounts + losses
        origins.push({
            coord: info.coord,
            name: info.name,
            amounts: rsRowUnits(rows[0]),
            losses: rsRowUnits(rows[rows.length - 1])
        });
    });

    if (!origins.length) return { ok: false, error: "noorigins" };
    return { ok: true, target: target, origins: origins };
}

// Add a parsed report's nonzero losses to the state as one order per origin.
// Dedup by report id: a report already in state.reports is never added twice.
function rsAddReport(state, reportId, parsed) {
    if (state.reports[reportId]) return { added: 0, already: true };
    var added = 0;
    parsed.origins.forEach(function (o) {
        var units = {};
        var any = false;
        Object.keys(o.losses).forEach(function (u) {
            if (o.losses[u] > 0) { units[u] = o.losses[u]; any = true; }
        });
        if (!any) return; // origin survived unscathed — nothing to refill
        state.orders.push({ target: parsed.target.coord, tName: parsed.target.name, source: o.coord, units: units, reportId: reportId });
        added++;
    });
    state.reports[reportId] = { target: parsed.target.coord, orders: added };
    return { added: added, already: false };
}

// Merge orders by target+source (summing units), keeping first-seen target
// grouping so the plan stays target-by-target like the tribe-calculator export.
function rsAggregateOrders(orders) {
    var byKey = {}, list = [];
    orders.forEach(function (o) {
        var key = o.target + ">" + o.source;
        var agg = byKey[key];
        if (!agg) {
            byKey[key] = agg = { target: o.target, tName: o.tName, source: o.source, units: {} };
            list.push(agg);
        }
        Object.keys(o.units).forEach(function (u) {
            agg.units[u] = (agg.units[u] || 0) + o.units[u];
        });
    });
    // stable target grouping: order of first appearance of each target
    var targetOrder = {}, n = 0;
    orders.forEach(function (o) { if (!(o.target in targetOrder)) targetOrder[o.target] = n++; });
    list.sort(function (a, b) { return targetOrder[a.target] - targetOrder[b.target]; });
    return list;
}

// Build the SUPPORTPLAN text (see FORMAT CONTRACT above). Columns are the sendable
// units this world has that show any losses; anything else lands in `ignored`.
function rsBuildPlan(state, world, player, worldUnits) {
    var agg = rsAggregateOrders(state.orders);
    var totals = {}, ignored = {};
    agg.forEach(function (o) {
        Object.keys(o.units).forEach(function (u) {
            var sendable = RS_SENDABLE_UNITS.indexOf(u) !== -1 && worldUnits.indexOf(u) !== -1;
            var bucket = sendable ? totals : ignored;
            bucket[u] = (bucket[u] || 0) + o.units[u];
        });
    });
    var cols = RS_SENDABLE_UNITS.filter(function (u) { return totals[u] > 0; });
    if (!cols.length) return { text: null, orders: agg.length, targets: 0, cols: [], totals: totals, ignored: ignored };

    var lines = ["SUPPORTPLAN;1;" + world + ";" + player + ";" + cols.join(",")];
    var targets = {};
    agg.forEach(function (o) {
        targets[o.target] = true;
        lines.push(o.target + ";" + o.source + ";" + cols.map(function (u) { return o.units[u] || 0; }).join(";") + ";");
    });
    return { text: lines.join("\n"), orders: agg.length, targets: Object.keys(targets).length, cols: cols, totals: totals, ignored: ignored };
}

// ── game side: state, UI ──

function rsStateKey() { return game_data.world + "refill_supports_v1"; }

function rsLoadState() {
    var state = null;
    try { state = JSON.parse(localStorage.getItem(rsStateKey())); } catch (e) { }
    if (!state || typeof state !== "object" || !Array.isArray(state.orders) || typeof state.reports !== "object") {
        state = { reports: {}, orders: [] };
    }
    return state;
}

function rsSaveState(state) { localStorage.setItem(rsStateKey(), JSON.stringify(state)); }

function rsReportId() {
    var m = window.location.href.match(/[?&]view=(\d+)/);
    return m ? m[1] : null;
}

function rsEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Game unit icon; image_base is a per-world global on every page.
function rsIconImg(unit) {
    return (typeof image_base != "undefined")
        ? '<img src="' + image_base + "unit/unit_" + unit + '.webp" style="vertical-align:middle;" title="' + unit + '" alt="' + unit + '" /> '
        : unit + " ";
}

function rsUnitTotalsHtml(totals) {
    var keys = RS_SENDABLE_UNITS.filter(function (u) { return totals[u] > 0; })
        .concat(Object.keys(totals).filter(function (u) { return RS_SENDABLE_UNITS.indexOf(u) === -1 && totals[u] > 0; }));
    if (!keys.length) return "<i>none</i>";
    return keys.map(function (u) { return rsIconImg(u) + totals[u]; }).join(" &nbsp; ");
}

function rsOpenUI(status) {
    var state = rsLoadState();
    var plan = rsBuildPlan(state, game_data.world, game_data.player.name, game_data.units);
    var reportIds = Object.keys(state.reports);

    var html = "<head></head><body><h2>Refill defeated supports</h2>";
    if (status) html += "<p>" + status + "</p>";

    if (!state.orders.length) {
        html += "<p><i>No orders yet — run this script on a defeated-support report to add its losses.</i></p>";
    } else {
        html += "<p><b>" + plan.orders + "</b> refill order" + (plan.orders === 1 ? "" : "s") +
            " to <b>" + plan.targets + "</b> target" + (plan.targets === 1 ? "" : "s") +
            " from <b>" + reportIds.length + "</b> report" + (reportIds.length === 1 ? "" : "s") + "</p>" +
            "<p>Total losses to refill: " + rsUnitTotalsHtml(plan.totals) + "</p>";
        var ignoredKeys = Object.keys(plan.ignored).filter(function (u) { return plan.ignored[u] > 0; });
        if (ignoredKeys.length) {
            html += '<p class="warn">Not sendable via mass support (left out of the plan): ' + rsUnitTotalsHtml(plan.ignored) + "</p>";
        }
        if (plan.text) {
            html += "<p><textarea id='rs-plan-text' rows='8' style='width:100%;' readonly>" + rsEsc(plan.text) + "</textarea></p>" +
                '<p><input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="rsCopyPlan()" value="Copy SUPPORTPLAN"> ' +
                "<span class='small grey'>paste it into the supportSender script (Rally point → Mass support)</span></p>";
        } else {
            html += "<p class='warn'>No sendable losses in the plan — nothing to export.</p>";
        }
        html += '<p><input type="button" class="btn" onclick="rsRemoveCurrentReport()" value="Remove this report"> ' +
            '<input type="button" class="btn" onclick="rsClearPlan()" value="Clear plan"></p>';
    }
    html += "</body>";
    Dialog.show("Refill supports", html);
}

function rsCopyPlan() {
    var ta = document.getElementById("rs-plan-text");
    if (!ta) return;
    ta.focus();
    ta.select();
    try {
        document.execCommand("copy");
        UI.SuccessMessage("plan copied — paste it into supportSender", 2000);
    } catch (e) {
        UI.ErrorMessage("copy failed — select the text and copy manually", 3000);
    }
}

function rsRemoveCurrentReport() {
    var id = rsReportId();
    var state = rsLoadState();
    if (!id || !state.reports[id]) { UI.ErrorMessage("the current report is not in the plan", 2000); return; }
    delete state.reports[id];
    state.orders = state.orders.filter(function (o) { return o.reportId !== id; });
    rsSaveState(state);
    rsOpenUI("Removed this report from the plan.");
}

function rsClearPlan() {
    if (!confirm("clear ALL stored refill orders?")) return;
    rsSaveState({ reports: {}, orders: [] });
    rsOpenUI("Plan cleared.");
}

// ── entry point: on a report view, parse + auto-add; anywhere else just show the plan ──

function rsMain() {
    var reportId = rsReportId();
    var onReport = window.location.href.indexOf("screen=report") !== -1 && reportId !== null;
    if (!onReport) {
        if (rsLoadState().orders.length) { rsOpenUI("<i>Not on a report — showing the stored plan.</i>"); return; }
        alert("run this script on a defeated-support report\n(Reports → the \"your support ... has been attacked\" report)");
        return;
    }

    var parsed = rsParseReport(document);
    if (!parsed.ok) {
        var why = {
            noreport: "this is not a defeated-support report",
            notarget: "could not find the supported village",
            noorigins: "could not find any troop-origin blocks"
        }[parsed.error];
        rsOpenUI('<span class="warn">Nothing added: ' + why + ".</span>");
        return;
    }

    var state = rsLoadState();
    var res = rsAddReport(state, reportId, parsed);
    rsSaveState(state);
    var status = res.already
        ? "<i>This report is already in the plan.</i>"
        : "Added <b>" + res.added + "</b> refill order" + (res.added === 1 ? "" : "s") + " for target <b>" + rsEsc(parsed.target.name) + "</b>.";
    if (!res.already && res.added === 0) status = "<i>No losses in this report — nothing to refill.</i>";
    rsOpenUI(status);
}

rsMain();
