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
        { id: 'providers', icon: '🧠', label: 'النماذج والمزوّدون', count: () => (NS.Catalog ? NS.Catalog.status().providers : 0) },
        { id: 'skills', icon: '🧩', label: 'المهارات', count: () => (NS.skills ? NS.skills.list.length : 0) },
        { id: 'commands', icon: '⚡', label: 'الأوامر', count: () => Object.keys(u.isObj(S.data.commands) ? S.data.commands : {}).length },
        { id: 'plugins', icon: '🧱', label: 'الإضافات', count: () => (S.data.plugins || []).length },
        { id: 'formatters', icon: '🎨', label: 'المُنسِّقات', count: () => (u.isObj(S.data.formatter) ? Object.keys(S.data.formatter).length : (S.data.formatter ? 1 : 0)) },
        { id: 'references', icon: '📚', label: 'المراجع', count: () => Object.keys(u.isObj(S.data.references) ? S.data.references : {}).length },
        { id: 'instructions', icon: '📄', label: 'التعليمات' },
        { id: 'themes', icon: '🎭', label: 'الثيمات' }
      ]
    },
    {
      title: 'الطرفية — ما تراه كل يوم', target: 'cli', items: [
        { id: 'cli-appearance', icon: '🎨', label: 'المظهر والألوان' },
        { id: 'cli-session', icon: '💬', label: 'عرض الجلسة' },
        { id: 'cli-diffs', icon: '🔀', label: 'عرض الفروق' },
        { id: 'cli-input', icon: '⌨', label: 'الإدخال واللصق' }
      ]
    },
    {
      title: 'الطرفية — التنظيم والأدوات', target: 'cli', items: [
        { id: 'cli-tabs', icon: '🗂', label: 'التبويبات' },
        { id: 'cli-attention', icon: '🔔', label: 'التنبيهات والأصوات' },
        { id: 'cli-terminal', icon: '🖥', label: 'سلوك الطرفية' },
        { id: 'cli-mini', icon: '🧿', label: 'واجهة mini' }
      ]
    },
    {
      title: 'الطرفية — متقدم', target: 'cli', items: [
        { id: 'cli-keybinds', icon: '⌘', label: 'اختصارات المفاتيح' },
        { id: 'cli-plugins', icon: '🧩', label: 'إضافات الطرفية' },
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
    const roots = NS.fs.API.roots || [];

    if (!roots.length) {
      box.appendChild(el('div', { class: 'nav-group-title', text: 'نطاق الإعدادات' }));
      box.appendChild(el('div', { class: 'side-empty' }, [
        'لم تُربط أي مجلدات بعد. ',
        el('b', { text: 'اربط مجلد الإعدادات العامة' }),
        ' لتبدأ.'
      ]));
      box.appendChild(el('div', { class: 'side-actions' }, [
        F.btn('مجلد عام', { size: 'sm', icon: '🌐', onClick: () => quickPickDialog('global') }),
        F.btn('مجلد مشاريع', { size: 'sm', icon: '📂', onClick: () => quickPickDialog('projects') })
      ]));
      return;
    }

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
      box.appendChild(el('div', { class: 'side-empty', text: 'لم يُعثر على مشاريع بعد. أضف مجلد مشاريع أو اضغط فحص.' }));
    }
    projects.forEach(p => {
      const active = S.scope && S.scope.kind === 'project' && S.scope.id === p.id;
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
      F.btn('مجلد عام', { size: 'sm', icon: '🌐', onClick: () => quickPickDialog('global') }),
      F.btn('مجلد مشاريع', { size: 'sm', icon: '📂', onClick: () => quickPickDialog('projects') }),
      F.btn('فحص', { size: 'sm', icon: '⟳', title: 'إعادة فحص المشاريع', onClick: () => scanDialog() })
    ]));
  }

  /** Depth + concurrency are the two knobs that make discovery fast vs thorough. */
  function scanDialog() {
    let depth = 3, concurrency = 12;
    const info = u.el('div', { class: 'small dim', style: { marginBottom: '10px' } });
    const bar = u.el('div', { class: 'scan-bar' }, el('div', { class: 'scan-fill', style: { width: '0%' } }));
    const fill = bar.firstChild;

    const updateInfo = () => {
      const label = depth <= 2 ? 'سريع' : depth <= 5 ? 'متوازن' : 'عميق';
      info.textContent = 'عمق ' + depth + ' (' + label + ') · ' + concurrency + ' مجلدات متوازية';
    };

    const body = u.el('div', { class: 'grid' }, [
      info, bar,
      u.el('div', { class: 'field' }, [
        u.el('label', { text: 'عمق الفحص' }),
        u.el('input', {
          type: 'range', min: '1', max: '8', value: String(depth), dir: 'ltr',
          oninput: (e) => { depth = Number(e.target.value); updateInfo(); }
        })
      ]),
      u.el('div', { class: 'field' }, [
        u.el('label', { text: 'التوازي' }),
        u.el('input', {
          type: 'range', min: '4', max: '32', step: '2', value: String(concurrency), dir: 'ltr',
          oninput: (e) => { concurrency = Number(e.target.value); updateInfo(); }
        })
      ]),
      u.el('div', { class: 'info-box', html:
        'عمق 2 يجد المشاريع في المجلدات المباشرة فقط وهو الأسرع. عمق 4–5 مناسبmost للمونوريبو. ' +
        'عمق 8 يمرّ داخل node_modules ما لم يُتخطَّ — وهو أبطأ بكثير. ' +
        'نتخطّى دائماً <code>node_modules</code> و<code>.git</code> وكل المجلدات المخفية.' })
    ]);
    updateInfo();

    u.modal({
      title: 'فحص المشاريع',
      body,
      buttons: [
        { label: 'إغلاق', kind: 'ghost' },
        {
          label: 'ابدأ الفحص', kind: 'primary', close: false, onClick: async () => {
            u.closeModal();
            await rescanWithProgress({ depth, concurrency, fill });
          }
        }
      ]
    });
  }

  /** Scan with a live progress bar and the ability to stop. */
  async function rescanWithProgress(opts) {
    const fx = NS.fx;
    fx.loading(true);
    fx.scanNote('جارٍ الفحص…');

    const t0 = Date.now();
    const cancel = { off: false };
    const stop = fx.toast('info', 'جارٍ الفحص — اضغط للإيقاف', 60000, { progress: true });

    const controller = { cancel: () => { cancel.off = true; } };
    NS.main.cancelScan = controller;

    try {
      const list = await NS.fs.scanProjects({
        depth: opts.depth,
        concurrency: opts.concurrency,
        shouldStop: () => cancel.off,
        onProgress: (n) => {
          if (opts.fill) opts.fill.style.width = Math.min(100, n * 4) + '%';
          fx.scanNote('فحص… عُثر على ' + n + ' مشروع');
        }
      });
      S.projects = list;
      const ms = Date.now() - t0;
      if (cancel.off) fx.toast('warn', 'أُوقف الفحص — عُثر على ' + list.length + ' مشروع');
      else fx.toast('scan', list.length
        ? 'عُثر على ' + list.length + ' مشروع في ' + ms + ' مللي ثانية'
        : 'لم يُعثر على مشاريع', 3400);
    } catch (e) {
      fx.toast('err', 'فشل الفحص: ' + e.message);
    } finally {
      if (stop && stop.close) stop.close();
      fx.loading(false);
      NS.main.cancelScan = null;
      render();
    }
  }

  /* ---------------- scope opening ---------------- */
  function openGlobal() {
    ST.switchDoc({ kind: 'global', label: 'الإعدادات العامة' }, ST.target === 'cli' ? 'cli' : 'config');
    S.globalData = null;
    render();
  }

  async function openProject(id) {
    const p = NS.fs.projectById(id);
    if (!p) { u.toast('err', 'المشروع غير موجود'); return; }

    // instant feedback: show the target before the disk read finishes
    const scope = { kind: 'project', id: p.id, label: p.name, project: p };
    ST.switchDoc(scope, 'config');
    render();
    const fx = NS.fx;
    fx.scanNote('جارٍ قراءة ' + (p.configFile ? p.relPath + '/' + p.configFile.split('/').pop() : p.name) + '…');

    // configFile is relative to the project folder; the root is the projects root
    const path = p.configFile ? NS.fs.join(p.relPath, p.configFile) : null;

    if (!path) {
      fx.scanNote(null);
      u.toast('info', 'لا يوجد ملف إعداد في ' + p.name + ' — سيُنشأ عند الحفظ.', 5000);
      return;
    }
    try {
      const okPerm = await NS.fs.ensurePermission(p.rootId);
      if (!okPerm) { fx.scanNote(null); u.toast('err', 'لم يُمنح إذن قراءة هذا المجلد'); return; }
      const text = await NS.fs.readFile(p.rootId, path);
      if (text == null) {
        fx.scanNote(null);
        u.toast('err', 'تعذّر قراءة ' + path);
        render();
        return;
      }
      try {
        ST.loadText(text, { kind: 'fs', rootId: p.rootId, fileName: path, projectId: p.id });
      } catch (e) {
        ST.loadText('{}', { kind: 'fs', rootId: p.rootId, fileName: path, projectId: p.id });
        fx.scanNote(null);
        u.toast('err', 'الملف غير صالح (' + e.message + ' سطر ' + (e.line || '?') + ') — عدّله ثم احفظ', 7000);
        render();
        return;
      }
      fx.scanNote(null);
      const agents = Object.keys(ST.agents()).length;
      fx.toast('ok', agents ? agents + ' وكيل · ' + (S.data.permissions || []).length + ' قاعدة صلاحية'
        : 'لا توجد وكلاء أو صلاحيات في هذا المشروع', 2400);
    } catch (e) {
      fx.scanNote(null);
      u.toast('err', 'خطأ: ' + e.message);
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
      u.toast('ok', 'تم ربط الإعدادات العامة: ' + root.name);
    } catch (e) { u.toast('err', 'تعذّر الربط: ' + e.message); }
    render();
  }

  async function addProjectsRoot() {
    try {
      const root = await NS.fs.addRoot('projects');
      if (!root) return;
      await rescan(true);
      u.toast('ok', 'تمت إضافة مجلد المشاريع: ' + root.name);
    } catch (e) { u.toast('err', 'تعذّر الربط: ' + e.message); }
    render();
  }

  /**
   * A page cannot list drives, but it can tell you where they usually are and
   * open the system picker at a sensible starting point.
   */
  function quickPickDialog(kind) {
    const p = NS.OS.expectedPaths();
    const body = u.el('div', { class: 'grid' });

    body.appendChild(u.el('div', { class: 'info-box', html:
      'اكتشفنا نظامك: <b>' + u.esc(p.osLabel) + '</b>' + (p.arch ? ' · ' + u.esc(p.arch) : '') +
      '.<br>المسار المتوقع لإعدادات <span class="ltr">opencode</span> العامة: <code>' + u.esc(p.globalConfig) + '</code>' }));

    const userIn = u.el('input', { type: 'text', dir: 'ltr', placeholder: 'اسم المستخدم (اختياري)' });
    userIn.value = p.user || '';
    body.appendChild(u.el('div', { class: 'field' }, [
      u.el('label', { text: 'اسم المستخدم — يملأ المسارات أعلاه بدقة' }), userIn,
      u.el('span', { class: 'desc', text: 'المتصفح لا يستطيع كشفه تلقائياً؛ إن كتبته هنا نحفظه ونحدّث كل المسارات المقترحة.' })
    ]));

    const targets = kind === 'global'
      ? [{ label: 'مجلد الإعدادات العامة', path: p.globalConfig },
      { label: 'مجلد بيانات OpenCode (قد يحتوي auth.json)', path: p.dataDir }]
      : p.projectRoots.map(x => ({ label: 'مجلد مشاريع', path: x }));

    const grid = u.el('div', { class: 'quick-grid' });
    const refresh = () => {
      u.clear(grid);
      const cur = NS.OS.expectedPaths();
      const list = kind === 'global'
        ? [{ label: 'مجلد الإعدادات العامة', path: cur.globalConfig },
        { label: 'مجلد بيانات OpenCode', path: cur.dataDir }]
        : cur.projectRoots.map(x => ({ label: 'مجلد مشاريع', path: x }));
      list.forEach(t => {
        grid.appendChild(u.el('button', {
          class: 'quick-path', title: 'اضغط للنسخ · ' + t.path, dir: 'ltr',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(t.path);
              u.toast('ok', 'نُسخ المسار: ' + t.path, 2400);
            } catch (e) { u.toast('info', t.path, 4000); }
          }
        }, t.path));
      });
      grid.appendChild(u.el('button', {
        class: 'quick-path', title: 'فتح منتقي النظام',
        onclick: () => { u.closeModal(); (kind === 'global' ? addGlobalRoot : addProjectsRoot)(); }
      }, '📂 افتح منتقي النظام…'));
    };
    refresh();
    userIn.addEventListener('input', u.debounce(() => { NS.OS.saveUsername(userIn.value.trim()); refresh(); }, 300));

    body.appendChild(u.el('div', { class: 'field' }, [
      u.el('label', { text: kind === 'global' ? 'مسارات عامة متوقعة — انقر لنسخها' : 'مواقع مشاريع متوقعة — انقر لنسخها' }),
      grid
    ]));
    body.appendChild(u.el('div', { class: 'info-box', html:
      'الويب لا يستطيع قراءة المسارات أو سرد الأقراص. لذلك نعرض المسار المتوقع لتنتقل إليه في نافذة النظام، أو تستخدم زر «فتح منتقي النظام» وتوصل إلى المجلد بنفسك.' }));

    u.modal({
      title: kind === 'global' ? 'مجلد الإعدادات العامة' : 'مجلد المشاريع',
      body, wide: true,
      buttons: [{ label: 'إغلاق', kind: 'ghost' }]
    });
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
    const fx = NS.fx;
    fx.loading(true);
    const t0 = Date.now();
    let list;
    try {
      list = await NS.fs.scanProjects();
    } finally {
      fx.loading(false);
    }
    S.projects = list;
    if (notify) {
      fx.toast('scan',
        list.length ? 'عُثر على ' + list.length + ' مشروع في ' + (Date.now() - t0) + ' مللي ثانية'
          : 'لم يُعثر على مشاريع في المجلدات المضافة',
        2800);
    }
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
      ? 'امنح الإذن مرة واحدة لمجلد الإعدادات العامة ومجلدات مشاريعك، وبعدها تُقرأ وتُحفظ التغييرات تلقائياً على القرص.'
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
    if (!S.loaded) { u.toast('warn', 'لا يوجد ملف محمّل'); return; }
    if (!S.origin || S.origin.kind !== 'fs' || !S.origin.rootId) {
      doExport();
      return;
    }
    const fx = NS.fx;
    fx.saveState('saving');
    const ok = await NS.fs.ensurePermission(S.origin.rootId);
    if (!ok) { fx.saveState('idle'); u.toast('err', 'لم يُمنح إذن الكتابة'); return; }

    const path = S.origin.fileName;
    try {
      const prev = await NS.fs.readFile(S.origin.rootId, path);
      if (prev != null && prev !== ST.serialize()) ST.pushBackup(path, prev);
      await NS.fs.writeSafe(S.origin.rootId, path, ST.serialize());
      ST.markSaved();
      if (ST.isGlobal()) S.globalData = null; else S.globalData = readGlobalSnapshot();

      fx.saveState('saved');
      fx.toast('save', ST.isGlobal()
        ? 'الإعدادات العامة — تسري على كل المشاريع'
        : 'داخل هذا المشروع فقط', 2600);
      setTimeout(() => fx.saveState('idle'), 1700);
    } catch (e) {
      fx.saveState('idle');
      fx.toast('err', 'فشل الحفظ: ' + e.message, 6000);
    }
    render();
  }

  /* ---------------- export ---------------- */
  function doExport() {
    if (!S.loaded) { u.toast('warn', 'لا يوجد ملف'); return; }
    const name = (S.origin && S.origin.fileName) || (S.target === 'cli' ? 'cli.json' : 'opencode.json');
    u.download(name, ST.serialize(), 'application/json;charset=utf-8');
    u.toast('ok', 'نُزّل ' + name);
  }

  /* ---------------- bind ---------------- */
  function bind() {
    $('#btnConnect').addEventListener('click', addGlobalRoot);
    $('#btnConnect2').addEventListener('click', addGlobalRoot);
    $('#btnImport').addEventListener('click', addGlobalRoot);
    $('#btnImport2').addEventListener('click', addGlobalRoot);
    $('#btnExport').addEventListener('click', doExport);
    $('#btnSave').addEventListener('click', save);
    $('#btnUndo').addEventListener('click', () => { if (ST.undo()) { NS.fx.historyToast('undo'); render(); } });
    $('#btnRedo').addEventListener('click', () => { if (ST.redo()) { NS.fx.historyToast('redo'); render(); } });
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
      else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (typing) return;
        e.preventDefault();
        if (ST.undo()) NS.fx.historyToast('undo');
        render();
      }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        if (typing) return;
        e.preventDefault();
        if (ST.redo()) NS.fx.historyToast('redo');
        render();
      }
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

    // catalogue: bundled snapshot first, refresh in the background
    if (NS.Catalog) NS.Catalog.init().catch(() => { });

    if (!NS.fs.supported()) {
      render();
      return;
    }

    const restored = await NS.fs.restore();
    if (restored) {
      const need = NS.fs.needsPermission();
      if (need.length) {
        u.toast('warn', 'بقي بحاجة إلى إذن لـ ' + need.length + ' مجلد — اضغط «فتح مجلد» للسماح.', 8000);
      }
      await loadGlobal();
      await rescan(false);
    }
    if (NS.skills) NS.skills.discover({ remote: true }).catch(() => { });
    render();

    window.addEventListener('hashchange', () => {
      const h = (location.hash || '').replace('#', '');
      if (h && h !== S.view) go(h);
    });
  }

  NS.main = { go, render, save, rescan, openProject, openGlobal, addGlobalRoot, addProjectsRoot, loadGlobal };
  document.addEventListener('DOMContentLoaded', boot);
})(window.OCM);
