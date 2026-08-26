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
import { arrangeLayoutOptions, arrangePortRect } from './arrangeGeometry';

describe('arrangeLayoutOptions', () => {
  it('returns exactly the six tuned keys with their exact string values when called with no override', () => {
    const opts = arrangeLayoutOptions(undefined);
    expect(opts).toEqual({
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.edgeNode': '30',
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.thoroughness': '10',
    });
  });

  it('sets NEITHER elk.edgeRouting NOR elk.algorithm — the plugin owns those', () => {
    const opts = arrangeLayoutOptions(undefined);
    expect(Object.prototype.hasOwnProperty.call(opts, 'elk.edgeRouting')).toBe(false);
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
