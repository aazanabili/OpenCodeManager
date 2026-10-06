/* ============================================================
   views-infra.js — MCP · Providers & Models · Raw JSON
   =============================================================== */
(function (NS) {
  'use strict';
  const u = NS.u, F = NS.F, C = NS.C, ST = NS.store, S = ST.S;
  const { el } = u;
  /* ===============================================================
     MCP
     =============================================================== */
  function viewMcp(root) {
    const d = S.data;
    const servers = u.get(d, 'mcp.servers', {});
    const names = Object.keys(servers);
    root.appendChild(F.pageHead({
      icon: '🔌', title: 'خوادم MCP', doc: 'mcp-servers', count: names.length,
      desc: 'تُعرَّف تحت <code>mcp.servers</code> في V2 (ليست مباشرة تحت <code>mcp</code>). تتصل تلقائياً ما لم تُعطَّل بـ <code>disabled</code>.',
      actions: [F.btn('خادم جديد', { kind: 'primary', icon: '+', onClick: () => newServer() })]
    }));
    const c0 = F.card({ title: 'المهلات العامة', desc: 'بالمللي ثانية. ي/object الخادم يتجاوز القيم المطابقة.' });
    const td = u.get(d, 'mcp.timeout', {});
    c0.body.appendChild(F.grid([
      F.field({ label: 'mcp.timeout.startup', type: 'number', min: 1, value: td.startup, desc: 'افتراضي 30000 — اتصال النقل وتهيئة الخادم', onChange: v => ST.edit(x => u.setOrDelete(x, 'mcp.timeout.startup', v)) }),
      F.field({ label: 'mcp.timeout.catalog', type: 'number', min: 1, value: td.catalog, desc: 'افتراضي 30000 — سرد الأدوات والمطالبات والموارد', onChange: v => ST.edit(x => u.setOrDelete(x, 'mcp.timeout.catalog', v)) }),
      F.field({ label: 'mcp.timeout.execution', type: 'number', min: 1, value: td.execution, desc: 'افتراضي 43200000 (12 ساعة) — تنفيذ الأدوات', onChange: v => ST.edit(x => u.setOrDelete(x, 'mcp.timeout.execution', v)) })
    ], 'c3'));
    c0.body.appendChild(F.hint('كل القيم بالمللي ثانية.'));
    root.appendChild(c0.root);
    if (!names.length) root.appendChild(el('div', { class: 'empty', text: 'لا توجد خوادم MCP مهيّأة في هذا الملف.' }));
    const wrap = el('div', { class: 'items' });
    names.forEach(name => {
      const s = servers[name] || {};
      const type = s.type || 'local';
      const it = F.item({
        title: name, open: true,
        badges: [
          el('span', { class: 'pill ' + (type === 'remote' ? 'purple' : 'blue'), text: type }),
          s.disabled ? el('span', { class: 'pill red', text: 'معطّل' }) : el('span', { class: 'pill green', text: 'متصل تلقائياً' }),
          s.codemode === false ? el('span', { class: 'pill amber', text: 'بدون Code Mode' }) : null,
          s.protocol && s.protocol !== 'legacy' ? el('span', { class: 'pill', text: s.protocol }) : null
        ].filter(Boolean),
        subtitle: type === 'remote' ? (s.url || '') : ((s.command || []).join(' ')),
        headActions: [
          F.btn(s.disabled ? 'تفعيل' : 'تعطيل', { size: 'sm', onClick: e => { e.stopPropagation(); ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'disabled'], true, !s.disabled)); NS.main.render(); } }),
          F.btn('✕', { size: 'sm', kind: 'danger', onClick: async e => {
            e.stopPropagation();
            if (await u.confirmBox('حذف الخادم', 'سيُحذف الخادم «' + name + '» من الإعداد. بيانات OAuth المخزّنة خارج الملف.', 'حذف')) {
              ST.edit(x => { if (x.mcp && x.mcp.servers) delete x.mcp.servers[name]; if (x.mcp && u.isObj(x.mcp.servers) && !Object.keys(x.mcp.servers).length) delete x.mcp.servers; });
              NS.main.render();
            }
          } })
        ]
      });
      const b = it.body;
      b.appendChild(F.grid([
        F.field({ label: 'type', type: 'select', value: type, options: [{ id: 'local', label: 'local — عبر stdio' }, { id: 'remote', label: 'remote — Streamable HTTP' }], onChange: v => ST.edit(x => { u.ensure(x, ['mcp', 'servers', name]).type = v; }) }),
        F.field({ label: 'protocol', type: 'select', value: s.protocol || 'legacy', options: C.MCP_PROTOCOLS.map(p => ({ id: p.id, label: p.ar })), hint: C.MCP_PROTOCOLS.find(p => p.id === (s.protocol || 'legacy'))?.desc, onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'protocol'], v === 'legacy' ? undefined : v)) }),
        F.field({ label: 'codemode', type: 'bool', value: s.codemode !== false, desc: 'false يكشف الأدوات مباشرة بدل تجميعها في Code Mode', onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'codemode'], false, v === false)) }),
        F.field({ label: 'disabled', type: 'bool', value: s.disabled === true, desc: 'يمنع الاتصال', onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'disabled'], true, v)) })
      ], 'c4'));
      if (type === 'local') {
        const cmdArr = (s.command || []).join(' ');
        b.appendChild(F.field({
          label: 'command', value: cmdArr, mono: true, dir: 'ltr',
          desc: 'التنecutable ثم وسائطه، مفصولة بمسافات.',
          placeholder: 'npx -y @modelcontextprotocol/server-everything',
          onChange: v => ST.edit(x => u.set(x, ['mcp', 'servers', name, 'command'], v ? v.trim().split(/\s+/) : []))
        }));
        b.appendChild(F.field({ label: 'cwd', value: s.cwd, dir: 'ltr', placeholder: '.', onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'cwd'], v)) }));
        b.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'environment' }),
          F.kvEditor({
            value: s.environment || {}, addLabel: 'متغير', keyPlaceholder: 'MCP_API_KEY', valPlaceholder: '{env:MCP_API_KEY}',
            onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'environment'], v))
          }),
          F.hint('استخدم <code>{env:NAME}</code> للاستبدال. تعبيرات الصدفة مثل <code>$NAME</code> لا تُوسَّع داخل نصوص JSON.')
        ]));
      } else {
        b.appendChild(F.field({ label: 'url', value: s.url, dir: 'ltr', placeholder: 'https://mcp.context7.com/mcp', desc: 'عنوان Streamable HTTP مطلق', onChange: v => ST.edit(x => u.set(x, ['mcp', 'servers', name, 'url'], v)) }));
        b.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'headers' }),
          F.kvEditor({ value: s.headers || {}, addLabel: 'رأس', keyPlaceholder: 'Authorization', valPlaceholder: 'Bearer {env:MCP_API_KEY}', onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'headers'], v)) }),
          F.hint('احفظ الأسرار في متغيرات بيئة لا في الملف.')
        ]));
        // OAuth
        const oauth = s.oauth;
        const oauthOff = oauth === false;
        const owrap = el('div', {});
        const orender = () => {
          u.clear(owrap);
          const sw = F.field({
            label: 'oauth — تعطيل', type: 'bool', value: oauthOff,
            desc: 'OAuth مفعّل افتراضياً للخوادم البعيدة. استخدم false فقط إذا كان الخادم يعتمد على مفتاح API أو رأس.',
            onChange: v => ST.edit(x => {
              if (v) u.set(x, ['mcp', 'servers', name, 'oauth'], false);
              else delete x.mcp.servers[name].oauth;
            })
          });
          owrap.appendChild(sw);
          if (oauthOff) return;
          const o = u.isObj(oauth) ? oauth : {};
          owrap.appendChild(F.grid([
            F.field({ label: 'client_id', value: o.client_id, onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'oauth', 'client_id'], v)) }),
            F.field({ label: 'client_secret', type: 'password', value: o.client_secret, onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'oauth', 'client_secret'], v)) }),
            F.field({ label: 'scope', value: o.scope, desc: 'نطاقات مفصولة بمسافات', onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'oauth', 'scope'], v)) }),
            F.field({ label: 'callback_port', type: 'number', min: 1, max: 65535, value: o.callback_port, desc: 'منفذ محلي مؤقت افتراضياً', onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'oauth', 'callback_port'], v)) }),
            F.field({ label: 'redirect_uri', value: o.redirect_uri, dir: 'ltr', onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'oauth', 'redirect_uri'], v)) }),
            F.field({ label: 'auth_server_metadata_url', value: o.auth_server_metadata_url, dir: 'ltr', desc: 'مستند بيانات OAuth/OIDC', onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'oauth', 'auth_server_metadata_url'], v)) })
          ], 'c2'));
        };
        orender();
        b.appendChild(el('div', { class: 'field' }, [el('label', { text: 'المصادقة (OAuth)' }), owrap]));
      }
      // per-server timeouts
      const st = s.timeout || {};
      b.appendChild(el('div', { class: 'divider' }));
      b.appendChild(el('h4', { class: 'small', text: 'تجاوز المهلات لهذا الخادم' }));
      b.appendChild(F.grid([
        F.field({ label: 'timeout.startup', type: 'number', min: 1, value: st.startup, onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'timeout', 'startup'], v)) }),
        F.field({ label: 'timeout.catalog', type: 'number', min: 1, value: st.catalog, onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'timeout', 'catalog'], v)) }),
        F.field({ label: 'timeout.execution', type: 'number', min: 1, value: st.execution, onChange: v => ST.edit(x => u.setOrDelete(x, ['mcp', 'servers', name, 'timeout', 'execution'], v)) })
      ], 'c3'));
      b.appendChild(el('div', { class: 'flex wrap', style: { marginTop: '12px' } }, [
        el('span', { class: 'pill mono', text: 'tool action: ' + normAction(name) + '_*' }),
        F.btn('أضف قاعدة منع لأدوات هذا الخادم', {
          size: 'sm', onClick: () => {
            ST.edit(x => u.set(x, 'permissions', (x.permissions || []).concat([{ action: normAction(name) + '_*', resource: '*', effect: 'deny' }])));
            NS.main.go('permissions');
          }
        })
      ]));
      wrap.appendChild(it);
    });
    root.appendChild(wrap);
    const c2 = F.card({ title: 'إدارة من الطرفية' });
    c2.body.appendChild(el('pre', { class: 'snippet', html: u.esc(`opencode mcp add context7 --url https://mcp.context7.com/mcp
opencode mcp add context7 --global --url https://mcp.context7.com/mcp
opencode mcp add everything -- npx -y @modelcontextprotocol/server-everything
opencode mcp list
opencode mcp auth sentry
opencode mcp logout sentry`) }));
    c2.body.appendChild(F.hint('تسمية الأداة: <code>&lt;server&gt;_&lt;tool&gt;</code> بعد استبدال أي محرف غير أبجدية رقمية بـ <code>_</code>، وتصبح أوامر MCP بالشكل <code>&lt;server&gt;:&lt;prompt&gt;</code> مثل <code>/context_7:find_docs</code>.'));
    root.appendChild(c2.root);
  }
  function normAction(name) { return String(name).replace(/[^A-Za-z0-9_-]/g, '_'); }
  /* ---------------- provider settings form ----------------
     settings is package-specific, so we surface the fields the docs name
     for the built-in runtimes and keep a typed bag for anything else. */
  const LIMIT_FIELDS = [
    { key: 'context', label: 'context — نافذة السياق' },
    { key: 'output', label: 'output — أقصى إخراج' },
    { key: 'input', label: 'input — أقصى إدخال' }
  ];
  const COST_FIELDS = [
    { key: 'input', label: 'input' }, { key: 'output', label: 'output' },
    { key: 'cache_read', label: 'cache_read' }, { key: 'cache_write', label: 'cache_write' },
    { key: 'reasoning', label: 'reasoning' }
  ];
  const MEDIA_TYPES = ['text', 'image', 'audio', 'video', 'pdf', 'file'];
  const CAPABILITY_FLAGS = [
    { key: 'tool_call', label: 'استدعاء الأدوات' },
    { key: 'reasoning', label: 'استدلال' },
    { key: 'structured_output', label: 'إخراج منظّم' },
    { key: 'tool_attachments', label: 'مرفقات الأدوات' }
  ];
  /** Extra settings rows that matter for a given provider id. */
  function providerExtras(pid, canonical) {
    const id = String(pid || '');
    if (id === 'azure' || canonical === 'azure') {
      return [{ key: 'resourceName', label: 'resourceName (Azure)', type: 'text' }];
    }
    if (id === 'amazon-bedrock' || canonical === 'amazon-bedrock') {
      return [{ key: 'profile', label: 'profile (AWS)', type: 'text' }, { key: 'region', label: 'region (AWS)', type: 'text' }];
    }
    if (id === 'google-vertex' || canonical === 'google-vertex') {
      return [{ key: 'project', label: 'project (Vertex)', type: 'text' }, { key: 'location', label: 'location (Vertex)', type: 'text' }];
    }
    if (id === 'ollama') {
      return [{ key: 'apiKey', label: 'apiKey (Ollama)', type: 'text' }];
    }
    return [];
  }
  function providerSettingsForm(pid, p) {
    const box = el('div', {});
    const s = u.get(p, 'settings', {}) || {};
    const put = (key, val) => ST.edit(x => {
      const node = u.ensure(x, ['providers', pid]);
      if (!u.isObj(node.settings)) node.settings = {};
      u.setOrDelete(node.settings, key, val);
      if (!Object.keys(node.settings).length) delete node.settings;
    });
    const common = [
      { key: 'baseURL', label: 'baseURL — نقطة النهاية', type: 'text' },
      { key: 'apiKey', label: 'apiKey', type: 'text' },
      { key: 'transport', label: 'transport', type: 'select', options: ['', 'http', 'websocket'] },
      { key: 'timeout', label: 'timeout — مللي ثانية للطلب كاملاً', type: 'number' },
      { key: 'headerTimeout', label: 'headerTimeout', type: 'number' },
      { key: 'chunkTimeout', label: 'chunkTimeout', type: 'number' },
      { key: 'compactionType', label: 'compaction.type', type: 'select', options: ['', 'local', 'native', 'summary'], nested: 'compaction.type' }
    ];
    box.appendChild(F.grid(common.map(f => {
      const path = f.nested ? f.nested.split('.') : [f.key];
      const val = f.nested ? u.get(s, f.nested) : s[f.key];
      const onChange = v => ST.edit(x => {
        const node = u.ensure(x, ['providers', pid]);
        if (!u.isObj(node.settings)) node.settings = {};
        u.setOrDelete(node.settings, path, v);
        if (!Object.keys(node.settings).length) delete node.settings;
      });
      if (f.type === 'select') return F.field({ label: f.label, type: 'select', value: val || '', options: f.options, onChange: v => onChange(v || undefined) });
      if (f.type === 'number') return F.field({ label: f.label, type: 'number', min: 0, value: val, onChange });
      return F.field({ label: f.label, value: val, dir: 'ltr', onChange });
    }), 'c3'));
    const extras = providerExtras(pid, p.canonical);
    if (extras.length) {
      box.appendChild(el('div', { class: 'divider' }));
      box.appendChild(el('h4', { class: 'small', text: 'حقول خاصة بهذا المزوّد' }));
      box.appendChild(F.grid(extras.map(f => F.field({
        label: f.label, value: s[f.key], dir: 'ltr',
        onChange: v => ST.edit(x => {
          const node = u.ensure(x, ['providers', pid]);
          if (!u.isObj(node.settings)) node.settings = {};
          u.setOrDelete(node.settings, f.key, v);
          if (!Object.keys(node.settings).length) delete node.settings;
        })
      })), 'c3'));
    }
    // anything else the user already had
    const known = new Set(common.map(f => f.key).concat(extras.map(f => f.key)).concat(['compaction']));
    const rest = {};
    Object.keys(s).forEach(k => { if (!known.has(k)) rest[k] = s[k]; });
    box.appendChild(el('div', { class: 'divider' }));
    box.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'بقية إعدادات الحزمة' }),
      F.typedKV({
        value: rest, addLabel: 'إعداد', keyPlaceholder: 'اسم الإعداد',
        emptyText: 'لا توجد إعدادات أخرى',
        onChange: v => ST.edit(x => {
          const node = u.ensure(x, ['providers', pid]);
          const merged = {};
          Object.keys(s).forEach(k => { if (known.has(k)) merged[k] = s[k]; });
          Object.assign(merged, v || {});
          if (Object.keys(merged).length) node.settings = merged; else delete node.settings;
        })
      })
    ]));
    return box;
  }
  /** Model capabilities: boolean feature flags plus media-type chips. */
  function modelCapabilitiesForm(pid, mid, m) {
    const cap = m.capabilities || {};
    const put = (path, val) => ST.edit(x => {
      const node = u.ensure(x, ['providers', pid, 'models', mid]);
      if (!u.isObj(node.capabilities)) node.capabilities = {};
      u.setOrDelete(node.capabilities, path, val);
      if (!Object.keys(node.capabilities).length) delete node.capabilities;
    });
    const arr = (v) => Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
    const card = el('div', { class: 'card', style: { marginBottom: '12px' } });
    card.appendChild(el('div', { class: 'card-head' }, el('h3', { text: 'القدرات (capabilities)' })));
    const body = el('div', { class: 'card-body' });
    body.appendChild(F.grid(CAPABILITY_FLAGS.map(f => F.field({
      label: f.label, type: 'bool', value: cap[f.key] === true, onChange: v => put(f.key, v === true ? undefined : true)
    })), 'c4'));
    body.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'أنواع الوسائط المدخلة' }),
      F.chips({ items: arr(cap.input_modalities), placeholder: 'image', onChange: v => put('input_modalities', v) })
    ]));
    body.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'أنواع الوسائط المخرجة' }),
      F.chips({ items: arr(cap.output_modalities), placeholder: 'text', onChange: v => put('output_modalities', v) })
    ]));
    const knownKeys = new Set(CAPABILITY_FLAGS.map(f => f.key).concat(['input_modalities', 'output_modalities']));
    const rest = {};
    Object.keys(cap).forEach(k => { if (!knownKeys.has(k)) rest[k] = cap[k]; });
    if (Object.keys(rest).length) {
      body.appendChild(el('div', { class: 'field' }, [
        el('label', { text: 'قدرات أخرى' }),
        F.typedKV({ value: rest, addLabel: 'قدرة', onChange: v => ST.edit(x => {
          const node = u.ensure(x, ['providers', pid, 'models', mid]);
          const merged = {};
          Object.keys(cap).forEach(k => { if (knownKeys.has(k)) merged[k] = cap[k]; });
          Object.assign(merged, v || {});
          if (Object.keys(merged).length) node.capabilities = merged; else delete node.capabilities;
        }) })
      ]));
    }
    card.appendChild(body);
    return card;
  }
  function newServer() {
    const name = u.el('input', { type: 'text', class: 'mono', placeholder: 'context7', dir: 'ltr' });
    const type = u.el('select', {}, [el('option', { value: 'remote', text: 'remote (Streamable HTTP)' }), el('option', { value: 'local', text: 'local (stdio)' })]);
    u.modal({
      title: 'خادم MCP جديد',
      body: el('div', { class: 'grid' }, [
        el('div', { class: 'field' }, [el('label', { text: 'الاسم (معرّف الخادم)' }), name]),
        el('div', { class: 'field' }, [el('label', { text: 'النوع' }), type])
      ]),
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'إنشاء', kind: 'primary', close: false, onClick: () => {
            const n = name.value.trim();
            if (!n) { u.toast('err', 'أدخل اسماً'); return false; }
            ST.edit(x => {
              const node = u.ensure(x, ['mcp', 'servers', n]);
              u.setOrDelete(node, 'type', type.value);
              if (type.value === 'remote') node.url = '';
              else node.command = [];
            });
            u.closeModal(); NS.main.render();
          }
        }
      ]
    });
  }
