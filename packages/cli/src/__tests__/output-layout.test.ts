// D-89 output-layout tests — pure unit-tests of computeOutputPath plus an
// end-to-end M8 "source-rel preservation" coverage via runBuildMatrix.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBuildMatrix } from '../commands/build.js';
import { computeOutputPath, TARGET_EXTENSIONS } from '../utils/outputPath.js';

describe('computeOutputPath — D-89 layout unit tests', () => {
  it('L1: file in subdir → <out>/<target>/<rel>/Foo.<ext>', () => {
    const inputAbs = '/repo/src/components/forms/Input.rozie';
    const out = computeOutputPath(inputAbs, 'react', '/repo/dist', '/repo');
    expect(out).toBe('/repo/dist/react/src/components/forms/Input.tsx');
  });

  it('L2: file directly in rootDir → <out>/<target>/Foo.<ext>', () => {
    const inputAbs = '/repo/Counter.rozie';
    const out = computeOutputPath(inputAbs, 'react', '/repo/dist', '/repo');
    expect(out).toBe('/repo/dist/react/Counter.tsx');
  });

  it('L3: per-target extensions — vue→.vue, react→.tsx, svelte→.svelte, angular→.ts', () => {
    expect(TARGET_EXTENSIONS.vue).toBe('.vue');
    expect(TARGET_EXTENSIONS.react).toBe('.tsx');
    expect(TARGET_EXTENSIONS.svelte).toBe('.svelte');
    expect(TARGET_EXTENSIONS.angular).toBe('.ts');
    expect(computeOutputPath('/r/Foo.rozie', 'vue', '/r/d', '/r')).toBe('/r/d/vue/Foo.vue');
    expect(computeOutputPath('/r/Foo.rozie', 'react', '/r/d', '/r')).toBe('/r/d/react/Foo.tsx');
    expect(computeOutputPath('/r/Foo.rozie', 'svelte', '/r/d', '/r')).toBe('/r/d/svelte/Foo.svelte');
    expect(computeOutputPath('/r/Foo.rozie', 'angular', '/r/d', '/r')).toBe('/r/d/angular/Foo.ts');
  });

  it('L4: source outside rootDir → flatten to <out>/<target>/Foo.<ext> (path-traversal safety)', () => {
    // /elsewhere/Foo.rozie with rootDir=/repo would yield rel=../elsewhere; we
    // strip the ..-traversal and emit basename-only under outDir.
    const out = computeOutputPath('/elsewhere/Foo.rozie', 'react', '/repo/dist', '/repo');
    expect(out).toBe('/repo/dist/react/Foo.tsx');
  });

  it('L5: nested rel-path preservation under target subdir', () => {
    const out = computeOutputPath(
      '/repo/packages/lib/src/components/Modal.rozie',
      'svelte',
      '/repo/build',
      '/repo',
    );
    expect(out).toBe('/repo/build/svelte/packages/lib/src/components/Modal.svelte');
  });
});

describe('runBuildMatrix — M8 source-rel preservation end-to-end', () => {
  it('M8: input in subdir → output preserves source-rel-path under target subdir', async () => {
    // Build a temporary source tree:
    //   <tmp>/sub/Foo.rozie
    // Run with rootDir=<tmp>; expect output at <out>/vue/sub/Foo.vue.
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m8-src-'));
    const subDir = join(tmp, 'sub');
    mkdirSync(subDir, { recursive: true });
    const fooPath = join(subDir, 'Foo.rozie');
    writeFileSync(
      fooPath,
      [
        '<rozie name="Foo">',
        '<props>{ msg: { type: String, default: "hi" } }</props>',
        '<template><div>{{ $props.msg }}</div></template>',
        '</rozie>',
        '',
      ].join('\n'),
      'utf8',
    );

    const outDir = mkdtempSync(join(tmpdir(), 'rozie-cli-m8-out-'));
    await runBuildMatrix([fooPath], { target: ['vue'], out: outDir, root: tmp }, {
      exit: 'throw',
      stderrWrite: () => {},
      stdoutWrite: () => {},
    });
    expect(existsSync(join(outDir, 'vue', 'sub', 'Foo.vue'))).toBe(true);
  });
});

