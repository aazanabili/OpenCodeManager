/* Headless test for the JSONC engine (no DOM required). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
ctx.window.OCM = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'util.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'jsonc.js'), 'utf8'), ctx);
const J = ctx.window.OCM.jsonc;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

console.log('\n== parse basics ==');
let r = J.parse('{"a":1,"b":[1,2,3]}');
ok('simple object', !r.error && r.value.a === 1 && r.value.b[2] === 3, JSON.stringify(r.error));

r = J.parse('{\n  // a comment\n  "model": "anthropic/claude", // trailing\n}');
ok('comments + trailing comma', !r.error && r.value.model === 'anthropic/claude', JSON.stringify(r.error));
ok('captured 2 comments', r.comments.length === 2, 'got ' + r.comments.length);

r = J.parse('{ /* block */ "x": true, "y": [ /* mid */ 1, 2, ], }');
ok('block comments in object and array', !r.error && r.value.x === true && r.value.y.length === 2, JSON.stringify(r.error));

r = J.parse('{ "s": "he said \\"hi\\" // not a comment", "t": "c:\\\\path" }');
ok('escaped quotes and backslashes', !r.error && r.value.s === 'he said "hi" // not a comment' && r.value.t === 'c:\\path', JSON.stringify(r.error));

r = J.parse('{"emoji":"✅ عربي 🎉"}');
ok('unicode round-trip', !r.error && r.value.emoji === '✅ عربي 🎉');

r = J.parse('{ bad json }');
ok('reports error with line', !!r.error && typeof r.error.line === 'number', JSON.stringify(r.error));
r = J.parse('{"a":1} trailing');
ok('rejects trailing garbage', !!r.error);
r = J.parse('');
ok('empty file -> empty object', !r.error && JSON.stringify(r.value) === '{}');

console.log('\n== stringify preserves comments ==');
const src = `{
  "$schema": "https://opencode.ai/config.json",

  // Default model for every session.
  "model": "anthropic/claude-sonnet-4-5", // keep this

  "agents": {
    // Read-only reviewer.
    "reviewer": {
      "mode": "subagent",
      "permissions": [
        { "action": "edit", "resource": "*", "effect": "deny" },
      ],
    },
  },
}
`;
r = J.parse(src);
ok('parsed sample', !r.error, JSON.stringify(r.error));
const out = J.stringify(r.value, r.comments, { indent: 2 });
ok('keeps leading comment above model', /\/\/ Default model for every session\.\n\s*"model"/.test(out), out);
ok('keeps trailing comment on model', /"model": "anthropic\/claude-sonnet-4-5", \/\/ keep this/.test(out), out);
ok('keeps nested comment above reviewer', /\/\/ Read-only reviewer\.\n\s*"reviewer"/.test(out), out);
ok('keeps blank line before model', /\n\n\s*\/\/ Default model/.test(out), out);

console.log('\n== stringify re-parses to the same value ==');
const r2 = J.parse(out);
ok('re-parse has no error', !r2.error, JSON.stringify(r2.error));
ok('value deep-equals original', JSON.stringify(r2.value) === JSON.stringify(r.value),
  '\n  got: ' + JSON.stringify(r2.value) + '\n  exp: ' + JSON.stringify(r.value));
const out2 = J.stringify(r2.value, r2.comments, { indent: 2 });
ok('second round-trip is stable (idempotent)', out2 === out, '\n---1---\n' + out + '\n---2---\n' + out2);

console.log('\n== edits keep comments ==');
const r3 = J.parse(src);
r3.value.model = 'openai/gpt-5';
r3.value.agents.planner = { mode: 'primary' };
const out3 = J.stringify(r3.value, r3.comments, { indent: 2 });
ok('comment survives an edit', out3.includes('// Default model for every session.'), out3);
ok('new key added', out3.includes('"planner"'));
ok('value updated', out3.includes('"openai/gpt-5"'));
const r4 = J.parse(out3);
ok('edited output re-parses', !r4.error && r4.value.model === 'openai/gpt-5');

