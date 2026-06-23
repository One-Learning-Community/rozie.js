/**
 * Hand-kept event-description manifest for @rozie-ui/toast.
 *
 * Toaster emits NOTHING — the imperative `show / dismiss / clear` handle replaces
 * events entirely, and a per-toast close button calls the internal `dismiss`. So
 * `ir.emits` is empty and this map is empty. It is kept (and exported) only so
 * codegen.mjs / surface.test.ts can read a uniform shape; the README renderer
 * skips the Events section when `ir.emits` is empty.
 *
 * KEYS (none) MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every
 * emitted event name has an entry here and throws if one is missing.
 */
export const eventManifest = {};

export default eventManifest;
