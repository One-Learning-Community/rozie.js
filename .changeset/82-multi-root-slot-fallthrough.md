---
"@rozie/core": minor
---

A template of exactly one real HTML element plus N `<slot>` invocations now auto-inherits consumer
`class`/`style`/attributes/listeners onto that element, instead of being rejected outright as
multi-root. Before this release, a component shaped like:

```
<div class="widget">
  <slot name="header" />
  {{ label }}
  <slot />
</div>
```

hard-errored (`ROZ970`/`ROZ973`) the moment it carried default `inherit-attrs`/`inherit-listeners`
flags. The only way to ship it was the documented per-component opt-out
(`inherit-attrs="false" inherit-listeners="false"`) plus a hand-written `r-bind="$attrs"` /
`r-on="$listeners"` spread onto the intended element — and in practice several shipped components
took the opt-out and never wrote the spread, so consumer `class`/`style` silently reached nothing.
That shape now compiles cleanly with the spread synthesized automatically, with zero per-component
hand-written spread required.

**The behavior is order-independent** — a `<slot>` sibling before or after the real element
resolves to the same single-root classification and the same target element.

**What did NOT change:**

- **Two real element roots still hard-error.** `<div /><span />` is still rejected outright — this
  release only widens the "one real element" case to tolerate slot siblings, it does not change
  root-arity rules.
- **One element plus a non-slot structural sibling still hard-errors as before**, EXCEPT for the
  new diagnosed-but-deferred case below (a conditional/loop-gated single root).
- **A component-tag root is still out of scope.** `<MyOtherComponent />` as the sole top-level node
  is unaffected by this change.
- **The documented opt-out still works exactly as documented.** `inherit-attrs="false"
  inherit-listeners="false"` still suppresses the synthesized spread; nothing about how the opt-out
  itself behaves changed.

**Two new warning-severity diagnostics**, consuming the last two codes in the reserved
`ROZ090`..`ROZ099` band:

- **`ROZ098`** (attrs) and **`ROZ099`** (listeners) — `inheritAttrs`/`inheritListeners` are `true`
  (or unset) and the template's single structural root is a conditional (`r-if`/`r-match`) or loop
  (`r-for`), so there is no single element the synthesized spread can land on. Previously this shape
  silently dropped the consumer's attrs/listeners with zero signal. It is now diagnosed at
  warning severity instead of erroring, because the shape is common and often intentional — but
  **the underlying drop is NOT yet repaired.** The branch-descent fix (pushing the spread onto
  every branch of the conditional, or onto the loop's mapped root) is deliberately deferred to a
  future phase. Two remedies are available today: apply the documented `inherit-attrs="false"
  inherit-listeners="false"` opt-out to silence the warning once you've confirmed the drop is
  intentional, or restructure the template so the gate lives *inside* a single wrapping element
  instead of being the root itself.
- **The `ROZ090`..`ROZ099` reserved band is now fully consumed.** The next Phase-1-owned diagnostic
  code starts a new allocation outside this block.

**Twelve published per-framework packages regenerated:** `@rozie-ui/rete-{vue,react,svelte,solid,
angular,lit}` and `@rozie-ui/maplibre-{vue,react,svelte,solid,angular,lit}` now forward consumer
`class`/`style`/attrs/listeners onto `FlowCanvas`'s and `MapLibre`'s real root element — confirmed
via a live-DOM render on all six targets: the consumer class merges alongside the component's own
class (not a replacement), and a consumer custom property resolves on the root. `packages/ui/rete`
and `packages/ui/maplibre` (the two family root packages) are private workspace packages, never
published on their own; `@rozie/core`'s emitters are what's inlined into every public entry point
that compiles `.rozie` source (this CLI, the unplugin build-tool adapter, and the Babel plugin).

**`NodeType` (the `rete` family's node-type-template child) explicitly kept its opt-out.** Its only
real element is a `.rozie-node-type-children` container that is permanently `display:none` / 0×0 —
it exists solely so nested renderless `<Port>` children mount, never paints, and never receives
pointer/keyboard interaction. Forwarding consumer `class`/`style`/listeners onto it would be a
silent no-op (`class`/`style` land on an invisible element; listeners never fire), the same
rationale `Port`'s existing opt-out already documents for its own renderless shape. `NodeType`
carries `inherit-attrs="false" inherit-listeners="false"` again, verified via a live-DOM check
across all six targets confirming the container is still 0×0/hidden and nested `Port` sockets still
register correctly.
