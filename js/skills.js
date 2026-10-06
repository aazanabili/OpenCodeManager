/* ================================================================
   skills.js — discover, inspect, control and author skills

   Sources, in OpenCode's own precedence order:
     1. global  ~/.config/opencode/skills
     2. compat   ~/.claude/skills, ~/.agents/skills
     3. project  <project>/.opencode/skills
     4. compat   <project>/.claude/skills, <project>/.agents/skills
     5. explicit `skills: [...]` entries — local folders or HTTP catalogs

   A skill ID comes from its path, never from the front-matter `name`.
   ================================================================ */
(function (NS) {
  'use strict';

  const u = NS.u;

  const cache = { list: [], scannedAt: 0, remote: [], remoteError: null };

  /** Folder names OpenCode looks in, relative to a project or global root. */
  const PROJECT_DIRS = ['.opencode/skills', '.claude/skills', '.agents/skills'];
  const GLOBAL_DIRS = ['skills'];

  /* ---------------- reading one source ---------------- */

  /** Read a skills directory (or a single *.md file) into skill records. */
  async function readDir(fs, rootId, prefix, dir, scope, rootLabel) {
    const out = [];
    const base = dir ? fs.join(prefix, dir) : prefix;

    let files;
    try {
      files = await fs.walkFiles(rootId, base, 6);
    } catch (_) { return out; }

    for (const full of files) {
      if (!/\.md$/i.test(full)) continue;
      const rel = base ? full.slice(base.length).replace(/^\//, '') : full;

      // `<id>/SKILL.md` and `<id>.md` are both valid; `<id>.md` at the root wins on form
      let id;
      if (/\/SKILL\.md$/i.test(rel)) id = rel.replace(/\/SKILL\.md$/i, '');
      else if (rel.split('/').length === 1 && !/SKILL/i.test(rel)) id = rel.replace(/\.md$/i, '');
      else continue;                         // nested plain .md is not a skill

      if (!id || id.includes('/')) continue;

      const text = await fs.readFile(rootId, full);
      if (text == null) continue;
      const fm = NS.jsonc.parseFrontmatter(text);
      const data = fm.data || {};
      // `opencode/autoinvoke: false` lives under `metadata`
      const metaAuto = u.isObj(data.metadata) ? String(data.metadata['opencode/autoinvoke']) : '';
      const auto = metaAuto === 'false' || String(data.autoinvoke) === 'false' || data.disableModelInvocation === true;

      out.push({
        id,
        dirId: id.split('/').pop(),
        name: data.name || id,
        description: data.description || '',
        body: fm.body || '',
        file: full,
        dir: dir,
        scope,                                  // 'global' | 'project'
        source: rootLabel,
        autoinvoke: auto,
        hasScripts: /(^|\/)(scripts|bin)\//i.test(full),
        editable: true
      });
    }
    return out;
  }

  /** Fetch an HTTP catalogue: <base>/index.json then <base>/<name>/<file>. */
  async function readRemote(url) {
    const base = String(url).replace(/\/+$/, '');
    const res = await fetch(base + '/index.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const idx = await res.json();
    const entries = Array.isArray(idx) ? idx : (idx.skills || []);
    const out = [];

    for (const entry of entries.slice(0, 60)) {
      const name = entry.name || entry.id;
      if (!name) continue;
      let text = '';
      const files = Array.isArray(entry.files) ? entry.files : [name + '.md'];
      const entryFile = files.find(f => /SKILL\.md$/i.test(f)) || files.find(f => /\.md$/i.test(f));
      if (entryFile) {
        try {
          const r = await fetch(base + '/' + name + '/' + entryFile);
          if (r.ok) text = await r.text();
        } catch (_) { /* keep the entry with no body */ }
      }
      const fm = NS.jsonc.parseFrontmatter(text);
      const data = fm.data || {};
      out.push({
        id: name,
        dirId: name.split('/').pop(),
        name: data.name || name,
        description: data.description || '',
        body: fm.body || '',
        file: base + '/' + name + '/' + (entryFile || ''),
        dir: null,
        scope: 'remote',
        source: base,
        version: entry.version || '',
        autoinvoke: String(data.autoinvoke) === 'false' || data.disableModelInvocation === true,
        hasScripts: false,
        editable: false
      });
    }
    return out;
  }

  /* ---------------- full scan ---------------- */
  async function discover(opts) {
    opts = opts || {};
    const nsfs = NS.fs;
    const local = [];
    const remote = [];
    const errors = [];

    /* global root */
    const g = nsfs.globalRoot();
    if (g && g.permission === 'granted') {
      for (const dir of GLOBAL_DIRS) {
        try { local.push(...await readDir(nsfs, g.id, '', dir, 'global', g.name)); } catch (e) { errors.push(e.message); }
      }
      const entries = local.filter(s => s.scope === 'global').map(s => s.source);
      void entries;
    }

    /* current project (if we are inside one) */
    const ctx = nsfs.ctx();
    if (ctx && ctx.project) {
      for (const dir of PROJECT_DIRS) {
        try { local.push(...await readDir(nsfs, ctx.rootId, ctx.prefix, dir, 'project', ctx.label)); } catch (e) { errors.push(e.message); }
      }
    }

    /* explicit `skills` entries from the open config */
    const configured = (NS.store.S.data && NS.store.S.data.skills) || [];
    for (const entry of configured) {
      const s = String(entry || '').trim();
      if (!s) continue;
      if (/^https?:\/\//i.test(s)) {
        if (opts.remote === false) continue;
        try { remote.push(...await readRemote(s)); }
        catch (e) { errors.push(s + ' → ' + e.message); }
      } else {
        // a folder path: resolve it against the scope root we hold
        const root = ctx || (g ? { rootId: g.id, prefix: '', label: g.name } : null);
        if (!root) continue;
        try { local.push(...await readDir(nsfs, root.rootId, root.prefix, s, 'external', s)); }
        catch (e) { errors.push(s + ' → ' + e.message); }
      }
    }

    /* de-duplicate by ID, later sources win (OpenCode's precedence) */
    const byId = new Map();
    local.forEach(s => byId.set(s.id, s));
    const list = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));

    cache.list = list;
    cache.remote = remote;
    cache.remoteError = errors.length ? errors.join(' · ') : null;
    cache.scannedAt = Date.now();
    return cache;
  }

  function byId(id) { return cache.list.find(s => s.id === id) || null; }

  /* ---------------- authoring ---------------- */
  const TEMPLATES = {
    generic: {
      label: 'مهارة عامة',
      body: '## Workflow\n\n1. صف ما يجب فعله بالترتيب.\n2. حدّد الأدوات والملفات involved.\n3. تحقّق من النتيجة قبل الانتهاء.\n'
    },
    review: {
      label: 'مراجعة كود',
      body: '## Workflow\n\n1. اقرأ التغييرات مع `git diff`.\n2. رتّب الملاحظات حسب الخطورة.\n3. اذكر الملف والسطر لكل ملاحظة.\n4. لا تعدّل أي ملف.\n'
    },
    release: {
      label: 'إصدار نسخة',
      body: '## Workflow\n\n1. اقرأ `references/release-policy.md`.\n2. لخّص التغييرات المدمجة منذ آخر وسم.\n3. اقترح رقم الإصدار قبل أي تعديل.\n4. شغّل `scripts/changelog.ts` بعد موافقة المستخدم.\n'
    },
    test: {
      label: 'كتابة اختبارات',
      body: '## Workflow\n\n1. حدّد السلوك المطلوب من الكود.\n2. اكتب الاختبار قبل الإصلاح.\n3. شغّل الاختبار وتأكد من الفشل ثم النجاح.\n'
    }
  };

  function suggestBody(template) {
    return (TEMPLATES[template] || TEMPLATES.generic).body;
  }

  function slugOk(id) { return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id); }

  /** Where a new skill would live inside the current scope. */
  function targetDir() {
    const ctx = NS.fs.ctx();
    if (!ctx) return null;
    const dir = (ctx.project && ctx.project.skillsDir) || 'skills';
    return { rootId: ctx.rootId, full: NS.fs.join(ctx.prefix, dir), dir, label: ctx.label };
  }

  NS.skills = {
    discover, byId, TEMPLATES, suggestBody, slugOk, targetDir,
    cache,
    get list() { return cache.list; },
    get remote() { return cache.remote; },
    get error() { return cache.remoteError; },
    get scannedAt() { return cache.scannedAt; }
  };
})(window.OCM);