/* ===============================================================
     PROVIDERS — catalogue browser + your own provider definitions
     =============================================================== */
  function viewProviders(root) {
    const d = S.data;
    const C = NS.Catalog;
    root.appendChild(F.pageHead({
      icon: '🧠', title: 'المزوّدون والنماذج', doc: 'providers',
      count: (C ? C.status().providers : 0),
      desc: 'قاعدة بيانات النماذج نفسها التي يستخدمها OpenCode (<code>models.dev</code>). تُحمَّل تلقائياً عند توفّر الإنترنت وتُحفظ محلياً، ومعها نسخة مدمجة تعمل بلا اتصال.',
      actions: [
        F.btn('تحديث الكتالوج', { icon: '⟳', onClick: async (e) => {
          const btn = e.currentTarget;
          btn.classList.add('saving');
          await C.refresh();
          btn.classList.remove('saving');
          NS.main.render();
        } })
      ]
    }));
    if (!C) { root.appendChild(el('div', { class: 'err-box' }, 'تعذّر تحميل وحدة الكتالوج.')); return; }
    const st = C.status();
    /* ---------- catalogue status ---------- */
    const c0 = F.card({
      title: 'حالة الكتالوج',
      desc: 'المصدر: ' + (st.source === 'live' ? 'models.dev مباشرة' : 'نسخة مدمجة داخل الأداة')
    });
    c0.body.appendChild(F.grid([
      F.field({ label: 'المزوّدات', value: st.providers, hint: 'مزوّد معروف' }),
      F.field({ label: 'النماذج', value: st.models, hint: 'نموذج مدرج' }),
      F.field({
        label: 'آخر تحديث', value: st.fetchedAt ? new Date(st.fetchedAt).toLocaleString('ar') : '—',
        hint: st.refreshing ? 'جارٍ التحديث…' : 'يتجدد تلقائياً كل 3 أيام'
      }),
      F.field({
        label: 'المصدر', value: st.source === 'live' ? 'محدَّث' : 'مدمج (بلا إنترنت)',
        hint: st.lastError ? 'آخر خطأ: ' + st.lastError : 'لا أخطاء'
      })
    ], 'c4'));
    root.appendChild(c0.root);
    /* ---------- the default model, as a picker ---------- */
    const c1 = F.card({ title: 'النموذج الافتراضي', desc: 'النموذج المستخدم عند فتح أي جلسة لا يحدد نموذجاً' });
    c1.body.appendChild(F.field({
      label: 'model', type: 'modelpicker', value: typeof d.model === 'string' ? d.model : '',
      onChange: v => ST.edit(x => u.setOrDelete(x, 'model', v))
    }));
    c1.body.appendChild(F.hint('النموذج على المستوى الأعلى لا يحتفظ بـ <code>#variant</code> — استخدم قسم الوكلاء أو الأوامر إن أردت variant.'));
    root.appendChild(c1.root);
    /* ---------- catalogue browser ---------- */
    const c2 = F.card({
      title: 'تصفّح الكتالوج',
      desc: 'ابحث عن مزوّد أو نموذج. اضغط أي نموذج لنسخ مرجعه.'
    });
    const bar = el('div', { class: 'pv-search' });
    const q = el('input', { type: 'text', placeholder: 'ابحث: anthropic، claude، gpt، o3…', dir: 'ltr' });
    const filters = { tools: false, reasoning: false, vision: false, context: false };
    const fWrap = el('div', { class: 'pv-filters' });
    [
      { k: 'tools', label: 'يدعم الأدوات' },
      { k: 'reasoning', label: 'استدلال' },
      { k: 'vision', label: 'صور' },
      { k: 'context', label: 'سياق ≥ 200k' }
    ].forEach(f => {
      const b = el('button', { class: 'pv-filter', onclick: () => { filters[f.k] = !filters[f.k]; b.classList.toggle('on', filters[f.k]); render(); } }, f.label);
      fWrap.appendChild(b);
    });
    bar.appendChild(q);
    bar.appendChild(fWrap);
    c2.body.appendChild(bar);
    const results = el('div', {});
    c2.body.appendChild(results);
    root.appendChild(c2.root);
    function render() {
      u.clear(results);
      const configured = u.isObj(d.providers) ? d.providers : {};
      const found = C.search(q.value, {
        providers: C.withCustom(configured), tools: filters.tools,
        reasoning: filters.reasoning, vision: filters.vision, context: filters.context
      });
      if (!found.length) {
        results.appendChild(el('div', { class: 'empty', text: q.value ? 'لا نتائج لـ «' + q.value + '»' : 'الكتالوج فارغ' }));
        return;
      }
      const totalModels = found.reduce((n, p) => n + p.models.length, 0);
      results.appendChild(el('div', { class: 'small dim', style: { marginBottom: '10px' },
        text: found.length + ' مزوّد · ' + totalModels + ' نموذج مطابق' }));
      const grid = el('div', { class: 'pv-grid' });
      found.slice(0, 60).forEach(p => {
        const isConfigured = !!configured[p.id];
        const card = el('div', { class: 'pv-card' + (isConfigured ? ' in-config' : '') }, [
          el('div', { class: 'pv-head' }, [
            el('div', { class: 'pv-name' }, [
              el('span', { text: p.name }),
              el('span', { class: 'pv-id', text: p.id }),
              p.local ? el('span', { class: 'pill purple', text: 'محلي' }) : null,
              p.custom ? el('span', { class: 'pill green', text: 'في ملفك' }) : null
            ]),
            el('div', { class: 'pv-meta' }, [
              el('span', { text: p.models.length + ' معروض' }),
              (p.total && p.total > p.models.length) ? el('span', { text: 'من ' + p.total }) : null,
              (p.env || []).length ? el('span', { text: p.env.join(', ') }) : null
            ])
          ])
        ]);
        const body = el('div', { class: 'pv-body' });
        if (!p.models.length) {
          body.appendChild(el('div', { class: 'small muted', text: p.hint || 'لا نماذج معروفة — اكتبها يدوياً في المزوّد المعرّف أدناه.' }));
        }
        p.models.slice(0, 60).forEach(m => {
          const tags = el('span', { class: 'pv-tags' }, [
            m.toolCall ? el('span', { class: 'pv-tag on', text: 'أدوات' }) : null,
            m.reasoning ? el('span', { class: 'pv-tag on', text: 'استدلال' }) : null,
            (m.input || []).includes('image') ? el('span', { class: 'pv-tag on', text: 'صور' }) : null
          ]);
          body.appendChild(el('button', {
            class: 'pv-model',
            title: 'اضغط لنسخ ' + p.id + '/' + m.id,
            onclick: async () => {
              const ref = p.id + '/' + m.id;
              try {
                await navigator.clipboard.writeText(ref);
                NS.fx.swapLabel(el('span', { class: 'pill' }), '');
                NS.fx.toast('ok', 'نُسخ ' + ref, 2000);
              } catch (err) {
                NS.fx.toast('info', ref, 4000);
              }
            }
          }, [
            el('span', { class: 'mid', text: m.id }),
            tags,
            el('span', { class: 'mctx', text: C.fmtTokens(m.context) })
          ]));
        });
        if (p.models.length > 60) {
          body.appendChild(el('div', { class: 'small muted', style: { paddingTop: '8px' },
            text: 'و' + (p.models.length - 60) + ' نموذجاً أخرى — استخدم البحث لتضييق.' }));
        }
        card.appendChild(body);
        grid.appendChild(card);
      });
      results.appendChild(grid);
      if (found.length > 60) {
        results.appendChild(el('div', { class: 'small muted', style: { marginTop: '10px' },
          text: 'يُعرض أول 60 مزوّداً — ضيّق البحث لرؤية المزيد.' }));
      }
    }
    q.addEventListener('input', u.debounce(render, 260));
    render();
    /* ---------- your own provider definitions ---------- */
    const provs = u.isObj(d.providers) ? d.providers : {};
    const ids = Object.keys(provs);
    const c3 = F.card({
      title: 'مزوّدون معرّفون في ملفك',
      desc: 'مزوّد خارج الكتالوج، أو تجاوز لإعدادات مزوّد موجود، أو نموذج مضاف باسم مستعار.',
      actions: [F.btn('مزوّد جديد', { size: 'sm', icon: '+', onClick: () => newProvider() })]
    });
    if (!ids.length) c3.body.appendChild(el('div', { class: 'empty', text: 'لا توجد تعريفات — الكتالوج أعلاه يكفي للاستخدام اليومي.' }));
    const wrap = el('div', { class: 'items' });
    ids.forEach(pid => wrap.appendChild(providerCard(pid, provs[pid])));
    c3.body.appendChild(wrap);
    root.appendChild(c3.root);
    /* ---------- examples ---------- */
    const c4 = F.card({ title: 'أمثلة جاهزة', desc: 'انسخ ما يناسبك' });
    c4.body.appendChild(el('pre', { class: 'snippet', html: u.esc(JSON.stringify({
      model: 'company/coder',
      providers: {
        company: {
          env: ['COMPANY_GATEWAY_KEY'],
          package: '@opencode/ai/providers/openai-compatible',
          settings: { baseURL: 'https://gateway.example.com/v1' },
          models: { coder: { modelID: 'upstream/coder-v2' } }
        }
      }
    }, null, 2)) }));
    root.appendChild(c4.root);
  }
  function providerCard(pid, p) {
    const models = u.isObj(p.models) ? p.models : [];
    const it = F.item({
      title: pid, open: false,
      badges: [
        p.name ? el('span', { class: 'pill', text: p.name }) : null,
        p.package ? el('span', { class: 'pill mono', text: p.package }) : el('span', { class: 'pill blue', text: 'حزمة مدمجة' }),
        Array.isArray(p.env) && p.env.length ? el('span', { class: 'pill green', text: p.env.join(', ') }) : null,
        el('span', { class: 'pill mono', text: Object.keys(models).length + ' نموذج' })
      ].filter(Boolean),
      headActions: [F.btn('✕', {
        size: 'sm', kind: 'danger', onClick: async e => {
          e.stopPropagation();
          if (await u.confirmBox('حذف المزوّد', 'سيُحذف «' + pid + '» مع كل نماذجه من هذا الملف.', 'حذف')) {
            ST.edit(x => { if (x.providers) delete x.providers[pid]; if (x.providers && !Object.keys(x.providers).length) delete x.providers; });
            NS.main.render();
          }
        }
      })]
    });
    const b = it.body;
    b.appendChild(F.grid([
      F.field({ label: 'name', value: p.name, desc: 'اسم العرض', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'name'], v)) }),
      F.field({
        label: 'package', type: 'select', value: p.package || '', emptyValue: undefined,
        options: [{ id: '', label: '— الحزمة المدمجة —' }].concat(C.PROVIDER_PACKAGES.map(x => ({ id: x, label: x }))),
        desc: 'اختر حزمة متوافق، أو اكتب مساراً محلياً في الحقل أدناه.',
        onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'package'], v))
      }),
      F.field({ label: 'package (مخصص)', value: p.package && !C.PROVIDER_PACKAGES.includes(p.package) ? p.package : '', dir: 'ltr', placeholder: '@acme/opencode-provider أو file:///...', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'package'], v)) }),
      F.field({ label: 'canonical', value: p.canonical, placeholder: 'openai', desc: 'معرّف مزوّد مدمج ترث منه افتراضيات الكتالوج', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'canonical'], v)) })
    ], 'c2'));
    b.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'env — متغيرات الاعتماد بالترتيب' }),
      F.listEditor({
        items: Array.isArray(p.env) ? p.env : [], addLabel: 'إضافة متغير', placeholder: 'ACME_API_KEY',
        onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'env'], v))
      })
    ]));
    b.appendChild(el('div', { class: 'card', style: { marginBottom: '12px' } }, [
      el('div', { class: 'card-head' }, el('h3', { text: 'إعدادات الاتصال (settings)' })),
      el('div', { class: 'card-body' }, providerSettingsForm(pid, p))
    ]));
    b.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'headers' }),
      F.kvEditor({ value: p.headers || {}, addLabel: 'رأس', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'headers'], v)) })
    ]));
    b.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'body — حقول تُدمج في جسم كل طلب' }),
      F.typedKV({ value: p.body || {}, addLabel: 'حقل', keyPlaceholder: 'metadata', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'body'], v)) })
    ]));
    /* models */
    b.appendChild(el('div', { class: 'divider' }));
    b.appendChild(el('div', { class: 'flex' }, [
      el('h4', { class: 'small', text: 'النماذج' }),
      el('div', { class: 'spacer' }),
      F.btn('نموذج جديد', {
        size: 'sm', icon: '+', onClick: () => {
          u.promptBox('نموذج جديد', 'معرّف النموذج (مفتاح الخريطة)', 'my-model').then(mid => {
            if (!mid) return;
            ST.edit(x => u.set(x, ['providers', pid, 'models', mid.trim()], {}));
            NS.main.render();
          });
        }
      })
    ]));
    const mnames = Object.keys(models);
    if (!mnames.length) b.appendChild(el('div', { class: 'empty', style: { marginTop: '10px' }, text: 'لا توجد نماذج مخصّصة لهذا المزوّد.' }));
    mnames.forEach(mid => {
      const m = models[mid] || {};
      const mit = F.item({
        title: mid,
        badges: [
          m.modelID ? el('span', { class: 'pill mono', text: '→ ' + m.modelID }) : null,
          m.disabled ? el('span', { class: 'pill red', text: 'معطّل' }) : null,
          Array.isArray(m.variants) && m.variants.length ? el('span', { class: 'pill purple', text: m.variants.length + ' variant' }) : null
        ].filter(Boolean),
        subtitle: m.name || '',
        headActions: [F.btn('✕', {
          size: 'sm', kind: 'danger', onClick: () => {
            ST.edit(x => { if (x.providers[pid].models) delete x.providers[pid].models[mid]; });
            NS.main.render();
          }
        })],
        open: false
      });
      const mb = mit.body;
      mb.appendChild(F.grid([
        F.field({ label: 'name', value: m.name, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'name'], v)) }),
        F.field({
          label: 'modelID', type: 'modelpicker', value: (u.isObj(m.modelID) ? '' : (m.modelID || '')),
          desc: 'معرّف النموذج عند المزوّد — يُختار من الكتالوج أو يُكتب كما هو',
          onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'modelID'], v))
        }),
        F.field({ label: 'family', value: m.family, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'family'], v)) }),
        F.field({ label: 'package', value: m.package, dir: 'ltr', desc: 'تجاوز الحزمة لهذا النموذج', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'package'], v)) }),
        F.field({ label: 'disabled', type: 'bool', value: m.disabled === true, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'disabled'], true, v)) })
      ], 'c3'));
      mb.appendChild(el('div', { class: 'card', style: { marginBottom: '12px' } }, [
        el('div', { class: 'card-head' }, el('h3', { text: 'حدود النموذج (limit) — بالأرقام' })),
        el('div', { class: 'card-body' }, F.grid(LIMIT_FIELDS.map(f =>
          F.field({
            label: f.label, type: 'number', min: 0, value: u.get(m.limit || {}, f.key),
            onChange: v => ST.edit(x => {
              const node = u.ensure(x, ['providers', pid, 'models', mid]);
              if (!u.isObj(node.limit)) node.limit = {};
              u.setOrDelete(node.limit, f.key, v);
              if (!Object.keys(node.limit).length) delete node.limit;
            })
          })), 'c3'))
      ]));
      mb.appendChild(el('div', { class: 'card', style: { marginBottom: '12px' } }, [
        el('div', { class: 'card-head' }, el('h3', { text: 'التسعير (cost) — لكل مليون توكن' })),
        el('div', { class: 'card-body' }, F.grid(COST_FIELDS.map(f =>
          F.field({
            label: f.label, type: 'number', min: 0, step: 'any', value: u.get(m.cost || {}, f.key),
            onChange: v => ST.edit(x => {
              const node = u.ensure(x, ['providers', pid, 'models', mid]);
              if (!u.isObj(node.cost)) node.cost = {};
              u.setOrDelete(node.cost, f.key, v);
              if (!Object.keys(node.cost).length) delete node.cost;
            })
          })), 'c3'))
      ]));
      mb.appendChild(modelCapabilitiesForm(pid, mid, m));
      mb.appendChild(el('div', { class: 'field' }, [
        el('label', { text: 'settings — يتجاوز إعدادات المزوّد لهذا النموذج' }),
        F.typedKV({ value: m.settings || {}, addLabel: 'إعداد', keyPlaceholder: 'compaction.type', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'settings'], v)) })
      ]));
      mb.appendChild(el('div', { class: 'field' }, [
        el('label', { text: 'compatibility' }),
        F.typedKV({ value: m.compatibility || {}, addLabel: 'قاعدة توافق', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'compatibility'], v)) })
      ]));
      mb.appendChild(el('div', { class: 'field' }, [el('label', { text: 'headers' }), F.kvEditor({ value: m.headers || {}, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'headers'], v)) })]));
      mb.appendChild(el('div', { class: 'field' }, [
        el('label', { text: 'body' }),
        F.typedKV({ value: m.body || {}, addLabel: 'حقل', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'body'], v)) })
      ]));
      /* variants */
      const vars = Array.isArray(m.variants) ? m.variants : [];
      const vbox = el('div', {});
      const renderVars = () => {
        u.clear(vbox);
        if (!vars.length) { vbox.appendChild(el('div', { class: 'empty', style: { marginTop: '8px' }, text: 'لا توجد variants' })); return; }
        vars.forEach((vv, vi) => {
          vbox.appendChild(el('div', { class: 'card', style: { marginBottom: '10px' } }, [
            el('div', { class: 'card-head' }, [
              el('h3', { text: 'variant: ' + (vv.id || '?') }),
              el('div', { class: 'spacer' }),
              F.btn('↑', { size: 'sm', onClick: () => { if (vi > 0) { vars.splice(vi - 1, 0, vars.splice(vi, 1)[0]); ST.edit(x => x.providers[pid].models[mid].variants = u.clone(vars)); renderVars(); } } }),
              F.btn('↓', { size: 'sm', onClick: () => { if (vi < vars.length - 1) { vars.splice(vi + 1, 0, vars.splice(vi, 1)[0]); ST.edit(x => x.providers[pid].models[mid].variants = u.clone(vars)); renderVars(); } } }),
              F.btn('✕', { size: 'sm', kind: 'danger', onClick: () => { vars.splice(vi, 1); ST.edit(x => x.providers[pid].models[mid].variants = u.clone(vars)); renderVars(); } })
            ]),
            el('div', { class: 'card-body' }, [
              F.grid([
                F.field({ label: 'id', value: vv.id, onChange: v => ST.edit(x => x.providers[pid].models[mid].variants[vi].id = v) }),
                F.field({ label: 'name', value: vv.name, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'variants', vi, 'name'], v)) })
              ], 'c2'),
              el('div', { class: 'field' }, [el('label', { text: 'headers' }), F.kvEditor({ value: vv.headers || {}, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'variants', vi, 'headers'], v)) })]),
              el('div', { class: 'field' }, [
                el('label', { text: 'settings' }),
                F.typedKV({ value: vv.settings || {}, addLabel: 'إعداد', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'variants', vi, 'settings'], v)) })
              ]),
              el('div', { class: 'field' }, [
                el('label', { text: 'body' }),
                F.typedKV({ value: vv.body || {}, addLabel: 'حقل', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'variants', vi, 'body'], v)) })
              ])
            ])
          ]));
        });
      };
      renderVars();
      mb.appendChild(el('div', { class: 'field' }, [
        el('label', { text: 'variants' }), vbox,
        el('div', { class: 'flex', style: { marginTop: '8px' } }, [
          F.btn('إضافة variant', {
            size: 'sm', icon: '+', onClick: () => {
              vars.push({ id: '' });
              ST.edit(x => {
                if (!u.isObj(x.providers[pid].models[mid].variants)) x.providers[pid].models[mid].variants = [];
                x.providers[pid].models[mid].variants.push({ id: '' });
              });
              renderVars();
            }
          })
        ])
      ]));
      b.appendChild(mit);
    });
    return it;
  }
  function newProvider() {
    const id = u.el('input', { type: 'text', class: 'mono', placeholder: 'acme', dir: 'ltr' });
    const pkg = u.el('select', {}, [
      el('option', { value: '@opencode/ai/providers/openai-compatible', text: 'openai-compatible' }),
      el('option', { value: '@opencode/ai/providers/anthropic', text: 'anthropic' }),
      el('option', { value: '', text: '— احذف لاستخدام المدمج —' })
    ]);
    const b64 = u.el('input', { type: 'text', dir: 'ltr', placeholder: 'https://llm.acme.example/v1' });
    u.modal({
      title: 'مزوّد جديد',
      body: el('div', { class: 'grid' }, [
        el('div', { class: 'field' }, [el('label', { text: 'معرّف المزوّد' }), id]),
        el('div', { class: 'field' }, [el('label', { text: 'package' }), pkg]),
        el('div', { class: 'field' }, [el('label', { text: 'settings.baseURL' }), b64])
      ]),
      buttons: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'إنشاء', kind: 'primary', close: false, onClick: () => {
            const n = id.value.trim();
            if (!n) { u.toast('err', 'أدخل معرّفاً'); return false; }
            ST.edit(x => {
              const node = u.ensure(x, ['providers', n]);
              if (!u.isObj(node.models)) node.models = {};
              u.setOrDelete(node, 'package', pkg.value);
              if (b64.value.trim()) u.set(node, 'settings', { baseURL: b64.value.trim() });
            });
            u.closeModal(); NS.main.render();
            u.toast('ok', 'أُنشئ المزوّد ' + n);
          }
        }
      ]
    });
  }
  NS.views = NS.views || {};
  Object.assign(NS.views, { mcp: viewMcp, providers: viewProviders });
})(window.OCM);
