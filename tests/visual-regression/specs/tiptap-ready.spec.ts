import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260925-r41 — TipTap's `ready` event (examples/demos/TipTapReadyDemo.rozie).
 *
 * Reported from dogfooding (oinbox): a consumer couldn't tell when focusEditor() would work
 * and waited two animation frames. `ready` fires once the editor exists, carrying the Editor.
 * The demo covers both construction paths — `plain` (built synchronously at mount) and
 * `counted` (maxLength → CharacterCount loaded with a dynamic import() first, so the editor
 * is built a tick later). `counted` focuses its editor from inside the handler: that must
 * land focus in its own contenteditable, on every target.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  (built ? test : test.fixme)(`tiptap ready [${target}]: fires with the Editor on both construction paths; focusing from it works`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapReady&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    await expect(mount.getByTestId('plain-ready')).toHaveText('ready', { timeout: 10_000 });
    await expect(mount.getByTestId('counted-ready')).toHaveText('ready', { timeout: 10_000 });

    // Focus requested from the `counted` handler landed in `counted`'s own editor. The
    // activeElement walk descends open shadow roots (Lit).
    await expect
      .poll(() =>
        page.evaluate(() => {
          let a: Element | null = document.activeElement;
          while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
          if (!a?.classList.contains('ProseMirror')) return 'not an editor';
          // closest() stops at a shadow root (Lit): climb through shadow hosts to the demo's wrapper.
          let n: Element | null = a;
          while (n) {
            const hit = n.closest('[data-testid]');
            if (hit) return hit.getAttribute('data-testid');
            const root = n.getRootNode();
            n = root instanceof ShadowRoot ? root.host : null;
          }
          return 'no host';
        }),
      { timeout: 5_000 })
      .toBe('counted');

    // The lazily-loaded CharacterCount is live: the counter renders for `counted`.
    await expect(mount.getByTestId('counted').locator('.rozie-tiptap-count')).toBeVisible();
  });
}
