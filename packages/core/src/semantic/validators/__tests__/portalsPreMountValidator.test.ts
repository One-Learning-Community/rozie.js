// Quick 260829-cd4 — ROZ149 $portals-called-before-mount validator.
//
// Proves: a `$portals.<x>` read in a PRE-MOUNT evaluation position fires
// exactly one ROZ149 (error) — at <script> Program top level, inside a
// `$computed(...)` body, the `$watch` GETTER, a <template> binding /
// `{{ }}` interpolation / `r-if` / `r-show` / `r-for` iterable. Proves the
// DO-NOT-FLAG list produces ZERO ROZ149 — `$onMount` / `$onUnmount` /
// `$onUpdate` bodies, the `$watch` CALLBACK, `@event` handlers,
// `<listeners>` handlers, an ordinary top-level helper function/arrow body
// (the ENTIRE POINT of the Quick 260829-cd4 emitter fix), and computed
// `$portals['x']` access. Proves malformed shapes never crash and never
// false-positive. Closes with a repo-wide sweep asserting ZERO ROZ149 across
// every committed .rozie under examples/ + packages/ui/ + tests/ — per the
// plan's hard gate, a non-empty offenders list here is a STOP-and-report
// finding, not something to silently downgrade or route around.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, type Dirent } from 'node:fs';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { renderDiagnostic } from '../../../diagnostics/frame.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function diagnose(source: string, filename = 'PortalsProbe.rozie'): Diagnostic[] {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(`parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`);
  }
  return analyzeAST(ast).diagnostics;
}

function byCode(diags: Diagnostic[], code: string): Diagnostic[] {
  return diags.filter((d) => d.code === code);
}

/** A self-contained probe with a script + (optional) custom template. The
 *  default template carries a portal-reactive slot named `body` so every
 *  `$portals.body` reference is a declared portal (keeps unknownRefValidator
 *  quiet — irrelevant to the ROZ149 assertions, which all filter byCode). */
const wrap = (
  script: string,
  template = `<div ref="hostEl"></div><slot name="body" portal reactive />`,
) => `<rozie name="PortalsProbe">
<script>
${script}
</script>
<template>${template}</template>
</rozie>`;

/** Template-only probe: no <script>. */
const wrapTemplate = (template: string) => `<rozie name="PortalsProbe">
<template>${template}</template>
</rozie>`;

/** Probe with a <listeners> block whose handler reads $portals. */
const wrapWithListeners = (listeners: string) => `<rozie name="PortalsProbe">
<template><slot name="body" portal reactive /></template>
<listeners>${listeners}</listeners>
</rozie>`;

// ── POSITIVE — flagged contexts ─────────────────────────────────────────────

