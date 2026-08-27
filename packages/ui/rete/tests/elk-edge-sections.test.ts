/**
 * elk-edge-sections.test.ts — the Wave-0 empirical ELK probe, and a permanent
 * anti-revert regression guard on the routing mode (Phase 84).
 *
 * WHY THIS FILE EXISTS. `autoArrange()` is about to start CONSUMING ELK's
 * computed edge route (`edge.sections[].bendPoints`) instead of discarding it.
 * Two questions had to be answered before writing that consuming code, and
 * this file answers both by running the REAL installed `elkjs@0.8.2` headlessly
 * in Node — no DOM, no rete, no browser:
 *
 * 1. COORDINATE SPACE (M1/M2). Are `edge.sections[].{startPoint,bendPoints,
 *    endPoint}` in the same coordinate space as node `x`/`y`? Yes — confirmed
 *    below by asserting a section point's y falls inside its own node's
 *    vertical band, and that a far-right node's section points land at a
 *    correspondingly large x. But ELK's own `startPoint`/`endPoint` are NOT the
 *    component's socket centres — they sit ~14px OUTSIDE the node box (ELK
 *    anchors at the outer edge of the port it placed there). The drawn path
 *    must therefore keep using the socket-watcher `start`/`end` and consume
 *    ELK's data for the INTERMEDIATE points only. Never draw ELK's own
 *    endpoints; they would detach the line from its socket.
 *
 * 2. THE ROUTING-MODE TRAP (M3/M4). `rete-auto-arrange-plugin` sets
 *    `'elk.edgeRouting': 'POLYLINE'` unconditionally, and — until this phase —
 *    `arrangeLayoutOptions()` deliberately never overrode it. POLYLINE bends
 *    the node PLACEMENT, not the edge: on a CHAIN shape (the shape that
 *    motivated this whole phase — a run of intermediate nodes a skip edge must
 *    clear) it returns ZERO bendpoints. "Write `waypoints` from
 *    `edge.sections[].bendPoints`" would therefore be a literal no-op on the
 *    exact shape the phase exists to fix. Consuming ELK's route requires
 *    `'elk.edgeRouting': 'ORTHOGONAL'`, which is why `arrangeLayoutOptions()`
 *    now sets it (see `../src/internal/arrangeGeometry.ts`).
 *
 *    **The zero-bendpoints half holds ONLY under `arrangeLayoutOptions()`'s
 *    OWN tuned defaults (the identical chain graph under the plugin's BARE
 *    defaults gives 2, not 0), and ONLY on a chain (a diamond or fan-out gives
 *    1 under POLYLINE, never 0).** So the probe graph below is built by
 *    SPREADING `arrangeLayoutOptions()` — never a hardcoded options literal —
 *    so that a future change to the tuned defaults fails this test LOUDLY
 *    instead of silently drifting apart from what the anti-revert pair
 *    actually guards. Do not generalise the "POLYLINE yields zero" assertion
 *    to any shape other than this chain; do not "strengthen" it into a
 *    universal claim.
 *
 * This chain-of-4 + skip shape is the SAME graph the routing VR fixture
 * (`FlowCanvasRoutingDemo.rozie`, `rete-flow.spec.ts`) uses, so this unit
 * guard and the browser cell cover one shape between them.
 *
 * WHAT THIS FILE STOPS: a well-meaning revert of `elk.edgeRouting` back to
 * POLYLINE (e.g. "restore the old comment, it said not to touch this") would
 * silently reduce the entire routing feature to a no-op on chains — the exact
 * shape this phase was written to fix. This file turns that regression into a
 * loud, immediate failure instead of a shipped, undetected bug.
 */
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ELK = require('elkjs');
import {
  arrangeLayoutOptions,
  segmentIntersectsRect,
  waypointsFromElkEdges,
} from '../src/internal/arrangeGeometry';

const elk = new ELK();

const NODE_W = 140;
const NODE_H = 52;
const PORT_SIZE = 14;

