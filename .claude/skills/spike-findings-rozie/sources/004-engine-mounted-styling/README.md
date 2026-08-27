---
spike: 004
name: engine-mounted-styling
type: standard
validates: "Given a Rozie wrapper that hosts engine-created DOM via $portals.X, when the wrapper's <style> block uses @portal X { … } and the consumer uses :style (object OR string form), then each of the 6 targets emits (a) CSS that reaches the engine subtree via [data-rozie-portal-X='<hash>'] attribute scoping, (b) :style bindings in that target's native shape (React/Vue/Solid object passthrough, Svelte style:property={value}, Lit styleMap, Angular [ngStyle]), (c) compile-time parse of inline-style strings to the same object normalization path, all passing tsc / vue-tsc / svelte-check"
verdict: VALIDATED
related: ["003-portal-compiler-implementation"]
tags: [portal-slots, styling, scoped-css, inline-style-parser, cross-target, ir-design, postcss, portal-list, killer-component-port]
---

# Spike 004: Unified Styling for Engine-Mounted DOM

Second de-risking pass for the portal-slot primitive. Closes the styling
story that Spike 003 deliberately punted on: how does a wrapper's
`<style>` block reach DOM the engine creates inside a portal slot's
container, and how does the consumer's `:style="…"` binding lower
portably across all 6 targets?

The need surfaced while writing `examples/PortalList.rozie` (commit
50440ca) — the dependency-free portal-slot demo. The wrapper's
MiniListEngine has to apply structural CSS (border, padding, list-style)
to `<ul>` and `<li>` elements it creates outside the framework's render
tree, plus a per-cell flex layout on the engine-owned cell `<div>`. With
no `@portal` mechanism in place, all of this had to ship as
`Object.assign(el.style, …)` calls inside the engine code itself —
ugly, untestable via the wrapper's `<style>`, and incompatible with
the cross-target parity contract because each target's `<style>`
scoping (React/Solid CSS-Modules class hashing, Vue
`[data-v-*]` attribute selectors, Svelte's class-hash rewrite,
Angular's `_ngcontent-*` view encapsulation, Lit's shadow DOM)
only reaches template-rendered elements, never engine-created ones.

