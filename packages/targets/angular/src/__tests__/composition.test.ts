// Phase 06.2 P2 — Angular composition + recursion emit-side tests.
//
// Drives 4 new whole-module snapshots:
//   - TreeNode (self-reference) — `forwardRef` in @angular/core import line +
//     `imports: [forwardRef(() => TreeNode)]` in @Component decorator
//   - Card (wrapper composition) — `import { CardHeader } from './CardHeader';`
//     (NAMED import — Angular standalone components export class by name) +
//     `imports: [CardHeader]` in @Component decorator
//   - CardHeader (leaf, no <components>) — no new imports
//   - Modal-with-Counter (wrapper) — `import { Counter } from './Counter';` +
//     `imports: [Counter]` in @Component decorator
//
// Per RESEARCH Pitfall 5: forwardRef MUST be in @angular/core import line
// (extending AngularImportCollector union). Per Pitfall 6: composing imports
// look identical to handwritten cross-file Angular imports — analogjs
// disk-cache contract carries forward unchanged.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitAngular } from '../emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../fixtures/composition');

function compileAngular(src: string, filename: string): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

describe('emitAngular — Phase 06.2 P2 composition + recursion', () => {
  it('TreeNode.angular.ts.snap: self-ref via forwardRef + extended @angular/core import', async () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <span>{{ $props.label }}</span>
    <TreeNode :node="$props.children" />
  </li>
</template>
</rozie>`;
    const code = compileAngular(src, 'TreeNode.rozie');
    // Pitfall 5 — forwardRef MUST be in @angular/core import line.
    expect(code).toMatch(/import \{[^}]*\bforwardRef\b[^}]*\} from '@angular\/core';/);
    // forwardRef wraps the self-class in @Component imports[].
    expect(code).toMatch(/forwardRef\(\(\) => TreeNode\)/);
    expect(code).toMatch(/imports: \[[^\]]*forwardRef\(\(\) => TreeNode\)[^\]]*\]/);
    // Self-reference does NOT emit a top-of-file `import { TreeNode } from ...` —
    // the class is in scope of its own decorator.
    expect(code).not.toMatch(/import \{ TreeNode \} from '\.\/TreeNode'/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'TreeNode.angular.ts.snap'));
  });

  it('Card.angular.ts.snap: wrapper composition emits NAMED import + imports[CardHeader]', async () => {
    const src = `<rozie name="Card">
<components>{ CardHeader: "./CardHeader.rozie" }</components>
<template>
  <div class="card">
    <CardHeader title="Hello" />
  </div>
</template>
</rozie>`;
    const code = compileAngular(src, 'Card.rozie');
    // Named import — Angular standalone components export class by name.
    expect(code).toMatch(/import \{ CardHeader \} from '\.\/CardHeader';/);
    // Class added to @Component imports[].
    expect(code).toMatch(/imports: \[[^\]]*CardHeader[^\]]*\]/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Card.angular.ts.snap'));
  });

  it('CardHeader.angular.ts.snap: leaf component — no new component imports', async () => {
    const src = `<rozie name="CardHeader">
<props>{ title: { type: String } }</props>
<template>
  <div class="card-header">{{ $props.title }}</div>
</template>
</rozie>`;
    const code = compileAngular(src, 'CardHeader.rozie');
    // No PascalCase user-component imports introduced.
    expect(code).not.toMatch(/import \{ [A-Z]\w+ \} from '\.\/[A-Z]\w+'/);
    expect(code).not.toMatch(/forwardRef/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'CardHeader.angular.ts.snap'));
  });

  it('Modal-with-Counter.angular.ts.snap: wrapper composition emits NAMED import + imports[Counter]', async () => {
    const src = `<rozie name="Modal">
<components>{ Counter: "./Counter.rozie" }</components>
<template>
  <div class="modal">
    <Counter />
  </div>
</template>
</rozie>`;
    const code = compileAngular(src, 'Modal-with-Counter.rozie');
    expect(code).toMatch(/import \{ Counter \} from '\.\/Counter';/);
    expect(code).toMatch(/imports: \[[^\]]*Counter[^\]]*\]/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Modal-with-Counter.angular.ts.snap'));
  });

  // Phase 06.2 follow-up: Angular rejects `[on-*]` and other `on-` prefixed
  // bindings with NG0306 for security. When the source uses Vue-style kebab-
  // case attribute names (`:on-close="$props.onClose"`) targeting a child
  // component, the Angular emitter MUST camelCase the binding name so it
  // maps to the component's camelCase property and avoids the NG0306 trap.
  // HTML elements keep kebab-case (e.g., `[aria-label]`, `[data-foo]`).
  it('camelCases kebab-case prop bindings on component tags (NG0306 fix)', () => {
    const src = `<rozie name="Card">
<components>{ CardHeader: "./CardHeader.rozie" }</components>
<props>{ title: { type: String, default: '' }, onClose: { type: Function, default: null } }</props>
<template>
  <article class="card" data-variant="default" aria-label="card">
    <CardHeader :title="$props.title" :on-close="$props.onClose" />
  </article>
</template>
</rozie>`;
    const code = compileAngular(src, 'Card.rozie');
    // Component binding camelCased.
    expect(code).toContain('[onClose]="onClose()"');
    expect(code).not.toContain('[on-close]=');
    // HTML attributes (data-*, aria-*) on the host <article> stay kebab-case.
    expect(code).toContain('data-variant="default"');
    expect(code).toContain('aria-label="card"');
  });
});

// Keyed-remount codegen, Task 6 (Angular — HARDEST) — a `:key` on a composed
// component now lowers to `TemplateElementIR.remountKeyExpression` (Task 1,
// DONE). Angular USED TO forward it as an inert `[key]` property input (dead —
// the child declares no `key` input, so it never remounted; see
// data-table-super-crosstarget-findings.md §3.1). Fix: emit a single-element
// keyed `@for (__rozieRemountKey of [<expr>]; track __rozieRemountKey) { … }`
// so a key change tears down and rebuilds the embedded view (the remount), and
// STOP forwarding the inert `[key]` input.
describe('emitAngular — component :key structural-recreates via keyed @for (keyed-remount codegen Task 6)', () => {
  it('component :key wraps the invocation in a single-element keyed @for and drops the inert [key] input', () => {
    const src = `<rozie name="KeyedHost">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ v: 0 }</data>
<template>
  <div>
    <MyComp :key="String($data.v)" />
  </div>
</template>
</rozie>`;
    const code = compileAngular(src, 'KeyedHost.rozie');
    // THE fix — a real single-element keyed @for around the component tag.
    expect(code).toMatch(
      /@for \(__rozieRemountKey of \[String\(v\(\)\)\]; track __rozieRemountKey\) \{\s*<rozie-my-comp><\/rozie-my-comp>\s*\}/,
    );
    // The inert `[key]` input is NO LONGER forwarded onto the component tag.
    expect(code).not.toMatch(/\[key\]=/);
  });

  it('control: component WITHOUT :key emits no @for wrap and no [key] input', () => {
    const src = `<rozie name="KeyedHostNoKey">
<components>{ MyComp: "./MyComp.rozie" }</components>
<template>
  <div>
    <MyComp />
  </div>
</template>
</rozie>`;
    const code = compileAngular(src, 'KeyedHostNoKey.rozie');
    expect(code).not.toMatch(/@for/);
    expect(code).not.toMatch(/__rozieRemountKey/);
    expect(code).not.toMatch(/\[key\]=/);
  });

  it('control: r-for loop key on a component still emits @for with track <keyExpr> (unaffected by remountKeyExpression)', () => {
    const src = `<rozie name="KeyedHostLoop">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ xs: [] }</data>
<template>
  <div>
    <MyComp r-for="x in $data.xs" :key="x.id" />
  </div>
</template>
</rozie>`;
    const code = compileAngular(src, 'KeyedHostLoop.rozie');
    // The r-for loop still tracks by the user's :key expression, NOT by the
    // remount-key sentinel — this task must not touch the loop path.
    expect(code).toMatch(/@for \(x of xs\(\); track x\.id\)/);
    expect(code).not.toMatch(/__rozieRemountKey/);
    expect(code).not.toMatch(/\[key\]=/);
  });

  // CRITICAL interaction (the reason this task is hard): a component carrying
  // BOTH `:key` AND `ref=` (the DataTableSuperDemo shape). Wrapping the tag in
  // `@for` moves the `#tbl` template-ref var into the block's embedded view.
  // Angular SIGNAL view queries (`viewChild()`) are dynamic and reactively
  // match template-ref vars inside `@if`/`@for` blocks, so the emitted
  // `tbl = viewChild<MyComp>('tbl')` query still resolves the child instance
  // at rest, and the imperative `$refs.tbl.verb()` call (which fires at
  // user-interaction time, after view-init) still works — Fix #3 is NOT
  // regressed. We assert BOTH the keyed @for AND the intact viewChild query.
  it('ref + :key interaction: keyed @for wraps the #tbl-bearing tag AND the viewChild query is intact', () => {
    const src = `<rozie name="KeyedRefHost">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ v: 0 }</data>
<refs>{ tbl: null }</refs>
<template>
  <div>
    <MyComp :key="String($data.v)" ref="tbl" />
  </div>
  <button @click="$refs.tbl.reload()">go</button>
</template>
</rozie>`;
    const code = compileAngular(src, 'KeyedRefHost.rozie');
    // Keyed @for wraps the tag; the `#tbl` template-ref var rides along on the
    // child tag INSIDE the block (moved with the component, as it must).
    expect(code).toMatch(
      /@for \(__rozieRemountKey of \[String\(v\(\)\)\]; track __rozieRemountKey\) \{\s*<rozie-my-comp #tbl><\/rozie-my-comp>\s*\}/,
    );
    // The signal viewChild query is UNCHANGED — it still targets 'tbl' and
    // resolves the component instance (dynamic queries cross @for blocks).
    expect(code).toContain("tbl = viewChild<MyComp>('tbl');");
    // The imperative handle call (Fix #3) is preserved.
    expect(code).toContain('tbl().reload()');
    // No inert [key] input alongside the ref.
    expect(code).not.toMatch(/\[key\]=/);
  });
});
