// Original Script by lodi94 (https://forum.tribalwars.net/index.php?threads/download-tribe-info.285469/)
// Maintained by Vanquished

function openUI() {
    html = '<head></head><body><h1>Tribe troop counter</h1><form><fieldset><legend>Settings</legend><p><input type="radio" name="mode" id="of" value="Read troops of the village" onchange="setMode(\'members_troops\')">Read troops of the village</input></p><p><input type="radio" name="mode" id="in" value="Read defenses in the village" onchange="setMode(\'members_defense\')">Read defenses in the village</input></p></fieldset><fieldset><legend>Filters</legend><select id="variable"><option value="x">x</option><option value="y">y</option>' + createUnitOption() + '</select><select id="kind"><option value=">">\></option><option value="<">\<</option></select><input type="text" id="value"></input><input type="button" class="btn evt-confirm-btn btn-confirm-yes" onclick="addFilter()" value="Save filter"></input><p><table><tr><th>Variable filtered</th><th>Operatore</th><th>Value</th><th></th></tr>' + createFilterTable() + '</form></p></fieldset><div><p><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="run" onclick="readData()" value="Read data"></input></p></div></body>';
    Dialog.show("Troop counter", html);
    if (localStorage.troopCounterMode) {
        if (localStorage.troopCounterMode == "members_troops") {
            document.getElementById("of").checked = true;
 
        } else {
            document.getElementById("in").checked = true;
        }
 
    } else {
        document.getElementById("of").checked = true;
    }
}

function setMode(a) {
    localStorage.troopCounterMode = a;
}

// game_data.mode is unreliable on some worlds (often null even on the members
// overview, only set when an in-game AJAX click leaves a stale value behind).
// The URL's mode param is always correct, so gate on that instead.

