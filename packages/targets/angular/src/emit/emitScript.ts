/**
 * emitScript — Phase 5 Plan 05-04a Task 1.
 *
 * Produces the body of an Angular 17+ standalone-component CLASS declaration.
 * Output order (per RESEARCH Pattern 6 + Pitfall 8):
 *
 *   1. Field declarations (signal-style API):
 *      - input/model props        (`name = input<T>(default)` or `model<T>(default)`)
 *      - state signals            (`name = signal<T>(initializer)`)
 *      - viewChild refs           (`name = viewChild<ElementRef>('name')`)
 *      - output emits             (`name = output<T>()`)
 *      - @ContentChild slot tpls  (Plan 05-04a Task 2 — emitSlotDecl)
 *      - private __rozieDestroyRef = inject(DestroyRef);  // hoisted when a
 *        paired-cleanup $onMount lands in ngAfterViewInit (inject() is invalid
 *        outside injection context, so cleanups dereference this field).
 *   2. constructor() {
 *        const renderer = inject(Renderer2);   // Listeners use this
 *        ...user residual <script> body (DX-03 floor)
 *        ...$onUnmount standalone hooks (inject(DestroyRef).onDestroy(...))
 *        ...$onUpdate hooks (effect(() => ...))
 *        ...listener effect blocks (Plan 05-04a Task 3)
 *      }
 *   3. ngAfterViewInit() {                     // mount-phase lifecycle lands here
 *        ...$onMount setup bodies (viewChild() signals are populated post-init)
 *        ...this.__rozieDestroyRef.onDestroy(<cleanup>) for paired mount+cleanup
 *      }
 *   4. computed properties (`name = computed(() => ...)`)
 *   5. method/arrow declarations from user's <script> body — emitted at class
 *      level (NOT in constructor) so they're invokable as `this.name(...)`.
 *
 * Pitfall 8 mitigation: `inject(Renderer2)` / `inject(DestroyRef)` calls live
 * exclusively in constructor body or as field initializers — NEVER inside
 * method/arrow bodies.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-angular` imports —
 * debounce/throttle/outsideClick all inline as IIFE / Renderer2.listen.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  ComputedDecl,
  RefDecl,
  StateDecl,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { partitionUserImports } from '../rewrite/partitionUserImports.js';
import {
  rewriteRozieIdentifiers,
  hoistDoubleReadAccessors,
  normalizeModelAccessor,
} from '../rewrite/rewriteScript.js';
import { sanitizeEventName } from '../rewrite/sanitizeEventName.js';
import {
  AngularImportCollector,
  collectAngularImports,
} from '../rewrite/collectAngularImports.js';
import { buildSlotCtx, buildNgTemplateContextGuard } from './refineSlotTypes.js';
import { emitPortals } from './emitPortals.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

// Phase 06.1 P2: GEN_OPTS gains sourceMaps:true + sourceFileName so each
// @babel/generator call emits a per-expression child map anchored to the
// .rozie source. The synthesized-AST `.loc =` annotations (D-104/D-106) give
// those maps real positional content; non-annotated scaffolding falls back
// to nearest-segment via the surrounding shell map (D-102).
const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: false,
};

// Used when generating the user-authored constructor-expression statements
// with source maps, so devtools can resolve back to the .rozie file.
const GEN_OPTS_MAP: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
};

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

/**
 * Emit `() => body` for an Expression or BlockStatement body.
 *
 * Building the arrow as a Babel node (rather than string-templating
 * `() => ${genCode(body)}`) lets @babel/generator auto-wrap ObjectExpression
 * bodies in parens, so `$computed(() => ({ x: 1 }))` emits `() => ({ x: 1 })`
 * instead of `() => { x: 1 }` (a BlockStatement with LabeledStatement
 * `x: 1`).
 */
function arrowBody(body: t.Expression | t.BlockStatement): string {
  return genCode(t.arrowFunctionExpression([], body));
}

/**
 * Bug 2: annotate any parameter that lacks a type annotation with `: any`.
 * User `<script>` arrows/functions get lifted to class fields verbatim; under
 * the consumer's `strict` tsconfig an un-annotated param is TS7006 (implicit
 * any). Mutates the params in place (callers pass cloned nodes).
 *
 * Skips params that already carry a `typeAnnotation`. Handles Identifier,
 * AssignmentPattern (default-valued params), RestElement, and patterns by
 * annotating the outermost binding node.
 */
function annotateUntypedParams(
  params: Array<t.Identifier | t.Pattern | t.RestElement>,
): void {
  const anyAnnotation = (): t.TSTypeAnnotation =>
    t.tsTypeAnnotation(t.tsAnyKeyword());
  for (const param of params) {
    if (t.isIdentifier(param)) {
      if (!param.typeAnnotation) param.typeAnnotation = anyAnnotation();
    } else if (t.isAssignmentPattern(param)) {
      const left = param.left;
      if (
        (t.isIdentifier(left) ||
          t.isObjectPattern(left) ||
          t.isArrayPattern(left)) &&
        !left.typeAnnotation
      ) {
        left.typeAnnotation = anyAnnotation();
      }
    } else if (t.isRestElement(param)) {
      if (!param.typeAnnotation) param.typeAnnotation = anyAnnotation();
    } else if (t.isObjectPattern(param) || t.isArrayPattern(param)) {
      if (!param.typeAnnotation) param.typeAnnotation = anyAnnotation();
    }
  }
}

/**
 * WR-01 ROOT CAUSE 2 — render a `VariableDeclarator` `id`'s author type
 * annotation as a `": <Type>"` suffix string (empty when the id is untyped).
 * Used by the class-field rebuild site so an author declarator annotation
 * (`const f: (e: MouseEvent) => void = …`) survives onto the emitted field.
 */
function renderDeclaratorTypeSuffix(id: t.LVal): string {
  if (!t.isIdentifier(id)) return '';
  const ann = id.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return '';
  // @babel/generator cannot print a bare `TSTypeAnnotation` (its printer
  // dereferences a parent that no longer exists). Print the INNER type node
  // and prepend the `: ` ourselves.
  return `: ${genCode(ann.typeAnnotation)}`;
}

/**
 * WR-01 ROOT CAUSE 1 — true when a `VariableDeclarator` `id` carries a genuine
 * FUNCTION-type annotation. When true, the arrow `init`'s params are
 * contextually typed by that annotation and must NOT be `: any`-stamped. A
 * non-function annotation does not contextually type params.
 */
function declaratorHasFunctionType(id: t.LVal): boolean {
  if (!t.isIdentifier(id)) return false;
  const ann = id.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return false;
  return t.isTSFunctionType(ann.typeAnnotation);
}

/** Render a PropTypeAnnotation as a TS type string. */
function renderType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        return 'any[]';
      case 'Object':
        return 'Record<string, any>';
      case 'Function':
        return '(...args: unknown[]) => unknown';
      default:
        return ann.name;
    }
  }
  if (ann.kind === 'union') return ann.members.map(renderType).join(' | ');
  if (ann.kind === 'literal') {
    if (ann.value === 'array') return 'any[]';
    if (ann.value === 'object') return 'Record<string, any>';
    if (ann.value === 'function') return '(...args: unknown[]) => unknown';
    return ann.value;
  }
  return 'unknown';
}

