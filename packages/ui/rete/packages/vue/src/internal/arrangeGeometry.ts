/**
 * arrangeGeometry — the pure ELK-layout geometry for FlowCanvas's `autoArrange()`
 * verb, extracted to `src/internal/` so it can be unit-tested in isolation
 * (codegen vendors `src/internal/` into every leaf via `copyInternal`, excluding
 * `*.test.ts`) and imported once from `FlowCanvas.rozie`'s `<script>` as a set of
 * PLAIN functions — never a `$computed`, since a `$computed` is a value on React
 * but an accessor on Solid, so aliasing the result in script logic diverges
 * across targets. A plain function called `()` everywhere is uniform on all six.
 *
 * THE BUG THIS FIXES: `rete-auto-arrange-plugin@2.0.2`'s built-in classic preset
 * reports ELK port offsets that match rete's own DEFAULT node view (output port
 * at `y = top(35) + index*spacing(35)`, input port at
 * `y = height - bottom(15) - ports*spacing(35) + index*spacing(35)`), not
 * FlowCanvas's actual rendered port positions. `nodeToLayoutChild` then
 * hard-sets `portConstraints: 'FIXED_POS'` on every node AFTER spreading a
 * preset's `options?.(id)`, so a preset option cannot override it — ELK
 * faithfully aligns each edge's two mismatched endpoints and shifts every
 * successive node in a chain by the offset delta (measured: a +33px/hop
 * staircase on a 140x52 node chain). Reporting the REAL measured (or a
 * symmetric centred-fallback) geometry here removes the mismatch, and with it
 * the staircase.
 *
 * No framework imports, no DOM — pure data in, pure data out.
 */

/** A finite `{x,y,width,height}` measured port rect, in graph (unscaled) units. */
export interface MeasuredPortRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The rect shape ELK's port-layout API expects, plus the side ELK aligns to. */
export interface ArrangedPortRect {
  x: number;
  y: number;
  width: number;
  height: number;
  side: 'EAST' | 'WEST';
}

/** Mirrors `MINIMAP_DEFAULT_NODE_W` (FlowCanvas.rozie) — the unmeasured-first-paint fallback node width. */
const FALLBACK_NODE_W = 140;
/** Mirrors `MINIMAP_DEFAULT_NODE_H` (FlowCanvas.rozie) — the unmeasured-first-paint fallback node height. */
const FALLBACK_NODE_H = 52;
/** The fallback port size (square) used when a socket has not yet been measured. */
const FALLBACK_PORT_SIZE = 14;

/**
 * The component's tuned ELK layout defaults, spread FIRST so a caller's
 * `userOptions` (spread LAST) wins on every shared key while an untouched
 * default survives. Deliberately sets NEITHER `elk.edgeRouting` NOR
 * `elk.algorithm` — the plugin supplies `elk.algorithm: 'layered'`,
 * `elk.hierarchyHandling: 'INCLUDE_CHILDREN'`, and POLYLINE routing
 * underneath, and both must survive untouched (overriding edgeRouting
 * measured worse for socket-to-socket chords).
 *
 * `elk.layered.nodePlacement.strategy: 'NETWORK_SIMPLEX'` is a measured
 * choice: on the chain-6+skip-edge probe it yields 31px of skip-edge
 * clearance where the default `BRANDES_KOEPF` still overlaps.
 */
export function arrangeLayoutOptions(
  userOptions?: Record<string, string> | null,
): Record<string, string> {
  return {
    'elk.spacing.nodeNode': '40',
    'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    'elk.spacing.edgeNode': '30',
    'elk.layered.spacing.edgeNodeBetweenLayers': '30',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.thoroughness': '10',
    ...(userOptions || {}),
  };
}

/** `true` when `n` is a genuine finite number (never NaN/Infinity/non-number). */
function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** `true` when every field of `measured` is a finite number. */
function isFullyMeasured(measured: MeasuredPortRect | null | undefined): measured is MeasuredPortRect {
  return (
    !!measured &&
    isFiniteNumber(measured.x) &&
    isFiniteNumber(measured.y) &&
    isFiniteNumber(measured.width) &&
    isFiniteNumber(measured.height)
  );
}

/**
 * Resolve the rect ELK should use for one socket, on one node.
 *
 * When `measured` carries four finite numbers, they are returned verbatim
 * (plus `side`) — the real, rendered socket geometry. Otherwise falls back to
 * a VERTICALLY-CENTRED port: `y = nodeHeight/2 - portSize/2`, `x` on the same
 * node edge the measured path would report (`nodeWidth - portSize` for an
 * output, `0` for an input). Both branches are symmetric — an unmeasured
 * output port and an unmeasured input port on the SAME node report the SAME
 * `y` — which is exactly the property that removes the per-hop staircase.
 *
 * `side` is always `side === 'output' ? 'EAST' : 'WEST'` — this component's
 * node view is inherently left-in / right-out.
 *
 * Non-finite `nodeWidth`/`nodeHeight` (an unmeasured node, same unmeasured-
 * first-paint class as `MINIMAP_DEFAULT_NODE_W`/`MINIMAP_DEFAULT_NODE_H`) are
 * substituted with the fallback node-dimension constants so the centred
 * fallback never computes off a non-finite dimension.
 */
export function arrangePortRect(
  side: 'input' | 'output',
  nodeWidth: number,
  nodeHeight: number,
  measured: MeasuredPortRect | null | undefined,
): ArrangedPortRect {
  const elkSide: 'EAST' | 'WEST' = side === 'output' ? 'EAST' : 'WEST';

  if (isFullyMeasured(measured)) {
    return { x: measured.x, y: measured.y, width: measured.width, height: measured.height, side: elkSide };
  }

  const w = isFiniteNumber(nodeWidth) ? nodeWidth : FALLBACK_NODE_W;
  const h = isFiniteNumber(nodeHeight) ? nodeHeight : FALLBACK_NODE_H;
  const portSize = FALLBACK_PORT_SIZE;

  return {
    x: side === 'output' ? w - portSize : 0,
    y: h / 2 - portSize / 2,
    width: portSize,
    height: portSize,
    side: elkSide,
  };
}
