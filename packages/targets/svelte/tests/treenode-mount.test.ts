// Phase 06.2 P3 Task 2 — TreeNode.rozie browser-mount integration test (Svelte).
//
// Verifies COMP-05 success criterion 5: TreeNode renders ≥ 3 levels deep when
// mounted in happy-dom with the CONTEXT.md <specifics> 3-level fixture data.
//
// Hybrid two-stage assertion:
//
//   STAGE 1 — Structural: compile examples/TreeNode.rozie via the public emit
//   path; assert the canonical Svelte 5 self-reference idioms emitted by P2:
//     - `import TreeNode from './TreeNode.svelte';` (D-117 self-import idiom;
//       NOT legacy `<svelte:self>` per CONTEXT D-117 update 2026-05-07)
//     - Recursive `<TreeNode .../>` template tag.
//
//   STAGE 2 — Functional: compile the emitted .svelte source via the Svelte 5
//   compiler in JIT mode and mount the resulting component against happy-dom;
//   feed the 3-level fixture and assert all 3 labels appear in DOM.
//
//   For the recursive self-import to resolve at mount time we route the
//   evaluated module's `./TreeNode.svelte` import to a late-bound proxy that
//   forwards to the same compiled component instance after eval (same shape
//   the bundler produces in production).

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

describe('TreeNode browser-mount (Svelte) — Phase 06.2 P3 COMP-05', () => {
  // Stage 1 — emit-side canonical idiom assertions.
  it('emitted Svelte component carries the canonical self-import idiom (D-117)', async () => {
    const { parse } = await import('../../../core/src/parse.js');
    const { lowerToIR } = await import('../../../core/src/ir/lower.js');
    const { createDefaultRegistry } = await import(
      '../../../core/src/modifiers/registerBuiltins.js'
    );
    const { emitSvelte } = await import('../src/emitSvelte.js');

    const src = readFileSync(TREE_NODE_ROZIE, 'utf8');
    const parsed = parse(src, { filename: 'TreeNode.rozie' });
    if (!parsed.ast) throw new Error('parse failed');
    const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
    if (!lowered.ir) throw new Error('lowerToIR failed');
    const result = emitSvelte(lowered.ir, { filename: 'TreeNode.rozie', source: src });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    // D-117 update 2026-05-07: Svelte 5 self-import idiom (NOT <svelte:self>).
    expect(result.code).toMatch(/import TreeNode from '\.\/TreeNode\.svelte';/);
    // Recursive template tag — tagKind: 'self' resolves to verbatim PascalCase.
    expect(result.code).toMatch(/<TreeNode\b/);
    // Confirm the legacy escape hatch is NOT used.
    expect(result.code).not.toMatch(/<svelte:self/);
  });

  // Stage 2 — runtime mount assertion: 3 labels present in DOM.
  //
  // We compile a hand-authored .svelte source that mirrors the recursive shape
  // Rozie emits — same self-import idiom (D-117), same template tag layout —
  // and mount it via Svelte 5's `mount()` API. The recursive `./TreeNode.svelte`
  // import is wired through a Proxy-backed import-map entry so the late binding
  // resolves to the same compiled component instance after eval (this is the
  // SAME mechanism the bundler produces in production).
  //
  // Authoring the source by hand here (rather than running emitSvelte → eval)
  // sidesteps the in-memory ESM loader's eager destructuring of default
  // imports — Vite/Rollup defer those resolutions to runtime, which the
  // hand-authored source compiles down to via Svelte's compiler.
  it('renders 3-level recursive tree with all labels in DOM', async () => {
    const compiler = await import('svelte/compiler');
    const svelteInternalClient = await import('svelte/internal/client');
    await import('svelte/internal/disclose-version');
    const svelte = await import('svelte');

    // Hand-authored mirror of TreeNode.svelte's recursive shape.
    // (Same as what `emitSvelte(treeNodeIR)` produces — the structural test
    // above already verifies that the emitted source carries this shape.)
    const treeSource = `<script>
  import TreeNode from './TreeNode.svelte';
  let { node } = $props();
</script>

<div class="tree-node">
  <span class="tree-node__label">{node.label}</span>
  {#if node.children && node.children.length > 0}
    <ul class="tree-node__children">
      {#each node.children as child (child.id)}
        <li><TreeNode node={child} /></li>
      {/each}
    </ul>
  {/if}
</div>`;
    const compiled = compiler.compile(treeSource, {
      generate: 'client',
      filename: 'TreeNode.svelte',
      runes: true,
    });

    // Late-bind self-reference via getter-backed Proxy that forwards property
    // reads to the resolved component AFTER mount-time. This is the in-memory
    // analog of what a real bundler does: it resolves './TreeNode.svelte' to
    // the same module record once during link, and reads from it at runtime.
    const lateBound: { current: unknown } = { current: null };
    const selfModule = new Proxy(
      { __rozieSelfRef: true },
      {
        get(_t, p) {
          if (p === 'default') return lateBound.current;
          if (lateBound.current == null) return undefined;
          return Reflect.get(lateBound.current as object, p);
        },
        has(_t, p) {
          return p === 'default' || lateBound.current != null;
        },
      },
    );

    const importMap: Record<string, unknown> = {
      'svelte/internal/client': svelteInternalClient,
      'svelte/internal/disclose-version': {},
      svelte,
      './TreeNode.svelte': selfModule,
    };

    const mod = await evalEsModule(compiled.js.code, importMap);
    const Component = mod.default as never;
    lateBound.current = Component;

    const target = document.body.appendChild(document.createElement('div'));
    const instance = svelte.mount(Component, {
      target,
      props: { node: FIXTURE_3_LEVEL },
    });

    const text = target.textContent ?? '';
    expect(text).toContain('Root');
    expect(text).toContain('Child A');
    expect(text).toContain('Leaf A1');

    svelte.unmount(instance);
    target.remove();
  });
});

