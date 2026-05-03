// Write tools — only registered when the server runs without --read-only.
//
// All tools mutate the in-memory Playbook. Persistence is explicit: the agent
// must call `save` to flush changes to disk. This lets the agent experiment
// (compose several plays, evaluate them) before committing.
//
// Player addressing: `playerRole` is the player's shortName (e.g. "WRR",
// "SRR", "QB"). It must be unique within a play; we error otherwise so a
// silent "wrong player edited" never happens.

import { z } from "zod";
import { Play } from "../../src/models/play.js";
import { Player } from "../../src/models/player.js";
import { Route } from "../../src/models/route.js";
import { Motion } from "../../src/models/motion.js";
import { Path } from "../../src/models/path.js";
import { Color } from "../../src/models/color.js";
import { Formation } from "../../src/models/formation.js";
import { Category } from "../../src/models/category.js";
import { parseColorInput } from "../colors.js";

const colorInput = z.union([
  z.string(),
  z.array(z.number()).length(3),
  z.object({ r: z.number(), g: z.number(), b: z.number() }),
]);

const pathInput = z.object({
  x: z.number(),
  y: z.number(),
  controlX: z.number().optional(),
  controlY: z.number().optional(),
});

function snapHalf(n) {
  return Math.round(n * 2) / 2;
}

function findPlayer(play, role) {
  const matches = play.players.filter((p) => p.role.shortName === role);
  if (matches.length === 0) {
    throw new Error(
      `No player with role "${role}" in play "${play.name}". ` +
      `Roles present: ${play.players.map((p) => p.role.shortName).join(", ") || "(none)"}.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple players have role "${role}" in play "${play.name}" — addressing is ambiguous. ` +
      `Rename one (e.g. add an L/R suffix) before editing.`,
    );
  }
  return matches[0];
}

function pathsFromInput(arr) {
  return arr.map((p) => new Path(
    p.x, p.y,
    p.controlX ?? null, p.controlY ?? null,
  ));
}

