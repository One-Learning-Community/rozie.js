/**
 * rewriteTemplateExpression — Phase 5 Plan 05-04a Task 2 (Angular target).
 *
 * Renders a Babel Expression as an Angular-template-friendly string. Mirrors
 * rewriteRozieIdentifiers but operates on a single Expression. Same rewrites
 * as the script-side path because Angular's template surface uses `this.x()`
 * signal-call shape just like the script body — well, actually Angular
 * templates don't need `this.` prefix (templates implicitly bind to component
 * instance), so signal accessors become `x()` not `this.x()`.
 *
 *   - `$props.value`  (model)     → `value()`     (signal call, no `this.`)
 *   - `$props.step`   (non-model) → `step()`
 *   - `$data.hovering`            → `hovering()`
 *   - `$refs.dialogEl`            → `dialogEl()?.nativeElement` (DOM-element ref)
 *   - `$refs.tbl` (composed ref)  → `tbl()` (component instance — NO `.nativeElement`,
 *                                   so `$expose`d verbs resolve; see componentRefs.ts)
 *   - `$slots.foo`                → `fooTpl` (TemplateRef ref check is `!!fooTpl`)
 *   - `$emit('foo', x)`           → `foo.emit(x)` (no `this.` prefix in template)
 *
 * EXCEPT for `@for` track-expression context: do NOT prefix loop variable
 * with anything (e.g., `track item.id` should NOT become `track this.item.id`).
 * Loop-local bindings shadow the component instance.
 *
 * Inputs are deep-cloned BEFORE traversal so the IR's referential preservation
 * (IR-04) is never violated.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { sanitizeEventName } from './sanitizeEventName.js';
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';
import { collectComponentRefTypes } from './componentRefs.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function flattenInlineCode(code: string): string {
  return code.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/**
 * Phase 07.3.2 Plan 10 — build the dynamic-name fallback merge for `$slots.X`.
 *
 * Returns `(tplName ?? templates()?.['dynKey'])` (or, with `prefixThis: true`,
 * `(this.tplName ?? this.templates()?.['dynKey'])`). Both operands flow through
 * `mkRef()` so the prefixThis discipline (d46f597) is honored end-to-end —
 * static path AND templates() callee.
 *
 * Uses `t.parenthesizedExpression` for the outer parens. Single quotes on the
 * computed-key StringLiteral are applied via `extra.raw` / `extra.rawValue`
 * so @babel/generator emits `'header'` not `"header"` — matching the existing
 * emitSlotInvocation.ts:326 string-concat shape so dist-parity diffs stay
 * limited to the planned outer-guard merge.
 */
function buildSlotsMerge(
  mkRef: (name: string) => t.Expression,
  tplName: string,
  dynKey: string,
): t.Expression {
  const dynKeyLit = t.stringLiteral(dynKey);
  // Force single-quote output for the computed key — matches emitSlotInvocation
  // template-string convention and existing dist-parity baseline.
  (dynKeyLit as t.StringLiteral & { extra?: { raw?: string; rawValue?: string } }).extra = {
    raw: `'${dynKey}'`,
    rawValue: dynKey,
  };
  const merge = t.logicalExpression(
    '??',
    mkRef(tplName),
    t.optionalMemberExpression(
      t.callExpression(mkRef('templates'), []),
      dynKeyLit,
      true,
      true,
    ),
  );
  return t.parenthesizedExpression(merge);
}

/**
 * Build `name.set(rhs)` for a plain `=`, or `name.set(name() OP rhs)` for
 * compound operators. Used when rewriting template-context AssignmentExpressions
 * targeting signal-typed members.
 */
function buildTemplateSetterCall(
  signalName: string,
  operator: string,
  rhs: t.Expression,
  compoundOpMap: Record<string, t.BinaryExpression['operator']>,
): t.CallExpression {
  const setterCallee = t.memberExpression(
    t.identifier(signalName),
    t.identifier('set'),
  );
  if (operator === '=') {
    return t.callExpression(setterCallee, [rhs]);
  }
  const binOp = compoundOpMap[operator];
  if (!binOp) {
    return t.callExpression(setterCallee, [rhs]);
  }
  const innerRead = t.callExpression(t.identifier(signalName), []);
  return t.callExpression(setterCallee, [t.binaryExpression(binOp, innerRead, rhs)]);
}

