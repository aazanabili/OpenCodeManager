/* ============================================================
   store.js — application state, data catalog, undo/redo
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u;
  const J = NS.jsonc;

  /* ================================================================
     CATALOG — every documented constant, extracted from the V2 docs
     ================================================================ */
  const C = {
    DOCS: 'https://opencode.ai/v2/docs/',

    EFFECTS: ['allow', 'ask', 'deny'],
    EFFECT_AR: { allow: 'سماح', ask: 'سؤال', deny: 'منع' },

    PERM_ACTIONS: [
      { id: '*', ar: 'أي إجراء', desc: 'يشمل كل الأدوات' },
      { id: 'read', ar: 'قراءة', desc: 'أداة read — مسار داخلي أو مسار خارجي مطلق' },
      { id: 'edit', ar: 'تعديل', desc: 'أدوات edit و write و patch — المسار الهدف' },
      { id: 'glob', ar: 'بحث ملفات', desc: 'أداة glob — نمط البحث' },
      { id: 'grep', ar: 'بحث نصي', desc: 'أداة grep — التعبير النمطي المطلوب' },
      { id: 'shell', ar: 'أوامر صدفة', desc: 'أداة bash — نص الأمر' },
      { id: 'subagent', ar: 'وكلاء فرعيون', desc: 'أداة task — معرّف الوكيل المستهدف' },
      { id: 'skill', ar: 'مهارات', desc: 'أداة skill — معرّف المهارة' },
      { id: 'question', ar: 'أسئلة', desc: 'أداة question' },
      { id: 'webfetch', ar: 'جلب ويب', desc: 'أداة webfetch — العنوان' },
      { id: 'websearch', ar: 'بحث ويب', desc: 'أداة websearch — الاستعلام' },
      { id: 'external_directory', ar: 'مجلد خارجي', desc: 'الوصول خارج مجلد المشروع — ينتهي عادة بـ /*' },
      { id: 'doom_loop', ar: 'doom_loop', desc: 'غير إجراء V2 حالي' },
      { id: 'execute', ar: 'execute', desc: 'يتحكم في إتاحة Code Mode' }
    ],

    MODES: [
      { id: 'primary', ar: 'رئيسي', desc: 'يعمل كوكيل رئيسي لجلسة. الافتراضي للوكيل المخصص الجديد.' },
      { id: 'subagent', ar: 'فرعي', desc: 'يعمل فقط داخل جلسة فرعية عبر أداة task.' },
      { id: 'all', ar: 'كلاهما', desc: 'يعمل كوكيل رئيسي وكوكيل فرعي.' }
    ],

    BUILTIN_AGENTS: [
      { id: 'build', mode: 'primary', ar: 'وكيل البرمجة الافتراضي؛ الأدوات مسموحة، وقراءة ملفات البيئة الحساسة وخارج مساحة العمل تطلب موافقة.' },
      { id: 'plan', mode: 'primary', ar: 'يستكشف ويخطّط دون تعديل ملفات المشروع العادية؛ يكتب ملفات plan الخاصة بـ opencode عند الطلب.' },
      { id: 'general', mode: 'subagent', ar: 'أبحاث ومهام متعددة بصلاحيات واسعة، لكنه لا يستطيع إطلاق وكلاء فرعيين.' },
      { id: 'explore', mode: 'subagent', ar: 'يبحث ويقرأ الكود أو مصادر الويب دون تعديل الملفات.' },
      { id: 'compaction', mode: 'all', hidden: true, ar: 'وكيل داخلي لضغط السياق.' },
      { id: 'title', mode: 'all', hidden: true, ar: 'وكيل داخلي لتوليد العناوين؛ يرفض كل الإجراءات.' },
      { id: 'summary', mode: 'all', hidden: true, ar: 'وكيل داخلي للتلخيص؛ يرفض كل الإجراءات.' }
    ],

    UPDATE_MODES: [
      { id: 'disable', ar: 'تعطيل', desc: 'تخطَّ فحوص التحديث' },
      { id: 'notify', ar: 'إشعار', desc: 'أظهر التوفر قبل التثبيت (افتراضي)' },
      { id: 'auto', ar: 'تلقائي', desc: 'ثبّت التحديثات تلقائياً' }
    ],

    SHARE_MODES: [
      { id: 'manual', ar: 'يدوي' }, { id: 'auto', ar: 'تلقائي' }, { id: 'disabled', ar: 'معطّل' }
    ],

    POLICY_ACTIONS: [
      { id: 'provider.use', ar: 'provider.use', desc: 'السماح أو منع استخدام مزوّد' },
      { id: 'permission', ar: 'permission', desc: 'منع قسري لفحص صلاحية، مورده <action>:<value>' }
    ],
    POLICY_EFFECTS: ['allow', 'deny'],

    WEBSEARCH_PROVIDERS: ['random', 'exa', 'brave', 'kagi', 'perplexity', 'tavily'],

    MCP_PROTOCOLS: [
      { id: 'legacy', ar: 'legacy', desc: 'افتراضي — initialize حتى مراجعات 2025-11-25' },
      { id: 'auto', ar: 'auto', desc: 'يستكشف الخادم عبر server/discover لسريان 2026-07-28 ثم يتراجع' },
      { id: '2026-07-28', ar: '2026-07-28', desc: 'يتطلب سريان 2026-07-28' }
    ],
    MCP_TIMEOUT_DEFAULTS: { startup: 30000, catalog: 30000, execution: 43200000 },

    CMD_FIELDS: [
      { id: 'template', ar: 'القالب', type: 'textarea', required: true, desc: 'نص البرومبت. استخدم $ARGUMENTS أو $1 و $2.' },
      { id: 'description', ar: 'الوصف', type: 'text', desc: 'النص الظاهر في قوائم الأوامر' },
      { id: 'agent', ar: 'الوكيل', type: 'agent', desc: 'الوكيل المستخدم عند تشغيل الأمر' },
      { id: 'model', ar: 'النموذج', type: 'model', desc: 'تجاوز النموذج بصيغة provider/model أو provider/model#variant' },
      { id: 'subagent', ar: 'تشغيل فرعي', type: 'bool', desc: 'true يشغّل في جلسة فرعية في الخلفية؛ false يفرض الجلسة الحالية' }
    ],

    FORMATTER_BUILTINS: [
      ['gofmt', ['.go'], 'gofmt'],
      ['mix', ['.ex', '.exs', '.eex', '.heex', '.leex', '.neex', '.sface'], 'mix'],
      ['oxfmt', ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'], 'oxfmt في package.json'],
      ['prettier', ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.xml', '.md', '.mdx', '.graphql', '.gql'], 'prettier في package.json'],
      ['biome', ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.xml', '.md', '.mdx', '.graphql', '.gql'], 'biome.json + @biomejs/biome'],
      ['zig', ['.zig', '.zon'], 'zig'],
      ['clang-format', ['.c', '.cc', '.cpp', '.cxx', '.c++', '.h', '.hh', '.hpp', '.hxx', '.h++', '.ino', '.C', '.H'], 'clang-format + .clang-format'],
      ['ktlint', ['.kt', '.kts'], 'ktlint'],
      ['ruff', ['.py', '.pyi'], 'ruff'],
      ['air', ['.R'], 'air'],
      ['uv', ['.py', '.pyi'], 'uv'],
      ['rubocop', ['.rb', '.rake', '.gemspec', '.ru'], 'rubocop'],
      ['standardrb', ['.rb', '.rake', '.gemspec', '.ru'], 'standardrb'],
      ['htmlbeautifier', ['.erb'], 'htmlbeautifier'],
      ['dart', ['.dart'], 'dart'],
      ['ocamlformat', ['.ml', '.mli'], 'ocamlformat + .ocamlformat'],
      ['terraform', ['.tf', '.tfvars'], 'terraform'],
      ['latexindent', ['.tex'], 'latexindent'],
      ['gleam', ['.gleam'], 'gleam'],
      ['shfmt', ['.sh', '.bash'], 'shfmt'],
      ['nixfmt', ['.nix'], 'nixfmt'],
      ['rustfmt', ['.rs'], 'rustfmt'],
      ['pint', ['.php'], 'laravel/pint في composer.json'],
      ['ormolu', ['.hs'], 'ormolu'],
      ['cljfmt', ['.clj', '.cljs', '.cljc', '.edn'], 'cljfmt'],
      ['dfmt', ['.d'], 'dfmt']
    ],

    PROVIDER_PACKAGES: [
      '@opencode/ai/providers/openai',
      '@opencode/ai/providers/openai/chat',
      '@opencode/ai/providers/openai/responses',
      '@opencode/ai/providers/openai-compatible',
      '@opencode/ai/providers/openai-compatible/responses',
      '@opencode/ai/providers/anthropic',
      '@opencode/ai/providers/anthropic-compatible',
      '@opencode/ai/providers/google',
      '@opencode/ai/providers/google-vertex',
      '@opencode/ai/providers/google-vertex/gemini',
      '@opencode/ai/providers/google-vertex/chat',
      '@opencode/ai/providers/google-vertex/responses',
      '@opencode/ai/providers/google-vertex/messages',
      '@opencode/ai/providers/azure',
      '@opencode/ai/providers/azure/chat',
      '@opencode/ai/providers/azure/responses',
      '@opencode/ai/providers/amazon-bedrock',
      '@opencode/ai/providers/amazon-bedrock/mantle',
      '@opencode/ai/providers/amazon-bedrock/mantle/chat',
      '@opencode/ai/providers/amazon-bedrock/mantle/responses',
      '@opencode/ai/providers/openrouter',
      '@opencode/ai/providers/xai'
    ],

    KNOWN_PROVIDERS: ['opencode', 'anthropic', 'openai', 'google', 'google-vertex', 'azure', 'amazon-bedrock', 'openrouter', 'xai', 'ollama', 'lmstudio', 'vllm', 'github-copilot', 'azure-cognitive-services', 'google-vertex-anthropic'],

    /* ----- cli.json ----- */
    CLI_THEME_MODES: ['system', 'dark', 'light'],
    CLI_CURSOR_STYLES: ['block', 'underline', 'line', 'default'],
    CLI_PASTE: ['compact', 'full'],
    CLI_SESSION_ENUMS: {
      sidebar: ['auto', 'hide'],
      thinking: ['show', 'hide'],
      grouping: ['auto', 'none'],
      markdown: ['source', 'rendered'],
      new_location: ['launch', 'inherit'],
      permissions: ['prompt', 'autoaccept']
    },
    CLI_TABS: { mode: ['auto', 'on', 'off'], scope: ['cwd', 'global'], layout: ['horizontal', 'vertical'], indicators: ['status', 'numbers'] },
    CLI_DIFFS: { source: ['branch', 'committed', 'working', 'turn'], wrap: ['word', 'none'], view: ['auto', 'split', 'unified'] },
    CLI_TURN_TOKENS: ['false', 'true', 'verbose'],
    CLI_SOUND_EVENTS: ['default', 'question', 'permission', 'error', 'done', 'subagent_done'],
    CLI_SPINNERS: ['block-soft-slide', 'block-soft-sweep', 'block-low-comet', 'block-low-duet', 'block-shuttle', 'block-bridge', 'block-squeeze', 'small-toggle', 'square-toggle', 'grow-shrink', 'quadrant-orbit', 'crosshatch', 'density-wave', 'seed'],

    /* Built-in themes shipped with opencode (themes/*.json) */
    THEMES: ['opencode', 'tokyonight', 'tokyonight-night', 'tokyonight-day', 'gruvbox', 'gruvbox-light', 'catppuccin', 'catppuccin-mocha', 'catppuccin-latte', 'nord', 'dracula', 'everforest', 'matte-black', 'ayu', 'ayu-light', 'ayu-mirage', 'rose-pine', 'rose-pine-dawn', 'solarized-light', 'solarized-dark', 'onedark', 'monokai', 'vitesse-dark', 'vitesse-light'],

    KEYBIND_COMMANDS: [
      'app.exit', 'app.help', 'help.show', 'session.list', 'session.new', 'session.share',
      'session.previous', 'session.next', 'session.replay', 'session.fork', 'session.undo',
      'session.redo', 'session.compact', 'session.thinking', 'session.children', 'session.rename',
      'prompt.submit', 'prompt.clear', 'prompt.paste', 'prompt.editor', 'prompt.history.previous',
      'prompt.history.next', 'prompt.autocomplete', 'prompt.transcript', 'prompt.leader',
      'file.open', 'diff.open', 'diff.next', 'diff.prev', 'messages.next', 'messages.previous',
      'command.list', 'agent.list', 'model.list', 'theme.list', 'mcp.list', 'connect.list',
      'terminal.focus', 'terminal.clear', 'debug.open', 'editor.open'
    ]
  };

  /* ================================================================
     Store
     ================================================================ */
  const listeners = [];

  /* Scope model
     ────────────────────────────────────────────────────────────
     docKey examples:
       'global:config'          ~/.config/opencode/opencode.json(c)
       'global:cli'             ~/.config/opencode/cli.json
       'project:r1::acme:config'  acme/opencode.json(c)
     Each key keeps its own data + comments + origin + undo stack,
     so switching scope never mixes two configurations together. */
  const S = {
    docKey: 'global:config',
    scope: { kind: 'global', label: 'الإعدادات العامة' },
    target: 'config',          // 'config' | 'cli'  (cli only exists in global scope)

    data: {},
    comments: [],
    text: '',
    dirty: false,
    loaded: false,
    origin: null,              // { kind, rootId, fileName, projectId }

    history: [], future: [],
    buffers: {},               // docKey -> { data, comments, history, future, dirty, text }
    backups: [],

    fs: null,
    view: 'general',

    globalData: null,          // parsed global config, for "inherited from global" hints
    projects: []
  };

  /** Build the document key for a scope + target. */
  function docKeyFor(scope, target) {
    if (!scope || scope.kind === 'global') return 'global:' + (target || 'config');
    return scope.id + ':' + (target || 'config');
  }

  function emit(reason) { listeners.forEach(fn => { try { fn(S, reason); } catch (e) { console.error(e); } }); }
  function on(fn) { listeners.push(fn); }

  /* ----- snapshot / restore ----- */
  function snapshot() { return { data: u.clone(S.data), comments: u.clone(S.comments) }; }
  function restore(s) { S.data = s.data; S.comments = s.comments; }

  /** Record an undo point capturing the state BEFORE the change. */
  function checkpoint(before) {
    S.history.push(before);
    if (S.history.length > 80) S.history.shift();
    S.future.length = 0;
  }

  /** Convenience: run a mutation with undo support. */
  function edit(fnMutator, reason) {
    const before = snapshot();
    const res = fnMutator(S.data);
    if (res === false) return false;
    checkpoint(before);
    S.dirty = true;
    updateScopeChip();
    emit(reason || 'edit');
    return true;
  }

  function undo() {
    if (!S.history.length) return false;
    S.future.push(snapshot());
    restore(S.history.pop());
    S.dirty = true;
    emit('undo');
    return true;
  }
  function redo() {
    if (!S.future.length) return false;
    S.history.push(snapshot());
    restore(S.future.pop());
    S.dirty = true;
    emit('redo');
    return true;
  }

  /* ----- loading ----- */
  function loadText(text, meta) {
    const parsed = J.parse(text);
    if (parsed.error) {
      const err = new Error(parsed.error.message);
      err.line = parsed.error.line; err.column = parsed.error.column;
      err.raw = true;
      throw err;
    }
    S.text = text;
    S.data = parsed.value && typeof parsed.value === 'object' ? parsed.value : {};
    S.comments = parsed.comments;
    S.loaded = true;
    S.dirty = false;
    S.history.length = 0; S.future.length = 0;
    if (meta) S.origin = meta;
    updateScopeChip();
    emit('load');
  }

  function loadBuffer(key, text, meta) {
    const parsed = J.parse(text);
    if (parsed.error) return false;
    S.buffers[key] = {
      data: parsed.value && typeof parsed.value === 'object' ? parsed.value : {},
      comments: parsed.comments, text, meta: meta || null,
      history: [], future: [], dirty: false
    };
    return true;
  }

  /** Persist the current document into its buffer (without touching the DOM). */
  function stash() {
    if (!S.docKey) return;
    S.buffers[S.docKey] = {
      data: u.clone(S.data), comments: u.clone(S.comments),
      history: S.history.splice(0), future: S.future.splice(0),
      dirty: S.dirty, text: S.loaded ? serialize() : null,
      meta: S.origin, loaded: S.loaded
    };
  }

  /**
   * Switch to another document (global config, global cli, or a project's
   * config). Each keeps its own edits, undo history and dirty flag.
   */
  function switchDoc(scope, target) {
    let t = (target || 'config');
    if (scope && scope.kind === 'project') t = 'config';   // no cli.json inside a project
    const key = docKeyFor(scope, t);
    if (key === S.docKey && S.loaded) return false;

    stash();
    S.docKey = key;
    S.scope = scope || { kind: 'global', label: 'الإعدادات العامة' };
    S.target = t;

    const buf = S.buffers[key];
    if (buf) {
      S.data = u.clone(buf.data);
      S.comments = u.clone(buf.comments);
      S.text = buf.text || '';
      S.history = buf.history || [];
      S.future = buf.future || [];
      S.dirty = !!buf.dirty;
      S.origin = buf.meta || null;
      S.loaded = buf.loaded !== false;
    } else {
      S.data = {}; S.comments = []; S.text = '';
      S.history = []; S.future = [];
      S.dirty = false; S.loaded = false; S.origin = null;
    }
    updateScopeChip();
    emit('scope');
    return true;
  }

  /* ----- serialisation ----- */
  function serialize() { return J.stringify(S.data, S.comments, { indent: 2 }); }

  function markSaved() {
    S.dirty = false;
    S.text = serialize();
    const buf = S.buffers[S.docKey] || {};
    buf.dirty = false; buf.text = S.text; buf.meta = S.origin; buf.loaded = true;
    S.buffers[S.docKey] = buf;
    updateScopeChip();
    emit('saved');
  }

  /* ----- scope chip ----- */
  function updateScopeChip() {
    const chip = document.getElementById('scopeChip');
    const label = document.getElementById('scopeLabel');
    if (!chip || !label) return;
    chip.classList.remove('live', 'dirty');
    const project = currentProject();
    const parts = [];
    // For a project the file path already contains the project folder,
    // so showing the name twice would just be noise.
    if (!project) parts.push('الإعدادات العامة');
    parts.push(S.origin && S.origin.fileName
      ? S.origin.fileName
      : (S.target === 'cli' ? 'cli.json' : 'opencode.json'));
    if (S.origin && S.origin.kind === 'memory') parts.push('(غير محفوظ)');
    if (!S.loaded) parts.push('غير محمّل');
    label.textContent = parts.join(' · ');
    if (S.origin && S.origin.kind === 'fs' && S.loaded) chip.classList.add(S.dirty ? 'dirty' : 'live');
  }

  /* ----- backups (in-memory safety net) ----- */
  function pushBackup(name, text) {
    S.backups.unshift({ name, text, at: Date.now() });
    if (S.backups.length > 10) S.backups.pop();
  }

  /* ----- scope helpers used by views ----- */
  const isGlobal = () => !S.scope || S.scope.kind === 'global';
  const currentProject = () => (S.scope && S.scope.kind === 'project' ? S.scope : null);

  /** Is this top-level key also defined in the global configuration? */
  function inheritedFromGlobal(key) {
    if (isGlobal() || !S.globalData) return false;
    return Object.prototype.hasOwnProperty.call(S.globalData, key) &&
      u.get(S.globalData, key) !== undefined;
  }

  function globalValue(key) { return S.globalData ? S.globalData[key] : undefined; }

  /* ----- convenience accessors ----- */
  const cfg = () => S.data;
  const agents = () => (u.isObj(S.data.agents) ? S.data.agents : {});

  function agentIds() {
    const ids = Object.keys(agents());
    C.BUILTIN_AGENTS.forEach(b => { if (!ids.includes(b.id)) ids.unshift(b.id); });
    return ids;
  }

  NS.C = C;
  NS.store = {
    S, on, emit, edit, checkpoint, snapshot, restore, undo, redo,
    loadText, serialize, markSaved, switchDoc, stash, docKeyFor, loadBuffer,
    isGlobal, currentProject, inheritedFromGlobal, globalValue,
    updateScopeChip, pushBackup, cfg, agents, agentIds
  };
})(window.OCM);