import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Node-flow-editor behavioral smoke — Rete.js v2 (`FlowCanvas`), reworked onto the
 * Phase-41 CONTROLLED-GRAPH model.
 *
 * FlowCanvas is the framework-agnostic-engine archetype: the engine
 * (NodeEditor + AreaPlugin + ConnectionPlugin) owns the graph + all pointer
 * interaction, and a single VANILLA render pipe (no rete-react/vue/… plugin)
 * fills each engine node element with DOM, emits `render`/`rendered` socket signals
 * (so the ConnectionPlugin + the DOM socket-position watcher see the anchors), and
 * draws connection SVG paths.
 *
 * THE REDESIGN (41-02/41-03/41-04): the consumer no longer feeds config-arrays
 * `:nodes`/`:connections` + a reactive `#node` portal. Instead it binds ONE
 * `r-model:graph` object `{ nodes:[{id,type,x,y,data}], connections:[] }` as the
 * SINGLE SOURCE OF TRUTH and declares `<NodeType type><template #body>` + typed
 * `<Port output/input type>` TEMPLATES ONCE each. The canvas renders every graph
 * node FROM ITS TYPE (render-by-type — the demo never r-fors the nodes), and writes
 * back x/y on drag + connections on connect/disconnect into the bound graph (a fresh
 * immutable object). `examples/demos/FlowCanvasDemo.rozie` is the behavioral driver;
 * `FlowCanvasAdvancedDemo.rozie` is the typed-pipeline centerpiece.
 *
 * THE LOAD-BEARING SHIFT FROM THE OLD CELLS — assert the BOUND GRAPH, not just
 * element counts. A count-only VR pass once masked a totally non-rendering feature on
 * THIS component (project_next_port_rete_flow). So the drag cell asserts the BOUND
 * `readout-node0-x` (the write-back into `$data.graph`) actually changed — not just
 * that a `.rozie-flow-node` moved in the DOM — and is ECHO-SAFE (stable after the
 * drag settles, no oscillation / climbing count from a write-back loop). Connect /
 * disconnect assert the bound `connection-count` readout. Validation asserts the
 * `readout-rejected` TEXT (the attempted types), not a path count. Remove asserts the
 * SPECIFIC node body gone (toHaveCount(0)), not just a count delta.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. The deterministic pixel baseline is the SEPARATE
 * `FlowCanvasScreenshot` matrix cell (`FlowCanvasScreenshotDemo`).
 *
 * If this spec is red but the other engine specs (chart, tiptap, maplibre) are
 * green, the regression is in the FlowCanvas wrapper's vanilla render pipe (the
 * `area.addPipe` render handler, the render/rendered socket-signal emission, the
 * render-by-type bodyRenderer, or the graph write-back reconcilers) — not the
 * broader engine-wrapper pattern.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// All 6 targets must pass the controlled-graph cells (the Svelte Port reserved-word
// blocker was resolved in 41-04 commit 0c6736ad by renaming the <Port in/out> attrs
// to input/output — Svelte's $props() destructure now binds legal identifiers).
const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