/**
 * Phase 23 (angular-cva-forms-integration) — the resolved post-write value handed
 * to `__rozieCvaOnChange(...)` from a TEMPLATE-context model write. Mirrors
 * rewriteScript.ts:buildCvaNewValueExpr but the compound inner-read uses the
 * template signal-call shape (`name()`, no `this.`). Plain `=` → rhs clone;
 * compound → `name() OP rhs`.
 */
function buildTemplateCvaNewValue(
  signalName: string,
  operator: string,
  rhs: t.Expression,
  compoundOpMap: Record<string, t.BinaryExpression['operator']>,
): t.Expression {
  if (operator === '=') return t.cloneNode(rhs, true, false);
  const binOp = compoundOpMap[operator];
  if (!binOp) return t.cloneNode(rhs, true, false);
  const innerRead = t.callExpression(t.identifier(signalName), []);
  return t.binaryExpression(binOp, innerRead, t.cloneNode(rhs, true, false));
}

export interface RewriteTemplateOpts {
  /**
   * Names of identifiers that are loop-local bindings within this expression's
   * context (e.g., `item` in `r-for="item in items"`). Bare identifier
   * references matching these names are NOT rewritten — they shadow component
   * members.
   */
  loopBindings?: ReadonlySet<string> | undefined;
  /**
   * Collision-renames from rewriteScript (e.g., `close` → `_close`). When the
   * template references a renamed user method, rewrite the bare identifier
   * accordingly. Output fields (e.g., emit `close = output()`) keep their bare
   * names — only user methods that collided are renamed.
   */
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  /**
   * When true, emit class-body-scoped references (`this.X()` instead of `X()`,
   * `this.headerTpl` instead of `headerTpl`). Used when the rewritten expression
   * is interpolated into a class-body context — e.g., the dynamic-slot `templates`
   * getter — where Angular's template-scope auto-resolution does not apply.
   * Default false (template-binding context).
   */
  prefixThis?: boolean;
  /**
   * Phase 23 (angular-cva-forms-integration) — the single CVA model prop name
   * (or null when the component is not CVA-receiving). When non-null, a template
   * model-write to this prop (`@input="$model.value = x"`) additionally emits
   * `this.__rozieCvaOnChange(<newValue>)` (Task 1). When undefined (the default
   * for direct callers/tests), the rewrite is byte-identical to the pre-CVA path
   * — emitAngular threads the RESOLVED gate (honoring `cva:false`).
   */
  cvaModelProp?: string | null | undefined;
  /**
   * Phase 23 — Task 2: when true, a template read of `$props.disabled` lowers to
   * `(disabled() || this.__rozieCvaDisabled())`. Set only when the component is
   * CVA-receiving AND declares a `disabled` prop.
   */
  cvaMergeDisabled?: boolean | undefined;
}

/**
 * Phase 18 (Req 2) — return a CLONE of `expr` with the producer-side
 * two-way-write sigil `$model` renamed to `$props` on every member-expression
 * object. Never mutates the input (IR-04 referential preservation). `$model` is
 * model-only by contract (Wave 1 rejected non-model/non-existent before
 * lowering) and always a member-expression object (D-03), so the rename routes
 * the read/write through the IDENTICAL `$props.<modelProp>` Angular lowering →
 * byte-identical emit. Reuse, not reimplement (SPEC Req 2).
 */
function normalizeTemplateModelAccessor(expr: t.Expression): t.Expression {
  const clone = t.cloneNode(expr, true, false);
  const wrapper = t.file(t.program([t.expressionStatement(clone)]));
  traverse(wrapper, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
  });
  return clone;
}

/**
 * Render a Babel Expression as an Angular-template-friendly string.
 */
