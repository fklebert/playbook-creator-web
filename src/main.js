// App entry: wires controller, UI, storage, and PDF export.

import { controller } from "./controller.js";
import { buildDefaultPlaybook } from "./data/defaultPlaybook.js";
import { Play } from "./models/play.js";
import { Category } from "./models/category.js";
import { Config } from "./render/config.js";
import { PlayEditor } from "./ui/playEditor.js";
import { PlayList } from "./ui/playList.js";
import { Inspector } from "./ui/inspector.js";
import { buildMenubar } from "./ui/menubar.js";
import { formDialog, listSelectDialog, checklistDialog, alertDialog, confirmDialog } from "./ui/dialogs.js";
import { openFile, saveFile, reloadFile } from "./storage/fileAccess.js";
import { serialize, deserialize } from "./storage/sqlite.js";
import { openPdfExportDialog } from "./ui/pdfExportDialog.js";
import { exportWristCoachPDF } from "./export/pdfWristCoach.js";

// Boot ------------------------------------------------------------------
const editor = new PlayEditor(document.getElementById("canvas-host"));
const list = new PlayList();
const inspector = new Inspector();

// Initial empty playbook so the user can immediately drop in a play.
controller.setPlaybook(buildDefaultPlaybook("Untitled Playbook", 5));

// Status bar shows dirty state
const statusEl = document.getElementById("canvas-status");
function refreshStatus() {
  const pb = controller.playbook;
  if (!pb) { statusEl.textContent = ""; return; }
  statusEl.textContent = `${pb.name}${controller.dirty ? " • unsaved changes" : ""}`;
}
controller.on("playbookChanged", refreshStatus);
controller.on("playChanged", refreshStatus);
controller.on("dirtyChanged", refreshStatus);
refreshStatus();

// Title (in menubar)
const menubarHandle = buildMenubar(
  document.getElementById("menubar"),
  buildMenus(),
  () => {
    const pb = controller.playbook;
    return pb ? `Playbook Creator — ${pb.name}${controller.dirty ? " *" : ""}` : "Playbook Creator";
  },
);
controller.on("playbookChanged", () => menubarHandle.updateTitle());
controller.on("dirtyChanged", () => menubarHandle.updateTitle());

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  const alt = e.altKey;
  const shift = e.shiftKey;
  const key = e.key.toLowerCase();
  if (ctrl && alt && key === "n") { e.preventDefault(); cmdNewPlaybook(); }
  else if (ctrl && alt && key === "o") { e.preventDefault(); cmdOpenPlaybook(); }
  else if (ctrl && alt && key === "s") { e.preventDefault(); cmdSavePlaybookAs(); }
  else if (ctrl && alt && key === "w") { e.preventDefault(); cmdExportPdf(); }
  else if (ctrl && shift && key === "s") { e.preventDefault(); cmdSavePlayAs(); }
  else if (ctrl && key === "n") { e.preventDefault(); cmdNewPlay(); }
  else if (ctrl && key === "o") { e.preventDefault(); cmdOpenPlay(); }
  else if (ctrl && key === "s") { e.preventDefault(); cmdSavePlaybook(); }
  else if (ctrl && key === "e") { e.preventDefault(); cmdEditCategories(); }
  else if (ctrl && key === "arrowright") { e.preventDefault(); navigatePlay(+1); }
  else if (ctrl && key === "arrowleft") { e.preventDefault(); navigatePlay(-1); }
});

// ---- Menus ------------------------------------------------------------

