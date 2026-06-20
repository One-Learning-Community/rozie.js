/**
 * inlineScriptPartials — Phase 54 unit contract (R1–R7) + negative routing.
 *
 * Nyquist discipline (54-VALIDATION.md): this suite was authored BEFORE the
 * `inlineScriptPartials` pass existed (Wave-0, "green-by-skip"). Waves 2–4 then
 * flipped every `it` to a real assertion as the pass
 * (`../inlineScriptPartials.ts`) and its diagnostics (ROZ139 collision /
 * ROZ140 cycle) landed; all R1–R7 + negative-routing cases are now active.
 *
 * The pass inlines a `.rzts`/`.rzjs` script partial's EXPORTED declarations
 * (sigils intact) into the host component's `<script>` AST BEFORE `analyzeAST`
 * runs — so the partial rides the host's single per-target lowering. The
 * north-star invariant (proven in tests/dist-parity/partial-inline-parity.test.ts)
 * is byte-identity between the same logic authored inline vs. in a partial.
 *
 * IMPORTANT (acceptance criterion): there is NO top-level static import of
 * `../inlineScriptPartials.js` — it does not exist yet. Each skipped `it`
 * dynamically `import()`s it INSIDE the test body (mirrors the repo's
 * in-it() dynamic-import hoist guidance so the suite does not hard-fail on
 * the not-yet-created module). No watch-mode flags.
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import { parse as babelParse } from '@babel/parser';
import type { File, Program, Statement } from '@babel/types';
import * as t from '@babel/types';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const LOC = { start: 0, end: 0 };

/** Parse a module-source string into a Babel File (the `<script>` program shape). */
function moduleFile(src: string): File {
  return babelParse(src, { sourceType: 'module', plugins: ['typescript'] });
}

/** Convenience: the top-level statement list of a parsed module. */
function bodyOf(file: File): Statement[] {
  return (file.program as Program).body;
}

/**
 * Stage a partial source on disk under a fresh tmp dir so the real
 * resolver/`readFileSync` path can locate it. Returns the absolute partial
 * path + a disposer. Wave 2/3 implementations call the pass with a host whose
 * ImportDeclaration source resolves to this file. (Currently unused by the
 * skipped bodies — retained as the shared fixture helper the flips will use.)
 */
