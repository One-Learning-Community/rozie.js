/**
 * normalizeListeners — Phase 15 (listener fallthrough) runtime helper, Solid.
 *
 * The Phase 15 D-09 hybrid: a `.rozie` author's `r-on="<expr>"` object-spread
 * is key-normalized to Solid-JSX listener-prop naming so HTML-shape event
 * names (`click`, `mouseenter`, …) work on a Solid host element.
 *
 * Compile-time path (preferred — zero runtime cost):
 *   r-on="{ click: fn, mouseenter: hover }"  is a LITERAL — the Solid emitter
 *   walks the ObjectExpression and renames keys at compile time, emitting
 *   per-key native JSX listener props directly.
 *
 * Runtime path (this helper — used only when the compile-time walk can't
 * apply, i.e. the `r-on` expression is NOT an object literal):
 *   r-on="someObj"          →  {...normalizeListeners(someObj)}
 *
 * SOLID DIFFERENCE: Solid's JSX listener convention is the SAME `onClick`/
 * `onMouseEnter` family as React (per docs.solidjs.com/concepts/components/
 * event-handlers — Solid lowers `onClick` to `addEventListener('click', …)`
 * under the hood). The `SOLID_LISTENER_KEY_MAP` table is entry-for-entry
 * identical to `REACT_LISTENER_KEY_MAP` — kept as a separate symbol so
 * downstream tooling can introspect a target-specific map.
 *
 * The `$listeners` magic accessor is EXEMPT (D-19): a `$listeners` cluster
 * already carries target-native keys (the consumer wrote `onClick`, not
 * `click`), so the Solid emitter spreads it WITHOUT a wrap. Mirrors Phase
 * 14's `$attrs` D-04 exemption.
 *
 * SECURITY (T-15-V5-03 — prototype pollution): the keys of a dynamic `r-on`
 * object may be consumer- or data-controlled. Keys matching `__proto__`,
 * `constructor`, or `prototype` are SKIPPED — never copied to the output —
 * and the output is built on a null-prototype object. Byte-equal mirror of
 * Phase 14's `normalizeAttrs` FORBIDDEN_KEYS guard.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */

/** Keys whose presence in attacker-controllable input is a pollution vector. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * HTML DOM event name → Solid JSX listener-prop name. Identical entry set to
 * `REACT_LISTENER_KEY_MAP` (Phase 15 D-09 — Solid shares the React JSX
 * listener convention). Kept as a separate exported symbol so tooling can
 * introspect a target-specific map without conflating the two.
 *
 * Keys already in `on*` form pass through unchanged via the `?? key`
 * fallback.
 *
 * @public — paired with `normalizeListeners`.
 */
export const SOLID_LISTENER_KEY_MAP: Readonly<Record<string, string>> = {
  // Mouse
  click: 'onClick',
  dblclick: 'onDoubleClick',
  contextmenu: 'onContextMenu',
  mousedown: 'onMouseDown',
  mouseup: 'onMouseUp',
  mousemove: 'onMouseMove',
  mouseenter: 'onMouseEnter',
  mouseleave: 'onMouseLeave',
  mouseover: 'onMouseOver',
  mouseout: 'onMouseOut',
  // Pointer
  pointerdown: 'onPointerDown',
  pointerup: 'onPointerUp',
  pointermove: 'onPointerMove',
  pointerenter: 'onPointerEnter',
  pointerleave: 'onPointerLeave',
  pointercancel: 'onPointerCancel',
  pointerover: 'onPointerOver',
  pointerout: 'onPointerOut',
  gotpointercapture: 'onGotPointerCapture',
  lostpointercapture: 'onLostPointerCapture',
  // Touch
  touchstart: 'onTouchStart',
  touchend: 'onTouchEnd',
  touchmove: 'onTouchMove',
  touchcancel: 'onTouchCancel',
  // Keyboard
  keydown: 'onKeyDown',
  keyup: 'onKeyUp',
  keypress: 'onKeyPress',
  // Focus
  focus: 'onFocus',
  blur: 'onBlur',
  focusin: 'onFocusIn',
  focusout: 'onFocusOut',
  // Form
  input: 'onInput',
  change: 'onChange',
  submit: 'onSubmit',
  reset: 'onReset',
  invalid: 'onInvalid',
  select: 'onSelect',
  beforeinput: 'onBeforeInput',
  // Composition
  compositionstart: 'onCompositionStart',
  compositionend: 'onCompositionEnd',
  compositionupdate: 'onCompositionUpdate',
  // Drag & Drop
  drag: 'onDrag',
  dragstart: 'onDragStart',
  dragend: 'onDragEnd',
  dragenter: 'onDragEnter',
  dragleave: 'onDragLeave',
  dragover: 'onDragOver',
  dragexit: 'onDragExit',
  drop: 'onDrop',
  // UI / Scroll / Wheel
  wheel: 'onWheel',
  scroll: 'onScroll',
  resize: 'onResize',
  // Animation
  animationstart: 'onAnimationStart',
  animationend: 'onAnimationEnd',
  animationiteration: 'onAnimationIteration',
  // Transition
  transitionstart: 'onTransitionStart',
  transitionend: 'onTransitionEnd',
  transitionrun: 'onTransitionRun',
  transitioncancel: 'onTransitionCancel',
  // Clipboard
  copy: 'onCopy',
  cut: 'onCut',
  paste: 'onPaste',
  // Media
  play: 'onPlay',
  playing: 'onPlaying',
  pause: 'onPause',
  ended: 'onEnded',
  load: 'onLoad',
  error: 'onError',
  loadstart: 'onLoadStart',
  loadend: 'onLoadEnd',
  loadeddata: 'onLoadedData',
  loadedmetadata: 'onLoadedMetadata',
  canplay: 'onCanPlay',
  canplaythrough: 'onCanPlayThrough',
  progress: 'onProgress',
  ratechange: 'onRateChange',
  seeking: 'onSeeking',
  seeked: 'onSeeked',
  stalled: 'onStalled',
  suspend: 'onSuspend',
  timeupdate: 'onTimeUpdate',
  volumechange: 'onVolumeChange',
  waiting: 'onWaiting',
  durationchange: 'onDurationChange',
  abort: 'onAbort',
  emptied: 'onEmptied',
  encrypted: 'onEncrypted',
};

/**
 * Key-remap a dynamic `r-on` object to Solid JSX listener-prop naming.
 *
 * - HTML-shape event-name keys in `SOLID_LISTENER_KEY_MAP` are renamed
 *   (`click` → `onClick`, `mouseenter` → `onMouseEnter`, …).
 * - Keys ALREADY in Solid `on*` form (`onClick`, `onMouseEnter`) pass through
 *   unchanged via the `?? key` fallback.
 * - All other keys pass through verbatim (custom event names).
 * - `__proto__` / `constructor` / `prototype` keys are SKIPPED (T-15-V5-03).
 *
 * Returns a plain object suitable for a Solid JSX `{...obj}` spread.
 */
export function normalizeListeners(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  // Build on a null-prototype object so a remapped key can never collide with
  // an inherited Object.prototype member.
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(obj)) {
    // SECURITY (T-15-V5-03) — never copy a pollution-vector key.
    if (FORBIDDEN_KEYS.has(key)) continue;
    const mapped = SOLID_LISTENER_KEY_MAP[key] ?? key;
    out[mapped] = obj[key];
  }
  return out;
}
