import { test, expect, type Page } from '@playwright/test';
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
 *
 * Quick 260927-a2u — autofocus-timing assertions. A third cell, `auto`, sets TipTap's
 * declarative `:autofocus="true"` prop and does NOT call any focus command itself (unlike
 * `counted`, which focuses imperatively FROM its `ready` handler).
 *
 * A `document.activeElement`-polling assertion (matching the `counted`-focus poll below)
 * was tried FIRST and empirically disproven — instrumenting `requestAnimationFrame` and
 * `.focus()` via `page.addInitScript` (react + vue, ~40ms after navigation) showed
 * `@tiptap/core`'s `focus` command (`src/commands/focus.ts`) defers the actual
 * `view.focus()` call through `requestAnimationFrame` INSIDE `delayedFocus()` — a SECOND
 * deferral layered on top of `Editor.mount()`'s `setTimeout(fn, 0)` that schedules the
 * declarative `autofocus` command in the first place. `auto`'s autofocus reliably calls
 * `.focus()` first (its `mount()` macrotask needs no lazy extension) — but `counted`'s
 * handler-triggered `editor.commands.focus('end')` schedules its OWN `requestAnimationFrame`
 * that lands in the SAME frame and, since rAF callbacks run in scheduling order, fires
 * SECOND and reclaims final document focus sub-millisecond later. No `expect.poll`
 * (100ms-scale sampling) can observe that transient window, so `auto` genuinely never
 * shows up as the final `focusedTestId()` — deterministically, not flakily, on every run.
 *
 * The two assertions below are event-driven instead, proving what actually matters for the
 * todo without depending on that unobservable transient: `TipTap.rozie`'s `construct()`
 * emits Rozie's `ready` event synchronously right after `new Editor({...})` returns,
 * strictly BEFORE either deferred layer runs, so `editor.isFocused` read SYNCHRONOUSLY
 * inside the `ready` handler is always `'no'` (`auto-focused-sync`) — `ready` firing does
 * NOT mean the declarative `autofocus` prop has landed. Separately, `auto-focused-ever`
 * (TipTap's own pre-existing `focus` event) DOES turn `'yes'` shortly after, proving
 * autofocus DOES engage — it just doesn't durably win the page's focus once another
 * editor's focus request lands in the same animation frame. This closes the ambiguity the
 * original oinbox dogfooding report left unresolved, with a stronger (and less convenient)
 * answer than that report assumed. See TipTapReadyDemo.rozie's header comment for the full
 * mechanism and the measured evidence.
 */

// Walks the activeElement down through open shadow roots (Lit) and back up to the nearest
// `[data-testid]` ancestor, so a test can assert WHICH cell's editor currently holds focus
// regardless of target. Returns 'not an editor' when focus isn't inside a ProseMirror
// contenteditable, or 'no host' if no `[data-testid]` ancestor is found.
async function focusedTestId(page: Page): Promise<string> {
  return page.evaluate(() => {
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
  });
}

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
    await expect(mount.getByTestId('auto-ready')).toHaveText('ready', { timeout: 10_000 });

    // At the instant `auto`'s `ready` fired, its declarative autofocus had NOT yet landed —
    // proving `ready` fires strictly before TipTap's deferred autofocus command runs.
    await expect(mount.getByTestId('auto-focused-sync')).toHaveText('no');
    // Autofocus DOES engage shortly after (TipTap's own `focus` event fires) — even though,
    // per the header comment's measured mechanism, it does not durably win document focus.
    await expect(mount.getByTestId('auto-focused-ever')).toHaveText('yes', { timeout: 5_000 });

    // Focus requested from the `counted` handler landed in `counted`'s own editor. The
    // activeElement walk descends open shadow roots (Lit).
    await expect.poll(() => focusedTestId(page), { timeout: 5_000 }).toBe('counted');

    // The lazily-loaded CharacterCount is live: the counter renders for `counted`.
    await expect(mount.getByTestId('counted').locator('.rozie-tiptap-count')).toBeVisible();
  });
}
