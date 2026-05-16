// Phase 07.2 Plan 06 Task 1 — D-12 tsconfig paths integration test.
//
// Verifies the end-to-end claim from Plan 07.2-01: a consumer that imports a
// producer via a tsconfig-`paths` alias (e.g., `@/Producer.rozie`) is
// behaviorally identical to a sibling consumer that uses the relative form
// (e.g., `./Producer.rozie`).
//
// This is the integration-level proof that the resolver's tsconfig-paths leg
// (D-12) is transparent at the emit boundary: the alias is resolved by
// ProducerResolver to the same absolute path the relative form resolves to,
// so threadParamTypes finds the same producer IR and per-target emit walks
// the same tree.
//
// Distinguished from `resolver.test.ts` (Plan 07.2-01) which tests
// ProducerResolver in isolation against tmpdir fixtures. This integration
// test runs the full compile() pipeline so any subtle leak between the
// resolver's two legs (tsconfig-paths first, npm/relative second) and the
// downstream emitter would surface as a body-diff between the two consumers.
//
// IMPORTANT — the alias is preserved verbatim in the emitted import statement
// (the consumer's downstream bundler — Vite/webpack/rollup — resolves the
// alias through its own tsconfig-paths config). So byte-equality applies to
// the body (template + script + slot-fill threading) AFTER normalising the
// import specifier line, NOT to the raw bytes. This is the correct behavior:
// rewriting `@/Producer.vue` → `./Producer.vue` at emit would force every
// downstream consumer to opt out of their tsconfig-paths layout, which would
// be a Rozie-specific tax on consumer tooling.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  realpathSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '../../src/compile.js';

describe('D-12 tsconfig paths integration — aliased vs relative consumer byte-equal', () => {
  let root: string;
  let aliasedConsumer: string;
  let relativeConsumer: string;

  beforeAll(() => {
    // Realpath canonicalization: macOS symlinks `/var` → `/private/var`, and
    // enhanced-resolve always returns canonical paths.
    root = realpathSync(mkdtempSync(join(tmpdir(), 'rozie-tsconfig-paths-int-')));

    // Layout:
    //   <root>/
    //     tsconfig.json   (paths: @/* -> ./src/*)
    //     src/
    //       Producer.rozie     (the shared producer; declares header + default slots)
    //       AliasedConsumer.rozie  (imports @/Producer.rozie)
    //       RelativeConsumer.rozie (imports ./Producer.rozie)
    mkdirSync(join(root, 'src'), { recursive: true });

    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@/*': ['./src/*'],
            },
          },
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(root, 'src', 'Producer.rozie'),
      `<rozie name="Producer">

<props>
{
  title: { type: String, default: 'Hello' },
}
</props>

<template>
<div class="producer">
  <header>
    <slot name="header"><h2>{{ $props.title }}</h2></slot>
  </header>
  <main>
    <slot>body fallback</slot>
  </main>
</div>
</template>

</rozie>
`,
    );

    // Both consumer .rozie files share the SAME basename `Consumer.rozie` —
    // sitting in two different sub-directories. Per-target emit hashes that
    // incorporate the filename (e.g., React + Solid CSS-scope hashes via
    // basename) produce identical bytes for the two consumers; the only
    // textual difference is the `<components>` block specifier, which the
    // post-compile normalisation collapses.
    mkdirSync(join(root, 'src', 'aliased'), { recursive: true });
    mkdirSync(join(root, 'src', 'relative'), { recursive: true });

    aliasedConsumer = join(root, 'src', 'aliased', 'Consumer.rozie');
    writeFileSync(
      aliasedConsumer,
      `<rozie name="Consumer">

<components>
{
  Producer: '@/Producer.rozie',
}
</components>

<template>
<Producer :title="'World'">
  <template #header>
    <h2>Custom header</h2>
  </template>
  Custom body
</Producer>
</template>

</rozie>
`,
    );

    relativeConsumer = join(root, 'src', 'relative', 'Consumer.rozie');
    writeFileSync(
      relativeConsumer,
      `<rozie name="Consumer">

<components>
{
  Producer: '../Producer.rozie',
}
</components>

<template>
<Producer :title="'World'">
  <template #header>
    <h2>Custom header</h2>
  </template>
  Custom body
</Producer>
</template>

</rozie>
`,
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const TARGETS = ['vue', 'react', 'svelte', 'solid', 'lit', 'angular'] as const;

  describe.each(TARGETS)('target=%s', (target) => {
    it('aliased and relative consumers produce byte-equal compiled output', () => {
      const aliasedSrc = readFileSync(aliasedConsumer, 'utf8');
      const relativeSrc = readFileSync(relativeConsumer, 'utf8');

      const aliasedResult = compile(aliasedSrc, {
        target,
        filename: aliasedConsumer,
        resolverRoot: root,
        types: true,
        sourceMap: false,
      });
      const relativeResult = compile(relativeSrc, {
        target,
        filename: relativeConsumer,
        resolverRoot: root,
        types: true,
        sourceMap: false,
      });

      // No errors in either compile — both legs resolve the producer cleanly.
      expect(aliasedResult.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(relativeResult.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

      // Body byte-equality — normalise the import specifier line so the only
      // bytes that differ between the two consumers are the alias-vs-relative
      // specifier. Rewriting the alias at emit would force consumers to opt
      // out of their tsconfig-paths layout downstream (Vite/webpack/rollup
      // resolve the alias via their own config) — so the alias being preserved
      // verbatim is the correct behavior. The byte-equality of everything ELSE
      // is the integration assertion: alias resolution flows through to the
      // same producer IR + same threading + same per-target emit.
      // Normalise the import-specifier line that necessarily differs between
      // the two consumers (alias vs relative). Everything ELSE — body
      // template, slot-fill threading, prop wiring, CSS scope hash (filename
      // is identical), per-target dispatch shape — must be byte-equal.
      const normalize = (code: string): string =>
        code
          // Vue/Svelte rewrite ProducerRef to ../Producer.vue / ../Producer.svelte
          // when the import is `../Producer.rozie`; aliased form yields
          // `@/Producer.vue`. Strip both back to the same neutral form.
          .replace(/['"]@\/Producer\.([a-z.]+)['"]/g, "'NORMALIZED.$1'")
          .replace(/['"]\.\.\/Producer\.([a-z.]+)['"]/g, "'NORMALIZED.$1'")
          .replace(/['"]\.\/Producer['"]/g, "'NORMALIZED'")
          .replace(/['"]@\/Producer['"]/g, "'NORMALIZED'")
          .replace(/['"]\.\.\/Producer['"]/g, "'NORMALIZED'")
          // Angular emits `import { Producer } from './...';` — strip the
          // bracketed-named import specifier line the same way.
          .replace(/['"]@\/Producer\.rozie['"]/g, "'NORMALIZED.rozie'")
          .replace(/['"]\.\.\/Producer\.rozie['"]/g, "'NORMALIZED.rozie'");
      expect(normalize(aliasedResult.code)).toBe(normalize(relativeResult.code));
    });
  });
});
