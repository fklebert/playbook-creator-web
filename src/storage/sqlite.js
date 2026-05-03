// SQLite persistence using sql.js (WASM build of SQLite).
// Loaded lazily from a CDN on first save/load. The file format is a
// standard SQLite database — readable by any sqlite3 CLI.

import { Playbook, SCHEMA_VERSION, APP_VERSION } from "../models/playbook.js";
import { Formation } from "../models/formation.js";
import { Player } from "../models/player.js";
import { Route } from "../models/route.js";
import { Path } from "../models/path.js";
import { Color } from "../models/color.js";
import { Play } from "../models/play.js";
import { Category } from "../models/category.js";
import { Motion } from "../models/motion.js";

const SQLJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";
const SQLJS_WASM_URL = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm";

let sqlPromise = null;
let customLoader = null;

// Inject a custom sql.js loader. The browser app leaves this alone and uses
// the default CDN <script>-tag flow. The Node MCP server installs sql.js from
// npm and registers a loader that just returns initSqlJs() — that way the same
// serialize/deserialize logic runs in both environments without `window`.
export function setSqlLoader(loader) {
  customLoader = loader;
  sqlPromise = null;
}

async function loadSqlJs() {
  if (sqlPromise) return sqlPromise;
  sqlPromise = (customLoader || defaultBrowserLoader)();
  return sqlPromise;
}

async function defaultBrowserLoader() {
  if (!globalThis.initSqlJs) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SQLJS_URL;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load sql.js"));
      document.head.appendChild(s);
    });
  }
  return globalThis.initSqlJs({ locateFile: () => SQLJS_WASM_URL });
}