export function rewriteTemplateExpression(
  expr: t.Expression,
  ir: IRComponent,
  opts: RewriteTemplateOpts = {},
): string {
  const cloned = t.cloneNode(expr, true, false);
  const loopBindings = opts.loopBindings ?? new Set<string>();
  const collisionRenames = opts.collisionRenames ?? new Map<string, string>();
  const prefixThis = opts.prefixThis ?? false;
  const cvaModelProp = opts.cvaModelProp ?? null;
  const cvaMergeDisabled = opts.cvaMergeDisabled ?? false;
  const mkRef = (name: string): t.Expression =>
    prefixThis
      ? t.memberExpression(t.thisExpression(), t.identifier(name))
      : t.identifier(name);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  // Finding §3.2 (data-table-super-crosstarget-findings.md) — a ref on a
  // CHILD COMPONENT lowers to the COMPONENT INSTANCE (`X()`), NOT the host
  // `ElementRef` (`X()?.nativeElement`) — the instance carries the $expose
  // methods; the host DOM node does not. Same classification the <script>-body
  // path already uses (rewriteScript.ts, Phase 66) — reused here so this
  // SEPARATE inline-template-expression lowering path agrees.
  const componentRefNames = new Set(collectComponentRefTypes(ir).keys());
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? '' : s.name)));
  const computedNames = new Set(ir.computed.map((c) => c.name));

  // Bare identifier names that, when referenced in template expressions in
  // READ position (not call/lvalue), need a `()` invocation (signal-call).
  const signalIdentifiers = new Set<string>([
    ...modelProps,
    ...nonModelProps,
    ...dataNames,
    ...refNames,
    ...computedNames,
  ]);

  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X` in template
  // event handlers (`@click="$model.open = false"`) and bindings. Normalize the
  // accessor `$model` → `$props` before the main traversal so every downstream
  // write/read site routes through the IDENTICAL `$props.<modelProp>` Angular
  // lowering → same signal setter/getter, byte-identical emit.
  traverse(wrapper, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
  });

  const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
    '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '**=': '**',
    '<<=': '<<', '>>=': '>>', '>>>=': '>>>', '&=': '&', '|=': '|', '^=': '^',
  };

  traverse(wrapper, {
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;
      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj)) return;
      if (left.computed) return;
      if (!t.isIdentifier(prop)) return;

      // $data.X = Y → X.set(Y) — but template binding can also be
      // `$props.X = Y` for model:true props.
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        const setterCall = buildTemplateSetterCall(prop.name, node.operator, node.right, COMPOUND_OP_MAP);
        path.replaceWith(setterCall);
        // Skip descending into the new node — the inner Identifier `X` would
        // otherwise get wrapped to `X()` by the Identifier visitor below.
        path.skip();
        return;
      }
      if (obj.name === '$props' && modelProps.has(prop.name)) {
        const setterCall = buildTemplateSetterCall(prop.name, node.operator, node.right, COMPOUND_OP_MAP);
        // Phase 23 — Task 1: a TEMPLATE model write to the single CVA prop
        // (`@input="$model.value = x"`) also notifies the form via
        // `__rozieCvaOnChange(<newValue>)`. Template event bindings run in the
        // component instance scope, so the bare `__rozieCvaOnChange(...)` resolves
        // against `this` — matching the bare `value.set(...)` setter convention.
        // A SequenceExpression keeps the replacement a single expression node
        // (template event expressions are not statement-context).
        if (prop.name === cvaModelProp) {
          const newValue = buildTemplateCvaNewValue(
            prop.name,
            node.operator,
            node.right,
            COMPOUND_OP_MAP,
          );
          path.replaceWith(
            t.sequenceExpression([
              setterCall,
              t.callExpression(t.identifier('__rozieCvaOnChange'), [newValue]),
            ]),
          );
          path.skip();
          return;
        }
        path.replaceWith(setterCall);
        path.skip();
        return;
      }
    },

    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          // $props.value → value()  (signal call; no `this.` prefix in templates)
          const read = t.callExpression(mkRef(prop.name), []);
          // Phase 23 — Task 2: OR-merge the CVA disabled signal into every
          // internal `disabled` read on a CVA component declaring a `disabled`
          // prop → `(disabled() || this.__rozieCvaDisabled())`. The
          // `__rozieCvaDisabled` private member is referenced via `this.` so the
          // read is unambiguous in both template and class-body (prefixThis)
          // contexts.
          if (cvaMergeDisabled && prop.name === 'disabled') {
            path.replaceWith(
              t.parenthesizedExpression(
                t.logicalExpression(
                  '||',
                  read,
                  t.callExpression(
                    t.memberExpression(
                      t.thisExpression(),
                      t.identifier('__rozieCvaDisabled'),
                    ),
                    [],
                  ),
                ),
              ),
            );
            path.skip();
            return;
          }
          path.replaceWith(read);
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.callExpression(mkRef(prop.name), []));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.foo → foo()?.nativeElement (HTML-element ref: signal call +
        // optional chain to the DOM node) OR foo() (composed-component ref:
        // the COMPONENT INSTANCE itself — finding §3.2, no .nativeElement
        // deref, matches the <script>-body lowering).
        const refCall = t.callExpression(mkRef(prop.name), []);
        path.replaceWith(
          componentRefNames.has(prop.name)
            ? refCall
            : t.optionalMemberExpression(
                refCall,
                t.identifier('nativeElement'),
                false,
                true,
              ),
        );
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // Phase 07.3.2 Plan 10 — guard must merge with dynamic-name fallback
        // so r-if="$slots.foo" evaluates truthy when ONLY dynamic-name fills
        // exist. mkRef() respects prefixThis (d46f597) for class-body callsites.
        const tplName = prop.name === '' ? 'defaultTpl' : `${prop.name}Tpl`;
        const dynKey = prop.name === '' ? 'defaultSlot' : prop.name;
        path.replaceWith(buildSlotsMerge(mkRef, tplName, dynKey));
        path.skip();
        return;
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          path.replaceWith(t.callExpression(mkRef(prop.name), []));
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.callExpression(mkRef(prop.name), []));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // See MemberExpression branch above — same composed-vs-DOM ref split.
        const refCall = t.callExpression(mkRef(prop.name), []);
        path.replaceWith(
          componentRefNames.has(prop.name)
            ? refCall
            : t.optionalMemberExpression(
                refCall,
                t.identifier('nativeElement'),
                false,
                true,
              ),
        );
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // Phase 07.3.2 Plan 10 — same merge as MemberExpression branch.
        const tplName = prop.name === '' ? 'defaultTpl' : `${prop.name}Tpl`;
        const dynKey = prop.name === '' ? 'defaultSlot' : prop.name;
        path.replaceWith(buildSlotsMerge(mkRef, tplName, dynKey));
        path.skip();
        return;
      }
    },

    /**
     * `$emit('event', x)` → `event.emit(x)` (no `this.` in template context).
     */
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $classSelector('panel') → ".panel" — same lowering as the <script> path
      // (rewriteScript.ts); both hooks call the SAME shared helper so they
      // cannot drift (Pitfall 4). Handled BEFORE the $emit-only early-return so
      // a :attr-position $classSelector is rewritten.
      if (callee.name === '$classSelector') {
        // 'single' — an Angular `[attr]="..."` binding double-quotes its
        // expression; the lowered literal must serialize with single quotes so
        // it does not collide with that wrapper (`[attr]="".panel""`).
        lowerClassSelectorCall(path, 'single');
        return;
      }

      if (callee.name !== '$emit') return;
      const args = path.node.arguments;
      if (args.length === 0) return;
      const first = args[0];
      if (!t.isStringLiteral(first)) return;
      // Bug 2 (260520-gi1): the output() field id is the sanitized
      // (valid-identifier) name; `<field>.emit(…)` must agree with the
      // field declaration emitted in emitScript.ts.
      const eventName = sanitizeEventName(first.value);
      const rest = args.slice(1);
      const replacement = t.callExpression(
        t.memberExpression(t.identifier(eventName), t.identifier('emit')),
        rest as Array<t.Expression | t.SpreadElement | t.ArgumentPlaceholder>,
      );
      path.replaceWith(replacement);
    },

    /**
     * Bare-identifier rewrite for template context:
     *   - Apply collision-rename (e.g., `close` → `_close`).
     *   - Wrap signal-typed bare identifier reads in a `()` invocation
     *     (e.g., `canDecrement` → `canDecrement()`).
     *
     * Loop-local bindings are excluded — they shadow component members.
     */
    Identifier(path) {
      const name = path.node.name;
      if (loopBindings.has(name)) return;
      // Skip declaration-site identifiers and member-property positions.
      const parent = path.parent;
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node &&
        !parent.computed
      ) {
        return;
      }
      if (
        (t.isObjectProperty(parent) || t.isObjectMethod(parent)) &&
        parent.key === path.node &&
        !parent.computed
      ) {
        return;
      }

      // Apply collision rename in-place when applicable. Signals that use
      // collision-rename are unusual (output names colliding with user methods
      // — outputs aren't signals), so this rename happens BEFORE the signal-call
      // wrap check.
      let effectiveName = name;
      if (collisionRenames.has(name)) {
        effectiveName = collisionRenames.get(name)!;
        path.node.name = effectiveName;
      }

      // Signal-call wrap: bare identifier reference to a signal in READ
      // position needs a `()` invocation suffix.
      if (signalIdentifiers.has(name)) {
        const isCallee =
          (t.isCallExpression(parent) || t.isOptionalCallExpression(parent)) &&
          parent.callee === path.node;
        const isAssignLeft =
          t.isAssignmentExpression(parent) && parent.left === path.node;
        if (isCallee || isAssignLeft) {
          // Already a call/assignment — no wrap.
          return;
        }
        path.replaceWith(t.callExpression(mkRef(effectiveName), []));
        path.skip();
      }
    },
  });

  const stmt = wrapper.program.body[0]!;
  const rewrittenExpr = !t.isExpressionStatement(stmt) ? cloned : stmt.expression;
  const raw = generate(rewrittenExpr, GEN_OPTS).code;
  return flattenInlineCode(raw);
}

/**
 * Quick task 260520-w18 follow-up — Angular TEMPLATE-expression double-read
 * narrowing.
 *
 * The script-body sibling `hoistDoubleReadAccessors` (rewriteScript.ts) fixes
 * the same class for `<script>` bodies by hoisting `const __X = $props.X` to
 * the top of a BlockStatement. A template attribute expression has no block
 * to hoist into — Angular templates cannot declare locals. The 260520-w18
 * SUMMARY explicitly flagged this as an unsolved residual.
 *
 * The clean Angular idiom for "compute once, use in template" is a class
 * member. When a template attribute expression reads the SAME `$props.X` /
 * `$data.X` accessor 2+ times in a guard-and-use shape — i.e.
 *
 *   `$props.allowedFileTypes ? $props.allowedFileTypes.join(',') : null`
 *
 * — each `$props.X` independently lowers to `X()`, and `strictTemplates`
 * cannot narrow a signal-call result across two separate call expressions
 * (the `.join(',')` consequent still sees `string[] | null` → TS2531/TS2538).
 *
 * This pre-pass detects that shape and synthesises a getter class member that
 * reads the signal ONCE into a local and performs the guard-and-use against
 * the narrowed local:
 *
 *   protected get __accept() {
 *     const __allowedFileTypes = this.allowedFileTypes();
 *     return __allowedFileTypes ? __allowedFileTypes.join(',') : null;
 *   }
 *
 * The template attr then binds to the bare getter (`[accept]="__accept"`).
 *
 * Scope discipline: this triggers ONLY when the SAME accessor is read 2+
 * times in one attribute expression. Reference examples (Counter / Dropdown /
 * Modal / SearchInput / TodoList) have no such shape — each template
 * accessor is read once — so their emitted output is byte-stable. Two
 * DIFFERENT accessors in one expression (e.g. `$props.disabled ||
 * $data.uploading`) each lower to a single call and are untouched.
 *
 * Returns `null` when the expression has no double-read accessor — callers
 * fall back to the normal `rewriteTemplateExpression` path.
 *
 * @experimental — shape may change before v1.0
 */
export interface TemplateAccessorHoist {
  /** Getter member name to bind the attribute to (e.g. `__accept`). */
  memberName: string;
  /** Full class-body getter declaration text. */
  decl: string;
}

/**
 * Count non-computed read-only `$props.X` / `$data.X` MemberExpressions in an
 * Expression, keyed by `accessor.name`. Descent stops at nested function
 * boundaries (their reads run in a later scope) and does NOT descend into a
 * matched `$props.X` (no rewritable children for this purpose). Mirrors the
 * `collectInScope` walker in rewriteScript.ts:hoistDoubleReadAccessors.
 */
function collectTemplateAccessorReads(
  node: t.Node,
  found: Map<string, number>,
): void {
  if (
    t.isFunctionDeclaration(node) ||
    t.isFunctionExpression(node) ||
    t.isArrowFunctionExpression(node) ||
    t.isObjectMethod(node) ||
    t.isClassMethod(node)
  ) {
    return;
  }
  if (
    (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    !node.computed &&
    t.isIdentifier(node.object) &&
    (node.object.name === '$props' || node.object.name === '$data') &&
    t.isIdentifier(node.property)
  ) {
    const key = `${node.object.name}.${node.property.name}`;
    found.set(key, (found.get(key) ?? 0) + 1);
    return;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') {
      continue;
    }
    const child = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && 'type' in c) {
          collectTemplateAccessorReads(c as t.Node, found);
        }
      }
    } else if (child && typeof child === 'object' && 'type' in child) {
      collectTemplateAccessorReads(child as t.Node, found);
    }
  }
}

/**
 * Replace every non-computed `$accessor.name` MemberExpression in `node`
 * (recursively, NOT crossing nested-function boundaries — same discipline as
 * the collector) with `Identifier(localName)`.
 */
function replaceTemplateAccessorReads(
  node: t.Node,
  accessor: string,
  name: string,
  localName: string,
): void {
  if (
    t.isFunctionDeclaration(node) ||
    t.isFunctionExpression(node) ||
    t.isArrowFunctionExpression(node) ||
    t.isObjectMethod(node) ||
    t.isClassMethod(node)
  ) {
    return;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    const isMatch = (cn: t.Node): boolean =>
      (t.isMemberExpression(cn) || t.isOptionalMemberExpression(cn)) &&
      !cn.computed &&
      t.isIdentifier(cn.object) &&
      cn.object.name === accessor &&
      t.isIdentifier(cn.property) &&
      cn.property.name === name;
    if (Array.isArray(child)) {
      for (let i = 0; i < child.length; i++) {
        const c = child[i];
        if (c && typeof c === 'object' && 'type' in c) {
          const cn = c as t.Node;
          if (isMatch(cn)) {
            child[i] = t.identifier(localName);
          } else {
            replaceTemplateAccessorReads(cn, accessor, name, localName);
          }
        }
      }
    } else if (child && typeof child === 'object' && 'type' in child) {
      const cn = child as t.Node;
      if (isMatch(cn)) {
        (node as unknown as Record<string, unknown>)[key] = t.identifier(
          localName,
        );
      } else {
        replaceTemplateAccessorReads(cn, accessor, name, localName);
      }
    }
  }
}

/**
 * Detect the template-expression double-read shape and, when present,
 * synthesise a single-read getter class member.
 *
 * `attrName` is the (already kebab/camel-resolved) attribute name — used to
 * derive a stable, collision-resistant getter name (`__<attr>` plus a
 * disambiguating counter when the same element carries two bindings of the
 * same name, or when sibling elements collide).
 *
 * Only `$props.X` / `$data.X` accessors that are READ-ONLY in the expression
 * qualify (template attribute expressions never assign, so no extra
 * assignment guard is needed — unlike the script-body sibling). Loop-local
 * bindings are NOT accessors and are left untouched, so a loop-variable
 * double-read (`f.id … f.id`) never triggers this path.
 */
export function hoistTemplateDoubleReadAccessor(
  expr: t.Expression,
  ir: IRComponent,
  attrName: string,
  takenNames: ReadonlySet<string>,
  opts: RewriteTemplateOpts = {},
): TemplateAccessorHoist | null {
  // Phase 18 (Req 2) — normalize the producer-side two-way-write sigil
  // `$model.X` → `$props.X` on a CLONE (never mutate the caller's IR-referenced
  // node — IR-04) before the double-read classification below keys on `$props`/
  // `$data` (A2: this classification site would otherwise miss `$model` reads
  // and skip the hoist, diverging from the byte-identical `$props.X` form).
  // `$model` is model-only by contract (Wave 1) and always a member-expression
  // object (D-03).
  expr = normalizeTemplateModelAccessor(expr);
  // A synthesised getter lives in class scope and cannot see loop-local
  // bindings (`f` from `r-for="f in $data.files"`). If the expression
  // references ANY loop binding, lifting it into a class member would emit a
  // class-scope reference to an undeclared identifier — bail and let the
  // attribute lower in-place. (A loop-element attr that ALSO double-reads a
  // signal is vanishingly rare; in-place keeps the double call, which is the
  // pre-existing residual rather than a regression.)
  const loopBindings = opts.loopBindings;
  if (loopBindings !== undefined && loopBindings.size > 0) {
    let touchesLoopVar = false;
    const scanLoop = (node: t.Node): void => {
      if (touchesLoopVar) return;
      if (t.isIdentifier(node) && loopBindings.has(node.name)) {
        touchesLoopVar = true;
        return;
      }
      for (const key of Object.keys(node)) {
        if (key === 'loc') continue;
        const child = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          for (const c of child) {
            if (c && typeof c === 'object' && 'type' in c) scanLoop(c as t.Node);
          }
        } else if (child && typeof child === 'object' && 'type' in child) {
          scanLoop(child as t.Node);
        }
      }
    };
    scanLoop(expr);
    if (touchesLoopVar) return null;
  }

  const found = new Map<string, number>();
  collectTemplateAccessorReads(expr, found);

  // Collect accessors read 2+ times. Anything below the threshold lowers to a
  // single call and needs no hoist.
  const doubleRead: Array<{ accessor: string; name: string }> = [];
  for (const [key, count] of found) {
    if (count < 2) continue;
    const dotIdx = key.indexOf('.');
    doubleRead.push({
      accessor: key.slice(0, dotIdx),
      name: key.slice(dotIdx + 1),
    });
  }
  if (doubleRead.length === 0) return null;

  // Verify each double-read accessor names a declared signal — guards against
  // hoisting an unknown `$props.X` the rewrite would not lower anyway.
  const modelProps = new Set(
    ir.props.filter((p) => p.isModel).map((p) => p.name),
  );
  const nonModelProps = new Set(
    ir.props.filter((p) => !p.isModel).map((p) => p.name),
  );
  const dataNames = new Set(ir.state.map((s) => s.name));
  const knownDoubleRead = doubleRead.filter((d) =>
    d.accessor === '$props'
      ? modelProps.has(d.name) || nonModelProps.has(d.name)
      : dataNames.has(d.name),
  );
  if (knownDoubleRead.length === 0) return null;

  // Build the getter body: hoist `const __X = $props.X;` for each double-read
  // accessor, then `return <expr-with-accessors-replaced>;`. The hoisted
  // initializers + the return expression flow through rewriteTemplateExpression
  // with prefixThis:true so `$props.X` lowers to `this.X()` and the local
  // identifiers stay bare.
  const exprClone = t.cloneNode(expr, true, false);
  for (const { accessor, name } of knownDoubleRead) {
    replaceTemplateAccessorReads(exprClone, accessor, name, `__${name}`);
  }

  // Lower the hoisted const initializers + the return expression. Each is an
  // independent statement; rewriteTemplateExpression handles single expressions
  // so lower each piece and reassemble. prefixThis:true → class-body scope.
  const lowerOpts: RewriteTemplateOpts = { ...opts, prefixThis: true };
  const declLines = knownDoubleRead.map(({ accessor, name }) => {
    const localName = `__${name}`;
    const initExpr = t.memberExpression(
      t.identifier(accessor),
      t.identifier(name),
    );
    const loweredInit = rewriteTemplateExpression(initExpr, ir, lowerOpts);
    return `const ${localName} = ${loweredInit};`;
  });
  const loweredReturn = rewriteTemplateExpression(exprClone, ir, lowerOpts);

  // Derive a stable, collision-free getter name.
  const base = `__${attrName.replace(/[^A-Za-z0-9_$]/g, '_')}`;
  let memberName = base;
  let n = 2;
  while (takenNames.has(memberName)) {
    memberName = `${base}_${n}`;
    n++;
  }

  const decl = [
    `protected get ${memberName}() {`,
    ...declLines.map((l) => `    ${l}`),
    `    return ${loweredReturn};`,
    `  }`,
  ].join('\n');

  return { memberName, decl };
}

/**
 * Emitter-hardening item #7 sub-shape (ii) — walk `node` (and every
 * descendant) for an ArrowFunctionExpression or FunctionExpression. Angular's
 * template expression parser is a deliberately restricted subset of JS that
 * rejects function-literal expressions wherever they appear (e.g.
 * `{{ items.find((x) => x > 1) }}`) — the component silently JIT-falls-back
 * and then throws "JIT compiler unavailable" at runtime under an AOT-only
 * bootstrap (`project_angular_aot_no_template_arrow`; passes `compile()` ×6
 * and the surface gate, fails only the AOT/consumer-demo build).
 *
 * Mirrors `emitSlotInvocation.ts`'s `containsFunctionExpression` — kept as a
 * separate small local predicate (not imported) per this codebase's IN-04
 * per-seam-AST-predicate convention; both walk the exact same two node kinds.
 */
function containsFunctionLiteral(node: t.Node): boolean {
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) return true;
  for (const key of Object.keys(node)) {
    const child = (node as unknown as Record<string, unknown>)[key];
    if (child && typeof child === 'object' && 'type' in (child as object)) {
      if (containsFunctionLiteral(child as t.Node)) return true;
    }
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in (item as object)) {
          if (containsFunctionLiteral(item as t.Node)) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Emitter-hardening item #7 sub-shape (ii) — when `expr` (or any descendant)
 * is a function literal, hoist the WHOLE expression into a generated
 * class-body getter, mirroring `hoistTemplateDoubleReadAccessor`'s getter
 * shape (Analog B — item #7's `rozieDisplay`/`usedGlobals` field-injection
 * precedent generalized to an arbitrary expression). The arrow now lives in
 * real TS class-body code — never spliced into the template string — so the
 * template reference becomes a bare identifier (`{{ __interp_0 }}`), which
 * Angular's restricted template-expression grammar always accepts.
 *
 * `hintName` seeds the synthesized member name (same disambiguation scheme as
 * `hoistTemplateDoubleReadAccessor`'s `attrName`); callers pass a
 * position-derived hint (e.g. `interp_<N>`) since an interpolation has no
 * natural "attribute name".
 *
 * Bails (returns `null`) when `expr` touches a loop-local binding — a
 * synthesized getter lives in class scope and cannot see loop variables (same
 * discipline as `hoistTemplateDoubleReadAccessor`; a loop-element expression
 * that ALSO contains a function literal is a vanishingly rare shape left as a
 * pre-existing residual, not a regression).
 *
 * Returns `null` when `expr` has no function literal — every existing
 * fixture with no arrow-bearing template expression is unaffected, so this is
 * purely additive (zero-drift on the corpus).
 */
export function hoistNonPureTemplateExpression(
  expr: t.Expression,
  ir: IRComponent,
  hintName: string,
  takenNames: ReadonlySet<string>,
  opts: RewriteTemplateOpts = {},
): TemplateAccessorHoist | null {
  // Phase 18 (Req 2) — normalize `$model.X` → `$props.X` on a CLONE first, so
  // the function-literal scan below sees the SAME shape rewriteTemplateExpression
  // will eventually lower (mirrors hoistTemplateDoubleReadAccessor).
  const normalized = normalizeTemplateModelAccessor(expr);
  if (!containsFunctionLiteral(normalized)) return null;

  const loopBindings = opts.loopBindings;
  if (loopBindings !== undefined && loopBindings.size > 0) {
    let touchesLoopVar = false;
    const scanLoop = (node: t.Node): void => {
      if (touchesLoopVar) return;
      if (t.isIdentifier(node) && loopBindings.has(node.name)) {
        touchesLoopVar = true;
        return;
      }
      for (const key of Object.keys(node)) {
        if (key === 'loc') continue;
        const child = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          for (const c of child) {
            if (c && typeof c === 'object' && 'type' in c) scanLoop(c as t.Node);
          }
        } else if (child && typeof child === 'object' && 'type' in child) {
          scanLoop(child as t.Node);
        }
      }
    };
    scanLoop(normalized);
    if (touchesLoopVar) return null;
  }

  const lowerOpts: RewriteTemplateOpts = { ...opts, prefixThis: true };
  const loweredReturn = rewriteTemplateExpression(normalized, ir, lowerOpts);

  const base = `__${hintName.replace(/[^A-Za-z0-9_$]/g, '_')}`;
  let memberName = base;
  let n = 2;
  while (takenNames.has(memberName)) {
    memberName = `${base}_${n}`;
    n++;
  }

  const decl = [
    `protected get ${memberName}() {`,
    `    return ${loweredReturn};`,
    `  }`,
  ].join('\n');

  return { memberName, decl };
}
