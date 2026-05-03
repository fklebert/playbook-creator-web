// In-memory tests for the write tools. The save() round-trip lives in
// save-roundtrip.test.js; here we just verify each tool mutates the
// in-memory playbook the way it claims to.

import { test } from "node:test";
import assert from "node:assert/strict";

import { makeWired, jsonOf, textOf } from "./_helpers.js";

test("create_play creates a play from a formation", async () => {
  const { client, getPlaybook } = await makeWired();
  const result = await client.callTool({
    name: "create_play",
    arguments: { name: "First", formation: "Spread Right", categories: ["Pass"] },
  });
  const out = jsonOf(result);
  assert.equal(out.created, "First");
  const pb = getPlaybook();
  assert.ok(pb.plays.has("First"));
  assert.ok(pb.categories.has("Pass"), "missing category was auto-created");
  assert.deepEqual([...pb.getPlay("First").categoryNames], ["Pass"]);
});

test("create_play rejects duplicate names and unknown formations", async () => {
  const { client } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "X", formation: "Spread Right" },
  });
  const dup = await client.callTool({
    name: "create_play",
    arguments: { name: "X", formation: "Spread Right" },
  });
  assert.equal(dup.isError, true);
  assert.match(textOf(dup), /already exists/);

  const bad = await client.callTool({
    name: "create_play",
    arguments: { name: "Y", formation: "Nonsense" },
  });
  assert.equal(bad.isError, true);
  assert.match(textOf(bad), /No formation named/);
});

test("assign_library_route deep-clones (later library edit doesn't bleed)", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  await client.callTool({
    name: "assign_library_route",
    arguments: { playName: "P", playerRole: "WRR", routeName: "Slant" },
  });
  const pb = getPlaybook();
  const wrr = pb.getPlay("P").players.find((p) => p.role.shortName === "WRR");
  assert.ok(wrr.route);
  assert.equal(wrr.route.name, "Slant");

  // Mutating the library should NOT change the play's copy.
  pb.getRoute("Slant").paths[0].end.x = 999;
  assert.notEqual(wrr.route.paths[0].end.x, 999);
});

test("set_inline_route accepts straight + Bezier segments", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  await client.callTool({
    name: "set_inline_route",
    arguments: {
      playName: "P", playerRole: "SRR", name: "WheelOut",
      paths: [
        { x: 0, y: 4 },
        { x: -3, y: 8, controlX: -1, controlY: 6 },
      ],
    },
  });
  const srr = getPlaybook().getPlay("P").players.find((p) => p.role.shortName === "SRR");
  assert.equal(srr.route.name, "WheelOut");
  assert.equal(srr.route.paths.length, 2);
  assert.equal(srr.route.paths[0].control, null);
  assert.deepEqual(srr.route.paths[1].control, { x: -1, y: 6 });
});

test("set_player_position snaps to 0.5 yard grid", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  await client.callTool({
    name: "set_player_position",
    arguments: { playName: "P", playerRole: "QB", x: 0.34, y: -4.71 },
  });
  const qb = getPlaybook().getPlay("P").players.find((p) => p.role.shortName === "QB");
  assert.deepEqual(qb.pos, { x: 0.5, y: -4.5 });
});

test("set_player_color accepts named, hex, and [r,g,b]", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  const setColor = (playerRole, color) => client.callTool({
    name: "set_player_color",
    arguments: { playName: "P", playerRole, color },
  });

  await setColor("WRR", "blue");
  await setColor("WRL", "#ff8800");
  await setColor("SRR", [10, 20, 30]);

  const players = getPlaybook().getPlay("P").players;
  const wrr = players.find((p) => p.role.shortName === "WRR");
  const wrl = players.find((p) => p.role.shortName === "WRL");
  const srr = players.find((p) => p.role.shortName === "SRR");
  assert.deepEqual({ r: wrr.color.r, g: wrr.color.g, b: wrr.color.b }, { r: 40, g: 80, b: 220 });
  assert.deepEqual({ r: wrl.color.r, g: wrl.color.g, b: wrl.color.b }, { r: 255, g: 136, b: 0 });
  assert.deepEqual({ r: srr.color.r, g: srr.color.g, b: srr.color.b }, { r: 10, g: 20, b: 30 });
});

