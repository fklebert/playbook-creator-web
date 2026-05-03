// Player: a single offensive player on a play or formation.
// Position is in yards (LOS-centered, +x right, +y downfield).

import { Color } from "./color.js";
import { Route } from "./route.js";
import { Motion } from "./motion.js";

export class Player {
  constructor({
    role,            // {fullName, shortName}
    color = new Color(),
    pos = { x: 0, y: 0 },
    name = "",
    nr = 0,
    route = null,
    motion = null,
    optionRoutes = [],
    altRoute1 = null,
    altRoute2 = null,
  } = {}) {
    this.role = { fullName: role?.fullName || "", shortName: role?.shortName || "" };
    this.color = color instanceof Color ? color : new Color(color?.r, color?.g, color?.b);
    this.pos = { x: +pos.x, y: +pos.y };
    this.name = name;
    this.nr = nr | 0;
    this.route = route;
    this.motion = motion;
    this.optionRoutes = optionRoutes.slice();
    this.altRoute1 = altRoute1;
    this.altRoute2 = altRoute2;
  }

  clone() {
    return new Player({
      role: { ...this.role },
      color: this.color.clone(),
      pos: { ...this.pos },
      name: this.name,
      nr: this.nr,
      route: this.route ? this.route.clone() : null,
      motion: this.motion ? this.motion.clone() : null,
      optionRoutes: this.optionRoutes.map((r) => r.clone()),
      altRoute1: this.altRoute1 ? this.altRoute1.clone() : null,
      altRoute2: this.altRoute2 ? this.altRoute2.clone() : null,
    });
  }

  toJSON() {
    return {
      role: { ...this.role },
      color: { r: this.color.r, g: this.color.g, b: this.color.b },
      pos: { ...this.pos },
      name: this.name,
      nr: this.nr,
      route: this.route ? this.route.toJSON() : null,
      motion: this.motion ? this.motion.toJSON() : null,
      optionRoutes: this.optionRoutes.map((r) => r.toJSON()),
      altRoute1: this.altRoute1 ? this.altRoute1.toJSON() : null,
      altRoute2: this.altRoute2 ? this.altRoute2.toJSON() : null,
    };
  }

  static fromJSON(o) {
    return new Player({
      role: o.role,
      color: new Color(o.color?.r, o.color?.g, o.color?.b),
      pos: o.pos,
      name: o.name,
      nr: o.nr,
      route: Route.fromJSON(o.route),
      motion: Motion.fromJSON(o.motion),
      optionRoutes: (o.optionRoutes || []).map(Route.fromJSON).filter(Boolean),
      altRoute1: Route.fromJSON(o.altRoute1),
      altRoute2: Route.fromJSON(o.altRoute2),
    });
  }
}
