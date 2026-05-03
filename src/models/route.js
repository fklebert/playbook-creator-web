// Route: ordered list of Paths, with name + codeName.

import { Path } from "./path.js";

export class Route {
  constructor(name = "", codeName = "", paths = []) {
    this.name = name;
    this.codeName = codeName;
    this.paths = paths.slice();
  }

  clone() {
    return new Route(this.name, this.codeName, this.paths.map((p) => p.clone()));
  }

  toJSON() {
    return {
      name: this.name,
      codeName: this.codeName,
      paths: this.paths.map((p) => p.toJSON()),
    };
  }

  static fromJSON(o) {
    if (!o) return null;
    return new Route(
      o.name || "",
      o.codeName || "",
      (o.paths || []).map(Path.fromJSON),
    );
  }
}