console.log('\n== orphan comments are never dropped ==');
const r5 = J.parse('{\n  // kept note\n  "a": 1\n}');
delete r5.value.a;
const out5 = J.stringify(r5.value, r5.comments, { indent: 2 });
ok('orphan comment appended', out5.includes('// kept note'), out5);

console.log('\n== deep paths / nested arrays ==');
const deep = '{\n  // top\n  "experimental": {\n    // policies\n    "policies": [\n      {\n        // first\n        "action": "permission",\n        "resource": "shell:rm *",\n        "effect": "deny",\n      },\n    ],\n  },\n}';
const r6 = J.parse(deep);
ok('deep parse', !r6.error && r6.value.experimental.policies[0].effect === 'deny', JSON.stringify(r6.error));
const out6 = J.stringify(r6.value, r6.comments, { indent: 2 });
ok('deep comment "// top"', out6.includes('// top'), out6);
ok('deep comment "// policies"', out6.includes('// policies'), out6);
ok('deep comment "// first"', out6.includes('// first'), out6);
ok('deep re-parse', !J.parse(out6).error);
ok('deep idempotent', J.stringify(J.parse(out6).value, J.parse(out6).comments, { indent: 2 }) === out6);

console.log('\n== frontmatter ==');
const fm = J.parseFrontmatter('---\ndescription: Reviews changes\nmode: subagent\nsteps: 8\nhidden: true\npermissions:\n  - action: edit\n    resource: "*"\n    effect: deny\n---\n\nBody text\nmore body\n');
ok('frontmatter fields', fm.data.description === 'Reviews changes' && fm.data.mode === 'subagent' && fm.data.steps === 8 && fm.data.hidden === true, JSON.stringify(fm.data));
ok('frontmatter list', Array.isArray(fm.data.permissions) && fm.data.permissions.length === 1 && fm.data.permissions[0].action === 'edit', JSON.stringify(fm.data.permissions));
ok('frontmatter body', fm.body.trim() === 'Body text\nmore body', JSON.stringify(fm.body));

const comp = J.composeFile({ description: 'He said "hi"', mode: 'subagent', permissions: [{ action: 'edit', resource: '*', effect: 'deny' }] }, 'Do the thing.\n');
const back = J.parseFrontmatter(comp);
ok('compose round-trip description', back.data.description === 'He said "hi"', JSON.stringify(back.data));
ok('compose round-trip permissions', back.data.permissions[0].effect === 'deny', JSON.stringify(back.data.permissions));
ok('compose round-trip body', back.body.trim() === 'Do the thing.', JSON.stringify(back.body));

console.log('\n== full opencode-style round trip ==');
const real = `{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "default_agent": "build",
  // Ordered rules; last match wins.
  "permissions": [
    { "action": "shell", "resource": "*", "effect": "ask" },
    { "action": "shell", "resource": "git push *", "effect": "deny" },
  ],
  "mcp": { "servers": { "ctx7": { "type": "remote", "url": "https://mcp.context7.com/mcp" } } },
  "cli-guard": "none",
}`;
const rr = J.parse(real);
ok('real config parses', !rr.error, JSON.stringify(rr.error));
const rt = J.stringify(rr.value, rr.comments, { indent: 2 });
const rr2 = J.parse(rt);
ok('real config round-trips', !rr2.error && JSON.stringify(rr2.value) === JSON.stringify(rr.value));
ok('real config keeps comment', rt.includes('// Ordered rules; last match wins.'));
ok('real config keeps escaped string', rr2.value['cli-guard'] === 'none');

console.log('\n== error reporting ==');
const bad = J.parse('{\n  "a": 1,\n  "b": ,\n}');
ok('bad value reports correct line', !!bad.error && bad.error.line === 3, 'line=' + (bad.error && bad.error.line));

console.log('\n' + '='.repeat(46));
console.log('  pass: ' + pass + '   fail: ' + fail);
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);