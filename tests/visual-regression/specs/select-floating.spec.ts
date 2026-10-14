import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select floating popup — the popup is positioned by the composed
 * @rozie-ui/popover leaf (Floating UI). Driven against
 * examples/demos/SelectFloatingDemo.rozie on all 6 targets.
 *
 * Positioning runs through requestAnimationFrame and needs a real layout engine,
 * so this is the only place the placement, the flip and the width match can be
 * proven. Behavioral assertions only (no screenshots). CSS / role locators pierce
 * Lit's open shadow roots.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  runner(`select-floating [${target}]: popup is positioned below, matches control width, flips above near the viewport bottom`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 600 });
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const top = page.getByTestId('top-select');
    await top.locator('[role="combobox"]').click();
    const list = top.locator('[role="listbox"]');
    await expect(list).toBeVisible();
    const c = await top.locator('.rozie-select-control').boundingBox();
    const l = await list.boundingBox();
    expect(l!.y).toBeGreaterThanOrEqual(c!.y + c!.height);          // below
    expect(Math.abs(l!.width - c!.width)).toBeLessThanOrEqual(1);   // width-matched
    expect(Math.abs(l!.x - c!.x)).toBeLessThanOrEqual(1);           // bottom-START: left edges meet
    expect(Math.abs(l!.y - (c!.y + c!.height) - 4)).toBeLessThanOrEqual(1); // the default 4px offset
    await page.keyboard.press('Escape');

    const bottom = page.getByTestId('bottom-select');
    await bottom.locator('[role="combobox"]').click();
    const bl = bottom.locator('[role="listbox"]');
    await expect(bl).toBeVisible();
    const bc = await bottom.locator('.rozie-select-control').boundingBox();
    await expect.poll(async () => { const b = await bl.boundingBox(); return b!.y + b!.height <= bc!.y + 1; }).toBe(true); // flipped above
    await page.keyboard.press('Escape');
    await expect(bl).toHaveCount(0);

    // disable-flip, at the SAME height as the select that just flipped: the popup stays
    // below its control although it does not fit there.
    const noflip = page.getByTestId('noflip-select');
    const nc = await noflip.locator('.rozie-select-control').boundingBox();
    expect(Math.abs(nc!.y - bc!.y)).toBeLessThanOrEqual(1);          // same row as bottom-select
    await noflip.locator('[role="combobox"]').click();
    const nl = noflip.locator('[role="listbox"]');
    await expect(nl).toBeVisible();
    const below = async () => { const b = await nl.boundingBox(); return !!b && b.y >= nc!.y + nc!.height - 1; };
    await expect.poll(below).toBe(true);
    const nb = await nl.boundingBox();
    expect(nb!.y + nb!.height).toBeGreaterThan(600);                 // it really does not fit in the viewport
    await page.waitForTimeout(300);                                   // …and it does not flip a moment later
    expect(await below()).toBe(true);
  });

  runner(`select-floating [${target}]: a non-default placement and offset take effect`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('placed-select');
    await wrap.locator('[role="combobox"]').click();
    const list = wrap.locator('[role="listbox"]');
    await expect(list).toBeVisible();
    const c = await wrap.locator('.rozie-select-control').boundingBox();
    // There is room below as well (so "above" is the placement prop, not a flip).
    const vh = page.viewportSize()!.height;
    // placement="top-start": above the control; offset=24: exactly that far from it.
    await expect.poll(async () => { const l = await list.boundingBox(); return !!l && Math.abs(c!.y - (l.y + l.height) - 24) <= 1; }).toBe(true);
    const l = await list.boundingBox();
    expect(vh - (c!.y + c!.height)).toBeGreaterThan(l!.height + 24);
    expect(l!.y).toBeGreaterThanOrEqual(0);
    expect(Math.abs(l!.x - c!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(l!.width - c!.width)).toBeLessThanOrEqual(1);
  });

  runner(`select-floating [${target}]: outside click closes only the clicked-away select; ids stay unique`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const a = page.getByTestId('top-select').locator('[role="combobox"]');
    const b = page.getByTestId('second-select').locator('[role="combobox"]');
    // Every id on the page that a select or its composed popover generated (walking open
    // shadow roots), and — per select trigger — how many elements in the trigger's own
    // tree its `aria-controls` names.
    const audit = () =>
      page.evaluate(() => {
        const ids: string[] = [];
        const triggers: { label: string | null; expanded: string | null; controls: string | null; hits: number }[] = [];
        const walk = (root: Document | ShadowRoot) => {
          // Generated ids (by prefix) and every id inside a select, whatever its base.
          root.querySelectorAll('[id]').forEach((e) => {
            if (e.id.startsWith('rozie-select') || e.id.startsWith('rozie-popover') || e.closest('.rozie-select')) ids.push(e.id);
          });
          root.querySelectorAll('.rozie-select-trigger[role="combobox"]').forEach((t) => {
            const controls = t.getAttribute('aria-controls');
            const scope = t.getRootNode() as Document | ShadowRoot;
            triggers.push({
              label: t.getAttribute('aria-label'),
              expanded: t.getAttribute('aria-expanded'),
              controls,
              hits: controls ? scope.querySelectorAll(`[id="${controls}"]`).length : -1,
            });
          });
          root.querySelectorAll('*').forEach((e) => { if ((e as HTMLElement).shadowRoot) walk((e as HTMLElement).shadowRoot!); });
        };
        walk(document);
        return { ids, triggers };
      });
    const check = async (open: string) => {
      const { ids, triggers } = await audit();
      // The scan sees the selects and at least the open list and its options.
      expect(triggers.length).toBe(8);
      expect(ids.length).toBeGreaterThan(5);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'duplicated ids').toEqual([]);
      // Every trigger names its own popup, and no two triggers name the same one.
      const controls = triggers.map((t) => t.controls);
      expect(controls.every((c) => !!c && c.endsWith('-list'))).toBe(true);
      expect(new Set(controls).size).toBe(controls.length);
      for (const t of triggers) {
        if (t.label === open) {
          expect(t.expanded).toBe('true');
          expect(t.hits, `aria-controls of the open select "${t.label}"`).toBe(1);
        } else if (t.label === 'Virtual') {
          expect(t.hits, 'the windowed list stays mounted while closed').toBe(1);
        } else {
          expect(t.expanded).toBe('false');
          expect(t.hits, `aria-controls of the closed select "${t.label}"`).toBe(0); // its list is not rendered
        }
      }
    };
    await a.click();
    await expect(a).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('top-select').locator('[role="option"]')).toHaveCount(5);
    await check('Top');
    await b.click();
    await expect(a).toHaveAttribute('aria-expanded', 'false');
    await expect(b).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('second-select').locator('[role="option"]')).toHaveCount(5);
    await expect(page.getByTestId('top-select').locator('[role="listbox"]')).toHaveCount(0);
    await check('Second');
    await page.mouse.click(5, 5);
    await expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  runner(`select-floating [${target}]: open-change fires exactly once per transition, whoever closes the popup`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const top = page.getByTestId('top-select');
    const trigger = top.locator('[role="combobox"]');
    const list = top.locator('[role="listbox"]');
    const log = page.getByTestId('readout-log');
    // The log holds one letter per open-change event: T = { open: true }, F = { open: false }.
    // `settled` waits long enough for a late duplicate (a deferred dismissal, a second
    // watcher pass) to land before the exact string is asserted.
    const settled = async (want: string) => {
      await expect(log).toHaveText(want);
      await page.waitForTimeout(250);
      await expect(log).toHaveText(want);
    };
    await expect(trigger).toBeVisible();
    await settled('');

    // open by click → close by outside click (the popover's own dismissal)
    await trigger.click();
    await expect(list).toBeVisible();
    await settled('T');
    await page.mouse.click(5, 5);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);
    await settled('TF');

    // open by keyboard → close by Escape on the focused trigger (the key handler and
    // the popover's document-level Escape both see this key)
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled('TFT');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled('TFTF');
    // Escape did not re-open it, and the keyboard still works (focus stayed on the trigger).
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The highlight was reset by the close: it starts again from the first option.
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled('TFTFT');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-1$/);

    // close by clicking the control itself
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled('TFTFTF');

    // the exposed toggle(): open, then close
    const toggle = page.getByTestId('toggle-top');
    await toggle.focus();
    await page.keyboard.press('o');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(list).toBeVisible();
    await settled('TFTFTFT');
    await page.keyboard.press('o');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled('TFTFTFTF');

    // open through the handle, then Escape while focus is OUTSIDE the select: only the
    // popover's document-level Escape sees it.
    await page.keyboard.press('o');
    await expect(list).toBeVisible();
    await settled('TFTFTFTFT');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);
    await settled('TFTFTFTFTF');
    // The highlight was reset by that close too.
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled('TFTFTFTFTFT');

    // picking an option closes once
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled('TFTFTFTFTFTF');

    // Back-to-back opens and closes with no settling in between: every transition is
    // still reported exactly once, and the popup ends in the state the last key asked for.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
    }
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);
    await settled('TFTFTFTFTFTF' + 'TFTF'.repeat(8));
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(list).toBeVisible();
    await settled('TFTFTFTFTFTF' + 'TFTF'.repeat(8) + 'T');
  });

  runner(`select-floating [${target}]: focus stays on the trigger when the popup opens and closes (keyboard keeps working after a click)`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('second-select');
    const trigger = wrap.locator('[role="combobox"]');
    await trigger.click();
    await expect(wrap.locator('[role="listbox"]')).toBeVisible();
    await expect(trigger).toBeFocused();
    // No focus() call from here on: every key must reach the trigger the click focused.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-\d$/);
    const active = await trigger.getAttribute('aria-activedescendant');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).not.toHaveAttribute('aria-activedescendant', active!);
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    await expect(trigger).not.toHaveText('');
  });

  runner(`select-floating [${target}]: block fills the container and the popup follows`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('block-select');
    await wrap.locator('[role="combobox"]').click();
    const list = wrap.locator('[role="listbox"]');
    await expect(list).toBeVisible();
    const w = await wrap.boundingBox();
    const c = await wrap.locator('.rozie-select-control').boundingBox();
    expect(Math.abs(c!.width - w!.width)).toBeLessThanOrEqual(1);
    expect(w!.width).toBeGreaterThan(400); // wider than the default 16rem control: `block` did something
    await expect.poll(async () => { const l = await list.boundingBox(); return Math.abs(l!.width - c!.width) <= 1; }).toBe(true);
    // …and it sits directly below the control, left edges aligned.
    await expect.poll(async () => { const l = await list.boundingBox(); return !!l && Math.abs(l.y - (c!.y + c!.height) - 4) <= 1 && Math.abs(l.x - c!.x) <= 1; }).toBe(true);
  });

  runner(`select-floating [${target}]: a windowed (virtual) list floats, stays mounted while closed, and navigates`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('virtual-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    // Mounted but hidden while closed (the virtualizer needs its scroll element).
    await expect(list).toHaveCount(1);
    await expect(list).toBeHidden();
    await trigger.click();
    await expect(list).toBeVisible();
    const options = wrap.locator('[role="option"]');
    await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    expect(await options.count()).toBeLessThan(60); // a window, not 500 rows
    const c = await wrap.locator('.rozie-select-control').boundingBox();
    await expect.poll(async () => { const l = await list.boundingBox(); return !!l && l.y >= c!.y + c!.height && Math.abs(l.width - c!.width) <= 1; }).toBe(true);
    // The window follows the scroll position inside the floated panel.
    await list.evaluate((el) => { el.scrollTop = 6000; });
    await expect
      .poll(async () => options.evaluateAll((els) => els.some((e) => Number(e.getAttribute('data-index')) > 100)), { timeout: 15_000 })
      .toBe(true);
    await list.evaluate((el) => { el.scrollTop = 0; });
    await expect(wrap.locator('[role="option"][data-index="0"]')).toBeVisible();
    // Keyboard navigation and commit.
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-2$/);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('Option 3');
    // Closed: hidden, still mounted; it opens again with its window intact.
    await expect(list).toBeHidden();
    await expect(list).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(0);
  });

  runner(`select-floating [${target}]: a windowed list opened with a selection far down shows it, and aria-activedescendant names a rendered option`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('virtual-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    await expect(list).toHaveCount(1);
    await page.getByTestId('pick-far-virtual').click();
    await expect(trigger).toContainText('Option 400');
    // How many elements in the trigger's own tree carry the id it names.
    const named = () => trigger.evaluate((t) => {
      const id = t.getAttribute('aria-activedescendant');
      return id ? (t.getRootNode() as Document | ShadowRoot).querySelectorAll(`[id="${id}"]`).length : -1;
    });
    const selectedInView = async () => {
      const l = await list.boundingBox();
      const row = wrap.locator('[role="option"][data-index="399"]');
      if ((await row.count()) !== 1) return false;
      const o = await row.boundingBox();
      return !!l && !!o && o.y >= l.y - 1 && o.y + o.height <= l.y + l.height + 1;
    };
    // Opened by click — no key is pressed afterwards.
    await trigger.click();
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-399$/);
    await expect.poll(selectedInView, { timeout: 15_000 }).toBe(true);
    await expect.poll(named).toBe(1);
    await expect(wrap.locator('[role="option"][data-index="399"]')).toHaveAttribute('aria-selected', 'true');
    // Closed and opened by key: the same.
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await list.evaluate((el) => { el.scrollTop = 0; });
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect.poll(selectedInView, { timeout: 15_000 }).toBe(true);
    await expect.poll(named).toBe(1);
  });

  runner(`select-floating [${target}]: custom #option content renders inside the floated list and picks`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('nested-outer');
    const trigger = wrap.locator('[role="combobox"]');
    await trigger.click();
    const options = wrap.locator('[role="option"]');
    await expect(options).toHaveCount(5);
    await expect(options.nth(2)).toHaveText('Cherry');
    await options.nth(2).click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('Cherry');
  });
}
