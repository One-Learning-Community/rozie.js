# @rozie-ui/tiptap-svelte

## 0.5.1

### Patch Changes

- 543759b: Typed public surface, phase 1: a component can now declare real TypeScript types for its events, slot parameters and imperative handle, and a consumer on any target sees them instead of `any`. See the new guide, "Typed public surface".

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

## 0.5.0

### Minor Changes

- TipTap now ships an OS-driven dark-mode default for its editor chrome, matching the mechanism already shipped for `@rozie-ui/rete`.

  Previously, `@rozie-ui/tiptap`'s default toolbar/editor colors were light-only — a consumer on a `prefers-color-scheme: dark` system with no import at all got a bright white editor surface on a dark page. `TipTap.rozie` now carries a zero-import `@media (prefers-color-scheme: dark)` default on 15 color-bearing tokens (background, toolbar background, button colors and states, borders, toolbar separator, character-count colors, placeholder), declared on private `--rtt-*` names so a public `--rozie-tiptap-*` override anywhere still wins. An app that explicitly opts into light via `.light` / `[data-theme="light"]` keeps the light look under OS dark. The link-editor floating surface is intentionally excluded — its dark styling is by original design, not new.

  No public API changes: all new values are private `--rtt-*` wiring — no `--rozie-tiptap-*` token was added, renamed, or removed, so an existing consumer override of any `--rozie-tiptap-*` token keeps winning in both light and dark, exactly as before.

## 0.4.0

### Minor Changes

- 4f2148d: Two findings from dogfooding, both consumer-visible on install and on construction timing.

  **BREAKING — `@tiptap/extension-bubble-menu` is now a required peer dependency, not
  optional.** The built-in link editor is a `BubbleMenu` on every editor, unconditionally, so
  declaring it optional was never accurate — a consumer who never installed it simply never
  noticed until they hit the link-editor path. If you don't already have it installed:

  ```
  npm install @tiptap/extension-bubble-menu
  ```

  **`character-count`, `image`, and `floating-menu` extension peers are now lazy-loaded, only
  when their feature is actually used**, instead of being statically imported by every leaf
  regardless of whether the consumer installed them. `@tiptap/extension-character-count` loads
  only when `maxLength` (or the `#count` slot) is used; `@tiptap/extension-image` only when
  `uploadImage` is used; `@tiptap/extension-floating-menu` only when the `floatingMenu` slot is
  used. Declaring these peers `peerDependenciesMeta.optional: true` is now actually true — you may
  drop whichever of the three you don't use.

  **New event: `ready`.** Fired once per mount, on both the synchronous and the (new) lazy
  construction path, with the live `Editor` instance as its payload. **If your component uses
  `maxLength`, `uploadImage`, or a `floatingMenu` slot, construction is now asynchronous** — use
  `ready` (`onReady` / `@ready`) to know when calling a handle verb like `focusEditor()` will
  actually work, rather than an arbitrary delay. With none of the three lazy features in use, the
  editor is still constructed synchronously at mount, exactly as before. `ready`'s payload is typed
  `unknown`, matching every other emitted event today.

  **`tiptap-vue` — Vue's `inherit-attrs`/`inherit-listeners` opt-out now applies** (see the
  `@rozie/core` changeset in this same release for the underlying emitter fix): undeclared
  attributes and listeners no longer fall through onto `tiptap-vue`'s wrapper element, matching the
  other five targets. This is a **behaviour change** if you were relying on that fallthrough on Vue
  specifically.

  **Solid packaging.** `@rozie-ui/tiptap-solid` ships the same compiled-JS-by-default,
  JSX-under-the-`solid`-condition packaging shape as every other published Solid leaf this release
  — see the dedicated Solid packaging changeset for the full description. No API change.

  Docs updated: the install line now lists all four required peers plus the three optional ones
  (it previously omitted `@tiptap/extensions` and `bubble-menu` and claimed both menu peers were
  optional).

### Patch Changes

- 4f2148d: **Fixed: a stale pre-unmount async construction could double-construct the Editor
  under React StrictMode** (`maxLength`/`uploadImage`/`floatingMenu` lazy-extension path
  only). React's dev-mode StrictMode double-invoke (mount → cleanup → mount, against the
  SAME component instance) could let a stale first invocation's async extension-load
  `.then()` construct a SECOND Editor onto the same DOM node and fire `ready` twice,
  because the internal `disposed` guard was reset by the second invocation before the
  first's `.then()` ever settled. Fixed with a per-mount-invocation guard; no API change.

  **Fixed: `setContent()`/`clearContent()` no longer drop a write made during the async
  construction gap** (`maxLength`/`uploadImage`/`floatingMenu` lazy-extension path only).
  Calling either before `ready` now updates the bound `html` model immediately, and the
  editor constructs with that value once it exists, instead of the write silently vanishing.

  **New event: `error`.** Fired when an optional extension (`floatingMenu`/`image`/`count`)
  fails to load via its dynamic `import()` — payload is `{ extension, error }`. Previously
  an unhandled rejection on the internal `Promise.all` left the editor permanently
  uncreated, silently, on ANY chunk-load failure (a real-world CDN/network blip). The
  editor now still constructs WITHOUT the failed extension (degrade) instead of never
  constructing at all; the failure is also reported via `console.error`.

  **Docs: the `ready` event's README table row is no longer empty.** Its description was
  missing from the generator's event-description map since `ready` shipped last release;
  now documented, alongside the new `error` event above.
  - @rozie/runtime-svelte@0.7.5

