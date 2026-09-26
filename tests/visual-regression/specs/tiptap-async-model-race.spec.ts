import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260926 audit follow-up to quick 260925-r41 (TipTap's `ready` event).
 *
 * Reported from the same audit as tiptap-remount-race.spec.ts: `setContent()` /
 * `clearContent()` return early on `!editor` (TipTap.rozie ~1134-1153), so a consumer
 * write during the async construction gap (`maxLength` → CharacterCount loaded via
 * dynamic import() before the Editor exists) was silently DROPPED — the eventual
 * `ready` payload's `getHTML()` still showed the ORIGINAL seed, not the write.
 *
 * `examples/demos/TipTapAsyncModelRaceDemo.rozie` calls the child's exposed
 * `setContent()` handle from its own `$onMount`, deferred by one microtask (see that
 * file's header for why a bare same-tick call would silently no-op on Solid) — still
 * strictly before the child's maxLength-triggered import() can possibly settle. Once
 * `ready` fires, the demo records `editor.getHTML()`. Before the fix this is the
 * untouched original seed; after the fix (setContent updates the model even
 * pre-construction, and construct() reads the html model fresh) it reflects the
 * injected write.
 *
 * Angular's component ref resolves to the host element, not the exposed handle (the
 * documented per-target idiom — same gate as tiptap.spec.ts's $expose section), so
 * `$refs.ed?.setContent?.()` is a harmless no-op there; this spec excludes Angular.
 */

const TARGETS = ['vue', 'react', 'svelte', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  (built ? test : test.fixme)(`tiptap async model race [${target}]: a setContent() write during the construction gap is not dropped`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapAsyncModelRace&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    await expect
      .poll(() => mount.getByTestId('final-html').textContent(), { timeout: 10_000 })
      .toContain('INJECTED BEFORE READY');
  });
}
