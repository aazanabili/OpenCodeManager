/* ============================================================
   theme.js — light/dark theme switcher
   ============================================================ */
(function (NS) {
  'use strict';

  const KEY = 'ocm.theme';
  const MODES = ['dark', 'light', 'auto'];

  function current() {
    return localStorage.getItem(KEY) || 'dark';
  }

  /** Apply the chosen theme to <html data-theme>. "auto" follows the OS. */
  function apply(mode) {
    const m = MODES.includes(mode) ? mode : 'dark';
    document.documentElement.dataset.theme = m;
    if (m === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.effective = prefersDark ? 'dark' : 'light';
    } else {
      document.documentElement.dataset.effective = m;
    }
  }

  function set(mode) {
    localStorage.setItem(KEY, mode);
    apply(mode);
    NS.fx && NS.fx.toast('ok', 'تم التبديل إلى: ' + (mode === 'light' ? 'نهاري' : mode === 'dark' ? 'ليلي' : 'تلقائي'), 1500);
  }

  function cycle() {
    const i = MODES.indexOf(current());
    const next = MODES[(i + 1) % MODES.length];
    set(next);
  }

  function init() {
    apply(current());
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (current() === 'auto') apply('auto');
    });
  }

  NS.theme = { current, set, apply, cycle, init, MODES };
})(window.OCM);