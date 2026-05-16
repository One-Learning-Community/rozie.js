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
 * flush/immediate options are out of scope.
 */
export interface WatchEntry {
  /** The raw arrow/function expression passed as the first arg to $watch. */
  getter: ArrowFunctionExpression | FunctionExpression;
  /** The raw arrow/function expression passed as the second arg to $watch. */
  callback: ArrowFunctionExpression | FunctionExpression;
  sourceLoc: SourceLoc;
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
  /** Ordered (source order) per REACT-04. */
  lifecycle: LifecycleHookEntry[];
  /**
   * Ordered (source order) per REACT-04 — same convention as `lifecycle`.
   * Populated by collectScriptDecls for top-level `$watch(getter, cb)` calls.
   * Quick plan 260515-u2b.
   */
  watchers: WatchEntry[];
}
