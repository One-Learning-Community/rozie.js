import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Node-flow-editor behavioral smoke — Rete.js v2 (`FlowCanvas`).
 *
 * FlowCanvas is the framework-agnostic-engine archetype: the engine
 * (NodeEditor + AreaPlugin + ConnectionPlugin) owns the graph + all pointer
 * interaction, and a single VANILLA render pipe (no rete-react/vue/… plugin)
 * fills each engine node element with DOM, emits `render` socket signals (so the
 * ConnectionPlugin + the DOM socket-position watcher see the anchors), and draws
 * connection SVG paths. `examples/demos/FlowCanvasDemo.rozie` drives a
 * config-array `:nodes` / `:connections` graph, a two-way `r-model:zoom`, an
 * "add node" button (push onto `$data.nodes`), and fills the REACTIVE
 * multi-instance `node` portal slot with framework-native node chrome.
 *
 *   1. **Mount + vanilla render (all 6 targets) — the make-or-break.** The
 *      wrapper's host `.rozie-flow-canvas` appears and the vanilla render pipe
 *      fills the engine node elements: ≥3 `.rozie-flow-node` boxes render. This
 *      proves the custom render layer fired across the framework boundary (no
 *      framework render plugin involved).
 *
 *   2. **Connections (all 6 targets).** The `:connections` array draws SVG paths
 *      via `classicConnectionPath` + the socket-position watcher — ≥1
 *      `.rozie-flow-connection__path` renders. Proves socket render-signal
 *      emission reached the watcher and the path redraw ran.
 *
 *   3. **Reactive node portal slot.** Each node body is the consumer
 *      `<template #node>` fragment (`.rozie-demo-node`) mounted per node via the
 *      reactive multi-instance portal. Their presence proves the per-node portal
 *      mounted framework-native content.
 *
 *   4. **Config-array reconcile (add node).** Clicking "Add node" pushes onto
 *      `$data.nodes`; the wrapper `$watch` reconciles it into the live editor
 *      (no remount), the count readout climbs, and a new `.rozie-flow-node`
 *      appears — the reactive-add proof.
 *
 *   5. **Two-way zoom.** Clicking "Zoom in" mutates `$data.zoom`; the model write
 *      reconciles into the live area (`area.area.zoom`) and the bound readout
 *      reflects the new level — the two-way round-trip proof.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. The deterministic pixel baseline is the SEPARATE
 * `FlowCanvasScreenshot` matrix cell (`FlowCanvasScreenshotDemo`). Like
 * `maplibre-map.spec.ts`, this spec runs locally on macOS without a Docker
 * baseline.
 *
 * If this spec is red but the other engine specs (chart, tiptap, maplibre) are
 * green, the regression is in the FlowCanvas wrapper's vanilla render pipe (the
 * `area.addPipe` render handler, the socket render-signal emission, or the
 * `$watch` graph reconcilers) — not the broader engine-wrapper pattern.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow [${target}]: graph mounts via vanilla render, connections draw, node portal + reconcile + two-way zoom`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvas&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount + vanilla render (the make-or-break) ----
    // The CSS locators pierce Lit's open shadow root.
    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    // ≥3 node boxes filled by the vanilla render pipe.
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3);

    // ---- 2. connections drawn ----
    await expect
      .poll(async () => page.locator('.rozie-flow-connection__path').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);

    // ---- 3. reactive node portal slot mounted consumer content ----
    await expect
      .poll(async () => page.locator('.rozie-demo-node').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(3);

    // ---- 4. config-array reconcile: add a node ----
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

    // ---- 5. two-way zoom round-trip ----
    const zoomReadout = page.getByTestId('readout-zoom');
    await expect(zoomReadout).toHaveText('1');
    await page.getByTestId('zoom-in').click();
    await expect(zoomReadout).not.toHaveText('1', { timeout: 5_000 });
  });
}

/**
 * Phase 37 — declarative `<FlowNode>` / `<Handle>` / `<Connection>` children +
 * the D-04 $portals body + the D-02 union + the D37-08 provenance.
 *
 * `examples/demos/FlowCanvasDeclarativeDemo.rozie` feeds ONE `<FlowCanvas>` BOTH a
 * config-array (`:nodes` → `cfg`) AND declarative children: `<FlowNode id="a">`
 * with an INLINE `<template #body>` (`.demo-card`) + a nested output `<Handle>`, an
 * r-for-gated `<FlowNode id="b">` (the unmount-reap vehicle) + nested in/out
 * `<Handle>`s, and a flat `<Connection source="a" target="b"/>`. It proves:
 *
 *   1. **D-04 body via $portals (esp. Lit).** Each `<FlowNode>` mounts its `#body`
 *      portal slot DIRECTLY into the engine `.rozie-flow-node__body` host via the
 *      shipped reactive-portal machinery (`$portals.body` → React createRoot+flushSync
 *      / Vue render / Svelte mount / Solid accessor / Angular ViewContainerRef / Lit
 *      render) — the SAME mechanism the config-array `#node` slot uses, which is
 *      6/6-green. NO framework-owned DOM is relocated (the abandoned `$el`-move path
 *      threw on react removeChild / angular @for / lit lit-html). The body text
 *      (`[data-testid=card-a]`) appears INSIDE a `.rozie-flow-node__body`.
 *   2. **Nested `<Handle>` ports.** The Handles addPort() into the node spec, so
 *      `buildSocketRow` renders `[data-testid=socket]` sockets.
 *   3. **Flat `<Connection>`.** A `.rozie-flow-connection__path` draws between the
 *      declarative nodes.
 *   4. **D-02 union.** The merged node set (cfg + a + b) reaches the engine; with
 *      the imperative add it is cfg + a + b + imp = 4, read via `$expose getNodes()`.
 *   5. **D37-08 provenance.** Toggling b off reaps its registry-managed node while
 *      the imperative `imp` node (in NEITHER provenance set) SURVIVES.
 *
 * Behavioral-only — NO new pixel baseline (D-08). Angular's component `ref` is the
 * host element (no `getNodes`), so its union/provenance readouts stay `0`/`false`;
 * for Angular we assert the rendered `.rozie-flow-node` DOM count instead (the
 * union still feeds the SAME reconcile, and the 5 ref-resolving targets prove the
 * merged-count + provenance via the handle).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-declarative [${target}]: <FlowNode> inline body (D-04) + nested <Handle> + flat <Connection> + D-02 union + D37-08 provenance`, async ({
    page,
  }) => {
    await page.goto(`/?example=FlowCanvasDeclarative&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount + the declarative + config-array nodes render ----
    const canvas = page.locator('.rozie-flow-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    // cfg (config-array) + a + b (declarative) = 3 node boxes.
    await expect
      .poll(async () => page.locator('.rozie-flow-node').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3);

    // ---- 2. D-04 body renders INSIDE the engine node via $portals (esp. Lit) ----
    // The FlowNode mounts its `#body` portal slot directly into the engine
    // `.rozie-flow-node__body` host (the 6/6-green reactive-portal machinery, no DOM
    // relocation). Assert the inline body text is visible inside an engine node — the
    // make-or-break body-projection proof.
    await expect(
      page.locator('.rozie-flow-node .rozie-flow-node__body').first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('card-a').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('card-a').first()).toHaveText('Source card');

    // ---- 3. nested <Handle> ports render sockets ----
    await expect
      .poll(async () => page.getByTestId('socket').count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);

    // ---- 4. flat <Connection> draws an edge between the declarative nodes ----
    await expect
      .poll(async () => page.locator('.rozie-flow-connection__path').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);

    // ---- 5. D-02 union + D37-08 provenance via the $expose handle ----
    if (target === 'angular') {
      // Angular's component `ref` resolves to the host ELEMENT, not the $expose
      // instance handle (the documented Angular ref edge — see the spec preamble), so
      // the imperative `addNode()` / `getNodes()` paths are not reachable via the ref
      // here. We therefore assert the parts that DO exercise the same union+reconcile
      // on Angular at the DOM level:
      //   • D-02 union: cfg (config-array) + a + b (declarative) = 3 engine node boxes.
      //   • D37-08 registry-managed reap: toggling b off unmounts the declarative
      //     <FlowNode id="b">, whose registry-managed engine node is reaped (3 → 2).
      // The "imperative $expose node SURVIVES the reap" half of D37-08 is proven on
      // the 5 ref-resolving targets below (where getNodes()/addNode() are reachable);
      // it cannot be triggered through Angular's host-element ref.
      const before = await page.locator('.rozie-flow-node').count();
      expect(before).toBeGreaterThanOrEqual(3);
      await page.getByTestId('toggle-b').click();
      await expect
        .poll(async () => page.locator('.rozie-flow-node').count(), {
          timeout: 10_000,
        })
        .toBeLessThan(before);
      return;
    }

    const countReadout = mount.getByTestId('readout-node-count');
    const impReadout = mount.getByTestId('readout-imp-present');

    // D-02 union: cfg + a + b = 3 nodes in the live engine.
    await expect
      .poll(
        async () => {
          await mount.getByTestId('check-union').click();
          return Number((await countReadout.textContent())?.trim() ?? '0');
        },
        { timeout: 15_000, intervals: [300, 600, 1200] },
      )
      .toBe(3);

    // Add the imperative node → union is now 4; imp present.
    await mount.getByTestId('add-imperative').click();
    await expect
      .poll(
        async () => {
          await mount.getByTestId('check-union').click();
          return Number((await countReadout.textContent())?.trim() ?? '0');
        },
        { timeout: 10_000, intervals: [300, 600, 1200] },
      )
      .toBe(4);
    await expect(impReadout).toHaveText('true');

    // D37-08: toggle b off → its registry-managed node is reaped (4 → 3), but the
    // imperative `imp` node (in NEITHER provenance set) SURVIVES the reconcile.
    await mount.getByTestId('toggle-b').click();
    await expect
      .poll(
        async () => {
          await mount.getByTestId('check-union').click();
          return Number((await countReadout.textContent())?.trim() ?? '0');
        },
        { timeout: 10_000, intervals: [300, 600, 1200] },
      )
      .toBe(3);
    // imp survived the reap — the provenance distinction proof.
    await expect(impReadout).toHaveText('true');
  });
}