/**
 * True when the prop has an explicit `default: null` in the `.rozie` source —
 * i.e. `prop.defaultValue` is a `NullLiteral` node (NOT the `null`-the-absence
 * sentinel, which is `prop.defaultValue === null`). When true, the emitted
 * field type must be widened to `<T | null>` so `null` is assignable.
 */
function hasExplicitNullDefault(prop: PropDecl): boolean {
  return prop.defaultValue !== null && t.isNullLiteral(prop.defaultValue);
}

/** Render the default value for an input/model field initializer. */
function renderDefault(prop: PropDecl): string {
  if (prop.defaultValue === null) return '';
  const raw = genCode(prop.defaultValue);
  // Arrow factory like `() => []` should be invoked: `(() => [])()`.
  if (
    t.isArrowFunctionExpression(prop.defaultValue) &&
    (t.isArrayExpression(prop.defaultValue.body) ||
      t.isObjectExpression(prop.defaultValue.body))
  ) {
    return `(${raw})()`;
  }
  // Wrap arrow/function-expression defaults in parens to avoid `??` precedence issues.
  if (
    t.isArrowFunctionExpression(prop.defaultValue) ||
    t.isFunctionExpression(prop.defaultValue)
  ) {
    return `(${raw})`;
  }
  return raw;
}

/**
 * Phase 23 (angular-cva-forms-integration) — build the static CVA class shape
 * (three private members + four ControlValueAccessor methods + the
 * `__rozieCvaOnTouched` host callback) for the single `model: true` prop the
 * accessor wraps. Returns a single string ready to push into `classBodyParts`.
 *
 * The shape is the Spike 006 contract (`.planning/spikes/006-...`):
 *   - `writeValue(v: T | null)` coerces null → the prop's declared default
 *     literal (via the shared `renderDefault`), matching flatpickr's
 *     `this.date.set(v ?? '')` — null-coercion is load-bearing from NgModel's
 *     very first `writeValue(null)` call (006-A journal), not just `reset()`.
 *   - the value parameter is typed `<T> | null` reusing the prop's TS type the
 *     same way the `model()` initializer does (renderType).
 *
 * This emits ONLY the static shape. The dynamic view→model hookup at the
 * internal write site (`this.__rozieCvaOnChange(...)`) and the disabled-read
 * merge are Plan 03 — NOT here.
 */
function buildCvaClassShape(prop: PropDecl): string {
  const tsType = renderType(prop.typeAnnotation);
  const rendered = renderDefault(prop);
  // renderDefault returns '' for the no-declared-default sentinel; in that case
  // coerce to `null` (the value param is already `T | null`). Otherwise coerce
  // to the rendered default literal (e.g. '' for the String date default).
  const defaultLiteral = rendered.length > 0 ? rendered : 'null';
  return [
    `private __rozieCvaOnChange: (v: ${tsType}) => void = () => {};`,
    `private __rozieCvaOnTouchedFn: () => void = () => {};`,
    `private __rozieCvaDisabled = signal(false);`,
    ``,
    `writeValue(v: ${tsType} | null): void {`,
    `  this.${prop.name}.set(v ?? ${defaultLiteral});`,
    `}`,
    `registerOnChange(fn: (v: ${tsType}) => void): void {`,
    `  this.__rozieCvaOnChange = fn;`,
    `}`,
    `registerOnTouched(fn: () => void): void {`,
    `  this.__rozieCvaOnTouchedFn = fn;`,
    `}`,
    `setDisabledState(isDisabled: boolean): void {`,
    `  this.__rozieCvaDisabled.set(isDisabled);`,
    `}`,
    `__rozieCvaOnTouched(): void {`,
    `  this.__rozieCvaOnTouchedFn();`,
    `}`,
  ].join('\n');
}

/**
 * Find the cloned `body` for each ComputedDecl by name. Matches
 * VariableDeclarators with `init = $computed(arrow|fn)`.
 */
function findClonedComputedBodies(
  clonedProgram: t.File,
): Map<string, t.Expression | t.BlockStatement> {
  const out = new Map<string, t.Expression | t.BlockStatement>();
  for (const stmt of clonedProgram.program.body) {
    if (!t.isVariableDeclaration(stmt)) continue;
    for (const d of stmt.declarations) {
      if (!t.isIdentifier(d.id)) continue;
      if (!d.init || !t.isCallExpression(d.init)) continue;
      const callee = d.init.callee;
      if (!t.isIdentifier(callee) || callee.name !== '$computed') continue;
      const cb = d.init.arguments[0];
      if (!cb) continue;
      if (t.isArrowFunctionExpression(cb) || t.isFunctionExpression(cb)) {
        out.set(d.id.name, cb.body);
      }
    }
  }
  return out;
}

/**
 * Bug 4: scan the cloned Program for `$emit('name', ...)` CallExpressions and
 * return the set of event names that are passed a payload argument in at least
 * one call. Events NOT in this set never carry a payload and should be emitted
 * as `output<void>()` (so `.emit()` with no args typechecks).
 *
 * MUST run on the clone BEFORE rewriteRozieIdentifiers — the rewrite turns
 * `$emit('name', x)` into `this.name.emit(x)`, erasing the `$emit` callee.
 */
function collectEmitsWithPayload(clonedProgram: t.File): Set<string> {
  const withPayload = new Set<string>();
  // Use a lightweight recursive walk — no need for full @babel/traverse here.
  const visit = (node: t.Node | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (t.isCallExpression(node)) {
      const callee = node.callee;
      if (
        t.isIdentifier(callee) &&
        callee.name === '$emit' &&
        node.arguments.length >= 1 &&
        t.isStringLiteral(node.arguments[0]!)
      ) {
        const eventName = (node.arguments[0] as t.StringLiteral).value;
        if (node.arguments.length >= 2) withPayload.add(eventName);
      }
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const c of child) visit(c as t.Node);
      } else {
        visit(child as t.Node);
      }
    }
  };
  visit(clonedProgram.program);
  return withPayload;
}

interface LifecycleClonedBody {
  setupCloned: t.Expression | t.BlockStatement;
  cleanupCloned: t.Expression | null;
  phase: 'mount' | 'unmount' | 'update';
}

/**
 * Pair lifecycle hooks (D-19) by walking the cloned Program in source order.
 * Adjacent `$onMount(setup) + $onUnmount(cleanup)` Identifier-pair → ONE
 * paired hook.
 */
