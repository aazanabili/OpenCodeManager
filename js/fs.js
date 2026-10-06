/* ============================================================
   fs.js — multi-root filesystem access (local, no server)

   Two kinds of root are kept:
     · global  — the OpenCode config dir (~/.config/opencode)
     · projects — one or more folders that contain your projects

   Handles are persisted in IndexedDB so the next visit only needs
   the permission re-grant (a single click) before reading resumes.
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u;

  const IDB_NAME = 'opencode-manager';
  const IDB_STORE = 'handles';
  const IDB_KEY = 'roots-v2';

  /** Folders never worth descending into while scanning for projects. */
  const SKIP_DIRS = new Set([
    'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', 'target',
    'vendor', 'coverage', '.next', '.nuxt', '.cache', '.venv', 'venv',
    '__pycache__', '.gradle', '.idea', '.vscode', 'tmp', 'temp', '.turbo'
  ]);

  const MAX_DEPTH = 4;
  const MAX_PROJECTS = 300;

  const API = {
    roots: [],            // { id, name, kind: 'global'|'projects', handle, permission }
    projects: [],         // { id, name, rootId, relPath, configFile, dotOpencode, agentsDir, ... }
    scannedAt: 0
  };

  /* ---------------- IndexedDB ---------------- */
  function idb(mode, fn) {
    return new Promise((resolve) => {
      let req;
      try { req = indexedDB.open(IDB_NAME, 1); } catch (e) { return resolve(null); }
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
  const idbSet = (k, v) => idb('readwrite', s => s.put(v, k));
  const idbGet = (k) => idb('readonly', s => s.get(k));
  const idbDel = (k) => idb('readwrite', s => s.delete(k));

  /* ---------------- capability ---------------- */
  const supported = () => typeof window.showDirectoryPicker === 'function' && window.isSecureContext;

  /* ---------------- low level path helpers ---------------- */
  const segments = (p) => String(p || '').split('/').map(s => s.trim()).filter(Boolean);

  async function dirFrom(handle, path, create) {
    let dir = handle;
    const segs = segments(path);
    for (let i = 0; i < segs.length; i++) dir = await dir.getDirectoryHandle(segs[i], { create: !!create });
    return dir;
  }

  async function resolve(rootId, path, create) {
    const root = API.roots.find(r => r.id === rootId);
    if (!root) throw new Error('الجذر غير موجود');
    const segs = segments(path);
    const name = segs.pop();
    const dir = await dirFrom(root.handle, segs.join('/'), !!create);
    return { root, dir, name };
  }

  async function readFile(rootId, path) {
    try {
      const { dir, name } = await resolve(rootId, path, false);
      const fh = await dir.getFileHandle(name, { create: false });
      return await (await fh.getFile()).text();
    } catch (_) { return null; }
  }

  async function writeFile(rootId, path, text) {
    const { dir, name } = await resolve(rootId, path, true);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    return true;
  }

  /** Write, keeping one rotating `.backup` of the previous content. */
  async function writeSafe(rootId, path, text) {
    const prev = await readFile(rootId, path);
    if (prev != null && prev !== text) await writeFile(rootId, path + '.backup', prev).catch(() => { });
    return writeFile(rootId, path, text);
  }

  async function removePath(rootId, path) {
    try {
      const { dir, name } = await resolve(rootId, path, false);
      await dir.removeEntry(name, { recursive: true });
      return true;
    } catch (_) { return false; }
  }

  async function listDir(rootId, path) {
    try {
      const { dir } = await resolve(rootId, path ? path + '/x' : '', false);
      const out = [];
      for await (const [name, handle] of dir.entries()) out.push({ name, kind: handle.kind });
      return out.sort((a, b) => a.name.localeCompare(b.name));
    } catch (_) { return []; }
  }

  /** All files under `path`, as relative paths. */
  async function walkFiles(rootId, path, maxDepth) {
    const out = [];
    const baseDepth = segments(path).length;
    async function rec(rel, depth) {
      if (maxDepth && depth > maxDepth) return;
      let items = [];
      try {
        const { dir } = await resolve(rootId, rel ? rel + '/x' : '', false);
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

  /* ---------------- permissions ---------------- */
  async function ensurePermission(rootId, mode) {
    const root = API.roots.find(r => r.id === rootId);
    if (!root) return false;
    const opts = { mode: mode || 'readwrite' };
    let p = await root.handle.queryPermission(opts);
    if (p !== 'granted') p = await root.handle.requestPermission(opts);
    root.permission = p;
    return p === 'granted';
  }

  async function reauthorizeAll() {
    let all = true;
    for (const r of API.roots) {
      const ok = await ensurePermission(r.id);
      if (!ok) all = false;
    }
    return all;
  }

  /* ---------------- roots management ---------------- */
  const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  async function addRoot(kind) {
    if (!supported()) {
      u.toast('warn', 'المتصفح لا يدعم الوصول للقرص. استخدم Chrome أو Edge.', 6000);
      return null;
    }
    let handle;
    try {
      handle = await window.showDirectoryPicker({
        id: kind === 'global' ? 'opencode-global' : 'opencode-projects',
        mode: 'readwrite'
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      throw e;
    }
    const root = { id: uid(), name: handle.name, kind, handle, permission: 'prompt' };
    API.roots.push(root);
    await ensurePermission(root.id);
    await persist();
    return root;
  }

  async function removeRoot(rootId) {
    API.roots = API.roots.filter(r => r.id !== rootId);
    API.projects = API.projects.filter(p => p.rootId !== rootId);
    await persist();
  }

  function globalRoot() { return API.roots.find(r => r.kind === 'global') || null; }
  function projectRoots() { return API.roots.filter(r => r.kind === 'projects'); }

  async function persist() {
    await idbSet(IDB_KEY, API.roots.map(r => ({ id: r.id, name: r.name, kind: r.kind, handle: r.handle })));
  }

  async function restore() {
    const saved = await idbGet(IDB_KEY);
    if (!saved || !Array.isArray(saved)) return false;
    API.roots = [];
    for (const r of saved) {
      if (!r || !r.handle) continue;
      let perm = 'prompt';
      try { perm = await r.handle.queryPermission({ mode: 'readwrite' }); }
      catch (_) { continue; }
      API.roots.push({ id: r.id, name: r.name, kind: r.kind, handle: r.handle, permission: perm });
    }
    return API.roots.length > 0;
  }

  /** Roots whose permission still needs one user click. */
  function needsPermission() { return API.roots.filter(r => r.permission !== 'granted'); }

  /* ---------------- project discovery ---------------- */
  const PROJECT_CONFIG_FILES = ['opencode.jsonc', 'opencode.json', '.opencode/opencode.jsonc', '.opencode/opencode.json'];

  /** Inspect one directory and describe it if it looks like an OpenCode project. */
  async function inspectDir(rootId, relPath) {
    let names = [];
    try {
      const { dir } = await resolve(rootId, relPath ? relPath + '/x' : '', false);
      for await (const [name, handle] of dir.entries()) names.push({ name, kind: handle.kind });
    } catch (_) { return null; }

    const has = (n) => names.some(x => x.name === n);
    const dotOpencode = names.some(x => x.name === '.opencode' && x.kind === 'directory');

    let configFile = null;
    let inner = null;
    if (has('opencode.jsonc')) configFile = 'opencode.jsonc';
    else if (has('opencode.json')) configFile = 'opencode.json';
    else if (dotOpencode) {
      try {
        inner = [];
        const { dir } = await resolve(rootId, relPath ? relPath + '/.opencode/x' : '.opencode/x', false);
        for await (const [name] of dir.entries()) inner.push(name);
        if (inner.includes('opencode.jsonc')) configFile = '.opencode/opencode.jsonc';
        else if (inner.includes('opencode.json')) configFile = '.opencode/opencode.json';
      } catch (_) { /* unreadable .opencode is simply not a config site */ }
    }

    if (!configFile && !dotOpencode) return null;

    // Content folders live either at the project root or under .opencode/.
    const pick = (...cands) => {
      for (const c of cands) {
        const parts = c.split('/');
        if (parts[0] === '.opencode') {
          if (inner && inner.includes(parts[1])) return c;
        } else if (has(c)) return c;
      }
      return null;
    };
    const instructions = has('AGENTS.md') ? 'AGENTS.md'
      : (inner && inner.includes('AGENTS.md') ? '.opencode/AGENTS.md' : null);

    return {
      relPath,
      name: relPath ? relPath.split('/').pop() : (API.roots.find(r => r.id === rootId) || {}).name,
      configFile,
      dotOpencode,
      agentsDir: pick('.opencode/agents', 'agents'),
      skillsDir: pick('.opencode/skills', 'skills'),
      commandsDir: pick('.opencode/commands', 'commands'),
      themesDir: pick('.opencode/themes', 'themes'),
      pluginsDir: pick('.opencode/plugins', 'plugins'),
      instructionsFile: instructions
    };
  }

  /**
   * Walk every projects root concurrently.
   * opts: { depth, concurrency, shouldStop, onProgress }
   * Depth 2 only inspects the direct children — fast. Higher values walk
   * deeper and find monorepo packages.
   */
  async function scanProjects(opts) {
    opts = opts || {};
    const maxDepth = opts.depth || MAX_DEPTH;
    const concurrency = opts.concurrency || 12;
    const shouldStop = opts.shouldStop || (() => false);
    const onProgress = opts.onProgress || (() => { });

    const found = [];
    const seen = new Set();

    const accept = (info, rootId) => {
      const id = rootId + '::' + info.relPath;
      if (seen.has(id)) return;
      seen.add(id);
      found.push(Object.assign({ id, rootId }, info));
      onProgress(found.length);
    };

    // a queue of directories still to visit, per root
    const queues = [];
    for (const root of projectRoots()) {
      if (root.permission !== 'granted') continue;
      queues.push({ rootId: root.id, pending: [''] });
      const self = await inspectDir(root.id, '');
      if (self) accept(self, root.id);
    }

    let active = 0;
    // breadth-first: take the shallowest queued directory first
    const take = (q) => {
      if (!q.pending.length) return undefined;
      q.pending.sort((a, b) => a.split('/').length - b.split('/').length);
      return q.pending.shift();
    };

    const worker = async () => {
      while (true) {
        if (shouldStop()) return;
        // find any queue with work
        let q = null, rel = undefined;
        for (const cand of queues) {
          if (cand.pending.length) { q = cand; rel = take(cand); break; }
        }
        if (!q || rel === undefined) return;

        let entries = [];
        try {
          const { dir } = await resolve(q.rootId, rel ? rel + '/x' : '', false);
          for await (const [name, handle] of dir.entries()) entries.push({ name, kind: handle.kind });
        } catch (_) { continue; }

        for (const e of entries) {
          // build outputs, dist, node_modules and every dot-directory are noise
          if (e.kind !== 'directory' || SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
          const child = rel ? rel + '/' + e.name : e.name;
          const depth = child.split('/').length;
          try {
            const info = await inspectDir(q.rootId, child);
            if (info) accept(info, q.rootId);
          } catch (_) { /* unreadable folder: skip */ }
          if (depth < maxDepth) q.pending.push(child);
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.max(1, Math.min(concurrency, 32)); i++) workers.push(worker());
    await Promise.all(workers);

    API.projects = found.sort((a, b) => a.name.localeCompare(b.name));
    API.scannedAt = Date.now();
    return API.projects;
  }

  function projectById(id) { return API.projects.find(p => p.id === id) || null; }

  /** Where a project's config lives (may be a file or a folder entry). */
  function projectConfigPath(project) {
    if (!project || !project.configFile) return null;
    return project.configFile;
  }

  /**
   * Filesystem context for the configuration currently open in the store:
   * which root to talk to, and the folder prefix inside it.
   *   global scope  -> the opencode config dir, prefix ''
   *   project scope -> the project's root, prefix '<relative path>/'
   */
  function ctx() {
    const S = NS.store && NS.store.S;
    const scope = S && S.scope;
    if (scope && scope.kind === 'project' && scope.project) {
      const p = scope.project;
      return {
        rootId: p.rootId,
        prefix: p.relPath ? p.relPath + '/' : '',
        label: p.name,
        project: p
      };
    }
    const g = globalRoot();
    return g ? { rootId: g.id, prefix: '', label: g.name, project: null } : null;
  }

  /** Join a scope-relative folder with the current context prefix. */
  function join(prefix, rel) {
    const head = String(prefix == null ? '' : prefix).replace(/^\/+|\/+$/g, '');
    const tail = String(rel == null ? '' : rel).replace(/^\/+|\/+$/g, '');
    if (!tail) return head;
    if (!head) return tail;
    return head + '/' + tail;
  }

  NS.fs = {
    API, supported, addRoot, removeRoot, persist, restore, reauthorizeAll, needsPermission,
    globalRoot, projectRoots, scanProjects, projectById, projectConfigPath, inspectDir,
    readFile, writeFile, writeSafe, removePath, listDir, walkFiles, ensurePermission,
    ctx, join, PROJECT_CONFIG_FILES
  };
})(window.OCM);