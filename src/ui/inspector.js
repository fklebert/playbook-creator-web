// Right panel: play info, active player info, route library list.

import { controller } from "../controller.js";

export class Inspector {
  constructor() {
    this.playInfo = document.getElementById("play-info");
    this.playerInfo = document.getElementById("player-info");
    this.routeLib = document.getElementById("route-library");
    controller.on("playbookChanged", () => this.refresh());
    controller.on("playChanged", () => this.refresh());
    controller.on("playerChanged", () => this.refresh());
    this.refresh();
  }

  refresh() {
    this._renderPlayInfo();
    this._renderPlayerInfo();
    this._renderRouteLib();
  }

  _renderPlayInfo() {
    const play = controller.activePlay;
    this.playInfo.innerHTML = "";
    if (!play) {
      this.playInfo.innerHTML = '<p class="muted">No play selected.</p>';
      return;
    }
    const grid = document.createElement("div");
    grid.className = "kv-grid";
    grid.appendChild(kv("Name", play.name));
    grid.appendChild(kv("Code", play.codeName || "—"));
    grid.appendChild(kv("Formation", play.formationName || "—"));
    grid.appendChild(kv("Players", String(play.players.length)));
    grid.appendChild(kv("Categories", [...play.categoryNames].join(", ") || "—"));
    this.playInfo.appendChild(grid);
    if (play.comment) {
      const c = document.createElement("p");
      c.className = "muted";
      c.style.marginTop = "8px";
      c.textContent = play.comment;
      this.playInfo.appendChild(c);
    }
  }

  _renderPlayerInfo() {
    const player = controller.activePlayer;
    this.playerInfo.innerHTML = "";
    if (!player) {
      this.playerInfo.innerHTML = '<p class="muted">Click a player to inspect.</p>';
      return;
    }
    const grid = document.createElement("div");
    grid.className = "kv-grid";
    grid.appendChild(kv("Role", player.role.fullName));
    grid.appendChild(kv("Short", player.role.shortName));
    grid.appendChild(kv("Position", `(${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}) yd`));
    const colorRow = document.createElement("span");
    colorRow.className = "val";
    const sw = document.createElement("span");
    sw.className = "color-swatch";
    sw.style.background = player.color.toCss();
    colorRow.appendChild(sw);
    colorRow.appendChild(document.createTextNode(player.color.toHex()));
    grid.appendChild(kvNode("Color", colorRow));
    grid.appendChild(kv("Number", player.nr ? String(player.nr) : "—"));
    grid.appendChild(kv("Route", player.route?.name || "—"));
    grid.appendChild(kv("Motion", player.motion ? "yes" : "—"));
    if (player.altRoute1) grid.appendChild(kv("Alt 1", player.altRoute1.name || "(custom)"));
    if (player.altRoute2) grid.appendChild(kv("Alt 2", player.altRoute2.name || "(custom)"));
    if (player.optionRoutes.length) grid.appendChild(kv("Options", String(player.optionRoutes.length)));
    this.playerInfo.appendChild(grid);

    const hint = document.createElement("p");
    hint.className = "muted";
    hint.style.fontSize = "11px";
    hint.style.marginTop = "10px";
    hint.textContent = "Drag to move. Right-click for routes/motion. Double-click to draw a custom route.";
    this.playerInfo.appendChild(hint);
  }

  _renderRouteLib() {
    this.routeLib.innerHTML = "";
    const pb = controller.playbook;
    if (!pb || !pb.routes.size) {
      const li = document.createElement("li");
      li.textContent = "(none)";
      li.className = "muted";
      this.routeLib.appendChild(li);
      return;
    }
    const routes = [...pb.routes.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const r of routes) {
      const li = document.createElement("li");
      const n = document.createElement("span");
      n.textContent = r.name;
      li.appendChild(n);
      if (r.codeName) {
        const c = document.createElement("span");
        c.className = "code";
        c.textContent = r.codeName;
        li.appendChild(c);
      }
      this.routeLib.appendChild(li);
    }
  }
}

function kv(key, val) {
  const k = document.createElement("span");
  k.className = "key";
  k.textContent = key;
  const v = document.createElement("span");
  v.className = "val";
  v.textContent = val;
  const frag = document.createDocumentFragment();
  frag.appendChild(k);
  frag.appendChild(v);
  return frag;
}
function kvNode(key, valNode) {
  const k = document.createElement("span");
  k.className = "key";
  k.textContent = key;
  const frag = document.createDocumentFragment();
  frag.appendChild(k);
  frag.appendChild(valNode);
  return frag;
}