/** A plugin-shaped ELK child node: fixed dims, two FIXED_POS ports (side under `properties`). */
function mkNode(id: string) {
  return {
    id,
    width: NODE_W,
    height: NODE_H,
    layoutOptions: { portConstraints: 'FIXED_POS' },
    ports: [
      {
        id: `${id}_in_input`,
        x: 0,
        y: NODE_H / 2 - PORT_SIZE / 2,
        width: PORT_SIZE,
        height: PORT_SIZE,
        properties: { side: 'WEST' },
      },
      {
        id: `${id}_out_output`,
        x: NODE_W - PORT_SIZE,
        y: NODE_H / 2 - PORT_SIZE / 2,
        width: PORT_SIZE,
        height: PORT_SIZE,
        properties: { side: 'EAST' },
      },
    ],
  };
}

/** A plugin-shaped ELK edge: id + the underscore-joined port ids `connectionToLayoutEdge` builds. */
function mkEdge(id: string, source: string, target: string) {
  return { id, sources: [`${source}_out_output`], targets: [`${target}_in_input`] };
}

/**
 * The root ELK graph, mirroring exactly what `AutoArrangePlugin.layout()` builds:
 * the plugin's own unconditional base (`elk.algorithm`, `elk.hierarchyHandling`,
 * a POLYLINE default) with `arrangeLayoutOptions(routingOverride)` spread LAST —
 * the same precedence `autoArrange()` uses (`options: arrangeLayoutOptions(opts)`).
 */
function buildGraph(nodeIds: string[], edges: Array<[string, string, string]>, routingOverride?: string) {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'POLYLINE',
      ...arrangeLayoutOptions(routingOverride ? { 'elk.edgeRouting': routingOverride } : undefined),
    },
    children: nodeIds.map(mkNode),
    edges: edges.map(([id, s, t]) => mkEdge(id, s, t)),
  };
}

/** chain-of-4 + skip (M7): a -> b -> c -> d, plus a skip edge a -> d. */
function chain4Graph(routingOverride?: string) {
  return buildGraph(
    ['a', 'b', 'c', 'd'],
    [
      ['a-b', 'a', 'b'],
      ['b-c', 'b', 'c'],
      ['c-d', 'c', 'd'],
      ['a-d', 'a', 'd'],
    ],
    routingOverride,
  );
}

/** diamond: source -> {A, B} -> sink, plus a source -> sink skip edge. */
function diamondGraph(routingOverride?: string) {
  return buildGraph(
    ['s', 'a', 'b', 'k'],
    [
      ['s-a', 's', 'a'],
      ['s-b', 's', 'b'],
      ['a-k', 'a', 'k'],
      ['b-k', 'b', 'k'],
      ['s-k', 's', 'k'],
    ],
    routingOverride,
  );
}

/** fan-out: source -> {A, B, C} -> sink, plus a source -> sink skip edge (Phase 84-02, D-03). */
function fanoutGraph(routingOverride?: string) {
  return buildGraph(
    ['s', 'a', 'b', 'c', 'k'],
    [
      ['s-a', 's', 'a'],
      ['s-b', 's', 'b'],
      ['s-c', 's', 'c'],
      ['a-k', 'a', 'k'],
      ['b-k', 'b', 'k'],
      ['c-k', 'c', 'k'],
      ['s-k', 's', 'k'],
    ],
    routingOverride,
  );
}

/** 48-node / 86-edge scale graph (M5/M6): a 47-edge chain plus 39 skip edges. */
function scaleGraph(routingOverride?: string) {
  const N = 48;
  const ids = Array.from({ length: N }, (_, i) => `n${i}`);
  const edges: Array<[string, string, string]> = [];
  for (let i = 0; i < N - 1; i++) edges.push([`e_${i}_${i + 1}`, ids[i], ids[i + 1]]);
  for (let i = 0; i < N - 2 && edges.length < 86; i++) edges.push([`skip_${i}_${i + 2}`, ids[i], ids[i + 2]]);
  return buildGraph(ids, edges, routingOverride);
}

