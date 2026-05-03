// Color: ports PBCColor.
// Plain RGB triple. Static contrastColor() picks black or white text
// for legibility on top of this color (luminance > 0.5 → black).

export class Color {
  constructor(r = 0, g = 0, b = 0) {
    this.r = r | 0;
    this.g = g | 0;
    this.b = b | 0;
  }

  toCss() {
    return `rgb(${this.r}, ${this.g}, ${this.b})`;
  }

  toHex() {
    const h = (n) => n.toString(16).padStart(2, "0");
    return `#${h(this.r)}${h(this.g)}${h(this.b)}`;
  }

  static fromHex(hex) {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return new Color();
    const v = parseInt(m[1], 16);
    return new Color((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
  }

  clone() { return new Color(this.r, this.g, this.b); }

  // Mirrors PBCColor::contrastColor — luminance threshold 0.5
  static contrastColor(c) {
    const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    return lum > 0.5 ? new Color(0, 0, 0) : new Color(255, 255, 255);
  }
}
