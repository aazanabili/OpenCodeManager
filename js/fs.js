/* ============================================================
   fs.js — File System Access API layer (local, no server)
   Falls back to import/export when the API is unavailable.
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u;
  const { el, $ } = u;

  const API = {
    handle: null,
    name: '',
    mode: 'memory',          // 'fs' | 'memory'
    permission: 'unknown',   // granted | prompt | denied | unknown
    lastError: null
  };

  const IDB_NAME = 'opencode-manager';
  const IDB_STORE = 'handles';
  const IDB_KEY = 'root-dir';

  /* ---------------- IndexedDB (tiny promise wrapper) ---------------- */
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(IDB_NAME, 1); }
      catch (e) { return resolve(null); }
      req.onupgradeneeded = () => { try { req.result.createObjectStore(IDB_STORE); } catch (_) { } };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, mode);
          const r = fn(tx.objectStore(IDB_STORE));
          tx.oncomplete = () => resolve(r && r.result !== undefined ? r.result : null);
          tx.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      };
    });
  }
  function idbSet(k, v) { return idb('readwrite', s => s.put(v, k)); }
  function idbGet(k) { return idb('readonly', s => s.get(k)); }
  function idbDel(k) { return idb('readwrite', s => s.delete(k)); }

  /* ---------------- capability ---------------- */
  const supported = () =>
    typeof window.showDirectoryPicker === 'function' && window.isSecureContext;

  /* ---------------- path helpers ---------------- */
  function segments(path) {
    return String(path || '').split('/').map(s => s.trim()).filter(Boolean);
  }

  async function dirFor(path, create) {
    if (!API.handle) throw new Error('لا يوجد مجلد متصل');
    let dir = API.handle;
    const segs = segments(path);
    // last segment may be the file name
    for (let i = 0; i < segs.length - 1; i++) {
      dir = await dir.getDirectoryHandle(segs[i], { create: !!create });
    }
    return dir;
  }

  function parentOf(path) {
    const segs = segments(path);
    return segs.length > 1 ? segs.slice(0, -1).join('/') : '';
  }
  function baseOf(path) {
    const segs = segments(path);
    return segs.length ? segs[segs.length - 1] : '';
  }

  /* ---------------- permission ---------------- */
  async function ensurePermission(desc) {
    if (!API.handle) return false;
    const opts = { mode: 'readwrite' };
    let p = await API.handle.queryPermission(opts);
    if (p === 'granted') { API.permission = 'granted'; return true; }
    p = await API.handle.requestPermission(opts);
    API.permission = p;
    return p === 'granted';
  }

  /* ---------------- read / write ---------------- */
  async function exists(path) {
    try {
      const segs = segments(path);
      if (!segs.length) return false;
      const dir = await dirFor(path, false);
      await dir.getFileHandle(segs[segs.length - 1], { create: false });
      return true;
    } catch (_) { return false; }
  }

  async function read(path) {
    if (!API.handle) return null;
    try {
      const segs = segments(path);
      const dir = await dirFor(path, false);
      const fh = await dir.getFileHandle(segs[segs.length - 1], { create: false });
      const file = await fh.getFile();
      return await file.text();
    } catch (_) { return null; }
  }

  async function readJSON(path) {
    const txt = await read(path);
    if (txt == null) return null;
    return NS.jsonc.parse(txt);
  }

  async function write(path, text) {
    if (!API.handle) throw new Error('لا يوجد مجلد متصل');
    const ok = await ensurePermission();
    if (!ok) throw new Error('لم يُمنح إذن الكتابة للمجلد');
    const segs = segments(path);
    const dir = await dirFor(path, true);
    const fh = await dir.getFileHandle(segs[segs.length - 1], { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    return true;
  }

  /** Save with a rotating `.backup` copy of the previous content. */
  async function writeSafe(path, text) {
    const prev = await read(path);
    if (prev != null && prev !== text) {
      await write(path + '.backup', prev).catch(() => { });
    }
    return write(path, text);
  }

  async function remove(path) {
    if (!API.handle) return false;
    const ok = await ensurePermission();
    if (!ok) throw new Error('لم يُمنح إذن الحذف');
    const segs = segments(path);
    if (!segs.length) return false;
    const dir = await dirFor(path, false);
    await dir.removeEntry(segs[segs.length - 1], { recursive: true });
    return true;
  }

  /** List one directory level. Returns [{ name, kind }] sorted. */
  async function list(path) {
    if (!API.handle) return [];
    try {
      const dir = path ? await dirFor(path + '/x', false) : API.handle;
      const out = [];
      for await (const [name, handle] of dir.entries()) {
        out.push({ name, kind: handle.kind });
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    } catch (_) { return []; }
  }

  /** Recursively collect files under `path`, relative paths returned. */
  async function walk(path, maxDepth) {
    const out = [];
    const base = segments(path).length;
    async function rec(rel, depth) {
      if (maxDepth && depth > maxDepth) return;
      let items = [];
      try {
        const dir = rel ? await dirFor(rel + '/x', false) : API.handle;
        for await (const [name, handle] of dir.entries()) items.push({ name, kind: handle.kind });
      } catch (_) { return; }
      for (const it of items) {
        const r = rel ? rel + '/' + it.name : it.name;
        if (it.kind === 'file') out.push(r);
        else await rec(r, depth + 1);
      }
    }
    await rec(path || '', 0);
    return out.sort();
  }

  /* ---------------- scope detection ---------------- */
  const CONFIG_CANDIDATES = [
    'opencode.jsonc', 'opencode.json',
    '.opencode/opencode.jsonc', '.opencode/opencode.json'
  ];
  const CLI_CANDIDATES = ['cli.json'];

  async function detect() {
    const files = await walk('', 3);
    const set = new Set(files);
    const has = (p) => set.has(p);

    const cfgPath = CONFIG_CANDIDATES.find(has) || null;
    const cliPath = CLI_CANDIDATES.find(has) || null;

    const agentsDir = has('.opencode/agents') ? '.opencode/agents' : (has('agents') ? 'agents' : null);
    const skillsDir = has('.opencode/skills') ? '.opencode/skills' : (has('skills') ? 'skills' : null);
    const commandsDir = has('.opencode/commands') ? '.opencode/commands' : (has('commands') ? 'commands' : null);
    const themesDir = has('.opencode/themes') ? '.opencode/themes' : (has('themes') ? 'themes' : null);
    const pluginsDir = has('.opencode/plugins') ? '.opencode/plugins' : (has('plugins') ? 'plugins' : null);

    return {
      files, cfgPath, cliPath,
      agentsDir, skillsDir, commandsDir, themesDir, pluginsDir,
      agentsFile: (agentsDir ? agentsDir + '/x' : 'x'),
      isOpencodeConfigDir: !!cliPath && !!cfgPath,
      instructionsFile: has('.opencode/AGENTS.md') ? '.opencode/AGENTS.md'
        : (has('AGENTS.md') ? 'AGENTS.md' : null)
    };
  }

  /* ---------------- connect ---------------- */
  async function connect() {
    if (!supported()) {
      u.toast('متصفحك لا يدعم الكتابة المباشرة على القرص. استخدم الاستيراد/التصدير.', 'warn', 6000);
      return null;
    }
    let handle;
    try {
      handle = await window.showDirectoryPicker({ id: 'opencode-config', mode: 'readwrite' });
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      throw e;
    }
    API.handle = handle;
    API.name = handle.name;
    API.mode = 'fs';
    await idbSet(IDB_KEY, handle);
    const ok = await ensurePermission();
    if (!ok) { API.mode = 'memory'; u.toast('لم يُمنح إذن الكتابة — وضع للقراءة فقط', 'warn'); }
    return handle;
  }

  async function restore() {
    if (!supported()) return false;
    const handle = await idbGet(IDB_KEY);
    if (!handle) return false;
    try {
      const p = await handle.queryPermission({ mode: 'readwrite' });
      if (p === 'granted') {
        API.handle = handle; API.name = handle.name; API.mode = 'fs'; API.permission = 'granted';
        return true;
      }
      API.handle = handle; API.name = handle.name; API.mode = 'fs'; API.permission = p;
      return true; // needs a user gesture to re-grant
    } catch (_) { await idbDel(IDB_KEY); return false; }
  }

  async function reauthorize() {
    if (!API.handle) return false;
    const ok = await ensurePermission();
    return ok;
  }

  function disconnect() {
    API.handle = null; API.name = ''; API.mode = 'memory'; API.permission = 'unknown';
    idbDel(IDB_KEY);
  }

  NS.fs = {
    API, supported, connect, restore, disconnect, reauthorize,
    read, readJSON, write, writeSafe, remove, exists, list, walk, detect,
    parentOf, baseOf
  };
})(window.OCM);