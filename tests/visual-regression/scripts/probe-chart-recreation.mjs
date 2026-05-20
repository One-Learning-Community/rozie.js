/**
 * probe-chart-recreation.mjs — behavioral gate for the linechart-watch-recreate
 * debug session (Bug B: Svelte/Solid/React recreate the Chart.js instance on
 * every $data change).
 *
 * Each `new Chart(canvas, config)` call invokes
 * `HTMLCanvasElement.prototype.getContext` exactly once. We instrument that
 * prototype method via `page.addInitScript` BEFORE any app code runs, so a
 * monotonic counter on `window.__getContextCount` tracks every Chart.js
 * instantiation. We then:
 *   1. navigate the VR host at ?example=LineChart&target=<t>
 *   2. record the baseline count once the chart has mounted
 *   3. click "Push point" 6× — each click appends one data point, which the
 *      LineChart wrapper's $watch reconciles into the EXISTING chart instance
 *   4. assert the getContext delta is +0 across all six clicks
 *
 * A correct target shows delta 0 (chart created once at mount, never again).
 * A broken target shows delta > 0 (the mount hook / type watcher re-fired
 * `new Chart()` because a transitive reactive read leaked into its dep set).
 *
 * Usage:  node scripts/probe-chart-recreation.mjs [baseURL]
 * Default baseURL: http://localhost:4180
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4180';
const TARGETS = ['vue', 'angular', 'lit', 'svelte', 'solid', 'react'];
const CLICKS = 6;

const INIT_SCRIPT = `
  (() => {
    window.__getContextCount = 0;
    const proto = HTMLCanvasElement.prototype;
    const orig = proto.getContext;
    proto.getContext = function (...args) {
      window.__getContextCount += 1;
      return orig.apply(this, args);
    };
  })();
`;

async function probeTarget(browser, target) {
  const page = await browser.newPage();
  await page.addInitScript(INIT_SCRIPT);
  const url = `${BASE}/?example=LineChart&target=${target}`;
  await page.goto(url, { waitUntil: 'load' });

  // Wait for the chart canvas to appear and for the first `new Chart()` to
  // have run (getContext count >= 1).
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page
    .waitForFunction(() => (window.__getContextCount ?? 0) >= 1, {
      timeout: 15000,
    })
    .catch(() => {});
  // Settle: let Chart.js's first-paint RAF + any mount-phase effects flush.
  await page.waitForTimeout(600);

  const baseline = await page.evaluate(() => window.__getContextCount ?? 0);

  // Click "Push point" CLICKS times. The button text is "Push point".
  const pushBtn = page.getByRole('button', { name: 'Push point' });
  let clickError = null;
  for (let i = 0; i < CLICKS; i++) {
    try {
      await pushBtn.click({ timeout: 5000 });
    } catch (e) {
      clickError = String(e).split('\n')[0];
      break;
    }
    await page.waitForTimeout(150);
  }
  // Allow any async re-render / effect flush after the final click.
  await page.waitForTimeout(400);

  const afterClicks = await page.evaluate(() => window.__getContextCount ?? 0);

  // Canvas node identity — confirm no component remount (1 distinct node).
  const canvasCount = await page.evaluate(
    () => document.querySelectorAll('canvas').length,
  );

  await page.close();

  const delta = afterClicks - baseline;
  const perClick = delta / CLICKS;
  return {
    target,
    baseline,
    afterClicks,
    delta,
    perClick: Math.round(perClick * 100) / 100,
    canvasCount,
    clickError,
  };
}

const browser = await chromium.launch();
const results = [];
for (const target of TARGETS) {
  try {
    results.push(await probeTarget(browser, target));
  } catch (e) {
    results.push({ target, error: String(e).split('\n')[0] });
  }
}
await browser.close();

console.log('\n=== Chart.js recreation probe (getContext = new Chart() count) ===');
console.log(`baseURL: ${BASE}   clicks: ${CLICKS}\n`);
let anyFail = false;
for (const r of results) {
  if (r.error) {
    anyFail = true;
    console.log(`  ${r.target.padEnd(8)}  ERROR  ${r.error}`);
    continue;
  }
  const pass = r.delta === 0 && !r.clickError;
  if (!pass) anyFail = true;
  const status = r.delta === 0 ? 'PASS' : 'FAIL';
  let line = `  ${r.target.padEnd(8)}  ${status}  delta=+${r.delta} (${r.perClick}/click)  baseline=${r.baseline} after=${r.afterClicks} canvas=${r.canvasCount}`;
  if (r.clickError) line += `  clickError=${r.clickError}`;
  console.log(line);
}
console.log('');
process.exit(anyFail ? 1 : 0);
