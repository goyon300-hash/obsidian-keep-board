import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { outputFiles } = await build({
  entryPoints: ['src/view.ts'], bundle: true, format: 'cjs',
  platform: 'node', external: ['obsidian'], write: false,
});

// Deliberately small DOM/Obsidian doubles: these tests do not exercise CSS,
// browser layout, native touch synthesis, or an actual Obsidian installation.
class Element {
  constructor(tag = 'div', cls = '', document = { activeElement: null }) {
    this.tagName = tag;
    this.cls = cls;
    this.ownerDocument = document;
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.scrollTop = 0;
    this.clientWidth = 800;
    this.value = '';
    this.isConnected = true;
  }
  addClass(cls) { this.cls += ` ${cls}`; }
  empty() { this.children.forEach(child => child.remove()); }
  createEl(tag, options = {}) {
    const child = new Element(tag, options.cls, this.ownerDocument);
    child.parent = this;
    this.children.push(child);
    return child;
  }
  createDiv(options) { return this.createEl('div', options); }
  setText(text) { this.text = text; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatch(type, extra = {}) {
    const event = { preventDefault() {}, stopPropagation() {}, ...extra };
    for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event);
  }
  focus() { this.ownerDocument.activeElement = this; }
  remove() {
    this.isConnected = false;
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
  }
}
class TFile {
  constructor(path, mtime = 1) {
    this.path = path;
    this.basename = path.split('/').at(-1).replace(/\.md$/, '');
    this.extension = 'md';
    this.stat = { mtime };
  }
}
function debounce(callback, timeout) {
  let timer;
  const wrapped = () => { clearTimeout(timer); timer = setTimeout(callback, timeout); return wrapped; };
  wrapped.cancel = () => { clearTimeout(timer); return wrapped; };
  return wrapped;
}
function setup(files = [], read = async () => 'Preview') {
  const observers = [];
  const events = [];
  const app = {
    vault: { getMarkdownFiles: () => [...files], cachedRead: read,
      on: (event, callback) => { events.push({ event, callback }); return {}; } },
    metadataCache: { on: () => ({}) },
  };
  class ItemView {
    constructor() { this.app = app; this.containerEl = new Element(); this.contentEl = this.containerEl.createDiv({}); }
    registerEvent() {}
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const module = { exports: {} };
  runInNewContext(outputFiles[0].text, {
    module, exports: module.exports, ResizeObserver,
    require: id => { assert.equal(id, 'obsidian'); return { ItemView, TFile, debounce }; },
  });
  const view = new module.exports.KeepBoardView({});
  return { view, observers, events };
}
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const paths = view => Array.from(view.notes, note => note.file.path);

test('sort newest first; search title/path case-insensitively and trim whitespace', async () => {
  const { view } = setup([new TFile('Archive/Older.md', 1), new TFile('New.md', 2)]);
  await view.onOpen();
  assert.deepEqual(paths(view), ['New.md', 'Archive/Older.md']);
  view.searchInput.value = ' ARCHIVE/ ';
  await view.renderBoard();
  assert.deepEqual(paths(view), ['Archive/Older.md']);
  view.searchInput.value = 'nEw';
  await view.renderBoard();
  assert.deepEqual(paths(view), ['New.md']);
  await view.onClose();
});

test('stale asynchronous render cannot repopulate a newer filtered board', async () => {
  const pending = deferred();
  const a = new TFile('A.md', 2), b = new TFile('B.md', 1);
  const { view } = setup([a, b], file => file === a ? pending.promise : Promise.resolve('B'));
  const initial = view.onOpen();
  view.searchInput.value = 'B';
  await view.renderBoard();
  pending.resolve('A');
  await initial;
  assert.deepEqual(paths(view), ['B.md']);
  assert.equal(view.board.children.length, 1);
  await view.onClose();
});

test('closing invalidates an in-flight render and cancels queued debounce', async () => {
  const pending = deferred();
  let reads = 0;
  const { view, observers, events } = setup([new TFile('A.md')], () => { reads++; return pending.promise; });
  const initial = view.onOpen();
  events.find(event => event.event === 'modify').callback(new TFile('A.md'));
  await view.onClose();
  pending.resolve('Late content');
  await initial;
  await new Promise(resolve => setTimeout(resolve, 130));
  assert.equal(reads, 1);
  assert.equal(view.board, null);
  assert.equal(view.notes.length, 0);
  assert.equal(observers[0].disconnected, true);
});

test('resize recalculates columns without reading or rebuilding cards', async () => {
  let reads = 0;
  const { view, observers } = setup([new TFile('A.md')], async () => { reads++; return 'A'; });
  await view.onOpen();
  const card = view.board.children[0];
  view.board.clientWidth = 1000;
  observers[0].callback();
  assert.equal(view.board.style.columnCount, '3');
  view.board.clientWidth = 200;
  observers[0].callback();
  assert.equal(view.board.style.columnCount, '1');
  assert.equal(view.board.children[0], card);
  assert.equal(reads, 1);
  await view.onClose();
});

test('focus mode stays single, uses click only, cleans Escape listeners and restores scroll/focus', async () => {
  const file = new TFile('A.md');
  const { view } = setup([file]);
  await view.onOpen();
  const card = view.board.children[0];
  card.focus();
  view.board.scrollTop = 42;
  assert.equal(card.listeners.has('touchend'), false);
  card.dispatch('click');
  const first = view.container.children.at(-1);
  assert.equal(first.attributes.role, 'dialog');
  assert.equal(first.children[0].tagName, 'button');
  assert.equal(first.children[0].attributes['aria-label'], 'Close note');
  view.openFocusMode(file);
  assert.equal(first.isConnected, false);
  assert.equal(first.listeners.get('keydown').size, 0);
  const overlay = view.container.children.at(-1);
  overlay.dispatch('keydown', { key: 'Escape' });
  assert.equal(overlay.isConnected, false);
  assert.equal(overlay.listeners.get('keydown').size, 0);
  assert.equal(view.closeFocus, null);
  assert.equal(view.board.scrollTop, 42);
  assert.equal(view.container.ownerDocument.activeElement, card);
  // Closing through the button must clean up just as Escape does.
  view.openFocusMode(file);
  const clicked = view.container.children.at(-1);
  clicked.children[0].dispatch('click');
  assert.equal(clicked.listeners.get('keydown').size, 0);
  view.openFocusMode(file);
  const backOverlay = view.container.children.at(-1);
  backOverlay.children.at(-1).dispatch('click');
  assert.equal(backOverlay.listeners.get('keydown').size, 0);
  view.openFocusMode(file);
  const last = view.container.children.at(-1);
  await view.onClose();
  assert.equal(last.isConnected, false);
});

test('read failures keep the card and show a focus error; note markup uses text', async () => {
  const file = new TFile('Example.md');
  const markup = '<img src=x onerror=alert(1)>';
  let fail = false;
  const { view } = setup([file], async () => {
    if (fail) throw new Error('Synthetic read error');
    return markup;
  });
  await view.onOpen();
  assert.equal(view.board.children[0].children[1].text, markup);
  view.openFocusMode(file);
  await Promise.resolve();
  const overlay = view.container.children.at(-1);
  assert.equal(overlay.children[2].text, markup);
  view.closeFocus();
  fail = true;
  await view.renderBoard();
  assert.deepEqual(paths(view), ['Example.md']);
  assert.equal(view.board.children[0].children.length, 2);
  view.openFocusMode(file);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.container.children.at(-1).children[2].text, 'Error loading note');
  await view.onClose();
});

test('preview strips only delimited frontmatter and keeps note text inert', () => {
  const { view } = setup();
  const preview = text => view.getPreview(text, new TFile('Example.md'));
  assert.equal(preview('---\ntitle: example\n---\n# Hello **world**'), 'Hello world');
  assert.equal(preview('---\n---\nBody'), 'Body');
  assert.equal(preview('\uFEFF---\r\ntitle: example\r\n...\r\nHello'), 'Hello');
  assert.equal(preview('--- not frontmatter\nKeep --- this'), '--- not frontmatter\nKeep --- this');
  assert.equal(preview('---\nNo closing delimiter'), '---\nNo closing delimiter');
  assert.equal(preview('![alt](image.png) ![[image.png]] [label](note.md)'), 'label');
  assert.equal(preview('<script>alert(1)</script>'), '<script>alert(1)</script>');
  assert.equal(preview('a'.repeat(201)), 'a'.repeat(200) + '...');
});
