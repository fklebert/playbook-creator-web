// Dialog helpers using native <dialog>. All return a Promise that resolves
// with the user's input (or null if canceled).

const host = () => document.getElementById("dialog-host");

function makeDialog({ title, body, primaryLabel = "OK", cancelLabel = "Cancel", extraClass = "" }) {
  const dlg = document.createElement("dialog");
  if (extraClass) dlg.className = extraClass;
  const titleEl = document.createElement("h2");
  titleEl.className = "dialog-title";
  titleEl.textContent = title;
  dlg.appendChild(titleEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "dialog-body";
  if (typeof body === "string") bodyEl.textContent = body;
  else bodyEl.appendChild(body);
  dlg.appendChild(bodyEl);

  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = cancelLabel;
  const okBtn = document.createElement("button");
  okBtn.className = "primary";
  okBtn.textContent = primaryLabel;
  actions.appendChild(cancelBtn);
  actions.appendChild(okBtn);
  dlg.appendChild(actions);

  host().appendChild(dlg);
  return { dlg, okBtn, cancelBtn, bodyEl };
}

function dispose(dlg) {
  dlg.close();
  dlg.remove();
}

export function alertDialog(message, title = "Notice") {
  return new Promise((resolve) => {
    const { dlg, okBtn, cancelBtn } = makeDialog({ title, body: message, primaryLabel: "OK", cancelLabel: "" });
    cancelBtn.style.display = "none";
    okBtn.addEventListener("click", () => { resolve(); dispose(dlg); });
    dlg.showModal();
  });
}

export function confirmDialog(message, title = "Confirm") {
  return new Promise((resolve) => {
    const { dlg, okBtn, cancelBtn } = makeDialog({ title, body: message });
    okBtn.addEventListener("click", () => { resolve(true); dispose(dlg); });
    cancelBtn.addEventListener("click", () => { resolve(false); dispose(dlg); });
    dlg.addEventListener("cancel", () => { resolve(false); dispose(dlg); });
    dlg.showModal();
  });
}

function makeForm(fields) {
  const form = document.createElement("form");
  form.style.display = "grid";
  form.style.gap = "10px";
  form.method = "dialog";
  const inputs = {};
  for (const f of fields) {
    const lbl = document.createElement("label");
    lbl.textContent = f.label;
    let input;
    if (f.type === "select") {
      input = document.createElement("select");
      for (const opt of f.options) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label ?? opt.value;
        input.appendChild(o);
      }
      if (f.value !== undefined) input.value = String(f.value);
    } else if (f.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
      input.value = f.value ?? "";
    } else {
      input = document.createElement("input");
      input.type = f.type || "text";
      if (f.value !== undefined) input.value = String(f.value);
      if (f.min !== undefined) input.min = f.min;
      if (f.max !== undefined) input.max = f.max;
      if (f.step !== undefined) input.step = f.step;
    }
    input.required = !!f.required;
    lbl.appendChild(input);
    form.appendChild(lbl);
    inputs[f.key] = input;
  }
  return { form, inputs };
}

export function formDialog({ title, fields, primaryLabel = "OK" }) {
  return new Promise((resolve) => {
    const { form, inputs } = makeForm(fields);
    const { dlg, okBtn, cancelBtn } = makeDialog({ title, body: form, primaryLabel });
    const submit = (ev) => {
      ev?.preventDefault?.();
      const out = {};
      for (const [k, el] of Object.entries(inputs)) {
        out[k] = el.type === "number" ? Number(el.value) : el.value;
      }
      resolve(out);
      dispose(dlg);
    };
    okBtn.addEventListener("click", submit);
    form.addEventListener("submit", submit);
    cancelBtn.addEventListener("click", () => { resolve(null); dispose(dlg); });
    dlg.addEventListener("cancel", () => { resolve(null); dispose(dlg); });
    dlg.showModal();
    const firstInput = Object.values(inputs)[0];
    firstInput?.focus?.();
  });
}

