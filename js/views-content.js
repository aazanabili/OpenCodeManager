/* ============================================================
   views-content.js — Skills · Commands · Plugins · Formatters
                       · Themes · References · Instructions
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u, F = NS.F, C = NS.C, ST = NS.store, S = ST.S;
  const { el } = u;

  const H = () => NS.helpers;

/* ===============================================================
     SKILLS — discovery, control and authoring
     =============================================================== */
  function viewSkills(root) {
    const d = S.data;
    const SK = NS.skills;
    const isProject = !ST.isGlobal();

    root.appendChild(F.pageHead({
      icon: '🧩', title: 'المهارات', doc: 'skills',
      count: SK.list.length + (SK.remote.length || ''),
      desc: 'تعليمات قابلة لإعادة الاستخدام لمهمة محددة. يعرضها OpenCode للنموذج حسب صلاحيتها، ثم يحمّلها بأداة <code>skill</code> عند الحاجة. المعرّف يأتي من المسار لا من اسم العرض.',
      actions: [
        F.btn('فحص', { icon: '⟳', onClick: async (e) => {
          e.currentTarget.classList.add('saving');
          await SK.discover({ remote: true });
          e.currentTarget.classList.remove('saving');
          NS.main.render();
        } }),
        F.btn('مهارة جديدة', { kind: 'primary', icon: '+', onClick: () => skillWizard() })
      ]
    }));

    /* ---------- extra sources configured by the user ---------- */
    const c0 = F.card({
      title: 'مصادر إضافية',
      desc: 'مجلدات محلية أو كتالوجات HTTP. تُدمج مع ما يكتشفه OpenCode تلقائياً ولا تستبدله.'
    });
    c0.body.appendChild(F.listEditor({
      items: d.skills || [], placeholder: './team-skills  أو  https://example.com/opencode/skills/',
      addLabel: 'إضافة مصدر', emptyText: 'لا توجد مصادر إضافية — الاكتشاف التلقائي كافٍ',
      hint: 'المسار النسبي يُحل من مجلد العمل النشط · <code>~/</code> من مجلد المستخدم · <code>http(s)://</code> كتالوج يحتوي <code>index.json</code>.',
      onChange: v => { ST.edit(x => u.setOrDelete(x, 'skills', v)); }
    }));
    root.appendChild(c0.root);

    /* ---------- discovered skills ---------- */
    const c1 = F.card({
      title: 'المهارات المكتشفة',
      desc: SK.scannedAt ? 'آخر فحص: ' + new Date(SK.scannedAt).toLocaleString('ar') : 'لم يُفحص بعد'
    });

    if (SK.error) c1.body.appendChild(el('div', { class: 'warn-box', html: 'تعذّر الوصول إلى: ' + u.esc(SK.error) }));

    if (!SK.list.length && !SK.remote.length) {
      c1.body.appendChild(el('div', { class: 'empty' },
        'لم يُعثر على مهارات. يبحث OpenCode تلقائياً في: .opencode/skills و .claude/skills و .agents/skills — تأكد أن المجلد مربوط或在ه.'));
    }

    if (SK.list.length) {
      const grid = el('div', { class: 'sk-grid' });
      SK.list.forEach(s => grid.appendChild(skillCard(s)));
      c1.body.appendChild(grid);
    }

    if (SK.remote.length) {
      c1.body.appendChild(el('div', { class: 'divider' }));
      c1.body.appendChild(el('h4', { class: 'small', text: 'من كتالوجات HTTP (' + SK.remote.length + ')' }));
      const grid2 = el('div', { class: 'sk-grid', style: { marginTop: '10px' } });
      SK.remote.forEach(s => grid2.appendChild(skillCard(s, true)));
      c1.body.appendChild(grid2);
    }
    root.appendChild(c1.root);

    /* ---------- permission gate for skills ---------- */
    const c2 = F.card({
      title: 'صلاحيات المهارات',
      desc: 'تحكّم في أي مهارة يستطيع الوكيل عرضها وتحميلها.'
    });
    const hasRules = (d.permissions || []).some(r => r.action === 'skill');
    if (!hasRules) {
      c2.body.appendChild(el('div', { class: 'info-box', html: 'لا توجد قواعد <code>skill</code> — يُسمح بكل المهارات التي لها <code>description</code>.' }));
    }
    c2.body.appendChild(F.btn('فتح قسم الصلاحيات', { onClick: () => NS.main.go('permissions') }));
    if (SK.list.length) {
      c2.body.appendChild(el('div', { class: 'flex wrap', style: { marginTop: '10px' } },
        [F.btn('اسمح بكل المهارات', {
          size: 'sm', onClick: () => {
            ST.edit(x => u.set(x, 'permissions', (x.permissions || []).concat([{ action: 'skill', resource: '*', effect: 'allow' }])));
            NS.main.go('permissions');
          }
        }), F.btn('امنع كل المهارات', {
          size: 'sm', kind: 'danger', onClick: () => {
            ST.edit(x => u.set(x, 'permissions', (x.permissions || []).concat([{ action: 'skill', resource: '*', effect: 'deny' }])));
            NS.main.go('permissions');
          }
        })]));
    }
    root.appendChild(c2.root);

    /* ---------- how it works ---------- */
    const c3 = F.card({ title: 'كيف تعمل المهارات' });
    c3.body.appendChild(F.hint(
      'المعرّف من المسار: <code>&lt;source&gt;/git-release/SKILL.md</code> ⇒ <code>git-release</code>، و <code>&lt;source&gt;/review.md</code> ⇒ <code>review</code>. ' +
      'الاسم في frontmatter مجرد تسمية عرض.'));
    c3.body.appendChild(F.hint(
      'بدون <code>description</code> لا تُعرض المهارة للنموذج إطلاقاً. ' +
      'و <code>opencode/autoinvoke: false</code> يخفيها من القائمة مع بقائها قابلة للتحميل بالـ ID — و <code>disable-model-invocation: true</code> له نفس الأثر، و <code>opencode/autoinvoke</code> هو الأسبق عند وجودهما معاً.'));
    c3.body.appendChild(el('pre', { class: 'snippet', style: { marginTop: '12px' }, html: u.esc(`---
name: Git Release
description: Prepare release notes, version bumps, and GitHub releases
metadata:
  opencode/autoinvoke: false
---

## Workflow

1. Read \`references/release-policy.md\`.
2. Summarize merged changes since the previous tag.
3. Propose the version bump before changing files.`) }));
    root.appendChild(c3.root);
  }

  function skillCard(s, isRemote) {
    const card = el('div', { class: 'sk-card' + (isRemote ? ' remote' : '') }, [
      el('div', { class: 'sk-name' }, [
        el('span', { class: 'sk-id', text: s.id }),
        s.autoinvoke ? el('span', { class: 'pill amber', text: 'مخفية' }) : null
      ].filter(Boolean)),
      el('div', { class: 'small', style: { color: 'var(--text-2)', fontWeight: '600' }, text: s.name }),
      el('div', { class: 'sk-desc', text: s.description || 'بلا وصف — لن يعرضها OpenCode للنموذج.' }),
      el('div', { class: 'sk-src', text: (isRemote ? '🌐 ' : (s.scope === 'project' ? '📁 ' : '🌐 ')) + (s.dir || s.source) }),
      el('div', { class: 'flex wrap' }, [
        s.hasScripts ? el('span', { class: 'pill', text: 'يحوي سكربتات' }) : null,
        s.version ? el('span', { class: 'pill mono', text: 'v' + s.version }) : null,
        isRemote
          ? el('button', { class: 'btn ghost sm', onclick: () => showSkill(s) }, 'عرض')
          : el('button', { class: 'btn ghost sm', onclick: () => NS.fileviews.editMarkdown(s.file, 'skill') }, 'تحرير'),
        !isRemote ? el('button', {
          class: 'btn ghost sm', title: 'إخفاء من قائمة النموذج',
          onclick: async () => {
            const FS = NS.fs, ctx = FS.ctx();
            const text = (await FS.readFile(ctx.rootId, s.file)) || '';
            const fm = NS.jsonc.parseFrontmatter(text);
            const data = u.clone(fm.data);
            const off = s.autoinvoke;                 // currently hidden -> make visible
            if (u.isObj(data.metadata)) {
              delete data.metadata['opencode/autoinvoke'];
              if (!Object.keys(data.metadata).length) delete data.metadata;
            }
            delete data.autoinvoke;
            if (!off) {
              if (!u.isObj(data.metadata)) data.metadata = {};
              data.metadata['opencode/autoinvoke'] = 'false';
            }
            await FS.writeSafe(ctx.rootId, s.file, NS.jsonc.composeFile(data, fm.body));
            await NS.skills.discover({ remote: false });
            u.toast('ok', off ? 'أُعيد عرض المهارة للنموذج' : 'أُخفيت المهارة من قائمة النموذج');
            NS.main.render();
          }
        }, s.autoinvoke ? 'إظهار للنموذج' : 'إخفاء') : null
      ].filter(Boolean))
    ]);
    return card;
  }

  function showSkill(s) {
    u.modal({
      title: s.name + '  ·  ' + s.id, wide: true,
      body: el('div', {}, [
        el('div', { class: 'small dim', style: { marginBottom: '12px' }, text: s.file }),
        el('div', { class: 'md-preview', style: { maxHeight: '52vh' }, html: u.mdToHtml(s.body) })
      ]),
      buttons: [{ label: 'إغلاق', kind: 'ghost' }]
    });
  }

  /* ---------------- authoring wizard ---------------- */
  function skillWizard() {
    const target = NS.skills.targetDir();
    if (!target) { u.toast('warn', 'اربط مجلداً أولاً لتحديد مكان إنشاء المهارة.'); return; }

    const idIn = u.el('input', { type: 'text', class: 'mono', dir: 'ltr', placeholder: 'my-skill' });
    const nameIn = u.el('input', { type: 'text', placeholder: 'اسم العرض' });
    const descIn = u.el('input', { type: 'text', placeholder: 'متى يستخدم النموذج هذه المهارة؟' });
    const autoIn = u.el('input', { type: 'checkbox' });
    const bodyTa = u.el('textarea', { rows: 12, dir: 'ltr' });
    bodyTa.value = NS.skills.suggestBody('generic');
    const preview = el('div', { class: 'md-preview', html: u.mdToHtml(bodyTa.value) });
    bodyTa.addEventListener('input', u.debounce(() => { preview.innerHTML = u.mdToHtml(bodyTa.value); }, 300));

    const err = u.el('div', { class: 'field-error hidden' });
    idIn.addEventListener('input', () => {
      const v = idIn.value.trim();
      if (!v) return err.classList.add('hidden');
      if (!NS.skills.slugOk(v)) {
        u.clear(err); err.appendChild(document.createTextNode('استخدم أحرفاً صغيرة وأرقاماً وشرطات فقط، مثل git-release'));
        err.classList.remove('hidden');
      } else if (NS.skills.byId(v)) {
        u.clear(err); err.appendChild(document.createTextNode('يوجد مهارة بنفس المعرّف'));
        err.classList.remove('hidden');
      } else err.classList.add('hidden');
    });

    const templates = u.el('div', { class: 'flex wrap' });
    Object.entries(NS.skills.TEMPLATES).forEach(([k, t]) => {
      templates.appendChild(u.el('button', {
        class: 'btn ghost sm', onclick: () => { bodyTa.value = t.body; preview.innerHTML = u.mdToHtml(t.body); }
      }, t.label));
    });

    u.modal({
      title: 'مهارة جديدة', wide: true,
      body: u.el('div', { class: 'grid' }, [
        u.el('div', { class: 'info-box', html: 'ستُنشأ في <code>' + u.esc(target.full + '/&lt;id&gt;/SKILL.md') + '</code> داخل نطاق <b>' + u.esc(target.label) + '</b>.' }),
        u.el('div', { class: 'grid c2' }, [
          u.el('div', { class: 'field' }, [u.el('label', { text: 'المعرّف (مجلد صغير بأحرف إنجليزية وأرقام وشرطات)' }), idIn, err]),
          u.el('div', { class: 'field' }, [u.el('label', { text: 'اسم العرض' }), nameIn])
        ]),
        u.el('div', { class: 'field' }, [u.el('label', { text: 'الوصف — يظهر للنموذج ليقرر متى يستخدم المهارة' }), descIn]),
        u.el('div', { class: 'field inline' }, [
          u.el('label', { text: 'إخفاؤها من قائمة النموذج (تبقى قابلة للتحميل بالـ ID)' }),
          u.el('label', { class: 'switch' }, [autoIn, u.el('span', { class: 'slider' })])
        ]),
        u.el('div', { class: 'field' }, [
          u.el('label', { text: 'المحتوى' }), templates,
          u.el('div', { class: 'md-editor', style: { marginTop: '8px' } }, [bodyTa, preview])
        ])
      ]),
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'إنشاء المهارة', kind: 'primary', close: false, onClick: async () => {
            const id = idIn.value.trim();
            if (!id) { u.toast('err', 'أدخل معرّفاً'); return false; }
            if (!NS.skills.slugOk(id)) { u.toast('err', 'المعرّف يجب أن يكون بأحرف صغيرة وأرقام وشرطات'); return false; }
            if (NS.skills.byId(id)) { u.toast('err', 'يوجد مهارة بنفس المعرّف'); return false; }

            const data = { name: nameIn.value.trim() || id, description: descIn.value.trim() };
            if (autoIn.checked) data.autoinvoke = 'false';
            if (!data.description) data.description = id;

            const ctx = NS.fs.ctx();
            const okPerm = await NS.fs.ensurePermission(ctx.rootId);
            if (!okPerm) { u.toast('err', 'لم يُمنح إذن الكتابة'); return false; }

            const path = target.full + '/' + id + '/SKILL.md';
            await NS.fs.writeFile(ctx.rootId, path, NS.jsonc.composeFile(data, bodyTa.value));
            u.closeModal();
            await NS.skills.discover({ remote: false });
            u.toast('ok', 'أُنشئت المهارة ' + id + ' في ' + target.label);
            NS.main.render();
          }
        }
      ]
    });
  }


  /* ===============================================================
     COMMANDS
     =============================================================== */
  function viewCommands(root) {
    const d = S.data;
    const cmds = u.isObj(d.commands) ? d.commands : {};
    const names = Object.keys(cmds);
    root.appendChild(F.pageHead({
      icon: '⚡', title: 'الأوامر (Commands)', doc: 'commands', count: names.length,
      desc: 'أوامر تبدأ بشرطة مائلة تتحول إلى برومبت. تُعرَّف إما في <code>commands</code> داخل الإعداد أو كملفات <code>commands/*.md</code>.',
      actions: [F.btn('أمر جديد', { kind: 'primary', icon: '+', onClick: () => newCommand() })]
    }));

    if (!names.length) root.appendChild(el('div', { class: 'empty', text: 'لا توجد أوامر في هذا الملف.' }));

    const wrap = el('div', { class: 'items' });
    names.forEach(name => {
      const c = cmds[name] || {};
      const it = F.item({
        title: name, open: true,
        badges: [
          c.agent ? el('span', { class: 'pill blue', text: 'agent: ' + c.agent }) : null,
          c.model ? el('span', { class: 'pill mono', text: '🤖 ' + c.model }) : null,
          c.subagent === true ? el('span', { class: 'pill purple', text: 'فرعي' }) : null,
          c.subtask !== undefined && c.subagent === undefined ? el('span', { class: 'pill amber', text: 'subtask (مهمل)' }) : null
        ].filter(Boolean),
        subtitle: c.description || c.template || '',
        headActions: [
          F.btn('⇩', { size: 'sm', title: 'تصدير كملف .md', onClick: e => { e.stopPropagation(); exportCommandMd(name); } }),
          F.btn('✕', { size: 'sm', kind: 'danger', onClick: async e => {
            e.stopPropagation();
            if (await u.confirmBox('حذف الأمر', 'سيُحذف الأمر «' + name + '»', 'حذف')) {
              ST.edit(x => { if (x.commands) delete x.commands[name]; if (x.commands && !Object.keys(x.commands).length) delete x.commands; });
              NS.main.render();
            }
          } })
        ]
      });
      const b = it.body;
      b.appendChild(F.grid([
        F.field({ label: 'الوصف', value: c.description, onChange: v => putCmd(name, 'description', v) }),
        F.field({ label: 'الوكيل (agent)', type: 'agent', value: c.agent, onChange: v => putCmd(name, 'agent', v) }),
        F.field({ label: 'النموذج (model)', type: 'model', value: c.model, onChange: v => putCmd(name, 'model', v) }),
        F.field({ label: 'تشغيل في جلسة فرعية', type: 'bool', value: c.subagent === true, desc: 'true دائماً جلسة فرعية · false دائماً الجلسة الحالية · مُهمَل: جلسة فرعية فقط إذا كان الوكيل subagent', onChange: v => putCmd(name, 'subagent', v === true ? undefined : true) })
      ], 'c2'));
      b.appendChild(F.field({
        label: 'القالب (template)', type: 'textarea', rows: 6, value: c.template, mono: true, required: true,
        hint: '<code>$ARGUMENTS</code> = كامل الوسائط · <code>$1</code> و <code>$2</code> = وسائط موضعية · <code>!`command`</code> يُدرج مخرجات الصدفة قبل الإرسال.',
        onChange: v => putCmd(name, 'template', v)
      }));
      wrap.appendChild(it);
    });
    root.appendChild(wrap);

    const c1 = F.card({ title: 'أوامر من ملفات', desc: 'ملفات .md في <code>commands/</code> أو <code>.opencode/commands/</code>. المسار المتداخل يصبح <code>/team/review</code>.' });
    const box = el('div', {});
    c1.body.appendChild(box);
    root.appendChild(c1.root);
    renderCommandFiles(box);

    const c2 = F.card({ title: 'مرجع سريع', desc: 'أنماط الوسائط الموضعية والتوسيع' });
    c2.body.appendChild(el('div', { class: 'grid c2' }, [
      el('div', {}, [el('h4', { class: 'small', text: 'المواضع' }), el('pre', { class: 'snippet', html: u.esc(`/check src/auth.ts "error handling"
  → $1 = src/auth.ts   $2 = error handling

/check compare api stable branch
  → Check $1 with $2.   →   Compare api with stable branch.`) })]),
      el('div', {}, [
        el('h4', { class: 'small', text: 'كتل الصدفة' }),
        el('pre', { class: 'snippet', html: u.esc(`Review this diff:

!\`git diff --stat && git diff\``) }),
        el('p', { class: 'small dim', style: { marginTop: '8px' } }, 'كتل الصدفة تعمل عند تقييم الأمر خارج تدفق صلاحيات الأدوات. لا تضع وسائط غير موثوقة داخلها.'),
        el('p', { class: 'small dim' }, 'إذا لم يحتوِ القالب على أي عنصر نائب، تُلحق الوسائط غير الفارغة بعد سطر فارغ.')
      ])
    ]));
    root.appendChild(c2.root);
  }

  function putCmd(name, key, val) {
    ST.edit(x => {
      const node = u.ensure(x, ['commands', name]);
      u.setOrDelete(node, key, val);
      if (!Object.keys(node).length) delete x.commands[name];
    });
  }

  function newCommand() {
    const name = u.el('input', { type: 'text', class: 'mono', placeholder: 'review', dir: 'ltr' });
    const tpl = u.el('textarea', { rows: 4, class: 'mono', dir: 'ltr' });
    tpl.value = 'Review $ARGUMENTS for bugs and missing tests.';
    u.modal({
      title: 'أمر جديد',
      body: el('div', { class: 'grid' }, [
        el('div', { class: 'field' }, [el('label', { text: 'اسم الأمر' }), name]),
        el('div', { class: 'field' }, [el('label', { text: 'القالب' }), tpl])
      ]),
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'إنشاء', kind: 'primary', close: false, onClick: () => {
            const n = u.slug(name.value);
            if (!n) { u.toast('err', 'اسم غير صالح'); return false; }
            ST.edit(x => u.set(x, ['commands', n], { template: tpl.value }));
            u.closeModal(); NS.main.render(); u.toast('ok', 'أُنشئ الأمر /' + n);
          }
        }
      ]
    });
  }

  function exportCommandMd(name) {
    const c = (S.data.commands || {})[name] || {};
    const fm = {};
    ['description', 'agent', 'model', 'subagent'].forEach(k => { if (c[k] !== undefined) fm[k] = c[k]; });
    u.download(name + '.md', NS.jsonc.composeFile(fm, c.template || ''), 'text/markdown;charset=utf-8');
  }

  async function renderCommandFiles(box) {
    const FV = NS.fileviews;
    FV.renderMarkdownList(box, {
      kind: 'commands',
      label: 'أمر ملف جديد',
      idFrom: (rel) => rel.replace(/\.md$/i, ''),
      onOpen: (f) => FV.editMarkdown(f, 'command'),
      onCreate: (full, dir) => FV.createFile(full, dir, 'command')
    });
  }

  /* ===============================================================
     PLUGINS
     =============================================================== */
  function viewPlugins(root) {
    const d = S.data;
    const list = Array.isArray(d.plugins) ? d.plugins : [];
    root.appendChild(F.pageHead({
      icon: '🧱', title: 'الإضافات (Plugins)', doc: 'plugins', count: list.length,
      desc: 'حزم منشورة أو مسارات محلية. تُعالَج بالترتيب، وتُطبَّق مصفوفات الإضافات من أولوية أقل إلى أعلى بدل الاستبدال.',
      actions: [
        F.btn('إضافة', { kind: 'primary', icon: '+', onClick: () => addPlugin() }),
        F.btn('تحديث', { icon: '⟳', onClick: () => NS.main.render() })
      ]
    }));

    root.appendChild(F.sectionNote('التحكم: بادئة <code>-</code> تعطّل معرّفاً أو نمطاً، و <code>*</code> تطابق كل إضافة، و <code>.*</code> تطابق بادئة معرّف. معرّف لاحق يعيد التفعيل. الإضافتان <code>opencode.config.policy</code> و <code>opencode.provider.opencode</code> تتجاهلان الإزالة.'));

    if (!list.length) root.appendChild(el('div', { class: 'empty', text: 'لا توجد إضافات مهيّأة في هذا الملف.' }));

    const wrap = el('div', { class: 'items' });
    list.forEach((entry, idx) => {
      const isObj = u.isObj(entry);
      const pkg = isObj ? entry.package : entry;
      const opts = isObj ? entry.options : null;
      const disabled = String(pkg || '').startsWith('-');
      const it = F.item({
        title: pkg, disabled,
        badges: [
          disabled ? el('span', { class: 'pill red', text: 'معطّلة' }) : el('span', { class: 'pill green', text: 'مفعّلة' }),
          isObj ? el('span', { class: 'pill purple', text: 'مع خيارات' }) : el('span', { class: 'pill', text: 'نص' }),
          /^\*/.test(pkg) ? el('span', { class: 'pill amber', text: 'نمط' }) : null
        ].filter(Boolean),
        headActions: [
          F.btn('↑', { size: 'sm', onClick: e => { e.stopPropagation(); move(idx, -1); } }),
          F.btn('↓', { size: 'sm', onClick: e => { e.stopPropagation(); move(idx, 1); } }),
          F.btn(disabled ? 'تفعيل' : 'تعطيل', { size: 'sm', onClick: e => { e.stopPropagation(); toggle(idx); } }),
          F.btn('✕', { size: 'sm', kind: 'danger', onClick: e => { e.stopPropagation(); remove(idx); } })
        ],
        open: !isObj
      });
      if (isObj) {
        it.body.appendChild(F.grid([
          F.field({
            label: 'package', value: entry.package, dir: 'ltr',
            hint: 'اسم حزمة، أو إصدار <code>name@1.2.0</code>، أو نطاق، أو مسار نسبي <code>./plugins/local</code>، أو <code>file:///abs/path</code>.',
            onChange: v => { ST.edit(x => { x.plugins[idx] = Object.assign({}, x.plugins[idx], { package: v }); }); }
          })
        ], 'c1'));
        it.body.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'options — خيارات خاصة بهذه الإضافة' }),
          F.typedKV({
            value: opts || {}, addLabel: 'خيار', keyPlaceholder: 'strict',
            emptyText: 'لا توجد خيارات',
            onChange: v => ST.edit(x => {
              if (v === undefined) { if (x.plugins[idx] && typeof x.plugins[idx] === 'object') delete x.plugins[idx].options; }
              else x.plugins[idx] = Object.assign({}, x.plugins[idx], { options: v });
            })
          })
        ]));
        it.body.appendChild(el('div', { class: 'flex', style: { marginTop: '10px' } }, [
          F.btn('تحويل إلى نص', { size: 'sm', onClick: () => ST.edit(x => { x.plugins[idx] = x.plugins[idx].package; }) })
        ]));
      }
      wrap.appendChild(it);
    });
    root.appendChild(wrap);

    if (ST.isGlobal()) {
      const c = F.card({ title: 'أدوات CLI', desc: 'الإضافات الخاصة بالطرفية تُضبط في <code>cli.json</code> وتبقى فعّالة عند الاتصال بسيرفر بعيد.' });
      c.body.appendChild(F.btn('فتح قسم إعدادات الطرفية', { onClick: () => { ST.switchDoc(ST.S.scope, 'cli'); NS.main.go('cli-plugins'); } }));
      root.appendChild(c.root);
    }

    const c2 = F.card({ title: 'إدارة من الطرفية', desc: 'أوامر opencode' });
    c2.body.appendChild(el('pre', { class: 'snippet', html: u.esc(`opencode plugin add opencode-acme-plugin@1.2.0
opencode plugin list
opencode plugin list --builtin
opencode plugin check
opencode plugin update
opencode plugin update opencode-acme-plugin
opencode plugin remove opencode-acme-plugin@1.2.0`) }));
    root.appendChild(c2.root);
  }

  function addPlugin() {
    const pkg = u.el('input', { type: 'text', class: 'mono', dir: 'ltr', placeholder: '@acme/opencode-plugin' });
    u.modal({
      title: 'إضافة إضافة',
      body: el('div', { class: 'grid' }, [
        el('div', { class: 'field' }, [
          el('label', { text: 'الحزمة أو المسار' }), pkg,
          el('span', { class: 'desc', html: 'أو أضفها ككائن بخيارات <code>options</code> بعد الإضافة.' })
        ])
      ]),
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'إضافة', kind: 'primary', close: false, onClick: () => {
            const v = pkg.value.trim();
            if (!v) { u.toast('err', 'أدخل اسم حزمة أو مساراً'); return false; }
            ST.edit(x => u.set(x, 'plugins', (x.plugins || []).concat([v])));
            u.closeModal(); NS.main.render();
          }
        }
      ]
    });
  }
  function move(idx, dir) {
    ST.edit(x => {
      const a = x.plugins || [];
      const j = idx + dir;
      if (j < 0 || j >= a.length) return false;
      const t = a[idx]; a[idx] = a[j]; a[j] = t;
      return true;
    });
    NS.main.render();
  }
  function toggle(idx) {
    ST.edit(x => {
      const list = x.plugins || [];
      const e = list[idx];
      if (u.isObj(e)) e.package = flipDisable(e.package);
      else list[idx] = flipDisable(e);
      return true;
    });
    NS.main.render();
  }
  /** OpenCode disables a plugin by prefixing its id with "-". */
  function flipDisable(value) {
    const s = String(value == null ? '' : value);
    return s.startsWith('-') ? s.slice(1) : '-' + s;
  }
  function remove(idx) {
    ST.edit(x => { (x.plugins || []).splice(idx, 1); if (!(x.plugins || []).length) delete x.plugins; });
    NS.main.render();
  }

  /* ===============================================================
     FORMATTERS
     =============================================================== */
  function viewFormatters(root) {
    const d = S.data;
    const f = d.formatter;
    root.appendChild(F.pageHead({
      icon: '🎨', title: 'المُنسِّقات (Formatters)', doc: 'formatters',
      desc: 'تُنسِّق OpenCode الملفات بعد تغيّرها عبر <code>write</code> أو <code>edit</code> أو <code>patch</code>. التنسيق معطّل افتراضياً.'
    }));

    const c = F.card({ title: 'التفعيل', desc: 'القيمة <code>true</code> تفعّل كل المدمج وتصفّر التخصيصات. الكائن <code>{}</code> يحافظ على الموروث. <code>false</code> يعطّل كل التنسيق.' });
    c.body.appendChild(F.grid([
      F.field({
        label: 'الحالة', type: 'select',
        value: f === true ? 'on' : f === false ? 'off' : u.isObj(f) ? 'custom' : 'inherit',
        options: [
          { id: 'inherit', label: 'غير محدد (موروث من ملف أدنى أولوية)' },
          { id: 'on', label: 'true — تفعيل كل المدمج' },
          { id: 'custom', label: 'كائن — تفعيل المدمج مع تخصيصات' },
          { id: 'off', label: 'false — تعطيل التنسيق' }
        ],
        onChange: v => ST.edit(x => {
          if (v === 'on') x.formatter = true;
          else if (v === 'off') x.formatter = false;
          else if (v === 'custom') x.formatter = {};
          else delete x.formatter;
        })
      })
    ], 'c2'));
    root.appendChild(c.root);

    const overrides = u.isObj(f) ? f : {};
    const customNames = Object.keys(overrides).filter(k => !C.FORMATTER_BUILTINS.some(b => b[0] === k));

    const c2 = F.card({
      title: 'المُنسِّقات المدمجة', desc: 'اضغط لتفعيل أو تعطيل، أو اضبط امتداداتها ومتغيراتها.',
      actions: [
        F.btn('تعطيل كل المدمج', { size: 'sm', onClick: () => {
          const next = {};
          C.FORMATTER_BUILTINS.forEach(b => { next[b[0]] = { disabled: true }; });
          ST.edit(x => x.formatter = next); NS.main.render();
        } }),
        F.btn('إعادة الكل للافتراضي', { size: 'sm', onClick: () => { ST.edit(x => x.formatter = true); NS.main.render(); } })
      ]
    });
    const tbl = el('table', { class: 'tbl' });
    tbl.appendChild(el('thead', {}, el('tr', {}, [
      el('th', { text: 'الاسم' }), el('th', { text: 'الامتدادات' }), el('th', { text: 'المتطلب' }), el('th', { style: { width: '100px' }, text: 'الحالة' }), el('th', { style: { width: '60px' }, text: '' })
    ])));
    const tb = el('tbody');
    C.FORMATTER_BUILTINS.forEach(b => {
      const [name, exts, req] = b;
      const ov = overrides[name] || {};
      const isOff = ov.disabled === true || f === false;
      tb.appendChild(el('tr', {}, [
        el('td', {}, el('span', { class: 'pill mono', text: name })),
        el('td', {}, el('span', { class: 'small dim mono', text: (ov.extensions || exts).join(' ') })),
        el('td', {}, el('span', { class: 'small dim', text: req })),
        el('td', {}, el('span', { class: 'pill ' + (isOff ? 'red' : 'green'), text: isOff ? 'معطّل' : 'فعّال' })),
        el('td', { class: 'actions' }, [
          el('button', {
            class: 'btn ghost sm', title: 'تخصيص',
            onclick: () => editFormatter(name, ov, exts)
          }, '⋯')
        ])
      ]));
    });
    tbl.appendChild(tb);
    c2.body.appendChild(el('div', { class: 'table-wrap' }, tbl));
    c2.body.appendChild(F.hint('الامتداد يُقارن بالامتداد الأخير للملف، والمطابقة حساسة لحالة الأحرف. عند تطابق عدة منسّقات تُجرّب بترتيب التسجيل ويكتمل الأمر عند أول نجاح.'));
    root.appendChild(c2.root);

    if (customNames.length) {
      const c3 = F.card({ title: 'مُنسِّقات مخصّصة' });
      customNames.forEach(n => {
        const it = F.item({
          title: n, open: true,
          headActions: [F.btn('✕', { size: 'sm', kind: 'danger', onClick: () => { ST.edit(x => { delete x.formatter[n]; if (x.formatter && !Object.keys(x.formatter).length) x.formatter = true; }); NS.main.render(); } })]
        });
        it.body.appendChild(formatterFields(n, overrides[n]));
        c3.body.appendChild(it);
      });
      root.appendChild(c3.root);
    }

    const c4 = F.card({ title: 'إضافة مُنسِّق مخصّص', desc: 'يحتاج <code>command</code> و <code>extensions</code> ليعمل. يُستبدل <code>$FILE</code> بالمسار المطلق للملف.' });
    const nm = el('input', { type: 'text', class: 'mono', placeholder: 'deno-markdown', dir: 'ltr' });
    const cm = el('input', { type: 'text', class: 'mono', placeholder: 'deno, fmt, $FILE', dir: 'ltr' });
    const ex = el('input', { type: 'text', class: 'mono', placeholder: '.md', dir: 'ltr' });
    c4.body.appendChild(el('div', { class: 'grid c3' }, [
      el('div', { class: 'field' }, [el('label', { text: 'الاسم' }), nm]),
      el('div', { class: 'field' }, [el('label', { text: 'command (مصفوفة معطيات)' }), cm]),
      el('div', { class: 'field' }, [el('label', { text: 'extensions' }), ex])
    ]));
    c4.body.appendChild(el('div', { class: 'flex', style: { marginTop: '10px' } }, [
      F.btn('إضافة', {
        kind: 'primary', onClick: () => {
          const n = u.slug(nm.value);
          if (!n) { u.toast('err', 'أدخل اسماً'); return; }
          const command = cm.value.trim() ? cm.value.trim().split(/\s+/) : [];
          const extensions = ex.value.trim() ? ex.value.trim().split(/[\s,]+/) : [];
          ST.edit(x => {
            if (x.formatter === true || x.formatter === false || !u.isObj(x.formatter)) x.formatter = {};
            x.formatter[n] = { command, extensions };
          });
          NS.main.render();
        }
      })
    ]));
    root.appendChild(c4.root);
  }

  function formatterFields(name, ov) {
    ov = ov || {};
    const cmdArr = Array.isArray(ov.command) ? ov.command.join(' ') : (typeof ov.command === 'string' ? ov.command : '');
    const extArr = Array.isArray(ov.extensions) ? ov.extensions.join(' ') : '';
    const wrap = el('div', { class: 'grid' });
    wrap.appendChild(F.grid([
      F.field({
        label: 'command', value: cmdArr, mono: true, dir: 'ltr',
        desc: 'مصفوفة وسائط مفصولة بمسافات. استبدل $FILE بمسار الملف المطلق.',
        onChange: v => {
          const arr = v ? v.trim().split(/\s+/) : [];
          ST.edit(x => {
            if (!u.isObj(x.formatter)) x.formatter = {};
            u.setOrDelete(x, ['formatter', name, 'command'], arr, arr.length);
          });
        }
      }),
      F.field({
        label: 'extensions', value: extArr, mono: true, dir: 'ltr',
        desc: 'مع النقطة الأولى، مفصولة بمسافات.',
        onChange: v => {
          const arr = v ? v.trim().split(/[\s,]+/) : [];
          ST.edit(x => {
            if (!u.isObj(x.formatter)) x.formatter = {};
            u.setOrDelete(x, ['formatter', name, 'extensions'], arr, arr.length);
          });
        }
      })
    ], 'c2'));
    wrap.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'environment' }),
      F.kvEditor({ value: ov.environment || {}, addLabel: 'متغير بيئة', onChange: v => {
        ST.edit(x => {
          if (!u.isObj(x.formatter)) x.formatter = {};
          u.setOrDelete(x, ['formatter', name, 'environment'], v, Object.keys(v || {}).length);
        });
      } })
    ]));
    wrap.appendChild(el('div', { class: 'field inline' }, [
      el('label', { text: 'تعطيل هذا المنسّق' }),
      F.field({
        type: 'bool', inline: false, label: '', cls: 'inline',
        value: ov.disabled === true,
        onChange: v => ST.edit(x => {
          if (!u.isObj(x.formatter)) x.formatter = {};
          u.setOrDelete(x, ['formatter', name, 'disabled'], true, v);
        })
      })
    ]));
    return wrap;
  }

  function editFormatter(name, ov, defaultExts) {
    const cmdIn = el('input', { type: 'text', class: 'mono', dir: 'ltr', value: (ov.command || []).join(' ') });
    const extIn = el('input', { type: 'text', class: 'mono', dir: 'ltr', value: (ov.extensions || defaultExts || []).join(' ') });
    const dis = el('input', { type: 'checkbox' }); dis.checked = ov.disabled === true;
    const envBox = el('div', {});
    let env = u.clone(ov.environment || {});
    function renderEnv() {
      u.clear(envBox);
      envBox.appendChild(F.kvEditor({ value: env, addLabel: 'متغير بيئة', onChange: v => { env = v; } }));
    }
    renderEnv();

    u.modal({
      title: 'تخصيص ' + name, wide: true,
      body: el('div', { class: 'grid' }, [
        el('div', { class: 'field inline' }, [el('label', { text: 'تعطيل هذا المنسّق' }), el('label', { class: 'switch' }, [dis, el('span', { class: 'slider' })])]),
        el('div', { class: 'field' }, [el('label', { text: 'command' }), cmdIn, el('span', { class: 'desc', text: 'مصفوفة وسائط، لا سلسلة أوامر صدفة. اتركه فارغاً للوراثة.' })]),
        el('div', { class: 'field' }, [el('label', { text: 'extensions' }), extIn, el('span', { class: 'desc', text: 'مفصولة بمسافات، مع النقطة الأولى.' })]),
        el('div', { class: 'field' }, [el('label', { text: 'environment' }), envBox])
      ]),
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'حفظ', kind: 'primary', close: false, onClick: () => {
            ST.edit(x => {
              if (!u.isObj(x.formatter)) x.formatter = {};
              const next = Object.assign({}, x.formatter[name]);
              u.setOrDelete(next, 'disabled', true, dis.checked);
              const c = cmdIn.value.trim() ? cmdIn.value.trim().split(/\s+/) : [];
              u.setOrDelete(next, 'command', c, c.length);
              const e = extIn.value.trim() ? extIn.value.trim().split(/[\s,]+/) : [];
              u.setOrDelete(next, 'extensions', e, e.length);
              u.setOrDelete(next, 'environment', env, Object.keys(env).length);
              if (Object.keys(next).length) x.formatter[name] = next; else delete x.formatter[name];
              if (!Object.keys(x.formatter).length) x.formatter = true;
            });
            u.closeModal(); NS.main.render();
          }
        }
      ]
    });
  }

