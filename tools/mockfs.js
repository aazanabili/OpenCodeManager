/* In-page mock FileSystemDirectoryHandle so the project scanner and the
   scope model can be exercised without a real folder-picker gesture.
   `tree` is a nested plain object where string values are file contents. */
(function (global) {
  'use strict';

  function domError(kind) {
    const e = new Error(kind);
    e.name = kind;
    return e;
  }

  function makeFile(parentTree, name, onWrite) {
    return {
      kind: 'file',
      name,
      async getFile() {
        const content = parentTree[name] || '';
        return { text: async () => content, size: content.length };
      },
      async createWritable() {
        let buf = parentTree[name] || '';
        return {
          async write(d) { buf = d; },
          async close() { parentTree[name] = buf; if (onWrite) onWrite(name, buf); }
        };
      }
    };
  }

  function makeDir(tree, onWrite) {
    if (!tree || typeof tree !== 'object') throw domError('TypeMismatch');
    return {
      kind: 'directory',
      async queryPermission() { return 'granted'; },
      async requestPermission() { return 'granted'; },
      async getDirectoryHandle(name, opts) {
        let sub = tree[name];
        if (sub === undefined || sub === null || typeof sub !== 'object') {
          if (opts && opts.create) { tree[name] = {}; sub = tree[name]; }
          else throw domError('NotFoundError');
        }
        return makeDir(sub, onWrite);
      },
      async getFileHandle(name, opts) {
        if (typeof tree[name] !== 'string') {
          if (opts && opts.create) tree[name] = '';
          else throw domError('NotFoundError');
        }
        return makeFile(tree, name, onWrite);
      },
      async *entries() {
        for (const k of Object.keys(tree)) {
          const v = tree[k];
          if (typeof v === 'string') yield [k, makeFile(tree, k, onWrite)];
          else if (v && typeof v === 'object') yield [k, makeDir(v, onWrite)];
        }
      },
      async removeEntry(name) { delete tree[name]; }
    };
  }

  global.MOCKFS = { dir(tree, onWrite) { return makeDir(tree, onWrite); } };
})(window);