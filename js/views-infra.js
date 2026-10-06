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
            if (!n) { u.toast('أدخل اسماً', 'err'); return false; }
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
     PROVIDERS
     =============================================================== */
  function viewProviders(root) {
    const d = S.data;
    const provs = u.isObj(d.providers) ? d.providers : {};
    const ids = Object.keys(provs);
    root.appendChild(F.pageHead({
      icon: '🧠', title: 'المزوّدون والنماذج', doc: 'providers', count: ids.length,
      desc: 'أضف مزوّداً خارج الكتالوج، أو تجاوز إعدادات مزوّد موجود، أو أضف نماذج وتجاوز إعداداتها. مفتاح <code>providers</code> هو معرّف المزوّد المستخدم في <code>معرّف/نموذج</code>.',
      actions: [F.btn('مزوّد جديد', { kind: 'primary', icon: '+', onClick: () => newProvider() })]
    }));

    const c0 = F.card({ title: 'النموذج الافتراضي', doc: 'models' });
    c0.body.appendChild(F.grid([
      F.field({
        label: 'model', type: 'model', value: typeof d.model === 'string' ? d.model : '',
        desc: 'الصيغة <code>provider/model</code> أو مرجع إلى معرّف أضيف في <code>providers</code>.',
        onChange: v => ST.edit(x => u.setOrDelete(x, 'model', v))
      })
    ], 'c2'));
    c0.body.appendChild(F.hint('النموذج على المستوى الأعلى لا يحتفظ بـ <code>#variant</code>؛ مراجع الوكيل والأوامر تستطيع فعل ذلك.'));
    root.appendChild(c0.root);

    if (!ids.length) {
      root.appendChild(el('div', { class: 'empty', text: 'لا توجد تعريفات providers في هذا الملف. المزوّدون المدمجون يعتمدون على بيانات الاعتماد عبر /connect دون أي تعريف هنا.' }));
    }

    const wrap = el('div', { class: 'items' });
    ids.forEach(pid => {
      const p = provs[pid] || {};
      const models = u.isObj(p.models) ? p.models : {};
      const it = F.item({
        title: pid, open: false,
        badges: [
          p.name ? el('span', { class: 'pill', text: p.name }) : null,
          p.package ? el('span', { class: 'pill mono', text: p.package }) : el('span', { class: 'pill blue', text: 'حزمة مدمجة' }),
          Array.isArray(p.env) && p.env.length ? el('span', { class: 'pill green', text: p.env.join(', ') }) : null,
          el('span', { class: 'pill mono', text: Object.keys(models).length + ' نموذج' })
        ].filter(Boolean),
        headActions: [
          F.btn('✕', { size: 'sm', kind: 'danger', onClick: async e => {
            e.stopPropagation();
            if (await u.confirmBox('حذف المزوّد', 'سيُحذف «' + pid + '» مع كل نماذجه من هذا الملف.', 'حذف')) {
              ST.edit(x => { if (x.providers) delete x.providers[pid]; if (x.providers && !Object.keys(x.providers).length) delete x.providers; });
              NS.main.render();
            }
          } })
        ]
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
        F.field({ label: 'canonical', value: p.canonical, placeholder: 'openai', desc: 'معرّف مزوّد مدمج ترث منه هذا المزوّد افتراضيات الكتالوج', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'canonical'], v)) })
      ], 'c2'));

      b.appendChild(el('div', { class: 'field' }, [
        el('label', { text: 'env — متغيرات الاعتماد بالترتيب' }),
        F.listEditor({
          items: Array.isArray(p.env) ? p.env : [], addLabel: 'إضافة متغير', placeholder: 'ACME_API_KEY',
          onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'env'], v))
        })
      ]));

      b.appendChild(F.field({
        label: 'settings', type: 'json', rows: 6, value: p.settings,
        hint: 'خاصة بالحزمة. أمثلة: <code>baseURL</code> · <code>apiKey</code> · <code>headerTimeout</code>/<code>chunkTimeout</code> (رقم أو false) · <code>timeout</code> · <code>transport: "websocket"</code> · <code>compaction.type</code> · Azure <code>resourceName</code> · Bedrock <code>profile</code>+<code>region</code> · Vertex <code>project</code>+<code>location</code>.',
        onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'settings'], v))
      }));

      b.appendChild(el('div', { class: 'field' }, [
        el('label', { text: 'headers' }),
        F.kvEditor({ value: p.headers || {}, addLabel: 'رأس', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'headers'], v)) })
      ]));
      b.appendChild(F.field({ label: 'body', type: 'json', rows: 4, value: p.body, desc: 'حقول JSON تُدمج في جسم كل طلب', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'body'], v)) }));

      // models
      b.appendChild(el('div', { class: 'divider' }));
      b.appendChild(el('div', { class: 'flex' }, [
        el('h4', { class: 'small', text: 'النماذج' }),
        el('div', { class: 'spacer' }),
        F.btn('نموذج جديد', { size: 'sm', icon: '+', onClick: () => {
          u.promptBox('نموذج جديد', 'معرّف النموذج (مفتاح الخريطة)', 'my-model').then(mid => {
            if (!mid) return;
            ST.edit(x => u.set(x, ['providers', pid, 'models', mid.trim()], {}));
            NS.main.render();
          });
        } })
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
          headActions: [F.btn('✕', { size: 'sm', kind: 'danger', onClick: () => { ST.edit(x => { if (x.providers[pid].models) delete x.providers[pid].models[mid]; }); NS.main.render(); } })],
          open: false
        });
        const mb = mit.body;
        mb.appendChild(F.grid([
          F.field({ label: 'name', value: m.name, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'name'], v)) }),
          F.field({ label: 'modelID', value: m.modelID, desc: 'المعرّف المرسل للمزوّد (مثلاً deployment في Azure)', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'modelID'], v)) }),
          F.field({ label: 'family', value: m.family, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'family'], v)) }),
          F.field({ label: 'package', value: m.package, dir: 'ltr', desc: 'تجاوز الحزمة لهذا النموذج', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'package'], v)) }),
          F.field({ label: 'disabled', type: 'bool', value: m.disabled === true, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'disabled'], true, v)) })
        ], 'c3'));
        mb.appendChild(F.field({ label: 'limit', type: 'json', rows: 3, value: m.limit, hint: '{ "context": 200000, "output": 32000 }', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'limit'], v)) }));
        mb.appendChild(F.field({ label: 'cost', type: 'json', rows: 3, value: m.cost, hint: 'تسعير لكل مليون توكن: { "input": ..., "output": ..., "cache_read": ..., "cache_write": ... }', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'cost'], v)) }));
        mb.appendChild(F.field({ label: 'capabilities', type: 'json', rows: 4, value: m.capabilities, hint: 'دعم الأدوات وأنواع الوسائط المدخلة/المخرجة', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'capabilities'], v)) }));
        mb.appendChild(F.field({ label: 'compatibility', type: 'json', rows: 3, value: m.compatibility, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'compatibility'], v)) }));
        mb.appendChild(F.field({ label: 'settings', type: 'json', rows: 4, value: m.settings, hint: 'يتجاوز settings المزوّد لهذا النموذج', onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'settings'], v)) }));
        mb.appendChild(el('div', { class: 'field' }, [el('label', { text: 'headers' }), F.kvEditor({ value: m.headers || {}, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'headers'], v)) })]));
        mb.appendChild(F.field({ label: 'body', type: 'json', rows: 3, value: m.body, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'body'], v)) }));

        // variants
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
                F.field({ label: 'settings', type: 'json', rows: 3, value: vv.settings, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'variants', vi, 'settings'], v)) }),
                el('div', { class: 'field' }, [el('label', { text: 'headers' }), F.kvEditor({ value: vv.headers || {}, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'variants', vi, 'headers'], v)) })]),
                F.field({ label: 'body', type: 'json', rows: 3, value: vv.body, onChange: v => ST.edit(x => u.setOrDelete(x, ['providers', pid, 'models', mid, 'variants', vi, 'body'], v)) })
              ])
            ]));
          });
        };
        renderVars();
        mb.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'variants' }), vbox,
          el('div', { class: 'flex', style: { marginTop: '8px' } }, [
            F.btn('إضافة variant', { size: 'sm', icon: '+', onClick: () => { vars.push({ id: '' }); ST.edit(x => { if (!u.isObj(x.providers[pid].models[mid].variants)) x.providers[pid].models[mid].variants = []; x.providers[pid].models[mid].variants.push({ id: '' }); }); renderVars(); } })
          ])
        ]));
        b.appendChild(mit);
      });
      wrap.appendChild(it);
    });
    root.appendChild(wrap);

    const c1 = F.card({ title: 'مثال كامل', desc: 'مزوّد متوافق مع OpenAI عبر بوابة' });
    c1.body.appendChild(el('pre', { class: 'snippet', html: u.esc(JSON.stringify({
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
    root.appendChild(c1.root);
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
            if (!n) { u.toast('أدخل معرّفاً', 'err'); return false; }
            ST.edit(x => {
              const node = u.ensure(x, ['providers', n]);
              if (!u.isObj(node.models)) node.models = {};
              u.setOrDelete(node, 'package', pkg.value);
              if (b64.value.trim()) u.set(node, 'settings', { baseURL: b64.value.trim() });
            });
            u.closeModal(); NS.main.render();
          }
        }
      ]
    });
  }

  /* ===============================================================
     RAW JSON
     =============================================================== */
  function viewRaw(root) {
    root.appendChild(F.pageHead({
      icon: '📄', title: 'محرر JSON الخام',
      desc: 'تحرير مباشر لكامل الملف مع الحفاظ على التعليقات. استخدمه لأي حقل غير معروض في الأقسام الأخرى.'
    }));

    const pathLabel = ST.S.origin && ST.S.origin.fileName ? ST.S.origin.fileName : (ST.S.target === 'cli' ? 'cli.json' : 'opencode.json');

    const ta = el('textarea', { class: 'json-editor', rows: 26, spellcheck: 'false', dir: 'ltr' });
    const status = el('div', { class: 'json-status' });
    const pathIn = el('input', { type: 'text', class: 'mono', dir: 'ltr', value: pathLabel });

    function load() {
      ta.value = ST.serialize();
      ta.className = 'json-editor ok';
      status.className = 'json-status ok';
      status.textContent = '✓ محمّل — ' + ta.value.split('\n').length + ' سطر';
    }
    function validate() {
      const p = NS.jsonc.parse(ta.value);
      if (p.error) {
        ta.className = 'json-editor bad';
        status.className = 'json-status bad';
        status.textContent = '✕ خطأ: ' + p.error.message + ' (سطر ' + p.error.line + '، عمود ' + p.error.column + ')';
        return false;
      }
      ta.className = 'json-editor ok';
      status.className = 'json-status ok';
      status.textContent = '✓ JSON صالح — ' + Object.keys(p.value || {}).length + ' مفتاحاً علوياً';
      return true;
    }
    ta.addEventListener('input', u.debounce(validate, 420));

    const preview = el('pre', { class: 'snippet' });
    function updatePreview() {
      const p = NS.jsonc.parse(ta.value);
      preview.textContent = p.error ? '— غير صالح —' : JSON.stringify(p.value, null, 2);
    }
    ta.addEventListener('input', u.debounce(updatePreview, 420));

    const c = F.card({ title: 'المحتوى', desc: 'التعديلات هنا لا تدخل الحالة حتى تضغط «تطبيق».' });
    c.body.appendChild(ta);
    c.body.appendChild(status);
    c.body.appendChild(el('div', { class: 'flex wrap', style: { marginTop: '12px' } }, [
      F.btn('تطبيق على الحالة', {
        kind: 'primary', icon: '✓', onClick: () => {
          if (!validate()) { u.toast('صحّح الخطأ أولاً', 'err'); return; }
          const p = NS.jsonc.parse(ta.value);
          ST.edit(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, p.value); });
          ta.value = ST.serialize();
          updatePreview();
          u.toast('طُبّق', 'ok');
          NS.main.render();
        }
      }),
      F.btn('إعادة تحميل من الحالة', { onClick: load }),
      F.btn('تنسيق تلقائي', { onClick: () => { const p = NS.jsonc.parse(ta.value); if (p.error) { u.toast('غير صالح', 'err'); return; } ta.value = NS.jsonc.stringify(p.value, p.comments, { indent: 2 }); validate(); updatePreview(); } }),
      F.btn('نسخ', {
        onClick: async () => { try { await navigator.clipboard.writeText(ta.value); u.toast('نُسخ', 'ok'); } catch (e) { u.toast('Clipboard غير متاح', 'err'); } }
      })
    ]));
    root.appendChild(c.root);

    const c2 = F.card({ title: 'معاينة JSON المُحلَّل', desc: 'النتيجة بعد إزالة التعليقات' });
    c2.body.appendChild(preview);
    root.appendChild(c2.root);

    const c3 = F.card({ title: 'النسخ الاحتياطية', desc: 'يحفظ التطبيق نسخة <code>.backup</code> بجانب الملف قبل كل كتابة' });
    const bb = el('div', {});
    c3.body.appendChild(bb);
    root.appendChild(c3.root);
    (async () => {
      u.clear(bb);
      const buf = ST.readBuffer(ST.S.target);
      if (ST.S.backups.length) {
        ST.S.backups.forEach(bk => bb.appendChild(el('div', { class: 'list-row' }, [
          el('span', { class: 'pill mono', text: bk.name }),
          el('span', { class: 'small dim', text: u.timeAgo(bk.at) + ' · ' + u.bytes(bk.text.length) }),
          el('div', { class: 'spacer' }),
          F.btn('استعادة', { size: 'sm', onClick: () => { ST.edit(() => true); ST.loadText(bk.text, ST.S.origin); u.toast('استُعيدت النسخة', 'ok'); NS.main.render(); } })
        ])));
      } else bb.appendChild(el('div', { class: 'empty', text: 'لا توجد نسخ في الذاكرة بعد.' }));

      if (NS.fs.API.handle) {
        const cur = pathIn.value;
        const bpath = cur + '.backup';
        const existing = await NS.fs.read(bpath);
        if (existing != null) {
          bb.appendChild(el('div', { class: 'list-row', style: { marginTop: '8px' } }, [
            el('span', { class: 'pill mono green', text: bpath }),
            el('span', { class: 'small dim', text: u.bytes(existing.length) + ' على القرص' }),
            el('div', { class: 'spacer' }),
            F.btn('فتح', { size: 'sm', onClick: () => { ta.value = existing; validate(); updatePreview(); u.toast('حُمّلت النسخة', 'ok'); } })
          ]));
        }
      }
    })();

    load(); updatePreview();

    const c4 = F.card({ title: 'مسار الحفظ', desc: 'أين يُكتب الملف فعلياً' });
    c4.body.appendChild(F.field({ label: 'اسم الملف داخل المجلد', value: pathIn.value, dir: 'ltr', onChange: v => { pathIn.value = v; } }));
    c4.body.appendChild(el('div', { class: 'flex', style: { marginTop: '10px' } }, [
      F.btn('حفظ إلى هذا المسار', { kind: 'primary', onClick: async () => {
        const ok = await saveTo(pathIn.value.trim());
        if (ok) { ST.markSaved(); }
      } }),
      F.btn('حفظ كملف جديد', { onClick: async () => { const n = await u.promptBox('حفظ كملف جديد', 'اسم الملف', pathIn.value); if (n) { const ok = await saveTo(n.trim()); if (ok) ST.markSaved(); } } })
    ]));
    root.appendChild(c4.root);
  }

  async function saveTo(path) {
    if (!NS.fs.API.handle) { u.toast('اربط مجلداً أولاً', 'warn'); return false; }
    const ok = await NS.fs.reauthorize();
    if (!ok) { u.toast('لم يُمنح إذن الكتابة', 'err'); return false; }
    try {
      await NS.fs.writeSafe(path, ST.serialize());
      ST.S.origin = Object.assign({}, ST.S.origin, { fileName: path, kind: 'fs', dirName: NS.fs.API.name });
      ST.updateScopeChip();
      u.toast('حُفظ إلى ' + path, 'ok');
      return true;
    } catch (e) {
      u.toast('فشل الحفظ: ' + e.message, 'err');
      return false;
    }
  }

  NS.views = NS.views || {};
  Object.assign(NS.views, { mcp: viewMcp, providers: viewProviders, raw: viewRaw });
  NS.views.saveTo = saveTo;
})(window.OCM);