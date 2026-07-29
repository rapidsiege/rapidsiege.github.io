// Original Script by lodi94 (https://forum.tribalwars.net/index.php?threads/download-tribe-info.285469/)
// Maintained by Vanquished
//
// v4 — works in the mobile app and mobile browsers as well as on desktop:
//   • member list no longer scraped from the desktop members table (three sources, best
//     first: the player_id <select>, /map/player.txt filtered by own tribe, legacy table)
//   • Share buttons (Web Share API) export a real file where downloads don't work
//     (app WebViews); Copy buttons as a universal fallback
//   • points parsing fixed on the defense/incoming views
// v3 — adds building levels + a structured parse → serialize split so every view can
// export as .txt AND .json. Units/buildings change based on world settings. Modes:
//   members_troops    "Read troops of the village"          — a village's own army
//   members_defense   "Read defenses in the village"        — everything stationed there ("en el pueblo")
//   members_incoming  "Read incoming troops of the village" — troops en route to it   ("en camino")
//   all_troops        "Read all troops"                     — the three troop views combined (Type column)
//   members_buildings "Read all buildings"                  — 16 building levels per village
//   everything        "Read everything (JSON only)"         — all troops + buildings, one object per village
//
// Units .txt positionally as  Coords, Player, [Type], <units in game_data.units order>, [IncomingAttacks].
// Buildings .txt positionally as Coords, Player, Village, Points, <buildings in header order>.
// .json exports are more free-formated based on mode, but contain all relevant information with similar structures.

/* ─────────────────────────── UI ─────────────────────────── */

function openUI() {
    // Two <hr> separators group the list: single troop views + all_troops · buildings · everything.
    html = '<head></head><body><h1>Tribe troop counter</h1><form><fieldset><legend>Settings</legend>'
        + '<p><input type="radio" name="mode" id="of"  onchange="setMode(\'members_troops\')">Read troops of the village</input></p>'
        + '<p><input type="radio" name="mode" id="in"  onchange="setMode(\'members_defense\')">Read defenses in the village</input></p>'
        + '<p><input type="radio" name="mode" id="inc" onchange="setMode(\'members_incoming\')">Read incoming troops of the village</input></p>'
        + '<p><input type="radio" name="mode" id="allt" onchange="setMode(\'all_troops\')">Read all troops</input></p>'
        + '<hr>'
        + '<p><input type="radio" name="mode" id="bld" onchange="setMode(\'members_buildings\')">Read all buildings</input></p>'
        + '<hr>'
        + '<p><input type="radio" name="mode" id="all" onchange="setMode(\'everything\')">Read everything (JSON only)</input></p>'
        + '</fieldset><fieldset><legend>Filters</legend><select id="variable"><option value="x">x</option><option value="y">y</option>' + createUnitOption() + '</select><select id="kind"><option value=">">\></option><option value="<">\<</option></select><input type="text" id="value"></input><input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="addFilter()" value="Save filter"></input><p><table><tr><th>Variable filtered</th><th>Operatore</th><th>Value</th><th></th></tr>' + createFilterTable() + '</form></p></fieldset><div><p><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="run" onclick="readData()" value="Read data"></input></p></div></body>';
    Dialog.show("Troop counter", html);
    var m = localStorage.troopCounterMode;
    var byMode = { members_defense: "in", members_incoming: "inc", all_troops: "allt", members_buildings: "bld", everything: "all" };
    var id = byMode[m] || "of";
    document.getElementById(id).checked = true;
}

function setMode(a) {
    localStorage.troopCounterMode = a;
}

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