const SCHEMA_SQL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE category (name TEXT PRIMARY KEY);
CREATE TABLE route (name TEXT PRIMARY KEY, code_name TEXT NOT NULL DEFAULT '');
CREATE TABLE route_path (
  route_name TEXT NOT NULL,
  ord INTEGER NOT NULL,
  end_x REAL NOT NULL, end_y REAL NOT NULL,
  ctrl_x REAL, ctrl_y REAL,
  PRIMARY KEY (route_name, ord)
);
CREATE TABLE formation (name TEXT PRIMARY KEY);
CREATE TABLE formation_player (
  formation_name TEXT NOT NULL,
  ord INTEGER NOT NULL,
  role_full TEXT NOT NULL, role_short TEXT NOT NULL,
  pos_x REAL NOT NULL, pos_y REAL NOT NULL,
  color_r INTEGER NOT NULL DEFAULT 0,
  color_g INTEGER NOT NULL DEFAULT 0,
  color_b INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (formation_name, ord)
);
CREATE TABLE play (
  name TEXT PRIMARY KEY,
  code_name TEXT NOT NULL DEFAULT '',
  formation_name TEXT,
  comment TEXT NOT NULL DEFAULT ''
);
CREATE TABLE play_category (
  play_name TEXT NOT NULL,
  category_name TEXT NOT NULL,
  PRIMARY KEY (play_name, category_name)
);
CREATE TABLE play_player (
  play_name TEXT NOT NULL,
  ord INTEGER NOT NULL,
  role_full TEXT NOT NULL, role_short TEXT NOT NULL,
  pos_x REAL NOT NULL, pos_y REAL NOT NULL,
  color_r INTEGER NOT NULL, color_g INTEGER NOT NULL, color_b INTEGER NOT NULL,
  player_name TEXT NOT NULL DEFAULT '',
  player_nr INTEGER NOT NULL DEFAULT 0,
  route_json TEXT,
  motion_json TEXT,
  alt1_json TEXT,
  alt2_json TEXT,
  options_json TEXT,
  PRIMARY KEY (play_name, ord)
);
`;

export async function serialize(playbook) {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();
  try {
    db.exec(SCHEMA_SQL);

    const setMeta = db.prepare("INSERT INTO meta(key,value) VALUES (?, ?)");
    setMeta.run(["schema_version", String(SCHEMA_VERSION)]);
    setMeta.run(["app_version", APP_VERSION]);
    setMeta.run(["name", playbook.name]);
    setMeta.run(["player_number", String(playbook.playerNumber)]);
    setMeta.free();

    const insCat = db.prepare("INSERT INTO category(name) VALUES (?)");
    for (const c of playbook.categories.values()) insCat.run([c.name]);
    insCat.free();

    const insRoute = db.prepare("INSERT INTO route(name, code_name) VALUES (?, ?)");
    const insRP = db.prepare(
      "INSERT INTO route_path(route_name, ord, end_x, end_y, ctrl_x, ctrl_y) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const r of playbook.routes.values()) {
      insRoute.run([r.name, r.codeName]);
      r.paths.forEach((p, i) => {
        insRP.run([r.name, i, p.end.x, p.end.y, p.control?.x ?? null, p.control?.y ?? null]);
      });
    }
    insRoute.free(); insRP.free();

    const insFor = db.prepare("INSERT INTO formation(name) VALUES (?)");
    const insFP = db.prepare(
      "INSERT INTO formation_player(formation_name, ord, role_full, role_short, pos_x, pos_y, color_r, color_g, color_b) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const f of playbook.formations.values()) {
      insFor.run([f.name]);
      f.players.forEach((p, i) => {
        insFP.run([f.name, i, p.role.fullName, p.role.shortName, p.pos.x, p.pos.y, p.color.r, p.color.g, p.color.b]);
      });
    }
    insFor.free(); insFP.free();

    const insPlay = db.prepare("INSERT INTO play(name, code_name, formation_name, comment) VALUES (?, ?, ?, ?)");
    const insPC = db.prepare("INSERT INTO play_category(play_name, category_name) VALUES (?, ?)");
    const insPP = db.prepare(
      "INSERT INTO play_player(play_name, ord, role_full, role_short, pos_x, pos_y, color_r, color_g, color_b, player_name, player_nr, route_json, motion_json, alt1_json, alt2_json, options_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const play of playbook.plays.values()) {
      insPlay.run([play.name, play.codeName, play.formationName || null, play.comment]);
      for (const cn of play.categoryNames) insPC.run([play.name, cn]);
      play.players.forEach((p, i) => {
        insPP.run([
          play.name, i,
          p.role.fullName, p.role.shortName,
          p.pos.x, p.pos.y,
          p.color.r, p.color.g, p.color.b,
          p.name, p.nr,
          p.route ? JSON.stringify(p.route.toJSON()) : null,
          p.motion ? JSON.stringify(p.motion.toJSON()) : null,
          p.altRoute1 ? JSON.stringify(p.altRoute1.toJSON()) : null,
          p.altRoute2 ? JSON.stringify(p.altRoute2.toJSON()) : null,
          p.optionRoutes.length ? JSON.stringify(p.optionRoutes.map((r) => r.toJSON())) : null,
        ]);
      });
    }
    insPlay.free(); insPC.free(); insPP.free();

    return db.export(); // Uint8Array
  } finally {
    db.close();
  }
}

export async function deserialize(bytes) {
  const SQL = await loadSqlJs();
  const db = new SQL.Database(bytes);
  try {
    const metaMap = new Map();
    const metaRes = db.exec("SELECT key, value FROM meta");
    if (metaRes.length) {
      for (const row of metaRes[0].values) metaMap.set(row[0], row[1]);
    }

    const playerNumber = parseInt(metaMap.get("player_number") || "5", 10);
    const pb = new Playbook({
      name: metaMap.get("name") || "Untitled",
      playerNumber,
      version: metaMap.get("app_version") || APP_VERSION,
    });

    // Categories
    const catRes = db.exec("SELECT name FROM category");
    if (catRes.length) {
      for (const r of catRes[0].values) pb.addCategory(new Category(r[0]));
    }

    // Routes
    const routeRes = db.exec("SELECT name, code_name FROM route");
    const routePathStmt = db.prepare("SELECT ord, end_x, end_y, ctrl_x, ctrl_y FROM route_path WHERE route_name = ? ORDER BY ord");
    if (routeRes.length) {
      for (const [name, codeName] of routeRes[0].values) {
        const paths = [];
        routePathStmt.bind([name]);
        while (routePathStmt.step()) {
          const row = routePathStmt.get();
          paths.push(new Path(row[1], row[2], row[3], row[4]));
        }
        routePathStmt.reset();
        pb.addRoute(new Route(name, codeName, paths));
      }
    }
    routePathStmt.free();

    // Formations
    const fRes = db.exec("SELECT name FROM formation");
    const fpStmt = db.prepare("SELECT ord, role_full, role_short, pos_x, pos_y, color_r, color_g, color_b FROM formation_player WHERE formation_name = ? ORDER BY ord");
    if (fRes.length) {
      for (const [name] of fRes[0].values) {
        const players = [];
        fpStmt.bind([name]);
        while (fpStmt.step()) {
          const row = fpStmt.get();
          players.push(new Player({
            role: { fullName: row[1], shortName: row[2] },
            pos: { x: row[3], y: row[4] },
            color: new Color(row[5], row[6], row[7]),
          }));
        }
        fpStmt.reset();
        pb.addFormation(new Formation(name, players));
      }
    }
    fpStmt.free();

    // Plays
    const playRes = db.exec("SELECT name, code_name, formation_name, comment FROM play");
    const ppStmt = db.prepare("SELECT ord, role_full, role_short, pos_x, pos_y, color_r, color_g, color_b, player_name, player_nr, route_json, motion_json, alt1_json, alt2_json, options_json FROM play_player WHERE play_name = ? ORDER BY ord");
    const pcStmt = db.prepare("SELECT category_name FROM play_category WHERE play_name = ?");
    if (playRes.length) {
      for (const [name, codeName, formationName, comment] of playRes[0].values) {
        const players = [];
        ppStmt.bind([name]);
        while (ppStmt.step()) {
          const row = ppStmt.get();
          players.push(new Player({
            role: { fullName: row[1], shortName: row[2] },
            pos: { x: row[3], y: row[4] },
            color: new Color(row[5], row[6], row[7]),
            name: row[8] || "",
            nr: row[9] || 0,
            route: row[10] ? Route.fromJSON(JSON.parse(row[10])) : null,
            motion: row[11] ? Motion.fromJSON(JSON.parse(row[11])) : null,
            altRoute1: row[12] ? Route.fromJSON(JSON.parse(row[12])) : null,
            altRoute2: row[13] ? Route.fromJSON(JSON.parse(row[13])) : null,
            optionRoutes: row[14] ? JSON.parse(row[14]).map(Route.fromJSON).filter(Boolean) : [],
          }));
        }
        ppStmt.reset();

        const cats = [];
        pcStmt.bind([name]);
        while (pcStmt.step()) cats.push(pcStmt.get()[0]);
        pcStmt.reset();

        pb.addPlay(new Play({
          name, codeName: codeName || "",
          formationName: formationName || "",
          comment: comment || "",
          players,
          categoryNames: cats,
        }));
      }
    }
    ppStmt.free(); pcStmt.free();

    return pb;
  } finally {
    db.close();
  }
}
