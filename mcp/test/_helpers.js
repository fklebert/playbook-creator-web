// Test helpers: build a fresh fixture file, wire createServer + Client over
// the in-memory transport, return the bits tests want to poke.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import initSqlJs from "sql.js";
import { setSqlLoader, serialize } from "../../src/storage/sqlite.js";
import { buildDefaultPlaybook } from "../../src/data/defaultPlaybook.js";
import { createServer } from "../createServer.js";

let initialized = false;

export async function makeFixture({ name = "Test", playerNumber = 5 } = {}) {
  if (!initialized) {
    setSqlLoader(() => initSqlJs());
    initialized = true;
  }
  const dir = mkdtempSync(join(tmpdir(), "pbc-test-"));
  const filePath = join(dir, `${name.replace(/\s+/g, "-")}.pbc.sqlite`);
  const pb = buildDefaultPlaybook(name, playerNumber);
  writeFileSync(filePath, await serialize(pb));
  return filePath;
}

export async function makeWired({ filePath, readOnly = false } = {}) {
  if (!filePath) filePath = await makeFixture();
  const { server, getPlaybook, savePlaybook, absPath } =
    await createServer({ filePath, readOnly });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return { client, getPlaybook, savePlaybook, absPath };
}

export function textOf(result) {
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export function jsonOf(result) {
  return JSON.parse(textOf(result));
}
