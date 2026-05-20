/**
 * probe-linechart-feed.mjs — supplementary behavioral gate for the
 * linechart-watch-recreate debug session, steps 4-6.
 *
 * Verifies, per target, on the VR host (?example=LineChart):
 *   - step 4 (React stale closure): the live feed grows past 8 points and
 *     slides — i.e. the "Count" stat climbs over consecutive ticks. The bug
 *     froze the React feed at 8 forever.
 *   - step 5 (Svelte checkbox r-model): the "Live feed" checkbox renders
 *     CHECKED at mount (liveFeed defaults true) and toggling it flips state.
 *   - step 6 ($watch immediate-fire): the simulated feed auto-STARTS without
 *     any user interaction (the Count climbs on its own) — exercised on Vue
 *     and Svelte, the two targets whose $watch was previously lazy.
 *
 * Usage:  node scripts/probe-linechart-feed.mjs [baseURL]
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4180';
const TARGETS = ['vue', 'angular', 'lit', 'svelte', 'solid', 'react'];

function countFromText(txt) {
  // The "Count" stat renders as a <dd> after a <dt>Count</dt>. We grab the
  // first integer in the stats region as a coarse proxy.
  const m = txt.match(/Count\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

async function probeTarget(browser, target) {
  const page = await browser.newPage();
  await page.goto(`${BASE}/?example=LineChart&target=${target}`, {
    waitUntil: 'load',
  });
  await page.waitForSelector('canvas', { timeout: 15000 });

  // Auto-start check ($watch immediate-fire): liveFeed defaults true, so the
  // feed should tick on its own. Read the Count stat, wait ~2s (>2 ticks at
  // 0.8s), read again. A climbing count means the feed auto-started AND the
  // React functional updater is not frozen.
  const readCount = async () => {
    const txt = await page.evaluate(
      () => document.body.innerText.replace(/\s+/g, ' '),
    );
    return countFromText(txt);
  };

  const count0 = await readCount();
  await page.waitForTimeout(2100);
  const count1 = await readCount();

  // Live-feed checkbox: rendered checked at mount?
  const checkbox = page.locator('input[type="checkbox"]').first();
  let checkedAtMount = null;
  let toggleWorks = null;
  try {
    checkedAtMount = await checkbox.isChecked({ timeout: 3000 });
    await checkbox.click({ timeout: 3000 });
    await page.waitForTimeout(150);
    const afterToggle = await checkbox.isChecked();
    toggleWorks = afterToggle !== checkedAtMount;
  } catch (e) {
    // Lit's checkbox lives in shadow DOM; Playwright's input[type=checkbox]
    // query won't pierce it. Recorded as null (not a failure for lit).
    checkedAtMount = `n/a (${String(e).split('\n')[0].slice(0, 40)})`;
  }

  await page.close();

  const climbed = count0 !== null && count1 !== null && count1 > count0;
  return { target, count0, count1, climbed, checkedAtMount, toggleWorks };
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

console.log('\n=== LineChart live-feed probe (steps 4-6) ===');
console.log(`baseURL: ${BASE}\n`);
for (const r of results) {
  if (r.error) {
    console.log(`  ${r.target.padEnd(8)}  ERROR  ${r.error}`);
    continue;
  }
  const feed = r.climbed ? 'auto-start+grows' : 'STUCK/no-climb';
  console.log(
    `  ${r.target.padEnd(8)}  count ${r.count0}->${r.count1} (${feed})  ` +
      `checkbox checked@mount=${r.checkedAtMount} toggleWorks=${r.toggleWorks}`,
  );
}
console.log('');
