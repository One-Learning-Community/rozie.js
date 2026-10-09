# @rozie-ui/toast-svelte

## 0.4.0

### Minor Changes

- 3201801: The toaster now announces through two standing live regions that are mounted with it, instead of a `role="status"` on each toast as it is inserted (a live region that arrives together with its content is often not announced, VoiceOver especially). A polite `role="status"` region and an assertive `role="alert"` region exist before the first toast; each toast's `message` is written into one of them, and a `patch()` or `promise()` that changes the message rewrites that toast's line in place.

  `error` toasts are announced assertively (`role="alert"`) and every other type is polite. This changes `warning`, which was assertive before: it is now polite.

  Toast rows no longer carry `role` or `aria-live`, so a test or stylesheet that selects toasts by `[role="status"]` should select `.rozie-toast` instead. The exception is a toast shown without a `message` (for example `show({ data, type: 'error' })` drawn by a `#toast` slot): it has nothing to write into a region, so its own row keeps a live role (`role="alert"` for `error`, `role="status"` otherwise) and slot-only content is still announced. A `patch()` that adds or clears the message moves the toast between the two forms.

  The regions carry `message`, so pass one to `show()` even when a `#toast` slot renders its own content. New `disableAnnounce` prop for a slot that supplies its own `role` / `aria-live`: the toaster then renders no live regions, so nothing is announced twice or nested.

  On Solid, the `toastSlot` function no longer appears as a `toastslot` attribute on the root element (a compiler fix).

### Patch Changes

- @rozie/runtime-svelte@0.9.1

## 0.3.1

### Patch Changes

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- 3fcfea0: Toaster: the `dismissed` event handler now has a real payload type instead of `(...args: any[]) => void`. It receives `ToastDismissedPayload` (`{ toast: ToastEntry; reason: ToastDismissReason }`), and the `#toast` slot's `toast` and `dismiss` parameters are typed too (`ToastEntry` and `(id: string) => void`). `ToastEntry`, `ToastType`, `ToastAction`, `ToastDismissReason` and `ToastDismissedPayload` are exported from the package entry. A handler written against a different payload shape may now be rejected by the type checker.
- Updated dependencies [c362398]
  - @rozie/runtime-svelte@0.9.0

## 0.3.0

### Minor Changes

- a9d67cb: Props types now accept the root element's HTML attributes when a component passes attributes through to a single root element (typed public surface, phase 3).
  - React: `interface XProps extends Omit<React.ComponentPropsWithoutRef<'<tag>'>, …>` — `className`, `style`, `id`, `aria-*`, `data-*`, element-specific attributes (`disabled` on a `<button>` root, …) and DOM listeners typecheck without a cast.
  - Solid: the same with `ComponentProps<'<tag>'>`.
  - Svelte: `interface Props extends Omit<SvelteHTMLElements['<tag>'], …>` replaces `[key: string]: unknown`. **This is stricter:** an attribute the root element does not support, which the old index signature accepted, is now a type error.
  - The component's own props win on a name collision. `children` stays rejected when the component has no default slot, as do the content-replacing `dangerouslySetInnerHTML` (React) and `innerHTML` / `innerText` / `textContent` (Solid).
  - An `<svg>` root gets the SVG element's attributes (`fill`, `stroke`, `viewBox`, …). Any other non-HTML root (a custom element) gets the generic `HTMLAttributes<HTMLElement>` on React and Solid, and Svelte's permissive custom-element entry.
  - Components with `inherit-attrs="false"`, an `r-if` root or a component root are unchanged. Vue, Angular and Lit are unchanged; they already accepted pass-through attributes.

  The `.d.rozie.ts` sidecars (React, Solid, Svelte) carry the same types. Types only — no runtime change.

### Patch Changes

