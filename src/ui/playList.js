// Left sidebar: searchable + category-filtered list of plays.

import { controller } from "../controller.js";

export class PlayList {
  constructor() {
    this.searchEl = document.getElementById("play-search");
    this.categoryEl = document.getElementById("category-filter");
    this.listEl = document.getElementById("play-list-items");

    this.searchEl.addEventListener("input", () => this.refresh());
    this.categoryEl.addEventListener("change", () => this.refresh());

    controller.on("playbookChanged", () => this.refresh());
    controller.on("playChanged", () => this.refresh());

    this.refresh();
  }

  refresh() {
    const pb = controller.playbook;
    this.categoryEl.innerHTML = '<option value="">All categories</option>';
    if (pb) {
      for (const c of pb.categoryNames()) {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        this.categoryEl.appendChild(o);
      }
    }

    this.listEl.innerHTML = "";
    if (!pb) return;
    const q = (this.searchEl.value || "").toLowerCase();
    const cat = this.categoryEl.value;
    const plays = [...pb.plays.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const play of plays) {
      if (q && !play.name.toLowerCase().includes(q) && !play.codeName.toLowerCase().includes(q)) continue;
      if (cat && !play.categoryNames.has(cat)) continue;
      const li = document.createElement("li");
      li.textContent = play.name;
      if (play.codeName) {
        const c = document.createElement("span");
        c.className = "code";
        c.textContent = play.codeName;
        li.appendChild(c);
      }
      if (controller.activePlay === play) li.classList.add("active");
      li.addEventListener("click", () => controller.setActivePlay(play));
      this.listEl.appendChild(li);
    }
  }
}