/**
 * 1. CONTROLLED GRAPH — render-by-type, DRAG WRITE-BACK, add-node reconcile, two-way zoom.
 *
 * `examples/demos/FlowCanvasDemo.rozie` binds ONE `r-model:graph` (3 `task` nodes
 * Source/Filter/Sink + 2 connections) and declares a single `task` <NodeType> whose
 * `#body` (`.rozie-demo-node`) renders for EVERY node of the type. It exposes
 * `readout-count` / `readout-zoom` / `readout-connect` / `readout-node0-x`, plus
 * `add-node` / `zoom-in`.
 *
 *   1. Mount + vanilla render (all 6) — ≥3 `.rozie-flow-node` boxes filled.
 *   2. RENDER-BY-TYPE — the single `task` `#body` (`.rozie-demo-node`) renders for
 *      EVERY node (≥3), proving the per-type body projection mounts per instance.
 *   3. Connections — the 2 bound edges draw `.rozie-flow-connection__path`.
 *   4. DRAG WRITE-BACK (the #1 proof) — drag the 'Source' node; assert the BOUND
 *      `readout-node0-x` (= `Math.round($data.graph.nodes[0].x)`) CHANGED. This proves
 *      the canvas wrote the new x back into `$data.graph` — NOT merely that the engine
 *      moved the DOM (which a `.rozie-flow-node` transform check would pass even with a
 *      dead write-back). ECHO-SAFETY: after the drag settles, the readout is STABLE on
 *      a re-sample (no oscillation / climbing from a write-back→reconcile→write loop)
 *      and the node count did not climb.
 *   5. Add-node reconcile — `add-node` appends to `$data.graph.nodes` (fresh object);
 *      the count readout climbs 3→4 and a new node box appears (no remount).
 *   6. Two-way zoom — `zoom-in` mutates `$data.zoom`; the bound readout reflects it.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow [${target}]: controlled graph renders by type, drag writes back to the bound graph, add-node reconciles, two-way zoom`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvas&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount + vanilla render (the make-or-break) ----
    // The CSS locators pierce Lit's open shadow root.
    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3);

    // ---- 2. RENDER-BY-TYPE: the single `task` #body renders for every instance ----
    // `.rozie-demo-node` is the type's `<template #body>` fill, mounted per graph node
    // via the render-by-type bodyRenderer ($portals.body). One declared template,
    // ≥3 rendered bodies — the per-type projection proof.
    await expect
      .poll(async () => page.locator('.rozie-demo-node').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(3);
    // each type body carries its node's label (the #body read `node.data.label`).
    await expect(
      page.locator('.rozie-demo-node', { hasText: 'Source' }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // ---- 3. the 2 bound connections draw ----
    await expect
      .poll(async () => page.locator('.rozie-flow-connection__path').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(2);

    // ---- 4. DRAG WRITE-BACK (the #1 proof): drag node 'a' → BOUND readout-node0-x changes ----
    const node0xReadout = page.getByTestId('readout-node0-x');
    // readout-node0-x = Math.round($data.graph.nodes[0].x); the demo seeds x=20.
    await expect(node0xReadout).toHaveText('20');

    // Drag the 'Source' node body by a clear horizontal delta. Grab the node by its
    // HEAD/body (not a socket) so this is a node-move gesture, not a connect gesture.
    const sourceNode = page.locator('.rozie-flow-node', { hasText: 'Source' }).first();
    await expect(sourceNode).toBeVisible({ timeout: 10_000 });
    const nb = await sourceNode.boundingBox();
    if (!nb) throw new Error('source node bounding box unavailable');
    // Grab near the top-left of the node (the label area), away from the output socket
    // on the right edge, so we move the node rather than start a connection drag.
    const grabX = nb.x + 14;
    const grabY = nb.y + 10;
    const DX = 80;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    // move in steps so the area-plugin drag fires pointermove → translate write-back.
    await page.mouse.move(grabX + DX / 2, grabY, { steps: 6 });
    await page.mouse.move(grabX + DX, grabY, { steps: 6 });
    await page.mouse.up();

    // THE WRITE-BACK PROOF: the BOUND graph's nodes[0].x changed (the canvas wrote a
    // fresh {...graph, nodes} back into $data.graph). NOT a DOM-transform check — this
    // reads the consumer's bound model via the readout, so a dead write-back FAILS here
    // even though the engine still moved the node box visually.
    await expect
      .poll(async () => Number((await node0xReadout.textContent())?.trim() ?? 'NaN'), {
        timeout: 10_000,
        intervals: [100, 300, 600, 1000],
      })
      .toBeGreaterThan(20);

    // ---- ECHO-SAFETY: after settle, the readout is STABLE (no write-back loop) ----
    await page.waitForTimeout(500);
    const settled = (await node0xReadout.textContent())?.trim();
    const boxesAfterDrag = await page.locator('.rozie-flow-node').count();
    await page.waitForTimeout(400);
    // re-sample: a write-back→reconcile→write echo loop would oscillate/climb the x or
    // duplicate node boxes; both must be identical after settle.
    expect((await node0xReadout.textContent())?.trim()).toBe(settled);
    expect(await page.locator('.rozie-flow-node').count()).toBe(boxesAfterDrag);

    // ---- 5. add-node reconcile (fresh-object append, no remount) ----
    const countReadout = page.getByTestId('readout-count');
    await expect(countReadout).toHaveText('3');
    const before = await page.locator('.rozie-flow-node').count();
    await page.getByTestId('add-node').click();
    await expect(countReadout).toHaveText('4');
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(before);

    // ---- 6. two-way zoom round-trip ----
    const zoomReadout = page.getByTestId('readout-zoom');
    await expect(zoomReadout).toHaveText('1');
    await page.getByTestId('zoom-in').click();
    await expect(zoomReadout).not.toHaveText('1', { timeout: 5_000 });
  });
}

/**
 * 2. CONNECT WRITE-BACK — drag-to-connect appends to the bound graph + draws the live
 * preview line.
 *
 * `examples/demos/FlowCanvasDemo.rozie` starts with 2 bound edges (a→b, b→c) and the
 * a→c pair unconnected. Dragging from 'Source' output to 'Sink' input commits a real
 * connection: the canvas writes the new edge back into `$data.graph.connections` AND
 * fires `@connection-created` → the demo's `onConnect` bumps `readout-connect`.
 *
 *   MID-DRAG (the rubber-band fix proof): with the button held, the count of DRAWN
 *   paths (a non-empty `d` attribute) reaches ≥3 (2 committed + the live preview).
 *   Counting elements or asserting the committed edge would NOT distinguish fixed from
 *   broken (the pseudo `<path>` element exists either way; pre-fix it simply has no
 *   `d`). Only a non-empty `d` mid-drag proves the rubber-band actually draws.
 *
 *   WRITE-BACK (the controlled-graph proof): after release, the BOUND `readout-connect`
 *   reads '1' — the `@connection-created` round-tripped on ALL 6 (incl. the Svelte
 *   hyphenated-emit path fixed in 595968e0). Sink's `in` input is single-connection
 *   (Rete ClassicPreset `multiple:false` default), so dropping a→c onto c's occupied
 *   input EVICTS b→c (`connectionremoved`) — the net DRAWN count settles back to 2 even
 *   though a→c persisted. We therefore assert the WRITE-BACK via the connect readout +
 *   that the count settled to a stable ≥2 (the committed edges), NOT a brittle =3.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-drag [${target}]: drag-to-connect draws the live preview + writes the edge back to the bound graph`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvas&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3);
    // the 2 bound edges (a→b, b→c) are committed and drawn before we drag.
    await expect
      .poll(async () => page.locator('.rozie-flow-connection__path').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(2);

    // a→c is the UNCONNECTED pair: drag from Source's output to Sink's input.
    const sourceOut = page
      .locator('.rozie-flow-node', { hasText: 'Source' })
      .locator('.rozie-flow-socket--output')
      .first();
    const sinkIn = page
      .locator('.rozie-flow-node', { hasText: 'Sink' })
      .locator('.rozie-flow-socket--input')
      .first();
    await expect(sourceOut).toBeVisible({ timeout: 10_000 });
    await expect(sinkIn).toBeVisible({ timeout: 10_000 });

    const out = await sourceOut.boundingBox();
    const inn = await sinkIn.boundingBox();
    if (!out || !inn) throw new Error('socket bounding boxes unavailable');
    const outCx = out.x + out.width / 2;
    const outCy = out.y + out.height / 2;
    const inCx = inn.x + inn.width / 2;
    const inCy = inn.y + inn.height / 2;
    const midX = (outCx + inCx) / 2;
    const midY = (outCy + inCy) / 2;

    // counts DRAWN paths (non-empty `d`), piercing Lit's open shadow root.
    const drawnCount = async () =>
      page
        .locator('.rozie-flow-connection__path')
        .evaluateAll(
          (els) =>
            els.filter((e) => (e.getAttribute('d') || '').trim().length > 0)
              .length,
        );

    // start the gesture and move partway toward the input socket (button held).
    await page.mouse.move(outCx, outCy);
    await page.mouse.down();
    await page.mouse.move(midX, midY, { steps: 8 });

    // THE PREVIEW PROOF: mid-drag, the pseudo path draws → drawn count climbs to ≥3
    // (the 2 committed edges + the live preview line). expect.poll samples while the
    // button is still held so it catches the rubber-band as it tracks.
    await expect
      .poll(drawnCount, { timeout: 5_000, intervals: [100, 200, 300, 500] })
      .toBeGreaterThanOrEqual(3);

    // complete the gesture over the input socket → commit the a→c connection.
    await page.mouse.move(inCx, inCy, { steps: 8 });
    await page.mouse.up();

    // THE WRITE-BACK PROOF (controlled graph): the drop committed a real connection in
    // the editor, firing `@connection-created`. The canvas wrote the edge back into
    // `$data.graph.connections`; the demo's `onConnect` bumps the BOUND `readout-connect`
    // to '1'. Asserted on ALL 6 incl. Svelte (the hyphenated-emit normalizer fix).
    await expect(page.getByTestId('readout-connect')).toHaveText('1', {
      timeout: 10_000,
    });

    // CORROBORATION + ECHO-SAFETY: after the rubber-band tears down, the drawn-path
    // count settles to a STABLE value ≥2 (Sink's single input evicts b→c when a→c lands,
    // so the net committed set stays 2). We assert it is stable on a re-sample (no
    // write-back→reconcile oscillation), not a brittle exact 3 (which a single-input
    // eviction correctly violates).
    await page.waitForTimeout(600);
    const settled = await drawnCount();
    expect(settled).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(400);
    expect(await drawnCount()).toBe(settled);
  });
}

/**
 * 3. Connector / socket vertical-alignment proof (quick-260610-jrk continuation #2,
 * carried over to the controlled-graph demo).
 *
 * THE BUG: connection lines anchored ~14px BELOW each socket, at the node BOTTOM,
 * instead of on the socket. ROOT CAUSE (DOM-evidence-confirmed): the connection
 * `<svg>` was `display:inline` (the SVG default), so the 1px-tall SVG sat on the
 * connection element's TEXT BASELINE — ~14px below the connection element's top — and
 * the connection element IS the area-transform origin, so the offset is in screen
 * space and pushes EVERY endpoint ~14px down. FIX: `display:block` on
 * `.rozie-flow-connection__svg` (CSS-only, in FlowCanvas's scoped `:root {}` block).
 *
 * THE PROOF (must FAIL pre-fix, PASS post-fix): every drawn connection path's START
 * and END screen point must sit within tolerance of SOME socket center VERTICALLY.
 * Pre-fix worst dy ≈ 13.9px (node bottom); post-fix «1px (on the socket). HORIZONTAL
 * is only sanity-bounded: `getDOMSocketPosition.calculatePosition` returns the socket
 * center shifted 12px OUTWARD by design.
 */
