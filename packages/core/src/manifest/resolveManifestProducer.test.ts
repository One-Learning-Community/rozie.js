// Phase 75 Plan 02 Task 1 — resolveManifestProducer: derive the per-target
// package by convention (D-08), locate its installed rozie-manifest.json via
// node module resolution (D-10), validate schema-version loudly (D-04).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { buildManifest } from './buildManifest.js';
import { ProducerResolver } from '../resolver/index.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import {
  isPublishedSpecifier,
  resolveManifestProducer,
} from './resolveManifestProducer.js';
import type { RozieTarget } from '../codegen/rewriteRozieImport.js';
import type { RozieManifest } from './schema.js';

// This file lives at packages/core/src/manifest/resolveManifestProducer.test.ts →
// four `..` segments reach the repo root.
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);

/** Build a real, valid RozieManifest from Combobox.rozie's IR (Plan 01's buildManifest). */
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

const ALL_TARGETS: RozieTarget[] = [
  'react',
  'vue',
  'svelte',
  'angular',
  'solid',
  'lit',
];

describe('isPublishedSpecifier', () => {
  it('true for a scoped bare specifier ending in .rozie', () => {
    expect(isPublishedSpecifier('@rozie-ui/combobox/Combobox.rozie')).toBe(true);
  });

  it('false for relative specifiers', () => {
    expect(isPublishedSpecifier('./Combobox.rozie')).toBe(false);
  });

  it('false for parent-relative specifiers', () => {
    expect(isPublishedSpecifier('../x/Modal.rozie')).toBe(false);
  });

  it('false for a tsconfig-alias-shaped @/ specifier (LOCAL, not published)', () => {
    expect(isPublishedSpecifier('@/components/Modal.rozie')).toBe(false);
  });

  it('false for a specifier not ending in .rozie', () => {
    expect(isPublishedSpecifier('@rozie-ui/combobox/Combobox.ts')).toBe(false);
  });
});

describe('resolveManifestProducer', () => {
  let tmpRoot: string;
  let consumerFile: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-manifest-resolve-'));
    consumerFile = path.join(tmpRoot, 'Host.rozie');
    writeFileSync(consumerFile, '<rozie><template><div /></template></rozie>', 'utf8');
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  /**
   * Stage a fixture per-target package under `<tmpRoot>/node_modules` mirroring
   * a REAL per-target leaf's package.json shape (exports "." only — deliberately
   * NOT exporting "./package.json" or "./rozie-manifest.json", per the real
   * packages/ui/combobox/packages/react/package.json read_first reference) plus
   * a rozie-manifest.json sibling.
   */
  function stagePackage(pkgName: string, manifestJson: unknown): string {
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
    return dir;
  }

  it('derives the per-target package name and resolves a surface for ALL SIX targets', () => {
    const manifestJson = buildRealComboboxManifest();
    for (const target of ALL_TARGETS) {
      const pkgName = `@rozie-ui/combobox-${target}`;
      stagePackage(pkgName, manifestJson);
      const resolver = new ProducerResolver({ root: tmpRoot });
      const result = resolveManifestProducer({
        specifier: '@rozie-ui/combobox/Combobox.rozie',
        target,
        fromFile: consumerFile,
        resolver,
      });
      expect(result.error).toBeNull();
      expect(result.surface).not.toBeNull();
      expect(result.surface?.props.map((p) => p.name)).toEqual(
        manifestJson.props.map((p) => p.name),
      );
    }
  });

  it('returns MANIFEST_SCHEMA_VERSION_MISMATCH for schemaVersion: 999 (D-04 backstop)', () => {
    const manifestJson = { ...buildRealComboboxManifest(), schemaVersion: 999 };
    const pkgName = '@rozie-ui/combobox-react';
    stagePackage(pkgName, manifestJson);
    const resolver = new ProducerResolver({ root: tmpRoot });
    const result = resolveManifestProducer({
      specifier: '@rozie-ui/combobox/Combobox.rozie',
      target: 'react',
      fromFile: consumerFile,
      resolver,
    });
    expect(result.surface).toBeNull();
    expect(result.error?.code).toBe(RozieErrorCode.MANIFEST_SCHEMA_VERSION_MISMATCH);
  });

  it('returns CROSS_PACKAGE_LOOKUP_FAILED when the derived package is not installed', () => {
    const resolver = new ProducerResolver({ root: tmpRoot });
    const result = resolveManifestProducer({
      specifier: '@rozie-ui/combobox/Combobox.rozie',
      target: 'react',
      fromFile: consumerFile,
      resolver,
    });
    expect(result.surface).toBeNull();
    expect(result.error?.code).toBe(RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED);
  });

  it('skips a name-matched dist/package.json duplicate lacking rozie-manifest.json and finds the real root (ng-packagr shape)', () => {
    // Mirrors packages/ui/combobox/packages/angular's real shape: ng-packagr
    // emits a SECONDARY package.json inside dist/ with the SAME `name` as the
    // real package root, and the resolved "." entry sits a level deeper still
    // (dist/fesm2022/*.mjs). Only the REAL root (sibling to the AUTHORED
    // package.json) carries rozie-manifest.json.
    const manifestJson = buildRealComboboxManifest();
    const pkgName = '@rozie-ui/combobox-angular';
    const dir = path.join(tmpRoot, 'node_modules', ...pkgName.split('/'));
    mkdirSync(path.join(dir, 'dist/fesm2022'), { recursive: true });
    const pkgJson = {
      name: pkgName,
      type: 'module',
      exports: {
        '.': { default: './dist/fesm2022/rozie-ui-combobox-angular.mjs' },
      },
    };
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJson), 'utf8');
    // The ng-packagr dist/package.json duplicate: SAME name, NO manifest sibling.
    writeFileSync(path.join(dir, 'dist/package.json'), JSON.stringify(pkgJson), 'utf8');
    writeFileSync(
      path.join(dir, 'dist/fesm2022/rozie-ui-combobox-angular.mjs'),
      'export {};\n',
      'utf8',
    );
    writeFileSync(
      path.join(dir, 'rozie-manifest.json'),
      JSON.stringify(manifestJson),
      'utf8',
    );
    const resolver = new ProducerResolver({ root: tmpRoot });
    const result = resolveManifestProducer({
      specifier: '@rozie-ui/combobox/Combobox.rozie',
      target: 'angular',
      fromFile: consumerFile,
      resolver,
    });
    expect(result.error).toBeNull();
    expect(result.surface).not.toBeNull();
    expect(result.surface?.props.map((p) => p.name)).toEqual(
      manifestJson.props.map((p) => p.name),
    );
  });

  it('returns CROSS_PACKAGE_LOOKUP_FAILED when the package resolves but has no rozie-manifest.json', () => {
    const pkgName = '@rozie-ui/combobox-react';
    const dir = path.join(tmpRoot, 'node_modules', ...pkgName.split('/'));
    mkdirSync(path.join(dir, 'dist'), { recursive: true });
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: pkgName,
        type: 'module',
        exports: { '.': { import: './dist/index.mjs' } },
      }),
      'utf8',
    );
    writeFileSync(path.join(dir, 'dist/index.mjs'), 'export {};\n', 'utf8');
    // Deliberately NO rozie-manifest.json written.
    const resolver = new ProducerResolver({ root: tmpRoot });
    const result = resolveManifestProducer({
      specifier: '@rozie-ui/combobox/Combobox.rozie',
      target: 'react',
      fromFile: consumerFile,
      resolver,
    });
    expect(result.surface).toBeNull();
    expect(result.error?.code).toBe(RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED);
  });
});