## 0.3.2

### Patch Changes

- ba42bc2: On React, Angular, and Lit, the synthesized `$portals` closure now lives at COMPONENT scope
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

  **Changeset scope note.** The six `@rozie-ui/<family>` umbrella packages are `private: true` and the repo sets `privatePackages.version: false`, so listing them alone versions nothing. The published, consumer-installed artifacts are the per-framework pre-compiled leaves (`@rozie-ui/<family>-<target>`), and they carry no dependency on `@rozie/core` — a core bump does not cascade to them. Since this change rewrites their emitted source, they are bumped explicitly. `@rozie-ui/maplibre-*` is omitted deliberately: those leaves are in the changeset config's `ignore` list. `-solid` leaves are omitted because Solid already emitted the closure at component scope and its output is unchanged.

  **Why no `@rozie-ui/<family>` umbrella entries.** Those six packages are `private: true`, so changesets treats them as ignored; a changeset that mixes ignored and non-ignored packages is rejected outright (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), failing `changeset status` and any release run. Only the published, consumer-installed per-framework leaves are listed.

- eb280c9: No API change. Internal helpers that read `$portals.<name>` now live at component scope
  instead of inside the mount-phase lifecycle hook, now that quick 260829-cd4 hoists the
  emitter-synthesized `$portals` closure to component scope on all six targets.

  This unwinds the `$portals` mount-scope workarounds in three shipped `@rozie-ui`
  components (of the five originally targeted — see the CodeMirror note below) carried
  before that emitter fix landed:
  - **`@rozie-ui/tiptap`** — `makeNodeView`/`makeNodeViewExtensions` read `$portals.nodeView`
    directly instead of taking it as an injected parameter.
  - **`@rozie-ui/rete`** (`NodeType`) — the `#body` portal-mount closure is a top-level
    function instead of a null-let bridge assigned inside `$onMount`.
  - **`@rozie-ui/chartjs`** (and its 8 per-type variants, generated from the same source) —
    `buildConfig` and its click/hover/tooltip helpers are top-level; `$onMount` now only
    captures the canvas ref, constructs the `Chart` instance, and tears it down.

  `@rozie-ui/maplibre`'s per-framework leaves are changesets-ignored (deliberately
  unpublished) even though the marker/popup/interactive-layer reconcile unwind landed and
  is included in the source diff — no leaf version bump applies.

  `@rozie-ui/rete`'s sibling `FlowCanvas` component was investigated and found
  correct-by-design (its reconcilers are rooted in a `$refs` read that must stay
  `$onMount`-scoped under ROZ123) — only its stale comment was corrected, no behavior change.

  **`@rozie-ui/codemirror` REVERTED, not shipped.** The relocation was implemented, gated
  green (build/test/typecheck), and committed, but the full Docker VR union caught a
  React-only regression it introduced: the CM6 `Compartment` instances (`themeCompartment`
  et al.) lost their `useMemo(() => new Compartment(), [])` wrapping and became a
  per-render `new Compartment()` once `buildState` (which reads them) moved out of
  `$onMount` to a top-level `useCallback` — an emitter memoization-heuristic gap, not a
  `.rozie`-source-fixable issue (SCOPE FENCE: no emitter code changed in this quick). Two
  React `code-mirror.spec.ts` tests failed (theme-toggle class never changing; an
  extensions-toggle readOnly reconfigure never taking effect) while all five other targets
  stayed green. The commit was reverted; CodeMirror.rozie and its six leaves are unchanged
  from `main` before this quick. Recorded as a follow-up for the emitter team, not
  worked around here.

  Several stale comments across the touched files claimed `$emit` and/or `$slots` also
  forced mount scope. Neither ever did, on any target — those comments are corrected too.

  No emitter code changed in this patch. `@rozie/core` is not bumped.

  **Why no `@rozie-ui/<family>` umbrella entries.** Those six packages are `private: true`, so changesets treats them as ignored; a changeset that mixes ignored and non-ignored packages is rejected outright (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), failing `changeset status` and any release run. Only the published, consumer-installed per-framework leaves are listed.
  - @rozie/runtime-svelte@0.7.0

## 0.3.1

### Patch Changes

- @rozie/runtime-svelte@0.6.0

## 0.3.0

### Minor Changes

