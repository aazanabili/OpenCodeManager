/* ============================================================
   main.js — router, navigation, folder binding, save/import/export
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u, F = NS.F, C = NS.C, ST = NS.store, S = ST.S;
  const { el, $ } = u;

  /* ---------------- navigation model ---------------- */
  const NAV = [
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
        { id: 'themes', icon: '🎭', label: 'الثيمات' },
        { id: 'raw', icon: '📝', label: 'محرر JSON الخام' }
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
        { id: 'cli-debug', icon: '🐞', label: 'التشخيص والتجارب' },
        { id: 'cli-raw', icon: '📝', label: 'محرر cli.json' }
      ]
    }
  ];

  const ALL_ITEMS = NAV.flatMap(g => g.items.map(i => Object.assign({}, i, { target: g.target })));

  function itemFor(id) { return ALL_ITEMS.find(i => i.id === id); }

  /* ---------------- navigation ---------------- */
  function go(id) {
    const it = itemFor(id);
    if (it && it.target !== S.target) ST.setTarget(it.target);
    if (id === 'cli-raw') id = 'raw';
    S.view = id;
    render();
    $('#main').scrollTop = 0;
    location.hash = id;
  }

  function buildNav(filter) {
    const nav = $('#nav');
    u.clear(nav);
    const q = (filter || '').toLowerCase().trim();
    NAV.forEach(group => {
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
          c ? el('span', { class: 'badge', text: String(c) }) : null
        ]));
      });
    });
  }

  /* ---------------- render ---------------- */
  function render() {
    buildNav($('#navSearch').value);
    const welcome = $('#welcome'), view = $('#view');
    if (!S.loaded) {
      welcome.hidden = false; view.hidden = true;
      $('#fsSupport').textContent = NS.fs.supported()
        ? 'متصفحك يدعم القراءة والكتابة المباشرة على القرص. كل شيء يبقى محلياً.'
        : '⚠ متصفحك لا يدعم File System Access API. استخدم Chrome أو Edge للكتابة المباشرة، أو استعمل الاستيراد/التصدير.';
      return;
    }
    welcome.hidden = true; view.hidden = false;
    u.clear(view);

    // sync target buttons
    document.querySelectorAll('.target-btn').forEach(b => b.classList.toggle('active', b.dataset.target === S.target));

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

  function updateButtons() {
    $('#btnUndo').disabled = !S.history.length;
    $('#btnRedo').disabled = !S.future.length;
    $('#btnSave').disabled = !S.loaded;
    $('#btnExport').disabled = !S.loaded;
    ST.updateScopeChip();
    renderFsStatus();
  }

  function renderFsStatus() {
    const box = $('#fsStatus'), title = $('#fsTitle'), desc = $('#fsDesc');
    if (!NS.fs.API.handle) {
      box.classList.remove('live');
      title.textContent = 'وضع عدم الاتصال';
      desc.textContent = 'استورد ملفاً أو افتح مجلداً للكتابة';
      return;
    }
    const live = NS.fs.API.permission === 'granted';
    box.classList.toggle('live', live);
    title.textContent = live ? 'مربوط: ' + NS.fs.API.name : 'مربوط (إذن مطلوب): ' + NS.fs.API.name;
    desc.textContent = live
      ? (S.origin && S.origin.fileName ? 'يكتب إلى ' + S.origin.fileName : 'مجلد متاح للقراءة والكتابة')
      : 'اضغط «فتح مجلد» لإعادة منح الإذن';
  }

  /* ---------------- folder binding ---------------- */
  let scopeCache = null;

  async function connect() {
    if (!NS.fs.supported()) {
      u.toast('المتصفح لا يدعم الكتابة المباشرة. استخدم Chrome/Edge أو الاستيراد.', 'warn', 6000);
      return;
    }
    try {
      const h = await NS.fs.connect();
      if (!h) return;
      scopeCache = await NS.fs.detect();
      await loadScope(scopeCache);
      u.toast('تم الربط بمجلد ' + h.name, 'ok');
    } catch (e) {
      console.error(e);
      u.toast('تعذّر الربط: ' + e.message, 'err');
    }
    render();
  }

  async function loadScope(scope) {
    if (!scope) return;
    const targetFile = S.target === 'cli' ? scope.cliPath : scope.cfgPath;
    if (!targetFile) {
      if (S.target === 'cli' && scope.cfgPath) {
        S.origin = { kind: 'fs', dirName: scope.files[0] ? NS.fs.API.name : NS.fs.API.name, fileName: null };
        ST.loadText('{}', S.origin);
        S.origin.fileName = null;
        u.toast('لا يوجد cli.json — أنشئه من قسم محرر cli.json أو احفظ مباشرة.', 'info');
        return;
      }
      const alt = S.target === 'cli' ? scope.cfgPath : scope.cliPath;
      u.toast('لا يوجد ' + (S.target === 'cli' ? 'cli.json' : 'opencode.json') + ' في هذا المجلد.' + (alt ? ' تم فتح ' + alt + ' بدلاً منه.' : ''), 'warn', 5000);
      if (alt) {
        ST.setTarget(alt.includes('cli') ? 'cli' : 'config');
        return loadScope(scope);
      }
      ST.loadText('{}', { kind: 'fs', dirName: NS.fs.API.name, fileName: null });
      return;
    }
    const text = (await NS.fs.read(targetFile)) || '{}';
    ST.loadText(text, { kind: 'fs', dirName: NS.fs.API.name, fileName: targetFile });
  }

  function targetFileFor(target) {
    if (S.origin && S.origin.kind === 'fs' && S.origin.fileName) return S.origin.fileName;
    if (target === 'cli') return 'cli.json';
    return scopeCache ? (scopeCache.cfgPath || 'opencode.json') : 'opencode.json';
  }

  /* ---------------- save ---------------- */
  async function save() {
    if (!S.loaded) { u.toast('لا يوجد ملف محمّل', 'warn'); return; }
    if (!NS.fs.API.handle) {
      download(S.target === 'cli' ? 'cli.json' : 'opencode.json', ST.serialize());
      u.toast('نزّل الملف — لم يكن هناك مجلد مربوط', 'info');
      return;
    }
    const okPerm = await NS.fs.reauthorize();
    if (!okPerm) { u.toast('لم يُمنح إذن الكتابة', 'err'); return; }
    const path = targetFileFor(S.target);
    try {
      const prev = await NS.fs.read(path);
      if (prev != null && prev !== ST.serialize()) ST.pushBackup(path, prev);
      await NS.fs.writeSafe(path, ST.serialize());
      S.origin = Object.assign({}, S.origin, { kind: 'fs', dirName: NS.fs.API.name, fileName: path });
      ST.markSaved();
      scopeCache = await NS.fs.detect();
      u.toast('حُفظ إلى ' + path, 'ok');
    } catch (e) {
      u.toast('فشل الحفظ: ' + e.message, 'err');
    }
    render();
  }

  /* ---------------- import / export ---------------- */
  function doImport() {
    const input = $('#fileInput');
    input.value = '';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const text = await f.text();
      try {
        ST.setTarget(f.name.includes('cli') ? 'cli' : 'config');
        ST.loadText(text, { kind: 'memory', dirName: 'استيراد', fileName: f.name });
        u.toast('استُورد ' + f.name + ' (' + u.bytes(text.length) + ')', 'ok');
        go(ST.target === 'cli' ? 'cli-appearance' : 'general');
      } catch (e) {
        u.toast('ملف غير صالح: ' + e.message + ' (سطر ' + (e.line || '?') + ')', 'err', 6000);
        // still show it raw so the user can fix it
        ST.setTarget(f.name.includes('cli') ? 'cli' : 'config');
        S.data = {}; S.comments = []; S.loaded = true; S.dirty = false;
        S.origin = { kind: 'memory', dirName: 'استيراد', fileName: f.name };
        S.history.length = 0; S.future.length = 0;
        go('raw');
      }
      render();
    };
    input.click();
  }

  function doExport() {
    if (!S.loaded) { u.toast('لا يوجد ملف', 'warn'); return; }
    const name = (S.origin && S.origin.fileName) || (S.target === 'cli' ? 'cli.json' : 'opencode.json');
    u.download(name, ST.serialize(), 'application/json;charset=utf-8');
    u.toast('نُزّل ' + name, 'ok');
  }

  /* ---------------- keybind picker view ---------------- */
  function keybindPicker(root) {
    root.appendChild(F.pageHead({
      icon: '⌘', title: 'إضافة تجاوز اختصار',
      desc: 'اختر أمراً ثم أدخل القيمة.'
    }));
    const c = F.card({ title: 'كل الأوامر', desc: 'القيمة يمكن أن نصاً، أو مصفوفة بدائل مفصولة بفواصل، أو <code>none</code> / <code>false</code> لتعطيل الاختصار.' });
    const grid = el('div', { class: 'grid c3' });
    C.KEYBIND_COMMANDS.forEach(cmd => {
      grid.appendChild(el('button', {
        class: 'btn sm mono', style: { justifyContent: 'flex-start' }, dir: 'ltr',
        onclick: async () => {
          const val = await u.promptBox('تجاوز ' + cmd, 'القيمة', '');
          if (val == null) return;
          ST.edit(x => {
            if (!u.isObj(x.keybinds)) x.keybinds = {};
            const v = val.trim();
            if (!v) delete x.keybinds[cmd];
            else if (v === 'false' || v === 'none') x.keybinds[cmd] = false;
            else if (v.includes(',')) x.keybinds[cmd] = v.split(',').map(s => s.trim()).filter(Boolean);
            else x.keybinds[cmd] = v;
          });
          go('cli-keybinds');
        }
      }, cmd));
    });
    c.body.appendChild(grid);
    root.appendChild(c.root);
    root.appendChild(el('div', { class: 'flex', style: { marginTop: '12px' } }, [
      F.btn('رجوع لاختصارات المفاتيح', { onClick: () => go('cli-keybinds') })
    ]));
  }
  NS.views.keybindPicker = keybindPicker;

  /* ---------------- boot ---------------- */
  function bind() {
    $('#btnConnect').addEventListener('click', connect);
    $('#btnConnect2').addEventListener('click', connect);
    $('#btnImport').addEventListener('click', doImport);
    $('#btnImport2').addEventListener('click', doImport);
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
        ST.setTarget(t);
        // load from disk if we have a bound folder and this file exists
        if (NS.fs.API.handle) {
          NS.fs.detect().then(async sc => {
            scopeCache = sc;
            const p = t === 'cli' ? sc.cliPath : sc.cfgPath;
            if (p && !(S.origin && S.origin.fileName === p)) {
              const text = await NS.fs.read(p);
              if (text != null) { ST.loadText(text, { kind: 'fs', dirName: NS.fs.API.name, fileName: p }); }
              else {
                ST.loadText('{}', { kind: 'fs', dirName: NS.fs.API.name, fileName: p });
                u.toast('لا يوجد ' + p + ' — سيُنشأ عند الحفظ', 'info');
              }
            }
            render();
          });
        } else render();
        go(t === 'cli' ? 'cli-appearance' : 'general');
      });
    });

    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (typing) return;
        e.preventDefault(); ST.undo(); render();
      }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        if (typing) return;
        e.preventDefault(); ST.redo(); render();
      }
      else if (e.key === 'Escape' && !$('#modalBackdrop').hidden) u.closeModal();
    });

    window.addEventListener('beforeunload', (e) => {
      if (S.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  async function boot() {
    bind();
    ST.on(() => updateButtons());

    // try to restore a previously bound folder
    if (NS.fs.supported()) {
      const ok = await NS.fs.restore();
      if (ok) {
        if (NS.fs.API.permission !== 'granted') {
          u.toast('مجلد محفوظ: ' + NS.fs.API.name + ' — انقر «فتح مجلد» لمنح الإذن مرة أخرى', 'info', 6000);
        }
        scopeCache = await NS.fs.detect();
        await loadScope(scopeCache);
      }
    }

    const hash = (location.hash || '').replace('#', '');
    const start = itemFor(hash) ? hash : (S.target === 'cli' ? 'cli-appearance' : 'general');
    S.view = start;
    if (!S.loaded) {
      u.clear($('#view'));
      $('#welcome').hidden = false;
      $('#view').hidden = true;
    } else render();

    window.addEventListener('hashchange', () => {
      const h = (location.hash || '').replace('#', '');
      if (h && h !== S.view) go(h);
    });
  }

  NS.main = { go, render, connect, save, updateButtons, buildNav };
  document.addEventListener('DOMContentLoaded', boot);
})(window.OCM);