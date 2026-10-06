/* ============================================================
   form.js — reusable form widgets + page scaffolding
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u;
  const { el, $ } = u;
  const C = NS.C;

  /* ---------------- page scaffolding ---------------- */
  function pageHead(opts) {
    const kids = [el('h2', {}, [
      el('span', { text: opts.icon || '' }),
      el('span', { text: opts.title }),
      opts.count != null ? el('span', { class: 'badge-count', text: String(opts.count) }) : null,
      opts.extra || null
    ])];
    const desc = el('p', { html: (opts.desc || '') + (opts.doc ? ' <a class="doc-link" target="_blank" rel="noopener" href="' + C.DOCS + opts.doc + '">التوثيق الرسمي ↗</a>' : '') });
    kids.push(desc);
    const head = el('div', { class: 'page-head' }, kids);
    if (opts.actions && opts.actions.length) head.appendChild(el('div', { class: 'flex wrap', style: { marginTop: '12px' } }, opts.actions));
    return head;
  }

  function card(opts) {
    const head = el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h3', { text: opts.title }),
        opts.desc ? el('p', { text: opts.desc }) : null
      ]),
      el('div', { class: 'spacer' })
    ].concat(opts.actions || []));
    const body = el('div', { class: 'card-body' + (opts.tight ? ' tight' : '') });
    return { root: el('div', { class: 'card' + (opts.cls ? ' ' + opts.cls : '') }, [head, body]), body };
  }

  function sectionNote(text, kind) {
    return el('div', { class: kind === 'warn' ? 'warn-box' : kind === 'err' ? 'err-box' : 'info-box', html: text });
  }

  function hint(html) { return el('p', { class: 'hint', html }); }

  /* ---------------- basic fields ---------------- */
  function field(opts) {
    const wrap = el('div', { class: 'field' + (opts.inline ? ' inline' : '') + (opts.cls ? ' ' + opts.cls : '') });
    const id = u.uid('f');
    const input = buildInput(opts, id);
    if (opts.inline) {
      const lab = el('label', { for: id }, [
        el('span', { text: opts.label }),
        opts.desc ? el('span', { class: 'desc', text: opts.desc }) : null
      ]);
      wrap.appendChild(lab); wrap.appendChild(input);
    } else {
      wrap.appendChild(el('label', { for: id, text: opts.label }));
      if (opts.desc) wrap.appendChild(el('span', { class: 'desc', text: opts.desc }));
      wrap.appendChild(input);
    }
    if (opts.hint) wrap.appendChild(hint(opts.hint));
    wrap.input = input;
    return wrap;
  }

  function buildInput(opts, id) {
    const emitVal = (v) => opts.onChange && opts.onChange(v);

    switch (opts.type) {
      case 'bool': {
        const inp = el('input', { type: 'checkbox', id });
        inp.checked = !!opts.value;
        inp.addEventListener('change', () => emitVal(inp.checked));
        const sw = el('label', { class: 'switch' }, [inp, el('span', { class: 'slider' })]);
        if (opts.onRender) opts.onRender(inp);
        return sw;
      }
      case 'textarea':
      case 'code': {
        const ta = el('textarea', { id, class: opts.type === 'code' ? 'code' : '', rows: opts.rows || 4, placeholder: opts.placeholder || '' });
        ta.value = opts.value == null ? '' : String(opts.value);
        if (opts.mono !== false && opts.type === 'textarea') ta.classList.add('mono');
        ta.addEventListener('input', u.debounce(() => emitVal(ta.value), opts.debounce == null ? 320 : opts.debounce));
        return ta;
      }
      case 'number': {
        const inp = el('input', { type: 'number', id, min: opts.min, max: opts.max, step: opts.step || 1 });
        inp.value = (opts.value == null || opts.value === '') ? '' : opts.value;
        inp.addEventListener('input', u.debounce(() => {
          if (inp.value === '') return emitVal(undefined);
          emitVal(Number(inp.value));
        }, opts.debounce == null ? 320 : opts.debounce));
        return inp;
      }
      case 'color': {
        const inp = el('input', { type: 'color', id });
        inp.value = opts.value || '#38bdf8';
        const text = el('input', { type: 'text', class: 'mono', style: { width: '110px', flex: '0 0 110px' } });
        text.value = opts.value || '';
        const sync = (v) => {
          if (/^#[0-9a-fA-F]{6}$/.test(v)) inp.value = v;
          text.value = v;
          emitVal(v || undefined);
        };
        inp.addEventListener('input', () => sync(inp.value));
        text.addEventListener('input', u.debounce(() => sync(text.value.trim()), 350));
        return el('div', { class: 'row-inline' }, [inp, text,
          el('button', { class: 'btn ghost sm', onclick: () => sync('') }, 'بدون')]);
      }
      case 'select': {
        const sel = el('select', { id });
        (opts.options || []).forEach(o => {
          const opt = typeof o === 'string' ? { id: o, label: o } : o;
          sel.appendChild(el('option', { value: opt.id, text: opt.label || opt.id }));
        });
        sel.value = opts.value == null ? '' : String(opts.value);
        sel.addEventListener('change', () => {
          const v = sel.value;
          emitVal(opts.emptyValue !== undefined && v === '' ? opts.emptyValue : v);
        });
        return sel;
      }
      case 'modelpicker': {
        return modelPicker(opts);
      }
      case 'agentpicker': {
        return agentPicker(opts);
      }
      case 'typedkv': {
        // A key/value editor with an explicit value type. Replaces raw JSON
        // for package-specific option bags.
        return typedKV(opts);
      }
      case 'chips': {
        return chips(opts);
      }
      case 'model': {
        const inp = el('input', { type: 'text', id, class: 'mono', placeholder: 'anthropic/claude-sonnet-4-5#high', dir: 'ltr' });
        inp.value = opts.value == null ? '' : String(opts.value);
        inp.addEventListener('input', u.debounce(() => emitVal(inp.value.trim() || undefined), 350));
        return inp;
      }
      case 'agent': {
        const sel = el('select', { id });
        sel.appendChild(el('option', { value: '', text: '— غير محدد —' }));
        NS.store.agentIds().forEach(a => sel.appendChild(el('option', { value: a, text: a })));
        sel.value = opts.value == null ? '' : String(opts.value);
        sel.addEventListener('change', () => emitVal(sel.value || undefined));
        return sel;
      }
      case 'password': {
        const inp = el('input', { type: 'password', id, class: 'mono', placeholder: opts.placeholder || '', dir: 'ltr' });
        inp.value = opts.value == null ? '' : String(opts.value);
        inp.addEventListener('input', u.debounce(() => emitVal(inp.value || undefined), 350));
        return inp;
      }
      default: {
        const inp = el('input', { type: 'text', id, dir: opts.dir || null, class: opts.mono === false ? '' : 'mono', placeholder: opts.placeholder || '' });
        inp.value = opts.value == null ? '' : String(opts.value);
        inp.addEventListener('input', u.debounce(() => emitVal(inp.value.trim() || undefined), opts.debounce == null ? 350 : opts.debounce));
        return inp;
      }
    }
  }

  /* ---------------- string list editor ---------------- */
  function listEditor(opts) {
    const items = Array.isArray(opts.items) ? opts.items.slice() : [];
    const wrap = el('div', { class: 'list-editor' });
    const commit = () => opts.onChange && opts.onChange(items.slice());

    function render() {
      u.clear(wrap);
      if (!items.length) {
        wrap.appendChild(el('div', { class: 'empty', text: opts.emptyText || 'لا توجد عناصر' }));
      }
      items.forEach((val, idx) => {
        const inp = el('input', { type: 'text', class: 'mono', value: val == null ? '' : String(val), placeholder: opts.placeholder || '' });
        inp.addEventListener('input', u.debounce(() => { items[idx] = inp.value; commit(); }, 400));
        wrap.appendChild(el('div', { class: 'list-row' }, [
          el('span', { class: 'drag', text: '⋮⋮' }),
          inp,
          el('button', {
            class: 'btn ghost sm', title: 'أعلى',
            onclick: () => { if (idx > 0) { const t = items[idx - 1]; items[idx - 1] = items[idx]; items[idx] = t; render(); commit(); } }
          }, '↑'),
          el('button', {
            class: 'btn ghost sm', title: 'أسفل',
            onclick: () => { if (idx < items.length - 1) { const t = items[idx + 1]; items[idx + 1] = items[idx]; items[idx] = t; render(); commit(); } }
          }, '↓'),
          el('button', {
            class: 'btn ghost sm danger', title: 'حذف',
            onclick: () => { items.splice(idx, 1); render(); commit(); }
          }, '✕')
        ]));
      });
      wrap.appendChild(el('button', {
        class: 'btn sm', onclick: () => { items.push(''); render(); commit(); }
      }, '+ ' + (opts.addLabel || 'إضافة')));
      if (opts.hint) wrap.appendChild(hint(opts.hint));
    }
    render();
    return wrap;
  }

  /* ---------------- string object editor ---------------- */
  function kvEditor(opts) {
    const obj = u.isObj(opts.value) ? u.clone(opts.value) : {};
    const wrap = el('div', { class: 'kv-editor' });
    const commit = () => opts.onChange && opts.onChange(u.clone(obj));

    function render() {
      u.clear(wrap);
      const keys = Object.keys(obj);
      if (!keys.length) wrap.appendChild(el('div', { class: 'empty', text: 'لا توجد مفاتيح' }));
      keys.forEach(k => {
        const ki = el('input', { type: 'text', class: 'mono', value: k, placeholder: opts.keyPlaceholder || 'المفتاح' });
        const vi = el('input', { type: 'text', class: 'mono', value: obj[k] == null ? '' : String(obj[k]), placeholder: opts.valPlaceholder || 'القيمة' });
        const rename = () => {
          const nk = ki.value;
          if (nk !== k) {
            const next = {};
            keys.forEach(kk => { if (kk === k) next[nk] = obj[kk]; else next[kk] = obj[kk]; });
            Object.keys(obj).forEach(x => delete obj[x]);
            Object.assign(obj, next);
            commit(); render();
          }
        };
        ki.addEventListener('change', rename);
        vi.addEventListener('input', u.debounce(() => { obj[k] = vi.value; commit(); }, 400));
        wrap.appendChild(el('div', { class: 'kv-row' }, [
          ki, vi,
          el('button', {
            class: 'btn ghost sm danger',
            onclick: () => { delete obj[k]; commit(); render(); }
          }, '✕')
        ]));
      });
      wrap.appendChild(el('button', {
        class: 'btn sm',
        onclick: () => {
          let i = 1;
          while (Object.prototype.hasOwnProperty.call(obj, 'key' + i)) i++;
          obj['key' + i] = ''; commit(); render();
        }
      }, '+ ' + (opts.addLabel || 'إضافة مفتاح')));
      if (opts.hint) wrap.appendChild(hint(opts.hint));
    }
    render();
    return wrap;
  }

  /* ---------------- ordered rules table (permissions / policies) ---------------- */
  function rulesTable(opts) {
    const rules = Array.isArray(opts.value) ? u.clone(opts.value) : [];
    const actions = opts.actions || C.PERM_ACTIONS;
    const effects = opts.effects || C.EFFECTS;
    const wrap = el('div', {});
    const table = el('table', { class: 'tbl' });
    const commit = () => opts.onChange && opts.onChange(u.clone(rules));

    function render() {
      u.clear(table);
      const thead = el('thead', {}, el('tr', {}, [
        el('th', { style: { width: '34px' }, text: '#' }),
        el('th', { text: opts.actionLabel || 'الإجراء' }),
        el('th', { text: opts.resourceLabel || 'المورد' }),
        el('th', { style: { width: '130px' }, text: 'النتيجة' }),
        el('th', { style: { width: '120px' }, text: '' })
      ]));
      const tbody = el('tbody');
      rules.forEach((r, idx) => {
        const act = el('input', { type: 'text', class: 'mono', value: r.action || '', list: 'oc-actions', placeholder: 'shell' });
        act.addEventListener('change', () => { r.action = act.value.trim(); commit(); });
        const res = el('input', { type: 'text', class: 'mono', value: r.resource == null ? '' : String(r.resource), placeholder: '*' });
        res.addEventListener('input', u.debounce(() => { r.resource = res.value; commit(); }, 400));
        const eff = el('select', { class: 'eff-' + (effects.indexOf(r.effect) >= 0 ? r.effect : 'ask') });
        effects.forEach(e => eff.appendChild(el('option', { value: e, text: e })));
        eff.value = r.effect || effects[0];
        eff.addEventListener('change', () => { r.effect = eff.value; eff.className = 'eff-' + eff.value; commit(); });

        tbody.appendChild(el('tr', {}, [
          el('td', { class: 'dim mono', text: String(idx + 1) }),
          el('td', {}, act),
          el('td', {}, res),
          el('td', {}, eff),
          el('td', { class: 'actions' }, [
            el('button', { class: 'btn ghost sm', title: 'لأعلى', onclick: () => { if (idx > 0) { rules.splice(idx - 1, 0, rules.splice(idx, 1)[0]); commit(); render(); } } }, '↑'),
            el('button', { class: 'btn ghost sm', title: 'لأسفل', onclick: () => { if (idx < rules.length - 1) { rules.splice(idx + 1, 0, rules.splice(idx, 1)[0]); commit(); render(); } } }, '↓'),
            el('button', { class: 'btn ghost sm', title: 'تكرار', onclick: () => { rules.splice(idx + 1, 0, u.clone(r)); commit(); render(); } }, '⧉'),
            el('button', { class: 'btn ghost sm danger', title: 'حذف', onclick: () => { rules.splice(idx, 1); commit(); render(); } }, '✕')
          ])
        ]));
      });
      table.appendChild(thead); table.appendChild(tbody);
      if (!rules.length) {
        wrap.replaceChildren(el('div', { class: 'empty', text: 'لا توجد قواعد — يُستخدم السلوك الافتراضي (ask عند عدم المطابقة)' }), table);
      } else wrap.replaceChildren(table);
    }
    render();

    const dl = el('datalist', { id: 'oc-actions' });
    actions.forEach(a => dl.appendChild(el('option', { value: a.id })));
    if (!document.getElementById('oc-actions')) document.body.appendChild(dl);

    const box = el('div', {}, [
      wrap,
      el('div', { class: 'flex wrap', style: { marginTop: '10px' } }, [
        el('button', { class: 'btn sm', onclick: () => { rules.push({ action: '*', resource: '*', effect: effects.includes('deny') ? 'deny' : 'allow' }); commit(); render(); } }, '+ قاعدة'),
        el('button', { class: 'btn sm ghost', onclick: () => { (opts.presets || []).forEach(p => rules.push(u.clone(p))); commit(); render(); } }, 'إضافة قالب جاهز'),
        el('button', { class: 'btn sm ghost', onclick: () => { rules.length = 0; commit(); render(); } }, 'مسح الكل'),
        opts.onSort ? el('button', { class: 'btn sm ghost', onclick: () => { rules.sort((a, b) => String(a.action).localeCompare(String(b.action))); commit(); render(); } }, 'ترتيب أبجدي') : null
      ]),
      el('div', { class: 'order-note', html: opts.orderNote || '<b>القاعدة المطابقة الأخيرة تفوز.</b> ضع القواعد العامة أولاً ثم الاستثناءات بعدها. تُدمج القواعد بالترتيب: إعدادات ذات أولوية أقل ← القواعد العامة ← قواعد الوكيل.' })
    ]);
    return box;
  }

/* ---------------- searchable model picker ----------------
     Replaces the free-text `provider/model#variant` field. The list comes
     from the catalogue; providers declared in the user's own config are
     merged in, local runtimes get a hint, and a value outside the
     catalogue is preserved rather than silently dropped. */
  function modelPicker(opts) {
    const C = NS.Catalog;
    if (!C) {
      const fallback = el('input', { type: 'text', class: 'mono', dir: 'ltr', placeholder: 'anthropic/claude-sonnet-4-5#high' });
      fallback.value = opts.value == null ? '' : String(opts.value);
      fallback.addEventListener('input', u.debounce(() => opts.onChange && opts.onChange(fallback.value || undefined), 350));
      return fallback;
    }

    const hidden = el('input', { type: 'hidden', value: opts.value == null ? '' : String(opts.value) });
    const providerSel = el('select', { class: 'mp-provider' });
    const modelRow = el('div', { class: 'mp-row' });
    const variantRow = el('div', { class: 'mp-variant' });
    const status = el('div', { class: 'mp-status' });

    const wrap = el('div', { class: 'mpicker' }, [
      hidden,
      el('div', { class: 'mp-row' }, [providerSel]),
      modelRow,
      variantRow,
      status
    ]);

    const custom = opts.customProviders || (NS.store && NS.store.S.data ? NS.store.S.data.providers : null);
    const list = C.withCustom(custom);
    let cur = C.parseRef(hidden.value);

    function commit(providerId, modelId, variant) {
      hidden.value = (providerId && modelId) ? providerId + '/' + modelId + (variant ? '#' + variant : '') : '';
      cur = C.parseRef(hidden.value);
      if (opts.onChange) opts.onChange(hidden.value || undefined);
      renderStatus();
    }

    function renderProviders() {
      u.clear(providerSel);
      providerSel.appendChild(el('option', { value: '', text: '— اختر المزوّد —' }));
      list.forEach(p => {
        const n = Object.keys(p.models).length;
        const suffix = p.custom ? ' · من إعداداتك'
          : p.local ? ' · محلي'
            : n ? ' · ' + n + ' نموذج' : ' · يُكتشف وقت التشغيل';
        providerSel.appendChild(el('option', { value: p.id, text: p.name + ' — ' + p.id + suffix }));
      });
      providerSel.value = cur.providerId && C.has(cur.providerId) ? cur.providerId : '';
      if (!providerSel.value) {
        const withModels = list.find(p => Object.keys(p.models).length);
        providerSel.value = withModels ? withModels.id : '';
      }
    }

    function renderModels() {
      u.clear(modelRow); u.clear(variantRow);
      const pid = providerSel.value;
      if (!pid) {
        modelRow.appendChild(el('div', { class: 'empty', text: 'اختر مزوّداً لعرض نماذجه' }));
        renderStatus();
        return;
      }
      const p = C.get(pid);
      const models = p ? Object.values(p.models) : [];
      models.sort((a, b) => {
        if ((b.release || '') !== (a.release || '')) return (b.release || '').localeCompare(a.release || '');
        return (b.context || 0) - (a.context || 0);
      });

      const sel = el('select', { class: 'mp-model' });
      sel.appendChild(el('option', {
        value: '',
        text: models.length ? '— اختر النموذج —'
          : (p && p.hint) ? p.hint : '— لا نماذج معروفة —'
      }));
      models.forEach(m => {
        const bits = [];
        if (m.context) bits.push(C.fmtTokens(m.context));
        if (m.toolCall) bits.push('أدوات');
        if (m.reasoning) bits.push('استدلال');
        if ((m.input || []).includes('image')) bits.push('صور');
        sel.appendChild(el('option', { value: m.id, text: m.id + (bits.length ? '  ·  ' + bits.join(' · ') : '') }));
      });

      if (cur.modelId && cur.providerId === pid && !models.some(m => m.id === cur.modelId)) {
        sel.appendChild(el('option', { value: cur.modelId, text: cur.modelId + '  ·  خارج الكتالوج' }));
      }
      if (cur.modelId && cur.providerId === pid) sel.value = cur.modelId;
      sel.addEventListener('change', () => {
        commit(pid, sel.value, sel.value ? cur.variant : '');
        renderVariants();
      });
      modelRow.appendChild(sel);
      renderVariants();
      renderStatus();
    }

    function renderVariants() {
      u.clear(variantRow);
      const pid = providerSel.value;
      const modelId = cur.providerId === pid ? cur.modelId : '';
      if (!modelId) return;
      const variants = C.variantsFor(pid, modelId);
      if (!variants.length && !cur.variant) return;

      const sel = el('select', { class: 'mp-vsel' });
      sel.appendChild(el('option', { value: '', text: 'بدون variant' }));
      variants.forEach(v => sel.appendChild(el('option', { value: v.id, text: v.label })));
      if (cur.variant && !variants.some(v => v.id === cur.variant)) {
        sel.appendChild(el('option', { value: cur.variant, text: cur.variant + ' (مخصص)' }));
      }
      sel.appendChild(el('option', { value: '__manual', text: 'أدخل variant يدوياً…' }));
      sel.value = cur.variant || '';

      sel.addEventListener('change', async () => {
        if (sel.value === '__manual') {
          const v = await u.promptBox('variant', 'اسم الـ variant (يُضاف بعد #)', cur.variant || '');
          if (v && v.trim()) { commit(pid, modelId, v.trim()); }
          sel.value = cur.variant || '';
          renderVariants();
          return;
        }
        commit(pid, modelId, sel.value);
      });

      variantRow.appendChild(el('span', { class: 'mp-lbl', text: '# variant' }));
      variantRow.appendChild(sel);
    }

    function renderStatus() {
      u.clear(status);
      if (!hidden.value) { status.textContent = 'لم يُختر نموذج بعد'; return; }
      const m = C.model(cur.providerId, cur.modelId);
      if (!m) { status.textContent = hidden.value + ' — خارج الكتالوج، سيُحفظ كما هو'; return; }
      const badges = [];
      if (m.toolCall) badges.push('أدوات');
      if (m.reasoning) badges.push('استدلال');
      if (m.structuredOutput) badges.push('إخراج منظّم');
      if ((m.input || []).includes('image')) badges.push('صور');
      if ((m.input || []).includes('pdf')) badges.push('PDF');
      u.clear(status);
      status.appendChild(el('span', { class: 'mp-name', text: m.name }));
      status.appendChild(el('span', { class: 'mp-meta', text: 'سياق ' + C.fmtTokens(m.context) + ' · إخراج ' + C.fmtTokens(m.maxOutput) }));
      if (badges.length) status.appendChild(el('span', { class: 'mp-badges', text: badges.join(' · ') }));
      if (m.costIn != null || m.costOut != null) {
        status.appendChild(el('span', { class: 'mp-meta', text: C.fmtCost(m.costIn) + ' / ' + C.fmtCost(m.costOut) + ' لكل مليون توكن' }));
      }
    }

    providerSel.addEventListener('change', () => {
      commit(providerSel.value, '', '');
      renderModels();
    });

    renderProviders();
    renderModels();
    return wrap;
  }

  /* ---------------- agent picker ---------------- */
  function agentPicker(opts) {
    const sel = el('select', {});
    sel.appendChild(el('option', { value: '', text: '— أي وكيل (الافتراضي) —' }));
    NS.store.agentIds().forEach(a => sel.appendChild(el('option', { value: a, text: a })));
    const cur = NS.store.agentIds();
    sel.value = cur.indexOf(opts.value) >= 0 ? opts.value : '';
    sel.addEventListener('change', () => opts.onChange && opts.onChange(sel.value || undefined));
    return sel;
  }

  /* ---------------- typed key/value editor ----------------
     Package-specific option bags (settings, body, capabilities, …) have no
     fixed schema in the docs. Rather than handing the user a JSON text box,
     every entry gets an explicit value type. */
  const KV_TYPES = [
    { id: 'text', label: 'نص' },
    { id: 'number', label: 'رقم' },
    { id: 'bool', label: 'صح/خطأ' }
  ];

  function typedKV(opts) {
    const source = u.isObj(opts.value) ? u.clone(opts.value) : {};
    const wrap = el('div', { class: 'typedkv' });
    const commit = () => opts.onChange && opts.onChange(Object.keys(source).length ? u.clone(source) : undefined);

    function render() {
      u.clear(wrap);
      const keys = Object.keys(source);
      if (!keys.length) wrap.appendChild(el('div', { class: 'empty', text: opts.emptyText || 'لا توجد مفاتيح' }));

      keys.forEach(k => {
        const cur = source[k];
        const kind = typeof cur === 'number' ? 'number' : typeof cur === 'boolean' ? 'bool' : 'text';
        const keyIn = el('input', { type: 'text', class: 'mono', value: k, placeholder: opts.keyPlaceholder || 'المفتاح' });
        const typeSel = el('select', {}, KV_TYPES.map(t => el('option', { value: t.id, text: t.label })));
        typeSel.value = kind;

        const valWrap = el('div', { class: 'kv-val' });
        function renderValue() {
          u.clear(valWrap);
          const t = typeSel.value;
          if (t === 'bool') {
            const sw = el('input', { type: 'checkbox' });
            sw.checked = source[k] === true;
            sw.addEventListener('change', () => { source[k] = sw.checked; commit(); });
            valWrap.appendChild(el('label', { class: 'switch' }, [sw, el('span', { class: 'slider' })]));
            return;
          }
          const inp = el('input', { type: 'text', class: 'mono', dir: 'ltr', value: source[k] == null ? '' : String(source[k]), placeholder: t === 'number' ? '123' : 'القيمة' });
          inp.addEventListener('input', u.debounce(() => {
            if (t === 'number') {
              const n = Number(inp.value);
              source[k] = inp.value.trim() === '' ? '' : (Number.isFinite(n) ? n : 0);
            } else source[k] = inp.value;
            commit();
          }, 400));
          valWrap.appendChild(inp);
        }
        renderValue();

        typeSel.addEventListener('change', () => {
          const t = typeSel.value;
          if (t === 'number') source[k] = Number(source[k]) || 0;
          else if (t === 'bool') source[k] = source[k] === true;
          else source[k] = source[k] == null ? '' : String(source[k]);
          commit(); renderValue(); render();
        });

        keyIn.addEventListener('change', () => {
          const nk = keyIn.value.trim();
          if (!nk || nk === k) { keyIn.value = k; return; }
          const next = {};
          keys.forEach(kk => { next[kk === k ? nk : kk] = source[kk]; });
          Object.keys(source).forEach(x => delete source[x]);
          Object.assign(source, next);
          commit(); render();
        });

        wrap.appendChild(el('div', { class: 'typedkv-row' }, [
          keyIn, typeSel, valWrap,
          el('button', {
            class: 'btn ghost sm danger', title: 'حذف',
            onclick: () => { delete source[k]; commit(); render(); }
          }, '✕')
        ]));
      });

      wrap.appendChild(el('div', { class: 'flex', style: { marginTop: '9px' } }, [
        el('button', {
          class: 'btn sm',
          onclick: () => {
            let i = 1;
            while (Object.prototype.hasOwnProperty.call(source, 'key' + i)) i++;
            source['key' + i] = '';
            commit(); render();
          }
        }, '+ ' + (opts.addLabel || 'إضافة مفتاح'))
      ]));
      if (opts.hint) wrap.appendChild(hint(opts.hint));
    }
    render();
    return wrap;
  }

  /* ---------------- chips (list of short strings) ---------------- */
  function chips(opts) {
    const items = Array.isArray(opts.items) ? opts.items.slice() : [];
    const wrap = el('div', { class: 'chips-editor' });
    const commit = () => opts.onChange && opts.onChange(items.length ? items.slice() : undefined);

    function render() {
      u.clear(wrap);
      if (!items.length) wrap.appendChild(el('div', { class: 'empty', text: opts.emptyText || 'لا توجد عناصر' }));
      items.forEach((v, i) => wrap.appendChild(el('span', { class: 'chip-input' }, [
        el('span', { class: 'ltr', text: v }),
        el('button', { title: 'حذف', onclick: () => { items.splice(i, 1); commit(); render(); } }, '×')
      ])));
      const inp = el('input', { type: 'text', class: 'mono', dir: 'ltr', placeholder: opts.placeholder || '', style: { maxWidth: '220px' } });
      const add = () => {
        const v = inp.value.trim();
        if (!v) return;
        items.push(v); inp.value = '';
        commit(); render();
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      wrap.appendChild(el('div', { class: 'chips-add' }, [inp, el('button', { class: 'btn sm', onclick: add }, '+')]));
      if (opts.hint) wrap.appendChild(hint(opts.hint));
    }
    render();
    return wrap;
  }

  /* ---------------- collapsible item card ---------------- */
  function item(opts) {
    const body = el('div', { class: 'item-body' });
    const chev = el('span', { class: 'chev' + (opts.open ? ' open' : ''), text: '▶' });
    const title = el('div', { class: 'item-title' }, [
      opts.icon ? el('span', { text: opts.icon }) : null,
      el('span', { class: 'id', text: opts.title }),
      opts.badges || null
    ]);
    const head = el('div', { class: 'item-head' }, [
      chev,
      el('div', {}, [title, opts.subtitle ? el('div', { class: 'item-sub', text: opts.subtitle }) : null]),
      el('div', { class: 'spacer' }),
      ...(opts.headActions || [])
    ]);
    head.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select, textarea')) return;
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      chev.classList.toggle('open', !open);
    });
    const root = el('div', { class: 'item' + (opts.disabled ? ' disabled-item' : '') }, [head, body]);
    if (!opts.open) body.style.display = 'none';
    root.body = body;
    return root;
  }

  /* ---------------- sub tabs ---------------- */
  function subtabs(tabs, onPick, active) {
    const wrap = el('div', { class: 'subtabs' });
    tabs.forEach(t => {
      wrap.appendChild(el('button', {
        class: 'subtab' + (t.id === active ? ' on' : ''),
        onclick: () => onPick(t.id)
      }, t.label + (t.count != null ? ' (' + t.count + ')' : '')));
    });
    return wrap;
  }

  /* ---------------- grid helper ---------------- */
  function grid(children, cols) {
    return el('div', { class: 'grid ' + (cols || 'c2') }, children.filter(Boolean));
  }

  function btn(label, opts) {
    opts = opts || {};
    return el('button', {
      class: 'btn ' + (opts.kind || 'ghost') + (opts.size ? ' ' + opts.size : '') + (opts.cls ? ' ' + opts.cls : ''),
      title: opts.title || '',
      onclick: opts.onClick
    }, opts.icon ? [el('span', { text: opts.icon }), label] : label);
  }

  NS.F = { pageHead, card, field, listEditor, kvEditor, typedKV, chips, rulesTable, item, subtabs, grid, btn, hint, sectionNote, KV_TYPES };
})(window.OCM);