- TipTap 0.3.0 — new imperative link-editor verbs plus four bubble-menu link-editor bug fixes, no breaking changes:
  - **New `setLink(attrs)` / `unsetLink()` imperative-handle verbs.** Thin delegates over the exact same `applyLink` / `removeLink` the `#linkEditor` slot scope already hands a consumer fragment, so the imperative handle and the slot-scope verb can never disagree. The handle is now 25 verbs.
  - **Fix: mount-time prefill.** The built-in link form now seeds its input from the live editor's link attributes at mount, so a document whose caret starts inside a link shows a prefilled URL instead of an empty field.
  - **Fix: open/close silently no-op'd on all six targets whenever the editor already had focus** — the common case, since the create/close controls are `@mousedown.prevent`-guarded precisely so pressing them does not collapse the selection. TipTap's `focus` command dispatches nothing when the view is already focused, and `@tiptap/extension-bubble-menu`'s `update()` short-circuits when neither the doc nor the selection changed, so `shouldShow` never re-ran either. Now routed through the extension's own documented escape hatch, `view.dispatch(state.tr.setMeta(pluginKey, 'show' | 'hide'))`.
  - **Fix: stale read on the reactive-refresh path.** The link scope was read in the same synchronous tick it was written — React's setState-is-async trap. The scope builder now takes `href` / `attrs` as parameters populated from the caller's freshly-computed locals. Consumer-visible effect: the `#linkEditor` slot scope's `href` / `attrs` now reflect the current link on every caret move rather than the previous one.
  - Internal, stated because it is why the React leaf's emitted body moved: the component's `link` data key was renamed to `linkState` because it collided with React's auto-generated `setLink` state setter once `setLink` became a public verb. No public surface change.
  - **Solid specifically:** before `@rozie/core@0.5.1`, the `#linkEditor` override slot's `setLink` / `unsetLink` / `close` threw a `ReferenceError` on Solid. The regenerated leaf here carries the emitter fix; Solid and Svelte 5 are now durably covered for this path for the first time.

  No breaking changes.

### Patch Changes

- Updated dependencies
  - @rozie/runtime-svelte@0.5.1

## 0.2.0

### Minor Changes

- b9b4351: TipTap 0.2.0 — three additive feature waves, no breaking changes:
  - **Bubble-menu link editor (#2).** A batteries-included link editor on its own selection-anchored bubble-menu surface: a toolbar **Link** button + auto-surface when the cursor is on a link, a built-in URL form (Apply / Remove / Cancel; Enter applies, Escape cancels), and a reactive `#linkEditor` override slot (`{ editor, href, attrs, setLink, unsetLink, close }`) for bring-your-own link UI. Adds the `bubbleMenuShouldShow` prop to make the general `bubbleMenu` slot's trigger consumer-controllable, the `openLinkEditor()` imperative verb, and `--rozie-tiptap-link-*` theming tokens. Custom link attributes (e.g. `data-course-link`) persist via a consumer `Link.extend({ addAttributes })` through `:extensions`.
  - **Character/word count (#1).** Optional `maxLength` renders a live `characters / maxLength` counter (overridable via the `#count` slot) with an `over` state; `enforceMaxLength` opts into a hard cap. New `getCharacterCount()` / `getWordCount()` handle verbs. Zero overhead when unused.
  - **Themeable styles (#3).** Every visual value is now a `var(--rozie-tiptap-*, <default>)` CSS custom property, so the editor chrome is themeable on install without forking — headless-UI convention, byte-identical default render.

## 0.1.2

### Patch Changes

- TipTap: configurable StarterKit, custom node registration, a richer default toolbar, and image upload.
  - **Configurable StarterKit** — new `starterKit` prop is passed straight to `StarterKit.configure(...)`, so you can disable or tune any bundled extension: `:starter-kit="{ heading: false }"`, `{ heading: { levels: [1, 2] } }`, `{ link: false }`, and so on. Supplying your own extension via `extensions` whose name matches a StarterKit-bundled node or mark (e.g. a custom `Link`) now automatically disables the built-in one — no more `Duplicate extension names found` warning, and your extension wins. (The `extensions` "consumer wins" behavior is now actually delivered; previously it was documented but did not work.)
  - **Custom node views** — new `nodeSpecs` prop lets you register your own ProseMirror nodes (`{ name, tag, group, inline, atom, content, attrs }`), rendered through the `nodeView` slot by dispatching on `node.type.name`. Note: the previously built-in `rozieMention` / `rozieCallout` demo nodes have been removed from the component — a stock `<TipTap>` no longer registers them. If you relied on them, declare them via `nodeSpecs` (see the example recipes).
  - **Richer default toolbar** — added Underline, Ordered List, Undo, and Redo buttons (all StarterKit-native; no new engine dependencies).
  - **Image upload** — new `uploadImage` prop, `(file: File) => Promise<string>`. When provided, pasted or dropped images are uploaded through your callback and inserted at the caret; when omitted, there is zero overhead. Requires `@tiptap/extension-image` (now declared as an optional peer dependency and externalized from the bundle).

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-svelte@0.2.0
