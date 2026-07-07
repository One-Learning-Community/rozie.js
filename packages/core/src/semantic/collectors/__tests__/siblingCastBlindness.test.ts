// ROZ-cast-blindness fix — sibling sigils to the ROZ132 $inject fix
// (a84c1714). `$computed` (declarator form), `$watch`/`$onMount`/`$onUnmount`/
// `$onUpdate` (statement form), and `$provide`/`$expose` (statement form)
// shared the identical `if (!t.isCallExpression(...)) return null;`
// cast-blind shape in collectScriptDecls.ts.
//
// Proves at the collector/binding level:
//   - a TS-cast-wrapped `$computed(...)` declarator IS collected into
//     `bindings.computeds` (previously: silently dropped — the raw
//     `$computed` identifier leaked into every target's emit).
//   - a TS-cast-wrapped `$watch(...)` / `$onMount(...)` / `$onUnmount(...)` /
//     `$onUpdate(...)` statement IS collected (previously: silently dropped).
//   - a TS-cast-wrapped `$provide(...)` statement is recognized as a
//     top-level STATEMENT (no false ROZ131 PROVIDE_NOT_STATEMENT).
//   - a TS-cast-wrapped `$expose(...)` statement is recognized as TOP-LEVEL
//     (no false ROZ120 EXPOSE_NOT_TOP_LEVEL).
// Bare (uncast) forms still collect/validate identically (regression guard).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function analyze(source: string, filename = 'SiblingCastProbe.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return analyzeAST(ast);
}

function byCode(diags: Diagnostic[], code: string) {
  return diags.filter((d) => d.code === code);
}

const wrapComputed = (script: string) => `<rozie name="SiblingCastProbe">
<script lang="ts">
${script}
</script>
<template><div>{{ label }}</div></template>
</rozie>`;

const wrapPlain = (script: string, template = '<div></div>') =>
  `<rozie name="SiblingCastProbe">
<script lang="ts">
${script}
</script>
<template>${template}</template>
</rozie>`;

describe('$computed collector — ROZ-cast-blindness fix', () => {
  it('bare `const label = $computed(...)` is collected', () => {
    const { bindings } = analyze(wrapComputed(`const label = $computed(() => 'x')`));
    expect(bindings.computeds.has('label')).toBe(true);
  });

  it('`const label = $computed(...) as string` IS collected (not silently dropped)', () => {
    const { bindings, diagnostics } = analyze(
      wrapComputed(`const label = $computed(() => 'x') as string`),
    );
    expect(bindings.computeds.has('label')).toBe(true);
    // No bare-sigil / unknown-ref diagnostic for the now-recognized $computed.
    expect(byCode(diagnostics, 'ROZ104').length).toBe(0);
  });

  it('`const label = $computed(...)!` (non-null) IS collected', () => {
    const { bindings } = analyze(
      wrapComputed(`const label = $computed(() => 'x')!`),
    );
    expect(bindings.computeds.has('label')).toBe(true);
  });

  it('`const label = $computed(...) satisfies T` IS collected', () => {
    const { bindings } = analyze(
      wrapComputed(`const label = $computed(() => 'x') satisfies string`),
    );
    expect(bindings.computeds.has('label')).toBe(true);
  });

  it('a plain (non-$computed) cast-wrapped const is NOT mis-collected as computed', () => {
    const { bindings } = analyze(
      wrapComputed(`const label = ('x') as string`),
    );
    expect(bindings.computeds.has('label')).toBe(false);
  });
});

