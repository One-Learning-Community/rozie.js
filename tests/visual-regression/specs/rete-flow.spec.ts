import { test, expect, type Page } from '@playwright/test';
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

    // ---- 3b. DIRECTION ARROWHEADS (Win 3): every drawn path carries a marker-end ----
    // Structural proof (pierces Lit's open shadow root via evaluateAll): at least one
    // drawn connection path references an arrowhead marker (`marker-end: url(#…)`). The
    // marker <defs> lives in the same per-edge <svg>, so the reference resolves within
    // the shadow root on Lit too. Pixel correctness is gated by the FlowCanvasScreenshot
    // baseline; here we assert the attribute is present (NOT a count).
    await expect
      .poll(
        async () =>
          page.locator('.rozie-flow-connection__path').evaluateAll((els) =>
            els.filter(
              (e) =>
                (e.getAttribute('d') || '').trim().length > 0 &&
                (e.getAttribute('marker-end') || '').includes('url('),
            ).length,
          ),
        { timeout: 10_000 },
      )
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
      //
      // NOT migrated to _shadow-utils.ts's shared deepQuerySelectorAll* helpers
      // (quick 260716-npt Fix C): this deepQueryAll is called MULTIPLE times
      // and its results feed FURTHER getBoundingClientRect/getPointAtLength/
      // getScreenCTM geometry math, all within this SAME evaluate call, for
      // one atomic snapshot. It is byte-identical to the other deepQueryAll
      // in this file (below) but extracting it would require restructuring
      // the surrounding multi-step computation, not a safe mechanical dedup.
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

/**
 * 5. NODE DELETE — Delete/Backspace key on the selected node, cascading the incident
 * edges (Win 1, quick-260611-sqa).
 *
 * `examples/demos/FlowCanvasDemo.rozie` (3 `task` nodes Source→Filter→Sink, 2 bound
 * edges a→b, b→c). This proves the NEW cascading delete on the controlled graph via the
 * Delete key on all 6:
 *
 *   SELECT the MIDDLE node ('Filter', id 'b') — it carries BOTH bound edges (a→b and
 *   b→c) — by clicking its body (Rete `nodepicked` → `.is-selected`), focus the canvas,
 *   press Delete. The canvas's keydown handler collects the selected node id from the
 *   live selector and calls the cascading `deleteNode('b')`, which filters the node AND
 *   both incident connections out of FRESH arrays and writes ONE fresh `{...graph,
 *   nodes, connections}` back through the model → the `$watch(graph)` reconcile reaps the
 *   engine node + both edges.
 *
 *   This exercises BOTH delete paths in one: the Delete KEY wiring AND the cascading
 *   `deleteNode` verb body (the keydown handler calls the same exposed function). Assert
 *   the BOUND `readout-count` drops 3→2, the SPECIFIC 'Filter' node body is GONE
 *   (`toHaveCount(0)` — NOT a count-only delta; a count check once masked a
 *   non-rendering feature on THIS component), AND the two incident edges cascaded away
 *   (the drawn-path count drops to 0 — the cascade proof).
 *
 * (The imperative `$refs.flow.deleteNode(id)` call from a consumer is the SAME function
 * body the key handler invokes; its handle exposure is gated by the surface test +
 * per-target handle synthesis, and the demo-ref handle is a documented cross-target
 * divergence — Angular's child ref is the host element — so the VR proves the function
 * behavior via the key path, which works uniformly on all 6.)
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-delete [${target}]: Delete key cascades the selected node + its incident edges out of the bound graph`, async ({
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

    // counts DRAWN paths (non-empty `d`), piercing Lit's open shadow root.
    const drawnCount = async () =>
      page
        .locator('.rozie-flow-connection__path')
        .evaluateAll(
          (els) =>
            els.filter((e) => (e.getAttribute('d') || '').trim().length > 0)
              .length,
        );

    // both bound edges (a→b, b→c) drawn before we delete.
    await expect.poll(drawnCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    const countReadout = page.getByTestId('readout-count');
    await expect(countReadout).toHaveText('3');

    // ---- SELECT the MIDDLE 'Filter' node (carries BOTH edges) + press Delete ----
    const filterNode = page.locator('.rozie-flow-node', { hasText: 'Filter' });
    await expect(filterNode).toHaveCount(1);
    const fb = await filterNode.first().boundingBox();
    if (!fb) throw new Error('Filter node bounding box unavailable');
    // click its body near the label (away from the right-edge output socket) to PICK it.
    await page.mouse.click(fb.x + 14, fb.y + 10);
    // selection settles — the `.is-selected` class lands on the .rozie-flow-node box
    // (Lit may settle async, so the locator carries its own timeout).
    await expect(
      page.locator('.rozie-flow-node.is-selected', { hasText: 'Filter' }),
    ).toHaveCount(1, { timeout: 5_000 });

    // focus the canvas (the keydown listener lives on .rozie-flow-canvas, tabindex=0)
    // and press Delete → cascading deleteNode('b').
    await canvas.focus();
    await page.keyboard.press('Delete');

    // BOUND node-count drops 3→2 and the SPECIFIC 'Filter' node body is gone.
    await expect(countReadout).toHaveText('2', { timeout: 10_000 });
    await expect(filterNode).toHaveCount(0, { timeout: 10_000 });

    // CASCADE PROOF: both edges incident to 'b' (a→b and b→c) were filtered out of the
    // fresh graph → the reconcile removed them → the drawn-path count falls to 0.
    await expect.poll(drawnCount, { timeout: 10_000 }).toBe(0);
  });
}

/**
 * 6. SELECTION SURFACED — @selection-change fires { ids } on pick / unpick / deselect
 * (Win 2, quick-260611-sqa).
 *
 * `examples/demos/FlowCanvasAdvancedDemo.rozie` wires `@selection-change` →
 * `onSelectionChange` → writes the joined selected ids to `data-testid="readout-selection"`
 * (the #1 real-app need: click a node → drive an inspector). The canvas computes the
 * selected-id set from the live selector after a pick/unpick, dedupes, and emits.
 *
 *   PICK: click the 'Number Source' (num) node body → the readout updates to contain
 *   'num'.
 *   RE-PICK: click 'Math' (math) → the readout changes to 'math' (single-select replaces).
 *   DESELECT: click the empty canvas background → the readout clears (the selector
 *   unselects all → empty { ids } emit).
 *
 * The readout TEXT is asserted (the load-bearing surface — not a count). expect.poll /
 * toContainText absorbs Lit's async settle. Selection is NOT written into the graph
 * model, so this never perturbs the controlled-graph echo-safety assertions.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-selection [${target}]: @selection-change surfaces the selected node ids on pick / re-pick / deselect`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasAdvanced&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(5);

    const selection = page.getByTestId('readout-selection');
    // empty before any pick (the initial empty selection does not emit on mount).
    await expect(selection).toHaveText('');

    // ---- PICK 'Number Source' (id 'num') ----
    const numNode = page.locator('.rozie-flow-node', { hasText: 'Number Source' }).first();
    const numBox = await numNode.boundingBox();
    if (!numBox) throw new Error('Number Source node bounding box unavailable');
    await page.mouse.click(numBox.x + 14, numBox.y + 10);
    await expect(selection).toContainText('num', { timeout: 10_000 });

    // ---- RE-PICK 'Math' (id 'math') → single-select replaces ----
    const mathNode = page.locator('.rozie-flow-node', { hasText: 'Math' }).first();
    const mathBox = await mathNode.boundingBox();
    if (!mathBox) throw new Error('Math node bounding box unavailable');
    await page.mouse.click(mathBox.x + 14, mathBox.y + 10);
    await expect(selection).toContainText('math', { timeout: 10_000 });

    // ---- DESELECT: click the empty canvas background → selection clears ----
    const cb = await canvas.boundingBox();
    if (!cb) throw new Error('canvas bounding box unavailable');
    // bottom-right corner of the canvas — away from any node (nodes sit upper-left).
    await page.mouse.click(cb.x + cb.width - 12, cb.y + cb.height - 12);
    await expect(selection).toHaveText('', { timeout: 10_000 });
  });
}

/**
 * 7. CONTROLS WIDGET — the built-in zoom in / out / fit overlay (Win 4,
 * quick-260611-sqa).
 *
 * `examples/demos/FlowCanvasDemo.rozie` leaves `controls` at its default (ON), so the
 * built-in overlay renders. Assert the `flow-zoom-in` button is present over the canvas
 * and clicking it drives the BOUND `readout-zoom` (= $data.zoom, two-way) — the buttons
 * reuse the zoomTo verb which echoes $model.zoom. Then `flow-fit` is present + clickable
 * (it calls zoomToFit; view-only, no graph mutation asserted here).
 *
 *   The overlay is COMPONENT-template DOM (not engine-mounted), so the locators resolve
 *   on all 6 incl. piercing Lit's open shadow root. The button click changes the bound
 *   zoom readout — proving the built-in control drives the live area + echoes the model.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-controls [${target}]: the built-in Controls overlay drives the bound zoom`, async ({
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

    // the built-in Controls overlay rendered (default :controls ON).
    const zoomInBtn = page.getByTestId('flow-zoom-in');
    await expect(zoomInBtn).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('flow-zoom-out')).toBeVisible();
    await expect(page.getByTestId('flow-fit')).toBeVisible();

    // clicking the built-in zoom-in drives the BOUND zoom (the button reuses zoomTo →
    // echoes $model.zoom → the demo's readout-zoom reflects it).
    const zoomReadout = page.getByTestId('readout-zoom');
    await expect(zoomReadout).toHaveText('1');
    await zoomInBtn.click();
    await expect(zoomReadout).not.toHaveText('1', { timeout: 5_000 });

    // fit is present + clickable (view-only; no graph mutation).
    await page.getByTestId('flow-fit').click();
  });
}

/**
 * 8. MINIMAP — the built-in MiniMap overlay (opt-in :minimap) + the pannable viewport
 * API (Phase 42, setCenter/setViewport).
 *
 * `examples/demos/FlowCanvasMinimapDemo.rozie` binds a WIDE 4-node controlled graph
 * (x up to 920) with `:minimap="true"` + `:fit-on-mount="false"` so the graph overflows
 * the 720px canvas — making the minimap's viewport window a real SUB-rectangle of the
 * content bounds (the dim mask + outline are meaningful). The minimap SVG is built
 * imperatively (createElementNS) into the light-DOM host, styled with inline attributes,
 * so it renders identically on all 6 incl. Lit (the locators pierce its open shadow root).
 *
 *   1. The minimap host (`[data-testid=flow-minimap]`) renders.
 *   2. NODE RECTS (NOT count-only-trivial): `.rozie-flow-minimap__node` count == the
 *      graph node count (4), AND every rect has a positive measured width (proving the
 *      node-view dims were read + placed, not zero-size).
 *   3. VIEWPORT RECT: exactly one `.rozie-flow-minimap__viewport` renders, with a width
 *      `> 0` and `< 200` (the minimap box width) — i.e. a real sub-window, since the
 *      graph is wider than the viewport.
 *   4. PANNABLE (the nav feature): a pointer-drag on the minimap recenters the main
 *      viewport (setCenter → area.translate → @translated). The BOUND `readout-tx`
 *      (= Math.round of the viewport pan x) changes from its initial '0', and is STABLE
 *      on a re-sample (no write-back oscillation), and the node count never changed
 *      (panning never touches the graph model).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-minimap [${target}]: the built-in MiniMap renders node + viewport rects and pannable-recenters the bound viewport`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasMinimap&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    // the 4 wide nodes render.
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(4);

    // ---- 1. the minimap host rendered (opt-in :minimap ON) ----
    const minimap = page.getByTestId('flow-minimap');
    await expect(minimap).toBeVisible({ timeout: 10_000 });

    // ---- 2. NODE RECTS: count == graph node count (4) + positive widths ----
    // `.rozie-flow-minimap__node` are the imperative SVG rects; locators pierce Lit's
    // open shadow root. Poll for the measured-redraw to settle to exactly 4.
    await expect
      .poll(async () => page.locator('.rozie-flow-minimap__node').count(), {
        timeout: 10_000,
      })
      .toBe(4);
    // every node rect has a positive width (the node-view dims were measured + scaled,
    // not a degenerate zero-rect) — the load-bearing "not count-only" assertion.
    const minNodeWidth = await page
      .locator('.rozie-flow-minimap__node')
      .evaluateAll((els) =>
        Math.min(
          ...els.map((e) =>
            parseFloat((e as SVGRectElement).getAttribute('width') || '0'),
          ),
        ),
      );
    expect(minNodeWidth).toBeGreaterThan(0);

    // ---- 3. VIEWPORT RECT renders as a real sub-window (0 < width < 200) ----
    const viewportRect = page.locator('.rozie-flow-minimap__viewport');
    await expect(viewportRect).toHaveCount(1, { timeout: 10_000 });
    const vpWidth = await viewportRect.evaluate((e) =>
      parseFloat((e as SVGRectElement).getAttribute('width') || '0'),
    );
    expect(vpWidth).toBeGreaterThan(0);
    // the graph (x up to 920) is wider than the 720px viewport, so the viewport window
    // is strictly narrower than the 200px minimap box — a genuine sub-rectangle.
    expect(vpWidth).toBeLessThan(200);

    // ---- 4. PANNABLE: drag the minimap → the BOUND viewport pan (readout-tx) changes ----
    const txReadout = page.getByTestId('readout-tx');
    await expect(txReadout).toHaveText('0');

    const mmBox = await minimap.boundingBox();
    if (!mmBox) throw new Error('minimap bounding box unavailable');
    // press at the minimap center, drag toward its top-left corner (a clearly off-center
    // graph coord → a clearly non-zero recenter). pointerdown already calls setCenter.
    const cx = mmBox.x + mmBox.width / 2;
    const cy = mmBox.y + mmBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(mmBox.x + 12, mmBox.y + 12, { steps: 6 });
    await page.mouse.up();

    // THE PAN PROOF: the bound viewport-pan readout moved off its initial 0 (setCenter
    // wrote the AreaPlugin transform → @translated surfaced the new pan x).
    await expect(txReadout).not.toHaveText('0', { timeout: 5_000 });

    // ECHO-SAFETY: after settle the readout is STABLE (no write-back loop) and the graph
    // node count never changed (panning is a view op — it never touches the model).
    await page.waitForTimeout(500);
    const settled = (await txReadout.textContent())?.trim();
    const nodeBoxes = await page.locator('.rozie-flow-node').count();
    await page.waitForTimeout(400);
    expect((await txReadout.textContent())?.trim()).toBe(settled);
    expect(await page.locator('.rozie-flow-node').count()).toBe(nodeBoxes);
  });
}

/**
 * 9. PALETTE DRAG-DROP — `screenToFlowPosition(clientX, clientY)` (Phase 43 F1).
 *
 * `examples/demos/FlowCanvasPaletteDemo.rozie` seeds ONE node and wires the palette-drop
 * pattern (consumer owns the DnD; the canvas owns the projection — RF parity). The spec
 * drives the DETERMINISTIC proxy: a "Drop at center" button runs the SAME `dropNodeAt`
 * path at the canvas center — `flow.screenToFlowPosition(centerX, centerY)` → append a
 * fresh node there — so we assert the projection ROUND-TRIP without flaky native HTML5 DnD:
 *
 *   1. seed renders (1 `.rozie-flow-node`, `readout-count` == 1).
 *   2. click "Drop at center" → a node is appended to the bound graph (`readout-count`
 *      climbs 1→2) — proving `screenToFlowPosition` returned a coord and the controlled
 *      write-back landed.
 *   3. PROJECTION CORRECTNESS (the load-bearing assertion, NOT count-only): the new
 *      'Dropped' node's rendered box top-left sits at the canvas center within tolerance —
 *      dropped at the center screen point ⇒ rendered back at the center (screen→flow→screen
 *      round-trips). A wrong projection would place it far off-center even though the count
 *      still climbed.
 */
const PALETTE_PROJECTION_TOL_PX = 32;

// The `screenToFlowPosition` VERB compiles identically on all 6 (the surface gate proves
// it) and the projection is target-agnostic (pure transform inverse). This cell exercises
// it through a CONSUMER ref (`$refs.flow.screenToFlowPosition(...)`), which now resolves the
// child's $expose handle/instance on ALL SIX targets (refs-lowering-cross-target):
//   - Finding 2 fix: Angular's `$refs.<childComponent>` lowers to the component INSTANCE
//     (`viewChild('flow')`), not the host element — the verb is reachable via `$refs`.
//   - Finding 1 fix: react/svelte no longer self-shadow `const flow = $refs.flow`
//     (the deconflict pre-pass renames the local), so the round-trip runs there too.
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-palette [${target}]: screenToFlowPosition projects a drop point to graph coords + appends the node there`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasPalette&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    // the seed node renders.
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(1);
    const countReadout = page.getByTestId('readout-count');
    await expect(countReadout).toHaveText('1');

    // the canvas center (the deterministic drop point).
    const cbox = await canvas.boundingBox();
    if (!cbox) throw new Error('canvas bounding box unavailable');
    const centerX = cbox.x + cbox.width / 2;
    const centerY = cbox.y + cbox.height / 2;

    // ---- drop a node at the canvas center via screenToFlowPosition ----
    await page.getByTestId('drop-center').click();

    // the controlled write-back landed — a fresh node appended (1→2).
    await expect(countReadout).toHaveText('2', { timeout: 10_000 });
    const dropped = page.locator('.rozie-flow-node', { hasText: 'Dropped' });
    await expect(dropped).toHaveCount(1, { timeout: 10_000 });

    // ---- PROJECTION CORRECTNESS: the dropped node renders AT the center ----
    // screenToFlowPosition(center) → graph coord whose node origin renders back at the
    // center screen point. The node element's box top-left ≈ the drop point.
    const dbox = await dropped.first().boundingBox();
    if (!dbox) throw new Error('dropped node bounding box unavailable');
    expect(
      Math.abs(dbox.x - centerX),
      `dropped node x ${dbox.x.toFixed(1)} vs canvas center ${centerX.toFixed(1)} (tol ${PALETTE_PROJECTION_TOL_PX}px)`,
    ).toBeLessThanOrEqual(PALETTE_PROJECTION_TOL_PX);
    expect(
      Math.abs(dbox.y - centerY),
      `dropped node y ${dbox.y.toFixed(1)} vs canvas center ${centerY.toFixed(1)} (tol ${PALETTE_PROJECTION_TOL_PX}px)`,
    ).toBeLessThanOrEqual(PALETTE_PROJECTION_TOL_PX);
  });
}

/**
 * 10. TOP/BOTTOM HANDLES — `<Port position="top|bottom">` vertical flow (Phase 43 F2).
 *
 * `examples/demos/FlowCanvasVerticalDemo.rozie` declares a `step` <NodeType> with its INPUT
 * on the TOP edge and OUTPUT on the BOTTOM edge, and stacks 3 nodes so the 2 edges run
 * top→bottom. This proves the position-aware render layout + the custom getDOMSocketPosition
 * offset (which must shift the connection anchor on the Y axis for top/bottom ports — the
 * rete default shifts X only):
 *
 *   1. the 3 nodes render and the top/bottom sockets exist (`.rozie-flow-socket--top` x3,
 *      `.rozie-flow-socket--bottom` x3).
 *   2. the 2 vertical connections draw (`.rozie-flow-connection__path`, non-empty `d`).
 *   3. ALIGNMENT (the load-bearing offset proof): every drawn path endpoint sits within a
 *      tight HORIZONTAL tolerance of some socket center (dx ≈ 0). With the rete DEFAULT
 *      offset the top/bottom anchor would be pushed ±12px on X (dx ≈ 12, fails); the custom
 *      offset shifts Y instead, so the endpoint stays horizontally aligned with the socket.
 */
const VERTICAL_ALIGN_DX_TOL_PX = 7;   // proves the anchor did NOT shift on X (default = ~12)
const VERTICAL_ALIGN_DY_SANITY_PX = 22; // the intentional ±12 outward Y shift + AA/rounding

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-vertical [${target}]: <Port position=top/bottom> renders edge sockets + the connection anchor shifts on the Y axis`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasVertical&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    // ---- 1. top + bottom sockets render (3 each — one per step node) ----
    await expect
      .poll(async () => page.locator('.rozie-flow-socket--top').count(), { timeout: 10_000 })
      .toBe(3);
    await expect
      .poll(async () => page.locator('.rozie-flow-socket--bottom').count(), { timeout: 10_000 })
      .toBe(3);

    // ---- 2. the 2 vertical connections draw ----
    await expect
      .poll(
        async () =>
          page.locator('.rozie-flow-connection__path').evaluateAll((els) =>
            els.filter((e) => (e.getAttribute('d') || '').trim().length > 0).length,
          ),
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(2);

    // give the watcher-driven redraw a moment to settle after mount.
    await page.waitForTimeout(1000);

    // ---- 3. ALIGNMENT: endpoints are HORIZONTALLY aligned with sockets (Y-axis offset) ----
    const result = await page.evaluate(() => {
      // NOT migrated to _shadow-utils.ts (quick 260716-npt Fix C) — same
      // rationale as the twin deepQueryAll above: entangled with further
      // geometry math in this same evaluate call.
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
        return { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f };
      };
      let worstDx = 0;
      let worstDy = 0;
      let endpointCount = 0;
      for (const p of paths) {
        const total = p.getTotalLength();
        for (const e of [screenPoint(p, 0), screenPoint(p, total)]) {
          if (!e) continue;
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
          endpointCount++;
          if (bestDx > worstDx) worstDx = bestDx;
          if (bestDy > worstDy) worstDy = bestDy;
        }
      }
      return { socketCount: sockets.length, pathCount: paths.length, endpointCount, worstDx, worstDy };
    });

    expect(result.socketCount).toBeGreaterThanOrEqual(6);
    expect(result.pathCount).toBeGreaterThanOrEqual(2);
    expect(result.endpointCount).toBeGreaterThanOrEqual(4);
    // THE PROOF (horizontal): top/bottom anchors did NOT shift on X — endpoints stay
    // aligned with the socket column. Default (X-shift) offset would give worstDx ~12.
    expect(
      result.worstDx,
      `worst horizontal endpoint→socket offset ${result.worstDx.toFixed(2)}px (tol ${VERTICAL_ALIGN_DX_TOL_PX}px) — the rete default X-shift would be ~12px`,
    ).toBeLessThanOrEqual(VERTICAL_ALIGN_DX_TOL_PX);
    // SANITY (vertical): the anchor IS shifted ±12px outward on Y by design.
    expect(
      result.worstDy,
      `worst vertical endpoint→socket offset ${result.worstDy.toFixed(2)}px (sanity ${VERTICAL_ALIGN_DY_SANITY_PX}px; ~12px is the intentional outward Y shift)`,
    ).toBeLessThanOrEqual(VERTICAL_ALIGN_DY_SANITY_PX);
  });
}

