// Playbook: top-level container. Maps from name → object for each kind.

import { Formation } from "./formation.js";
import { Route } from "./route.js";
import { Play } from "./play.js";
import { Category } from "./category.js";

export const PLAYER_NUMBERS = [5, 7, 9, 11];
export const APP_VERSION = "0.1.0";
export const SCHEMA_VERSION = 1;

export class Playbook {
  constructor({
    name = "Untitled Playbook",
    playerNumber = 5,
    version = APP_VERSION,
  } = {}) {
    this.name = name;
    this.playerNumber = playerNumber;
    this.version = version;
    /** @type {Map<string, Formation>} */ this.formations = new Map();
    /** @type {Map<string, Route>} */ this.routes = new Map();
    /** @type {Map<string, Play>} */ this.plays = new Map();
    /** @type {Map<string, Category>} */ this.categories = new Map();
  }

  // ---- generic helpers ----------------------------------------
  formationNames() { return [...this.formations.keys()].sort(); }
  routeNames() { return [...this.routes.keys()].sort(); }
  playNames() { return [...this.plays.keys()].sort(); }
  categoryNames() { return [...this.categories.keys()].sort(); }

  // ---- formations ---------------------------------------------
  addFormation(formation, { overwrite = false } = {}) {
    if (!overwrite && this.formations.has(formation.name)) return false;
    this.formations.set(formation.name, formation);
    return true;
  }
  getFormation(name) { return this.formations.get(name) || null; }
  deleteFormation(name) { return this.formations.delete(name); }

  // ---- routes -------------------------------------------------
  addRoute(route, { overwrite = false } = {}) {
    if (!overwrite && this.routes.has(route.name)) return false;
    this.routes.set(route.name, route);
    return true;
  }
  getRoute(name) { return this.routes.get(name) || null; }
  deleteRoute(name) { return this.routes.delete(name); }

  // ---- plays --------------------------------------------------
  addPlay(play, { overwrite = false } = {}) {
    if (!overwrite && this.plays.has(play.name)) return false;
    this.plays.set(play.name, play);
    // sync category memberships
    for (const cat of this.categories.values()) {
      if (play.categoryNames.has(cat.name)) cat.addPlay(play.name);
      else cat.removePlay(play.name);
    }
    return true;
  }
  getPlay(name) { return this.plays.get(name) || null; }
  deletePlay(name) {
    const removed = this.plays.delete(name);
    if (removed) {
      for (const cat of this.categories.values()) cat.removePlay(name);
    }
    return removed;
  }
  renamePlay(oldName, newName) {
    if (!this.plays.has(oldName) || this.plays.has(newName)) return false;
    const play = this.plays.get(oldName);
    play.name = newName;
    this.plays.delete(oldName);
    this.plays.set(newName, play);
    for (const cat of this.categories.values()) {
      if (cat.playNames.has(oldName)) {
        cat.removePlay(oldName);
        cat.addPlay(newName);
      }
    }
    return true;
  }

  // ---- categories ---------------------------------------------
  addCategory(cat, { overwrite = false } = {}) {
    if (!overwrite && this.categories.has(cat.name)) return false;
    this.categories.set(cat.name, cat);
    return true;
  }
  getCategory(name) { return this.categories.get(name) || null; }
  deleteCategory(name) {
    const removed = this.categories.delete(name);
    if (removed) {
      for (const play of this.plays.values()) play.categoryNames.delete(name);
    }
    return removed;
  }
}
