---
"@rozie/core": patch
---

Angular and Lit lowered a component-state write to `this.<name>` inside a non-arrow member
of an object literal, where `this` is the OBJECT and not the component — so the write landed
on the object, the component never updated, and nothing was reported. Silent, zero-diagnostic,
and only on the two class targets; React/Vue/Svelte/Solid close over the binding instead and
were always correct.

`redirectNestedThis` exists precisely to repair every emitter-injected `this` that would
rebind, redirecting it to a `const __rozieSelf = this;` alias. Its guard returned early for
any top-level non-arrow function, on the reasoning that a top-level function is a promoted
class method whose `this` is the component. That reasoning does not hold for an object-literal
member: a top-level `const api = { load() { … } }` is promoted to a class FIELD, so `api`'s
members have no function parent and read as top-level, yet their `this` is `api`.

The gap covers every non-arrow object member — method shorthand, getter/setter, and a
function-expression property — with or without a nested callback. The arrow-property form was
always correct, and is the reason the fix works: an arrow member of a class-field initializer
already resolves `this` to the instance, because a field initializer's `this` is the instance
and an arrow inherits it.

Two changes, applied to both byte-identical target mirrors. Detection now treats
object-literal membership as a non-component-`this` context. For the host, when the outermost
enclosing function is itself an object member there is no function to hold the alias, so the
field initializer is wrapped in an arrow IIFE that carries it —
`api = (() => { const __rozieSelf = this; return { … }; })();`. An object nested inside a
function keeps using the existing function host and emits no IIFE. The IIFE was chosen over
rewriting methods into arrow properties because it preserves the object's own method
semantics and is the one mechanism that also covers getters and setters, which cannot be
arrow-converted at all.

`$provide(...)` payloads are excluded. `emitContext.bindProvidedValue` already owns that
seam: it wraps the payload in a host-capturing IIFE, rewrites every `ThisExpression` to a
`__rozieCtxHost` parameter, and keys its reactivity bridge on finding those `ThisExpression`s.
Because `redirectNestedThis` runs earlier, an unguarded fix consumed that `this` first and the
entire reactive `effect(...)` bridge disappeared from every emitted provider — caught by
Lit's existing context test and now locked by a dedicated case in both targets' fixtures.

No emitted output changes. A scan of all 218 emitted Angular and Lit files in this repo found
3497 object literals and 60 non-arrow object member functions, none of which contained a
`this` — so the shape was latent and the whole-repo rebuild produced zero drift, with
dist-parity 1049/1049. This closes an authorable correctness hole rather than a shipped
defect, and no `@rozie-ui` leaf needs regenerating.
