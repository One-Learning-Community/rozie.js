/**
 * expandExposeAliases — give every `$expose` verb a script binding of its own
 * name, so the six emitters (which bind a verb to the script binding it names)
 * see only shorthand keys.
 *
 * `$expose` accepts three forms besides shorthand `{ clear }`, and every
 * emitter used to drop them silently:
 *
 *   $expose({ open: openGated })        → const open = openGated;
 *   $expose({ peek: () => $data.n })     → const peek = () => $data.n;
 *   $expose({ bump() { $data.n++ } })    → const bump = () => { $data.n++ };
 *
 * The new declaration goes right before the `$expose` statement and the
 * property becomes shorthand `{ open }`. An object method becomes an arrow,
 * not a `function` expression: on the class targets (Angular, Lit) the body's
 * `$data` / `$props` reads lower to `this.…`, which an arrow keeps bound to
 * the instance.
 *
 * A verb whose name is already a top-level binding (`const open = …` next to
 * `{ open: openGated }`) is left alone: binding it would redeclare that name.
 * The `$expose` validator reports it (ROZ160). So is an alias of something
 * that is not a top-level function (`{ open: someValue }`): ROZ118, as before.
 *
 * Runs on the canonical (first top-level) `$expose` call only, and never on a
 * malformed one — the validator owns those. Mutates `program` in place, and
 * only when there is something to expand.
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';

/** Names bound at the top level of the script, and which of them are functions. */
function topLevelBindings(body: t.Statement[]): { all: Set<string>; fns: Set<string> } {
  const all = new Set<string>();
  const fns = new Set<string>();
  for (const stmt of body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      all.add(stmt.id.name);
      fns.add(stmt.id.name);
    } else if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        for (const name of Object.keys(t.getBindingIdentifiers(d.id))) all.add(name);
        if (t.isIdentifier(d.id) && (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))) {
          fns.add(d.id.name);
        }
      }
    } else if (t.isClassDeclaration(stmt) && stmt.id) {
      all.add(stmt.id.name);
    } else if (t.isImportDeclaration(stmt)) {
      for (const s of stmt.specifiers) all.add(s.local.name);
    }
  }
  return { all, fns };
}

function exposeCallOf(stmt: t.Statement): t.CallExpression | null {
  if (!t.isExpressionStatement(stmt)) return null;
  const expr = stmt.expression;
  if (!t.isCallExpression(expr)) return null;
  if (!t.isIdentifier(expr.callee) || expr.callee.name !== '$expose') return null;
  return expr;
}

function keyName(key: t.Node): string | null {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return null;
}

export function expandExposeAliases(program: File): void {
  const body = program.program.body;
  const index = body.findIndex((s) => exposeCallOf(s) !== null);
  if (index === -1) return;
  const arg = exposeCallOf(body[index]!)!.arguments[0];
  if (!arg || !t.isObjectExpression(arg)) return;
  if (arg.properties.some((p) => t.isSpreadElement(p) || p.computed)) return;

  const { all, fns } = topLevelBindings(body);
  const added: t.Statement[] = [];
  const properties = arg.properties.map((prop) => {
    if (t.isSpreadElement(prop)) return prop;
    const name = keyName(prop.key);
    if (name === null || !t.isValidIdentifier(name) || all.has(name)) return prop;

    let init: t.Expression | null = null;
    if (t.isObjectMethod(prop)) {
      if (prop.kind !== 'method' || prop.generator) return prop;
      init = t.arrowFunctionExpression(prop.params, prop.body, prop.async);
      if (prop.returnType) init.returnType = prop.returnType;
      if (prop.typeParameters) init.typeParameters = prop.typeParameters as t.TSTypeParameterDeclaration;
    } else if (t.isObjectProperty(prop)) {
      const value = prop.value;
      if (t.isArrowFunctionExpression(value) || t.isFunctionExpression(value)) init = value;
      else if (t.isIdentifier(value) && value.name !== name && fns.has(value.name)) init = value;
    }
    if (init === null) return prop;

    all.add(name);
    fns.add(name);
    const decl = t.variableDeclaration('const', [t.variableDeclarator(t.identifier(name), init)]);
    decl.loc = prop.loc ?? null;
    added.push(decl);
    const short = t.objectProperty(t.identifier(name), t.identifier(name), false, true);
    short.loc = prop.loc ?? null;
    short.start = prop.start ?? null;
    short.end = prop.end ?? null;
    return short;
  });
  if (added.length === 0) return;
  arg.properties = properties;
  body.splice(index, 0, ...added);
}
