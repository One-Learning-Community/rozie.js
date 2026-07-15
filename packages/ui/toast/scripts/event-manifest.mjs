/**
 * Hand-kept event-description manifest for @rozie-ui/toast.
 *
 * `dismissed` is the family's FIRST event (command-palette event-manifest
 * precedent): every dismissal — the `dismiss(id)` verb ('api'), the built-in
 * close button ('close'), a timer expiry ('timeout'), or a swipe past
 * threshold ('swipe') — routes through the single `dismissBegin(id, reason)`
 * funnel and fires `dismissed` exactly once, BEFORE the exit animation runs.
 * `clear()` stays bulk and fires nothing.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every
 * emitted event name has an entry here and throws if one is missing.
 */
export const eventManifest = {
  dismissed:
    "Fired exactly once per toast, at dismissal initiation (before the exit animation runs). Payload is ONE object `{ toast, reason }` — `toast` is the full queue entry, `reason` is `'timeout'` (auto-dismiss), `'swipe'` (pointer swipe past threshold), `'close'` (the built-in close button), or `'api'` (the `dismiss(id)` verb). `clear()` removes every toast immediately and does NOT fire `dismissed` (documented bulk behavior).",
};

export default eventManifest;
