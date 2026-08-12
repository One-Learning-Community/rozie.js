/**
 * threadProducerEmits.test.ts — quick task 260811-trz, Task 1 (D-01/D-02/D-03).
 *
 * RED-FIRST proof for `TemplateElementIR.producerEmits` — the new cross-file
 * fact `threadParamTypes` threads onto every resolved component/self tag so
 * per-target consumer-side event lowering (Task 2) can resolve a listener
 * against the callee's ACTUAL declared emit list instead of guessing from
 * the authored name's shape.
 *
 * Fixtures follow the two-file pattern from `tests/event-contract-conformance/`
 * — a parent whose `<components>` resolves a sibling child by relative path.
 * A bare `lowerToIR()` call does NOT run `threadParamTypes` — `compileAndThread`
 * below replicates exactly the wiring `compile()` uses for its parse →
 * lowerToIR → threadParamTypes steps (cache + resolver + target), so this
 * suite proves the REAL pass, not a hand-simulated one. `compile()` itself
 * does not return the mutated `IRComponent`, so this helper is necessary to
 * inspect `producerEmits` directly on the resulting template node.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { IRCache } from '../cache.js';
import { ProducerResolver } from '../../resolver/index.js';
import { threadParamTypes } from '../threadParamTypes.js';
import { parseManifest } from '../../manifest/readManifest.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { MANIFEST_SCHEMA_VERSION } from '../../manifest/schema.js';
import type { RozieTarget } from '../../codegen/rewriteRozieImport.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { IRComponent, TemplateElementIR, TemplateNode } from '../types.js';

/**
 * Replicates `compile()`'s steps 1 → 2.5 (parse → lowerToIR →
 * threadParamTypes) with a real `IRCache` + `ProducerResolver`, returning the
 * MUTATED consumer `IRComponent` for direct inspection — `compile()` itself
 * discards this object after emit.
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

/** DFS the lowered template for the first TemplateElement with `tagName`. */
function findElement(root: TemplateNode | null, tagName: string): TemplateElementIR | null {
  if (root === null) return null;
  if (root.type === 'TemplateElement') {
    if (root.tagName === tagName) return root;
    for (const child of root.children) {
      const found = findElement(child, tagName);
      if (found) return found;
    }
    if (root.slotFillers) {
      for (const filler of root.slotFillers) {
        for (const child of filler.body) {
          const found = findElement(child, tagName);
          if (found) return found;
        }
      }
    }
    return null;
  }
  if (root.type === 'TemplateConditional') {
    for (const branch of root.branches) {
      for (const child of branch.body) {
        const found = findElement(child, tagName);
        if (found) return found;
      }
    }
    return null;
  }
  if (root.type === 'TemplateLoop') {
    for (const child of root.body) {
      const found = findElement(child, tagName);
      if (found) return found;
    }
    return null;
  }
  if (root.type === 'TemplateFragment') {
    for (const child of root.children) {
      const found = findElement(child, tagName);
      if (found) return found;
    }
    return null;
  }
  return null;
}

describe('threadParamTypes — producerEmits (T1: local .rozie child, WITH slot fillers)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-emits-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('threads the child\'s RAW authored $emit names, in declaration order, onto the composed component-tag node', () => {
    writeFileSync(
      path.join(tmpRoot, 'Child.rozie'),
      `<rozie name="Child">
<template>
  <div>
    <slot name="default"></slot>
  </div>
</template>
<script>
function fire() {
  $emit('sort-change');
  $emit('ready');
}
</script>
</rozie>
`,
      'utf8',
    );
    const parentSrc = `<rozie name="Parent">
<components>{ Child: './Child.rozie' }</components>
<template>
  <Child>
    <template #default>x</template>
  </Child>
</template>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { ir } = compileAndThread(parentSrc, parentFile, tmpRoot);
    const node = findElement(ir.template, 'Child');
    expect(node).not.toBeNull();
    expect(node!.producerEmits).toEqual(['sort-change', 'ready']);
  });
});

describe('threadParamTypes — producerEmits (T2: NO slot fillers — the load-bearing case)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-emits-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('threads producerEmits on a component tag with NO slot fillers — the case the pre-change early-return skipped entirely', () => {
    writeFileSync(
      path.join(tmpRoot, 'Child.rozie'),
      `<rozie name="Child">
<template>
  <button type="button">go</button>
</template>
<script>
function fire() {
  $emit('sort-change');
}
</script>
</rozie>
`,
      'utf8',
    );
    const parentSrc = `<rozie name="Parent">
<components>{ Child: './Child.rozie' }</components>
<template>
  <Child @sort-change="onSort" />
</template>
<script>
function onSort() {}
</script>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { ir } = compileAndThread(parentSrc, parentFile, tmpRoot);
    const node = findElement(ir.template, 'Child');
    expect(node).not.toBeNull();
    expect(node!.slotFillers === undefined || node!.slotFillers.length === 0).toBe(true);
    expect(node!.producerEmits).toEqual(['sort-change']);
  });
});

