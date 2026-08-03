/**
 * Hand-kept event-description manifest for @rozie-ui/embla.
 *
 * The emitted events are derived structurally from the source via `ir.emits`
 * (the `$emit(...)` calls in Carousel.rozie), but their payload shape and
 * human-readable description have no first-class IR source — so the prose
 * lives here, mirroring handle-manifest.mjs's shape.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing (the same
 * lockstep contract handle-manifest.mjs already applies to `ir.expose`).
 */
export const eventManifest = {
  select: {
    payload: 'index: number',
    description:
      'Fires on every snap change (drag, scroll, or programmatic). Distinct from the `selectedIndex` model prop — a model prop must not share a name with an emit.',
  },
  settle: {
    payload: '—',
    description: 'Fires when carousel motion stops (after a drag, scroll, or reInit settles).',
  },
  reInit: {
    payload: '—',
    description:
      'Fires when the engine re-initialises (an option flip, a slide add/remove, or a manual `reInitCarousel()` call). The current snap is preserved across it.',
  },
  'pointer-down': {
    payload: '—',
    description: 'Fires when a pointer drag begins on the viewport.',
  },
};

export default eventManifest;
