/* ============================================================
   views-core.js — General · Agents · Permissions · Policies
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u, F = NS.F, C = NS.C, ST = NS.store, S = ST.S;
  const { el } = u;

  const DOC = {
    config: 'config', agents: 'agents', permissions: 'permissions',
    policies: 'policies', compaction: 'compaction', attachments: 'attachments',
    websearch: 'websearch', warming: 'warming', snapshots: 'snapshots'
  };

  /* ---------------------------------------------------------------
     helpers
  --------------------------------------------------------------- */
  /** last matching rule wins */
  function lastMatch(rules, action, resourceTest) {
    let found = null;
    (Array.isArray(rules) ? rules : []).forEach(r => {
      if (!r || typeof r !== 'object') return;
      const a = r.action == null ? '' : String(r.action);
      const res = r.resource == null ? '' : String(r.resource);
      const actionOk = a === action || a === '*';
      if (!actionOk) return;
      if (resourceTest && !resourceTest(res)) return;
      found = r;
    });
    return found;
  }

/* --- وصف صلاحيات إطلاق الوكلاء الفرعية + دلالات الأنماط العامة --- */

  /**
   * دلالات الأنماط العامة في OpenCode على قيمة كاملة:
   *   *   صفر أو أكثر حرف، بما في ذلك /
   *   ?   حرف واحد بالضبط
   * النمط المنتهي بـ " *" يطابق أيضاً القيمة بلا وسائط، فـ "git status *"
   * يطابق `git status` و `git status --short` معاً.
   */
  function wildcardMatch(pattern, value) {
    const p = String(pattern == null ? '' : pattern);
    const v = String(value == null ? '' : value);
    const toRe = (pat) => new RegExp(
      '^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');

    if (toRe(p).test(v)) return true;
    if (p.endsWith(' *')) return toRe(p.slice(0, -2)).test(v);
    return false;
  }

  /** ماذا يستطيع هذا الوكيل إطلاقه من وكلاء فرعية؟ آخر قاعدة مطابقة تفوز. */
  function describeSubagents(agentPerms) {
    const rules = (Array.isArray(agentPerms) ? agentPerms : [])
      .filter(r => r && (r.action === 'subagent' || r.action === '*'));

    if (!rules.length) {
      return { text: 'يُسمح له بكل الوكلاء الفرعيين (الافتراضي)', kind: 'green', pill: 'مسموح' };
    }

    const effective = (candidate) => {
      let eff = 'allow';
      rules.forEach(r => {
        if (r.resource === '*' || wildcardMatch(r.resource, candidate)) eff = r.effect;
      });
      return eff;
    };

    const named = [];
    rules.forEach(r => {
      const res = String(r.resource == null ? '' : r.resource);
      if (res && res !== '*' && res.indexOf('*') < 0) named.push(res);
    });
    const unique = Array.from(new Set(named));
    const base = effective('__no_such_agent__');

    if (base === 'deny') {
      const allowed = unique.filter(id => effective(id) !== 'deny');
      if (allowed.length) {
        return {
          text: 'لا يستطيع إطلاق أي وكيل إلا: ' + allowed.join('، '),
          kind: 'amber', pill: 'قائمة محدودة'
        };
      }
      return { text: 'لا يستطيع إطلاق أي وكيل فرعي إطلاقاً', kind: 'red', pill: 'محظور' };
    }
    if (base === 'ask') {
      const allowed = unique.filter(id => effective(id) !== 'deny');
      return {
        text: allowed.length
          ? 'يسأل قبل إطلاق أي وكيل، ويسمح مباشرة بـ: ' + allowed.join('، ')
          : 'يسأل قبل إطلاق أي وكيل فرعي',
        kind: 'amber', pill: 'بحاجة لموافقة'
      };
    }
    const blocked = unique.filter(id => effective(id) === 'deny');
    if (blocked.length) {
      return {
        text: 'يُسمح له بكل الوكلاء الفرعيين ما عدا: ' + blocked.join('، '),
        kind: 'green', pill: 'مسموح مع استثناء'
      };
    }
    return { text: 'يُسمح له بكل الوكلاء الفرعيين', kind: 'green', pill: 'مسموح' };
  }

  function agentCount() { return Object.keys(ST.agents()).length; }

  const CONFIG_KEY_LABELS = {
    model: 'النموذج الافتراضي', default_agent: 'الوكيل الافتراضي', shell: 'الصدفة',
    username: 'اسم المستخدم', update: 'التحديثات', share: 'المشاركة', snapshots: 'اللقطات',
    permissions: 'الصلاحيات', agents: 'الوكلاء', mcp: 'خوادم MCP', providers: 'المزوّدون',
    skills: 'مصادر المهارات', commands: 'الأوامر', plugins: 'الإضافات',
    formatter: 'المُنسِّقات', references: 'المراجع', instructions: 'التعليمات',
    websearch: 'البحث في الويب', compaction: 'ضغط السياق', warming: 'التسخين',
    worktree: 'شجرة العمل', watcher: 'المراقب', tool_output: 'إخراج الأدوات',
    media: 'معالجة الصور', experimental: 'خيارات تجريبية'
  };
  const SKIP_COMPARE = new Set(['$schema']);

  /**
   * Project scope only: show which top-level keys this project redefines and
   * which it simply inherits from the global configuration.
   */
  function globalCompareCard() {
    if (ST.isGlobal() || !S.globalData) return el('span');
    const g = S.globalData;
    const projectKeys = Object.keys(S.data).filter(k => !SKIP_COMPARE.has(k));
    const shared = projectKeys.filter(k => Object.prototype.hasOwnProperty.call(g, k));
    const onlyHere = projectKeys.filter(k => !shared.includes(k));
    const onlyGlobal = Object.keys(g).filter(k => !SKIP_COMPARE.has(k) && !shared.includes(k));

    const c = F.card({
      title: 'مقارنة مع الإعدادات العامة',
      desc: 'ما الذي يحدّده هذا المشروع وما الذي يرثه من الملف العام.'
    });
    const label = (k) => CONFIG_KEY_LABELS[k] || k;

    const mk = (title, keys, pillCls, note) => {
      const row = el('div', { class: 'cmp-row' }, [el('div', { class: 'cmp-title', text: title })]);
      if (!keys.length) row.appendChild(el('span', { class: 'muted small', text: '— لا شيء —' }));
      keys.forEach(k => row.appendChild(el('span', { class: 'pill mono ' + pillCls, text: label(k), title: k })));
      return row;
    };
    c.body.appendChild(mk('محدّد هنا (يتجاوز العام)', shared, 'amber', ''));
    c.body.appendChild(mk('خاص بهذا المشروع فقط', onlyHere, 'blue', ''));
    c.body.appendChild(mk('يأتي من الإعدادات العامة فقط', onlyGlobal, 'purple', ''));
    c.body.appendChild(F.hint('مفتاح محدّد في المشروع يتجاوز قيمة العامة عند التشغيل. مفتاح غير معرّف هنا يُورَث من الملف العام.'));
    c.body.appendChild(el('div', { class: 'flex', style: { marginTop: '10px' } }, [
      F.btn('عرض القيم العامة', {
        onClick: () => showGlobalValues(shared.concat(onlyGlobal))
      })
    ]));
    return c.root;
  }

  function showGlobalValues(keys) {
    const g = S.globalData || {};
    const body = el('div', {});
    if (!keys.length) body.appendChild(el('div', { class: 'empty', text: 'لا توجد مفاتيح مشتركة.' }));
    keys.forEach(k => {
      body.appendChild(el('div', { class: 'cmp-global-row' }, [
        el('span', { class: 'pill mono', text: CONFIG_KEY_LABELS[k] || k }),
        el('span', { class: 'small dim', text: JSON.stringify(g[k]).slice(0, 180) })
      ]));
    });
    u.modal({ title: 'القيم المعرّفة في الإعدادات العامة', body });
  }

  /* ===============================================================
     GENERAL
     =============================================================== */
  function viewGeneral(root) {
    const d = S.data;
    const re = () => viewGeneral(root);

    root.appendChild(F.pageHead({
      icon: '⚙', title: ST.isGlobal() ? 'الإعدادات العامة' : 'إعدادات المشروع', doc: DOC.config,
      desc: 'الإعدادات الأساسية التي <code>opencode.json(c)</code> يقرؤها. ترتيب أولوية OpenCode: ملف عام ← ملفات المشروع من الخارج إلى الداخل ← <code>.opencode/</code>، والأقرب يفوز.'
    }));

    root.appendChild(globalCompareCard());

    // ---- basics
    const c1 = F.card({ title: 'الأساسيات', desc: 'أهم المفاتيح على مستوى الملف' });
    c1.body.appendChild(F.grid([
      F.field({ label: '$schema', value: d.$schema, placeholder: 'https://opencode.ai/config.json', onChange: v => ST.edit(x => u.setOrDelete(x, '$schema', v)), badge: 'General' }),
      F.field({ label: 'الصدفة (shell)', value: d.shell, placeholder: '/bin/zsh', desc: 'الصدفة المستخدمة في الطرفية وأداة bash', onChange: v => ST.edit(x => u.setOrDelete(x, 'shell', v)) }),
      F.field({
        label: 'النموذج الافتراضي', type: 'modelpicker', value: typeof d.model === 'string' ? d.model : '',
        desc: 'الصيغة: <code>provider/model</code>. ملاحظة: النموذج على المستوى الأعلى لا يحتفظ بـ <code>#variant</code>.',
        hint: d.model && typeof d.model === 'object' ? 'مُخزَّن حالياً بالصيغة الموسّعة: ' + JSON.stringify(d.model) : null,
        onChange: v => ST.edit(x => u.setOrDelete(x, 'model', v))
      }),
      F.field({
        label: 'الوكيل الافتراضي', type: 'agentpicker', value: d.default_agent,
        desc: 'يُستخدم عندما لا تحدد الجلسة وكيلاً. يجب أن يكون موجوداً ومرئياً ويدعم الوضع primary.',
        onChange: v => ST.edit(x => u.setOrDelete(x, 'default_agent', v))
      }),
      F.field({ label: 'اسم المستخدم', value: d.username, placeholder: 'alice', desc: 'يقبله OpenCode لكنه لا يعرضه في المحادثات', onChange: v => ST.edit(x => u.setOrDelete(x, 'username', v)) }),
      F.field({
        label: 'التحديثات', type: 'select', value: d.update || 'notify', options: C.UPDATE_MODES,
        desc: 'تُتجاهل القيم على مستوى المشروع.',
        onChange: v => ST.edit(x => { if (v === 'notify') delete x.update; else x.update = v; })
      }),
      F.field({
        label: 'المشاركة', type: 'select', value: d.share || 'manual', options: C.SHARE_MODES,
        desc: 'مشاركة الجلسات غير مدعومة بعد في V2.',
        onChange: v => ST.edit(x => u.setOrDelete(x, 'share', v))
      })
    ], 'c2'));
    root.appendChild(c1.root);

    // ---- safety / runtime
    const c2 = F.card({ title: 'السلامة والتشغيل' });
    c2.body.appendChild(F.grid([
      F.field({
        label: 'لقطات نظام الملفات (snapshots)', type: 'bool', value: d.snapshots !== false,
        desc: 'تستخدمها ميزات التراجع والإرجاع. فعّال افتراضياً.',
        onChange: v => ST.edit(x => u.setOrDelete(x, 'snapshots', v, v === true ? false : true))
      }),
      F.field({
        label: 'الماسح المحمول للصدفة', type: 'bool',
        value: u.get(d, 'experimental.portable_shell_scanner', false),
        desc: 'يستبدل محلّل tree-sitter القياسي. أمر لا يستطيع المحلّل تحليله يُعيد خطأ محلّل وليس رفض صلاحية.',
        onChange: v => ST.edit(x => u.setOrDelete(x, 'experimental.portable_shell_scanner', v, v === true ? false : true))
      }),
      F.field({
        label: 'مجلد worktrees', value: u.get(d, 'worktree.directory'),
        placeholder: '../worktrees', dir: 'ltr',
        desc: 'المجلد الأب لـ worktrees الجديدة؛ يُلحق OpenCode اسم الـ worktree. المسارات النسبية تُحل من النسخة الأصلية للمشروع.',
        onChange: v => ST.edit(x => u.setOrDelete(x, 'worktree.directory', v))
      }),
      F.field({
        label: 'مزوّد البحث في الويب', type: 'select', value: websearchProvider(d),
        options: [{ id: '', label: '— معطّل (false) —' }].concat(C.WEBSEARCH_PROVIDERS.map(p => ({ id: p, label: p }))),
        desc: 'استخدم <code>random</code> لاختيار مزوّد متاح تلقائياً.',
        onChange: v => ST.edit(x => {
          if (v === '') delete x.websearch;
          else if (v === 'false') x.websearch = false;
          else x.websearch = { provider: v };
        })
      })
    ], 'c2'));
    root.appendChild(c2.root);

    // ---- watcher
    const c3 = F.card({ title: 'مراقب الملفات (watcher)', desc: 'مسارات لا يجب أن تُطلق تحديثات الملفات' });
    c3.body.appendChild(F.listEditor({
      items: u.get(d, 'watcher.ignore', []),
      placeholder: 'dist/**', addLabel: 'إضافة مسار مستثنى',
      emptyText: 'لا توجد مسارات مستثناة',
      hint: 'نماذج عامة مدعومة: <code>*</code> و <code>?</code>.',
      onChange: v => ST.edit(x => u.setOrDelete(x, 'watcher.ignore', v))
    }));
    root.appendChild(c3.root);

    // ---- tool output
    const c4 = F.card({ title: 'إخراج الأدوات (tool_output)', desc: 'الحد الأقصى المحتفظ به من نتيجة أي أداة' });
    c4.body.appendChild(F.grid([
      F.field({ label: 'أقصى عدد أسطر', type: 'number', min: 1, value: u.get(d, 'tool_output.max_lines'), onChange: v => ST.edit(x => u.setOrDelete(x, 'tool_output.max_lines', v)) }),
      F.field({ label: 'أقصى عدد بايت', type: 'number', min: 1, value: u.get(d, 'tool_output.max_bytes'), onChange: v => ST.edit(x => u.setOrDelete(x, 'tool_output.max_bytes', v)) })
    ], 'c2'));
    root.appendChild(c4.root);

    // ---- media
    const c5 = F.card({ title: 'معالجة الصور (media.image)', doc: DOC.attachments, desc: 'ماذا يحدث للصور الكبيرة التي تقرؤها أداة read' });
    c5.body.appendChild(F.grid([
      F.field({ label: 'إعادة تحجيم تلقائي', type: 'bool', value: u.get(d, 'media.image.auto_resize', false), desc: 'عند <code>false</code> تُرفض الصور التي تتجاوز الحدود', onChange: v => ST.edit(x => u.setOrDelete(x, 'media.image.auto_resize', v, v === true ? false : true)) }),
      F.field({ label: 'أقصى عرض', type: 'number', min: 1, value: u.get(d, 'media.image.max_width'), onChange: v => ST.edit(x => u.setOrDelete(x, 'media.image.max_width', v)) }),
      F.field({ label: 'أقصى ارتفاع', type: 'number', min: 1, value: u.get(d, 'media.image.max_height'), onChange: v => ST.edit(x => u.setOrDelete(x, 'media.image.max_height', v)) }),
      F.field({ label: 'أقصى حجم base64', type: 'number', min: 1, value: u.get(d, 'media.image.max_base64_bytes'), desc: 'افتراضي التوثيق: 5242880', onChange: v => ST.edit(x => u.setOrDelete(x, 'media.image.max_base64_bytes', v)) })
    ], 'c4'));
    root.appendChild(c5.root);

    // ---- compaction
    const c6 = F.card({ title: 'ضغط السياق (compaction)', doc: DOC.compaction, desc: 'ضغط السياق التلقائي وكم مقدار السياق الحديث يبقى محفوظاً' });
    c6.body.appendChild(F.grid([
      F.field({ label: 'ضغط تلقائي', type: 'bool', value: u.get(d, 'compaction.auto', true), desc: '<code>false</code> يوقف الضغط التلقائي الجديد دون حذف نقاط الحفظ الموجودة', onChange: v => ST.edit(x => { if (v === true) delete x.compaction; else u.set(x, 'compaction.auto', false); }) }),
      F.field({ label: 'عدد التوكنات المحفوظة', type: 'number', min: 0, value: u.get(d, 'compaction.keep.tokens', 15000), desc: 'الافتراضي 15000', onChange: v => ST.edit(x => u.setOrDelete(x, 'compaction.keep.tokens', v)) }),
      F.field({ label: 'المخزن الاحتياطي (buffer)', type: 'number', min: 0, value: u.get(d, 'compaction.buffer', 20000), desc: 'هامش فوق حدود النموذج قبل بدء الضغط', onChange: v => ST.edit(x => u.setOrDelete(x, 'compaction.buffer', v)) }),
      F.field({
        label: 'تقليم التاريخ القديم (prune)', type: 'select',
        value: u.get(d, 'compaction.prune', '') || '',
        options: [
          { id: '', label: '— الافتراضي (لا تقليم) —' },
          { id: 'old', label: 'old — عند كل ضغط' },
          { id: 'never', label: 'never — تعطيل' }
        ],
        desc: 'يحذف أجزاء التاريخ القديم قبل/أثناء الضغط. اختر <code>old</code> لتخفيف النمو دون فقد الإعدادات.',
        onChange: v => ST.edit(x => u.setOrDelete(x, 'compaction.prune', v))
      })
    ], 'c4'));
    c6.body.appendChild(F.hint('الضغط الأصلي من المزوّد يُفتح عبر سياسة إعدادات: <code>providers.&lt;id&gt;.settings.compaction.type = "native"</code>، ويمكن تجاوزه لكل نموذج.'));
    root.appendChild(c6.root);

    // ---- warming
    const warming = d.warming;
    const wOn = warming === true || (u.isObj(warming) && !warming.disabled);
    const c7 = F.card({ title: 'التسخين (warming)', doc: DOC.warming, desc: 'طلبات دورية خفيفة لإبقاء الجلسات نشطة — معطّل افتراضياً' });
    const wBody = el('div', {});
    c7.body.appendChild(F.field({
      label: 'تفعيل التسخين', type: 'bool', value: wOn,
      onChange: v => ST.edit(x => { if (v) x.warming = {}; else delete x.warming; })
    }));
    c7.body.appendChild(wBody);
    const renderW = () => {
      u.clear(wBody);
      const w = S.data.warming;
      if (!u.isObj(w)) { wBody.appendChild(F.hint('عند التفعيل بدون قيم مخصّصة تُستخدم فاصل 4 دقائق للخمول ونافذة 30 دقيقة للنشاط.')); return; }
      wBody.appendChild(F.grid([
        F.field({ label: 'البرومبت', type: 'textarea', rows: 2, value: w.prompt, onChange: v => ST.edit(x => u.setOrDelete(x, 'warming.prompt', v)) }),
        F.field({ label: 'الفاصل', value: w.interval, placeholder: '4 minutes', desc: 'صيغة مدة نصية', onChange: v => ST.edit(x => u.setOrDelete(x, 'warming.interval', v)) }),
        F.field({ label: 'المدة', value: w.duration, placeholder: '30 minutes', onChange: v => ST.edit(x => u.setOrDelete(x, 'warming.duration', v)) })
      ], 'c2'));
    };
    renderW();
    c7.body.addEventListener('oc:rerender', renderW);
    root.appendChild(c7.root);

    // ---- schema help
    const c8 = F.card({ title: 'مخطط JSON', desc: 'للتحقق والإكمال التلقائي داخل المحرر' });
    c8.body.appendChild(el('div', { class: 'flex wrap' }, [
      el('a', { class: 'btn', href: 'https://opencode.ai/config.json', target: '_blank', rel: 'noopener' }, 'فتح config.json'),
      el('a', { class: 'btn', href: 'https://opencode.ai/v2/cli.json', target: '_blank', rel: 'noopener' }, 'فتح cli.json')
    ]));
    c8.body.appendChild(F.hint('مخطط JSON المنشور قد يسبق أو يتأخر عن توثيق V2. هذه الواجهة تتبع توثيق V2 بالكامل، ولكل حقل موثّق نموذج مخصّص هنا.'));
    root.appendChild(c8.root);
  }

  function websearchProvider(d) {
    const w = d.websearch;
    if (w === false) return 'false';
    if (u.isObj(w) && w.provider) return w.provider;
    if (w === true) return '';
    return '';
  }

  /* ===============================================================
     AGENTS
     =============================================================== */
  function viewAgents(root) {
    const ids = new Set(Object.keys(ST.agents()));
    const custom = Array.from(ids);
    const builtins = C.BUILTIN_AGENTS.filter(b => !ids.has(b.id));

    root.appendChild(F.pageHead({
      icon: '🤖', title: 'الوكلاء (Agents)', doc: DOC.agents, count: custom.length,
      desc: 'كل وكيل يجمع: برومبت النظام + تفضيل النموذج + الصلاحيات + تفاصيل العرض. يوجد وكيلان مدمجان يمكنك تجاوزهما بنفس المعرّف: <code>build</code> و <code>plan</code>.',
      actions: [
        F.btn('وكيل جديد', { kind: 'primary', icon: '+', onClick: () => newAgentDialog() }),
        F.btn('تحديث الواجهة', { icon: '⟳', onClick: () => NS.main.render() })
      ]
    }));

    root.appendChild(F.sectionNote(
      'تعريفات الوكلاء تُدمج بترتيب ملفات الإعداد: القيم البسيطة يستبدلها الملف الأحدث، وخرائط الطلبات تُدمج بالمفتاح، و<b>قواعد الصلاحيات تُضاف ولا تُستبدل</b>. القواعد العامة تُطبّق قبل قواعد الوكيل ليستطيع الوكيل تخصيصها.'));

    if (!custom.length) {
      root.appendChild(el('div', { class: 'empty' }, [
        'لا يوجد وكلاء مخصصون في هذا الملف. اضغط «وكيل جديد» لإنشاء وكيل.',
        el('br'),
        el('span', { class: 'small' }, 'يمكنك أيضاً إنشاء وكيل كملف Markdown داخل مجلد agents/ عبر قسم «الوكلاء من الملفات» في نفس الصفحة.')
      ]));
    }

    const wrap = el('div', { class: 'items' });
    custom.forEach(id => wrap.appendChild(agentCard(id, true)));
    root.appendChild(wrap);

    root.appendChild(el('div', { class: 'divider' }));
    root.appendChild(el('h3', { class: 'small dim', text: 'وكلاء مدمجان غير معرَّفين هنا (يمكن تجاوزهم بتعريف يحمل نفس المعرّف)' }));
    const bw = el('div', { class: 'items', style: { marginTop: '10px' } });
    builtins.forEach(b => {
      const it = F.item({
        title: b.id, icon: b.mode === 'primary' ? '🅰' : '🅱', open: false,
        badges: [
          el('span', { class: 'pill blue', text: b.mode }),
          b.hidden ? el('span', { class: 'pill amber', text: 'مخفي' }) : null
        ],
        subtitle: b.ar,
        headActions: [F.btn('تجاوز بإعدادات', { size: 'sm', onClick: e => { e.stopPropagation(); ST.edit(x => u.set(x, ['agents', b.id], u.get(x, ['agents', b.id], {}))); NS.main.render(); } })]
      });
      it.body.appendChild(F.hint('أضف تعريفاً يحمل هذا المعرّف لتغيير سلوكه أو إبطاله عبر <code>disabled: true</code>.'));
      bw.appendChild(it);
    });
    root.appendChild(bw);

    // file-based agents
    root.appendChild(el('div', { class: 'divider' }));
    const fw = F.card({
      title: 'الوكلاء من ملفات (Markdown)', doc: DOC.agents,
      desc: 'الملفات في <code>agents/&lt;name&gt;.md</code> أو <code>.opencode/agents/&lt;name&gt;.md</code>. جسم الملف يصبح برومبت النظام، و الـ frontmatter يحمل باقي الحقول. المسارات المتداخلة تصنع معرّفات مثل <code>team/reviewer</code>.'
    });
    const fileBox = el('div', {});
    fw.body.appendChild(fileBox);
    root.appendChild(fw.root);
    renderAgentFiles(fileBox);
  }

  function agentCard(id, isCustom) {
    const a = ST.agents()[id] || {};
    const sub = describeSubagents(a.permissions);
    const builtin = C.BUILTIN_AGENTS.find(b => b.id === id);
    const mode = a.mode || (builtin ? builtin.mode : 'primary');

    /* Read / Edit mode. By default an agent card is locked — the user clicks
       «Edit» to enter edit mode. In edit mode every form widget is interactive
       and the card shows «حفظ» + «تراجع» + dirty indicator. Read-only mode
       is safer when the user is just inspecting many agents. */
    let cardMode = 'read';
    let savedSnapshot = null;

    const badges = [
      el('span', { class: 'pill blue', text: mode }),
      a.disabled ? el('span', { class: 'pill red', text: 'معطّل' }) : null,
      a.hidden ? el('span', { class: 'pill amber', text: 'مخفي' }) : null,
      a.model ? el('span', { class: 'pill mono', text: '🤖 ' + (typeof a.model === 'string' ? a.model : (a.model.providerID + '/' + a.model.model)) }) : null,
      el('span', { class: 'pill ' + sub.kind, text: 'فرعيون: ' + sub.pill })
    ].filter(Boolean);

    const editBtn = F.btn('تحرير', {
      size: 'sm', kind: 'primary',
      title: 'افتح حقول التحرير',
      onClick: e => { e.stopPropagation(); enterEdit(); }
    });
    const saveBtn = F.btn('حفظ', {
      size: 'sm', kind: 'primary',
      title: 'حفظ التغييرات على الملف',
      onClick: e => { e.stopPropagation(); saveEdits(); }
    });
    const cancelBtn = F.btn('تراجع عن التغييرات', {
      size: 'sm',
      title: 'العودة إلى آخر حالة محفوظة',
      onClick: e => { e.stopPropagation(); cancelEdits(); }
    });
    const dirtyChip = el('span', { class: 'pill amber edit-dirty', style: { display: 'none' }, text: 'تغييرات غير محفوظة' });

    const it = F.item({
      title: id,
      badges: [...badges, dirtyChip],
      subtitle: a.description || builtin ? (a.description || (builtin ? builtin.ar : '')) : 'بلا وصف',
      headActions: [
        editBtn, saveBtn, cancelBtn,
        F.btn('⧉', { size: 'sm', title: 'تكرار', onClick: e => { e.stopPropagation(); duplicateAgent(id); } }),
        F.btn('⇩', { size: 'sm', title: 'تصدير كملف .md', onClick: e => { e.stopPropagation(); exportAgentMd(id); } }),
        F.btn('✕', { size: 'sm', kind: 'danger', title: 'حذف', onClick: e => { e.stopPropagation(); removeAgent(id); } })
      ],
      open: true
    });

    function refreshHeadActions() {
      editBtn.style.display = cardMode === 'read' ? '' : 'none';
      saveBtn.style.display = cardMode === 'edit' ? '' : 'none';
      cancelBtn.style.display = cardMode === 'edit' ? '' : 'none';
    }

    function enterEdit() {
      savedSnapshot = u.clone(S.data);
      cardMode = 'edit';
      it.body.classList.add('edit-mode');
      it.body.classList.remove('read-mode');
      refreshHeadActions();
    }

    function saveEdits() {
      savedSnapshot = null;
      cardMode = 'read';
      dirtyChip.style.display = 'none';
      it.body.classList.remove('edit-mode');
      it.body.classList.add('read-mode');
      refreshHeadActions();
      NS.fx.toast('save', 'حُفظت تغييرات الوكيل «' + id + '» على الملف الحالي', 2400);
    }

    function cancelEdits() {
      if (savedSnapshot) {
        ST.edit(x => {
          Object.keys(S.data).forEach(k => delete S.data[k]);
          Object.assign(S.data, savedSnapshot);
        });
      }
      savedSnapshot = null;
      cardMode = 'read';
      dirtyChip.style.display = 'none';
      it.body.classList.remove('edit-mode');
      it.body.classList.add('read-mode');
      refreshHeadActions();
      NS.main.render();
      NS.fx.toast('undo', 'تم التراجع عن التغييرات في الوكيل «' + id + '»', 2000);
    }

    it.body.classList.add('read-mode');

    let tab = 'general';
    const body = it.body;
    const renderBody = () => {
      u.clear(body);
      body.appendChild(F.subtabs([
        { id: 'general', label: 'عام' },
        { id: 'prompt', label: 'البرومبت' },
        { id: 'perms', label: 'الصلاحيات', count: (a.permissions || []).length },
        { id: 'model', label: 'النموذج والطلب' }
      ], (t) => { tab = t; renderBody(); }, tab));

      const markDirty = () => { if (cardMode === 'edit') dirtyChip.style.display = ''; };

      const ag = () => ST.agents()[id] || (ST.agents()[id] = {});
      const put = (key, val) => ST.edit(x => {
        const node = u.ensure(x, ['agents', id]);
        u.setOrDelete(node, key, val);
        if (!Object.keys(node).length) delete x.agents[id];
        if (!Object.keys(x.agents || {}).length) delete x.agents;
      });
      const putAndMark = (key, val) => { put(key, val); markDirty(); };

      if (tab === 'general') {
        body.appendChild(F.grid([
          F.field({ label: 'الوصف', type: 'text', value: a.description, desc: 'يظهر للنموذج عند اختيار وكيل فرعي — ضروري للوكلاء الفرعيين', tip: 'الوصف الذي يراه النموذج عند اختيار وكيل فرعي. <b>ضروري</b> للوكلاء الفرعيين.', onChange: (v) => putAndMark('description', v) }),
          F.field({
            label: 'الوضع (mode)', type: 'select', value: mode, options: C.MODES.map(m => ({ id: m.id, label: m.ar + ' — ' + m.id })),
            desc: C.MODES.find(m => m.id === mode)?.desc,
            tip: '<b>primary</b>: وكيل رئيسي للجلسة. <b>subagent</b>: يعمل فقط عبر جلسة فرعية من أداة task. <b>all</b>: كلاهما.',
            onChange: v => putAndMark('mode', v === 'primary' ? undefined : v)
          }),
          F.field({ label: 'اللون', type: 'color', value: a.color, desc: 'ستة أرقام hex', tip: 'لون الوكيل في الواجهة (شريط فتح فوق إعداداته).', onChange: v => putAndMark('color', v) }),
          F.field({ label: 'أقصى عدد خطوات', type: 'number', min: 1, value: a.steps, desc: 'في الخطوة الأخيرة يزيل OpenCode الأدوات ويطلب ملخصاً نصياً', tip: 'عدد خطوات Tool Loop قبل أن يطلب من الوكيل تلخيص نفسه. التلخيص في الخطوة الأخيرة ليس خطأ.', onChange: v => putAndMark('steps', v) }),
          F.field({ label: 'إخفاء من القوائم', type: 'bool', value: a.hidden === true, desc: 'يزيله من القوائم والاكتشاف وكتالوج الوكلاء الفرعية — تحكّم بالظهور لا بالأمان', tip: 'تحكّم بالظهور لا بالأمان. الوكيل المخفي لا يظهر للنموذج في القوائم.', onChange: v => putAndMark('hidden', v === true ? undefined : true) }),
          F.field({ label: 'تعطيل الوكيل', type: 'bool', value: a.disabled === true, desc: 'يزيل الوكيل المدمج أو المخصص عند هذه النقطة', tip: '<code>true</code> يزيل الوكيل نهائياً — لا يمكن للنموذج اختياره.', onChange: v => putAndMark('disabled', v === true ? undefined : true) })
        ], 'c2'));

        const sub2 = describeSubagents(a.permissions);
        body.appendChild(el('div', { class: 'info-box', style: { marginTop: '4px', marginBottom: '0' } },
          'الوكيل ' + sub2.text + '.'));
      }

      if (tab === 'prompt') {
        body.appendChild(F.field({
          label: 'برومبت النظام (system)', type: 'textarea', rows: 14, value: a.system, mono: true,
          desc: 'قيمة غير فارغة تستبدل برومبت المزوّد الأساسي لهذا الوكيل. تعليمات المشروع والمهارات والمراجع تُضاف إليها.',
          tip: 'يستبدل برومبت النظام من المزوّد. تعليمات AGENTS.md و skills و references تُضاف فوقه.',
          placeholder: 'راجع التغييرات دون تعديل الملفات. اذكر النتائج مرتبة حسب الخطورة مع مراجع الملف والسطر.',
          onChange: v => putAndMark('system', v)
        }));
        if (a.system) {
          body.appendChild(el('div', { class: 'md-preview', style: { marginTop: '10px', maxHeight: '220px' }, html: u.mdToHtml(a.system) }));
        }
      }

      if (tab === 'perms') {
        const s2 = describeSubagents(a.permissions);
        body.appendChild(el('div', { class: 'info-box' },
          'قواعد الصلاحيات الخاصة بهذا الوكيل <b>تُضاف بعد</b> القواعد العامة، فهي لا تستبدلها. الوكيل الفرعي يستخدم صلاحياته الخاصة لا صلاحيات والده. — حالة إطلاق الوكلاء الفرعية حالياً: <b>' + s2.text + '</b>.'));
        body.appendChild(F.rulesTable({
          value: a.permissions || [], actions: C.PERM_ACTIONS, effects: C.EFFECTS,
          onChange: v => putAndMark('permissions', v),
          presets: [
            { action: 'edit', resource: '*', effect: 'deny' },
            { action: 'subagent', resource: '*', effect: 'deny' },
            { action: 'question', resource: '*', effect: 'deny' },
            { action: 'shell', resource: 'rm *', effect: 'deny' }
          ]
        }));
      }

      if (tab === 'model') {
        const modelVal = typeof a.model === 'string' ? a.model : (u.isObj(a.model) ? [a.model.providerID, a.model.model].filter(Boolean).join('/') + (a.model.variant ? '#' + a.model.variant : '') : '');
        body.appendChild(F.grid([
          F.field({
            label: 'النموذج', type: 'modelpicker', value: modelVal,
            desc: 'الوكيل الفرعي يستخدم نموذجه المحدد، أو يرث نموذج الجلسة إذا لم يُحدَّد.',
            hint: 'الصيغة الموسّعة <code>{ providerID, model, variant }</code> مدعومة أيضاً في JSON.',
            tip: 'الوكيل الفرعي يستخدم نموذجه المحدد، أو يرث من الجلسة الرئيسية. الصيغة: <code>provider/model#variant</code>.',
            onChange: v => putAndMark('model', v)
          }),
          F.field({ label: 'الصيغة المستخدمة', type: 'select', value: typeof a.model === 'object' ? 'object' : 'string', options: [{ id: 'string', label: 'نص: provider/model#variant' }, { id: 'object', label: 'كائن JSON موسّع' }], emptyValue: 'string', onChange: v => putAndMark('model', v === 'object' ? { providerID: '', model: '' } : undefined) })
        ], 'c2'));

        body.appendChild(el('div', { class: 'divider' }));
        body.appendChild(el('h4', { class: 'small', text: 'طلبات HTTP (request)' }));
        body.appendChild(F.sectionNote('تحتفظ جلسات V2 بهذه القيم لكنها <u>لا ترسلها</u> بعد مع طلبات النموذج. اضبط إعدادات الطلب الفعلية على المزوّد أو النموذج أو الـ variant. Legacy fields مثل <code>temperature</code> و <code>prompt</code> و <code>maxSteps</code> ممنوعة في V2.', 'warn'));
        body.appendChild(F.kvEditor({
          value: u.get(a, 'request.headers', {}), keyPlaceholder: 'x-agent', valPlaceholder: 'reviewer',
          addLabel: 'رأس (header)', onChange: v => putAndMark('request.headers', v)
        }));
        body.appendChild(el('div', { style: { height: '10px' } }));
        body.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'حقول جسم الطلب (body)' }),
          F.typedKV({
            value: u.get(a, 'request.body', {}), addLabel: 'حقل جسم الطلب', keyPlaceholder: 'temperature',
            emptyText: 'لا توجد حقول في جسم الطلب', onChange: v => putAndMark('request.body', v)
          })
        ]));
      }
    };
    renderBody();
    refreshHeadActions();
    return it;
  }

  function newAgentDialog() {
    const nameIn = el('input', { type: 'text', class: 'mono', placeholder: 'reviewer', dir: 'ltr' });
    const descIn = el('input', { type: 'text', placeholder: 'يراجع التغييرات دون تعديل الملفات' });
    const modeIn = el('select', {}, C.MODES.map(m => el('option', { value: m.id, text: m.ar + ' — ' + m.id })));
    modeIn.value = 'subagent';
    const body = el('div', { class: 'grid' }, [
      el('div', { class: 'field' }, [el('label', { text: 'معرّف الوكيل' }), nameIn, el('span', { class: 'desc', text: 'أحرف صغيرة وشرطات. المسار المتداخل يصنع معرّفاً مثل team/reviewer' })]),
      el('div', { class: 'field' }, [el('label', { text: 'الوصف' }), descIn]),
      el('div', { class: 'field' }, [el('label', { text: 'الوضع' }), modeIn])
    ]);
    u.modal({
      title: 'وكيل جديد', body,
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'إنشاء', kind: 'primary', close: false, onClick: () => {
            const id = u.slug(nameIn.value);
            if (!id) { u.toast('err', 'أدخل معرّفاً صالحاً'); return false; }
            if (ST.agents()[id]) { u.toast('err', 'المعرّف مستخدم بالفعل'); return false; }
            ST.edit(x => {
              u.set(x, ['agents', id], { description: descIn.value.trim() || undefined, mode: modeIn.value });
              u.setOrDelete(x, ['agents', id, 'description'], descIn.value.trim());
              if (modeIn.value === 'primary') delete x.agents[id].mode;
            });
            u.closeModal();
            NS.main.render();
            u.toast('ok', 'أُنشئ الوكيل ' + id);
          }
        }
      ]
    });
  }

  function duplicateAgent(id) {
    const copy = u.clone(ST.agents()[id] || {});
    let nid = id + '-copy', i = 2;
    while (ST.agents()[nid]) { nid = id + '-copy' + i; i++; }
    ST.edit(x => x.agents[nid] = copy);
    NS.main.render();
    u.toast('ok', 'نُسخ إلى ' + nid);
  }

  async function removeAgent(id) {
    const ok = await u.confirmBox('حذف الوكيل', 'سيُحذف تعريف الوكيل «' + id + '» من هذا الملف. لن تتأثر ملفات .md.', 'حذف');
    if (!ok) return;
    ST.edit(x => {
      if (x.agents) delete x.agents[id];
      if (x.agents && !Object.keys(x.agents).length) delete x.agents;
    });
    NS.main.render();
  }

  function exportAgentMd(id) {
    const a = ST.agents()[id] || {};
    const fm = {};
    if (a.description) fm.description = a.description;
    if (a.mode) fm.mode = a.mode;
    if (a.model) fm.model = typeof a.model === 'string' ? a.model : [a.model.providerID, a.model.model, a.model.variant].filter(Boolean).join('/');
    if (a.steps) fm.steps = a.steps;
    if (a.hidden) fm.hidden = true;
    if (a.color) fm.color = a.color;
    if (a.disabled) fm.disabled = true;
    if (Array.isArray(a.permissions) && a.permissions.length) {
      fm.permissions = a.permissions.map(r => ({ action: r.action, resource: r.resource, effect: r.effect }));
    }
    const text = NS.jsonc.composeFile(fm, a.system || '');
    u.download(id + '.md', text, 'text/markdown;charset=utf-8');
  }

  function renderAgentFiles(box) {
    const FV = NS.fileviews;
    FV.renderMarkdownList(box, {
      kind: 'agents',
      label: 'ملف وكيل جديد',
      idFrom: (rel) => rel.replace(/\.md$/i, ''),
      onOpen: (f) => FV.editMarkdown(f, 'agent'),
      onCreate: (full, dir) => FV.createFile(full, dir, 'agent')
    });
  }

  /* ===============================================================
     PERMISSIONS
     =============================================================== */
  function viewPermissions(root) {
    const d = S.data;
    root.appendChild(F.pageHead({
      icon: '🔐', title: 'الصلاحيات العامة', doc: DOC.permissions, count: (d.permissions || []).length,
      desc: 'قائمة مرتّبة تحدد ما إذا كان بإمكان الوكيل تنفيذ إجراء على مورد. <b>آخر قاعدة مطابقة تفوز</b>. إذا لم تطابق أي قاعدة تكون النتيجة <code>ask</code>.',
      actions: [
        F.btn('سياسات متقدمة', { onClick: () => NS.main.go('policies') }),
        F.btn('تحديث', { icon: '⟳', onClick: () => NS.main.render() })
      ]
    }));

    /* توضيح علوي سريع للمستخدم */
    root.appendChild(F.sectionNote(
      '<b>ما الفرق بين هذا القسم وقسم «الوكلاء»؟</b> القواعد هنا تُطبَّق على <b>كل</b> الوكلاء قبل قواعدهم الخاصة. الوكيل الفرعي يستخدم صلاحياته الخاصة لا صلاحيات والده. الفجوة لاتخاذ القرار: <b>قواعد الوكيل تُضاف بعد القواعد العامة، لذا فإن قاعدة عامة «أو منع» لا تستطيع التراجع لصالح قاعدة وكيل «اسماح».</b>',
      'info'));

    root.appendChild(el('div', { class: 'grid c2' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, el('h3', { text: 'كيف تُطبَّق القواعد' })),
        el('div', { class: 'card-body' }, el('div', {}, [
          el('p', { class: 'small dim', html: 'تُدمج القواعد بالترتيب: <b>إعدادات ذات أولوية أقل ← القواعد العامة ← قواعد الوكيل</b>. القواعد العامة تُضاف، ولا تستبدل قواعد الوكيل.' }),
          el('p', { class: 'small dim', html: 'العملية قد تفحص عدة موارد (مثل رقعة تمس ملفات متعددة): أي <code>deny</code> يمنع، وإلا أي <code>ask</code> يسأل، وإلا يُسمح.' }),
          el('p', { class: 'small dim', html: 'أنماط بسيطة على القيمة كاملة: <code>*</code> صفر أو أكثر حرف (بما في ذلك <code>/</code>)، و <code>?</code> حرف واحد. نمط ينتهي بـ <code> *</code> يطابق الأمر بلا وسائط أيضاً.' }),
          el('p', { class: 'small dim', html: 'لـ <code>read</code> و <code>edit</code> و <code>external_directory</code> يتم توسيع <code>~</code> و <code>$HOME</code>. موارد shell تبقى نص أمر خام.' })
        ]))
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, el('h3', { text: 'السياسة الافتراضية الأساسية' })),
        el('div', { class: 'card-body' }, [
          el('p', { class: 'small dim', text: 'يبدأ كل وكيل بهذه القواعد، ثم تضيف قواعدك العامة، ثم قواعد الوكيل:' }),
          el('pre', { class: 'snippet', html: u.esc(JSON.stringify([
            { action: '*', resource: '*', effect: 'allow' },
            { action: 'external_directory', resource: '*', effect: 'ask' },
            { action: 'read', resource: '*.env', effect: 'ask' },
            { action: 'read', resource: '*.env.*', effect: 'ask' },
            { action: 'read', resource: '*.env.example', effect: 'allow' }
          ], null, 2)) }),
          el('p', { class: 'small dim', html: '<code>build</code> يسمح بالأسئلة · <code>plan</code> يسمح بالأسئلة ويمنع التعديل خارج <code>~/.opencode/plan</code> · <code>general</code> يمنع الأسئلة وإطلاق الوكلاء الفرعية · <code>explore</code> يمنع كل شيء عدا القراءة والبحث والجلب.</p>' })
        ])
      ])
    ]));

    const c = F.card({
      title: 'قواعد الصلاحيات',
      desc: 'رتّب من العام إلى الاستثناء. مثال: اسمح بـ shell ثم اسأل، ثم اسمح بأوامر git للقراءة فقط، ثم امنع git push.',
      actions: [F.btn('استعادة القواعد الافتراضية', { size: 'sm', onClick: () => { ST.edit(x => u.setOrDelete(x, 'permissions', [
        { action: 'shell', resource: '*', effect: 'ask' },
        { action: 'shell', resource: 'git status *', effect: 'allow' },
        { action: 'shell', resource: 'git diff *', effect: 'allow' },
        { action: 'shell', resource: 'git push *', effect: 'deny' }
      ])); NS.main.render(); } })]
    });
    c.body.appendChild(F.rulesTable({
      value: d.permissions || [], actions: C.PERM_ACTIONS, effects: C.EFFECTS, onSort: true,
      onChange: v => ST.edit(x => u.setOrDelete(x, 'permissions', v)),
      presets: [
        { action: 'shell', resource: '*', effect: 'ask' },
        { action: 'read', resource: '*.env', effect: 'deny' },
        { action: 'edit', resource: '*.env', effect: 'deny' },
        { action: 'external_directory', resource: '*', effect: 'ask' },
        { action: 'webfetch', resource: '*', effect: 'ask' },
        { action: 'subagent', resource: '*', effect: 'allow' }
      ]
    }));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'الماسح المحمول', doc: DOC.permissions });
    c2.body.appendChild(F.field({
      label: 'experimental.portable_shell_scanner', type: 'bool',
      value: u.get(d, 'experimental.portable_shell_scanner', false),
      desc: 'يستبدل محلّل tree-sitter القياسي. الأمر الذي لا يستطيع المحلّل تحليله يُعيد خطأ محلّل — ليس رفض صلاحية.',
      tip: 'يستبدل محلّل tree-sitter بأكثر منه توافقية. أمر لا يمكن تحليله يُعيد خطأ محلّل لا رفض صلاحية.',
      onChange: v => ST.edit(x => u.setOrDelete(x, 'experimental.portable_shell_scanner', v, v === true ? false : true))
    }));
    root.appendChild(c2.root);

    // MCP-derived action helper
    const mcpNames = Object.keys(u.get(d, 'mcp.servers', {}));
    if (mcpNames.length) {
      const c3 = F.card({ title: 'أدوات MCP كأفعال صلاحيات', desc: 'كل أداة MCP تصبح فعلاً بالشكل <code>&lt;server&gt;_&lt;tool&gt;</code>' });
      c3.body.appendChild(el('div', { class: 'flex wrap' }, mcpNames.map(n =>
        el('button', {
          class: 'btn sm mono', dir: 'ltr',
          onclick: () => {
            ST.edit(x => u.set(x, 'permissions', (x.permissions || []).concat([{ action: n + '_*', resource: '*', effect: 'deny' }])));
            NS.main.render();
          }
        }, n + '_*'))));
      c3.body.appendChild(F.hint('اضغط لإضافة قاعدة منع لكل أدوات هذا الخادم.'));
      root.appendChild(c3.root);
    }
  }

  /* ===============================================================
     POLICIES
     =============================================================== */
  function viewPolicies(root) {
    const d = S.data;
    const pol = u.get(d, 'experimental.policies', []);
    root.appendChild(F.pageHead({
      icon: '🛡', title: 'السياسات (experimental.policies)', doc: DOC.policies, count: pol.length,
      desc: 'السياسات منفصلة عن الصلاحيات: ثنائية (allow/deny)، لا تسأل أبداً، وتُشدّد فقط ما تسمح به الصلاحيات والمزوّدات.'
    }));

    root.appendChild(F.sectionNote(
      '<b>الفرق بين «الصلاحيات» و«السياسات»:</b> الصلاحيات تسأل عند عدم اليقين وتعرض للمستخدم خيارات (allow/ask/deny). السياسات <b>ثنائية</b> فقط — تنفّذ فوراً دون سؤال. فإذا كتبت سياسة <code>shell:rm * deny</code> لن يسأل حتى لو سمحت الصلاحيات. <b>هذا القسم تجريبي</b> وقد يتغير في V2.',
      'warn'));

    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, el('h3', { text: 'ترتيب الأولوية (يعكس إعدادات OpenCode)' })),
      el('div', { class: 'table-wrap' }, el('table', { class: 'tbl' }, [
        el('tbody', {}, [
          ['1 (الأعلى)', 'مساحة عمل OpenCode Console المتصلة'],
          ['2', 'الملف العام  ~/.config/opencode/opencode.json(c)'],
          ['3', 'ملفات opencode.json(c) المباشرة — الدليل الخارجي يتقدم على الداخلي'],
          ['4 (الأدنى)', '.opencode/opencode.json(c) — الدليل الخارجي يتقدم على الداخلي']
        ].map(r => el('tr', {}, [el('td', { class: 'nowrap' }, el('span', { class: 'pill mono', text: r[0] })), el('td', { class: 'dim', text: r[1] })])))
      ]))
    ]));

    const c = F.card({ title: 'البيانات', desc: 'داخل ملف واحد تبقى العبارات بالترتيب المكتوب. أولوية التطابق: آخر تطابق يفوز.' });
    c.body.appendChild(F.rulesTable({
      value: pol, actions: C.POLICY_ACTIONS, effects: C.POLICY_EFFECTS,
      actionLabel: 'الإجراء', resourceLabel: 'المورد',
      onChange: v => ST.edit(x => u.setOrDelete(x, 'experimental.policies', v)),
      presets: [
        { action: 'provider.use', resource: '*', effect: 'deny' },
        { action: 'permission', resource: 'shell:rm *', effect: 'deny' },
        { action: 'permission', resource: 'read:*/.ssh/*', effect: 'deny' },
        { action: 'permission', resource: 'external_directory:*', effect: 'deny' }
      ],
      orderNote: 'داخل ملف واحد: <b>آخر عبارة تطابق تفوز</b> — ضع العبارات العامة أولاً ثم الاستثناءات. تُضاف سياسات Console بعد كل العبارات المكتوبة، فتكون لها الكلمة الأخيرة.'
    }));
    root.appendChild(c.root);

    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, el('h3', { text: 'مرجع سريع' })),
      el('div', { class: 'card-body' }, el('div', { class: 'grid c2' }, [
        el('div', {}, [
          el('h4', { class: 'small', text: 'provider.use' }),
          el('p', { class: 'small dim', html: 'المورد هو معرّف المزوّد: <code>anthropic</code> أو <code>openai</code> أو معرّف مخصّص من <code>providers</code>. المزوّد المرفوض يختفي من الكتالوج حتى لو كانت بياناته صالحة.' }),
          el('pre', { class: 'snippet', html: u.esc(JSON.stringify({ experimental: { policies: [{ action: 'provider.use', resource: '*', effect: 'deny' }, { action: 'provider.use', resource: 'anthropic', effect: 'allow' }] } }, null, 2)) })
        ]),
        el('div', {}, [
          el('h4', { class: 'small', text: 'permission' }),
          el('p', { class: 'small dim', html: 'المورد هو <code>&lt;action&gt;:&lt;value&gt;</code>. يرفض الفحص ويظهر <code>Blocked by configuration policy</code> بدل السؤال، ويتجاوز حتى موافقات «اسمح دائماً» المحفوظة.' }),
          el('pre', { class: 'snippet', html: u.esc(JSON.stringify({ experimental: { policies: [{ action: 'permission', resource: 'shell:git push *', effect: 'deny' }, { action: 'permission', resource: 'shell:git status *', effect: 'allow' }] } }, null, 2)) })
        ])
      ]))
    ]));
  }

  NS.views = NS.views || {};
  Object.assign(NS.views, {
    general: viewGeneral, agents: viewAgents,
    permissions: viewPermissions, policies: viewPolicies
  });
  NS.helpers = { describeSubagents, lastMatch, wildcardMatch, renderAgentFiles };
})(window.OCM);
