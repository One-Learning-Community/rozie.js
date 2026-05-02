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

  // ---- ROZ400+ reserved for Phase 3+ target emitters ----
} as const;

export type RozieErrorCode = (typeof RozieErrorCode)[keyof typeof RozieErrorCode];