function buildMenus() {
  return [
    { label: "File", items: [
      { label: "New Playbook…", shortcut: "Ctrl+Alt+N", onClick: cmdNewPlaybook },
      { label: "Open Playbook…", shortcut: "Ctrl+Alt+O", onClick: cmdOpenPlaybook },
      { label: "Save Playbook", shortcut: "Ctrl+S", onClick: cmdSavePlaybook },
      { label: "Save Playbook As…", shortcut: "Ctrl+Alt+S", onClick: cmdSavePlaybookAs },
      { separator: true },
      { label: "Reload from Disk", onClick: cmdReloadFromDisk },
    ]},
    { label: "Play", items: [
      { label: "New Play…", shortcut: "Ctrl+N", onClick: cmdNewPlay },
      { label: "Open Play…", shortcut: "Ctrl+O", onClick: cmdOpenPlay },
      { label: "Save Play As…", shortcut: "Ctrl+Shift+S", onClick: cmdSavePlayAs },
      { separator: true },
      { label: "Save Formation As…", onClick: cmdSaveFormationAs },
      { label: "Edit Categories…", shortcut: "Ctrl+E", onClick: cmdEditCategories },
      { label: "Edit Comment…", onClick: cmdEditComment },
      { separator: true },
      { label: "Previous Play", shortcut: "Ctrl+←", onClick: () => navigatePlay(-1) },
      { label: "Next Play", shortcut: "Ctrl+→", onClick: () => navigatePlay(+1) },
    ]},
    { label: "Playbook", items: [
      { label: "Wrist Coach PDF…", shortcut: "Ctrl+Alt+W", onClick: cmdExportPdf },
    ]},
    { label: "Delete", items: [
      { label: "Delete Plays…", onClick: () => cmdDelete("plays") },
      { label: "Delete Routes…", onClick: () => cmdDelete("routes") },
      { label: "Delete Formations…", onClick: () => cmdDelete("formations") },
      { label: "Delete Categories…", onClick: () => cmdDelete("categories") },
    ]},
    { label: "Help", items: [
      { label: "About…", onClick: cmdAbout },
    ]},
  ];
}

// ---- Command handlers -------------------------------------------------

async function cmdNewPlaybook() {
  if (controller.dirty) {
    if (!await confirmDialog("Discard unsaved changes?", "Confirm")) return;
  }
  const out = await formDialog({
    title: "New Playbook",
    fields: [
      { key: "name", label: "Playbook name", value: "Untitled Playbook", required: true },
      { key: "playerNumber", label: "Player count", type: "select", value: "5",
        options: [{ value: "5" }, { value: "7" }, { value: "9" }, { value: "11" }] },
    ],
  });
  if (!out) return;
  const pb = buildDefaultPlaybook(out.name, parseInt(out.playerNumber, 10));
  controller.setPlaybook(pb);
}

async function cmdOpenPlaybook() {
  if (controller.dirty) {
    if (!await confirmDialog("Discard unsaved changes?", "Confirm")) return;
  }
  const f = await openFile();
  if (!f) return;
  try {
    const pb = await deserialize(f.bytes);
    controller.setPlaybook(pb, { fileHandle: f.fileHandle, fileName: f.fileName });
  } catch (e) {
    console.error(e);
    await alertDialog(`Failed to open: ${e.message || e}`, "Open Playbook");
  }
}

async function cmdSavePlaybook() {
  const pb = controller.playbook;
  if (!pb) return;
  try {
    const bytes = await serialize(pb);
    const handle = await saveFile(bytes, controller.fileName || `${pb.name}.pbc.sqlite`, controller.fileHandle);
    if (handle !== undefined) controller.fileHandle = handle || controller.fileHandle;
    controller.markClean();
  } catch (e) {
    console.error(e);
    await alertDialog(`Failed to save: ${e.message || e}`, "Save Playbook");
  }
}

async function cmdSavePlaybookAs() {
  const pb = controller.playbook;
  if (!pb) return;
  try {
    const bytes = await serialize(pb);
    const handle = await saveFile(bytes, `${pb.name}.pbc.sqlite`, null);
    controller.fileHandle = handle || controller.fileHandle;
    controller.markClean();
  } catch (e) {
    console.error(e);
    await alertDialog(`Failed to save: ${e.message || e}`, "Save Playbook As");
  }
}

