// Two-pane play picker + paper/grid/margin form for the wrist-coach PDF export.

import { dispose, makeDialog } from "./dialogs.js";

const DEFAULTS = {
  paperWidth: 0,
  paperHeight: 0,
  cols: 8,
  rows: 5,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  marginBottom: 0,
};

export function openPdfExportDialog({ availablePlays }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "pdf-dialog-wrap";

    // Two-pane play selector
    const grid = document.createElement("div");
    grid.className = "pdf-grid";

    const leftBox = document.createElement("div");
    leftBox.className = "pdf-list-box";
    const leftTitle = document.createElement("div");
    leftTitle.className = "pdf-list-title";
    leftTitle.textContent = "Available";
    leftBox.appendChild(leftTitle);
    const leftList = document.createElement("ul");
    leftList.className = "pdf-list";
    leftBox.appendChild(leftList);

    const arrows = document.createElement("div");
    arrows.className = "pdf-arrow-buttons";
    const btnRight = button("→");
    const btnLeft = button("←");
    const btnUp = button("↑");
    const btnDown = button("↓");
    arrows.appendChild(btnRight);
    arrows.appendChild(btnLeft);
    arrows.appendChild(btnUp);
    arrows.appendChild(btnDown);

    const rightBox = document.createElement("div");
    rightBox.className = "pdf-list-box";
    const rightTitle = document.createElement("div");
    rightTitle.className = "pdf-list-title";
    rightTitle.textContent = "Selected (in order)";
    rightBox.appendChild(rightTitle);
    const rightList = document.createElement("ul");
    rightList.className = "pdf-list";
    rightBox.appendChild(rightList);

    grid.appendChild(leftBox);
    grid.appendChild(arrows);
    grid.appendChild(rightBox);
    wrap.appendChild(grid);

    /** @type {string[]} */
    const available = availablePlays.map((p) => p.name).sort();
    /** @type {string[]} */
    const selected = [];
    let leftActive = null;
    let rightActive = null;

    function refreshLists() {
      leftList.innerHTML = "";
      for (const name of available) {
        const li = document.createElement("li");
        li.textContent = name;
        if (name === leftActive) li.classList.add("selected");
        li.addEventListener("click", () => { leftActive = name; refreshLists(); });
        li.addEventListener("dblclick", () => moveRight(name));
        leftList.appendChild(li);
      }
      rightList.innerHTML = "";
      for (const name of selected) {
        const li = document.createElement("li");
        li.textContent = name;
        if (name === rightActive) li.classList.add("selected");
        li.addEventListener("click", () => { rightActive = name; refreshLists(); });
        li.addEventListener("dblclick", () => moveLeft(name));
        rightList.appendChild(li);
      }
    }
    function moveRight(name) {
      const i = available.indexOf(name); if (i < 0) return;
      available.splice(i, 1);
      selected.push(name);
      leftActive = null;
      refreshLists();
    }
    function moveLeft(name) {
      const i = selected.indexOf(name); if (i < 0) return;
      selected.splice(i, 1);
      available.push(name);
      available.sort();
      rightActive = null;
      refreshLists();
    }
    btnRight.addEventListener("click", (ev) => { ev.preventDefault(); if (leftActive) moveRight(leftActive); });
    btnLeft.addEventListener("click", (ev) => { ev.preventDefault(); if (rightActive) moveLeft(rightActive); });
    btnUp.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!rightActive) return;
      const i = selected.indexOf(rightActive); if (i <= 0) return;
      [selected[i - 1], selected[i]] = [selected[i], selected[i - 1]];
      refreshLists();
    });
    btnDown.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!rightActive) return;
      const i = selected.indexOf(rightActive); if (i < 0 || i >= selected.length - 1) return;
      [selected[i + 1], selected[i]] = [selected[i], selected[i + 1]];
      refreshLists();
    });

    refreshLists();

    // Form: paper size + grid + margins
    const form = document.createElement("div");
    form.className = "pdf-form";
    const fields = {
      paperWidth: numField(form, "Paper width (mm, 0=auto)", DEFAULTS.paperWidth),
      paperHeight: numField(form, "Paper height (mm, 0=auto)", DEFAULTS.paperHeight),
      cols: numField(form, "Columns", DEFAULTS.cols, 1),
      rows: numField(form, "Rows", DEFAULTS.rows, 1),
      marginLeft: numField(form, "Margin L (mm)", DEFAULTS.marginLeft),
      marginRight: numField(form, "Margin R (mm)", DEFAULTS.marginRight),
      marginTop: numField(form, "Margin T (mm)", DEFAULTS.marginTop),
      marginBottom: numField(form, "Margin B (mm)", DEFAULTS.marginBottom),
    };
    wrap.appendChild(form);

    const { dlg, okBtn, cancelBtn } = makeDialog({
      title: "Export Wrist Coach PDF",
      body: wrap,
      primaryLabel: "Export",
      extraClass: "pdf-dialog",
    });

    okBtn.addEventListener("click", () => {
      if (!selected.length) {
        alert("Please select at least one play.");
        return;
      }
      const out = {
        playNames: selected.slice(),
        paperWidthMm: Math.max(0, +fields.paperWidth.value || 0),
        paperHeightMm: Math.max(0, +fields.paperHeight.value || 0),
        cols: Math.max(1, +fields.cols.value || 1),
        rows: Math.max(1, +fields.rows.value || 1),
        marginLeftMm: Math.max(0, +fields.marginLeft.value || 0),
        marginRightMm: Math.max(0, +fields.marginRight.value || 0),
        marginTopMm: Math.max(0, +fields.marginTop.value || 0),
        marginBottomMm: Math.max(0, +fields.marginBottom.value || 0),
      };
      resolve(out);
      dispose(dlg);
    });
    cancelBtn.addEventListener("click", () => { resolve(null); dispose(dlg); });
    dlg.addEventListener("cancel", () => { resolve(null); dispose(dlg); });
    dlg.showModal();
  });
}

function numField(parent, labelText, value, min = 0) {
  const lbl = document.createElement("label");
  lbl.textContent = labelText;
  const inp = document.createElement("input");
  inp.type = "number";
  inp.min = String(min);
  inp.value = String(value);
  lbl.appendChild(inp);
  parent.appendChild(lbl);
  return inp;
}

function button(label) {
  const b = document.createElement("button");
  b.textContent = label;
  return b;
}
