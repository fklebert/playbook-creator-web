#!/usr/bin/env node
// Playbook Creator MCP server (CLI entry).
//
// Reads/writes a single .pbc.sqlite file via the same model + SQL layer the
// browser app uses. Launched per-conversation by an MCP client (Claude
// Desktop, Claude Code, etc.) over stdio:
//
//   node server.js <file.pbc.sqlite> [--read-only]
//
// See ./README.md for the Claude Desktop config snippet.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./createServer.js";

const args = process.argv.slice(2);
const readOnly = args.includes("--read-only");
const filePath = args.find((a) => !a.startsWith("--"));

if (!filePath) {
  console.error("Usage: playbook-creator-mcp <file.pbc.sqlite> [--read-only]");
  process.exit(1);
}

const { server, getPlaybook, absPath } = await createServer({ filePath, readOnly });

const pb = getPlaybook();
console.error(
  `[playbook-creator-mcp] loaded "${pb.name}" ` +
  `(${pb.plays.size} plays, ${pb.formations.size} formations, ` +
  `${pb.routes.size} routes) from ${absPath}` +
  (readOnly ? " [read-only]" : ""),
);

const transport = new StdioServerTransport();
await server.connect(transport);