function getPageMode() {
    return new URLSearchParams(window.location.search).get("mode");
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

function downloadInfo(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(null);
    return request.response;
}

function getPlayerDict() {
    playerDict = {};
    now = new Date();
    server = window.location.host;
    if (localStorage.playerDictFake) {
        if (localStorage.playerDictFake.split(":::")[0] == server) {
            savedDate = new Date(localStorage.playerDictFake.split(":::")[1])
            if (now - savedDate < 1000 * 60 * 60) {
                playerDict = JSON.parse(localStorage.playerDictFake.split(":::")[2]);
                return playerDict;
            }
        }
    }
    playerUrl = "https://" + window.location.host + "/map/player.txt";
    playerList = downloadInfo(playerUrl).split("\n");
    for (i = 0; i < playerList.length; i++) {
        if (playerList[i] != "") {
            row = playerList[i].split(",");
            playerDict[row[0]] = row[1].replace(/\+/g, " ");
        }
    }
    localStorage.playerDictFake = server + ":::" + now + ":::" + JSON.stringify(playerDict);
    return playerDict;

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

function readData() {
    if (game_data.screen == "ally" && getPageMode() == "members") {
        var html = '<label> Reading...     </label><progress id="bar" max="1" value="0">  </progress>';
        Dialog.show("Progress bar", html);
        filtres = {};
        if (localStorage.troopCounterFilter) {
            filtres = JSON.parse(localStorage.troopCounterFilter);
        }
        table = document.getElementsByClassName("vis");
        nMembers = table[2].rows.length;
        playerInfoList = [];
        for (i = 1; i < nMembers - 1; i++) {
            let playerId = table[2].rows[i].innerHTML.split("[")[1].split("]")[0];
            let villageAmount = table[2].rows[i].innerHTML.split("<td class=\"lit-item\">")[4].split("</td>")[0];
            playerInfoList.push({
                playerId: playerId,
                villageAmount: villageAmount
            });
        }
        mode = localStorage.troopCounterMode;
        data = "Coords,Player,";
        unitsList = game_data.units;
        for (k = 0; k < unitsList.length; k++) {
            data = data + unitsList[k] + ",";
        }
        if (mode == "members_troops") {
            data = data + "Incoming,";
        }
        players = getPlayerDict();
        data = data + "\n";
        i = 0;
        let pageNumber = 1;
        (function loop() {
            // In sitter mode (someone operates the account in vacation mode) the game needs a
            // t=<owner_id> param so requests act on behalf of the sat account. game_data.player.sitter
            // is 0 when you run your own account, the sitter's id otherwise.
            let URLReq;
            if (game_data.player.sitter > 0) {
                URLReq = "https://" + window.location.host + "/game.php?t=" + game_data.player.id + "&screen=ally&mode=" + mode + "&player_id=" + playerInfoList[i].playerId + "&page=" + pageNumber;
            } else {
                URLReq = "https://" + window.location.host + "/game.php?screen=ally&mode=" + mode + "&player_id=" + playerInfoList[i].playerId + "&page=" + pageNumber;
            }
            page = $.ajax({
                url: URLReq,
                async: false,
                function(result) {
                    return result.responseText;
                }
            });
            document.getElementById("bar").value = (i / playerInfoList.length);

            let temp = page.responseText.split("vis w100");

            if (temp.length === 2 || temp.length === 4) {
                rows = page.responseText.split("vis w100")[temp.length - 1].split("<tr>");
                step = 1;
                if (mode == "members_defense") {
                    step = 2;
                }
                // The "incoming attacks" column (unit/att.webp) only appears when the
                // member shares incoming attacks. When absent the table ends one column
                // earlier on "active orders" (icons/commands_outgoing.webp), so the last
                // <td> is NOT incoming. Detect the column from this player's header row
                // (rows[1]) so we never mistake active-orders for incoming.
                let hasIncoming = rows[1] && rows[1].indexOf("unit/att.webp") !== -1;
                for (j = 2; j + step < rows.length; j = j + step) {
                    villageData = {};

                    let coords = rows[j].match(/\d{1,3}\|\d{1,3}/g)[0].split("|");
                    villageData["x"] = coords[0];
                    villageData["y"] = coords[1];
                    units = rows[j].split(/<td class="">|<td class="hidden">/g);
                    for (k = 1; k < units.length; k++) {
                        villageData[unitsList[k - 1]] = units[k].split("</td>")[0].replace(/ /g, "").replace(/\n/g, "").replace(/<spanclass="grey">\.<\/span>/g, "");
                    }
                    if (mode == "members_troops") {
                        // Incoming attacks = the last <td> in the row, but only when the
                        // member shares incoming (att.webp column present). Otherwise that
                        // last cell is "active orders" — leave Incoming blank. Same markup
                        // as the unit cells; final tag-strip guards against a link wrapper.
                        villageData["Incoming"] = hasIncoming
                            ? units[units.length - 1].split("</td>")[0].replace(/ /g, "").replace(/\n/g, "").replace(/<spanclass="grey">\.<\/span>/g, "").replace(/<[^>]*>/g, "")
                            : "";
                    }
                    filtered = true; //filtered==true ok, ==false hide
                    for (key in filtres) {
                        for (k = 0; k < filtres[key].length; k++) {
                            if (filtres[key][k][0] === ">") {
                                if (parseInt(villageData[key]) < parseInt(filtres[key][k][1])) {
                                    filtered = false;
                                }
                            } else if (filtres[key][k][0] === "<") {
                                         
                                if (parseInt(villageData[key]) > parseInt(filtres[key][k][1])) {
                                    filtered = false;
                                }
                            }
                        }
                    }
                    if (filtered) {
                        data = data + villageData["x"] + "|" + villageData["y"] + ",";
                        data = data + players[playerInfoList[i].playerId] + ",";
                        for (k = 0; k < unitsList.length; k++) {
                            data = data + villageData[unitsList[k]] + ",";
                        }
                        if (mode == "members_troops") {
                            data = data + villageData["Incoming"] + ",";
                        }
                        data = data + "\n";
                    }
                }
            }
            i++;

            if (temp.length === 4) {
                if (playerInfoList[i].villageAmount / 1000 > pageNumber) {
                    i--;
                    pageNumber++;
                } else {
                    pageNumber = 1;
                }
            }

            if (i < playerInfoList.length) {
                setTimeout(loop, 200);
            } else {
       
                showData(data, mode);
            }
        })();
    } else {
        UI.ErrorMessage("Open this from the tribe Members tab (screen=ally&mode=members), then run “Read data” again.", 5000);
    }
}

function showData(data) {
    html = '<head></head><body><p><h2>Tribe data</h2>Mode selected: ' + mode + '</p><p><textarea readonly=true>' + data + '</textarea></p><p><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="download" onclick="download(\'tribe info\',data)" value="Download as csv"></input><input type="button" class="btn evt-confirm-btn btn-confirm-no" onclick="openUI()" value="Back to main menu"></input></p></body>';
    Dialog.show("Tribe data", html);
}


openUI();