describe('$watch / lifecycle collectors — ROZ-cast-blindness fix', () => {
  it('bare `$watch(...)` is collected', () => {
    const src = `<rozie name="SiblingCastProbe">
<data>
{
  n: 0,
}
</data>
<script lang="ts">
$watch(() => $data.n, () => {})
</script>
<template><div>{{ $data.n }}</div></template>
</rozie>`;
    const { bindings } = analyze(src);
    expect(bindings.watchers.length).toBe(1);
  });

  it('`$watch(...) as void` IS collected (not silently dropped)', () => {
    const src = `<rozie name="SiblingCastProbe">
<data>
{
  n: 0,
}
</data>
<script lang="ts">
$watch(() => $data.n, () => {}) as void
</script>
<template><div>{{ $data.n }}</div></template>
</rozie>`;
    const { bindings } = analyze(src);
    expect(bindings.watchers.length).toBe(1);
  });

  it('bare `$onMount(...)` is collected', () => {
    const { bindings } = analyze(
      wrapPlain(`$onMount(() => { console.log('mounted') })`),
    );
    expect(bindings.lifecycle.length).toBe(1);
    expect(bindings.lifecycle[0]!.phase).toBe('mount');
  });

  it('`$onMount(...) as void` IS collected (not silently dropped)', () => {
    const { bindings } = analyze(
      wrapPlain(`$onMount(() => { console.log('mounted') }) as void`),
    );
    expect(bindings.lifecycle.length).toBe(1);
    expect(bindings.lifecycle[0]!.phase).toBe('mount');
  });

  it('`$onUnmount(...) as void` IS collected', () => {
    const { bindings } = analyze(
      wrapPlain(`$onUnmount(() => { console.log('bye') }) as void`),
    );
    expect(bindings.lifecycle.length).toBe(1);
    expect(bindings.lifecycle[0]!.phase).toBe('unmount');
  });

  it('`$onUpdate(...) as void` IS collected', () => {
    const { bindings } = analyze(
      wrapPlain(`$onUpdate(() => { console.log('updated') }) as void`),
    );
    expect(bindings.lifecycle.length).toBe(1);
    expect(bindings.lifecycle[0]!.phase).toBe('update');
  });
});

describe('$provide statement-position — ROZ131 cast-blindness fix', () => {
  it('bare `$provide(...)` is a clean top-level statement (no ROZ131)', () => {
    const src = `<rozie name="SiblingCastProbe">
<data>
{
  color: 'red',
}
</data>
<script lang="ts">
$provide('theme', { color: $data.color })
</script>
<template><div><slot></slot></div></template>
</rozie>`;
    const { bindings, diagnostics } = analyze(src);
    expect(bindings.provides.length).toBe(1);
    expect(byCode(diagnostics, 'ROZ131').length).toBe(0);
  });

  it('`$provide(...) as void` does NOT raise false ROZ131', () => {
    const src = `<rozie name="SiblingCastProbe">
<data>
{
  color: 'red',
}
</data>
<script lang="ts">
$provide('theme', { color: $data.color }) as void
</script>
<template><div><slot></slot></div></template>
</rozie>`;
    const { bindings, diagnostics } = analyze(src);
    expect(bindings.provides.length).toBe(1);
    expect(byCode(diagnostics, 'ROZ131').length).toBe(0);
  });

  it('a genuinely expression-position `$provide(...)` STILL raises ROZ131', () => {
    const src = `<rozie name="SiblingCastProbe">
<script lang="ts">
const x = $provide('theme', 1)
</script>
<template><div></div></template>
</rozie>`;
    const { diagnostics } = analyze(src);
    expect(byCode(diagnostics, 'ROZ131').length).toBe(1);
  });
});

describe('$expose top-level-position — ROZ120 cast-blindness fix', () => {
  it('bare `$expose(...)` is clean top-level (no ROZ120)', () => {
    const src = `<rozie name="SiblingCastProbe">
<script lang="ts">
function reset(): void {}
$expose({ reset })
</script>
<template><div></div></template>
</rozie>`;
    const { bindings, diagnostics } = analyze(src);
    expect(bindings.expose.length).toBe(1);
    expect(byCode(diagnostics, 'ROZ120').length).toBe(0);
  });

  it('`($expose(...) as unknown)` does NOT raise false ROZ120', () => {
    const src = `<rozie name="SiblingCastProbe">
<script lang="ts">
function reset(): void {}
($expose({ reset }) as unknown)
</script>
<template><div></div></template>
</rozie>`;
    const { bindings, diagnostics } = analyze(src);
    expect(bindings.expose.length).toBe(1);
    expect(byCode(diagnostics, 'ROZ120').length).toBe(0);
  });

  it('a genuinely nested `$expose(...)` STILL raises ROZ120', () => {
    const src = `<rozie name="SiblingCastProbe">
<script lang="ts">
function reset(): void {}
function setup(): void {
  $expose({ reset })
}
setup()
</script>
<template><div></div></template>
</rozie>`;
    const { diagnostics } = analyze(src);
    expect(byCode(diagnostics, 'ROZ120').length).toBe(1);
  });
});
