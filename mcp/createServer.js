// Builds the MCP server, wires read (and conditionally write) tools, and
// provides the load/save lifecycle bound to a single .pbc.sqlite file.
// The CLI entry (server.js) is a thin wrapper around this; the test suite
// uses createServer directly with the in-memory transport.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs from "sql.js";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { setSqlLoader, serialize, deserialize } from "../src/storage/sqlite.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";

let sqlLoaderRegistered = false;

export async function createServer({ filePath, readOnly = false }) {
  if (!sqlLoaderRegistered) {
    setSqlLoader(() => initSqlJs());
    sqlLoaderRegistered = true;
  }

  const absPath = resolve(filePath);

  let playbook = null;
  // mtime captured at last read; save() refuses (without force) if the file
  // has been modified externally since.
  let lastReadMtime = 0;

  async function load() {
    const bytes = readFileSync(absPath);
    lastReadMtime = statSync(absPath).mtimeMs;
    playbook = await deserialize(bytes);
  }

  async function savePlaybook({ force = false } = {}) {
    const currentMtime = statSync(absPath).mtimeMs;
    // Allow ~1ms slop; some filesystems quantize mtime.
    if (!force && currentMtime > lastReadMtime + 1) {
      throw new Error(
        `File modified externally since last read (mtime ${currentMtime} > ${lastReadMtime}). ` +
        `Reload before saving, or pass force=true to overwrite.`,
      );
    }
    const bytes = await serialize(playbook);
    writeFileSync(absPath, bytes);
    lastReadMtime = statSync(absPath).mtimeMs;
  }

  await load();

  const server = new McpServer({
    name: "playbook-creator",
    version: "0.1.0",
  });

  registerReadTools(server, () => playbook);
  if (!readOnly) {
    registerWriteTools(server, () => playbook, savePlaybook);
  }

  return {
    server,
    getPlaybook: () => playbook,
    savePlaybook,
    absPath,
  };
}
