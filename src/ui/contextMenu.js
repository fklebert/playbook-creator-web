// Generic context-menu builder. Supports one level of nested submenus.
// Items: { label, onClick?, separator?, submenu?: items[] }
//
// Positioning strategy:
//   - Root menu is placed at the cursor; if it overflows the viewport,
//     it shifts left/up to stay on screen.
//   - Submenus use position: fixed and are placed JS-side on mouseenter,
//     flipping to the left of the parent if they'd overflow the right
//     edge, and shifting upward (clamped to the viewport) if they'd
//     overflow the bottom. Tall submenus get vertical scrolling.

let activeMenu = null;

export function showContextMenu(x, y, items) {
  closeContextMenu();
  const root = document.createElement("div");
  root.className = "context-menu";
  // Use fixed positioning so we don't get clipped by an ancestor with overflow:hidden.
  root.style.position = "fixed";
  root.style.left = `${x}px`;
  root.style.top = `${y}px`;
  root.appendChild(buildList(items));
  document.body.appendChild(root);
  activeMenu = root;

  setTimeout(() => {
    window.addEventListener("mousedown", onOutside, true);
    window.addEventListener("keydown", onKey, true);
  }, 0);

  // Clamp root menu to viewport
  const rect = root.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    root.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
  }
  if (rect.bottom > window.innerHeight) {
    root.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
  }
}

function buildList(items) {
  const frag = document.createDocumentFragment();
  // Track which submenu is currently open so hovering siblings can close it.
  const state = { openItem: null };

  for (const it of items) {
    if (it.separator) {
      const sep = document.createElement("div");
      sep.className = "context-menu-separator";
      frag.appendChild(sep);
      continue;
    }
    const el = document.createElement("div");
    el.className = "context-menu-item";
    el.textContent = it.label;

    if (it.submenu) {
      el.classList.add("has-submenu");
      const sub = document.createElement("div");
      sub.className = "submenu";
      sub.appendChild(buildList(it.submenu));
      el.appendChild(sub);

      let hideTimer = null;
      const cancelHide = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
      const scheduleHide = () => {
        cancelHide();
        hideTimer = setTimeout(() => {
          el.classList.remove("open");
          if (state.openItem === el) state.openItem = null;
        }, 120);
      };

      const open = () => {
        cancelHide();
        if (state.openItem && state.openItem !== el) state.openItem.classList.remove("open");
        state.openItem = el;
        el.classList.add("open");
        positionSubmenu(el, sub);
      };

      el.addEventListener("mouseenter", open);
      el.addEventListener("mouseleave", scheduleHide);
      sub.addEventListener("mouseenter", cancelHide);
      sub.addEventListener("mouseleave", scheduleHide);
    } else {
      el.addEventListener("mouseenter", () => {
        // Closing the open sibling submenu makes navigation feel snappy.
        if (state.openItem) {
          state.openItem.classList.remove("open");
          state.openItem = null;
        }
      });
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeContextMenu();
        it.onClick?.();
      });
    }
    frag.appendChild(el);
  }
  return frag;
}

// Place a submenu in viewport coords, flipping/shifting to fit.
function positionSubmenu(parentItem, sub) {
  // Reset and make visible (but transparent) so we can measure.
  sub.style.visibility = "hidden";
  sub.style.left = "0";
  sub.style.top = "0";
  // Unset any prior max-height so we measure natural size first.
  sub.style.maxHeight = "";

  const parentRect = parentItem.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 4;

  // Measure natural size, but cap to a reasonable height so very tall
  // submenus get a scrollbar instead of overflowing.
  const maxH = vh - 2 * margin;
  sub.style.maxHeight = `${maxH}px`;
  const subRect = sub.getBoundingClientRect();

  // Horizontal: prefer right of parent; flip to left if it overflows.
  let left = parentRect.right;
  if (left + subRect.width > vw - margin) {
    left = parentRect.left - subRect.width;
  }
  if (left < margin) left = margin;

  // Vertical: prefer aligned with parent top; shift up if overflowing bottom.
  let top = parentRect.top;
  if (top + subRect.height > vh - margin) {
    top = vh - subRect.height - margin;
  }
  if (top < margin) top = margin;

  sub.style.left = `${left}px`;
  sub.style.top = `${top}px`;
  sub.style.visibility = "visible";
}

function onOutside(ev) {
  if (!activeMenu) return;
  if (activeMenu.contains(ev.target)) return;
  // Submenus are descendants of activeMenu in the DOM, so this also works for them.
  closeContextMenu();
}
function onKey(ev) {
  if (ev.key === "Escape") closeContextMenu();
}
export function closeContextMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
    window.removeEventListener("mousedown", onOutside, true);
    window.removeEventListener("keydown", onKey, true);
  }
}
