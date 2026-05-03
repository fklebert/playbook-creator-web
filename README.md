# Playbook Creator Web

A free, browser-based editor for American (Flag) Football playbooks.
Design plays, organize them into categories, and export a wrist-coach
PDF — entirely offline, with no installation, no backend, and no account.

This project is a **ground-up HTML5 rewrite** of the excellent
[Playbook Creator](https://github.com/obraunsdorf/playbook-creator) by
Oliver Braunsdorf — see [Credits & Attribution](#credits--attribution)
below.

---

## Quick start

The app uses native ES modules, so it needs to be served over HTTP rather
than opened directly from disk. Pick any local server:

```bash
cd playbook-creator-web/
python3 -m http.server 8000
# then open http://localhost:8000
```

Or:

```bash
npx serve .
```

There is **no build step** and **no `npm install`** for the web app.
The two runtime libraries — `sql.js` (for SQLite persistence) and
`jsPDF` (for the PDF export) — load lazily from a CDN the first time
you save a playbook or print a wrist coach. Once cached, the app works
fully offline.

The optional MCP server in [`mcp/`](mcp/) is the one place a Node
toolchain enters the project, isolated to that folder. The web app does
not depend on it. See [AI agent integration](#ai-agent-integration-optional)
below.

### Hosting

Because the whole app is static, you can host it on anything that serves
files: GitHub Pages, Netlify, Cloudflare Pages, S3, even a USB stick on
a school's intranet. Just upload the contents of this folder.

---

## Usage

### Creating a playbook
- **File → New Playbook…** (or `Ctrl+Alt+N`). Pick a name and a player
  count: 5, 7, 9, or 11. The playbook is preloaded with the *Spread
  Right* formation and 14 default routes (Hook, Slant, Post, Corner,
  Fly, Shallow, etc.).
- **File → Save Playbook** (`Ctrl+S`) writes a `.pbc.sqlite` file. On
  Chrome/Edge this uses the File System Access API — subsequent saves
  go silently to the same file. On Safari/Firefox it falls back to a
  download.

### Creating plays
- **Play → New Play…** (`Ctrl+N`). Name it, optionally set a code name
  (shown on the field instead of the full name — useful for audibles),
  and pick a formation.
- On the field:
  - **Drag** a player to reposition (snaps to ½-yard grid).
  - **Right-click** a player to assign a route, option route,
    alternative route 1/2, motion, color, position, or jersey number.
    Submenus auto-flip to stay on screen.
  - **Double-click** a player to draw a custom route directly. Single
    clicks add straight segments; click-drag adds a Bezier curve where
    the drag's midpoint becomes the control point.
- **Play → Save Play As…** (`Ctrl+Shift+S`) snapshots the current
  player layout under a new name (use this to "rename" a play and then
  delete the original via **Delete → Plays**).
- **Play → Save Formation As…** strips routes/motions/numbers from the
  current play and adds it to the formation library.
- **Play → Edit Categories…** (`Ctrl+E`) tags the current play with
  one or more categories. The left sidebar can filter by category.
- **Ctrl+←** / **Ctrl+→** flips through plays in the playbook.

### Routes
- **Library routes** are reusable — assign them via right-click → Route.
  When you assign a library route to a player, the play stores its own
  *copy*, so editing the library entry later won't change saved plays.
- **Custom (named) routes** open the route editor. Tick "Save to route
  library" to make them reusable.
- **Custom (unnamed) routes** are one-shot — applied only to that
  player on that play.
- **Option routes** render as dotted lines, **alt 1** as orange, **alt
  2** as fuchsia. **Motions** are dashed and feed into the route's
  starting point.

### Wrist coach PDF
- **Playbook → Wrist Coach PDF…** (`Ctrl+Alt+W`).
- Move plays from the left list to the right list (double-click or
  arrow buttons). The right list's order is preserved in the PDF.
- Configure paper size (mm), columns × rows, and per-side margins.
  Set paper W or H to **0** to auto-fit to a number of plays at a fixed
  scale.
- Margins (if any) are drawn as a red dashed border to mark the area
  hidden by a wrist-coach sleeve.

### Storage format

Files are saved as `*.pbc.sqlite` — a standard SQLite 3 database. You
can inspect them with any SQLite client:

```bash
sqlite3 my-playbook.pbc.sqlite '.schema'
sqlite3 my-playbook.pbc.sqlite 'SELECT name, code_name FROM play'
```

The schema lives in [`src/storage/sqlite.js`](src/storage/sqlite.js).

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+N` | New playbook |
| `Ctrl+Alt+O` | Open playbook |
| `Ctrl+S` | Save playbook |
| `Ctrl+Alt+S` | Save playbook as |
| `Ctrl+Alt+W` | Export wrist coach PDF |
| `Ctrl+N` | New play |
| `Ctrl+O` | Open play |
| `Ctrl+Shift+S` | Save play as |
| `Ctrl+E` | Edit categories of current play |
| `Ctrl+→` / `Ctrl+←` | Next / previous play |

---

## Differences from the original Playbook Creator

This rewrite preserves the core mental model — yards, formations,
routes, motion, wrist coach — but the implementation and feature set
differ in some places. If you're coming from the desktop app, here's
what's the same and what's not.

### What's the same
- Coordinate system: yards, LOS-centered (0,0 = ball), 25-yd field
  width, +y = downfield. Routes mirror via "in/out factor" so "5 In"
  goes toward the middle for both sides.
- Field rendering: LOS at 70%, 5-yd line at 50%, 10-yd at 30%, 15-yd at
  10% of the canvas height — same proportions, same gray.
- Default playbook: 14 routes (Hook, Comeback, 5/10 In/Out, Slant,
  Shallow, Curl, Post, Corner, Fly, Seam, Fade) and the Spread Right
  formation, with 5/7/9/11-player variants — route values and
  positions match the original exactly. (One naming deviation: the 5p
  formation labels the slot at +5 yards as `SRR` (Slot Receiver Right)
  rather than the original's `HB`, since the player lines up on the
  LOS, not behind it. The position itself is unchanged.)
- Player counts: 5, 7, 9, or 11; fixed at playbook creation.
- Wrist-coach layout: configurable rows × cols × paper × margins, with
  the same auto-sizing math (`scale = 0.025`) when paper is left at 0.
- Categories, comments, alternative routes 1 & 2 (orange / fuchsia),
  option routes (dotted), pre-snap motion (dashed), arrowheads on the
  last segment.

### What's different (or improved)

| Area | Original (Qt/C++) | Web rewrite |
|---|---|---|
| **Install** | Native binary per OS, possible "unidentified developer" warnings | Just open the URL |
| **Storage** | Custom encrypted `.pbc` (AES-256-GCM via Botan + Boost.Serialization) | Plain SQLite (`*.pbc.sqlite`) — readable by any SQLite tool |
| **File access** | Native file dialogs | File System Access API on Chrome/Edge; download fallback elsewhere |
| **Auto-update** | Bundled Rust updater | Browser refreshes on deploy |
| **Submenus** | Could fall off the screen with many routes | Auto-flip & scroll to fit viewport |
| **Color picker** | Qt color dialog | Native browser color input |
| **Custom route drawing** | Click points; hold Ctrl while moving for a curve | Click for straight; click-and-drag for a Bezier (drag midpoint = control) |
| **PDF rendering** | Qt's QPainter direct to PDF | SVG rasterized at configurable DPI, embedded via jsPDF |

### What's deliberately not (yet) ported

The following features exist in the original but were dropped to keep
this rewrite small and focused:

- **Encrypted playbooks.** SQLite files are plain. If you need
  confidentiality, store them on encrypted disk or in a private cloud
  folder. Browser-side AES-GCM via WebCrypto could be added later.
- **Reading legacy `.pbc` files.** The original's
  Boost.Serialization-based binary format isn't decoded here. If you
  have an existing playbook to migrate, the simplest path is to recreate
  it (or contribute a one-shot `.pbc → .sqlite` converter).
- **Importing one playbook into another** with prefix/suffix renaming.
- **Mailing list / native auto-updater integration.**

If any of these matter to you, please open an issue.

---

## AI agent integration (optional)

This repo includes a small **Model Context Protocol (MCP) server** in
[`mcp/`](mcp/) that lets an AI agent (Claude Desktop, Claude Code, or
any MCP-compatible client) read and author plays in your `.pbc.sqlite`
files. It reuses the web app's model and storage layer directly, so the
agent sees exactly the same playbook the editor does.

Two scenarios it's designed for:

- **Authoring.** A coach asks the agent to compose new plays — *"Add
  three dagger concepts using the routes already in the library, out of
  Spread Right, and tag them as Pass."* — and the agent writes them
  back to the file.
- **Study.** A QB or position coach asks about plays — *"Walk me
  through Smash Right. What's the progression if the corner sits?"* —
  using the same server in `--read-only` mode.

The workflow:

1. Coach designs plays in the browser, hits **Save**.
2. Agent reads/edits the file via MCP.
3. Coach picks **File → Reload from Disk** to see the changes.

The MCP server is a Node process launched per-conversation by the MCP
client (no daemon, no Docker, no hosted backend — same offline-first
ethos as the rest of the project). It captures the file's mtime when
it loads and refuses to save if the file has been modified externally
since, so concurrent edits in the browser don't get clobbered silently.

Setup, the Claude Desktop config snippet, and the full tool surface
(read tools always available; write tools omitted in `--read-only`) live
in [`mcp/README.md`](mcp/README.md).

---

## Credits & Attribution

This project is a **derivative work** of
[Playbook Creator](https://github.com/obraunsdorf/playbook-creator),
copyright **© 2015 Oliver Braunsdorf**, originally released under the
**GNU General Public License v3+**.

> **Modification notice (per GPL v3 §5):** The original Qt5/C++
> Playbook Creator was rewritten as a browser-based HTML5/JavaScript
> application by Fabian Klebert in 2026. The rewrite reimplements the
> data model, rendering, and wrist-coach export from scratch in
> JavaScript, while reproducing the field proportions, default route
> library, formation defaults, and wrist-coach layout algorithm of the
> original. No source code from the original C++ project is included.
> This work is released under the same license (GPL v3 or later) as
> the original.

Everything that's good about the way this app *behaves* — the field
proportions, the route library, the in/out mirroring trick, the
formation defaults, the wrist-coach layout algorithm — was designed by
Oliver and ported here as faithfully as possible. The bugs are mine.

If Playbook Creator (the original or this web port) helps your team,
consider supporting Oliver's work upstream — see his
[README](https://github.com/obraunsdorf/playbook-creator) for details.

### Third-party libraries (loaded from CDN at runtime)

- **[sql.js](https://github.com/sql-js/sql.js/)** — WebAssembly build
  of SQLite. MIT.
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF generation.
  MIT.

These are not vendored; the app fetches them on first use.

### License

This rewrite inherits the original's license: **GPL v3+** (see
[`LICENSE`](LICENSE)). You are free to use, modify, and redistribute it
under those terms. If you build something on top of it, please
preserve the attribution to Oliver's project.

---

## Contributing

Issues and pull requests are welcome. The codebase is small and aims to
stay that way:

```
src/                          # browser app — pure HTML5, no build
├── main.js                   # boot, command dispatch, keyboard shortcuts
├── controller.js             # active-playbook + active-play state
├── data/defaultPlaybook.js   # 14 default routes, Spread Right formation
├── models/                   # Color, Path, Route, Motion, Player,
│                             # Formation, Category, Play, Playbook
├── render/                   # Config, yards↔pixels, field & play SVG
├── ui/                       # menubar, sidebars, dialogs, editors,
│                             # context menu, PDF export dialog
├── storage/                  # sql.js wrapper + File System Access
└── export/                   # jsPDF wrist-coach exporter

mcp/                          # optional MCP server (Node, isolated)
├── createServer.js           # factory: load file, register tools, save
├── server.js                 # stdio CLI entry
├── tools/{read,write}.js     # the agent-facing tool surface
├── describe.js               # LLM-friendly text rendering of plays
├── colors.js                 # named palette + parsing
└── test/                     # node --test, in-memory MCP transport
```

No bundler or transpiler. The browser app has no formal test suite —
syntax-check with `find src -name "*.js" -exec node --check {} \;` and
spot-check pure-JS models with `node --input-type=module -e ...`. The
MCP server has tests (model round-trip, describe snapshots, tool
surface, save/reload): `cd mcp && npm test`.
