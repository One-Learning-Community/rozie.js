// Emitter-hardening backlog item #5 — trailing `$expose` verb params lowered
// optional.
//
// Real-world shape (packages/ui/captcha/src/RecaptchaV3.rozie /
// packages/ui/embla/src/Carousel.rozie, pre-fix): a `$expose`'d verb's last
// param is a genuinely-optional refinement, but nothing in the untyped
// `<script>` marks it `?` — so `typeNeutralizeScript` stamped it REQUIRED
// (`: any`). Internally calling that SAME verb with fewer args than declared
// (the verb's own public contract permits it) then fails `TS2554` on every
// target's body-typecheck.
//
// These tests exercise the REAL pipeline (`lowerToIR`, which runs
// `typeNeutralizeScript(ir.setupBody.scriptProgram, ir)`), not the pass in
// isolation — item 5 only activates when `ir.expose` + the verb's internal
// call sites are both visible, which only the full lowering pipeline has.
import { describe, it, expect } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../../ir/lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { synthesizeHandleType } from '../synthesizeHandleType.js';
import type { IRComponent } from '../../ir/types.js';

function lower(source: string, filename = 'Probe.rozie'): IRComponent {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR returned null ir');
  return ir;
}

/** Find a top-level `function <name>(...)` declaration's params. */
function findVerbParams(
  ir: IRComponent,
  name: string,
): Array<{ optional?: boolean }> {
  const body = ir.setupBody.scriptProgram.program.body;
  const fn = body.find(
    (s) => s.type === 'FunctionDeclaration' && s.id?.name === name,
  );
  if (!fn || fn.type !== 'FunctionDeclaration') {
    throw new Error(`verb ${name} not found`);
  }
  return fn.params as unknown as Array<{ optional?: boolean }>;
}

