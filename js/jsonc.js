/* ============================================================
   jsonc.js — JSON with comments & trailing commas.
   Parse keeps comment anchors so saving does NOT destroy comments
   or user formatting intent.

   Comment anchor = the object path it belongs to:
     []            → before the root value
     ["agents"]    → before the closing brace of the "agents" object
     ["agents","build"] → above the "build" key, or trailing that value
   ============================================================ */
(function (NS) {
  'use strict';

  const u = NS.u;

  function anchorKey(path) { return JSON.stringify(path); }

  /* ---------------------------------------------------------------
     parse(text) → { value, comments, error }
     comments: [{ ord, path, trailing, style, text, line }]
  --------------------------------------------------------------- */
  function parse(text) {
    let src = String(text || '');
    if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1);

    let i = 0;
    const n = src.length;
    const comments = [];
    let ord = 0;

    let lastValueLine = -1;
    let lastAnchor = [];
    let hadValue = false;

    function lineAt(pos) {
      let ln = 1;
      for (let k = 0; k < pos && k < n; k++) if (src.charCodeAt(k) === 10) ln++;
      return ln;
    }
    function colAt(pos) {
      let last = -1;
      for (let k = 0; k < pos && k < n; k++) if (src.charCodeAt(k) === 10) last = k;
      return pos - last;
    }
    function fail(msg, pos) {
      const e = new Error(msg);
      e.line = lineAt(pos == null ? i : pos);
      e.column = colAt(pos == null ? i : pos);
      e.isJsoncError = true;
      throw e;
    }

    /** Skip whitespace and collect comments. Returns them in source order. */
    function ws() {
      const collected = [];
      let nl = 0;
      for (;;) {
        while (i < n && (src[i] === ' ' || src[i] === '\t' || src[i] === '\r' || src[i] === '\n')) {
          if (src[i] === '\n') nl++;
          i++;
        }
        if (i < n && src[i] === '/' && src[i + 1] === '/') {
          const start = i, startLine = lineAt(i);
          i += 2;
          while (i < n && src[i] !== '\n') i++;
          collected.push({ style: 'line', text: src.slice(start + 2, i).replace(/\s+$/, ''), line: startLine, blankBefore: nl >= 2 });
          nl = 0;
          continue;
        }
        if (i < n && src[i] === '/' && src[i + 1] === '*') {
          const start = i, startLine = lineAt(i);
          i += 2;
          while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
          if (i >= n) fail('تعليق غير مغلق /*', start);
          const body = src.slice(start + 2, i);
          i += 2;
          collected.push({ style: 'block', text: body.replace(/^\n/, '').replace(/\n\s*$/, ''), line: startLine, blankBefore: nl >= 2 });
          nl = 0;
          continue;
        }
        break;
      }
      return collected;
    }

    const addComment = (path, cm, trailing) =>
      comments.push({
        ord: ord++, path: path.slice(), trailing: !!trailing,
        style: cm.style, text: cm.text, line: cm.line,
        blankBefore: !!cm.blankBefore
      });

    /** Comments on the same line as the value that just ended are its trailing notes. */
    function splitTrailing(list, path) {
      const trailing = [], pending = [];
      list.forEach(cm => {
        if (hadValue && lastAnchor && lastValueLine >= 0 && cm.line === lastValueLine) addComment(lastAnchor, cm, true);
        else pending.push(cm);
      });
      return pending;
    }

    function value(path) {
      const c = src[i];
      if (c === '{') return object(path);
      if (c === '[') return array(path);
      if (c === '"') return string();
      if (c === '-' || (c >= '0' && c <= '9')) return number();
      if (src.startsWith('true', i)) { i += 4; return true; }
      if (src.startsWith('false', i)) { i += 5; return false; }
      if (src.startsWith('null', i)) { i += 4; return null; }
      fail('قيمة غير متوقعة: ' + JSON.stringify(c || 'EOF'));
    }

    function string() {
      const start = i;
      i++;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '"') { i++; try { return JSON.parse(src.slice(start, i)); } catch (e) { fail('نص غير صالح', start); } }
        if (ch === '\n') fail('نص غير مغلق (سطر جديد داخل نص)', start);
        i++;
      }
      fail('نص غير مغلق', start);
    }

    function number() {
      const start = i;
      if (src[i] === '-') i++;
      while (i < n && /[0-9]/.test(src[i])) i++;
      if (src[i] === '.') { i++; while (i < n && /[0-9]/.test(src[i])) i++; }
      if (src[i] === 'e' || src[i] === 'E') { i++; if (src[i] === '+' || src[i] === '-') i++; while (i < n && /[0-9]/.test(src[i])) i++; }
      const raw = src.slice(start, i);
      const v = Number(raw);
      if (Number.isNaN(v)) fail('رقم غير صالح: ' + raw, start);
      return v;
    }

    function object(path) {
      i++; // {
      const out = {};
      let pend = ws();
      if (src[i] === '}') { pend.forEach(cm => addComment(path, cm, false)); i++; mark(path); return out; }
      for (;;) {
        if (src[i] !== '"') fail('مفتاح كائن متوقع (' + JSON.stringify(src[i] || 'EOF') + ')', i);
        const key = string();
        const kp = path.concat([key]);
        pend.forEach(cm => addComment(kp, cm, false));
        pend = [];
        ws().forEach(cm => addComment(kp, cm, false));      // comments between key and colon
        if (src[i] !== ':') fail('":" متوقع', i);
        i++;
        ws().forEach(cm => addComment(kp, cm, false));      // comments between colon and value
        out[key] = value(kp);
        mark(kp);

        const after = splitTrailing(ws(), kp);
        if (src[i] === ',') {
          i++;
          // Comments written after the comma but on the same line still belong
          // to the value that just ended, e.g.  "a": 1, // note
          pend = after.concat(splitTrailing(ws(), kp));
          if (src[i] === '}') { pend.forEach(cm => addComment(path, cm, false)); i++; break; } // trailing comma
          continue;
        }
        if (src[i] === '}') { after.forEach(cm => addComment(path, cm, false)); i++; break; }
        fail('"," أو "}" متوقع', i);
      }
      return out;
    }

    function array(path) {
      i++; // [
      const out = [];
      let idx = 0;
      let pend = ws();
      if (src[i] === ']') { pend.forEach(cm => addComment(path, cm, false)); i++; mark(path); return out; }
      for (;;) {
        const ip = path.concat([idx]);
        pend.forEach(cm => addComment(ip, cm, false));
        pend = [];
        out.push(value(ip));
        mark(ip);
        idx++;

        const after = splitTrailing(ws(), ip);
        if (src[i] === ',') {
          i++;
          pend = after.concat(splitTrailing(ws(), ip));
          if (src[i] === ']') { pend.forEach(cm => addComment(path, cm, false)); i++; break; } // trailing comma
          continue;
        }
        if (src[i] === ']') { after.forEach(cm => addComment(path, cm, false)); i++; break; }
        fail('"," أو "]" متوقع', i);
      }
      return out;
    }

    function mark(path) { hadValue = true; lastAnchor = path; lastValueLine = lineAt(i - 1); }

    let rootValue, error = null;
    try {
      const topPending = ws();
      if (i >= n) { rootValue = {}; }
      else {
        topPending.forEach(cm => addComment([], cm, false));
        rootValue = value([]);
        mark([]);
        splitTrailing(ws(), []).forEach(cm => addComment([], cm, false));
      }
      if (i < n) fail('محتوى زائد بعد قيمة الجذر', i);
    } catch (e) {
      error = { message: e.message, line: e.line || 1, column: e.column || 1 };
      rootValue = null;
    }

    return { value: rootValue, comments: comments.sort((a, b) => a.ord - b.ord), error };
  }

  /* ---------------------------------------------------------------
     stringify(value, comments, { indent }) → text
     --------------------------------------------------------------- */
  function stringify(value, comments, opts) {
    opts = opts || {};
    const indent = opts.indent == null ? 2 : opts.indent;
    const pad = ' '.repeat(indent);

    const byKey = new Map();
    (comments || []).forEach(cm => {
      const k = anchorKey(cm.path || []);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(cm);
    });

    const taken = new Set();

    function take(path) {
      const k = anchorKey(path);
      const list = byKey.get(k);
      if (!list) return [];
      return list.filter(cm => !cm.trailing && !taken.has(cm));
    }
    function markTaken(cm) { taken.add(cm); }

    function emitLeading(path, padStr) {
      const list = take(path);
      if (!list.length) return '';
      let out = '';
      for (const cm of list) {
        markTaken(cm);
        if (cm.blankBefore) out += '\n';
        if (cm.style === 'line') {
          out += padStr + '//' + cm.text + '\n';
        } else {
          out += padStr + '/*' + cm.text + '*/\n';
        }
      }
      return out;
    }
    function emitTrailing(path) {
      const k = anchorKey(path);
      const list = byKey.get(k);
      if (!list) return '';
      const t = list.filter(cm => cm.trailing && !taken.has(cm));
      if (!t.length) return '';
      t.forEach(markTaken);
      return ' ' + t.map(cm => (cm.style === 'line' ? '//' + cm.text : '/*' + cm.text + '*/')).join(' ');
    }

    function ser(v, path, depth) {
      const cur = ' '.repeat(depth * indent);
      const childPad = ' '.repeat((depth + 1) * indent);

      if (v === null) return 'null';
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
      if (typeof v === 'string') return JSON.stringify(v);

      if (Array.isArray(v)) {
        if (!v.length) return '[]';
        let out = '[\n';
        v.forEach((item, idx) => {
          const ip = path.concat([idx]);
          out += emitLeading(ip, childPad);
          out += childPad + ser(item, ip, depth + 1);
          if (idx < v.length - 1) out += ',';
          out += emitTrailing(ip) + '\n';
        });
        out += emitLeading(path, childPad);
        out += cur + ']';
        return out;
      }

      if (u.isObj(v)) {
        // A key explicitly set to undefined behaves as if it were absent.
        const keys = Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function');
        if (!keys.length) return '{}';
        let out = '{\n';
        keys.forEach((key, idx) => {
          const kp = path.concat([key]);
          out += emitLeading(kp, childPad);
          out += childPad + JSON.stringify(key) + ': ' + ser(v[key], kp, depth + 1);
          if (idx < keys.length - 1) out += ',';
          out += emitTrailing(kp) + '\n';
        });
        out += emitLeading(path, childPad);
        out += cur + '}';
        return out;
      }
      return 'null';
    }

    let text = emitLeading([], '');
    if (value === undefined) value = {};
    text += ser(value, [], 0);

    // Any comments whose anchor no longer exists are appended at the end,
    // so nothing the user wrote is silently dropped.
    const orphans = (comments || []).filter(cm => !taken.has(cm));
    if (orphans.length) {
      text += '\n\n' + orphans.map(cm => (cm.style === 'line' ? '//' + cm.text : '/*' + cm.text + '*/')).join('\n');
    }
    return text + '\n';
  }

  /* ---------------------------------------------------------------
     Front-matter (YAML-lite) used by agents / commands / skills
     --------------------------------------------------------------- */
  const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

  function parseFrontmatter(text) {
    const m = FM_RE.exec(String(text || ''));
    if (!m) return { data: {}, body: String(text || ''), raw: '', hasFm: false };
    return { data: parseYamlLite(m[1]), body: String(text).slice(m[0].length), raw: m[1], hasFm: true };
  }

  /* Indentation-aware YAML subset: scalars, quoted strings, inline
     [a, b] / {a: b}, block scalars (| and >), sequences including
     sequences of maps (the shape agents/*.md uses for `permissions`),
     and nested maps. */
  function parseYamlLite(raw) {
    const lines = String(raw == null ? '' : raw).split(/\r?\n/);
    return readBlock(lines, 0, -1).value;
  }

  const indentOf = (line) => {
    let n = 0;
    while (n < line.length && (line[n] === ' ' || line[n] === '\t')) n++;
    return n;
  };
  const isBlank = (line) => !line || !line.trim() || line.trim().startsWith('#');
  const KEY_RE = /^([A-Za-z0-9_.\-\/]+)\s*:\s*(.*)$/;

  function readBlock(lines, start, parentIndent) {
    let i = start;
    while (i < lines.length && isBlank(lines[i])) i++;
    if (i >= lines.length) return { value: {}, next: i };
    const ind = indentOf(lines[i]);
    if (ind <= parentIndent) return { value: null, next: start };
    const body = lines[i].slice(ind);
    if (body.trim().startsWith('- ') || body.trim() === '-') return readSeq(lines, i, ind);
    return readMap(lines, i, ind);
  }

  function readMap(lines, start, indent) {
    const out = {};
    let i = start;
    while (i < lines.length) {
      if (isBlank(lines[i])) { i++; continue; }
      const ind = indentOf(lines[i]);
      if (ind < indent) break;
      if (ind > indent) { i++; continue; }
      const body = lines[i].slice(ind);
      if (body.trim().startsWith('- ') || body.trim() === '-') break;
      const m = KEY_RE.exec(body);
      if (!m) { i++; continue; }
      const key = m[1], rest = m[2].trim();
      i++;
      if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
        const block = [];
        while (i < lines.length && (isBlank(lines[i]) || indentOf(lines[i]) > indent)) {
          const lead = Math.min(indent + 2, indentOf(lines[i]));
          block.push(lines[i].slice(lead));
          i++;
        }
        while (block.length && !block[block.length - 1].trim()) block.pop();
        out[key] = rest[0] === '|' ? block.join('\n')
          : block.join(' ').replace(/\s+/g, ' ').trim();
        continue;
      }
      if (rest === '') {
        let j = i;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) > indent) {
          const sub = readBlock(lines, j, indent);
          out[key] = sub.value;
          i = sub.next;
        } else out[key] = '';
        continue;
      }
      out[key] = yamlScalar(rest);
    }
    return { value: out, next: i };
  }

  function readSeq(lines, start, indent) {
    const out = [];
    let i = start;
    while (i < lines.length) {
      if (isBlank(lines[i])) { i++; continue; }
      const ind = indentOf(lines[i]);
      if (ind < indent) break;
      if (ind > indent) { i++; continue; }
      const body = lines[i].slice(ind);
      if (!body.trim().startsWith('- ') && body.trim() !== '-') break;
      const rest = body.trim() === '-' ? '' : body.trim().slice(2).trim();
      i++;
      if (rest === '') {
        let j = i;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) > indent) {
          const sub = readBlock(lines, j, indent);
          out.push(sub.value);
          i = sub.next;
        } else out.push('');
        continue;
      }
      // "- key: value" opens a map that continues on the following lines
      if (KEY_RE.test(rest)) {
        const itemIndent = ind + 2;
        const synth = [' '.repeat(itemIndent) + rest];
        let j = i;
        while (j < lines.length && (isBlank(lines[j]) || indentOf(lines[j]) >= itemIndent)) {
          synth.push(lines[j]);
          j++;
        }
        out.push(readMap(synth, 0, itemIndent).value);
        i = j;
        continue;
      }
      out.push(yamlScalar(rest));
    }
    return { value: out, next: i };
  }

  function yamlScalar(v) {
    const s = String(v == null ? '' : v).trim();
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1).trim();
      return inner ? splitInline(inner).map(x => yamlScalar(x)) : [];
    }
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1).trim();
      const o = {};
      if (inner) splitInline(inner).forEach(part => {
        const at = part.indexOf(':');
        if (at > 0) o[part.slice(0, at).trim()] = yamlScalar(part.slice(at + 1));
      });
      return o;
    }
    if (s === 'true' || s === 'True') return true;
    if (s === 'false' || s === 'False') return false;
    if (s === 'null' || s === '~') return null;
    if (s === '') return '';
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
    return s;
  }

  /** Split an inline list on commas that are not inside quotes or brackets. */
  function splitInline(s) {
    const parts = [];
    let depth = 0, quote = '', cur = '';
    for (const ch of String(s)) {
      if (quote) { cur += ch; if (ch === quote) quote = ''; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;
      else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  /** Serialize a JS object back to front-matter, preserving nested shapes. */
  function buildFrontmatter(data, depth) {
    depth = depth || 0;
    const pad = '  '.repeat(depth);
    const lines = [];
    for (const [k, v] of Object.entries(data || {})) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        if (!v.length) { lines.push(pad + k + ': []'); continue; }
        lines.push(pad + k + ':');
        v.forEach(item => {
          if (u.isObj(item)) {
            const subLines = buildFrontmatter(item, depth + 1).split('\n');
            lines.push(pad + '  - ' + subLines[0].replace(/^\s{2}/, ''));
            // continuation lines must align past the "- " marker
            subLines.slice(1).forEach(l => lines.push('  '.repeat(depth + 1) + l));
          } else {
            lines.push(pad + '  - ' + yamlOutScalar(item));
          }
        });
        continue;
      }
      if (u.isObj(v)) {
        if (!Object.keys(v).length) { lines.push(pad + k + ': {}'); continue; }
        lines.push(pad + k + ':');
        buildFrontmatter(v, depth + 1).split('\n').forEach(l => lines.push(l));
        continue;
      }
      if (typeof v === 'string' && v.indexOf('\n') >= 0) {
        lines.push(pad + k + ': |');
        v.split('\n').forEach(l => lines.push('  '.repeat(depth + 1) + l));
        continue;
      }
      if (v === null) { lines.push(pad + k + ': null'); continue; }
      lines.push(pad + k + ': ' + yamlOutScalar(v));
    }
    return lines.join('\n');
  }
  function yamlOutScalar(v) {
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    const s = String(v);
    if (s === '' || /[:#\-{}[\],&*?|<>=!%@`"']/.test(s) || /^\s|\s$/.test(s) ||
        /^(true|false|null|yes|no|on|off)$/i.test(s) || /^-?\d+(\.\d+)?$/.test(s)) {
      return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return s;
  }

  function composeFile(data, body) {
    const fm = buildFrontmatter(data);
    const b = String(body == null ? '' : body);
    if (!fm) return b.replace(/^\n+/, '');
    return '---\n' + fm + '\n---\n\n' + b.replace(/^\n+/, '');
  }

  NS.jsonc = { parse, stringify, parseFrontmatter, composeFile, buildFrontmatter, anchorKey };
})(window.OCM);