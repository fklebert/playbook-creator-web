// Wrist coach PDF export. Ports pbcStorage::exportAsPDF.
//
// Strategy:
//   1) For each play, render an off-DOM <svg> at a chosen pixel resolution.
//   2) Rasterize that SVG to an HTMLCanvasElement via Image + drawImage.
//   3) Add the canvas PNG to the jsPDF document at the computed tile rect.
//   4) Wrap rows/columns and start a new page when full.

import { Config } from "../render/config.js";
import { PlayRenderer } from "../render/playRenderer.js";

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

let jspdfPromise = null;
async function loadJsPdf() {
  if (jspdfPromise) return jspdfPromise;
  jspdfPromise = (async () => {
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = JSPDF_URL;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Failed to load jsPDF"));
        document.head.appendChild(s);
      });
    }
    return window.jspdf.jsPDF;
  })();
  return jspdfPromise;
}

/**
 * @param {object} opts
 * @param {Play[]} opts.plays
 * @param {number} opts.paperWidthMm  - 0 = auto
 * @param {number} opts.paperHeightMm - 0 = auto
 * @param {number} opts.cols
 * @param {number} opts.rows
 * @param {number} opts.marginLeftMm
 * @param {number} opts.marginRightMm
 * @param {number} opts.marginTopMm
 * @param {number} opts.marginBottomMm
 * @param {number} [opts.dpi]   - rasterization DPI (default 200)
 */
export async function exportWristCoachPDF(opts) {
  const jsPDF = await loadJsPdf();

  const {
    plays, cols, rows,
    marginLeftMm, marginRightMm, marginTopMm, marginBottomMm,
    dpi = 200,
  } = opts;

  // Auto-size paper if either dimension is 0 (mirrors C++ scale 0.025)
  let paperW = opts.paperWidthMm;
  let paperH = opts.paperHeightMm;
  const autoScale = 0.025;
  if (!paperW || !paperH) {
    const cw = Config.canvasWidth;
    const ch = Config.canvasHeight;
    paperW = paperW || (cw * cols + marginLeftMm + marginRightMm) * autoScale;
    paperH = paperH || (ch * rows + marginTopMm + marginBottomMm) * autoScale;
  }

  // jsPDF accepts [w,h] in mm regardless of "orientation" when format is explicit.
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [paperW, paperH] });

  const usableW = paperW - marginLeftMm - marginRightMm;
  const usableH = paperH - marginTopMm - marginBottomMm;
  const tileW = usableW / cols;
  const tileH = usableH / rows;

  // Pixel target size for each rendered play
  const pxPerMm = dpi / 25.4;
  const tileWpx = Math.max(64, Math.round(tileW * pxPerMm));
  const tileHpx = Math.max(64, Math.round(tileH * pxPerMm));

  const oldCanvasW = Config.canvasWidth;
  const oldCanvasH = Config.canvasHeight;
  Config.setCanvasSize(tileWpx, tileHpx);

  try {
    let col = 0, row = 0, pageStarted = true;
    for (const play of plays) {
      if (!pageStarted) {
        // We're starting a new page
        pdf.addPage([paperW, paperH], "portrait");
        pageStarted = true;
      }

      const x = marginLeftMm + col * tileW;
      const y = marginTopMm + row * tileH;

      const r = new PlayRenderer({ shadow: false });
      const svgEl = r.render(play);
      const png = await rasterizeSvg(svgEl, tileWpx, tileHpx);
      pdf.addImage(png, "PNG", x, y, tileW, tileH);

      col++;
      if (col >= cols) {
        col = 0; row++;
        if (row >= rows) {
          row = 0;
          pageStarted = false; // next play -> new page
        }
      }
    }

    // Optional dashed border
    const anyMargin = marginLeftMm || marginRightMm || marginTopMm || marginBottomMm;
    if (anyMargin) {
      const borderInset = 2;
      pdf.setDrawColor(220, 50, 50);
      pdf.setLineDashPattern([2, 2], 0);
      pdf.rect(borderInset, borderInset, paperW - 2 * borderInset, paperH - 2 * borderInset);
      pdf.setLineDashPattern([], 0);
    }

    return pdf;
  } finally {
    Config.setCanvasSize(oldCanvasW, oldCanvasH);
  }
}

function rasterizeSvg(svgEl, wPx, hPx) {
  return new Promise((resolve, reject) => {
    const xml = new XMLSerializer().serializeToString(svgEl);
    // Ensure the SVG carries explicit width/height so the <img> sizes correctly.
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = wPx;
      canvas.height = hPx;
      const ctx = canvas.getContext("2d");
      // Plain white background (the field grass-color in CSS doesn't apply when raster-rendered)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, wPx, hPx);
      ctx.drawImage(img, 0, 0, wPx, hPx);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e || new Error("SVG rasterization failed"));
    };
    img.src = url;
  });
}
