/**
 * BindingsTable type definitions for the Phase 2 collectors substage.
 *
 * Plan 02-01 Task 3 lands this concrete shape. Plans 02-02 (validators),
 * 02-03 (ReactiveDepGraph), and 02-05 (IR lowering) all consume this table.
 *
 * Design constraints:
 * - Every entry carries `sourceLoc: SourceLoc` from its upstream AST node
 *   (D-11 / D-12 — locations threaded from day one).
 * - Maps store keys after prototype-pollution filtering (collectors skip
 *   `__proto__`, `constructor`, `prototype` — T-2-01-01 mitigation).
 * - Lifecycle entries are an ordered array (NOT a map) so source order is
 *   preserved per REACT-04. D-19 cleanup pairing happens in Plan 05
 *   lowerScript, NOT here.
 * - Computed entries use the assignment-target identifier as the key (e.g.,
 *   `const isValid = $computed(...)` keys as 'isValid').
 *
 * @experimental — shape may change before v1.0
 */
import type {
  ObjectProperty,
  Expression,
  ArrowFunctionExpression,
  FunctionExpression,
  CallExpression,
} from '@babel/types';
import type { SourceLoc } from '../ast/types.js';

/**
 * One entry per declared `<props>` field. The Babel `decl` is preserved so
 * Plans 02 / 05 can reach the original ObjectExpression of the prop's
 * options without re-walking PropsAST.
 */
export interface PropDeclEntry {
  name: string;
  /** The Babel ObjectProperty node from <props>'s ObjectExpression. */
  decl: ObjectProperty;
  /** Convenience: the type identifier text ('Number', 'Array', etc.) — extracted from `type` field. */
  typeIdentifier: string | null;
  /** Convenience: the AST node for `default` field — null if absent. */
  defaultExpression: Expression | null;
  /**
   * D-22 (Phase 1) detection: true iff `model: true` literal-property pair
   * appears in the prop's options object. Plan 02 propWriteValidator gates
   * ROZ200 on this flag.
   */
  isModel: boolean;
  sourceLoc: SourceLoc;
}

export interface DataDeclEntry {
  name: string;
  decl: ObjectProperty;
  initializer: Expression;
  sourceLoc: SourceLoc;
}

export interface RefDeclEntry {
  name: string;
  /** Tag name of the bound element (e.g., 'div', 'input') for SEM-04 type inference. */
  elementTag: string;
  sourceLoc: SourceLoc;
}

export interface SlotParamDecl {
  name: string;
  /** Raw expression text from the value attribute (Babel-parseable in Plan 05). */
  valueExpressionRaw: string;
  sourceLoc: SourceLoc;
}

export interface SlotDeclEntry {
  /** '' for the default slot (sentinel per RESEARCH.md A1). */
  name: string;
  /**
   * 'always' if the <slot> sits at template root or under an unconditional
   * parent; 'conditional' if it sits under r-if="$slots.<name>".
   * Wave 0 baseline: collectors always emit 'always' here. Plan 05
   * lowerSlots refines this when computing presence per A1 / D-18.
   */
  presence: 'always' | 'conditional';
  /** Slot params from `:propName="expr"` attributes on the <slot> element. */
  params: SlotParamDecl[];
  sourceLoc: SourceLoc;
}

export interface ComputedDeclEntry {
  name: string;
  /** The arrow/function passed to $computed(). */
  callback: ArrowFunctionExpression | FunctionExpression;
  sourceLoc: SourceLoc;
}

/**
 * D-19: each $onMount / $onUnmount / $onUpdate call collected in source order.
 * Cleanup-return EXTRACTION happens in Plan 05 (lowerScript) — this entry just
 * captures the raw call site. Plan 05 reads these to produce LifecycleHook IR
 * with paired setup/cleanup.
 */
export interface LifecycleHookEntry {
  phase: 'mount' | 'unmount' | 'update';
  /**
   * The first argument to $onMount(callback) / $onUnmount(callback). May be
   * an ArrowFunctionExpression, FunctionExpression, or Identifier reference
   * (e.g., $onMount(lockScroll) in Modal.rozie).
   */
  callback: Expression;
  sourceLoc: SourceLoc;
}

/**
 * Quick plan 260515-u2b: $watch(() => getter, () => callback) at Program top
 * level. Both args MUST be ArrowFunctionExpression | FunctionExpression — the
 * collector skips malformed calls silently; the validator emits ROZ109.
 *
 * Single-getter form ONLY for v1; array-of-getters / oldValue param /
 * flush options are out of scope.
 *
 * Quick plan 260602-9lw: `$watch` is now LAZY by default on all 6 targets — the
 * callback fires only when the watched value CHANGES (reference `!==`) after
 * mount, NEVER with the initial value. The optional third argument
 * `{ immediate: true }` opts back into the eager initial fire (Vue-style). This
 * REVERSES the 260519 "immediate-by-default" contract. `immediate` defaults to
 * `false`; the collector stays silent on a malformed third arg.
 */
export interface WatchEntry {
  /** The raw arrow/function expression passed as the first arg to $watch. */
  getter: ArrowFunctionExpression | FunctionExpression;
  /** The raw arrow/function expression passed as the second arg to $watch. */
  callback: ArrowFunctionExpression | FunctionExpression;
  /**
   * `true` when the call carries a literal `{ immediate: true }` third arg —
   * restores the eager initial fire. Defaults to `false` (lazy / fire-on-change).
   */
  immediate: boolean;
  sourceLoc: SourceLoc;
}

