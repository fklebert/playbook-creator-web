// Ports pbcConfig.h. All values match the C++ defaults.

export const Config = {
  // canvas dimensions in pixels (display units of the SVG / viewBox).
  // CSS scales the SVG to fit the canvas area.
  canvasWidth: 500,
  canvasHeight: 500,

  // field model
  fieldWidth: 25,           // yards (horizontal extent)
  losYFactor: 0.7,          // LOS at 70% of canvas height
  fiveYdYFactor: 0.5,       // 5-yd line at 50%

  // colors (rgb)
  losColor: "rgb(128,128,128)",
  fiveYdColor: "rgb(128,128,128)",
  ballColor: "rgb(139,69,19)",
  playNameColor: "rgb(128,128,128)",

  // widths in yards
  losWidthYd: 0.3,
  fiveYdWidthYd: 0.15,
  playerWidthYd: 1,
  routeWidthYd: 0.4,
  ballWidthYd: 1,
  playNameSizeYd: 1.5,

  // misc
  playNameFont: "Helvetica, Arial, sans-serif",
  printPlayName: true,
  playerShadow: true,
  playerShadowRadius: 6,    // SVG drop-shadow blur stdDev
  playerShadowOffsetFactor: 0.25,

  // setCanvasSize keeps width as fieldWidth × ydInPixel, like C++
  setCanvasSize(w, h) {
    this.canvasHeight = h;
    this.canvasWidth = this.fieldWidth * this.ydInPixel();
  },

  // 1 yard in pixels — derived from canvas height and the LOS/5-yd factor gap
  ydInPixel() {
    return (this.losYFactor - this.fiveYdYFactor) * this.canvasHeight / 5.0;
  },

  losY() { return this.losYFactor * this.canvasHeight; },
  fiveYdY() { return this.fiveYdYFactor * this.canvasHeight; },
  tenYdY() {
    return (this.losYFactor - (this.losYFactor - this.fiveYdYFactor) * 2.0) * this.canvasHeight;
  },
  fifteenYdY() {
    return (this.losYFactor - (this.losYFactor - this.fiveYdYFactor) * 3.0) * this.canvasHeight;
  },

  losWidth() { return this.losWidthYd * this.ydInPixel(); },
  fiveYdWidth() { return this.fiveYdWidthYd * this.ydInPixel(); },
  playerWidth() { return this.playerWidthYd * this.ydInPixel(); },
  routeWidth() { return this.routeWidthYd * this.ydInPixel(); },
  ballWidth() { return this.ballWidthYd * this.ydInPixel(); },
  playNameSize() { return this.playNameSizeYd * this.ydInPixel(); },
  playerShadowOffset() { return this.playerShadowOffsetFactor * this.playerWidth(); },
};

// Initialize derived width once
Config.setCanvasSize(Config.canvasWidth, Config.canvasHeight);
