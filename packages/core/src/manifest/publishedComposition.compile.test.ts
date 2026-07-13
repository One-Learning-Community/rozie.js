// Phase 75 Plan 02 Task 2 — live-compile integration proof for the manifest-
// first producer-resolution branch (COMP-04 bounded exception). A consumer
// `.rozie` with a PUBLISHED `<components>` specifier (D-08 shape) threads
// scoped-slot params + validates r-model:propName against a
// rozie-manifest.json read from a fixture `node_modules` install — with NO
// `.rozie` producer source present anywhere in the compile pass.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { compile } from '../compile.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { buildManifest } from './buildManifest.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { RozieManifest } from './schema.js';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);

function buildRealComboboxManifest(): RozieManifest {
  const file = path.join(repoRoot, 'packages/ui/combobox/src/Combobox.rozie');
  const source = readFileSync(file, 'utf8');
  const { ast, diagnostics: parseDiags } = parse(source, {
    filename: 'Combobox.rozie',
  });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for Combobox.rozie: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null IR for Combobox.rozie');
  return buildManifest(ir);
}

// A published-composition consumer: uses the D-08 `@rozie-ui/combobox/Combobox.rozie`
// bare-package specifier form, binds the sole model:true prop via r-model:value
// (validateTwoWayBindings' manifest branch), and fills BOTH scoped slots
// (threadParamTypes' manifest branch — #option carries option/index/active/
// selected/disabled params, #empty carries query).
const CONSUMER_SRC = `<rozie name="Consumer">
<components>{ Combobox: '@rozie-ui/combobox/Combobox.rozie' }</components>
<data>
{
  value: null,
  options: [],
}
</data>
<template>
  <Combobox r-model:value="$data.value" :options="$data.options">
    <template #option="{ option, index }">
      <span>{{ option.label }} {{ index }}</span>
    </template>
    <template #empty="{ query }">
      <span>No results for {{ query }}</span>
    </template>
  </Combobox>
</template>
</rozie>
`;

describe('published cross-package composition — live compile() (COMP-04)', () => {
  let tmpRoot: string;
  let consumerFile: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-published-compile-'));
    consumerFile = path.join(tmpRoot, 'Consumer.rozie');
    writeFileSync(consumerFile, CONSUMER_SRC, 'utf8');
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
    writeFileSync(
      path.join(dir, 'rozie-manifest.json'),
      JSON.stringify(manifestJson),
      'utf8',
    );
  }

  it('compiles ZERO-error against a real installed manifest and threads the scoped-slot signature', () => {
    stagePackage('@rozie-ui/combobox-react', buildRealComboboxManifest());
    const result = compile(CONSUMER_SRC, {
      target: 'react',
      filename: consumerFile,
      resolverRoot: tmpRoot,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(result.code).not.toBe('');
    // No false ROZ949 (TWO_WAY_PROP_NOT_MODEL) — the manifest correctly
    // threads `value`'s isModel:true from the real Combobox IR.
    expect(
      result.diagnostics.some((d) => d.code === RozieErrorCode.TWO_WAY_PROP_NOT_MODEL),
    ).toBe(false);
    // No false ROZ947 (SCOPED_PARAM_MISMATCH) — `option`/`index`/`query` are
    // all real producer slot params threaded from the manifest.
    expect(
      result.diagnostics.some((d) => d.code === RozieErrorCode.SCOPED_PARAM_MISMATCH),
    ).toBe(false);
  });

  it('surfaces MANIFEST_SCHEMA_VERSION_MISMATCH when the installed manifest is schemaVersion-incompatible (D-04/D-12 backstop)', () => {
    const mismatched = { ...buildRealComboboxManifest(), schemaVersion: 999 };
    stagePackage('@rozie-ui/combobox-react', mismatched);
    const result = compile(CONSUMER_SRC, {
      target: 'react',
      filename: consumerFile,
      resolverRoot: tmpRoot,
    });
    const mismatchDiag = result.diagnostics.find(
      (d) => d.code === RozieErrorCode.MANIFEST_SCHEMA_VERSION_MISMATCH,
    );
    expect(mismatchDiag).toBeDefined();
    expect(mismatchDiag?.severity).toBe('error');
    // A schema-incompatible install fails the compile loudly (empty code).
    expect(result.code).toBe('');
  });

  it('a local relative ./Child.rozie producer still resolves via the on-disk .rozie cache (COMP-04 local path unregressed)', () => {
    const childFile = path.join(tmpRoot, 'Child.rozie');
    writeFileSync(
      childFile,
      `<rozie name="Child">
<props>
{
  value: { type: null, default: null, model: true },
}
</props>
<template>
  <div>
    <slot name="option" :option="1"></slot>
  </div>
</template>
</rozie>
`,
      'utf8',
    );
    const localConsumerFile = path.join(tmpRoot, 'LocalConsumer.rozie');
    const localConsumerSrc = `<rozie name="LocalConsumer">
<components>{ Child: './Child.rozie' }</components>
<data>
{
  value: null,
}
</data>
<template>
  <Child r-model:value="$data.value">
    <template #option="{ option }">
      <span>{{ option }}</span>
    </template>
  </Child>
</template>
</rozie>
`;
    writeFileSync(localConsumerFile, localConsumerSrc, 'utf8');
    const result = compile(localConsumerSrc, {
      target: 'react',
      filename: localConsumerFile,
      resolverRoot: tmpRoot,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(result.code).not.toBe('');
    expect(
      result.diagnostics.some((d) => d.code === RozieErrorCode.TWO_WAY_PROP_NOT_MODEL),
    ).toBe(false);
  });
});
