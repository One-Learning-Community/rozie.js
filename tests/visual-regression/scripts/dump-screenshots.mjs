/**
 * dump-screenshots.mjs — capture every (example x target) cell to a temp dir.
 *
 * Mirrors specs/matrix.spec.ts's 8x6 matrix and the playwright.config.ts
 * viewport / deviceScaleFactor so output matches what the regression compares
 * against. Output layout:
 *
 *   <out>/<target>/<Example>.png
 *
 * Default output is `/tmp/rozie-vr-screens/`; override with `--out=<path>` or
 * env `ROZIE_VR_OUT`. Expects the preview server to already be running on
 * 4180 (run `pnpm build && pnpm preview` first, or invoke this script via the
 * playwright webServer hook by running playwright once first).
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
];
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT_ROOT = resolve(
  outArg ? outArg.slice('--out='.length) : (process.env.ROZIE_VR_OUT ?? '/tmp/rozie-vr-screens'),
);
const BASE_URL = process.env.ROZIE_VR_BASE_URL ?? 'http://localhost:4180';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});

const failures = [];

for (const target of TARGETS) {
  const targetDir = resolve(OUT_ROOT, target);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  for (const example of EXAMPLES) {
    const page = await ctx.newPage();
    let pageError = null;
    page.on('pageerror', (e) => (pageError ??= e.message));
    try {
      const url = `${BASE_URL}/?example=${example}&target=${target}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });
      const mount = page.getByTestId('rozie-mount');
      await mount.waitFor({ state: 'visible', timeout: 5_000 });
      const out = resolve(targetDir, `${example}.png`);
      await mount.screenshot({ path: out, animations: 'disabled' });
      process.stdout.write(`ok  ${target.padEnd(7)} ${example.padEnd(12)} -> ${out}\n`);
    } catch (err) {
      failures.push({ target, example, err: err.message, pageError });
      process.stdout.write(
        `ERR ${target.padEnd(7)} ${example.padEnd(12)} :: ${err.message.split('\n')[0]}` +
          (pageError ? ` (pageerror: ${pageError.split('\n')[0]})` : '') +
          '\n',
      );
    } finally {
      await page.close();
    }
  }
}

await browser.close();

if (failures.length > 0) {
  process.stdout.write(`\n${failures.length} cell(s) failed to capture.\n`);
  process.exit(1);
}
process.stdout.write(`\nAll ${EXAMPLES.length * TARGETS.length} screenshots written under ${OUT_ROOT}\n`);
