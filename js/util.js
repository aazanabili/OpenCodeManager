/* ============================================================
   util.js — DOM + data helpers (classic script, global OCM namespace)
   ============================================================ */
window.OCM = window.OCM || {};

(function (NS) {
  'use strict';

  /* ---------- DOM ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      }
    }
    if (children != null) {
      appendAll(node, children);
    }
    return node;
  }

  /** Append children, flattening nested arrays and skipping null/false. */
  function appendAll(node, children) {
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null || c === false || c === '') return;
      if (Array.isArray(c)) { appendAll(node, c); return; }
      if (typeof c === 'object' && c.nodeType) { node.appendChild(c); return; }
      node.appendChild(document.createTextNode(String(c)));
    });
    return node;
  }

  const frag = (children) => appendAll(document.createDocumentFragment(), children);

  const clear = (node) => { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };

  /* ---------- escaping ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const escAttr = esc;

  /* ---------- data ---------- */
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isArr = Array.isArray;

  function clone(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(clone);
    const o = {};
    for (const k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = clone(v[k]);
    return o;
  }

  function get(obj, path, dflt) {
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return dflt;
      cur = cur[p];
    }
    return cur === undefined ? dflt : cur;
  }

  function set(obj, path, val) {
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!isObj(cur[p]) && !Array.isArray(cur[p])) cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = val;
    return obj;
  }

  /**
   * Ensure the container object at `path` exists (creating intermediates) and
   * return that container. Unlike set(), this returns the NESTED node, which is
   * what callers need when they want to edit one sub-object in place.
   */
  function ensure(obj, path) {
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let cur = obj;
    for (const p of parts) {
      if (!isObj(cur[p])) cur[p] = {};
      cur = cur[p];
    }
    return cur;
  }

  /** Remove a key by path; prunes empty parent objects that we created. */
  function unset(obj, path) {
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!isObj(cur[p]) && !Array.isArray(cur[p])) return false;
      cur = cur[p];
    }
    if (!(parts[parts.length - 1] in cur)) return false;
    delete cur[parts[parts.length - 1]];
    return true;
  }

  /** True when the path holds undefined / null / empty-string / empty-array / empty-object. */
  function isEmptyish(v) {
    if (v === undefined || v === null || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (isObj(v)) return Object.keys(v).length === 0;
    return false;
  }

  const uid = (() => { let n = 0; return (p) => `${p || 'id'}-${++n}-${Date.now().toString(36)}`; })();

  const slug = (s) => String(s || '')
    .trim().toLowerCase()
    .replace(/[^\w\s.\-\/]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const kebab = (s) => slug(s).replace(/\//g, '-');

  /**
   * Set a path to `value`, or remove it.
   * `enabled` defaults to true: pass false to force removal. A value that is
   * empty (undefined / null / '' / [] / {}) is treated as "not set".
   */
  function setOrDelete(obj, path, value, enabled) {
    if (enabled === undefined) enabled = true;
    if (enabled && !isEmptyish(value)) set(obj, path, value);
    else unset(obj, path);
    return obj;
  }

  /* ---------- formatting ---------- */
  function bytes(n) {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function timeAgo(ts) {
    const d = Date.now() - ts;
    if (d < 60000) return 'الآن';
    if (d < 3600000) return Math.floor(d / 60000) + ' دقيقة';
    if (d < 86400000) return Math.floor(d / 3600000) + ' ساعة';
    return Math.floor(d / 86400000) + ' يوم';
  }
  function debounce(fn, ms) {
    let t;
    return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); };
  }

  /* ---------- toasts ---------- */
  // Delegates to the feedback layer so every call site gets the animated design.
  function toast(kind, msg, ms) {
    if (NS.fx) return NS.fx.toast(kind, msg, ms);
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = el('div', { class: 'toast ' + (kind || 'info') }, [
      el('span', { class: 't-icon', text: (kind === 'ok' ? '✓' : kind === 'err' ? '✕' : kind === 'warn' ? '!' : 'i') }),
      el('span', { text: msg })
    ]);
    box.appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
  }

  /* ---------- modal ---------- */
  let modalOnClose = null;
  function modal(opts) {
    const bd = $('#modalBackdrop'), body = $('#modalBody'), foot = $('#modalFoot');
    $('#modalTitle').textContent = opts.title || '';
    clear(body); clear(foot);
    const bdEl = $('.modal', bd);
    bdEl.classList.toggle('wide', !!opts.wide);
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    (opts.buttons || [{ label: 'إغلاق', kind: 'ghost', close: true }]).forEach(b => {
      foot.appendChild(el('button', {
        class: 'btn ' + (b.kind || 'ghost'),
        onclick: () => { if (b.onClick) { if (b.onClick(body) === false) return; } if (b.close !== false) closeModal(); }
      }, b.label));
    });
    bd.hidden = false;
    modalOnClose = opts.onClose || null;
    const firstInput = body.querySelector('input, textarea, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 40);
    return body;
  }
  function closeModal() {
    const bd = $('#modalBackdrop');
    if (!bd || bd.hidden) return;
    bd.hidden = true;
    if (modalOnClose) { const f = modalOnClose; modalOnClose = null; f(); }
  }
  function confirmBox(title, message, confirmLabel, kind) {
    return new Promise(resolve => {
      let done = false;
      modal({
        title,
        body: el('p', { class: 'dim', text: message, style: { margin: 0, lineHeight: '1.7' } }),
        buttons: [
          { label: 'إلغاء', kind: 'ghost', onClick: () => { done = true; resolve(false); } },
          { label: confirmLabel || 'تأكيد', kind: kind || 'danger', onClick: () => { done = true; resolve(true); } }
        ],
        onClose: () => { if (!done) resolve(false); }
      });
    });
  }
  function promptBox(title, label, value, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      let done = false;
      const input = el(opts.multiline ? 'textarea' : 'input', {
        class: opts.mono ? 'mono' : '', value: value == null ? '' : value,
        placeholder: opts.placeholder || '', rows: opts.rows || 4
      });
      if (!opts.multiline) input.type = 'text';
      const body = el('div', { class: 'field' }, [el('label', { text: label }), input]);
      modal({
        title,
        body,
        buttons: [
          { label: 'إلغاء', kind: 'ghost', onClick: () => { done = true; resolve(null); } },
          { label: opts.confirmLabel || 'حفظ', kind: 'primary', onClick: () => { done = true; resolve(input.value); } }
        ],
        onClose: () => { if (!done) resolve(null); }
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); done = true; resolve(input.value); closeModal(); }
      });
    });
  }

  /* ---------- file download ---------- */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------- tiny markdown renderer (preview only) ---------- */
  function mdToHtml(src) {
    if (!src) return '<span class="muted small">(فارغ)</span>';
    let s = esc(src);
    const blocks = [];
    s = s.replace(/```([\s\S]*?)```/g, (m, code) => {
      blocks.push('<pre><code>' + code.replace(/^\n/, '') + '</code></pre>');
      return ' B' + (blocks.length - 1) + ' ';
    });
    s = s.replace(/^###### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^##### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^#### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h2>$1</h2>')
      .replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^[-*] (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
      .replace(/^(\d+)\. (.*)$/gm, '<li>$2</li>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
    s = '<p>' + s + '</p>';
    s = s.replace(/ B(\d+) /g, (m, i) => blocks[+i]);
    return s;
  }

  /* ---------- exported ---------- */
  NS.u = {
    $, $$, el, frag, clear, esc, escAttr,
    isObj, isArr, clone, get, set, ensure, unset, isEmptyish, uid, slug, kebab, setOrDelete,
    bytes, timeAgo, debounce,
    toast, modal, closeModal, confirmBox, promptBox,
    download, mdToHtml
  };
})(window.OCM);