function pairClonedLifecycle(
  clonedProgram: t.File,
  ir: IRComponent,
): { perHook: LifecycleClonedBody[]; consumedIndices: Set<number> } {
  const perHook: LifecycleClonedBody[] = [];
  const consumed = new Set<number>();
  const lifecycleCallIndices: Array<{
    idx: number;
    calleeName: string;
    arg: t.Node;
  }> = [];

  for (let i = 0; i < clonedProgram.program.body.length; i++) {
    const stmt = clonedProgram.program.body[i]!;
    if (!t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (!t.isCallExpression(expr)) continue;
    const callee = expr.callee;
    if (!t.isIdentifier(callee)) continue;
    if (
      callee.name !== '$onMount' &&
      callee.name !== '$onUnmount' &&
      callee.name !== '$onUpdate'
    ) {
      continue;
    }
    const arg = expr.arguments[0];
    if (!arg) continue;
    lifecycleCallIndices.push({ idx: i, calleeName: callee.name, arg });
  }

  let cursor = 0;
  for (const lh of ir.lifecycle) {
    while (cursor < lifecycleCallIndices.length) {
      const entry = lifecycleCallIndices[cursor]!;
      cursor++;
      const expectedCallee =
        lh.phase === 'mount' ? '$onMount' : lh.phase === 'unmount' ? '$onUnmount' : '$onUpdate';
      if (entry.calleeName !== expectedCallee) continue;
      consumed.add(entry.idx);
      let setupCloned = entry.arg as t.Expression | t.BlockStatement;
      let cleanupCloned: t.Expression | null = null;

      if (lh.cleanup) {
        if (cursor < lifecycleCallIndices.length) {
          const next = lifecycleCallIndices[cursor]!;
          if (next.calleeName === '$onUnmount') {
            consumed.add(next.idx);
            cleanupCloned = next.arg as t.Expression;
            cursor++;
          }
        }
      }

      // Inline cleanup-return detection (Pitfall 5 React analog).
      if (
        cleanupCloned === null &&
        lh.phase === 'mount' &&
        (t.isArrowFunctionExpression(setupCloned) ||
          t.isFunctionExpression(setupCloned))
      ) {
        const fnBody = setupCloned.body;
        if (t.isBlockStatement(fnBody) && !setupCloned.async) {
          const lastStmt = fnBody.body[fnBody.body.length - 1];
          if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
            cleanupCloned = lastStmt.argument;
            const newBody = t.blockStatement(fnBody.body.slice(0, -1));
            // Phase 9 Plan 09-04 (RESEARCH Pitfall 3) — `returnType` is
            // intentionally NOT carried over: the `return` statement was just
            // peeled off into `cleanupCloned`, so the original setup
            // callback's return annotation no longer describes this body.
            // `params` (with any author annotations) ARE passed by reference,
            // and a lifecycle setup callback declaring `typeParameters` is
            // outside the supported TS surface (CONTEXT — annotations on
            // let/const, function params, catch bindings). Re-attaching
            // either here would be wrong.
            const newArrow = t.arrowFunctionExpression(
              setupCloned.params,
              newBody,
              setupCloned.async,
            );
            setupCloned = newArrow;
          }
        }
      }
      perHook.push({ setupCloned, cleanupCloned, phase: lh.phase });
      break;
    }
  }
  return { perHook, consumedIndices: consumed };
}

/**
 * One rendered lifecycle hook, bucketed into either the constructor or
 * ngAfterViewInit() — see renderLifecycleHook for the bucketing rules.
 */
interface RenderedLifecycleHook {
  /** Which class member the rendered code belongs in. */
  kind: 'constructor' | 'afterViewInit';
  /** Generated source lines (already trimmed; caller handles indentation). */
  code: string;
  /**
   * True when the rendered code references `this.__rozieDestroyRef` — the
   * caller must hoist `private __rozieDestroyRef = inject(DestroyRef);` as a
   * class field. `inject()` is only valid in constructor / field-initializer
   * injection context, so cleanup callbacks emitted from ngAfterViewInit must
   * dereference the pre-injected field instead of calling inject() inline.
   */
  needsDestroyRefField: boolean;
}

/**
 * Render a single lifecycle hook into the class member it belongs in.
 *
 * Bucketing rules:
 *   - phase 'mount' (with or without paired cleanup) → `ngAfterViewInit()`.
 *     Angular's `viewChild()` signals return `undefined` until after view-init
 *     fires; running setup in the constructor breaks any `$el`-touching mount
 *     body (e.g., `new SortableJS(this.__rozieRoot()?.nativeElement, ...)`
 *     throws because the nativeElement is undefined pre-view-init). Mirrors
 *     React `useEffect(..., [])`, Vue `onMounted`, Svelte `$effect`.
 *   - phase 'mount' + paired cleanup → setup + cleanup BOTH go into
 *     ngAfterViewInit, with the cleanup registered through the hoisted
 *     `this.__rozieDestroyRef` field (inject() is invalid outside the
 *     constructor / field-initializer context). Keeping the pair together
 *     preserves any locals declared in the setup body that the cleanup
 *     closure references (cleanup-return form).
 *   - phase 'unmount' standalone → constructor: `inject(DestroyRef).onDestroy(<cleanup>);`
 *   - phase 'update' → constructor: `effect(() => { ... })` (auto-tracks
 *     reactive reads; effect() must run in injection context).
 */
function renderLifecycleHook(
  hook: LifecycleClonedBody,
  classMembers: ReadonlySet<string>,
  collisionRenames: ReadonlyMap<string, string>,
): RenderedLifecycleHook {
  const { setupCloned, cleanupCloned, phase } = hook;

  if (phase === 'unmount') {
    return {
      kind: 'constructor',
      code: `inject(DestroyRef).onDestroy(${invokeOrPass(setupCloned, classMembers, collisionRenames)});`,
      needsDestroyRefField: false,
    };
  }

  if (phase === 'update') {
    return {
      kind: 'constructor',
      code: `effect(() => ${invokeOrPass(setupCloned, classMembers, collisionRenames, true)});`,
      needsDestroyRefField: false,
    };
  }

  // phase === 'mount' — runs after view init so viewChild() signals are populated.
  const setupInvocation = invokeAndExpand(setupCloned, classMembers, collisionRenames);

  if (cleanupCloned === null) {
    return {
      kind: 'afterViewInit',
      code: setupInvocation,
      needsDestroyRefField: false,
    };
  }

  const cleanupRef = invokeOrPass(cleanupCloned, classMembers, collisionRenames);
  return {
    kind: 'afterViewInit',
    code: `${setupInvocation}\nthis.__rozieDestroyRef.onDestroy(${cleanupRef});`,
    needsDestroyRefField: true,
  };
}

/**
 * For an arrow/function expression, return its body inlined into a callable
 * IIFE form `(arrow)()` or — when the arrow is identifier-bound — the bare
 * identifier invocation `name()`.
 *
 * For an Identifier (function reference like `lockScroll`) emit `lockScroll();`.
 */
function renderClassMemberRef(
  name: string,
  classMembers: ReadonlySet<string>,
  collisionRenames: ReadonlyMap<string, string>,
): string {
  // Apply collision-rename if applicable, then check class membership.
  const renamed = collisionRenames.get(name) ?? name;
  if (classMembers.has(renamed)) {
    return `this.${renamed}`;
  }
  return name;
}

