// Named color palette for player jerseys / route emphasis.
//
// Tools accept colors as either a name (string), a hex (#rrggbb), or an
// [r,g,b] / {r,g,b} triple. The describe layer prefers the closest named
// color when within `threshold` Euclidean RGB distance, otherwise it
// emits the raw RGB tuple — this keeps the LLM-facing text readable
// without losing precision when a coach picks an unusual color.

const NAMED_COLORS = [
  ["red",    [220,  40,  40]],
  ["blue",   [ 40,  80, 220]],
  ["green",  [ 40, 170,  80]],
  ["yellow", [240, 220,  60]],
  ["orange", [240, 140,  40]],
  ["purple", [140,  60, 200]],
  ["navy",   [ 20,  40, 100]],
  ["maroon", [120,  30,  50]],
  ["gold",   [220, 180,  50]],
  ["silver", [190, 190, 190]],
  ["white",  [240, 240, 240]],
  ["black",  [ 20,  20,  20]],
  ["gray",   [140, 140, 140]],
];

const NAMED_INDEX = new Map(NAMED_COLORS.map(([n, rgb]) => [n, rgb]));

export function colorNames() {
  return NAMED_COLORS.map(([n]) => n);
}

export function nearestNamed(r, g, b, threshold = 60) {
  let best = null;
  let bestD = Infinity;
  for (const [name, [nr, ng, nb]] of NAMED_COLORS) {
    const d = Math.hypot(r - nr, g - ng, b - nb);
    if (d < bestD) { bestD = d; best = name; }
  }
  return bestD <= threshold ? best : null;
}

export function describeColor(color) {
  const named = nearestNamed(color.r, color.g, color.b);
  return named || `rgb(${color.r}, ${color.g}, ${color.b})`;
}

// Accept a name, hex, [r,g,b] tuple, or {r,g,b} object. Returns {r,g,b}.
export function parseColorInput(input) {
  if (typeof input === "string") {
    const norm = input.trim().toLowerCase();
    if (NAMED_INDEX.has(norm)) {
      const [r, g, b] = NAMED_INDEX.get(norm);
      return { r, g, b };
    }
    const m = /^#?([0-9a-fA-F]{6})$/.exec(norm);
    if (m) {
      const v = parseInt(m[1], 16);
      return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
    }
    throw new Error(
      `Unknown color "${input}". Use one of: ${[...NAMED_INDEX.keys()].join(", ")}; ` +
      `or "#rrggbb"; or [r,g,b].`,
    );
  }
  if (Array.isArray(input) && input.length === 3) {
    return { r: clamp8(input[0]), g: clamp8(input[1]), b: clamp8(input[2]) };
  }
  if (input && typeof input === "object" && "r" in input) {
    return { r: clamp8(input.r), g: clamp8(input.g), b: clamp8(input.b) };
  }
  throw new Error("Color must be a name (string), '#rrggbb', [r,g,b], or {r,g,b}.");
}

function clamp8(n) {
  const v = Math.round(+n);
  if (!Number.isFinite(v)) throw new Error(`Invalid color channel: ${n}`);
  return Math.max(0, Math.min(255, v));
}
