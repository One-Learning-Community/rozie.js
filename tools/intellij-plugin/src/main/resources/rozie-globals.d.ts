// rozie-globals.d.ts — synthetic ambient declarations for the 13 Rozie
// magic identifiers. Source of truth: Plan 13's
// `tools/intellij-plugin/src/main/kotlin/js/rozie/intellij/completion/RozieMagicIdentifiers.kt`
// `MAGIC_IDENTIFIERS` registry. v0.2.0 ships permissive `any`-typed shapes;
// per-component prop interface synthesis is deferred to a v0.3.0 follow-up
// (captured in Plan 08.2-16 SUMMARY "Known Stubs" section).
//
// =============================================================================
// Strategy chosen: B (ambient-decl prefix injected into every Rozie JS fragment)
// =============================================================================
//
// Rationale: Plan 08.2-16 documents two candidate strategies for surfacing
// these declarations to the JetBrains JS resolver inside `.rozie`-injected JS:
//
//   - Strategy A: register `JSPredefinedLibraryProvider` via the
//     `JavaScript.predefinedLibraryProvider` extension point, supplying this
//     `.d.ts` content as a `ScriptingLibraryModel`.
//   - Strategy B: prepend the contents of this file as the `prefix` argument
//     of `MultiHostRegistrar.addPlace(prefix, suffix, host, range)` on every
//     JS injection performed by `RozieMultiHostInjector` (same paren-wrap
//     mechanism Plan 08.2-11 established for `<props>` / `<data>` etc.).
//
// Task 1 investigation findings (Plan 16, 2026-05-17):
//
//   - `com.intellij.lang.javascript.library.JSPredefinedLibraryProvider`
//     EXISTS on BOTH IU-242.24807.4 (floor) and IU-253.28294.334 (ceiling)
//     with identical public API (`getPredefinedLibraries(Project): ScriptingLibraryModel[]`,
//     `getFilesForGlobalsProcessing(): Collection<VirtualFile>`,
//     `getRequiredLibraryFilesForResolve(): Set<VirtualFile>`). Verified via
//     `javap` against the bundled `javascript-plugin.jar` on each leg.
//   - EP qualified name is `JavaScript.predefinedLibraryProvider` — registered
//     in the JS plugin's `META-INF/js-plugin.xml`.
//   - However: the API is **project-wide by design**. `getPredefinedLibraries`
//     receives only a `Project` (no file/scope context). The mapping system
//     (`JSPredefinedLibraryMappings` / `ScriptingLibraryMappings`) lets
//     **users** include/exclude per-scope through UI, but there is no
//     extension hook for a plugin to declare "scope this library to files
//     matching predicate X." The library content is visible to EVERY JS
//     file in the user's project.
//   - This directly violates Plan 16 Pitfall 2 (the negative test
//     `testPlainJsFileDoesNotResolveBareDollarProps` REQUIRES that a plain
//     `.js` file in the user's project NOT resolve bare `$props`). Strategy A
//     would leak `$props` / `$data` / etc. into every `.js` / `.ts` / `.tsx`
//     file in the user's project.
//   - Confirmed by Vue plugin precedent: `vuejs.jar`'s `META-INF/plugin.xml`
//     contains ZERO `JSPredefinedLibraryProvider` / `predefinedLibrary`
//     registrations. Vue handles `vue3-globals` via web-symbols /
//     `JSImplicitElementProvider`, NOT via the predefined-library EP — a
//     deliberate choice consistent with the Pitfall 2 reasoning above.
//
// Decision: ADOPT STRATEGY B. The ambient-decl prefix on every Rozie JS
// injection mitigates Pitfall 2 by construction — the prefix appears in
// injected JS fragments only, and Rozie's `MultiHostInjector` only fires on
// `RozieRootBlock` hosts, which only exist inside `.rozie` files. A plain
// `.js` file cannot reach the prefix because no Rozie injection fires there.
//
// Cost of Strategy B: every Rozie JS injection carries an extra ~500 bytes
// of ambient declarations. T-08.2-37 dispositioned this cost as "accept" —
// the JS parser handles thousands of `declare` statements without measurable
// slowdown, and the per-injection coordinate-mapping invariant is preserved
// (the prefix lives in the injected document only; `InjectedLanguageManager
// .injectedToHost` correctly subtracts the prefix length).
//
// Files-modified consequence: Strategy B requires editing
// `tools/intellij-plugin/src/main/kotlin/js/rozie/intellij/injection/RozieMultiHostInjector.kt`,
// which overlaps `files_modified` with Plans 08.2-15 + 08.2-18. The phase
// execute-orchestrator's wave-5 serialization handles this — Plan 16 lands
// after Plans 15 + 18 if those land first. Documented in Plan 16 SUMMARY.
//
// Future migration path (post-v0.2.0): if JetBrains adds a file-context
// predicate to `JSPredefinedLibraryProvider` (or Vue's web-symbols path
// becomes a stable public API surface for synthetic JS globals), revisit
// Strategy A — the per-injection prefix cost would disappear. Until then,
// Strategy B is the only mechanism that satisfies Pitfall 2.
// =============================================================================

declare const $props: any;
declare const $data: any;
declare const $refs: any;
declare function $emit(name: string, ...args: any[]): void;
declare function $computed<T>(getter: () => T): T;
declare function $onMount(callback: () => void | (() => void)): void;
declare function $onUnmount(callback: () => void): void;
declare function $onUpdate(callback: () => void | (() => void)): void;
declare function $watch<T>(getter: () => T, callback: (newValue: T, oldValue: T) => void): void;
declare const $slots: any;
declare const $el: any;
declare const $portals: any;
declare function $classSelector(className: string): string;
