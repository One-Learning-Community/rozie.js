// @vitest-environment happy-dom
/**
 * image-upload-chunk-failure.behavior.test.ts — what `uploadImage` paste/drop
 * does when the optional `@tiptap/extension-image` chunk fails to load.
 *
 * The component lazily `import()`s the image extension when `uploadImage` is
 * set. A file-level mock whose factory throws makes that import reject: the
 * editor still constructs, emits `error` with `{ extension: 'image' }`, emits
 * `ready`, and its schema has no `image` node. The handlers must then never call
 * `uploadImage`. A paste is left to ProseMirror (claiming it would replace a
 * selection with nothing, T-mmv-04). A drop that carries image files is
 * swallowed: left alone, the browser's default would navigate the tab to the
 * dropped file.
 *
 * It lives in its own file because the mock is file-level; it only intercepts
 * when this file resolves the package from the same place as the compiled
 * component, which holds for a test under packages/ui/tiptap/tests/.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import type { App } from 'vue';
// @ts-expect-error — virtual module provided by vitest.config.ts (TipTap.rozie compiled to Vue)
import TipTap from 'virtual:tiptap-vue-from-source';

vi.mock('@tiptap/extension-image', () => {
  throw new Error('chunk failed');
});

const apps: App[] = [];
const hosts: HTMLElement[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

async function mountEditor(props: Record<string, unknown>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  let editor: any = null;
  const errors: any[] = [];
  let readyCount = 0;
  const app = createApp({
    render: () =>
      h(TipTap, {
        ...props,
        onReady: (ed: any) => {
          readyCount++;
          editor = ed;
        },
        onError: (payload: any) => {
          errors.push(payload);
        },
      }),
  });
  app.mount(host);
  apps.push(app);
  await vi.waitFor(() => {
    if (!editor) throw new Error('editor not ready');
  });
  return { editor, errors, readyCount: () => readyCount };
}

function imageFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

function fileEvent(kind: 'paste' | 'drop', files: File[], text: string): Event {
  const ev = new Event(kind, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, kind === 'paste' ? 'clipboardData' : 'dataTransfer', {
    value: {
      files,
      types: text ? ['Files', 'text/plain'] : ['Files'],
      getData: (type: string) => (type === 'text/plain' || type === 'Text' ? text : ''),
    },
  });
  if (kind === 'drop') {
    Object.defineProperty(ev, 'clientX', { value: 0 });
    Object.defineProperty(ev, 'clientY', { value: 0 });
  }
  return ev;
}

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

describe('uploadImage without the image extension', () => {
  it('C1: the editor still constructs; error fires for image; no image node in the schema', async () => {
    const calls: string[] = [];
    const { editor, errors, readyCount } = await mountEditor({
      html: '<p>text</p>',
      uploadImage: (f: File) => {
        calls.push(f.name);
        return Promise.resolve('https://cdn.test/x.png');
      },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].extension).toBe('image');
    expect(readyCount()).toBe(1);
    expect(editor.schema.nodes.image).toBeUndefined();
  });

  it('C2: an image paste is left to ProseMirror, which pastes the text', async () => {
    const calls: string[] = [];
    const { editor } = await mountEditor({
      html: '<p>text</p>',
      uploadImage: (f: File) => {
        calls.push(f.name);
        return Promise.resolve('https://cdn.test/x.png');
      },
    });
    editor.commands.setTextSelection(5);
    editor.view.dom.dispatchEvent(fileEvent('paste', [imageFile('a.png')], ' pasted'));
    await settle();
    expect(calls).toEqual([]);
    expect(editor.getHTML()).toBe('<p>text pasted</p>');
  });

  it('C3: an image drop is swallowed (no browser file navigation) and nothing is uploaded', async () => {
    const calls: string[] = [];
    const { editor } = await mountEditor({
      html: '<p>text</p>',
      uploadImage: (f: File) => {
        calls.push(f.name);
        return Promise.resolve('https://cdn.test/x.png');
      },
    });
    editor.view.posAtCoords = () => ({ pos: 5, inside: -1 });
    const ev = fileEvent('drop', [imageFile('a.png')], '');
    editor.view.dom.dispatchEvent(ev);
    await settle();
    expect(calls).toEqual([]);
    expect(editor.getHTML()).toBe('<p>text</p>');
    // Nobody else prevents a files-only drop: ProseMirror parses no slice from
    // it and returns early, so the browser would navigate the tab to the file.
    expect(ev.defaultPrevented).toBe(true);
  });

  it('C4: a drop with no image file is still left to ProseMirror', async () => {
    const calls: string[] = [];
    const { editor } = await mountEditor({
      html: '<p>text</p>',
      uploadImage: (f: File) => {
        calls.push(f.name);
        return Promise.resolve('https://cdn.test/x.png');
      },
    });
    editor.view.posAtCoords = () => ({ pos: 5, inside: -1 });
    const ev = fileEvent('drop', [new File(['x'], 'note.txt', { type: 'text/plain' })], ' dropped');
    editor.view.dom.dispatchEvent(ev);
    await settle();
    expect(calls).toEqual([]);
    // ProseMirror's own text drop ran (it prevents the default itself).
    expect(editor.getHTML()).toBe('<p>text dropped</p>');
  });
});