describe('M1/M2 — coordinate space (chain-of-4 + skip, ORTHOGONAL)', () => {
  it('every edge section point falls inside its own node band, and the far-right node reports far-right x', async () => {
    const result = await elk.layout(chain4Graph());
    const byId = new Map((result.children || []).map((n: any) => [n.id, n]));

    for (const edge of result.edges || []) {
      const section = edge.sections && edge.sections[0];
      if (!section) continue;
      const src = section.incomingShape ? String(section.incomingShape).replace(/_out_output$/, '') : null;
      const tgt = section.outgoingShape ? String(section.outgoingShape).replace(/_in_input$/, '') : null;
      const srcNode: any = src ? byId.get(src) : null;
      const tgtNode: any = tgt ? byId.get(tgt) : null;

      if (srcNode) {
        expect(
          section.startPoint.y,
          `edge ${edge.id} startPoint.y should fall inside source node ${src}'s [y, y+height] band`,
        ).toBeGreaterThanOrEqual(srcNode.y);
        expect(section.startPoint.y).toBeLessThanOrEqual(srcNode.y + srcNode.height);
      }
      if (tgtNode) {
        expect(
          section.endPoint.y,
          `edge ${edge.id} endPoint.y should fall inside target node ${tgt}'s [y, y+height] band`,
        ).toBeGreaterThanOrEqual(tgtNode.y);
        expect(section.endPoint.y).toBeLessThanOrEqual(tgtNode.y + tgtNode.height);
      }
    }

    // The discriminating half: the right-most node (d) sits well past x=700
    // (a node-local coordinate space would instead report a small offset).
    const d: any = byId.get('d');
    expect(d.x).toBeGreaterThan(700);
    const dEdge = (result.edges || []).find((e: any) => e.id === 'c-d');
    expect(dEdge.sections[0].endPoint.x).toBeGreaterThan(700);
  });

  it("ELK's own section endpoints sit OUTSIDE the node box — never draw them directly (M2)", async () => {
    const result = await elk.layout(chain4Graph());
    const byId = new Map((result.children || []).map((n: any) => [n.id, n]));
    const ab = (result.edges || []).find((e: any) => e.id === 'a-b');
    const a: any = byId.get('a');
    expect(
      ab.sections[0].startPoint.x,
      "startPoint.x must be strictly outside the source node's right edge",
    ).toBeGreaterThan(a.x + a.width);
  });
});

describe('M3/M4 — the anti-revert pair: POLYLINE yields zero, ORTHOGONAL yields a real route (chain-of-4 + skip ONLY)', () => {
  it('the shipped default (arrangeLayoutOptions() with no override) resolves elk.edgeRouting to ORTHOGONAL', () => {
    expect(arrangeLayoutOptions(undefined)['elk.edgeRouting']).toBe('ORTHOGONAL');
  });

  it('POLYLINE: the skip edge (a-d) gets ZERO bendpoints — this is why the old mode was a no-op for this feature', async () => {
    const result = await elk.layout(chain4Graph('POLYLINE'));
    const ad = (result.edges || []).find((e: any) => e.id === 'a-d');
    const bendPoints = (ad.sections[0].bendPoints || []) as Array<{ x: number; y: number }>;
    expect(bendPoints.length).toBe(0);
  });

  it('ORTHOGONAL: the skip edge (a-d) gets a real multi-point route that leaves the lane', async () => {
    const result = await elk.layout(chain4Graph('ORTHOGONAL'));
    const byId = new Map((result.children || []).map((n: any) => [n.id, n]));
    const ad = (result.edges || []).find((e: any) => e.id === 'a-d');
    const bendPoints = (ad.sections[0].bendPoints || []) as Array<{ x: number; y: number }>;
    expect(bendPoints.length).toBeGreaterThanOrEqual(4);

    // At least one bendpoint's y sits strictly outside EVERY intermediate
    // node's [y, y+height] band — the route genuinely leaves the lane rather
    // than merely being present-but-vacuous.
    const intermediates = ['b', 'c'].map((id) => byId.get(id));
    const escapes = bendPoints.some((p) =>
      intermediates.every((n: any) => p.y < n.y || p.y > n.y + n.height),
    );
    expect(escapes, 'expected at least one bendpoint to clear both intermediate nodes').toBe(true);
  });

  it('caller override wins: passing elk.edgeRouting through arrangeLayoutOptions userOptions restores POLYLINE even against the shipped ORTHOGONAL default', async () => {
    const forced = arrangeLayoutOptions({ 'elk.edgeRouting': 'POLYLINE' });
    expect(forced['elk.edgeRouting']).toBe('POLYLINE');
    const result = await elk.layout(chain4Graph('POLYLINE'));
    const ad = (result.edges || []).find((e: any) => e.id === 'a-d');
    expect((ad.sections[0].bendPoints || []).length).toBe(0);
  });
});

