/**
 * threadProducerProps.test.ts — quick task 260812-2ur, Task 1.
 *
 * RED-FIRST proof for `TemplateElementIR.producerProps` — the prop-side
 * sibling of 260811-trz's `producerEmits`. `threadParamTypes` threads the
 * callee's DECLARED prop names onto every resolved component/self tag so
 * per-target attribute emitters (Task 2: react/svelte/solid) can decide
 * whether a kebab-spelled consumer attribute (`:aria-label`) is a declared
 * prop (`ariaLabel` — convert) or a genuine passthrough attribute (preserve).
 *
 * Modelled 1:1 on `threadProducerEmits.test.ts` — same fixture-writing
 * helpers, same temp-dir/resolver setup, same component-tag-finding walker.
 * `compileAndThread` replicates exactly the wiring `compile()` uses for its
 * parse → lowerToIR → threadParamTypes steps (cache + resolver + target), so
 * this suite proves the REAL pass, not a hand-simulated one.
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

describe('threadParamTypes — producerProps (T1: local .rozie child, WITH slot fillers)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-props-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("threads the child's DECLARED prop names, in declaration order, onto the composed component-tag node", () => {
    writeFileSync(
      path.join(tmpRoot, 'Child.rozie'),
      `<rozie name="Child">
<props>
{
  ariaLabel: { type: String, default: '' },
  count: { type: Number, default: 0 },
}
</props>
<template>
  <div>
    <slot name="default"></slot>
  </div>
</template>
</rozie>
`,
      'utf8',
    );
    const parentSrc = `<rozie name="Parent">
<components>{ Child: './Child.rozie' }</components>
<template>
  <Child :aria-label="'x'">
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
    expect(node!.producerProps).toEqual(['ariaLabel', 'count']);
  });
});

describe('threadParamTypes — producerProps (T2: NO slot fillers — the load-bearing case)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-props-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('threads producerProps on a component tag with NO slot fillers — the case the pre-260811-trz early-return skipped entirely', () => {
    writeFileSync(
      path.join(tmpRoot, 'Child.rozie'),
      `<rozie name="Child">
<props>
{
  ariaLabel: { type: String, default: '' },
}
</props>
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
  <Child :aria-label="'Coverage Line Chart'" />
</template>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { ir } = compileAndThread(parentSrc, parentFile, tmpRoot);
    const node = findElement(ir.template, 'Child');
    expect(node).not.toBeNull();
    expect(node!.slotFillers === undefined || node!.slotFillers.length === 0).toBe(true);
    expect(node!.producerProps).toEqual(['ariaLabel']);
  });
});

describe('threadParamTypes — producerProps (T3: self-recursion threads its OWN ir.props)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-props-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("a self-recursive tag (tagKind: self) threads the component's own declared prop names", () => {
    const src = `<rozie name="TreeNode">
<props>
{
  ariaLabel: { type: String, default: '' },
  depth: { type: Number, default: 0 },
}
</props>
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <TreeNode :aria-label="'x'" />
  </li>
</template>
</rozie>
`;
    const file = path.join(tmpRoot, 'TreeNode.rozie');
    writeFileSync(file, src, 'utf8');
    const { ir } = compileAndThread(src, file, tmpRoot);
    const node = findElement(ir.template, 'TreeNode');
    expect(node).not.toBeNull();
    expect(node!.tagKind).toBe('self');
    expect(node!.producerProps).toEqual(['ariaLabel', 'depth']);
  });
});

describe('threadParamTypes — producerProps (T4: PUBLISHED specifier threads names from the manifest surface)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-props-'));
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

  it('a PUBLISHED cross-package specifier threads producerProps from the `props` array readManifest ALREADY parses — zero readManifest.ts changes', () => {
    stagePackage('@acme/widget-react', {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      name: 'Widget',
      props: [
        { name: 'ariaLabel', isModel: false },
        { name: 'count', isModel: false },
      ],
      slots: [],
      emits: [],
      expose: [],
    });
    const parentSrc = `<rozie name="Parent">
<components>{ Widget: '@acme/widget/Widget.rozie' }</components>
<template>
  <Widget :aria-label="'x'" />
</template>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { ir, diagnostics } = compileAndThread(parentSrc, parentFile, tmpRoot, 'react');
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
    const node = findElement(ir.template, 'Widget');
    expect(node).not.toBeNull();
    expect(node!.producerProps).toEqual(['ariaLabel', 'count']);
  });
});

describe('threadParamTypes — producerProps (T5: a child declaring no props leaves producerProps ABSENT, not [])', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-props-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('producerProps is undefined (not an empty array) when the resolved producer declares zero props', () => {
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
    expect(node!.producerProps).toBeUndefined();
  });
});

describe('threadParamTypes — producerProps DIAGNOSTIC-SURFACE GUARD (T6/T7: the trz gating invariant, prop-side witness)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-thread-producer-props-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('T6 — a component tag with NO slot fillers and an UNRESOLVABLE import degrades silently: producerProps undefined AND zero diagnostics pushed', () => {
    // './DoesNotExist.rozie' never resolves — no slot fillers on the tag.
    const parentSrc = `<rozie name="Parent">
<components>{ Ghost: './DoesNotExist.rozie' }</components>
<template>
  <Ghost :aria-label="'x'" />
</template>
</rozie>
`;
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, parentSrc, 'utf8');
    const { ir, diagnostics } = compileAndThread(parentSrc, parentFile, tmpRoot);
    const node = findElement(ir.template, 'Ghost');
    expect(node).not.toBeNull();
    expect(node!.slotFillers === undefined || node!.slotFillers.length === 0).toBe(true);
    // Assert EQUALITY of the full diagnostic array — the whole surface must
    // stay byte-identical, not merely "no ROZ945".
    expect(diagnostics).toEqual([]);
    expect(
      diagnostics.some((d) => d.code === RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED),
    ).toBe(false);
    // silent degrade: no producerProps threaded either.
    expect(node!.producerProps).toBeUndefined();
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