function invokeAndExpand(
  setup: t.Expression | t.BlockStatement,
  classMembers: ReadonlySet<string>,
  collisionRenames: ReadonlyMap<string, string>,
): string {
  if (t.isIdentifier(setup)) {
    const ref = renderClassMemberRef(setup.name, classMembers, collisionRenames);
    return `${ref}();`;
  }
  if (t.isArrowFunctionExpression(setup) || t.isFunctionExpression(setup)) {
    const fnBody = setup.body;
    if (t.isBlockStatement(fnBody)) {
      // Inline the body as a sequence of statements rather than as an
      // IIFE — this keeps the constructor reading naturally.
      const stmts = fnBody.body.map((s) => genCode(s)).join('\n');
      return stmts;
    }
    // Expression-bodied — emit as expression statement.
    return `${genCode(fnBody)};`;
  }
  if (t.isBlockStatement(setup)) {
    const stmts = setup.body.map((s) => genCode(s)).join('\n');
    return stmts;
  }
  return `(${genCode(setup)})();`;
}

/**
 * Render a callable reference suitable as `inject(DestroyRef).onDestroy(<X>)`'s
 * argument — Identifier passes verbatim, arrow/function-expression passes as
 * a callable expression, BlockStatement wraps in `() => { ... }`.
 *
 * When `wrapInArrow` is true, always wrap the result in `() => { ... }` so
 * effect() callbacks have the right shape.
 */
function invokeOrPass(
  node: t.Node,
  classMembers: ReadonlySet<string>,
  collisionRenames: ReadonlyMap<string, string>,
  wrapInArrow = false,
): string {
  if (t.isIdentifier(node)) {
    const ref = renderClassMemberRef(node.name, classMembers, collisionRenames);
    return wrapInArrow ? `() => ${ref}()` : ref;
  }
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    if (wrapInArrow) {
      const fnBody = node.body;
      if (t.isBlockStatement(fnBody)) {
        return `() => ${genCode(fnBody)}`;
      }
      return `() => { ${genCode(fnBody)}; }`;
    }
    return genCode(node);
  }
  if (t.isBlockStatement(node)) {
    return `() => ${genCode(node)}`;
  }
  return genCode(node as t.Expression);
}

export interface EmitScriptResult {
  /**
   * Portal-slot primitive (Spike 003) — markup to append to the component
   * template when the wrapper uses any `<slot portal />`. Empty string when
   * no portal slots are present. emitAngular splices this into the rendered
   * template string AFTER emitTemplate runs.
   */
  portalTemplateAppend: string;
  /** The class body text (lines inside `class X { ... }`, without surrounding braces). */
  classBody: string;
  /** Import collector — populated with every @angular/core symbol referenced. */
  imports: AngularImportCollector;
  /** Standalone interface declarations (slot ctx interfaces) — emitted BEFORE the class. */
  interfaceDecls: string[];
  /**
   * Spike 001 B1 — user-authored `<script>` `ImportDeclaration` statements
   * rendered as a single string, ready to splice at module top by the shell.
   * Empty when the script has no imports. Without this hoist the imports
   * would be emitted INSIDE the constructor body and produce TS1232.
   */
  userImports: string;
  /**
   * Phase 06.1 P2 (D-100/D-101): per-expression child sourcemap produced by
   * generating the user-authored constructor-expression statements as a single
   * t.Program with sourceMaps:true. Maps generated positions back to .rozie
   * source lines. Null when no user residual statements exist or no filename
   * was provided.
   */
  scriptMap: EncodedSourceMap | null;
  /**
   * Number of lines in the class body BEFORE the user-authored
   * constructor-expression statements. Used by buildShell to compute the
   * total userCodeLineOffset (lines in the full output before user code).
   * Includes: field declaration lines + blank separator (if fields exist) +
   * constructor header line.
   */
  preambleSectionLines: number;
  diagnostics: Diagnostic[];
}

/**
 * Phase 06.1 P2 emitScript options.
 */
export interface EmitScriptOptions {
  /**
   * .rozie filename surfaced as `sourceFileName` on @babel/generator's
   * per-call output map (D-103). Defaults to '<rozie>' when omitted.
   */
  filename?: string;
  /**
   * Spike 004 — per-component scope hash threaded into `emitPortals` so the
   * portal closure's `container.setAttribute('data-rozie-portal-<name>', …)`
   * line uses the same hash the `@portal` CSS rules are scoped with. Empty
   * string / omitted when the caller has no portal slots to scope.
   */
  portalScopeHash?: string;
  /**
   * Phase 23 (angular-cva-forms-integration) — the single `model: true` prop
   * the auto-`ControlValueAccessor` wraps, or `null` when CVA is off (zero/≥2
   * model props OR `cva: false`). Computed once in emitAngular() and threaded
   * here. When non-null, emitScript appends the four CVA methods
   * (`writeValue` / `registerOnChange` / `registerOnTouched` /
   * `setDisabledState`) + the `__rozieCvaOnTouched` host-callback + three
   * private members (`__rozieCvaOnChange` / `__rozieCvaOnTouchedFn` /
   * `__rozieCvaDisabled`) to the class body. When null, NOTHING is appended —
   * byte-identical to the pre-CVA output.
   */
  cvaModelProp?: PropDecl | null;
}

/**
 * 260602-9lw — detect a literal `{ immediate: true }` third argument on a cloned
 * `$watch(...)` call. Mirrors the core collector's parse discipline; any other
 * shape defaults to lazy. Re-read here because the watcher loop walks the cloned
 * Program by source order rather than consuming `ir.watchers`.
 */
function watchCallIsImmediate(expr: t.CallExpression): boolean {
  const optionsArg = expr.arguments[2];
  if (!optionsArg || !t.isObjectExpression(optionsArg)) return false;
  for (const prop of optionsArg.properties) {
    if (!t.isObjectProperty(prop)) continue;
    if (prop.computed) continue;
    let key: string | null = null;
    if (t.isIdentifier(prop.key)) key = prop.key.name;
    else if (t.isStringLiteral(prop.key)) key = prop.key.value;
    if (key !== 'immediate') continue;
    if (t.isBooleanLiteral(prop.value) && prop.value.value === true) return true;
  }
  return false;
}

