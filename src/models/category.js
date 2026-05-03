// Category: organizes plays into named groups (e.g. "Run", "4th Down").
// Stores play *names* (not references) so it round-trips cleanly through
// SQLite without graph reconstruction.

export class Category {
  constructor(name, playNames = []) {
    this.name = name;
    this.playNames = new Set(playNames);
  }

  addPlay(name) { this.playNames.add(name); }
  removePlay(name) { this.playNames.delete(name); }
  hasPlay(name) { return this.playNames.has(name); }
}
