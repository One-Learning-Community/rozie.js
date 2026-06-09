/**
 * run-probe.mjs — Phase 37 Wave-0 A3 RENDER probe runner (Lit).
 *
 * THROWAWAY PROBE. Stands up a Vite dev server over ./index.html (which loads
 * harness.ts + the freshly-compiled FlowNode.lit.ts), drives a headless Chromium
 * via Playwright, and asserts the D-04 body teleport renders on Lit:
 *   (A) <button#body-btn>BODY</button> lands INSIDE the engine node body element
 *       ([data-engine-body="n1"]) — the teleport crossed the shadow boundary;
 *   (B) the post-move button still fires a click (interactivity survives).
 *
 * Run from the tests/visual-regression package (where vite + playwright + lit +
 * @lit/context + @lit-labs/preact-signals + @rozie/runtime-lit all resolve):
 *   cd tests/visual-regression && node ../../packages/ui/rete/scripts/probe-a3-lit/run-probe.mjs
 *
 * Exit 0 = A3 PASSES on Lit. Non-zero = FAIL (with DOM evidence printed).
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const PROBE_ROOT = dirname(fileURLToPath(import.meta.url));

function fail(msg, extra) {
  console.error('\nA3 PROBE FAIL: ' + msg);
  if (extra) console.error(extra);
  process.exitCode = 1;
}

const server = await createServer({
  root: PROBE_ROOT,
  configFile: false,
  logLevel: 'warn',
  server: { port: 0 },
  // Vite serves outside-root files (the workspace runtime/lit dist) — allow it.
  // Default fs.allow already includes workspace root via searchForWorkspaceRoot.
});
await server.listen();
const url = server.resolvedUrls.local[0];
console.log('probe server: ' + url);

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push('console.error: ' + m.text());
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });

  // The Lit ContextConsumer resolves async (REQ-30); the teleport happens in
  // FlowNode.firstUpdated AFTER context resolves. Wait for the relocated button.
  const teleported = page.locator('[data-engine-body="n1"] #body-btn');
  await teleported.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});

  // ── Evidence dump ──────────────────────────────────────────────────────────
  const evidence = await page.evaluate(() => {
    const canvas = document.querySelector('probe-canvas');
    const surface = canvas?.shadowRoot?.querySelector('#engine-surface');
    const engineBody = surface?.querySelector('[data-engine-body="n1"]');
    const flowNode = document.querySelector('rozie-flow-node');
    const fnShadow = flowNode?.shadowRoot;
    const bodyElInFnShadow = fnShadow?.querySelector('[data-rozie-ref="bodyEl"]');

    // Where did the bodyEl (the r-external wrapper holding the <slot>) end up?
    const bodyEl =
      engineBody?.querySelector('[data-rozie-ref="bodyEl"]') ||
      bodyElInFnShadow ||
      null;
    const bodyElParent = bodyEl?.parentElement;
    const bodyElInEngine = !!engineBody?.querySelector('[data-rozie-ref="bodyEl"]');

    // Is the slot inside the relocated bodyEl projecting the <button>?
    const slot = bodyEl?.querySelector('slot');
    const assigned = slot ? slot.assignedElements({ flatten: true }) : [];
    const assignedButton = assigned.find((el) => el.id === 'body-btn') || null;

    // The button's flattened (rendered) position — does it visually sit inside
    // the engine body element?
    const btn = document.getElementById('body-btn');
    const btnInEngineLightTree = engineBody
      ? engineBody.contains(bodyEl) && !!assignedButton
      : false;

    return {
      hasCanvasShadow: !!canvas?.shadowRoot,
      hasEngineBody: !!engineBody,
      engineBodyHTML: engineBody ? engineBody.outerHTML.slice(0, 400) : null,
      bodyElFound: !!bodyEl,
      bodyElInEngine,
      bodyElParentTag: bodyElParent ? bodyElParent.tagName.toLowerCase() : null,
      bodyElParentClass: bodyElParent ? bodyElParent.className : null,
      slotFound: !!slot,
      slotAssignedCount: assigned.length,
      assignedButtonText: assignedButton ? assignedButton.textContent : null,
      buttonExists: !!btn,
      buttonLightDomParent: btn ? btn.parentElement?.tagName.toLowerCase() : null,
      btnInEngineLightTree,
    };
  });

  console.log('\n── A3 DOM evidence (Lit) ──');
  console.log(JSON.stringify(evidence, null, 2));

  // ── Assertion A: body teleported INSIDE the engine node element ─────────────
  const teleportOk =
    evidence.hasEngineBody &&
    evidence.bodyElInEngine &&
    evidence.slotFound &&
    evidence.assignedButtonText === 'BODY';

  if (!teleportOk) {
    fail(
      'FlowNode body did NOT teleport into the engine node element on Lit (or its <slot> stopped projecting the <button> after the cross-shadow move).',
      JSON.stringify(evidence, null, 2),
    );
  } else {
    console.log(
      '\nA3 assertion A PASS: <button>BODY</button> is projected by the <slot> inside the relocated bodyEl, which now lives inside [data-engine-body="n1"].',
    );
  }

  // ── Assertion B: post-move click still fires ────────────────────────────────
  const before = await page.evaluate(() => window.__probeClicks ?? 0);
  await page.locator('#body-btn').click({ timeout: 3000 }).catch((e) => {
    fail('post-teleport click() threw — button not hittable after the DOM move.', String(e));
  });
  const after = await page.evaluate(() => window.__probeClicks ?? 0);
  if (after > before) {
    console.log(`A3 assertion B PASS: post-teleport click fired (clicks ${before} → ${after}).`);
  } else {
    fail(`post-teleport click did NOT fire (clicks stayed at ${before}).`);
  }

  // Capture a screenshot artifact (the rendered teleported body).
  const shotPath = resolve(PROBE_ROOT, 'a3-lit-evidence.png');
  await page.screenshot({ path: shotPath });
  console.log('screenshot: ' + shotPath);

  if (pageErrors.length) {
    fail('page emitted runtime errors during the probe.', pageErrors.join('\n'));
  }

  if (process.exitCode === 1) {
    console.error('\n=== A3 RESULT: FAIL (see evidence above) ===');
  } else {
    console.log('\n=== A3 RESULT: PASS — D-04 body teleport renders on Lit ===');
  }
} finally {
  await browser.close();
  await server.close();
}