/**
 * 11. EDGE LABELS + STYLING — per-edge `label` / `stroke` / `dashed` (Phase 43 F3).
 *
 * `examples/demos/FlowCanvasEdgesDemo.rozie` fans a Start node out to Approve (green edge
 * labeled 'approve') + Reject (red dashed edge labeled 'reject') — the labels/styles live
 * directly on `graph.connections[]`. Proves:
 *   1. both edges draw with their LABELS rendered (`.rozie-flow-connection__label` ×2, text
 *      'approve' / 'reject').
 *   2. STYLING applies — one path stroke is green (#16a34a), one is red (#dc2626) and dashed
 *      (a non-empty `stroke-dasharray`).
 *   3. LIVE RE-RENDER — clicking "Relabel" writes a fresh `graph.connections` (e1 label →
 *      'approved!'); the rendered edge label updates (the controlled-graph edit path).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-edges [${target}]: per-edge label + stroke/dashed styling render and relabel live`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasEdges&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);
    // both styled edges draw.
    await expect
      .poll(
        async () =>
          page.locator('.rozie-flow-connection__path').evaluateAll((els) =>
            els.filter((e) => (e.getAttribute('d') || '').trim().length > 0).length,
          ),
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(2);

    // ---- 1. both edge LABELS render with their text ----
    const labels = page.locator('.rozie-flow-connection__label');
    await expect.poll(async () => labels.count(), { timeout: 10_000 }).toBe(2);
    await expect(
      page.locator('.rozie-flow-connection__label', { hasText: 'approve' }),
    ).toHaveCount(1, { timeout: 10_000 });
    await expect(
      page.locator('.rozie-flow-connection__label', { hasText: 'reject' }),
    ).toHaveCount(1);

    // ---- 2. STYLING: one green stroke, one red + dashed ----
    const styles = await page
      .locator('.rozie-flow-connection__path')
      .evaluateAll((els) =>
        els
          .filter((e) => (e.getAttribute('d') || '').trim().length > 0)
          .map((e) => ({
            stroke: (e.getAttribute('stroke') || '').toLowerCase(),
            dash: (e.getAttribute('stroke-dasharray') || '').trim(),
          })),
      );
    const green = styles.find((s) => s.stroke === '#16a34a');
    const red = styles.find((s) => s.stroke === '#dc2626');
    expect(green, `expected a green (#16a34a) edge; got ${JSON.stringify(styles)}`).toBeTruthy();
    expect(red, `expected a red (#dc2626) edge; got ${JSON.stringify(styles)}`).toBeTruthy();
    expect(red?.dash.length, `expected the red edge to be dashed; got ${JSON.stringify(red)}`).toBeGreaterThan(0);

    // ---- 3. LIVE RE-RENDER: relabel e1 through the controlled graph ----
    await page.getByTestId('relabel').click();
    await expect(
      page.locator('.rozie-flow-connection__label', { hasText: 'approved!' }),
    ).toHaveCount(1, { timeout: 10_000 });
    // the other label is untouched, and the count is still 2 (no duplicate edge).
    await expect(
      page.locator('.rozie-flow-connection__label', { hasText: 'reject' }),
    ).toHaveCount(1);
    await expect.poll(async () => labels.count(), { timeout: 5_000 }).toBe(2);
  });
}

/**
 * 8. EDGE SELECT + DELETE — Phase 44 T1.1 (D-08).
 *
 * `examples/demos/FlowCanvasEdgeDeleteDemo.rozie` (3 `step` nodes Start→Approve/Reject,
 * 2 committed edges e1: start→yes, e2: start→no). This proves the NEW edge-select +
 * edge-delete seam on all 6:
 *
 *   CLICK a specific connection `.rozie-flow-connection__path` (its midpoint) — the
 *   imperative pointerup listener (NOT click — Rete swallows it) fires
 *   selectEdge(connection.id): `.is-selected` toggles on that path, @edge-click /
 *   @edge-selected emit, and the consumer's `edge-clicked-id` readout updates. Focus the
 *   canvas, press Delete → the keydown handler's edge branch calls
 *   writeBackConnectionRemoved(selectedConnId), filtering exactly that edge out of a fresh
 *   `{ ...graph, connections }` object → the $watch(graph) reconcile reaps the engine edge.
 *
 *   The load-bearing assertions (per the count-only-masks-bugs lesson on THIS component):
 *   (a) the BOUND `connection-count` readout decremented exactly 2→1; (b) the total drawn
 *   `.rozie-flow-connection__path` count dropped by exactly 1; (c) the SPECIFIC clicked
 *   edge's path is GONE — no remaining path carries its captured `d` (toHaveCount(0)), not
 *   merely a delta. No `toHaveScreenshot` — behavioral cell only (FlowCanvasScreenshot is
 *   the separate, byte-identical pixel cell).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-edge-delete [${target}]: click an edge + Delete removes exactly that edge from the bound graph`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasEdgeDelete&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    // helper: the DRAWN paths (non-empty `d`), piercing Lit's open shadow root.
    const pathLoc = page.locator('.rozie-flow-connection__path');
    const drawnDs = async (): Promise<string[]> =>
      pathLoc.evaluateAll((els) =>
        els
          .map((e) => (e.getAttribute('d') || '').trim())
          .filter((d) => d.length > 0),
      );

    // both committed edges (e1, e2) draw before we delete.
    await expect.poll(async () => (await drawnDs()).length, { timeout: 10_000 }).toBe(2);

    const countReadout = page.getByTestId('connection-count');
    await expect(countReadout).toHaveText('2');
    const clickedReadout = page.getByTestId('edge-clicked-id');
    await expect(clickedReadout).toHaveText('');

    // ---- SELECT a specific edge: click the FIRST path's midpoint ----
    // Capture its `d` so we can later assert THAT path (not just any) is gone.
    const targetPath = pathLoc.first();
    const targetD = (await targetPath.getAttribute('d'))?.trim() || '';
    expect(targetD.length, 'expected the target edge to have a drawn path').toBeGreaterThan(0);
    const pb = await targetPath.boundingBox();
    if (!pb) throw new Error('target connection path bounding box unavailable');
    // pointerup at the path midpoint → the per-edge select listener fires.
    await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);

    // selection settled: `.is-selected` lands on exactly one path AND the consumer's
    // edge-clicked-id readout is now a non-empty id (the @edge-click signal reached it).
    await expect(
      page.locator('.rozie-flow-connection__path.is-selected'),
    ).toHaveCount(1, { timeout: 5_000 });
    await expect.poll(async () => (await clickedReadout.textContent())?.trim() || '', {
      timeout: 5_000,
    }).not.toBe('');

    // ---- focus the canvas (keydown listener lives on .rozie-flow-canvas, tabindex=0) +
    //      press Delete → writeBackConnectionRemoved(selectedConnId) ----
    await canvas.focus();
    await page.keyboard.press('Delete');

    // (a) BOUND connection-count decremented exactly 2→1.
    await expect(countReadout).toHaveText('1', { timeout: 10_000 });
    // (b) the total drawn-path count dropped by exactly 1 (2→1).
    await expect.poll(async () => (await drawnDs()).length, { timeout: 10_000 }).toBe(1);
    // (c) the SPECIFIC clicked edge's path is GONE — no remaining path carries its `d`.
    await expect
      .poll(async () => (await drawnDs()).filter((d) => d === targetD).length, {
        timeout: 10_000,
      })
      .toBe(0);
  });
}

/**
 * 12. EDGE TYPES — per-edge `connection.type` step/smoothstep/straight/bezier (Phase 44 T1.2, D-01).
 *
 * `examples/demos/FlowCanvasEdgeTypesDemo.rozie` fans a Start node out to four targets, one
 * edge per type: e-step ('step'), e-smoothstep ('smoothstep'), e-straight ('straight'), and
 * e-bezier (NO type → the bezier DEFAULT). `connection.type` selects a path generator in
 * renderConnection.redraw; the default branch stays `classicConnectionPath` (byte-identical).
 * Proves:
 *   1. the STEP edge's `d` is orthogonal — three `L` line-segments (`/L .* L .* L/`).
 *   2. the BEZIER (default) edge's `d` STILL uses a `C` cubic-bezier command — proving the
 *      bezier default path is UNCHANGED (no edit to the default branch).
 *   3. the SMOOTHSTEP edge's `d` carries `Q` quadratic arcs (rounded corners) — distinct from
 *      both the sharp step and the straight line.
 *   4. LIVE RE-RENDER — re-typing the step edge to 'straight' through the controlled graph
 *      (edgeStyleSig includes `type`) re-renders it: the step `L`-segment shape disappears and
 *      a plain `M…L…` straight `d` appears (proving a type change on an existing edge re-draws).
 * No `toHaveScreenshot` — behavioral cell only (FlowCanvasScreenshot is the byte-identical
 * pixel cell, unaffected: edge types are opt-in via `connection.type`).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-edge-types [${target}]: per-edge connection.type selects step/smoothstep/straight/bezier path`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasEdgeTypes&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(5);

    // helper: the DRAWN connection `d` strings (non-empty), piercing Lit's open shadow.
    const pathLoc = page.locator('.rozie-flow-connection__path');
    const drawnDs = async (): Promise<string[]> =>
      pathLoc.evaluateAll((els) =>
        els
          .map((e) => (e.getAttribute('d') || '').trim())
          .filter((d) => d.length > 0),
      );

    // all four typed edges draw.
    await expect.poll(async () => (await drawnDs()).length, { timeout: 10_000 }).toBe(4);

    // ---- 1. the STEP edge's `d` is orthogonal — three `L` line-segments ----
    // `M sx sy L mx sy L mx ey L ex ey` → matches /L .* L .* L/ (and NOT a bezier `C`).
    const stepRe = /L .* L .* L/;
    await expect
      .poll(async () => (await drawnDs()).filter((d) => stepRe.test(d) && !/[CcQq]/.test(d)).length, {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);

    // ---- 2. the BEZIER (default) edge's `d` STILL uses a `C` cubic command (unchanged) ----
    await expect
      .poll(async () => (await drawnDs()).filter((d) => /\bC\b|[ ]C[ ]/.test(d) || /C/.test(d)).length, {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);

    // ---- 3. the SMOOTHSTEP edge's `d` carries `Q` quadratic arcs (rounded corners) ----
    await expect
      .poll(async () => (await drawnDs()).filter((d) => /Q/.test(d)).length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);

    // capture the current set of step-shaped `d`s (sharp orthogonal, no curves) for re-type proof.
    const stepDsBefore = (await drawnDs()).filter((d) => stepRe.test(d) && !/[CcQq]/.test(d));
    expect(stepDsBefore.length, 'expected at least one sharp step edge before re-type').toBeGreaterThanOrEqual(1);

    // ---- 4. LIVE RE-RENDER: re-type e-step 'step' → 'straight' through the controlled graph ----
    await page.getByTestId('to-straight').click();
    // the previously-step `d` (sharp three-segment) is GONE — re-typed to a straight line.
    await expect
      .poll(async () => (await drawnDs()).filter((d) => stepDsBefore.includes(d)).length, {
        timeout: 10_000,
      })
      .toBe(0);
    // count unchanged (4 edges, no add/drop — only a restyle).
    await expect.poll(async () => (await drawnDs()).length, { timeout: 5_000 }).toBe(4);
    // the bezier default edge STILL carries a `C` command (untouched by the re-type).
    await expect
      .poll(async () => (await drawnDs()).filter((d) => /C/.test(d)).length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(1);
  });
}

/**
 * 13. UNDO / REDO — per-gesture graph-only undo (Phase 44 T1.3, D-02/03/04).
 *
 * `examples/demos/FlowCanvasUndoDemo.rozie` (2 `step` nodes A,B + one edge; undo/redo
 * buttons calling the canvas's `undo()`/`redo()` $expose verbs). A drag pushes ONE
 * history snapshot (the pre-drag graph) and writes the post-drag graph back into the
 * bound `$data.graph`; undo() restores the snapshot through the model (echo-guarded),
 * redo() re-applies the post-drag state. Proves on all 6:
 *
 *   1. DRAG WRITE-BACK — node A's BOUND x (`node0-x` = Math.round(graph.nodes[0].x))
 *      changes after a horizontal node-move gesture (the controlled-graph write-back).
 *   2. UNDO — clicking `undo-btn` restores `node0-x` to EQUAL the captured pre-drag value
 *      EXACTLY (not merely "smaller" — the snapshot is the literal pre-gesture graph).
 *   3. ONE gesture = ONE step — a single undo reverts the whole drag (no second undo
 *      needed to get back to the start).
 *   4. REDO — clicking `redo-btn` returns `node0-x` to the post-drag value EXACTLY.
 *
 * Asserts the SETTLED readout only (the bound model after the gesture flushes), never a
 * mid-drag transform (drag velocity is flaky). No `toHaveScreenshot` — behavioral cell.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-undo [${target}]: drag → undo restores the pre-gesture graph; redo re-applies it`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasUndo&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    const node0x = page.getByTestId('node0-x');
    const readX = async (): Promise<number> =>
      Number((await node0x.textContent())?.trim() ?? 'NaN');

    // ---- capture the PRE-drag bound x (the demo seeds A at x=40) ----
    await expect(node0x).toHaveText('40');
    const preDragX = await readX();
    expect(preDragX).toBe(40);

    // ---- 1. DRAG WRITE-BACK: move node A horizontally → bound x changes ----
    const nodeA = page.locator('.rozie-flow-node', { hasText: 'A' }).first();
    await expect(nodeA).toBeVisible({ timeout: 10_000 });
    const nb = await nodeA.boundingBox();
    if (!nb) throw new Error('node A bounding box unavailable');
    // grab near the top-left (label area), away from the right-edge output socket, so
    // this is a node-move gesture (not a connect drag).
    const grabX = nb.x + 14;
    const grabY = nb.y + 10;
    const DX = 90;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + DX / 2, grabY, { steps: 6 });
    await page.mouse.move(grabX + DX, grabY, { steps: 6 });
    await page.mouse.up();

    // the bound x climbed (the canvas wrote a fresh {...graph, nodes} into $data.graph).
    await expect
      .poll(readX, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBeGreaterThan(preDragX);

    // settle, then capture the POST-drag value (stable — no write-back loop).
    await page.waitForTimeout(500);
    const postDragX = await readX();
    expect(postDragX).toBeGreaterThan(preDragX);
    await page.waitForTimeout(300);
    expect(await readX(), 'post-drag readout must be settled (no echo loop)').toBe(postDragX);

    // ---- 2 + 3. UNDO: one click restores the PRE-drag x EXACTLY (one gesture = one step) ----
    await page.getByTestId('undo-btn').click();
    await expect
      .poll(readX, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(preDragX);
    // settle + re-sample: a single undo fully reverts the drag and holds (no oscillation).
    await page.waitForTimeout(400);
    expect(await readX(), 'a single undo reverts the whole drag and holds').toBe(preDragX);

    // ---- 4. REDO: returns the bound x to the POST-drag value EXACTLY ----
    await page.getByTestId('redo-btn').click();
    await expect
      .poll(readX, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(postDragX);
    await page.waitForTimeout(400);
    expect(await readX(), 'redo returns to the post-drag value and holds').toBe(postDragX);
  });
}

/**
 * 14. AUTO-LAYOUT — verb-only elkjs relayout (Phase 44 T2.6, D-08).
 *
 * `examples/demos/FlowCanvasArrangeDemo.rozie` (2 `step` nodes A,B seeded ON TOP of each
 * other at the same x/y + one edge a→b; an `arrange-btn` calling the canvas's
 * `autoArrange()` $expose verb). autoArrange() runs the elkjs-backed AutoArrangePlugin
 * (after setting node dims from the measured node-view element — Pitfall 3) and reads the
 * arranged positions back into the bound `$data.graph` (echo-guarded, one undoable gesture).
 * Exercises the elkjs bundle on all 6 incl. Angular AOT + Lit (the high-risk legs). Proves:
 *
 *   1. START OVERLAPPING — `node0-x` and `node1-x` (= Math.round(graph.nodes[i].x)) are
 *      seeded EQUAL (both 80) — the tangled start state.
 *   2. ARRANGE — clicking `arrange-btn` runs autoArrange(); the two x readouts SETTLE to
 *      values that differ by ≥ a node width (the layered preset puts a source→target pair in
 *      ADJACENT columns) — a RELATIVE non-overlap assertion (not exact px, which is
 *      layout-engine-dependent).
 *   3. STABLE — re-sampling after a tick shows the positions HOLD (no oscillation / no
 *      write-back loop).
 *
 * Asserts the SETTLED readouts only. No `toHaveScreenshot` — autoArrange is verb-only, so
 * FlowCanvasScreenshot stays byte-identical (a separate matrix cell guards that).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-arrange [${target}]: autoArrange() relayouts overlapping nodes into a non-overlapping layered layout`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasArrange&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    const node0x = page.getByTestId('node0-x');
    const node1x = page.getByTestId('node1-x');
    const readX = async (loc: typeof node0x): Promise<number> =>
      Number((await loc.textContent())?.trim() ?? 'NaN');

    // ---- 1. START OVERLAPPING: both nodes seeded at x=80 (the tangled start) ----
    await expect(node0x).toHaveText('80');
    await expect(node1x).toHaveText('80');
    expect(await readX(node0x)).toBe(await readX(node1x));

    // measure the rendered node width (the non-overlap threshold = "≥ a node width").
    const nodeA = page.locator('.rozie-flow-node', { hasText: 'A' }).first();
    await expect(nodeA).toBeVisible({ timeout: 10_000 });
    const ab = await nodeA.boundingBox();
    if (!ab) throw new Error('node A bounding box unavailable');
    const nodeWidth = ab.width;
    expect(nodeWidth).toBeGreaterThan(0);

    // ---- 2. ARRANGE: click → the two x readouts settle to a ≥ node-width separation ----
    await page.getByTestId('arrange-btn').click();
    await expect
      .poll(
        async () => Math.abs((await readX(node0x)) - (await readX(node1x))),
        { timeout: 15_000, intervals: [100, 300, 600, 1000, 2000] },
      )
      .toBeGreaterThanOrEqual(nodeWidth);

    // settle, then capture the arranged positions.
    await page.waitForTimeout(500);
    const x0 = await readX(node0x);
    const x1 = await readX(node1x);
    expect(Math.abs(x0 - x1), 'arranged nodes are non-overlapping (≥ node width apart)')
      .toBeGreaterThanOrEqual(nodeWidth);

    // ---- 3. STABLE: re-sample after a tick → the positions HOLD (no oscillation) ----
    await page.waitForTimeout(400);
    expect(await readX(node0x), 'node0-x is stable after arrange (no write-back loop)').toBe(x0);
    expect(await readX(node1x), 'node1-x is stable after arrange (no write-back loop)').toBe(x1);
  });
}

/**
 * 15. CONNECT-END-ON-PANE — pure emit, consumer owns creation (Phase 44 T2.7, D-07).
 *
 * `examples/demos/FlowCanvasConnectEndDemo.rozie` (one `src` node with an OUTPUT socket near
 * the top-left; an `onConnectEnd` handler fed by the canvas's `@connect-end` emit writes the
 * payload into `connect-end-source` / `connect-end-x` / `connect-end-y` / `connect-count`
 * readouts; `node-count` = the bound graph's node count). The spec drags FROM the output
 * socket and drops on EMPTY canvas (no target socket, no edge created) → the ConnectionPlugin
 * fires `connectiondrop { socket:null, created:false, initial.side:'output' }`, which the
 * canvas surfaces as `@connect-end { source, sourceOutput, position }`. Proves on all 6:
 *
 *   1. EMIT FIRED — `connect-count` reaches ≥ 1 (the pane-drop surfaced the hook).
 *   2. PAYLOAD — `connect-end-source` shows the source node id ('src'); `connect-end-x` /
 *      `connect-end-y` are FINITE numbers within the canvas range (NOT exact coords — the
 *      synthetic drop point is flaky; we assert plausibility, not equality — the
 *      area.area.pointer graph-coord projection is what we're proving cross-target).
 *   3. CONSUMER OWNS CREATION — `node-count` is UNCHANGED (still 1): the canvas auto-creates
 *      NOTHING (D-07, no built-in picker); the handler is the consumer's own stand-in.
 *
 * Behavioral-only — @connect-end is a pure emit, so FlowCanvasScreenshot stays byte-identical.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-connect-end [${target}]: dropping a connection on empty canvas fires @connect-end; consumer owns creation`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasConnectEnd&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(1);

    // sanity: nothing surfaced yet, the one seed node is bound.
    await expect(page.getByTestId('connect-count')).toHaveText('0');
    await expect(page.getByTestId('node-count')).toHaveText('1');

    // the source node's OUTPUT socket — the drag start.
    const sourceOut = page
      .locator('.rozie-flow-node', { hasText: 'Source' })
      .locator('.rozie-flow-socket--output')
      .first();
    await expect(sourceOut).toBeVisible({ timeout: 10_000 });
    const out = await sourceOut.boundingBox();
    if (!out) throw new Error('output socket bounding box unavailable');
    const outCx = out.x + out.width / 2;
    const outCy = out.y + out.height / 2;

    // the EMPTY drop point — the canvas's bottom-right region, well clear of the
    // top-left source node + its sockets (so it is a pane-drop, never a socket-drop).
    const cbox = await canvas.boundingBox();
    if (!cbox) throw new Error('canvas bounding box unavailable');
    const paneX = cbox.x + cbox.width * 0.78;
    const paneY = cbox.y + cbox.height * 0.78;

    // drag from the output socket → release on empty canvas.
    await page.mouse.move(outCx, outCy);
    await page.mouse.down();
    await page.mouse.move((outCx + paneX) / 2, (outCy + paneY) / 2, { steps: 6 });
    await page.mouse.move(paneX, paneY, { steps: 6 });
    await page.mouse.up();

    // ---- 1. EMIT FIRED: the pane-drop surfaced @connect-end ----
    await expect
      .poll(async () => Number((await page.getByTestId('connect-count').textContent())?.trim() ?? '0'), {
        timeout: 10_000,
        intervals: [100, 200, 300, 500],
      })
      .toBeGreaterThanOrEqual(1);

    // ---- 2. PAYLOAD: source id + finite, in-range graph-coord drop position ----
    await expect(page.getByTestId('connect-end-source')).toHaveText('src');
    const x = Number((await page.getByTestId('connect-end-x').textContent())?.trim() ?? 'NaN');
    const y = Number((await page.getByTestId('connect-end-y').textContent())?.trim() ?? 'NaN');
    expect(Number.isFinite(x), `connect-end x is finite (got ${x})`).toBe(true);
    expect(Number.isFinite(y), `connect-end y is finite (got ${y})`).toBe(true);
    // plausibility: graph coords for a drop inside a ~620×320 canvas with zoom 1 and a
    // node seeded at (60,60) — generously bounded (NOT exact; the drop point is synthetic).
    expect(x, `connect-end x in plausible range (got ${x})`).toBeGreaterThan(-200);
    expect(x, `connect-end x in plausible range (got ${x})`).toBeLessThan(2000);
    expect(y, `connect-end y in plausible range (got ${y})`).toBeGreaterThan(-200);
    expect(y, `connect-end y in plausible range (got ${y})`).toBeLessThan(2000);

    // ---- 3. CONSUMER OWNS CREATION: the canvas auto-created NO node (D-07) ----
    await page.waitForTimeout(400);
    await expect(page.getByTestId('node-count')).toHaveText('1');
    expect(await page.locator('.rozie-flow-node').count()).toBe(1);
  });
}

/**
 * 11. MARQUEE SELECT — the pan↔select `mode` toggle (Phase 44 T2.4, D-05).
 *
 * `examples/demos/FlowCanvasMarqueeDemo.rozie` binds a 3-node controlled graph (two nodes
 * a/b stacked in the LEFT column at x=40, c far right at x=520), drives `mode` INTERNALLY
 * via a `mode-btn` toggle (with `:marquee` ON), and exposes `selected-count` (fed by
 * `@selection-change`) + `viewport-x` (fed by `@translated`). Proves on all 6:
 *
 *   1. SELECT MODE — click `mode-btn` to enter 'select', then drag a rubber-band box over
 *      the two LEFT-column nodes (empty-canvas drag) → `selected-count` SETTLES to ≥ 2 (the
 *      box multi-selected both via the selectableNodes select handle → @selection-change).
 *   2. PAN MODE — click `mode-btn` back to 'pan', do the SAME empty-canvas drag → the
 *      viewport PANS: `viewport-x` (= Math.round of the @translated x) CHANGES, and
 *      `selected-count` does NOT increase (the drag pans, it does not select).
 *
 * The drag starts on EMPTY canvas (a gap not over any node) so it is a marquee/pan gesture,
 * never a node drag. Asserts the SETTLED readouts only (drag velocity is flaky) — never a
 * mid-drag transform. No `toHaveScreenshot` — behavioral cell.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-marquee [${target}]: select mode rubber-bands ≥2 nodes; pan mode pans the same drag`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasMarquee&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    // the 3 nodes render (a/b left column, c far right).
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    const selectedCount = page.getByTestId('selected-count');
    const viewportX = page.getByTestId('viewport-x');
    const modeBtn = page.getByTestId('mode-btn');
    const readCount = async (): Promise<number> =>
      Number((await selectedCount.textContent())?.trim() ?? 'NaN');
    const readVx = async (): Promise<number> =>
      Number((await viewportX.textContent())?.trim() ?? 'NaN');

    // initial state: nothing selected, viewport at 0.
    await expect(selectedCount).toHaveText('0');
    const cb = await canvas.boundingBox();
    if (!cb) throw new Error('canvas bounding box unavailable');

    // A marquee box over the LEFT column (nodes a/b sit at graph x≈40, stacked y≈40/170).
    // Drag from an empty point ABOVE-LEFT of node a down PAST node b — the box encloses
    // both. Start the drag on EMPTY canvas (top-left gutter, clear of any node) so it is a
    // marquee/pan gesture. Coordinates are canvas-relative; the seeded nodes are near the
    // top-left because :fit-on-mount=false keeps the seeded positions.
    const x0 = cb.x + 8;
    const y0 = cb.y + 8;
    const x1 = cb.x + 230;
    const y1 = cb.y + 300;

    // ---- 1. SELECT MODE: enter select, drag the box over ≥2 nodes ----
    await modeBtn.click(); // pan → select
    await expect(modeBtn).toContainText('select', { timeout: 5_000 });

    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 8 });
    await page.mouse.move(x1, y1, { steps: 8 });
    await page.mouse.up();

    // the rubber-band multi-selected the 2 left-column nodes → @selection-change → ≥2.
    await expect
      .poll(readCount, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBeGreaterThanOrEqual(2);
    // settle + re-sample: the selected count holds (no oscillation).
    await page.waitForTimeout(400);
    const selectedSettled = await readCount();
    expect(selectedSettled).toBeGreaterThanOrEqual(2);

    // ---- 2. PAN MODE: back to pan, the SAME empty-canvas drag PANS (no new selection) ----
    await modeBtn.click(); // select → pan
    await expect(modeBtn).toContainText('pan', { timeout: 5_000 });
    const vxBefore = await readVx();

    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 8 });
    await page.mouse.move(x1, y1, { steps: 8 });
    await page.mouse.up();

    // the viewport panned: viewport-x changed from its pre-pan value.
    await expect
      .poll(readVx, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe(vxBefore);
    // and the same drag did NOT add a selection (pan mode never marquee-selects). The
    // selected count must not exceed the select-mode result.
    await page.waitForTimeout(400);
    expect(
      await readCount(),
      'pan-mode drag must not increase the selection',
    ).toBeLessThanOrEqual(selectedSettled);
  });
}

/**
 * 12. RECONNECTABLE EDGES — reconnect coalesces to ONE undo entry (Phase 44 T2.5, D-08/D-03).
 *
 * `examples/demos/FlowCanvasReconnectDemo.rozie` binds a source→sink controlled graph where
 * the `sink` node has TWO input sockets (in1/in2) and one seeded edge source.out → sink.in1.
 * Dragging the edge's INPUT endpoint from in1 to in2 is the shipped classic-preset reconnect
 * (one connectionremoved + one connectioncreated, net ONE graph change). Proves on all 6:
 *
 *   1. RECONNECT WRITE-BACK — after dragging the in1 endpoint to in2, `conn0-target-input`
 *      (= graph.connections[0].targetInput) SETTLES to 'in2', and `connection-count` stays
 *      '1' (one removed + one added — the edge count is unchanged across a reconnect).
 *   2. ONE GESTURE = ONE UNDO ENTRY — clicking `undo-btn` ONCE restores `conn0-target-input`
 *      to 'in1'. A double-history-entry (the Pitfall-2 bug) would need TWO undos to fully
 *      revert; a single undo restoring the original target proves the paired remove+add
 *      coalesced into ONE history entry.
 *
 * Asserts the SETTLED readouts only (the bound model after the gesture flushes), never a
 * mid-drag endpoint (drag velocity is flaky). No `toHaveScreenshot` — behavioral cell.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-reconnect [${target}]: drag an edge endpoint to a new socket = ONE undoable reconnect`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasReconnect&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    // the source + sink nodes render (sink carries the two input sockets).
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    // the seeded edge is committed + drawn before we reconnect it.
    await expect
      .poll(
        async () =>
          page
            .locator('.rozie-flow-connection__path')
            .evaluateAll(
              (els) =>
                els.filter((e) => (e.getAttribute('d') || '').trim().length > 0)
                  .length,
            ),
        { timeout: 10_000, intervals: [100, 300, 600, 1000] },
      )
      .toBeGreaterThanOrEqual(1);

    const conn0Target = page.getByTestId('conn0-target-input');
    const connCount = page.getByTestId('connection-count');

    // ---- capture the PRE-reconnect bound state (edge into in1, one edge) ----
    await expect(conn0Target).toHaveText('in1', { timeout: 10_000 });
    await expect(connCount).toHaveText('1');

    // Locate the sink's two input sockets by their port-row label (in1 / in2). Each port
    // row is `.rozie-flow-port--input` carrying its `.rozie-flow-port__label`; pick the row
    // whose label matches, then its socket.
    const inputSocket = (label: string) =>
      page
        .locator('.rozie-flow-node', { hasText: 'Sink' })
        .locator('.rozie-flow-port--input', { hasText: label })
        .locator('.rozie-flow-socket')
        .first();

    const center = async (loc: ReturnType<typeof inputSocket>) => {
      await expect(loc).toBeVisible({ timeout: 10_000 });
      const box = await loc.boundingBox();
      if (!box) throw new Error('socket bounding box unavailable');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    const in1 = await center(inputSocket('in1'));
    const in2 = await center(inputSocket('in2'));
    const midX = (in1.x + in2.x) / 2;
    const midY = (in1.y + in2.y) / 2;

    // ---- 1. RECONNECT: grab the edge's in1 endpoint, drag it onto in2, drop ----
    // Grabbing an already-connected input socket starts the classic-preset reconnect:
    // the existing edge is removed and a pseudo-connection follows the pointer; dropping on
    // in2 commits source.out → sink.in2.
    await page.mouse.move(in1.x, in1.y);
    await page.mouse.down();
    await page.mouse.move(midX, midY, { steps: 8 });
    await page.mouse.move(in2.x, in2.y, { steps: 8 });
    await page.mouse.up();

    // the reconnect committed: the bound edge[0] now targets in2 (SETTLED), and the edge
    // COUNT is unchanged (one removed + one added → still exactly one edge).
    await expect(conn0Target).toHaveText('in2', {
      timeout: 10_000,
    });
    await expect(connCount).toHaveText('1');
    // settle + re-sample: the target holds (no write-back→reconcile oscillation).
    await page.waitForTimeout(500);
    await expect(conn0Target).toHaveText('in2');
    await expect(connCount).toHaveText('1');

    // ---- 2. ONE UNDO restores the original target (proves the gesture coalesced) ----
    await page.getByTestId('undo-btn').click();
    await expect(conn0Target).toHaveText('in1', {
      timeout: 10_000,
    });
    // a SINGLE undo fully reverts the reconnect and holds (a double-entry bug would leave
    // the edge still on in2, needing a second undo). Edge count stays 1 throughout.
    await page.waitForTimeout(400);
    await expect(conn0Target).toHaveText('in1');
    await expect(connCount).toHaveText('1');
  });
}

/**
 * 13. NODE TOOLBAR — opt-in floating per-node toolbar (Phase 44 T2.8, D-06).
 *
 * `examples/demos/FlowCanvasToolbarDemo.rozie` binds a 2-node graph with `:node-toolbar`
 * ON + a single `step` <NodeType>. Selecting a node pops a floating `.rozie-flow-toolbar`
 * over it (positioned from the engine node-view rect + the area transform); its default
 * Delete button drives the controlled-graph `deleteNode` and fires `@node-action`. Proves
 * on all 6:
 *
 *   1. OPT-IN OVERLAY — clicking the 'Alpha' node body pops `.rozie-flow-toolbar` (visible),
 *      and it sits NEAR the node (its box overlaps/abuts the node rect — not parked at 0,0).
 *   2. DELETE ACTS ON THE BOUND GRAPH — clicking the toolbar's Delete button removes the
 *      node (`toHaveCount(0)` for the 'Alpha' body — NOT a count-only delta), `node-count`
 *      decrements 2→1, and `node-action-readout` shows 'delete' (the @node-action emit).
 *   3. PIXEL-SAFE — the DEFAULT `FlowCanvas` demo (NO :node-toolbar) shows NO
 *      `.rozie-flow-toolbar` on select → existing canvases are untouched (the
 *      FlowCanvasScreenshot baseline is byte-identical; toolbar is strictly opt-in).
 *
 * Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-toolbar [${target}]: opt-in NodeToolbar pops over the selected node; Delete acts on the bound graph; off by default`, async ({
    page,
  }) => {
    // ---- 1+2. WITH :node-toolbar — select a node → toolbar pops → Delete removes it ----
    await page.goto(`/?example=FlowCanvasToolbar&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    const nodeCount = page.getByTestId('node-count');
    const actionReadout = page.getByTestId('node-action-readout');
    await expect(nodeCount).toHaveText('2');
    await expect(actionReadout).toHaveText('—');

    // toolbar is ABSENT until a node is selected (display:none / not visible).
    const toolbar = page.locator('.rozie-flow-toolbar');
    await expect(toolbar).toBeHidden();

    // SELECT the 'Alpha' node body (click near the label, away from the output socket).
    const alpha = page.locator('.rozie-flow-node', { hasText: 'Alpha' });
    await expect(alpha).toHaveCount(1);
    const ab = await alpha.first().boundingBox();
    if (!ab) throw new Error('Alpha node bounding box unavailable');
    await page.mouse.click(ab.x + 14, ab.y + 10);

    // selection settles — the `.is-selected` class lands on the node box.
    await expect(
      page.locator('.rozie-flow-node.is-selected', { hasText: 'Alpha' }),
    ).toHaveCount(1, { timeout: 5_000 });

    // ---- 1. the toolbar pops over the selected node ----
    await expect(toolbar).toBeVisible({ timeout: 5_000 });
    // it sits NEAR the node (overlaps/abuts the node rect — not parked at the origin).
    const tb = await toolbar.first().boundingBox();
    const ab2 = await alpha.first().boundingBox();
    if (!tb || !ab2) throw new Error('toolbar / node bounding box unavailable');
    // horizontal overlap with the node, and vertically within ~80px of the node top edge.
    const horizOverlap = tb.x < ab2.x + ab2.width && tb.x + tb.width > ab2.x;
    expect(horizOverlap, `toolbar x ${tb.x.toFixed(0)} not over node x ${ab2.x.toFixed(0)}..${(ab2.x + ab2.width).toFixed(0)}`).toBe(true);
    expect(
      Math.abs(tb.y + tb.height - ab2.y) < 90 || Math.abs(tb.y - (ab2.y + ab2.height)) < 90,
      `toolbar y ${tb.y.toFixed(0)} not adjacent to node y ${ab2.y.toFixed(0)}/${(ab2.y + ab2.height).toFixed(0)}`,
    ).toBe(true);

    // ---- 2. Delete button removes the node from the bound graph + fires @node-action ----
    await page.getByTestId('flow-toolbar-delete').dispatchEvent('pointerup');
    await expect(alpha).toHaveCount(0, { timeout: 10_000 });
    await expect(nodeCount).toHaveText('1', { timeout: 10_000 });
    await expect(actionReadout).toHaveText('delete', { timeout: 10_000 });

    // ---- 3. PIXEL-SAFE — the DEFAULT FlowCanvas demo has NO toolbar on select ----
    await page.goto(`/?example=FlowCanvas&target=${target}`);
    const mount2 = page.getByTestId('rozie-mount');
    await expect(mount2).toBeVisible();
    const canvas2 = page.locator('.rozie-flow-canvas').first();
    await expect(canvas2).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    // the toolbar host is NOT rendered at all (r-if off when :node-toolbar is false).
    await expect(page.locator('.rozie-flow-toolbar')).toHaveCount(0);
    // selecting a node still pops nothing.
    const someNode = page.locator('.rozie-flow-node').first();
    const sb = await someNode.boundingBox();
    if (!sb) throw new Error('node bounding box unavailable');
    await page.mouse.click(sb.x + 14, sb.y + 10);
    await page.waitForTimeout(500);
    await expect(page.locator('.rozie-flow-toolbar')).toHaveCount(0);
  });
}

/**
 * rete-flow-background — Phase 74 (D-01..D-04): the `:background` variant switch
 * (dots | lines | cross | none), the React Flow `<Background variant>` parity.
 *
 * Loader → examples/demos/FlowCanvasBackgroundDemo.rozie: a single `step` node + 4
 * toggle buttons (`bg-dots`/`bg-lines`/`bg-cross`/`bg-none`) driving the canvas's own
 * local `background` state, plus a `current-background` readout.
 *
 * Asserts:
 *   1. clicking each of the 4 buttons updates the `current-background` readout.
 *   2. the canvas's COMPUTED `background-image` is pairwise DISTINCT across
 *      dots/lines/cross (a real rendered-CSS change, not just a class toggle).
 *   3. `none` has NO gradient image in its computed `background-image` (accepts the
 *      literal `'none'` keyword or an empty/gradient-free value).
 *   4. D-02 BYTE-IDENTITY — the EXISTING unmodified `FlowCanvas` demo (no `:background`
 *      prop set) computes the SAME `background-image` as the `dots` variant here,
 *      proving the untouched default is unchanged at the rendered-CSS level (not just
 *      source-level).
 *
 * Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-background [${target}]: :background switches dots/lines/cross/none; default stays byte-identical`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasBackground&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    const readout = page.getByTestId('current-background');
    const bgImage = () => canvas.evaluate((el) => getComputedStyle(el).backgroundImage);

    // ---- 1. dots (initial state) ----
    await expect(readout).toHaveText('dots');
    const dotsBg = await bgImage();
    expect(dotsBg.length).toBeGreaterThan(0);

    // ---- lines ----
    await page.getByTestId('bg-lines').click();
    await expect(readout).toHaveText('lines');
    const linesBg = await bgImage();
    expect(linesBg).not.toBe(dotsBg);

    // ---- cross ----
    await page.getByTestId('bg-cross').click();
    await expect(readout).toHaveText('cross');
    const crossBg = await bgImage();
    expect(crossBg).not.toBe(dotsBg);
    expect(crossBg).not.toBe(linesBg);

    // ---- none — no gradient image at all ----
    await page.getByTestId('bg-none').click();
    await expect(readout).toHaveText('none');
    const noneBg = await bgImage();
    expect(noneBg).not.toContain('radial-gradient');
    expect(noneBg).not.toContain('linear-gradient');

    // ---- back to dots, re-confirm ----
    await page.getByTestId('bg-dots').click();
    await expect(readout).toHaveText('dots');
    expect(await bgImage()).toBe(dotsBg);

    // ---- 4. D-02 byte-identity — the untouched default FlowCanvas demo (no
    // :background prop) computes the SAME background-image as `dots` here. ----
    await page.goto(`/?example=FlowCanvas&target=${target}`);
    const mount2 = page.getByTestId('rozie-mount');
    await expect(mount2).toBeVisible();
    const canvas2 = page.locator('.rozie-flow-canvas').first();
    await expect(canvas2).toBeVisible({ timeout: 15_000 });
    const defaultBg = await canvas2.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(defaultBg).toBe(dotsBg);
  });
}

/**
 * rete-flow-resize — Phase 74 (D-05/D-08/D-09/D-10/D-15/D-16): the NodeResizer
 * corner-handle interaction (the React Flow `<NodeResizer/>` parity).
 *
 * Loader → examples/demos/FlowCanvasResizeDemo.rozie: a single `resizable` `note` node
 * (`min-width="80"` / `min-height="60"` / `max-width="400"` / `max-height="300"`) + an
 * `undo-btn`, plus bound-model `node-width`/`node-height` readouts (default the literal
 * string `'auto'` when the node has no explicit size).
 *
 * Proves on all 6:
 *
 *   1. SELECTION-GATED VISIBILITY — the 4 corner handles (`flow-resize-handle-{nw,ne,
 *      sw,se}`) are HIDDEN before any node is selected; selecting the node makes all 4
 *      VISIBLE, with the `se` handle sitting at the node's bottom-right corner.
 *   2. DRAG-TO-RESIZE WRITE-BACK — dragging the `se` handle outward changes the BOUND
 *      `node-width`/`node-height` readouts from `'auto'` to specific larger numbers
 *      (SETTLED — the write-back is rAF-coalesced, D-09).
 *   3. UNDO — clicking `undo-btn` reverts both readouts back to `'auto'` (D-10, one
 *      resize gesture = one undo step).
 *   4. DOUBLE-CLICK RESET — re-resizing the node then double-clicking (two rapid
 *      pointerup cycles within the handle's timing-window double-click detection) the
 *      `se` handle ALSO reverts both readouts to `'auto'` (D-08) — a SECOND, independent
 *      proof of the reset path, distinct from the undo assertion above.
 *
 * Asserts the SETTLED readouts only. Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-resize [${target}]: selection-gated corner handles drag-resize the bound graph; undo and double-click both reset to auto`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasResize&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    const widthReadout = page.getByTestId('node-width');
    const heightReadout = page.getByTestId('node-height');
    const readWidth = async (): Promise<string> => (await widthReadout.textContent())?.trim() ?? '';
    const readHeight = async (): Promise<string> => (await heightReadout.textContent())?.trim() ?? '';
    await expect(widthReadout).toHaveText('auto');
    await expect(heightReadout).toHaveText('auto');

    const nwHandle = page.getByTestId('flow-resize-handle-nw');
    const neHandle = page.getByTestId('flow-resize-handle-ne');
    const swHandle = page.getByTestId('flow-resize-handle-sw');
    const seHandle = page.getByTestId('flow-resize-handle-se');

    // ---- 1a. HIDDEN before any node is selected ----
    await expect(nwHandle).toBeHidden();
    await expect(neHandle).toBeHidden();
    await expect(swHandle).toBeHidden();
    await expect(seHandle).toBeHidden();

    // ---- select the node (click near its center, away from any edge) ----
    const node = page.locator('.rozie-flow-node').first();
    await expect(node).toBeVisible({ timeout: 10_000 });
    const nb0 = await node.boundingBox();
    if (!nb0) throw new Error('node bounding box unavailable');
    await page.mouse.click(nb0.x + nb0.width / 2, nb0.y + nb0.height / 2);
    await expect(page.locator('.rozie-flow-node.is-selected')).toHaveCount(1, { timeout: 5_000 });

    // ---- 1b. VISIBLE post-selection; se sits at the node's bottom-right corner ----
    await expect(seHandle).toBeVisible({ timeout: 5_000 });
    await expect(nwHandle).toBeVisible();
    await expect(neHandle).toBeVisible();
    await expect(swHandle).toBeVisible();

    const nb1 = await node.boundingBox();
    const seBox1 = await seHandle.boundingBox();
    if (!nb1 || !seBox1) throw new Error('node / se-handle bounding box unavailable');
    const seCx1 = seBox1.x + seBox1.width / 2;
    const seCy1 = seBox1.y + seBox1.height / 2;
    expect(Math.abs(seCx1 - (nb1.x + nb1.width)), 'se handle x not at the node right edge').toBeLessThan(20);
    expect(Math.abs(seCy1 - (nb1.y + nb1.height)), 'se handle y not at the node bottom edge').toBeLessThan(20);

    // ---- 2. DRAG-TO-RESIZE: drag the se handle outward → bound width/height change ----
    const DX = 60;
    const DY = 40;
    await page.mouse.move(seCx1, seCy1);
    await page.mouse.down();
    await page.mouse.move(seCx1 + DX / 2, seCy1 + DY / 2, { steps: 6 });
    await page.mouse.move(seCx1 + DX, seCy1 + DY, { steps: 6 });
    await page.mouse.up();

    await expect
      .poll(readWidth, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe('auto');
    await expect
      .poll(readHeight, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe('auto');

    // settle, then capture the resized values.
    await page.waitForTimeout(400);
    const resizedWidth = Number(await readWidth());
    const resizedHeight = Number(await readHeight());
    expect(resizedWidth).toBeGreaterThan(80);
    expect(resizedHeight).toBeGreaterThan(60);
    await page.waitForTimeout(300);
    expect(await readWidth(), 'width readout must be settled (no echo loop)').toBe(String(resizedWidth));
    expect(await readHeight(), 'height readout must be settled (no echo loop)').toBe(String(resizedHeight));

    // ---- 3. UNDO: one click reverts BOTH readouts back to 'auto' ----
    await page.getByTestId('undo-btn').click();
    await expect
      .poll(readWidth, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('auto');
    await expect
      .poll(readHeight, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('auto');
    await page.waitForTimeout(300);
    expect(await readWidth(), 'undo must hold at auto (no oscillation)').toBe('auto');
    expect(await readHeight(), 'undo must hold at auto (no oscillation)').toBe('auto');

    // ---- 4. DOUBLE-CLICK RESET: re-drag to re-establish a size, then double-click se ----
    // (re-read the handle's live position — undo may have reverted the box size).
    const seBox2 = await seHandle.boundingBox();
    if (!seBox2) throw new Error('se-handle bounding box unavailable (post-undo)');
    const seCx2 = seBox2.x + seBox2.width / 2;
    const seCy2 = seBox2.y + seBox2.height / 2;
    await page.mouse.move(seCx2, seCy2);
    await page.mouse.down();
    await page.mouse.move(seCx2 + DX / 2, seCy2 + DY / 2, { steps: 6 });
    await page.mouse.move(seCx2 + DX, seCy2 + DY, { steps: 6 });
    await page.mouse.up();

    await expect
      .poll(readWidth, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe('auto');
    await page.waitForTimeout(400);

    // double-click (via timing-window pointerup pairing — §resetNodeSize) the se handle
    // at its NEW resized position: two rapid full down/up cycles at the same point.
    const seBox3 = await seHandle.boundingBox();
    if (!seBox3) throw new Error('se-handle bounding box unavailable (post re-resize)');
    const seCx3 = seBox3.x + seBox3.width / 2;
    const seCy3 = seBox3.y + seBox3.height / 2;
    await page.mouse.click(seCx3, seCy3);
    await page.mouse.click(seCx3, seCy3);

    await expect
      .poll(readWidth, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('auto');
    await expect
      .poll(readHeight, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('auto');
    await page.waitForTimeout(300);
    expect(await readWidth(), 'double-click reset must hold at auto').toBe('auto');
    expect(await readHeight(), 'double-click reset must hold at auto').toBe('auto');
  });
}

/**
 * rete-resize-dblclick-zoom regression — a resize-handle double-click must reset the
 * node's size WITHOUT ALSO triggering rete AreaPlugin's own dblclick-to-zoom (k *= 1.4).
 *
 * Root cause (debug session `.planning/debug/resolved/rete-resize-dblclick-zoom.md`):
 * rete-area-plugin's `Zoom` class installs a plain, undelegated
 * `container.addEventListener('dblclick', ...)` on the area container, tagged
 * `source: 'dblclick'` in its guard-pipe context. FlowCanvas.rozie's `area.addPipe`
 * now vetoes that specific source (alongside the pre-existing `zoomable === false`
 * veto), through rete's own official interception point — not by fighting the DOM
 * event (which is unreliable cross-target: React/Svelte 5/Solid DELEGATE the
 * `dblclick` event type to a shared root/document dispatcher, so a template-bound
 * `stopPropagation()` on the handle runs too late to stop rete's plain ancestor
 * listener; only Vue/Angular/Lit — which attach true native per-element listeners —
 * would have "worked" by accident).
 *
 * Reads the area container's live CSS transform directly (piercing shadow roots for
 * Lit) before and after a REAL double-click (`page.mouse.dblclick`, not two synthetic
 * `.click()` calls — those never produce a native `dblclick`) and asserts it is
 * BYTE-IDENTICAL, while the size reset (the actual D-08 feature) still fires.
 */
