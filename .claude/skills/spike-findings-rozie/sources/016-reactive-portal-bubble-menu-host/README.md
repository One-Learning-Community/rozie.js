---
spike: 016
name: reactive-portal-bubble-menu-host
type: standard
validates: "Given a reactive `{update,dispose}` portal mounted into an imperatively-created element that @tiptap/extension-bubble-menu re-parents (element.remove() on hide / appendChild on show), when the selection/link changes, then the consumer fragment re-renders IN PLACE (same DOM, no remount) and survives every detach/reattach cycle — resolving TipTap #2 OPEN Q1."
verdict: VALIDATED
related: [007, 009]
tags: [tiptap, portal-slots, reactive, bubble-menu, link-editor, prosemirror, vue, phase-tiptap-2, open-q1]
---

# Spike 016: Reactive portal into a bubble-menu-managed host

## What This Validates

**OPEN Q1** of the TipTap #2 link-editor spec
(`.planning/quick/260721-lnk-tiptap-link-editor/260721-lnk-SPEC.md`):

> Does the existing reactive-portal primitive (`$portals.X(el, scope) => {update, dispose}`,
> the `nodeView` variant) render correctly into a host element that is created
> imperatively and then positioned/shown/hidden by `@tiptap/extension-bubble-menu`?
> If it holds → reactive `$portals.linkEditor` is the render strategy for `#linkEditor`.
> If it flickers/fails → fall back to mount-once portal + imperative input refresh.

Given/When/Then: **Given** a reactive `{update,dispose}` portal mounted into a bubble-menu
host, **when** the selection/link changes across many show/hide cycles, **then** the
fragment re-renders in place (same DOM node, no remount) and never errors — even while the
host is detached from the document.

## Why this was the #1 build risk (and what was already settled)

- **Already proven** by prior spikes — NOT re-tested here:
  - **Spike 007** — the reactive `{update,dispose}` portal re-renders in place across all 6 targets.
  - **Spike 009** — 007 exercised inside the real TipTap engine (`nodeView` @mention chip).
- **The novel, untested delta** (this spike): the reactive portal's host is managed by the
  **bubble-menu extension**, not by ProseMirror's NodeView machinery. Reading the extension's
  dist (`@tiptap/extension-bubble-menu@3.23.5`) surfaced the exact stressor:
  - **hide** → `this.element.style.visibility='hidden'; this.element.style.opacity='0'; this.element.remove()` — the host is **fully detached from the DOM**.
  - **show** → `(appendToElement ?? this.view.dom.parentElement).appendChild(this.element)` — **re-attached**.
  - positioning → Floating-UI writes `style.left/top/position/width`.
  - It **never** wipes `innerHTML`, clones, or replaces the element — only styles + moves it.
  So the open question reduced to: *does a framework's reactive mount survive its container
  being repeatedly `remove()`-d and `appendChild`-ed, and does `handle.update()` still patch
  while the container is detached?*

## Research

- **Target chosen:** Vue (fastest to iterate; spec recommends one target). The spike
  reproduces the **exact emitted Vue reactive-portal bridge** verbatim
  (`packages/ui/tiptap/packages/vue/src/TipTap.vue` L745–764):
  `renderScope(s) => render(h(Fragment, null, slotFn(s)), container)`, `update:(s)=>renderScope(s)`.
