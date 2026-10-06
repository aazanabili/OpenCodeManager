/* ============================================================
   catalog.js — the provider / model catalogue

   Source of truth is https://models.dev/api.json (the same feed OpenCode
   uses). It ships with CORS enabled, so the browser can fetch it directly.

   Strategy:
     · a bundled snapshot always works offline
     · when the network is available we refresh and merge, so the list is
       current without the app ever needing a server
     · locally-discovered runtimes (ollama, vllm, lmstudio) are not in the
       feed — OpenCode finds those at runtime, so they get their own entries
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u;

  const SRC = 'https://models.dev/api.json';
  const CACHE_KEY = 'oc-catalog-v1';
  const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 3;   // refresh after 3 days

  /** Runtimes OpenCode discovers locally; they never appear in the feed. */
  const LOCAL_RUNTIMES = {
    ollama: {
      name: 'Ollama', env: [], npm: '',
      doc: 'https://ollama.com',
      hint: 'اكتشفه OpenCode من http://127.0.0.1:11434 — أضف أسماء النماذج يدوياً',
      models: {}
    },
    vllm: {
      name: 'vLLM', env: [], npm: '',
      doc: 'https://docs.vllm.ai',
      hint: 'نماذج vLLM تبدأ مع تعطيل الأدوات — فعّلها يدوياً لكل نموذج',
      models: {}
    },
    lmstudio: {
      name: 'LM Studio', env: [], npm: '',
      doc: 'https://lmstudio.ai',
      hint: 'اكتشفه OpenCode من http://127.0.0.1:1234/v1',
      models: {}
    }
  };

  const state = {
    providers: {},        // id -> { id, name, env, npm, doc, models, total, bundled }
    source: 'bundled',    // 'bundled' | 'live'
    fetchedAt: 0,
    refreshing: false,
    lastError: null,
    listeners: []
  };

  /* ---------------- storage ---------------- */
  function idb(mode, fn) {
    return new Promise((resolve) => {
      let req;
      try { req = indexedDB.open('opencode-manager', 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = () => { try { req.result.createObjectStore('handles'); } catch (_) { } };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('handles', mode);
          const r = fn(tx.objectStore('handles'));
          tx.oncomplete = () => resolve(r && r.result !== undefined ? r.result : null);
          tx.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      };
    });
  }
  const cacheGet = () => idb('readonly', s => s.get(CACHE_KEY));
  const cacheSet = (v) => idb('readwrite', s => s.put(v, CACHE_KEY));

  /* ---------------- shaping ---------------- */
  function normModel(id, m) {
    return {
      id,
      name: m.name || id,
      family: m.family || m.fam || '',
      release: m.release_date || m.rel || '',
      reasoning: !!m.reasoning,
      reasoningOptions: m.reasoning_options || m.ropts || null,
      toolCall: !!(m.tool_call != null ? m.tool_call : m.tools),
      structuredOutput: !!(m.structured_output != null ? m.structured_output : m.struct),
      attachment: !!(m.attachment != null ? m.attachment : m.attach),
      input: m.modalities ? m.modalities.input : (m.in || []),
      output: m.modalities ? m.modalities.output : (m.out || []),
      context: (m.limit && m.limit.context) || m.ctx || 0,
      maxOutput: (m.limit && m.limit.output) || m.maxOut || 0,
      costIn: (m.cost && m.cost.input) != null ? m.cost.input : (m.cin != null ? m.cin : null),
      costOut: (m.cost && m.cost.output) != null ? m.cost.output : (m.cout != null ? m.cout : null),
      canonical: m.canonical_model_id || m.cid || ''
    };
  }

  function normProvider(id, p) {
    return {
      id,
      name: p.name || id,
      env: Array.isArray(p.env) ? p.env : (p.env ? [p.env] : []),
      npm: p.npm || '',
      doc: p.doc || '',
      local: !!LOCAL_RUNTIMES[id],
      hint: (LOCAL_RUNTIMES[id] || {}).hint || '',
      models: {},
      total: p.total || 0
    };
  }

  function ingest(raw) {
    const next = {};
    for (const [pid, p] of Object.entries(raw)) {
      const np = normProvider(pid, p);
      if (p.models) for (const [mid, m] of Object.entries(p.models)) np.models[mid] = normModel(mid, m);
      np.total = np.total || Object.keys(np.models).length;
      next[pid] = np;
    }
    // local runtimes always exist, even when absent from the feed
    for (const id of Object.keys(LOCAL_RUNTIMES)) {
      if (!next[id]) next[id] = normProvider(id, LOCAL_RUNTIMES[id]);
    }
    state.providers = next;
    emit();
  }

  function emit() { state.listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }
  function on(fn) { state.listeners.push(fn); }

  /* ---------------- init ---------------- */
  async function init() {
    // 1. bundled snapshot — instant, always available
    if (window.OCM_BUNDLED_CATALOG) {
      ingest(window.OCM_BUNDLED_CATALOG.providers || {});
      state.fetchedAt = window.OCM_BUNDLED_CATALOG.fetched ? Date.parse(window.OCM_BUNDLED_CATALOG.fetched) : 0;
    }

    // 2. a previously cached live snapshot
    const cached = await cacheGet();
    if (cached && cached.providers && Date.now() - (cached.at || 0) < CACHE_MAX_AGE) {
      ingest(cached.providers);
      state.source = 'live';
      state.fetchedAt = cached.at;
      emit();
    }

    // 3. refresh in the background; never block the UI on it
    if (!cached || Date.now() - (cached.at || 0) >= CACHE_MAX_AGE) {
      refresh().catch(() => { });
    }
    return state;
  }

  async function refresh() {
    if (state.refreshing) return state;
    state.refreshing = true;
    state.lastError = null;
    emit();
    try {
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timer = setTimeout(() => ctrl && ctrl.abort(), 45000);
      const res = await fetch(SRC, ctrl ? { signal: ctrl.signal } : undefined);
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();

      // keep only what the UI needs, otherwise the cache gets huge
      const slim = {};
      for (const [pid, p] of Object.entries(raw)) {
        const models = {};
        for (const [mid, m] of Object.entries(p.models || {})) {
          models[mid] = {
            name: m.name, family: m.family, release_date: m.release_date,
            reasoning: m.reasoning, reasoning_options: m.reasoning_options,
            tool_call: m.tool_call, structured_output: m.structured_output,
            attachment: m.attachment, modalities: m.modalities,
            limit: m.limit, cost: m.cost, canonical_model_id: m.canonical_model_id
          };
        }
        slim[pid] = {
          name: p.name, env: p.env, npm: p.npm, doc: p.doc, models
        };
      }
      ingest(slim);
      state.source = 'live';
      state.fetchedAt = Date.now();
      await cacheSet({ at: state.fetchedAt, providers: slim }).catch(() => { });
    } catch (e) {
      state.lastError = e && e.name === 'AbortError' ? 'انتهت المهلة' : (e && e.message) || 'تعذّر الاتصال';
      // offline is expected and not an error worth shouting about
      if (state.lastError !== 'Failed to fetch') {
        NS.fx && NS.fx.toast('warn', 'تعذّر تحديث كتالوج النماذج: ' + state.lastError, 4200);
      }
    } finally {
      state.refreshing = false;
      emit();
    }
    return state;
  }

  /* ---------------- queries ---------------- */
  function providers() { return Object.values(state.providers); }
  function get(id) { return state.providers[id] || null; }
  function has(id) { return !!state.providers[id]; }

  function models(providerId) {
    const p = state.providers[providerId];
    if (!p) return [];
    return Object.values(p.models).sort((a, b) => {
      if ((b.release || '') !== (a.release || '')) return (b.release || '').localeCompare(a.release || '');
      return (b.context || 0) - (a.context || 0);
    });
  }

  function providerIds() { return Object.keys(state.providers).sort(); }

  /** Merge providers defined in the user's own config over the catalogue. */
  function withCustom(custom) {
    if (!u.isObj(custom)) return providers();
    const out = providers().slice();
    const seen = new Set(out.map(p => p.id));
    Object.keys(custom).forEach(id => {
      const c = custom[id];
      const models = {};
      if (u.isObj(c && c.models)) {
        for (const [mid, m] of Object.entries(c.models)) {
          models[mid] = Object.assign(normModel(mid, m || {}), { custom: true });
        }
      }
      const entry = {
        id,
        name: (c && c.name) || id,
        env: (c && c.env) || [],
        npm: (c && c.package) || '',
        doc: '',
        custom: true,
        local: false,
        hint: 'مزوّد معرّف في ملفك',
        models,
        total: Object.keys(models).length
      };
      if (seen.has(id)) {
        const i = out.findIndex(p => p.id === id);
        out[i] = Object.assign({}, out[i], entry, { models: Object.assign({}, out[i].models, models) });
      } else out.push(entry);
    });
    return out.sort((a, b) => {
      if (a.custom !== b.custom) return a.custom ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }

  /** Case-insensitive search over provider ids, names and model ids. */
  function search(query, opts) {
    opts = opts || {};
    const q = (query || '').trim().toLowerCase();
    const list = opts.providers || providers();

    // Always return the same shape: `models` as a sorted array of details.
    const shape = (p, models, matched) => Object.assign({}, p, {
      models: models.slice().sort((a, b) => {
        if ((b.release || '') !== (a.release || '')) return (b.release || '').localeCompare(a.release || '');
        return (b.context || 0) - (a.context || 0);
      }),
      matchedProvider: matched
    });
    const allModels = (p) => Object.values(p.models || {});

    if (!q) {
      return list
        .map(p => shape(p, allModels(p).filter(m => passesFilters(m, opts)), true))
        .filter(p => p.models.length);
    }

    const out = [];
    for (const p of list) {
      const hitProvider = p.id.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q);
      const ms = allModels(p).filter(m => {
        if (!passesFilters(m, opts)) return false;
        if (hitProvider) return true;
        return m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q);
      });
      if (hitProvider || ms.length) out.push(shape(p, ms, hitProvider));
    }
    return out;
  }

  function passesFilters(m, opts) {
    if (opts.tools && !m.toolCall) return false;
    if (opts.reasoning && !m.reasoning) return false;
    if (opts.vision && !(m.input || []).includes('image')) return false;
    if (opts.context && (m.context || 0) < opts.context) return false;
    return true;
  }

  function model(providerId, modelId) {
    const p = state.providers[providerId];
    return (p && p.models[modelId]) || null;
  }

  /** "anthropic/claude-sonnet-4-5" -> { providerId, modelId, variant } */
  function parseRef(ref) {
    const s = String(ref || '').trim();
    if (!s) return { providerId: '', modelId: '', variant: '' };
    const hash = s.indexOf('#');
    const variant = hash >= 0 ? s.slice(hash + 1) : '';
    const body = hash >= 0 ? s.slice(0, hash) : s;
    const slash = body.indexOf('/');
    return {
      providerId: slash < 0 ? '' : body.slice(0, slash),
      modelId: slash < 0 ? body : body.slice(slash + 1),
      variant
    };
  }

  /**
   * Available variants for a model. OpenCode writes them as `#variant` in
   * model references; models.dev describes reasoning options instead, so we
   * surface the useful ones and always allow a free variant.
   */
  function variantsFor(providerId, modelId) {
    const m = model(providerId, modelId);
    if (!m) return [];
    const out = [];
    const push = (id, label) => { if (id && !out.some(v => v.id === id)) out.push({ id, label }); };

    if (m.reasoning) {
      if (m.reasoningOptions && m.reasoningOptions.type === 'effort') {
        (m.reasoningOptions.options || []).forEach(o => push(o, 'جهد ' + o));
      } else if (m.reasoningOptions && m.reasoningOptions.type === 'budget_tokens') {
        push('low', 'جهد منخفض');
        push('medium', 'جهد متوسط');
        push('high', 'جهد عالٍ');
      } else {
        push('low', 'جهد منخفض');
        push('medium', 'جهد متوسط');
        push('high', 'جهد عالٍ');
      }
    }
    return out;
  }

  function status() {
    return {
      source: state.source,
      fetchedAt: state.fetchedAt,
      refreshing: state.refreshing,
      lastError: state.lastError,
      providers: Object.keys(state.providers).length,
      models: Object.values(state.providers).reduce((n, p) => n + Object.keys(p.models).length, 0)
    };
  }

  function fmtTokens(n) {
    if (!n) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(n);
  }
  function fmtCost(v) { return v == null ? '—' : '$' + v; }

  NS.Catalog = {
    SRC, LOCAL_RUNTIMES, init, refresh, on, state,
    providers, get, has, models, providerIds, withCustom, search, model,
    parseRef, variantsFor, status, fmtTokens, fmtCost
  };
})(window.OCM);