describe('branching shapes (diamond) — NOT asserted as a bendpoint count (see file docblock + M3 consequence 2)', () => {
  it('diamond graph resolves under both routing modes without throwing (existence-only — no count is authoritative here)', async () => {
    const polyline = await elk.layout(diamondGraph('POLYLINE'));
    const orthogonal = await elk.layout(diamondGraph('ORTHOGONAL'));
    expect(polyline.children?.length).toBe(4);
    expect(polyline.edges?.length).toBe(5);
    expect(orthogonal.children?.length).toBe(4);
    expect(orthogonal.edges?.length).toBe(5);
    // Deliberately NOT asserting a bendpoint count here. The planner's
    // authoritative table (1 under POLYLINE, 2 under ORTHOGONAL) could not be
    // reproduced against this construction (both returned 0 in this repo's
    // run) — recorded in the SUMMARY as a non-reproduced measurement per
    // M3 consequence 2, rather than asserted as if it were confirmed.
  });
});

/**
 * Data-layer clearance proof (Phase 84-02, D-03) — the counterpart to the browser
 * geometry cell (`rete-flow-routing`, `rete-flow.spec.ts`) for the two branching shapes
 * that cell does NOT cover. Lives here rather than as two more VR cells for reasons
 * recorded in 84-01-PLAN.md's own fixture-split rationale: this proof can check EVERY
 * edge of every shape against every non-endpoint node's box, with no browser flake, no
 * viewport clipping, and no zoom transform in the way — the browser cell's distinct job
 * (proving a route survives the whole model-to-DOM chain on all 6 targets) is already
 * discharged once by the chain-of-4 + skip fixture.
 *
 * MEASURED, NOT ASSUMED (this plan's own governing theme). 84-02-PLAN.md's text asserted
 * "the diamond and fan-out skip edges DO route under ORTHOGONAL: 2 bendpoints each",
 * attributed to 84-01-PLAN.md's M4a. Re-running the EXACT diamond construction already
 * committed above (and the fan-out construction added for this task) against the real
 * installed elkjs gives **0 bendpoints for both shapes, under BOTH routing modes** — the
 * identical non-reproduction 84-01-SUMMARY.md already documented for this diamond. The
 * "≥2 bendpoints, strictly more than POLYLINE" assertion 84-02-PLAN.md asked for is
 * therefore NOT added — it would be false, not merely conservative.
 *
 * This does NOT mean the clearance claim is false. `source` and `sink` land in the SAME
 * layer on both shapes (confirmed below), so the skip edge's own straight run — ELK's
 * `startPoint` to `endPoint`, zero bends — sits well outside every intermediate node's
 * band purely from LAYERED PLACEMENT, without needing a single bend. D-03's truth ("ELK's
 * own computed polyline clears every non-endpoint node") holds either way: a polyline with
 * zero interior points is still a polyline, and clearance is what the truth actually
 * requires — not that the route bends. Every edge of every shape is checked below, not
 * just the skip edge, so the proof is not narrowed to the one case that was expected to
 * be interesting.
 */