describe('threadParamTypes — producerEmits (T3: self-recursion threads its OWN ir.emits)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-emits-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('a self-recursive tag (tagKind: self) threads the component\'s own declared $emit names', () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <TreeNode @sort-change="onSort" />
  </li>
</template>
<script>
function fire() {
  $emit('sort-change');
}
function onSort() {}
</script>
</rozie>
`;
    const file = path.join(tmpRoot, 'TreeNode.rozie');
    writeFileSync(file, src, 'utf8');
    const { ir } = compileAndThread(src, file, tmpRoot);
    const node = findElement(ir.template, 'TreeNode');
    expect(node).not.toBeNull();
    expect(node!.tagKind).toBe('self');
    expect(node!.producerEmits).toEqual(['sort-change']);
  });
});

describe('threadParamTypes — producerEmits (T4: PUBLISHED specifier threads emits from the manifest surface)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-emits-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function stagePackage(pkgName: string, manifestJson: unknown): void {
    const dir = path.join(tmpRoot, 'node_modules', ...pkgName.split('/'));
    mkdirSync(path.join(dir, 'dist'), { recursive: true });
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: pkgName,
        type: 'module',
        exports: {
          '.': {
            types: './dist/index.d.mts',
            import: './dist/index.mjs',
            require: './dist/index.cjs',
          },
        },
      }),
      'utf8',
    );
    writeFileSync(path.join(dir, 'dist/index.mjs'), 'export {};\n', 'utf8');
    writeFileSync(path.join(dir, 'rozie-manifest.json'), JSON.stringify(manifestJson), 'utf8');
  }

  it('parseManifest surfaces the validated "emits" array directly (surface.emits)', () => {
    const { surface, error } = parseManifest({
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      name: 'Widget',
      props: [],
      slots: [],
      emits: ['sort-change', 'ready'],
      expose: [],
    });
    expect(error).toBeNull();
    expect(surface?.emits).toEqual(['sort-change', 'ready']);
  });

  it('a PUBLISHED cross-package specifier threads producerEmits from the compiled rozie-manifest.json', () => {
    stagePackage('@acme/widget-react', {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      name: 'Widget',
      props: [],
      slots: [],
      emits: ['sort-change', 'ready'],
      expose: [],
    });
    const parentSrc = `<rozie name="Parent">
<components>{ Widget: '@acme/widget/Widget.rozie' }</components>
<template>
  <Widget @sort-change="onSort" />
</template>
<script>
function onSort() {}
</script>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { ir, diagnostics } = compileAndThread(parentSrc, parentFile, tmpRoot, 'react');
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
    const node = findElement(ir.template, 'Widget');
    expect(node).not.toBeNull();
    expect(node!.producerEmits).toEqual(['sort-change', 'ready']);
  });
});

describe('threadParamTypes — producerEmits (T5: a child declaring no emits leaves producerEmits ABSENT, not [])', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-emits-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('producerEmits is undefined (not an empty array) when the resolved producer declares zero emits', () => {
    writeFileSync(
      path.join(tmpRoot, 'Child.rozie'),
      `<rozie name="Child">
<template>
  <button type="button">go</button>
</template>
</rozie>
`,
      'utf8',
    );
    const parentSrc = `<rozie name="Parent">
<components>{ Child: './Child.rozie' }</components>
<template>
  <Child @click="onClick">
    <template #default>x</template>
  </Child>
</template>
<script>
function onClick() {}
</script>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { ir } = compileAndThread(parentSrc, parentFile, tmpRoot);
    const node = findElement(ir.template, 'Child');
    expect(node).not.toBeNull();
    expect(node!.producerEmits).toBeUndefined();
  });
});

describe('threadParamTypes — DIAGNOSTIC-SURFACE GUARD (T6/T7: the highest-risk regression this restructure can cause)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-emits-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('T6 — a component tag with NO slot fillers and an UNRESOLVABLE import produces the EXACT SAME diagnostic set as before this change (no new ROZ945)', () => {
    // './DoesNotExist.rozie' never resolves — no slot fillers on the tag.
    const parentSrc = `<rozie name="Parent">
<components>{ Ghost: './DoesNotExist.rozie' }</components>
<template>
  <Ghost @sort-change="onSort" />
</template>
<script>
function onSort() {}
</script>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { ir, diagnostics } = compileAndThread(parentSrc, parentFile, tmpRoot);
    const node = findElement(ir.template, 'Ghost');
    expect(node).not.toBeNull();
    expect(node!.slotFillers === undefined || node!.slotFillers.length === 0).toBe(true);
    // Assert EQUALITY of the full diagnostic array, not merely "length 0" —
    // per the task's own instruction: other unrelated diagnostics may be
    // present and must also be preserved untouched.
    expect(diagnostics).toEqual([]);
    expect(
      diagnostics.some((d) => d.code === RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED),
    ).toBe(false);
    // silent degrade: no producerEmits threaded either.
    expect(node!.producerEmits).toBeUndefined();
  });

  it('T7 — a component tag WITH slot fillers and an UNRESOLVABLE import still produces ROZ945 (no over-suppression)', () => {
    const parentSrc = `<rozie name="Parent">
<components>{ Ghost: './DoesNotExist.rozie' }</components>
<template>
  <Ghost>
    <template #default>x</template>
  </Ghost>
</template>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { diagnostics } = compileAndThread(parentSrc, parentFile, tmpRoot);
    const roz945 = diagnostics.filter(
      (d) => d.code === RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED,
    );
    expect(roz945.length).toBe(1);
  });
});
