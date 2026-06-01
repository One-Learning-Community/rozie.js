// Phase 21 Plan 21-01 Task 2 — $expose methods-only validator (ROZ115–ROZ120).
//
// Proves: the 6 malformed forms each emit their distinct code with a renderable
// code-frame; clean shorthand / explicit / inline-arrow forms validate silently;
// $expose({ someComputed }) → ROZ118; <data expose> → ROZ202 (reserved-sigil
// lockstep); every diagnostic is severity 'error'; compile() never throws (D-08).
import { readFileSync, readdirSync, type Dirent } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { renderDiagnostic } from '../../../diagnostics/frame.js';
import { RESERVED_SIGILS } from '../reservedIdentifierValidator.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function diagnose(source: string, filename = 'ExposeProbe.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return analyzeAST(ast).diagnostics;
}

function byCode(diags: Diagnostic[], code: string) {
  return diags.filter((d) => d.code === code);
}

const wrap = (script: string, data = `{ value: '' }`) => `<rozie name="ExposeProbe">
<data>${data}</data>
<script>
${script}
</script>
<template><input ref="field" /></template>
</rozie>`;

describe('$expose validator — reserved-sigil lockstep', () => {
  it("'$expose' is registered in RESERVED_SIGILS", () => {
    expect(RESERVED_SIGILS.has('$expose')).toBe(true);
  });

  it('a <data> field named `$expose` triggers ROZ202 (sigil collision)', () => {
    // The sigil itself ($-prefixed) as a data key.
    const src = `<rozie name="P">
<data>{ "$expose": '' }</data>
<template><div /></template>
</rozie>`;
    const diags = diagnose(src);
    expect(byCode(diags, 'ROZ202').length).toBeGreaterThanOrEqual(1);
  });
});

describe('$expose validator — the 6 malformed forms (ROZ115–ROZ120)', () => {
  it('ROZ115 — $expose(x) non-object argument (exactly one, with code-frame)', () => {
    const src = wrap(`const x = 1\n$expose(x)`);
    const diags = diagnose(src);
    const hits = byCode(diags, 'ROZ115');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    const frame = renderDiagnostic(hits[0]!, src);
    expect(frame).toContain('ROZ115');
  });

  it('ROZ116 — $expose({ ...o }) spread (exactly one)', () => {
    const src = wrap(`const o = {}\n$expose({ ...o })`);
    const hits = byCode(diagnose(src), 'ROZ116');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ117 — $expose({ [k]: v }) computed key (exactly one)', () => {
    const src = wrap(`const k = 'reset'\nfunction reset() {}\n$expose({ [k]: reset })`);
    const hits = byCode(diagnose(src), 'ROZ117');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ118 — $expose({ a: 1 }) literal value', () => {
    const hits = byCode(diagnose(wrap(`$expose({ a: 1 })`)), 'ROZ118');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ118 — $expose({ a: notInScope }) identifier not resolving to a function', () => {
    const hits = byCode(diagnose(wrap(`$expose({ a: notInScope })`)), 'ROZ118');
    expect(hits.length).toBe(1);
  });

  it('ROZ118 — $expose({ someComputed }) a $computed-bound value (reactive, not a function)', () => {
    const src = wrap(`const someComputed = $computed(() => $data.value)\n$expose({ someComputed })`);
    const hits = byCode(diagnose(src), 'ROZ118');
    expect(hits.length).toBe(1);
  });

  it('ROZ119 — two top-level $expose(...) calls (one ROZ119 on the second)', () => {
    const src = wrap(`function reset() {}\nfunction focus() {}\n$expose({ reset })\n$expose({ focus })`);
    const hits = byCode(diagnose(src), 'ROZ119');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ120 — $expose(...) nested inside a function (one ROZ120)', () => {
    const src = wrap(`function reset() {}\nfunction setup() { $expose({ reset }) }`);
    const hits = byCode(diagnose(src), 'ROZ120');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });
});

