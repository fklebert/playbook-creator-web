# Playbook Creator MCP server

A local MCP server that lets an AI agent **read** and **author** playbooks
stored in `.pbc.sqlite` files produced by [Playbook Creator
Web](../README.md). It reuses the web app's model and storage layer
directly — same SQLite schema, same coordinate system, same in/out
mirroring semantics.

The server is a Node process. The browser app remains pure HTML5 and is
unaffected by anything in this folder.

## Install

```bash
cd mcp/
npm install
```

## Run (standalone, for sanity check)

```bash
node server.js /path/to/your/playbook.pbc.sqlite
# add --read-only to disable the write/save tools
```

The server speaks MCP over stdio. Standalone it just prints a load banner
and waits — it's meant to be launched by an MCP client.

## Wire into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "playbook-creator": {
      "command": "node",
      "args": [
        "/absolute/path/to/playbook-creator-web/mcp/server.js",
        "/absolute/path/to/your-playbook.pbc.sqlite"
      ]
    }
  }
}
```

Restart Claude Desktop. The playbook tools will appear in the tool list.

For a **read-only** instance (study/QB scenario), append `"--read-only"`
to the `args` array. Two separate MCP entries — one read-write for the
coach, one read-only for the QB — is a reasonable pattern.

## Workflow

1. Coach designs plays in the browser app, hits **Save**.
2. Agent reads/edits the file via this MCP server, writes back.
3. Coach picks **File → Reload from disk** in the browser to see the
   changes.

The server captures the file's mtime when it loads and refuses to save
if the file has been modified externally since. Pass `force: true` to
the `save` tool to overwrite anyway.

## Tool surface

**Read tools** (always available):

- `get_playbook_meta` — name, player count, summary counts
- `describe_playbook` — LLM-friendly index of the whole book
- `describe_play(name)` — full per-play rendering (positions, routes,
  motion, alts, plus the in/out mirror legend)
- `list_formations` / `get_formation(name)`
- `list_routes` / `get_route(name)`
- `list_categories` / `list_plays(category?)`

**Write tools** (omitted in `--read-only` mode):

- `create_play({name, codeName?, formation, categories?})`
- `delete_play(name)`
- `assign_library_route({playName, playerRole, routeName})` — deep-clones
- `set_inline_route({playName, playerRole, paths, name?})` —
  `paths[i]` = `{x, y, controlX?, controlY?}` (Bezier when control set)
- `clear_route({playName, playerRole})`
- `set_player_position({playName, playerRole, x, y})` — snaps 0.5 yd
- `set_player_color({playName, playerRole, color})` — name / hex / [r,g,b]
- `set_player_number({playName, playerRole, nr})`
- `set_motion({playName, playerRole, paths, endX, endY})`
- `clear_motion({playName, playerRole})`
- `set_play_categories({playName, categoryNames})`
- `set_play_comment({playName, comment})`
- `add_library_route({name, codeName?, paths})`
- `add_library_formation_from_play({playName, formationName})`
- `save({force?})` — flush to disk; refuses on stale mtime unless `force`

Player addressing uses the `shortName` of the role (e.g. `WRR`, `SRR`,
`QB`, `HB`, `TE`). The server errors on ambiguous roles within a play.

## Tests

```bash
npm test
```

Runs `node --test` across `test/`: model round-trip, describe text
snapshots, full read/write tool surface (in-memory MCP transport), and
file save/reload with stale-mtime handling.

## License

GPL v3 or later, same as the rest of Playbook Creator.
