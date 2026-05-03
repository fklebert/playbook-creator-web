// Interactive editor: takes a host element, watches the controller's active
// play, renders it via PlayRenderer, and wires up drag + context menu.

import { controller } from "../controller.js";
import { PlayRenderer } from "../render/playRenderer.js";
import { retranslatePos } from "../render/translator.js";
import { Config } from "../render/config.js";
import { showContextMenu } from "./contextMenu.js";
import { Color } from "../models/color.js";
import { Route } from "../models/route.js";
import { Motion } from "../models/motion.js";
import { openRouteEditor } from "./routeEditor.js";
import { confirmDialog } from "./dialogs.js";

export class PlayEditor {
  constructor(hostEl) {
    this.host = hostEl;
    this.renderer = new PlayRenderer({ shadow: true, interactive: true });
    this.svgEl = null;

    controller.on("playChanged", () => this.refresh());
    controller.on("playbookChanged", () => this.refresh());
    this.refresh();
  }

  refresh() {
    while (this.host.firstChild) this.host.firstChild.remove();
    if (!controller.activePlay) {
      const placeholder = document.createElement("div");
      placeholder.className = "muted";
      placeholder.style.padding = "40px";
      placeholder.textContent = controller.playbook
        ? "No play selected. Use Play → New (Ctrl+N)."
        : "No playbook loaded. Use File → New Playbook (Ctrl+Alt+N).";
      this.host.appendChild(placeholder);
      return;
    }
    this.svgEl = this.renderer.render(controller.activePlay);
    this.host.appendChild(this.svgEl);
    this._wirePlayers();
  }

  _wirePlayers() {
    for (const [player, node] of this.renderer.playerNodes.entries()) {
      this._wirePlayer(player, node);
    }
  }

