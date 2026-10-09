/**
 * middleware.ts — pure construction of the Floating UI middleware stack from the
 * Popover's first-class props.
 *
 * This is the one piece of BRANCHY engine glue in Popover.rozie (offset always on,
 * flip/shift opt-out via `disableFlip`/`disableShift`, arrow opt-in via `arrow` +
 * an element). Extracted to `src/internal/` so it can be unit-tested in isolation
 * (codegen vendors `src/internal/` into every leaf via copyInternal, excluding
 * `*.test.ts`).
 *
 * It takes the Floating UI middleware FACTORIES as arguments (rather than importing
 * `@floating-ui/dom` itself) so the unit test can pass lightweight stand-ins and
 * assert ORDER + presence without pulling the real engine — and so the vendored
 * copy in each leaf has zero engine import of its own (the leaf's Popover.* owns
 * the single engine import).
 *
 * Floating UI ordering contract: offset → size → flip → shift → arrow. `offset`
 * first so the gap is measured before collision detection; `size` next (pure
 * width-matching, placement-independent, so its slot is readability-driven, not
 * functional — gap math, then sizing, then collision-avoidance, then decoration);
 * `arrow` last so it reads the final resolved placement.
 *
 * Staying inside the viewport (261008-mmt). Field report: a `right-start` panel
 * on a 390px-wide screen ended with its right edge at 521px. The engine's DEFAULTS
 * cannot fix that: default `flip()` only tries placements on the same axis, so a
 * `right-start` panel with no room on either side stays `right-start` (the one that
 * overflows least), and default `shift()` slides a panel along its ALIGNMENT axis
 * only, which for a `left`/`right` placement is vertical — the horizontal overflow
 * is on shift's cross axis, which is off. So for `left*`/`right*` placements only,
 * flip also falls back to below, then above, and shift also slides across the
 * anchor as a last resort when nothing fits. Both are keyed on the engine's own
 * `initialPlacement` through Floating UI's option-function form, so the call site
 * does not change.
 *
 * `top*`/`bottom*` placements deliberately keep the engine defaults: every in-repo
 * composite (combobox `bottom-start`, data-table `bottom-end`) uses them, and a
 * dropdown must not jump beside its input in a short viewport or slide over it.
 */

/** The slice of the engine's middleware state the option functions read. */
export interface PlacementState {
  initialPlacement: string;
}
export interface FlipOptionsLike {
  crossAxis?: boolean | 'alignment';
  fallbackAxisSideDirection?: 'none' | 'start' | 'end';
}
export interface ShiftOptionsLike {
  crossAxis?: boolean;
}

export interface MiddlewareFactories {
  offset: (value: number) => unknown;
  flip: (options?: (state: PlacementState) => FlipOptionsLike) => unknown;
  shift: (options?: (state: PlacementState) => ShiftOptionsLike) => unknown;
  arrow: (opts: { element: Element }) => unknown;
  size: (opts: { apply: (args: unknown) => void }) => unknown;
}

export interface MiddlewareConfig {
  offset: number;
  disableFlip: boolean;
  disableShift: boolean;
  arrow: boolean;
  arrowEl: Element | null;
  matchWidth: boolean;
}

/**
 * True for a `left` / `right` placement (any alignment suffix). `placement` is a
 * loosely typed String prop, so anything that is not a string is not a side
 * placement.
 */
export function isSidePlacement(placement: unknown): boolean {
  return (
    typeof placement === 'string' &&
    (placement.startsWith('left') || placement.startsWith('right'))
  );
}

/**
 * Build the ordered middleware array for `computePosition`. Pure — no engine
 * import, no DOM read beyond the passed-in arrow element.
 */
export function buildMiddleware(
  factories: MiddlewareFactories,
  config: MiddlewareConfig,
): unknown[] {
  const mw: unknown[] = [factories.offset(config.offset)];
  if (config.matchWidth) {
    mw.push(
      factories.size({
        apply: (args: unknown) => {
          // D-12: WIDTH ONLY — never a height-family style property. Height
          // stays owned by the composing component's own token; a container
          // whose size changes on every scroll/resize is a virtualizer
          // re-measure feedback loop this repo has already paid for.
          const { rects, elements } = args as {
            rects: { reference: { width: number } };
            elements: { floating: HTMLElement };
          };
          // A zero-width reference (a point virtual element, release-0.8.0
          // audit B4) has no width to match: leave the panel's own width.
          elements.floating.style.width =
            rects.reference.width > 0 ? `${rects.reference.width}px` : '';
        },
      }),
    );
  }
  if (!config.disableFlip) {
    mw.push(
      factories.flip((state) =>
        isSidePlacement(state.initialPlacement)
          ? // 'alignment': leave the horizontal axis only when every horizontal
            // placement overflows its own side, so a tall panel that fits beside
            // the anchor stays beside it; 'end' tries below, then above.
            { crossAxis: 'alignment', fallbackAxisSideDirection: 'end' }
          : {},
      ),
    );
  }
  if (!config.disableShift) {
    mw.push(
      factories.shift((state) => ({ crossAxis: isSidePlacement(state.initialPlacement) })),
    );
  }
  // The arrow middleware needs a real element to position; opt-in only when both
  // the `arrow` prop is set AND the arrow element has mounted.
  if (config.arrow && config.arrowEl) {
    mw.push(factories.arrow({ element: config.arrowEl }));
  }
  return mw;
}
