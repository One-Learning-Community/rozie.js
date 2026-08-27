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
 * default survives.
 *
 * **SETS `elk.edgeRouting: 'ORTHOGONAL'` (Phase 84, measured — see
 * `tests/elk-edge-sections.test.ts` and 84-CONTEXT.md D3/D5).** The plugin's
 * own unconditional default is `POLYLINE`, which bends the NODE PLACEMENT
 * rather than the edge itself. On a chain — the shape that motivated this
 * phase — POLYLINE returns ZERO bendpoints, so a route this component now
 * consumes (`autoArrange()` -> `connection.waypoints`) would always come back
 * empty under the old default: a silent no-op on the exact case the phase
 * exists to fix. An earlier version of this comment stated "overriding
 * edgeRouting measured worse for socket-to-socket chords" — that measurement
 * was taken while the route was still being DISCARDED, so it was really
 * measuring placement side-effects on a bezier chord drawn between two raw
 * endpoints. Now that the route is consumed instead of thrown away, the trade
 * inverts: every probed shape routes at least as well under ORTHOGONAL, the
 * chain contrast is starkest (0 bendpoints vs 4+), and the layout-time cost
 * difference is negligible (~6% on a 48-node/86-edge graph). Escape hatch:
 * `userOptions` is spread LAST, so a caller can restore the previous behaviour
 * per call via `autoArrange({ options: { 'elk.edgeRouting': 'POLYLINE' } })`.
 *
 * Still sets NEITHER `elk.algorithm` NOR `elk.hierarchyHandling` — the plugin
 * supplies `elk.algorithm: 'layered'` and
 * `elk.hierarchyHandling: 'INCLUDE_CHILDREN'` unconditionally, and that half
 * of the original discipline is untouched.
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
    'elk.edgeRouting': 'ORTHOGONAL',
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

/**
 * A two-number waypoint — one intermediate point on a routed connection.
 * Always graph-space coordinates, matching node `x`/`y` (see M1 above and
 * `tests/elk-edge-sections.test.ts`'s coordinate-space assertions).
 */
export interface Waypoint {
  x: number;
  y: number;
}

/**
 * Minimal, LOCALLY-DECLARED shape of what elkjs's `layout()` result carries —
 * this module has zero dependency on elkjs's own types (or on elkjs at all)
 * because it is vendored verbatim into every one of the six leaf packages by
 * codegen's `copyInternal`, several of which do not otherwise depend on elkjs.
 * Structural typing means the REAL elkjs result already satisfies this shape.
 */
interface ElkEdgeSectionLike {
  bendPoints?: Array<{ x: number; y: number }>;
}
interface ElkEdgeLike {
  id?: string;
  sections?: ElkEdgeSectionLike[];
}
interface ElkLayoutResultLike {
  edges?: ElkEdgeLike[];
}

/**
 * The client-side denial-of-service guard for a pathological hand-authored
 * `connection.waypoints` array (threat T-84-01-1). Every probed shape in this
 * phase's planning stayed in the single digits; this cap is generous headroom
 * well above any real layout while still bounding the SVG `d` string length
 * `waypointPathD` below can produce from untrusted consumer data.
 */
const MAX_WAYPOINTS = 64;

/**
 * Maps an ELK edge id to the flat array of `{x,y}` points it routed through,
 * built by CONCATENATING the `bendPoints` of every section of that edge in
 * order — never a hard `sections[0]` (M6: a single-segment edge is the common
 * case measured, but nothing guarantees ELK never splits one, so the read
 * path must not assume it). Non-finite coordinates are dropped via the same
 * finite-number guard `arrangePortRect` already uses. An edge that
 * contributes NO points is OMITTED from the map entirely — this lets a caller
 * distinguish "ELK routed this edge around something" from "ELK left it
 * straight" and drop a stale `waypoints` field in the second case, rather than
 * writing an empty array that would need its own "is this actually a route"
 * check downstream. A nullish/malformed `result` yields an empty map rather
 * than throwing (defensive: this consumes elkjs's own Web-Worker
 * structured-clone output, per threat T-84-01-4).
 */
export function waypointsFromElkEdges(result: ElkLayoutResultLike | null | undefined): Map<string, Waypoint[]> {
  const map = new Map<string, Waypoint[]>();
  const edges = result && Array.isArray(result.edges) ? result.edges : [];

  for (const edge of edges) {
    if (!edge || edge.id == null) continue;
    const points: Waypoint[] = [];
    const sections = Array.isArray(edge.sections) ? edge.sections : [];
    for (const section of sections) {
      const bendPoints = section && Array.isArray(section.bendPoints) ? section.bendPoints : [];
      for (const bp of bendPoints) {
        if (bp && isFiniteNumber(bp.x) && isFiniteNumber(bp.y)) {
          points.push({ x: bp.x, y: bp.y });
        }
      }
    }
    if (points.length) map.set(String(edge.id), points);
  }

  return map;
}

