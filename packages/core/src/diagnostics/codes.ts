/**
 * Central registry of stable ROZxxx diagnostic codes (D-07).
 *
 * Phase 1 owns ROZ001..ROZ099. Phase 2 starts at ROZ100.
 *
 * Per D-07, codes are namespaced by phase. Per D-06/D-08, every diagnostic
 * carries a code from this registry; renderers (frame.ts) display the code
 * alongside the message and the offending source frame.
 *
 * Constant object pattern (NOT enum) per `verbatimModuleSyntax: true` —
 * tree-shakable and works without `isolatedModules` exemptions.
 *
 * Stability contract: code STRINGS (`'ROZ001'`, etc.) are public API and never
 * renumber. The exported member names (`MISSING_ROZIE_ENVELOPE`, etc.) are
 * developer-facing and may rename across minor versions if clarity demands.
 */
export const RozieErrorCode = {
  // ---- SFC envelope (Plan 02) — ROZ001..ROZ009 ----
  MISSING_ROZIE_ENVELOPE: 'ROZ001',
  MULTIPLE_ROZIE_ENVELOPES: 'ROZ002',
  UNKNOWN_TOP_LEVEL_BLOCK: 'ROZ003',
  DUPLICATE_BLOCK: 'ROZ004',
  // 260603 — error: a literal close sequence (e.g. `</script>` inside a JS
  // string or comment in the `<script>` block) terminated its own block early.
  // Block bodies end at the first literal `</blockname>` sequence regardless of
  // JS/CSS context — exactly like HTML itself, and like Vue/Svelte SFCs
  // (htmlparser2 RAWTEXT for <script>/<style>; the splitter's opaque-block
  // discipline for <props>/<data>/<listeners>/<components>). Without this code
  // the failure surfaced as a misleading cascade (ROZ031 unterminated-string +
  // ROZ003 unknown-block pointing at the author's own template content). The
  // splitter detects the signature — a SECOND `</blockname>` close tag arriving
  // after the block already closed, while no block is open — and reports the
  // real cause, code-framed at the premature close, with the standard HTML
  // escape (`<\/script>`) as the hint. Collateral ROZ002/003/004 noise located
  // after the premature close is suppressed.
  PREMATURE_BLOCK_CLOSE: 'ROZ005', // error — literal `</script>` (or other block close sequence) inside the block's own body ended the block early; escape it as `<\/script>`

  // ---- Block parse — declarative <props>/<data>/<listeners> (Plan 03) — ROZ010..ROZ029 ----
  INVALID_DECLARATIVE_EXPRESSION: 'ROZ010',
  NOT_OBJECT_LITERAL: 'ROZ011',
  LISTENER_KEY_NOT_STRING: 'ROZ012',
  LISTENER_VALUE_NOT_OBJECT: 'ROZ013',
  // A `<props>` entry declared `required: true` also carries a `default:` —
  // the default can never fire (a required prop is always passed), so Rozie
  // drops the default. Warning severity (260521-oao).
  REQUIRED_PROP_HAS_DEFAULT: 'ROZ014',
  // Phase 19 (D-06): a `<listener>` element carries zero `@event` attributes —
  // it wires nothing. The element form replaces the object-literal `<listeners>`
  // walk (which emitted ROZ010/011/012/013 — those DEFINITIONS are kept below
  // but their emission is retired from parseListeners). Error severity; the tag
  // is skipped. Next free code after ROZ014 in the block-parse cluster.
  LISTENER_ELEMENT_NO_EVENT: 'ROZ015',
  // Phase 19 (code-review WR-01): distinct codes for the two OTHER element-walk
  // failure modes, split out of ROZ015 so consumers (IDE suppressors,
  // lint-as-code) can target each precisely. ROZ016 = a non-`<listener>` element
  // inside `<listeners>`; ROZ017 = a `<listener>` left unterminated (no `/>` or
  // close tag).
  LISTENERS_UNEXPECTED_ELEMENT: 'ROZ016',
  // Phase 19 (code-review WR-01): a `<listener>` element is left unterminated —
  // no self-closing `/>` and no closing tag. Error severity; the malformed tag
  // produces no listener and parsing recovers at the next element.
  LISTENER_ELEMENT_UNTERMINATED: 'ROZ017',

  // ---- Script parse (Plan 03) — ROZ030..ROZ049 ----
  SCRIPT_PARSE_ERROR: 'ROZ030',
  SCRIPT_UNRECOVERABLE: 'ROZ031',
  // Phase 9 (WR-03): `<script lang="...">` carries an unrecognized value
  // (e.g. `tsx`). Only `ts`/`typescript` enable the TypeScript parser plugin;
  // any other non-empty `lang` would otherwise parse as plain JS and surface
  // confusing syntax errors with no hint at the real cause.
  SCRIPT_UNRECOGNIZED_LANG: 'ROZ032',

  // ---- Template parse (Plan 03) — ROZ050..ROZ069 ----
  TEMPLATE_UNCLOSED_ELEMENT: 'ROZ050',
  TEMPLATE_MALFORMED_MUSTACHE: 'ROZ051',

  // ---- Modifier grammar (Plan 04) — ROZ070..ROZ079 ----
  MODIFIER_GRAMMAR_ERROR: 'ROZ070',

  // ---- Style parse (Plan 03) — ROZ080..ROZ089 ----
  STYLE_PARSE_ERROR: 'ROZ080',
  STYLE_MIXED_ROOT_SELECTOR: 'ROZ081',
  STYLE_PORTAL_INVALID_NESTING: 'ROZ082', // @portal nested inside @media (or any non-@portal at-rule) — invalid per Spike 004 locked decision #2
  // Spike 004 (string-form `:style` lowering, quick-task 260520-8iu): a
  // string-literal `:style` carries `!important` AND the target's object-form
  // lowering (React/Solid) silently drops it — per Spike 004 locked decision
  // #7 this is a WARN. Codes are public API and never renumber.
  STYLE_IMPORTANT_DROPPED_IN_STYLE_OBJECT: 'ROZ083',
  STYLE_PORTAL_SELECTOR_PARSE_ERROR: 'ROZ084', // @portal block has empty/malformed prelude or unparseable inner content
  // Phase 10: `<style lang="scss">` was used but the optional `sass` (dart-sass)
  // peer dependency is not installed. Error severity, fail loud — there is no
  // SCSS-to-CSS path without the compiler, so emitting partial/raw output would
  // ship un-preprocessed SCSS to the scoping pass. Mirrors the `ROZ085`-must-be-
  // an-error reasoning in 10-SPEC.md.
  STYLE_MISSING_SASS: 'ROZ085',
  // Phase 10: dart-sass threw on invalid SCSS during `sass.compileString`. Per
  // D-08 the exception is COLLECTED, never propagated — the thrown
  // `sass.Exception` becomes this diagnostic and `parseStyle` returns node null.
  STYLE_SCSS_COMPILE_ERROR: 'ROZ086',
  // Phase 10 (D-02): a `<style lang>` value that is neither `scss` nor `css`
  // (nor absent). Error severity with no `<style>` output — feeding Less/Sass-
  // indented syntax to `postcss.parse` would otherwise surface as a confusing
  // ROZ080. The `lang="less"` case carries a Less-aware deferral hint (D-03).
  STYLE_UNRECOGNIZED_LANG: 'ROZ087',

  // ---- ROZ090..ROZ099 reserved for late-Phase-1 needs ----

  // ---- Semantic-binding errors (Phase 2 Plan 02) — ROZ100..ROZ199 ----
  UNKNOWN_PROPS_REF: 'ROZ100', // SEM-01: $props.foo where foo not declared
  UNKNOWN_DATA_REF: 'ROZ101', // SEM-01: $data.foo where foo not declared
  UNKNOWN_REFS_REF: 'ROZ102', // SEM-01: $refs.foo where no template ref="foo"
  UNKNOWN_SLOTS_REF: 'ROZ103', // SEM-01: $slots.foo where no <slot name="foo">
  LIFECYCLE_OUTSIDE_SCRIPT: 'ROZ104', // $onMount/$onUnmount/$onUpdate called outside <script> block / Program top level
  ASYNC_ONMOUNT_RETURN: 'ROZ105', // D-19 edge case: $onMount(async () => …) Promise return cannot be cleanup
  COMPUTED_MAGIC_ACCESS: 'ROZ106', // $props['foo'] — magic accessors require static keys
  CONDITIONAL_CLEANUP_RETURN: 'ROZ107', // $onMount(() => { return condition ? cleanA : cleanB }) — conditional cleanup shape
  NON_FUNCTION_CLEANUP_RETURN: 'ROZ108', // $onMount(() => { return nonFnValue }) — return value is not a function
  WATCH_INVALID_ARGS: 'ROZ109', // $watch requires (getterFn, callbackFn); skipping malformed call. Plan quick-260515-u2b.
  UNKNOWN_MODIFIER: 'ROZ110', // .escspe (typo) — name not registered in ModifierRegistry
  MODIFIER_ARITY_MISMATCH: 'ROZ111', // .debounce() (missing required ms arg)
  MODIFIER_ARG_SHAPE: 'ROZ112', // .outside('not-a-ref') — refExpr expected, got literal
  // Phase 18 (D-08): `$model.<x>` where `x` is not a declared prop at all.
  // Sibling of UNKNOWN_PROPS_REF (ROZ100) in the 100 semantic-binding cluster.
  // NOTE: the 1-0-4 slot is TAKEN (LIFECYCLE_OUTSIDE_SCRIPT) and ROZ100..ROZ112
  // are all allocated — ROZ113 is the next free 100-cluster code (RESEARCH
  // §"Free ROZ Codes", Pitfall 1). Emitted from unknownRefValidator's `scope === 'model'`
  // branch; codeframe; never throws.
  UNKNOWN_MODEL_REF: 'ROZ113', // $model.bogus — 'bogus' is not a declared prop
  // Phase 19 (D-04/D-06): a `<listener :target="...">` whose target is neither
  // `window` nor `document` (nor omitted → `$el`). `$refs.x` and arbitrary
  // expressions are DEFERRED (the IR `decodeTarget` already supports
  // `{kind:'ref'}`, so widening is purely additive). The restriction is enforced
  // at the parser layer, NOT by crippling `decodeTarget`. Error severity; the
  // offending tag produces NO ListenerEntry and never throws. Next free code
  // after ROZ113 in the 100 semantic-binding cluster.
  UNSUPPORTED_LISTENER_TARGET: 'ROZ114',
  // Phase 21 ($expose imperative-handle sigil) — six distinct malformed-form
  // codes in the 100 semantic-binding cluster (ROZ114 was the last allocated;
  // ROZ115–120 were free). `runExposeValidator` emits at most ONE of these per
  // offending site; all error severity; compile() never throws (D-08). Each
  // malformed `$expose` shape gets its own code so IDE suppressors / lint-as-
  // code can target it precisely.
  EXPOSE_ARG_NOT_OBJECT: 'ROZ115', // $expose(x) — argument is not an object literal
  EXPOSE_SPREAD_PROPERTY: 'ROZ116', // $expose({ ...o }) — a property is a spread
  EXPOSE_COMPUTED_KEY: 'ROZ117', // $expose({ [k]: v }) — a property has a computed key
  EXPOSE_VALUE_NOT_FUNCTION: 'ROZ118', // $expose({ a: 1 }) / { a: notInScope } / { a: someComputed } — value is not an in-scope <script> function nor an inline arrow/function
  EXPOSE_DUPLICATE_CALL: 'ROZ119', // two top-level $expose(...) calls — only one is allowed
  EXPOSE_NOT_TOP_LEVEL: 'ROZ120', // $expose(...) called inside a nested function (not <script> Program top level)
  // Quick 260601-jsy — an `$expose`'d method name collides with an emitted event
  // (`$emit('name', ...)`) OR, on class-based targets (Angular), a same-named
  // declared prop (`<props>` field, model or not). On class-based targets the
  // event/prop materializes as a class field (`open = output()` / `date =
  // input()`/`model()`) and the exposed method materializes as a class method —
  // two members cannot share a name, so the Angular emitter silently renames the
  // method (`_open`) or emits a duplicate member, quietly breaking the uniform
  // imperative handle on 1 of 6 targets. Error severity; case-sensitive
  // (`Open` ≠ `open`); fires once per colliding property, code-framed at the
  // `$expose` property; suppressed when the `$expose` call is structurally
  // malformed (ROZ115–117). The diagnostic makes the collision unrepresentable —
  // it is the fix; the emitters are deliberately untouched. Rename the exposed
  // method (events/props keep their public consumer-facing names). Structurally
  // identical to ROZ524 (React auto-setter `set<X>` vs user `setX`), the
  // model-setter-collision precedent. Investigation 260601-jsy confirmed: both a
  // model and a non-model `<props>` field break Angular the same way events do,
  // and ROZ524 does NOT cover the Angular direct-name (`$expose({ date })` vs
  // prop `date`) field-vs-method case — only the React `setX` setter form.
  EXPOSE_EVENT_NAME_COLLISION: 'ROZ121', // $expose({ open }) where 'open' is an emitted event, or (on class-based targets) a same-named declared prop — field/method name clash
  // Quick 260601-l2u — a `$emit` call whose first argument is a STRING LITERAL
  // whose `.value.trim() === ''` (empty OR whitespace-only). An empty event name
  // is meaningless on every target — Angular emits a class field with an empty
  // name; consumers cannot bind it — so this mirrors the ROZ121 collision work:
  // it makes a structurally-meaningless `$emit` shape an explicit compile error
  // instead of broken codegen on 1-of-6 targets. Error severity; emitted from the
  // emitNameValidator across all three expression contexts (<script> + template
  // handlers + <listeners>); fires once per offending call, code-framed at the
  // `$emit` call site; never throws (D-08). Non-string-literal first args
  // (dynamic names — `$emit(name)`, template literals, member exprs) are OUT OF
  // SCOPE — no false positive. ROZ122 is the next free code after ROZ121 in the
  // 100 semantic-binding cluster.
  EMIT_EMPTY_EVENT_NAME: 'ROZ122', // $emit('') / $emit('   ') — empty/whitespace-only string-literal event name
  // Quick 260602-dv1 — a `$refs.<member>` read in a PRE-MOUNT evaluation position.
  // `$refs` are only populated AFTER the component mounts, so reading one in a
  // position that is evaluated during setup/render is a silent cross-target
  // divergence: on solid the eager memo / `$watch` effect reads `$refs` at setup
  // (before the ref callback assigns the element) → TDZ crash / null; on lit and
  // the other targets it simply yields null. This exact shape — `$computed(() =>
  // [rangePlugin({ input: $refs.rangeEnd })])` — was falsified in debug session
  // lit-rangeplugin-shadow-dom (the $computed crashed solid and silently no-op'd
  // lit), and Dan blessed turning the divergence into a LOUD compile error.
  //
  // FLAGGED (the two pre-mount eval contexts), emitted by refsPreMountValidator:
  //   - inside a `$computed(...)` argument body in <script>;
  //   - inside the `$watch(getter, cb)` GETTER (argument[0]) in <script> — the
  //     getter is EAGER on solid: it lowers to `createEffect(on(() => getter(),
  //     …))`, whose deps-fn runs at setup BEFORE the `let elRef = null` ref
  //     binding is assigned (empirically confirmed, 260602-dv1 probe), the same
  //     hazard as a `$computed` body;
  //   - inside a <template> binding (`:plugins="…"`), a `{{ }}` interpolation,
  //     or an `r-if` / `r-show` / `r-for`-iterable expression (all render-time).
  // DO-NOT-FLAG (all run post-mount when invoked): `$onMount`/`$onUnmount`/
  // `$onUpdate` bodies; the `$watch` CALLBACK (argument[1]); `@event` handler
  // expressions (`@click="$refs.x.focus()"`); `<listeners>` handlers; r-model
  // targets; r-for LHS aliases (not a JS expr); and plain function/method bodies
  // (and a `$refs` read at <script> Program top level — a separate concern, not
  // this validator's).
  // OUT OF SCOPE: computed `$refs['x']` is ROZ106's concern (detectMagicAccess
  // returns null for it); non-`$refs` magic accessors are unaffected.
  // Error severity; fires once per offending `$refs` read, code-framed at the
  // read, naming the member. Never throws (D-08): all template re-parses are
  // try/catch-wrapped. ROZ123 is the next free code after ROZ122 in the 100
  // semantic-binding cluster.
  REFS_READ_BEFORE_MOUNT: 'ROZ123', // $refs.x read in a $computed body / $watch getter / template binding|interpolation|r-if|r-show|r-for-iterable — evaluated before mount
  // Phase 23 (angular-cva-forms-integration) — a `$expose`d name that collides
  // with a reserved Angular ControlValueAccessor method name (`writeValue` /
  // `registerOnChange` / `registerOnTouched` / `setDisabledState`) on a
  // component that WILL receive the CVA emit (i.e. its single `model: true`
  // prop is the auto-wired cvaModelProp — cvaModelProp !== null). When CVA is
  // active the Angular component IS the ControlValueAccessor, so a public
  // method with one of those four names would be silently overwritten by (or
  // collide with) the generated accessor method, quietly breaking either the
  // imperative handle OR the forms integration on the Angular target alone.
  // Structurally identical to ROZ121 (EXPOSE_EVENT_NAME_COLLISION): error
  // severity; case-sensitive (`WriteValue` ≠ `writeValue`); fires once per
  // colliding exposed property, code-framed at the `$expose` property;
  // suppressed when the `$expose` call is structurally malformed (ROZ115–117);
  // never throws (D-08). Does NOT fire when CVA is inactive (cva:false, or a
  // non-single-model component) — without an auto-emitted accessor there is no
  // method to collide with. The code definition lives here in core's central
  // registry; the emission logic lives in the Angular package (per
  // 23-RESEARCH.md). ROZ124 is the next free code after ROZ123 in the 100
  // semantic-binding cluster.
  EXPOSE_CVA_NAME_COLLISION: 'ROZ124', // $expose({ writeValue }) (or registerOnChange/registerOnTouched/setDisabledState) on a single-model CVA-receiving Angular component — collides with the auto-emitted ControlValueAccessor method
  // Phase 23 — info diagnostic: a component declares ≥2 `model: true` props, so
  // Angular's single-control ControlValueAccessor contract cannot be satisfied
  // (a CVA wraps exactly ONE form value). No accessor is auto-emitted; the
  // multi-model two-way binding still works via the standard per-prop
  // `valueChange.emit(...)` outputs, just without ngModel/formControl forms
  // integration. Info severity (NOT an error — this is a legitimate,
  // documented shape, e.g. LeafletMap's center+zoom); collected, never throws.
  CVA_MULTI_MODEL_NO_ACCESSOR: 'ROZ125', // ≥2 model:true props — no single-control ControlValueAccessor auto-emitted on the Angular target
  // Phase 23 — info diagnostic: a single-model CVA component declares NO
  // `disabled` prop, so the generated `setDisabledState(isDisabled)` accessor
  // method has no prop to write and is emitted as a documented no-op. Info
  // severity; the component still integrates with Angular forms — it just
  // ignores the disabled state Angular forwards. Collected, never throws.
  CVA_NO_DISABLED_PROP: 'ROZ126', // single-model CVA component with no `disabled` prop — setDisabledState is a no-op on the Angular target
  // Phase 28 (slot/prop same-name collision class) — a `<slot name="X">` whose
  // `X` equals a declared `<props>` key. Unsupportable uniformly across targets
  // because Svelte 5 unifies snippets and props into ONE `$props()` namespace:
  // the regenerated Svelte leaf's `Props` interface would declare `X` TWICE
  // (the prop's type AND a `Snippet`), both sourcing from the same
  // `props.X` key, so setting the prop poisons the slot derivation. The other 5
  // targets keep prop and slot in distinct consumer namespaces (React `slots={{}}`,
  // Vue `#slot`, Angular contentChild, Solid `XSlot`, Lit `.XSlot`) and are
  // immune — making this a silent cross-target divergence on 1 of 6. Conceptually
  // adjacent to ROZ121 (EXPOSE_EVENT_NAME_COLLISION) / ROZ122 — a declaration-
  // namespace collision. Detected by the IR-level `validateSlotPropCollision`
  // validator (collected-not-thrown, D-08), wired into `lowerToIR` so it fires
  // for BOTH `compile()` AND `@rozie/unplugin`. Error severity; case-sensitive;
  // dual code-frame (primary at the slot decl, `related[]` at the colliding prop
  // decl). Remediation: rename the slot (append `Content` / the engine hook name).
  // ROZ127 is the next free code after ROZ126 in the 100 semantic-binding cluster.
  SLOT_PROP_NAME_COLLISION: 'ROZ127', // error — <slot name="X"> where X equals a declared <props> key; Svelte 5 collapses snippets+props into one namespace, so the names cannot coexist
  // Phase 34 (CSS engine-DOM escape hatch) — a `:global(...)` pseudo used in a
  // `<style>` selector. It "works" only on Vue and Svelte (whose compilers
  // understand `:global()`) and is SILENTLY DROPPED on React, Solid, and Lit
  // (in a non-CSS-Modules / runtime-injected / shadow-DOM pipeline the browser
  // sees `:global(...)` as an unknown pseudo and discards the whole rule). That
  // makes it a cross-target-half-supported footgun in the exact same class as
  // ROZ127 / ROZ125. Detected selector-only in parseStyle (the PARSE phase,
  // collected-not-thrown, D-08); compile() merges parse diagnostics, and
  // @rozie/unplugin throws on parse-phase error diagnostics (transform.ts) — so
  // it surfaces on BOTH paths. (Unlike ROZ127, which IS a lowerToIR validator;
  // ROZ128 never touches a lowerToIR validator.)
  // Remediation: use the `:root { .selector { ... } }` engine-DOM escape hatch,
  // which lowers to the engineRules bucket and emits unscoped/global across all
  // six targets. ROZ128 is the next free code after ROZ127 in the 100 cluster.
  STYLE_GLOBAL_PSEUDO_FORBIDDEN: 'ROZ128', // error — :global(...) used in <style>; works only on Vue/Svelte, silently dead on React/Solid/Lit. Use :root { ... } for the engine-DOM escape hatch.
  // Phase 36 ($provide/$inject cross-component context primitive) — four
  // malformed-form codes in the 100 semantic-binding cluster (D-04 locked names;
  // ROZ128 was the verified highest used, so ROZ129–132 were free). The context
  // validator (contextValidator.ts, mirroring runExposeValidator) emits these
  // collected-not-thrown (D-08) — compile() never throws on malformed
  // $provide/$inject. Each malformed shape gets its own code so IDE suppressors /
  // lint-as-code can target it precisely. The `$provide`/`$inject` keys MUST be
  // string literals (ROZ129/130) — no runtime-computed token keys (ASVS V5,
  // T-36-01). `$provide` is a statement-only sigil (ROZ131); `$inject` must bind
  // to a `const x = $inject(...)` (ROZ132).
  INVALID_PROVIDE_KEY: 'ROZ129', // error — $provide(key, …) key is not a string literal.
  INVALID_INJECT_KEY: 'ROZ130', // error — $inject(key, …) key is not a string literal.
  PROVIDE_NOT_STATEMENT: 'ROZ131', // error — $provide(...) used in expression position (must be a top-level statement).
  INJECT_UNBOUND: 'ROZ132', // error — $inject(...) not bound to a `const x = $inject(...)`.
  // Phase 36 (code-review CR-02) — a `$provide('key')` call with no value (or a
  // non-expression second argument). The collector silently drops a valueless
  // $provide (no ProvideEntry, no emit), so an author who forgot the value got a
  // clean compile that provided nothing — every descendant $inject('key') then
  // resolved to fallback/undefined with zero indication why. This is the exact
  // "silent compile failure" anti-pattern ROZ977 outlaws. Error severity; emitted
  // from runContextValidator alongside ROZ129/ROZ131 when a $provide call site
  // has arguments.length < 2 (or arguments[1] is not an expression). ROZ133 is
  // the next free code after ROZ132 in the 100 semantic-binding cluster.
  PROVIDE_MISSING_VALUE: 'ROZ133', // error — $provide(key) called with no value (or a non-expression second argument); $provide(key, value) requires a value.

  // ---- Compile-time correctness errors (Phase 2 Plan 02) — ROZ200..ROZ299 ----
  WRITE_TO_NON_MODEL_PROP: 'ROZ200', // SEM-02: $props.foo = … where foo lacks model: true (Phase 2 success criterion 2)
  WRITE_TO_REF: 'ROZ201', // $refs.foo = … (refs are read-only DOM-element wrappers)
  RESERVED_IDENTIFIER_COLLISION: 'ROZ202', // <data> field or r-for loop var named $el / $props / $data / $refs / $slots / $emit / $event / $attrs / $listeners / $restoreFocus / $model / $expose / $provide / $inject. ($event is the closure-param name for event-handler emits — see emitTemplate's `($event) =>` convention in target-{react,svelte,solid,lit}.) Wired in semantic/validators/reservedIdentifierValidator.ts — keep RESERVED_SIGILS there in sync with this list.
  // 260530: expression-context `++`/`--` on reactive state ($data.<key> or a
  // model:true $props.<key>) where the UpdateExpression's value is CONSUMED
  // (parent is not an ExpressionStatement). Such reads can't be satisfied by a
  // functional-updater setter (the setter returns the NEW value, not the
  // postfix pre-increment value), so the setter-based targets (React/Solid/
  // Angular) would otherwise emit uncompilable code. Statement-context
  // `$data.x++` is fine (lowered through the setter by cb341f12) — only the
  // value-consumed form trips this. Detected by semantic/validators/
  // updateExpressionValidator.ts, wired into analyzeAST so it fires once for
  // both compile() and @rozie/unplugin (both route through lowerToIR).
  UPDATE_EXPRESSION_VALUE_CONSUMED: 'ROZ203', // error — expression-context ++/-- on reactive state isn't lowerable
  // Phase 18 (D-07): a write to `$props.<x>` where `x` IS a `model: true` prop.
  // `$props` is read-only universally (SPEC Req 3) — a model prop is written via
  // the new producer-side `$model.<x>` sigil, never `$props.<x>`. Replaces the
  // old `if (decl.isModel) return;` early-return in propWriteValidator. ROZ200
  // (WRITE_TO_NON_MODEL_PROP) stays unchanged for the non-model case — two
  // distinct author mistakes, two distinct messages. The message names
  // `$model.<x>` as the fix; codeframe + related decl pointer (makeRoz200 shape).
  WRITE_TO_MODEL_PROP_VIA_PROPS: 'ROZ204', // error — $props.<modelProp> = … ; use $model.<x>
  // Phase 18 (D-08): `$model.<x>` where `x` IS a declared prop but lacks
  // `model: true`. `$model`'s valid keys are exactly the model-prop subset of
  // <props> (SPEC Req 4). Emitted from unknownRefValidator's `scope === 'model'`
  // branch; hint: add `model: true` to the prop or use `$data`. Names the prop;
  // codeframe; never throws.
  MODEL_ACCESS_NON_MODEL_PROP: 'ROZ205', // error — $model.<nonModelProp>
  // Phase 19 (D-08): a `<listener>` element placed inside `<template>` instead
  // of the `<listeners>` block. `r-if` on a `<listener>` means conditional
  // attach/detach (not conditional render like a `<template>` `r-if`), so the
  // tag is forbidden in `<template>`. Detected by the dedicated
  // `listenerElementValidator` over `walkTemplateElements` (case-folded so both
  // `<listener>` and PascalCase `<Listener>` trip it, never routed to component
  // resolution). Error severity; never throws. Next free code after ROZ205.
  LISTENER_ELEMENT_MISPLACED: 'ROZ206',

  // ---- Warnings (Phase 2 Plan 02) — ROZ300..ROZ399 ----
  RFOR_MISSING_KEY: 'ROZ300', // SEM-03: r-for without :key
  RFOR_KEY_IS_LOOP_VARIABLE: 'ROZ301', // SEM-03: :key="index" / :key="item" (loop var)
  RFOR_KEY_IS_NON_PRIMITIVE: 'ROZ302', // :key="someObj" (Pitfall 6 secondary case)
  /** @deprecated placeholder — accessibility lint warnings deferred per CONTEXT.md A7. */
  RIF_ACCESSIBILITY_PLACEHOLDER: 'ROZ303', // RESERVED — not emitted in Phase 2 (deferred per A7)

  // ---- @rozie/unplugin configuration errors (Phase 3 D-52) — ROZ400..ROZ419 ----
  UNPLUGIN_TARGET_REQUIRED: 'ROZ400', // D-49: target option missing
  UNPLUGIN_TARGET_UNKNOWN: 'ROZ401', // target value not in 'vue'|'react'|'svelte'|'angular'
  UNPLUGIN_TARGET_NOT_YET_SUPPORTED: 'ROZ402', // Phase 3 only ships 'vue'; react/svelte/angular ROZ402 until later phases
  UNPLUGIN_PEER_DEP_MISSING: 'ROZ403', // @rozie/runtime-vue or @vitejs/plugin-vue not resolvable (Pitfall 8)
  UNPLUGIN_PLUGIN_CHAIN_MISORDER: 'ROZ404', // detected vite-plugin-vue lacking; D-25 chain broken
  UNPLUGIN_ANGULAR_OPTIONS_INVALID: 'ROZ405', // Phase 23 — malformed `angular` config shape (e.g. angular.cva not boolean); thrown at factory-call time before Vite hooks (T-23-04-OPT)

  // ---- @rozie/target-vue lowering errors (Phase 3 D-52) — ROZ420..ROZ449 ----
  // (Reserved as safety net per CONTEXT D-52 — none anticipated for v1.)
  TARGET_VUE_RESERVED: 'ROZ420', // RESERVED placeholder; emitter throws this only on internal-invariant violation
  TARGET_VUE_RHTML_WITH_CHILDREN: 'ROZ421', // r-html via v-html cannot coexist with children; mirrors ROZ620/721

  // ---- Phase 3 emitter warnings — ROZ450..ROZ499 (Phase 7 hardening) ----

  // ---- @rozie/unplugin Solid-branch + @rozie/target-solid errors (Phase 06.3 — D-140 amended) — ROZ810..ROZ812 ----
  // NOTE: D-140 originally claimed ROZ800..ROZ829 but ROZ800/ROZ801 are already
  // allocated to Phase 6 compile() errors and ROZ850 is allocated to
  // CLI_INVALID_TARGET. Phase 06.3 codes use the unclaimed sub-range
  // ROZ810..ROZ819 for Solid; ROZ812 reserved for runtime-solid warnings.
  UNPLUGIN_SOLID_PEER_DEP_MISSING: 'ROZ810', // vite-plugin-solid not resolvable from cwd (D-139)
  UNPLUGIN_SOLID_DEP_MISSING: 'ROZ811',       // solid-js (^1.8) not resolvable from cwd (D-139)
  // ---- @rozie/runtime-solid warnings (Phase 06.3) — ROZ812 ----
  RUNTIME_SOLID_CONTROLLABLE_MODE_FLIP: 'ROZ812', // D-135 — createControllableSignal detected parent flipping controlled/uncontrolled mid-lifecycle
  // ---- @rozie/target-solid lowering errors (Phase 07.1) — ROZ813..ROZ819 ----
  TARGET_SOLID_RESERVED: 'ROZ813', // internal-invariant placeholder; mirrors TARGET_SVELTE_RESERVED/TARGET_ANGULAR_RESERVED. Solid emitter raises this when a modifier has no solid() hook.

  // ---- @rozie/unplugin React-branch configuration errors (Phase 4 D-63) — ROZ500..ROZ519 ----
  UNPLUGIN_REACT_PEER_DEP_MISSING: 'ROZ500', // D-59: neither @vitejs/plugin-react nor @vitejs/plugin-react-swc installed (Pitfall 9)
  UNPLUGIN_REACT_DEP_MISSING: 'ROZ501', // react peer dep not resolvable
  UNPLUGIN_REACT_PLUGIN_CHAIN_MISORDER: 'ROZ502', // detected plugin-react/swc lacking; D-58 chain broken (no enforce: 'pre' on @rozie/unplugin)

  // ---- @rozie/target-react lowering errors (Phase 4 D-63) — ROZ520..ROZ549 ----
  TARGET_REACT_RHTML_WITH_CHILDREN: 'ROZ520', // r-html with children — React's dangerouslySetInnerHTML can't coexist with children (Pitfall 10)
  TARGET_REACT_NESTED_STATE_MUTATION: 'ROZ521', // Pitfall 7 — $data.foo.bar = 'x' nested member writes; v1 warns + leaves AST unchanged
  TARGET_REACT_MODULE_LET_AUTO_HOISTED: 'ROZ522', // Pitfall 3/8 — module-scoped `let X` referenced from LifecycleHook setup auto-hoisted to useRef
  TARGET_REACT_MODULE_LET_UNHOISTABLE: 'ROZ523', // Pitfall 3/8 — module-scoped `let X` referenced too indirectly to safely auto-hoist; user must refactor
  TARGET_REACT_SETTER_NAME_COLLISION: 'ROZ524', // Phase 07.7 — user-defined function `set<X>` collides with auto-generated useState/useControllableState setter `setX` for state/model prop X; emits "already declared" + infinite recursion when `$data.X = v` rewrites to `setX(v)` inside the same-named user wrapper

  // ---- @rozie/runtime-react warnings (Phase 4 D-63) — ROZ550..ROZ579 ----
  RUNTIME_REACT_CONTROLLABLE_MODE_FLIP: 'ROZ550', // D-57 — useControllableState detected parent flipping controlled/uncontrolled mid-lifecycle

  // ---- ROZ580..ROZ599 reserved for Phase 7 hardening ----

  // ---- @rozie/unplugin Svelte-branch + @rozie/target-svelte errors (Phase 5) — ROZ600..ROZ649 ----
  UNPLUGIN_SVELTE_PEER_DEP_MISSING: 'ROZ600', // @sveltejs/vite-plugin-svelte not resolvable from cwd
  UNPLUGIN_SVELTE_DEP_MISSING: 'ROZ601', // svelte itself (^5) not resolvable from cwd
  UNPLUGIN_SVELTE_PLUGIN_CHAIN_MISORDER: 'ROZ602', // RESERVED — enforce:'pre' guarantees this; placeholder for future
  TARGET_SVELTE_RHTML_WITH_CHILDREN: 'ROZ620', // r-html with children; mirrors Vue/React Pitfall 10
  TARGET_SVELTE_RESERVED: 'ROZ621', // internal-invariant placeholder; mirrors TARGET_VUE_RESERVED

  // ---- @rozie/runtime-svelte warnings (Phase 5) — ROZ650..ROZ699 (RESERVED for v2 helpers) ----

  // ---- @rozie/unplugin Angular-branch + @rozie/target-angular errors (Phase 5 D-72) — ROZ700..ROZ749 ----
  UNPLUGIN_ANGULAR_PEER_DEP_MISSING: 'ROZ700', // @analogjs/vite-plugin-angular not resolvable from cwd (D-72)
  UNPLUGIN_ANGULAR_DEP_MISSING: 'ROZ701', // @angular/core (^17) not resolvable
  UNPLUGIN_ANGULAR_VITE_VERSION_TOO_LOW: 'ROZ702', // analogjs requires Vite ^6 (RESEARCH OQ6)
  UNPLUGIN_ANGULAR_PLUGIN_CHAIN_MISORDER: 'ROZ703', // RESERVED — enforce:'pre' guarantees this
  TARGET_ANGULAR_RFOR_MISSING_KEY: 'ROZ720', // Angular @for REQUIRES track expression (Pitfall 3); upgrade ROZ300 warning to error for Angular target
  TARGET_ANGULAR_RHTML_WITH_CHILDREN: 'ROZ721', // r-html via [innerHTML] cannot coexist with children
  TARGET_ANGULAR_RESERVED: 'ROZ722', // internal-invariant placeholder

  // ---- @rozie/runtime-angular warnings (Phase 5) — ROZ750..ROZ799 (RESERVED for v2 helpers) ----

  // ---- Phase 6 (ROZ800..ROZ899) — D-96 sub-ranges =====
  //   ROZ800..ROZ819 — @rozie/core compile() public-API errors
  //   ROZ820..ROZ849 — @rozie/babel-plugin (Plan 06-04)
  //   ROZ850..ROZ879 — @rozie/cli argv + filesystem errors (Plan 06-03)
  //   ROZ880..ROZ899 — .d.ts emission errors (Plan 06-02)
  COMPILE_INVALID_TARGET: 'ROZ800', // unknown target token in opts.target
  COMPILE_INVALID_OPT_COMBO: 'ROZ801', // reserved — disallowed opts combination
  // ---- @rozie/babel-plugin (Plan 06-04) — ROZ820..ROZ829 ----
  BABEL_PLUGIN_INVALID_TARGET: 'ROZ820', // missing or invalid `target` option (vue|react|svelte|angular required)
  BABEL_PLUGIN_NO_FILENAME: 'ROZ821', // cannot resolve relative .rozie path without state.filename / file.opts.filename
  BABEL_PLUGIN_COMPILE_ERROR: 'ROZ822', // compile() returned severity:'error' diagnostics during sibling write
  BABEL_PLUGIN_SIBLING_WRITE_FAIL: 'ROZ823', // fs writeFileSync failed when emitting sibling .{ext}/.d.ts/.module.css/.global.css
  // ROZ824..ROZ829 reserved for future @rozie/babel-plugin needs (ROZ830..ROZ849 reallocated to Lit per D-LIT-19)
  // ---- @rozie/unplugin Lit-branch + @rozie/target-lit + @rozie/runtime-lit (Phase 06.4 — D-LIT-19 Option A) — ROZ830..ROZ849 ----
  // NOTE: This block sits inside the broader ROZ820..ROZ849 babel-plugin reserved range from Phase 6.
  // Babel-plugin currently uses ROZ820..ROZ823; ROZ824..ROZ829 stay reserved for future babel-plugin needs.
  // ROZ830..ROZ849 is hereby reallocated for Lit. The 850-range CLI block is untouched.
  UNPLUGIN_LIT_PEER_DEP_MISSING: 'ROZ830', // lit (^3.2) not resolvable from cwd
  UNPLUGIN_LIT_SIGNALS_PEER_DEP_MISSING: 'ROZ831', // @lit-labs/preact-signals (^1) not resolvable from cwd
  // ---- @rozie/target-lit lowering errors (Phase 07.1) — ROZ832..ROZ839 ----
  TARGET_LIT_RESERVED: 'ROZ832', // internal-invariant placeholder; mirrors TARGET_SVELTE_RESERVED/TARGET_ANGULAR_RESERVED. Lit emitter raises this when a modifier has no lit() hook.
  TARGET_LIT_RHTML_WITH_CHILDREN: 'ROZ833', // r-html via unsafeHTML cannot coexist with children; mirrors ROZ620/721
  // ROZ834..ROZ839 reserved for future Lit-emitter diagnostics
  RUNTIME_LIT_CONTROLLABLE_MODE_FLIP: 'ROZ840', // createLitControllableProperty parent-flip warning (D-LIT-10)
  // ROZ841..ROZ849 reserved for future @rozie/runtime-lit warnings
  // ---- @rozie/cli argv parsing + filesystem errors (Plan 06-03) — ROZ850..ROZ879 ----
  CLI_INVALID_TARGET: 'ROZ850', // unknown --target token (commander InvalidArgumentError)
  CLI_MISSING_INPUT: 'ROZ851', // no .rozie files matched after expandInputs
  CLI_OUT_REQUIRED: 'ROZ852', // --out required for multiple inputs or multiple targets
  CLI_NULL_BYTE_INPUT: 'ROZ853', // null-byte injection in input arg (carries forward unplugin/transform.ts:235-237)
  CLI_NON_ROZIE_INPUT: 'ROZ854', // file input that doesn't end with .rozie
  CLI_REACT_REQUIRES_OUT_DIR: 'ROZ855', // target=react with no --out — sidecars (.d.ts/.module.css/.global.css) cannot stream to stdout
  // ROZ856..ROZ879 reserved for future @rozie/cli needs
  // ROZ880..ROZ899 reserved for .d.ts emitter (Plan 06-02)

  // ---- Phase 06.1 source-map composition (D-111) — ROZ900..ROZ919 ----
  // ROZ900..ROZ909: composeMaps errors (malformed child map, mismatched offsets, @ampproject/remapping failures)
  SOURCEMAP_COMPOSE_FAILED: 'ROZ900', // composeMaps() threw or returned null
  SOURCEMAP_CHILD_MAP_MALFORMED: 'ROZ901', // child map missing required Source Map v3 fields
  SOURCEMAP_OFFSET_OUT_OF_RANGE: 'ROZ902', // ChildMap.outputOffset exceeds shellMs output length
  SOURCEMAP_REMAPPING_THREW: 'ROZ903', // @ampproject/remapping internal error
  // ROZ910..ROZ919: emit-time position-anchoring failures
  SOURCEMAP_AST_NODE_MISSING_LOC: 'ROZ910', // synthesized AST node lacks loc; falls back to nearest segment (D-104/D-106)
  SOURCEMAP_PARSER_OFFSET_INVALID: 'ROZ911', // @babel/parser startLine/startColumn validation failed

  // ---- Phase 06.2 component composition (D-123 sub-allocation) — ROZ920..ROZ939 ----
  // D-123 reserves ROZ920..ROZ939 for the <components> block + composition
  // diagnostics. ROZ920..ROZ924 are the 5 core composition codes; ROZ925..928
  // are per-primitive escape-hatch sub-codes resolving Open Question §2 from
  // RESEARCH.md (per-primitive hint messages provide better DX than a flat
  // ROZ920). ROZ929..ROZ939 reserved for future ROZ-COMP needs.
  UNKNOWN_COMPONENT: 'ROZ920', // PascalCase tag matches neither outer name nor <components> entry
  NON_ROZIE_IMPORT_PATH: 'ROZ921', // <components> entry value is not a `.rozie` string literal
  LOWERCASE_LIKELY_TYPO: 'ROZ922', // warning: <counter> when Counter is declared
  DUPLICATE_COMPONENT_IMPORT_PATH: 'ROZ923', // warning: two <components> entries point at the same .rozie path
  UNUSED_COMPONENT_ENTRY: 'ROZ924', // warning: declared <components> entry never used in template
  // D-124 — per-primitive escape-hatch sub-codes (4 sub-codes, framework-specific hints)
  ESCAPE_HATCH_REACT_SUSPENSE: 'ROZ925', // <Suspense> — use React directly
  ESCAPE_HATCH_VUE_TELEPORT: 'ROZ926', // <Teleport> — use Vue directly
  ESCAPE_HATCH_NG_CONTAINER: 'ROZ927', // <ng-container> — use Angular directly
  ESCAPE_HATCH_SVELTE_FRAGMENT: 'ROZ928', // <svelte:fragment> — use Svelte directly
  // ROZ929..ROZ939 reserved for future ROZ-COMP needs

  // ---- Phase 07.2 consumer-side slot fills (D-08 sub-allocation) — ROZ940..ROZ959 ----
  // ROZ940..ROZ947 are the 8 core consumer-side codes per CONTEXT.md D-08.
  // ROZ948..ROZ959 reserved for surface-derived codes that emerge from the
  // Wave-1/Wave-2 per-target emitters or the dogfood gate.
  DUPLICATE_DEFAULT_FILL: 'ROZ940',                // error — locked in SPEC.md R3; loose children + explicit <template #default>
  UNKNOWN_SLOT_NAME: 'ROZ941',                     // warn  — consumer fills a slot the producer doesn't declare (typo catch)
  DUPLICATE_NAMED_FILL: 'ROZ942',                  // error — two sibling <template #header> directives
  REPROJECTION_UNDECLARED_WRAPPER_SLOT: 'ROZ943',  // error — wrapper forwards a slot it doesn't itself declare
  REPROJECTION_UNDECLARED_INNER_SLOT: 'ROZ944',    // warn  — wrapper forwards into a slot the inner producer doesn't declare
  CROSS_PACKAGE_LOOKUP_FAILED: 'ROZ945',           // error — npm/relative resolution of a <components> importPath returns null
  DYNAMIC_NAME_EXPRESSION_INVALID: 'ROZ946',       // error — `<template #[expr]>` bracketed text fails to parse as a JS expression
  SCOPED_PARAM_MISMATCH: 'ROZ947',                 // error — D-09 — consumer destructures a param the producer SlotDecl.params doesn't declare
  SCOPED_PARAMS_ALL_DROPPED: 'ROZ948',             // warn  — scoped-params destructure had properties but none resolved to simple bindings (e.g. spread, computed keys, rename)

  // ---- Phase 07.3 consumer-side two-way binding — ROZ949..ROZ951 ----
  // Per 07.3-SPEC.md §Diagnostic Code Assignments: ROZ949 is the next free
  // code after the 07.2 cleanup that registered ROZ948 (ROADMAP working-list
  // mentioned ROZ950 but predated that cleanup; SPEC.md is authoritative).
  TWO_WAY_PROP_NOT_MODEL: 'ROZ949',           // error — r-model:prop= where producer prop lacks model:true (dual-frame: consumer site + producer decl)
  TWO_WAY_ARG_OR_TARGET_INVALID: 'ROZ950',    // error — r-model: with empty arg (`r-model:=`), OR applied to non-component HTML tag (`<div r-model:foo=`)
  TWO_WAY_LHS_NOT_WRITABLE: 'ROZ951',         // error — RHS not a writable lvalue per 07.3-CONTEXT D-03 permissive rule (literal/ternary/call/$computed)
  TWO_WAY_DIRECTIVE_TYPO: 'ROZ952',           // error — colon-form directive `r-<base>:<arg>` whose `<base>` is a Levenshtein near-miss of `model` (e.g. `r-modle:open`); `model` is the only directive taking a colon argument, so the typo'd directive would otherwise be silently dropped. did-you-mean suggests `r-model:<arg>`.

  // ---- Phase 11 r-match construct — ROZ953..ROZ959 ----
  // The switch-style `r-match` / `r-case` / `r-default` trio. Six error
  // conditions + one warning, all detected inline in the lowerTemplate
  // match-grouping pass (D-05) and collected-not-thrown.
  MATCH_EMPTY_DISCRIMINANT: 'ROZ953',   // error — r-match host with no value (`<template r-match>` / `<template r-match="">`)
  MATCH_STRAY_CHILD: 'ROZ954',          // error — r-match host child that is neither r-case nor r-default
  MATCH_CASE_NO_VALUE: 'ROZ955',        // error — valueless r-case (hint: did you mean r-default?)
  MATCH_CASE_WITH_FOR: 'ROZ956',        // error — r-case + r-for on the same element
  MATCH_DEFAULT_NOT_LAST: 'ROZ957',     // error — r-default is not the last branch of the match
  MATCH_MULTIPLE_DEFAULT: 'ROZ958',     // error — more than one r-default in a single r-match
  MATCH_DUPLICATE_CASE: 'ROZ959',       // warning — duplicate literal r-case value (first occurrence wins, like `switch`)

  // ---- Phase 12 r-model modifiers — ROZ960..ROZ964 ----
  // The r-model modifier chain: an unknown / misused modifier is a hard
  // error, never a silent drop. All four are detected inline in the
  // lowerTemplate r-model branch (collected-not-thrown), parallel to where
  // event modifiers resolve.
  RMODEL_UNKNOWN_MODIFIER: 'ROZ960',        // error — unknown r-model modifier (did-you-mean among model modifiers)
  RMODEL_EVENT_MODIFIER_MISUSED: 'ROZ961',  // error — a valid event modifier used on r-model
  DIRECTIVE_TAKES_NO_MODIFIERS: 'ROZ962',   // error — modifier on r-if/r-for/r-show/r-html/r-text
  RMODEL_BUILTIN_ON_TWO_WAY: 'ROZ963',      // error — built-in r-model modifier on consumer-side r-model:propName
  // CR-01 (12-REVIEW) — a value-transform modifier (.number/.trim/custom) on a
  // checkbox/radio r-model has no effect: the bound value is a boolean
  // `checked` (checkbox) or a fixed `value` string chosen by the input, not a
  // user-typed string the transform could coerce. Phase 12's whole purpose is
  // killing silent drops, so this is a warning emitted at per-target emit
  // time (the React/Solid checkbox/radio branches) rather than a silent
  // discard. `.lazy` is exempt — `change` is already the checkbox/radio
  // commit event, so `.lazy` is a genuine no-op there, not a dropped intent.
  RMODEL_MODIFIER_NOT_APPLICABLE: 'ROZ964', // warning — value-transform modifier on a checkbox/radio r-model

  // ---- Phase 13 $classSelector — ROZ965..ROZ967 ----
  // The `$classSelector('<class>')` compile-time helper lowers a class name to
  // a CSS selector matching the class as it actually renders (literal `.grip`
  // on five targets, runtime `"." + styles.grip` on React). Three validation
  // rules guard the argument; all three are hard errors detected by the
  // IR-level `validateClassSelector` validator (collected-not-thrown), wired
  // into `lowerToIR` so they fire for both `compile()` and `@rozie/unplugin`.
  // `ROZ964` is the verified current highest (Phase 12 RMODEL fix) — these do
  // NOT collide.
  CLASS_SELECTOR_ARG_NOT_LITERAL: 'ROZ965', // error — R3: $classSelector argument is not a string literal
  CLASS_SELECTOR_UNKNOWN_CLASS: 'ROZ966',   // error — R4: class not declared in the component's <style> scope; did-you-mean hint
  CLASS_SELECTOR_INVALID_TOKEN: 'ROZ967',   // error — R5: multi-token / dotted / combinator / `#` argument (fails the bare-class-token regex)
  // React emit-config error: the React lowering of `$classSelector` emits a
  // runtime `"." + styles.<class>` expression, but `emitReact` only emits the
  // `styles` CSS-Modules import when `opts.source` is supplied (it needs the
  // raw source to slice rule bodies). On the back-compat no-`source` emit path
  // the lowering would reference an unimported `styles`, so emitReact refuses
  // and reports this instead of producing a dangling reference.
  CLASS_SELECTOR_REACT_NO_SOURCE: 'ROZ968', // retired (Phase 25) — formerly fired when $classSelector was used in a React emit without opts.source. React now emits plain attribute-scoped CSS with no `styles` import, so the guard no longer fires; the code is retained (never reused) for public-API stability.

  // ---- Phase 14 attribute fallthrough — ROZ969..ROZ971 ----
  // Cross-framework attribute fallthrough: the `r-bind="<expr>"` bare-spread
  // form, the `$attrs` magic accessor, and `<rozie inherit-attrs>` auto-
  // fallthrough. `ROZ968` (Phase 13 $classSelector) was the highest assigned
  // code when this cluster was added — these do NOT collide. (The registry has
  // since grown past it; e.g. ROZ978 for Phase 26 bare-sigil rejection.)
  R_BIND_COLON_FORM: 'ROZ969',             // error — R1: `r-bind:foo="x"` colon form is not supported (use the `:foo` shorthand or the bare-spread `r-bind="obj"`)
  ATTR_FALLTHROUGH_MULTI_ROOT: 'ROZ970',   // error — R8: a multi-root template with auto-fallthrough enabled has no single root to receive inherited attributes
  ATTR_DOUBLE_APPLY: 'ROZ971',             // warning — R9: `$attrs` referenced (e.g. via `r-bind="$attrs"`) while auto-fallthrough is still on — attributes would be applied twice

  // ---- Phase 15 listener fallthrough — ROZ972..ROZ974 ----
  // Cross-framework listener fallthrough: the `r-on="<expr>"` object-spread
  // form, the `$listeners` magic accessor, and `<rozie inherit-listeners>`
  // auto-fallthrough. `ROZ971` is the verified current highest (Phase 14
  // ATTR_DOUBLE_APPLY) — these do NOT collide. ROZ973/ROZ974 are deliberately
  // SEPARATE codes from their Phase 14 attribute-side analogues (ROZ970 /
  // ROZ971) per SPEC R8/R9: the two checks are INDEPENDENT — a multi-root
  // component with `inherit-attrs="false"` but default `inherit-listeners`
  // produces ROZ973 (not ROZ970), and vice versa.
  R_ON_COLON_FORM: 'ROZ972',                  // error — R1: `r-on:click="x"` colon form is not supported (use the single-event `@click` syntax or the bare object-spread `r-on="{ click: fn }"`)
  LISTENER_FALLTHROUGH_MULTI_ROOT: 'ROZ973',  // error — R8: a multi-root template with auto-listener-fallthrough enabled has no single root to receive inherited listeners (INDEPENDENT of ROZ970)
  LISTENER_DOUBLE_APPLY: 'ROZ974',            // warning — R9: `$listeners` referenced (e.g. via `r-on="$listeners"`) while auto-listener-fallthrough is still on — listeners would be applied twice (INDEPENDENT of ROZ971)

  // ---- Phase 16 $restoreFocus — ROZ975..ROZ976 ----
  // The `$restoreFocus(selector, idx)` sigil restores focus to a keyed-list row
  // after a state mutation that reorders the list. The validator (modeled after
  // validateClassSelector) enforces literal-selector + arity rules at compile
  // time, wired into `lowerToIR` so both `compile()` and `@rozie/unplugin`
  // catch errors. SPEC R9/R10.
  RESTORE_FOCUS_NON_LITERAL_SELECTOR: 'ROZ975', // error — SPEC R9: $restoreFocus first arg is not a string literal
  RESTORE_FOCUS_BAD_ARITY:            'ROZ976', // error — SPEC R9: $restoreFocus called with wrong number of arguments

  // ---- compile() empty-code guard — ROZ977 ----
  // Fail-loud sentinel for the "silent compile failure" anti-pattern: if
  // `compile()` is about to return `code: ''` with NO error-level diagnostics
  // already in the bag, emit this code so consumers see an explicit signal
  // instead of an empty string. The trigger surfaced in 260526-uj3: a parser
  // bug silently dropped a required block, downstream emit produced empty
  // output, and the failure was invisible until the docs build crashed with
  // a generic ROZ500. This is the safety net.
  COMPILE_EMPTY_CODE_NO_DIAGNOSTICS:  'ROZ977', // error — internal: compile() emit produced empty code with no error diagnostics (parser/lowerer/emitter internal failure)

  // ---- Phase 26 bare-sigil rejection — ROZ978 ----
  // A bare whole-object `$props`/`$data`/`$refs`/`$slots` identifier (NOT a
  // member access like `$data.columns`, and NOT `$attrs`/`$listeners` whose
  // whole-object fallthrough use is legitimate) has no portable representation
  // in v1. Six targets diverge inconsistently today (Svelte hard build-error,
  // React/Solid/Lit runtime "not defined", Angular empty render, Vue renders).
  // One shared pre-IR semantic validator (always-on, independent of the
  // safeInterpolation flag — D-14) replaces that with a uniform compile error +
  // a member-access hint. SPEC-5, extended by CONTEXT D-04/D-05.
  BARE_OBJECT_SIGIL:                  'ROZ978', // error — bare $props/$data/$refs/$slots used as a whole-object value (not a member access). No portable representation in v1.
} as const;

export type RozieErrorCode = (typeof RozieErrorCode)[keyof typeof RozieErrorCode];
