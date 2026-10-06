/* ============================================================
   osinfo.js — what a web page can honestly know about the machine

   A page cannot read the username or any filesystem path, and it cannot
   list drives. What it CAN do is identify the OS and therefore the shape
   of the standard locations — which is enough to tell the user exactly
   where their settings live and offer one-click picks.
   ============================================================ */
(function (NS) {
  'use strict';

  const KEY = 'oc-username';

  function detect() {
    const ua = navigator.userAgent || '';
    const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';

    let os = 'unknown';
    if (/Win/i.test(plat) || /Windows/i.test(ua)) os = 'windows';
    else if (/Mac/i.test(plat) || /Macintosh/i.test(ua)) os = 'macos';
    else if (/Linux/i.test(plat) || /Linux/i.test(ua)) os = 'linux';

    return {
      os,
      arch: /arm64|aarch64/i.test(ua) ? 'arm64' : /x86_64|x64|win64|amd64/i.test(ua) ? 'x64' : '',
      browser: (() => {
        if (/Edg\//.test(ua)) return 'Edge';
        if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
        if (/Firefox\//.test(ua)) return 'Firefox';
        if (/Chrome\//.test(ua)) return 'Chrome';
        if (/Safari\//.test(ua)) return 'Safari';
        return 'متصفح غير معروف';
      })(),
      supportsDirectDisk: typeof window.showDirectoryPicker === 'function' && window.isSecureContext
    };
  }

  const OS_LABEL = { windows: 'Windows', macos: 'macOS', linux: 'Linux', unknown: 'نظام غير معروف' };

  /** remembered username — only ever one the user typed themselves */
  function savedUsername() {
    try { return localStorage.getItem(KEY) || ''; } catch (_) { return ''; }
  }
  function saveUsername(name) {
    try {
      if (name) localStorage.setItem(KEY, name);
      else localStorage.removeItem(KEY);
    } catch (_) { }
  }

  /**
   * Where OpenCode keeps its files. `~` is shown literally because the page
   * cannot resolve it — that is exactly why the UI then offers a pick button.
   */
  function expectedPaths() {
    const { os } = detect();
    const user = savedUsername();

    const globalConfig = os === 'windows'
      ? 'C:\\Users\\' + (user || '<اسم المستخدم>') + '\\.config\\opencode'
      : '~/.config/opencode';

    const dataDir = os === 'windows'
      ? 'C:\\Users\\' + (user || '<اسم المستخدم>') + '\\.local\\share\\opencode'
      : '~/.local/share/opencode';

    // Folder names that commonly hold source projects, per platform.
    const common = os === 'windows'
      ? ['projects', 'source', 'repos', 'dev', 'code', 'work', 'Documents\\Projects', 'Desktop']
      : os === 'macos'
        ? ['Developer', 'Projects', 'Code', 'dev', 'src', 'work', 'Documents', 'Desktop']
        : ['projects', 'code', 'dev', 'src', 'git', 'work', 'workspace', 'repos', 'Documents'];

    const projectRoots = common.map(name => {
      if (os === 'windows') {
        return name.includes('\\')
          ? 'C:\\Users\\' + (user || '<اسم المستخدم>') + '\\' + name.replace('/', '\\')
          : 'C:\\Users\\' + (user || '<اسم المستخدم>') + '\\' + name;
      }
      return '~/' + name;
    });

    return { os, osLabel: OS_LABEL[os] || OS_LABEL.unknown, user, globalConfig, dataDir, projectRoots };
  }

  /** Human sentence describing what we can and cannot discover. */
  function explain() {
    const p = expectedPaths();
    const bits = [];
    bits.push('النظام: ' + p.osLabel);
    if (p.user) bits.push('المستخدم: ' + p.user);
    bits.push(p.supportsDirectDisk === false
      ? '⚠ هذا المتصفح لا يقرأ القرص مباشرة — استخدم التصدير'
      : 'تم منح الصلاحية');
    return bits.join(' · ');
  }

  NS.OS = { detect, expectedPaths, savedUsername, saveUsername, explain, OS_LABEL };
})(window.OCM);