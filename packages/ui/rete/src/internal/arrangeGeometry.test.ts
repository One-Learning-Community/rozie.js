/**
 * arrangeGeometry.test.ts — ordinary co-located vitest for the pure
 * `src/internal/arrangeGeometry.ts` module (260826-h7k).
 *
 * THE FAILURE MODE THIS FILE GUARDS: `rete-auto-arrange-plugin@2.0.2`'s built-in
 * classic preset reports ELK port offsets that match rete's own DEFAULT node
 * view, not FlowCanvas's — output ports at `y = 35 + index*35`, input ports at
 * `y = height - 15 - ports*35 + index*35`. `nodeToLayoutChild` hard-sets
 * `portConstraints: 'FIXED_POS'` on every node AFTER spreading a preset's
 * `options?.(id)`, so a preset cannot override it — ELK faithfully aligns each
 * edge's two mismatched endpoints and shifts every successive node by the
 * offset delta, producing a FIXED PER-HOP Y STAIRCASE on a source→target chain
 * (measured: +33px/hop on a 140×52 node chain). This module reports the socket
 * geometry FlowCanvas actually rendered instead, removing the staircase.
 *
 * Imports the module directly — no source-slicing, no eval, no DOM. Import
 * failure IS the RED signal until Task 2 creates `./arrangeGeometry`.
 */
import { describe, expect, it } from 'vitest';
import {
  arrangeLayoutOptions,
  arrangePortRect,
  sanitizeWaypoints,
  waypointPathD,
  waypointsFromElkEdges,
  waypointsSignature,
  withoutWaypoints,
  withWaypoints,
} from './arrangeGeometry';

describe('arrangeLayoutOptions', () => {
  it('returns exactly the seven tuned keys with their exact string values when called with no override', () => {
    const opts = arrangeLayoutOptions(undefined);
    expect(opts).toEqual({
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.edgeNode': '30',
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.thoroughness': '10',
      'elk.edgeRouting': 'ORTHOGONAL',
    });
  });

  it('sets elk.edgeRouting to ORTHOGONAL (Phase 84 — consuming ELK\'s route requires it, see arrangeGeometry.ts docblock) but leaves elk.algorithm to the plugin', () => {
    const opts = arrangeLayoutOptions(undefined);
    expect(opts['elk.edgeRouting']).toBe('ORTHOGONAL');
    expect(Object.prototype.hasOwnProperty.call(opts, 'elk.algorithm')).toBe(false);
  });

  it('MERGE ORDER: caller wins on a shared key, adds a caller-only key, and an untouched default survives', () => {
    const opts = arrangeLayoutOptions({
      'elk.spacing.nodeNode': '999',
      'elk.direction': 'DOWN',
    });
    expect(opts['elk.spacing.nodeNode']).toBe('999'); // the CALLER wins
    expect(opts['elk.direction']).toBe('DOWN'); // a caller-only key is added
    expect(opts['elk.layered.nodePlacement.strategy']).toBe('NETWORK_SIMPLEX'); // untouched default survives
  });
});

describe('arrangePortRect', () => {
  it('FALLBACK SYMMETRY: output and input fallback ports (measured=null) share the same centred y — this is the property that removes the staircase', () => {
    const out = arrangePortRect('output', 140, 52, null);
    const inp = arrangePortRect('input', 140, 52, null);
    expect(out.width).toBe(14);
    expect(out.height).toBe(14);
    expect(inp.width).toBe(14);
    expect(inp.height).toBe(14);
    expect(out.y).toBe(52 / 2 - 14 / 2);
    expect(inp.y).toBe(52 / 2 - 14 / 2);
    // The symmetric-centred property: an unmeasured output port and an
    // unmeasured input port on the SAME node report the SAME y — no per-hop
    // mismatch for ELK to fixate on, which is the staircase's root cause.
    expect(out.y, 'output and input fallback y must be EQUAL (symmetric-centred, staircase-free)').toBe(inp.y);
  });

  it('SIDE MAPPING: output -> EAST, input -> WEST', () => {
    expect(arrangePortRect('output', 140, 52, null).side).toBe('EAST');
    expect(arrangePortRect('input', 140, 52, null).side).toBe('WEST');
  });

  it('MEASURED PASSTHROUGH: a fully-finite measured rect is returned verbatim plus side', () => {
    const measured = { x: 133, y: 21, width: 14, height: 14 };
    const rect = arrangePortRect('output', 140, 52, measured);
    expect(rect.x).toBe(133);
    expect(rect.y).toBe(21);
    expect(rect.width).toBe(14);
    expect(rect.height).toBe(14);
    expect(rect.side).toBe('EAST');
  });

  it('DEFENSIVE: a non-finite measured value falls back to the centred geometry rather than propagating NaN into ELK', () => {
    const measured = { x: NaN, y: 0, width: 14, height: 14 };
    const rect = arrangePortRect('output', 140, 52, measured);
    expect(Number.isFinite(rect.x)).toBe(true);
    expect(Number.isFinite(rect.y)).toBe(true);
    expect(rect.y).toBe(52 / 2 - 14 / 2);
  });
});