export function listSelectDialog({ title, items, multi = false, primaryLabel = "Select", initialSelected = [] }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";
    wrap.style.minWidth = "320px";

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Filter…";
    wrap.appendChild(search);

    const list = document.createElement("ul");
    list.style.listStyle = "none";
    list.style.margin = "0";
    list.style.padding = "0";
    list.style.maxHeight = "320px";
    list.style.overflow = "auto";
    list.style.border = "1px solid var(--border)";
    list.style.borderRadius = "4px";
    wrap.appendChild(list);

    const selected = new Set(initialSelected);

    function render() {
      list.innerHTML = "";
      const q = search.value.toLowerCase();
      for (const it of items) {
        if (q && !String(it.label).toLowerCase().includes(q)) continue;
        const li = document.createElement("li");
        li.style.padding = "6px 10px";
        li.style.cursor = "pointer";
        li.style.borderBottom = "1px solid #2f3036";
        li.textContent = it.label;
        if (selected.has(it.value)) li.style.background = "var(--accent)";
        li.addEventListener("click", () => {
          if (multi) {
            if (selected.has(it.value)) selected.delete(it.value);
            else selected.add(it.value);
          } else {
            selected.clear();
            selected.add(it.value);
          }
          render();
        });
        li.addEventListener("dblclick", () => {
          if (!multi) { resolve([it.value]); dispose(dlg); }
        });
        list.appendChild(li);
      }
    }
    search.addEventListener("input", render);
    render();

    const { dlg, okBtn, cancelBtn } = makeDialog({ title, body: wrap, primaryLabel });
    okBtn.addEventListener("click", () => { resolve([...selected]); dispose(dlg); });
    cancelBtn.addEventListener("click", () => { resolve(null); dispose(dlg); });
    dlg.addEventListener("cancel", () => { resolve(null); dispose(dlg); });
    dlg.showModal();
    search.focus();
  });
}

export function checklistDialog({ title, items, initialChecked = [], primaryLabel = "OK", allowAdd = false, addPlaceholder = "" }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";
    wrap.style.minWidth = "320px";

    const list = document.createElement("div");
    list.style.maxHeight = "320px";
    list.style.overflow = "auto";
    list.style.border = "1px solid var(--border)";
    list.style.borderRadius = "4px";
    list.style.padding = "8px";

    const checked = new Set(initialChecked);
    const allItems = [...items];

    function render() {
      list.innerHTML = "";
      if (!allItems.length) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = "(none)";
        list.appendChild(p);
        return;
      }
      for (const it of allItems) {
        const lab = document.createElement("label");
        lab.style.flexDirection = "row";
        lab.style.alignItems = "center";
        lab.style.gap = "8px";
        lab.style.color = "var(--fg)";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = checked.has(it.value);
        cb.addEventListener("change", () => {
          if (cb.checked) checked.add(it.value);
          else checked.delete(it.value);
        });
        lab.appendChild(cb);
        const txt = document.createElement("span");
        txt.textContent = it.label;
        lab.appendChild(txt);
        list.appendChild(lab);
      }
    }
    render();
    wrap.appendChild(list);

    if (allowAdd) {
      const addRow = document.createElement("div");
      addRow.style.display = "flex";
      addRow.style.gap = "6px";
      const inp = document.createElement("input");
      inp.placeholder = addPlaceholder;
      inp.style.flex = "1";
      const btn = document.createElement("button");
      btn.textContent = "Add";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const v = inp.value.trim();
        if (!v) return;
        if (allItems.some((x) => x.value === v)) return;
        allItems.push({ value: v, label: v });
        checked.add(v);
        inp.value = "";
        render();
      });
      addRow.appendChild(inp);
      addRow.appendChild(btn);
      wrap.appendChild(addRow);
    }

    const { dlg, okBtn, cancelBtn } = makeDialog({ title, body: wrap, primaryLabel });
    okBtn.addEventListener("click", () => { resolve([...checked]); dispose(dlg); });
    cancelBtn.addEventListener("click", () => { resolve(null); dispose(dlg); });
    dlg.addEventListener("cancel", () => { resolve(null); dispose(dlg); });
    dlg.showModal();
  });
}

export { dispose, makeDialog };
