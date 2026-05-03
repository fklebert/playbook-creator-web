// Controller: singleton holding the active playbook + active play, and an
// observer system for UI redraws. Mirrors PBCController.

class Controller extends EventTarget {
  constructor() {
    super();
    /** @type {import('./models/playbook.js').Playbook|null} */
    this.playbook = null;
    /** @type {import('./models/play.js').Play|null} */
    this.activePlay = null;
    /** @type {import('./models/player.js').Player|null} */
    this.activePlayer = null;
    /** Path to file (File System Access handle if available, else null). */
    this.fileHandle = null;
    /** Suggested file name for save fallback. */
    this.fileName = null;
    /** "dirty" flag for window-title star. */
    this.dirty = false;
  }

  setPlaybook(pb, { fileHandle = null, fileName = null } = {}) {
    this.playbook = pb;
    this.activePlay = null;
    this.activePlayer = null;
    this.fileHandle = fileHandle;
    this.fileName = fileName || (pb?.name ? `${pb.name}.pbc.sqlite` : null);
    this.dirty = false;
    this.emit("playbookChanged");
  }

  setActivePlay(play) {
    this.activePlay = play;
    this.activePlayer = null;
    this.emit("playChanged");
  }

  setActivePlayer(player) {
    this.activePlayer = player;
    this.emit("playerChanged");
  }

  markDirty() {
    if (!this.dirty) {
      this.dirty = true;
      this.emit("dirtyChanged");
    }
  }
  markClean() {
    if (this.dirty) {
      this.dirty = false;
      this.emit("dirtyChanged");
    }
  }

  // re-emit "playChanged" after any in-place edit so the canvas redraws.
  notifyPlayEdited() {
    this.markDirty();
    this.emit("playChanged");
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  on(type, handler) {
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler);
  }
}

export const controller = new Controller();
