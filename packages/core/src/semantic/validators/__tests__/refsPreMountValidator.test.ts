// Quick 260602-dv1 — ROZ123 $refs-read-before-mount validator.
//
// Proves: a `$refs.<x>` read in a PRE-MOUNT evaluation position fires exactly
// one ROZ123 (error) — inside a `$computed(...)` body, the `$watch` GETTER, a
// `<template>` binding / `{{ }}` interpolation / `r-if` / `r-show` / `r-for`
// iterable. Proves the DO-NOT-FLAG list produces ZERO ROZ123 — `$onMount` /
// `$onUnmount` / `$onUpdate` bodies, the `$watch` CALLBACK, `@event` handlers,
// `<listeners>` handlers, `r-model` targets, plain function bodies, top-level
// `<script>` reads, and a nested lifecycle inside a `$computed`. Proves
// malformed shapes never crash and never false-positive, and that compile()
// surfaces ROZ123 on solid + lit without throwing. Closes with a repo-wide
// sweep asserting ZERO ROZ123 across every committed .rozie under examples/ +
// packages/ui/ + tests/.
//
// $watch-GETTER VERDICT (encoded by the getter tests below): EAGER → FLAGGED.
// Empirically confirmed via compile(..., { target: 'solid' }) — the getter
// lowers into `createEffect(on(() => getter(), …))` whose deps-fn runs at setup
// BEFORE the `let elRef = null` ref binding is assigned (the eager-read hazard,
// and a literal read-before-declaration of the ref). The CALLBACK is deferred.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, type Dirent } from 'node:fs';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { renderDiagnostic } from '../../../diagnostics/frame.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function diagnose(source: string, filename = 'RefsProbe.rozie'): Diagnostic[] {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return analyzeAST(ast).diagnostics;
}

function byCode(diags: Diagnostic[], code: string): Diagnostic[] {
  return diags.filter((d) => d.code === code);
}

/** A self-contained probe with a script + (optional) custom template. The
 *  default template carries `ref="el"` so $refs.el is a declared ref (keeps
 *  unknownRefValidator quiet — it is irrelevant to the ROZ123 assertions, which
 *  all filter byCode). */
const wrap = (
  script: string,
  template = `<input ref="el" />`,
) => `<rozie name="RefsProbe">
<data>{ v: '' }</data>
<script>
${script}
</script>
<template>${template}</template>
</rozie>`;

/** Template-only probe: no <script>; the ref is declared inline in the template. */
const wrapTemplate = (template: string) => `<rozie name="RefsProbe">
<data>{ v: '' }</data>
<template>${template}</template>
</rozie>`;

/** Probe with a <listeners> block whose handler reads $refs. */
const wrapWithListeners = (listeners: string) => `<rozie name="RefsProbe">
<data>{ v: '' }</data>
<template><input ref="x" /></template>
<listeners>${listeners}</listeners>
</rozie>`;

// ── POSITIVE — flagged contexts ─────────────────────────────────────────────

describe('refsPreMountValidator — POSITIVE flagged positions (ROZ123)', () => {
  it('$computed body — the falsified FlatpickrBehaviorDemo shape → one ROZ123 naming rangeEnd', () => {
    const src = wrap(
      `const plugin = () => ({});\nconst r = $computed(() => [plugin({ input: $refs.rangeEnd })])`,
      `<input ref="rangeEnd" />`,
    );
    const hits = byCode(diagnose(src), 'ROZ123');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    const frame = renderDiagnostic(hits[0]!, src);
    expect(frame).toContain('ROZ123');
    expect(frame).toContain('rangeEnd');
  });

  it('template binding :data-w="$refs.el.offsetWidth" → ROZ123', () => {
    const src = wrapTemplate(`<input ref="el" :data-w="$refs.el.offsetWidth" />`);
    expect(byCode(diagnose(src), 'ROZ123').length).toBe(1);
  });

  it('interpolation {{ $refs.el.offsetWidth }} → ROZ123', () => {
    const src = wrapTemplate(`<input ref="el" /><span>{{ $refs.el.offsetWidth }}</span>`);
    expect(byCode(diagnose(src), 'ROZ123').length).toBe(1);
  });

  it('r-if="$refs.el" → ROZ123', () => {
    const src = wrapTemplate(`<input ref="el" /><div r-if="$refs.el">x</div>`);
    expect(byCode(diagnose(src), 'ROZ123').length).toBe(1);
  });

  it('r-show="$refs.el" → ROZ123', () => {
    const src = wrapTemplate(`<input ref="el" /><div r-show="$refs.el">x</div>`);
    expect(byCode(diagnose(src), 'ROZ123').length).toBe(1);
  });

  it('r-for iterable "item in $refs.el.children" → ROZ123 (iterable RHS is render-time)', () => {
    // DECISION (Task 1): the r-for iterable IS flagged. The LHS alias `item` is
    // not a JS expression and is not parsed; the RHS `$refs.el.children` is
    // re-parsed at its computed byte offset and the $refs read is flagged.
    const src = wrapTemplate(
      `<input ref="el" /><div r-for="item in $refs.el.children" :key="item"><span>{{ item }}</span></div>`,
    );
    expect(byCode(diagnose(src), 'ROZ123').length).toBe(1);
  });
});

// ── $watch GETTER vs CALLBACK ───────────────────────────────────────────────