function stagePartial(name: string, src: string): { path: string; dispose: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'rozie-partial-'));
  const path = join(dir, name);
  writeFileSync(path, src, 'utf8');
  return { path, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('inlineScriptPartials', () => {
  // R1 — detection + import removal. A host program with an ImportDeclaration
  // whose source ends in `.rzts`/`.rzjs` is detected, and that import statement
  // is REMOVED from the program body after the pass (its declarations are
  // spliced in instead of left as a runtime import).
  it('R1: detects a .rzts/.rzjs import and removes the import statement after inline', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'logic.rzts',
      `export const usedName = $computed(() => $props.value + 1);`,
    );
    try {
      const host = moduleFile(`import { usedName } from '${partial.path.replace(/\\/g, '\\\\')}';`);
      // Wave 2/3: inlineScriptPartials(host, { resolverRoot, diagnostics, ... })
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const stillImported = bodyOf(result.ast ?? host).some(
        (s) => s.type === 'ImportDeclaration' && /\.rz(ts|js)$/.test(s.source.value),
      );
      expect(stillImported).toBe(false);
    } finally {
      partial.dispose();
    }
  });

  // R2 — tree-shake. Only the IMPORTED names plus their transitive in-file
  // helper closure are spliced. An UNUSED export of the partial adds nothing
  // to the merged host body.
  it('R2: splices only imported names + their transitive helper closure (unused export tree-shaken)', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'logic.rzts',
      [
        `const helper = (n) => n * 2;`,
        `export const usedName = $computed(() => helper($props.value));`,
        `export const neverImported = $computed(() => 999);`, // must NOT inline
      ].join('\n'),
    );
    try {
      const host = moduleFile(`import { usedName } from '${partial.path.replace(/\\/g, '\\\\')}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const text = JSON.stringify(bodyOf(result.ast ?? host));
      expect(text).toContain('usedName');
      expect(text).toContain('helper'); // transitive closure pulled in
      expect(text).not.toContain('neverImported'); // unused export dropped
    } finally {
      partial.dispose();
    }
  });

  // R3 — pre-lowering placement. A $computed/$onMount moved into a partial
  // lands in `ast.script.program.body` BEFORE `analyzeAST` runs, so the inlined
  // reactive reads are analyzed identically to host-authored reads (shared
  // ReactiveDepGraph). Assert via merged-body inspection.
  it('R3: inlined declarations land in the merged host body before analyzeAST', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'logic.rzts',
      `export const onReady = $onMount(() => { $data.ready = true; });`,
    );
    try {
      const host = moduleFile(`import { onReady } from '${partial.path.replace(/\\/g, '\\\\')}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const merged = bodyOf(result.ast ?? host);
      const hasInlined = merged.some(
        (s) =>
          s.type === 'VariableDeclaration' &&
          s.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === 'onReady'),
      );
      expect(hasInlined).toBe(true);
    } finally {
      partial.dispose();
    }
  });

  // R4 — import hoist + dedup. Partial top-level ImportDeclarations are hoisted
  // to the host and deduped by the (source, importKind, imported/local,
  // default/namespace) tuple; aliases are preserved.
  it('R4: hoists + dedups partial top-level imports by (source, kind, name) tuple, preserving aliases', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'logic.rzts',
      [
        `import { thing as aliased } from 'engine';`,
        `export const usedName = $computed(() => aliased($props.value));`,
      ].join('\n'),
    );
    try {
      // Host already imports `thing` from 'engine' under a DIFFERENT local name;
      // the dedup must keep both bindings distinct (alias preserved), not merge.
      const host = moduleFile(
        [
          `import { thing } from 'engine';`,
          `import { usedName } from '${partial.path.replace(/\\/g, '\\\\')}';`,
        ].join('\n'),
      );
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const imports = bodyOf(result.ast ?? host).filter(
        (s): s is t.ImportDeclaration => s.type === 'ImportDeclaration',
      );
      const engineSpecifiers = imports
        .filter((i) => i.source.value === 'engine')
        .flatMap((i) => i.specifiers.map((sp) => (sp.local as t.Identifier).name));
      expect(engineSpecifiers).toContain('thing');
      expect(engineSpecifiers).toContain('aliased');
    } finally {
      partial.dispose();
    }
  });

  // R5 — recursion + cycle detection. A 2-level partial chain inlines fully; an
  // import CYCLE pushes a clean diagnostic (no stack overflow). The exact code
  // is ROZ140-adjacent; left as a TODO until Wave 3 assigns the canonical value.
  it('R5: inlines a 2-level partial chain; an import cycle pushes a clean diagnostic (no stack overflow)', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const { RozieErrorCode } = await import('../../diagnostics/codes.js');
    const CYCLE_DIAGNOSTIC_CODE = RozieErrorCode.PARTIAL_INLINE_CYCLE;
    // a.rzts imports b from a sibling b.rzts (a real 2-level chain); both staged
    // in the SAME tmp dir so `./b.rzts` resolves.
    const a = stagePartial('a.rzts', `import { b } from './b.rzts';\nexport const a = $computed(() => b + 1);`);
    writeFileSync(join(dirname(a.path), 'b.rzts'), `export const b = $computed(() => 1);`, 'utf8');
    const cyclic = stagePartial('cyclic.rzts', `import { self } from './cyclic.rzts';\nexport const self = 1;`);
    try {
      const host = moduleFile(`import { a } from '${a.path.replace(/\\/g, '\\\\')}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      // 2-level chain inlines without throwing — both `a` and `b` land in the body.
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const text = JSON.stringify(bodyOf(result.ast ?? host));
      expect(text).toContain('"name":"a"');
      expect(text).toContain('"name":"b"');

      const cyclicHost = moduleFile(`import { self } from '${cyclic.path.replace(/\\/g, '\\\\')}';`);
      const cyclicResult = inlineScriptPartials(cyclicHost, { hostFilename: 'Host.rozie' });
      expect(cyclicResult.diagnostics.map((d) => d.code)).toContain(CYCLE_DIAGNOSTIC_CODE);
    } finally {
      a.dispose();
      cyclic.dispose();
    }
  });

  // R6 — collision diagnostic. A partial declaration whose name collides with a
  // host binding pushes PARTIAL_INLINE_COLLISION (ROZ139) with a code-frame
  // citing BOTH sites (host + partial).
  it('R6: a partial-vs-host name collision pushes ROZ139 with a frame citing both sites', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const { RozieErrorCode } = await import('../../diagnostics/codes.js');
    const COLLISION_CODE = RozieErrorCode.PARTIAL_INLINE_COLLISION;
    const partial = stagePartial(
      'logic.rzts',
      `export const value = $computed(() => $props.value);`, // collides with host `value`
    );
    try {
      const host = moduleFile(
        [
          `const value = 1;`, // host already binds `value`
          `import { value } from '${partial.path.replace(/\\/g, '\\\\')}';`,
        ].join('\n'),
      );
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const collision = result.diagnostics.find((d) => d.code === COLLISION_CODE);
      expect(collision).toBeDefined();
      expect(collision?.severity).toBe('error');
      // Frame must cite BOTH sites: the diagnostic loc/filename points at the
      // partial declaration; the `related` entry points at the host binding.
      expect(collision?.filename ?? '').toContain('logic.rzts');
      expect(collision?.related?.length ?? 0).toBeGreaterThan(0);
      // The colliding declaration is dropped — the host body never has two
      // top-level `value` declarations (no structurally-invalid emit).
      const valueDecls = bodyOf(result.ast ?? host).filter(
        (s) =>
          s.type === 'VariableDeclaration' &&
          s.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === 'value'),
      );
      expect(valueDecls.length).toBe(1);
    } finally {
      partial.dispose();
    }
  });

  // R7 — source-map / diagnostic fidelity. An inlined statement's Babel
  // loc.filename / start resolves to the PARTIAL's `.rzts` absolute path, not
  // the host `.rozie` — so error frames + source maps cite the partial origin.
  it('R7: an inlined statement carries the partial .rzts origin in its loc, not the host .rozie', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'logic.rzts',
      `export const usedName = $computed(() => $props.value + 1);`,
    );
    try {
      const host = moduleFile(`import { usedName } from '${partial.path.replace(/\\/g, '\\\\')}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const inlined = bodyOf(result.ast ?? host).find(
        (s) =>
          s.type === 'VariableDeclaration' &&
          s.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === 'usedName'),
      );
      expect(inlined?.loc?.filename).toContain('logic.rzts');
    } finally {
      partial.dispose();
    }
  });

  // R7-line — POST-SEAM expectation (Phase 55, script-partial literal
  // byte-identity). A spliced statement's emit line (loc.start.line) is rewritten
  // to a HOST-contiguous value so @babel/generator's comment/blank-line math is
  // continuous at the host↔partial boundary, while the true `.rzts` ORIGIN
  // (file + line) is stashed on a parallel channel (extra.__roziePartialOrigin)
  // and loc.filename (R7 file origin) is preserved — so source-map line fidelity
  // remains recoverable (D-01: file+line). SKIPPED in Plan 01: un-skip in Plan 02
  // after normalizeSplicedEmitLines lands. extra.__roziePartialOrigin does not
  // exist yet, so this would fail today.
  it('R7-line: a spliced statement carries its .rzts origin LINE on extra.__roziePartialOrigin while loc.start.line is host-contiguous', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    // `usedName` sits on partial-local line 2 (a leading helper occupies line 1).
    const ORIGIN_LINE = 2;
    const partial = stagePartial(
      'logic.rzts',
      [
        `const helper = (n) => n + 1;`,
        `export const usedName = $computed(() => helper($props.value));`,
      ].join('\n'),
    );
    try {
      // Pad the host so its contiguous insertion line cannot coincidentally equal
      // the partial-local ORIGIN_LINE (the !== assertion must be meaningful).
      const host = moduleFile(
        [
          `const padA = 1;`,
          `const padB = 2;`,
          `const padC = 3;`,
          `import { usedName } from '${partial.path.replace(/\\/g, '\\\\')}';`,
        ].join('\n'),
      );
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const inlined = bodyOf(result.ast ?? host).find(
        (s) =>
          s.type === 'VariableDeclaration' &&
          s.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === 'usedName'),
      );
      const origin = (
        inlined?.extra as
          | { __roziePartialOrigin?: { line?: number; filename?: string } }
          | undefined
      )?.__roziePartialOrigin;
      // (1) the .rzts ORIGIN LINE is stashed on the parallel channel.
      expect(origin?.line).toBe(ORIGIN_LINE);
      // (2) the .rzts ORIGIN FILE is stashed too.
      expect(origin?.filename ?? '').toContain('logic.rzts');
      // (3) R7 file origin is preserved on loc.filename (the existing gate).
      expect(inlined?.loc?.filename).toContain('logic.rzts');
      // (4) the EMIT line was normalized to a host-contiguous value — proving the
      // decoupling (it is NOT the partial-local origin line anymore).
      expect(inlined?.loc?.start.line).not.toBe(ORIGIN_LINE);
    } finally {
      partial.dispose();
    }
  });

  // Clone-survival (Phase 55, Pitfall 4) — each per-target emitter deep-clones the
  // program (`t.cloneNode(node, /*deep*/ true)`) before serialization. The
  // host-contiguous `loc`, the attached comments, AND the stashed
  // `extra.__roziePartialOrigin` (Plan 03's map-line-restore anchor) must all
  // survive that clone; a shallow clone that strips `extra` would lose the
  // origin. Assert on a spliced node carrying a comment.
  it('clone-survival: t.cloneNode(spliced, true) preserves loc, attached comments, and extra.__roziePartialOrigin', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    // `helper` is a NON-exported closure decl on partial-local line 1 carrying a
    // trailing comment ON THE BARE declaration (so it survives the export-unwrap
    // independent of comment-transfer) — the spliced node we clone.
    const partial = stagePartial(
      'logic.rzts',
      [
        `const helper = (n) => n + 1; // helper-trailing-marker`,
        `export const usedName = $computed(() => helper($props.value));`,
      ].join('\n'),
    );
    try {
      const host = moduleFile(
        [`const padA = 1;`, `import { usedName } from '${partial.path.replace(/\\/g, '\\\\')}';`].join('\n'),
      );
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const helperDecl = bodyOf(result.ast ?? host).find(
        (s) =>
          s.type === 'VariableDeclaration' &&
          s.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === 'helper'),
      );
      expect(helperDecl).toBeDefined();
      const cloned = t.cloneNode(helperDecl as Statement, /*deep*/ true);
      // (1) loc (filename + the rewritten host-contiguous line) survives the deep clone.
      expect(cloned.loc?.filename).toContain('logic.rzts');
      expect(cloned.loc?.start.line).toBe(helperDecl?.loc?.start.line);
      // (2) extra.__roziePartialOrigin (the .rzts origin LINE) survives the clone.
      const origin = (
        cloned.extra as { __roziePartialOrigin?: { line?: number; filename?: string } } | undefined
      )?.__roziePartialOrigin;
      expect(origin?.line).toBe(1);
      expect(origin?.filename ?? '').toContain('logic.rzts');
      // (3) the attached trailing comment survives the deep clone.
      expect(
        (cloned.trailingComments ?? []).some((c) => c.value.includes('helper-trailing-marker')),
      ).toBe(true);
    } finally {
      partial.dispose();
    }
  });

  // CR-01 — an exported `enum` (a RUNTIME TypeScript value) is recognized by
  // bindingNames() and inlined, not silently dropped.
  it('CR-01: inlines an exported enum from a partial (TSEnumDeclaration recognized)', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'status.rzts',
      `export enum Status { Idle, Busy }`,
    );
    try {
      const host = moduleFile(`import { Status } from '${partial.path.replace(/\\/g, '\\\\')}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const hasEnum = bodyOf(result.ast ?? host).some(
        (s) => s.type === 'TSEnumDeclaration' && s.id.name === 'Status',
      );
      expect(hasEnum).toBe(true);
    } finally {
      partial.dispose();
    }
  });

  // WR-01 — two distinct host import statements naming DIFFERENT symbols from
  // the SAME partial must BOTH inline (the union is spliced once; neither name
  // is silently dropped by the diamond `visited` guard).
  it('WR-01: two host imports of the same partial with different names both inline', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'expand.rzts',
      [
        `export const toggleRowExpanded = $computed(() => 1);`,
        `export const collapseAll = $computed(() => 2);`,
      ].join('\n'),
    );
    try {
      const esc = partial.path.replace(/\\/g, '\\\\');
      const host = moduleFile(
        [
          `import { toggleRowExpanded } from '${esc}';`,
          `import { collapseAll } from '${esc}';`,
        ].join('\n'),
      );
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const names = bodyOf(result.ast ?? host)
        .filter((s): s is t.VariableDeclaration => s.type === 'VariableDeclaration')
        .flatMap((s) => s.declarations.map((d) => (d.id as t.Identifier).name));
      expect(names).toContain('toggleRowExpanded');
      expect(names).toContain('collapseAll');
      // No leftover partial import statement remains.
      const stillImported = bodyOf(result.ast ?? host).some(
        (s) => s.type === 'ImportDeclaration' && /\.rz(ts|js)$/.test(s.source.value),
      );
      expect(stillImported).toBe(false);
    } finally {
      partial.dispose();
    }
  });

  // WR-02 — a default or namespace import of a partial has no inlinable surface
  // and must produce an explicit ROZ141 diagnostic (never a silent drop, and
  // never a throw — D-08).
  it('WR-02: a default/namespace import of a partial produces a ROZ141 diagnostic', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const { RozieErrorCode } = await import('../../diagnostics/codes.js');
    const partial = stagePartial(
      'logic.rzts',
      `export const usedName = $computed(() => 1);`,
    );
    try {
      const esc = partial.path.replace(/\\/g, '\\\\');
      // Default import form.
      const defaultHost = moduleFile(`import Logic from '${esc}';`);
      const defaultResult = inlineScriptPartials(defaultHost, { hostFilename: 'Host.rozie' });
      expect(defaultResult.diagnostics.map((d) => d.code)).toContain(
        RozieErrorCode.PARTIAL_UNSUPPORTED_IMPORT_FORM,
      );
      // Namespace import form.
      const nsHost = moduleFile(`import * as logic from '${esc}';`);
      const nsResult = inlineScriptPartials(nsHost, { hostFilename: 'Host.rozie' });
      const nsDiag = nsResult.diagnostics.find(
        (d) => d.code === RozieErrorCode.PARTIAL_UNSUPPORTED_IMPORT_FORM,
      );
      expect(nsDiag).toBeDefined();
      expect(nsDiag?.severity).toBe('error');
    } finally {
      partial.dispose();
    }
  });

  // IN-01 — a re-export-from form (`export { X } from 'pkg'` /
  // `export { Bar as Baz } from 'pkg'`) is NOT a local declaration: it maps an
  // exported name to a SOURCE module. It must be hoisted into the host as an
  // import so a host `import { X }` resolves (alias preserved), never silently
  // dropped (which left the host reference dangling with no ROZ explanation).
  it('IN-01: re-export-from is hoisted into the host as an import (alias preserved)', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      're-export.rzts',
      [
        `export { ExpandedState } from '@tanstack/table-core';`,
        `export { Bar as Baz } from '@pkg';`,
        `export const usedLocal = $computed(() => 1);`,
        `export { Unused } from '@noise';`, // tree-shaken: host never imports it
      ].join('\n'),
    );
    try {
      const esc = partial.path.replace(/\\/g, '\\\\');
      const host = moduleFile(`import { ExpandedState, Baz, usedLocal } from '${esc}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const imports = bodyOf(result.ast ?? host).filter(
        (s): s is t.ImportDeclaration => s.type === 'ImportDeclaration',
      );
      // The partial import statement is gone.
      expect(imports.some((i) => /\.rz(ts|js)$/.test(i.source.value))).toBe(false);
      // `ExpandedState` hoisted from @tanstack/table-core as a host binding.
      const tanstack = imports.find((i) => i.source.value === '@tanstack/table-core');
      expect(tanstack).toBeDefined();
      expect(
        tanstack?.specifiers.map((sp) => (sp.local as t.Identifier).name),
      ).toContain('ExpandedState');
      // `Baz` aliased: `import { Bar as Baz } from '@pkg'` — local Baz, imported Bar.
      const pkg = imports.find((i) => i.source.value === '@pkg');
      expect(pkg).toBeDefined();
      const bazSpec = pkg?.specifiers.find(
        (sp): sp is t.ImportSpecifier =>
          sp.type === 'ImportSpecifier' && (sp.local as t.Identifier).name === 'Baz',
      );
      expect(bazSpec).toBeDefined();
      expect((bazSpec?.imported as t.Identifier).name).toBe('Bar');
      // The locally-declared export still inlines normally.
      const names = bodyOf(result.ast ?? host)
        .filter((s): s is t.VariableDeclaration => s.type === 'VariableDeclaration')
        .flatMap((s) => s.declarations.map((d) => (d.id as t.Identifier).name));
      expect(names).toContain('usedLocal');
      // The un-imported re-export is tree-shaken — no @noise import is hoisted.
      expect(imports.some((i) => i.source.value === '@noise')).toBe(false);
    } finally {
      partial.dispose();
    }
  });

  // IN-01 — a bare `export * from 'pkg'` star re-export has no statically-known
  // named surface to inline; it produces an explicit ROZ141 diagnostic (never a
  // silent drop, never a throw — D-08).
  it('IN-01: a star re-export (export * from) produces a ROZ141 diagnostic', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const { RozieErrorCode } = await import('../../diagnostics/codes.js');
    const partial = stagePartial(
      'star.rzts',
      [`export * from '@pkg';`, `export const keep = $computed(() => 1);`].join('\n'),
    );
    try {
      const esc = partial.path.replace(/\\/g, '\\\\');
      const host = moduleFile(`import { keep } from '${esc}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      const diag = result.diagnostics.find(
        (d) => d.code === RozieErrorCode.PARTIAL_UNSUPPORTED_IMPORT_FORM,
      );
      expect(diag).toBeDefined();
      expect(diag?.severity).toBe('error');
      // The legitimately-imported local export still inlines.
      const names = bodyOf(result.ast ?? host)
        .filter((s): s is t.VariableDeclaration => s.type === 'VariableDeclaration')
        .flatMap((s) => s.declarations.map((d) => (d.id as t.Identifier).name));
      expect(names).toContain('keep');
    } finally {
      partial.dispose();
    }
  });

  // IN-02 — a type-only import used SOLELY in TS type-annotation positions
  // (`param: MyType`) is NOT a Babel `ReferencedIdentifier`, so before the fix
  // its `import type` was not hoisted and the consumer's `tsc` errored on the
  // dangling type reference. The extended reference collection captures type
  // positions, so the `import type` IS hoisted into the host.
  it('IN-02: hoists a type-only import used only in annotations', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'typed.rzts',
      [
        `import type { MyType } from 'pkg';`,
        `const toLabel = (x: MyType): string => x.label;`,
        `export { toLabel };`,
      ].join('\n'),
    );
    try {
      const esc = partial.path.replace(/\\/g, '\\\\');
      const host = moduleFile(`import { toLabel } from '${esc}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const imports = bodyOf(result.ast ?? host).filter(
        (s): s is t.ImportDeclaration => s.type === 'ImportDeclaration',
      );
      const pkgImport = imports.find((i) => i.source.value === 'pkg');
      expect(pkgImport).toBeDefined();
      // The hoisted import is type-only (declaration-level OR per-specifier).
      const isTypeOnly =
        pkgImport?.importKind === 'type' ||
        (pkgImport?.specifiers ?? []).some(
          (sp) => sp.type === 'ImportSpecifier' && sp.importKind === 'type',
        );
      expect(isTypeOnly).toBe(true);
      expect(
        pkgImport?.specifiers.map((sp) => (sp.local as t.Identifier).name),
      ).toContain('MyType');
      // The annotated helper still inlines.
      const names = bodyOf(result.ast ?? host)
        .filter((s): s is t.VariableDeclaration => s.type === 'VariableDeclaration')
        .flatMap((s) => s.declarations.map((d) => (d.id as t.Identifier).name));
      expect(names).toContain('toLabel');
    } finally {
      partial.dispose();
    }
  });

  // IN-02 — a type-only HELPER declaration referenced only in a type position
  // (`type Alias = Helper`) is pulled into the inline closure by the extended
  // reference collection, not tree-shaken away.
  it('IN-02: pulls a type-only helper decl referenced only in a type position into the closure', async () => {
    const { inlineScriptPartials } = await import('../inlineScriptPartials.js');
    const partial = stagePartial(
      'typedecls.rzts',
      [
        `interface Helper { id: number }`,
        `type Row = Helper;`,
        `export type { Row };`,
      ].join('\n'),
    );
    try {
      const esc = partial.path.replace(/\\/g, '\\\\');
      const host = moduleFile(`import { Row } from '${esc}';`);
      const result = inlineScriptPartials(host, { hostFilename: 'Host.rozie' });
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const text = JSON.stringify(bodyOf(result.ast ?? host));
      expect(text).toContain('Row'); // the alias inlines
      expect(text).toContain('Helper'); // its type-position dependency is pulled in
    } finally {
      partial.dispose();
    }
  });
});

