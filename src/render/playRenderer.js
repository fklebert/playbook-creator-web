// Ports pbcPlayView + pbcPlayerView. Renders a Play into an SVG element.
// Returns the <svg> root and a per-player metadata array so the editor
// can wire up drag/context-menu handlers.

import { Config } from "./config.js";
import { translatePos } from "./translator.js";
import { renderField, renderPlayName } from "./fieldRenderer.js";
import { svg, clear, SVG_NS } from "./svgUtil.js";
import { Color } from "../models/color.js";

export const RouteType = Object.freeze({
  Route: "route",
  OptionRoute: "option",
  Alternative1: "alt1",
  Alternative2: "alt2",
  Motion: "motion",
});

const ALT1_COLOR = "orange";
const ALT2_COLOR = "fuchsia";

export class PlayRenderer {
  /**
   * @param {{ shadow?: boolean, interactive?: boolean }} opts
   */
  constructor(opts = {}) {
    this.opts = {
      shadow: Config.playerShadow,
      interactive: true,
      ...opts,
    };
    /** @type {SVGSVGElement} */
    this.svgEl = null;
    /** map player ref -> SVGGElement so editor can hit-test/replace */
    this.playerNodes = new Map();
  }

  /** Build a fresh <svg> for `play`. */
  render(play) {
    const W = Config.canvasWidth;
    const H = Config.canvasHeight;
    const root = svg("svg", {
      class: "play-svg",
      xmlns: SVG_NS,
      width: W,
      height: H,
      viewBox: `0 0 ${W} ${H}`,
    });

    // Optional drop-shadow filter
    if (this.opts.shadow) {
      const defs = svg("defs");
      const filter = svg("filter", { id: "playerShadow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
      filter.appendChild(svg("feGaussianBlur", { in: "SourceAlpha", stdDeviation: Config.playerShadowRadius / 4 }));
      filter.appendChild(svg("feOffset", { dx: Config.playerShadowOffset(), dy: Config.playerShadowOffset(), result: "offsetblur" }));
      const feComp = svg("feComponentTransfer");
      const feFunc = svg("feFuncA", { type: "linear", slope: "0.4" });
      feComp.appendChild(feFunc);
      filter.appendChild(feComp);
      const feMerge = svg("feMerge");
      feMerge.appendChild(svg("feMergeNode"));
      feMerge.appendChild(svg("feMergeNode", { in: "SourceGraphic" }));
      filter.appendChild(feMerge);
      defs.appendChild(filter);
      root.appendChild(defs);
    }

    renderField(root);

    if (play) {
      this.playerNodes.clear();
      for (const player of play.players) {
        const g = this._renderPlayer(player);
        root.appendChild(g);
        this.playerNodes.set(player, g);
      }
      renderPlayName(root, play);
    }

    this.svgEl = root;
    return root;
  }

  _renderPlayer(player) {
    const pos = translatePos(player.pos);
    const w = Config.playerWidth();
    const half = w / 2;
    const isCenter = player.role.fullName === "Center" || player.role.shortName === "C";

    const g = svg("g", {
      class: "player",
      "data-role": player.role.shortName,
      filter: this.opts.shadow ? "url(#playerShadow)" : null,
    });

    // Routes are drawn behind the player body
    const routeGroup = svg("g", { class: "routes" });
    g.appendChild(routeGroup);

    // Motion first (so route is on top of motion)
    if (player.motion && player.motion.paths.length) {
      this._drawPaths(routeGroup, player.motion.paths, pos, RouteType.Motion, player.color);
    }

    // Compute route base (motion endpoint if any, else player center)
    let routeBase = pos;
    const inOutFactor = pos.x < Config.canvasWidth / 2 ? 1 : -1;
    if (player.motion) {
      const mep = player.motion.endPoint;
      const mirroredEnd = { x: inOutFactor * mep.x, y: mep.y };
      routeBase = translatePos(mirroredEnd, pos);
    }

    if (player.optionRoutes?.length) {
      for (const r of player.optionRoutes) {
        this._drawPaths(routeGroup, r.paths, routeBase, RouteType.OptionRoute, player.color);
      }
    }
    if (player.altRoute2) this._drawPaths(routeGroup, player.altRoute2.paths, routeBase, RouteType.Alternative2, player.color);
    if (player.altRoute1) this._drawPaths(routeGroup, player.altRoute1.paths, routeBase, RouteType.Alternative1, player.color);
    if (player.route)    this._drawPaths(routeGroup, player.route.paths,    routeBase, RouteType.Route,        player.color);

    // Body — inline stroke/fill so the SVG renders correctly when
    // rasterized for PDF export (CSS doesn't apply in that context).
    const fill = player.color.toCss();
    const bodyStroke = "rgba(0,0,0,0.4)";
    let body;
    if (isCenter) {
      body = svg("rect", {
        class: "player-shape",
        x: pos.x - half,
        y: pos.y - half,
        width: w,
        height: w,
        fill,
        stroke: bodyStroke,
        "stroke-width": 0.5,
      });
    } else {
      body = svg("circle", {
        class: "player-shape",
        cx: pos.x,
        cy: pos.y,
        r: half,
        fill,
        stroke: bodyStroke,
        "stroke-width": 0.5,
      });
    }
    g.appendChild(body);

    // Jersey number
    if (player.nr > 0) {
      const contrast = Color.contrastColor(player.color);
      const t = svg("text", {
        class: "player-text",
        x: pos.x,
        y: pos.y,
        "font-size": w / 2,
        "font-family": "Helvetica, Arial, sans-serif",
        "font-weight": "bold",
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: contrast.toCss(),
      });
      t.textContent = String(player.nr);
      g.appendChild(t);
    }

    return g;
  }

  /**
   * Build SVG path elements (and arrowhead for the last segment of routes)
   * from a list of Path objects starting at `base` (pixel coords).
   * Uses inOutFactor mirroring like the C++ joinPaths().
   */
  _drawPaths(parent, paths, base, type, playerColor) {
    if (!paths || !paths.length) return;
    const inOutFactor = base.x < Config.canvasWidth / 2 ? 1 : -1;
    let lastX = base.x;
    let lastY = base.y;

    let stroke;
    switch (type) {
      case RouteType.Alternative1: stroke = ALT1_COLOR; break;
      case RouteType.Alternative2: stroke = ALT2_COLOR; break;
      default: stroke = playerColor.toCss();
    }
    // Dash patterns are scaled by routeWidth so they look the same regardless
    // of canvas size. With stroke-linecap: round, a dash of 0 renders as a
    // perfect round dot of diameter == strokeWidth.
    const rw = Config.routeWidth();
    let dash = null;
    if (type === RouteType.Motion) dash = `${rw * 1.6} ${rw * 1.0}`;
    else if (type === RouteType.OptionRoute) dash = `0 ${rw * 2.2}`;

    // Arrows go on every "route" type — including option routes — but never on motion.
    const isRouteWithArrow = type !== RouteType.Motion;

    paths.forEach((p, idx) => {
      // Apply inOutFactor mirroring on x for endpoint and control
      const endYd = { x: inOutFactor * p.end.x, y: p.end.y };
      const endPx = translatePos(endYd, base);

      let cp = null;
      let arrowAnchor = { x: lastX, y: lastY };
      if (p.control !== null) {
        const ctrlYd = { x: inOutFactor * p.control.x, y: p.control.y };
        cp = translatePos(ctrlYd, base);
        arrowAnchor = cp;
      }

      // For the last segment of an arrow-bearing route, compute the arrow
      // geometry first and stop the line at the arrow's base midpoint so the
      // round line cap doesn't poke past the arrow tip.
      const isLast = idx === paths.length - 1;
      const drawArrow = isRouteWithArrow && isLast;
      let lineEnd = endPx;
      let arrowVerts = null;
      if (drawArrow) {
        const angle = Math.atan2(endPx.y - arrowAnchor.y, -(endPx.x - arrowAnchor.x));
        const arrowSize = Config.routeWidth() * 2;
        const a1 = {
          x: endPx.x + Math.sin(angle + Math.PI / 3) * arrowSize,
          y: endPx.y + Math.cos(angle + Math.PI / 3) * arrowSize,
        };
        const a2 = {
          x: endPx.x + Math.sin(angle + Math.PI - Math.PI / 3) * arrowSize,
          y: endPx.y + Math.cos(angle + Math.PI - Math.PI / 3) * arrowSize,
        };
        arrowVerts = { tip: endPx, a1, a2 };
        lineEnd = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 };
      }

      const d = cp
        ? `M ${lastX} ${lastY} Q ${cp.x} ${cp.y} ${lineEnd.x} ${lineEnd.y}`
        : `M ${lastX} ${lastY} L ${lineEnd.x} ${lineEnd.y}`;

      parent.appendChild(svg("path", {
        class: "route-path",
        d,
        stroke,
        "stroke-width": Config.routeWidth(),
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        fill: "none",
        "stroke-dasharray": dash,
      }));

      if (arrowVerts) {
        // Arrow polygons are always solid — never inherit the dotted/dashed
        // stroke pattern of the line they cap.
        parent.appendChild(svg("polygon", {
          class: "arrow-head",
          points: `${arrowVerts.tip.x},${arrowVerts.tip.y} ${arrowVerts.a1.x},${arrowVerts.a1.y} ${arrowVerts.a2.x},${arrowVerts.a2.y}`,
          fill: stroke,
          stroke,
          "stroke-width": Config.routeWidth() / 4,
          "stroke-linejoin": "round",
        }));
      }

      lastX = endPx.x;
      lastY = endPx.y;
    });
  }
}

/** Convenience: render a Play into a fresh <svg> and return it. */
export function renderPlayToSvg(play, opts) {
  const r = new PlayRenderer(opts);
  return { svg: r.render(play), playerNodes: r.playerNodes };
}