async function cmdReloadFromDisk() {
  if (controller.dirty) {
    if (!await confirmDialog("Discard unsaved changes and reload from disk?", "Reload")) return;
  }
  // If we have an FSA handle, re-read in place. Otherwise fall back to the
  // file picker — Safari/Firefox can't persistently re-open the same file.
  let f = null;
  if (controller.fileHandle) {
    try {
      f = await reloadFile(controller.fileHandle);
    } catch (e) {
      console.error(e);
      await alertDialog(`Couldn't read file: ${e.message || e}`, "Reload");
      return;
    }
  } else {
    f = await openFile();
  }
  if (!f) return;
  try {
    const pb = await deserialize(f.bytes);
    controller.setPlaybook(pb, { fileHandle: f.fileHandle, fileName: f.fileName });
  } catch (e) {
    console.error(e);
    await alertDialog(`Failed to reload: ${e.message || e}`, "Reload");
  }
}

async function cmdNewPlay() {
  const pb = controller.playbook;
  if (!pb) return;
  if (pb.formations.size === 0) { await alertDialog("Add a formation first."); return; }
  const out = await formDialog({
    title: "New Play",
    fields: [
      { key: "name", label: "Play name", required: true },
      { key: "codeName", label: "Code name (optional)" },
      { key: "formation", label: "Formation", type: "select",
        options: pb.formationNames().map((n) => ({ value: n })),
        value: pb.formationNames()[0],
      },
    ],
  });
  if (!out) return;
  if (!out.name.trim()) return;
  if (pb.plays.has(out.name)) { await alertDialog("A play with this name exists already."); return; }
  const formation = pb.getFormation(out.formation);
  const play = Play.fromFormation(out.name.trim(), out.codeName.trim(), formation);
  pb.addPlay(play);
  controller.setActivePlay(play);
  controller.notifyPlayEdited();
}

async function cmdOpenPlay() {
  const pb = controller.playbook;
  if (!pb) return;
  const sel = await listSelectDialog({
    title: "Open Play",
    items: pb.playNames().map((n) => ({ value: n, label: n })),
    primaryLabel: "Open",
  });
  if (!sel || !sel.length) return;
  const play = pb.getPlay(sel[0]);
  if (play) controller.setActivePlay(play);
}

async function cmdSavePlayAs() {
  const pb = controller.playbook;
  const cur = controller.activePlay;
  if (!cur) return;
  const out = await formDialog({
    title: "Save Play As",
    fields: [
      { key: "name", label: "New name", value: cur.name, required: true },
      { key: "codeName", label: "Code name", value: cur.codeName },
    ],
  });
  if (!out) return;
  if (!out.name.trim()) return;
  if (pb.plays.has(out.name)) {
    if (!await confirmDialog(`Overwrite existing "${out.name}"?`)) return;
  }
  const copy = cur.clone();
  copy.name = out.name.trim();
  copy.codeName = out.codeName.trim();
  pb.addPlay(copy, { overwrite: true });
  controller.setActivePlay(copy);
  controller.markDirty();
}

async function cmdSaveFormationAs() {
  const pb = controller.playbook;
  const cur = controller.activePlay;
  if (!cur) return;
  const out = await formDialog({
    title: "Save Formation As",
    fields: [{ key: "name", label: "Formation name", required: true }],
  });
  if (!out || !out.name.trim()) return;
  const name = out.name.trim();
  if (pb.formations.has(name)) {
    if (!await confirmDialog(`Overwrite formation "${name}"?`)) return;
  }
  const { Formation } = await import("./models/formation.js");
  const players = cur.players.map((p) => {
    const c = p.clone();
    c.route = c.motion = c.altRoute1 = c.altRoute2 = null;
    c.optionRoutes = [];
    c.nr = 0;
    c.name = "";
    return c;
  });
  pb.addFormation(new Formation(name, players), { overwrite: true });
  controller.markDirty();
}