function readAreaTransform(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    function walk(root: Document | ShadowRoot): string | null {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const transform = (el as HTMLElement).style?.transform;
        if (transform && transform.includes('translate')) return transform;
        if ((el as HTMLElement).shadowRoot) {
          const found = walk((el as HTMLElement).shadowRoot as ShadowRoot);
          if (found) return found;
        }
      }
      return null;
    }
    return walk(document);
  });
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-resize-dblclick-zoom [${target}]: a resize-handle double-click resets size WITHOUT zooming the canvas`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasResize&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    const widthReadout = page.getByTestId('node-width');
    const readWidth = async (): Promise<string> => (await widthReadout.textContent())?.trim() ?? '';

    const node = page.locator('.rozie-flow-node').first();
    const nb0 = await node.boundingBox();
    if (!nb0) throw new Error('node bounding box unavailable');
    await page.mouse.click(nb0.x + nb0.width / 2, nb0.y + nb0.height / 2);
    await expect(page.locator('.rozie-flow-node.is-selected')).toHaveCount(1, { timeout: 5_000 });

    const seHandle = page.getByTestId('flow-resize-handle-se');
    await expect(seHandle).toBeVisible({ timeout: 5_000 });

    // Establish an explicit size first (mirrors rete-flow-resize) so the double-click
    // reset below has something real to clear back to 'auto'.
    const seBox1 = await seHandle.boundingBox();
    if (!seBox1) throw new Error('se-handle bounding box unavailable');
    const seCx1 = seBox1.x + seBox1.width / 2;
    const seCy1 = seBox1.y + seBox1.height / 2;
    await page.mouse.move(seCx1, seCy1);
    await page.mouse.down();
    await page.mouse.move(seCx1 + 60, seCy1 + 40, { steps: 6 });
    await page.mouse.up();
    await expect.poll(readWidth, { timeout: 10_000, intervals: [100, 300, 600, 1000] }).not.toBe('auto');
    await page.waitForTimeout(400);

    const transformBefore = await readAreaTransform(page);
    // NON-VACUITY GUARD: readAreaTransform returns `string | null`, so if the area
    // container is ever restructured such that the walk finds nothing, the final
    // transformAfter === transformBefore assertion would degrade to
    // expect(null).toBe(null) and pass while testing NOTHING. Pin that both reads are
    // real transform strings, so this cell fails loudly rather than going quietly green.
    expect(
      transformBefore,
      'area transform must be readable — otherwise the zoom assertion below is vacuous',
    ).toBeTruthy();

    // The actual reproduction: a REAL native double-click (page.mouse.dblclick — two
    // synthetic .click() calls do NOT produce a native 'dblclick').
    const seBox2 = await seHandle.boundingBox();
    if (!seBox2) throw new Error('se-handle bounding box unavailable (post-resize)');
    await page.mouse.dblclick(seBox2.x + seBox2.width / 2, seBox2.y + seBox2.height / 2);

    // The D-08 reset still fires (pointerup-timing, independent of dblclick).
    await expect.poll(readWidth, { timeout: 5_000, intervals: [100, 300, 600, 1000] }).toBe('auto');
    await page.waitForTimeout(300);
    expect(await readWidth(), 'double-click reset must hold at auto').toBe('auto');

    // The regression: rete's own dblclick-to-zoom must NOT have fired.
    const transformAfter = await readAreaTransform(page);
    expect(transformAfter, 'the resize-handle double-click must not zoom the canvas').toBe(
      transformBefore,
    );
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// rete-flow-reactive-* helpers (quick-260803-s3m).
//
// All three re-read the LIVE bounding box on every call, so repeated gestures on the
// same node compose (a node that already moved is grabbed at its new position) and a
// panned viewport never desyncs the grab point.
// ───────────────────────────────────────────────────────────────────────────────

/** The node box whose `#body` carries `label`. */
function nodeByLabel(page: Page, label: string) {
  return page.locator('.rozie-flow-node', { hasText: label }).first();
}

/**
 * The accumulate / shortcut modifier key (quick-260803-uwb).
 *
 * BOTH keys work on BOTH platforms — rete's `accumulateOnCtrl()` tracks a DOCUMENT
 * keydown/keyup for `e.key === 'Control' || e.key === 'Meta'` (rete-area-plugin
 * .esm.js:966-979), and the canvas's own keydown handler tests `e.ctrlKey || e.metaKey`
 * (FlowCanvas.rozie:1490-1506). We pick `Meta` on darwin anyway because on macOS a
 * Ctrl+LEFT-CLICK is remapped by the OS into a CONTEXT-MENU gesture, which would corrupt
 * the accumulate cell locally while still passing in Linux Docker — a divergence that only
 * shows up in CI. `Meta` sidesteps it entirely and is the native macOS idiom besides.
 */
const MOD: 'Meta' | 'Control' = process.platform === 'darwin' ? 'Meta' : 'Control';

/**
 * Drag the labelled node by (dx, dy) using the house grab/step technique: grab near the
 * node's top-left label area (`+14, +10`) — away from the right-edge output socket — so
 * this is a node-MOVE gesture and never a connect gesture, then two stepped moves so the
 * area-plugin's Drag fires pointermove → `nodetranslate` → write-back.
 */
