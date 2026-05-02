// Phase 2 Plan 02-05 Task 2 — IR-04 / REACT-03 Babel File preservation.
//
// IRComponent.setupBody.scriptProgram must be the SAME Babel File node from
// the parsed AST (referential equality — no clone). Phase 3+ target emitters
// traverse + rewrite this Program without re-parsing. Risk 5 trust-erosion
// floor extends to the IR layer: console.log survives parse → IR.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as t from '@babel/types';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

describe('script preservation through IR — Plan 02-05 (IR-04)', () => {
  it('IRComponent.setupBody.scriptProgram === parse(source).ast.script.program (referential equality)', () => {
    const src = loadExample('Counter');
    const result = parse(src, { filename: 'Counter.rozie' });
    expect(result.ast).not.toBeNull();
    expect(result.ast!.script).not.toBeNull();
    const originalProgram = result.ast!.script!.program;

    const lowered = lowerToIR(result.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(lowered.ir).not.toBeNull();
    // Referential equality — IR-04 contract.
    expect(lowered.ir!.setupBody.scriptProgram).toBe(originalProgram);
  });

  it('console.log("hello from rozie") in <script> survives to setupBody.scriptProgram verbatim — Risk 5 floor', () => {
    const synthSrc = `<rozie name="WithConsole">
<script>
console.log("hello from rozie")
const greet = () => "hi"
</script>
<template><div>{{ greet() }}</div></template>
</rozie>`;
    const result = parse(synthSrc, { filename: 'WithConsole.rozie' });
    expect(result.ast).not.toBeNull();

    const lowered = lowerToIR(result.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(lowered.ir).not.toBeNull();

    const program = lowered.ir!.setupBody.scriptProgram;
    // Find the console.log ExpressionStatement in the Program body.
    const stmts = program.program.body;
    const consoleCall = stmts.find(
      (s): s is t.ExpressionStatement =>
        t.isExpressionStatement(s) &&
        t.isCallExpression(s.expression) &&
        t.isMemberExpression(s.expression.callee) &&
        t.isIdentifier(s.expression.callee.object) &&
        s.expression.callee.object.name === 'console' &&
        t.isIdentifier(s.expression.callee.property) &&
        s.expression.callee.property.name === 'log',
    );
    expect(consoleCall).toBeDefined();
    // Verify the literal argument value survives.
    const expr = consoleCall!.expression as t.CallExpression;
    const arg0 = expr.arguments[0];
    expect(arg0 && t.isStringLiteral(arg0)).toBe(true);
    if (arg0 && t.isStringLiteral(arg0)) {
      expect(arg0.value).toBe('hello from rozie');
    }
  });

  it('SetupAnnotation[] tags top-level $computed declarators as kind: "computed", lifecycle calls as "lifecycle"', () => {
    const src = loadExample('Modal');
    const result = parse(src, { filename: 'Modal.rozie' });
    expect(result.ast).not.toBeNull();

    const lowered = lowerToIR(result.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(lowered.ir).not.toBeNull();

    const annotations = lowered.ir!.setupBody.annotations;
    // Modal has lifecycle calls: $onMount(lockScroll), $onUnmount(unlockScroll), $onMount(arrow).
    // It has no $computed (Modal has 0 computeds — see canonical_fixtures table).
    // It DOES have helper-fn declarations (close, lockScroll, unlockScroll).
    const lifecycleAnnotations = annotations.filter((a) => a.kind === 'lifecycle');
    expect(lifecycleAnnotations.length).toBeGreaterThanOrEqual(3);

    // Counter has $computed — verify in a separate fixture.
    const counterResult = parse(loadExample('Counter'), { filename: 'Counter.rozie' });
    const counterLowered = lowerToIR(counterResult.ast!, {
      modifierRegistry: createDefaultRegistry(),
    });
    const counterAnnotations = counterLowered.ir!.setupBody.annotations;
    const computedAnnotations = counterAnnotations.filter((a) => a.kind === 'computed');
    // Counter has canIncrement and canDecrement — 2 computed declarators.
    expect(computedAnnotations.length).toBeGreaterThanOrEqual(2);
  });
});
