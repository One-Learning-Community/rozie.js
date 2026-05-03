/**
 * MOD-05 dogfood: the swipe modifier proves the public registerModifier API
 * is SemVer-stable v1 — a third-party plugin author can ship a modifier
 * that compiles correctly across BOTH Vue (Phase 3) and React (Phase 4)
 * without any change to @rozie/core.
 *
 * Plan 04-05 replaces this placeholder with the full ModifierImpl (resolve
 * + vue + react hooks) and wires the @touchstart.swipe('left') usage.
 */
export const __swipePluginPlaceholder: true = true;