describe('refsPreMountValidator — $watch getter verdict EAGER → FLAGGED', () => {
  it('$watch GETTER reading $refs → ONE ROZ123 (eager verdict)', () => {
    // EAGER verdict: solid lowers the getter into createEffect(on(...)) whose
    // deps-fn runs at setup before the ref is assigned. So the getter IS flagged.
    const src = wrap(
      `$watch(() => $refs.el?.offsetWidth, (w) => { $data.v = String(w) })`,
    );
    expect(byCode(diagnose(src), 'ROZ123').length).toBe(1);
  });

  it('$watch CALLBACK reading $refs → ZERO ROZ123 (callback is deferred)', () => {
    const src = wrap(
      `$watch(() => $data.v, () => { foo($refs.el) })`,
    );
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });
});

// ── NEGATIVE — do-not-flag positions ────────────────────────────────────────

describe('refsPreMountValidator — NEGATIVE do-not-flag positions (zero ROZ123)', () => {
  it('$onMount body reading $refs → zero ROZ123', () => {
    const src = wrap(`$onMount(() => { foo($refs.el) })`);
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('$onUnmount body reading $refs → zero ROZ123', () => {
    const src = wrap(`$onUnmount(() => { foo($refs.el) })`);
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('$onUpdate body reading $refs → zero ROZ123', () => {
    const src = wrap(`$onUpdate(() => { foo($refs.el) })`);
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('event handler @click="$refs.x.focus()" → zero ROZ123', () => {
    const src = wrapTemplate(`<input ref="x" /><button @click="$refs.x.focus()">x</button>`);
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('<listeners> handler reading $refs → zero ROZ123', () => {
    const src = wrapWithListeners(
      `<listener :target="window" @resize="$refs.x.focus()" />`,
    );
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('r-model target → zero ROZ123', () => {
    const src = wrapTemplate(`<input ref="x" r-model="$data.v" />`);
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('plain function body reading $refs (called post-mount) → zero ROZ123', () => {
    const src = wrap(`const reposition = () => { foo($refs.el) }`);
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('top-level $refs read in <script> (not in $computed) → zero ROZ123', () => {
    const src = wrap(`const w = $refs.el`);
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('nested $onMount inside $computed re-defers → zero ROZ123 (exotic edge)', () => {
    const src = wrap(
      `const c = $computed(() => { $onMount(() => foo($refs.el)); return 1 })`,
    );
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });
});

// ── MALFORMED — no crash, no false positive ─────────────────────────────────

describe('refsPreMountValidator — MALFORMED inputs never crash (D-08)', () => {
  it('$computed() with no arg → no throw, zero ROZ123', () => {
    const src = wrap(`const c = $computed()`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('$computed(notAFn) → no throw, zero ROZ123', () => {
    const src = wrap(`const fn = () => {}\nconst c = $computed(fn)`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('bare $refs (no member) → no throw, zero ROZ123', () => {
    const src = wrap(`const c = $computed(() => $refs)`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('unparseable template binding :x="$refs." → no throw, zero ROZ123', () => {
    const src = wrapTemplate(`<input ref="el" :x="$refs." />`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });

  it('computed $refs["x"] in $computed → zero ROZ123 (ROZ106 owns it, not us)', () => {
    const src = wrap(`const c = $computed(() => $refs['x'])`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ123')).toEqual([]);
  });
});

// ── compile() surfaces ROZ123 on solid + lit, never throws ───────────────────

describe('refsPreMountValidator — compile() surfaces ROZ123 (solid + lit), never throws', () => {
  for (const target of ['solid', 'lit'] as const) {
    it(`compile() to ${target} never throws on the $computed shape and surfaces ROZ123`, () => {
      const src = wrap(
        `const plugin = () => ({});\nconst r = $computed(() => [plugin({ input: $refs.rangeEnd })])`,
        `<input ref="rangeEnd" />`,
      );
      expect(() => compile(src, { target })).not.toThrow();
      const result = compile(src, { target });
      expect(result.diagnostics.some((d) => d.code === 'ROZ123')).toBe(true);
    });
  }
});

// ── Repo-wide sweep — ZERO ROZ123 across committed .rozie sources ────────────

describe('refsPreMountValidator — repo-wide sweep (ZERO ROZ123)', () => {
  // This test file lives at
  //   packages/core/src/semantic/validators/__tests__/refsPreMountValidator.test.ts
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

  function roz123Hits(filePath: string): Diagnostic[] {
    const source = readFileSync(filePath, 'utf8');
    // ROZ123 is a SEMANTIC diagnostic emitted in analyzeAST (target-independent),
    // so one target suffices.
    const { diagnostics } = compile(source, { target: 'solid', filename: filePath });
    return diagnostics.filter((d) => d.code === 'ROZ123');
  }

  it('SWEEP: no committed .rozie example/fixture trips ROZ123', () => {
    const roots = ['examples', 'packages/ui', 'tests']
      .map((r) => path.join(repoRoot, r))
      .flatMap((r) => collectRozieFiles(r));

    expect(roots.length).toBeGreaterThan(0); // sanity: we actually found files.

    const offenders: string[] = [];
    for (const file of roots) {
      if (roz123Hits(file).length > 0) {
        offenders.push(path.relative(repoRoot, file));
      }
    }
    // A non-empty offenders list is a STOP-and-report finding (a real latent
    // pre-mount $refs read in a shipped example) — surfaced in the assertion
    // message. The post-fix FlatpickrBehaviorDemo uses the safe $onMount pattern,
    // so this MUST be empty.
    expect(offenders, `latent ROZ123 ($refs-before-mount) in: ${offenders.join(', ')}`).toEqual([]);
    // 30s deadline: matches the exposeValidator sweep — @rozie/core's
    // vitest.config.ts has no global testTimeout, and under `turbo run test`
    // parallel CPU starvation this whole-repo compile races past the 5s default.
  }, 30_000);
});
