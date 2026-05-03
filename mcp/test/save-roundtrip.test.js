// End-to-end persistence tests:
// - mutate via tools → save → re-deserialize the file → assert on disk state
// - external modification between load and save triggers stale-mtime error
//   (force=true overrides)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, statSync, utimesSync } from "node:fs";

import initSqlJs from "sql.js";
import { setSqlLoader, deserialize } from "../../src/storage/sqlite.js";

import { makeWired, jsonOf } from "./_helpers.js";

setSqlLoader(() => initSqlJs());

test("mutations persist through save → re-deserialize", async () => {
  const { client, absPath } = await makeWired();

  await client.callTool({
    name: "create_play",
    arguments: { name: "Smash Right", codeName: "SR-1", formation: "Spread Right", categories: ["Pass"] },
  });
  await client.callTool({
    name: "assign_library_route",
    arguments: { playName: "Smash Right", playerRole: "WRR", routeName: "Corner" },
  });
  await client.callTool({
    name: "set_player_position",
    arguments: { playName: "Smash Right", playerRole: "QB", x: 0, y: -4.5 },
  });
  await client.callTool({
    name: "set_player_color",
    arguments: { playName: "Smash Right", playerRole: "WRR", color: "blue" },
  });
  await client.callTool({
    name: "set_play_comment",
    arguments: { playName: "Smash Right", comment: "high-low concept" },
  });
  await client.callTool({
    name: "add_library_route",
    arguments: { name: "Texas", paths: [{ x: 0, y: 5 }, { x: -5, y: 8, controlX: -2, controlY: 6 }] },
  });

  const saveResult = jsonOf(await client.callTool({ name: "save", arguments: {} }));
  assert.equal(saveResult.saved, true);

  // Read the file back from disk via a fresh deserialize — proves persistence.
  const reloaded = await deserialize(readFileSync(absPath));

  const play = reloaded.getPlay("Smash Right");
  assert.ok(play, "play persisted to disk");
  assert.equal(play.codeName, "SR-1");
  assert.equal(play.comment, "high-low concept");
  assert.ok(play.categoryNames.has("Pass"));

  const wrr = play.players.find((p) => p.role.shortName === "WRR");
  assert.equal(wrr.route?.name, "Corner");
  assert.deepEqual({ r: wrr.color.r, g: wrr.color.g, b: wrr.color.b }, { r: 40, g: 80, b: 220 });

  const qb = play.players.find((p) => p.role.shortName === "QB");
  assert.equal(qb.pos.y, -4.5);

  const texas = reloaded.getRoute("Texas");
  assert.ok(texas, "library route persisted");
  assert.equal(texas.paths.length, 2);
  assert.deepEqual(texas.paths[1].control, { x: -2, y: 6 });
});

test("save refuses when file modified externally; force overrides", async () => {
  const { client, absPath } = await makeWired();

  await client.callTool({
    name: "create_play",
    arguments: { name: "P", formation: "Spread Right" },
  });

  // Simulate an external write: bump mtime well past lastReadMtime by both
  // touching the file with a future time and rewriting its contents.
  const future = new Date(Date.now() + 5000);
  // Re-write with the same bytes; what matters is the mtime advance.
  writeFileSync(absPath, readFileSync(absPath));
  utimesSync(absPath, future, future);
  // Sanity check that mtime really did advance.
  assert.ok(statSync(absPath).mtimeMs > Date.now() - 1, "mtime moved forward");

  const stale = await client.callTool({ name: "save", arguments: {} });
  assert.equal(stale.isError, true, "stale save should error");
  assert.match(
    stale.content[0].text,
    /modified externally/,
    "error message names the cause",
  );

  const forced = jsonOf(await client.callTool({
    name: "save", arguments: { force: true },
  }));
  assert.equal(forced.saved, true);
  assert.equal(forced.force, true);

  // After force-save, the in-memory state must have been written.
  const reloaded = await deserialize(readFileSync(absPath));
  assert.ok(reloaded.getPlay("P"), "force-saved play landed on disk");
});