export function emitScript(
  ir: IRComponent,
  opts: EmitScriptOptions = {},
): EmitScriptResult {
  // Phase 06.1 P2 (D-103): wire opts.filename through GEN_OPTS.sourceFileName.
  void opts.filename;
  const diagnostics: Diagnostic[] = [];

  // 1. Clone Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 1b. Spike 001 B1 + Phase 9 Plan 09-04 — partition user-authored top-level
  //     ImportDeclarations AND statement-position `interface`/`type`
  //     declarations out of the Program body BEFORE any downstream pass
  //     iterates the body. Mutate `cloned.program.body` in place so index-based
  //     passes (lifecycle pairing, $watch consumption, the residual user-script
  //     loop) naturally operate on the partitioned body.
  //
  //     `userImports` is rendered as a string for the shell to splice at module
  //     top — without this hoist imports would land in the constructor body and
  //     produce TS1232.
  //
  //     `hoistedTypeDecls` carries any `<script lang="ts">` statement-position
  //     `TSInterfaceDeclaration` / `TSTypeAliasDeclaration`. A type declaration
  //     inside the `@Component` class body is a TS syntax error (TS1068), and
  //     leaving it in `bodyStmts` would also expose its type-position
  //     identifiers to `rewriteRozieIdentifiers` below (mangling a
  //     `count: number` property signature into `this.count(): number`). We
  //     push them onto `interfaceDecls` — the shell already emits that bucket
  //     at MODULE scope, above the `@Component` decorator — so they land in
  //     legal module scope, exactly like the inline-`ClassDeclaration` hoist at
  //     Section 9 and the slot-context interfaces. `hoistedTypeDecls` is always
  //     empty for an untyped `<script>`, so untyped emit is byte-identical.
  const {
    userImports: userImportNodes,
    hoistedTypeDecls,
    bodyStmts,
  } = partitionUserImports(cloned);
  cloned.program.body = bodyStmts;
  const userImports =
    userImportNodes.length > 0
      ? userImportNodes.map((imp) => genCode(imp)).join('\n') + '\n'
      : '';

  // 1b-bis. Phase 18 (Req 2) — normalize the producer-side two-way-write sigil
  //     `$model.X` → `$props.X` at the EARLIEST point, BEFORE the double-read
  //     hoist + lifecycle pairing + the identifier rewrite. Every Angular
  //     script-side classification site (hoistDoubleReadAccessors keys on
  //     `$props`/`$data`; A2) and lowering site keys on `$props`, so a single
  //     normalization here routes `$model` model writes/reads through the
  //     IDENTICAL `$props.<modelProp>` lowering — byte-identical emit (reuse,
  //     not reimplement). `$model` is model-only by contract (Wave 1) and always
  //     a member-expression object (D-03).
  normalizeModelAccessor(cloned);

  // 1c. Quick task 260520-w18 bug class 5 — hoist double-read $props/$data
  //     accessors to a single signal-read local. MUST run BEFORE
  //     pairClonedLifecycle: that pass slices `$onMount` bodies into a fresh
  //     statement array, so a `const __X` unshifted afterwards would not
  //     survive into the lifecycle copy. Running it here, on the shared
  //     statement nodes, means both the top-level body and the sliced
  //     lifecycle bodies see the hoist.
  hoistDoubleReadAccessors(cloned);

  // 2. Pair lifecycle hooks BEFORE rewriting identifiers — pairClonedLifecycle
  //    looks for top-level `$onMount(IDENTIFIER)` patterns; the rewrite would
  //    otherwise convert bare Identifier names like `lockScroll` to
  //    `this.lockScroll` MemberExpressions, breaking pairing detection. The
  //    rewriter's Identifier visitor is configured to SKIP direct lifecycle
  //    call args so the args remain bare Identifiers post-rewrite — this
  //    pre-pass is here for defensive ordering.
  const lifecyclePairing = pairClonedLifecycle(cloned, ir);

  // 2b. Bug 4: scan for `$emit('name', payload)` BEFORE the rewrite erases the
  //     `$emit` callee. Events never passed a payload → `output<void>()`.
  const emitsWithPayload = collectEmitsWithPayload(cloned);

  // 3. Rewrite identifiers on the clone.
  const rewriteResult = rewriteRozieIdentifiers(cloned, ir);
  diagnostics.push(...rewriteResult.diagnostics);

  // 4. Compute Angular imports based on IR shape.
  const imports = collectAngularImports(ir);

  // 4b. Locate cloned bodies for ComputedDecl post-rewrite.
  const clonedComputedBodies = findClonedComputedBodies(cloned);

  // 5. Build module-scope declarations rendered above the @Component class.
  //    Author-declared `<script lang="ts">` `interface`/`type` aliases
  //    (hoisted in Section 1b) go FIRST so user-authored types read at the
  //    top of the file; the synthesized per-slot context interfaces follow.
  //    Both land at module scope via the shell's `interfaceDecls` bucket.
  const interfaceDecls: string[] = [];
  for (const typeDecl of hoistedTypeDecls) {
    interfaceDecls.push(genCode(typeDecl));
  }
  const slotFieldDecls: string[] = [];
  for (const slot of ir.slots) {
    const ctx = buildSlotCtx(slot);
    interfaceDecls.push(ctx.interfaceDecl);
    slotFieldDecls.push(ctx.fieldDecl);
  }

  // 6. Build field declarations.
  const fieldLines: string[] = [];

  // 6a. Props: model() vs input().
  for (const p of ir.props) {
    let tsType = renderType(p.typeAnnotation);
    const defaultVal = renderDefault(p);
    const fnName = p.isModel ? 'model' : 'input';
    // Bug 1: an explicit `default: null` produces a `null` initializer, which
    // is not assignable to the bare prop type — widen the field type to
    // `(T) | null` so `input<(T) | null>(null)` typechecks. The base type is
    // parenthesized because a bare function type (`(...args) => unknown`)
    // would otherwise bind `| null` inside its return type.
    if (hasExplicitNullDefault(p)) {
      tsType = `(${tsType}) | null`;
    }
    if (defaultVal) {
      fieldLines.push(`${p.name} = ${fnName}<${tsType}>(${defaultVal});`);
    } else if (p.required) {
      // 260521-oao — `p.required` is the SOLE optionality determinant. A
      // `required: true` no-default prop emits `input.required<T>()` /
      // `model.required<T>()` (consumer MUST pass it).
      fieldLines.push(`${p.name} = ${fnName}.required<${tsType}>();`);
    } else {
      // 260521-oao — a plain no-default prop is OPTIONAL: emit `input<T>()` /
      // `model<T>()` (the initializerless signal is `T | undefined`). Angular
      // no longer treats no-default as required — `required` does that.
      fieldLines.push(`${p.name} = ${fnName}<${tsType}>();`);
    }
  }

  // 6b. State signals.
  for (const s of ir.state) {
    const initText = genCode(s.initializer);
    // Quick task 260520-w18 bug class 2/6(iii) — an empty-array `<data>`
    // initializer (`files: []`) types as `signal<never[]>`, so
    // `files().map(f => f.id)` fails TS2339 and an `@for` over `files()`
    // types its loop variable as `never`. Annotate the empty-array literal
    // case as `signal<any[]>([])`. Mirrors the React/Vue/Svelte fix.
    //
    // Phase 16 follow-up — a NullLiteral state initializer (`observed: null`)
    // similarly types as `signal<null>` and rejects subsequent writes
    // (`observed.set({...})` fails TS2345). The author intent for `null` is
    // "sentinel/initial value that will be replaced." Annotate as
    // `signal<any>(null)` — same pattern as typeNeutralizeScript's
    // `let editor = null` → `let editor: any = null` widening (per memory
    // `project_typeneutralize_script`). Empty-object literal `{}` already
    // types permissively enough (Record<string, never>); only the null
    // case needs widening here. PropDefaultCoercion.rozie is the canary.
    let signalTypeArg = '';
    if (
      t.isArrayExpression(s.initializer) &&
      s.initializer.elements.length === 0
    ) {
      signalTypeArg = '<any[]>';
    } else if (t.isNullLiteral(s.initializer)) {
      signalTypeArg = '<any>';
    }
    fieldLines.push(`${s.name} = signal${signalTypeArg}(${initText});`);
  }

  // 6c. RefDecls — viewChild signals.
  for (const r of ir.refs) {
    let domType = 'HTMLElement';
    switch (r.elementTag.toLowerCase()) {
      case 'input':
        domType = 'HTMLInputElement';
        break;
      case 'textarea':
        domType = 'HTMLTextAreaElement';
        break;
      case 'select':
        domType = 'HTMLSelectElement';
        break;
      case 'button':
        domType = 'HTMLButtonElement';
        break;
      case 'form':
        domType = 'HTMLFormElement';
        break;
      case 'div':
        domType = 'HTMLDivElement';
        break;
    }
    fieldLines.push(`${r.name} = viewChild<ElementRef<${domType}>>('${r.name}');`);
  }

  // 6d. Output emits.
  //     Bug 4: events that never carry a payload emit `output<void>()` so a
  //     payload-less `.emit()` call typechecks; payload-carrying events keep
  //     `output<unknown>()`.
  //     Bug 2 (260520-gi1): kebab/snake-case event names are not valid JS
  //     identifiers — sanitize the field id and preserve the consumer-facing
  //     event name via `output()`'s optional `{ alias }` argument. Names that
  //     are already valid identifiers stay byte-identical (no alias arg).
  for (const e of ir.emits) {
    const outputType = emitsWithPayload.has(e) ? 'unknown' : 'void';
    const fieldId = sanitizeEventName(e);
    if (fieldId === e) {
      fieldLines.push(`${fieldId} = output<${outputType}>();`);
    } else {
      fieldLines.push(`${fieldId} = output<${outputType}>({ alias: '${e}' });`);
    }
  }

  // 6e. @ContentChild slot tpl fields.
  for (const decl of slotFieldDecls) {
    fieldLines.push(decl);
  }

  // 6e.bis Phase 07.3.2 — accept consumer-side dynamic-name templates map
  // (D-SV-16 cross-target port; signal-era `input<T>()` form per RESEARCH A7,
  // NOT decorator `@Input()`). Consumer emitter (emitTemplateNode.ts:449)
  // emits a class-body `templates` getter that returns
  // `Record<string, TemplateRef<unknown>>`; the producer-side `templates`
  // signal input declared here is the symmetric receiving half. The
  // @ContentChild static-name precedence (D-02) is preserved at the binding
  // site (emitSlotInvocation.ts:311) via the `??` LEFT operand —
  // @ContentChild populates in `ngAfterContentInit` BEFORE template binding
  // evaluation (Assumption A5). Gated on `ir.slots.length > 0` so non-slotted
  // components (Counter, SearchInput, Dropdown) stay byte-identical (D-05
  // byte-equivalence invariant). The signal-form mirrors the surrounding
  // Section 6a `input<T>()` style at L569-573 (Pattern 6); the binding-site
  // read becomes `templates()?.['<X>']` (signal call) — NOT `templates?.['<X>']`.
  if (ir.slots.length > 0) {
    fieldLines.push(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
    // Defensive `input` import — Section 6a's `hasNonModelProps` path adds
    // `input` for components with any non-model prop; a slot-only component
    // with no props (or only model props) would miss it. collectAngularImports
    // already adds `TemplateRef` for `ir.slots.length > 0` at L181-184.
    imports.add('input');
  }

  // 7. Build computed properties.
  const computedLines: string[] = [];
  for (const c of ir.computed) {
    const body = clonedComputedBodies.get(c.name) ?? c.body;
    computedLines.push(`${c.name} = computed(${arrowBody(body)});`);
  }

  // 8. Build lifecycle blocks, bucketed per-phase:
  //    - mount → ngAfterViewInit() so viewChild() signals are populated
  //    - unmount / update → constructor (inject() / effect() need injection context)
  //    See renderLifecycleHook for the bucketing rationale.
  const lifecycleConstructorLines: string[] = [];
  const lifecycleAfterViewInitLines: string[] = [];
  let lifecycleNeedsDestroyRefField = false;
  for (const hook of lifecyclePairing.perHook) {
    const rendered = renderLifecycleHook(
      hook,
      rewriteResult.classMembers,
      rewriteResult.collisionRenames,
    );
    if (rendered.kind === 'afterViewInit') {
      lifecycleAfterViewInitLines.push(rendered.code);
    } else {
      lifecycleConstructorLines.push(rendered.code);
    }
    if (rendered.needsDestroyRefField) lifecycleNeedsDestroyRefField = true;
  }

  // Portal-slot primitive (Spike 003) — synthesize portal scaffolding before
  // we finalize lifecycleAfterViewInitLines / fieldLines so we can splice
  // the closure + destroy registration into the same ngAfterViewInit block.
  const portalsEmit = emitPortals(ir, opts.portalScopeHash ?? '');
  if (portalsEmit.hasPortals) {
    for (const symName of portalsEmit.angularImports) {
      // AngularImportCollector accepts any string via .add — narrow at runtime.
      (imports as { add: (n: string) => void }).add(symName);
    }
    for (const decl of portalsEmit.fieldDecls) fieldLines.push(decl);
    // Closure runs FIRST in ngAfterViewInit so user lifecycle bodies below
    // can reference `portals.<name>(...)`. Destroy registration runs LAST so
    // the cleanup loop executes before user-registered cleanups (Angular runs
    // onDestroy callbacks in registration order — last in, last out).
    lifecycleAfterViewInitLines.unshift(portalsEmit.closureBlock);
    lifecycleAfterViewInitLines.push(portalsEmit.destroyRegister);
    if (portalsEmit.needsDestroyRefField) {
      lifecycleNeedsDestroyRefField = true;
    }
  }

  // When at least one mount hook with paired cleanup landed in ngAfterViewInit,
  // hoist `private __rozieDestroyRef = inject(DestroyRef);` as a class field.
  // inject() is only valid in injection context (constructor body /
  // field initializer); cleanup callbacks run from ngAfterViewInit must call
  // `this.__rozieDestroyRef.onDestroy(...)` instead. `inject` and `DestroyRef`
  // are already on the imports list when ir.lifecycle is non-empty with cleanup
  // (see collectAngularImports).
  if (lifecycleNeedsDestroyRefField) {
    fieldLines.push('private __rozieDestroyRef = inject(DestroyRef);');
  }

  // 8b. Quick plan 260515-u2b — $watch lowers to effect(() => { (getter)(); (cb)(); }).
  // Angular signals' `effect()` is the equivalent of Svelte's $effect / Solid's
  // createEffect — it auto-tracks signal reads inside its body. We walk the
  // cloned Program to find top-level $watch calls; the bodies were already
  // rewritten by rewriteRozieIdentifiers (so `$props.open` → `this.open()` etc).
  // The `effect` symbol is already on the @angular/core import list when
  // lifecycle.update or watchers exist.
  const watcherConsumedIndices = new Set<number>();
  let watchIdx = 0;
  for (let i = 0; i < cloned.program.body.length; i++) {
    if (lifecyclePairing.consumedIndices.has(i)) continue;
    const stmt = cloned.program.body[i];
    if (!stmt || !t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) continue;
    if (expr.callee.name !== '$watch') continue;
    const getterArg = expr.arguments[0];
    const cbArg = expr.arguments[1];
    if (
      !getterArg ||
      (!t.isArrowFunctionExpression(getterArg) && !t.isFunctionExpression(getterArg))
    ) {
      continue;
    }
    if (
      !cbArg ||
      (!t.isArrowFunctionExpression(cbArg) && !t.isFunctionExpression(cbArg))
    ) {
      continue;
    }
    watcherConsumedIndices.add(i);
    const getterCode = genCode(getterArg as t.Node);
    const cbCode = genCode(cbArg as t.Node);
    // Bind the getter's evaluated value as the callback's first argument so
    // user-authored `(v) => ...` params actually receive the new value at
    // invocation time. Without this the param is bound to `undefined` and
    // any `instance?.option('x', v)` writes a silent no-op.
    //
    // Only pass __watchVal when the callback declares a param to receive it —
    // passing an arg to a 0-param arrow is runtime-safe (JS drops extras) but
    // tsc flags TS2554 "Expected 0 arguments, but got 1". Conditional bind keeps
    // both `(v) => ...` and `() => ...` shapes type-clean. Matches Solid + Lit.
    const cbParamCount =
      t.isArrowFunctionExpression(cbArg) || t.isFunctionExpression(cbArg)
        ? cbArg.params.length
        : 0;
    const callArg = cbParamCount > 0 ? '__watchVal' : '';
    const idx = watchIdx++;
    const immediate = watchCallIsImmediate(expr);
    // Bug B fix (260519 linechart-watch-recreate) — the callback runs inside
    // `untracked(...)` (from @angular/core) so its reads — including transitive
    // ones via a helper call like `buildConfig()` reading `$props.data` — do
    // NOT join the watcher effect's dependency set. The getter is still invoked
    // in the tracking scope so its reads subscribe the effect; only those reads
    // define what re-runs the watcher — matching Vue's `watch(getter, cb)` and
    // Solid's untrack-wrapped $watch callback (commit e57df14).
    //
    // 260602-9lw — `$watch` is now LAZY by default on all six targets (REVERSES
    // the 260519 immediate-by-default contract). Angular's `effect()` runs once
    // initially to establish tracking — that initial run IS the eager fire. For
    // the default (`!immediate`) we make the skip EXPLICIT via a class-field
    // first-run flag read/written INSIDE `untracked(...)` (so it does not join
    // the effect's dependency set); the callback fires only on subsequent
    // changes. `{ immediate: true }` keeps today's eager shape.
    if (immediate) {
      lifecycleConstructorLines.push(
        `effect(() => { const __watchVal = (${getterCode})(); untracked(() => (${cbCode})(${callArg})); });`,
      );
    } else {
      const flag = `__rozieWatchInitial_${idx}`;
      fieldLines.push(`private ${flag} = true;`);
      lifecycleConstructorLines.push(
        `effect(() => { const __watchVal = (${getterCode})(); untracked(() => { if (this.${flag}) { this.${flag} = false; return; } (${cbCode})(${callArg}); }); });`,
      );
    }
  }
  // Ensure `effect` is on the @angular/core import list when at least one
  // watcher exists (covers the case where the IR has no $onUpdate hook).
  // `untracked` is paired with `effect` for the Bug B $watch callback wrap.
  if (ir.watchers.length > 0) {
    imports.add('effect');
    imports.add('untracked');
  }

  // 9. Build residual user-script body — methods/arrows go at CLASS level
  //    (so they're invokable via `this.name(...)`); top-level statements
  //    (console.log, expression-statements) go in the constructor body.
  const classMethodLines: string[] = [];
  const constructorExpressionLines: string[] = [];
  // Collect the raw t.Statement nodes for user residual constructor expressions
  // so we can generate a single-program source map (for devtools line accuracy).
  const residualStmts: t.Statement[] = [];

  for (let i = 0; i < cloned.program.body.length; i++) {
    if (lifecyclePairing.consumedIndices.has(i)) continue;
    // Quick plan 260515-u2b — $watch lines emitted into constructor above.
    if (watcherConsumedIndices.has(i)) continue;
    const stmt = cloned.program.body[i]!;

    // Skip $computed VariableDeclarations (consumed above).
    if (t.isVariableDeclaration(stmt)) {
      const allComputed =
        stmt.declarations.length > 0 &&
        stmt.declarations.every(
          (d) =>
            d.init &&
            t.isCallExpression(d.init) &&
            t.isIdentifier(d.init.callee) &&
            d.init.callee.name === '$computed',
        );
      if (allComputed) continue;

      // For each declarator that's an arrow/function-expression, emit as a
      // class-level arrow field. Other declarators (e.g., let/const with
      // primitive values) go to the constructor body.
      for (const d of stmt.declarations) {
        if (!t.isIdentifier(d.id) || !d.init) {
          // Multi-declarator non-identifier — fall back to constructor.
          constructorExpressionLines.push(genCode(stmt));
          residualStmts.push(stmt);
          break;
        }
        if (
          t.isArrowFunctionExpression(d.init) ||
          t.isFunctionExpression(d.init)
        ) {
          // Emit as class-level arrow field. WR-01 ROOT CAUSE 2: a declarator
          // type annotation (`const f: (e: MouseEvent) => void = …`) must
          // survive onto the class field — `${d.id.name} = …` alone drops it.
          // Re-emit it as `f: (e: MouseEvent) => void = …`. When that
          // annotation is a genuine FUNCTION type, the arrow's params are
          // contextually typed by it, so do NOT `annotateUntypedParams` — a
          // `: any` fill would override the author's types (and core's
          // typeNeutralizeScript already left them bare for this shape).
          // Otherwise (Bug 2 path, including a non-function declarator
          // annotation) annotate un-typed params with `: any` so the lifted
          // field typechecks under `strict`.
          const declTypeSuffix = renderDeclaratorTypeSuffix(d.id);
          if (!declaratorHasFunctionType(d.id)) {
            annotateUntypedParams(d.init.params);
          }
          const arrowCode = genCode(d.init);
          classMethodLines.push(`${d.id.name}${declTypeSuffix} = ${arrowCode};`);
        } else {
          // Primitive / other init — emit as class-level field too. Class fields
          // initialized at field declaration time match user intent ("this is
          // module-level state"). genCode the whole declarator (not just the
          // init) so a `: any` annotation added by typeNeutralizeScript — e.g.
          // `let editor = null` → `editor: any = null` — survives onto the
          // field; without it the field is typed `null` and every reassignment
          // (`this.editor = new Editor()`) is TS2322.
          classMethodLines.push(`${genCode(d)};`);
        }
      }
      continue;
    }

    // FunctionDeclaration → class method.
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      // Convert `function foo() {...}` → arrow class field. Bug 2: annotate
      // un-typed params with `: any` so the lifted field typechecks under
      // `strict`.
      annotateUntypedParams(stmt.params);
      const arrow = t.arrowFunctionExpression(
        stmt.params,
        stmt.body,
        stmt.async ?? false,
      );
      // Phase 9 Plan 09-04 (RESEARCH Pitfall 3) — `t.arrowFunctionExpression`
      // does NOT carry over a `FunctionDeclaration`'s author `returnType` /
      // `typeParameters`. For a `<script lang="ts">` `function describe(x):
      // string {…}` the `: string` return annotation would be silently
      // dropped from the lifted class field. Re-attach both so author types
      // survive verbatim. `?? null` because a `FunctionDeclaration` carries
      // these as `… | null | undefined` while an `ArrowFunctionExpression`'s
      // fields are `… | null` (no `undefined` under `exactOptionalPropertyTypes`);
      // for an untyped function both are absent, so the result is `null` —
      // no emit change.
      arrow.returnType = stmt.returnType ?? null;
      arrow.typeParameters = stmt.typeParameters ?? null;
      const fnCode = genCode(arrow);
      classMethodLines.push(`${stmt.id.name} = ${fnCode};`);
      continue;
    }

    // ClassDeclaration → hoist to MODULE scope (before the @Component class).
    // The Angular emitter would otherwise land the declaration in the
    // constructor body via the catch-all `else` below, which means lifecycle
    // methods (`ngAfterViewInit`, etc.) can't see the class — the
    // constructor's scope ends as soon as the constructor returns. Piggyback
    // on the shell's `interfaceDecls` slot, which already lands between
    // `importLines` and the `@Component` decorator.
    //
    // Required for inline-engine wrappers like examples/PortalList.rozie that
    // declare a tiny vanilla-JS class in `<script>` and reference it from
    // `$onMount`. Mirrors the natural shape every other target gets for free
    // (Vue/React/Svelte/Solid/Lit emit class declarations into the same
    // scope as the lifecycle hook bodies).
    if (t.isClassDeclaration(stmt) && stmt.id) {
      interfaceDecls.push(genCode(stmt));
      continue;
    }

    // ExpressionStatements (console.log, $emit calls, etc.) → constructor body.
    if (t.isExpressionStatement(stmt)) {
      // Phase 21 (REQ-7) — a top-level `$expose({...})` call is a COMPILE-TIME
      // directive consumed via `ir.expose`. Angular re-emits the named user
      // functions as public class methods (Section 9 lifting); the `$expose(...)`
      // CALL itself must be STRIPPED here, not lifted into the constructor —
      // otherwise it leaks as an undefined-`$expose` runtime reference (mirrors
      // the Vue/React residual-body strip). Skip ONLY the top-level call form.
      const callExpr = stmt.expression;
      if (
        t.isCallExpression(callExpr) &&
        t.isIdentifier(callExpr.callee) &&
        callExpr.callee.name === '$expose'
      ) {
        continue;
      }
      // Already filtered $onMount/$onUnmount/$onUpdate above (consumed).
      // Remaining ExpressionStatements: e.g., `console.log("hello from rozie")`.
      constructorExpressionLines.push(genCode(stmt));
      residualStmts.push(stmt);
      continue;
    }

    // Fallback: emit verbatim into constructor.
    constructorExpressionLines.push(genCode(stmt));
    residualStmts.push(stmt);
  }

  // 10. Assemble the constructor body.
  // Order:
  //   inject(Renderer2) / inject(DestroyRef) consts (only if needed)
  //   user residual top-level statements (console.log etc.)
  //   lifecycle hook calls (paired-cleanup form)
  //   listener effect blocks (Plan 05-04a Task 3 splices in)
  const constructorBodyLines: string[] = [];

  // Note: we do NOT preemptively inject Renderer2/DestroyRef here — the
  // listener emitter (Task 3) will splice its own `inject(Renderer2)` / `inject(DestroyRef)`
  // lines into the constructor as needed. For lifecycle-only components,
  // `inject(DestroyRef).onDestroy(...)` calls are inlined directly.

  for (const line of constructorExpressionLines) {
    constructorBodyLines.push(line);
  }
  for (const line of lifecycleConstructorLines) {
    constructorBodyLines.push(line);
  }

  // 11. Build the final class body.
  const classBodyParts: string[] = [];
  if (fieldLines.length > 0) {
    classBodyParts.push(fieldLines.join('\n'));
  }
  if (constructorBodyLines.length > 0) {
    const indented = constructorBodyLines
      .map((l) =>
        l
          .split('\n')
          .map((line) => (line.length > 0 ? '  ' + line : line))
          .join('\n'),
      )
      .join('\n');
    classBodyParts.push(`constructor() {\n${indented}\n}`);
  }
  if (lifecycleAfterViewInitLines.length > 0) {
    const indented = lifecycleAfterViewInitLines
      .map((l) =>
        l
          .split('\n')
          .map((line) => (line.length > 0 ? '  ' + line : line))
          .join('\n'),
      )
      .join('\n');
    classBodyParts.push(`ngAfterViewInit() {\n${indented}\n}`);
  }
  if (computedLines.length > 0) {
    classBodyParts.push(computedLines.join('\n'));
  }
  if (classMethodLines.length > 0) {
    classBodyParts.push(classMethodLines.join('\n'));
  }

  // Phase 23 — auto-CVA static class shape, gated on the single cvaModelProp.
  // Null (zero/≥2 model props OR cva:false) → nothing appended → byte-identical
  // to the pre-CVA output. The dynamic write-site/disabled-read hookup is Plan 03.
  if (opts.cvaModelProp != null) {
    classBodyParts.push(buildCvaClassShape(opts.cvaModelProp));
  }

  // ngTemplateContextGuard static method (only if slots present).
  const guardMethod = buildNgTemplateContextGuard(ir.name, ir.slots);
  if (guardMethod) {
    classBodyParts.push(guardMethod);
  }

  const classBody = classBodyParts.join('\n\n');

  // Phase 06.1 P2: generate a single-program source map for the user-authored
  // constructor-expression statements. This lets devtools resolve
  // `console.log("hello from rozie")` back to its original .rozie line.
  // We only generate when residualStmts is non-empty and a filename was provided.
  let scriptMap: EncodedSourceMap | null = null;
  if (residualStmts.length > 0 && opts.filename !== undefined) {
    const sourceFileName = opts.filename;
    const genResult = generate(
      t.file(t.program(residualStmts)),
      { ...GEN_OPTS_MAP, sourceFileName },
    );
    if (genResult.map) {
      scriptMap = genResult.map as EncodedSourceMap;
    }
  }

  // Compute the number of lines in the class body BEFORE the user-authored
  // constructor-expression statements. This is:
  //   - lines from field declarations (one per field entry)
  //   - 1 blank separator line (if fields exist, from '\n\n' join)
  //   - 1 line for `constructor() {` header
  // buildShell will add the lines before the class body in the full output.
  const fieldLineCount = fieldLines.length;
  // The class body text before the constructor body content looks like:
  //   <field1>\n<field2>\n...<fieldN>\n\nconstructor() {\n
  // fieldLineCount lines + 1 blank (if fields > 0) + 1 for constructor header
  const preambleSectionLines =
    fieldLineCount + (fieldLineCount > 0 ? 1 : 0) + 1;

  return {
    portalTemplateAppend: portalsEmit.templateAppend,
    classBody,
    imports,
    interfaceDecls,
    userImports,
    scriptMap,
    preambleSectionLines,
    diagnostics,
  };
}