  _wirePlayer(player, node) {
    let dragState = null;

    const svgEl = this.svgEl;
    const originalNodeTransform = node.getAttribute("transform") || "";

    node.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      controller.setActivePlayer(player);
      const r = svgEl.getBoundingClientRect();
      const scale = Config.canvasWidth / r.width;
      dragState = {
        pointerId: ev.pointerId,
        startClient: { x: ev.clientX, y: ev.clientY },
        scale,
        startPos: { ...player.pos },
      };
      node.setPointerCapture(ev.pointerId);
      node.classList.add("dragging");
    });

    node.addEventListener("pointermove", (ev) => {
      if (!dragState) return;
      const dxPx = (ev.clientX - dragState.startClient.x) * dragState.scale;
      const dyPx = (ev.clientY - dragState.startClient.y) * dragState.scale;
      // Visually drag without re-rendering the entire SVG every frame
      node.setAttribute("transform", `${originalNodeTransform} translate(${dxPx} ${dyPx})`);
    });

    const finishDrag = (ev) => {
      if (!dragState) return;
      const dxPx = (ev.clientX - dragState.startClient.x) * dragState.scale;
      const dyPx = (ev.clientY - dragState.startClient.y) * dragState.scale;
      const dxYd = dxPx / Config.ydInPixel();
      const dyYd = -dyPx / Config.ydInPixel(); // y inverted
      const newPos = {
        x: dragState.startPos.x + dxYd,
        y: dragState.startPos.y + dyYd,
      };
      // Snap to half-yard grid for sanity
      newPos.x = Math.round(newPos.x * 2) / 2;
      newPos.y = Math.round(newPos.y * 2) / 2;
      const moved = newPos.x !== dragState.startPos.x || newPos.y !== dragState.startPos.y;
      dragState = null;
      node.classList.remove("dragging");
      node.removeAttribute("transform");
      if (moved) {
        player.pos = newPos;
        controller.notifyPlayEdited();
      }
    };
    node.addEventListener("pointerup", finishDrag);
    node.addEventListener("pointercancel", finishDrag);

    node.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      controller.setActivePlayer(player);
      this._showPlayerContextMenu(player, ev.clientX, ev.clientY);
    });

    node.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      this._editCustomRoute(player, "route");
    });
  }

  _showPlayerContextMenu(player, x, y) {
    const pb = controller.playbook;
    const routes = [...pb.routes.values()].sort((a, b) => {
      const da = a.paths[a.paths.length - 1]?.end.y ?? 0;
      const db = b.paths[b.paths.length - 1]?.end.y ?? 0;
      return da - db;
    });

    const buildRouteSubmenu = (assign, reset) => {
      const items = [
        { label: "Reset", onClick: reset },
        { separator: true },
        ...routes.map((r) => ({
          label: r.codeName ? `${r.name} (${r.codeName})` : r.name,
          onClick: () => assign(r.clone()),
        })),
        { separator: true },
        { label: "Custom (named)…", onClick: () => this._editCustomRoute(player, "named") },
        { label: "Custom (unnamed)…", onClick: () => this._editCustomRoute(player, "route") },
      ];
      return items;
    };

    showContextMenu(x, y, [
      {
        label: "Route",
        submenu: buildRouteSubmenu(
          (r) => { player.route = r; controller.notifyPlayEdited(); },
          () => { player.route = null; controller.notifyPlayEdited(); },
        ),
      },
      {
        label: "Option Route",
        submenu: buildRouteSubmenu(
          (r) => { player.optionRoutes.push(r); controller.notifyPlayEdited(); },
          () => { player.optionRoutes = []; controller.notifyPlayEdited(); },
        ),
      },
      {
        label: "Alternative Route 1",
        submenu: buildRouteSubmenu(
          (r) => { player.altRoute1 = r; controller.notifyPlayEdited(); },
          () => { player.altRoute1 = null; controller.notifyPlayEdited(); },
        ),
      },
      {
        label: "Alternative Route 2",
        submenu: buildRouteSubmenu(
          (r) => { player.altRoute2 = r; controller.notifyPlayEdited(); },
          () => { player.altRoute2 = null; controller.notifyPlayEdited(); },
        ),
      },
      { separator: true },
      {
        label: "Motion",
        submenu: [
          { label: "Apply Motion…", onClick: () => this._editCustomRoute(player, "motion") },
          { label: "Clear Motion", onClick: () => { player.motion = null; controller.notifyPlayEdited(); } },
        ],
      },
      { separator: true },
      { label: "Set Color…", onClick: () => this._setColor(player) },
      { label: "Set Position…", onClick: () => this._setPosition(player) },
      { label: "Set Number…", onClick: () => this._setNumber(player) },
    ]);
  }

  async _editCustomRoute(player, mode) {
    const result = await openRouteEditor({ player, mode });
    if (!result) return;
    if (mode === "motion") {
      const last = result.paths[result.paths.length - 1];
      player.motion = new Motion(result.paths, { x: last.end.x, y: last.end.y });
    } else {
      const route = new Route(result.name || "Custom", result.codeName || "", result.paths);
      if (result.save && result.name) {
        const existing = controller.playbook.getRoute(result.name);
        let overwrite = !existing;
        if (existing) {
          overwrite = await confirmDialog(`Overwrite existing route "${result.name}"?`, "Overwrite Route");
        }
        if (overwrite) controller.playbook.addRoute(route.clone(), { overwrite: true });
      }
      // Apply to the player based on mode
      if (mode === "option") player.optionRoutes.push(route);
      else if (mode === "alt1") player.altRoute1 = route;
      else if (mode === "alt2") player.altRoute2 = route;
      else player.route = route;
    }
    controller.notifyPlayEdited();
  }

  async _setColor(player) {
    const inp = document.createElement("input");
    inp.type = "color";
    inp.value = player.color.toHex();
    // Must be in DOM and rendered for click() to open the picker reliably.
    inp.style.position = "fixed";
    inp.style.left = "-9999px";
    document.body.appendChild(inp);
    inp.addEventListener("change", () => {
      player.color = Color.fromHex(inp.value);
      controller.notifyPlayEdited();
      inp.remove();
    }, { once: true });
    inp.addEventListener("blur", () => { inp.remove(); }, { once: true });
    inp.click();
  }

  async _setPosition(player) {
    const x = window.prompt("Horizontal position (yards)", String(player.pos.x));
    if (x === null) return;
    const y = window.prompt("Vertical position (yards, +y is downfield)", String(player.pos.y));
    if (y === null) return;
    const nx = Number(x); const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      player.pos = { x: nx, y: ny };
      controller.notifyPlayEdited();
    }
  }

  async _setNumber(player) {
    const n = window.prompt("Jersey number (0 to hide)", String(player.nr));
    if (n === null) return;
    const v = parseInt(n, 10);
    if (Number.isFinite(v) && v >= 0 && v < 100) {
      player.nr = v;
      controller.notifyPlayEdited();
    }
  }
}