export function registerWriteTools(server, getPlaybook, save) {
  const text = (s) => ({ content: [{ type: "text", text: s }] });
  const ok = (s) => text(typeof s === "string" ? s : JSON.stringify(s, null, 2));

  // ---- play lifecycle ----------------------------------------------------

  server.registerTool("create_play", {
    title: "Create play",
    description:
      "Create a new play from a formation. Players are deep-copied from the " +
      "formation with no routes assigned. Returns the new play's name.",
    inputSchema: {
      name: z.string().min(1),
      codeName: z.string().optional(),
      formation: z.string(),
      categories: z.array(z.string()).optional(),
    },
  }, async ({ name, codeName, formation, categories }) => {
    const pb = getPlaybook();
    if (pb.plays.has(name)) throw new Error(`A play named "${name}" already exists.`);
    const f = pb.getFormation(formation);
    if (!f) throw new Error(`No formation named "${formation}".`);
    const play = Play.fromFormation(name, codeName || "", f);
    if (categories) {
      for (const cn of categories) {
        if (!pb.categories.has(cn)) pb.addCategory(new Category(cn));
      }
      play.categoryNames = new Set(categories);
    }
    pb.addPlay(play);
    return ok({ created: name, formation, players: play.players.length });
  });

  server.registerTool("delete_play", {
    title: "Delete play",
    description: "Remove a play from the playbook.",
    inputSchema: { name: z.string() },
  }, async ({ name }) => {
    const pb = getPlaybook();
    if (!pb.plays.has(name)) throw new Error(`No play named "${name}".`);
    pb.deletePlay(name);
    return ok({ deleted: name });
  });

  // ---- routes on a player ------------------------------------------------

  server.registerTool("assign_library_route", {
    title: "Assign library route",
    description:
      "Assign a route from the library to a player. The route is deep-cloned " +
      "into the play; later edits to the library entry do not affect this play.",
    inputSchema: {
      playName: z.string(),
      playerRole: z.string().describe("Player shortName, e.g. 'WRR', 'SRR', 'QB'"),
      routeName: z.string(),
    },
  }, async ({ playName, playerRole, routeName }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    const route = pb.getRoute(routeName);
    if (!route) throw new Error(`No library route named "${routeName}".`);
    const player = findPlayer(play, playerRole);
    player.route = route.clone();
    return ok({ playName, playerRole, route: routeName });
  });

  server.registerTool("set_inline_route", {
    title: "Set inline (custom) route",
    description:
      "Assign a one-off route to a player. Pass an array of path segments. " +
      "Each segment has end coords (x, y); add controlX+controlY for a Bezier " +
      "curve (the control point shapes the segment from its start to (x,y)). " +
      "Coords are in yards relative to the player's start position, in the " +
      "un-mirrored frame.",
    inputSchema: {
      playName: z.string(),
      playerRole: z.string(),
      paths: z.array(pathInput).min(1),
      name: z.string().optional().describe("Optional name for the inline route"),
    },
  }, async ({ playName, playerRole, paths, name }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    const player = findPlayer(play, playerRole);
    player.route = new Route(name || "", "", pathsFromInput(paths));
    return ok({ playName, playerRole, segments: paths.length });
  });

  server.registerTool("clear_route", {
    title: "Clear route",
    description: "Remove the route assigned to a player (motion is unaffected).",
    inputSchema: { playName: z.string(), playerRole: z.string() },
  }, async ({ playName, playerRole }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    const player = findPlayer(play, playerRole);
    player.route = null;
    return ok({ playName, playerRole, cleared: "route" });
  });

  // ---- player attributes -------------------------------------------------

  server.registerTool("set_player_position", {
    title: "Set player position",
    description:
      "Move a player to (x, y) yards. Snaps to the 0.5-yard grid (matching " +
      "the editor's drag behavior).",
    inputSchema: {
      playName: z.string(),
      playerRole: z.string(),
      x: z.number(),
      y: z.number(),
    },
  }, async ({ playName, playerRole, x, y }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    const player = findPlayer(play, playerRole);
    player.pos = { x: snapHalf(x), y: snapHalf(y) };
    return ok({ playName, playerRole, pos: player.pos });
  });

  server.registerTool("set_player_color", {
    title: "Set player color",
    description:
      "Set a player's jersey color. Accepts a name (red, blue, green, ...), " +
      "'#rrggbb', or [r,g,b].",
    inputSchema: {
      playName: z.string(),
      playerRole: z.string(),
      color: colorInput,
    },
  }, async ({ playName, playerRole, color }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    const player = findPlayer(play, playerRole);
    const rgb = parseColorInput(color);
    player.color = new Color(rgb.r, rgb.g, rgb.b);
    return ok({ playName, playerRole, color: rgb });
  });

  server.registerTool("set_player_number", {
    title: "Set player number",
    description: "Set the jersey number on a player (0 to clear).",
    inputSchema: {
      playName: z.string(),
      playerRole: z.string(),
      nr: z.number().int().min(0).max(99),
    },
  }, async ({ playName, playerRole, nr }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    const player = findPlayer(play, playerRole);
    player.nr = nr | 0;
    return ok({ playName, playerRole, nr: player.nr });
  });

  // ---- motion ------------------------------------------------------------

  server.registerTool("set_motion", {
    title: "Set pre-snap motion",
    description:
      "Assign pre-snap motion to a player. `paths` is the motion path; " +
      "`endX`/`endY` is the endpoint where the player ends up before the snap " +
      "and from which any assigned route then begins.",
    inputSchema: {
      playName: z.string(),
      playerRole: z.string(),
      paths: z.array(pathInput).min(1),
      endX: z.number(),
      endY: z.number(),
    },
  }, async ({ playName, playerRole, paths, endX, endY }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    const player = findPlayer(play, playerRole);
    player.motion = new Motion(pathsFromInput(paths), { x: endX, y: endY });
    return ok({ playName, playerRole, endPoint: { x: endX, y: endY } });
  });

  server.registerTool("clear_motion", {
    title: "Clear motion",
    description: "Remove the pre-snap motion assigned to a player.",
    inputSchema: { playName: z.string(), playerRole: z.string() },
  }, async ({ playName, playerRole }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    const player = findPlayer(play, playerRole);
    player.motion = null;
    return ok({ playName, playerRole, cleared: "motion" });
  });

  // ---- play metadata -----------------------------------------------------

  server.registerTool("set_play_categories", {
    title: "Set play categories",
    description:
      "Replace the category set on a play. Any category names not yet in the " +
      "playbook are created.",
    inputSchema: {
      playName: z.string(),
      categoryNames: z.array(z.string()),
    },
  }, async ({ playName, categoryNames }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    for (const cn of categoryNames) {
      if (!pb.categories.has(cn)) pb.addCategory(new Category(cn));
    }
    play.categoryNames = new Set(categoryNames);
    for (const cat of pb.categories.values()) {
      if (play.categoryNames.has(cat.name)) cat.addPlay(play.name);
      else cat.removePlay(play.name);
    }
    return ok({ playName, categories: categoryNames });
  });

  server.registerTool("set_play_comment", {
    title: "Set play comment",
    description: "Set the free-text comment shown in the inspector for a play.",
    inputSchema: { playName: z.string(), comment: z.string() },
  }, async ({ playName, comment }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    play.comment = comment;
    return ok({ playName, commentLength: comment.length });
  });

  // ---- library additions -------------------------------------------------

  server.registerTool("add_library_route", {
    title: "Add library route",
    description:
      "Add a new named route to the library so it can be assigned to players " +
      "in any play. Errors if the name already exists.",
    inputSchema: {
      name: z.string().min(1),
      codeName: z.string().optional(),
      paths: z.array(pathInput).min(1),
    },
  }, async ({ name, codeName, paths }) => {
    const pb = getPlaybook();
    if (pb.routes.has(name)) throw new Error(`A library route named "${name}" already exists.`);
    pb.addRoute(new Route(name, codeName || "", pathsFromInput(paths)));
    return ok({ added: name, segments: paths.length });
  });

  server.registerTool("add_library_formation_from_play", {
    title: "Add library formation from play",
    description:
      "Snapshot a play's player layout (positions/roles only, no routes/motion/numbers) " +
      "into the formation library under a new name.",
    inputSchema: {
      playName: z.string(),
      formationName: z.string().min(1),
    },
  }, async ({ playName, formationName }) => {
    const pb = getPlaybook();
    const play = pb.getPlay(playName);
    if (!play) throw new Error(`No play named "${playName}".`);
    if (pb.formations.has(formationName)) {
      throw new Error(`A formation named "${formationName}" already exists.`);
    }
    const players = play.players.map((p) => {
      const c = p.clone();
      c.route = c.motion = c.altRoute1 = c.altRoute2 = null;
      c.optionRoutes = [];
      c.nr = 0;
      c.name = "";
      return c;
    });
    pb.addFormation(new Formation(formationName, players));
    return ok({ added: formationName, players: players.length });
  });

  // ---- persistence -------------------------------------------------------

  server.registerTool("save", {
    title: "Save playbook to disk",
    description:
      "Flush all changes to the .pbc.sqlite file. Refuses if the file has " +
      "been modified externally since the MCP server last read it (use " +
      "`force: true` to overwrite anyway). The browser app should then " +
      "use File → Reload from disk to pick up the changes.",
    inputSchema: {
      force: z.boolean().optional().describe("Overwrite even if mtime advanced"),
    },
  }, async ({ force }) => {
    await save({ force: !!force });
    return ok({ saved: true, force: !!force });
  });
}