describe('portalsPreMountValidator — POSITIVE flagged positions (ROZ149)', () => {
  it('<script> Program top level (no enclosing function) → ROZ149', () => {
    const src = wrap(`const h = $portals.body(document.createElement('div'), {})`);
    const hits = byCode(diagnose(src), 'ROZ149');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    const frame = renderDiagnostic(hits[0]!, src);
    expect(frame).toContain('ROZ149');
    expect(frame).toContain('body');
  });

  it('top-level call nested in an if-block (still Program top level) → ROZ149', () => {
    const src = wrap(`if (true) { $portals.body(document.createElement('div'), {}) }`);
    expect(byCode(diagnose(src), 'ROZ149').length).toBe(1);
  });

  it('$computed body → ROZ149', () => {
    const src = wrap(`const c = $computed(() => $portals.body(document.createElement('div'), {}))`);
    expect(byCode(diagnose(src), 'ROZ149').length).toBe(1);
  });

  it('template binding :data-x="$portals.body(...)" → ROZ149', () => {
    const src = wrapTemplate(
      `<slot name="body" portal reactive /><div :data-x="$portals.body(document.createElement('div'), {})"></div>`,
    );
    expect(byCode(diagnose(src), 'ROZ149').length).toBe(1);
  });

  it('interpolation {{ $portals.body(...) }} → ROZ149', () => {
    // A bare `{}` object-literal argument confuses parseTemplate's `{{ }}`
    // boundary detection (a known, unrelated parser limitation — REQ-13 in
    // the spike-findings-rozie skill). Pass a primitive instead so this
    // probe stays scoped to ROZ149, not that pre-existing gap.
    const src = wrapTemplate(
      `<slot name="body" portal reactive /><span>{{ $portals.body(document.createElement('div'), 1) }}</span>`,
    );
    expect(byCode(diagnose(src), 'ROZ149').length).toBe(1);
  });

  it('r-if="$portals.body(...)" → ROZ149', () => {
    const src = wrapTemplate(
      `<slot name="body" portal reactive /><div r-if="$portals.body(document.createElement('div'), {})">x</div>`,
    );
    expect(byCode(diagnose(src), 'ROZ149').length).toBe(1);
  });

  it('r-show="$portals.body(...)" → ROZ149', () => {
    const src = wrapTemplate(
      `<slot name="body" portal reactive /><div r-show="$portals.body(document.createElement('div'), {})">x</div>`,
    );
    expect(byCode(diagnose(src), 'ROZ149').length).toBe(1);
  });

  it('r-for iterable "item in $portals.body(...)" → ROZ149 (iterable RHS is render-time)', () => {
    const src = wrapTemplate(
      `<slot name="body" portal reactive /><div r-for="item in $portals.body(document.createElement(\'div\'), {})" :key="item"><span>{{ item }}</span></div>`,
    );
    expect(byCode(diagnose(src), 'ROZ149').length).toBe(1);
  });
});

// ── $watch GETTER vs CALLBACK ───────────────────────────────────────────────

describe('portalsPreMountValidator — $watch getter verdict EAGER → FLAGGED', () => {
  it('$watch GETTER reading $portals → ONE ROZ149 (eager verdict, mirrors ROZ123)', () => {
    const src = wrap(
      `$watch(() => $portals.body(document.createElement('div'), {}), (v) => { console.log(v) })`,
    );
    expect(byCode(diagnose(src), 'ROZ149').length).toBe(1);
  });

  it('$watch CALLBACK reading $portals → ZERO ROZ149 (callback is deferred)', () => {
    const src = wrap(
      `let h = null\n$watch(() => Date.now(), () => { h = $portals.body(document.createElement('div'), {}) })`,
    );
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });
});

// ── NEGATIVE — do-not-flag positions ────────────────────────────────────────

