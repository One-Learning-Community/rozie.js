/**
 * unmatchedComponentListener.test.ts — quick task 260812-i67, Task 2 (ROZ998).
 *
 * Pins every behavior case of the UNMATCHED_COMPONENT_LISTENER warning: a
 * listener authored on a composed component tag whose callee RESOLVED and
 * declares emits, matching no declared emit (neither exact nor canonical) and
 * being neither a native DOM event nor a Rozie-synthetic runtime event.
 *
 * Fixtures reuse the multi-file harness style from the sibling
 * `threadProducerEmits.test.ts` so producer resolution is exercised for REAL
 * (parse → lowerToIR → threadParamTypes with a live IRCache +
 * ProducerResolver) rather than by hand-stamping IR fields — the
 * unresolved-callee case in particular is only meaningful when resolution
 * genuinely fails.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { IRCache } from '../cache.js';
import { ProducerResolver } from '../../resolver/index.js';
import { threadParamTypes } from '../threadParamTypes.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { RozieTarget } from '../../codegen/rewriteRozieImport.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { IRComponent } from '../types.js';

/**
 * Replicates `compile()`'s parse → lowerToIR → threadParamTypes steps with a
 * real IRCache + ProducerResolver (same helper shape as
 * threadProducerEmits.test.ts).
 */
function compileAndThread(
  src: string,
  filename: string,
  resolverRoot: string,
  target: RozieTarget = 'react',
): { ir: IRComponent; diagnostics: Diagnostic[] } {
  const registry = createDefaultRegistry();
  const { ast, diagnostics: parseDiags } = parse(src, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags.map((d) => d.code).join(', ')}`,
    );
  }
  const cache = new IRCache({ modifierRegistry: registry });
  const resolver = new ProducerResolver({ root: resolverRoot });
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    resolver,
    filename,
  });
  if (!ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const acc: Diagnostic[] = [...parseDiags, ...irDiags];
  threadParamTypes(ir, filename, cache, resolver, target, acc);
  return { ir, diagnostics: acc };
}

function roz998(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(
    (d) => d.code === RozieErrorCode.UNMATCHED_COMPONENT_LISTENER,
  );
}

/** A child declaring exactly the given $emit names. */
function childSrc(...emits: string[]): string {
  const calls = emits.map((e) => `  $emit('${e}');`).join('\n');
  const script =
    emits.length > 0
      ? `<script>
function fire() {
${calls}
}
</script>
`
      : '';
  return `<rozie name="Child">
<template>
  <button type="button">go</button>
</template>
${script}</rozie>
`;
}

/** A parent resolving ./Child.rozie and binding the given listener. */
function parentSrc(listenerAttr: string): string {
  return `<rozie name="Parent">
<components>{ Child: './Child.rozie' }</components>
<template>
  <Child ${listenerAttr} />
</template>
<script>
function onSort() {}
</script>
</rozie>
`;
}

describe('threadParamTypes — ROZ998 UNMATCHED_COMPONENT_LISTENER', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-unmatched-listener-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function run(child: string, parent: string) {
    writeFileSync(path.join(tmpRoot, 'Child.rozie'), child, 'utf8');
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parent, 'utf8');
    return compileAndThread(parent, parentFile, tmpRoot);
  }

  it('near-miss misspelling of a declared emit: exactly one ROZ998 warning at the listener loc, with did-you-mean + declared list in the hint', () => {
    const { diagnostics } = run(
      childSrc('sortChange', 'rowSelect'),
      parentSrc('@sortChanged="onSort"'),
    );
    const hits = roz998(diagnostics);
    expect(hits.length).toBe(1);
    const hit = hits[0]!;
    expect(hit.severity).toBe('warning');
    expect(hit.message).toContain('@sortChanged');
    expect(hit.message).toContain('./Child.rozie');
    expect(hit.message).toContain('declares');
    expect(hit.hint).toContain("Did you mean 'sortChange'?");
    expect(hit.hint).toContain("'rowSelect'");
    expect(hit.hint).toContain("'sortChange'");
    // The loc is the listener's own sourceLoc — a real, non-zero span.
    expect(hit.loc.start).toBeGreaterThan(0);
    expect(hit.loc.end).toBeGreaterThan(hit.loc.start);
  });

  it('exact match of a declared emit: silent', () => {
    const { diagnostics } = run(
      childSrc('sortChange'),
      parentSrc('@sortChange="onSort"'),
    );
    expect(roz998(diagnostics)).toEqual([]);
  });

  it('kebab-declared emit bound via its camel equivalent: silent (canonical match)', () => {
    const { diagnostics } = run(
      childSrc('sort-change'),
      parentSrc('@sortChange="onSort"'),
    );
    expect(roz998(diagnostics)).toEqual([]);
  });

  it('camel-declared emit bound via its kebab equivalent: silent (canonical match)', () => {
    const { diagnostics } = run(
      childSrc('sortChange'),
      parentSrc('@sort-change="onSort"'),
    );
    expect(roz998(diagnostics)).toEqual([]);
  });

  it('native DOM event on the component tag: silent (allowlist)', () => {
    const { diagnostics } = run(
      childSrc('sortChange'),
      parentSrc('@click="onSort"'),
    );
    expect(roz998(diagnostics)).toEqual([]);
  });

  it('Rozie-synthetic keynav-family runtime event: silent (prefix skip)', () => {
    const { diagnostics } = run(
      childSrc('sortChange'),
      parentSrc('@keynav-commit="onSort"'),
    );
    expect(roz998(diagnostics)).toEqual([]);
  });

  it('UNRESOLVED callee + misspelled listener: silent — byte-identical diagnostic surface to before this change', () => {
    // './DoesNotExist.rozie' never resolves; the tag carries a listener that
    // would warn IF the callee had resolved. Case 1 of the unmatched-listener
    // todo stays deliberately silent (D-06) — assert FULL equality of the
    // diagnostic array, not merely the absence of ROZ998.
    const src = `<rozie name="Parent">
<components>{ Ghost: './DoesNotExist.rozie' }</components>
<template>
  <Ghost @sortChanged="onSort" />
</template>
<script>
function onSort() {}
</script>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, src, 'utf8');
    const { diagnostics } = compileAndThread(src, parentFile, tmpRoot);
    expect(diagnostics).toEqual([]);
  });

  it('RESOLVED callee that declares ZERO emits, any listener: silent (structurally unreachable)', () => {
    const { diagnostics } = run(
      childSrc(),
      parentSrc('@sortChanged="onSort"'),
    );
    expect(roz998(diagnostics)).toEqual([]);
  });

  it('component tag with no listeners at all: silent', () => {
    const { diagnostics } = run(childSrc('sortChange'), parentSrc(''));
    expect(roz998(diagnostics)).toEqual([]);
  });

  it('self-recursive tag: a misspelled listener against the component\'s OWN emits warns too', () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <TreeNode @sortChanged="onSort" />
  </li>
</template>
<script>
function fire() {
  $emit('sortChange');
}
function onSort() {}
</script>
</rozie>
`;
    const file = path.join(tmpRoot, 'TreeNode.rozie');
    writeFileSync(file, src, 'utf8');
    const { diagnostics } = compileAndThread(src, file, tmpRoot);
    const hits = roz998(diagnostics);
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain('<self recursion: TreeNode>');
  });
});
