// Phase 06.2 P3 Task 2 — TreeNode.rozie browser-mount integration test (Angular).
//
// Verifies COMP-05 success criterion 5 for the Angular target.
//
// Angular browser-mount in pure Vitest+happy-dom is the trickiest of the four
// targets — the standalone-component runtime requires zone.js + JIT compiler
// + TestBed bootstrap, and the analogjs disk-cache hazard surface (Pitfall 6)
// makes the in-memory mount path brittle. Per the plan's allowance:
//
//   "Angular browser-mount in Vitest+happy-dom is the trickiest. Approaches in
//    order of simplicity:
//      1. Preferred: Angular's TestBed.createComponent...
//      2. Fallback: structural assertion that forwardRef(() => TreeNode) appears
//         in imports[] AND the template includes the recursive selector.
//        Document the fallback in the task SUMMARY with rationale."
//
// We adopt the structural fallback — the canonical Angular self-reference idiom
// (forwardRef inside the @Component({ imports: [...] }) decorator) is fully
// verifiable from the emitted source. Phase 7's Playwright cross-target VR is
// the canonical browser-mount signal for the Angular consumer (analogjs demo).
//
// CRITICAL load-bearing assertions:
//   1. `forwardRef(() => TreeNode)` appears in `imports: [...]` — the Pitfall 5
//      forward-reference idiom that lets a class register itself in its own
//      decorator BEFORE the class declaration completes.
//   2. `forwardRef` appears in the @angular/core import line.
//   3. The recursive template tag is rewritten to selector form
//      `<rozie-tree-node>` (kebab-case; Angular standalone components match
//      by selector — verbatim PascalCase tags would NOT match the registered
//      `selector: 'rozie-tree-node'` field at runtime).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TREE_NODE_ROZIE = resolve(__dirname, '../../../../examples/TreeNode.rozie');

interface TreeNodeData {
  id: string;
  label: string;
  children?: TreeNodeData[];
}

const FIXTURE_3_LEVEL: TreeNodeData = {
  id: 'root',
  label: 'Root',
  children: [
    {
      id: 'a',
      label: 'Child A',
      children: [{ id: 'a1', label: 'Leaf A1', children: [] }],
    },
  ],
};

describe('TreeNode browser-mount (Angular) — Phase 06.2 P3 COMP-05', () => {
  it('emitted .angular.ts carries the canonical self-reference idiom (Pitfall 5 forwardRef)', async () => {
    const { parse } = await import('../../../core/src/parse.js');
    const { lowerToIR } = await import('../../../core/src/ir/lower.js');
    const { createDefaultRegistry } = await import(
      '../../../core/src/modifiers/registerBuiltins.js'
    );
    const { emitAngular } = await import('../src/emitAngular.js');

    const src = readFileSync(TREE_NODE_ROZIE, 'utf8');
    const parsed = parse(src, { filename: 'TreeNode.rozie' });
    if (!parsed.ast) throw new Error('parse failed');
    const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
    if (!lowered.ir) throw new Error('lowerToIR failed');
    const result = emitAngular(lowered.ir, { filename: 'TreeNode.rozie', source: src });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    // Pitfall 5: `forwardRef(() => Self)` inside @Component({ imports: [...] }).
    expect(result.code).toMatch(/forwardRef\(\(\)\s*=>\s*TreeNode\)/);
    // `forwardRef` must be imported from @angular/core.
    expect(result.code).toMatch(/import\s*\{[^}]*\bforwardRef\b[^}]*\}\s*from\s*['"]@angular\/core['"]/);
    // Selector-form recursive tag (kebab-case; PascalCase wouldn't match
    // Angular's registered selector at runtime).
    expect(result.code).toMatch(/<rozie-tree-node\b/);
    // The standalone component's selector field declares the same kebab form.
    expect(result.code).toMatch(/selector:\s*['"]rozie-tree-node['"]/);
  });

  // Document the structural-fallback rationale + the 3-level fixture data
  // pinned for Phase 7's Playwright VR (analogjs consumer demo).
  it.todo(
    'mounts in TestBed and renders 3-level recursive tree (deferred — see fallback in describe header; Phase 7 Playwright VR is the canonical browser-mount signal)',
  );

  // Structural verification: the 3-level fixture data is well-formed enough
  // to drive Phase 7's Playwright VR per CONTEXT.md <specifics>.
  it('fixture data shape matches CONTEXT.md <specifics> (Root → Child A → Leaf A1)', () => {
    const root = FIXTURE_3_LEVEL;
    expect(root.label).toBe('Root');
    expect(root.children).toHaveLength(1);
    const childA = root.children![0]!;
    expect(childA.label).toBe('Child A');
    expect(childA.children).toHaveLength(1);
    const leafA1 = childA.children![0]!;
    expect(leafA1.label).toBe('Leaf A1');
  });
});
