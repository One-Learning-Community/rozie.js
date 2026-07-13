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