test("set_player_color rejects unknown name", async () => {
  const { client } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  const r = await client.callTool({
    name: "set_player_color",
    arguments: { playName: "P", playerRole: "QB", color: "puce" },
  });
  assert.equal(r.isError, true);
  assert.match(textOf(r), /Unknown color/);
});

test("set_motion sets endPoint and routes start there post-snap", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  await client.callTool({
    name: "set_motion",
    arguments: {
      playName: "P", playerRole: "SRR",
      paths: [{ x: 4, y: -2 }],
      endX: 4, endY: -2,
    },
  });
  const srr = getPlaybook().getPlay("P").players.find((p) => p.role.shortName === "SRR");
  assert.deepEqual(srr.motion.endPoint, { x: 4, y: -2 });
  assert.equal(srr.motion.paths.length, 1);
});

test("set_play_categories creates new categories and updates membership", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  await client.callTool({
    name: "set_play_categories",
    arguments: { playName: "P", categoryNames: ["Run", "RunPass"] },
  });
  const pb = getPlaybook();
  assert.ok(pb.categories.has("Run"));
  assert.ok(pb.categories.has("RunPass"));
  assert.ok(pb.getCategory("Run").playNames.has("P"));
  assert.ok(pb.getCategory("RunPass").playNames.has("P"));

  await client.callTool({
    name: "set_play_categories",
    arguments: { playName: "P", categoryNames: ["Run"] },
  });
  assert.ok(pb.getCategory("Run").playNames.has("P"));
  assert.equal(pb.getCategory("RunPass").playNames.has("P"), false);
});

test("add_library_route adds, rejects duplicate", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "add_library_route",
    arguments: { name: "Texas", paths: [{ x: 0, y: 5 }, { x: -4, y: 7 }] },
  });
  assert.ok(getPlaybook().getRoute("Texas"));

  const dup = await client.callTool({
    name: "add_library_route",
    arguments: { name: "Texas", paths: [{ x: 0, y: 5 }] },
  });
  assert.equal(dup.isError, true);
});

test("add_library_formation_from_play strips routes, motion, numbers", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  await client.callTool({
    name: "assign_library_route",
    arguments: { playName: "P", playerRole: "WRR", routeName: "Slant" },
  });
  await client.callTool({
    name: "set_player_number",
    arguments: { playName: "P", playerRole: "WRR", nr: 11 },
  });

  await client.callTool({
    name: "add_library_formation_from_play",
    arguments: { playName: "P", formationName: "Spread Right Variant" },
  });

  const f = getPlaybook().getFormation("Spread Right Variant");
  assert.ok(f);
  for (const pl of f.players) {
    assert.equal(pl.route, null, `${pl.role.shortName} should have no route`);
    assert.equal(pl.motion, null);
    assert.equal(pl.nr, 0);
  }
});

test("clear_route removes only the route, leaving motion intact", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });
  await client.callTool({
    name: "set_motion",
    arguments: {
      playName: "P", playerRole: "SRR",
      paths: [{ x: 4, y: -2 }], endX: 4, endY: -2,
    },
  });
  await client.callTool({
    name: "assign_library_route",
    arguments: { playName: "P", playerRole: "SRR", routeName: "Slant" },
  });
  await client.callTool({
    name: "clear_route",
    arguments: { playName: "P", playerRole: "SRR" },
  });
  const srr = getPlaybook().getPlay("P").players.find((p) => p.role.shortName === "SRR");
  assert.equal(srr.route, null);
  assert.notEqual(srr.motion, null, "motion was preserved");
});

test("delete_play removes from playbook + category memberships", async () => {
  const { client, getPlaybook } = await makeWired();
  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right", categories: ["Pass"] },
  });
  await client.callTool({ name: "delete_play", arguments: { name: "P" } });
  const pb = getPlaybook();
  assert.equal(pb.plays.has("P"), false);
  assert.equal(pb.getCategory("Pass").playNames.has("P"), false);
});

test("write tools error in read-only mode", async () => {
  const { client } = await makeWired({ readOnly: true });
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  // None of the write tool names should be present.
  for (const wn of [
    "create_play", "delete_play", "assign_library_route", "set_inline_route",
    "set_player_position", "save",
  ]) {
    assert.ok(!names.includes(wn), `${wn} should not be exposed in read-only`);
  }
});
