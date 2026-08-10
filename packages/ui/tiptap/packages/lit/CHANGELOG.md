# @rozie-ui/tiptap-lit

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
  - @rozie/runtime-lit@0.5.1

## 0.2.0

### Minor Changes

- b9b4351: TipTap 0.2.0 — three additive feature waves, no breaking changes:
  - **Bubble-menu link editor (#2).** A batteries-included link editor on its own selection-anchored bubble-menu surface: a toolbar **Link** button + auto-surface when the cursor is on a link, a built-in URL form (Apply / Remove / Cancel; Enter applies, Escape cancels), and a reactive `#linkEditor` override slot (`{ editor, href, attrs, setLink, unsetLink, close }`) for bring-your-own link UI. Adds the `bubbleMenuShouldShow` prop to make the general `bubbleMenu` slot's trigger consumer-controllable, the `openLinkEditor()` imperative verb, and `--rozie-tiptap-link-*` theming tokens. Custom link attributes (e.g. `data-course-link`) persist via a consumer `Link.extend({ addAttributes })` through `:extensions`.
  - **Character/word count (#1).** Optional `maxLength` renders a live `characters / maxLength` counter (overridable via the `#count` slot) with an `over` state; `enforceMaxLength` opts into a hard cap. New `getCharacterCount()` / `getWordCount()` handle verbs. Zero overhead when unused.
  - **Themeable styles (#3).** Every visual value is now a `var(--rozie-tiptap-*, <default>)` CSS custom property, so the editor chrome is themeable on install without forking — headless-UI convention, byte-identical default render.

## 0.1.3

### Patch Changes

- TipTap: configurable StarterKit, custom node registration, a richer default toolbar, and image upload.
  - **Configurable StarterKit** — new `starterKit` prop is passed straight to `StarterKit.configure(...)`, so you can disable or tune any bundled extension: `:starter-kit="{ heading: false }"`, `{ heading: { levels: [1, 2] } }`, `{ link: false }`, and so on. Supplying your own extension via `extensions` whose name matches a StarterKit-bundled node or mark (e.g. a custom `Link`) now automatically disables the built-in one — no more `Duplicate extension names found` warning, and your extension wins. (The `extensions` "consumer wins" behavior is now actually delivered; previously it was documented but did not work.)
  - **Custom node views** — new `nodeSpecs` prop lets you register your own ProseMirror nodes (`{ name, tag, group, inline, atom, content, attrs }`), rendered through the `nodeView` slot by dispatching on `node.type.name`. Note: the previously built-in `rozieMention` / `rozieCallout` demo nodes have been removed from the component — a stock `<TipTap>` no longer registers them. If you relied on them, declare them via `nodeSpecs` (see the example recipes).
  - **Richer default toolbar** — added Underline, Ordered List, Undo, and Redo buttons (all StarterKit-native; no new engine dependencies).
  - **Image upload** — new `uploadImage` prop, `(file: File) => Promise<string>`. When provided, pasted or dropped images are uploaded through your callback and inserted at the caret; when omitted, there is zero overhead. Requires `@tiptap/extension-image` (now declared as an optional peer dependency and externalized from the bundle).

## 0.1.2

### Patch Changes

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
