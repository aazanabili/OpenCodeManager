/* ============================================================
   main.js — scope routing, project discovery, connect & save
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u, F = NS.F, C = NS.C, ST = NS.store, S = ST.S;
  const { el, $ } = u;

  /* ---------------- navigation model ---------------- */
  const GLOBAL_SECTIONS = [
    {
      title: 'إعدادات OpenCode', target: 'config', items: [
        { id: 'general', icon: '⚙', label: 'عام' },
        { id: 'agents', icon: '🤖', label: 'الوكلاء', count: () => Object.keys(ST.agents()).length },
        { id: 'permissions', icon: '🔐', label: 'الصلاحيات', count: () => (S.data.permissions || []).length },
        { id: 'policies', icon: '🛡', label: 'السياسات', count: () => u.get(S.data, 'experimental.policies', []).length },
        { id: 'mcp', icon: '🔌', label: 'خوادم MCP', count: () => Object.keys(u.get(S.data, 'mcp.servers', {})).length },
        { id: 'providers', icon: '🧠', label: 'المزوّدون والنماذج', count: () => Object.keys(u.isObj(S.data.providers) ? S.data.providers : {}).length },
        { id: 'skills', icon: '🧩', label: 'المهارات', count: () => (S.data.skills || []).length },
        { id: 'commands', icon: '⚡', label: 'الأوامر', count: () => Object.keys(u.isObj(S.data.commands) ? S.data.commands : {}).length },
        { id: 'plugins', icon: '🧱', label: 'الإضافات', count: () => (S.data.plugins || []).length },
        { id: 'formatters', icon: '🎨', label: 'المُنسِّقات', count: () => (u.isObj(S.data.formatter) ? Object.keys(S.data.formatter).length : (S.data.formatter ? 1 : 0)) },
        { id: 'references', icon: '📚', label: 'المراجع', count: () => Object.keys(u.isObj(S.data.references) ? S.data.references : {}).length },
        { id: 'instructions', icon: '📄', label: 'التعليمات' },
        { id: 'themes', icon: '🎭', label: 'الثيمات' }
      ]
    },
    {
      title: 'إعدادات الطرفية (cli.json)', target: 'cli', items: [
        { id: 'cli-appearance', icon: '🎨', label: 'المظهر' },
        { id: 'cli-input', icon: '⌨', label: 'الإدخال' },
        { id: 'cli-session', icon: '💬', label: 'الجلسات' },
        { id: 'cli-tabs', icon: '🗂', label: 'التبويبات' },
        { id: 'cli-diffs', icon: '🔀', label: 'الفروق' },
        { id: 'cli-attention', icon: '🔔', label: 'التنبيهات' },
        { id: 'cli-terminal', icon: '🖥', label: 'الطرفية' },
        { id: 'cli-mini', icon: '🧿', label: 'Mini' },
        { id: 'cli-plugins', icon: '🧱', label: 'إضافات الطرفية' },
        { id: 'cli-keybinds', icon: '⌘', label: 'اختصارات المفاتيح' },
        { id: 'cli-debug', icon: '🐞', label: 'التشخيص والتجارب' }
      ]
    }
  ];

  /** Sections valid for the current scope (cli.json is global-only). */
  function sectionsForScope() {
    return ST.isGlobal() ? GLOBAL_SECTIONS : [GLOBAL_SECTIONS[0]];
  }

  function allItems() {
    return sectionsForScope().flatMap(g => g.items.map(i => Object.assign({}, i, { target: g.target })));
  }
  function itemFor(id) { return allItems().find(i => i.id === id); }

  /* ---------------- navigation ---------------- */
  function go(id) {
    let it = itemFor(id);
    if (!it) it = itemFor('general');        // e.g. a cli view opened while inside a project
    id = it.id;
    if (it.target !== S.target) ST.switchDoc(S.scope, it.target);
    S.view = id;
    render();
    $('#main').scrollTop = 0;
    if (location.hash !== '#' + id) location.hash = id;
  }

  function buildNav(filter) {
    const nav = $('#nav');
    u.clear(nav);
    const q = (filter || '').toLowerCase().trim();
    sectionsForScope().forEach(group => {
      const items = group.items.filter(i => !q || i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
      if (!items.length) return;
      nav.appendChild(el('div', { class: 'nav-group-title', text: group.title }));
      items.forEach(i => {
        const c = i.count ? i.count() : null;
        nav.appendChild(el('button', {
          class: 'nav-item' + (S.view === i.id ? ' active' : ''),
          onclick: () => go(i.id)
        }, [
          el('span', { class: 'ico', text: i.icon }),
          el('span', { text: i.label }),
          (c != null && c > 0) ? el('span', { class: 'badge', text: String(c) }) : null
        ]));
      });
    });
  }

  /* ---------------- scope switcher ---------------- */
  function buildScopeList() {
    const box = $('#scopeList');
    u.clear(box);
    const globalRoot = NS.fs.globalRoot();
    const projects = NS.fs.API.projects || [];

    box.appendChild(el('div', { class: 'nav-group-title', text: 'نطاق الإعدادات' }));

    box.appendChild(el('button', {
      class: 'nav-item scope-item' + (ST.isGlobal() ? ' active' : ''),
      onclick: () => openGlobal()
    }, [
      el('span', { class: 'ico', text: '🌐' }),
      el('span', { class: 'scope-name', text: 'الإعدادات العامة' }),
      el('span', { class: 'scope-sub', text: globalRoot ? globalRoot.name : 'غير مربوطة' })
    ]));

    box.appendChild(el('div', { class: 'nav-group-title', text: 'المشاريع (' + projects.length + ')' }));
    if (!projects.length) {
      box.appendChild(el('div', { class: 'side-empty', text: 'لم يُعثر على مشاريع بعد.' }));
    }
    projects.forEach(p => {
      const active = S.scope && S.scope.kind === 'project' && S.scope.id === p.id;
      const dirty = ST.isGlobal() ? false : false;
      box.appendChild(el('button', {
        class: 'nav-item scope-item' + (active ? ' active' : ''),
        title: p.relPath || p.name,
        onclick: () => openProject(p.id)
      }, [
        el('span', { class: 'ico', text: '📁' }),
        el('span', { class: 'scope-name', text: p.name }),
        el('span', { class: 'scope-sub', text: p.configFile ? 'إعداد' : '.opencode' })
      ]));
    });

    box.appendChild(el('div', { class: 'side-actions' }, [
      F.btn('مجلد عام', { size: 'sm', icon: '🌐', onClick: () => addGlobalRoot() }),
      F.btn('مجلد مشاريع', { size: 'sm', icon: '📂', onClick: () => addProjectsRoot() }),
      F.btn('فحص', { size: 'sm', icon: '⟳', onClick: () => rescan() })
    ]));
  }

  /* ---------------- scope opening ---------------- */
  function openGlobal() {
    ST.switchDoc({ kind: 'global', label: 'الإعدادات العامة' }, ST.target === 'cli' ? 'cli' : 'config');
    S.globalData = null;
    render();
  }

  async function openProject(id) {
    const p = NS.fs.projectById(id);
    if (!p) { u.toast('المشروع غير موجود', 'err'); return; }
    const scope = { kind: 'project', id: p.id, label: p.name, project: p };
    ST.switchDoc(scope, 'config');

    // configFile is relative to the project folder; the root is the projects root
    const path = p.configFile ? NS.fs.join(p.relPath, p.configFile) : null;

    if (!path) {
      u.toast('لا يوجد ملف إعداد في ' + p.name + ' — سيُنشأ عند الحفظ.', 'info', 5000);
      render();
      return;
    }
    try {
      const okPerm = await NS.fs.ensurePermission(p.rootId);
      if (!okPerm) { u.toast('لم يُمنح إذن قراءة هذا المجلد', 'err'); return; }
      const text = await NS.fs.readFile(p.rootId, path);
      if (text == null) { u.toast('تعذّر قراءة ' + path, 'err'); render(); return; }
      try {
        ST.loadText(text, { kind: 'fs', rootId: p.rootId, fileName: path, projectId: p.id });
      } catch (e) {
        ST.loadText('{}', { kind: 'fs', rootId: p.rootId, fileName: path, projectId: p.id });
        u.toast('الملف غير صالح (' + e.message + ' سطر ' + (e.line || '?') + ') — عدّله ثم احفظ', 'err', 7000);
      }
    } catch (e) {
      u.toast('خطأ: ' + e.message, 'err');
    }
    S.globalData = readGlobalSnapshot();
    go('general');
  }

  /** Keep a parsed copy of the global config so project views can show inheritance. */
  function readGlobalSnapshot() {
    const buf = S.buffers['global:config'];
    return buf ? u.clone(buf.data) : null;
  }

  /* ---------------- roots ---------------- */
  async function addGlobalRoot() {
    try {
      const root = await NS.fs.addRoot('global');
      if (!root) return;
      await loadGlobal();
      u.toast('تم ربط الإعدادات العامة: ' + root.name, 'ok');
    } catch (e) { u.toast('تعذّر الربط: ' + e.message, 'err'); }
    render();
  }

  async function addProjectsRoot() {
    try {
      const root = await NS.fs.addRoot('projects');
      if (!root) return;
      await rescan(true);
      u.toast('تمت إضافة مجلد المشاريع: ' + root.name, 'ok');
    } catch (e) { u.toast('تعذّر الربط: ' + e.message, 'err'); }
    render();
  }

  async function loadGlobal() {
    const root = NS.fs.globalRoot();
    if (!root) return false;
    const ok = await NS.fs.ensurePermission(root.id);
    if (!ok) return false;

    // Land on the global document FIRST: loadText() writes into whatever
    // document is active, so switching afterwards would resurrect a stale buffer.
    ST.switchDoc({ kind: 'global', label: 'الإعدادات العامة' }, 'config');

    for (const cand of NS.fs.PROJECT_CONFIG_FILES) {
      const t = await NS.fs.readFile(root.id, cand);
      if (t != null) { ST.loadText(t, { kind: 'fs', rootId: root.id, fileName: cand }); break; }
    }
    if (!S.loaded) ST.loadText('{}', { kind: 'fs', rootId: root.id, fileName: 'opencode.json' });

    // cli.json is global-only
    const cliText = await NS.fs.readFile(root.id, 'cli.json');
    ST.loadBuffer('global:cli', cliText == null ? '{}' : cliText,
      { kind: 'fs', rootId: root.id, fileName: 'cli.json' });
    return true;
  }

  async function rescan(notify) {
    const list = await NS.fs.scanProjects();
    S.projects = list;
    if (notify) u.toast(list.length ? 'عُثر على ' + list.length + ' مشروع' : 'لم يُعثر على مشاريع في المجلدات المضافة', 'info');
    render();
    return list;
  }

  /* ---------------- render ---------------- */
  function render() {
    buildScopeList();
    buildNav($('#navSearch').value);
    const welcome = $('#welcome'), view = $('#view');
    if (!S.loaded) {
      welcome.hidden = false; view.hidden = true;
      updateFsSupportNote();
      updateButtons();
      return;
    }
    welcome.hidden = true; view.hidden = false;
    u.clear(view);

    document.querySelectorAll('.target-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.target === S.target);
      b.parentElement.hidden = !ST.isGlobal();
    });

    view.appendChild(scopeBanner());

    const fn = NS.views[S.view] || NS.views.general;
    try {
      fn(view, S);
    } catch (e) {
      console.error(e);
      view.appendChild(el('div', { class: 'err-box' }, 'حدث خطأ في عرض هذا القسم: ' + e.message));
      view.appendChild(el('pre', { class: 'snippet', text: (e.stack || '') }));
    }
    updateButtons();
  }

  /** The strip that always says which configuration you are editing. */
  function scopeBanner() {
    const global = ST.isGlobal();
    const project = ST.currentProject();
    const box = el('div', { class: 'scope-banner ' + (global ? 'is-global' : 'is-project') });

    box.appendChild(el('div', { class: 'sb-icon', text: global ? '🌐' : '📁' }));
    box.appendChild(el('div', { class: 'sb-text' }, [
      el('strong', { text: global ? 'الإعدادات العامة — تُطبَّق على كل المشاريع' : 'إعدادات المشروع: ' + (project ? project.label : '') }),
      el('span', {
        text: global
          ? 'أي تعديل هنا يسري على كل مشروع يفتحه OpenCode على هذا الجهاز.'
          : 'أي تعديل هنا يبقى داخل هذا المشروع فقط ولا يمسّ الإعدادات العامة.'
      })
    ]));
    if (!global && project) {
      box.appendChild(el('span', { class: 'pill mono sb-file', text: project.project && project.project.configFile ? project.project.configFile : 'لا يوجد ملف بعد' }));
    }
    return box;
  }

  function updateButtons() {
    $('#btnUndo').disabled = !S.history.length;
    $('#btnRedo').disabled = !S.future.length;
    $('#btnSave').disabled = !S.loaded;
    $('#btnExport').disabled = !S.loaded;
    ST.updateScopeChip();
    renderFsStatus();
  }

  function updateFsSupportNote() {
    const note = $('#fsSupport');
    if (!note) return;
    note.textContent = NS.fs.supported()
      ? 'امنح الإذن مرة واحدة لمجلد الإعدادات العامة ومجلدات مشاريعك،。之后 تُقرأ وتُحفظ التغييرات تلقائياً على القرص.'
      : '⚠ متصفحك لا يدعم الوصول للقرص. استخدم Chrome أو Edge.';
  }

  function renderFsStatus() {
    const box = $('#fsStatus'), title = $('#fsTitle'), desc = $('#fsDesc');
    if (!box) return;
    const roots = NS.fs.API.roots || [];
    if (!roots.length) {
      box.classList.remove('live');
      title.textContent = 'غير مربوط';
      desc.textContent = 'أضف مجلد الإعدادات العامة ومجلد مشاريعك';
      return;
    }
    const granted = roots.filter(r => r.permission === 'granted').length;
    box.classList.toggle('live', granted === roots.length && granted > 0);
    title.textContent = granted === roots.length
      ? roots.length + ' مجلد مربوط'
      : granted + '/' + roots.length + ' مجلد بصلاحية';
    desc.textContent = granted === roots.length
      ? 'القراءة والحفظ تلقائيان'
      : 'اضغط «فتح مجلد» لإعادة منح الإذن';
  }

  /* ---------------- save ---------------- */
  async function save() {
    if (!S.loaded) { u.toast('لا يوجد ملف محمّل', 'warn'); return; }
    if (!S.origin || S.origin.kind !== 'fs' || !S.origin.rootId) {
      doExport();
      return;
    }
    const ok = await NS.fs.ensurePermission(S.origin.rootId);
    if (!ok) { u.toast('لم يُمنح إذن الكتابة', 'err'); return; }
    const path = S.origin.fileName;
    try {
      const prev = await NS.fs.readFile(S.origin.rootId, path);
      if (prev != null && prev !== ST.serialize()) ST.pushBackup(path, prev);
      await NS.fs.writeSafe(S.origin.rootId, path, ST.serialize());
      ST.markSaved();
      if (ST.isGlobal()) S.globalData = null; else S.globalData = readGlobalSnapshot();
      u.toast('حُفظ إلى ' + path + (ST.isGlobal() ? ' (عام)' : ' — داخل المشروع فقط'), 'ok');
    } catch (e) {
      u.toast('فشل الحفظ: ' + e.message, 'err');
    }
    render();
  }

  /* ---------------- export ---------------- */
  function doExport() {
    if (!S.loaded) { u.toast('لا يوجد ملف', 'warn'); return; }
    const name = (S.origin && S.origin.fileName) || (S.target === 'cli' ? 'cli.json' : 'opencode.json');
    u.download(name, ST.serialize(), 'application/json;charset=utf-8');
    u.toast('نُزّل ' + name, 'ok');
  }

  /* ---------------- bind ---------------- */
  function bind() {
    $('#btnConnect').addEventListener('click', addGlobalRoot);
    $('#btnConnect2').addEventListener('click', addGlobalRoot);
    $('#btnImport').addEventListener('click', addGlobalRoot);
    $('#btnImport2').addEventListener('click', addGlobalRoot);
    $('#btnExport').addEventListener('click', doExport);
    $('#btnSave').addEventListener('click', save);
    $('#btnUndo').addEventListener('click', () => { ST.undo(); render(); });
    $('#btnRedo').addEventListener('click', () => { ST.redo(); render(); });
    $('#navSearch').addEventListener('input', u.debounce(() => buildNav($('#navSearch').value), 150));
    $('#modalClose').addEventListener('click', u.closeModal);
    $('#modalBackdrop').addEventListener('mousedown', (e) => { if (e.target.id === 'modalBackdrop') u.closeModal(); });

    document.querySelectorAll('.target-btn').forEach(b => {
      b.addEventListener('click', () => {
        const t = b.dataset.target;
        if (t === S.target) return;
        ST.switchDoc(S.scope, t);
        go(t === 'cli' ? 'cli-appearance' : 'general');
      });
    });

    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { if (typing) return; e.preventDefault(); ST.undo(); render(); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { if (typing) return; e.preventDefault(); ST.redo(); render(); }
      else if (e.key === 'Escape' && !$('#modalBackdrop').hidden) u.closeModal();
    });

    window.addEventListener('beforeunload', (e) => {
      const anyDirty = Object.keys(S.buffers).some(k => S.buffers[k] && S.buffers[k].dirty);
      if (anyDirty || S.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    bind();
    ST.on(() => updateButtons());

    if (!NS.fs.supported()) {
      render();
      return;
    }

    const restored = await NS.fs.restore();
    if (restored) {
      const need = NS.fs.needsPermission();
      if (need.length) {
        u.toast('بقي بحاجة إلى إذن لـ ' + need.length + ' مجلد — اضغط «فتح مجلد» للسماح.', 'warn', 8000);
      }
      await loadGlobal();
      await rescan(false);
    }
    render();

    window.addEventListener('hashchange', () => {
      const h = (location.hash || '').replace('#', '');
      if (h && h !== S.view) go(h);
    });
  }

  NS.main = { go, render, save, rescan, openProject, openGlobal, addGlobalRoot, addProjectsRoot, loadGlobal };
  document.addEventListener('DOMContentLoaded', boot);
})(window.OCM);