// File export via the native share sheet — the only way to produce an actual FILE inside
// the mobile app, whose WebView swallows download()'s data: URI + synthetic click.
// navigator.share({files}) raises the system share sheet (Save to Files / AirDrop / …),
// no clipboard involved. Support is device- and WebView-dependent, so the button only
// renders when canShareFiles() says yes (see showData).
function canShareFiles() {
    try {
        var probe = new File(["x"], "probe.txt", { type: "text/plain" });
        return !!(navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch (e) {
        return false;                                  // no File constructor / no canShare
    }
}

function shareExport(kind) {
    var text = kind === "json" ? window._tribeInfoJson : window._tribeInfoTxt;
    var base = window._tribeInfoBase || "tribe_info";
    if (!text) return;

    var file = null;
    try {
        file = new File([text], base + "." + kind, {
            type: kind === "json" ? "application/json" : "text/plain",
        });
    } catch (e) { /* fall through to the guard below */ }

    if (!file || !navigator.canShare || !navigator.canShare({ files: [file] })) {
        UI.ErrorMessage("Sharing files isn't supported here — use Copy instead.", 4000);
        return;
    }

    navigator.share({ files: [file] }).then(function () {
        UI.SuccessMessage("Shared " + base + "." + kind + ".", 2000);
    }, function (err) {
        if (err && err.name === "AbortError") return;  // user closed the sheet — not an error
        UI.ErrorMessage("Share failed — use Copy instead.", 4000);
    });
}

// Clipboard export — the fallback that works where download() doesn't (see showData).
// navigator.clipboard needs a secure context and can be absent in a WebView, so fall back
// to selecting the on-screen textarea and letting execCommand copy it.
function copyExport(kind) {
    var text = kind === "json" ? window._tribeInfoJson : window._tribeInfoTxt;
    if (!text) return;

    // Copy from a throwaway textarea holding exactly `text` — the visible one only ever shows
    // one of the two exports, so selecting it would copy the wrong one.
    function viaTextarea() {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { ta.setSelectionRange(0, text.length); } catch (e) {}   // iOS needs the explicit range
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
            UI.SuccessMessage("Copied " + kind + " to clipboard.", 2000);
        }, function () {
            if (viaTextarea()) UI.SuccessMessage("Copied " + kind + " to clipboard.", 2000);
            else UI.ErrorMessage("Could not copy — select the text above and copy it manually.", 5000);
        });
        return;
    }

    if (viaTextarea()) UI.SuccessMessage("Copied " + kind + " to clipboard.", 2000);
    else UI.ErrorMessage("Could not copy — select the text above and copy it manually.", 5000);
}

function downloadInfo(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(null);
    return request.response;
}

// The mobile app renders its own layout, so nothing read out of the live page can be
// assumed to look like the desktop markup. game_data.device is "desktop" on the desktop
// layout and "ios"/"android" in the app.
function isMobileLayout() {
    return typeof game_data !== "undefined" && !!game_data.device && game_data.device !== "desktop";
}

// One pass over /map/player.txt gives names, village counts AND tribe ids — all three
// layout-independent. Cached for an hour. Only the player's own tribe is kept: every
// lookup downstream is for a tribe member, and storing a mature world's full player list
// is megabytes against the origin's localStorage quota. Cache key carries world + tribe
// so changing either invalidates it.
function getPlayerInfo() {
    var now = new Date();
    var server = window.location.host;
    var myTribe = String(game_data.player.ally || "");
    var stamp = server + "|" + myTribe;

    if (localStorage.playerInfo2) {
        var parts = localStorage.playerInfo2.split(":::");
        if (parts[0] === stamp && (now - new Date(parts[1])) < 1000 * 60 * 60) {
            return JSON.parse(parts[2]);
        }
    }

    var info = { name: {}, villages: {}, tribe: {} };
    var rows = downloadInfo("https://" + server + "/map/player.txt").split("\n");
    for (var i = 0; i < rows.length; i++) {
        if (rows[i] === "") continue;
        var row = rows[i].split(",");                  // id,name,tribeId,villages,points,rank
        if (myTribe && row[2] !== myTribe) continue;
        info.name[row[0]] = row[1].replace(/\+/g, " ");
        info.tribe[row[0]] = row[2];
        info.villages[row[0]] = parseInt(row[3], 10) || 0;
    }

    // A full quota is not a reason to abort the run — we already hold the data in memory.
    try {
        localStorage.playerInfo2 = stamp + ":::" + now + ":::" + JSON.stringify(info);
    } catch (e) {
        console.warn("tribeInfo: could not cache player data", e);
    }
    return info;
}

/* ─────────────── Member list (layout-independent) ─────────────── */