/**
 * Phase 21 ($expose) — one entry per well-formed property key of the canonical
 * top-level `$expose({...})` call, in source order. The collector extracts only
 * the canonical names (shorthand + explicit); ALL malformed-shape detection is
 * left to `runExposeValidator` (collectors stay silent per the Plan 02-01
 * contract). `__proto__` / `constructor` / `prototype` keys are filtered.
 */
export interface ExposedMethodEntry {
  name: string;
  sourceLoc: SourceLoc;
}

/**
 * Phase 21 ($expose) — every `$expose(...)` call site, recorded for the
 * validator's duplicate + nested-scope checks. `atTopLevel` is true for a call
 * that is an `ExpressionStatement` at `<script>` Program top level (the only
 * valid placement), false for any call nested inside a function / block.
 */
export interface ExposeCallSite {
  call: CallExpression;
  atTopLevel: boolean;
}

/**
 * Phase 36 ($provide) — one entry per well-formed top-level `$provide('key',
 * value)` statement, in source order. The collector extracts only the canonical
 * (string-literal key + value-expression) shape; ALL malformed-shape detection
 * (non-string key → ROZ129, expression-position → ROZ131) is left to
 * `runContextValidator` (collectors stay silent per the Plan 02-01 contract).
 * Multiple distinct keys are all collected (unlike single-`$expose`).
 */
export interface ProvideEntry {
  key: string;
  valueExpr: Expression;
  sourceLoc: SourceLoc;
}

/**
 * Phase 36 ($inject) — one entry per well-formed `const x = $inject('key',
 * fallback?)` binder, in source order. The collector extracts only the
 * canonical shape; malformed forms (non-string key → ROZ130, unbound →
 * ROZ132) are owned by `runContextValidator`. `localBinding` is the `const`
 * declarator name; `fallbackExpr` is the optional 2nd argument.
 */
export interface InjectEntry {
  key: string;
  localBinding: string;
  fallbackExpr?: Expression;
  sourceLoc: SourceLoc;
}

/**
 * Phase 36 — every `$provide(...)` call site, recorded for the context
 * validator. `isStatement` is true iff the call is the expression of an
 * `ExpressionStatement` (the only valid placement — `$provide` is a statement
 * sigil); false → ROZ131 (PROVIDE_NOT_STATEMENT).
 */
export interface ProvideCallSite {
  call: CallExpression;
  isStatement: boolean;
}

/**
 * Phase 36 — every `$inject(...)` call site, recorded for the context
 * validator. `boundToConst` is true iff the call is the `init` of a
 * `VariableDeclarator` whose enclosing declaration is a `const` (the only valid
 * placement); false → ROZ132 (INJECT_UNBOUND).
 *
 * `soleDeclarator` is true iff the enclosing `const` declaration has EXACTLY one
 * declarator. A mixed declaration (`const x = $inject('k'), y = 5`) defeats the
 * per-statement strip in the emitters (the whole statement leaks, double-
 * declaring `x` and leaking the bare `$inject` ref) — false → ROZ134
 * (INJECT_MIXED_DECLARATION). Only meaningful when `boundToConst` is true.
 */
export interface InjectCallSite {
  call: CallExpression;
  boundToConst: boolean;
  soleDeclarator: boolean;
}

export interface BindingsTable {
  props: Map<string, PropDeclEntry>;
  data: Map<string, DataDeclEntry>;
  refs: Map<string, RefDeclEntry>;
  slots: Map<string, SlotDeclEntry>;
  computeds: Map<string, ComputedDeclEntry>;
  /**
   * Discovered from $emit('name', ...) call sites in <script>; template
   * @event handler expressions are also walked (RESEARCH.md A4).
   */
  emits: Set<string>;
  /**
   * Phase 21 — extracted `$expose({...})` key names from the canonical
   * top-level call, in source order. `[]` when no `$expose` call.
   */
  expose: ExposedMethodEntry[];
  /**
   * Phase 21 — every `$expose(...)` call site (incl. nested) for the validator's
   * duplicate (ROZ119) + nested-scope (ROZ120) checks. `[]` when no `$expose`.
   */
  exposeCalls: ExposeCallSite[];
  /**
   * Phase 36 — extracted `$provide('key', value)` statements in source order;
   * `[]` when no `$provide` call. Multiple distinct keys all collected.
   */
  provides: ProvideEntry[];
  /**
   * Phase 36 — extracted `const x = $inject('key', fallback?)` binders in
   * source order; `[]` when no `$inject` call.
   */
  injects: InjectEntry[];
  /**
   * Phase 36 — every `$provide(...)` call site (incl. expression-position) for
   * the context validator's ROZ129/ROZ131 checks. `[]` when no `$provide`.
   */
  provideCalls: ProvideCallSite[];
  /**
   * Phase 36 — every `$inject(...)` call site (incl. unbound) for the context
   * validator's ROZ130/ROZ132 checks. `[]` when no `$inject`.
   */
  injectCalls: InjectCallSite[];
  /** Ordered (source order) per REACT-04. */
  lifecycle: LifecycleHookEntry[];
  /**
   * Ordered (source order) per REACT-04 — same convention as `lifecycle`.
   * Populated by collectScriptDecls for top-level `$watch(getter, cb)` calls.
   * Quick plan 260515-u2b.
   */
  watchers: WatchEntry[];
}
