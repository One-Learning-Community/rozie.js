---
"@rozie/core": patch
---

Eleven emitter/diagnostic fixes across five targets, closing a cluster of cross-target
correctness gaps found while hardening `@rozie-ui/data-table` for its own release (the N-01
through N-05 series) plus two standalone emitter-scope bugs found elsewhere.

**React — N-01: a merged same-event handler now sees the fresh model value.** When `r-model`
and a colliding same-event `@handler` (e.g. `r-model` plus `@change` on the same element) are
folded into one arrow function, the folded-in handler previously read the React `useState`
render const from BEFORE the model write landed — `setState` is async, so the other five
targets (which read a signal/ref) saw the new value while React saw the stale one. The emitter
now shadows the stale render const with a `const <local> = <committed>;` declaration inside the
merged arrow, so every statement after the model write sees the value that was just written.
Emitter-only; no author-visible change unless you rely on the emitted output directly.

**Vue — N-03: the `inherit-attrs`/`inherit-listeners` opt-out now actually opts out.**
`inheritAttrs: false` is now correctly emitted via `defineOptions({ inheritAttrs: false })` when
a component declares the opt-out. Previously the opt-out was silently inert on the Vue target —
undeclared attributes and listeners kept falling through to the wrapper element regardless.
**BEHAVIOUR CHANGE for Vue consumers of any component that declares this opt-out:** a component
that already sets it now genuinely stops Vue's attribute/listener fallthrough onto its wrapper
element — matching what the other five targets have always done. If you were relying on the
old (buggy) fallthrough-despite-opt-out behavior on Vue specifically, you will see a difference.
Every published leaf that declares the opt-out ships this change as part of its own release note
in this same wave (`@rozie-ui/chartjs-vue`, `@rozie-ui/codemirror-vue`, `@rozie-ui/data-table-vue`,
`@rozie-ui/fullcalendar-vue`, `@rozie-ui/rete-vue`, `@rozie-ui/tiptap-vue`).

**Vue — a ternary of two non-nullish branches is no longer wrapped in `?? undefined`.** The Vue
emitter wraps a gated nullable DOM-attribute binding as `(expr) ?? undefined` and exempts shapes
TypeScript proves can never be nullish (wrapping those trips `TS2869`, "unreachable right
operand"). Every conditional expression was previously excluded from that exemption, so
`c ? 'true' : 'false'` — which can never be nullish — still failed typecheck. A ternary is now
exempt only when both of its branches are provably non-nullish; a branch normalized to
`: undefined` still wraps as before.

**Angular — `<data>` initializers reading `$props`/`$model` are now `this.`-qualified.** A
`<data>` initializer is class-field position, not template position; it now routes through the
same expression rewriter used elsewhere with `this.`-prefixing enabled, so `$props.value` /
`$data.a` / `$model.open` correctly lower to `this.value()` / `this.a()` / `this.open()` instead
of leaking the bare (undefined) identifier — previously a `TS2304` compile error plus a runtime
`ReferenceError` had it actually run. All six targets also now recognize `$model` (not just
`$props`) in this position; a `$model.X` initializer previously slipped past the gate entirely.
Vue additionally now renders the initializer in *script* context rather than template context,
avoiding a latent ref-aliasing bug (`ref(existingRef)` returns the same ref, so a template-context
render was silently aliasing state rather than copying it).

**New diagnostic — ROZ150.** A new warning fires when top-level (`Program`-level, outside any
function) `<script>` code reads `$props.<x>` or `$model.<x>` in setup-once code — a shape that
is correct on some targets (Angular constructor / class field reads the input's default once)
but silently stale on others. Diagnostic only; no codegen behavior changes as a result of this
warning. Extended to also cover a `<data>` initializer reading `$props`/`$model` (a class-field
position on Angular/Lit, subject to the same staleness).

**Lit — a computed object key that references a component-scope name is now rewritten in two
more shapes.** `{ [X]: 1 }` (an object literal) and `const { [X]: v } = o` (a destructuring
pattern) both previously left a component-scope identifier used as a *computed key* bare in the
emitted class body, throwing `"X is not defined"` at runtime — the key is an expression, not a
binding, and two separate guards were walking past it into binding-position logic. Both shapes
are now correctly rewritten to `this.X`. Angular carries an identical (intentionally
byte-mirrored) fix for the same destructuring-computed-key gap in its own class emitter.

**Solid — a valueless boolean HTML attribute now lowers to `={true}`, not `=""`.** A bare
attribute (`<input disabled>`) collapses in the IR to a static binding with an empty string
value; the Solid target rendered that as the literal string `disabled=""`, which fails Solid's
strict boolean-typed JSX props (`TS2322`). It now emits the JSX boolean form (`disabled={true}`)
for any attribute name in the shared boolean-HTML-attribute allowlist, matching what React/Vue/
Svelte already did for this shape.

**Solid — a scoped slot fill now reads its scope lazily instead of destructuring it.** A
producer that calls a scoped slot inside a tracked JSX expression (passing a getter-backed
context object) was met with a consumer emit of `slotName={({ a, b }) => …}` — destructuring
reads every getter immediately, inside the producer's own tracking scope, so any unrelated
scope change re-ran the producer's expression and tore down the entire fill (lost focus, reset
child component state). The fill now binds the context object itself and rewrites every
scope-param read to a property access on it (`_rozieSlot.a`), tracked by whichever fine-grained
computation actually reads it. Covers nested fills, reactive vs. mount-once portals, `r-for`
aliases and expression-local shadowing, shorthand destructuring (`{ label }`), dynamic slot
names, and dynamic-record keys.

**Lit + Angular — a bound `<select>`'s value now survives its own not-yet-rendered
`<option>`s.** Both targets apply an element's own bindings before creating that element's
dynamic children, so a `<select>` with a value-bound property/attribute had that value applied
to an *empty* `<select>` — the browser rejects it and falls back to index 0, silently showing
(and letting the user commit) the wrong option. Fixed by additionally binding `selected` on each
`<option>` against the select's own value expression, which is correct the moment each option is
created and needs no ordering guarantee. React/Vue/Svelte/Solid were already unaffected. An
explicit author `:selected` still always wins.

Every fix above is emitter-scoped; per-fix blast radius on the shipped `@rozie-ui` corpus was
measured individually (mostly zero — no shipped `.rozie`/`.rzts`/`.rzjs` source hits several of
these shapes today) and the leaves that DO carry regenerated output as a result ship their own
changeset in this same release (`@rozie-ui/data-table-*` for the `<select>`/N-05-adjacent fixes,
`@rozie-ui/tiptap-*`/`@rozie-ui/combobox-*` etc. where applicable).
