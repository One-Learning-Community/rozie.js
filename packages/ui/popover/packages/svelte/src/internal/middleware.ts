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
 */

export interface MiddlewareFactories {
  offset: (value: number) => unknown;
  flip: () => unknown;
  shift: () => unknown;
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
          elements.floating.style.width = `${rects.reference.width}px`;
        },
      }),
    );
  }
  if (!config.disableFlip) mw.push(factories.flip());
  if (!config.disableShift) mw.push(factories.shift());
  // The arrow middleware needs a real element to position; opt-in only when both
  // the `arrow` prop is set AND the arrow element has mounted.
  if (config.arrow && config.arrowEl) {
    mw.push(factories.arrow({ element: config.arrowEl }));
  }
  return mw;
}
