---
"@rozie/core": patch
"@rozie-ui/chartjs": patch
"@rozie-ui/codemirror": patch
"@rozie-ui/fullcalendar": patch
"@rozie-ui/maplibre": patch
"@rozie-ui/rete": patch
"@rozie-ui/tiptap": patch
---

On React, Angular, and Lit, the synthesized `$portals` closure now lives at COMPONENT scope
(React: the hook section; Angular/Lit: a private class field) instead of being declared
inside the mount-phase lifecycle hook body. Vue, Svelte, and Solid already did the right
thing and are unaffected in shape (Vue/Svelte additionally now declare the closure BEFORE
the user script, matching Solid, closing a secondary TDZ hazard for a top-level invocation).

This closes a silent parity bug: a `<script>` top-level helper reading `$portals.<name>`
previously compiled on three targets and failed on the other three — `TS2304 Cannot find
name 'portals'` on the bundled-leaf strict typecheck, `ReferenceError: portals is not
defined` at runtime, with zero diagnostics. Three failure shapes are fixed:

1. A top-level helper reading `$portals.<name>`, called from `$onMount`.
2. A top-level helper reading `$portals.<name>`, with NO `$onMount` at all — previously
   the whole closure was emitted NOWHERE on React (it was attached unconditionally to the
   first mount-phase hook; no hook meant it was silently dropped).
3. A `$portals.<name>` read from a `$watch` body — broken on all three targets, and the
   shape driving most of the corpus workarounds this closes the door on.

React additionally synthesizes a dispose-only effect (`[]` deps) for a component that has
portals but no mount-phase lifecycle hook at all, so portal roots still bulk-dispose on
unmount in that shape. Angular and Lit now lower `$portals.<name>` to a `this.`-qualified
member read (the closure is a class field, not a same-method-only `const`); the
reactive-handle `interface ReactivePortalHandle` moved to module scope on both (a TS
`interface` cannot live inside a class body).

A new diagnostic, ROZ149, now flags a `$portals.<name>` reference genuinely evaluated
during setup/render — `<script>` Program top level, a `$computed` body, a `$watch` GETTER,
or a template binding/directive/`r-for`-iterable/interpolation — since the portal anchor
does not exist yet at those positions on any target, even after this fix. It does NOT fire
on an ordinary function/arrow body (the shape this fix makes correct), `$onMount` /
`$onUnmount` / `$onUpdate` bodies, a `$watch` CALLBACK, or event handlers.

`.rozie` authors do not need to change anything for code that already calls `$portals` from
inside `$onMount` — a hook-scope const / class field is visible from the method that used to
declare it, so nothing that compiled before stops compiling. Emitted output is NOT
byte-identical for any component with a portal slot — the closure text moves and, on
Angular/Lit, gains a `this.` qualifier — so `@rozie-ui/chartjs`, `@rozie-ui/codemirror`,
`@rozie-ui/fullcalendar`, `@rozie-ui/maplibre`, and `@rozie-ui/rete` (the shipped leaf
packages whose `.rozie` sources declare a portal slot) take a patch bump alongside
`@rozie/core`.

The workaround bridges those five packages carry to route `$portals` calls into mount scope
(null-let bridges, a "must not be called before mount" invariant, a relocated code block)
are now unnecessary and can be unwound at leisure as an independent, opt-in follow-up — not
part of this change.
