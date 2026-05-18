// Capture current matrix screenshots to /tmp/rozie-vr-current/<Component>/<target>.png
// User-requested layout (component first, target second) for side-by-side viewing.
// Sources match the live matrix.spec.ts EXAMPLES + TARGETS list.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const EXAMPLES = [
  'Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal',
  'TreeNode', 'Card', 'CardHeader', 'ModalConsumer', 'PortalList',
];
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

const OUT_ROOT = process.env.OUT_ROOT || '/tmp/rozie-vr-current';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4180';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});

let ok = 0, fail = 0;
const failures = [];

for (const example of EXAMPLES) {
  const exDir = resolve(OUT_ROOT, example);
  mkdirSync(exDir, { recursive: true });
  for (const target of TARGETS) {
    const page = await ctx.newPage();
    let pageError = null;
    page.on('pageerror', (e) => (pageError ??= e.message));
    try {
      await page.goto(`${BASE_URL}/?example=${example}&target=${target}`, {
        waitUntil: 'networkidle',
        timeout: 15_000,
      });
      const mount = page.getByTestId('rozie-mount');
      await mount.waitFor({ state: 'visible', timeout: 5_000 });
      const out = resolve(exDir, `${target}.png`);
      await mount.screenshot({ path: out, animations: 'disabled' });
      ok++;
      process.stdout.write(`✓ ${example.padEnd(14)} ${target.padEnd(8)} -> ${out}\n`);
    } catch (err) {
      fail++;
      failures.push({ example, target, err: err.message.split('\n')[0], pageError });
      process.stdout.write(
        `✗ ${example.padEnd(14)} ${target.padEnd(8)} :: ${err.message.split('\n')[0]}` +
          (pageError ? ` (pageerror: ${pageError.split('\n')[0]})` : '') +
          '\n',
      );
    } finally {
      await page.close();
    }
  }
}

await browser.close();

console.log(`\n${ok} captured, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(` - ${f.example} · ${f.target}: ${f.err}${f.pageError ? ` | pageerror: ${f.pageError}` : ''}`);
}
console.log(`\nLayout: ${OUT_ROOT}/<Component>/<target>.png`);