describe('portalsPreMountValidator — NEGATIVE do-not-flag positions (zero ROZ149)', () => {
  it('$onMount body reading $portals → zero ROZ149', () => {
    const src = wrap(`$onMount(() => { $portals.body(document.createElement('div'), {}) })`);
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('$onUnmount body reading $portals → zero ROZ149', () => {
    const src = wrap(`$onUnmount(() => { $portals.body(document.createElement('div'), {}) })`);
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('$onUpdate body reading $portals → zero ROZ149', () => {
    const src = wrap(`$onUpdate(() => { $portals.body(document.createElement('div'), {}) })`);
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('ordinary top-level helper function body reading $portals (the point of the emitter fix) → zero ROZ149', () => {
    const src = wrap(
      `function mountBody(host) { return $portals.body(host, {}) }\n$onMount(() => { mountBody(document.createElement('div')) })`,
    );
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('ordinary top-level arrow helper reading $portals, never called from $onMount at all → zero ROZ149', () => {
    const src = wrap(`const mountBody = (host) => { return $portals.body(host, {}) }`);
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('event handler @click="$portals.body(...)" → zero ROZ149', () => {
    const src = wrapTemplate(
      `<slot name="body" portal reactive /><button @click="$portals.body(document.createElement('div'), {})">x</button>`,
    );
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('<listeners> handler reading $portals → zero ROZ149', () => {
    const src = wrapWithListeners(
      `<listener :target="window" @resize="$portals.body(document.createElement('div'), {})" />`,
    );
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('computed $portals["x"] at top level → zero ROZ149 (ROZ106 owns it, not us)', () => {
    const src = wrap(`const c = $portals['body']`);
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('nested $onMount inside $computed re-defers → zero ROZ149 (exotic edge, mirrors ROZ123)', () => {
    const src = wrap(
      `const c = $computed(() => { $onMount(() => $portals.body(document.createElement('div'), {})); return 1 })`,
    );
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });
});

// ── MALFORMED — no crash, no false positive ─────────────────────────────────

describe('portalsPreMountValidator — MALFORMED inputs never crash (D-08)', () => {
  it('$computed() with no arg → no throw, zero ROZ149', () => {
    const src = wrap(`const c = $computed()`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('$computed(notAFn) → no throw, zero ROZ149', () => {
    const src = wrap(`const fn = () => {}\nconst c = $computed(fn)`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('bare $portals (no member) → no throw, zero ROZ149', () => {
    const src = wrap(`const c = $computed(() => $portals)`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });

  it('unparseable template binding :x="$portals." → no throw, zero ROZ149', () => {
    const src = wrapTemplate(`<slot name="body" portal reactive /><div :x="$portals."></div>`);
    expect(() => diagnose(src)).not.toThrow();
    expect(byCode(diagnose(src), 'ROZ149')).toEqual([]);
  });
});

// ── compile() surfaces ROZ149 (react + angular + lit), never throws ─────────

describe('portalsPreMountValidator — compile() surfaces ROZ149 (react/angular/lit), never throws', () => {
  for (const target of ['react', 'angular', 'lit'] as const) {
    it(`compile() to ${target} never throws on the $computed shape and surfaces ROZ149`, () => {
      const src = wrap(`const c = $computed(() => $portals.body(document.createElement('div'), {}))`);
      expect(() => compile(src, { target })).not.toThrow();
      const result = compile(src, { target });
      expect(result.diagnostics.some((d) => d.code === 'ROZ149')).toBe(true);
    });
  }
});

// ── Repo-wide sweep — ZERO ROZ149 across committed .rozie sources ────────────

describe('portalsPreMountValidator — repo-wide sweep (ZERO ROZ149)', () => {
  // This test file lives at
  //   packages/core/src/semantic/validators/__tests__/portalsPreMountValidator.test.ts
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

  function roz149Hits(filePath: string): Diagnostic[] {
    const source = readFileSync(filePath, 'utf8');
    // ROZ149 is a SEMANTIC diagnostic emitted in analyzeAST (target-independent),
    // so one target suffices.
    const { diagnostics } = compile(source, { target: 'solid', filename: filePath });
    return diagnostics.filter((d) => d.code === 'ROZ149');
  }

  it('SWEEP: no committed .rozie example/fixture trips ROZ149', () => {
    const roots = ['examples', 'packages/ui', 'tests']
      .map((r) => path.join(repoRoot, r))
      .flatMap((r) => collectRozieFiles(r));

    expect(roots.length).toBeGreaterThan(0); // sanity: we actually found files.

    const offenders: string[] = [];
    for (const file of roots) {
      if (roz149Hits(file).length > 0) {
        offenders.push(path.relative(repoRoot, file));
      }
    }
    // A non-empty offenders list is a STOP-and-report finding (a real latent
    // setup-time $portals call in a shipped example) — surfaced in the
    // assertion message. Per the site classification in
    // .planning/notes/class-a-sigil-scoping.md §2, every corpus $portals.*
    // call site is either inside $onMount, a $watch CALLBACK, or a plain
    // helper — all do-not-flag — so this MUST be empty.
    expect(offenders, `latent ROZ149 ($portals-before-mount) in: ${offenders.join(', ')}`).toEqual(
      [],
    );
    // 120s deadline: matches the refsPreMountValidator sweep's rationale —
    // analyzeAST now runs one more validator per .rozie, and a full cold
    // `turbo run test` sweep races past the 5s default under CPU starvation.
  }, 120_000);
});