// The desktop members table (<table class="vis"> with "[player_id]" links) doesn't exist
// on the mobile layout, so the member list can't be scraped from it. Three sources, best
// first — the first one that yields ids wins:
//   1. the player_id <select> the ally screens carry (live, so never stale)
//   2. /map/player.txt filtered by own tribe id (no DOM at all)
//   3. the legacy desktop table scrape (kept so an unrecognised layout still degrades)
// Village counts only drive pagination, so an unknown count safely means "one page".
function getTribeMembers(info, doc, myTribe) {
    doc = doc || document;
    if (myTribe === undefined) myTribe = game_data.player.ally;

    var ids = membersFromSelect(doc);
    if (!ids.length) ids = membersFromWorldData(info, myTribe);
    if (!ids.length) ids = membersFromMembersTable(doc);

    var seen = {}, members = [];
    ids.forEach(function (id) {
        if (seen[id]) return;                          // the select can repeat ids across forms
        seen[id] = true;
        members.push({ playerId: String(id), villageAmount: info.villages[id] || 0 });
    });
    return members;
}

// Present on the members_troops / members_defense / members_buildings screens on both
// layouts; absent on the members overview in the app — which is why the world-data
// fallback below exists rather than this being the only source.
function membersFromSelect(doc) {
    var sel = doc.querySelector('select[name="player_id"]');
    if (!sel) return [];
    return Array.from(sel.querySelectorAll("option[value]"))
        .map(function (o) { return String(o.value).trim(); })
        .filter(function (v) { return /^\d+$/.test(v) && v !== "0"; });
}

function membersFromWorldData(info, myTribe) {
    myTribe = String(myTribe || "");
    if (!myTribe || myTribe === "0") return [];        // tribeless — nothing to read
    return Object.keys(info.tribe).filter(function (id) { return info.tribe[id] === myTribe; });
}

// Legacy desktop-only path — guarded so a missing table returns [] instead of throwing.
function membersFromMembersTable(doc) {
    var ids = [];
    try {
        var table = (doc || document).getElementsByClassName("vis")[2];
        if (!table) return [];
        for (var i = 1; i < table.rows.length - 1; i++) {
            var html = table.rows[i].innerHTML;
            if (html.indexOf("[") === -1) continue;
            ids.push(html.split("[")[1].split("]")[0]);
        }
    } catch (e) {
        return [];
    }
    return ids;
}

function addFilter() {
    filters = {};
    if (localStorage.troopCounterFilter) {
        filters = JSON.parse(localStorage.troopCounterFilter);
    }
    if (filters[document.getElementById("variable").value]) {
        if (isNaN(document.getElementById("value").value)) {
            UI.ErrorMessage("Insert a valid value", 3000);

        } else {
            filters[document.getElementById("variable").value].push([document.getElementById("kind").value, document.getElementById("value").value]);
        }

    } else {
        if (isNaN(document.getElementById("value").value)) {
            UI.ErrorMessage("Insert a valid value", 3000);

        } else {
            filters[document.getElementById("variable").value] = [[document.getElementById("kind").value, document.getElementById("value").value]];
        }
    }
    localStorage.troopCounterFilter = JSON.stringify(filters);
    openUI();
}

function createUnitOption() {
    unitsList = game_data.units;
    menu = "";
    for (i = 0; i < unitsList.length; i++) {
        menu = menu + '<option value="' + unitsList[i] + '">' + unitsList[i] + '</option>';
    }
    return menu;
}

function createFilterTable() {
    filters = {};
    if (localStorage.troopCounterFilter) {
        filters = JSON.parse(localStorage.troopCounterFilter);
    }
    rows = ""
    for (filter in filters) {
        for (i = 0; i < filters[filter].length; i++) {
            rows = rows + '<tr><td>' + filter + '</td><td>' + filters[filter][i][0] + '</td><td>' + filters[filter][i][1] + '</td><td><input type="image" src="https://dsit.innogamescdn.com/asset/cbd6f76/graphic/delete.png" onclick="deleteFilter(\'' + filter + '\',\'' + i.toString() + '\')"></input></td></tr>';
        }
    }
    return rows;
}

