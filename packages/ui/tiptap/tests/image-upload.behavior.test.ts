// @vitest-environment happy-dom
/**
 * image-upload.behavior.test.ts — mount-and-drive proof for the `uploadImage`
 * paste/drop handlers of TipTap.rozie.
 *
 * The component is compiled from SOURCE to Vue (see vitest.config.ts) and
 * mounted under happy-dom with a real TipTap editor. The assertions are on the
 * resulting document (`editor.getHTML()`), the selection, and the calls the
 * consumer's `uploadImage` received — never on emitted source text, except in
 * the `uploadImage wiring` block which locks the receiver-safe closure shape on
 * the class-based targets.
 *
 * Harness facts (measured, see the plan's <interfaces>):
 *  - happy-dom has no usable clipboard / drag-data plumbing. A plain
 *    `Event('paste' | 'drop')` with `clipboardData` / `dataTransfer` defined as
 *    `{ files, types, getData }` reaches the editor props, because ProseMirror
 *    reads only `files` and `getData()`.
 *  - There is no layout, so the drop position is set by overriding
 *    `editor.view.posAtCoords`.
 *  - A paste nobody claims and that carries no text starts a 50 ms capture
 *    timer in ProseMirror, so every not-claimed paste carries plain text.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import type { App } from 'vue';
import { Image } from '@tiptap/extension-image';
import { compile } from '@rozie/core';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — virtual module provided by vitest.config.ts (TipTap.rozie compiled to Vue)
import TipTap from 'virtual:tiptap-vue-from-source';

type Kind = 'paste' | 'drop';
type Plan = (file: File) => Promise<unknown>;

const apps = new Set<App>();
const hosts: HTMLElement[] = [];

afterEach(() => {
  for (const app of apps) app.unmount();
  apps.clear();
  for (const host of hosts.splice(0)) host.remove();
});

async function mountEditor(props: Record<string, unknown>): Promise<{ app: App; editor: any }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  let editor: any = null;
  const app = createApp({
    render: () =>
      h(TipTap, {
        ...props,
        onReady: (ed: any) => {
          editor = ed;
        },
      }),
  });
  app.mount(host);
  apps.add(app);
  await vi.waitFor(() => {
    if (!editor) throw new Error('editor not ready');
  });
  return { app, editor };
}

function imageFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

// Builds the paste / drop event described in the harness facts. `getData`
// returns `text` for text/plain (and the legacy 'Text' key) and '' otherwise.
function fileEvent(kind: Kind, files: File[], text: string): Event {
  const ev = new Event(kind, { bubbles: true, cancelable: true });
  const data = {
    files,
    types: text ? ['Files', 'text/plain'] : ['Files'],
    getData: (type: string) => (type === 'text/plain' || type === 'Text' ? text : ''),
  };
  Object.defineProperty(ev, kind === 'paste' ? 'clipboardData' : 'dataTransfer', { value: data });
  if (kind === 'drop') {
    Object.defineProperty(ev, 'clientX', { value: 0 });
    Object.defineProperty(ev, 'clientY', { value: 0 });
  }
  return ev;
}

// Paste: put the text caret at `pos` first. Drop: there is no layout, so
// override posAtCoords to report `pos` (ProseMirror's own drop handler and the
// wrapper both call it).
function fire(kind: Kind, editor: any, files: File[], pos: number, text = ''): Event {
  if (kind === 'paste') {
    editor.commands.setTextSelection(pos);
  } else {
    editor.view.posAtCoords = () => ({ pos, inside: -1 });
  }
  const ev = fileEvent(kind, files, text);
  editor.view.dom.dispatchEvent(ev);
  return ev;
}

// The transaction ProseMirror itself dispatches for a typed character. It
// replaces the current selection, which is exactly what deletes a node-selected
// image — the consumer's bug report.
function typeText(editor: any, text: string): void {
  editor.view.dispatch(editor.state.tr.insertText(text));
}

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

function deferred<T = unknown>() {
  let resolveFn!: (v: T) => void;
  let rejectFn!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  // A deferred nobody consumed (a handler that never started that upload) must
  // not surface as an unhandled rejection in the test runner; consumers that do
  // chain on `promise` still observe the rejection.
  promise.catch(() => {});
  return { promise, resolve: resolveFn, reject: rejectFn };
}

function images(editor: any): Array<{ src: unknown; alt: unknown }> {
  const out: Array<{ src: unknown; alt: unknown }> = [];
  editor.state.doc.descendants((node: any) => {
    if (node.type.name === 'image') out.push({ src: node.attrs.src, alt: node.attrs.alt });
  });
  return out;
}

const cdn = (name: string) => `https://cdn.test/${name}`;

// A recording uploadImage whose behaviour is chosen per call by `plan`.
function makeUpload(plan: Plan = (f) => Promise.resolve(cdn(f.name))) {
  const calls: string[] = [];
  const fn = (file: File) => {
    calls.push(file.name);
    return plan(file);
  };
  return { fn, calls };
}

const A = 'a.png';
const B = 'b.png';
const C = 'c.png';
const IMG_A = `<img src="${cdn(A)}">`;
const IMG_B = `<img src="${cdn(B)}">`;
const IMG_C = `<img src="${cdn(C)}">`;

function sharedCases(kind: Kind) {
  it('S1: every image file is uploaded, all at once, in file order', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B), imageFile(C)], 5);
    // Before anything resolves: every upload has already been started.
    expect(up.calls).toEqual([A, B, C]);
    await settle();
    expect(images(editor).map((i) => i.src)).toEqual([cdn(A), cdn(B), cdn(C)]);
  });

  it('S2: one image leaves a text cursor after it; typing keeps the image', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A)], 5);
    await settle();
    const sel = editor.state.selection;
    expect((sel as any).node).toBeUndefined();
    expect(sel.empty).toBe(true);
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>text</p>${IMG_A}<p>mark</p>`);
  });

  it('S3: two images land in file order and survive typing', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B)], 5);
    await settle();
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>text</p>${IMG_A}${IMG_B}<p>mark</p>`);
  });

  it('S4: { src, alt } and a plain string both work', async () => {
    const up = makeUpload((f) =>
      f.name === A ? Promise.resolve({ src: cdn(A), alt: A }) : Promise.resolve(cdn(f.name)),
    );
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B)], 5);
    await settle();
    expect(images(editor)).toEqual([
      { src: cdn(A), alt: A },
      { src: cdn(B), alt: null },
    ]);
  });

  it('S5: each image is inserted as its own upload settles, in file order; a rejection is skipped', async () => {
    const d: Record<string, ReturnType<typeof deferred>> = {
      [A]: deferred(),
      [B]: deferred(),
      [C]: deferred(),
    };
    const up = makeUpload((f) => d[f.name].promise);
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B), imageFile(C)], 5);
    d[C].resolve(cdn(C));
    await settle();
    // C does not wait for A and B.
    expect(images(editor).map((i) => i.src)).toEqual([cdn(C)]);
    d[A].resolve(cdn(A));
    await settle();
    // A settles later but lands BEFORE C: file order.
    expect(images(editor).map((i) => i.src)).toEqual([cdn(A), cdn(C)]);
    d[B].reject(new Error('upload failed'));
    await settle();
    expect(images(editor).map((i) => i.src)).toEqual([cdn(A), cdn(C)]);
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>text</p>${IMG_A}${IMG_C}<p>mark</p>`);
  });

  it('S6: an edit before the insertion point while uploading does not misplace the image', async () => {
    const d = deferred();
    const up = makeUpload(() => d.promise);
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A)], 5);
    editor.commands.insertContentAt(1, 'ab');
    d.resolve(cdn(A));
    await settle();
    expect(editor.getHTML()).toBe(`<p>abtext</p>${IMG_A}<p></p>`);
  });

  it('S7: text typed at the insertion point while uploading stays before the image, and the caret stays with the typing', async () => {
    const d = deferred();
    const up = makeUpload(() => d.promise);
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A)], 5);
    editor.commands.setTextSelection(5);
    typeText(editor, 'ZZ');
    d.resolve(cdn(A));
    await settle();
    expect(editor.getHTML()).toBe(`<p>textZZ</p>${IMG_A}<p></p>`);
    // The user was typing: the caret is not pulled after the image.
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>textZZmark</p>${IMG_A}<p></p>`);
  });

  // ---- one container, consecutive, in file order (review finding 1) ----

  it('K1: two images at the end of a list item stay in that item, with the caret after them', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({
      html: '<ul><li><p>one</p></li><li><p>two</p></li></ul>',
      uploadImage: up.fn,
    });
    fire(kind, editor, [imageFile(A), imageFile(B)], 6);
    await settle();
    // The final `<p></p>` after the list is StarterKit's own trailing node: it
    // follows ANY edit of a document that ends in a list. The second item is
    // untouched and gets no stray paragraph.
    expect(editor.getHTML()).toBe(
      `<ul><li><p>one</p>${IMG_A}${IMG_B}<p></p></li><li><p>two</p></li></ul><p></p>`,
    );
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(
      `<ul><li><p>one</p>${IMG_A}${IMG_B}<p>mark</p></li><li><p>two</p></li></ul><p></p>`,
    );
  });

  it('K2: two images at the end of a blockquote paragraph both stay in the quote', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({
      html: '<blockquote><p>quote</p></blockquote><p>after</p>',
      uploadImage: up.fn,
    });
    fire(kind, editor, [imageFile(A), imageFile(B)], 7);
    await settle();
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(
      `<blockquote><p>quote</p>${IMG_A}${IMG_B}<p>mark</p></blockquote><p>after</p>`,
    );
  });

  it('K3: a following block that is not a paragraph is not entered; the caret gets its own line after the images', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({
      html: '<p>one</p><blockquote><p>q</p></blockquote>',
      uploadImage: up.fn,
    });
    fire(kind, editor, [imageFile(A), imageFile(B)], 4);
    await settle();
    typeText(editor, 'mark');
    // (The final `<p></p>` is StarterKit's trailing node after the blockquote.)
    expect(editor.getHTML()).toBe(
      `<p>one</p>${IMG_A}${IMG_B}<p>mark</p><blockquote><p>q</p></blockquote><p></p>`,
    );
  });

  it('K4: three images before an existing paragraph are consecutive and the caret lands in that paragraph', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({ html: '<p>one</p><p>two</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B), imageFile(C)], 4);
    await settle();
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>one</p>${IMG_A}${IMG_B}${IMG_C}<p>marktwo</p>`);
  });

  // ---- the caret is only moved while it is still where the routine left it (review finding 2) ----

  it('F1: a caret the user moved while uploading is left alone', async () => {
    const d = deferred();
    const up = makeUpload(() => d.promise);
    const { editor } = await mountEditor({ html: '<p>one</p><p>two</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A)], 4);
    editor.commands.setTextSelection(7);
    d.resolve(cdn(A));
    await settle();
    // Same spot in the text, one position later because the image went in before it.
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.head).toBe(8);
    typeText(editor, 'X');
    expect(editor.getHTML()).toBe(`<p>one</p>${IMG_A}<p>tXwo</p>`);
  });

  it('F2: a caret moved between two images is left alone; the second image still follows the first', async () => {
    const d: Record<string, ReturnType<typeof deferred>> = { [A]: deferred(), [B]: deferred() };
    const up = makeUpload((f) => d[f.name].promise);
    const { editor } = await mountEditor({ html: '<p>one</p><p>two</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B)], 4);
    d[A].resolve(cdn(A));
    await settle();
    editor.commands.setTextSelection(2);
    d[B].resolve(cdn(B));
    await settle();
    expect(editor.state.selection.head).toBe(2);
    typeText(editor, 'X');
    expect(editor.getHTML()).toBe(`<p>oXne</p>${IMG_A}${IMG_B}<p>two</p>`);
  });

  it('F3: inserting never focuses the editor', async () => {
    const d: Record<string, ReturnType<typeof deferred>> = { [A]: deferred(), [B]: deferred() };
    const up = makeUpload((f) => d[f.name].promise);
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    const other = document.createElement('input');
    document.body.appendChild(other);
    hosts.push(other);
    fire(kind, editor, [imageFile(A), imageFile(B)], 5);
    // The user leaves the editor while the uploads run.
    other.focus();
    const viewFocus = vi.spyOn(editor.view, 'focus');
    const domFocus = vi.spyOn(editor.view.dom, 'focus');
    d[A].resolve(cdn(A));
    d[B].resolve(cdn(B));
    await settle();
    // TipTap's focus command defers to an animation frame: wait past it.
    await new Promise<void>((r) => setTimeout(r, 60));
    expect(images(editor).map((i) => i.src)).toEqual([cdn(A), cdn(B)]);
    expect(viewFocus).toHaveBeenCalledTimes(0);
    expect(domFocus).toHaveBeenCalledTimes(0);
    expect(document.activeElement).toBe(other);
  });

  // ---- one upload never holds back another (review finding 3) ----

  it('H1: an upload that never settles does not hold back the later images', async () => {
    const up = makeUpload((f) => (f.name === A ? new Promise(() => {}) : Promise.resolve(cdn(f.name))));
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B), imageFile(C)], 5);
    await settle();
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>text</p>${IMG_B}${IMG_C}<p>mark</p>`);
  });

  it('H2: settle order B, C, A still gives file order A, B, C', async () => {
    const d: Record<string, ReturnType<typeof deferred>> = {
      [A]: deferred(),
      [B]: deferred(),
      [C]: deferred(),
    };
    const up = makeUpload((f) => d[f.name].promise);
    const { editor } = await mountEditor({ html: '<p>text</p><p>tail</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B), imageFile(C)], 5);
    d[B].resolve(cdn(B));
    await settle();
    expect(editor.getHTML()).toBe(`<p>text</p>${IMG_B}<p>tail</p>`);
    d[C].resolve(cdn(C));
    await settle();
    expect(editor.getHTML()).toBe(`<p>text</p>${IMG_B}${IMG_C}<p>tail</p>`);
    d[A].resolve(cdn(A));
    await settle();
    expect(editor.getHTML()).toBe(`<p>text</p>${IMG_A}${IMG_B}${IMG_C}<p>tail</p>`);
    // The caret is after the LAST image, not after the one inserted last.
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>text</p>${IMG_A}${IMG_B}${IMG_C}<p>marktail</p>`);
  });

  it('H3: a later image follows the earlier one even after an edit moved it', async () => {
    const d: Record<string, ReturnType<typeof deferred>> = { [A]: deferred(), [B]: deferred() };
    const up = makeUpload((f) => d[f.name].promise);
    const { editor } = await mountEditor({ html: '<p>text</p><p>tail</p>', uploadImage: up.fn });
    fire(kind, editor, [imageFile(A), imageFile(B)], 5);
    d[A].resolve(cdn(A));
    await settle();
    editor.commands.insertContentAt(0, '<p>new first line</p>');
    d[B].resolve(cdn(B));
    await settle();
    expect(editor.getHTML()).toBe(`<p>new first line</p><p>text</p>${IMG_A}${IMG_B}<p>tail</p>`);
  });

  it('H4: the transaction listener goes once every upload has settled', async () => {
    const d: Record<string, ReturnType<typeof deferred>> = { [A]: deferred(), [B]: deferred() };
    const up = makeUpload((f) => d[f.name].promise);
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    const on = vi.spyOn(editor, 'on');
    const off = vi.spyOn(editor, 'off');
    fire(kind, editor, [imageFile(A), imageFile(B)], 5);
    const added = on.mock.calls.filter((c: any[]) => c[0] === 'transaction');
    expect(added).toHaveLength(1);
    const removed = () => off.mock.calls.filter((c: any[]) => c[0] === 'transaction' && c[1] === added[0][1]);
    d[B].reject(new Error('upload failed'));
    await settle();
    expect(removed()).toHaveLength(0);
    d[A].resolve(cdn(A));
    await settle();
    expect(removed()).toHaveLength(1);
  });

  it('H5: with an upload still pending the listener goes when the editor is destroyed; a late result is a no-op', async () => {
    const d = deferred();
    const up = makeUpload((f) => (f.name === A ? d.promise : Promise.resolve(cdn(f.name))));
    const { app, editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    const on = vi.spyOn(editor, 'on');
    const off = vi.spyOn(editor, 'off');
    fire(kind, editor, [imageFile(A), imageFile(B)], 5);
    const added = on.mock.calls.filter((c: any[]) => c[0] === 'transaction');
    expect(added).toHaveLength(1);
    const removed = () => off.mock.calls.filter((c: any[]) => c[0] === 'transaction' && c[1] === added[0][1]);
    await settle();
    expect(images(editor).map((i) => i.src)).toEqual([cdn(B)]);
    expect(removed()).toHaveLength(0);
    app.unmount();
    apps.delete(app);
    expect(editor.isDestroyed).toBe(true);
    expect(removed()).toHaveLength(1);
    const errors: unknown[] = [];
    const onRejection = (e: any) => errors.push(e);
    process.on('unhandledRejection', onRejection);
    d.resolve(cdn(A));
    await settle();
    process.off('unhandledRejection', onRejection);
    expect(errors).toEqual([]);
    expect(removed()).toHaveLength(1);
  });

  it('H6: a single upload that never settles: the listener goes with the editor', async () => {
    const up = makeUpload(() => new Promise(() => {}));
    const { app, editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    const on = vi.spyOn(editor, 'on');
    const off = vi.spyOn(editor, 'off');
    fire(kind, editor, [imageFile(A)], 5);
    const added = on.mock.calls.filter((c: any[]) => c[0] === 'transaction');
    expect(added).toHaveLength(1);
    app.unmount();
    apps.delete(app);
    expect(off.mock.calls.filter((c: any[]) => c[0] === 'transaction' && c[1] === added[0][1])).toHaveLength(1);
  });
}

describe('uploadImage paste: fixes', () => {
  sharedCases('paste');

  it('P8: a throwing upload, a malformed result and a non-image file do not block the rest', async () => {
    const up = makeUpload((f) => {
      if (f.name === 'throw.png') throw new Error('sync boom');
      if (f.name === 'nosrc.png') return Promise.resolve({ alt: 'no src here' });
      return Promise.resolve(cdn(f.name));
    });
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    const files = [
      imageFile('throw.png'),
      imageFile('nosrc.png'),
      new File(['x'], 'note.txt', { type: 'text/plain' }),
      imageFile(A),
    ];
    fire('paste', editor, files, 5);
    await settle();
    // The text/plain file is never handed to the consumer.
    expect(up.calls).toEqual(['throw.png', 'nosrc.png', A]);
    expect(images(editor).map((i) => i.src)).toEqual([cdn(A)]);
  });

  it('P9: a consumer inline Image keeps every image inline on one line', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({
      html: '<p>text</p>',
      uploadImage: up.fn,
      extensions: [Image.configure({ inline: true })],
    });
    fire('paste', editor, [imageFile(A), imageFile(B)], 3);
    await settle();
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>te${IMG_A}${IMG_B}markxt</p>`);
  });

  it('P11: inline images settling C, A, B end up A, B, C on one line', async () => {
    const d: Record<string, ReturnType<typeof deferred>> = {
      [A]: deferred(),
      [B]: deferred(),
      [C]: deferred(),
    };
    const up = makeUpload((f) => d[f.name].promise);
    const { editor } = await mountEditor({
      html: '<p>text</p>',
      uploadImage: up.fn,
      extensions: [Image.configure({ inline: true })],
    });
    fire('paste', editor, [imageFile(A), imageFile(B), imageFile(C)], 3);
    d[C].resolve(cdn(C));
    await settle();
    d[A].resolve(cdn(A));
    await settle();
    d[B].resolve(cdn(B));
    await settle();
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>te${IMG_A}${IMG_B}${IMG_C}markxt</p>`);
  });

  it('P10: an empty document with { src, alt } results', async () => {
    const up = makeUpload((f) => Promise.resolve({ src: cdn(f.name), alt: f.name }));
    const { editor } = await mountEditor({ html: '', uploadImage: up.fn });
    fire('paste', editor, [imageFile(A), imageFile(B)], 1);
    await settle();
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(
      `<img src="${cdn(A)}" alt="${A}"><img src="${cdn(B)}" alt="${B}"><p>mark</p>`,
    );
  });
});

describe('uploadImage drop: fixes', () => {
  sharedCases('drop');

  it('D1: the caret was elsewhere; the images land at the drop position and the caret ends after them', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({ html: '<p>one</p><p>two</p>', uploadImage: up.fn });
    editor.commands.setTextSelection(2);
    fire('drop', editor, [imageFile(A)], 9);
    await settle();
    typeText(editor, 'mark');
    expect(editor.getHTML()).toBe(`<p>one</p><p>two</p>${IMG_A}<p>mark</p>`);
  });

  it('D2: the drop itself (the user gesture) prevents the browser default, focuses once and moves the caret to the drop point', async () => {
    const d = deferred();
    const up = makeUpload(() => d.promise);
    const { editor } = await mountEditor({ html: '<p>one</p><p>two</p>', uploadImage: up.fn });
    editor.commands.setTextSelection(2);
    const viewFocus = vi.spyOn(editor.view, 'focus');
    const ev = fire('drop', editor, [imageFile(A)], 9);
    expect(ev.defaultPrevented).toBe(true);
    expect(viewFocus).toHaveBeenCalledTimes(1);
    expect(editor.state.selection.head).toBe(9);
    d.resolve(cdn(A));
    await settle();
    await new Promise<void>((r) => setTimeout(r, 60));
    expect(viewFocus).toHaveBeenCalledTimes(1);
  });

  it('D3: a drop with no image file is left to ProseMirror', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    const ev = fire('drop', editor, [new File(['x'], 'note.txt', { type: 'text/plain' })], 5);
    await settle();
    expect(up.calls).toEqual([]);
    expect(ev.defaultPrevented).toBe(false);
    expect(editor.getHTML()).toBe('<p>text</p>');
  });
});

describe('uploadImage paste: unchanged behaviour', () => {
  it('G1: an untouched selection is replaced by the image', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    editor.commands.setTextSelection({ from: 3, to: 5 });
    editor.view.dom.dispatchEvent(fileEvent('paste', [imageFile(A)], ''));
    await settle();
    expect(editor.getHTML()).toBe(`<p>te</p>${IMG_A}<p></p>`);
  });

  it('G2: a selection the user changed while uploading is not replaced', async () => {
    const d = deferred();
    const up = makeUpload(() => d.promise);
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    editor.commands.setTextSelection({ from: 3, to: 5 });
    editor.view.dom.dispatchEvent(fileEvent('paste', [imageFile(A)], ''));
    typeText(editor, 'Z');
    d.resolve(cdn(A));
    await settle();
    expect(editor.getHTML()).toBe(`<p>teZ</p>${IMG_A}<p></p>`);
  });

  it('G3: unmounting while an upload is pending does not throw', async () => {
    const d = deferred();
    const up = makeUpload(() => d.promise);
    const { app, editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire('paste', editor, [imageFile(A)], 5);
    app.unmount();
    apps.delete(app);
    d.resolve(cdn(A));
    await settle();
    expect(editor.isDestroyed).toBe(true);
  });

  it('G4: a text/plain file with plain text is left to ProseMirror', async () => {
    const up = makeUpload();
    const { editor } = await mountEditor({ html: '<p>text</p>', uploadImage: up.fn });
    fire('paste', editor, [new File(['x'], 'note.txt', { type: 'text/plain' })], 5, ' pasted');
    await settle();
    expect(up.calls).toEqual([]);
    expect(editor.getHTML()).toBe('<p>text pasted</p>');
  });
});

// Source of the six-target compile for the wiring lock. The class-based
// targets (Lit, Angular) hand ProseMirror its editor props with no receiver, so
// the two handlers must reach editorProps as closures that keep the component
// instance. On Lit a top-level function lowers to an unbound prototype method;
// handed over by bare reference, `this.uploadImage` is read off `undefined`.
const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, '..', 'src', 'TipTap.rozie'), 'utf8');
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

describe('uploadImage wiring', () => {
  it.each(TARGETS)('W1: %s compiles with no error diagnostic', (target) => {
    const r = compile(SOURCE, { target, filename: 'TipTap.rozie' });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it.each(['lit', 'angular'] as const)('W2: %s registers handlePaste / handleDrop as closures on this', (target) => {
    const code = compile(SOURCE, { target, filename: 'TipTap.rozie' }).code;
    expect(code).toMatch(/handlePaste:\s*\([^)]*\)\s*=>\s*this\.handlePaste\(/);
    expect(code).toMatch(/handleDrop:\s*\([^)]*\)\s*=>\s*this\.handleDrop\(/);
    // Never a bare member reference.
    expect(code).not.toMatch(/handlePaste:\s*this\.handlePaste\s*[,}]/);
    expect(code).not.toMatch(/handleDrop:\s*this\.handleDrop\s*[,}]/);
  });
});