- **Deps:** real `@tiptap/core` + `@tiptap/starter-kit` + `@tiptap/extension-bubble-menu`
  @3.23.5 (the component's actual pinned versions) + `vue@3.5.33`, aliased from the monorepo
  `.pnpm` store. StarterKit v3 bundles the `Link` mark (`setLink`/`unsetLink`/`extendMarkRange`).
- **Deviation from CONVENTIONS** (which say runtime-behavior spikes use the VR rig): a
  focused standalone Vite+Vue app is lighter and more isolated for this *single-target,
  single-mechanism* question, and the cross-6 reactive-portal behavior is already settled by
  007/009. Documented here per the convention's "or deviation documented" clause.

## How to Run

```bash
cd .planning/spikes/016-reactive-portal-bubble-menu-host
node <repo>/node_modules/.pnpm/vite@8.1.0_*/node_modules/vite/bin/vite.js --config vite.config.mjs
# → http://localhost:5016/
```

Then: **Select "TipTap" word** (edit an existing link, prefilled) → **Run stress** (50 cycles).

## Observability

On-page forensic panel (`main.js`): counters for `mounts`, `updates`, `detaches`,
`reattaches`, `renderErrors`, `inputStable` (same `<input>` DOM identity across every patch),
`updatesWhileDetached`; timestamped event log; a rAF poller detects `isConnected`
transitions (the extension's remove/appendChild). A 50-iteration stress routine drives
selection between the link range and an off-link collapsed cursor.

## Investigation Trail

1. Read `TipTap.rozie` + emitted Vue file → confirmed the reactive-portal mechanism is Vue's
   low-level `render(vnode, container)` keyed on container identity, and that the existing
   `bubbleMenu` slot is **mount-once** while `nodeView` is the **reactive** one — Q1 is their
   untested cross-product.
2. Read the bubble-menu extension dist → found `element.remove()`/`appendChild` detach-reattach
   (stronger than the assumed visibility-toggle) → this is the real stressor.
3. Built the Vue+Vite repro mirroring the emitted bridge exactly; mounted the portal in
   `onCreate` (while the menu is hidden → **host starts detached**, matching how TipTap.rozie
   mounts the bubbleMenu portal right after `new Editor`).
4. **First mount into a detached host: no error**, content rendered and held (mounts=1, renderErrors=0).
5. Selecting the existing link → extension `appendChild`-ed the host → the pre-rendered Vue form
   appeared **prefilled with the current href** (`gen 6 · href="https://tiptap.dev"`); 5 updates
   had already run while detached, all clean.
6. **Stress: 211 in-place updates, 207 of them while the host was detached, 0 render errors,
   `inputStable=true`** (same `<input>` reused throughout — patched, never remounted), final
   prefilled href correct. Detach/reattach transitions coalesced to a few because the bubble-menu
   `updateDelay` debounces rapid selection changes — physical DOM moves are debounced, but every
   `handle.update()` still patched in place regardless of connected state.
7. Verified the interactive contract via the live editor: `setLink({href})` applies,
   `unsetLink()` removes, `isActive('link')`/`getAttributes('link')` drive prefill.
8. **Adjacent probe** (custom-attr question for spec §5.3): applied
   `setLink({ href, 'data-course-link': 'course-42' })` → the custom attr was **DROPPED**.

## Results

**VERDICT: ✅ VALIDATED — use reactive `$portals.linkEditor` for the `#linkEditor` slot.**

A framework reactive mount (Vue `render`) into a bubble-menu-managed host **survives the
extension's `remove()`/`appendChild` detach-reattach cycles and patches in place**, including
while the host is detached from the document. No flicker, no remount, no error across 211
updates. The fallback (mount-once + imperative input refresh) is **not needed**.

Why it holds (mechanism, not luck): Vue's `render(vnode, container)` keys on the **container
element's identity** (stores the prior vnode on the element); the bubble-menu extension only
*styles and moves* that element — it never destroys or replaces it — so the element (and its
rendered subtree + patch state) persists across every hide/show, and `render()` operates on
detached nodes fine. This is DOM-level behavior, so it generalizes across frameworks whose
reactive mount keys on container identity (all six do — already proven in-place by 007/009).

### Signal for the build

- **Render strategy:** reactive `$portals.linkEditor(linkEditorEl, scope)` returning
  `{update, dispose}`; mount in `$onMount` right after `new Editor` (host is detached then —
  proven fine); call `handle.update(buildLinkScope())` from `onSelectionUpdate` (mirror
  `refreshActive`/`refreshLink`). Follow the `bubbleMenu`/`nodeView` portal discipline exactly.
- **Two BubbleMenu instances need distinct `pluginKey`s** — the spike used
  `pluginKey: 'rozieLinkEditor'`; the existing general `bubbleMenu` instance must get an explicit
  key too (spec already flags this).
- **Link-aware `shouldShow` works** as specced: `!state.selection.empty || editor.isActive('link') || openFlag`.
- **Per-target residual (smoke-check at build, no spike needed):** Vue proven here; 007/009
  already proved the reactive `{update,dispose}` in-place across all 6. The bubble-menu delta is
  pure DOM detach/reattach (framework-agnostic). Smoke-check **Svelte 5** ($state PortalHost — the
  007 "3-strikes" watch item, validated there) and **Solid** (render disposal tied to container)
  when their leaves are regenerated, but treat as expected-green.
- **⚠️ Spec §5.3 / acceptance criterion 3 correction (custom attrs):** stock StarterKit `Link`
  only allows `href/target/rel/class/title`; `setLink({ 'data-course-link': id })` is **silently
  dropped** (verified: absent from `getAttributes('link')` and serialized HTML). The OLC
  extension-point demo must ship a `Link.extend({ addAttributes: () => ({ 'data-course-link': {…} }) })`
  through the `extensions` prop for the custom attr to persist. The `#linkEditor` slot's `setLink`
  passthrough is necessary but **not sufficient** on its own — document this, and word acceptance
  criterion 3 as "with an attr-extended Link".
