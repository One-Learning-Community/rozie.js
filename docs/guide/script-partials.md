# Script partials (`.rzts` / `.rzjs`)

As a component grows, its `<script>` block can become the longest part of the file. **Script
partials** let you split that logic into smaller, focused files — without changing a single
byte of the code Rozie emits for any target.

A script partial is a standalone `.rzts` (TypeScript) or `.rzjs` (JavaScript) file that holds a
slice of a component's `<script>` body. The host component imports it like an ordinary module;
at compile time Rozie inlines the imported declarations back into the component before any
target-specific lowering runs.

## The guarantee: decomposition is a provable no-op

This is the property that makes partials safe to adopt: **moving code into a partial produces
byte-for-byte identical output for React, Vue, Svelte, Angular, Solid, and Lit.** Whether your
logic lives inline or in twelve partials, the compiled package you ship is character-for-character
the same.

That means a refactor that splits a component into partials shows **zero diff** in the generated
code — reviewers see only the source reorganization, never churn in the emitted artifacts. The
compiler enforces this with a strict cross-target byte-identity test suite, so the guarantee can't
silently regress.

> Rozie's own `@rozie-ui/data-table` is decomposed into 20 partials this way — its `<script>`
> shrank from ~3,100 lines to ~570 — and every target's published package is byte-identical to
> the pre-decomposition build.

## Anatomy of a partial

A partial is just the verbatim run of declarations you lifted out, followed by an `export` list
naming what the host (or another partial) needs:

```ts
// stateChangeCallbacks.rzts
const onSortingChangeCb = (updater) => { writeSorting(applyUpdater(updater, currentState().sorting)) }
const onColumnSizingInfoChangeCb = (updater) => {
  const next = applyUpdater(updater, $data.columnSizingInfo)
  $data.columnSizingInfo = next != null ? next : $data.columnSizingInfo
}

export { onSortingChangeCb, onColumnSizingInfoChangeCb }
```

The host component imports it from its `<script>`:

```html
<script lang="ts">
import { onSortingChangeCb, onColumnSizingInfoChangeCb } from './stateChangeCallbacks.rzts'
// ...the rest of the component logic
</script>
```

Notice what the partial is **not**: there are no `<script>` tags, no block wrappers — it is plain
TS/JS source. All the usual Rozie sigils (`$data`, `$props`, `$computed`, `$expose`, `$onMount`,
`$inject`, …) and directives work exactly as they do inline; a partial is conceptually a region of
the host's script that happens to live in another file.

## How inlining works

When the compiler resolves a `.rzts` / `.rzjs` import, it:

- **Tree-shakes** — only the transitive closure of the names you actually import is spliced in; an
  unused export in the partial contributes nothing to the output.
- **Hoists the partial's own imports** into the host's import region and **de-duplicates** them by
  source + import kind + local name, so two partials importing `lodash` don't emit it twice.
- **Inlines recursively** — a partial may import another partial. A diamond (two partials importing
  the same third) inlines that third exactly once.
- **Preserves source positions** — spliced declarations keep their original location, so type
  errors and source maps point back to the `.rzts` file, not the host.

Two compile-time guards keep decomposition honest:

| Diagnostic | Cause |
| --- | --- |
| **ROZ139** | A partial declaration's name collides with a host binding or an already-inlined partial. |
| **ROZ140** | An import cycle between partials (`a.rzts` → `b.rzts` → `a.rzts`). |

## Conventions for clean decomposition

- **Keep module-level `let`s in the host.** Reassigned module state (the shared mutable bindings
  the component writes back to) stays in the host `<script>`; partials hold the pure declarations
  and functions that close over it. Splitting a shared `let` across files changes nothing at runtime
  but muddies ownership.
- **Don't reorder runs.** Extract contiguous regions in source order. Partials may forward-reference
  one another's exports inside event/lifecycle closures (they resolve at call time), but the source
  order of the runs should match the original inline order.
- **Group by responsibility.** Name partials for what they do (`columnBuilders.rzts`,
  `editorBindings.rzts`, `gridFocusNav.rzts`) rather than by size — the goal is navigability.

## When to reach for partials

Script partials are an **authoring-ergonomics** tool, not a runtime feature. Reach for them when a
component's `<script>` is large enough that a single file hurts navigation or review. For small
components, inline is simpler and just as correct. Because the output is identical either way, you
can decompose (or recombine) at any time with no risk to what ships.
