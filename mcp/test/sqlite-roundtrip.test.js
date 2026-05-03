// Verifies the refactored src/storage/sqlite.js works in Node when given an
// injected sql.js loader, and that a default playbook round-trips losslessly.

import { test } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";

import { setSqlLoader, serialize, deserialize } from "../../src/storage/sqlite.js";
import { buildDefaultPlaybook } from "../../src/data/defaultPlaybook.js";

setSqlLoader(() => initSqlJs());

test("default playbook round-trips through serialize/deserialize", async () => {
  const original = buildDefaultPlaybook("Round Trip Book", 7);
  const bytes = await serialize(original);
  assert.ok(bytes instanceof Uint8Array, "serialize returns Uint8Array");
  assert.ok(bytes.length > 0, "serialized playbook is non-empty");

  const restored = await deserialize(bytes);

  assert.equal(restored.name, original.name);
  assert.equal(restored.playerNumber, original.playerNumber);

  const origRoutes = [...original.routes.keys()].sort();
  const restRoutes = [...restored.routes.keys()].sort();
  assert.deepEqual(restRoutes, origRoutes);

  const origForms = [...original.formations.keys()].sort();
  const restForms = [...restored.formations.keys()].sort();
  assert.deepEqual(restForms, origForms);

  const origSpread = original.getFormation("Spread Right");
  const restSpread = restored.getFormation("Spread Right");
  assert.equal(restSpread.players.length, origSpread.players.length);

  const origPlayer = origSpread.players.find((p) => p.role.shortName === "SRR");
  const restPlayer = restSpread.players.find((p) => p.role.shortName === "SRR");
  assert.ok(origPlayer, "default 5p has SRR after rename");
  assert.equal(restPlayer.role.fullName, "Slot Receiver Right");
  assert.equal(restPlayer.pos.x, 5);
  assert.equal(restPlayer.pos.y, 0);
});
