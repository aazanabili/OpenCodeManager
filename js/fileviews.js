/* ============================================================
   fileviews.js — shared helpers for browsing / editing the
   per-agent / per-command / per-skill / per-theme files that
   live next to the open configuration.
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u, F = NS.F, ST = NS.store, S = ST.S;
  const { el } = u;

  /** Which sub-folder holds each kind of file in the current scope. */
  function dirFor(scopeProject, kind) {
    if (!scopeProject) return null;
    const map = {
      agents: 'agentsDir', skills: 'skillsDir', commands: 'commandsDir', themes: 'themesDir'
    };
    return scopeProject[map[kind]] || null;
  }

  function noFolderBox(box, message) {
    u.clear(box);
    box.appendChild(el('div', { class: 'empty', text: message }));
  }

  /**
   * Render the list of Markdown files of a given kind.
   * opts: { kind, label, hint, idFrom, onOpen, onCreate, emptyText }
   */
  async function renderMarkdownList(box, opts) {
    const fs = NS.fs;
    u.clear(box);

    const c = fs.ctx();
    if (!c) { noFolderBox(box, 'اربط مجلداً لعرض ملفات ' + opts.label + '.'); return; }
    if (!opts.scopeReady) { noFolderBox(box, opts.notReadyText || 'لا يوجد مجلد مربوط.'); return; }

    const dir = dirFor(c.project, opts.kind);
    if (!dir) {
      noFolderBox(box, 'لا يوجد مجلد ' + opts.kind + '/ داخل هذا النطاق — أضف مجلداً أو أنشئه بالزر أدناه.');
      box.appendChild(el('div', { class: 'flex', style: { marginTop: '10px' } }, [
        F.btn('إنشاء مجلد ' + opts.kind + '/', {
          kind: 'primary', icon: '+',
          onClick: async () => {
            await fs.writeFile(c.rootId, fs.join(c.prefix, opts.kind) + '/.keep', '');
            NS.main.render();
          }
        })
      ]));
      return;
    }

    const full = fs.join(c.prefix, dir);
    const files = (await fs.walkFiles(c.rootId, full, 6)).filter(f => /\.md$/i.test(f));

    if (!files.length) noFolderBox(box, 'لا توجد ملفات ' + opts.kind + ' في ' + dir);

    files.forEach(f => {
      const rel = f.slice(full.length).replace(/^\//, '');
      box.appendChild(el('div', { class: 'list-row', style: { padding: '7px 0', borderBottom: '1px solid var(--border)' } }, [
        el('span', { class: 'pill mono blue', text: opts.idFrom ? opts.idFrom(rel, f) : rel.replace(/\.md$/i, '') }),
        el('span', { class: 'small dim', text: f }),
        el('div', { class: 'spacer' }),
        F.btn('عرض', { size: 'sm', onClick: () => opts.onOpen(f) }),
        F.btn('حذف', {
          size: 'sm', kind: 'danger',
          onClick: async () => {
            if (!await u.confirmBox('حذف الملف', 'سيُحذف ' + f, 'حذف')) return;
            await fs.removePath(c.rootId, f);
            NS.main.render();
          }
        })
      ]));
    });

    if (opts.onCreate) {
      box.appendChild(el('div', { class: 'flex', style: { marginTop: '12px' } }, [
        F.btn('إنشاء ' + opts.label, { kind: 'primary', icon: '+', onClick: () => opts.onCreate(full, dir) })
      ]));
    }
  }

  /** Front-matter + body editor used for agents, commands and skills. */
  async function editMarkdown(path, kind) {
    const fs = NS.fs;
    const c = fs.ctx();
    const text = (await fs.readFile(c.rootId, path)) || '';
    const parsed = NS.jsonc.parseFrontmatter(text);
    const data = u.clone(parsed.data);

    const bodyTa = el('textarea', { rows: 16, dir: 'ltr' });
    bodyTa.value = parsed.body;
    const preview = el('div', { class: 'md-preview', html: u.mdToHtml(parsed.body) });
    bodyTa.addEventListener('input', u.debounce(() => { preview.innerHTML = u.mdToHtml(bodyTa.value); }, 300));

    const fmWrap = el('div', { class: 'grid c2' });
    function renderFm() {
      u.clear(fmWrap);
      const fields = kind === 'agent' ? [
        { k: 'description', label: 'الوصف' },
        { k: 'mode', label: 'mode', type: 'select', options: ['', 'primary', 'subagent', 'all'] },
        { k: 'model', label: 'model' },
        { k: 'steps', label: 'steps', type: 'number' },
        { k: 'color', label: 'color' },
        { k: 'hidden', label: 'hidden', type: 'bool' },
        { k: 'disabled', label: 'disabled', type: 'bool' }
      ] : kind === 'skill' ? [
        { k: 'name', label: 'name' },
        { k: 'description', label: 'description' },
        { k: 'autoinvoke', label: 'opencode/autoinvoke (false لإخفاء)', type: 'select', options: ['', 'true', 'false'] },
        { k: 'disableModelInvocation', label: 'disable-model-invocation', type: 'bool' }
      ] : [
        { k: 'description', label: 'الوصف' },
        { k: 'agent', label: 'agent' },
        { k: 'model', label: 'model' },
        { k: 'subagent', label: 'subagent', type: 'bool' }
      ];

      fields.forEach(f => {
        let node;
        if (f.type === 'bool') {
          node = F.field({
            label: f.label, type: 'bool', value: data[f.k] === true,
            onChange: v => { if (v) data[f.k] = true; else delete data[f.k]; }
          });
        } else if (f.type === 'select') {
          node = F.field({
            label: f.label, type: 'select', value: data[f.k] || f.options[0], options: f.options,
            onChange: v => { if (!v) delete data[f.k]; else data[f.k] = v; }
          });
        } else if (f.type === 'number') {
          node = F.field({
            label: f.label, type: 'number', min: 1, value: data[f.k],
            onChange: v => { if (v == null) delete data[f.k]; else data[f.k] = v; }
          });
        } else {
          node = F.field({ label: f.label, value: data[f.k], onChange: v => u.setOrDelete(data, f.k, v) });
        }
        fmWrap.appendChild(node);
      });

      if (kind === 'agent') {
        fmWrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'permissions' }),
          F.rulesTable({
            value: data.permissions || [], actions: NS.C.PERM_ACTIONS,
            onChange: v => { if (v.length) data.permissions = v; else delete data.permissions; }
          })
        ]));
      }
    }
    renderFm();

    const body = el('div', {}, [
      el('div', { class: 'frontmatter' }, [
        el('div', { class: 'frontmatter-toggle' }, [el('span', { class: 'dots', text: '⋯' }), el('span', { text: 'frontmatter' })]),
        fmWrap
      ]),
      el('div', { class: 'md-editor' }, [bodyTa, preview])
    ]);

    u.modal({
      title: 'تحرير ' + path, body, wide: true,
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'حفظ', kind: 'primary', close: false, onClick: async () => {
            const ok = await fs.ensurePermission(c.rootId);
            if (!ok) { u.toast('لم يُمنح إذن الكتابة', 'err'); return false; }
            await fs.writeSafe(c.rootId, path, NS.jsonc.composeFile(data, bodyTa.value));
            u.closeModal(); u.toast('حُفظ ' + path, 'ok'); NS.main.render();
          }
        }
      ]
    });
  }

  /** Create a new file of a given kind. */
  async function createFile(fullDir, dir, kind) {
    const fs = NS.fs;
    const c = fs.ctx();
    if (kind === 'skill') {
      const name = await u.promptBox('مهارة جديدة', 'معرّف المهارة (kebab-case، مطابق لاسم المجلد)', 'my-skill');
      if (!name) return;
      const id = u.slug(name);
      await fs.writeFile(c.rootId, fullDir + '/' + id + '/SKILL.md',
        NS.jsonc.composeFile({ name: id, description: '' }, 'Describe what this skill does and when to use it.\n'));
    } else {
      const name = await u.promptBox(kind === 'agent' ? 'وكيل ملف جديد' : 'أمر ملف جديد',
        'اسم الملف بدون .md (يمكن استخدام team/review للوكلاء والأوامر)', kind === 'agent' ? 'reviewer' : 'review');
      if (!name) return;
      const content = kind === 'agent'
        ? NS.jsonc.composeFile({ description: '', mode: 'subagent' }, 'Describe what this agent does.\n')
        : 'Review $ARGUMENTS for bugs and missing tests.\n';
      await fs.writeFile(c.rootId, fullDir + '/' + u.slug(name) + '.md', content);
    }
    NS.main.render();
  }

  NS.fileviews = { renderMarkdownList, editMarkdown, createFile, dirFor };
})(window.OCM);