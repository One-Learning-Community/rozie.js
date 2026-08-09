import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * `#linkEditor` consumer-override + open-surface proving spec (quick 260809-6zp,
 * residuals 1-3 of the shipped `260721-liz` TipTap link editor).
 *
 * Leg A — over the `TipTapLinkEditor` cell (D-01, residual 1): the reactive
 * `#linkEditor` portal-slot override path was proven on Vue only (Spike 016 +
 * a runtime smoke) when it shipped; Svelte 5 and Solid were never runtime-
 * proven. This spec runs all 6 targets and MUST NOT `test.fixme`/`KNOWN_FAILING`
 * Svelte or Solid — a real failure there is the exact regression this quick
 * exists to catch, and must be fixed red-first at the component or emitter seam
 * (never silently gated).
 *
 * `TipTapLinkEditorDemo.rozie` fills `#linkEditor` with a consumer fragment
 * (`[data-testid=le-form]`) that REPLACES the built-in link form entirely. The
 * seed doc's first paragraph STARTS with a known link
 * (`https://rozie.dev/docs`, the D-05 zero-interaction-open trick, so the
 * fragment is already mounted at page load); the second paragraph is link-free.
 *
 * IMPORTANT — the surface is link-anchored BY DESIGN (TipTap.rozie's own
 * comment: "it stays while the caret is on a link and hides once ... the
 * caret is off any link"): its `shouldShow` is `isActive('link') || openFlag`,
 * and the plugin's hide path calls `element.remove()` — genuine DOM removal,
 * not a CSS `display:none`. So "the caret moves ... off a link" is proven by
 * the surface (and `le-form` inside it) disappearing entirely, NOT by an
 * empty `data-href` on a still-visible form. Re-entering the link then proves
 * the Spike-016 claim concretely: the SAME underlying fragment DOM node comes
 * back (survives the extension's detach/`element.remove()` + reattach cycle),
 * not a fresh remount.
 *
 * Leg B — over the `TipTapLinkEditorScreenshot` cell (guards D-02's precondition,
 * on macOS, before the Linux-Docker pixel baseline exists): the OPEN link-editor
 * surface opens with ZERO interaction (D-05 — the seed doc's first textblock
 * STARTS with a link) and its built-in input is prefilled from that link's href
 * (the D-04 mount-time prefill fix). This makes the pixel cell's "open and
 * prefilled" precondition permanently guarded by a behavioral assertion, not
 * only implicitly baked into a PNG.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const SEED_HREF = 'https://rozie.dev/docs';
const NEXT_HREF = 'https://rozie.dev/blog';

// MUST stay empty — a real Svelte/Solid failure here is the residual this quick
// exists to close; fix it red-first at the component or emitter seam.
const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>([]);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`tiptap-link-editor [${target}]: #linkEditor consumer override — mounts, reactive in-place update, setLink/unsetLink/close mutate + dismiss`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapLinkEditor&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // ---- 1. the consumer fragment mounted INSTEAD OF the built-in form ----
    // (D-05: the seed doc's first paragraph STARTS with the link, so the
    // fragment is already showing at mount with zero interaction.)
    const form = mount.getByTestId('le-form');
    await expect(form).toBeVisible({ timeout: 10_000 });
    await expect(form).toHaveAttribute('data-href', SEED_HREF);
    // The built-in form's input is completely absent — the override REPLACED
    // it, not rendered alongside it.
    await expect(page.locator('.rozie-tiptap-link-input')).toHaveCount(0);

    // Capture the fragment's underlying DOM node — it must be the SAME node
    // every time the surface re-shows (in-place re-render, no remount).
    const formNodeBefore = await form.elementHandle();
    expect(formNodeBefore).toBeTruthy();

    // ---- 2. caret off the link → the link-anchored surface closes ----
    // shouldShow is `isActive('link') || openFlag`; off any link with no
    // create-mode flag, the plugin's hide path calls `element.remove()` —
    // absence, not merely invisibility.
    await mount.getByTestId('le-caret-off').click();
    await expect(page.locator('.rozie-tiptap-link-editor')).toHaveCount(0, {
      timeout: 5_000,
    });

    // ---- 3. caret back onto the link → re-renders IN PLACE, not a remount ----
    // Spike 016's claim made concrete: the reactive portal survives the bubble-
    // menu extension's detach (element.remove()) + reattach cycle — the SAME
    // underlying fragment DOM node comes back, carrying the live href again.
    await mount.getByTestId('le-caret-in').click();
    await expect(form).toBeVisible({ timeout: 5_000 });
    await expect
      .poll(async () => await form.getAttribute('data-href'), {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toBe(SEED_HREF);
    {
      const now = await form.elementHandle();
      const same = await page.evaluate(
        ([x, y]) => x === y,
        [formNodeBefore, now] as const,
      );
      expect(same).toBe(true);
    }

    // ---- 4. setLink from the fragment mutates the document ----
    await mount.getByTestId('le-apply').click();
    await expect
      .poll(async () => (await mount.getByTestId('le-html').textContent()) ?? '', {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toContain(NEXT_HREF);
    await expect(mount.getByTestId('le-html')).toContainText('_blank');

    // ---- 5. unsetLink from the fragment removes the link ----
    await mount.getByTestId('le-unset').click();
    await expect
      .poll(async () => (await mount.getByTestId('le-html').textContent()) ?? '', {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .not.toContain('<a ');

    // ---- 6. close from the fragment dismisses the surface ----
    // Move off any link, enter create mode via the built-in toolbar Link
    // button (the toolbar is NOT overridden by this demo), confirm the surface
    // opens, then dismiss it from the fragment's own close() verb.
    await mount.getByTestId('le-select-plain').click();
    // exact: true — otherwise Playwright's substring role-name match also
    // catches this demo's own "Caret into link" / "Caret off link" drivers.
    await mount.getByRole('button', { name: 'Link', exact: true }).click();
    await expect(page.locator('.rozie-tiptap-link-editor')).toBeVisible({
      timeout: 10_000,
    });
    await mount.getByTestId('le-close').click();
    // The plugin's hide path calls element.remove() — absence, not merely
    // invisibility, is the crisp assertion.
    await expect(page.locator('.rozie-tiptap-link-editor')).toHaveCount(0, {
      timeout: 10_000,
    });
  });
}

/**
 * Leg B — guards the OPEN-surface pixel cell's precondition (D-02/D-05): the
 * link-editor surface opens with ZERO interaction over a seed doc whose first
 * textblock starts with a link, and its built-in input is prefilled from that
 * link's href (the D-04 mount-time prefill fix). Structural/DOM assertions
 * only — no screenshots here (the pixel tier is the SEPARATE
 * TipTapLinkEditorScreenshot leg in matrix.spec.ts).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`tiptap-link-editor [${target}]: open-surface precondition — opens on mount with zero interaction, prefilled`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapLinkEditorScreenshot&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await editor.textContent()) ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400],
      })
      .toContain('Rozie docs');

    // Opens with ZERO interaction — no click, no focus.
    await expect(page.locator('.rozie-tiptap-link-editor')).toBeVisible({
      timeout: 10_000,
    });
    // The D-04 prefill fix: the built-in input already carries the seed link's
    // href rather than rendering empty.
    await expect(page.locator('.rozie-tiptap-link-input')).toHaveValue(
      SEED_HREF,
      { timeout: 10_000 },
    );
  });
}
