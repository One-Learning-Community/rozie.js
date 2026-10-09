import { test, expect, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/tiptap `uploadImage` — pasting or dropping several image files.
 *
 * Every image file is handed to `uploadImage` at once, each image is inserted
 * as its own upload settles, in FILE ORDER with the alt text the hook returns
 * (although the first upload is the slowest), all in the container they were
 * pasted into, a failed upload is skipped, and the caret is left as a text
 * cursor after the last image — unless the user moved it while the upload ran.
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

  runner(`tiptap-image-upload [${target}]: images pasted into a list item all stay in that item`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapImageUpload&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    const editor = mount.getByTestId('upload-editor-list').locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Caret at the end of the first item's text.
    await editor.locator('li').first().locator('p').first().click();
    await page.keyboard.press('End');
    await dispatchImages(editor, 'paste', ['a.png', 'b.png']);

    const first = editor.locator('ul > li').first();
    const second = editor.locator('ul > li').nth(1);
    await expect
      .poll(() => first.locator('img').evaluateAll((els) => els.map((e) => e.getAttribute('alt'))))
      .toEqual(['a.png', 'b.png']);
    // Nothing leaks into the neighbouring item: no image, no extra paragraph.
    await expect(editor.locator('ul > li')).toHaveCount(2);
    await expect(second.locator('img')).toHaveCount(0);
    await expect(second.locator('p')).toHaveCount(1);
    await expect(second).toHaveText('two');

    // The caret is after the last image, still inside the first item.
    await page.keyboard.type('mark');
    await expect(first.locator('img')).toHaveCount(2);
    await expect(first).toContainText('mark');
    await expect(second).toHaveText('two');
  });

  runner(`tiptap-image-upload [${target}]: a caret moved while the upload runs is left where the user put it`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapImageUpload&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    const editor = mount.getByTestId('upload-editor').locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.locator('p').first().click();
    await page.keyboard.press('End');
    // `wait-` uploads take a second: time to move the caret before the image lands.
    await dispatchImages(editor, 'paste', ['wait-a.png']);
    await page.keyboard.press('Home');
    await expect(editor.locator('img')).toHaveCount(0);

    await expect.poll(imageAlts(editor)).toEqual(['wait-a.png']);
    await expect(editor.locator('img.ProseMirror-selectednode')).toHaveCount(0);

    // Typing continues at the start of the line, where the user moved the caret.
    await page.keyboard.type('mark');
    await expect(editor.locator('p').first()).toHaveText('marktext');
    await expect(editor.locator('img')).toHaveCount(1);
  });
}