async function dragNodeBy(page: Page, label: string, dx: number, dy = 0): Promise<void> {
  const node = nodeByLabel(page, label);
  await expect(node).toBeVisible({ timeout: 10_000 });
  const nb = await node.boundingBox();
  if (!nb) throw new Error(`${label} node bounding box unavailable`);
  const grabX = nb.x + 14;
  const grabY = nb.y + 10;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + dx / 2, grabY + dy / 2, { steps: 6 });
  await page.mouse.move(grabX + dx, grabY + dy, { steps: 6 });
  await page.mouse.up();
}

/** Click the labelled node's body (the `nodepicked` gesture), away from its sockets. */
async function clickNodeBody(page: Page, label: string): Promise<void> {
  const node = nodeByLabel(page, label);
  await expect(node).toBeVisible({ timeout: 10_000 });
  const nb = await node.boundingBox();
  if (!nb) throw new Error(`${label} node bounding box unavailable`);
  await page.mouse.click(nb.x + 14, nb.y + 10);
}

/**
 * Click the labelled node's body while the accumulate MODIFIER is HELD (quick-260803-uwb).
 *
 * `keyboard.down(MOD)` / `keyboard.up(MOD)` around the click — NOT `click({ modifiers })` —
 * because rete's accumulate predicate reads a DOCUMENT-level keydown/keyup pair it tracks
 * itself (rete-area-plugin.esm.js:966-979), not the `ctrlKey`/`metaKey` flag on the click
 * event. A modifiers-only click never fires the keydown, so the predicate would stay false
 * and the cell would "prove" a non-accumulating selection on a correctly-accumulating build.
 */
async function modClickNode(page: Page, label: string): Promise<void> {
  const node = nodeByLabel(page, label);
  await expect(node).toBeVisible({ timeout: 10_000 });
  const nb = await node.boundingBox();
  if (!nb) throw new Error(`${label} node bounding box unavailable`);
  await page.keyboard.down(MOD);
  try {
    await page.mouse.click(nb.x + 14, nb.y + 10);
  } finally {
    await page.keyboard.up(MOD);
  }
}

/**
 * Drag from one node's OUTPUT socket to another's INPUT socket (the rete-flow-drag
 * socket-locator technique) — the connect gesture.
 */
async function dragConnect(page: Page, fromLabel: string, toLabel: string): Promise<void> {
  const out = nodeByLabel(page, fromLabel).locator('.rozie-flow-socket--output').first();
  const inn = nodeByLabel(page, toLabel).locator('.rozie-flow-socket--input').first();
  await expect(out).toBeVisible({ timeout: 10_000 });
  await expect(inn).toBeVisible({ timeout: 10_000 });
  const ob = await out.boundingBox();
  const ib = await inn.boundingBox();
  if (!ob || !ib) throw new Error('socket bounding boxes unavailable');
  const ox = ob.x + ob.width / 2;
  const oy = ob.y + ob.height / 2;
  const ix = ib.x + ib.width / 2;
  const iy = ib.y + ib.height / 2;
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  await page.mouse.move((ox + ix) / 2, (oy + iy) / 2, { steps: 8 });
  await page.mouse.move(ix, iy, { steps: 8 });
  await page.mouse.up();
}

