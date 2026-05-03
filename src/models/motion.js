// Motion: pre-snap movement. Like a Route, but with an explicit endPoint
// (the location the player ends up at after motion; routes start from there).

import { Path } from "./path.js";

export class Motion {
  constructor(paths = [], endPoint = { x: 0, y: 0 }) {
    this.paths = paths.slice();
    this.endPoint = { ...endPoint };
  }

  clone() {
    return new Motion(this.paths.map((p) => p.clone()), { ...this.endPoint });
  }

  toJSON() {
    return {
      paths: this.paths.map((p) => p.toJSON()),
      endPoint: { ...this.endPoint },
    };
  }

  static fromJSON(o) {
    if (!o) return null;
    return new Motion(
      (o.paths || []).map(Path.fromJSON),
      o.endPoint || { x: 0, y: 0 },
    );
  }
}