describe('$expose validator — ROZ121 name collision (Quick 260601-jsy)', () => {
  // wrap() builds <data> + <input ref="field" />; for collision cases we inject
  // $emit('open') / $emit('close') calls into the exposed functions so the
  // collector populates bindings.emits.

  // A <props> block needs to be threaded for prop-collision cases — the default
  // wrap() has no <props>, so use a dedicated builder there.
  const wrapWithProps = (
    script: string,
    props: string,
    data = `{ value: '' }`,
  ) => `<rozie name="ExposeProbe">
<props>${props}</props>
<data>${data}</data>
<script>
${script}
</script>
<template><input ref="field" /></template>
</rozie>`;

  it('event collision: $expose({ open }) + $emit("open") → exactly one ROZ121, error, code-framed at the property', () => {
    const src = wrap(
      `function open() { $emit('open'); }\n$expose({ open })`,
    );
    const hits = byCode(diagnose(src), 'ROZ121');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    const frame = renderDiagnostic(hits[0]!, src);
    expect(frame).toContain('ROZ121');
    // Code-frame points at the `open` property inside the $expose object, not the
    // function declaration — assert the frame surfaces the $expose call line.
    expect(frame).toContain('$expose({ open })');
  });

  it('no collision: exposed name ≠ any emitted event → zero ROZ121', () => {
    const src = wrap(
      `function openPicker() { $emit('open'); }\n$expose({ openPicker })`,
    );
    expect(byCode(diagnose(src), 'ROZ121')).toEqual([]);
  });

  it('suppression: malformed $expose ({ ...o }) with a would-be collision → only ROZ116, ZERO ROZ121', () => {
    // `o` has an `open` key, and the component emits `open` — but the spread
    // makes the call structurally malformed, so the collision check is suppressed.
    const src = wrap(
      `const o = { open: () => $emit('open') }\n$expose({ ...o })`,
    );
    const diags = diagnose(src);
    expect(byCode(diags, 'ROZ116').length).toBe(1);
    expect(byCode(diags, 'ROZ121')).toEqual([]);
  });

  it('suppression: non-object arg with a would-be collision → only ROZ115, ZERO ROZ121', () => {
    const src = wrap(
      `function open() { $emit('open'); }\nconst handle = { open }\n$expose(handle)`,
    );
    const diags = diagnose(src);
    expect(byCode(diags, 'ROZ115').length).toBe(1);
    expect(byCode(diags, 'ROZ121')).toEqual([]);
  });

  it('case-sensitivity: exposed `Open`, emitted `open` → zero ROZ121', () => {
    const src = wrap(
      `function Open() { $emit('open'); }\n$expose({ Open })`,
    );
    expect(byCode(diagnose(src), 'ROZ121')).toEqual([]);
  });

  it('multiple collisions: expose open AND close, emit both → exactly one ROZ121 per collision (length 2)', () => {
    const src = wrap(
      `function open() { $emit('open'); }\nfunction close() { $emit('close'); }\n$expose({ open, close })`,
    );
    const hits = byCode(diagnose(src), 'ROZ121');
    expect(hits.length).toBe(2);
    for (const h of hits) expect(h.severity).toBe('error');
  });

  it('prop collision (non-model): $expose({ date }) + non-model prop `date` → one ROZ121 naming "the \'date\' prop"', () => {
    const src = wrapWithProps(
      `function date() { $refs.field.focus(); }\n$expose({ date })`,
      `{ date: { type: String } }`,
    );
    const hits = byCode(diagnose(src), 'ROZ121');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain("the 'date' prop");
  });

  it('prop collision (model): $expose({ date }) + model:true prop `date` → one ROZ121 naming "the \'date\' prop"', () => {
    const src = wrapWithProps(
      `function date() { $refs.field.focus(); }\n$expose({ date })`,
      `{ date: { type: String, model: true } }`,
    );
    const hits = byCode(diagnose(src), 'ROZ121');
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain("the 'date' prop");
  });

  it('event surface takes message precedence when both event + prop collide', () => {
    const src = wrapWithProps(
      `function date() { $emit('date'); }\n$expose({ date })`,
      `{ date: { type: String } }`,
    );
    const hits = byCode(diagnose(src), 'ROZ121');
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain("the 'date' event");
  });

  it('compile() never throws on a collision (D-08) and surfaces an error', () => {
    const src = wrap(`function open() { $emit('open'); }\n$expose({ open })`);
    expect(() => compile(src, { target: 'angular' })).not.toThrow();
    const result = compile(src, { target: 'angular' });
    expect(result.diagnostics.some((d) => d.code === 'ROZ121')).toBe(true);
  });

  it('compile() never throws on an EMPTY-STRING collision (D-08): $emit("") + $expose({ "": fn })', () => {
    // Pathological but parseable: a string-literal empty key colliding with an
    // empty-string event name. The hint's capitalized-rename suggestion must not
    // index into name[0] of an empty string (orchestrator-caught regression).
    const src = wrap(
      `function doNothing() {}\nfunction fire() { $emit('', 1); }\n$expose({ '': doNothing })`,
    );
    expect(() => compile(src, { target: 'angular' })).not.toThrow();
    const result = compile(src, { target: 'angular' });
    const hits = result.diagnostics.filter((d) => d.code === 'ROZ121');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.hint).toContain('non-empty');
  });
});

describe('$expose validator — clean forms validate silently', () => {
  it('shorthand { clear, open } → zero ROZ115-120', () => {
    const src = wrap(`function clear() {}\nfunction open() {}\n$expose({ clear, open })`);
    const diags = diagnose(src);
    for (const code of ['ROZ115', 'ROZ116', 'ROZ117', 'ROZ118', 'ROZ119', 'ROZ120']) {
      expect(byCode(diags, code), code).toEqual([]);
    }
  });

  it('explicit { clear: clear } → zero diagnostics', () => {
    const src = wrap(`function clear() {}\n$expose({ clear: clear })`);
    const diags = diagnose(src);
    for (const code of ['ROZ115', 'ROZ116', 'ROZ117', 'ROZ118', 'ROZ119', 'ROZ120']) {
      expect(byCode(diags, code), code).toEqual([]);
    }
  });

  it('inline arrow getter { getValue: () => $data.value } → zero diagnostics', () => {
    const src = wrap(`$expose({ getValue: () => $data.value })`);
    const diags = diagnose(src);
    for (const code of ['ROZ115', 'ROZ116', 'ROZ117', 'ROZ118', 'ROZ119', 'ROZ120']) {
      expect(byCode(diags, code), code).toEqual([]);
    }
  });

  it('arrow-const reference { reset } where reset = () => ... → zero diagnostics', () => {
    const src = wrap(`const reset = () => { $data.value = '' }\n$expose({ reset })`);
    const diags = diagnose(src);
    expect(byCode(diags, 'ROZ118')).toEqual([]);
  });
});