/**
 * 22. RUNTIME-REACTIVE `readonly` (quick-260803-s3m).
 *
 * `readonly` used to be read ONCE in `$onMount` (it only ever decided whether the
 * selection extension + the canvas keydown listener were installed at construction), so
 * flipping it after mount did nothing at all. It is now a LIVE read on every gesture,
 * vetoed per-event in the area gate pipe (`nodetranslate` → no drag) and in the
 * connection plugin's `connectionpick` branch (→ the connect drag never starts, so no
 * ghost path is even drawn).
 *
 * Loader → examples/demos/FlowCanvasReactiveDemo.rozie (3 `task` nodes, a→b connected,
 * a→c deliberately NOT, `:fit-on-mount="false"`, all five interaction props driven off
 * local state by their own toggle buttons).
 *
 * Proves on all 6, with `readonly` flipped MID-SESSION:
 *
 *   0. BASELINE — while editable, dragging 'Alpha' writes back (bound `node0-x` climbs
 *      off its seeded 40 and settles).
 *   1. DRAG WRITE-BACK STOPS — the SAME drag under `readonly` leaves `node0-x` byte-
 *      identical (the `nodetranslate` veto; the engine never moves the box either).
 *   2. SELECTION STOPS — clicking 'Bravo' leaves `selected-count` at '0'. `readonly`
 *      KEEPS its shipped coupling to selection (D-05); decoupling is a separate task.
 *   3. DELETE IS INERT — canvas-focused Delete changes neither `node-count` nor
 *      `conn-count` (the live guard at the top of the now-unconditional keydown handler).
 *   4. CONNECT NEVER STARTS — an Alpha`out` → Charlie`in` drag leaves `conn-count` at '1'
 *      (the `connectionpick` veto).
 *   5. REVERSIBLE — toggling `readonly` back off restores BOTH the drag write-back and
 *      selection, with no remount.
 *
 * Asserts the SETTLED bound-model readouts only. Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-reactive-readonly [${target}]: flipping :readonly live stops drag write-back, selection, Delete and connect — and restores them`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasReactive&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    const node0x = page.getByTestId('node0-x');
    const readX = async (): Promise<number> =>
      Number((await node0x.textContent())?.trim() ?? 'NaN');
    const readonlyState = page.getByTestId('readonly-state');
    const readonlyBtn = page.getByTestId('readonly-btn');
    const selectedCount = page.getByTestId('selected-count');
    const nodeCount = page.getByTestId('node-count');
    const connCount = page.getByTestId('conn-count');

    // seeded state: editable, node 'a' at x=40, 3 nodes, 1 edge.
    await expect(readonlyState).toHaveText('false');
    await expect(node0x).toHaveText('40');
    await expect(nodeCount).toHaveText('3');
    await expect(connCount).toHaveText('1');

    // ---- 0. BASELINE: editable → the drag writes back into the bound graph ----
    await dragNodeBy(page, 'Alpha', 80);
    await expect
      .poll(readX, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBeGreaterThan(40);
    await page.waitForTimeout(400);
    const baselineX = await readX();
    await page.waitForTimeout(200);
    expect(await readX(), 'baseline drag readout must settle (no echo loop)').toBe(baselineX);

    // ---- flip readonly ON, live (no remount) ----
    await readonlyBtn.click();
    await expect(readonlyState).toHaveText('true', { timeout: 5_000 });

    // ---- 1. DRAG WRITE-BACK MUST STOP ----
    await dragNodeBy(page, 'Alpha', 80);
    await page.waitForTimeout(600);
    expect(
      await readX(),
      'readonly must veto the node drag — node0-x moved anyway',
    ).toBe(baselineX);

    // ---- 2. SELECTION MUST STOP (D-05: readonly stays coupled to selection) ----
    await clickNodeBody(page, 'Bravo');
    await page.waitForTimeout(500);
    await expect(selectedCount).toHaveText('0');

    // ---- 3. DELETE MUST BE INERT ----
    await canvas.focus();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    await expect(nodeCount).toHaveText('3');
    await expect(connCount).toHaveText('1');

    // ---- 4. THE CONNECT DRAG MUST NOT EVEN START (connectionpick veto) ----
    await dragConnect(page, 'Alpha', 'Charlie');
    await page.waitForTimeout(600);
    await expect(connCount).toHaveText('1');

    // ---- 5. REVERSIBLE: toggling readonly back off restores drag + selection ----
    await readonlyBtn.click();
    await expect(readonlyState).toHaveText('false', { timeout: 5_000 });

    await dragNodeBy(page, 'Alpha', 80);
    await expect
      .poll(readX, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBeGreaterThan(baselineX);

    await clickNodeBody(page, 'Bravo');
    await expect(selectedCount).toHaveText('1', { timeout: 10_000 });
  });
}

/**
 * 23. RUNTIME-REACTIVE `pannable` / `zoomable` (quick-260803-s3m).
 *
 * Both used to be applied by an IRREVERSIBLE construction-time engine mutation
 * (`area.area.setDragHandler(null)` / `setZoomHandler(null)` — rete's `Drag`/`Zoom` are
 * not re-instantiable from our import surface, so there was no way back). They are now
 * per-event VETOES in the area gate pipe: `Area.translate` and `Area.zoom` each AWAIT
 * their guard emit and abort on a falsy result without touching the transform, so the
 * handlers stay attached and simply have their effect refused — reversibly.
 *
 * Proves on all 6, flipping each flag MID-SESSION:
 *
 *   1. PAN — an empty-canvas drag moves the bound `viewport-x` (fed by `@translated`);
 *      under `:pannable="false"` the SAME drag leaves it byte-identical; toggling back
 *      moves it again.
 *   2. ZOOM — a wheel over the canvas moves `zoom-readout` (the 2dp bound `zoom` model);
 *      under `:zoomable="false"` the SAME wheel leaves it byte-identical; toggling back
 *      moves it again.
 *
 * The drag starts in the top-left gutter (clear of every node, which sit at graph x≥40
 * and only ever move further right/down as the viewport pans) so it is always a
 * pan gesture, never a node drag. Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-reactive-viewport [${target}]: flipping :pannable / :zoomable live blocks and restores the background pan and the wheel zoom`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasReactive&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    const viewportX = page.getByTestId('viewport-x');
    const zoomReadout = page.getByTestId('zoom-readout');
    const readVx = async (): Promise<string> => (await viewportX.textContent())?.trim() ?? '';
    const readZoom = async (): Promise<string> => (await zoomReadout.textContent())?.trim() ?? '';

    await expect(page.getByTestId('pannable-state')).toHaveText('true');
    await expect(page.getByTestId('zoomable-state')).toHaveText('true');
    await expect(zoomReadout).toHaveText('1.00');

    const cb = await canvas.boundingBox();
    if (!cb) throw new Error('canvas bounding box unavailable');
    // an EMPTY-canvas drag from the top-left gutter (nodes sit at graph x≥40 and only
    // move further right/down as the viewport pans).
    const panDrag = async (): Promise<void> => {
      const x0 = cb.x + 8;
      const y0 = cb.y + 8;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x0 + 60, y0 + 30, { steps: 8 });
      await page.mouse.move(x0 + 120, y0 + 60, { steps: 8 });
      await page.mouse.up();
    };
    const wheelZoom = async (): Promise<void> => {
      await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
      await page.mouse.wheel(0, -120);
    };

    // ---- 1a. PAN works while :pannable ----
    const vx0 = await readVx();
    await panDrag();
    await expect
      .poll(readVx, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe(vx0);
    await page.waitForTimeout(400);
    const vxPanned = await readVx();

    // ---- 1b. :pannable=false → the SAME drag does NOT pan ----
    await page.getByTestId('pannable-btn').click();
    await expect(page.getByTestId('pannable-state')).toHaveText('false', { timeout: 5_000 });
    await panDrag();
    await page.waitForTimeout(600);
    expect(
      await readVx(),
      'pannable=false must veto the viewport translate — viewport-x moved anyway',
    ).toBe(vxPanned);

    // ---- 1c. toggling back restores the pan (the veto is reversible) ----
    await page.getByTestId('pannable-btn').click();
    await expect(page.getByTestId('pannable-state')).toHaveText('true', { timeout: 5_000 });
    await panDrag();
    await expect
      .poll(readVx, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe(vxPanned);

    // ---- 2a. ZOOM works while :zoomable ----
    await wheelZoom();
    await expect
      .poll(readZoom, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe('1.00');
    await page.waitForTimeout(400);
    const zoomed = await readZoom();

    // ---- 2b. :zoomable=false → the SAME wheel does NOT zoom ----
    await page.getByTestId('zoomable-btn').click();
    await expect(page.getByTestId('zoomable-state')).toHaveText('false', { timeout: 5_000 });
    await wheelZoom();
    await page.waitForTimeout(600);
    expect(
      await readZoom(),
      'zoomable=false must veto the wheel zoom — zoom-readout moved anyway',
    ).toBe(zoomed);

    // ---- 2c. toggling back restores the zoom ----
    await page.getByTestId('zoomable-btn').click();
    await expect(page.getByTestId('zoomable-state')).toHaveText('true', { timeout: 5_000 });
    await wheelZoom();
    await expect
      .poll(readZoom, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe(zoomed);
  });
}

/**
 * 24. RUNTIME-REACTIVE `selectable` (quick-260803-s3m).
 *
 * `selectable` used to decide, at construction, whether `AreaExtensions.selectableNodes`
 * was installed at all (`selector`/`nodeSelectApi` stayed null otherwise). The extension
 * is now installed unconditionally and the pick is vetoed per-event on the `nodepicked`
 * signal off a LIVE `$props.selectable` read — plus a `$watch` that CLEARS the live
 * selection the moment the flag goes false (which also hides the NodeToolbar and the
 * resize handles through the existing selection-change chain).
 *
 * Proves on all 6:
 *
 *   1. A pick selects ('Alpha' → `selected-count` '1').
 *   2. `:selectable="false"` CLEARS the standing selection → '0' (the `$watch`).
 *   3. A further pick under `selectable=false` does nothing → still '0' (the veto).
 *   4. Toggling back restores picking → '1', no remount.
 *
 * Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-reactive-select [${target}]: flipping :selectable live clears the selection, blocks further picks, and restores them`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasReactive&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    const selectedCount = page.getByTestId('selected-count');
    const selectableState = page.getByTestId('selectable-state');
    const selectableBtn = page.getByTestId('selectable-btn');

    await expect(selectableState).toHaveText('true');
    await expect(selectedCount).toHaveText('0');

    // ---- 1. a pick selects ----
    await clickNodeBody(page, 'Alpha');
    await expect(selectedCount).toHaveText('1', { timeout: 10_000 });

    // ---- 2. :selectable=false CLEARS the standing selection ($watch) ----
    await selectableBtn.click();
    await expect(selectableState).toHaveText('false', { timeout: 5_000 });
    await expect(selectedCount).toHaveText('0', { timeout: 10_000 });

    // ---- 3. a further pick under selectable=false does nothing (nodepicked veto) ----
    await clickNodeBody(page, 'Bravo');
    await page.waitForTimeout(500);
    await expect(selectedCount).toHaveText('0');

    // ---- 4. toggling back restores picking ----
    await selectableBtn.click();
    await expect(selectableState).toHaveText('true', { timeout: 5_000 });
    await clickNodeBody(page, 'Bravo');
    await expect(selectedCount).toHaveText('1', { timeout: 10_000 });
  });
}

/**
 * 25. RUNTIME-REACTIVE `snapGrid` (quick-260803-s3m).
 *
 * `AreaExtensions.snapGrid` captures its `size` ONCE at install and has no function form,
 * so it is structurally unusable for reactivity. Its entire behaviour is
 * `Math.round(v / size) * size` on the `nodetranslate` signal — reimplemented inline in
 * the gate pipe off a LIVE `$props.snapGrid` read (returning a FRESH context, mirroring
 * the extension's own spread shape).
 *
 * Proves on all 6, flipping the grid MID-SESSION:
 *
 *   1. `snapGrid` 0 → 25 makes the NEXT drag snap: a deliberately non-multiple +83px
 *      delta from the seeded (40, 40) lands the bound `node0-x` AND `node0-y` on exact
 *      multiples of 25.
 *   2. Back to 0 un-snaps: a second +83px drag from that 25-aligned origin lands
 *      `node0-x` OFF the grid (83 is not a multiple of 25, so a snapped result is
 *      arithmetically impossible if snapping were still live).
 *
 * Asserts the SETTLED bound-model readouts. Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-reactive-snap [${target}]: flipping :snap-grid live snaps the next drag to the grid, and un-snaps when turned off`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasReactive&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    const node0x = page.getByTestId('node0-x');
    const node0y = page.getByTestId('node0-y');
    const snapState = page.getByTestId('snap-state');
    const snapBtn = page.getByTestId('snap-btn');
    const readX = async (): Promise<string> => (await node0x.textContent())?.trim() ?? '';
    const readY = async (): Promise<string> => (await node0y.textContent())?.trim() ?? '';

    await expect(snapState).toHaveText('0');
    await expect(node0x).toHaveText('40');
    await expect(node0y).toHaveText('40');

    // ---- 1. snapGrid 0 → 25: the NEXT drag snaps ----
    await snapBtn.click();
    await expect(snapState).toHaveText('25', { timeout: 5_000 });

    await dragNodeBy(page, 'Alpha', 83);
    await expect
      .poll(readX, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe('40');
    await page.waitForTimeout(400);

    const snappedX = Number(await readX());
    const snappedY = Number(await readY());
    expect(
      snappedX % 25,
      `snapGrid=25 must snap the drag — node0-x settled at ${snappedX}`,
    ).toBe(0);
    expect(
      snappedY % 25,
      `snapGrid=25 must snap the drag — node0-y settled at ${snappedY}`,
    ).toBe(0);

    // ---- 2. back to 0: the next drag is NOT snapped ----
    await snapBtn.click();
    await expect(snapState).toHaveText('0', { timeout: 5_000 });

    await dragNodeBy(page, 'Alpha', 83);
    await expect
      .poll(readX, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .not.toBe(String(snappedX));
    await page.waitForTimeout(400);

    const freeX = Number(await readX());
    expect(
      freeX % 25,
      `snapGrid=0 must stop snapping — node0-x settled at ${freeX} (a multiple of 25)`,
    ).not.toBe(0);
  });
}

/**
 * 26. `accumulateOnCtrl` — Ctrl/Cmd-click ADDS to the selection, and turning it off makes
 * the modified click REPLACE instead (quick-260803-uwb, brief #1).
 *
 * `accumulateOnCtrl` (default `true`, FlowCanvas.rozie:174-178) had shipped with NO VR
 * coverage on either branch. It is CONSTRUCTION-TIME — consumed exactly once at the
 * `$onMount` `AreaExtensions.selectableNodes(area, selector, { accumulating: … })` install
 * (FlowCanvas.rozie:2278-2282, whose own comment says it "stays construction-time — it is
 * not one of the five live props") — so the false branch cannot be reached by a toggle.
 * This cell therefore does TWO `page.goto`s in ONE test against two dedicated demos (the
 * shipped NodeToolbar-cell precedent, which re-navigates mid-test); an `r-if` remount would
 * drag full engine teardown/re-init across 6 targets into a coverage cell.
 *
 * PART A — `?example=FlowCanvasVerbs` (accumulate ON, the default):
 *   1. baseline: the 3 nodes render and nothing is selected.
 *   2. a plain click on 'Alpha' selects 1.
 *   3. MOD-click 'Bravo' → 2 — the modified pick ACCUMULATED.
 *   4. MOD-click 'Charlie' → 3 — it keeps accumulating (not a 2-item cap).
 *   5. a PLAIN click on 'Alpha' → back to 1 — an unmodified pick still REPLACES.
 *   6. corroborated at the DOM: exactly one `.rozie-flow-node.is-selected` box.
 *
 * PART B — `?example=FlowCanvasAccumOff` (`:accumulate-on-ctrl="false"`):
 *   7. a plain click on 'Alpha' selects 1 (selection itself still works).
 *   8. MOD-click 'Bravo' → STILL 1, and the single `.is-selected` box is BRAVO's.
 *      That second half is the load-bearing one: a bare '1' would ALSO pass if the
 *      modified click had been vetoed outright and Alpha were still the selected node.
 *      The contract is "the pick still happens, it just replaces instead of accumulating".
 *
 * The modifier is held via explicit `keyboard.down/up` (see `modClickNode`) because rete
 * tracks a DOCUMENT keydown/keyup pair, not the click event's `ctrlKey`/`metaKey` flag.
 *
 * Asserts the BOUND `selected-count` (fed by @selection-change) AND the rendered
 * `.is-selected` classes. Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-accumulate [${target}]: Ctrl/Cmd-click accumulates the selection by default, and replaces it when :accumulate-on-ctrl is false`, async ({
    page,
  }) => {
    const selectedCount = page.getByTestId('selected-count');
    const selectedBoxes = page.locator('.rozie-flow-node.is-selected');

    // ─────────── PART A: accumulate ON (the default) ───────────
    await page.goto(`/?example=FlowCanvasVerbs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);
    await expect(selectedCount).toHaveText('0');

    // ---- 2. plain pick → 1 ----
    await clickNodeBody(page, 'Alpha');
    await expect(selectedCount).toHaveText('1', { timeout: 10_000 });

    // ---- 3. MOD-click 'Bravo' → ACCUMULATES to 2 ----
    await modClickNode(page, 'Bravo');
    await expect(selectedCount).toHaveText('2', { timeout: 10_000 });

    // ---- 4. MOD-click 'Charlie' → keeps accumulating to 3 ----
    await modClickNode(page, 'Charlie');
    await expect(selectedCount).toHaveText('3', { timeout: 10_000 });
    await expect(selectedBoxes).toHaveCount(3, { timeout: 10_000 });

    // ---- 5. a PLAIN pick REPLACES the accumulated selection ----
    await clickNodeBody(page, 'Alpha');
    await expect(selectedCount).toHaveText('1', { timeout: 10_000 });
    // ---- 6. corroborate at the DOM (not count-only on the model) ----
    await expect(selectedBoxes).toHaveCount(1, { timeout: 10_000 });

    // ─────────── PART B: accumulate OFF (a SECOND MOUNT — S2) ───────────
    await page.goto(`/?example=FlowCanvasAccumOff&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvasOff = page.locator('.rozie-flow-canvas').first();
    await expect(canvasOff).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);
    await expect(selectedCount).toHaveText('0');

    // ---- 7. a plain pick still works with accumulation off ----
    await clickNodeBody(page, 'Alpha');
    await expect(selectedCount).toHaveText('1', { timeout: 10_000 });

    // ---- 8. the MOD-click REPLACES (does not accumulate) — and the pick DID happen ----
    await modClickNode(page, 'Bravo');
    await expect(selectedCount).toHaveText('1', { timeout: 10_000 });
    await expect(selectedBoxes).toHaveCount(1, { timeout: 10_000 });
    // THE LOAD-BEARING HALF: the surviving selection is BRAVO's box, not Alpha's — the
    // modified click was honoured as a replacing pick, not vetoed.
    await expect(
      page.locator('.rozie-flow-node.is-selected', { hasText: 'Bravo' }),
    ).toHaveCount(1, { timeout: 10_000 });
  });
}

/**
 * 27. `@context-menu` — the canvas suppresses the native browser menu and surfaces
 * `{ id }` instead, WITHOUT touching the graph (quick-260803-uwb, brief #2).
 *
 * `examples/demos/FlowCanvasVerbsDemo.rozie` binds `@context-menu="onContextMenu"`, which
 * bumps `ctx-count` and writes `ctx-id` (the node id, or the literal '(pane)' when the
 * payload's `id` is null).
 *
 * The component calls `context.data.event.preventDefault()` and then
 * `$emit('context-menu', { id: ctx && ctx.id ? ctx.id : null })` (FlowCanvas.rozie:
 * 2192-2197). rete's contextmenu payload is `{ event, context: 'root' | Node | Connection }`
 * (rete-area-plugin/_types/base.d.ts:46-50), so a PANE right-click hands the string 'root',
 * which has no `.id` ⇒ the emit carries `id: null` ⇒ the demo renders '(pane)'.
 *
 * Emit-assertion style copied from the shipped `@connect-end` cell: poll the COUNT first,
 * then assert the payload readout — a payload assertion alone can race the emit.
 *
 *   1. baseline — no emit has fired (`ctx-count` '0', `ctx-id` '(none)'), 3 nodes / 1 edge.
 *   2. right-click the 'Bravo' NODE body → exactly one emit, `ctx-id` 'b' (the node id).
 *   3. right-click EMPTY canvas (bottom-right corner — the shipped deselect-point) → a
 *      second emit, `ctx-id` '(pane)' (the null-id branch).
 *   4. THE GRAPH IS UNTOUCHED after a settle: `node-count` '3' and `conn-count` '1'. A
 *      context menu is a PURE EMIT — it must never mutate the bound model.
 *
 * Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-context-menu [${target}]: right-click surfaces @context-menu with the node id (pane → null) and never mutates the graph`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasVerbs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    const ctxCount = page.getByTestId('ctx-count');
    const ctxId = page.getByTestId('ctx-id');
    const nodeCount = page.getByTestId('node-count');
    const connCount = page.getByTestId('conn-count');

    // ---- 1. baseline: nothing emitted yet; the seeded graph is 3 nodes / 1 edge ----
    await expect(ctxCount).toHaveText('0');
    await expect(ctxId).toHaveText('(none)');
    await expect(nodeCount).toHaveText('3');
    await expect(connCount).toHaveText('1');

    // ---- 2. right-click the 'Bravo' NODE body → { id: 'b' } ----
    const bravo = nodeByLabel(page, 'Bravo');
    await expect(bravo).toBeVisible({ timeout: 10_000 });
    const nb = await bravo.boundingBox();
    if (!nb) throw new Error('Bravo node bounding box unavailable');
    // +14/+10 = the house grab point: inside the body, away from the edge sockets.
    await page.mouse.click(nb.x + 14, nb.y + 10, { button: 'right' });

    await expect
      .poll(async () => Number((await ctxCount.textContent())?.trim() ?? 'NaN'), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);
    await expect(ctxId).toHaveText('b', { timeout: 10_000 });
    // exactly ONE emit for one right-click (not a double-fire through the pipe).
    await expect(ctxCount).toHaveText('1');

    // ---- 3. right-click EMPTY canvas → the null-id ('root' context) branch ----
    const cb = await canvas.boundingBox();
    if (!cb) throw new Error('canvas bounding box unavailable');
    // bottom-right corner — away from every node (they sit upper-left); the same
    // empty-canvas point the shipped selection cell uses to deselect.
    await page.mouse.click(cb.x + cb.width - 12, cb.y + cb.height - 12, {
      button: 'right',
    });
    await expect(ctxCount).toHaveText('2', { timeout: 10_000 });
    await expect(ctxId).toHaveText('(pane)', { timeout: 10_000 });

    // ---- 4. PURE EMIT: the bound graph never moved ----
    await page.waitForTimeout(400);
    await expect(nodeCount).toHaveText('3');
    await expect(connCount).toHaveText('1');
    // and no further emits arrived on their own.
    await expect(ctxCount).toHaveText('2');
  });
}

/**
 * 28. IMPERATIVE SELECTION VERBS — `selectNode` / `selectAll` / `clearSelection` /
 * `getSelectedNodes` / `centerOnNode` + `getTransform`, driven through a CONSUMER `$refs`
 * handle (quick-260803-uwb, brief #3).
 *
 * All six are in `$expose` (FlowCanvas.rozie:3521-3541) but only ever exercised
 * indirectly (the marquee cell drives the internal selector; nothing drove the verbs from a
 * consumer). The verb BODIES are target-agnostic — what actually differs per target is the
 * `$refs.<child>` handle resolution (refs-lowering), so a consumer-ref cell is the useful one.
 *
 * `examples/demos/FlowCanvasVerbsDemo.rozie` wires each verb to a button and each result to
 * a readout.
 *
 *   1. `selectNode('b')` — the BOUND `selected-count` reads 1, the RENDERED `.is-selected`
 *      box is BRAVO's (`.is-selected` is toggled from the render pipe,
 *      FlowCanvas.rozie:1578/1596 — so a programmatic select must light it up too), and
 *      `getSelectedNodes()` returns exactly `['b']` (the verb returns the NODES, not a count).
 *   2. `selectAll()` — 3 selected on the model, 3 `.is-selected` boxes, `sel-ids` 'a,b,c'.
 *   3. `clearSelection()` — 0 / 0 / '' on all three surfaces.
 *   4. `centerOnNode('c')` — observed via `@translated`, which is emitted UNCONDITIONALLY
 *      (NOT `!programmatic`-gated, FlowCanvas.rozie:2173-2174/3283-3285), so a PROGRAMMATIC
 *      recenter still surfaces. Then `getTransform()` is re-read and must agree with what
 *      `@translated` reported — a live cross-check that the getter reads the CURRENT
 *      transform rather than a stale snapshot.
 *   5. ECHO-SAFETY — after a settle the viewport readout is stable on re-sample and
 *      `node-count` is untouched: selection and viewport ops never write the graph model.
 *
 * Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-selection-verbs [${target}]: selectNode / selectAll / clearSelection / getSelectedNodes / centerOnNode / getTransform drive from a consumer ref`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasVerbs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    const selectedCount = page.getByTestId('selected-count');
    const selectedBoxes = page.locator('.rozie-flow-node.is-selected');
    const selIds = page.getByTestId('sel-ids');
    const nodeCount = page.getByTestId('node-count');
    const tx = page.getByTestId('tx');
    const viewportX = page.getByTestId('viewport-x');
    const readSelBtn = page.getByTestId('read-sel-btn');
    const readTransformBtn = page.getByTestId('read-transform-btn');

    await expect(selectedCount).toHaveText('0');
    await expect(selectedBoxes).toHaveCount(0);

    // ---- 1. selectNode('b') ----
    await page.getByTestId('select-b-btn').click();
    await expect(selectedCount).toHaveText('1', { timeout: 10_000 });
    // the RENDERED selection ring landed on the RIGHT node (not merely "some node").
    await expect(
      page.locator('.rozie-flow-node.is-selected', { hasText: 'Bravo' }),
    ).toHaveCount(1, { timeout: 10_000 });
    await expect(selectedBoxes).toHaveCount(1);
    // getSelectedNodes() returns the selected NODES — the demo maps→sorts→joins their ids.
    await readSelBtn.click();
    await expect(selIds).toHaveText('b', { timeout: 10_000 });

    // ---- 2. selectAll() ----
    await page.getByTestId('select-all-btn').click();
    await expect(selectedCount).toHaveText('3', { timeout: 10_000 });
    await expect(selectedBoxes).toHaveCount(3, { timeout: 10_000 });
    await readSelBtn.click();
    await expect(selIds).toHaveText('a,b,c', { timeout: 10_000 });

    // ---- 3. clearSelection() ----
    await page.getByTestId('clear-btn').click();
    await expect(selectedCount).toHaveText('0', { timeout: 10_000 });
    await expect(selectedBoxes).toHaveCount(0, { timeout: 10_000 });
    await readSelBtn.click();
    await expect(selIds).toHaveText('', { timeout: 10_000 });

    // ---- 4. centerOnNode('c') + getTransform() cross-check ----
    // pre-call: read the transform through the verb, and note where @translated stands.
    await readTransformBtn.click();
    await expect
      .poll(async () => (await tx.textContent())?.trim(), { timeout: 10_000 })
      .not.toBe('');
    const tx0 = (await tx.textContent())?.trim();
    const vx0 = (await viewportX.textContent())?.trim();

    await page.getByTestId('center-c-btn').click();
    // the PROGRAMMATIC recenter surfaced through the UNCONDITIONAL @translated emit.
    await expect
      .poll(async () => (await viewportX.textContent())?.trim(), {
        timeout: 10_000,
        intervals: [100, 300, 600, 1000],
      })
      .not.toBe(vx0);
    await page.waitForTimeout(400);
    const vxAfter = (await viewportX.textContent())?.trim();

    // re-read the transform through the verb: it moved, AND it agrees with what
    // @translated reported (the getter is live, not a stale mount-time snapshot).
    await readTransformBtn.click();
    await expect
      .poll(async () => (await tx.textContent())?.trim(), {
        timeout: 10_000,
        intervals: [100, 300, 600, 1000],
      })
      .not.toBe(tx0);
    expect(
      (await tx.textContent())?.trim(),
      'getTransform().x must agree with the x @translated reported',
    ).toBe(vxAfter);

    // ---- 5. ECHO-SAFETY: the viewport settles and the MODEL was never touched ----
    await page.waitForTimeout(400);
    expect((await viewportX.textContent())?.trim(), 'viewport-x is stable after the recenter').toBe(
      vxAfter,
    );
    await expect(nodeCount).toHaveText('3');
  });
}

/**
 * 29. Ctrl/Cmd+A (select all) and Ctrl/Cmd+D (duplicate selection) keybinds
 * (quick-260803-uwb, brief #4 — the quick-260803-qwh keybinds, previously untested).
 *
 * The handler (FlowCanvas.rozie:1490-1506) runs `if ($props.selectable === false ||
 * $props.readonly === true) return` FIRST — the LIVE gate — then, under
 * `(e.ctrlKey || e.metaKey) && !e.altKey`, maps `k === 'a'` → `selectAll()` and
 * `k === 'd'` → `duplicateNodes(selectedNodeIds())`.
 *
 * The listener lives on the CANVAS element (`tabindex="0"`, FlowCanvas.rozie:1463-1481,
 * template :3545), NOT on `document` — a shadow-scoped listener is the only reliably
 * cross-target path — so the cell focuses the canvas before every key (the shipped
 * Delete-cell precedent).
 *
 *   1. baseline: 3 nodes, nothing selected.
 *   2. MOD+A → all 3 selected, on the bound model AND as 3 rendered `.is-selected` boxes.
 *   3. MOD+D → `node-count` 6: the 3 clones landed in the BOUND graph (and 6 boxes render).
 *   4. ONE UNDO RESTORES ALL THREE CLONES (the D-03 "one gesture = one undo step"
 *      contract, FlowCanvas.rozie:1046-1061: `duplicateNodes` takes ONE snapshot and
 *      commits ONCE for N nodes). A single undo click must return the count to exactly 3
 *      and HOLD there — a per-node history push would need three undos and would leave
 *      the count at 5 here. This is the load-bearing step.
 *   5. INERT UNDER `readonly` — flipping it clears the selection through the shipped
 *      `$watch` (FlowCanvas.rozie:3519), and neither MOD+A nor MOD+D does anything.
 *   6. REVERSIBLE — flipping `readonly` back off restores the keybinds with no remount.
 *
 * Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-keyboard [${target}]: Ctrl/Cmd+A selects all and Ctrl/Cmd+D duplicates it as ONE undo step — and both go inert under :readonly`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasVerbs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);

    const nodeCount = page.getByTestId('node-count');
    const selectedCount = page.getByTestId('selected-count');
    const selectedBoxes = page.locator('.rozie-flow-node.is-selected');
    const readonlyState = page.getByTestId('readonly-state');
    const readonlyBtn = page.getByTestId('readonly-btn');

    // ---- 1. baseline ----
    await expect(nodeCount).toHaveText('3');
    await expect(selectedCount).toHaveText('0');
    await expect(readonlyState).toHaveText('false');

    // ---- 2. MOD+A → select all ----
    await canvas.focus();
    await page.keyboard.press(`${MOD}+a`);
    await expect(selectedCount).toHaveText('3', { timeout: 10_000 });
    await expect(selectedBoxes).toHaveCount(3, { timeout: 10_000 });

    // ---- 3. MOD+D → duplicate the whole selection into the BOUND graph ----
    await canvas.focus();
    await page.keyboard.press(`${MOD}+d`);
    await expect(nodeCount).toHaveText('6', { timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
        intervals: [100, 300, 600, 1000],
      })
      .toBe(6);

    // ---- 4. ONE undo undoes the WHOLE duplication (D-03) ----
    await page.getByTestId('undo-btn').click();
    await expect(nodeCount).toHaveText('3', { timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
        intervals: [100, 300, 600, 1000],
      })
      .toBe(3);
    // HOLD: a per-node history push would have left extra entries and the count would
    // still be settling / would need further undos.
    await page.waitForTimeout(400);
    await expect(nodeCount).toHaveText('3');

    // ---- 5. INERT UNDER readonly (the live gate at the top of the handler) ----
    await readonlyBtn.click();
    await expect(readonlyState).toHaveText('true', { timeout: 5_000 });
    // the shipped $watch clears the selection when readonly flips on.
    await expect(selectedCount).toHaveText('0', { timeout: 10_000 });

    await canvas.focus();
    await page.keyboard.press(`${MOD}+a`);
    await page.waitForTimeout(500);
    expect(
      (await selectedCount.textContent())?.trim(),
      'Ctrl/Cmd+A must be inert while readonly',
    ).toBe('0');

    await canvas.focus();
    await page.keyboard.press(`${MOD}+d`);
    await page.waitForTimeout(500);
    expect(
      (await nodeCount.textContent())?.trim(),
      'Ctrl/Cmd+D must be inert while readonly',
    ).toBe('3');

    // ---- 6. REVERSIBLE ----
    await readonlyBtn.click();
    await expect(readonlyState).toHaveText('false', { timeout: 5_000 });
    await canvas.focus();
    await page.keyboard.press(`${MOD}+a`);
    await expect(selectedCount).toHaveText('3', { timeout: 10_000 });
  });
}

/**
 * 30. `validateTypes = false` — the opt-out branch, and the proof that the prop is read
 * LIVE (quick-260803-uwb, brief #6).
 *
 * `rete-flow-advanced` covers typed validation when it is ON. The OFF branch had never
 * been driven, and neither had the LIVENESS of the read: `$props.validateTypes` is tested
 * INSIDE the `connectioncreate` pipe — `if ($props.validateTypes !== false) { … }`
 * (FlowCanvas.rozie:2060-2080) — so a toggle takes effect on the very next connect attempt.
 *
 * `examples/demos/FlowCanvasValidateOffDemo.rozie` seeds a typed 2-node pipeline with ZERO
 * connections: a `source` with number+string OUTPUTs and a `merge` with number+string
 * `multiple` INPUTs. Both merge inputs are `multiple` so a drag never EVICTS a prior edge
 * (the shipped single-input eviction would make the drawn-path counts un-assertable).
 * Sockets are located by the `typedSocketOf` port-row technique from the advanced cell —
 * both nodes are multi-port, so `.first()` would ambiguously pick num-vs-str.
 *
 * The SAME cross-type drag is driven three times:
 *   1. baseline — 2 nodes, 0 drawn paths, `conn-count` '0', `validate-state` 'true'.
 *   2. ON (regression guard) — number-out → string-in is REFUSED: nothing draws, the bound
 *      count stays '0', and `reject-reason` is 'type-mismatch' (the payload is TAGGED per
 *      rule, FlowCanvas.rozie:2077/2083 — so we prove WHICH rule refused, not merely that
 *      something did).
 *   3. OFF (the new proof) — after `validate-btn`, the IDENTICAL drag is ALLOWED: one path
 *      draws, `conn-count` climbs to '1', `accepted` to '1', and no new rejection fired.
 *   4. BACK ON (proves live, not one-shot) — the other cross-type pair (string-out →
 *      number-in, onto a still-free input) is refused again, and `reject-text` now names
 *      the NEW edge. Asserting the reject TEXT rather than only the reason matters here:
 *      the reason was already 'type-mismatch' from step 2, so a reason-only assertion
 *      would pass even if no fresh rejection had fired at all.
 *
 * Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-validate-off [${target}]: :validate-types is read LIVE — a cross-type drag is refused, then allowed with it off, then refused again`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasValidateOff&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(2);

    // counts DRAWN paths (non-empty `d`), piercing Lit's open shadow root.
    const drawnCount = async () =>
      page
        .locator('.rozie-flow-connection__path')
        .evaluateAll(
          (els) =>
            els.filter((e) => (e.getAttribute('d') || '').trim().length > 0).length,
        );

    // The TYPED socket-row locator (the advanced-cell technique): the port ROW whose label
    // span reads 'number'/'string' inside the named node, then that row's socket. `.first()`
    // would be ambiguous — both nodes carry two ports on the relevant side.
    const typedSocketOf = (node: string, side: 'output' | 'input', portLabel: string) =>
      page
        .locator('.rozie-flow-node', { hasText: node })
        .locator(`.rozie-flow-port--${side}`, { hasText: portLabel })
        .locator('.rozie-flow-socket')
        .first();

    const center = async (locator: ReturnType<typeof typedSocketOf>) => {
      await expect(locator).toBeVisible({ timeout: 10_000 });
      const box = await locator.boundingBox();
      if (!box) throw new Error('socket bounding box unavailable');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
    };

    const connCount = page.getByTestId('conn-count');
    const accepted = page.getByTestId('accepted');
    const rejectReason = page.getByTestId('reject-reason');
    const rejectText = page.getByTestId('reject-text');
    const validateState = page.getByTestId('validate-state');
    const validateBtn = page.getByTestId('validate-btn');

    // ---- 1. baseline ----
    await expect.poll(drawnCount, { timeout: 10_000 }).toBe(0);
    await expect(connCount).toHaveText('0');
    await expect(accepted).toHaveText('0');
    await expect(validateState).toHaveText('true');

    // ---- 2. validation ON: number-out → string-in is REFUSED ----
    const numOut = await center(typedSocketOf('Number Source', 'output', 'number'));
    const mergeStrIn = await center(typedSocketOf('Merge', 'input', 'string'));
    await drag(numOut, mergeStrIn);

    await expect(rejectReason).toHaveText('type-mismatch', { timeout: 10_000 });
    await expect(rejectText).toHaveText('src:num → mrg:str', { timeout: 10_000 });
    await expect.poll(drawnCount, { timeout: 5_000 }).toBe(0);
    await expect(connCount).toHaveText('0');
    await expect(accepted).toHaveText('0');

    // ---- 3. validation OFF: the IDENTICAL drag is now ALLOWED (the live read) ----
    await validateBtn.click();
    await expect(validateState).toHaveText('false', { timeout: 5_000 });

    const numOut2 = await center(typedSocketOf('Number Source', 'output', 'number'));
    const mergeStrIn2 = await center(typedSocketOf('Merge', 'input', 'string'));
    await drag(numOut2, mergeStrIn2);

    await expect
      .poll(drawnCount, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(1);
    await expect(connCount).toHaveText('1', { timeout: 10_000 });
    await expect(accepted).toHaveText('1', { timeout: 10_000 });
    // no fresh rejection fired on the accepted drag (the readout still shows step 2's).
    await expect(rejectText).toHaveText('src:num → mrg:str');

    // ---- 4. validation BACK ON: the OTHER cross-type pair is refused again ----
    await validateBtn.click();
    await expect(validateState).toHaveText('true', { timeout: 5_000 });

    const strOut = await center(typedSocketOf('Number Source', 'output', 'string'));
    const mergeNumIn = await center(typedSocketOf('Merge', 'input', 'number'));
    await drag(strOut, mergeNumIn);

    // the NEW edge is named in the reject readout — proving a FRESH rejection fired
    // (the reason alone was already 'type-mismatch' from step 2).
    await expect(rejectText).toHaveText('src:str → mrg:num', { timeout: 10_000 });
    await expect(rejectReason).toHaveText('type-mismatch');
    await expect(connCount).toHaveText('1');
    await expect.poll(drawnCount, { timeout: 5_000 }).toBe(1);
    await expect(accepted).toHaveText('1');
  });
}

/**
 * 31. DARK MODE — the zero-import `prefers-color-scheme` default, declarative AND
 * imperative (quick-260803-uwb; closes the 260702-wws dark-mode deferral).
 *
 * FlowCanvas ships dark as a top-level SCOPED `@media (prefers-color-scheme: dark)` block
 * that redefines the `--rozie-flow-*` tokens on `.rozie-flow-canvas` (FlowCanvas.rozie:
 * 3873-3910). It is zero-import and OS-driven: `themes/*.css` also define those tokens, but
 * they are opt-in imports the VR demos never make — so in a LIGHT context the tokens are
 * genuinely UNDEFINED and every rule falls back through `var(token, <literal>)`. That makes
 * `getPropertyValue('--rozie-flow-bg')` a perfect discriminator: `''` under light,
 * `'#0f172a'` under dark.
 *
 * NEW MACHINERY: `page.emulateMedia({ colorScheme })`. NOTHING in the VR suite used colour-
 * scheme emulation before this cell — every other spec runs under the default (light)
 * scheme. Reuses the EXISTING `?example=FlowCanvasMinimap` (canvas + 4 nodes + edges +
 * minimap = exactly the token surface worth asserting); no demo is modified.
 *
 *   1. LIGHT baseline — `--rozie-flow-bg` is `''` (undefined; the fallback does the work),
 *      and the RENDERED colours are the light literals.
 *   2. FLIP to dark.
 *   3. DARK, DECLARATIVE — the three discriminating tokens take their dark values AND the
 *      rendered `backgroundColor` of the canvas and of a node element actually change.
 *      Asserting the rendered colour as well as the custom property is the load-bearing
 *      part: a declared-but-unapplied token would pass a property-only check.
 *   4. DARK, IMPERATIVE — the minimap SVG reads tokens at DRAW time via `flowToken()` →
 *      `getComputedStyle(container).getPropertyValue(name)` (FlowCanvas.rozie:1261-1263,
 *      2546-2557), and the redraw is rAF-coalesced off translate/zoom/node-move — so a
 *      colour-scheme flip alone does NOT repaint it. The cell forces a redraw with the
 *      shipped minimap pointer-drag, then asserts the mask `fill` and the viewport
 *      `stroke` attributes carry the dark token values.
 *   5. BACK TO LIGHT — every one of those reverts (with another forced redraw). This is
 *      what proves the MEDIA QUERY flipped them rather than a hardcode.
 *
 * DO NOT add the connection stroke / arrowhead as a dark signal: the dark value
 * `--rozie-flow-connection-stroke: #64748b` is IDENTICAL to the light fallback `#64748b`
 * (FlowCanvas.rozie:1843, 3887), so it discriminates nothing and would silently pass on a
 * completely broken dark block.
 *
 * Ungated and behavioral-only — it needs no PNG and runs green from day one. The pixel
 * guard is the separate baseline-gated `FlowCanvasDarkScreenshot` cell in
 * `rete-flow-dark.spec.ts`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-dark-tokens [${target}]: prefers-color-scheme dark repaints the canvas, nodes and the imperative minimap SVG — and reverts`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasMinimap&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(4);
    const minimap = page.getByTestId('flow-minimap');
    await expect(minimap).toBeVisible({ timeout: 10_000 });

    // the shipped rete-flow-background getComputedStyle idiom, piercing Lit's shadow root.
    const cssVar = (name: string) =>
      canvas.evaluate(
        (el, n) => getComputedStyle(el).getPropertyValue(n).trim(),
        name,
      );
    const bgColor = () =>
      canvas.evaluate((el) => getComputedStyle(el).backgroundColor);
    const nodeBg = () =>
      page
        .locator('.rozie-flow-node')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    /**
     * Resolve any CSS colour string to a CANONICAL `r,g,b,a` tuple through the browser's
     * own colour parser (alpha rounded to 2dp — the quantization floor of 8-bit hex alpha).
     *
     * WHY NOT A RAW STRING COMPARE: `flowToken()` copies the token's TEXT verbatim into the
     * SVG attribute, and the VR host's per-target builds serialize that text differently —
     * the vue / react / svelte sub-builds emit a MINIFIED `.css` asset in which
     * `rgba(0, 0, 0, 0.35)` has been rewritten to the equivalent `#00000059`, while
     * angular / solid / lit carry the CSS unminified. Same colour, different bytes. This
     * normalisation is NOT a loosening: r/g/b are still compared exactly and the two
     * candidate colours here (dark `rgba(0,0,0,0.35)` vs the light fallback
     * `rgba(15,23,42,0.18)`) are nowhere near each other, so a genuinely wrong colour —
     * including a light-mode value surviving the flip — still fails.
     */
    const canonColor = async (raw: string | null): Promise<string> =>
      page.evaluate((v) => {
        const el = document.createElement('span');
        el.style.color = v ?? '';
        document.body.appendChild(el);
        const c = getComputedStyle(el).color;
        el.remove();
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return `UNPARSEABLE:${c}`;
        const p = m[1].split(',').map((s) => Number(s.trim()));
        const a = p.length > 3 ? p[3] : 1;
        return `${p[0]},${p[1]},${p[2]},${Math.round(a * 100) / 100}`;
      }, raw);

    const maskFill = async () =>
      canonColor(
        await page.locator('.rozie-flow-minimap__mask').first().getAttribute('fill'),
      );
    const viewportStroke = async () =>
      canonColor(
        await page
          .locator('.rozie-flow-minimap__viewport')
          .first()
          .getAttribute('stroke'),
      );

    // The minimap redraw is rAF-coalesced and only scheduled off translate / zoom /
    // node-move — a media flip alone never repaints it. Force one with the shipped
    // minimap pointer-drag (pointerdown already calls setCenter → translate).
    const forceMinimapRedraw = async () => {
      const mm = await minimap.boundingBox();
      if (!mm) throw new Error('minimap bounding box unavailable');
      await page.mouse.move(mm.x + mm.width / 2, mm.y + mm.height / 2);
      await page.mouse.down();
      await page.mouse.move(mm.x + 12, mm.y + 12, { steps: 6 });
      await page.mouse.up();
    };

    // ---- 1. LIGHT baseline: the tokens are UNDEFINED; the fallbacks render ----
    expect(
      await cssVar('--rozie-flow-bg'),
      'in a light context the component defines NO --rozie-flow-* tokens (themes/*.css is an opt-in import the VR demos never make) — the var() fallbacks do the work',
    ).toBe('');
    expect(await bgColor()).toBe('rgb(247, 248, 250)');
    expect(await nodeBg()).toBe('rgb(255, 255, 255)');

    // ---- 2. FLIP to dark ----
    await page.emulateMedia({ colorScheme: 'dark' });

    // ---- 3. DARK, DECLARATIVE: tokens defined AND rendered colours changed ----
    await expect
      .poll(() => cssVar('--rozie-flow-bg'), {
        timeout: 10_000,
        intervals: [100, 300, 600, 1000],
      })
      .toBe('#0f172a');
    expect(await cssVar('--rozie-flow-node-bg')).toBe('#1e293b');
    expect(await cssVar('--rozie-flow-accent')).toBe('#60a5fa');
    // rendered, not merely declared — a declared-but-unapplied token passes a
    // property-only check.
    await expect.poll(bgColor, { timeout: 10_000 }).toBe('rgb(15, 23, 42)');
    await expect.poll(nodeBg, { timeout: 10_000 }).toBe('rgb(30, 41, 59)');

    // ---- 4. DARK, IMPERATIVE: the flowToken() path in the minimap SVG ----
    await forceMinimapRedraw();
    await expect
      .poll(maskFill, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('0,0,0,0.35');
    await expect
      .poll(viewportStroke, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('96,165,250,1');

    // ---- 5. BACK TO LIGHT: everything reverts (the media query did it, not a hardcode) ----
    await page.emulateMedia({ colorScheme: 'light' });
    await expect
      .poll(() => cssVar('--rozie-flow-bg'), {
        timeout: 10_000,
        intervals: [100, 300, 600, 1000],
      })
      .toBe('');
    await expect.poll(bgColor, { timeout: 10_000 }).toBe('rgb(247, 248, 250)');
    await expect.poll(nodeBg, { timeout: 10_000 }).toBe('rgb(255, 255, 255)');

    await forceMinimapRedraw();
    await expect
      .poll(maskFill, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('15,23,42,0.18');
    await expect
      .poll(viewportStroke, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('59,130,246,1');
  });
}

/**
 * 32. SCALE — a 48-node / 86-edge real-world ETL pipeline (quick-260803-uwb).
 *
 * Every other rete-flow cell drives 1–5 nodes. This one drives the size of graph a real
 * workflow-builder consumer hits: eight layers of source → transform/join → sink with
 * genuine fan-in (1–3 in-edges per node), fan-out and long chains, plus mixed edge types,
 * labels, strokes and dashed edges. `examples/demos/FlowCanvasLargeDemo.rozie` builds it in
 * `$onMount` as a PURE function of the loop indices — no `Math.random`, no `Date.now` — so
 * all six targets seed a byte-identical graph and this cell can pin '48' and '86' as exact
 * literals rather than lower bounds.
 *
 *   1. SCALE RENDERS — the bound counts read '48'/'86', 48 node boxes mount, and 86 paths
 *      are actually DRAWN (non-empty `d`, the house filter). A drawn count under 86 with 48
 *      nodes green is the single-input EVICTION signature: check that every `<Port input>`
 *      in the demo still carries `multiple` before suspecting the component.
 *   2. MINIMAP AT SCALE — 48 imperative SVG node rects + the viewport window.
 *   3. PRE-ARRANGE TANGLE — the geometry pass reports overlapping node rects (the seed
 *      stacks layers 30px apart on ~140px-wide nodes). The "before" half of the proof,
 *      mirroring the shipped 2-node arrange cell's START-OVERLAPPING discipline.
 *   4. AUTO-ARRANGE — `autoArrange()` drives overlaps to ZERO across all 48, the bounding
 *      box grows on both axes, the result is STABLE on re-sample (no write-back
 *      oscillation), and the TOPOLOGY is untouched (still 48/86 — a layout must never
 *      mutate the graph).
 *   5. ZOOM-TO-FIT — the bound zoom drops below 1 (the verb echoes `$model.zoom`) and every
 *      one of the 48 node centres lands inside the canvas viewport. This is the assertion
 *      the scale ask is really about: the whole graph is on screen.
 *   6. DRAG WRITE-BACK IN A DENSE GRAPH — run AFTER the fit so the target is on-screen;
 *      `dragNodeBy` re-reads the live box, so the post-fit scale is handled. The bound
 *      `drag-node-x` moves and then settles.
 *   7. UNDO RESTORES — one undo returns `drag-node-x` to EXACTLY its pre-drag value.
 *   8/9. SELECT-ALL + DUPLICATE-ALL AT SCALE — Ctrl/Cmd+A selects 48, Ctrl/Cmd+D clones the
 *      lot to 96, and ONE undo restores 48. That is the "one gesture = one undo step"
 *      contract (D-03) stressed at 48× rather than the 3 nodes the keyboard cell uses.
 *
 * `test.setTimeout` is raised because this is a SCALE cell: unlike the combobox-virtual
 * perf-budget cell — whose wall-clock budget IS the assertion, so raising it would mask the
 * defect — nothing here is guarded by elapsed time. The budget only has to be generous
 * enough that elk (which runs through a web-worker) and 96 node mounts can finish.
 *
 * Behavioral-only. There is deliberately NO pixel cell for the arranged graph: autoArrange
 * feeds elk the MEASURED node-view dimensions (FlowCanvas.rozie:3415-3445), so the layout
 * depends on per-platform font metrics, and the shipped arrange cell already refuses
 * exact-px assertions for that reason (rete-flow.spec.ts:1606).
 */

/**
 * This cell was `fixme`'d on react (quick-260803-uwb) for an EMITTER defect, never a
 * component-source one: `.rozie-flow-minimap__node` stayed at 0 forever while the other
 * five targets reported 48.
 *
 * FIXED in 9acd7737 (quick-260803-w7b, the third react staleness seam). A top-level helper
 * that reads reactive scope lowers to `useCallback(fn, [deps])`, whose identity React
 * refreshes every render — but `redrawMinimap` is declared inside the `[]`-dep mount effect,
 * so it captured render #1's `currentGraph` and observed the MOUNT-TIME graph forever. The
 * emitter now routes mount-scoped helper calls through a synced ref
 * (`_currentGraphRef.current()`), so the closure invokes the current instance.
 *
 * Why THIS demo exposed it and `rete-flow-minimap` did not: FlowCanvasLarge seeds its graph
 * in `$onMount`, so the mount-time capture is EMPTY; the shipped `FlowCanvasMinimap` demo
 * seeds in `<data>`, so its mount-time capture already holds the right nodes and the seam
 * was invisible there.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-large [${target}]: a 48-node / 86-edge pipeline renders, auto-arranges without overlaps, fits on screen, and survives drag/undo + select-all/duplicate at scale`, async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await page.goto(`/?example=FlowCanvasLarge&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    const nodeCount = page.getByTestId('node-count');
    const connCount = page.getByTestId('conn-count');
    const selectedCount = page.getByTestId('selected-count');
    const zoomReadout = page.getByTestId('zoom-readout');
    const bboxW = page.getByTestId('bbox-w');
    const bboxH = page.getByTestId('bbox-h');
    const dragNodeXReadout = page.getByTestId('drag-node-x');
    const readNum = async (loc: typeof bboxW): Promise<number> =>
      Number((await loc.textContent())?.trim() ?? 'NaN');

    /**
     * ONE geometry pass over the rendered node rects.
     *
     * NOT migrated to `_shadow-utils.ts` — same rationale as the two shipped twins in this
     * file: the `deepQueryAll` walk is entangled with further geometry math in this same
     * evaluate call, and `_shadow-utils.ts` exposes no geometry helper (verified).
     *
     * → { count, overlaps, unionW, unionH, insideCanvas }
     *   overlaps      = pairs of node rects intersecting by > 4px on BOTH axes (a 4px
     *                   slack absorbs sub-pixel layout rounding; a real stack overlaps by
     *                   tens of px).
     *   insideCanvas  = how many node-rect CENTRES fall inside the canvas rect (±2px).
     */
    const geometry = async () =>
      page.evaluate(() => {
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
        const rects = deepQueryAll('.rozie-flow-node').map((e) =>
          (e as HTMLElement).getBoundingClientRect(),
        );
        let overlaps = 0;
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i];
            const b = rects[j];
            const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (dx > 4 && dy > 4) overlaps++;
          }
        }
        const lefts = rects.map((r) => r.left);
        const rights = rects.map((r) => r.right);
        const tops = rects.map((r) => r.top);
        const bottoms = rects.map((r) => r.bottom);
        const unionW = rects.length ? Math.max(...rights) - Math.min(...lefts) : 0;
        const unionH = rects.length ? Math.max(...bottoms) - Math.min(...tops) : 0;

        const canvasEl = deepQueryAll('.rozie-flow-canvas')[0] as HTMLElement | undefined;
        const cr = canvasEl ? canvasEl.getBoundingClientRect() : null;
        let insideCanvas = 0;
        if (cr) {
          for (const r of rects) {
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (
              cx >= cr.left - 2 &&
              cx <= cr.right + 2 &&
              cy >= cr.top - 2 &&
              cy <= cr.bottom + 2
            ) {
              insideCanvas++;
            }
          }
        }
        return { count: rects.length, overlaps, unionW, unionH, insideCanvas };
      });

    // counts DRAWN paths (non-empty `d`) — the house filter, piercing Lit's shadow root.
    const drawnCount = async () =>
      page
        .locator('.rozie-flow-connection__path')
        .evaluateAll(
          (els) =>
            els.filter((e) => (e.getAttribute('d') || '').trim().length > 0).length,
        );

    // ---- 1. SCALE RENDERS: exact bound counts, 48 boxes, 86 DRAWN paths ----
    await expect(nodeCount).toHaveText('48', { timeout: 30_000 });
    await expect(connCount).toHaveText('86', { timeout: 30_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 60_000,
        intervals: [500, 1000, 2000, 4000],
      })
      .toBe(48);
    await expect
      .poll(drawnCount, { timeout: 60_000, intervals: [500, 1000, 2000, 4000] })
      .toBe(86);

    // ---- 2. MINIMAP REFLECTS THE SCALE ----
    await expect
      .poll(async () => page.locator('.rozie-flow-minimap__node').count(), {
        timeout: 30_000,
        intervals: [300, 600, 1000, 2000],
      })
      .toBe(48);
    await expect(page.locator('.rozie-flow-minimap__viewport')).toHaveCount(1, {
      timeout: 10_000,
    });

    // ---- 3. PRE-ARRANGE TANGLE (the "before" half of the arrange proof) ----
    const before = await geometry();
    expect(before.count).toBe(48);
    expect(
      before.overlaps,
      'the seeded layout must START tangled (layers 30px apart on ~140px-wide nodes) — otherwise the arrange assertion proves nothing',
    ).toBeGreaterThan(0);
    const bboxW0 = await readNum(bboxW);
    const bboxH0 = await readNum(bboxH);

    // ---- 4. AUTO-ARRANGE: overlaps → 0, bbox grows, stable, topology untouched ----
    await page.getByTestId('arrange-btn').click();
    await expect
      .poll(async () => (await geometry()).overlaps, {
        timeout: 60_000,
        intervals: [500, 1000, 2000, 4000],
      })
      .toBe(0);

    await page.waitForTimeout(400);
    const bboxW1 = await readNum(bboxW);
    const bboxH1 = await readNum(bboxH);
    expect(bboxW1, 'the layered layout spreads the graph horizontally').toBeGreaterThan(bboxW0);
    expect(bboxH1, 'the layered layout spreads the graph vertically').toBeGreaterThan(bboxH0);
    // STABLE on re-sample — no write-back → reconcile → write oscillation at scale.
    await page.waitForTimeout(400);
    expect(await readNum(bboxW), 'bbox-w is stable after arrange').toBe(bboxW1);
    expect(await readNum(bboxH), 'bbox-h is stable after arrange').toBe(bboxH1);
    // a LAYOUT must never mutate the topology.
    await expect(nodeCount).toHaveText('48');
    await expect(connCount).toHaveText('86');

    // ---- 5. ZOOM-TO-FIT: the whole graph lands on screen ----
    await page.getByTestId('fit-btn').click();
    await expect
      .poll(async () => Number((await zoomReadout.textContent())?.trim() ?? 'NaN'), {
        timeout: 30_000,
        intervals: [300, 600, 1000, 2000],
      })
      .toBeLessThan(1);
    await expect
      .poll(async () => (await geometry()).insideCanvas, {
        timeout: 30_000,
        intervals: [300, 600, 1000, 2000],
      })
      .toBe(48);

    // ---- 6. DRAG WRITE-BACK IN A DENSE GRAPH (post-fit, so the target is on-screen) ----
    const x0 = await readNum(dragNodeXReadout);
    expect(x0, 'the L3N4 readout resolves a real node').toBeGreaterThan(-1);
    // dragNodeBy re-reads the LIVE bounding box, so the post-fit scale is handled.
    await dragNodeBy(page, 'L3N4', 60);
    await expect
      .poll(async () => readNum(dragNodeXReadout), {
        timeout: 30_000,
        intervals: [100, 300, 600, 1000],
      })
      .not.toBe(x0);
    await page.waitForTimeout(400);
    const xDragged = await readNum(dragNodeXReadout);
    await page.waitForTimeout(400);
    expect(await readNum(dragNodeXReadout), 'drag-node-x is stable after the drag settles').toBe(
      xDragged,
    );

    // ---- 7. UNDO RESTORES the dragged node EXACTLY ----
    await page.getByTestId('undo-btn').click();
    await expect
      .poll(async () => readNum(dragNodeXReadout), {
        timeout: 30_000,
        intervals: [100, 300, 600, 1000],
      })
      .toBe(x0);
    await page.waitForTimeout(400);
    expect(await readNum(dragNodeXReadout), 'the undone position HOLDS').toBe(x0);

    // ---- 8. SELECT-ALL + DUPLICATE-ALL AT 48 NODES ----
    await canvas.focus();
    await page.keyboard.press(`${MOD}+a`);
    await expect(selectedCount).toHaveText('48', { timeout: 30_000 });

    await canvas.focus();
    await page.keyboard.press(`${MOD}+d`);
    await expect
      .poll(async () => (await nodeCount.textContent())?.trim(), {
        timeout: 60_000,
        intervals: [500, 1000, 2000, 4000],
      })
      .toBe('96');
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 60_000,
        intervals: [500, 1000, 2000, 4000],
      })
      .toBe(96);

    // ---- 9. ONE UNDO RESTORES THE WHOLE 48-NODE DUPLICATION (D-03 at scale) ----
    await page.getByTestId('undo-btn').click();
    await expect
      .poll(async () => (await nodeCount.textContent())?.trim(), {
        timeout: 60_000,
        intervals: [500, 1000, 2000, 4000],
      })
      .toBe('48');
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 60_000,
        intervals: [500, 1000, 2000, 4000],
      })
      .toBe(48);
    await page.waitForTimeout(500);
    await expect(nodeCount).toHaveText('48');
  });
}

