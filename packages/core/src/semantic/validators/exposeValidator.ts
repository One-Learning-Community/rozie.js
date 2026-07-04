/**
 * SEM / Phase 21 — `$expose` methods-only validator (ROZ115–ROZ120).
 *
 * `$expose({ clear, open })` exposes named `<script>` functions as a consumer-
 * callable imperative handle. This validator enforces the LOCKED accept-set
 * (21-PLAN <interfaces>): a `$expose` property value is VALID iff it is
 *   (a) a bare identifier (shorthand `{ clear }` or explicit `{ clear: clear }`)
 *       resolving to a top-level `<script>` FunctionDeclaration OR an
 *       arrow/function-valued `const`, OR
 *   (b) an inline ArrowFunctionExpression / FunctionExpression value
 *       (`{ getValue: () => $data.x }`).
 * A `$computed`-bound name is a reactive VALUE, not a function => ROZ118.
 * Everything else (literal, member-expr, call-expr, identifier not resolving to
 * a `<script>` function) => ROZ118.
 *
 * The six malformed forms each get one distinct code:
 *   ROZ115 — `$expose(x)` argument is not an object literal
 *   ROZ116 — `$expose({ ...o })` a property is a spread
 *   ROZ117 — `$expose({ [k]: v })` a property has a computed key
 *   ROZ118 — `$expose({ a: 1 })` value is not an in-scope function / inline fn
 *   ROZ119 — two top-level `$expose(...)` calls
 *   ROZ120 — `$expose(...)` inside a nested function (not Program top level)
 *
 * Plus one NAME-COLLISION code (Quick 260601-jsy):
 *   ROZ121 — an exposed method name collides with an emitted event
 *            (`bindings.emits`) OR a declared `<props>` field. On class-based
 *            targets (Angular) the event/prop is a class field and the exposed
 *            method is a class method — they cannot share a name, so the emitter
 *            silently renames the method (`_open`) or emits a duplicate member.
 *            The diagnostic makes the collision unrepresentable (the fix); the
 *            emitters are deliberately untouched. Case-sensitive; fires once per
 *            colliding property; suppressed under malformed $expose (ROZ115–117).
 *
 * At most ONE diagnostic per offending site; all error severity (D-08
 * collected-not-thrown: never throws — `compile()` never throws on malformed
 * `$expose`). Reads `bindings.exposeCalls` (every call site, populated by
 * collectScriptDecls) so duplicate + nested-scope detection needs no re-walk.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { locFromBabel } from '../../diagnostics/locFromBabel.js';
import type { BindingsTable } from '../types.js';

function locFromNode(node: t.Node): SourceLoc {
  return locFromBabel(node);
}

/**
 * Build the set of names that resolve to an in-scope `<script>` FUNCTION at
 * Program top level. A `const X = (…) => …` / `const X = function…` qualifies;
 * a `$computed`-bound const does NOT (it binds a reactive VALUE — a `$computed`
 * callback's RETURN is the value, so exposing the binding is ROZ118). Plain
 * function declarations always qualify.
 */
function collectInScopeFunctionNames(ast: RozieAST): Set<string> {
  const names = new Set<string>();
  if (!ast.script) return names;
  const body = ast.script.program.program.body;
  for (const stmt of body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
      continue;
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id)) continue;
        const init = decl.init;
        if (!init) continue;
        // Arrow / function-expression const → a function value.
        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          names.add(decl.id.name);
        }
        // NOTE: a $computed(...) const binds a reactive VALUE, not a function —
        // intentionally NOT added (exposing it is ROZ118).
      }
    }
  }
  return names;
}

/**
 * Run the `$expose` methods-only validator. Emits ROZ115–ROZ120. NEVER throws
 * (D-08). Mutates `diagnostics` in place; never mutates `ast` / `bindings`.
 */