const ALIGN_DY_TOLERANCE_PX = 6;
const ALIGN_DX_SANITY_PX = 20; // 12px intentional outward offset + AA/rounding slack

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-align [${target}]: connectors sit on the node sockets`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvas&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3);
    // both bound edges (a→b, b→c) drawn before we measure.
    await expect
      .poll(async () => page.locator('.rozie-flow-connection__path').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(2);

    // Give the watcher-driven redraw a moment to settle after mount/fit.
    await page.waitForTimeout(1200);

    // For every DRAWN path, compute its START + END screen points (via the path's own
    // getPointAtLength + getScreenCTM, so transforms/zoom are accounted for), collect
    // every socket's screen-center, and report the worst-case offset of any endpoint
    // from its NEAREST socket center. The bug-specific signal is VERTICAL (worstDy).
    const result = await page.evaluate(() => {
      // Deep query across the document AND every open shadow root (Lit renders the
      // canvas + sockets + connections inside a shadow root; plain querySelectorAll
      // does NOT pierce shadow DOM, so we recurse). Returns all matches everywhere.
      const deepQueryAll = (selector: string): Element[] => {
        const out: Element[] = [];
        const walk = (root: Document | ShadowRoot) => {
          out.push(...Array.from(root.querySelectorAll(selector)));
          for (const el of Array.from(root.querySelectorAll('*'))) {
            const sr = (el as HTMLElement).shadowRoot;
            if (sr) walk(sr);
          }
        };
        walk(document);
        return out;
      };

      const sockets = deepQueryAll('.rozie-flow-socket').map((s) => {
        const r = (s as HTMLElement).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });

      const paths = deepQueryAll('.rozie-flow-connection__path').filter(
        (p) => ((p as SVGPathElement).getAttribute('d') || '').trim().length > 0,
      ) as SVGPathElement[];

      const screenPoint = (p: SVGPathElement, len: number) => {
        const pt = p.getPointAtLength(len);
        const m = p.getScreenCTM();
        if (!m) return null;
        return {
          x: pt.x * m.a + pt.y * m.c + m.e,
          y: pt.x * m.b + pt.y * m.d + m.f,
        };
      };

      let worstDx = 0;
      let worstDy = 0;
      const endpoints: Array<{ dx: number; dy: number }> = [];
      for (const p of paths) {
        const total = p.getTotalLength();
        const ends = [screenPoint(p, 0), screenPoint(p, total)];
        for (const e of ends) {
          if (!e) continue;
          // nearest socket center to this endpoint
          let best = Infinity;
          let bestDx = Infinity;
          let bestDy = Infinity;
          for (const s of sockets) {
            const dx = Math.abs(e.x - s.x);
            const dy = Math.abs(e.y - s.y);
            const d = Math.hypot(dx, dy);
            if (d < best) {
              best = d;
              bestDx = dx;
              bestDy = dy;
            }
          }
          endpoints.push({ dx: bestDx, dy: bestDy });
          if (bestDx > worstDx) worstDx = bestDx;
          if (bestDy > worstDy) worstDy = bestDy;
        }
      }
      return {
        socketCount: sockets.length,
        pathCount: paths.length,
        endpointCount: endpoints.length,
        worstDx,
        worstDy,
        endpoints,
      };
    });

    // Sanity: we actually measured drawn edges + sockets.
    expect(result.socketCount).toBeGreaterThanOrEqual(3);
    expect(result.pathCount).toBeGreaterThanOrEqual(2);
    expect(result.endpointCount).toBeGreaterThanOrEqual(4);

    // THE PROOF (vertical): every endpoint sits on a socket center within tolerance
    // VERTICALLY — pre-fix worstDy ~14px (node bottom), post-fix «1px (on the socket).
    expect(
      result.worstDy,
      `worst vertical endpoint→socket offset ${result.worstDy.toFixed(2)}px (tol ${ALIGN_DY_TOLERANCE_PX}px) — pre-fix ~14px (node bottom); per-endpoint=${JSON.stringify(result.endpoints)}`,
    ).toBeLessThanOrEqual(ALIGN_DY_TOLERANCE_PX);
    // SANITY (horizontal): each endpoint terminates near a socket (the lib shifts the
    // stored position 12px outward by design, so this is a loose bound, not the proof).
    expect(
      result.worstDx,
      `worst horizontal endpoint→socket offset ${result.worstDx.toFixed(2)}px (sanity ${ALIGN_DX_SANITY_PX}px; ~12px is the lib's intentional outward offset); per-endpoint=${JSON.stringify(result.endpoints)}`,
    ).toBeLessThanOrEqual(ALIGN_DX_SANITY_PX);
  });
}

