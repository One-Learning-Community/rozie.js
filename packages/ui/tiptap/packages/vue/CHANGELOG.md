# @rozie-ui/tiptap-vue

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

## 0.3.1

### Patch Changes

- Regenerated with the toolchain's Vue `$watch` flush:'post' fix: all `$watch`-driven prop/data reconcilers now run post-flush (after the DOM update, matching the React/Solid/Svelte/Angular/Lit leaves' timing) instead of Vue's default pre-flush. This closes the portal re-entrancy class (a portal fill mounting from inside an engine update can no longer synchronously flush a pending sibling watcher into the same engine mid-update) and the pre-flush `$refs`-read-too-early class (e.g. the embla runtime `thumbnails` toggle previously failed to build its thumb engine on Vue). No API surface change.

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

## 0.2.1

### Patch Changes

- Stale-publish reconciliation. The published `0.2.0` tarball's `web-types.json` IDE sidecar was pinned at `0.1.1` — commit `4a095fdd` (2026-08-03) regenerated it to match the leaf version but landed on `main` without a version bump, so `pnpm publish` silently skipped republishing and the registry kept serving the stale sidecar for seven days after the `0.2.0` content itself went live. This release republishes with the sidecar's `version` field matching the leaf `package.json` version. No `src/` change, no API surface change — PhpStorm/WebStorm consumers now get correct `<TipTap>` prop/slot IDE completion instead of stale 0.1.1-era metadata.

## 0.2.0

### Minor Changes

- b9b4351: TipTap 0.2.0 — three additive feature waves, no breaking changes:
  - **Bubble-menu link editor (#2).** A batteries-included link editor on its own selection-anchored bubble-menu surface: a toolbar **Link** button + auto-surface when the cursor is on a link, a built-in URL form (Apply / Remove / Cancel; Enter applies, Escape cancels), and a reactive `#linkEditor` override slot (`{ editor, href, attrs, setLink, unsetLink, close }`) for bring-your-own link UI. Adds the `bubbleMenuShouldShow` prop to make the general `bubbleMenu` slot's trigger consumer-controllable, the `openLinkEditor()` imperative verb, and `--rozie-tiptap-link-*` theming tokens. Custom link attributes (e.g. `data-course-link`) persist via a consumer `Link.extend({ addAttributes })` through `:extensions`.
  - **Character/word count (#1).** Optional `maxLength` renders a live `characters / maxLength` counter (overridable via the `#count` slot) with an `over` state; `enforceMaxLength` opts into a hard cap. New `getCharacterCount()` / `getWordCount()` handle verbs. Zero overhead when unused.
  - **Themeable styles (#3).** Every visual value is now a `var(--rozie-tiptap-*, <default>)` CSS custom property, so the editor chrome is themeable on install without forking — headless-UI convention, byte-identical default render.

## 0.1.1

### Patch Changes

- TipTap: configurable StarterKit, custom node registration, a richer default toolbar, and image upload.
  - **Configurable StarterKit** — new `starterKit` prop is passed straight to `StarterKit.configure(...)`, so you can disable or tune any bundled extension: `:starter-kit="{ heading: false }"`, `{ heading: { levels: [1, 2] } }`, `{ link: false }`, and so on. Supplying your own extension via `extensions` whose name matches a StarterKit-bundled node or mark (e.g. a custom `Link`) now automatically disables the built-in one — no more `Duplicate extension names found` warning, and your extension wins. (The `extensions` "consumer wins" behavior is now actually delivered; previously it was documented but did not work.)
  - **Custom node views** — new `nodeSpecs` prop lets you register your own ProseMirror nodes (`{ name, tag, group, inline, atom, content, attrs }`), rendered through the `nodeView` slot by dispatching on `node.type.name`. Note: the previously built-in `rozieMention` / `rozieCallout` demo nodes have been removed from the component — a stock `<TipTap>` no longer registers them. If you relied on them, declare them via `nodeSpecs` (see the example recipes).
  - **Richer default toolbar** — added Underline, Ordered List, Undo, and Redo buttons (all StarterKit-native; no new engine dependencies).
  - **Image upload** — new `uploadImage` prop, `(file: File) => Promise<string>`. When provided, pasted or dropped images are uploaded through your callback and inserted at the caret; when omitted, there is zero overhead. Requires `@tiptap/extension-image` (now declared as an optional peer dependency and externalized from the bundle).
