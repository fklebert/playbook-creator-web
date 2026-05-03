// Path: a single segment of a route or motion.
// endpoint = target (yards, relative to base point)
// control = optional Bezier control point (null = straight line)

export class Path {
  constructor(endX, endY, ctrlX = null, ctrlY = null) {
    this.end = { x: +endX, y: +endY };
    if (ctrlX === null || ctrlX === undefined ||
        ctrlY === null || ctrlY === undefined) {
      this.control = null;
    } else {
      this.control = { x: +ctrlX, y: +ctrlY };
    }
  }

  clone() {
    return new Path(
      this.end.x, this.end.y,
      this.control ? this.control.x : null,
      this.control ? this.control.y : null,
    );
  }

  toJSON() {
    return {
      end: { ...this.end },
      control: this.control ? { ...this.control } : null,
    };
  }

  static fromJSON(o) {
    return new Path(
      o.end.x, o.end.y,
      o.control ? o.control.x : null,
      o.control ? o.control.y : null,
    );
  }
}