function deleteFilter(filter, i) {
    if (localStorage.troopCounterFilter) {
        filtres = JSON.parse(localStorage.troopCounterFilter);
        if (filter in filtres) {
            if (parseInt(i) < filtres[filter].length) {
                filtres[filter].splice(parseInt(i), 1);
            }
        }
    }
    localStorage.troopCounterFilter = JSON.stringify(filtres);
    openUI();
}

/* ───────────────────────── Fetch ───────────────────────── */

// Fetch one ally sub-page (synchronously) and return its HTML.
// In sitter mode (someone operates the account in vacation mode) the game needs a
// t=<owner_id> param so requests act on behalf of the sat account. game_data.player.sitter
// is 0 when you run your own account, the sitter's id otherwise.
function fetchTribePage(gameMode, playerId, pageNumber) {
    var URLReq;
    if (game_data.player.sitter > 0) {
        URLReq = "https://" + window.location.host + "/game.php?t=" + game_data.player.id + "&screen=ally&mode=" + gameMode + "&player_id=" + playerId + "&page=" + pageNumber;
    } else {
        URLReq = "https://" + window.location.host + "/game.php?screen=ally&mode=" + gameMode + "&player_id=" + playerId + "&page=" + pageNumber;
    }
    return $.ajax({ url: URLReq, async: false }).responseText;
}

/* ─────────────────── Parsing (pure helpers) ─────────────────── */
// These take raw response HTML and return structured rows — no DOM / game_data access —
// so they can be unit-tested against saved page fixtures (see tests/test_tribeinfo_v4.js).

// Strip a game table cell down to its text. TW writes counts with a grey thousands-dot
// (<span class="grey">.</span>) and pads with whitespace; kill spaces FIRST so the span
// collapses to <spanclass="grey"> (matching the historical regex), then drop it.
function cleanCell(html) {
    return html.split("</td>")[0]
        .replace(/\s/g, "")   // kill ALL whitespace (space/tab/CR/LF) so <span class → <spanclass
        .replace(/<spanclass="grey">\.<\/span>/g, "")
        .replace(/<[^>]*>/g, "");
}

// Points live in the "Puntos" column — the last <td> before the unit/building cells, EXCEPT on
// the defense/incoming views, where a label cell ("en el pueblo" / "en camino") sits after it.
// So walk the prefix cells backwards and take the first one carrying digits: that skips the
// label and still stops at Puntos before reaching the village-name cell (which also has digits,
// from its coordinates). Strips tags and the thousands separator: "3<span>.</span>166" → 3166.
function extractPoints(prefix) {
    var tds = prefix.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
    for (var i = tds.length - 1; i >= 0; i--) {
        var digits = tds[i].replace(/<[^>]*>/g, "").replace(/[^\d]/g, "");
        if (digits) return parseInt(digits, 10);
    }
    return 0;
}

// Village name = the anchor text with its "(x|y) Continent" suffix stripped.
function extractVillageName(prefix) {
    var m = prefix.match(/<a[^>]*>([\s\S]*?)<\/a>/);
    if (!m) return "";
    return m[1].replace(/&amp;/g, "&").replace(/\s*\(\d+\|\d+\).*$/, "").trim();
}

// Building columns are language-independent: read the slug straight from each header
// image filename (…/buildings/main.webp → "main"). Works on any world/locale.
function detectBuildingSlugs(headerRow) {
    var slugs = [], re = /\/buildings\/([a-z_]+)\.(?:webp|png)/gi, m;
    while ((m = re.exec(headerRow))) slugs.push(m[1]);
    return slugs;
}

// Isolate the data-table rows from a fetched page. The data table is the last element
// carrying the "vis w100" class marker; the desktop layout has it 3 times on the page
// (→ 4 split segments), the mobile-app layout once (→ 2). Anything else means the page
// isn't a shape we know — return null so the caller can skip it.
function tableRows(responseText) {
    var temp = responseText.split("vis w100");
    if (!(temp.length === 2 || temp.length === 4)) return null;
    return responseText.split("vis w100")[temp.length - 1].split("<tr>");
}