describe('typeNeutralizeScript — item 5 (trailing $expose verb params lowered optional)', () => {
  it('an internal fewer-arg call marks the TRAILING untyped param optional', () => {
    // Mirrors RecaptchaV3.rozie's real (pre-fix) shape exactly: `execute`
    // takes one param, is `$expose`'d, and is called with ZERO args from an
    // internal `$onMount` site.
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script>
function execute(action) {
  $data.value = action != null ? action : 'default'
}
$onMount(() => { execute() })
$expose({ execute })
</script>
<template><div>{{ $data.value }}</div></template>
</rozie>`;
    const params = findVerbParams(lower(src), 'execute');
    expect(params[0]?.optional).toBe(true);
  });

  it('a verb called at FULL ARITY everywhere is UNCHANGED (byte-identical, not marked optional)', () => {
    // The must_haves truth: a verb whose trailing param IS always supplied
    // internally stays required — no spurious optionalization.
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script>
function zoomTo(k) {
  $data.value = String(k)
}
function bump() { zoomTo(2) }
$expose({ zoomTo })
</script>
<template><div>{{ $data.value }}</div></template>
</rozie>`;
    const params = findVerbParams(lower(src), 'zoomTo');
    expect(params[0]?.optional).toBeFalsy();
  });

  it('a verb NEVER called internally (consumer-only) is UNCHANGED (no internal-call evidence)', () => {
    // Mirrors rete's FlowCanvas.rozie `autoArrange`/`selectNode` shape — an
    // exposed verb with NO internal call site at all. No evidence, no mark.
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script>
function autoArrange(opts) {
  $data.value = opts ? 'has-opts' : 'no-opts'
}
$expose({ autoArrange })
</script>
<template><div>{{ $data.value }}</div></template>
</rozie>`;
    const params = findVerbParams(lower(src), 'autoArrange');
    expect(params[0]?.optional).toBeFalsy();
  });

  it('a LEADING required param before a fewer-arg call stays required — only the TRAILING one lowers', () => {
    // Mirrors embla's `scrollToIndex(index, jump)` called internally as
    // `scrollToIndex(i)` (1 arg) — `index` (position 0) must stay required;
    // only `jump` (position 1, the trailing one) becomes optional.
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script>
function scrollToIndex(index, jump) {
  $data.value = String(index) + (jump ? ':jump' : '')
}
function navTo(i) { scrollToIndex(i) }
$expose({ scrollToIndex })
</script>
<template><div>{{ $data.value }}</div></template>
</rozie>`;
    const params = findVerbParams(lower(src), 'scrollToIndex');
    expect(params[0]?.optional).toBeFalsy();
    expect(params[1]?.optional).toBe(true);
  });

  it('a fewer-arg call from a TEMPLATE `@event` binding (not the `<script>` body) also marks the param optional', () => {
    // The embla Carousel.rozie real-world shape: the built-in nav button is
    // `@click="scrollNext()"` — that call site lives in `ir.listeners`
    // (template `@event` bindings lower to the SAME `Listener.handler` shape
    // as a `<listeners>` entry, D-20), NOT in `ir.setupBody.scriptProgram`.
    // Item 5 must see it there too, or embla's real fix would not have
    // worked.
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script>
function scrollNext(jump) {
  $data.value = jump ? 'jump' : 'plain'
}
$expose({ scrollNext })
</script>
<template><button @click="scrollNext()">Next</button></template>
</rozie>`;
    const params = findVerbParams(lower(src), 'scrollNext');
    expect(params[0]?.optional).toBe(true);
  });

  it('an author-typed param (lang="ts") is NEVER overridden, even inside the optional range', () => {
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script lang="ts">
function execute(action: string) {
  $data.value = action
}
$onMount(() => { execute('x') })
$expose({ execute })
</script>
<template><div>{{ $data.value }}</div></template>
</rozie>`;
    const params = findVerbParams(lower(src), 'execute');
    // Called at full arity (1 arg for 1 param) — untouched either way, and
    // the author's own explicit type is never clobbered by this pass.
    expect(params[0]?.optional).toBeFalsy();
  });

  it('CR-02 (73-REVIEW.md): a same-named PARAMETER shadowing the exposed verb in an unrelated helper is NOT counted as internal-call evidence', () => {
    // The ONLY zero-arg call in the file is `unrelatedHelper`'s own shadowed
    // parameter being invoked — `execute` here is a function PARAMETER of a
    // totally different, unrelated function, not the top-level exposed
    // verb. Before the CR-02 fix, `minScriptCallArity` matched by bare
    // callee NAME only (no scope/binding resolution), so this shadowed call
    // polluted the "minimum observed arity" and silently marked the
    // genuinely-required `action` param optional.
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script>
function execute(action) {
  $data.value = action.toUpperCase()
}
function unrelatedHelper(execute) {
  execute()
}
$expose({ execute })
</script>
<template><div>{{ $data.value }}</div></template>
</rozie>`;
    const params = findVerbParams(lower(src), 'execute');
    expect(params[0]?.optional).toBeFalsy();
  });

  it('CR-02 (73-REVIEW.md): a same-named PARAMETER shadowing the exposed verb inside a template `@event` listener expression is NOT counted as evidence either', () => {
    // Mirrors the script-level shadow above, but the shadowing happens
    // inside an IIFE embedded in a template `@event` binding — exercising
    // `minExpressionCallArity`'s scope-free shadow tracking (listener
    // expressions are bare Expressions, never part of a real Program, so
    // there is no `@babel/traverse` scope/binding API available there).
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script>
function scrollNext(jump) {
  $data.value = jump ? 'jump' : 'plain'
}
$expose({ scrollNext })
</script>
<template><button @click="(function(scrollNext) { scrollNext(); })(() => {})">Next</button></template>
</rozie>`;
    const params = findVerbParams(lower(src), 'scrollNext');
    expect(params[0]?.optional).toBeFalsy();
  });

  it('synthesizeHandleType renders the SAME trailing param as `?:` in the Handle interface (typed script)', () => {
    // The untyped-script case falls to the `(...args: any[]) => any` fallback
    // (already fully permissive — nothing to assert there). The interface
    // path only diverges from `(...args: any[]) => any` when the author
    // wrote an explicit return type — exercise THAT shape here, using an
    // AssignmentPattern default (semantically optional) to prove renderParam
    // strips the default and emits a valid `?:` interface member instead of
    // an illegal default-valued interface param.
    const src = `<rozie name="Probe">
<data>{ value: '' }</data>
<script lang="ts">
function execute(action: string = 'default'): string {
  $data.value = action
  return action
}
$expose({ execute })
</script>
<template><div>{{ $data.value }}</div></template>
</rozie>`;
    const ir = lower(src);
    const out = synthesizeHandleType(ir, 'ProbeHandle')!;
    expect(out).toContain('execute(action?: string): string;');
  });
});