describe('D-03 data-layer clearance — diamond and fan-out (segment-vs-node-box, no VR needed)', () => {
  /** `points[i] -> points[i+1]` for every consecutive pair, per `waypointPathD`'s own composition order. */
  const CLEARANCE_MARGIN = 2;

  function assertEveryEdgeClearsNonEndpoints(result: any) {
    const byId = new Map((result.children || []).map((n: any) => [n.id, n]));
    for (const edge of result.edges || []) {
      const section = edge.sections && edge.sections[0];
      if (!section) continue;
      const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
      // connectionToLayoutEdge sets sources/targets to `${nodeId}_out_output` /
      // `${nodeId}_in_input` — strip the suffix to recover the endpoint node ids (mirrors
      // M1/M2's own incomingShape/outgoingShape parsing above).
      const srcId = String((edge.sources || [])[0] || '').replace(/_out_output$/, '');
      const tgtId = String((edge.targets || [])[0] || '').replace(/_in_input$/, '');

      for (const [nodeId, node] of byId) {
        if (nodeId === srcId || nodeId === tgtId) continue; // never check an edge against its OWN endpoints
        const rect = { x: (node as any).x, y: (node as any).y, width: (node as any).width, height: (node as any).height };
        for (let i = 0; i < points.length - 1; i++) {
          const hit = segmentIntersectsRect(points[i], points[i + 1], rect, CLEARANCE_MARGIN);
          expect(
            hit,
            `edge ${edge.id} segment [${i}] should clear non-endpoint node ${nodeId}'s box`,
          ).toBe(false);
        }
      }
    }
  }

  it('diamond: source and sink share a layer (the placement fact that makes the skip edge clear without bending)', async () => {
    const result = await elk.layout(diamondGraph('ORTHOGONAL'));
    const byId = new Map((result.children || []).map((n: any) => [n.id, n]));
    const s: any = byId.get('s');
    const k: any = byId.get('k');
    expect(s.y).toBe(k.y);
  });

  it('diamond: every edge of ELK\'s own computed route clears every non-endpoint node box (ORTHOGONAL)', async () => {
    const result = await elk.layout(diamondGraph('ORTHOGONAL'));
    assertEveryEdgeClearsNonEndpoints(result);
  });

  it('diamond: the same clearance holds under POLYLINE (placement, not routing mode, is what clears this shape)', async () => {
    const result = await elk.layout(diamondGraph('POLYLINE'));
    assertEveryEdgeClearsNonEndpoints(result);
  });

  it('fan-out: source and sink share a layer, same as the diamond', async () => {
    const result = await elk.layout(fanoutGraph('ORTHOGONAL'));
    const byId = new Map((result.children || []).map((n: any) => [n.id, n]));
    const s: any = byId.get('s');
    const k: any = byId.get('k');
    expect(s.y).toBe(k.y);
  });

  it('fan-out: every edge of ELK\'s own computed route clears every non-endpoint node box (ORTHOGONAL)', async () => {
    const result = await elk.layout(fanoutGraph('ORTHOGONAL'));
    assertEveryEdgeClearsNonEndpoints(result);
  });

  it('fan-out: the same clearance holds under POLYLINE', async () => {
    const result = await elk.layout(fanoutGraph('POLYLINE'));
    assertEveryEdgeClearsNonEndpoints(result);
  });
});

describe('M5/M6 — scale (48 nodes / 86 edges)', () => {
  it('the scale graph resolves under the shipped (arrangeLayoutOptions-sourced) options', async () => {
    const result = await elk.layout(scaleGraph());
    expect(result.children?.length).toBe(48);
    expect(result.edges?.length).toBe(86);
  });

  it('every edge has exactly one section in this scale graph (M6) — but the read path concatenates ALL sections, never a hard sections[0]', async () => {
    const result = await elk.layout(scaleGraph());
    let maxSections = 0;
    for (const edge of result.edges || []) {
      maxSections = Math.max(maxSections, (edge.sections || []).length);
    }
    expect(maxSections).toBe(1);

    // Read through the SAME concatenating helper the production write-back
    // uses — proves the scale graph resolves through that path without error.
    const map = waypointsFromElkEdges(result);
    expect(map instanceof Map).toBe(true);
    // Some subset of the 86 edges are skip edges expected to carry a route.
    expect(map.size).toBeGreaterThan(0);
    expect(map.size).toBeLessThanOrEqual(86);
  });
});
