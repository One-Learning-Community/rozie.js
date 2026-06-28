# `@rozie-ui/headless-core`

Shared, target-agnostic **headless logic** for the `@rozie-ui` component families — extracted in Phase 64 so that list and windowing behaviour lives in one place instead of being copy-pasted per family.

> **Source-only package.** `private: true`, no version is published, and there are **no compiled per-framework leaves**. It ships `.rzts` script-partials that *dissolve* into each consumer's compiled output at build time, leaving **zero runtime dependency** on this package. Do not `import` from it at runtime — the symbols only exist inside a consumer's `<script>` after compilation.

## How it works (the dissolve model)

The `.rzts` files are **compile-time script-partials**, not modules. A consuming `.rozie` imports symbols from a bare specifier:

```js
import { windowedRows, virtualizerOptions } from '@rozie-ui/headless-core/windowing.rzts'
import { labelOf, visibleOptions, onControlKeyDown } from '@rozie-ui/headless-core/listCore.rzts'
```

During compilation, `inlineScriptPartials()` (in `@rozie/core`) resolves the bare specifier, inlines the partial's source into the consumer's `<script>`, and *then* lowers the merged script to each of the six targets. The import line disappears; the symbols become ordinary local declarations in the emitted React/Vue/Svelte/Angular/Solid/Lit leaf. The cross-package bare-specifier resolution path (ProducerResolver, `.rzts` ahead of `.ts`) was proven in Phase 64 P0 via `smoke.rzts`.

Consequences:
- Consumers add `@rozie-ui/headless-core` as a **`devDependency`** (build-time only), not a runtime `dependency`.
- There is nothing to type-check standalone: the `.rzts` partials use `$props` / `$computed` / `$emit` sigils and bare `.rzts` imports and are **not** valid standalone TS. Real type safety comes from each consumer compiling the inlined output. (This is why there is no `tsconfig.json` here — see Phase 64 WR-01.)

## The partials

### `windowing.rzts` — vertical windowing math (the virtual-core bridge)

Pure windowing math lifted verbatim from DataTable's Phase 53/63 baseline. Holds **only** the pure math; every DOM/refs/virtualizer-instance impurity stays per-consumer in the host (ROZ123).

**Exports:** `virtualItemKey`, `virtualizerOptions`, `windowedRows`, `padTop`, `padBottom`, `pmIndexInWindow`, `rowIsOutsideWindow`.

**Host contract** — the consuming `.rozie` MUST define these before importing (an implicit by-convention mixin contract):

| Symbol | Provided by host |
|---|---|
| `windowSource(): T[]` | the full list to window — **rows arrive ONLY through this** (the partial never reaches into the host data engine). Each item must carry a stable `.id` (used by `virtualItemKey`). |
| `$props.estimateRowHeight` | per-item size estimate |
| `$data.windowVer` / `$data.editVer` | window/edit-version reactivity bumps |
| `gridScrollEl` | the scroll-container element handle |
| `virtualizer` | the host's virtual-core instance (built in `$onMount` from the ref) |
| `observeElementRect` / `observeElementOffset` / `elementScroll` / `measureElement` | virtual-core fns |
| `scheduleRemeasure()` | the host's rAF/microtask remeasure defer |
| `pinnedEditIndex()` / `pinnedMeasurement(pin)` | **optional** D-05 pin hook — DataTable passes its edit-pinning hooks; list families pass a **no-op**. Routing pinning through this host hook (not inlining it) keeps DataTable's B13 edit-pinning byte-identical. |

> **`windowSource()` rows need a stable `.id`.** Combobox/Listbox wrap raw options into id-bearing rows (`{ id: valueOf(o), _opt, _i }`) so `virtualItemKey` keys correctly across recycling. Returning raw options with no `.id` yields `undefined` keys and node-recycling drift (Phase 64 CR-02).

### `listCore.rzts` — the headless list spine

Pure list logic lifted from Listbox's monolithic `<script>`: option resolvers, client-side filter, enabled-index navigation, the full keyboard reducer (arrow/home/end/enter/escape/space/tab), type-ahead, single + multi selection, open/close state, and activeDescendant derivation.

**Exports:** `labelOf`, `valueOf`, `disabledOf`, `optionId`, `visibleOptions`, `selectedLabel`, `activeDescendant`, `isSelected`, `resolveInitialActive`, `applyExpanded`, `open`, `close`, `toggle`, `fireChange`, `select`, `clear`, `nextEnabled`, `move`, `moveEdge`, `commitActive`, `onTypeahead`, `onControlKeyDown`, `fireSearch`, `onInput`, `onOptionPointerMove`.

**Parameterized by host convention** along two axes (no discriminant props):
- **focus-model:** `activedescendant` (both list families today — highlight tracked virtually, DOM focus stays on the control) vs `roving` (supported-but-unused; a roving host supplies its own focus mover).
- **input-mode:** `select-only` (Listbox — button trigger + type-ahead; never writes `$data.query`) vs `filter-input` (Combobox — a text `<input>` writes `$data.query`, so `visibleOptions` substring-filters).

**Host contract:** the host owns the type-ahead scratch `let`s (`typeBuffer` / `typeTimer` — they reassign from handlers, so the React emitter hoists them to `useRef`; per the A==B playbook they stay in the host), the impure ref-readers `focusControl()` / `scrollActiveIntoView()`, plus the option set + form surface (`$props.options` / `value` (model) / `multiple` / `id` / `optionLabel` / `optionValue` / `optionDisabled` / `closeOnSelect` / `disabled`) and reactive state (`$data.open` / `$data.activeIndex` / `$data.query`).

### `smoke.rzts`

The P0 boundary-proof partial — exercises the cross-package bare-specifier resolution path. Demo/test only (`HeadlessCoreSmokeDemo.rozie`, `tests/surface.test.ts`).

## Who consumes it today

| Consumer | `windowing.rzts` | `listCore.rzts` |
|---|---|---|
| `@rozie-ui/data-table` | ✅ (via its own `virtualization.rzts` host) | — |
| `@rozie-ui/listbox` | ✅ | ✅ |
| `@rozie-ui/combobox` | ✅ | ✅ |
| `@rozie-ui/command-palette` | ✅ (vendored Combobox copy) | ✅ (vendored Combobox copy) |

Virtualization is **opt-in per consumer** (the `virtual` prop, default `false`, byte-identical to non-virtual when off) and is **not** inherited automatically by other families — a new family must wire its own host (the table above) to light it up.

## Adding a new consumer

1. Add `@rozie-ui/headless-core: "workspace:*"` to the family's **`devDependencies`**.
2. In the `.rozie`, define the host-contract symbols above (scroll el, virtualizer instance, `windowSource()`, and a no-op pin hook for list-shaped data).
3. `import { … } from '@rozie-ui/headless-core/windowing.rzts'` (and/or `listCore.rzts`).
4. Gate the windowed branch on a `virtual` prop and verify a full `compile()` across all six targets is error-clean.

See `packages/ui/ADDING-A-FAMILY.md` and the Phase 64 design spec (`docs/superpowers/specs/2026-06-27-headless-windowing-listcore-design.md`) for the full rationale.
