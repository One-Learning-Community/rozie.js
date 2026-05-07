// Phase 06.2 P1 Task 3 — tagKind annotation + components-table threading tests.
// Verifies lowerTemplate stamps every TemplateElementIR with `tagKind` per the
// D-114 precedence: outer-name match first, then components-table match, then
// HTML/custom-element fallback.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import { stripCircular } from '../helpers/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../fixtures/ir');

function lowerSource(src: string, filename = 'fixture.rozie') {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(`parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  return lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
}

// Recursive collector for IR nodes by their `type` discriminator.
type IRNodeWithType<T extends string> = { type: T } & Record<string, unknown>;
function collectByType<T extends string>(
  root: unknown,
  typeTag: T,
): IRNodeWithType<T>[] {
  const out: IRNodeWithType<T>[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n['type'] === typeTag) out.push(n as IRNodeWithType<T>);
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };
  visit(root);
  return out;
}

describe('Phase 06.2 P1 Task 3 — tagKind annotation per D-114 precedence', () => {
  it('TreeNode self-reference: <TreeNode> inside <rozie name="TreeNode"> annotates tagKind: "self"', () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <span>{{ $props.label }}</span>
    <TreeNode :node="$props.children" />
  </li>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'TreeNode.rozie');
    expect(ir).not.toBeNull();
    const els = collectByType<'TemplateElement'>(ir!.template, 'TemplateElement');
    const treeNode = els.find((e) => e['tagName'] === 'TreeNode');
    expect(treeNode).toBeDefined();
    // outer-name match wins BEFORE components-table lookup (D-114).
    expect(treeNode!['tagKind']).toBe('self');
    expect(treeNode!['componentRef']).toBeUndefined();
    // Even though <components> redundantly declares TreeNode, the entry exists
    // in IRComponent.components (Task 4 emits ROZ924 only when never used).
    expect(ir!.components).toHaveLength(1);
    expect(ir!.components[0]!.localName).toBe('TreeNode');
  });

  it('Card composition: <CardHeader> matches components-table → tagKind: "component"', () => {
    const src = `<rozie name="Card">
<components>{ CardHeader: "./CardHeader.rozie" }</components>
<template>
  <div class="card">
    <CardHeader title="Hello" />
  </div>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'Card.rozie');
    expect(ir).not.toBeNull();
    const els = collectByType<'TemplateElement'>(ir!.template, 'TemplateElement');
    const cardHeader = els.find((e) => e['tagName'] === 'CardHeader');
    expect(cardHeader).toBeDefined();
    expect(cardHeader!['tagKind']).toBe('component');
    expect(cardHeader!['componentRef']).toBeDefined();
    const ref = cardHeader!['componentRef'] as Record<string, unknown>;
    expect(ref['localName']).toBe('CardHeader');
    expect(ref['importPath']).toBe('./CardHeader.rozie');
  });

  it('Leaf component without <components>: every element annotated tagKind: "html", components: []', () => {
    const src = `<rozie name="CardHeader">
<props>{ title: { type: String } }</props>
<template>
  <div class="card-header">{{ $props.title }}</div>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'CardHeader.rozie');
    expect(ir).not.toBeNull();
    const els = collectByType<'TemplateElement'>(ir!.template, 'TemplateElement');
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) {
      expect(el['tagKind']).toBe('html');
      expect(el['componentRef']).toBeUndefined();
    }
    expect(ir!.components).toEqual([]);
  });

  it('outer-name precedence: <Modal> outer + <components>{ Modal: "./Child.rozie" } → tagKind: "self"', () => {
    // Defensive test for D-114: the outer name MUST win even when components
    // table contains the same key (no shadowing in the wrong direction).
    const src = `<rozie name="Modal">
<components>{ Modal: "./ChildModal.rozie" }</components>
<template>
  <div role="dialog">
    <Modal />
  </div>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'Modal.rozie');
    expect(ir).not.toBeNull();
    const els = collectByType<'TemplateElement'>(ir!.template, 'TemplateElement');
    const modal = els.find((e) => e['tagName'] === 'Modal');
    expect(modal).toBeDefined();
    expect(modal!['tagKind']).toBe('self');
  });

  it('custom-element pass-through: <my-button> stays tagKind: "html" (kebab-case)', () => {
    const src = `<rozie name="Foo">
<template>
  <my-button label="X" />
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'Foo.rozie');
    const els = collectByType<'TemplateElement'>(ir!.template, 'TemplateElement');
    const myButton = els.find((e) => e['tagName'] === 'my-button');
    expect(myButton).toBeDefined();
    expect(myButton!['tagKind']).toBe('html');
  });

  it('Modal-with-Counter: <Counter> in body matches components-table', () => {
    const src = `<rozie name="Modal">
<components>{ Counter: "./Counter.rozie" }</components>
<template>
  <div role="dialog">
    <Counter />
  </div>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'Modal-with-Counter.rozie');
    const els = collectByType<'TemplateElement'>(ir!.template, 'TemplateElement');
    const counter = els.find((e) => e['tagName'] === 'Counter');
    expect(counter).toBeDefined();
    expect(counter!['tagKind']).toBe('component');
    const ref = counter!['componentRef'] as Record<string, unknown>;
    expect(ref['localName']).toBe('Counter');
    expect(ref['importPath']).toBe('./Counter.rozie');
  });
});

