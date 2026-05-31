#!/usr/bin/env node
/**
 * model-write-grep-gate.mjs — Phase 18 Req 7 migration gate.
 *
 *   pnpm --filter dist-parity exec node scripts/model-write-grep-gate.mjs
 *   (or)  node tests/dist-parity/scripts/model-write-grep-gate.mjs   (from repo root)
 *
 * Scans every `examples/**\/*.rozie` (incl. typed/ + consumers/ mirrors) and
 * reports each PRODUCER model-prop `$props.<x>` *WRITE* site, i.e. `$props.<x>`
 * appearing as:
 *   - the LHS of an assignment (`=`, `+=`, `-=`, `*=`, `/=`, `%=`, `**=`,
 *     `&&=`, `||=`, `??=`, `<<=`, etc.), or
 *   - the argument of an `++` / `--` UpdateExpression,
 * where `<x>` is a prop declared `model: true` in THAT file's `<props>` block.
 *
 * Reads (`$props.x` on a RHS / in a comparison `==`/`>=`/etc. / as a function
 * arg) are NOT flagged (owner decision D3 — model-prop reads stay `$props.x`).
 * Engine sigils ($reconcileAfterDomMutation / $restoreFocus / $classSelector /
 * r-external) and consumer-side `r-model:` directives are never touched: the
 * detector only ever matches a `$props.<member>` LHS of a write, so those are
 * structurally out of scope.
 *
 * Detection is AST-accurate, not regex-only (RESEARCH Pitfall 4 — the raw grep
 * over-counts reads/comparisons): the `<script>` block is walked as a Babel
 * program; template attribute values and `<listeners>` `when`/`handler`
 * expression strings are sub-parsed with @babel/core's parseSync.
 *
 * Exit code: 0 if ZERO write sites remain (post-migration Req 7 gate); non-zero
 * with a file:line worklist otherwise (pre-migration migration checklist).
 */
import { parse as rozieParse } from '@rozie/core';
import babel from '@babel/core';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');

/** Recursively collect every `*.rozie` under `dir`, skipping node_modules/dist/build dirs. */
function collectRozieFiles(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'build' || e.name === '.turbo') continue;
      collectRozieFiles(full, out);
    } else if (e.isFile() && e.name.endsWith('.rozie')) {
      out.push(full);
    }
  }
}

/** Collect the set of prop names declared `model: true` from a PropsAST. */
function modelPropSet(propsAst) {
  const set = new Set();
  const obj = propsAst?.expression;
  if (!obj || obj.type !== 'ObjectExpression') return set;
  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) continue;
    const name = prop.key?.name ?? prop.key?.value;
    if (!name) continue;
    const decl = prop.value;
    if (!decl || decl.type !== 'ObjectExpression') continue;
    const isModel = decl.properties.some(
      (p) =>
        p.type === 'ObjectProperty' &&
        !p.computed &&
        (p.key?.name ?? p.key?.value) === 'model' &&
        p.value?.type === 'BooleanLiteral' &&
        p.value.value === true,
    );
    if (isModel) set.add(name);
  }
  return set;
}

/** Is `node` a `$props.<member>` non-computed member expression? Returns the member name or null. */
function propsMemberName(node) {
  if (!node) return null;
  if (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') return null;
  if (node.computed) return null;
  const obj = node.object;
  if (!obj || obj.type !== 'Identifier' || obj.name !== '$props') return null;
  const prop = node.property;
  if (!prop || prop.type !== 'Identifier') return null;
  return prop.name;
}

/**
 * Walk a Babel node tree, invoking `onWrite(memberName, node)` for every
 * AssignmentExpression whose LHS is `$props.<member>` and every
 * UpdateExpression (`++`/`--`) whose argument is `$props.<member>`.
 */
function walkForWrites(node, onWrite) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) walkForWrites(n, onWrite);
    return;
  }
  if (node.type === 'AssignmentExpression') {
    const name = propsMemberName(node.left);
    if (name) onWrite(name, node.left ?? node);
  } else if (node.type === 'UpdateExpression') {
    const name = propsMemberName(node.argument);
    if (name) onWrite(name, node.argument ?? node);
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'range' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
    const v = node[key];
    if (v && typeof v === 'object') walkForWrites(v, onWrite);
  }
}