/**
 * 4. TYPED PIPELINE — automatic typed validation (reject + accept), `canConnect`
 * OVERRIDE, connect WRITE-BACK, and per-node ✕ REMOVE on the controlled graph.
 *
 * `examples/demos/FlowCanvasAdvancedDemo.rozie` binds ONE `r-model:graph` of 5 typed
 * nodes (Number Source / Text Source / Math / Format / Merge) and declares 4
 * `<NodeType>` templates with typed `<Port>`s — `source` carries BOTH a `number` and a
 * `string` OUTPUT, `merge` BOTH a `number` and a `string` INPUT (both `multiple`).
 * `:validate-types="true"` auto-rejects type-mismatched drags FROM THE PORT SCHEMA (no
 * predicate needed); a small `:can-connect="canConnect"` self-loop rule layers on top.
 * The graph starts with NO connections (drawnCount baseline 0). Each node `#body` carries
 * a per-node ✕ on `@pointerup`/`:data-id` → top-level `onRemoveClick` filters
 * `$data.graph` into a FRESH object (controlled-model remove).
 *
 *   RENDER-BY-TYPE: each declared type's `#body` renders for its instances — both the
 *   'Number Source' (source type) and the 'Merge' (merge type) bodies are present.
 *
 *   AUTOMATIC TYPED REJECT (D3, the novel proof): drag the Number Source's `number`
 *   output → Merge's `string` input (cross-type). `:validate-types` resolves the port
 *   types and CANCELS the connection — `connectioncreated` never fires, no path draws.
 *   Assert: drawnCount STAYS 0 AND `readout-rejected` shows the attempted types TEXT
 *   (load-bearing, NOT a count: a count-only check once masked a non-rendering feature,
 *   and a rejected pseudo-path can exist mid-drag). `readout-accepted` STAYS 0.
 *
 *   ACCEPT: drag the Number Source's `number` output → Math's `number` input
 *   (same-type). The typed check + canConnect pass; the edge commits and is WRITTEN BACK
 *   into `$data.graph.connections` — the BOUND `connection-count` climbs 0→1 and
 *   `readout-accepted` reads 1.
 *
 *   canConnect OVERRIDE: drag the Math node's `number` output → its OWN `number` input
 *   (a self-loop). The typed check passes (number→number) but the custom `canConnect`
 *   (`c.source !== c.target`) REJECTS it — proving the consumer rule runs IN ADDITION to
 *   the automatic validation. `connection-count` stays 1; `readout-rejected` updates to
 *   the self-loop edge.
 *
 *   ✕ REMOVE (all 6 incl. Solid): click the 'Text Source' node's ✕ (@pointerup/:data-id
 *   → top-level onRemoveClick filters the bound graph). Assert `node-count` drops 5→4,
 *   the box count drops by exactly 1, AND the SPECIFIC removed node's body is GONE
 *   (toHaveCount(0)) — the load-bearing per-node proof.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-advanced [${target}]: automatic typed validation rejects cross-type + canConnect override + connect write-back + ✕ remove`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasAdvanced&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- setup: canvas + the 5 typed nodes render; baseline drawnCount = 0 ----
    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(5);

    // RENDER-BY-TYPE: both the source-type and merge-type #body templates rendered for
    // their instances (the per-type body projection across distinct types).
    await expect(
      page.locator('.rozie-flow-node', { hasText: 'Number Source' }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('.rozie-flow-node', { hasText: 'Merge' }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // counts DRAWN paths (non-empty `d`), piercing Lit's open shadow root.
    const drawnCount = async () =>
      page
        .locator('.rozie-flow-connection__path')
        .evaluateAll(
          (els) =>
            els.filter((e) => (e.getAttribute('d') || '').trim().length > 0)
              .length,
        );

    // BOUND-graph readout: connection-count = $data.graph.connections.length.
    const connectionCount = page.getByTestId('connection-count');

    // no initial connections — the baseline is a clean 0 (both drawn paths AND the
    // bound graph).
    await expect.poll(drawnCount, { timeout: 10_000 }).toBe(0);
    await expect(connectionCount).toHaveText('0');
    await expect(page.getByTestId('readout-accepted')).toHaveText('0');

    // Locate a socket by its node's distinctive label + the socket side. `.first()`
    // takes the first port of that side (for nodes with one port per side).
    const socketOf = (label: string, side: 'output' | 'input') =>
      page
        .locator('.rozie-flow-node', { hasText: label })
        .locator(`.rozie-flow-socket--${side}`)
        .first();

    // Locate a TYPED socket precisely: the port ROW (.rozie-flow-port--<side>) whose
    // label span reads the port's `label` ('number'/'string') inside the named node,
    // then that row's socket. Needed for the multi-port `source`/`merge` types where
    // `.first()` would ambiguously pick num-vs-str. The row's label span is the
    // `port.label` text (buildSocketRow renders label='number'/'string').
    const typedSocketOf = (
      node: string,
      side: 'output' | 'input',
      portLabel: string,
    ) =>
      page
        .locator('.rozie-flow-node', { hasText: node })
        .locator(`.rozie-flow-port--${side}`, { hasText: portLabel })
        .locator('.rozie-flow-socket')
        .first();

    const center = async (locator: ReturnType<typeof socketOf>) => {
      await expect(locator).toBeVisible({ timeout: 10_000 });
      const box = await locator.boundingBox();
      if (!box) throw new Error('socket bounding box unavailable');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    const drag = async (
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, {
        steps: 8,
      });
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
    };

    // ---- REJECT (automatic typed validation): number output → string input ----
    // Number Source's `number` output → Merge's `string` input (cross-type). Both nodes
    // are multi-port, so target the TYPED socket by its port label, not `.first()`.
    const numOut = await center(typedSocketOf('Number Source', 'output', 'number'));
    const mergeStrIn = await center(typedSocketOf('Merge', 'input', 'string'));
    await drag(numOut, mergeStrIn);

    // no edge committed — drawn count + the BOUND connection-count both stay 0.
    await expect.poll(drawnCount, { timeout: 5_000 }).toBe(0);
    await expect(connectionCount).toHaveText('0');
    // the @connection-rejected handler ran and wrote the attempted types (TEXT, not a
    // count — the load-bearing assertion). The readout reads e.g. 'num:num → merge:…'.
    const rejected = page.getByTestId('readout-rejected');
    await expect(rejected).toContainText('num', { timeout: 10_000 });
    await expect(rejected).toContainText('merge');
    // no connection-created fired on the rejected drag.
    await expect(page.getByTestId('readout-accepted')).toHaveText('0');

    // ---- ACCEPT (same-type) + CONNECT WRITE-BACK: number output → number input ----
    const mathIn = await center(socketOf('Math', 'input'));
    await drag(numOut, mathIn);

    // the committed same-type edge draws — drawnCount settles to exactly 1.
    await expect
      .poll(drawnCount, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(1);
    // WRITE-BACK: the edge was written back into $data.graph.connections — the BOUND
    // connection-count climbed 0→1 …
    await expect(connectionCount).toHaveText('1', { timeout: 10_000 });
    // … and @connection-created round-tripped (incl. the Svelte hyphenated-emit path).
    await expect(page.getByTestId('readout-accepted')).toHaveText('1', {
      timeout: 10_000,
    });

    // ---- canConnect OVERRIDE: Math number output → Math number input (self-loop) ----
    // The typed check passes (number→number) but the custom canConnect (source!==target)
    // REJECTS it — proving the consumer rule layers ON TOP of the automatic validation.
    const mathOut = await center(socketOf('Math', 'output'));
    const mathInAgain = await center(socketOf('Math', 'input'));
    await drag(mathOut, mathInAgain);
    // no new edge: the BOUND connection-count stays 1 and drawnCount stays 1.
    await expect(connectionCount).toHaveText('1');
    await expect.poll(drawnCount, { timeout: 5_000 }).toBe(1);
    // the self-loop reject updated the rejected readout to the math→math edge.
    await expect(rejected).toContainText('math', { timeout: 10_000 });
    // accepted did not climb (no second commit).
    await expect(page.getByTestId('readout-accepted')).toHaveText('1');

    // ---- ✕ REMOVE: per-node remove on the controlled graph (all 6 incl. Solid) ----
    // The ✕ uses :data-id + a TOP-LEVEL onRemoveClick (NOT slot-scope emit), so it works
    // on Solid where slot-scope @click bodies are not accessor-rewritten. Remove the
    // 'Text Source' (txt) LEAF node — untouched by the drags above — so sequencing the
    // removal last cannot disturb those assertions.
    const nodeCount = page.getByTestId('node-count');
    await expect(nodeCount).toHaveText('5');
    const txtNode = page.locator('.rozie-flow-node', { hasText: 'Text Source' });
    await expect(txtNode).toHaveCount(1);
    const boxesBefore = await page.locator('.rozie-flow-node').count();

    await page.getByTestId('remove-txt').click();

    // the controlled-graph filter reconciled: the BOUND node-count drops by exactly 1 …
    await expect(nodeCount).toHaveText('4');
    // … the engine reaps exactly one node box …
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 10_000,
      })
      .toBe(boxesBefore - 1);
    // … and the SPECIFIC removed node's box is gone (not just a count delta — the
    // load-bearing per-node proof that ✕ removed the RIGHT node on this target).
    await expect(txtNode).toHaveCount(0);
  });
}
