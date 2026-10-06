/* ============================================================
   lang.js — Arabic / English language toggle
   ============================================================
   Strings live here in flat dicts (AR + EN). Views that need to be
   translatable go through `t(key)`. Static English technical terms
   inside tooltips, code blocks and `code` tags stay in English on
   purpose — those are technical identifiers the user types verbatim.

   The page keeps `lang="ar" dir="rtl"` for the UI; switching the
   language flips both attributes and the strings that come from t(). */
(function (NS) {
  'use strict';

  const KEY = 'ocm.lang';
  const LOCALES = ['ar', 'en'];

  const STRINGS = {
    /* generic */
    'app.title':           { ar: 'لوحة تحكم إعدادات OpenCode V2 — تعمل محلياً بدون سيرفر', en: 'OpenCode Manager — local config UI for OpenCode V2' },
    'brand.sub':           { ar: 'لوحة تحكم إعدادات OpenCode V2 — تعمل محلياً بدون سيرفر', en: 'Local config UI for OpenCode V2 — no server' },
    'btn.save':            { ar: 'حفظ', en: 'Save' },
    'btn.undo':            { ar: 'تراجع', en: 'Undo' },
    'btn.redo':            { ar: 'إعادة', en: 'Redo' },
    'btn.export':          { ar: 'تصدير', en: 'Export' },
    'btn.connect':         { ar: 'فتح مجلد', en: 'Open folder' },
    'search.nav':          { ar: 'بحث في الأقسام…', en: 'Search sections…' },
    'welcome.h1':          { ar: 'اربط مجلداتك', en: 'Connect your folders' },
    'welcome.p':           { ar: 'هذه الأداة تقرأ ملفات إعدادات OpenCode مباشرة على جهازك وتكتب تعديلاتك إليها. لا يوجد سيرفر ولا تُرسل أي بيانات إلى الإنترنت.', en: 'This tool reads your OpenCode config files directly from disk and writes your edits back. No server, no data leaves your machine.' },
    'welcome.global':      { ar: 'الإعدادات العامة', en: 'Global settings' },
    'welcome.global.p':    { ar: 'مجلد <code>~/.config/opencode</code> — إعدادات تسري على <b>كل</b> مشاريعك على هذا الجهاز.', en: 'Folder <code>~/.config/opencode</code> — settings that apply to <b>every</b> project on this machine.' },
    'welcome.connect.btn': { ar: 'اختيار مجلد الإعدادات العامة', en: 'Choose global config folder' },
    'welcome.projects':    { ar: 'مجلدات المشاريع', en: 'Project folders' },
    'welcome.projects.p':  { ar: 'مجلد واحد أو أكثر يحتوي مشاريعك. تفحص الأداة كل مجلد فرعي وتعرض ما فيه إعداد OpenCode.', en: 'One or more folders containing your projects. The tool scans every subfolder and shows any OpenCode config it finds.' },
    'welcome.addprojects': { ar: 'إضافة مجلد مشاريع', en: 'Add projects folder' },
    'welcome.li1':         { ar: 'بعد المنحة تتكرر تلقائياً في كل فتح: تُقرأ الإعدادات العامة، وتُفحص المشاريع، وتُحدَّث فوراً.', en: 'After granting access, the tool re-reads every time: global settings are loaded, projects are scanned, everything stays fresh.' },
    'welcome.li2':         { ar: 'اضغط أي مشروع من القائمة لعرض إعداداته وتعديلها.', en: 'Click any project in the sidebar to view and edit its settings.' },
    'welcome.li3':         { ar: 'التعديل داخل مشروع يبقى فيه فقط ولا يمسّ الإعدادات العامة.', en: 'Edits inside a project stay inside it — they do not touch global settings.' },
    'welcome.li4':         { ar: 'كل حفظ يكتب نسخة <code>.backup</code> بجانب الملف.', en: 'Every save writes a <code>.backup</code> copy next to the file.' },
    'welcome.fs.warn':     { ar: '⚠ متصفحك لا يدعم الوصول للقرص. استخدم Chrome أو Edge.', en: '⚠ Your browser does not support disk access. Use Chrome or Edge.' },
    'welcome.fs.ok':       { ar: 'امنح الإذن مرة واحدة لمجلد الإعدادات العامة ومجلدات مشاريعك، وبعدها تُقرأ وتُحفظ التغييرات تلقائياً على القرص.', en: 'Grant access once for the global folder and your project folders — after that changes are read and written automatically.' },
    'scope.notLoaded':     { ar: 'لم يتم تحميل ملف', en: 'No file loaded' },
    'scope.global':        { ar: 'الإعدادات العامة', en: 'Global settings' },
    'sidebar.empty':        { ar: '— لا مشاريع —', en: '— no projects —' },
    'toast.saved':         { ar: 'تم الحفظ', en: 'Saved' },
    'toast.undo':          { ar: 'تراجع', en: 'Undo' },
    'toast.redo':          { ar: 'إعادة', en: 'Redo' }
  };

  function current() {
    return localStorage.getItem(KEY) || 'ar';
  }

  function set(loc) {
    const v = LOCALES.includes(loc) ? loc : 'ar';
    localStorage.setItem(KEY, v);
    apply(v);
  }

  function apply(loc) {
    const html = document.documentElement;
    html.lang = loc;
    html.dir = loc === 'ar' ? 'rtl' : 'ltr';
    /* When the page goes LTR, some RTL-only flexes break. The CSS already
       handles most cases via [dir=ltr] overrides; we just need to flip the
       body class so any extra selectors can hook in. */
    document.body.classList.toggle('lang-en', loc === 'en');
    document.body.classList.toggle('lang-ar', loc === 'ar');
    applyDom();
  }

  /** Walk the document and swap textContent / placeholder for any element
      marked with data-i18n / data-i18n-ph. Done once per locale change; static
      Arabic text is preserved as the source of truth in HTML. */
  function applyDom() {
    const loc = current();
    const setOne = (n) => {
      const key = n.dataset.i18n;
      if (!key) return;
      const e = STRINGS[key];
      if (!e) return;
      const txt = e[loc] || e.ar;
      if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') {
        /* placeholder handled by data-i18n-ph separately */
      } else {
        n.textContent = txt;
      }
    };
    document.querySelectorAll('[data-i18n]').forEach(setOne);
    document.querySelectorAll('[data-i18n-ph]').forEach(n => {
      const key = n.dataset.i18nPh;
      const e = STRINGS[key];
      if (!e) return;
      n.placeholder = e[loc] || e.ar;
    });
  }

  function toggle() {
    set(current() === 'ar' ? 'en' : 'ar');
    NS.fx && NS.fx.toast('ok', current() === 'ar' ? 'العربية' : 'English', 1500);
  }

  /** Look up a translation. Falls back to Arabic text when key is unknown,
      and to the key itself when both are missing. */
  function t(key) {
    const loc = current();
    const entry = STRINGS[key];
    if (entry) return entry[loc] || entry.ar || key;
    return key;
  }

  function init() {
    apply(current());
  }

  NS.lang = { current, set, apply, applyDom, toggle, t, init, LOCALES };
})(window.OCM);