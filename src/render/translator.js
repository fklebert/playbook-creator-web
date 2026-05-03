// Ports pbcPositionTranslator.cpp.
// Yards <-> pixels. y-axis is inverted (more yards downfield = smaller y).

import { Config } from "./config.js";

function defaultBase() {
  // Ball position: center horizontally, LOS vertically
  return { x: Config.canvasWidth / 2, y: Config.losY() };
}

// yard point (relative to base) -> pixel point in canvas coords
export function translatePos(yd, base = defaultBase()) {
  const f = Config.ydInPixel();
  return {
    x: base.x + f * yd.x,
    y: base.y - f * yd.y,
  };
}

// pixel point -> yard point (relative to base)
export function retranslatePos(px, base = defaultBase()) {
  const f = Config.ydInPixel();
  return {
    x: (px.x - base.x) / f,
    y: (base.y - px.y) / f,
  };
}
