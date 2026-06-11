/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/embla.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (the Phase 21 `$expose({ ... })` call in Carousel.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121/ROZ524/Lit-lifecycle): none of these verbs
 * collides with an emitted event name (`reInitCarousel`, NOT `reInit` — which IS
 * an emit), the React `selectedIndex`-model auto-setter (`getSelectedIndex`, NOT
 * `selectedIndex`), or a Lit reserved lifecycle name.
 */
export const handleManifest = {
  scrollNext: 'Scroll to the next snap — `scrollNext(jump?)` (jump skips the transition). No-op before mount.',
  scrollPrev: 'Scroll to the previous snap — `scrollPrev(jump?)`. No-op before mount.',
  scrollToIndex:
    'Scroll to a specific snap index — `scrollToIndex(index, jump?)` (Embla `scrollTo`). Named to avoid the inherited DOM `HTMLElement.scrollTo(x, y)`. No-op before mount.',
  reInitCarousel:
    'Re-initialise the Embla engine (recompute snaps) — `reInitCarousel(opts?)`. Pass raw EmblaOptionsType to override; omit to re-apply the current prop-derived options. (NOT `reInit`, which is the emitted event.)',
  canScrollNext: 'Return whether a next snap is reachable — `canScrollNext()`. False before mount.',
  canScrollPrev: 'Return whether a previous snap is reachable — `canScrollPrev()`. False before mount.',
  getSelectedIndex:
    'Return the current scroll-snap index — `getSelectedIndex()` (Embla `selectedScrollSnap()`). 0 before mount. (NOT `selectedIndex`, which is the two-way model prop.)',
  scrollSnapList: 'Return the snap-point progress array — `scrollSnapList()` (numbers in [0, 1]). Empty before mount.',
  getInstance: 'Return the underlying EmblaCarouselType instance for direct API access (the engine escape hatch). Null before mount.',
};

export default handleManifest;
