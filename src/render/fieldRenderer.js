// Renders the football field background into an SVG group element.
// Ports pbcGridIronView + the field-drawing portion of pbcPlayView::repaint.

import { Config } from "./config.js";
import { svg } from "./svgUtil.js";

export function renderField(parent) {
  const W = Config.canvasWidth;
  const H = Config.canvasHeight;

  // Background — needed for rasterization (CSS doesn't apply when the
  // SVG is loaded as an <img> for PDF export).
  parent.appendChild(svg("rect", {
    class: "field-bg",
    x: 0, y: 0, width: W, height: H,
    fill: "#f5f4f0",
    stroke: "none",
  }));

  // LOS
  parent.appendChild(svg("line", {
    class: "field-line",
    x1: 0, y1: Config.losY(),
    x2: W, y2: Config.losY(),
    "stroke-width": Config.losWidth(),
    stroke: Config.losColor,
    fill: "none",
  }));

  // 5, 10, 15 yard lines — same color, thinner
  for (const y of [Config.fiveYdY(), Config.tenYdY(), Config.fifteenYdY()]) {
    parent.appendChild(svg("line", {
      class: "field-line",
      x1: 0, y1: y, x2: W, y2: y,
      "stroke-width": Config.fiveYdWidth(),
      stroke: Config.fiveYdColor,
      fill: "none",
    }));
  }

  // Border
  parent.appendChild(svg("rect", {
    class: "field-border",
    x: 0.5, y: 0.5,
    width: W - 1, height: H - 1,
    fill: "none",
    stroke: "#888",
    "stroke-width": 1,
  }));

  // Ball at center
  const bw = Config.ballWidth();
  parent.appendChild(svg("ellipse", {
    class: "ball",
    cx: W / 2, cy: Config.losY(),
    rx: bw / 2, ry: bw / 4,
    fill: "#8b4513",
    stroke: "#5a2d0c",
    "stroke-width": 1,
  }));
}

export function renderPlayName(parent, play) {
  if (!Config.printPlayName) return;
  const text = play.codeName || play.name || "";
  if (!text) return;

  const fontSize = Config.playNameSize();
  const t = svg("text", {
    class: "play-name",
    x: 5,
    y: Config.canvasHeight - fontSize * 0.5,
    "font-size": fontSize,
    "font-family": Config.playNameFont,
    fill: Config.playNameColor,
  });
  t.textContent = text;
  parent.appendChild(t);
}