/**
 * The defensive read-path normalizer for CONSUMER-AUTHORED `waypoints` data
 * (as opposed to `waypointsFromElkEdges`'s output, which is already-trusted
 * ELK data). Returns `null` unless `value` is a non-empty array whose EVERY
 * entry carries a finite `x` and a finite `y` — one malformed entry rejects
 * the whole array rather than silently dropping just that entry, so a caller
 * can tell "no route" from "a route, some of it garbage". Always returns
 * FRESH `{x,y}` point objects (never the caller's array or its element
 * objects), so a later consumer-side mutation of their own graph object can
 * never reach into anything already committed to the render path. Caps the
 * read length at `MAX_WAYPOINTS` (T-84-01-1) — a pathological hand-authored
 * graph cannot make `waypointPathD` below build an unbounded `d` string.
 */
export function sanitizeWaypoints(value: unknown): Waypoint[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const out: Waypoint[] = [];
  for (const entry of value) {
    const x = entry && typeof entry === 'object' ? (entry as { x?: unknown }).x : undefined;
    const y = entry && typeof entry === 'object' ? (entry as { y?: unknown }).y : undefined;
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
    out.push({ x, y });
    if (out.length >= MAX_WAYPOINTS) break;
  }

  return out;
}

/**
 * The pinned serialization for `edgeStyleSig`'s change-detection signature
 * (FlowCanvas.rozie's `edgeStyleSig`/`:2766` — the highest-risk single line in
 * this phase; see 84-CONTEXT.md D5). Returns the empty string for BOTH `null`
 * and an empty array — absent and empty deliberately collapse to the SAME
 * value because both mean "no route", so a connection that never had a route
 * and one whose route was just cleared do not spuriously look "changed" to
 * each other. Otherwise joins each point's coordinates with a comma and every
 * point with a semicolon.
 *
 * Deliberately a hand-built delimited string, not `JSON.stringify`: it is
 * order-of-keys independent, it cannot throw on an exotic consumer-supplied
 * object shape, it is cheap, and it matches this file's own established
 * `label + '|' + stroke + '|' + ...`-style hand-concatenated signature idiom
 * rather than introducing a second serialization convention next to it.
 */
export function waypointsSignature(value: Waypoint[] | null | undefined): string {
  if (!value || value.length === 0) return '';
  return value.map((p) => `${p.x},${p.y}`).join(';');
}

/**
 * Fresh-object builders for clearing/setting a connection's `waypoints`
 * field — used instead of an inline object-rest or an assignment of an absent
 * value because this file's established idiom for clearing a model field is
 * always a fresh spread (`{ ...n, x, y }`, `{ ...g, nodes }`, etc.), and
 * because a key whose VALUE is `undefined` survives some deep-clone/structured
 * -clone strategies and not others — these helpers make the key genuinely
 * ABSENT on every target, not merely nullish.
 */
export function withWaypoints<T extends Record<string, unknown>>(
  conn: T,
  points: Waypoint[],
): T & { waypoints: Waypoint[] } {
  return { ...conn, waypoints: points };
}

/**
 * Returns the SAME object reference when `waypoints` is already absent (so a
 * caller mapping a whole connection list can cheaply skip creating garbage
 * for edges that never had a route), and a FRESH object with every other own
 * key preserved and `waypoints` genuinely gone when present. Never mutates
 * its input.
 */
export function withoutWaypoints<T extends Record<string, unknown>>(conn: T): T {
  if (!conn || !Object.prototype.hasOwnProperty.call(conn, 'waypoints')) return conn;
  const { waypoints: _waypoints, ...rest } = conn as Record<string, unknown>;
  return rest as T;
}

/**
 * Pure `d`-string generator for a waypoint-routed connection, matching the
 * signature convention of the four generators already in `FlowCanvas.rozie`
 * (`(start, end) -> d-string`) plus the one extra `points` parameter. Composes
 * a single move-to plus one line-to per intermediate point plus a final
 * line-to the end point — a plain multi-segment polyline, matching what ELK
 * itself computed (its own routing style here IS a polyline). Numeric
 * coordinates are interpolated into literal SVG path commands ONLY — this
 * inherits the same no-injection discipline the existing generators already
 * state (written via `setAttribute`, never `innerHTML` — T-84-01-2).
 */
