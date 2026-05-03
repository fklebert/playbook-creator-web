// Formation: named arrangement of players (positions only, no routes).

import { Player } from "./player.js";

export class Formation {
  constructor(name, players = []) {
    this.name = name;
    this.players = players.slice();
  }

  clone() {
    return new Formation(this.name, this.players.map((p) => p.clone()));
  }
}