describe('inlineScriptPartials — negative routing', () => {
  // A `.rzts`/`.rzjs` import is a COMPILE-TIME inline, NOT a module — it must
  // NOT produce an `@rozie/unplugin` virtual id. (Contrast `.rozie`, which IS
  // replaced with a compiled module + virtual id.)
  //
  // Plan 04 wired exactly this predicate into the unplugin entrypoint: every
  // `createResolveIdHook` branch (Vue/React/Svelte/Solid/Lit/Angular) and
  // `transformIncludeRozie` now early-return `null`/`false` when
  // `isPartialExtension(id)` is true (transform.ts), so a partial id never
  // becomes a synthetic `.rozie.{vue,tsx,svelte,ts}` virtual id. Asserting the
  // shared predicate here is the entrypoint-agnostic contract; the byte-identity
  // proof that a partial emits no virtual module is the dist-parity Leg-3 gate
  // (partial-inline-parity.test.ts, blessed in Plan 05). A direct import of the
  // unplugin hooks from this core unit test is deliberately avoided — core does
  // not depend on @rozie/unplugin and inverting that edge would flood turbo with
  // phantom build-order errors.
  it('a .rzts import yields NO unplugin virtual id', async () => {
    const { isPartialExtension } = await import('../inlineScriptPartials.js');
    // The routing predicate the unplugin resolveId path consults: a partial
    // extension is handled inline (no virtual id emitted), never as a module.
    expect(isPartialExtension('./logic.rzts')).toBe(true);
    expect(isPartialExtension('./logic.rzjs')).toBe(true);
    expect(isPartialExtension('./component.rozie')).toBe(false);
    expect(isPartialExtension('./plain.ts')).toBe(false);
    expect(isPartialExtension('./plain.js')).toBe(false);
  });

  // A `.rzts`/`.rzjs` import must NOT produce a `babel-plugin-rozie` sibling
  // file (the `.rozie` path writes a compiled sibling; the partial path does
  // not — it is consumed by the host's compile, never emitted standalone).
  //
  // Plan 04 left babel-plugin/src/index.ts's ImportDeclaration guard
  // INTENTIONALLY `.rozie`-only (`if (!src.endsWith('.rozie')) return;`), so a
  // partial import falls through and never reaches compileImport →
  // writeSiblingIfStale. The same shared predicate gates both entrypoints; the
  // no-sibling byte proof on the babel path is the dist-parity Leg-3 gate
  // (Plan 05). See babel-plugin/src/index.ts for the explanatory comment.
  it('a .rzts import produces NO babel sibling artifact', async () => {
    const { isPartialExtension } = await import('../inlineScriptPartials.js');
    // The babel-plugin import-interception consults the same predicate to skip
    // sibling emission for partials.
    expect(isPartialExtension('./logic.rzts')).toBe(true);
    expect(isPartialExtension('./logic.rzjs')).toBe(true);
    // A real `.rozie` import DOES emit a sibling — the partial exts must be the
    // only ones excluded from that path.
    expect(isPartialExtension('./Widget.rozie')).toBe(false);
  });
});
