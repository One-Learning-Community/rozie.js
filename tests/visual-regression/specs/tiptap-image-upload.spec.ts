import { test, expect, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/tiptap `uploadImage` — pasting or dropping several image files.
 *
 * Every image file is handed to `uploadImage` at once, the images are inserted
 * in FILE ORDER with the alt text the hook returns (although the first upload
 * is the slowest), a failed upload is skipped, and the caret is left as a text
 * cursor after the last image.
 *
 * BEHAVIOR-ONLY: readouts and DOM state, never a screenshot. Typing with the
 * REAL keyboard is the point: a node-selected image is replaced by the first
 * key typed, which is exactly the bug this cell guards.
 *
 * Also the only real-browser proof on Lit, where the paste/drop handlers used
 * to be handed to ProseMirror as unbound prototype methods.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return built ? test : test.fixme;
}

// Builds a real DataTransfer holding one `image/png` File per name inside the
// page, then dispatches a ClipboardEvent('paste') or a DragEvent('drop') on the
// editor element. Both bubble and are cancelable. The drop lands a few pixels
// inside the right end of the editor's first line.
async function dispatchImages(editor: Locator, kind: 'paste' | 'drop', names: string[]) {
  await editor.evaluate(
    (el, args) => {
      const dt = new DataTransfer();
      for (const name of args.names) {
        dt.items.add(new File(['x'], name, { type: 'image/png' }));
      }
      if (args.kind === 'paste') {
        el.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
        );
        return;
      }
      const line = (el.firstElementChild as HTMLElement | null) ?? (el as HTMLElement);
      const r = line.getBoundingClientRect();
      el.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: dt,
          clientX: Math.max(r.left + 1, r.right - 4),
          clientY: r.top + r.height / 2,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { kind, names },
  );
}

const imageAlts = (editor: Locator) => () =>
  editor.locator('img').evaluateAll((els) => els.map((e) => e.getAttribute('alt')));

for (const target of TARGETS) {
  const runner = runnerFor(target);

  runner(`tiptap-image-upload [${target}]: paste uploads every image in file order and typing keeps them`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapImageUpload&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    const editor = mount.getByTestId('upload-editor').locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await dispatchImages(editor, 'paste', ['slow-a.png', 'b.png', 'bad-c.png', 'd.png']);

    // File order although the first upload settles last; the rejected one skipped.
    await expect.poll(imageAlts(editor)).toEqual(['slow-a.png', 'b.png', 'd.png']);
    await expect(mount.getByTestId('readout-uploads')).toHaveText(
      'slow-a.png,b.png,bad-c.png,d.png',
    );
    await expect(editor.locator('img.ProseMirror-selectednode')).toHaveCount(0);

    await expect(editor).toBeFocused();
    await page.keyboard.type('mark');
    await expect(editor.locator('img')).toHaveCount(3);
    await expect(editor).toContainText('mark');
  });

  runner(`tiptap-image-upload [${target}]: drop uploads every image in file order and typing keeps them`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapImageUpload&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    const editor = mount.getByTestId('upload-editor').locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // No click first: a drop must work on an editor that has never had focus.
    await dispatchImages(editor, 'drop', ['a.png', 'b.png']);

    await expect.poll(imageAlts(editor)).toEqual(['a.png', 'b.png']);
    await expect(editor.locator('img.ProseMirror-selectednode')).toHaveCount(0);

    await expect(editor).toBeFocused();
    await page.keyboard.type('mark');
    await expect(editor.locator('img')).toHaveCount(2);
    await expect(editor).toContainText('mark');
  });
}
