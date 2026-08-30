---
"@rozie/core": patch
"@rozie-ui/codemirror-react": patch
"@rozie-ui/codemirror-vue": patch
"@rozie-ui/codemirror-svelte": patch
"@rozie-ui/codemirror-angular": patch
"@rozie-ui/codemirror-solid": patch
"@rozie-ui/codemirror-lit": patch
"@rozie-ui/data-table-react": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/tiptap-react": patch
"@rozie-ui/toast-react": patch
---

React's `useMemo` stabilization of an escaping top-level `const` was discovered by a
ONE-LEVEL, NON-TRANSITIVE scan of `Listener.deps` / `LifecycleHook.setupDeps` — a
`new X()` an effect reached only THROUGH a top-level helper (`buildState() ->
gutterCompartment.of(...)`) was invisible to that scan and never got `useMemo`, so React
rebuilt it fresh every render. For an identity-keyed engine object (a CodeMirror6
`Compartment`, a Map/WeakMap/Set used as cross-render scratch state) this silently no-ops
any imperative API keyed on that instance's identity — CodeMirror's
`scheduleReconfigure(compartment, ...)` against an `EditorState` that never saw the fresh
Compartment being the corpus shape that surfaced this. All four turbo gates (build, test,
dist-parity, typecheck) stayed green while the bug was live; only visual regression testing
caught it.

`computeEscapingNames` (`packages/targets/react/src/emit/computeEscapingNames.ts`) now runs
a worklist-to-fixpoint over top-level helper bodies: a helper name reached by an
effect/listener seed is walked (its body inspected for further references) but never itself
promoted into the escaping set — only a non-function top-level `const` binder reached at any
depth through that walk is added. This bound is deliberate: promoting a helper NAME into the
escaping set would flip a hoisted `function` declaration back into a non-hoisted
`useCallback` const, reopening the temporal-dead-zone class the emitter's plain-hoist branch
exists to close, across 860+ shipped `function` declarations corpus-wide. The duplicated seed
computation (previously maintained independently in two places in `emitScript.ts`) is now
one shared computation, so the `useMemo`/`useCallback` wrap decision and the seam-3 staleness
classification can never silently diverge.

The CodeMirror unwind quick 260829-gbs had to revert (`5d48f9156`, because the two
`code-mirror [react]` VR cells failed all retries under the pre-fix emitter) is re-landed:
all six leaves regenerated from the fixed emitter, all ten CM6 `Compartment` instances now
emit as `useMemo(() => new Compartment(), [])` on React, and the five non-React leaves are
byte-identical to the original unwind (`61bf99340`) — this fix is React-only.

Four other shipped React leaves also had a const of this exact shape and drifted as an
expected consequence of the emitter fix — each one individually inspected (correct empty
dep array on a non-reactive initializer, no reactive-read case regressed to `[]`, no
`.current`-read freeze hazard, and zero helper `function`-declaration flipped form anywhere
in the corpus): `@rozie-ui/data-table-react` (`GRID_PAGE_STEP`, `DATA_WRITE_TOKEN_KEY`,
`SELECT_COL_ID`, `EXPANDER_COL_ID`), `@rozie-ui/rete-react`
(`MINIMAP_W`/`MINIMAP_H`/`MINIMAP_DEFAULT_NODE_W`/`MINIMAP_DEFAULT_NODE_H`/
`RESIZE_MIN_FALLBACK`/`SVGNS`/`SOCKET`/`CONN_WARN_SETTLE_MS`/`HISTORY_CAP`/`ZOOM_STEP`),
`@rozie-ui/tiptap-react` (`buildStarterKitConfig`'s `STARTERKIT_COLLISION_MAP` dependency —
no wrap-form change, comment-fidelity only), and `@rozie-ui/toast-react`
(`EXIT_FAILSAFE_MS`).

`@rozie-ui/maplibre-*` ALSO drifted (`DEFAULT_STYLE` gained its correct `useMemo` leading
comment on React) but is deliberately OMITTED from this changeset's front-matter: that
family is in `.changeset/config.json`'s `ignore` list, and listing an ignored package
alongside a non-ignored one makes `changeset status` fail outright (the exact breakage
`8865e96df` repaired — not reintroduced here).

**Comment-fidelity note.** `tryWrapEscapingConstUseMemo` now preserves a wrapped const's own
LEADING comment (previously it silently dropped every comment on any const it wrapped — a
narrow pre-existing gap, newly visible now that the transitive expansion routes many more
corpus consts through it). Deliberately LEADING-only, not trailing: Babel attaches a comment
sitting between two statements to BOTH neighbours, and rendering trailing comments here
double-printed a comment already rendered as the NEXT statement's leading (found on
`@rozie-ui/maplibre-react`'s `DEFAULT_STYLE`/`PROGRAMMATIC` pair during this change's own
census; reverted to leading-only after confirming it fixed the duplicate). A comment that was
previously visible ONLY as a wrapped const's trailing (and is not independently re-rendered
by whatever statement follows) is a known, accepted residual gap — same pre-existing class as
`tryHoistArrowToFunction`'s un-copied comments on a hoisted helper, out of scope for this fix,
logged to `deferred-items.md`.