/** Parse an embedded expression string into a Babel AST (paren-wrapped to force expression context). */
function parseExpr(str) {
  try {
    const file = babel.parseSync(`(${str}\n)`, { configFile: false, babelrc: false });
    return file;
  } catch {
    return null; // unparseable fragment (e.g. a bare method name) — no writes possible
  }
}

/** Collect every embedded expression string from the template tree. */
function collectTemplateExprs(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) collectTemplateExprs(n, out);
    return;
  }
  // Element attributes: event/binding kinds carry an expression string in `.value`.
  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      if ((attr.kind === 'event' || attr.kind === 'binding') && typeof attr.value === 'string') {
        out.push(attr.value);
      }
    }
  }
  // Interpolation / mustache text nodes — reads only, but harmless to scan.
  if (typeof node.expression === 'string') out.push(node.expression);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'attributes') continue;
    const v = node[key];
    if (v && typeof v === 'object') collectTemplateExprs(v, out);
  }
}

/** Collect every `when` / `handler` expression string from the listeners tree. */
function collectListenerExprs(listenersAst, out) {
  if (!listenersAst?.entries) return;
  for (const entry of listenersAst.entries) {
    const obj = entry.value;
    if (!obj || obj.type !== 'ObjectExpression') continue;
    for (const prop of obj.properties) {
      if (prop.type !== 'ObjectProperty') continue;
      const key = prop.key?.name ?? prop.key?.value;
      const val = prop.value;
      // `when: "<expr string>"`, `handler: () => {...}` (handler is usually an
      // identifier or arrow — already a real AST node, walk it directly).
      if (key === 'when' && val?.type === 'StringLiteral') {
        out.push(val.value);
      } else if (val && (val.type === 'ArrowFunctionExpression' || val.type === 'FunctionExpression')) {
        // inline handler body is a real AST — collect as a pre-parsed node
        out.push(val);
      }
    }
  }
}

async function main() {
  const files = [];
  collectRozieFiles(resolve(ROOT, 'examples'), files);
  files.sort();

  const offenders = [];

  for (const file of files) {
    const rel = relative(ROOT, file);
    let source;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    let ast;
    try {
      ast = rozieParse(source, { filename: rel }).ast;
    } catch {
      // A file that fails to parse cannot be confidently scanned; surface it.
      offenders.push({ rel, name: '<parse-error>', kind: 'parse-error' });
      continue;
    }
    if (!ast) continue;

    const models = modelPropSet(ast.props);
    if (models.size === 0) continue; // no model props → no model-prop write possible

    const record = (name, kind, node) => {
      if (models.has(name)) offenders.push({ rel, name, kind, line: node?.loc?.start?.line ?? null });
    };

    // 1. <script> block — a real Babel program (loc lines are file-relative).
    if (ast.script?.program) {
      walkForWrites(ast.script.program, (name, node) => record(name, 'script', node));
    }

    // 2. <template> — event/binding attribute expression strings.
    const tmplExprs = [];
    if (ast.template) collectTemplateExprs(ast.template, tmplExprs);
    for (const expr of tmplExprs) {
      const parsed = parseExpr(expr);
      if (parsed) walkForWrites(parsed, (name) => record(name, 'template', null));
    }

    // 3. <listeners> — when (string) + inline handler (AST node).
    const listenerExprs = [];
    if (ast.listeners) collectListenerExprs(ast.listeners, listenerExprs);
    for (const item of listenerExprs) {
      if (typeof item === 'string') {
        const parsed = parseExpr(item);
        if (parsed) walkForWrites(parsed, (name) => record(name, 'listeners', null));
      } else {
        walkForWrites(item, (name, node) => record(name, 'listeners', node));
      }
    }
  }

  if (offenders.length === 0) {
    process.stdout.write('model-write-grep-gate: PASS — zero model-prop $props WRITE sites remain.\n');
    process.exit(0);
  }

  process.stdout.write(
    `model-write-grep-gate: ${offenders.length} model-prop $props WRITE site(s) remaining (migrate to $model.<x>):\n`,
  );
  for (const o of offenders) {
    const where = o.line != null ? `${o.rel}:${o.line}` : o.rel;
    process.stdout.write(`  ${where}  $props.${o.name}  [${o.kind}]\n`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