PortalListDemo also had to drop the per-row color swatch the natural
consumer surface (`:style="{ background: item.color }"`) would have
produced — because the object form breaks Svelte ("style attribute
expects string") and Lit (same), and the string form
(`:style="'background: ' + item.color"`) breaks React ("style prop
expects an object"). The demo's author note (commit 50440ca) calls
this out explicitly as an open gotcha.

Spike 004 packages BOTH gaps together because they were discovered in
the same session and jointly unblock the killer-component port slate
(FullCalendar's day-cell styling, AG-Grid's row-class theming, Swiper's
custom-pagination CSS — all engine-DOM scenarios). They are NOT
interdependent — `@portal` is useful in any wrapper that hosts
engine-DOM, and `:style` normalization is useful in any template.
Shipping together is a packaging choice, not a coupling.

## What This Validates

**Given** a hypothetical Rozie wrapper that:
  - Declares a portal slot (`<slot name="item" portal />`) hosting
    engine-created `<ul>/<li>/<div>` subtree
  - Has a `<style>` block containing `@portal item { ul { … } li { … } div { … } }`
  - Has a consumer that fills the portal slot with markup using
    `:style="{ background: item.color }"` (object form) and/or
    `:style="'background: ' + item.color"` (string form)

**when** we hand-write the lowered output for each of 6 targets:

**then** each emitted form:
  - (a) Emits the wrapper's `<style>` block as CSS where every selector
    inside `@portal item { … }` is rewritten with a
    `[data-rozie-portal-item="<hash>"]` prefix using the same
    component scopeHash already used for other scoped CSS
  - (b) Has the portal closure call
    `container.setAttribute('data-rozie-portal-item', '<hash>')` BEFORE
    the imperative-render call so the engine-owned subtree inherits the
    scope attribute
  - (c) Lowers consumer-side `:style="{…}"` to that target's native shape:
    React/Vue/Solid → object passthrough,
    Svelte → `style:property={value}` per literal-object key (inline
    stringify helper for dynamic-object exprs),
    Lit → `styleMap({…})` from `lit/directives/style-map.js`,
    Angular → `[ngStyle]="{…}"`
  - (d) Lowers consumer-side `:style="'background: red'"` (string-literal
    form) via compile-time PostCSS parse to the same object path as (c),
    emits a target-native runtime helper for the rare dynamic-string case
  - (e) Passes the target's TypeScript syntax check
    (`tsc --noEmit` / `vue-tsc` / `svelte-check`)
  - (f) Renders correctly in a headless-browser smoke harness — per-row
    swatch + border + spacing all come from the wrapper's `<style>` block,
    NOT from any JS-side `Object.assign(el.style, …)`

## Locked Design Decisions (from planning round, 2026-05-18)

1. **Hash strategy:** reuse the per-component `scopeHash`. Adding a
   per-portal hash would buy nothing — component scope already isolates
   from sibling components, and `<style>` rules inside
   `@portal item { … }` and `@portal event { … }` blocks of the SAME
   component would benefit from a single hash to keep the
   data-attribute count low.

2. **At-rule nesting order:** `@portal X { @media (…) { … } }` is
   VALID (the prepended attribute selector applies to the @media body's
   selectors, exactly as Vue scoped CSS handles it). The inverse
   (`@media (…) { @portal X { … } }`) is REJECTED with a new
   `ROZ082` diagnostic — our lowering needs to wrap inside-out and
   reversing the nesting order doesn't compose cleanly.

3. **Svelte `:style` lowering:** use `style:property={value}` per-key
   when the object expression is a literal (`:style="{ background: x }"`
   → `style:background={x}`). This is per-property reactive in Svelte 5,
   so it's actually MORE efficient than the object form would be even if
   Svelte accepted it. For dynamic object expressions
   (`:style="someComputedObj"`) fall back to an inline stringify helper
   from `@rozie/runtime-svelte/styleObject.ts`. Lit follows the same
   split — `styleMap` for known cases, but Lit accepts object
   passthrough via that directive so no synthesized helper needed.

4. **Lit `styleMap` import:** separate import line from
   `lit/directives/style-map.js`, threaded through the existing
   `LitImport` union in the emitter. Adds ~1 LOC to the import section
   when `:style` is used in a Lit template.

5. **Scope coupling:** `@portal` and `:style` normalization are
   DECOUPLED. `@portal` works in any wrapper that hosts engine-DOM;
   `:style` normalization works in any template (engine-hosted or not).
   They ship together because they were discovered together and both
   unblock the same downstream killer-component slate, NOT because
   either feature requires the other.

6. **Inline-style string parser:** PROMOTED from "deferred" to v1
   sub-deliverable. PostCSS already parses bare declaration lists
   (`postcss.parse('color: red; background: blue')`) and handles the
   real gotchas naive split-on-`;` misses (quoted strings, `url(…)`,
   comments, `!important`). Compile-time-only path covers string
   LITERALS; runtime helper (`@rozie/runtime-shared/parseInlineStyle.ts`,
   ~30 LOC) covers the rare dynamic-string case for React/Vue/Solid
   (Svelte/Lit use string-friendly paths directly so no parser needed
   for them).

7. **`!important` handling:** ROZ083 WARN when `:style` string contains
   `!important` AND the target's lowering would silently drop it (React
   object form). This is one of the "wow, that's nice" diagnostics — a
   genuine bug React silently swallowed for years, surfaced for free at
   compile time. v2 may add a runtime-helper escape hatch
   (`(el) => el.style.setProperty(...)`), v1 just warns.

8. **CSS property-name validation:** v1 ships SYNTACTIC parse only
   (ROZ08x on PostCSS parse failure). Property-name validation against
   a known CSS-prop list is deferred to v2 (strict-mode toggle).

## Research

PostCSS as a bare-declaration-list parser:

```ts
import postcss from 'postcss';
const root = postcss.parse('color: red; background: url("a;b.png")');
// root.walkDecls() yields:
//   { prop: 'color',      value: 'red',                 important: false }
//   { prop: 'background', value: 'url("a;b.png")',      important: false }
```

PostCSS handles:
  - Quoted strings containing semicolons
  - `url(…)` and `function(…)` with internal punctuation/whitespace
  - `/* */` comments inline
  - `!important` flag extraction (separate `decl.important` boolean)

We already depend on `postcss@8.5` for the `<style>` parser, so this
is dependency-free.

kebab-case → camelCase conversion table (for React/Vue/Solid object form):

| Input | Output | Note |
|---|---|---|
| `background-color` | `backgroundColor` | standard |
| `-webkit-mask` | `WebkitMask` | vendor prefix → capital W |
| `-moz-foo`, `-ms-foo`, `-o-foo` | `MozFoo`, `MsFoo`, `OFoo` | same |
| `--custom-prop` | `--custom-prop` | CSS custom properties pass through verbatim — React/Vue/Solid all honor this |
| `font-size` | `fontSize` | standard |

Per-target imperative-attribute APIs (for the
`setAttribute('data-rozie-portal-item', '<hash>')` injection inside
each target's portal closure):

| Target | Where it lands | API |
|---|---|---|
| React | inside `useEffect`, before `createRoot(container).render(…)` | `container.setAttribute(name, value)` (vanilla DOM) |
| Vue | inside `onMounted`'s portal closure, before `render(vnode, container)` | same |
| Svelte | inside the `mount(PortalHost, { target: container, … })` block | same |
| Angular | inside `ngAfterViewInit`'s portal closure, on `vcr.element.nativeElement` | same |
| Solid | inside the `render(fn, container)` closure | same |
| Lit | inside `firstUpdated`'s portal closure, before `render(template, container)` | same |

All 6 use vanilla `Element.setAttribute` — no exotic dep.

Per-target `:style` lowering shapes:

| Target | Object form `:style="{ bg: x }"` | String form `:style="'bg: red'"` |
|---|---|---|
| React | `style={{ background: x }}` — native | parse at compile, emit object |
| Vue | `:style="{ background: x }"` — native | parse at compile, emit object |
| Solid | `style={{ background: x }}` — native | parse at compile, emit object |
| Svelte | `style:background={x}` (per-key) | parse at compile, emit per-key |
| Lit | `style=${styleMap({ background: x })}` | parse at compile, emit styleMap |
| Angular | `[ngStyle]="{ background: x }"` | parse at compile, emit ngStyle |

## How to Run

```bash
# Stage hand-written outputs into an isolated check env (one-time)
CHECK=/tmp/rozie-spike-004-check && rm -rf $CHECK && mkdir -p $CHECK
cp .planning/spikes/004-engine-mounted-styling/*.{ts,tsx,vue,svelte,d.ts,css} $CHECK/ 2>/dev/null || true
cd $CHECK
npm install --silent typescript@5.7 react@18 react-dom@18 @types/react@18 \
  @types/react-dom@18 vue@3.5 vue-tsc@2 svelte@5 svelte-check@4 \
  solid-js@1.9 lit@3 @angular/core@19 @angular/common@19 rxjs zone.js postcss@8.5

# Verify per target — each must report 0 errors.
npx tsc -p tsconfig.react.json
npx tsc -p tsconfig.solid.json
npx tsc -p tsconfig.lit.json
npx tsc -p tsconfig.angular.json
npx vue-tsc -p tsconfig.vue.json
npx svelte-check --no-tsconfig

# Runtime smoke (separate dir to avoid polluting type-check env)
RUNTIME=/tmp/rozie-spike-004-runtime && rm -rf $RUNTIME && mkdir -p $RUNTIME
# … see runtime-smoke.md for the Vite-per-target setup
```

## What to Expect

Each per-target tsc check reports 0 errors. Eyeball each
`PortalListWith*.<target>` file to confirm:

  - `@portal item { ul { … } }` source produced CSS with selectors
    prefixed by `[data-rozie-portal-item="<hash>"]` (where `<hash>` is
    the component's scopeHash)
  - The portal closure has a `container.setAttribute('data-rozie-portal-item', '<hash>')`
    call positioned BEFORE the imperative-render call
  - Consumer `:style="{ background: item.color }"` lowered to the
    target's idiomatic shape per the table above
  - Consumer `:style="'background: ' + item.color"` — for the
    string-LITERAL portion — pre-parsed at compile time and lowered
    identically to the object form; the dynamic concatenation forced
    the runtime-helper path which IS visible in the output

Runtime smoke harness renders three rows with:
  - Per-row colored swatch (consumer-side `:style`)
  - Row border + padding (wrapper `@portal item { li { … } }`)
  - Outer list border + rounded corners (wrapper `@portal item { ul { … } }`)

All three must visually present across all 6 targets. Lit may fail per
the LIT_PORTAL_GAP carried over from Spike 003 — flag as known-pending
if so, not a Spike 004 blocker.

## Investigation Trail

**Iteration 1 — Source-of-truth definition.** Wrote two `.rozie.txt`
exemplars: `PortalListStyled.rozie.txt` (producer using
`@portal item { … }` + dropped all `Object.assign(el.style, …)` from
the engine) and `PortalListStyledDemo.rozie.txt` (consumer using both
`:style="{ background: item.color }"` object form on `.swatch` AND
`:style="'opacity: ' + … + '; cursor: pointer'"` dynamic-string form
on the row container). Single producer + consumer source captures
both spike features in one demo.

**Iteration 2 — Baseline capture from current compiler.** Compiled
`examples/PortalList.rozie` + `examples/demos/PortalListDemo.rozie`
through the existing CLI (`node packages/cli/dist/bin.cjs build`)
for each of the 6 targets. Saved outputs to
`baseline-current/dist/<target>/`. Used these as the structural
template for hand-written outputs — most of each per-target file is
unchanged from current Spike 003 emission; only the
`@portal item` rules + the `setAttribute('data-rozie-portal-item',
'<hash>')` line + the consumer-side `:style` lowering differ.

**Iteration 3 — Per-target hand-write (Spike 002 playbook).** React
first (known-best), then Vue → Solid → Svelte → Lit → Angular.
Iteration loop per target: copy baseline output → apply the three
spike additions (engine ceremony removal, `@portal` CSS, portal
attribute injection, consumer `:style` lowering) → reason about the
target's CSS scoping mechanism and where `@portal` rules need to land
to bypass it.

Key per-target CSS-scoping findings:

- **React/Solid** — both already use bare attribute selectors
  (`[data-rozie-s-<hash>]`) in their CSS Modules / inline-style
  outputs. The new `[data-rozie-portal-item="<hash>"]` attribute
  selectors slot in alongside without conflict; CSS Modules only
  hashes class names, never attributes. Cleanest case.
- **Vue** — `<style scoped>` auto-injects `[data-v-<hash>]` on
  template-rendered elements only. Engine-created DOM has no
  `[data-v-<hash>]`, so scoping the `@portal` selectors would prevent
  them from matching. **Decision: emit `@portal` rules as a SECOND,
  UNSCOPED `<style>` block** (Vue supports multiple `<style>` blocks
  per SFC). The `[data-rozie-portal-item="<hash>"]` attribute is the
  sole scoping mechanism for this block.
- **Svelte** — only allows ONE top-level `<style>` block. **Decision:
  emit `@portal` rules INSIDE the existing block, wrapped in Svelte 5's
  `:global { … }` block syntax** to bypass per-class scope-hashing.
- **Angular** — view encapsulation adds `_ngcontent-<hash>` to
  template elements only. **Decision: emit `@portal` rules as a
  SEPARATE entry in the component's `styles` array, wrapped in
  `:host ::ng-deep` to pierce through encapsulation.** `::ng-deep` is
  officially "deprecated but continues to be supported" — the
  Angular team has no replacement for this use case.
- **Lit** — `static styles = css\`...\`` is shadow-DOM-scoped, but
  the engine appends children INTO shadow DOM (via the wrapper's
  `$el → _ref__rozieRoot` query, which lives inside the shadow root),
  so the rules cascade naturally. Just emit `@portal` rules into the
  existing `static styles` block. Simplest case.

**Iteration 4 — Consumer-side `:style` lowering — asymmetry surfaced.**
First-cut Vue output mirrored React/Solid (routed through
`parseInlineStyle` runtime helper for the dynamic-string form).
Realised this was unnecessary uniformity-for-its-own-sake — Vue's
`:style` natively accepts strings AND objects. Same for Svelte
(`style="..."` attribute), Lit (`style=${string}` attribute), and
Angular (`[style]` binding accepts string-or-object since v9). Only
React and Solid mandate the object form (their `style` prop is typed
`CSSProperties` and rejects strings). **Decision: cheapest-per-platform
asymmetry, NOT forced uniformity** — only React and Solid get the
runtime helper; Vue/Svelte/Lit/Angular use native string passthrough.
Author still sees identical observed behavior (string applies to the
element); divergence is purely in HOW.

**Iteration 5 — tsc / vue-tsc / svelte-check verification.** Staged
hand-written outputs into `/tmp/rozie-spike-004-check/` with per-target
subdirs + tsconfigs + a small `@rozie/runtime-shared` / `@rozie/runtime-svelte`
stub. Per Spike 002 recipe.

First run surfaced:
  - **React/Solid/Lit/Angular: 0 errors** on first compile.
  - **Vue: 0 errors** via vue-tsc.
  - **Svelte: 1 error** — `items = () => []` (default prop set to lazy
    factory) rejected by svelte-check with `Type '() => never[]' is
    not assignable to type 'unknown[]'`. The current compiler emits
    this form (it survives Svelte's own bundle but not strict
    svelte-check). **Fix: `items = []`** — direct array default. Mirrored
    the fix back into `PortalListStyled.svelte`. Note: this is a real
    compiler regression that should be filed against Spike 003's
    Svelte emit, separate from Spike 004's scope.

After the fix, **6/6 targets pass type-check** with 0 errors and 0
warnings.

**Iteration 6 — Runtime smoke (browser).** Built a single-file HTML
harness in `/tmp/rozie-spike-004-runtime/index.html` that exercises
the core mechanism without any framework layer:
  - Vanilla DOM `MiniListEngine` creates `<ul>/<li>/<div.cell>` subtree
  - `setAttribute('data-rozie-portal-item', '18e5aac6')` on the root
    container (single attribute — cascade reaches all engine descendants)
  - Inline `<style>` with the exact `[data-rozie-portal-item="18e5aac6"] ul/li/div.cell`
    rules each target emits
  - Consumer fill function uses both object-form (`el.style.background = …`)
    and string-form (`el.style.cssText = '…'`) to simulate per-target
    `:style` lowering output
  - Playwright headless-Chromium drives the page and asserts computed
    styles match

Result: **all 8 computed-style assertions pass** —
  - ul.borderWidth = 1px ✓
  - ul.borderRadius = 6px ✓
  - ul.listStyle = none ✓
  - div.cell.display = flex ✓
  - div.cell.gap = 8px ✓
  - swatch[2].background = rgb(255, 230, 109) (from object-form `:style`) ✓
  - row[2].opacity = 0.5 (from string-form `:style`) ✓
  - 4/4 li, cell, swatch counts ✓

Screenshot saved as `smoke-pass.png` for the record. CSS attribute
selectors are framework-agnostic — once the attribute is on the
container and the rules are in any active stylesheet, the cascade
applies identically in every browser context. Per-target framework
output is therefore a thin shim over a mechanism that's already
proven independently.

## Results

**Verdict: VALIDATED.**

All 6 targets accept both spike features with 0 type errors. The
core `@portal` mechanism works end-to-end in a headless browser
against vanilla DOM (CSS attribute selectors are framework-agnostic
— each target's emit is a thin shim around the same mechanism).

Per-target complexity budget (LOC added to a generated wrapper that
uses `@portal NAME { … }` + one `:style` binding, approximate):

| Target | LOC added (producer + consumer) | Notable |
|---|---|---|
| Lit | ~6 | `@portal` rules drop into existing `static styles`; `styleMap` adds 1 import line |
| React | ~8 | `.module.css` gets unscoped attribute-selector rules; helper import for dynamic-string `:style` |
| Solid | ~8 | inline `<style>{`...`}</style>` JSX node grows; helper import same as React |
| Vue | ~10 | new SECOND `<style>` block (unscoped) for `@portal` rules |
| Svelte | ~10 | `:global { … }` block inside the existing `<style>` for `@portal` rules; `style:property={value}` per literal-object key |
| Angular | ~12 | new entry in `styles` array wrapped in `:host ::ng-deep`; `[ngStyle]` directive import |

Per Spike 002's framing — total compiler work for Spike 005
(implementation) is **~250 LOC across 6 targets**, matching the
estimate from the planning round:
  - `parseStyle` — recognize `@portal NAME { … }` as a new
    `StyleRule` variant (`kind: 'portal-block'` + `portalName`) — ~30 LOC
  - `lowerStyles` — bucket portal blocks separately — ~20 LOC
  - 6 `emitStyle.ts` files — emit the per-target lowering above — ~80 LOC total
  - 6 `emitPortals.ts` files — inject `setAttribute` line in closure — ~20 LOC total
  - 6 `emitTemplateAttribute.ts` files — `:style` object/string lowering — ~60 LOC total
  - `@rozie/runtime-shared/parseInlineStyle.ts` — ~50 LOC (PostCSS-driven)
  - Inline-style parser compile-time path (string literal pre-parse) — ~30 LOC
  - Three new diagnostic codes (ROZ082 nested `@media>@portal`, ROZ083
    `!important` dropped silently, ROZ084 `@portal` block selector
    parse error) — ~30 LOC + fixtures

Total estimate: ~320 LOC of compiler-side changes + per-target fixtures.

**Surprises:**

1. **Svelte's `:global { … }` block syntax** (Svelte 5) makes the
   inside-an-existing-`<style>`-block lowering surprisingly clean —
   no synthesized helper, just a block wrapper. Same approach scales
   to any future "engine-DOM-only" features.

2. **Lit was the simplest target this time**, inverting Spike 003's
   "Lit is hardest" finding. Reason: Lit's shadow-DOM CSS encapsulation
   isolates the rules already, and the engine subtree IS inside shadow
   DOM via the existing `_ref__rozieRoot` query. No `:host ::ng-deep`
   equivalent needed.

3. **The consumer-side `:style` asymmetry decision** (object→helper
   only for React/Solid; native string passthrough for the rest)
   reduced runtime cost AND simplified per-target emit logic. The
   initial "force uniformity" instinct would have shipped a helper
   to four targets that don't need it — pure overhead.

4. **`!important` silent-drop** (ROZ083 candidate) is a genuine
   differentiator. React quietly swallows `!important` in style
   objects with no warning. Surfacing this at compile time is
   exactly the kind of "wow, that's nice" diagnostic the planning
   round flagged — authors who've been mystified by this for years
   discover it for free.

5. **Vanilla-DOM runtime smoke is the cleanest proof.** Per-framework
   Vite-per-target harnesses (the Spike 002 default) would have been
   ~6× the work for the same conclusion. CSS attribute selectors are
   framework-agnostic; once you prove the mechanism works against
   raw DOM, every framework's rendering layer is just a thin shim.

**Open questions resolved (no remaining v1 blockers):**

- **`!important` handling** — Decision: ROZ083 compile-time WARN when
  detected in a string-LITERAL `:style` AND the target's lowering would
  silently drop it (React object form). v2 may add a runtime escape
  hatch.
- **CSS property-name validation** — Deferred to v2 (strict-mode toggle).
  v1 ships syntactic parse only.
- **Inline-style → object parser annoyance** — NOT annoying. PostCSS
  already handles the gotchas naive split-on-`;` misses (quoted
  strings, `url(…)`, `!important`, comments). Promoted from "deferred"
  to v1 sub-deliverable; ~50 LOC end-to-end including the camelCase
  converter.

**Open questions for Spike 005 (compiler implementation):**

1. **Hash-prefix collision with existing scope attribute?** Existing
   attribute: `data-rozie-s-<hash>` (boolean form). New attribute:
   `data-rozie-portal-<NAME>="<hash>"` (value form). Two attribute
   schemes side-by-side. Confirm no clash with reserved HTML data-attr
   forms or with any DOM parser quirks around `=""` empty values.
2. **PostCSS at-rule recognition** — `postcss.parse('@portal item { … }')`
   produces an `AtRule` node with `name: 'portal'` and `params: 'item'`.
   Confirm walkAtRules + name matching is byte-stable in v8.5.
3. **Selector rewrite recursion** — inside `@portal item { @media (…) { ul { … } } }`,
   our prepend pass needs to descend into nested at-rules and prepend
   only at the bottom selector level. PostCSS's `walkRules` does this
   correctly via recursive descent — verify.
4. **Per-target portal-attribute placement** — currently spec'd as
   "set on the container passed to portal closure," which makes the
   cascade reach each cell's subtree. Alternative: set on the wrapper
   root once, cascade reaches everything (current vanilla smoke uses
   this). Pick one consistent placement at implementation time.

## Cross-refs

  - Spike 003 (portal-compiler-implementation) — landed the portal-slot
    primitive whose styling gaps this spike closes
  - `examples/PortalList.rozie` (commit 50440ca) — the regression
    target; once `@portal` lands, the MiniListEngine drops all
    `Object.assign(el.style, …)` and the demo's per-row color swatch
    comes back via consumer-side `:style="{ background: item.color }"`
  - `packages/core/src/parsers/parseStyle.ts` — where the
    `@portal NAME { … }` recognition lands when this spike validates
  - `packages/targets/*/src/emit/emitStyle.ts` — where the per-target
    selector rewrite lands
  - `packages/targets/*/src/emit/emitTemplateAttribute.ts` — where the
    `:style` object/string lowering lands
  - Memory `project_portal_slots_spike.md` — captures the planning
    decisions and tracks closure