// Parse one fetched page into structured village rows for a single logical view.
// view: 'troops' | 'defense' | 'incoming' | 'buildings'.
//   troops    — own army; may carry an incoming-attacks count
//   defense   — units stationed in the village (row 1 of each 2-row pair)
//   incoming  — units en route to the village   (row 2 of each pair)
//   buildings — 16 building levels
// Each row: { coords, village, points, incoming, cells: { slug: number } }.
// unitsList is game_data.units for troop views; buildings detect their own slugs.
function parseView(responseText, view, unitsList) {
    var out = { slugs: [], rows: [] };
    var rows = tableRows(responseText);
    if (!rows) return out;

    var isPair = (view === "defense" || view === "incoming");
    var step = isPair ? 2 : 1;
    var header = rows[1] || "";

    if (view === "buildings") {
        out.slugs = detectBuildingSlugs(header);
    } else {
        out.slugs = unitsList.slice();
    }
    // The incoming-attacks column (unit/att.webp) only exists when the member shares it;
    // otherwise the last cell is "active orders" and must NOT be read as incoming.
    var hasIncoming = header.indexOf("unit/att.webp") !== -1;

    // Iterate every data row (rows[0]=pre-table, rows[1]=header) all the way to the end;
    // a coords guard skips the trailing non-data segment.
    for (var j = 2; j < rows.length; j += step) {
        if (isPair && j + 1 >= rows.length) break; // need both halves of the pair
        var coordRow = rows[j];                                  // row 1 always has the village link + points
        var unitRow = (view === "incoming") ? rows[j + 1] : rows[j];
        var cm = coordRow.match(/\d{1,3}\|\d{1,3}/g);
        if (!cm) continue;                                       // not a village row

        var prefix = unitRow.split(/<td class="">|<td class="hidden">/g)[0];
        var cellSegs = unitRow.split(/<td class="">|<td class="hidden">/g); // [prefix, cell1, cell2, …]
        var cells = {};
        for (var k = 1; k <= out.slugs.length && k < cellSegs.length; k++) {
            cells[out.slugs[k - 1]] = cleanCell(cellSegs[k]);
        }

        var incoming = "";
        if (view === "troops" && hasIncoming) {
            // Incoming attacks = the last cell in the row (present only when shared).
            incoming = cleanCell(cellSegs[cellSegs.length - 1]);
        }

        out.rows.push({
            coords: cm[0],
            village: extractVillageName(coordRow),               // coords row carries the name/points
            points: extractPoints(coordRow.split(/<td class="">|<td class="hidden">/g)[0]),
            incoming: incoming,
            cells: cells
        });
    }
    return out;
}

// Apply the saved x / y / unit-count filters to a parsed row. Mirrors v2: a ">" filter hides
// the row when the value is below the threshold, "<" when above. Keys absent on the row
// (e.g. unit filters on a buildings row) simply never match, so they don't hide it.
function passesFilters(row, filtres) {
    var probe = { x: row.coords.split("|")[0], y: row.coords.split("|")[1] };
    for (var s in row.cells) probe[s] = row.cells[s];
    for (var key in filtres) {
        for (var f = 0; f < filtres[key].length; f++) {
            var op = filtres[key][f][0], val = parseInt(filtres[key][f][1]);
            var have = parseInt(probe[key]);
            if (op === ">" && have < val) return false;
            if (op === "<" && have > val) return false;
        }
    }
    return true;
}

/* ─────────────────── Serialization ─────────────────── */

var UNIX = function () { return Math.floor(Date.now() / 1000); };
var WORLD = function () { return (typeof window !== "undefined" && window.location) ? window.location.host : ""; };

// numeric cell → int (blank / "." → 0)
function num(v) { var n = parseInt(v); return isNaN(n) ? 0 : n; }

// --- CSV (.txt) ---
// Troop CSV. Preserves the tribe-calculator contract exactly:
//   Coords, Player, [Type], <units…>, [IncomingAttacks]
// `typed` adds the Type column (all_troops); `withIncoming` adds the trailing count.
function troopCsv(sections, unitsList, opts) {
    opts = opts || {};
    var header = "Coords,Player,";
    if (opts.typed) header += "Type,";
    for (var u = 0; u < unitsList.length; u++) header += unitsList[u] + ",";
    if (opts.withIncoming) header += "IncomingAttacks,";
    var data = header + "\n";
    sections.forEach(function (sec) {
        sec.rows.forEach(function (r) {
            data += r.coords + ",";
            data += (r.player || "") + ",";
            if (opts.typed) data += sec.type + ",";
            for (var u = 0; u < unitsList.length; u++) data += (r.cells[unitsList[u]] || "0") + ",";
            if (opts.withIncoming) data += (r.incoming || "") + ",";
            data += "\n";
        });
    });
    return data;
}