describe('$expose validator — compile() never throws (D-08)', () => {
  const malformed = [
    `const x = 1\n$expose(x)`,
    `const o = {}\n$expose({ ...o })`,
    `const k = 'a'\nfunction reset() {}\n$expose({ [k]: reset })`,
    `$expose({ a: 1 })`,
    `function reset() {}\n$expose({ reset })\n$expose({ reset })`,
    `function reset() {}\nfunction setup() { $expose({ reset }) }`,
  ];

  for (const target of ['react', 'vue'] as const) {
    for (const [i, script] of malformed.entries()) {
      it(`malformed form #${i + 1} compiles to ${target} without throwing`, () => {
        const src = wrap(script);
        expect(() => compile(src, { target })).not.toThrow();
        const result = compile(src, { target });
        // Each malformed form yields at least one error diagnostic.
        expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
      });
    }
  }
});

describe('$expose ROZ121 — compile-level + repo-wide sweep (Quick 260601-jsy)', () => {
  // This test file lives at
  //   packages/core/src/semantic/validators/__tests__/exposeValidator.test.ts
  // → six `..` segments reach the repo root.
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../../../',
  );

  /** Recursively collect every `.rozie` file under `dir`, skipping node_modules / dist. */
  function collectRozieFiles(dir: string): string[] {
    const out: string[] = [];
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      return out; // dir doesn't exist — skip.
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        out.push(...collectRozieFiles(full));
      } else if (ent.isFile() && ent.name.endsWith('.rozie')) {
        out.push(full);
      }
    }
    return out;
  }

  function roz121Hits(filePath: string): Diagnostic[] {
    const source = readFileSync(filePath, 'utf8');
    // Compile to a single target — ROZ121 is a SEMANTIC diagnostic emitted in
    // analyzeAST (target-independent), so one target suffices.
    const { diagnostics } = compile(source, {
      target: 'angular',
      filename: filePath,
    });
    return diagnostics.filter((d) => d.code === 'ROZ121');
  }

  it('examples/ExposeProbe.rozie compiles with ZERO ROZ121 (and zero error diagnostics)', () => {
    const file = path.join(repoRoot, 'examples/ExposeProbe.rozie');
    const source = readFileSync(file, 'utf8');
    const { diagnostics } = compile(source, {
      target: 'angular',
      filename: file,
    });
    expect(diagnostics.filter((d) => d.code === 'ROZ121')).toEqual([]);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('packages/ui/flatpickr/src/Flatpickr.rozie compiles with ZERO ROZ121 (and zero error diagnostics)', () => {
    const file = path.join(
      repoRoot,
      'packages/ui/flatpickr/src/Flatpickr.rozie',
    );
    const source = readFileSync(file, 'utf8');
    const { diagnostics } = compile(source, {
      target: 'angular',
      filename: file,
    });
    expect(diagnostics.filter((d) => d.code === 'ROZ121')).toEqual([]);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('SWEEP: no committed .rozie example/fixture trips ROZ121', () => {
    const roots = ['examples', 'packages/ui', 'tests']
      .map((r) => path.join(repoRoot, r))
      .flatMap((r) => collectRozieFiles(r));

    expect(roots.length).toBeGreaterThan(0); // sanity: we actually found files.

    const offenders: string[] = [];
    for (const file of roots) {
      if (roz121Hits(file).length > 0) {
        offenders.push(path.relative(repoRoot, file));
      }
    }
    // A non-empty offenders list is a STOP-and-report finding (a real latent
    // collision in a shipped example) — surfaced via the assertion message.
    expect(offenders, `latent ROZ121 collisions in: ${offenders.join(', ')}`).toEqual([]);
    // 30s deadline: this sweep end-to-end-compiles every committed .rozie file
    // (dozens of them) in one synchronous test. The default 5s timeout is a
    // failsafe, not an assertion of compile speed; under `turbo run test`
    // parallel CPU starvation the sweep races past 5s and flakes (observed
    // 2026-06-01: timed out at 5664ms in a full battery). Raised to 30s — same
    // load-tolerant philosophy as commit 112352c5 (cli-smoke deadlines) and the
    // rozie-timing-tests testTimeout. Does NOT weaken the check: the offenders
    // assertion still genuinely fails on any real latent ROZ121 collision.
  }, 30_000);
});