/* ===============================================================
     THEMES
     =============================================================== */
  function viewThemes(root) {
    const isProject = !ST.isGlobal();
    const project = ST.currentProject();

    root.appendChild(F.pageHead({
      icon: '🎭', title: 'الثيمات', doc: 'themes',
      desc: 'الثيم المختار يعيش في <code>cli.json</code> تحت <code>theme</code> ويم affects واجهة الطرفية فقط — لذلك هذا القسم متاح في الإعدادات العامة فقط.'
    }));

    if (isProject) {
      root.appendChild(F.sectionNote('الثيمات إعداد خاص بعميل الطرفية، ولا يوجد <code>cli.json</code> داخل مشروع. اضغط «الإعدادات العامة» لتغيير الثيم.', 'warn'));
      root.appendChild(el('div', { class: 'flex', style: { marginTop: '12px' } }, [
        F.btn('الذهاب إلى الإعدادات العامة', { kind: 'primary', onClick: () => NS.main.openGlobal() })
      ]));
      return;
    }

    // cli.json may not be the document currently open
    const cliBuf = S.buffers['global:cli'];
    const cliData = (cliBuf && cliBuf.data) ? cliBuf.data : (S.target === 'cli' ? S.data : {});
    const theme = u.get(cliData, 'theme', {}) || {};
    const themeName = theme.name || '';
    const themeMode = theme.mode || 'system';

    const editTheme = (name, mode) => {
      ST.switchDoc(ST.S.scope, 'cli');
      ST.edit(x => { x.theme = { name, mode }; });
      u.toast('ok', 'حُدّث الثيم — احفظ بـ Ctrl+S');
      NS.main.go('cli-appearance');
    };

    const c = F.card({ title: 'الثيم الحالي', desc: 'يُطبَّق على واجهة الطرفية (cli.json)' });
    c.body.appendChild(F.grid([
      F.field({
        label: 'theme.name', type: 'select', value: themeName || C.THEMES[0],
        options: C.THEMES.map(t => ({ id: t, label: t })),
        desc: themeName && !C.THEMES.includes(themeName)
          ? 'الثيم الحالي «' + themeName + '» ليس مدمجاً — قد يكون ثيماً مخصصاً من مجلد themes/.'
          : 'اختر من الثيمات المدمجة.',
        onChange: v => editTheme(v, themeMode)
      }),
      F.field({
        label: 'theme.mode', type: 'select', value: themeMode,
        options: C.CLI_THEME_MODES.map(m => ({ id: m, label: m })),
        desc: 'system يتبع مظهر الطرفية، dark/light يثبّته.',
        onChange: v => editTheme(themeName || C.THEMES[0], v)
      })
    ], 'c2'));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'ثيمات مخصّصة في المجلد', desc: 'ملفات <code>themes/*.json</code> — يمكنك تفعيلها أو حذفها' });
    const box = el('div', {});
    c2.body.appendChild(box);
    root.appendChild(c2.root);

    (async () => {
      u.clear(box);
      const root_ = NS.fs.globalRoot();
      if (!root_ || root_.permission !== 'granted') {
        box.appendChild(el('div', { class: 'empty', text: 'اربط مجلد الإعدادات العامة لعرض الثيمات المخصّصة.' }));
        return;
      }
      const files = (await NS.fs.walkFiles(root_.id, 'themes', 3)).filter(f => f.endsWith('.json'));
      if (!files.length) {
        box.appendChild(el('div', { class: 'empty', text: 'لا توجد ملفات ثيم في مجلد themes/' }));
        return;
      }
      files.forEach(f => {
        const name = f.split('/').pop().replace(/\.json$/, '');
        box.appendChild(el('div', { class: 'list-row', style: { padding: '7px 0', borderBottom: '1px solid var(--border)' } }, [
          el('span', { class: 'pill mono blue', text: name }),
          name === themeName ? el('span', { class: 'pill green', text: 'مفعّل' }) : null,
          el('span', { class: 'small dim', text: f }),
          el('div', { class: 'spacer' }),
          F.btn('تفعيل', { size: 'sm', kind: 'ok', onClick: () => editTheme(name, themeMode) }),
          F.btn('حذف', {
            size: 'sm', kind: 'danger', onClick: async () => {
              if (!await u.confirmBox('حذف الثيم', 'سيُحذف الملف ' + f, 'حذف')) return;
              await NS.fs.removePath(root_.id, f);
              NS.main.render();
            }
          })
        ]));
      });
    })();
  }

  /* ===============================================================
     REFERENCES
     =============================================================== */
  function viewReferences(root) {
    const d = S.data;
    const refs = u.isObj(d.references) ? d.references : {};
    const names = Object.keys(refs);
    root.appendChild(F.pageHead({
      icon: '📚', title: 'المراجع (References)', doc: 'references', count: names.length,
      desc: 'اجعل مجلدات محلية أو مستودعات Git متاحة ك سياق مساند باسم. يُدمج محتواها في سياق الوكيل.'
    }));

    if (!names.length) root.appendChild(el('div', { class: 'empty', text: 'لا توجد مراجع. أضف واحداً ليجعل مجلداً أو مستودعاً متاحاً للوكلاء.' }));

    const wrap = el('div', { class: 'items' });
    names.forEach(name => {
      const r = refs[name] || {};
      const it = F.item({
        title: name, open: true,
        badges: [
          u.isObj(r) && r.repository ? el('span', { class: 'pill purple', text: 'مستودع Git' }) : el('span', { class: 'pill blue', text: 'مسار محلي' }),
          u.isObj(r) && r.visibility ? el('span', { class: 'pill', text: r.visibility }) : null
        ].filter(Boolean),
        subtitle: u.isObj(r) && r.repository ? r.repository : (u.isObj(r) ? r.path : ''),
        headActions: [F.btn('✕', { size: 'sm', kind: 'danger', onClick: () => { ST.edit(x => { if (x.references) delete x.references[name]; if (x.references && !Object.keys(x.references).length) delete x.references; }); NS.main.render(); } })]
      });
      const b = it.body;
      b.appendChild(F.grid([
        F.field({ label: 'type', type: 'select', value: u.isObj(r) && r.repository ? 'repo' : 'path', options: [{ id: 'path', label: 'مسار محلي' }, { id: 'repo', label: 'مستودع Git' }], emptyValue: undefined, onChange: v => {
          ST.edit(x => { const node = u.ensure(x, ['references', name]);
            if (v === 'repo') { delete node.path; u.set(node, 'repository', node.repository || ''); }
            else { delete node.repository; delete node.branch; delete node.commit; u.set(node, 'path', node.path || ''); } });
        } }),
        F.field({ label: 'الوصف', value: u.isObj(r) ? r.description : undefined, onChange: v => ST.edit(x => u.setOrDelete(x, ['references', name, 'description'], v)) })
      ], 'c2'));
      if (u.isObj(r) && r.repository) {
        b.appendChild(F.grid([
          F.field({ label: 'repository', value: r.repository, placeholder: 'Effect-TS/effect', hint: 'اختصار: <code>owner/repo</code>', onChange: v => ST.edit(x => u.set(x, ['references', name, 'repository'], v)) }),
          F.field({ label: 'branch', value: r.branch, placeholder: 'main', onChange: v => ST.edit(x => u.setOrDelete(x, ['references', name, 'branch'], v)) }),
          F.field({ label: 'commit', value: r.commit, onChange: v => ST.edit(x => u.setOrDelete(x, ['references', name, 'commit'], v)) }),
          F.field({ label: 'visibility', type: 'select', value: r.visibility || '', options: [{ id: '', label: '— الافتراضي —' }, { id: 'public', label: 'public' }, { id: 'private', label: 'private' }], emptyValue: undefined, onChange: v => ST.edit(x => u.setOrDelete(x, ['references', name, 'visibility'], v)) })
        ], 'c2'));
      } else {
        b.appendChild(F.field({ label: 'path', value: u.isObj(r) ? r.path : '', dir: 'ltr', placeholder: '../product-docs', hint: 'المسار نسبي لمجلد المشروع أو مطلق.', onChange: v => ST.edit(x => u.set(x, ['references', name, 'path'], v)) }));
      }
      wrap.appendChild(it);
    });
    root.appendChild(wrap);

    root.appendChild(el('div', { class: 'flex', style: { marginTop: '12px' } }, [
      F.btn('مرجع جديد', {
        kind: 'primary', icon: '+', onClick: async () => {
          const n = await u.promptBox('مرجع جديد', 'اسم المرجع', 'docs');
          if (!n) return;
          const key = u.slug(n);
          ST.edit(x => u.set(x, ['references', key], { path: '../' + key }));
          NS.main.render();
        }
      })
    ]));

    const c = F.card({ title: 'ملف opencode.json', desc: 'المسارات نسبية لجذر المشروع، وتُحَل من جذر النسخة الأصلية للمشروع.' });
    c.body.appendChild(el('pre', { class: 'snippet', html: u.esc(JSON.stringify({ references: { docs: { path: '../product-docs', description: 'Product behavior and terminology' }, effect: { repository: 'Effect-TS/effect', branch: 'main' } } }, null, 2)) }));
    root.appendChild(c.root);
  }

  /* ===============================================================
     INSTRUCTIONS
     =============================================================== */
  function viewInstructions(root) {
    const d = S.data;
    root.appendChild(F.pageHead({
      icon: '📄', title: 'التعليمات (Instructions)', doc: 'instructions',
      desc: 'ملف <code>AGENTS.md</code> هو مصدر التعليمات الفعّال. حقل <code>instructions</code> يقبله OpenCode لكنه لا يحمّل مدخلاته في V2.'
    }));

    const c = F.card({ title: 'حقل instructions', desc: 'مصفوفة مسارات أو أنماط أو روابط — يقبلها OpenCode لكنه لا يحمّل مدخلاتها' });
    c.body.appendChild(F.listEditor({
      items: Array.isArray(d.instructions) ? d.instructions : [], placeholder: 'CONTRIBUTING.md  أو  docs/guidelines/*.md', addLabel: 'إضافة مسار',
      emptyText: 'لا يوجد',
      onChange: v => ST.edit(x => u.setOrDelete(x, 'instructions', v))
    }));
    c.body.appendChild(F.sectionNote('استخدم <code>AGENTS.md</code> للتعليمات الفعلية. لم يوسّع OpenCode V2 هذا الحقل ليقرأ الملفات.', 'warn'));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'ملف AGENTS.md', desc: 'يُبحث في المجلد الحالي ثم يصعد حتى جذر المشروع.' });
    const box = el('div', {});
    c2.body.appendChild(box);
    root.appendChild(c2.root);

    (async () => {
      u.clear(box);
      const fs = NS.fs;
      const c = fs.ctx();
      if (!c) { box.appendChild(el('div', { class: 'empty', text: 'اربط مجلداً لتحرير AGENTS.md مباشرة.' })); return; }
      const pj = c.project;
      const rel = (pj && pj.instructionsFile) ? pj.instructionsFile : 'AGENTS.md';
      const path = fs.join(c.prefix, rel);
      const text = (await fs.readFile(c.rootId, path)) || '';
      const ta = el('textarea', { rows: 16, dir: 'ltr', placeholder: '# Project instructions\n\nDescribe how agents should work in this repository.' });
      ta.value = text;
      const prev = el('div', { class: 'md-preview', html: u.mdToHtml(text) });
      ta.addEventListener('input', u.debounce(() => { prev.innerHTML = u.mdToHtml(ta.value); }, 300));
      box.appendChild(el('div', { class: 'small dim', style: { marginBottom: '8px' } }, [
        el('span', { class: 'pill mono', text: path }), ' ', text ? 'موجود' : 'غير موجود (سيُنشأ عند الحفظ)'
      ]));
      box.appendChild(el('div', { class: 'md-editor' }, [ta, prev]));
      box.appendChild(el('div', { class: 'flex', style: { marginTop: '10px' } }, [
        F.btn('حفظ ' + path, {
          kind: 'primary', onClick: async () => {
            try {
              const ok = await fs.ensurePermission(c.rootId);
              if (!ok) { u.toast('err', 'لم يُمنح إذن الكتابة'); return; }
              await fs.writeSafe(c.rootId, path, ta.value);
              u.toast('ok', 'حُفظ ' + path);
            } catch (e) { u.toast('err', 'خطأ: ' + e.message); }
          }
        })
      ]));
    })();
  }

  NS.views = NS.views || {};
  Object.assign(NS.views, {
    skills: viewSkills, commands: viewCommands, plugins: viewPlugins,
    formatters: viewFormatters, themes: viewThemes,
    references: viewReferences, instructions: viewInstructions
  });
})(window.OCM);