- a9d67cb: Typed public surface, phase 1: a component can now declare real TypeScript types for its events, slot parameters and imperative handle, and a consumer on any target sees them instead of `any`. See the new guide, "Typed public surface".

  Four opt-in authoring features (a component that uses none of them compiles exactly as before; all are types-only, with no runtime change on any target):
  - `<types>` block: type-only statements (`import type`, `interface`, `type`, and `export` of those) hoisted into every target and re-exported from the package entry. Anything else is an error (ROZ019, ROZ020). A `<types>` import that clashes with a `<script>` import is ROZ024; an identical duplicate is dropped silently. A `<types>` name that collides with a generated name (`<Name>Props`, `<Name>Handle`, `Rozie<Name>EventMap`, slot context interfaces, …), with a name the compiled module imports (a `<components>` key, its `<Local>Handle`, or a framework / `@rozie/runtime-*` import such as `ReactNode` or `TemplateRef`, reserved on every target), or with a top-level `<script>` declaration is ROZ025.
  - `<emits>` block: `{ name: { payload?: '<type>', docs?: {...} } }`. When present it is the complete list: an undeclared `$emit` is an error (ROZ151), reported at the `$emit` call, and a declared event that is never emitted is a warning (ROZ152), reported at its `<emits>` entry. A `$emit` whose argument count does not match the declared payload is a warning (ROZ157), reported at the call. Invalid entries (including a repeated event name or `payload`/`docs` key), types and docs are ROZ021, ROZ022 and ROZ023. React and Solid get `onX?: (payload: P) => void`, Vue a typed `defineEmits`, Svelte a lowercase `onx` callback, Angular `output<P>()`, and Lit a `CustomEvent<P>` with a generated `Rozie<Name>EventMap` and typed `addEventListener`/`removeEventListener` overloads.
  - `<slot :param-types="{ row: 'Row' }">` types a slot parameter (unknown key ROZ153, malformed value ROZ154).
  - `$expose(verbs, signatures)`: a compile-time-only second argument typing the handle (unknown verb ROZ155, malformed ROZ156). The signature strings are stripped from every emitted module. A verb without a signature keeps its implementation's own types when it has them (a return-type annotation or an annotated `const`, in `<script lang="ts">`) on every target; only a fully untyped verb is `(...args: any[]) => any`.

  Also in this release:
  - The component manifest (`rozie-manifest.json`) is schema v2 and carries emit payloads, expose signatures, the `<types>` text and slot `:param-types`. The reader still accepts v1, so composing an already-published v1 package keeps working. Composing a package whose leaves ship a v2 manifest (`@rozie-ui/popover`, `@rozie-ui/combobox`, …) from your own `.rozie` requires `@rozie/*` at or above this release; a compiler that is too old now says so in ROZ988 (upgrade the toolchain) instead of advising a reinstall of the primitive.
  - `.d.rozie.ts` sidecars now carry `<types>` and type slots and events exactly as each compiled module does. Apart from `<types>`, these changes apply to every component, not only to ones that use the new features: Solid `<slot>Slot` props and JSX.Element shapes; Svelte Snippet shapes and lowercase handler names; no spurious `render<X>` props on Vue, Angular and Lit (Lit declares its slot receivers on the element class instead); no `on<X>` props on Lit; and on Angular, every component with events loses its spurious `on<Event>` props, and the declared class gets typed `OutputEmitterRef<T>` outputs from the same derivation as the compiled `output()` fields (`T` is the declared payload, otherwise `void`, or `unknown` when an untyped `$emit` passes a payload). The `<Name>Handle` of an `$expose` component now keeps the type of a verb declared as an annotated `const` (`const add: AddFn = …`) instead of `(...args: any[]) => any` (or the implementation's own signature). A Solid scoped default slot now accepts a function child.
  - Text such as `<script`, `<style`, `<title` or `<textarea` inside a `<types>`, `<emits>`, `<props>`, `<data>`, `<listeners>` or `<components>` body (in a comment, a docs string, or a generic like `Array<Style>`) no longer desynchronises the block splitter. Those bodies are now opaque to the HTML tokenizer.

  Untyped-handler convergence (the one planned typing change for components that do not opt in; the sidecar fixes above reach them too): an untyped event handler is now `(...args: any[]) => void` on every target. The shared `.d.ts` sidecar, Solid and Svelte used to emit `unknown[]`, which rejected handlers written with a concrete parameter type; React already used `any[]`. The generated sources of the Solid and Svelte leaves (and the React `.d.ts`) change accordingly, hence the patch bumps. `@rozie-ui/sortable-list-solid` and `@rozie-ui/switch-solid` also pick up the scoped-default-slot function-child fix.

  `@rozie-ui/popover-*` and `@rozie-ui/fullcalendar-*` adopt the features and are bumped minor, because typed events can reject a previously accepted wrong-typed handler:
  - popover: the `anchor` slot context is typed (including the new `panelId: string`) and the handle (`show`, `hide`, `toggle`, `reposition`) is typed. Its open state's change event is the `open` model's (Lit: `open-change`, now in `RoziePopoverEventMap` as `CustomEvent<boolean>`).
  - fullcalendar: 11 typed events (for example `eventClick` with `jsEvent: MouseEvent | KeyboardEvent`, and `unselect` with `jsEvent: UIEvent | null`), 10 typed portal slot arguments and 16 typed handle verbs. The `<types>` names are re-exported from every package entry, and the package barrels re-export the handle types and Lit event maps.
  - Both families generate their README event tables from `<emits>` and no longer ship `scripts/event-manifest.mjs`.
  - @rozie/runtime-svelte@0.8.0

## 0.2.1

### Patch Changes

- 64cebc6: The imperative handle's `show`/`dismiss`/`clear`/`patch`/`promise` methods now carry their real action/data-aware TypeScript signatures in every target's declaration output, instead of the untyped `(...args: any[]) => any` catch-all.

  `show()` and `patch()` were already functionally action/data-aware at runtime — both accept `{ message, type, duration, action: { label, onClick }, data }`, exactly as the README's Undo example documents — but none of the five methods carried an explicit TypeScript return-type annotation in the Rozie source, so every target's declaration emitter fell back to the untyped catch-all shape. A consumer typing `show({ actoin: {...} })` (typo) or misusing `patch()` got zero compile-time help.

  Purely a type-accuracy fix: no runtime behavior changed on any target.

## 0.2.0

### Minor Changes

- 4f2148d: A toast can now carry an action and pass-through data, from a dogfooding report: `show()`
  whitelisted `id`/`message`/`type`/`duration` and silently dropped everything else, so an "Undo"
  toast previously needed the `#toast` slot plus a side map from toast id to action.
  - `show({ action: { label, onClick } })` renders an action button in the default toast;
    clicking it calls `onClick({ id, data })` and dismisses with a new dismiss reason, `'action'`.
    An action with no `onClick` function is dropped — no dead button ships.
  - `show({ data })` carries any payload through untouched, available in the `#toast` slot's scope
    (`toast.data`), the `dismissed` payload, and the action callback.
  - `patch(id, { action, data })` can update both, so a promise-toast can gain its "Undo" action
    once it resolves.
  - The action button inherits the toast's own colour, matching every type variant. No new public
    theming token yet.

  Purely additive: `dismissed` can now also report reason `'action'`; existing consumers of
  `show()`/`patch()` are unaffected.

  **Theming — design-system bridges now yield to an ancestor's own tokens, and apply correctly on
  Lit.** Same fix as every other themed family in this release — see the `@rozie-ui/data-table`
  changeset in this release for the full description of the bridge-scoping defect and its fix.

  **Solid packaging.** `@rozie-ui/toast-solid` ships the same compiled-JS-by-default,
  JSX-under-the-`solid`-condition packaging shape as every other published Solid leaf this release
  — see the dedicated Solid packaging changeset for the full description. No API change.

### Patch Changes

- 4f2148d: Fixed: the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/toast-svelte`, this package's own.
- 4f2148d: Fixed two pre-release defects in the `action`/`data` API above before its first publish:
  - An action's `onClick` that threw an error used to leave its toast stuck forever (the
    dismiss never ran). `runAction` now dismisses with reason `'action'` in a `finally` block —
    the dismiss always happens, and the error itself still propagates (never silently
    swallowed).
  - The auto-dismiss timer now pauses on keyboard focus, not just pointer hover: tabbing to a
    toast's action (or close) button pauses it with the same exact-remainder precision as
    hover, so a keyboard user reading or acting on a toast never loses it to the timeout
    mid-interaction (WCAG 2.2.1). Hover-pause and focus-pause compose — leaving one does not
    resume the timer while the other is still active — and this is unconditional, not gated by
    `disablePauseOnHover`.
  - @rozie/runtime-svelte@0.7.5

## 0.1.3

### Patch Changes

- @rozie/runtime-svelte@0.7.0

## 0.1.2

### Patch Changes

- @rozie/runtime-svelte@0.6.0

## 0.1.1

### Patch Changes

- Stale-publish reconciliation. The published `0.1.0` tarball predates the `0.4.0`-cluster's stacked-offset regeneration and never carried it — `pnpm publish` silently skipped republishing at the time, so the registry has been serving a `Toaster` missing the `stacked` mode's per-toast depth offset since the feature's introduction. This release republishes the current generated output:
  - **Fix: `stacked` mode's collapsed depth offset now actually applies.** The template's `{#each}` was `{#each toasts as t (t.id)}` with `toastStyle(t)` (single-arg) in the published tarball; the depth-driven `--rozie-toast-depth` custom property that the `stacked` CSS relies on to fan/collapse the grid overlay was never computed per-row, so a `stacked` toaster rendered every toast at depth 0 (all stacked flush, no depth cascade). It is now `{#each toasts as t, ti (t.id)}` with `toastStyle(t, ti)`, threading the row index through to `depth(ti)`.
  - `depth()` itself changed from an O(n) `.findIndex()` scan per toast (invoked once per rendered row, so O(n²) per render) to O(1) arithmetic off the `{#each}`-provided index — same observable depth values, no behavior change beyond the fix above.
  - The `swipeGesture` pointer-drag bookkeeping moves from `$state(null)` to a plain module-scope `let`, matching the hoisted-non-reactive-bookkeeping convention used elsewhere in the corpus (the value is never read from the template, only from the four `onToastPointer*` handlers) — an internal implementation detail with no observable behavior change.
  - No prop/event/emit surface change. The `stacked` prop and its opt-in behavior shipped as designed in the `0.1.0` minor; only the depth-offset computation was missing from what actually reached npm.
- @rozie/runtime-svelte@0.2.2 (unchanged — no runtime bump in this wave)

## 0.1.0

### Minor Changes

- a7bc443: Toast UX cluster — closes the four previously-deferred `@rozie-ui/toast` UX items in one wave:
  - **Precise remaining-time hover pause.** Hovering the stack now stores each timer's exact remainder instead of a full restart — a 1000ms toast hovered ~600ms in and released dismisses ~400ms later, not after a fresh 1000ms.
  - **The family's first event, `@dismissed { toast, reason }`.** Every dismissal (timer expiry, the close button, the `dismiss()` verb, or a swipe) routes through one funnel and fires `dismissed` exactly once, before a new CSS enter/exit animation lifecycle runs; `clear()` stays bulk and fires nothing.
  - **`patch(id, changes)` and `promise(p, { loading, success, error })`.** `patch` updates an existing toast in place (message/type/duration, with duration-key timer restart semantics). `promise` shows a `{ type: 'loading' }` spinner toast synchronously and flips it to success/error at settle — the timer starts at settle, and a toast dismissed while pending is never resurrected.
  - **Pointer swipe-to-dismiss**, on by default (`disableSwipe` opts out): direction auto-derived from `position`, a 45%-width/velocity threshold, rubber-band on the wrong direction, and spring-back below threshold.
  - **An opt-in `stacked` collapsed stack**: a sonner-style depth-driven grid overlay (newest on top, depth 3+ hidden) that expands to the normal flex column on hover or keyboard focus.
  - 6 new theming tokens (`--rozie-toast-enter-duration`, `--rozie-toast-exit-duration`, `--rozie-toast-stack-offset`, `--rozie-toast-stack-scale-step`, `--rozie-toast-spinner-size`, `--rozie-toast-spinner-color`) with preset mappings across the shadcn/Material/Bootstrap theme bridges.

  The public surface grows from 5 props / 0 events / 3-verb handle to 7 props / 1 event / 5-verb handle; the `toast` scoped slot and all five existing props are unchanged. No breaking changes.

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-svelte@0.2.0
