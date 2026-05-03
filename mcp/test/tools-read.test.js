// End-to-end test: real MCP protocol over an in-memory transport. This
// exercises tool registration, JSON schema validation, and the client/server
// roundtrip — i.e. everything the stdio path does, just without spawning a
// subprocess.

import { test } from "node:test";
import assert from "node:assert/strict";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { buildDefaultPlaybook } from "../../src/data/defaultPlaybook.js";
import { Play } from "../../src/models/play.js";
import { Route } from "../../src/models/route.js";
import { Path } from "../../src/models/path.js";
import { Category } from "../../src/models/category.js";
import { registerReadTools } from "../tools/read.js";

async function makeWiredPair(playbook) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerReadTools(server, () => playbook);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return { client, server };
}

function textOf(result) {
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

test("client lists all read tools", async () => {
  const pb = buildDefaultPlaybook("E2E", 5);
  const { client } = await makeWiredPair(pb);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "describe_play",
    "describe_playbook",
    "get_formation",
    "get_playbook_meta",
    "get_route",
    "list_categories",
    "list_formations",
    "list_plays",
    "list_routes",
  ]);
});

test("get_playbook_meta returns the playbook stats", async () => {
  const pb = buildDefaultPlaybook("Meta Test", 7);
  const { client } = await makeWiredPair(pb);
  const result = await client.callTool({ name: "get_playbook_meta", arguments: {} });
  const meta = JSON.parse(textOf(result));
  assert.equal(meta.name, "Meta Test");
  assert.equal(meta.playerNumber, 7);
  assert.equal(meta.formations, 1);
  assert.equal(meta.routes, 14);
  assert.equal(meta.plays, 0);
});

test("get_formation returns Spread Right players including SRR", async () => {
  const pb = buildDefaultPlaybook("F", 5);
  const { client } = await makeWiredPair(pb);
  const result = await client.callTool({
    name: "get_formation",
    arguments: { name: "Spread Right" },
  });
  const f = JSON.parse(textOf(result));
  assert.equal(f.name, "Spread Right");
  const roles = f.players.map((p) => p.role).sort();
  assert.deepEqual(roles, ["C", "QB", "SRR", "WRL", "WRR"]);
  const srr = f.players.find((p) => p.role === "SRR");
  assert.equal(srr.x, 5);
  assert.equal(srr.y, 0);
});

test("describe_play renders a synthesized play", async () => {
  const pb = buildDefaultPlaybook("D", 5);
  pb.addCategory(new Category("Pass"));
  const formation = pb.getFormation("Spread Right");
  const play = Play.fromFormation("Demo", "", formation);
  play.categoryNames = new Set(["Pass"]);
  const wrr = play.players.find((p) => p.role.shortName === "WRR");
  wrr.route = new Route("Slant", "", [new Path(0, 2), new Path(9, 5)]);
  pb.addPlay(play);

  const { client } = await makeWiredPair(pb);
  const result = await client.callTool({
    name: "describe_play",
    arguments: { name: "Demo" },
  });
  const text = textOf(result);
  assert.match(text, /Play "Demo"/);
  assert.match(text, /WRR/);
  assert.match(text, /Slant/);
  assert.match(text, /un-mirrored frame/);
});

test("describe_play surfaces a tool error for unknown name", async () => {
  const pb = buildDefaultPlaybook("E", 5);
  const { client } = await makeWiredPair(pb);
  const result = await client.callTool({
    name: "describe_play",
    arguments: { name: "no-such" },
  });
  // SDK convention: errors come back as isError:true with text content.
  assert.equal(result.isError, true);
  assert.match(textOf(result), /No play named/);
});

test("list_plays filters by category", async () => {
  const pb = buildDefaultPlaybook("L", 5);
  pb.addCategory(new Category("Run"));
  pb.addCategory(new Category("Pass"));
  const formation = pb.getFormation("Spread Right");
  const a = Play.fromFormation("Iso", "", formation);
  a.categoryNames = new Set(["Run"]);
  const b = Play.fromFormation("Smash", "", formation);
  b.categoryNames = new Set(["Pass"]);
  pb.addPlay(a);
  pb.addPlay(b);

  const { client } = await makeWiredPair(pb);
  const all = JSON.parse(textOf(await client.callTool({
    name: "list_plays", arguments: {},
  })));
  assert.equal(all.length, 2);

  const passOnly = JSON.parse(textOf(await client.callTool({
    name: "list_plays", arguments: { category: "Pass" },
  })));
  assert.equal(passOnly.length, 1);
  assert.equal(passOnly[0].name, "Smash");
});
