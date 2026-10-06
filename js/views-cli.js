/* ============================================================
   views-cli.js — full cli.json surface (terminal-only settings)
   The router forces ST.target = 'cli' for every view here.
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u, F = NS.F, C = NS.C, ST = NS.store, S = ST.S;
  const { el } = u;

  const set = (path, value, enabledWhenTrue) => ST.edit(x => u.setOrDelete(x, path, value, enabledWhenTrue));
  const setRaw = (path, value) => ST.edit(x => u.setOrDelete(x, path, value));

  function head(root, icon, title, doc, desc) {
    root.appendChild(F.pageHead({
      icon, title, doc,
      desc: desc + ' هذه الإعدادات تؤثر على عميل الطرفية فقط وهي منفصلة عن إعدادات السيرفر في <code>opencode.json(c)</code>.',
      extra: el('span', { class: 'pill mono', text: 'cli.json' })
    }));
  }

  /* ---------------- appearance ---------------- */
  function cliAppearance(root) {
    head(root, '🎨', 'المظهر والثيم', 'themes', 'اختر الثيم وتحكّم في حركة الواجهة وشكل المؤشر.');
    const c = F.card({ title: 'الثيم' });
    c.body.appendChild(F.grid([
      F.field({ label: 'theme.name', value: u.get(S.data, 'theme.name', ''), placeholder: 'tokyonight', desc: 'ثيم مدمج أو مخصص أو مشتق من الطرفية', onChange: v => set('theme.name', v) }),
      F.field({ label: 'theme.mode', type: 'select', value: u.get(S.data, 'theme.mode', 'system'), options: C.CLI_THEME_MODES, desc: 'system يتبع الطرفية، dark/light يثبّته', onChange: v => set('theme.mode', v) }),
      F.field({ label: 'animations', type: 'bool', value: S.data.animations === true, desc: 'تفعيل حركات الواجهة', onChange: v => set('animations', v === true ? undefined : true) }),
      F.field({ label: 'cursor.style', type: 'select', value: u.get(S.data, 'cursor.style', 'default'), options: C.CLI_CURSOR_STYLES, desc: '<code>default</code> يبقي شكل مؤشر الطرفية', onChange: v => set('cursor.style', v) }),
      F.field({ label: 'cursor.blinking', type: 'bool', value: u.get(S.data, 'cursor.blinking', true), desc: 'لا تأثير له إذا كان style هو default', onChange: v => set('cursor.blinking', v === false ? undefined : true) })
    ], 'c2'));
    c.body.appendChild(el('div', { class: 'flex', style: { marginTop: '10px' } }, [
      F.btn('قائمة الثيمات المدمجة', { onClick: () => { ST.setTarget('cli'); NS.main.go('themes'); } })
    ]));
    root.appendChild(c.root);
  }

  /* ---------------- input ---------------- */
  function cliInput(root) {
    head(root, '⌨', 'الإدخال والتمرير', null, 'التقاط الفأرة، سرعة التمرير، سياق المحرر، اللصق، ومعاينة الصور.');
    const c = F.card({ title: 'التمرير والفأرة' });
    c.body.appendChild(F.grid([
      F.field({ label: 'mouse', type: 'bool', value: S.data.mouse === true, desc: 'تفعيل التقاط الفأرة في الطرفية', onChange: v => set('mouse', v === true ? undefined : true) }),
      F.field({ label: 'scroll.speed', type: 'number', min: 0.001, step: 0.5, value: u.get(S.data, 'scroll.speed'), desc: 'المسافة الثابتة لكل نبضة تمرير. الحد الأدنى 0.001', onChange: v => set('scroll.speed', v) }),
      F.field({ label: 'scroll.acceleration', type: 'bool', value: u.get(S.data, 'scroll.acceleration', true), desc: 'يتقدم على speed عند التفعيل', onChange: v => set('scroll.acceleration', v === false ? undefined : true) })
    ], 'c3'));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'مربع البرومبت' });
    c2.body.appendChild(F.grid([
      F.field({ label: 'prompt.editor', type: 'bool', value: u.get(S.data, 'prompt.editor', true), desc: 'تضمين ملف المحرر أو التحديد كسياق للبرومبت', onChange: v => set('prompt.editor', v === false ? undefined : true) }),
      F.field({ label: 'prompt.paste', type: 'select', value: u.get(S.data, 'prompt.paste', 'compact'), options: C.CLI_PASTE, desc: 'اللصقات الكبيرة: عنصر نائب مضغوط أو نص كامل', onChange: v => set('prompt.paste', v) }),
      F.field({ label: 'prompt.image_preview', type: 'bool', value: u.get(S.data, 'prompt.image_preview', true), desc: 'إظهار معاينات صور المرفقات فوق مربع الإدخال', onChange: v => set('prompt.image_preview', v === false ? undefined : true) })
    ], 'c3'));
    root.appendChild(c2.root);
  }

  /* ---------------- session ---------------- */
  function cliSession(root) {
    head(root, '💬', 'الجلسات', null, 'طريقة عرض جلسات الشاشة الكاملة ومكان بدء جلسة جديدة.');
    const E = C.CLI_SESSION_ENUMS;
    const c = F.card({ title: 'عرض الجلسة' });
    c.body.appendChild(F.grid([
      F.field({ label: 'session.sidebar', type: 'select', value: u.get(S.data, 'session.sidebar', 'auto'), options: E.sidebar, onChange: v => set('session.sidebar', v) }),
      F.field({ label: 'session.scrollbar', type: 'bool', value: u.get(S.data, 'session.scrollbar', true), onChange: v => set('session.scrollbar', v === false ? undefined : true) }),
      F.field({ label: 'session.thinking', type: 'select', value: u.get(S.data, 'session.thinking', 'show'), options: E.thinking, desc: 'إظهار تفكير النموذج افتراضياً', onChange: v => set('session.thinking', v) }),
      F.field({ label: 'session.grouping', type: 'select', value: u.get(S.data, 'session.grouping', 'auto'), options: E.grouping, desc: 'تجميع العناصر المترابطة أو عرض كل عنصر منفصلاً', onChange: v => set('session.grouping', v) }),
      F.field({ label: 'session.image_preview', type: 'bool', value: u.get(S.data, 'session.image_preview', true), desc: 'صور مرفقات المستخدم ونتائج الأدوات داخل السجل', onChange: v => set('session.image_preview', v === false ? undefined : true) }),
      F.field({ label: 'session.tps', type: 'bool', value: u.get(S.data, 'session.tps', true), desc: 'عرض توكنات الإخراج في الثانية', onChange: v => set('session.tps', v === false ? undefined : true) }),
      F.field({ label: 'session.markdown', type: 'select', value: u.get(S.data, 'session.markdown', 'rendered'), options: E.markdown, onChange: v => set('session.markdown', v) }),
      F.field({ label: 'session.new_location', type: 'select', value: u.get(S.data, 'session.new_location', 'launch'), options: E.new_location, desc: 'بدء الجلسة من مجلد إطلاق TUI أو وراثة موقع الجلسة النشطة', onChange: v => set('session.new_location', v) }),
      F.field({ label: 'session.permissions', type: 'select', value: u.get(S.data, 'session.permissions', 'prompt'), options: E.permissions, desc: '<code>autoaccept</code> يقبل كل طلبات الصلاحية تلقائياً', onChange: v => set('session.permissions', v) })
    ], 'c3'));
    if (u.get(S.data, 'session.permissions') === 'autoaccept') {
      c.body.appendChild(F.sectionNote('<b>تحذير:</b> <code>autoaccept</code> يقبل كل طلبات الصلاحية تلقائياً، متجاوزاً أسئلة الصلاحيات في الواجهة.', 'warn'));
    }
    root.appendChild(c.root);
  }

  /* ---------------- tabs ---------------- */
  function cliTabs(root) {
    head(root, '🗂', 'التبويبات', null, 'شريط تبويبات الجلسات الدائم.');
    const T = C.CLI_TABS;
    const legacy = S.data.tabs && typeof S.data.tabs === 'boolean';
    const c = F.card({ title: 'الإعدادات' });
    c.body.appendChild(F.grid([
      F.field({ label: 'tabs.mode', type: 'select', value: u.get(S.data, 'tabs.mode', legacy ? (S.data.tabs ? 'on' : 'off') : 'auto'), options: T.mode, desc: '<code>auto</code> يخفيها داخل Herdr', onChange: v => ST.edit(x => { if (u.isObj(x.tabs)) { x.tabs.mode = v; delete x.tabs.enabled; } else x.tabs = { mode: v }; }) }),
      F.field({ label: 'tabs.scope', type: 'select', value: u.get(S.data, 'tabs.scope', 'cwd'), options: T.scope, onChange: v => set('tabs.scope', v) }),
      F.field({ label: 'tabs.layout', type: 'select', value: u.get(S.data, 'tabs.layout', 'horizontal'), options: T.layout, onChange: v => set('tabs.layout', v) }),
      F.field({ label: 'tabs.indicators', type: 'select', value: u.get(S.data, 'tabs.indicators', 'status'), options: T.indicators, onChange: v => set('tabs.indicators', v) })
    ], 'c2'));
    if (legacy) c.body.appendChild(F.sectionNote('ملفك يستخدم <code>tabs.enabled</code> القديمة. القيمة <code>true</code> تعني <code>on</code> و <code>false</code> تعني <code>off</code>، وتُقرأ دون إعادة كتابة الملف. الحفظ هنا يحوّلها إلى <code>tabs.mode</code>.'));
    c.body.appendChild(F.hint('اختصارات Ctrl+رقم تعمل في الحالتين.'));
    root.appendChild(c.root);
  }

  /* ---------------- diffs ---------------- */
  function cliDiffs(root) {
    head(root, '🔀', 'الفروق (Diffs)', null, 'نطاق المراجعة الأولي وطريقة عرضه.');
    const D = C.CLI_DIFFS;
    const c = F.card({ title: 'الإعدادات' });
    c.body.appendChild(F.grid([
      F.field({
        label: 'diffs.source', type: 'select', value: u.get(S.data, 'diffs.source', 'branch'), options: D.source,
        hint: '<code>branch</code>: كل تغييرات الفرع والمحلي · <code>committed</code>: التزامات الفرع فقط · <code>working</code>: المُهيّأ وغير المُهيّأ وغير المتتبع · <code>turn</code>: ملفات آخر دورة (يتجدد بعد كل دورة ويسقط إلى <code>branch</code> خارج الجلسة).',
        onChange: v => set('diffs.source', v)
      }),
      F.field({ label: 'diffs.wrap', type: 'select', value: u.get(S.data, 'diffs.wrap', 'word'), options: D.wrap, onChange: v => set('diffs.wrap', v) }),
      F.field({ label: 'diffs.tree', type: 'bool', value: u.get(S.data, 'diffs.tree', true), desc: 'إظهار شجرة ملفات الفروق', onChange: v => set('diffs.tree', v === false ? undefined : true) }),
      F.field({ label: 'diffs.single', type: 'bool', value: u.get(S.data, 'diffs.single', false), desc: 'عرض رقعة الملف المحدد فقط', onChange: v => set('diffs.single', v === true ? undefined : true) }),
      F.field({ label: 'diffs.view', type: 'select', value: u.get(S.data, 'diffs.view', 'auto'), options: D.view, onChange: v => set('diffs.view', v) })
    ], 'c2'));
    c.body.appendChild(F.hint('داخل <code>/diff</code> اضغط <code>d</code> لتغيير النطاق أو اختيار فرع أساسي. هذه الاختيارات تنتهي مع TUI ولا تكتب في cli.json.'));
    root.appendChild(c.root);
  }

  /* ---------------- attention ---------------- */
  function cliAttention(root) {
    head(root, '🔔', 'التنبيهات والصوت', null, 'إشعارات النظام وأصوات التنبيه بشكل مستقل.');
    const at = S.data.attention || {};
    const c = F.card({ title: 'الإعدادات' });
    c.body.appendChild(F.grid([
      F.field({ label: 'attention.notifications', type: 'bool', value: at.notifications === true, desc: 'إشعارات النظام عادةً عندما لا تكون الطرفية مركّزة', onChange: v => set('attention.notifications', v === true ? undefined : true) }),
      F.field({ label: 'attention.sound', type: 'bool', value: at.sound === true, desc: 'تشغيل أصوات التنبيه', onChange: v => set('attention.sound', v === true ? undefined : true) }),
      F.field({ label: 'attention.volume', type: 'number', min: 0, max: 1, step: 0.05, value: at.volume, desc: 'من 0 إلى 1', onChange: v => set('attention.volume', v) }),
      F.field({ label: 'attention.sound_pack', value: at.sound_pack, placeholder: 'opencode.default', desc: 'معرّف حزمة الأصوات', onChange: v => set('attention.sound_pack', v) })
    ], 'c2'));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'أصوات مخصّصة لكل حدث', desc: 'مسارات ملفات .wav. تجاوز غير صالح أو غير قابل للقراءة يعود للصوت المدمج.' });
    const sounds = at.sounds || {};
    c2.body.appendChild(F.grid(C.CLI_SOUND_EVENTS.map(ev =>
      F.field({
        label: ev, value: sounds[ev], dir: 'ltr',
        placeholder: ev === 'default' ? 'opencode.default' : '',
        onChange: v => ST.edit(x => u.setOrDelete(x, ['attention', 'sounds', ev], v))
      })
    ), 'c3'));
    root.appendChild(c2.root);
  }

  /* ---------------- terminal ---------------- */
  function cliTerminal(root) {
    head(root, '🖥', 'الطرفية', null, 'تكامل الطرفية: العنوان والنسخ.');
    const c = F.card({ title: 'الإعدادات' });
    c.body.appendChild(F.grid([
      F.field({ label: 'terminal.title', type: 'bool', value: u.get(S.data, 'terminal.title', true), desc: 'تحديث عنوان نافذة الطرفية', onChange: v => set('terminal.title', v === false ? undefined : true) }),
      F.field({ label: 'terminal.copy', type: 'select', value: u.get(S.data, 'terminal.copy', 'manual'), options: ['manual', 'select'], desc: 'الافتراضي manual على Windows و select في بقية الأنظمة', onChange: v => set('terminal.copy', v) })
    ], 'c2'));
    root.appendChild(c.root);
  }

  /* ---------------- mini ---------------- */
  function cliMini(root) {
    head(root, '🧿', 'Mini', null, 'واجهة opencode mini التفاعلية المصغّرة.');
    const m = S.data.mini || {};
    const c = F.card({ title: 'العرض' });
    c.body.appendChild(F.grid([
      F.field({ label: 'mini.thinking', type: 'select', value: m.thinking || 'show', options: ['show', 'hide'], onChange: v => set('mini.thinking', v) }),
      F.field({ label: 'mini.tools', type: 'select', value: m.tools || 'show', options: ['show', 'hide'], desc: 'استدعاءات الأدوات والنص المصاحب لها', onChange: v => set('mini.tools', v) }),
      F.field({ label: 'mini.shell_output', type: 'select', value: m.shell_output || 'hide', options: ['show', 'hide'], desc: 'مخرجات الصدفة الخام', onChange: v => set('mini.shell_output', v) }),
      F.field({ label: 'mini.turn_summary', type: 'select', value: m.turn_summary || 'show', options: ['show', 'hide'], desc: 'ملخص الوكيل والنموذج والمدة', onChange: v => set('mini.turn_summary', v) }),
      F.field({ label: 'mini.footer', type: 'select', value: m.footer || 'show', options: ['show', 'hide'], desc: 'النشاط والنموذج والاستهلاك والسياق', onChange: v => set('mini.footer', v) }),
      F.field({ label: 'mini.splash', type: 'select', value: m.splash || 'show', options: ['show', 'hide'], desc: 'لافذتا الدخول والخروج', onChange: v => set('mini.splash', v) })
    ], 'c3'));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'السلوك' });
    c2.body.appendChild(F.grid([
      F.field({ label: 'mini.work_spinner', type: 'select', value: m.work_spinner || 'block-soft-slide', options: C.CLI_SPINNERS, desc: 'معرّف حركة العمل', onChange: v => set('mini.work_spinner', v) }),
      F.field({ label: 'mini.mono', type: 'bool', value: m.mono === true, desc: 'إخراج ASCII أحادي اللون', onChange: v => set('mini.mono', v === true ? undefined : true) }),
      F.field({ label: 'mini.replay', type: 'bool', value: m.replay === true, desc: 'استعادة سجل الجلسة عند الاستئناف أو تغيير حجم الطرفية', onChange: v => set('mini.replay', v === true ? undefined : true) }),
      F.field({ label: 'mini.replay_limit', type: 'number', min: 1, value: m.replay_limit, desc: 'يحدّ الاستعادة لأحدث الرسائل. الافتراضي 200', onChange: v => set('mini.replay_limit', v) })
    ], 'c2'));
    c2.body.appendChild(F.hint('رايات replay في سطر الأوامر تتجاوز هذه الإعدادات لهذا الاستدعاء.'));
    root.appendChild(c2.root);
  }

  /* ---------------- plugins ---------------- */
  function cliPlugins(root) {
    head(root, '🧱', 'إضافات الطرفية', 'plugins', 'إضافات تعمل فقط داخل عميل الطرفية وتبقى فعّالة عند الاتصال بسيرفر بعيد.');
    const list = Array.isArray(S.data.plugins) ? S.data.plugins : [];
    const c = F.card({ title: 'الإضافات', actions: [F.btn('إضافة', { size: 'sm', icon: '+', onClick: () => addCliPlugin() })] });
    if (!list.length) c.body.appendChild(el('div', { class: 'empty', text: 'لا توجد إضافات طرفية.' }));
    list.forEach((e, i) => {
      const isObj = u.isObj(e);
      const pkg = isObj ? e.package : e;
      c.body.appendChild(el('div', { class: 'list-row', style: { padding: '7px 0', borderBottom: '1px solid var(--border)' } }, [
        el('span', { class: 'pill mono', text: pkg }),
        el('div', { class: 'spacer' }),
        F.btn('↑', { size: 'sm', onClick: () => { ST.edit(x => { const a = x.plugins; const t = a[i - 1]; if (i > 0) { a[i - 1] = a[i]; a[i] = t; } }); NS.main.render(); } }),
        F.btn('↓', { size: 'sm', onClick: () => { ST.edit(x => { const a = x.plugins; const t = a[i + 1]; if (i < a.length - 1) { a[i + 1] = a[i]; a[i] = t; } }); NS.main.render(); } }),
        F.btn('✕', { size: 'sm', kind: 'danger', onClick: () => { ST.edit(x => { x.plugins.splice(i, 1); if (!x.plugins.length) delete x.plugins; }); NS.main.render(); } })
      ]));
    });
    root.appendChild(c.root);
    root.appendChild(F.sectionNote('إضافات السيرفر تُضبط في <code>opencode.json</code>. هذا القسم لإضافات الطرفية فقط.', 'warn'));
  }

  function addCliPlugin() {
    const p = u.el('input', { type: 'text', class: 'mono', dir: 'ltr', placeholder: 'opencode-acme-cli' });
    u.modal({
      title: 'إضافة إضافة طرفية',
      body: el('div', { class: 'field' }, [el('label', { text: 'الحزمة أو المسار' }), p]),
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'إضافة', kind: 'primary', close: false, onClick: () => {
            if (!p.value.trim()) return false;
            ST.edit(x => u.set(x, 'plugins', (x.plugins || []).concat([p.value.trim()])));
            u.closeModal(); NS.main.render();
          }
        }
      ]
    });
  }

  /* ---------------- keybinds ---------------- */
  function cliKeybinds(root) {
    head(root, '⌘', 'اختصارات المفاتيح', 'keybinds', 'تجاوز اختصار أمر واحد ومهلة مفتاح القائد.');
    const kb = u.isObj(S.data.keybinds) ? S.data.keybinds : {};

    const c = F.card({ title: 'القائد' });
    c.body.appendChild(F.grid([
      F.field({ label: 'keybinds.leader', value: kb.leader, placeholder: 'ctrl+x', desc: 'المفتاح المشار إليه بـ <code>&lt;leader&gt;</code> في الاختصارات الأخرى', onChange: v => set('keybinds.leader', v) }),
      F.field({ label: 'leader.timeout', type: 'number', min: 1, value: u.get(S.data, 'leader.timeout', 2000), desc: 'مللي ثانية للانتظار بعد مفتاح القائد', onChange: v => set('leader.timeout', v) })
    ], 'c2'));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'تجاوز الاختصارات', desc: 'القيمة نص، أو مصفوفة بدائل، أو كائن. استخدم <code>"none"</code> أو <code>false</code> لتعطيل اختصار.' });
    const wrap = el('div', {});
    const render = () => {
      u.clear(wrap);
      const cur = u.isObj(S.data.keybinds) ? S.data.keybinds : {};
      const keys = Object.keys(cur);
      if (!keys.length) wrap.appendChild(el('div', { class: 'empty', text: 'لا توجد تجاوزات — كل الاختصارات على قيمها الافتراضية.' }));
      keys.forEach(k => {
        const v = cur[k];
        const isStr = typeof v === 'string';
        const isArr = Array.isArray(v);
        const isBool = typeof v === 'boolean';
        const inp = el('input', { type: 'text', class: 'mono', dir: 'ltr', value: isStr ? v : isArr ? v.join(', ') : String(v) });
        inp.addEventListener('change', () => {
          const raw = inp.value.trim();
          ST.edit(x => {
            if (!u.isObj(x.keybinds)) x.keybinds = {};
            if (raw === 'false') x.keybinds[k] = false;
            else if (raw.includes(',')) x.keybinds[k] = raw.split(',').map(s => s.trim()).filter(Boolean);
            else x.keybinds[k] = raw;
          });
          NS.main.render();
        });
        wrap.appendChild(el('div', { class: 'list-row', style: { padding: '5px 0', borderBottom: '1px solid var(--border)' } }, [
          el('span', { class: 'pill mono', style: { minWidth: '150px' }, text: k }),
          inp,
          el('span', { class: 'pill ' + (isStr ? 'blue' : isArr ? 'purple' : isBool ? 'red' : ''), text: isStr ? 'نص' : isArr ? 'مصفوفة' : isBool ? 'معطّل' : 'كائن' }),
          F.btn('✕', { size: 'sm', kind: 'danger', onClick: () => { ST.edit(x => { if (x.keybinds) delete x.keybinds[k]; if (x.keybinds && !Object.keys(x.keybinds).length) delete x.keybinds; }); NS.main.render(); } })
        ]));
      });
      wrap.appendChild(el('div', { class: 'flex', style: { marginTop: '12px' } }, [
        F.btn('تجاوز جديد', { kind: 'primary', icon: '+', onClick: () => { ST.setTarget('cli'); NS.main.go('keybindPicker'); } })
      ]));
    };
    render();
    c2.body.appendChild(wrap);
    c2.body.appendChild(F.hint('كائن الاختصار يدعم <code>{ "key": "ctrl+v", "event": "press", "preventDefault": false, "fallthrough": false }</code>. مثال مع القائد: <code>"&lt;leader&gt;q"</code>.'));
    root.appendChild(c2.root);

    const c3 = F.card({ title: 'أوامر شائعة' });
    c3.body.appendChild(el('div', { class: 'tag-list' }, C.KEYBIND_COMMANDS.map(cmd =>
      el('button', {
        class: 'pill mono', style: { cursor: 'pointer' },
        onclick: async () => {
          const val = await u.promptBox('تجاوز ' + cmd, 'القيمة (نص، أو مفصولة بفواصل، أو none)', '');
          if (val == null) return;
          ST.edit(x => {
            if (!u.isObj(x.keybinds)) x.keybinds = {};
            if (!val.trim()) delete x.keybinds[cmd];
            else if (val.trim() === 'false') x.keybinds[cmd] = false;
            else if (val.includes(',')) x.keybinds[cmd] = val.split(',').map(s => s.trim()).filter(Boolean);
            else x.keybinds[cmd] = val.trim();
          });
          NS.main.render();
        }
      }, cmd))));
    root.appendChild(c3.root);
  }

  /* ---------------- debug ---------------- */
  function cliDebug(root) {
    head(root, '🐞', 'التشخيص والتجارب', null, 'تفعيل أدوات التشخيص أو الاشتراك في التجارب المتاحة.');
    const dbg = S.data.debug || {};
    const c = F.card({ title: 'Debug' });
    c.body.appendChild(F.grid([
      F.field({ label: 'debug.devtools', type: 'bool', value: dbg.devtools === true, desc: 'إظهار شريط تشخيص DevTools', onChange: v => set('debug.devtools', v === true ? undefined : true) }),
      F.field({ label: 'debug.timing', type: 'bool', value: dbg.timing === true, desc: 'تشخيص زمن أول رسم في شريط التصحيح', onChange: v => set('debug.timing', v === true ? undefined : true) }),
      F.field({
        label: 'debug.turn_tokens', type: 'select',
        value: dbg.turn_tokens === undefined ? 'false' : (dbg.turn_tokens === true ? 'true' : String(dbg.turn_tokens)),
        options: [{ id: 'false', label: 'false' }, { id: 'true', label: 'true' }, { id: 'verbose', label: 'verbose — يشمل وسائط استدعاءات الأدوات' }],
        onChange: v => set('debug.turn_tokens', v === 'false' ? undefined : v)
      })
    ], 'c3'));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'experimental', desc: 'خريطة معرّفات الميزات إلى قيم منطقية. استخدم فقط المعرّفات المعروضة حالياً في نافذة Experiments؛ المعرّفات المجهولة بلا أثر وقد تتغير أو تُحذف.' });
    c2.body.appendChild(F.kvEditor({
      value: u.isObj(S.data.experimental) ? S.data.experimental : {},
      keyPlaceholder: 'feature-id', valPlaceholder: 'true', addLabel: 'إضافة معرّف',
      hint: 'القيم المنطقية تُحفظ كنص؛ استخدم true/false بلا علامات اقتباس في محرر JSON الخام إن لزم.',
      onChange: v => ST.edit(x => {
        if (!Object.keys(v).length) delete x.experimental;
        else x.experimental = v;
      })
    }));
    root.appendChild(c2.root);
  }

  NS.views = NS.views || {};
  Object.assign(NS.views, {
    'cli-appearance': cliAppearance, 'cli-input': cliInput, 'cli-session': cliSession,
    'cli-tabs': cliTabs, 'cli-diffs': cliDiffs, 'cli-attention': cliAttention,
    'cli-terminal': cliTerminal, 'cli-mini': cliMini, 'cli-plugins': cliPlugins,
    'cli-keybinds': cliKeybinds, 'cli-debug': cliDebug
  });
})(window.OCM);