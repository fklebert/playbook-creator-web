// Custom-route drawing dialog. Lets the user click points (or click+drag to
// add a Bezier control handle, simplified: control = midpoint of mouse drag)
// to compose a route, then save it as a named library route or apply it
// directly to the player.

import { Config } from "../render/config.js";
import { translatePos, retranslatePos } from "../render/translator.js";
import { renderField } from "../render/fieldRenderer.js";
import { svg, SVG_NS } from "../render/svgUtil.js";
import { Path } from "../models/path.js";
import { Route } from "../models/route.js";
import { Color } from "../models/color.js";
import { dispose, makeDialog } from "./dialogs.js";

/**
 * Open a route-drawing dialog. Returns Promise<{paths, name, codeName, save}|null>
 * - paths: Path[] in yard coordinates (relative to the player's start point)
 * - name, codeName: filled if the user wants to save the route to the library
 * - save: true if user wants the route added to the playbook routes
 */
export function openRouteEditor({ player, mode = "route" }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "auto 200px";
    wrap.style.gap = "12px";
    wrap.style.minWidth = "560px";

    // SVG canvas
    const W = Config.canvasWidth;
    const H = Config.canvasHeight;
    const svgEl = svg("svg", {
      class: "play-svg",
      xmlns: SVG_NS,
      width: W,
      height: H,
      viewBox: `0 0 ${W} ${H}`,
      style: "background: var(--field-grass); border-radius: 4px; cursor: crosshair;",
    });
    renderField(svgEl);

    // Render the player so the user knows where the route starts
    const startPx = translatePos(player.pos);
    const pw = Config.playerWidth();
    const isCenter = player.role.fullName === "Center";
    const body = isCenter
      ? svg("rect", { x: startPx.x - pw / 2, y: startPx.y - pw / 2, width: pw, height: pw, fill: player.color.toCss() })
      : svg("circle", { cx: startPx.x, cy: startPx.y, r: pw / 2, fill: player.color.toCss() });
    svgEl.appendChild(body);

    // Path-in-progress visualization
    const previewGroup = svg("g");
    svgEl.appendChild(previewGroup);

    // State: chain of yard-relative Path segments
    /** @type {import('../models/path.js').Path[]} */
    const paths = [];
    let lastPx = { ...startPx };
    let dragStartPx = null;

    const inOutFactor = startPx.x < W / 2 ? 1 : -1;

    function redraw() {
      previewGroup.innerHTML = "";
      let lx = startPx.x;
      let ly = startPx.y;
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        const endPx = {
          x: startPx.x + inOutFactor * p.end.x * Config.ydInPixel(),
          y: startPx.y - p.end.y * Config.ydInPixel(),
        };
        let d;
        if (p.control) {
          const cx = startPx.x + inOutFactor * p.control.x * Config.ydInPixel();
          const cy = startPx.y - p.control.y * Config.ydInPixel();
          d = `M ${lx} ${ly} Q ${cx} ${cy} ${endPx.x} ${endPx.y}`;
        } else {
          d = `M ${lx} ${ly} L ${endPx.x} ${endPx.y}`;
        }
        previewGroup.appendChild(svg("path", {
          d, stroke: player.color.toCss(), "stroke-width": Config.routeWidth(),
          fill: "none", "stroke-linecap": "round",
        }));
        // node marker
        previewGroup.appendChild(svg("circle", {
          cx: endPx.x, cy: endPx.y, r: 3,
          fill: "white", stroke: "black",
        }));
        lx = endPx.x; ly = endPx.y;
      }
      lastPx.x = lx; lastPx.y = ly;
    }
    redraw();

    function svgPointFromEvent(ev) {
      const r = svgEl.getBoundingClientRect();
      // viewBox matches client size, no scaling math needed
      const sx = (ev.clientX - r.left) * (W / r.width);
      const sy = (ev.clientY - r.top) * (H / r.height);
      return { x: sx, y: sy };
    }

    svgEl.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      svgEl.setPointerCapture(ev.pointerId);
      dragStartPx = svgPointFromEvent(ev);
    });
    svgEl.addEventListener("pointerup", (ev) => {
      if (!dragStartPx) return;
      const endPxAbs = svgPointFromEvent(ev);
      const dx = endPxAbs.x - dragStartPx.x;
      const dy = endPxAbs.y - dragStartPx.y;
      const dist2 = dx * dx + dy * dy;

      // Convert pixel positions back to yard coordinates relative to startPx
      // applying the inOutFactor mirroring on x
      function pxToYd(px) {
        return {
          x: ((px.x - startPx.x) / Config.ydInPixel()) * inOutFactor,
          y: (startPx.y - px.y) / Config.ydInPixel(),
        };
      }

      if (dist2 < 36) {
        // Treat as a click → straight segment to that point
        const endYd = pxToYd(endPxAbs);
        paths.push(new Path(endYd.x, endYd.y, null, null));
      } else {
        // Drag → midpoint becomes the bezier control, end = release point
        const ctrlPxAbs = { x: (dragStartPx.x + endPxAbs.x) / 2, y: (dragStartPx.y + endPxAbs.y) / 2 };
        const endYd = pxToYd(endPxAbs);
        const ctrlYd = pxToYd(ctrlPxAbs);
        paths.push(new Path(endYd.x, endYd.y, ctrlYd.x, ctrlYd.y));
      }
      dragStartPx = null;
      redraw();
    });

    wrap.appendChild(svgEl);

    // Sidebar controls
    const sidebar = document.createElement("div");
    sidebar.style.display = "flex";
    sidebar.style.flexDirection = "column";
    sidebar.style.gap = "10px";

    const help = document.createElement("p");
    help.className = "muted";
    help.style.fontSize = "12px";
    help.style.margin = "0";
    help.textContent = "Click for a straight segment. Click-drag for a curve (release point = end, midpoint = control).";
    sidebar.appendChild(help);

    const undoBtn = document.createElement("button");
    undoBtn.textContent = "Undo Last";
    undoBtn.addEventListener("click", (ev) => { ev.preventDefault(); paths.pop(); redraw(); });
    sidebar.appendChild(undoBtn);

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", (ev) => { ev.preventDefault(); paths.length = 0; redraw(); });
    sidebar.appendChild(clearBtn);

    const saveCb = document.createElement("label");
    saveCb.style.flexDirection = "row";
    saveCb.style.alignItems = "center";
    saveCb.style.gap = "6px";
    saveCb.style.color = "var(--fg)";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    saveCb.appendChild(cb);
    const cbTxt = document.createElement("span");
    cbTxt.textContent = "Save to route library";
    saveCb.appendChild(cbTxt);
    sidebar.appendChild(saveCb);

    const nameInput = document.createElement("input");
    nameInput.placeholder = "Route name";
    nameInput.disabled = true;
    sidebar.appendChild(nameInput);

    const codeInput = document.createElement("input");
    codeInput.placeholder = "Code name (optional)";
    codeInput.disabled = true;
    sidebar.appendChild(codeInput);

    cb.addEventListener("change", () => {
      nameInput.disabled = !cb.checked;
      codeInput.disabled = !cb.checked;
    });

    wrap.appendChild(sidebar);

    const { dlg, okBtn, cancelBtn } = makeDialog({
      title: mode === "route" ? "Custom Route" : `Custom ${mode}`,
      body: wrap,
      primaryLabel: "Apply",
    });

    okBtn.addEventListener("click", () => {
      if (!paths.length) {
        resolve(null);
        dispose(dlg);
        return;
      }
      const result = {
        paths,
        save: cb.checked,
        name: nameInput.value.trim(),
        codeName: codeInput.value.trim(),
      };
      resolve(result);
      dispose(dlg);
    });
    cancelBtn.addEventListener("click", () => { resolve(null); dispose(dlg); });
    dlg.addEventListener("cancel", () => { resolve(null); dispose(dlg); });
    dlg.showModal();
  });
}
