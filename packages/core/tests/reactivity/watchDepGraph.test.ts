// Quick plan 260515-u2b — ReactiveDepGraph entries for $watch.
//
// buildReactiveDepGraph registers `watch.{N}.getter` → SignalRef[] for each
// WatchEntry. The dep source is the GETTER body (not the callback body).
// React's useEffect dep array consumes this; Vue/Svelte/Solid/Angular/Lit
// auto-track inside their native effect primitives and ignore the array.
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/parse.js';
import { collectAllDeclarations } from '../../src/semantic/bindings.js';
import { buildReactiveDepGraph } from '../../src/reactivity/buildDepGraph.js';

function loweredDeps(src: string, nodeId: string) {
  const result = parse(src, { filename: 'WatchDeps.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const bindings = collectAllDeclarations(result.ast);
  const graph = buildReactiveDepGraph(result.ast, bindings);
  return { deps: [...graph.forNodeOrEmpty(nodeId)], bindings };
}

const SHELL_HEAD = `<rozie name="WatchDeps">
<props>
{
  open:   { type: Boolean, default: false },
  closeOnEscape: { type: Boolean, default: true },
}
</props>
<data>
{
  count: { default: 0 },
}
</data>
<script>`;
const SHELL_TAIL = `</script>
<template><div /></template>
</rozie>`;

describe('buildReactiveDepGraph — $watch getter deps (quick 260515-u2b)', () => {
  it('Test 1: single-prop getter `() => $props.open` registers exactly [props.open] under watch.0.getter', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open, () => { console.log('fired') })
${SHELL_TAIL}`;
    const { deps } = loweredDeps(src, 'watch.0.getter');
    const propsRefs = deps.filter((d) => d.scope === 'props');
    expect(propsRefs).toHaveLength(1);
    expect(propsRefs[0]!.scope === 'props' && propsRefs[0]!.path[0]).toBe('open');
  });

  it('Test 2: combined getter `() => $props.open && $data.count` registers BOTH props.open and data.count', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open && $data.count, () => {})
${SHELL_TAIL}`;
    const { deps } = loweredDeps(src, 'watch.0.getter');
    const scopes = new Set(deps.map((d) => `${d.scope}:${d.scope === 'closure' ? d.identifier : d.path[0]}`));
    expect(scopes.has('props:open')).toBe(true);
    expect(scopes.has('data:count')).toBe(true);
  });

  it('Test 3: callback body refs do NOT contaminate watch.{N}.getter deps', () => {
    // Getter reads only $props.open; callback body references $props.closeOnEscape.
    // The dep set under watch.0.getter must be [props.open] only — callback
    // body references stay out of the getter's reactive subscription.
    const src = `${SHELL_HEAD}
$watch(() => $props.open, () => { if ($props.closeOnEscape) console.log('cb') })
${SHELL_TAIL}`;
    const { deps } = loweredDeps(src, 'watch.0.getter');
    const propScopes = deps
      .filter((d) => d.scope === 'props')
      .map((d) => (d.scope === 'props' ? d.path[0] : ''));
    expect(propScopes).toContain('open');
    expect(propScopes).not.toContain('closeOnEscape');
  });

  it('Test 4: two $watch calls register independent watch.0.getter and watch.1.getter entries', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open, () => {})
$watch(() => $data.count, () => {})
${SHELL_TAIL}`;
    const w0 = loweredDeps(src, 'watch.0.getter');
    expect(w0.deps.filter((d) => d.scope === 'props' && d.path[0] === 'open')).toHaveLength(1);
    const w1 = loweredDeps(src, 'watch.1.getter');
    expect(w1.deps.filter((d) => d.scope === 'data' && d.path[0] === 'count')).toHaveLength(1);
  });
});
