/**
 * assetUrlImport.test.ts — Angular emitter: rewrite `new URL(<literal>, import.meta.url)`
 * into a hoisted `?url` asset import.
 *
 * analogjs AOT REJECTS `import.meta.url`: `new Worker(new URL('./worker.js', import.meta.url))`
 * spliced verbatim → worker 404 / JIT fallback (memory `project_angular_aot_no_import_meta_url`).
 * The established hand-fix is a `?url` asset import; here the EMITTER owns that parity.
 *
 * FIX: the Angular target detects the EXACT static shape
 * `new URL(<string-literal>, import.meta.url)` and (1) hoists a module-top
 * `import __rozieAsset<N> from '<literal>?url';` and (2) replaces the NewExpression
 * with a bare `__rozieAsset<N>` reference (which resolves to the asset URL string
 * under Vite/analog's `?url` convention). Emitted Angular carries NO `import.meta.url`.
 *
 * Angular seam ONLY — the other five targets are Vite-based, tolerate `import.meta.url`,
 * and MUST keep splicing `new URL(<literal>, import.meta.url)` verbatim.
 *
 * The rewrite fires ONLY when arg2 is EXACTLY `import.meta.url` AND arg1 is a static
 * string literal; a dynamic/non-literal first arg is left byte-untouched.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { compile } from '../../../../../core/src/compile.js';
import type { IRComponent } from '../../../../../core/src/ir/types.js';
import { emitAngular } from '../../emitAngular.js';

function compileAngular(src: string, filename = 'Test.rozie'): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) {
    throw new Error('lowerToIR() returned null IR');
  }
  const ir: IRComponent = lowered.ir;
  return emitAngular(ir, { filename, source: src }).code;
}

const WORKER_SRC = `<rozie name="Test">
<script>
$onMount(() => {
  const worker = new Worker(new URL('./worker.js', import.meta.url));
  return () => worker.terminate();
})
</script>
<template>
  <div>hi</div>
</template>
</rozie>`;

describe('emitAngular — new URL(literal, import.meta.url) → hoisted ?url asset import', () => {
  it('(1) Angular hoists a module-top ?url import + references the binding; NO import.meta.url', () => {
    const code = compileAngular(WORKER_SRC);

    // Module-top asset import: specifier gained a `?url` suffix; binding `__rozieAsset0`.
    expect(code).toMatch(/import __rozieAsset0 from ['"]\.\/worker\.js\?url['"];/);
    // Reference at the original site.
    expect(code).toContain('new Worker(__rozieAsset0)');
    // NO `import.meta.url` anywhere.
    expect(code).not.toContain('import.meta.url');
    // NO residual `new URL(` for the matched pattern.
    expect(code).not.toMatch(/new URL\([^)]*import\.meta\.url/);
  });

  it('(2-cross-target) the SAME source on react STILL splices import.meta.url verbatim', () => {
    const react = compile(WORKER_SRC, { target: 'react', filename: 'Test.rozie' });
    expect(react.code).toContain('import.meta.url');
    expect(react.code).toContain('new URL(');
    // No asset-import rewrite leaked into a non-Angular target.
    expect(react.code).not.toContain('__rozieAsset');
  });

  it('(3-guard) dynamic first arg → LEFT UNTOUCHED (no __rozieAsset import; import.meta.url survives)', () => {
    const code = compileAngular(`<rozie name="Test">
<data>
{ workerUrl: './worker.js' }
</data>
<script>
$onMount(() => {
  const worker = new Worker(new URL($data.workerUrl, import.meta.url));
  return () => worker.terminate();
})
</script>
<template>
  <div>hi</div>
</template>
</rozie>`);
    // Dynamic first arg is out of scope — no rewrite.
    expect(code).not.toContain('__rozieAsset');
    expect(code).toContain('import.meta.url');
  });
});
