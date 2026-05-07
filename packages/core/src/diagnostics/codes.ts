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

  // ---- Block parse — declarative <props>/<data>/<listeners> (Plan 03) — ROZ010..ROZ029 ----
  INVALID_DECLARATIVE_EXPRESSION: 'ROZ010',
  NOT_OBJECT_LITERAL: 'ROZ011',
  LISTENER_KEY_NOT_STRING: 'ROZ012',
  LISTENER_VALUE_NOT_OBJECT: 'ROZ013',

  // ---- Script parse (Plan 03) — ROZ030..ROZ049 ----
  SCRIPT_PARSE_ERROR: 'ROZ030',
  SCRIPT_UNRECOVERABLE: 'ROZ031',

  // ---- Template parse (Plan 03) — ROZ050..ROZ069 ----
  TEMPLATE_UNCLOSED_ELEMENT: 'ROZ050',
  TEMPLATE_MALFORMED_MUSTACHE: 'ROZ051',

  // ---- Modifier grammar (Plan 04) — ROZ070..ROZ079 ----
  MODIFIER_GRAMMAR_ERROR: 'ROZ070',

  // ---- Style parse (Plan 03) — ROZ080..ROZ089 ----
  STYLE_PARSE_ERROR: 'ROZ080',
  STYLE_MIXED_ROOT_SELECTOR: 'ROZ081',

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
  UNKNOWN_MODIFIER: 'ROZ110', // .escspe (typo) — name not registered in ModifierRegistry
  MODIFIER_ARITY_MISMATCH: 'ROZ111', // .debounce() (missing required ms arg)
  MODIFIER_ARG_SHAPE: 'ROZ112', // .outside('not-a-ref') — refExpr expected, got literal

  // ---- Compile-time correctness errors (Phase 2 Plan 02) — ROZ200..ROZ299 ----
  WRITE_TO_NON_MODEL_PROP: 'ROZ200', // SEM-02: $props.foo = … where foo lacks model: true (Phase 2 success criterion 2)
  WRITE_TO_REF: 'ROZ201', // $refs.foo = … (refs are read-only DOM-element wrappers)
  RESERVED_IDENTIFIER_COLLISION: 'ROZ202', // <data> field named $el / $props / $data / $refs / $slots / $emit

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

  // ---- @rozie/target-vue lowering errors (Phase 3 D-52) — ROZ420..ROZ449 ----
  // (Reserved as safety net per CONTEXT D-52 — none anticipated for v1.)
  TARGET_VUE_RESERVED: 'ROZ420', // RESERVED placeholder; emitter throws this only on internal-invariant violation

  // ---- Phase 3 emitter warnings — ROZ450..ROZ499 (Phase 7 hardening) ----

  // ---- @rozie/unplugin React-branch configuration errors (Phase 4 D-63) — ROZ500..ROZ519 ----
  UNPLUGIN_REACT_PEER_DEP_MISSING: 'ROZ500', // D-59: neither @vitejs/plugin-react nor @vitejs/plugin-react-swc installed (Pitfall 9)
  UNPLUGIN_REACT_DEP_MISSING: 'ROZ501', // react peer dep not resolvable
  UNPLUGIN_REACT_PLUGIN_CHAIN_MISORDER: 'ROZ502', // detected plugin-react/swc lacking; D-58 chain broken (no enforce: 'pre' on @rozie/unplugin)

  // ---- @rozie/target-react lowering errors (Phase 4 D-63) — ROZ520..ROZ549 ----
  TARGET_REACT_RHTML_WITH_CHILDREN: 'ROZ520', // r-html with children — React's dangerouslySetInnerHTML can't coexist with children (Pitfall 10)
  TARGET_REACT_NESTED_STATE_MUTATION: 'ROZ521', // Pitfall 7 — $data.foo.bar = 'x' nested member writes; v1 warns + leaves AST unchanged
  TARGET_REACT_MODULE_LET_AUTO_HOISTED: 'ROZ522', // Pitfall 3/8 — module-scoped `let X` referenced from LifecycleHook setup auto-hoisted to useRef
  TARGET_REACT_MODULE_LET_UNHOISTABLE: 'ROZ523', // Pitfall 3/8 — module-scoped `let X` referenced too indirectly to safely auto-hoist; user must refactor

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
  // ---- @rozie/babel-plugin (Plan 06-04) — ROZ820..ROZ849 ----
  BABEL_PLUGIN_INVALID_TARGET: 'ROZ820', // missing or invalid `target` option (vue|react|svelte|angular required)
  BABEL_PLUGIN_NO_FILENAME: 'ROZ821', // cannot resolve relative .rozie path without state.filename / file.opts.filename
  BABEL_PLUGIN_COMPILE_ERROR: 'ROZ822', // compile() returned severity:'error' diagnostics during sibling write
  BABEL_PLUGIN_SIBLING_WRITE_FAIL: 'ROZ823', // fs writeFileSync failed when emitting sibling .{ext}/.d.ts/.module.css/.global.css
  // ROZ824..ROZ849 reserved for future @rozie/babel-plugin needs
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
} as const;

export type RozieErrorCode = (typeof RozieErrorCode)[keyof typeof RozieErrorCode];
