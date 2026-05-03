// Ports pbcDefaultPlaybook.cpp.
// Default routes (14) and the "Spread Right" formation, with optional
// linemen/tight-end/tackles depending on player count (5, 7, 9, 11).

import { Playbook } from "../models/playbook.js";
import { Formation } from "../models/formation.js";
import { Player } from "../models/player.js";
import { Route } from "../models/route.js";
import { Path } from "../models/path.js";
import { Color } from "../models/color.js";

function R(name, ...paths) {
  return new Route(name, "", paths);
}

export function defaultRoutes() {
  return [
    R("Hook",
      new Path(0, 6),
      new Path(1, 5)),
    R("Comeback",
      new Path(0, 12),
      new Path(-2, 10)),
    R("5 In",
      new Path(0, 5),
      new Path(10, 5)),
    R("10 In",
      new Path(0, 10),
      new Path(10, 10)),
    R("5 Out",
      new Path(0, 5),
      new Path(-10, 5)),
    R("10 Out",
      new Path(0, 10),
      new Path(-10, 10)),
    R("Slant",
      new Path(0, 2),
      new Path(9, 5)),
    R("Shallow",
      new Path(13, 2, 2, 2),
      new Path(15, 2)),
    R("Curl",
      new Path(0, 12),
      new Path(2, 10)),
    R("Post",
      new Path(0, 7),
      new Path(7, 14)),
    R("Corner",
      new Path(0, 7),
      new Path(-7, 14)),
    R("Fly",
      new Path(-1, 12, -0.7, 3),
      new Path(-1, 14)),
    R("Seam",
      new Path(0.7, 12, -0.3, 3),
      new Path(1, 14)),
    R("Fade",
      new Path(-1, 5, -0.7, 1),
      new Path(-1, 7)),
  ];
}

function P(role, posX, posY) {
  return new Player({
    role,
    color: new Color(0, 0, 0),
    pos: { x: posX, y: posY },
  });
}

export function defaultSpreadRight(playerNumber) {
  const players = [
    P({ fullName: "Center", shortName: "C" }, 0, 0),
    P({ fullName: "Quarterback", shortName: "QB" }, 0, -5),
    P({ fullName: "Wide Receiver Left", shortName: "WRL" }, -10, 0),
    P({ fullName: "Wide Receiver Right", shortName: "WRR" }, 10, 0),
    P({ fullName: "Halfback", shortName: "HB" }, 5, 0),
  ];
  if (playerNumber >= 7) {
    players.push(P({ fullName: "Left Guard", shortName: "LG" }, -1, 0));
    players.push(P({ fullName: "Right Guard", shortName: "RG" }, 1, 0));
  }
  if (playerNumber >= 9) {
    players.push(P({ fullName: "Fullback", shortName: "FB" }, 0, -3));
    players.push(P({ fullName: "Tight End", shortName: "TE" }, 3, -1));
  }
  if (playerNumber === 11) {
    players.push(P({ fullName: "Left Tackle", shortName: "LT" }, -2, 0));
    players.push(P({ fullName: "Right Tackle", shortName: "RT" }, 2, 0));
  }
  return new Formation("Spread Right", players);
}

export function buildDefaultPlaybook(name = "Untitled Playbook", playerNumber = 5) {
  const pb = new Playbook({ name, playerNumber });
  for (const r of defaultRoutes()) pb.addRoute(r);
  pb.addFormation(defaultSpreadRight(playerNumber));
  return pb;
}
