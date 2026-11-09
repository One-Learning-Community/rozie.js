// The @rozie-ui/sortable-list-lit README quick start, run as written in a
// browser against the published leaf package (no Rozie compiler on the
// consumer side). Lit only: the other five quick starts are checked by
// packages/ui/sortable-list/tests/readme-quickstart.test.ts and the
// framework typecheck harnesses.
//
//   - host/lit-quickstart.ts holds the README Usage snippet byte-for-byte;
//   - rows render with the content `rozieSlots.default` returns;
//   - a keyboard lift / move / drop works and writes `items` back through
//     `items-change`;
//   - in handle mode, a handle rendered by `rozieSlots.default` can point
//     `aria-describedby` at `instructionsId` (same shadow root);
//   - nested lists: an inner list's events stay on the inner element (Lit
//     component events do not bubble), so the outer list's listener hears
//     nothing while the inner list's own listener hears the lift.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const URL = '/lit/host/entry.lit.html?page=lit-quickstart';

async function open(page: Page) {
  await page.goto(URL);
  await page.waitForFunction(() => (window as any).__quickstartReady === true, undefined, { timeout: 15_000 });
  await page.evaluate(() => (document.querySelector('rozie-sortable-list') as any).updateComplete);
}

const rowTexts = (page: Page) =>
  page.evaluate(() =>
    [...(document.querySelector('rozie-sortable-list') as any).shadowRoot.querySelectorAll('.rozie-sortable-item')].map(
      (r: Element) => r.textContent!.trim(),
    ),
  );
const liveText = (page: Page) =>
  page.evaluate(
    () => (document.querySelector('rozie-sortable-list') as any).shadowRoot.querySelector('[aria-live]').textContent.trim(),
  );

test('the host page runs the README snippet verbatim', () => {
  const md = readFileSync(resolve(ROOT, 'packages/ui/sortable-list/packages/lit/README.md'), 'utf8');
  const snippet = md.slice(md.indexOf('\n## Usage\n')).match(/```ts\n([\s\S]*?)\n```/)![1]!;
  const host = readFileSync(resolve(HERE, '../host/lit-quickstart.ts'), 'utf8');
  const block = host.split('// --- README quick start ---\n')[1]!.split('\n// --- end README quick start ---')[0];
  expect(block).toBe(snippet);
});

test('rows render the content rozieSlots.default returns', async ({ page }) => {
  await open(page);
  expect(await rowTexts(page)).toEqual(['Apple', 'Banana']);
});

test('keyboard lift, move and drop write items back', async ({ page }) => {
  await open(page);
  await page.evaluate(() =>
    ((document.querySelector('rozie-sortable-list') as any).shadowRoot.querySelector('.rozie-sortable-item') as HTMLElement).focus(),
  );
  await page.keyboard.press('Space');
  await expect.poll(() => liveText(page)).toBe('Lifted Apple, position 1 of 2');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect.poll(() => liveText(page)).toBe('Dropped Apple at position 2 of 2');
  await expect.poll(() => rowTexts(page)).toEqual(['Banana', 'Apple']);
  const ids = await page.evaluate(() => (document.querySelector('rozie-sortable-list') as any).items.map((i: any) => i.id));
  expect(ids).toEqual(['2', '1']);
  // Nothing disappeared or duplicated.
  expect((await rowTexts(page)).sort()).toEqual(['Apple', 'Banana']);
});

test('a handle rendered by rozieSlots.default can reference instructionsId', async ({ page }) => {
  await open(page);
  const res = await page.evaluate(async () => {
    const html = (window as any).__litHtml;
    const el: any = document.querySelector('rozie-sortable-list');
    el.keyboardTrigger = 'handle';
    el.handle = '.grip';
    el.rozieSlots = {
      default: ({ item, instructionsId }: any) =>
        html`<button type="button" class="grip" aria-label=${'Reorder ' + item.label} aria-describedby=${instructionsId}>⋮⋮</button><span>${item.label}</span>`,
    };
    await el.updateComplete;
    const btn = el.shadowRoot.querySelector('.grip') as HTMLButtonElement;
    const id = btn.getAttribute('aria-describedby');
    const target = id ? (btn.getRootNode() as ShadowRoot).getElementById(id) : null;
    return { id, text: target?.textContent ?? null };
  });
  expect(res.id).toBeTruthy();
  expect(res.text).toContain('Press Space or Enter to pick up');
  await page.evaluate(() => ((document.querySelector('rozie-sortable-list') as any).shadowRoot.querySelector('.grip') as HTMLElement).focus());
  await page.keyboard.press('Enter');
  await expect.poll(() => liveText(page)).toBe('Lifted Apple, position 1 of 2');
  await page.keyboard.press('Escape');
  await expect.poll(() => rowTexts(page)).toEqual(['⋮⋮Apple', '⋮⋮Banana']);
});

test('nested lists: an inner list event does not reach the outer list’s listener', async ({ page }) => {
  await open(page);
  const seen = await page.evaluate(async () => {
    const html = (window as any).__litHtml;
    const outer: any = document.querySelector('rozie-sortable-list');
    outer.rozieSlots = {
      default: ({ item }: any) =>
        html`<span>${item.label}</span><rozie-sortable-list .itemKey=${'id'} .items=${[{ id: 'a', label: 'Inner A' }, { id: 'b', label: 'Inner B' }]} .rozieSlots=${{ default: ({ item: x }: any) => html`<span>${x.label}</span>` }}></rozie-sortable-list>`,
    };
    const outerLog: string[] = [];
    const innerLog: string[] = [];
    for (const name of ['start', 'reorder', 'end']) outer.addEventListener(name, () => outerLog.push(name));
    (window as any).__outerLog = outerLog;
    (window as any).__innerLog = innerLog;
    await outer.updateComplete;
    const inner: any = outer.shadowRoot.querySelector('rozie-sortable-list');
    await inner.updateComplete;
    for (const name of ['start', 'reorder', 'end']) inner.addEventListener(name, () => innerLog.push(name));
    (inner.shadowRoot.querySelector('.rozie-sortable-item') as HTMLElement).focus();
    return true;
  });
  expect(seen).toBe(true);
  await page.keyboard.press('Space'); // lift in the INNER list
  await expect.poll(() => page.evaluate(() => (window as any).__innerLog.length)).toBeGreaterThanOrEqual(1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__innerLog.includes('end'))).toBe(true);
  expect(await page.evaluate(() => (window as any).__innerLog[0])).toBe('start');
  expect(await page.evaluate(() => (window as any).__outerLog)).toEqual([]);
});