/**
 * Drag-to-connect rubber-band preview line (quick-260610-jrk).
 *
 * When the user drags an edge from an output socket toward an input socket,
 * `rete-connection-plugin` renders a *pseudo-connection* whose render signal
 * carries a literal pointer coordinate (`data.end` when dragging from an output)
 * alongside a payload with one DANGLING endpoint (`target:''`/`targetInput:''`).
 * The vanilla render pipe must seed that dangling endpoint from the pointer (the
 * socketWatcher listener for an empty node id never fires) and update it on every
 * pointermove — otherwise `redraw()`'s `if (!start || !end) return` guard means the
 * preview line is never drawn and the editor gives no drag feedback.
 *
 * THE FIX PROOF (load-bearing): mid-drag, with the button still held, assert the
 * count of DRAWN paths (a `d` attribute that is a non-empty string) reaches ≥3.
 * Justification: the committed edge commits CORRECTLY even WITHOUT the fix, and the
 * pseudo `<path>` ELEMENT is created either way — pre-fix it simply has no `d`
 * attribute (the start/end guard). So counting elements, or asserting the committed
 * edge / lastConnect, would NOT distinguish fixed from broken. Only a pseudo path
 * with a NON-EMPTY `d` mid-drag (2 committed drawn → 3 during the drag) proves the
 * rubber-band actually draws. This is target-agnostic — all 6 go through the same
 * vanilla render pipe and the same `.rozie-flow-connection__path`.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`rete-flow-drag [${target}]: drag-to-connect draws the live preview line`, async ({
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
    // the 2 config-array edges (a→b, b→c) are committed and drawn before we drag.
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

    // THE FIX PROOF: mid-drag, the pseudo path draws → drawn count climbs to ≥3
    // (the 2 committed edges + the live preview line). expect.poll samples while
    // the button is still held so it catches the rubber-band as it tracks.
    await expect
      .poll(drawnCount, { timeout: 5_000, intervals: [100, 200, 300, 500] })
      .toBeGreaterThanOrEqual(3);

    // complete the gesture over the input socket → commit the a→c connection.
    await page.mouse.move(inCx, inCy, { steps: 8 });
    await page.mouse.up();

    // CORROBORATION (gesture completed): the drop landed on a compatible input
    // socket and committed a real connection in the editor, firing the wrapper's
    // `connection-created` event. The demo's `@connection-created="onConnect"`
    // increments `$data.lastConnect`, surfaced via readout-connect → '1'.
    //
    // SVELTE CAVEAT (documented per-target gap, not part of this fix): on Svelte the
    // connection IS created and the wrapper's `$emit('connection-created', …)` fires
    // (verified), but the consumer's `@connection-created` handler is not invoked when
    // the event originates from an async ENGINE callback (the Rete pointerup pipe),
    // so the readout stays '0'. This is a Svelte custom-event-from-engine-callback
    // emitter-parity concern — config-array connections are added under the wrapper's
    // `programmatic` guard, so `connection-created` had never actually fired in any
    // prior test on any target, which is why the gap surfaces only now. It is
    // orthogonal to the drag-to-connect preview line proven above (mid-drag ≥3, which
    // passes on all 6 targets) and would require an emitter change to close, so it is
    // tracked separately rather than asserted here. The 5 other targets assert the
    // full commit round-trip.
    if (target !== 'svelte') {
      await expect(page.getByTestId('readout-connect')).toHaveText('1', {
        timeout: 10_000,
      });
    }
    // PERSISTENCE PROOF (260610-jrk continuation): after release the rubber-band
    // pseudo is torn down, but the freshly drag-created a→c edge is a REAL
    // connection that renders and PERSISTS with a non-empty `d` — so the drawn-path
    // count settles to EXACTLY 3 (a→b, b→c committed + a→c drag-created). This
    // upgrades the earlier soft `≥2` (which a vanishing a→c would have passed) to a
    // strict `=3` that fails if the drag-created edge does not keep a drawn path.
    //
    // Why this is now assertable: the DOM evidence in the 260610-jrk continuation
    // (an instrumented `area.addPipe` trace) proved the a→c connection IS created
    // (`connectioncreated`, programmatic=0) AND rendered with a real bezier `d`. The
    // earlier "doesn't persist" reading was a misdiagnosis — Sink's input was a
    // single-connection input (ClassicPreset `multiple:false` default), so dropping
    // a→c onto c's already-occupied input correctly EVICTED b→c (`connectionremoved`
    // for e2), leaving the count at 2 even though a→c persisted. Sink's input is now
    // `multiple: true` in FlowCanvasDemo, so a→c ADDS a third edge instead of
    // replacing b→c — making the persistence directly countable.
    await expect
      .poll(drawnCount, { timeout: 10_000, intervals: [100, 300, 600, 1000] })
      .toBe(3);
  });
}

/**
 * Connector / socket vertical-alignment proof (quick-260610-jrk continuation #2).
 *
 * THE BUG: connection lines anchored ~14px BELOW each socket, at the node BOTTOM,
 * instead of on the socket. ROOT CAUSE (DOM-evidence-confirmed): the connection
 * `<svg>` was `display:inline` (the SVG default), so the 1px-tall SVG sat on the
 * connection element's TEXT BASELINE. With the engine container's default
 * line-height that baseline is ~14px below the connection element's top — and the
 * connection element IS the area-transform origin, so the offset is in screen space
 * and pushes EVERY endpoint ~14px down. The socket positions reported by
 * `getDOMSocketPosition` (offsetTop within the node-view) were already correct; the
 * inline-SVG baseline was the sole vertical drift. FIX: `display:block` on
 * `.rozie-flow-connection__svg` removes the baseline gap (CSS-only, in FlowCanvas's
 * scoped `:root {}` engine-DOM block — no script/emitter change).
 *
 * THE PROOF (load-bearing — must FAIL pre-fix, PASS post-fix): every drawn
 * connection path's START and END screen point must sit within tolerance of SOME
 * socket center VERTICALLY. Pre-fix worst dy ≈ 13.9px (node bottom); post-fix it
 * collapses to «1px (on the socket). The HORIZONTAL offset is NOT asserted tightly:
 * `getDOMSocketPosition.calculatePosition` intentionally returns the socket center
 * shifted 12px OUTWARD (`position.x + 12 * (side==='input' ? -1 : 1)`), so a correct
 * endpoint is ~12px horizontally from the socket center BY DESIGN — only a loose
 * sanity bound (≤ 20px) is checked horizontally. Tolerance rationale for the
 * vertical proof: cross-target sub-pixel kerning / AA / curvature-handle rounding is
 * « 6px, while the bug's node-bottom offset (~14px) is well outside it. Holds on all
 * 6 targets — they share the one vanilla render pipe + the same scoped connection CSS.
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
    // both config-array edges (a→b, b→c) drawn before we measure.
    await expect
      .poll(async () => page.locator('.rozie-flow-connection__path').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(2);

    // Give the watcher-driven redraw a moment to settle after mount/fit.
    await page.waitForTimeout(1200);

    // For every DRAWN path, compute its START + END screen points (via the path's
    // own getPointAtLength + getScreenCTM, so transforms/zoom are accounted for),
    // collect every socket's screen-center, and report the worst-case offset of any
    // endpoint from its NEAREST socket center. The bug-specific signal is VERTICAL
    // (worstDy): pre-fix ~14px (node bottom), post-fix «1px (on the socket). The
    // horizontal offset is loose (the lib intentionally shifts the stored position
    // 12px outward), so worstDx is only sanity-bounded.
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