/**
 * OS-DARK LIGHT-OPT-OUT GUARD (ISSUE-3 / D-01, Phase 83 Plan 01) — the zero-import
 * OS-dark default must honor an app's explicit `.light` / `[data-theme="light"]` root
 * opt-out.
 *
 * `base.css`'s own documented promise (see its header comment above the OS-dark block
 * it declares) is two-fold: dark mode works with NO import at all (pure OS
 * `prefers-color-scheme`), AND an app that opts into light at the document root keeps
 * control even while the OS requests dark. Before this phase the SFC's zero-import
 * OS-dark block carried NO opt-out guard at all, so the second half of that promise
 * was false for every zero-import consumer of this component — and silently so, since
 * the naive guard shape compiles to dead code with zero compiler diagnostics
 * (`scopeCss()` scopes past a leading `:root` pseudo). This cell is RED-BY-CONSTRUCTION
 * on react/vue/svelte/angular/solid until Task 2 lands the corrected `:root { @media
 * {...} } }` escape-hatch shape.
 *
 * The Lit branch below is NOT an oversight — it records a deliberate, documented gap
 * (D-01): Lit's dark palette lives inside a shadow root where an ancestor selector like
 * `:root:not(.light)` can never be observed from outside, so Lit stays unguarded (still
 * dark, opt-out or not). That is the accepted contract, asserted here so it stays a
 * recorded fact rather than an accident.
 *
 * No `toHaveScreenshot` anywhere in this block — per this file's header, structural /
 * behavioral assertions only; a transient DOM-classlist-driven theming check must never
 * touch a pixel baseline.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-osdark-guard [${target}]: the zero-import OS-dark default honors the light opt-out`, async ({
    page,
  }) => {
    // Dark tokens resolve at style time and the imperative minimap reads them at draw
    // time — emulate BEFORE goto or the first paint is left light. Same ordering
    // `rete-flow-dark.spec.ts` documents and relies on.
    await page.emulateMedia({ colorScheme: 'dark' });
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

    // The CSS locator pierces Lit's open shadow root, exactly as the neighbouring cells
    // in this file rely on.
    const canvasBg = () =>
      page
        .locator('.rozie-flow-canvas')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);

    // ---- Assertion A (green today, permanent regression guard): no opt-out present —
    // dark on all six targets ----
    await expect
      .poll(canvasBg, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('rgb(15, 23, 42)');

    // ---- Assertion B (RED today on react/vue/svelte/angular/solid): `.light` class
    // opt-out ----
    await page.evaluate(() => document.documentElement.classList.add('light'));
    if (target === 'lit') {
      // D-01's documented, accepted gap: Lit's OS-dark copy lives inside a shadow root
      // where the ancestor guard selector can never match, so Lit stays dark regardless
      // of the opt-out.
      await expect
        .poll(canvasBg, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
        .toBe('rgb(15, 23, 42)');
    } else {
      await expect
        .poll(canvasBg, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
        .toBe('rgb(247, 248, 250)');
    }
    await page.evaluate(() => document.documentElement.classList.remove('light'));
    // the opt-out is not sticky — removing it returns the canvas to dark.
    await expect
      .poll(canvasBg, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe('rgb(15, 23, 42)');

    // ---- Assertion C (RED today on the same five): `[data-theme="light"]` attribute
    // opt-out — base.css's guard covers both forms and the SFC copy must too ----
    await page.evaluate(() =>
      document.documentElement.setAttribute('data-theme', 'light'),
    );
    if (target === 'lit') {
      await expect
        .poll(canvasBg, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
        .toBe('rgb(15, 23, 42)');
    } else {
      await expect
        .poll(canvasBg, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
        .toBe('rgb(247, 248, 250)');
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  });
}

/**
 * 33. INCOMPATIBLE-SOCKET DRAG FEEDBACK — mid-gesture ONLY (Phase 83 D-26, closes ISSUE-6).
 *
 * THE FAILURE MODE THIS GUARDS: before this phase, a rejected connection gave NO feedback
 * at the target port — the user dragged a typed output over a type-mismatched input,
 * released, and the edge simply failed to appear with no visual explanation. Plan 05 wired
 * `socketReg` (a `nodeId::side::key → element` registry populated for free from the
 * existing socket render emit) plus `markIncompatibleSockets`/`clearIncompatibleSockets`
 * (FlowCanvas.rozie:2153-2186) to dim type-mismatched, opposite-side sockets on OTHER nodes
 * while a typed connection is being dragged, via the `.rozie-flow-socket--incompatible`
 * class (opacity + `cursor: not-allowed`, driven by
 * `--rozie-flow-socket-incompatible-opacity`).
 *
 * THIS IS DELIBERATELY A BEHAVIORAL DOM CHECK, NOT A SCREENSHOT. The marking exists ONLY
 * while the pointer is down — it is transient DOM state that no pixel baseline could ever
 * capture deterministically. Baking a mid-drag frame into a `toHaveScreenshot` baseline
 * would be gesture-timing-dependent by construction, and per `feedback_vr_linux_baselines`
 * every baseline PNG must be Linux-Docker-rendered, which makes a flaky baseline expensive
 * to churn. `rete-flow.spec.ts` is explicitly a structural/behavioral spec with ZERO
 * `toHaveScreenshot` calls (see the file header) — this cell holds that discipline.
 *
 * THE NEGATIVE ASSERTIONS ARE THE POINT (D-12/D-13's scoping). A predicate that marked
 * every socket would satisfy a presence-only check. `examples/demos/FlowCanvasValidateOffDemo.rozie`
 * gives a genuine type-mismatched pair (`Number Source` output `number` → `Merge` input
 * `string`) AND a compatible control pair (`Merge` input `number`) in one graph, from a
 * single pick:
 *
 *   | Socket                        | Expected    | Why                                    |
 *   |--------------------------------|-------------|-----------------------------------------|
 *   | `Merge` input `string`         | MARKED      | opposite side, other node, type mismatch |
 *   | `Merge` input `number`         | NOT marked  | opposite side, other node, types agree   |
 *   | `Number Source` output `string`| NOT marked  | same node AND same side                  |
 *   | `Number Source` output `number`| NOT marked  | the picked socket itself                 |
 *
 * Sockets carry `data-testid="socket"` (FlowCanvas.rozie:1752), but this file's own
 * convention selects by node label text + `.rozie-flow-port--{side}` + `.rozie-flow-socket`
 * (the `typedSocketOf` idiom from cell 30) — preferred here over introducing a second
 * selector style, since two typed ports per side make a bare `data-testid="socket"` lookup
 * ambiguous.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-incompatible-socket [${target}]: a connection drag dims type-mismatched target ports and clears on drop`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasValidateOff&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(2);

    // the same typed socket-row locator the validate-off cell (30) uses — both nodes carry
    // two ports on the relevant side, so `.first()` alone would be ambiguous.
    const typedSocketOf = (node: string, side: 'output' | 'input', portLabel: string) =>
      page
        .locator('.rozie-flow-node', { hasText: node })
        .locator(`.rozie-flow-port--${side}`, { hasText: portLabel })
        .locator('.rozie-flow-socket')
        .first();

    const center = async (locator: ReturnType<typeof typedSocketOf>) => {
      await expect(locator).toBeVisible({ timeout: 10_000 });
      const box = await locator.boundingBox();
      if (!box) throw new Error('socket bounding box unavailable');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    // precondition: validation is ON, so the mismatched pair really is incompatible.
    await expect(page.getByTestId('validate-state')).toHaveText('true');

    const pickedOut = await center(typedSocketOf('Number Source', 'output', 'number'));
    const mismatchedIn = await center(typedSocketOf('Merge', 'input', 'string'));

    const mergeStr = typedSocketOf('Merge', 'input', 'string');
    const mergeNum = typedSocketOf('Merge', 'input', 'number');
    const srcStr = typedSocketOf('Number Source', 'output', 'string');
    const srcNum = typedSocketOf('Number Source', 'output', 'number');
    const INCOMPATIBLE = /rozie-flow-socket--incompatible/;

    // ---- start the gesture and PAUSE mid-drag (pointer still down) ----
    await page.mouse.move(pickedOut.x, pickedOut.y);
    await page.mouse.down();
    await page.mouse.move(
      (pickedOut.x + mismatchedIn.x) / 2,
      (pickedOut.y + mismatchedIn.y) / 2,
      { steps: 8 },
    );

    // ---- MID-GESTURE: the type-mismatched opposite-side socket on the OTHER node IS
    // marked ----
    await expect(mergeStr).toHaveClass(INCOMPATIBLE, { timeout: 5_000 });
    // D-12: type-agreeing opposite-side socket on the other node is NOT marked.
    // WR-01: `toHaveCount(1)` FIRST — Playwright's negated `.not.toHaveClass()` is
    // trivially satisfied by a locator that resolves to ZERO elements, so without
    // this the negative below would pass just as happily if the socket vanished.
    await expect(mergeNum).toHaveCount(1);
    await expect(mergeNum).not.toHaveClass(INCOMPATIBLE);
    // D-12: same node AND same side is NOT marked.
    await expect(srcStr).toHaveCount(1);
    await expect(srcStr).not.toHaveClass(INCOMPATIBLE);
    // D-12: the picked socket itself is NOT marked.
    await expect(srcNum).toHaveCount(1);
    await expect(srcNum).not.toHaveClass(INCOMPATIBLE);

    // ---- complete the gesture over the mismatched target → drop (refused by validation) ----
    await page.mouse.move(mismatchedIn.x, mismatchedIn.y, { steps: 8 });
    await page.mouse.up();

    // ---- POST-DROP: marking clears completely — check ALL FOUR sockets so a partial
    // clear cannot slip through. WR-01: existence-check every locator first, same
    // reasoning as the mid-gesture block above. ----
    await expect(mergeStr).toHaveCount(1);
    await expect(mergeStr).not.toHaveClass(INCOMPATIBLE, { timeout: 5_000 });
    await expect(mergeNum).toHaveCount(1);
    await expect(mergeNum).not.toHaveClass(INCOMPATIBLE);
    await expect(srcStr).toHaveCount(1);
    await expect(srcStr).not.toHaveClass(INCOMPATIBLE);
    await expect(srcNum).toHaveCount(1);
    await expect(srcNum).not.toHaveClass(INCOMPATIBLE);

    // ---- settle-and-resample (the file's own idiom, cell 1's echo-safety check): a late
    // re-mark cannot slip through after the gesture has fully settled ----
    await page.waitForTimeout(500);
    await expect(mergeStr).not.toHaveClass(INCOMPATIBLE);
  });
}

/**
 * 34. INCOMPATIBLE-SOCKET ABORT PATHS — Escape and pointercancel clear a stuck mid-drag
 * dimming (Phase 83 D-26, closes the D-14 gate).
 *
 * D-14's whole point is that no abort path leaves sockets permanently dimmed — a stuck
 * dimmed socket is a visible, user-facing failure that outlives the gesture. Plan 05
 * attached three window-level listeners (FlowCanvas.rozie:1618-1632) that all route through
 * the same `clearIncompatibleSockets` helper: `pointercancel`, `keydown` (Escape only), and
 * `blur`. This cell gates the first two permanently.
 *
 * WINDOW-BLUR IS DELIBERATELY NOT AUTOMATED HERE. Blur cannot be driven deterministically
 * from Playwright without a second page or a real OS focus change, and a flaky abort cell
 * in the shared VR suite is worse than none — it costs every future run. Plan 05 observed
 * blur clearing the marking by hand, on all six targets (83-05-SUMMARY.md, Task 3
 * observations table). This is a stated, recorded choice, not a silent gap.
 *
 * Escape is deliberately pressed WITHOUT first focusing the canvas container: the whole
 * reason D-14 put Escape on a `window` listener rather than extending the existing
 * `onCanvasKeydown` container listener is that focus during a pointer drag is not
 * guaranteed to be on the canvas (rete's own `usePointerListener` drives the gesture from
 * `window` itself, not from any focused element).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-incompatible-socket-abort [${target}]: Escape and pointercancel clear the mid-drag dimming`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasValidateOff&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(2);

    const typedSocketOf = (node: string, side: 'output' | 'input', portLabel: string) =>
      page
        .locator('.rozie-flow-node', { hasText: node })
        .locator(`.rozie-flow-port--${side}`, { hasText: portLabel })
        .locator('.rozie-flow-socket')
        .first();

    const center = async (locator: ReturnType<typeof typedSocketOf>) => {
      await expect(locator).toBeVisible({ timeout: 10_000 });
      const box = await locator.boundingBox();
      if (!box) throw new Error('socket bounding box unavailable');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    await expect(page.getByTestId('validate-state')).toHaveText('true');

    const pickedOut = await center(typedSocketOf('Number Source', 'output', 'number'));
    const mismatchedIn = await center(typedSocketOf('Merge', 'input', 'string'));
    const mergeStr = typedSocketOf('Merge', 'input', 'string');
    const INCOMPATIBLE = /rozie-flow-socket--incompatible/;

    const startPausedGesture = async () => {
      await page.mouse.move(pickedOut.x, pickedOut.y);
      await page.mouse.down();
      await page.mouse.move(
        (pickedOut.x + mismatchedIn.x) / 2,
        (pickedOut.y + mismatchedIn.y) / 2,
        { steps: 8 },
      );
      await expect(mergeStr).toHaveClass(INCOMPATIBLE, { timeout: 5_000 });
    };

    // ---- Escape clears the marking while the pointer is STILL down ----
    await startPausedGesture();
    await page.keyboard.press('Escape');
    await expect(mergeStr).not.toHaveClass(INCOMPATIBLE, { timeout: 5_000 });
    // leave the page in a clean state for the next abort.
    await page.mouse.up();

    // ---- a dispatched `pointercancel` clears the marking while the pointer is STILL
    // down — a fresh gesture, so results don't bleed into each other ----
    await startPausedGesture();
    await page.evaluate(() => {
      let evt: Event;
      try {
        evt = new PointerEvent('pointercancel', { bubbles: true, cancelable: true });
      } catch {
        evt = new Event('pointercancel', { bubbles: true, cancelable: true });
      }
      document.dispatchEvent(evt);
    });
    await expect(mergeStr).not.toHaveClass(INCOMPATIBLE, { timeout: 5_000 });
    await page.mouse.up();
  });
}

/**
 * 35. INCOMPATIBLE-SOCKET VALIDATION-OFF GUARD — nothing is ever dimmed when
 * `:validate-types` is false (Phase 83 D-26, guards the D-13/D-12 `validateTypes` boundary
 * Plan 05 recorded).
 *
 * `markIncompatibleSockets` returns immediately when `$props.validateTypes === false`
 * (FlowCanvas.rozie:2162-2186): an automatic-off canvas allows a type-mismatched drop, so
 * dimming a socket it will happily accept would misrepresent what the canvas is about to
 * do. This cell proves the affordance and the actual behavior agree — not just that nothing
 * is dimmed, but that the identical drag which WOULD have been refused with validation on
 * genuinely commits a connection with it off.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-incompatible-socket-validate-off [${target}]: nothing is dimmed when :validate-types is false`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasValidateOff&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(2);

    const typedSocketOf = (node: string, side: 'output' | 'input', portLabel: string) =>
      page
        .locator('.rozie-flow-node', { hasText: node })
        .locator(`.rozie-flow-port--${side}`, { hasText: portLabel })
        .locator('.rozie-flow-socket')
        .first();

    const center = async (locator: ReturnType<typeof typedSocketOf>) => {
      await expect(locator).toBeVisible({ timeout: 10_000 });
      const box = await locator.boundingBox();
      if (!box) throw new Error('socket bounding box unavailable');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    // counts DRAWN paths (non-empty `d`), the same helper cell 30 uses.
    const drawnCount = async () =>
      page
        .locator('.rozie-flow-connection__path')
        .evaluateAll(
          (els) =>
            els.filter((e) => (e.getAttribute('d') || '').trim().length > 0).length,
        );

    await expect(page.getByTestId('validate-state')).toHaveText('true');

    // ---- turn validation off ----
    await page.getByTestId('validate-btn').click();
    await expect(page.getByTestId('validate-state')).toHaveText('false', { timeout: 5_000 });

    const pickedOut = await center(typedSocketOf('Number Source', 'output', 'number'));
    const mismatchedIn = await center(typedSocketOf('Merge', 'input', 'string'));
    const mergeStr = typedSocketOf('Merge', 'input', 'string');
    const mergeNum = typedSocketOf('Merge', 'input', 'number');
    const srcStr = typedSocketOf('Number Source', 'output', 'string');
    const srcNum = typedSocketOf('Number Source', 'output', 'number');
    const INCOMPATIBLE = /rozie-flow-socket--incompatible/;

    // ---- start the SAME drag, pause mid-gesture — with validation off, NONE of the four
    // sockets is marked, including the type-mismatched target that WOULD be marked with
    // validation on ----
    await page.mouse.move(pickedOut.x, pickedOut.y);
    await page.mouse.down();
    await page.mouse.move(
      (pickedOut.x + mismatchedIn.x) / 2,
      (pickedOut.y + mismatchedIn.y) / 2,
      { steps: 8 },
    );
    await page.waitForTimeout(200);
    // WR-01: existence-check every locator before its negative assertion — see the
    // matching comment in the rete-flow-incompatible-socket cell above.
    await expect(mergeStr).toHaveCount(1);
    await expect(mergeStr).not.toHaveClass(INCOMPATIBLE);
    await expect(mergeNum).toHaveCount(1);
    await expect(mergeNum).not.toHaveClass(INCOMPATIBLE);
    await expect(srcStr).toHaveCount(1);
    await expect(srcStr).not.toHaveClass(INCOMPATIBLE);
    await expect(srcNum).toHaveCount(1);
    await expect(srcNum).not.toHaveClass(INCOMPATIBLE);

    // ---- complete the gesture: with validation off, the drop is genuinely ALLOWED — the
    // affordance and the behavior must agree, so prove a connection was actually created ----
    await page.mouse.move(mismatchedIn.x, mismatchedIn.y, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(drawnCount, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(1);
  });
}

/**
 * 36. WR-03 RUNTIME REPRODUCTION — a mid-drag `portsAdded` reconcile keeps an
 * already-dimmed incompatible socket dimmed (closes 83-VERIFICATION.md's last
 * `human_verification` item for RETE-09).
 *
 * THE FAILURE MODE THIS GUARDS: before commit `df9505e4a`, `reconcileNodesPass`'s
 * `portsAdded` branch (FlowCanvas.rozie:2503-2552) disposed and rebuilt a node's
 * socket DOM whenever that node's TYPE gained a new port — including mid-drag, if the
 * port-add landed while a connection pick was active. The rebuild produced fresh
 * socket elements carrying no memory of `rozie-flow-socket--incompatible`, so a
 * socket the drag had legitimately dimmed silently un-dimmed the moment an unrelated
 * reactive port mutation touched its node — misrepresenting an active drag as valid
 * mid-gesture. The fix tracks the active pick in a component-scope `activePick`
 * record and re-invokes `markIncompatibleSockets` synchronously, in the SAME
 * reconcile pass, right after the socket rebuild. This cell is the first executable
 * reproduction of that exact interleaving: an active drag CONCURRENT with a
 * `portsAdded` reconcile landing on the very node the drag has marked.
 *
 * THE TRIGGER: `examples/demos/FlowCanvasPortAddDemo.rozie` registers a window-level
 * 'p' keydown listener in $onMount that flips local `$data.portAdded`, which
 * conditionally mounts a THIRD `<Port>` on the `merge` NodeType — registering a new
 * port into the type's schema and firing FlowCanvas's own `$watch(() =>
 * $data.portReg, ...)` reconcile. `page.keyboard.press('p')` fires this without
 * releasing `page.mouse.down()`, which a button click could never do (see the demo's
 * own header for the full reasoning).
 *
 * THIS IS DELIBERATELY A BEHAVIORAL DOM CHECK, NOT A SCREENSHOT — the marking is
 * transient mid-drag state, same reasoning as `rete-flow-incompatible-socket`'s own
 * header (a mid-drag frame is gesture-timing-dependent by construction, and per
 * `feedback_vr_linux_baselines` every baseline PNG must be Linux-Docker-rendered,
 * which makes a flaky baseline expensive to churn). `rete-flow.spec.ts` stays
 * entirely `toHaveScreenshot`-free.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-port-add [${target}]: a mid-drag portsAdded reconcile keeps an already-marked socket dimmed`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasPortAdd&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(2);

    // the same typed socket-row locator the validate-off cell (30) and the
    // incompatible-socket cells (33/34) use.
    const typedSocketOf = (node: string, side: 'output' | 'input', portLabel: string) =>
      page
        .locator('.rozie-flow-node', { hasText: node })
        .locator(`.rozie-flow-port--${side}`, { hasText: portLabel })
        .locator('.rozie-flow-socket')
        .first();

    const center = async (locator: ReturnType<typeof typedSocketOf>) => {
      await expect(locator).toBeVisible({ timeout: 10_000 });
      const box = await locator.boundingBox();
      if (!box) throw new Error('socket bounding box unavailable');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    // precondition: the port-add hasn't fired yet.
    await expect(page.getByTestId('port-added-state')).toHaveCount(1);
    await expect(page.getByTestId('port-added-state')).toHaveText('false');
    // WR-01: existence-check before the negative — the reactive third port must not
    // exist yet, and a vanished-locator false-pass would be indistinguishable from a
    // genuinely-absent one without this.
    await expect(typedSocketOf('Merge', 'input', 'extra')).toHaveCount(0);

    const pickedOut = await center(typedSocketOf('Number Source', 'output', 'number'));
    const mismatchedIn = await center(typedSocketOf('Merge', 'input', 'string'));
    const mergeStr = typedSocketOf('Merge', 'input', 'string');
    const INCOMPATIBLE = /rozie-flow-socket--incompatible/;

    // ---- start the gesture and PAUSE mid-drag (pointer still down) ----
    await page.mouse.move(pickedOut.x, pickedOut.y);
    await page.mouse.down();
    await page.mouse.move(
      (pickedOut.x + mismatchedIn.x) / 2,
      (pickedOut.y + mismatchedIn.y) / 2,
      { steps: 8 },
    );

    // ---- POSITIVE FIRST (also proves the locator resolves): the type-mismatched
    // target socket is marked before any reconcile has run ----
    await expect(mergeStr).toHaveCount(1);
    await expect(mergeStr).toHaveClass(INCOMPATIBLE, { timeout: 5_000 });

    // ---- fire the mid-drag portsAdded reconcile: 'p' registers a new port on the
    // `merge` TYPE without releasing the pointer ----
    await page.keyboard.press('p');

    // ---- proves the toggle landed (the reconcile was actually triggered), not
    // merely that the key was pressed ----
    await expect(page.getByTestId('port-added-state')).toHaveText('true', { timeout: 5_000 });
    // ---- proves the reconcile actually ran end-to-end: the new port's socket DOM
    // exists on the live node, not just the data flag flipped ----
    await expect(typedSocketOf('Merge', 'input', 'extra')).toHaveCount(1, { timeout: 5_000 });

    // ---- THE REGRESSION GATE (WR-03): the already-marked socket survived the
    // portsAdded rebuild — still dimmed, not silently un-marked ----
    await expect(mergeStr).toHaveCount(1);
    await expect(mergeStr).toHaveClass(INCOMPATIBLE, { timeout: 5_000 });

    // ---- release the gesture: marking clears completely ----
    await page.mouse.move(mismatchedIn.x, mismatchedIn.y, { steps: 8 });
    await page.mouse.up();

    // WR-01: existence-check before the negative — same discipline as every other
    // negative assertion in this file.
    await expect(mergeStr).toHaveCount(1);
    await expect(mergeStr).not.toHaveClass(INCOMPATIBLE, { timeout: 5_000 });

    // ---- settle-and-resample (the file's own idiom): a late re-mark cannot slip
    // through after the gesture has fully settled ----
    await page.waitForTimeout(500);
    await expect(mergeStr).toHaveCount(1);
    await expect(mergeStr).not.toHaveClass(INCOMPATIBLE);
  });
}

/**
 * 37. BODY-REPAINT REGRESSION GATE — a graph re-bind repaints a `<NodeType>` `#body`
 * (the upstream 0.2.0 report: "`<NodeType #body>` content is rendered once and never
 * updates").
 *
 * THE FAILURE MODE THIS GUARDS: `renderNode`'s in-place branch (FlowCanvas.rozie:1697-
 * 1707) refreshed `existing.handle` — the LOW-LEVEL `#node` escape-hatch portal — and
 * fell back to `existing.titleEl` for default chrome. The render-by-type branch
 * (`:1787-1800`) sets `entry.bodyHandle` and RETURNS EARLY, so a `<NodeType>`-templated
 * node carries `handle === null` AND `titleEl === null`: both arms missed and
 * `area.update('node', id)` repainted nothing. `entry.bodyHandle` was built and
 * disposed but never updated anywhere in the file, so the projected `#body` froze at
 * first paint for the life of the node while the bound model moved underneath it.
 *
 * THE TRIGGER: `examples/demos/FlowCanvasBodyUpdateDemo.rozie` re-binds `$data.graph`
 * with a fresh node object carrying a changed `data.label`. That is the CONTROLLED-MODEL
 * path — FlowCanvas watches `() => $props.graph` by reference (`:3391`) — and it drives
 * `reconcileNodesPass` to re-seed `nodeMeta` (`:2489`) and call `area.update('node', id)`
 * (`:2534`) for the existing node, landing in exactly the in-place branch under test.
 * The port schema is deliberately untouched across the gesture: a port change would send
 * the reconcile down the `portsAdded` fresh-build path (`:2500-2532`), which re-projects
 * the body from scratch and would mask the frozen-body bug entirely.
 *
 * `label-state` (read off the BOUND MODEL) is asserted BEFORE the rendered body, so a
 * dead button and a frozen body can never be confused. The rendered proof reads
 * `.rozie-demo-node-label`, a class on the `#body` template's own element — not the
 * readout that mirrors it.
 *
 * Behavioral DOM check, NOT a screenshot — this asserts text content, so no
 * Linux-rendered baseline is owed (`feedback_vr_linux_baselines`). `rete-flow.spec.ts`
 * stays entirely `toHaveScreenshot`-free.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-body-update [${target}]: a graph re-bind repaints the NodeType #body`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasBodyUpdate&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(2);

    // The PROJECTED body text — one per graph node, from the single render-by-type
    // template. Two of them proves the type template renders per INSTANCE, which is
    // also the existence proof backing every negative count assertion below (WR-01:
    // a vanished locator must never be indistinguishable from a genuinely-absent one).
    const labels = page.locator('.rozie-flow-node .rozie-demo-node-label');
    await expect(labels).toHaveCount(2, { timeout: 15_000 });

    // ---- precondition: the seeded label is projected, the renamed one is not ----
    await expect(page.getByTestId('label-state')).toHaveText('Alpha');
    await expect(labels.filter({ hasText: 'Alpha' })).toHaveCount(1);
    await expect(labels.filter({ hasText: 'Bravo' })).toHaveCount(1);
    await expect(labels.filter({ hasText: 'Renamed' })).toHaveCount(0);

    // ---- re-bind the graph with a fresh node object carrying the new label ----
    await page.getByTestId('rename-btn').click();

    // ---- proves the BOUND MODEL actually moved (a dead button fails here, before
    // the render assertion can report a false negative) ----
    await expect(page.getByTestId('label-state')).toHaveText('Renamed', { timeout: 5_000 });

    // ---- THE REGRESSION GATE: the projected #body followed the re-bind ----
    await expect(labels).toHaveCount(2, { timeout: 5_000 });
    await expect(labels.filter({ hasText: 'Renamed' })).toHaveCount(1, { timeout: 5_000 });
    await expect(labels.filter({ hasText: 'Alpha' })).toHaveCount(0);
    // the UNTOUCHED sibling instance kept its own body — the update re-projected the
    // renamed node's scope, it did not re-render every node with one shared scope.
    await expect(labels.filter({ hasText: 'Bravo' })).toHaveCount(1);

    // ---- settle-and-resample (the file's own idiom): the repaint is stable, not a
    // frame that a later reconcile echo reverts ----
    await page.waitForTimeout(500);
    await expect(labels).toHaveCount(2);
    await expect(labels.filter({ hasText: 'Renamed' })).toHaveCount(1);
    await expect(labels.filter({ hasText: 'Alpha' })).toHaveCount(0);
  });
}

/**
 * 38. SOCKET RE-MEASURE GATE — a node box that changes size re-measures its sockets, so
 * the attached connection paths follow (the upstream 0.2.1 report: "#body content that
 * changes width leaves the connections behind").
 *
 * THE FAILURE MODE THIS GUARDS: `getDOMSocketPosition` (rete-render-utils) measures and
 * STORES a socket's position ONLY on a `rendered` + `socket` signal — verified in its own
 * source (`context.type === 'rendered' && context.data.type === 'socket'` →
 * `calculatePosition` → `sockets.add` → `emitter.emit`). FlowCanvas emits that signal from
 * exactly one place, `renderSocketInto` (FlowCanvas.rozie:1869), which runs only on the
 * FRESH-BUILD path; `renderNode`'s in-place branch is documented "leave sockets" (`:1694`).
 * So the position store kept first-paint coordinates for the life of the node and every
 * connection path stayed pinned to them. The reporter measured `d` byte-identical across a
 * change that narrowed five of seven nodes.
 *
 * A re-measure is SUFFICIENT — `renderConnection` subscribes
 * `socketWatcher.listen(nodeId, side, key, (p) => { start = p; redraw() })` (`:2120-2121`),
 * so a fresh position pushes straight into a redraw. That is also why the reporter's
 * `area.update('connection', id)` was inert: it redraws faithfully from the stale store.
 *
 * TWO LEGS, because there are two ways to move the box:
  *   1. BODY CONTENT — `badge-btn` toggles the badge text on the node's own `data` via a
 *      graph re-bind (the reporter's "user filters the underlying data"), changing the
 *      auto-sized node's width. Only reachable since 0.2.1 — before the ISSUE-7 fix a
 *      `#body` never repainted at all. Note the badge must live in `node.data`, not in
 *      component state: the slot scope is { node, selected, emit }, and a value read from
 *      outside it is snapshot at projection time by the reactive-portal contract.
 *   2. RESIZE GESTURE — a NodeResizer corner drag. `flushResizeWriteBack` (`:893`) commits
 *      width/height into the bound graph, which reconciles through the SAME in-place branch
 *      (`:1701-1702` sets `box.style.width/height`) and never re-measured. PRE-EXISTING,
 *      not a 0.2.1 regression; in scope because it is the same defect.
 *
 * Each leg asserts the node's own width CHANGED before asserting the path moved — the
 * existence proof that the box actually resized, so a dead button or a missed drag can
 * never masquerade as a pass. Behavioral DOM check, NOT a screenshot: the assertion is an
 * attribute string, so no Linux-rendered baseline is owed.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-socket-remeasure [${target}]: a resized node box re-measures its sockets so connections follow`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasBodyResize&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(2);

    const path = page.locator('.rozie-flow-connection__path').first();
    await expect(path).toHaveCount(1, { timeout: 15_000 });
    // the one seeded edge must actually be drawn before anything is sampled — a null/empty
    // `d` would make every "changed" comparison below vacuous.
    await expect
      .poll(async () => ((await path.getAttribute('d')) ?? '').length, { timeout: 15_000 })
      .toBeGreaterThan(10);

    // Sample the path only once it has STOPPED moving. The resize write-back is a genuine
    // round trip — the drag commits width/height into the bound graph, the reconcile sets
    // an explicit pixel box where the height was previously `auto`, and the resulting few-px
    // correction lands a frame or more later on React and Angular than on the other four.
    // A fixed-delay sample encodes one target's flush timing as the contract; polling for
    // two identical consecutive reads asserts the real property — it settled — without one.
    const settledD = async (tries = 20): Promise<string> => {
      let prev = (await path.getAttribute('d')) ?? '';
      for (let i = 0; i < tries; i++) {
        await page.waitForTimeout(150);
        const cur = (await path.getAttribute('d')) ?? '';
        if (cur === prev) return cur;
        prev = cur;
      }
      throw new Error('connection path never settled');
    };

    const autoNode = page.locator('.rozie-flow-node', { hasText: 'Source' }).first();
    const sizedNode = page.locator('.rozie-flow-node', { hasText: 'Sink' }).first();
    const widthOf = async (n: typeof autoNode) => {
      const box = await n.boundingBox();
      if (!box) throw new Error('node bounding box unavailable');
      return box.width;
    };

    // ── LEG 1: body content changes the auto-sized node's width ──────────────────
    const w0 = await widthOf(autoNode);
    const d0 = await settledD();
    await expect(page.getByTestId('wide-state')).toHaveText('wide');

    await page.getByTestId('badge-btn').click();
    await expect(page.getByTestId('wide-state')).toHaveText('narrow', { timeout: 5_000 });

    // EXISTENCE PROOF that the box really resized. Without this, a `d` that did not move
    // would be indistinguishable from a body that never changed width at all.
    await expect
      .poll(async () => Math.round(await widthOf(autoNode)), { timeout: 5_000 })
      .not.toBe(Math.round(w0));

    // THE REGRESSION GATE: the socket moved with the box, so the path must have moved.
    await expect
      .poll(async () => await path.getAttribute('d'), { timeout: 5_000 })
      .not.toBe(d0);

    // ── LEG 2: a NodeResizer corner drag on the `sized` node ─────────────────────
    await sizedNode.click();
    const seHandle = page.getByTestId('flow-resize-handle-se').first();
    await expect(seHandle).toBeVisible({ timeout: 5_000 });

    const hw0 = await widthOf(sizedNode);
    const d1 = await settledD();
    const hb = await seHandle.boundingBox();
    if (!hb) throw new Error('resize handle bounding box unavailable');

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 120, hb.y + hb.height / 2 + 60, { steps: 10 });
    await page.mouse.up();

    // Same discipline: prove the box resized before asserting the path followed.
    await expect
      .poll(async () => Math.round(await widthOf(sizedNode)), { timeout: 5_000 })
      .not.toBe(Math.round(hw0));
    await expect
      .poll(async () => await path.getAttribute('d'), { timeout: 5_000 })
      .not.toBe(d1);

    // settle-and-resample (the file's own idiom): once the path has stopped moving it STAYS
    // there — the re-measure is not a transient frame that a later reconcile echo reverts
    // back to the stale first-paint coordinates.
    const dFinal = await settledD();
    expect(dFinal).not.toBe(d1);
    await page.waitForTimeout(500);
    await expect(path).toHaveCount(1);
    expect(await path.getAttribute('d')).toBe(dFinal);
  });
}

/**
 * 39. TYPE-LEVEL NODE SIZING — a `<NodeType>` can fix or cap the box for every node of the
 * type, and min/max are real LAYOUT bounds rather than resize-gesture bounds (260825-mip).
 *
 * WHAT CHANGED: `minWidth`/`maxWidth`/`minHeight`/`maxHeight` used to be consumed at
 * exactly one place — `clampResizeSize`, called only from the resize-drag handler. They
 * bounded a GESTURE, not a LAYOUT: a `<NodeType maxWidth="240">` whose `#body` rendered
 * 600px of content still rendered 600px wide, and on a non-`resizable` type they did
 * nothing at all. The only way to fix a box was the per-INSTANCE `node.width` the resize
 * gesture writes back. Now a type-level `width`/`height` sets the box for every node of
 * the type, and the resolution is
 *
 *     effective = clamp( instance node.width ?? type width ?? auto )
 *
 * — instance beats type, clamp applies last to whichever won.
 *
 * FOUR INDEPENDENT LEGS, so a partial implementation cannot pass:
 *   1. FIXED   — a `:width` type holds ONE width across a `node.data` change that
 *      materially changes body content. Deliberate contrast with rete-flow-body-update,
 *      which asserts the width DOES move on the same trigger: same gesture, opposite
 *      contract, and that contrast is the feature.
 *   2. CAPPED  — a `:max-width` type with overlong content renders AT the cap, not wider.
 *   3. NARROW  — a `:width="120"` type really renders 120px. `.rozie-flow-node` carries
 *      `min-width: 140px` in base.css, so this leg proves an explicit width LOWERS that
 *      floor rather than being silently clamped up to it.
 *   4. INSTANCE-BEATS-TYPE — a corner drag persists an instance width that overrides the
 *      type width, and a handle double-click resets to the TYPE width, not to auto.
 *
 * Behavioral only — every assertion is a measured width, so no `.png` baseline is owed.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-fixed-width [${target}]: a NodeType can fix or cap the box for every node of its type`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasFixedWidth&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(4);

    const nodeOf = (label: string) =>
      page.locator('.rozie-flow-node', { hasText: label }).first();
    // offsetWidth, NOT boundingBox().width: the canvas applies a CSS transform, so a
    // bounding box is SCREEN space and silently multiplies by the zoom factor. That is not
    // a hypothetical — rete's AreaPlugin zooms by 1.4 on double-click, so the reset gesture
    // in leg 4 changes the zoom as well as the size, and a screen-space read of a correctly
    // reset 240px node comes back as 336. `offsetWidth` is layout space and is what "this
    // node is 240px wide" actually means.
    const widthOf = async (label: string) =>
      await nodeOf(label).evaluate((el: HTMLElement) => el.offsetWidth);

    // Every node seeds the SAME badge text, so any width difference between them can only
    // come from its type's sizing props — never from its content.
    await expect(page.getByTestId('badge-state')).toHaveText('wide');

    // ── LEG 1: a :width type renders at exactly that width ──────────────────────
    await expect.poll(async () => await widthOf('Fixed'), { timeout: 10_000 }).toBe(320);

    // ── LEG 2: a :max-width type is capped, not stretched by its content ────────
    await expect.poll(async () => await widthOf('Capped'), { timeout: 10_000 }).toBe(200);

    // ── LEG 3: an explicit width BELOW base.css's 140px node floor really renders ──
    await expect.poll(async () => await widthOf('Narrow'), { timeout: 10_000 }).toBe(120);

    // ── LEG 1 (the point of the feature): the fixed width HOLDS across a data change
    // that materially changes body content — the exact trigger under which
    // rete-flow-body-update asserts an auto-sized node's width MOVES ──────────────
    await page.getByTestId('badge-btn').click();
    await expect(page.getByTestId('badge-state')).toHaveText('narrow', { timeout: 5_000 });
    // the auto-sized-in-every-other-respect capped node proves the data change really did
    // shrink the content — otherwise "fixed width held" would be vacuously true.
    await expect
      .poll(async () => await widthOf('Capped'), { timeout: 5_000 })
      .toBeLessThan(200);
    await expect(await widthOf('Fixed')).toBe(320);
    await expect(await widthOf('Narrow')).toBe(120);

    // ── LEG 4: instance width beats type width; reset returns to the TYPE width ──
    await expect(await widthOf('Sized')).toBe(240);
    await nodeOf('Sized').click();
    const seHandle = page.getByTestId('flow-resize-handle-se').first();
    await expect(seHandle).toBeVisible({ timeout: 5_000 });
    const hb = await seHandle.boundingBox();
    if (!hb) throw new Error('resize handle bounding box unavailable');

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 100, hb.y + hb.height / 2, { steps: 10 });
    await page.mouse.up();

    // the persisted INSTANCE width now overrides the type's 240 — asserted on the BOUND
    // MODEL as well as the rendered box, so "reset never fired" and "reset fired but the
    // type width was not re-applied" cannot be confused later.
    await expect
      .poll(async () => await widthOf('Sized'), { timeout: 5_000 })
      .toBeGreaterThan(260);
    await expect(page.getByTestId('sized-width')).not.toHaveText('auto');

    // a handle double-click clears the instance width — which returns the node to its
    // TYPE width (240), NOT to auto. That is the precedence rule's deliberate consequence.
    //
    // SETTLE BEFORE RE-MEASURING (rete-resize-dblclick-zoom debug session, flake (B)):
    // `sized-width` updates as soon as the DEMO receives the resize write-back's two-way
    // echo, but the handle's OWN on-screen position is a SEPARATE, slightly slower round
    // trip — FlowCanvas's internal `$props.graph` $watch (which drives both
    // `reconcileNodes()` and `scheduleResizerTrack()`) only fires once the prop echoes
    // back down through the framework's own reactivity, one tick behind the readout. A
    // `boundingBox()` read taken the instant the readout flips can catch the handle
    // mid-correction (measured directly: up to ~20-40ms / one extra tick of drift on the
    // `se` handle's x) and cache a now-stale coordinate. The dblclick below then lands off
    // the (tiny, ~8px) handle entirely, onto whatever is underneath — which reaches rete's
    // own window-level pointerup listener unblocked (rete-area-plugin's `Area` binds
    // pointerup on `window`, not the container, per rete-area-plugin.esm.js:413) and
    // deselects the node via its click-like-background-pointerup guard (`twitch < 4` ->
    // `unselectAll()`, rete-area-plugin.esm.js:1315), hiding the handles and silently
    // swallowing the reset with no exception — exactly the reported "reset silently stops
    // firing" shape. Poll for two consecutive identical reads (the file's own `settledD`
    // settle idiom above) instead of firing at a single, possibly-mid-flight sample.
    const settledHandleBox = async (tries = 20) => {
      let prev = await seHandle.boundingBox();
      for (let i = 0; i < tries; i++) {
        await page.waitForTimeout(15);
        const cur = await seHandle.boundingBox();
        if (prev && cur && prev.x === cur.x && prev.y === cur.y) return cur;
        prev = cur;
      }
      throw new Error('resize handle position never settled after the drag');
    };
    const hb2 = await settledHandleBox();
    await page.mouse.dblclick(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
    // the model drops the instance width first…
    await expect(page.getByTestId('sized-width')).toHaveText('auto', { timeout: 5_000 });
    // …and the render falls back to the TYPE width, not to auto.
    await expect.poll(async () => await widthOf('Sized'), { timeout: 5_000 }).toBe(240);
  });
}

/**
 * 40. ELK-ROUTED EDGES — `autoArrange()` consumes ELK's own computed route instead of
 * discarding it (Phase 84, D-01/D-03/D-05). `examples/demos/FlowCanvasRoutingDemo.rozie`
 * seeds a a→b→c→d chain PLUS a labeled a→d SKIP edge, all four nodes tangled at the SAME
 * x/y — the identical chain-of-4 + skip shape `elk-edge-sections.test.ts`'s unit guard
 * uses (M3/M4/M7), so the unit guard and this browser cell exercise ONE shape between them.
 *
 * COUNT-ONLY OR EXISTENCE-ONLY ASSERTIONS ARE EXPLICITLY BANNED IN THIS CELL — a prior
 * FlowCanvas VR regression (project_next_port_rete_flow) was once masked by exactly that
 * shape of assertion. This cell's whole point is proving a REAL geometric route, not merely
 * that something changed. Three independent AFTER-assertions are REQUIRED, each catching a
 * DIFFERENT possible failure mode on its own:
 *
 *   (a) the `d` attribute actually CHANGED from its pre-arrange value. Catches a missed
 *       `edgeStyleSig` extension: the model would carry the route correctly while
 *       `reconcileConnections`'s `changed` gate never trips for this PRE-EXISTING edge, so
 *       the canvas keeps drawing the OLD path forever — Phase 84's single highest-risk line.
 *   (b) the new `d` is a multi-segment POLYLINE with AT LEAST as many line-to commands as
 *       the model's own waypoint count. Catches a route dropped somewhere between `norm()`/
 *       `connMeta` and the render branch (the model says "routed", the canvas draws a
 *       bezier anyway — "the model changed" is asserted separately from "the pixels moved
 *       correctly," and neither implies the other).
 *   (c) GEOMETRIC: the path is densely re-sampled (via `getPointAtLength` + `getScreenCTM`,
 *       so the area's pan/zoom transform is accounted for — the `rete-flow-align` idiom) and
 *       mapped to page space; NO sample falls inside either intermediate node's bounding box
 *       (with a small inward margin so a route that legitimately grazes a shared boundary
 *       does not flake). Catches a route that changed SHAPE but still cuts through the very
 *       nodes it was supposed to clear.
 *
 * The waypoint COUNT is asserted only as `>= 2` (proof of a real multi-segment route) —
 * NEVER the exact authoritative count (4 for this shape under the shipped options, measured
 * at planning time — see `elk-edge-sections.test.ts` / 84-CONTEXT.md M3). An exact-count
 * assertion would make this cell brittle against a future spacing/placement tuning that is
 * not itself a regression; the observed count is recorded in the SUMMARY instead.
 *
 * A BEFORE geometric assertion also has teeth: the pre-arrange bezier chord is asserted to
 * fall inside an intermediate node's box — proving the "after" geometric clearance
 * assertion is not vacuously true (there was something for the route to actually clear).
 *
 * BONUS (not one of the 3 required): the skip edge's label position is asserted to move
 * off the pre-arrange chord midpoint after arrange — light coverage for the label-midpoint
 * behavior (FR-06) this fixture's labeled skip edge also exercises.
 *
 * Behavioral-only — NO `toHaveScreenshot` (autoArrange is verb-only; matches the
 * `rete-flow-arrange`/`rete-flow-large` precedent — arranged layout depends on measured,
 * per-platform node dimensions, so no pixel baseline is owed).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-routing [${target}]: autoArrange() routes an edge around intermediate nodes, proven geometrically`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasRouting&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(4);
    await expect
      .poll(async () => page.locator('.rozie-flow-connection__path').count(), { timeout: 15_000 })
      .toBe(4);

    // The skip edge's own <path> — identified by its per-connection marker id
    // (`rozie-arrow-<connection.id>`, the SAME identifying attribute redraw()'s arrowhead
    // already relies on), NOT by render-order index (which edges render first is not part
    // of this feature's contract).
    const skipPath = page.locator('.rozie-flow-connection__path[marker-end="url(#rozie-arrow-e-skip)"]');
    await expect(skipPath).toHaveCount(1);
    const skipLabel = page.locator('.rozie-flow-connection__label', { hasText: 'skip' });
    await expect(skipLabel).toHaveCount(1);

    // Give the watcher-driven redraw a moment to settle after mount (the rete-flow-align
    // precedent) before the first geometry sample.
    await page.waitForTimeout(800);

    const nodeBox = async (label: string) => {
      const box = await page.locator('.rozie-flow-node', { hasText: label }).first().boundingBox();
      if (!box) throw new Error(`node ${label} bounding box unavailable`);
      return box;
    };
    type Box = { x: number; y: number; width: number; height: number };
    const insideBox = (pt: { x: number; y: number }, box: Box, margin = 3) =>
      pt.x > box.x + margin &&
      pt.x < box.x + box.width - margin &&
      pt.y > box.y + margin &&
      pt.y < box.y + box.height - margin;

    // Dense-sample a <path> in PAGE space via getPointAtLength + getScreenCTM (accounts for
    // the area's pan/zoom transform — same idiom as rete-flow-align).
    const sampleGeometry = async (loc: typeof skipPath, samples: number) =>
      loc.evaluate((path: SVGPathElement, count: number) => {
        const total = path.getTotalLength();
        const m = path.getScreenCTM();
        if (!m) return [] as Array<{ x: number; y: number }>;
        const pts: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= count; i++) {
          const len = (total * i) / count;
          const p = path.getPointAtLength(len);
          pts.push({ x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f });
        }
        return pts;
      }, samples);

    // ---- BEFORE: a bezier chord, and it genuinely cuts through an intermediate node ----
    const dBefore = await skipPath.getAttribute('d');
    expect(dBefore, 'pre-arrange path exists').toBeTruthy();
    expect(
      dBefore,
      'pre-arrange path is a curve (classicConnectionPath emits M/C only, no line-to)',
    ).not.toMatch(/\bL\b/);

    const nodeBBox = await nodeBox('B');
    const nodeCBox = await nodeBox('C');
    const beforeSamples = await sampleGeometry(skipPath, 40);
    const beforeHits = beforeSamples.some((p) => insideBox(p, nodeBBox) || insideBox(p, nodeCBox));
    expect(
      beforeHits,
      'pre-arrange chord should cut through an intermediate node — proves the after-assertion is not vacuous',
    ).toBe(true);

    const labelXBefore = await skipLabel.getAttribute('x');
    const labelYBefore = await skipLabel.getAttribute('y');

    // ---- ARRANGE: click → the skip edge's waypoint readout settles to a REAL route ----
    // Never assert the exact authoritative count (4 at planning time) — only that it is a
    // genuine multi-segment route (>= 2). See docblock.
    await page.getByTestId('arrange-btn').click();
    const waypointReadout = page.getByTestId('skip-waypoint-count');
    await expect
      .poll(
        async () => Number((await waypointReadout.textContent())?.trim() ?? '0'),
        { timeout: 15_000, intervals: [100, 300, 600, 1000, 2000] },
      )
      .toBeGreaterThanOrEqual(2);
    const waypointCount = Number((await waypointReadout.textContent())?.trim() ?? '0');

    // ---- AFTER (a): the `d` attribute actually changed (the edgeStyleSig gate tripped) ----
    await expect
      .poll(async () => await skipPath.getAttribute('d'), { timeout: 10_000, intervals: [100, 300, 600, 1000, 2000] })
      .not.toBe(dBefore);
    const dAfter = await skipPath.getAttribute('d');

    // ---- AFTER (b): a real multi-segment polyline, line-to count >= waypoint count ----
    expect(dAfter, 'after-arrange path should be a polyline (contains line-to commands)').toMatch(/\bL\b/);
    const lineToCount = (dAfter || '').split(/\s+/).filter((tok) => tok === 'L').length;
    expect(
      lineToCount,
      `after-arrange line-to count (${lineToCount}) should be >= the model's waypoint count (${waypointCount})`,
    ).toBeGreaterThanOrEqual(waypointCount);

    // ---- AFTER (c): GEOMETRIC — the rendered route clears BOTH intermediate nodes ----
    const nodeBBoxAfter = await nodeBox('B');
    const nodeCBoxAfter = await nodeBox('C');
    const afterSamples = await sampleGeometry(skipPath, 80);
    const afterHits = afterSamples.some((p) => insideBox(p, nodeBBoxAfter) || insideBox(p, nodeCBoxAfter));
    expect(afterHits, 'after-arrange route should geometrically clear both intermediate nodes').toBe(false);

    // ---- BONUS (not one of the 3 required): the label moved off the old chord midpoint ----
    const labelXAfter = await skipLabel.getAttribute('x');
    const labelYAfter = await skipLabel.getAttribute('y');
    expect(
      labelXAfter !== labelXBefore || labelYAfter !== labelYBefore,
      'label position should move onto the new route (FR-06)',
    ).toBe(true);
  });
}

/**
 * 41. ROUTE INVALIDATION ON DRAG — Phase 84-02 (D-04, FR-05). A stored route is wrong the
 * moment a node moves: dragging a node must drop the route of EVERY edge that node is an
 * endpoint of, in the SAME commit the existing drag write-back already makes (no second
 * write, no second history entry). An edge whose endpoints were NOT touched by the gesture
 * must KEEP its route — that half is what proves the invalidation is SCOPED rather than a
 * blanket wipe of every connection's route.
 *
 * MEASURED, NOT ASSUMED (this plan's own governing theme): under this fixture's chain-of-4
 * + skip shape, ELK only ever bends the SKIP edge (`e-skip`, a→d) — the three chain edges
 * (`e-ab`/`e-bc`/`e-cd`) sit on directly-adjacent layers and are always straight, so their
 * waypoint count is 0 both before AND after any gesture. Asserting "count drops to 0" on
 * one of THOSE edges would be vacuous — trivially true whether or not invalidation is
 * implemented at all. So this cell proves both D-04 halves against the ONE edge that ever
 * carries a real, non-zero route (`e-skip`), via two SEQUENTIAL gestures instead of
 * assuming a second real route exists on a chain edge:
 *
 *   1. Arrange (skip edge gets a real route, count ≥ 2 — cell 40's own proof).
 *   2. Drag node `B` (an intermediate node — endpoint of `e-ab`/`e-bc`, NOT an endpoint of
 *      `e-skip`). Assert `e-skip`'s waypoint count AND rendered `d` are BYTE-IDENTICAL to
 *      their post-arrange values — the SCOPED half: a gesture elsewhere never touches a
 *      route it has no business touching.
 *   3. Drag node `D` (`e-skip`'s own target endpoint). Assert `e-skip`'s waypoint count
 *      drops to 0 AND its `d` returns to a curve (no line-to commands) — the DROP half:
 *      the only edge this fixture ever routes genuinely loses that route the moment one of
 *      its own endpoints moves.
 *
 * Both surfaces (model readout AND rendered `d`) are asserted at each step — a model-only
 * assertion would pass even if the render never updated. Behavioral-only — no
 * `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-routing-drag [${target}]: dragging an untouched node keeps a route; dragging its own endpoint drops it`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasRouting&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(4);

    const skipPath = page.locator('.rozie-flow-connection__path[marker-end="url(#rozie-arrow-e-skip)"]');
    const readCount = async (testid: string): Promise<number> =>
      Number((await page.getByTestId(testid).textContent())?.trim() ?? '0');

    const dragNode = async (label: string, dx: number, dy: number) => {
      const node = page.locator('.rozie-flow-node', { hasText: label }).first();
      await expect(node).toBeVisible({ timeout: 10_000 });
      const nb = await node.boundingBox();
      if (!nb) throw new Error(`node ${label} bounding box unavailable`);
      const grabX = nb.x + 14;
      const grabY = nb.y + 10;
      await page.mouse.move(grabX, grabY);
      await page.mouse.down();
      await page.mouse.move(grabX + dx / 2, grabY + dy / 2, { steps: 6 });
      await page.mouse.move(grabX + dx, grabY + dy, { steps: 6 });
      await page.mouse.up();
    };

    // ---- 1. arrange: e-skip carries a real, settled route ----
    await page.getByTestId('arrange-btn').click();
    await expect
      .poll(async () => readCount('skip-waypoint-count'), {
        timeout: 15_000,
        intervals: [100, 300, 600, 1000, 2000],
      })
      .toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(500);
    const skipCountAfterArrange = await readCount('skip-waypoint-count');
    const dSkipAfterArrange = await skipPath.getAttribute('d');
    expect(dSkipAfterArrange, 'skip edge should have a rendered path after arrange').toBeTruthy();

    // ---- 2. drag node B (untouched by e-skip) — SCOPED half: e-skip's route survives ----
    await dragNode('B', 60, 40);
    await page.waitForTimeout(500);
    expect(
      await readCount('skip-waypoint-count'),
      'a gesture on a node NOT touching e-skip must not change its waypoint count',
    ).toBe(skipCountAfterArrange);
    expect(
      await skipPath.getAttribute('d'),
      "e-skip's rendered path must be byte-identical after an unrelated node's drag",
    ).toBe(dSkipAfterArrange);

    // ---- 3. drag node D (e-skip's OWN endpoint) — DROP half: e-skip's route is dropped ----
    await dragNode('D', 60, 40);
    await expect
      .poll(async () => readCount('skip-waypoint-count'), { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(0);
    await page.waitForTimeout(400);
    const dSkipAfterDrag = await skipPath.getAttribute('d');
    expect(
      dSkipAfterDrag,
      'e-skip should redraw as a curve (no line-to) once its route is dropped',
    ).not.toMatch(/\bL\b/);
  });
}

/**
 * 42. ROUTE INVALIDATION ON RESIZE — Phase 84-02 (D-04, FR-05). Resize is a first-class
 * invalidating gesture, not a secondary one inherited from the drag cell by code symmetry
 * — a corner-drag resize moves sockets exactly as a body drag does, so it gets its own
 * executed proof. Mirrors cell 41's two-gesture structure and its measured, non-vacuous
 * choice of edge exactly (see cell 41's docblock for why `e-skip` is the only edge this
 * fixture ever gives a real route to drop); only the touching gesture differs (a
 * corner-drag on a resizable node instead of a body drag).
 *
 *   1. Arrange (`e-skip` gets a real route).
 *   2. Resize node `B` (an intermediate node, NOT an endpoint of `e-skip`) via its `se`
 *      handle. Assert `e-skip`'s waypoint count AND `d` are unchanged — the scoped half.
 *   3. Resize node `D` (`e-skip`'s own endpoint) via its `se` handle. Assert `e-skip`'s
 *      waypoint count drops to 0 and its `d` returns to a curve — the drop half.
 *
 * The fixture's `step` NodeType is marked `resizable` (Phase 84-02 extension), so every
 * node exposes the 4 canvas-level corner handles once selected
 * (`flow-resize-handle-{nw,ne,sw,se}`, the `rete-flow-resize` precedent).
 *
 * Behavioral-only — no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-routing-resize [${target}]: resizing an untouched node keeps a route; resizing its own endpoint drops it`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasRouting&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(4);

    const skipPath = page.locator('.rozie-flow-connection__path[marker-end="url(#rozie-arrow-e-skip)"]');
    const readCount = async (testid: string): Promise<number> =>
      Number((await page.getByTestId(testid).textContent())?.trim() ?? '0');

    const resizeNodeSe = async (label: string, dx: number, dy: number) => {
      const node = page.locator('.rozie-flow-node', { hasText: label }).first();
      await expect(node).toBeVisible({ timeout: 10_000 });
      const nb0 = await node.boundingBox();
      if (!nb0) throw new Error(`node ${label} bounding box unavailable`);
      await page.mouse.click(nb0.x + nb0.width / 2, nb0.y + nb0.height / 2);
      await expect(page.locator('.rozie-flow-node.is-selected')).toHaveCount(1, { timeout: 5_000 });
      const seHandle = page.getByTestId('flow-resize-handle-se');
      await expect(seHandle).toBeVisible({ timeout: 5_000 });
      const seBox = await seHandle.boundingBox();
      if (!seBox) throw new Error('se-handle bounding box unavailable');
      const seCx = seBox.x + seBox.width / 2;
      const seCy = seBox.y + seBox.height / 2;
      await page.mouse.move(seCx, seCy);
      await page.mouse.down();
      await page.mouse.move(seCx + dx / 2, seCy + dy / 2, { steps: 6 });
      await page.mouse.move(seCx + dx, seCy + dy, { steps: 6 });
      await page.mouse.up();
    };

    // ---- 1. arrange: e-skip carries a real, settled route ----
    await page.getByTestId('arrange-btn').click();
    await expect
      .poll(async () => readCount('skip-waypoint-count'), {
        timeout: 15_000,
        intervals: [100, 300, 600, 1000, 2000],
      })
      .toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(500);
    const skipCountAfterArrange = await readCount('skip-waypoint-count');
    const dSkipAfterArrange = await skipPath.getAttribute('d');
    expect(dSkipAfterArrange, 'skip edge should have a rendered path after arrange').toBeTruthy();

    // ---- 2. resize node B (untouched by e-skip) — SCOPED half: e-skip's route survives ----
    await resizeNodeSe('B', 50, 30);
    await page.waitForTimeout(500);
    expect(
      await readCount('skip-waypoint-count'),
      'a resize on a node NOT touching e-skip must not change its waypoint count',
    ).toBe(skipCountAfterArrange);
    expect(
      await skipPath.getAttribute('d'),
      "e-skip's rendered path must be byte-identical after an unrelated node's resize",
    ).toBe(dSkipAfterArrange);

    // ---- 3. resize node D (e-skip's OWN endpoint) — DROP half: e-skip's route is dropped ----
    await resizeNodeSe('D', 50, 30);
    await expect
      .poll(async () => readCount('skip-waypoint-count'), { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(0);
    await page.waitForTimeout(400);
    const dSkipAfterResize = await skipPath.getAttribute('d');
    expect(
      dSkipAfterResize,
      'e-skip should redraw as a curve (no line-to) once its route is dropped',
    ).not.toMatch(/\bL\b/);
  });
}

/**
 * 43. UNDO/REDO COMPOSES WITH ROUTE INVALIDATION — Phase 84-02 (D-04, FR-08). 84-CONTEXT.md
 * D-04 explicitly leaves this REASONED BUT UNVERIFIED: history snapshots are whole-graph
 * objects captured BEFORE a drag/resize gesture, so an undo SHOULD restore a fully
 * self-consistent prior state — old positions WITH whatever route was valid for those old
 * positions at snapshot time — "for free," with no route-specific undo/redo code required.
 * This cell closes that open question by RUNNING it rather than reasoning about it further.
 *
 *   1. Arrange (`e-skip` gets a real route, count ≥ 2).
 *   2. Drag node `D` (`e-skip`'s own endpoint) — `e-skip`'s route drops to 0 (cell 41's own
 *      proof, re-established here as this cell's starting condition).
 *   3. UNDO — one click must restore BOTH the pre-drag node position AND `e-skip`'s
 *      pre-drag route: waypoint count back to its post-arrange value, `d` back to its
 *      post-arrange value. If undo restored positions but NOT the route, the cause would be
 *      an in-place mutation somewhere in the write-back chain (84-RESEARCH.md Pitfall 3) —
 *      this is exactly the failure this cell is designed to catch.
 *   4. REDO — one click must re-drop the route (count back to 0, `d` back to a curve),
 *      exactly re-applying the post-drag state.
 *
 * Asserts BOTH surfaces (model readout AND rendered `d`) at every step. Behavioral-only —
 * no `toHaveScreenshot`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-routing-undo [${target}]: undo restores a dropped route along with positions; redo re-drops it`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasRouting&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), { timeout: 15_000 })
      .toBe(4);

    const skipPath = page.locator('.rozie-flow-connection__path[marker-end="url(#rozie-arrow-e-skip)"]');
    const readCount = async (testid: string): Promise<number> =>
      Number((await page.getByTestId(testid).textContent())?.trim() ?? '0');

    // ---- 1. arrange: e-skip carries a real, settled route ----
    await page.getByTestId('arrange-btn').click();
    await expect
      .poll(async () => readCount('skip-waypoint-count'), {
        timeout: 15_000,
        intervals: [100, 300, 600, 1000, 2000],
      })
      .toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(500);
    const skipCountAfterArrange = await readCount('skip-waypoint-count');
    const dSkipAfterArrange = await skipPath.getAttribute('d');
    expect(dSkipAfterArrange, 'skip edge should have a rendered path after arrange').toBeTruthy();

    // ---- 2. drag node D (e-skip's OWN endpoint) — its route drops ----
    const nodeD = page.locator('.rozie-flow-node', { hasText: 'D' }).first();
    await expect(nodeD).toBeVisible({ timeout: 10_000 });
    const nb = await nodeD.boundingBox();
    if (!nb) throw new Error('node D bounding box unavailable');
    const grabX = nb.x + 14;
    const grabY = nb.y + 10;
    const DX = 60;
    const DY = 40;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + DX / 2, grabY + DY / 2, { steps: 6 });
    await page.mouse.move(grabX + DX, grabY + DY, { steps: 6 });
    await page.mouse.up();

    await expect
      .poll(async () => readCount('skip-waypoint-count'), { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(0);
    await page.waitForTimeout(400);
    const dSkipAfterDrag = await skipPath.getAttribute('d');
    expect(dSkipAfterDrag, 'e-skip should be a curve once its route is dropped by the drag').not.toMatch(/\bL\b/);

    // ---- 3. UNDO — restores BOTH the pre-drag position AND the pre-drag route ----
    await page.getByTestId('undo-btn').click();
    await expect
      .poll(async () => readCount('skip-waypoint-count'), { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(skipCountAfterArrange);
    await page.waitForTimeout(400);
    expect(
      await readCount('skip-waypoint-count'),
      'undo must hold at the pre-drag waypoint count (no oscillation)',
    ).toBe(skipCountAfterArrange);
    expect(
      await skipPath.getAttribute('d'),
      'undo must restore the EXACT pre-drag rendered path, not merely a route with the same count',
    ).toBe(dSkipAfterArrange);

    // ---- 4. REDO — re-drops the route, returning to the post-drag state ----
    await page.getByTestId('redo-btn').click();
    await expect
      .poll(async () => readCount('skip-waypoint-count'), { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(0);
    await page.waitForTimeout(400);
    expect(
      await readCount('skip-waypoint-count'),
      'redo must hold at 0 (no oscillation)',
    ).toBe(0);
    expect(
      await skipPath.getAttribute('d'),
      'redo must return e-skip to a curve, re-applying the post-drag state',
    ).not.toMatch(/\bL\b/);
  });
}