// Buildings CSV: Coords, Player, Village, Points, <buildings…>
function buildingsCsv(rows, slugs) {
    var data = "Coords,Player,Village,Points," + slugs.join(",") + ",\n";
    rows.forEach(function (r) {
        data += r.coords + "," + (r.player || "") + "," + (r.village || "") + "," + r.points + ",";
        for (var b = 0; b < slugs.length; b++) data += (r.cells[slugs[b]] || "0") + ",";
        data += "\n";
    });
    return data;
}

// --- JSON ---
function unitObj(cells, slugs) {
    var o = {};
    slugs.forEach(function (s) { o[s] = num(cells[s]); });
    return o;
}

// Single-view JSON. `key` names the unit block (troops / in_village / enroute / buildings).
function singleJson(mode, rows, slugs, key, withIncoming) {
    var villages = rows.map(function (r) {
        var obj = { player: r.player || "", player_id: r.playerId || "", village: r.village || "", coords: r.coords, points: r.points };
        if (withIncoming) obj.incoming_attacks = num(r.incoming);
        obj[key] = unitObj(r.cells, slugs);
        return obj;
    });
    return JSON.stringify({ exported_at: UNIX(), world: WORLD(), mode: mode, villages: villages }, null, 2);
}

// Combined JSON (all_troops / everything): one object per village, merging whichever views
// were fetched. Keyed by player_id + coords so a player's villages never collide across views.
function combinedJson(mode, views, unitSlugs, buildingSlugs) {
    // views: { troops:[], defense:[], incoming:[], buildings:[] } — any subset present
    var map = {};
    function ensure(r) {
        var k = (r.playerId || "") + "|" + r.coords;
        if (!map[k]) {
            map[k] = { player: r.player || "", player_id: r.playerId || "", village: r.village || "", coords: r.coords, points: r.points, _order: Object.keys(map).length };
        }
        var e = map[k];
        if (!e.village && r.village) e.village = r.village;   // fill from whichever view has it
        if (!e.points && r.points) e.points = r.points;
        return e;
    }
    (views.troops || []).forEach(function (r) { var e = ensure(r); e.troops = unitObj(r.cells, unitSlugs); e.incoming_attacks = num(r.incoming); });
    (views.defense || []).forEach(function (r) { ensure(r).in_village = unitObj(r.cells, unitSlugs); });
    (views.incoming || []).forEach(function (r) { ensure(r).enroute = unitObj(r.cells, unitSlugs); });
    (views.buildings || []).forEach(function (r) { ensure(r).buildings = unitObj(r.cells, buildingSlugs); });

    var villages = Object.keys(map).map(function (k) { return map[k]; })
        .sort(function (a, b) { return a._order - b._order; })
        .map(function (e) { delete e._order; return e; });
    return JSON.stringify({ exported_at: UNIX(), world: WORLD(), mode: mode, villages: villages }, null, 2);
}

/* ─────────────────── Orchestration ─────────────────── */

