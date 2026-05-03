// Play: a single play. Owns its own copy of players (with assigned routes
// and motions). The formationName is informational — editing the source
// formation does not retroactively change saved plays. Categories are
// referenced by name.

import { Player } from "./player.js";

export class Play {
  constructor({
    name = "",
    codeName = "",
    formationName = "",
    players = [],
    categoryNames = [],
    comment = "",
  } = {}) {
    this.name = name;
    this.codeName = codeName;
    this.formationName = formationName;
    this.players = players.slice();
    this.categoryNames = new Set(categoryNames);
    this.comment = comment;
  }

  clone() {
    return new Play({
      name: this.name,
      codeName: this.codeName,
      formationName: this.formationName,
      players: this.players.map((p) => p.clone()),
      categoryNames: [...this.categoryNames],
      comment: this.comment,
    });
  }

  // Build a fresh play from a formation: copy each player's position/color/role,
  // no routes assigned yet.
  static fromFormation(name, codeName, formation) {
    return new Play({
      name,
      codeName,
      formationName: formation.name,
      players: formation.players.map((p) => p.clone()),
    });
  }
}
