// Text renderers for an LLM audience.
//
// describePlaybook returns a compact index of the whole playbook.
// describePlay returns a detailed view of a single play, including each
// player's position, color, library or inline route, motion, and
// alternative / option routes.
//
// The output is the load-bearing surface for both authoring quality (the
// agent reasons from this text when composing new plays) and study
// quality (a QB asking about a play sees this rendered into a
// conversational answer). Coordinates are emitted in the un-mirrored
// frame as stored in the model — the in/out mirror rule is described in
// the trailing notes so the agent doesn't try to compensate for it.

import { describeColor } from "./colors.js";

export function describePlaybook(pb) {
  const lines = [];
  lines.push(`Playbook: "${pb.name}" (${pb.playerNumber}-on-${pb.playerNumber})`);
  lines.push("");

  lines.push("Formations:");
  if (pb.formations.size === 0) {
    lines.push("  (none)");
  } else {
    for (const f of pb.formations.values()) {
      lines.push(`  - ${f.name} (${f.players.length} players)`);
    }
  }
  lines.push("");

  lines.push(`Routes (library, ${pb.routes.size}):`);
  if (pb.routes.size === 0) {
    lines.push("  (none)");
  } else {
    const names = pb.routeNames();
    // Wrap to ~70 cols.
    let row = "  ";
    for (const n of names) {
      const piece = (row === "  " ? "" : ", ") + n;
      if ((row + piece).length > 70) {
        lines.push(row + ",");
        row = "  " + n;
      } else {
        row += piece;
      }
    }
    if (row !== "  ") lines.push(row);
  }
  lines.push("");

  lines.push("Categories:");
  if (pb.categories.size === 0) {
    lines.push("  (none)");
  } else {
    for (const c of pb.categories.values()) {
      lines.push(`  - ${c.name} (${c.playNames.size} plays)`);
    }
  }
  lines.push("");

  lines.push(`Plays (${pb.plays.size}):`);
  if (pb.plays.size === 0) {
    lines.push("  (none yet)");
  } else {
    for (const p of pb.plays.values()) {
      const cats = [...p.categoryNames];
      const catSuffix = cats.length ? ` — ${cats.join(", ")}` : "";
      const code = p.codeName ? ` [${p.codeName}]` : "";
      lines.push(`  - "${p.name}"${code} (${p.formationName})${catSuffix}`);
    }
  }
  lines.push("");

  lines.push("Notes:");
  lines.push("- Coordinates are yards from the ball (LOS-centered): +x right,");
  lines.push("  +y downfield, -y behind LOS. Field is 25 yards wide.");
  lines.push("- Use describe_play(name) for full per-play detail.");

  return lines.join("\n");
}

export function describePlay(pb, name) {
  const play = pb.getPlay(name);
  if (!play) throw new Error(`No play named "${name}".`);

  const lines = [];
  const code = play.codeName ? ` (code: ${play.codeName})` : "";
  lines.push(`Play "${play.name}"${code}`);
  lines.push(`Formation: ${play.formationName || "(none)"} (${pb.playerNumber}p)`);

  const cats = [...play.categoryNames];
  lines.push(`Categories: ${cats.length ? cats.join(", ") : "(none)"}`);

  if (play.comment) {
    lines.push(`Comment: ${play.comment}`);
  }
  lines.push("");

  lines.push("Players (yards from ball; +x right, +y downfield):");
  // Column widths: role (4), pos (16), color
  const roleW = Math.max(4, ...play.players.map((p) => p.role.shortName.length));
  for (const pl of play.players) {
    const pos = `at (${fmt(pl.pos.x).padStart(5)}, ${fmt(pl.pos.y).padStart(5)})`;
    const col = describeColor(pl.color);
    lines.push(`  ${pl.role.shortName.padEnd(roleW)}  ${pos}  ${col}` +
               (pl.nr ? `  #${pl.nr}` : "") +
               (pl.name ? `  "${pl.name}"` : ""));

    if (pl.motion) {
      const ep = pl.motion.endPoint;
      lines.push(`        motion (pre-snap, dashed) → ends at (${fmt(ep.x)}, ${fmt(ep.y)}):`);
      for (const seg of pl.motion.paths) lines.push(formatPath(seg));
    }
    if (pl.route) {
      const lib = pb.routes.has(pl.route.name) ? "library" : "inline";
      const rname = pl.route.name ? ` "${pl.route.name}"` : "";
      lines.push(`        route (${lib})${rname}:`);
      for (const seg of pl.route.paths) lines.push(formatPath(seg));
    }
    if (pl.altRoute1) {
      lines.push(`        alt-route 1 (orange dashed)${pl.altRoute1.name ? ` "${pl.altRoute1.name}"` : ""}:`);
      for (const seg of pl.altRoute1.paths) lines.push(formatPath(seg));
    }
    if (pl.altRoute2) {
      lines.push(`        alt-route 2 (fuchsia dashed)${pl.altRoute2.name ? ` "${pl.altRoute2.name}"` : ""}:`);
      for (const seg of pl.altRoute2.paths) lines.push(formatPath(seg));
    }
    if (pl.optionRoutes && pl.optionRoutes.length) {
      lines.push(`        option routes (dotted, ${pl.optionRoutes.length}):`);
      for (const r of pl.optionRoutes) {
        lines.push(`          • ${r.name || "(unnamed)"}`);
        for (const seg of r.paths) lines.push(formatPath(seg, "            "));
      }
    }
  }

  lines.push("");
  lines.push("Notes:");
  lines.push("- Routes assigned from the library are deep-copied into the play;");
  lines.push("  editing the library entry afterwards does not change this play.");
  lines.push("- Routes mirror automatically by player x-position. A route named");
  lines.push('  "5 In" breaks toward the middle for both WRL and WRR — path');
  lines.push("  coordinates above are stored in the un-mirrored frame, and the");
  lines.push("  renderer flips x for players on the right (x > 0).");
  lines.push("- After motion, the route starts from the motion endPoint, not the");
  lines.push("  pre-snap position.");

  return lines.join("\n");
}

function formatPath(p, indent = "          ") {
  if (p.control) {
    return `${indent}→ (${fmt(p.end.x)}, ${fmt(p.end.y)}) curve via control (${fmt(p.control.x)}, ${fmt(p.control.y)})`;
  }
  return `${indent}→ (${fmt(p.end.x)}, ${fmt(p.end.y)})`;
}

function fmt(n) {
  if (Number.isInteger(n)) return `${n}`;
  return n.toFixed(1).replace(/\.0$/, "");
}