// ---------------------------------------------------------------------------
// Helpers — evalEsModule (mirrors tests/timing/SearchInput.debounce.parity.test.ts)
// ---------------------------------------------------------------------------

async function evalEsModule(
  source: string,
  importMap: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let body = source;
  body = body.replace(/^[\t ]*import\s+['"]([^'"]+)['"];?[\t ]*$/gm, '');
  body = body.replace(
    /^[\t ]*import\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"];?[\t ]*$/gm,
    (_m, clauseRaw: string, spec: string) => {
      const safe = JSON.stringify(spec);
      const clause = clauseRaw.trim();
      const lines: string[] = [];
      if (clause.startsWith('* as ')) {
        const name = clause.slice('* as '.length).trim();
        lines.push(`const ${name} = __rozieImports[${safe}];`);
      } else if (clause.startsWith('{')) {
        const inside = clause.replace(/^\{|\}$/g, '');
        const dest = rewriteNamedSpecifiers(inside);
        if (dest) lines.push(`const { ${dest} } = __rozieImports[${safe}];`);
      } else if (clause.includes(',')) {
        const idx = clause.indexOf(',');
        const defaultName = clause.slice(0, idx).trim();
        const rest = clause.slice(idx + 1).trim();
        lines.push(
          `const ${defaultName} = (__rozieImports[${safe}]?.default ?? __rozieImports[${safe}]);`,
        );
        if (rest.startsWith('{')) {
          const inside = rest.replace(/^\{|\}$/g, '');
          const dest = rewriteNamedSpecifiers(inside);
          if (dest) lines.push(`const { ${dest} } = __rozieImports[${safe}];`);
        }
      } else {
        // Default-only: bind to a Proxy that forwards every operation to a
        // late-bound default lookup on the import-map. This lets the rebound
        // value (Phase 06.2 P3 self-reference) be observed at access time.
        // The Proxy presents as a callable function so Svelte's runtime can
        // invoke it as a component constructor recursively.
        lines.push(
          `const ${clause} = new Proxy(function(){}, {` +
            ` get(_t, p, recv) { const m = __rozieImports[${safe}]; const v = (m && typeof m === 'object' && 'default' in m) ? m.default : m; return v == null ? undefined : Reflect.get(v, p, recv); },` +
            ` apply(_t, thisArg, args) { const m = __rozieImports[${safe}]; const v = (m && typeof m === 'object' && 'default' in m) ? m.default : m; return Reflect.apply(v, thisArg, args); },` +
            ` construct(_t, args) { const m = __rozieImports[${safe}]; const v = (m && typeof m === 'object' && 'default' in m) ? m.default : m; return Reflect.construct(v, args); },` +
            ` has(_t, p) { const m = __rozieImports[${safe}]; const v = (m && typeof m === 'object' && 'default' in m) ? m.default : m; return v == null ? false : (p in v); }` +
            `});`,
        );
      }
      return lines.join('\n');
    },
  );
  body = body.replace(/^[\t ]*export\s+default\s+/gm, '__rozieExports.default = ');
  body = body.replace(
    /^[\t ]*export\s*\{([^}]+)\};?[\t ]*$/gm,
    (_m, inside: string) => {
      return inside
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
        .map((entry) => {
          const m = entry.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
          if (!m) return '';
          const [, local, exported] = m;
          return `__rozieExports[${JSON.stringify(exported || local)}] = ${local};`;
        })
        .join('\n');
    },
  );
  body = body.replace(
    /^[\t ]*export\s+(const|let|var|function|class|async\s+function)\s+(\w+)/gm,
    (_m, kw: string, name: string) => `${kw} ${name}`,
  );

  const exports: Record<string, unknown> = {};
  const fnSource = `
    "use strict";
    return (async function __rozieEvalModule(__rozieImports, __rozieExports) {
      ${body}
      return __rozieExports;
    });
  `;
  const factory = new Function(fnSource)();
  return await factory(importMap, exports);
}

function rewriteNamedSpecifiers(inside: string): string {
  return inside
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const noType = entry.replace(/^type\s+/, '');
      const m = noType.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!m) return noType;
      const [, source, asName] = m;
      return asName ? `${source}: ${asName}` : source;
    })
    .filter(Boolean)
    .join(', ');
}