export function runExposeValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  const calls = bindings.exposeCalls;
  if (calls.length === 0) return; // No $expose — nothing to validate.

  const inScopeFns = collectInScopeFunctionNames(ast);

  // ROZ120 — every non-top-level call is a nested-scope error.
  for (const site of calls) {
    if (!site.atTopLevel) {
      diagnostics.push({
        code: RozieErrorCode.EXPOSE_NOT_TOP_LEVEL,
        severity: 'error',
        message:
          '$expose(...) must be called once at <script> top level, not inside a function.',
        loc: locFromNode(site.call),
        hint: 'Move the $expose({ ... }) call to the top level of the <script> block.',
      });
    }
  }

  // ROZ119 — more than one TOP-LEVEL call. The first top-level call is the
  // canonical one; every subsequent top-level call is a duplicate.
  const topLevel = calls.filter((c) => c.atTopLevel);
  for (let i = 1; i < topLevel.length; i++) {
    diagnostics.push({
      code: RozieErrorCode.EXPOSE_DUPLICATE_CALL,
      severity: 'error',
      message:
        '$expose(...) may be called only once. Merge the exposed methods into a single $expose({ ... }) call.',
      loc: locFromNode(topLevel[i]!.call),
      hint: 'Combine all exposed method names into one $expose({ ... }) call.',
    });
  }

  // Shape validation runs ONLY on the canonical (first top-level) call. A
  // nested-only $expose already produced ROZ120; we do not also shape-check it.
  const canonical = topLevel[0];
  if (!canonical) return;

  const arg = canonical.call.arguments[0];

  // ROZ115 — argument is not an object literal.
  if (!arg || !t.isObjectExpression(arg)) {
    diagnostics.push({
      code: RozieErrorCode.EXPOSE_ARG_NOT_OBJECT,
      severity: 'error',
      message:
        '$expose(...) requires an object literal of method references, e.g. $expose({ clear, open }).',
      loc: locFromNode(arg ?? canonical.call),
      hint: 'Pass an object literal whose properties reference in-scope <script> functions.',
    });
    return;
  }

  for (const prop of arg.properties) {
    // ROZ116 — spread property.
    if (t.isSpreadElement(prop)) {
      diagnostics.push({
        code: RozieErrorCode.EXPOSE_SPREAD_PROPERTY,
        severity: 'error',
        message:
          '$expose({ ... }) does not support spread properties — list each exposed method explicitly.',
        loc: locFromNode(prop),
        hint: 'Replace the spread with explicit method references, e.g. { clear, open }.',
      });
      continue;
    }

    // ObjectMethod (`{ clear() {} }`) is a valid function value.
    if (t.isObjectMethod(prop)) {
      if (prop.computed) {
        diagnostics.push({
          code: RozieErrorCode.EXPOSE_COMPUTED_KEY,
          severity: 'error',
          message:
            '$expose({ ... }) does not support computed keys — use a static method name.',
          loc: locFromNode(prop),
          hint: 'Use a plain identifier key, e.g. { clear } or { clear: clear }.',
        });
      }
      continue; // a method definition IS a function value — valid.
    }

    // ObjectProperty.
    if (t.isObjectProperty(prop)) {
      // ROZ117 — computed key.
      if (prop.computed) {
        diagnostics.push({
          code: RozieErrorCode.EXPOSE_COMPUTED_KEY,
          severity: 'error',
          message:
            '$expose({ ... }) does not support computed keys — use a static method name.',
          loc: locFromNode(prop),
          hint: 'Use a plain identifier key, e.g. { clear } or { clear: clear }.',
        });
        continue;
      }

      const value = prop.value;

      // (b) inline arrow / function expression value → always valid.
      if (
        t.isArrowFunctionExpression(value) ||
        t.isFunctionExpression(value)
      ) {
        continue;
      }

      // (a) bare identifier resolving to an in-scope <script> function → valid.
      if (t.isIdentifier(value) && inScopeFns.has(value.name)) {
        continue;
      }

      // Everything else → ROZ118 (literal, member-expr, call-expr, identifier
      // not resolving to a <script> function, $computed-bound name, etc.).
      diagnostics.push({
        code: RozieErrorCode.EXPOSE_VALUE_NOT_FUNCTION,
        severity: 'error',
        message:
          '$expose({ ... }) values must reference an in-scope <script> function (or be an inline arrow). Reactive values are exposed via a getter method, e.g. { getValue: () => $data.x }.',
        loc: locFromNode(prop),
        hint: 'Reference a top-level <script> function by name, or pass an inline arrow function.',
      });
    }
  }

  // ROZ121 — name-collision check (Quick 260601-jsy). An exposed method name
  // that ALSO names an emitted event (`bindings.emits`) or a declared `<props>`
  // field collides with a class-member of the same name on class-based targets
  // (Angular): the event/prop is a class FIELD (`open = output()` / `date =
  // input()`/`model()`), the exposed method is a class METHOD — they cannot share
  // a name, so the emitter silently renames the method (`_open`) or emits a
  // duplicate member, breaking the uniform handle on 1 of 6 targets. The
  // diagnostic makes the collision unrepresentable; the emitters stay untouched.
  //
  // SUPPRESSION: this loop runs ONLY over the SAME well-formed canonical object
  // (`arg`) — the early `return` after ROZ115 already bails on a non-object arg,
  // so a structurally-malformed `$expose` (ROZ115/116/117 territory) never
  // reaches here with trustworthy names. We additionally skip spread / computed
  // properties per-prop below (mirroring the shape loop) so a single bad property
  // cannot fabricate a collision name.
  //
  // CASE-SENSITIVE (`Open` ≠ `open`); fires once per colliding property; code-
  // framed at the `$expose` property; CAN co-fire with other diagnostics. Never
  // throws (D-08).
  const propNames = new Set(bindings.props.keys());
  for (const prop of arg.properties) {
    // Skip the structurally-malformed shapes (already diagnosed above); only
    // well-formed `{ name }` / `{ name: ref }` / `{ name() {} }` carry a
    // trustworthy key to collision-check.
    if (t.isSpreadElement(prop)) continue;
    if (prop.computed) continue;

    let key: t.Expression | t.PrivateName;
    if (t.isObjectMethod(prop)) {
      key = prop.key;
    } else if (t.isObjectProperty(prop)) {
      key = prop.key;
    } else {
      continue;
    }

    // Canonical exposed name = the (non-computed) property key.
    let name: string | null = null;
    if (t.isIdentifier(key)) name = key.name;
    else if (t.isStringLiteral(key)) name = key.value;
    if (name === null) continue;

    const collidesEvent = bindings.emits.has(name);
    const collidesProp = propNames.has(name);
    if (!collidesEvent && !collidesProp) continue;

    // Name the colliding surface. Event takes precedence in the message when
    // both collide (event surface is the universal break; the prop surface is
    // class-based-target-only).
    const surface = collidesEvent
      ? `the '${name}' event this component emits`
      : `the '${name}' prop`;
    const classNote = collidesEvent
      ? "on class-based targets (Angular) the event field and the method cannot share a name"
      : 'on class-based targets (Angular) the prop field and the method cannot share a name';

    // Suggested renames. Guard the capitalized form against an empty-string key
    // (`$expose({ '': fn })` + `$emit('')` is parseable, pathological input —
    // D-08 says collect a diagnostic, never throw).
    const suggestions =
      name.length > 0
        ? `'${name}Picker' / 'do${name[0]!.toUpperCase()}${name.slice(1)}'`
        : 'a non-empty, non-colliding name';

    diagnostics.push({
      code: RozieErrorCode.EXPOSE_EVENT_NAME_COLLISION,
      severity: 'error',
      message: `$expose({ ${name} }) collides with ${surface} — ${classNote}. Rename the method (e.g. '${name}Picker'); ${collidesEvent ? 'events' : 'props'} keep their public names for consumers.`,
      loc: locFromNode(prop),
      hint: `Rename the exposed method so it does not match ${surface} (e.g. ${suggestions}).`,
    });
  }
}
