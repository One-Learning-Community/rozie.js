/**
 * nativeDomEvents — quick task 260812-i67 (ROZ998).
 *
 * The native-DOM-event allowlist consumed by the ROZ998
 * UNMATCHED_COMPONENT_LISTENER check in `ir/threadParamTypes.ts`. A native DOM
 * event bound on a composed component tag is COMMON and CORRECT —
 * `<DataTable @click="onRowClick">` binds the native `click` bubbling up from
 * the child's host element, not a Rozie-declared emit — so a listener whose
 * name is on this list is never flagged, even when the resolved callee's
 * declared emit list does not contain it.
 *
 * SOURCE (named so a future reader can re-verify): transcribed 2026-08-12 from
 * MDN's GlobalEventHandlers/Element/HTMLElement event reference pages plus the
 * UI Events specification (W3C) and the WHATWG DOM/HTML standards' event
 * lists (pointer events from the Pointer Events spec; touch events from the
 * Touch Events spec; animation/transition events from CSS Animations/
 * Transitions). Names are the lowercase event TYPE strings the browser
 * dispatches.
 *
 * Lookup is EXACT on the lowercased RAW authored name — deliberately NO
 * canonicalization before the allowlist test: a hyphenated spelling of a
 * native event (e.g. `pointer-down`) is NOT itself a native event name, so it
 * stays eligible for the ROZ998 warning.
 *
 * @experimental — shape may change before v1.0
 */

/**
 * Lowercase native DOM event names, grouped by family.
 */
export const NATIVE_DOM_EVENTS: ReadonlySet<string> = new Set<string>([
  // pointer family (Pointer Events spec)
  'pointerdown', 'pointerup', 'pointermove', 'pointerover', 'pointerout',
  'pointerenter', 'pointerleave', 'pointercancel', 'gotpointercapture',
  'lostpointercapture',
  // mouse family (UI Events spec)
  'click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'mousemove',
  'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'contextmenu',
  // touch family (Touch Events spec)
  'touchstart', 'touchend', 'touchmove', 'touchcancel',
  // drag family (HTML drag-and-drop)
  'drag', 'dragstart', 'dragend', 'dragenter', 'dragleave', 'dragover', 'drop',
  // keyboard family (UI Events spec)
  'keydown', 'keyup', 'keypress',
  // focus family, including the bubbling variants (UI Events spec)
  'focus', 'blur', 'focusin', 'focusout',
  // form family (HTML standard)
  'input', 'beforeinput', 'change', 'submit', 'reset', 'invalid', 'select',
  'selectionchange', 'selectstart', 'formdata', 'cancel', 'close',
  // clipboard family (Clipboard API spec)
  'copy', 'cut', 'paste',
  // composition family (UI Events spec)
  'compositionstart', 'compositionupdate', 'compositionend',
  // media / loading family (HTML media element events)
  'abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'ended',
  'error', 'loadeddata', 'loadedmetadata', 'loadstart', 'pause', 'play',
  'playing', 'progress', 'ratechange', 'seeked', 'seeking', 'stalled',
  'suspend', 'timeupdate', 'volumechange', 'waiting',
  // document / window loading + geometry (HTML standard)
  'load', 'unload', 'beforeunload', 'resize', 'scroll', 'scrollend',
  // wheel (UI Events spec)
  'wheel',
  // toggle (HTML details / popover)
  'toggle', 'beforetoggle',
  // animation events (CSS Animations spec)
  'animationstart', 'animationend', 'animationiteration', 'animationcancel',
  // transition events (CSS Transitions spec)
  'transitionstart', 'transitionend', 'transitionrun', 'transitioncancel',
  // shadow DOM / fullscreen (DOM + Fullscreen specs)
  'slotchange', 'fullscreenchange', 'fullscreenerror',
]);

/**
 * Rozie-SYNTHETIC runtime event prefixes. Events with these prefixes are
 * dispatched by the Rozie runtime packages themselves (not by the compiled
 * component's `$emit` calls), so they are legitimately ABSENT from any
 * callee's declared emit list and must never trip ROZ998. The one family
 * observed in-tree today: `keynav-` (`keynav-commit` / `keynav-page` /
 * `keynav-active`), dispatched by the r-keynav controller runtime.
 */
export const ROZIE_SYNTHETIC_EVENT_PREFIXES: readonly string[] = ['keynav-'];

/**
 * The single predicate the ROZ998 call site uses: true when the RAW authored
 * event name is a native DOM event (exact lowercase-name lookup) or carries a
 * Rozie-synthetic runtime prefix.
 */
export function isKnownNonEmitEvent(rawEventName: string): boolean {
  if (NATIVE_DOM_EVENTS.has(rawEventName.toLowerCase())) return true;
  return ROZIE_SYNTHETIC_EVENT_PREFIXES.some((prefix) =>
    rawEventName.startsWith(prefix),
  );
}