describe('waypointsFromElkEdges', () => {
  it('concatenates bendPoints across ALL sections of an edge, in order', () => {
    const result = {
      edges: [
        {
          id: 'e1',
          sections: [
            { bendPoints: [{ x: 1, y: 2 }] },
            { bendPoints: [{ x: 3, y: 4 }] },
          ],
        },
      ],
    };
    const map = waypointsFromElkEdges(result);
    expect(map.get('e1')).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it('an edge with zero bendpoints is ABSENT from the map (so "no route" is distinguishable from "some route")', () => {
    const result = { edges: [{ id: 'e1', sections: [{ bendPoints: [] }] }, { id: 'e2' }] };
    const map = waypointsFromElkEdges(result);
    expect(map.has('e1')).toBe(false);
    expect(map.has('e2')).toBe(false);
    expect(map.size).toBe(0);
  });

  it('drops non-finite coordinates', () => {
    const result = {
      edges: [{ id: 'e1', sections: [{ bendPoints: [{ x: NaN, y: 2 }, { x: 5, y: 6 }] }] }],
    };
    const map = waypointsFromElkEdges(result);
    expect(map.get('e1')).toEqual([{ x: 5, y: 6 }]);
  });

  it('a missing/nullish result yields an empty map rather than throwing', () => {
    expect(waypointsFromElkEdges(null).size).toBe(0);
    expect(waypointsFromElkEdges(undefined).size).toBe(0);
    expect(waypointsFromElkEdges({}).size).toBe(0);
  });
});

describe('sanitizeWaypoints', () => {
  it('returns null for nullish, non-array, or empty-array input', () => {
    expect(sanitizeWaypoints(null)).toBeNull();
    expect(sanitizeWaypoints(undefined)).toBeNull();
    expect(sanitizeWaypoints('not an array')).toBeNull();
    expect(sanitizeWaypoints({})).toBeNull();
    expect(sanitizeWaypoints([])).toBeNull();
  });

  it('returns null when ANY entry carries a non-finite x or y', () => {
    expect(sanitizeWaypoints([{ x: 1, y: 2 }, { x: NaN, y: 4 }])).toBeNull();
    expect(sanitizeWaypoints([{ x: 1, y: 2 }, { x: 3, y: 'not a number' }])).toBeNull();
    expect(sanitizeWaypoints([{ x: 1, y: 2 }, null])).toBeNull();
  });

  it('returns FRESH {x,y} objects — never the caller\'s array or its elements', () => {
    const input = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    const out = sanitizeWaypoints(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(out![0]).not.toBe(input[0]);
  });

  it('caps at the documented maximum length (client-side DoS guard, T-84-01-1)', () => {
    const huge = Array.from({ length: 10_000 }, (_, i) => ({ x: i, y: i }));
    const out = sanitizeWaypoints(huge);
    expect(out!.length).toBeLessThan(huge.length);
    expect(out!.length).toBeGreaterThan(0);
  });
});

describe('waypointsSignature', () => {
  it('returns the empty string for null AND for an empty array — absent and empty compare EQUAL (both mean "no route")', () => {
    expect(waypointsSignature(null)).toBe('');
    expect(waypointsSignature(undefined)).toBe('');
    expect(waypointsSignature([])).toBe('');
    expect(waypointsSignature(null)).toBe(waypointsSignature([]));
  });

  it('changes when a single coordinate changes', () => {
    const a = waypointsSignature([{ x: 1, y: 2 }]);
    const b = waypointsSignature([{ x: 1, y: 3 }]);
    expect(a).not.toBe(b);
  });
});

describe('withWaypoints / withoutWaypoints', () => {
  it('withoutWaypoints returns the SAME object reference when the key is absent', () => {
    const conn = { id: 'e1', source: 'a', target: 'b' };
    expect(withoutWaypoints(conn)).toBe(conn);
  });

  it('withoutWaypoints returns a fresh object with every other own key preserved and waypoints genuinely gone when present', () => {
    const conn = { id: 'e1', source: 'a', target: 'b', waypoints: [{ x: 1, y: 2 }] };
    const out = withoutWaypoints(conn);
    expect(out).not.toBe(conn);
    expect(Object.prototype.hasOwnProperty.call(out, 'waypoints')).toBe(false);
    expect(out.id).toBe('e1');
    expect(out.source).toBe('a');
    expect(out.target).toBe('b');
    // Never mutates the input.
    expect(Object.prototype.hasOwnProperty.call(conn, 'waypoints')).toBe(true);
  });

  it('withWaypoints returns a fresh object and never mutates its input', () => {
    const conn = { id: 'e1', source: 'a', target: 'b' };
    const points = [{ x: 1, y: 2 }];
    const out = withWaypoints(conn, points);
    expect(out).not.toBe(conn);
    expect(out.waypoints).toBe(points);
    expect(Object.prototype.hasOwnProperty.call(conn, 'waypoints')).toBe(false);
  });
});

describe('waypointPathD', () => {
  it('composes a move-to plus one line-to per intermediate point plus a final line-to the end point', () => {
    const d = waypointPathD({ x: 0, y: 0 }, [{ x: 1, y: 1 }, { x: 2, y: 2 }], { x: 3, y: 3 });
    expect(d).toBe('M 0 0 L 1 1 L 2 2 L 3 3');
  });

  it('with no intermediate points, composes a single move-to plus one line-to', () => {
    const d = waypointPathD({ x: 0, y: 0 }, [], { x: 3, y: 3 });
    expect(d).toBe('M 0 0 L 3 3');
  });
});
