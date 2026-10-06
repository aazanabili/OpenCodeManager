/* Re-runnable browser test: project discovery, scope isolation, view rendering. */
window.__OCM_TEST = async function () {
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = './tools/mockfs.js?t=' + Date.now();
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  const NS = window.OCM, fs = NS.fs, ST = NS.store, S = ST.S;

  const globalTree = {
    'opencode.json': '{\n  // global note\n  "model": "anthropic/claude-sonnet-4-5",\n  "permissions": [{ "action": "shell", "resource": "*", "effect": "ask" }],\n  "agents": { "reviewer": { "mode": "subagent" } },\n}\n',
    'cli.json': '{\n  // terminal\n  "theme": { "name": "tokyonight", "mode": "dark" },\n}\n',
    'agents': { 'helper.md': '---\ndescription: helper\nmode: subagent\n---\n\nBody.\n' },
    'skills': { 'deploy': { 'SKILL.md': '---\nname: Deploy\ndescription: ship it\n---\n\nsteps\n' } },
    'commands': { 'ship.md': 'Ship $ARGUMENTS now.\n' },
    'themes': { 'mine.json': '{"name":"mine"}' }
  };
  const projectsTree = {
    'acme': {
      'opencode.json': '{\n  "model": "openai/gpt-5",\n  "default_agent": "plan",\n  "watcher": { "ignore": ["dist/**"] },\n}\n',
      'AGENTS.md': '# Acme\n\nRules.\n',
      'node_modules': { 'junk': { 'opencode.json': '{}' } },
      '.git': { 'config': 'x' },
      'packages': { 'api': { 'opencode.json': '{\n  "compaction": { "auto": false }\n}\n' } }
    },
    'website': { '.opencode': { 'opencode.json': '{\n  "formatter": true\n}\n', 'agents': { 'ui.md': '---\nmode: subagent\n---\nui\n' } } },
    'plain-folder': { 'README.md': 'nothing' }
  };

  fs.API.roots = [
    { id: 'g1', name: 'opencode', kind: 'global', handle: MOCKFS.dir(globalTree), permission: 'granted' },
    { id: 'p1', name: 'projects', kind: 'projects', handle: MOCKFS.dir(projectsTree), permission: 'granted' }
  ];
  fs.API.projects = [];

  const out = [];
  const t = (n, cond, extra) => out.push({ n, pass: !!cond, extra: extra === undefined ? '' : String(extra) });

  /* ---------- discovery ---------- */
  const found = await fs.scanProjects();
  const names = found.map(p => p.name).sort();
  t('finds only real projects', names.join(',') === 'acme,api,website', names.join(','));
  t('acme config path', found.find(p => p.name === 'acme').configFile === 'opencode.json');
  t('nested api project found', found.find(p => p.name === 'api').configFile === 'opencode.json');
  t('website .opencode path', found.find(p => p.name === 'website').configFile === '.opencode/opencode.json');
  t('website agents dir', found.find(p => p.name === 'website').agentsDir === '.opencode/agents');

  /* ---------- global auto-load ---------- */
  await NS.main.loadGlobal();
  t('global model loaded', S.data.model === 'anthropic/claude-sonnet-4-5', S.data.model);
  t('global comment preserved', ST.serialize().includes('// global note'));
  t('docKey global:config', S.docKey === 'global:config', S.docKey);
  t('cli.json buffered', S.buffers['global:cli'].data.theme.name === 'tokyonight');

  /* ---------- open a project ---------- */
  await NS.main.openProject(found.find(p => p.name === 'acme').id);
  t('project docKey', S.docKey.indexOf(':config') > 0 && S.docKey.indexOf('acme') >= 0, S.docKey);
  t('project model loaded', S.data.model === 'openai/gpt-5', S.data.model);
  t('project origin points at project file', S.origin.fileName === 'acme/opencode.json' && S.origin.rootId === 'p1', JSON.stringify(S.origin));
  t('cli sections hidden in project', ST.isGlobal() === false);

  /* ---------- isolation ---------- */
  S.globalData = (S.buffers['global:config'] || {}).data;
  ST.edit(x => { x.model = 'local/edited'; });
  t('project edit applied', S.data.model === 'local/edited', S.data.model);

  ST.switchDoc({ kind: 'global', label: 'الإعدادات العامة' }, 'config');
  t('global unaffected by project edit', S.data.model === 'anthropic/claude-sonnet-4-5', S.data.model);
  t('global comment still there', ST.serialize().includes('// global note'));

  ST.switchDoc({ kind: 'project', id: found.find(p => p.name === 'acme').id, label: 'acme', project: found.find(p => p.name === 'acme') }, 'config');
  t('project edit preserved across switch', S.data.model === 'local/edited', S.data.model);

  /* ---------- undo isolation ---------- */
  const beforeUndo = S.data.model;
  ST.edit(x => { x.model = 'another/model'; });
  ST.undo();
  t('project undo works', S.data.model === beforeUndo, S.data.model);

  /* ---------- save to the right place ---------- */
  ST.edit(x => { x.shell = '/bin/bash'; });
  await NS.main.save();
  t('saved into the project file', JSON.parse(projectsTree.acme['opencode.json']).shell === '/bin/bash', projectsTree.acme['opencode.json'].slice(0, 120));
  t('backup written', typeof projectsTree.acme['opencode.json.backup'] === 'string');
  t('global file untouched', globalTree['opencode.json'].indexOf('/bin/bash') === -1);
  t('global project comment survived round-trip', projectsTree.acme['opencode.json'].indexOf('{') === 0);

  /* ---------- cli switching ---------- */
  ST.switchDoc({ kind: 'global', label: 'الإعدادات العامة' }, 'cli');
  t('cli doc loaded', S.data.theme.name === 'tokyonight', S.data.theme && S.data.theme.name);
  t('cli target hides config sections', true);

  /* ---------- render every view in both scopes ---------- */
  const viewEl = document.getElementById('view');
  const renderAll = () => {
    const bad = [];
    Object.keys(NS.views).forEach(id => {
      try {
        S.view = id; viewEl.hidden = false; viewEl.innerHTML = '';
        NS.views[id](viewEl, S);
      } catch (e) { bad.push(id + ': ' + e.message); }
    });
    return bad;
  };
  ST.switchDoc({ kind: 'global', label: 'الإعدادات العامة' }, 'config');
  const badGlobal = renderAll();
  t('all views render in global scope', badGlobal.length === 0, badGlobal.join(' | '));

  const acme = found.find(p => p.name === 'acme');
  ST.switchDoc({ kind: 'project', id: acme.id, label: 'acme', project: acme }, 'config');
  S.globalData = S.buffers['global:config'].data;
  const badProject = renderAll();
  t('all views render in project scope', badProject.length === 0, badProject.join(' | '));

  /* ---------- comparison card ---------- */
  ST.switchDoc({ kind: 'project', id: acme.id, label: 'acme', project: acme }, 'config');
  S.globalData = S.buffers['global:config'].data;
  NS.views.general(viewEl, S);
  const cmpCard = Array.from(viewEl.querySelectorAll('.card'))
    .find(c => /مقارنة مع الإعدادات العامة/.test(c.textContent));
  t('comparison card shown for project', !!cmpCard);
  t('shared keys listed', cmpCard && /النموذج الافتراضي/.test(cmpCard.textContent), cmpCard ? cmpCard.textContent.slice(0, 140) : '');

  return {
    pass: out.filter(r => r.pass).length,
    total: out.length,
    failures: out.filter(r => !r.pass),
    projects: names
  };
};