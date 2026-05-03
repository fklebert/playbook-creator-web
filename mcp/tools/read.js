// Read-only tools registered on the MCP server. These never mutate the
// playbook and are always available, including in --read-only mode.

import { z } from "zod";
import { describePlaybook, describePlay } from "../describe.js";
import { describeColor } from "../colors.js";

export function registerReadTools(server, getPlaybook) {
  const text = (s) => ({ content: [{ type: "text", text: s }] });
  const json = (o) => text(JSON.stringify(o, null, 2));

  server.registerTool("get_playbook_meta", {
    title: "Get playbook metadata",
    description:
      "Return name, player count, and counts of formations / routes / plays / categories.",
    inputSchema: {},
  }, async () => {
    const pb = getPlaybook();
    return json({
      name: pb.name,
      playerNumber: pb.playerNumber,
      formations: pb.formations.size,
      routes: pb.routes.size,
      plays: pb.plays.size,
      categories: pb.categories.size,
    });
  });

  server.registerTool("describe_playbook", {
    title: "Describe playbook",
    description:
      "Return a compact LLM-friendly index of the entire playbook: formations, " +
      "library routes, categories, and plays. Use this first to orient the agent.",
    inputSchema: {},
  }, async () => text(describePlaybook(getPlaybook())));

  server.registerTool("list_formations", {
    title: "List formations",
    description: "Return all formation names in the playbook.",
    inputSchema: {},
  }, async () => json(getPlaybook().formationNames()));

  server.registerTool("get_formation", {
    title: "Get formation",
    description:
      "Return the players (role, position, color) of a named formation. " +
      "Coordinates in yards: +x right, +y downfield.",
    inputSchema: { name: z.string().describe("Formation name") },
  }, async ({ name }) => {
    const f = getPlaybook().getFormation(name);
    if (!f) throw new Error(`No formation named "${name}".`);
    return json({
      name: f.name,
      players: f.players.map((p) => ({
        role: p.role.shortName,
        fullName: p.role.fullName,
        x: p.pos.x, y: p.pos.y,
        color: describeColor(p.color),
      })),
    });
  });

  server.registerTool("list_routes", {
    title: "List library routes",
    description: "Return all library route names. These can be assigned to players via assign_library_route.",
    inputSchema: {},
  }, async () => json(getPlaybook().routeNames()));

  server.registerTool("get_route", {
    title: "Get library route",
    description:
      "Return the path segments of a named library route. Coordinates are in " +
      "the un-mirrored frame relative to the player's start point; in/out " +
      "mirroring is applied at render time.",
    inputSchema: { name: z.string().describe("Route name") },
  }, async ({ name }) => {
    const r = getPlaybook().getRoute(name);
    if (!r) throw new Error(`No library route named "${name}".`);
    return json({
      name: r.name,
      codeName: r.codeName,
      paths: r.paths.map((p) => ({
        endX: p.end.x, endY: p.end.y,
        controlX: p.control?.x ?? null,
        controlY: p.control?.y ?? null,
      })),
    });
  });

  server.registerTool("list_categories", {
    title: "List categories",
    description: "Return categories with the count of plays in each.",
    inputSchema: {},
  }, async () => {
    const pb = getPlaybook();
    return json([...pb.categories.values()].map((c) => ({
      name: c.name, plays: c.playNames.size,
    })));
  });

  server.registerTool("list_plays", {
    title: "List plays",
    description:
      "Return plays in the playbook. Optional category filter restricts to " +
      "plays tagged with that category.",
    inputSchema: {
      category: z.string().optional().describe("Filter to plays in this category"),
    },
  }, async ({ category }) => {
    const pb = getPlaybook();
    let plays = [...pb.plays.values()];
    if (category) plays = plays.filter((p) => p.categoryNames.has(category));
    return json(plays.map((p) => ({
      name: p.name,
      codeName: p.codeName,
      formation: p.formationName,
      categories: [...p.categoryNames],
    })));
  });

  server.registerTool("describe_play", {
    title: "Describe play",
    description:
      "Return a detailed text rendering of one play: each player's role, " +
      "position, color, route (library or inline), motion, alternative and " +
      "option routes. Designed for an LLM to reason about the play.",
    inputSchema: { name: z.string().describe("Play name") },
  }, async ({ name }) => text(describePlay(getPlaybook(), name)));
}
