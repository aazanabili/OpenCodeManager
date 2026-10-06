/* ============================================================
   fx.js — feedback layer: toasts, save states, loading, flashes
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u;
  const { el, $ } = u;

  /* ---------------- toasts ---------------- */
  const ICONS = {
    ok: '✓', err: '✕', warn: '!', info: 'i',
    save: '✓', done: '✓', undo: '↺', redo: '↻', scan: '⌕'
  };
  const TITLES = {
    ok: 'تم', err: 'خطأ', warn: 'تنبيه', info: 'معلومة',
    save: 'تم الحفظ', done: 'اكتمل', undo: 'تراجع', redo: 'إعادة', scan: 'جارٍ الفحص'
  };

  /**
   * toast(kind, msg, ms, opts)
   * opts: { title, progress, icon }
   */
  function toast(kind, msg, ms, opts) {
    opts = opts || {};
    const box = $('#toasts');
    if (!box) return null;
    const dur = ms == null ? 3400 : ms;

    const node = el('div', { class: 'toast ' + kind, role: 'status' }, [
      el('span', { class: 't-icon', text: opts.icon || ICONS[kind] || 'i' }),
      el('div', { class: 't-body' }, [
        el('div', { class: 't-title', text: opts.title || TITLES[kind] || '' }),
        msg ? el('div', { class: 't-msg', text: msg }) : null
      ])
    ]);
    if (opts.progress) {
      node.querySelector('.t-bar').style.animationDuration = dur + 'ms';
      node.appendChild(el('div', { class: 't-bar' }));
    }
    box.appendChild(node);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      node.classList.add('out');
      setTimeout(() => node.remove(), 280);
    };
    const timer = setTimeout(close, dur);
    node.addEventListener('click', () => { clearTimeout(timer); close(); });
    node.close = close;
    return node;
  }

  const ok = (m, ms) => toast('ok', m, ms);
  const err = (m, ms) => toast('err', m, ms || 5200);
  const warn = (m, ms) => toast('warn', m, ms || 4800);
  const info = (m, ms) => toast('info', m, ms);

  /* ---------------- save button state ---------------- */
  async function saveState(phase) {
    const btn = $('#btnSave');
    if (!btn) return;
    if (phase === 'saving') {
      btn.classList.add('saving');
      btn.classList.remove('saved');
      btn.innerHTML = '<span>يحفظ…</span>';
    } else if (phase === 'saved') {
      btn.classList.remove('saving');
      btn.classList.add('saved');
      btn.innerHTML = '<span>محفوظ</span>';
      flashChip();
    } else {
      btn.classList.remove('saving', 'saved');
      btn.innerHTML = 'حفظ <kbd>Ctrl+S</kbd>';
    }
  }

  /** A green pulse on the scope chip when a write lands on disk. */
  function flashChip() {
    const chip = $('#scopeChip');
    if (!chip) return;
    chip.classList.remove('live', 'dirty');
    chip.classList.add('saved-flash');
    setTimeout(() => {
      chip.classList.remove('saved-flash');
      ST_sync();
    }, 900);
  }
  function ST_sync() {
    const S = window.OCM.store && window.OCM.store.S;
    if (S) window.OCM.store.updateScopeChip();
  }

  /* ---------------- top loading bar ---------------- */
  let bar = null;
  function loading(on, label) {
    if (on) {
      if (!bar) {
        bar = el('div', { class: 'loading-bar' });
        document.body.appendChild(bar);
      }
      const note = $('#scanNote');
      if (note && label) note.textContent = label;
    } else if (bar) {
      bar.remove(); bar = null;
      const note = $('#scanNote');
      if (note) note.remove();
    }
  }

  /** Inline note with a spinner; pass null to clear it. */
  function scanNote(text) {
    const old = $('#scanNote');
    if (old) old.remove();
    if (!text) return null;
    const node = el('div', { class: 'scan-note', id: 'scanNote' }, [
      el('span', { class: 'spinner' }),
      el('span', { text: text })
    ]);
    const host = $('#view') || document.querySelector('.main');
    if (host) host.insertBefore(node, host.firstChild);
    return node;
  }

  /* ---------------- element flash ---------------- */
  function flash(node, kind) {
    if (!node) return;
    node.classList.remove('flash-ok', 'flash-warn');
    void node.offsetWidth;                 // restart the animation
    node.classList.add(kind === 'warn' ? 'flash-warn' : 'flash-ok');
    setTimeout(() => node.classList.remove('flash-ok', 'flash-warn'), 900);
  }

  /** Briefly swap a button's label — used for copy / toggle confirmations. */
  function swapLabel(btn, text, ms) {
    if (!btn) return;
    if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent;
    btn.textContent = text;
    btn.classList.add('ok');
    setTimeout(() => {
      btn.textContent = btn.dataset.origLabel;
      btn.classList.remove('ok');
      delete btn.dataset.origLabel;
    }, ms || 1400);
  }

  /* ---------------- skeletons ---------------- */
  function skeletonCard(lines) {
    const n = lines || 4;
    const card = el('div', { class: 'card' }, el('div', { class: 'card-body' },
      Array.from({ length: n }, (_, i) =>
        el('div', { class: 'skeleton sk-line', style: { width: (100 - i * 12) + '%' } }))));
    return card;
  }

  /* ---------------- undo / redo feedback ---------------- */
  function historyToast(action) {
    toast(action, action === 'undo' ? 'تراجع عن آخر تعديل' : 'إعادة التعديل', 1500, {
      icon: ICONS[action] || '↺'
    });
  }

  NS.fx = { toast, ok, err, warn, info, saveState, loading, scanNote, flash, swapLabel, skeletonCard, historyToast, flashChip };
})(window.OCM);