async function cmdEditCategories() {
  const pb = controller.playbook;
  const play = controller.activePlay;
  if (!pb || !play) return;
  const items = pb.categoryNames().map((n) => ({ value: n, label: n }));
  const result = await checklistDialog({
    title: "Categories",
    items,
    initialChecked: [...play.categoryNames],
    allowAdd: true,
    addPlaceholder: "New category…",
    primaryLabel: "Apply",
  });
  if (!result) return;
  // Add any new categories that didn't exist before
  for (const name of result) {
    if (!pb.categories.has(name)) pb.addCategory(new Category(name));
  }
  play.categoryNames = new Set(result);
  // Sync Category->play mapping
  for (const cat of pb.categories.values()) {
    if (play.categoryNames.has(cat.name)) cat.addPlay(play.name);
    else cat.removePlay(play.name);
  }
  controller.notifyPlayEdited();
}

async function cmdEditComment() {
  const play = controller.activePlay;
  if (!play) return;
  const out = await formDialog({
    title: "Edit Comment",
    fields: [{ key: "comment", label: "Comment", type: "textarea", value: play.comment }],
  });
  if (!out) return;
  play.comment = out.comment;
  controller.notifyPlayEdited();
}

function navigatePlay(dir) {
  const pb = controller.playbook;
  if (!pb || !pb.plays.size) return;
  const names = pb.playNames();
  const cur = controller.activePlay?.name;
  let idx = cur ? names.indexOf(cur) : -1;
  idx = (idx + dir + names.length) % names.length;
  controller.setActivePlay(pb.getPlay(names[idx]));
}

async function cmdDelete(kind) {
  const pb = controller.playbook;
  if (!pb) return;
  let names, deleter, label;
  if (kind === "plays") {
    names = pb.playNames(); deleter = (n) => pb.deletePlay(n); label = "Delete Plays";
  } else if (kind === "routes") {
    names = pb.routeNames(); deleter = (n) => pb.deleteRoute(n); label = "Delete Routes";
  } else if (kind === "formations") {
    names = pb.formationNames(); deleter = (n) => pb.deleteFormation(n); label = "Delete Formations";
  } else {
    names = pb.categoryNames(); deleter = (n) => pb.deleteCategory(n); label = "Delete Categories";
  }
  if (!names.length) { await alertDialog("(none)"); return; }
  const sel = await checklistDialog({
    title: label,
    items: names.map((n) => ({ value: n, label: n })),
    primaryLabel: "Delete",
  });
  if (!sel || !sel.length) return;
  if (!await confirmDialog(`Delete ${sel.length} item(s)?`, label)) return;
  for (const n of sel) deleter(n);
  if (controller.activePlay && !pb.plays.has(controller.activePlay.name)) {
    controller.setActivePlay(null);
  }
  controller.markDirty();
  controller.emit("playbookChanged");
}

async function cmdExportPdf() {
  const pb = controller.playbook;
  if (!pb || !pb.plays.size) { await alertDialog("No plays to export."); return; }
  const opts = await openPdfExportDialog({ availablePlays: [...pb.plays.values()] });
  if (!opts) return;
  const plays = opts.playNames.map((n) => pb.getPlay(n)).filter(Boolean);
  try {
    const pdf = await exportWristCoachPDF({ ...opts, plays });
    pdf.save(`${pb.name || "playbook"}-wristcoach.pdf`);
  } catch (e) {
    console.error(e);
    await alertDialog(`PDF export failed: ${e.message || e}`, "PDF Export");
  }
}

async function cmdAbout() {
  await alertDialog(
    "Playbook Creator Web\n\n" +
    "A free, open-source browser app for designing American football playbooks. " +
    "Runs entirely in your browser — no backend, no account.\n\n" +
    "Storage: SQLite (.pbc.sqlite). Export: wrist coach PDF.\n\n" +
    "This app is a derivative of Playbook Creator by Oliver Braunsdorf " +
    "(github.com/obraunsdorf/playbook-creator), released under GPL v3+.",
    "About",
  );
}
