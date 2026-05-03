// Thin wrapper around File System Access API with download/<input> fallback
// for browsers that don't support it (Safari, Firefox).

const supportsFsa = "showOpenFilePicker" in window;

export async function openFile({ accept = ".pbc.sqlite,.sqlite,.pbc" } = {}) {
  if (supportsFsa) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: "Playbook Creator file",
          accept: { "application/x-sqlite3": [".pbc.sqlite", ".sqlite"] },
        }],
        excludeAcceptAllOption: false,
      });
      const file = await handle.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { bytes, fileHandle: handle, fileName: file.name };
    } catch (e) {
      if (e?.name === "AbortError") return null;
      // fall through to legacy path
    }
  }
  return await openFileLegacy(accept);
}

function openFileLegacy(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = accept;
    inp.style.display = "none";
    inp.addEventListener("change", async () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      const bytes = new Uint8Array(await f.arrayBuffer());
      resolve({ bytes, fileHandle: null, fileName: f.name });
      inp.remove();
    });
    document.body.appendChild(inp);
    inp.click();
  });
}

export async function saveFile(bytes, suggestedName, fileHandle = null) {
  if (fileHandle) {
    const w = await fileHandle.createWritable();
    await w.write(bytes);
    await w.close();
    return fileHandle;
  }
  if (supportsFsa) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: "Playbook Creator file",
          accept: { "application/x-sqlite3": [".pbc.sqlite"] },
        }],
      });
      const w = await handle.createWritable();
      await w.write(bytes);
      await w.close();
      return handle;
    } catch (e) {
      if (e?.name === "AbortError") return null;
    }
  }
  // Fallback: trigger download
  const blob = new Blob([bytes], { type: "application/x-sqlite3" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  return null;
}