function readData() {
    // Any ally screen works — the member list doesn't come from the members table — but
    // every source (the player_id select especially) assumes a tribe context.
    if (game_data.screen != "ally") {
        UI.ErrorMessage("Open this from the tribe screen (screen=ally), then run “Read data” again.", 5000);
        return;
    }

    var mode = localStorage.troopCounterMode || "members_troops";
    var unitsList = game_data.units;
    var filtres = {};
    if (localStorage.troopCounterFilter) filtres = JSON.parse(localStorage.troopCounterFilter);
    var info = getPlayerInfo();
    var players = info.name;

    // Which game pages each mode needs, and which views we parse out of them.
    var needTroops = (mode === "members_troops" || mode === "all_troops" || mode === "everything");
    var needDefPage = (mode === "members_defense" || mode === "members_incoming" || mode === "all_troops" || mode === "everything");
    var wantDefense = (mode === "members_defense" || mode === "all_troops" || mode === "everything");
    var wantIncoming = (mode === "members_incoming" || mode === "all_troops" || mode === "everything");
    var needBuildings = (mode === "members_buildings" || mode === "everything");

    // Member list (id + village count) — see getTribeMembers for the source ladder.
    var playerInfoList = getTribeMembers(info);
    if (!playerInfoList.length) {
        UI.ErrorMessage("Could not read the tribe member list from this page. Open the tribe Members tab and try again.", 5000);
        return;
    }

    // Flat request queue: one entry per (player, gamePage, pageNumber). Pages beyond 1 only
    // for players with >1000 villages. Fetched sequentially with a throttle (be nice to TW).
    var tasks = [];
    playerInfoList.forEach(function (p) {
        var pages = Math.max(1, Math.ceil(p.villageAmount / 1000));
        for (var pg = 1; pg <= pages; pg++) {
            if (needTroops) tasks.push({ pid: p.playerId, gameMode: "members_troops", page: pg });
            if (needDefPage) tasks.push({ pid: p.playerId, gameMode: "members_defense", page: pg });
            if (needBuildings) tasks.push({ pid: p.playerId, gameMode: "members_buildings", page: pg });
        }
    });

    // Accumulators (structured rows, tagged with player).
    var acc = { troops: [], defense: [], incoming: [], buildings: [] };
    var buildingSlugs = [];

    Dialog.show("Progress bar", '<label> Reading...     </label><progress id="bar" max="1" value="0">  </progress>');

    var t = 0;
    (function loop() {
        var task = tasks[t];
        var playerName = players[task.pid];
        var text = fetchTribePage(task.gameMode, task.pid, task.page);
        var bar = document.getElementById("bar");
        if (bar) bar.value = t / tasks.length;

        function tag(rows) {
            rows.forEach(function (r) { r.player = playerName; r.playerId = task.pid; });
            return rows;
        }

        if (task.gameMode === "members_troops") {
            var pt = parseView(text, "troops", unitsList);
            tag(pt.rows).forEach(function (r) { if (passesFilters(r, filtres)) acc.troops.push(r); });
        } else if (task.gameMode === "members_defense") {
            if (wantDefense) {
                var pd = parseView(text, "defense", unitsList);
                tag(pd.rows).forEach(function (r) { if (passesFilters(r, filtres)) acc.defense.push(r); });
            }
            if (wantIncoming) {
                var pi = parseView(text, "incoming", unitsList);
                tag(pi.rows).forEach(function (r) { if (passesFilters(r, filtres)) acc.incoming.push(r); });
            }
        } else if (task.gameMode === "members_buildings") {
            var pb = parseView(text, "buildings", unitsList);
            if (pb.slugs.length) buildingSlugs = pb.slugs;
            tag(pb.rows).forEach(function (r) { if (passesFilters(r, filtres)) acc.buildings.push(r); });
        }

        t++;
        if (t < tasks.length) {
            setTimeout(loop, 200);
        } else {
            // Every fetch succeeded but nothing parsed → the pages aren't a shape the
            // parsers recognise. Say so instead of handing over an empty file that looks
            // like "the tribe has no troops".
            var parsed = acc.troops.length + acc.defense.length + acc.incoming.length + acc.buildings.length;
            if (!parsed) {
                Dialog.close();                        // don't leave the progress bar hanging
                UI.ErrorMessage(
                    "Fetched " + tasks.length + " page(s) but parsed 0 villages — the page layout wasn't recognised" +
                    (isMobileLayout() ? " (mobile app layout)." : "."), 7000);
                return;
            }
            showData(mode, acc, unitsList, buildingSlugs);
        }
    })();
}

