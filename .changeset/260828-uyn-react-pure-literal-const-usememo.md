---
"@rozie/core": patch
"@rozie-ui/tiptap-react": patch
---

On React, a top-level `.rozie` `<script>` object or array literal const that reads nothing
reactive (`$props`, `$data`, a computed, or a helper) is now constructed ONCE per component
instance, matching Vue/Svelte/Angular/Lit/Solid — instead of being rebuilt with a fresh reference
on every render.

Before this release, only two narrow shapes were stabilized on React: a member-mutated fresh
instance (`new X()` / `[...]` / `{...}` later mutated via `.push`/`.add`/etc.) and a const escaping
into an effect's dependency array. A plain object/array literal outside both shapes — the common
"engine options" / "plugin list" pattern — silently kept a fresh identity every render, so any
`$watch` a child component ran on that prop re-fired on every unrelated parent re-render.

`.rozie` authors do not need to change anything — this is a compiler-side fix. A literal that reads
anything reactive, or cites a non-stable top-level reference (a helper, a plain `let`, another
un-stabilized const), is left byte-identical to before: only a literal PROVABLY safe to build once
gets the new `useMemo(..., [])` wrap.

No other `@rozie-ui/*-react` leaf package changes: across the full shipped component surface, only
`@rozie-ui/maplibre-react`'s `PROGRAMMATIC` and `@rozie-ui/tiptap-react`'s
`STARTERKIT_COLLISION_MAP` qualify for the new stabilization.

**Changeset scope note.** `@rozie-ui/maplibre-react` was removed from this changeset: it is in the changeset config's `ignore` list, and changesets rejects a changeset that mixes ignored and non-ignored packages (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), which made `changeset status` — and any release run — fail outright. The maplibre leaves are deliberately unpublished, so nothing consumer-facing is lost by the removal.