describe('Phase 06.2 P1 Task 3 — IR snapshot fixtures', () => {
  it('TreeNode.ir.snap — self-reference IR', async () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<props>{ label: { type: String }, children: { type: Array, default: () => [] } }</props>
<template>
  <li>
    <span>{{ $props.label }}</span>
    <TreeNode :node="$props.children" />
  </li>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'TreeNode.rozie');
    const serialized = JSON.stringify(stripCircular(ir), null, 2);
    await expect(serialized).toMatchFileSnapshot(resolve(FIXTURES_DIR, 'TreeNode.ir.snap'));
  });

  it('Card.ir.snap — wrapper composition IR', async () => {
    const src = `<rozie name="Card">
<components>{ CardHeader: "./CardHeader.rozie" }</components>
<template>
  <div class="card">
    <CardHeader title="Hello" />
  </div>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'Card.rozie');
    const serialized = JSON.stringify(stripCircular(ir), null, 2);
    await expect(serialized).toMatchFileSnapshot(resolve(FIXTURES_DIR, 'Card.ir.snap'));
  });

  it('CardHeader.ir.snap — leaf IR (components: [])', async () => {
    const src = `<rozie name="CardHeader">
<props>{ title: { type: String } }</props>
<template>
  <div class="card-header">{{ $props.title }}</div>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'CardHeader.rozie');
    const serialized = JSON.stringify(stripCircular(ir), null, 2);
    await expect(serialized).toMatchFileSnapshot(resolve(FIXTURES_DIR, 'CardHeader.ir.snap'));
  });

  it('Modal-with-Counter.ir.snap — Modal containing <Counter> IR', async () => {
    const src = `<rozie name="Modal">
<components>{ Counter: "./Counter.rozie" }</components>
<template>
  <div role="dialog">
    <Counter />
  </div>
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'Modal-with-Counter.rozie');
    const serialized = JSON.stringify(stripCircular(ir), null, 2);
    await expect(serialized).toMatchFileSnapshot(resolve(FIXTURES_DIR, 'Modal-with-Counter.ir.snap'));
  });

  it('unknown-component-error.ir.snap — placeholder for Task 4 ROZ920', async () => {
    // Task 3 records the IR shape; Task 4 upgrades the assertion to also
    // include diagnostics: [{ code: ROZ920, hint: "Did you mean ..." }].
    const src = `<rozie name="Foo">
<template>
  <UnknownTag />
</template>
</rozie>`;
    const { ir } = lowerSource(src, 'unknown-component-error.rozie');
    const serialized = JSON.stringify(stripCircular(ir), null, 2);
    await expect(serialized).toMatchFileSnapshot(
      resolve(FIXTURES_DIR, 'unknown-component-error.ir.snap'),
    );
  });
});