// Build the txt + json for the chosen mode and show the download UI.
function showData(mode, acc, unitsList, buildingSlugs) {
    var csv = "", json = "", base = "tribe_info", canTxt = true;

    if (mode === "members_troops") {
        base = "tribe_troops";
        csv = troopCsv([{ type: "troops", rows: acc.troops }], unitsList, { withIncoming: true });
        json = singleJson(mode, acc.troops, unitsList, "troops", true);
    } else if (mode === "members_defense") {
        base = "tribe_defense";
        csv = troopCsv([{ type: "defense", rows: acc.defense }], unitsList, {});
        json = singleJson(mode, acc.defense, unitsList, "in_village", false);
    } else if (mode === "members_incoming") {
        base = "tribe_incoming";
        csv = troopCsv([{ type: "incoming", rows: acc.incoming }], unitsList, {});
        json = singleJson(mode, acc.incoming, unitsList, "enroute", false);
    } else if (mode === "all_troops") {
        base = "tribe_all_troops";
        csv = troopCsv([
            { type: "troops", rows: acc.troops },
            { type: "defense", rows: acc.defense },
            { type: "incoming", rows: acc.incoming }
        ], unitsList, { typed: true, withIncoming: true });
        json = combinedJson(mode, { troops: acc.troops, defense: acc.defense, incoming: acc.incoming }, unitsList, buildingSlugs);
    } else if (mode === "members_buildings") {
        base = "tribe_buildings";
        csv = buildingsCsv(acc.buildings, buildingSlugs);
        json = singleJson(mode, acc.buildings, buildingSlugs, "buildings", false);
    } else if (mode === "everything") {
        base = "tribe_everything";
        canTxt = false; // JSON only — the full superset is far too wide for a sane CSV
        json = combinedJson(mode, { troops: acc.troops, defense: acc.defense, incoming: acc.incoming, buildings: acc.buildings }, unitsList, buildingSlugs);
    }

    window._tribeInfoTxt = csv;
    window._tribeInfoJson = json;
    window._tribeInfoBase = base;
    var shown = canTxt ? csv : json;
    // Two independent gates — layout and capability are different questions:
    //   Download — hidden on the mobile LAYOUT, where the app's WebView swallows the
    //     synthetic click.
    //   Share — shown wherever the browser SUPPORTS sharing files, regardless of layout
    //     (e.g. iOS Chrome gets the desktop layout but can share). Desktop browsers that
    //     pass the probe show a redundant-but-working Share button next to Download —
    //     accepted for the simplicity of not UA-sniffing.
    var buttons = "";
    if (!isMobileLayout()) {
        if (canTxt) buttons += '<input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="download(\'' + base + '.txt\', window._tribeInfoTxt)" value="Download .txt"></input> ';
        buttons += '<input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="download(\'' + base + '.json\', window._tribeInfoJson)" value="Download .json"></input> ';
    }
    if (canShareFiles()) {
        if (canTxt) buttons += '<input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="shareExport(\'txt\')" value="Share .txt"></input> ';
        buttons += '<input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="shareExport(\'json\')" value="Share .json"></input> ';
    }
    if (canTxt) buttons += '<input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="copyExport(\'txt\')" value="Copy .txt"></input> ';
    buttons += '<input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="copyExport(\'json\')" value="Copy .json"></input> ';
    buttons += '<input type="button" class="btn evt-confirm-btn btn-confirm-no" onclick="openUI()" value="Back to main menu"></input>';

    var html = '<head></head><body><p><h2>Tribe data</h2>Mode selected: ' + mode + (canTxt ? '' : ' (JSON only)') + '</p>'
        + '<p><textarea id="tribeInfoOut" readonly=true rows="14" style="width:100%">' + shown.replace(/</g, "&lt;") + '</textarea></p>'
        + '<p>' + buttons + '</p></body>';
    Dialog.show("Tribe data", html);
}

// Export the pure parsers for the node test harness; harmless in the browser.
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        cleanCell: cleanCell, extractPoints: extractPoints, extractVillageName: extractVillageName,
        detectBuildingSlugs: detectBuildingSlugs, tableRows: tableRows, parseView: parseView,
        passesFilters: passesFilters, troopCsv: troopCsv, buildingsCsv: buildingsCsv,
        singleJson: singleJson, combinedJson: combinedJson,
        // member-list sources — pure once you pass a doc / tribe id
        getTribeMembers: getTribeMembers, membersFromSelect: membersFromSelect,
        membersFromWorldData: membersFromWorldData, membersFromMembersTable: membersFromMembersTable
    };
}

if (typeof game_data !== "undefined") openUI();