export function waypointPathD(start: Waypoint, points: Waypoint[], end: Waypoint): string {
  const all = [start, ...points, end];
  return all.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
}

/**
 * WR-01 (84-REVIEW.md) — the arrowhead-orientation tangent for a WAYPOINT-ROUTED edge,
 * computed directly from the route's own final segment (`lastRoutePoint` -> `end`) rather
 * than an arc-length walk back along the rendered path. `redraw()`'s pre-existing
 * arc-length heuristic (`path.getPointAtLength(pathLen - ARROW_LEN)`) was tuned for a
 * 2-point bezier chord; on a multi-segment ELK polyline, the final leg into the port can
 * legitimately be shorter than `ARROW_LEN` (12px — ELK's own port-anchored bend can sit
 * very close to the socket), which makes the arc-length walk sample a point on the segment
 * BEFORE the final bend — cutting across the corner instead of following the true
 * final-approach direction. This function is exact for any final-leg length, including
 * zero (degenerate: returns 0, matching `Math.atan2(0, 0)`).
 */
export function waypointArrowAngleDeg(lastRoutePoint: Waypoint, end: Waypoint): number {
  return (Math.atan2(end.y - lastRoutePoint.y, end.x - lastRoutePoint.x) * 180) / Math.PI;
}

/** An axis-aligned box in the same graph (unscaled) coordinate space as `Waypoint`/node `x,y`. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Segment-versus-axis-aligned-rectangle intersection, over plain numbers — the primitive
 * `tests/elk-edge-sections.test.ts`'s data-layer clearance proof (Phase 84-02, D-03) composes
 * into "does ELK's own polyline clear every non-endpoint node box on the diamond and fan-out
 * shapes." Genuinely useful beyond that one test: any future feature that needs to know
 * whether a straight run between two graph-space points crosses a node's box can reach for
 * this rather than re-deriving line-clipping math.
 *
 * `margin` shrinks the rect INWARD on all four sides before testing — the same "small inward
 * margin so a route that legitimately grazes a shared boundary does not flake" idiom this
 * repo's VR specs already use for `insideBox` checks (`rete-flow.spec.ts`'s `rete-flow-routing`
 * cell). A margin that would invert the rect (make it wider than it is tall/short) makes the
 * rect vacuous and this function returns `false` — there is nothing left to intersect.
 *
 * Implementation: Liang-Barsky parametric line clipping against the four half-planes of the
 * (margin-shrunk) box. This correctly reports a hit for every case that matters here: the
 * segment fully inside the box, fully outside, crossing exactly one edge, crossing two edges
 * (passing straight through), and one endpoint exactly on a boundary — all covered by the
 * co-located unit tests. A degenerate zero-length segment (`a` equals `b`) falls back to a
 * plain point-in-rect check, since the parametric form below divides by the segment's delta.
 *
 * WR-02 (84-REVIEW.md) — matches every other exported helper in this module (`arrangePortRect`,
 * `waypointsFromElkEdges`, `sanitizeWaypoints`) by guarding non-finite `a`/`b` coordinates
 * up front: without it, a NaN coordinate makes every Liang-Barsky comparison below false
 * (NaN comparisons are always false), falling through to `t0 <= t1` with `t0`/`t1` unchanged
 * from their `0`/`1` initial values — silently returning `true` (a false "intersects")
 * instead of `false`.
 */
export function segmentIntersectsRect(a: Waypoint, b: Waypoint, rect: Rect, margin = 0): boolean {
  if (!isFiniteNumber(a.x) || !isFiniteNumber(a.y) || !isFiniteNumber(b.x) || !isFiniteNumber(b.y)) return false;
  const minX = rect.x + margin;
  const maxX = rect.x + rect.width - margin;
  const minY = rect.y + margin;
  const maxY = rect.y + rect.height - margin;
  if (minX > maxX || minY > maxY) return false;

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (dx === 0 && dy === 0) {
    return a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY;
  }

  // Liang-Barsky: clip the parametric segment a + t*(b-a), t in [0,1], against each of the
  // 4 half-planes; p<0 heads INTO that boundary (tightens the lower bound t0), p>0 heads OUT
  // of it (tightens the upper bound t1); p===0 means the segment runs PARALLEL to that
  // boundary, so it only survives if it is already on the inside (q>=0) of that one plane.
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - minX, maxX - a.x, a.y - minY, maxY - a.y];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }

  return t0 <= t1;
}
