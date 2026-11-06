# @rozie-ui/switch-react

## 0.1.8

### Patch Changes

- e9e5f05: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.

- e9e5f05: First npm release of the React, Vue, Svelte, Angular and Lit packages. The Solid package has been on npm since September 2026; this version brings all six targets to the same component revision.
- e9e5f05: React and Solid: slot props passed to the component are no longer part of the attribute pass-through spread onto its root element. On Solid a slot render function passed as `<name>Slot` (or a `slots` record) was written to the DOM as an attribute holding the function source; on React the slot members (`render<Name>`, `children`, `slots`) were left in the rest bucket. Regenerated with the compiler fix; no API change.
- e9e5f05: Props types now accept the root element's HTML attributes when a component passes attributes through to a single root element (typed public surface, phase 3).
  - React: `interface XProps extends Omit<React.ComponentPropsWithoutRef<'<tag>'>, …>` — `className`, `style`, `id`, `aria-*`, `data-*`, element-specific attributes (`disabled` on a `<button>` root, …) and DOM listeners typecheck without a cast.
  - Solid: the same with `ComponentProps<'<tag>'>`.
  - Svelte: `interface Props extends Omit<SvelteHTMLElements['<tag>'], …>` replaces `[key: string]: unknown`. **This is stricter:** an attribute the root element does not support, which the old index signature accepted, is now a type error.
  - The component's own props win on a name collision. `children` stays rejected when the component has no default slot, as do the content-replacing `dangerouslySetInnerHTML` (React) and `innerHTML` / `innerText` / `textContent` (Solid).
  - An `<svg>` root gets the SVG element's attributes (`fill`, `stroke`, `viewBox`, …). Any other non-HTML root (a custom element) gets the generic `HTMLAttributes<HTMLElement>` on React and Solid, and Svelte's permissive custom-element entry.
  - Components with `inherit-attrs="false"`, an `r-if` root or a component root are unchanged. Vue, Angular and Lit are unchanged; they already accepted pass-through attributes.

  The `.d.rozie.ts` sidecars (React, Solid, Svelte) carry the same types. Types only — no runtime change.

- e9e5f05: React: a consumer's DOM listener now fires alongside the component's own handler when the component's root element binds its own `@event` and passes attributes through (the default). Before, the root emitted `<el {...attrs} onClick={own}>`, and JSX's last-wins rule silently dropped the consumer's `onClick` — while Vue, Svelte, Solid and Lit already fired both. The root now emits `{...mergeListeners({ onClick: own }, pickListeners(attrs))}` after its merged `className`, so both handlers fire (own first) and the merged class is never re-applied.

  `@rozie/runtime-react` gains `pickListeners`, the React port of the Solid helper: it filters the pass-through bucket down to function-valued `on*` keys before the merge.

  Every React `mergeListeners(...)` events partial is now typed with `satisfies <element props> & Record<string, unknown>`, so its handlers get the same `$event` type they would have as JSX props — previously the listener-merge partial (e.g. `r-on="$listeners"` plus a local `@click` with `inherit-attrs="false"`) emitted an untyped `$event`, an implicit-`any` error under a strict consumer tsconfig.

## 0.1.2

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
