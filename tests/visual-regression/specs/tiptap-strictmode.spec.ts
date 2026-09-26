import { test, expect } from '@playwright/test';

/**
 * Quick 260926 audit follow-up to quick 260925-r41 (TipTap's `ready` event).
 *
 * Reported from an audit of the maxLength / uploadImage / #floatingMenu lazy-extension
 * construction path (commit 227bf0856): React StrictMode double-invokes every effect in
 * development (mount → cleanup → mount, against the SAME component instance/fiber — NOT a
 * real unmount+remount, which would get a fresh per-instance `disposed` and never
 * reproduce this). Before the fix, `disposed` is stored per-INSTANCE (`useRef(false)`,
 * see packages/ui/tiptap/packages/react/src/TipTap.tsx ~281) and reset to `false` at the
 * TOP of every effect invocation. StrictMode's second (real) effect invocation resets the
 * SAME ref's `.current` back to `false`; when the FIRST invocation's stale
 * `.then()` (from its own Promise.all([...import()])) finally fires, it reads
 * `disposed.current === false` (reset by the second invocation) and constructs a SECOND
 * Editor onto the SAME DOM node (`$refs.editorEl` — one physical element throughout, since
 * this is a synthetic double-invoke, not a real remount) — two `.ProseMirror` divs stacked
 * in one container, and `ready` fires twice.
 *
 * This is the ONE genuinely React-specific defect of the four in this audit — no other
 * target has an equivalent forced dev-mode double-invoke of mount lifecycle hooks against
 * the same instance. See playwright.strictmode.config.ts for why this spec needs its own
 * DEV-mode webServer (StrictMode's double-invoke is a no-op in this package's normal `vite
 * build` production output).
 */

test('tiptap StrictMode [react]: the lazy-extension construction path does not double-construct under a real dev double-invoke', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // The DEV server's `base: '/react/'` (vite.config.ts, keyed on ROZIE_TARGET) serves the
  // react entry HTML at this path — unlike the production build, where build-cells.mjs
  // writes a top-level dist/index.html router that redirects `?target=` to the right
  // per-target dist subtree.
  await page.goto('/react/host/entry.react.html?example=TipTapReady&target=react&strict=1');
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();

  // The `plain` cell needs no optional extension — it constructs SYNCHRONOUSLY inside
  // the effect body, so StrictMode's mandatory cleanup-then-reinvoke sequence always
  // destroys the first Editor before the second one is built (no leak, no double DOM
  // node — the OTHER effect-body statements aren't gated on anything async). It still
  // legitimately emits `ready` TWICE (once per invocation of an effect that has a side
  // effect at all) — that's inherent, expected StrictMode double-invoke noise for ANY
  // synchronous side-effecting effect, not the regression this spec targets, so it is
  // NOT asserted on here.
  await expect(mount.getByTestId('plain-ready')).toHaveText('ready', { timeout: 10_000 });

  // The `counted` cell (maxLength → CharacterCount via dynamic import()) is where the
  // async gap lets StrictMode's stale first invocation's .then() fire AFTER the second
  // invocation has reset disposed.current — the actual regression. Unlike `plain`, the
  // FIX changes this count: the first invocation's cleanup runs (and, post-fix, marks
  // ITS OWN per-invocation `disposed` closure true) BEFORE its async .then() ever
  // settles, so post-fix it never constructs or emits at all — only the second
  // (live) invocation does, landing on "1", not "2".
  await expect(mount.getByTestId('counted-ready')).toHaveText('ready', { timeout: 10_000 });
  await expect
    .poll(() => mount.getByTestId('counted-ready-count').textContent(), { timeout: 5_000 })
    .toBe('1');

  // Two Editors constructed onto the SAME element would each append their own
  // `.ProseMirror` contenteditable div — the literal "two Editors on one DOM node"
  // failure mode described in the audit.
  await expect(mount.getByTestId('counted').locator('.ProseMirror')).toHaveCount(1);

  expect(pageErrors).toEqual([]);
});
