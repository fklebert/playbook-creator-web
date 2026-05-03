// Builds the menu bar.

let openMenu = null;

export function buildMenubar(hostEl, menus, titleProvider) {
  hostEl.innerHTML = "";

  for (const menu of menus) {
    const menuEl = document.createElement("div");
    menuEl.className = "menu";

    const label = document.createElement("div");
    label.className = "menu-label";
    label.textContent = menu.label;
    menuEl.appendChild(label);

    const dropdown = document.createElement("div");
    dropdown.className = "menu-dropdown";
    for (const item of menu.items) {
      if (item.separator) {
        const sep = document.createElement("div");
        sep.className = "menu-separator";
        dropdown.appendChild(sep);
        continue;
      }
      const it = document.createElement("div");
      it.className = "menu-item";
      const itLabel = document.createElement("span");
      itLabel.textContent = item.label;
      it.appendChild(itLabel);
      if (item.shortcut) {
        const sc = document.createElement("span");
        sc.className = "shortcut";
        sc.textContent = item.shortcut;
        it.appendChild(sc);
      }
      it.addEventListener("click", () => {
        closeMenu();
        item.onClick?.();
      });
      dropdown.appendChild(it);
    }
    menuEl.appendChild(dropdown);

    menuEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (openMenu === menuEl) {
        closeMenu();
      } else {
        closeMenu();
        menuEl.classList.add("open");
        openMenu = menuEl;
      }
    });
    menuEl.addEventListener("mouseenter", () => {
      if (openMenu && openMenu !== menuEl) {
        openMenu.classList.remove("open");
        menuEl.classList.add("open");
        openMenu = menuEl;
      }
    });

    hostEl.appendChild(menuEl);
  }

  const spacer = document.createElement("div");
  spacer.className = "title-spacer";
  hostEl.appendChild(spacer);

  const title = document.createElement("div");
  title.className = "title";
  hostEl.appendChild(title);
  const updateTitle = () => { title.textContent = titleProvider?.() || ""; };
  updateTitle();

  document.body.addEventListener("click", closeMenu);

  return { updateTitle };
}

function closeMenu() {
  if (openMenu) openMenu.classList.remove("open");
  openMenu = null;
}
