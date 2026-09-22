// Quick 260922-hk4 (N-04) — ROZ150 setup-once `$props`/`$model` read validator.
//
// Proves: a `$props.<x>` / `$model.<x>` read in `<script>` code that runs ONCE
// at setup (Program top level — no enclosing function) fires exactly one
// ROZ150 (warning) per top-level statement + member, whose message names the
// derived-function fix and frames the issue as cross-target parity (Angular
// reads the input DEFAULT in the constructor; Lit does too for a top-level
// declaration initializer, which becomes a class field). Proves the
// DO-NOT-FLAG list produces ZERO ROZ150 — any function body, `$onMount`,
// `$watch`, `$computed`, computed `$props['x']`, template / `<listeners>`
// reads, and the assignment target of a prop write. Proves the warning never
// blocks a compile. Closes with a repo-wide sweep: packages/ui is silent, and
// the whole repo produces exactly the three enumerated test-fixture sites.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, type Dirent } from 'node:fs';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function diagnose(source: string, filename = 'SetupOnceProbe.rozie'): Diagnostic[] {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(`parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`);
  }
  return analyzeAST(ast).diagnostics;
}

function byCode(diags: Diagnostic[], code: string): Diagnostic[] {
  return diags.filter((d) => d.code === code);
}

const PROPS = `<props>
{
  value: { type: String, default: '' },
  a: { type: Number, default: 0 },
  open: { type: Boolean, default: false, model: true },
  items: { type: Array, default: () => [] },
}
</props>`;

const wrap = (
  script: string,
  template = `<div>{{ $props.value }}</div>`,
  data = `<data>
{
  draft: '',
}
</data>`,
) => `<rozie name="SetupOnceProbe">
${PROPS}
${data}
<script>
${script}
</script>
<template>${template}</template>
</rozie>`;

const roz150 = (src: string) => byCode(diagnose(src), 'ROZ150');

// ── POSITIVE — setup-once reads ─────────────────────────────────────────────

describe('setupOncePropReadValidator — POSITIVE setup-once reads (ROZ150)', () => {
  it('top-level `$data.draft = $props.value` → 1 warning naming the prop, Angular and the fix; NOT Lit', () => {
    const hits = roz150(wrap(`$data.draft = $props.value`));
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
    expect(hits[0]!.message).toContain('$props.value');
    expect(hits[0]!.message).toContain('Angular');
    expect(hits[0]!.message).toContain('() => $props.value');
    // Lit runs statement-shaped setup code in firstUpdated() — correct there.
    expect(hits[0]!.message).not.toContain('Lit');
  });

  it('top-level `const snap = $props.value` → 1 warning that ALSO names Lit (class field)', () => {
    const hits = roz150(wrap(`const snap = $props.value`));
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain('Lit');
    expect(hits[0]!.message).toContain('Angular');
  });

  it('`let s = $props.a + $props.a` → deduplicated to 1', () => {
    expect(roz150(wrap(`let s = $props.a + $props.a`)).length).toBe(1);
  });

  it('distinct members in one statement → one each', () => {
    expect(roz150(wrap(`let s = $props.a + $props.value`)).length).toBe(2);
  });

  it('top-level `if ($props.open) { … }` → 1', () => {
    expect(roz150(wrap(`if ($props.open) { console.log('x') }`)).length).toBe(1);
  });

  it('top-level `for (const x of $props.items) {}` → 1', () => {
    expect(roz150(wrap(`for (const x of $props.items) { console.log(x) }`)).length).toBe(1);
  });

  it('`const m = $model.open` → 1, message names $model.open', () => {
    const hits = roz150(wrap(`const m = $model.open`));
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain('$model.open');
  });

  it('loc points at the member expression', () => {
    const src = wrap(`$data.draft = $props.value`);
    const hit = roz150(src)[0]!;
    expect(src.slice(hit.loc.start, hit.loc.end)).toBe('$props.value');
  });
});

// ── NEGATIVE — deferred / non-script / writes ───────────────────────────────

describe('setupOncePropReadValidator — DO-NOT-FLAG (zero ROZ150)', () => {
  const cases: Array<[string, string]> = [
    ['arrow', `const f = () => $props.value`],
    ['function declaration', `function g() { return $props.value }`],
    ['object method', `const o = { get() { return $props.value } }`],
    ['$onMount body', `$onMount(() => { $data.draft = $props.value })`],
    ['$watch getter + callback', `$watch(() => $props.value, (v) => { $data.draft = v })`],
    ['$computed body', `const c = $computed(() => $props.value)`],
    ['computed member access', `const k = $props['value']`],
    ['prop write target', `$props.open = true`],
  ];
  for (const [name, script] of cases) {
    it(`${name} → 0`, () => {
      expect(roz150(wrap(script))).toEqual([]);
    });
  }

  it('template binding / interpolation read → 0', () => {
    const src = wrap(`const x = 1`, `<div :title="$props.value">{{ $props.a }}</div>`);
    expect(roz150(src)).toEqual([]);
  });

  it('<listeners> handler read → 0', () => {
    const src = `<rozie name="SetupOnceProbe">
${PROPS}
<template><div>x</div></template>
<listeners>
  <listener :target="document" @keydown="console.log($props.value)" r-if="$props.open" />
</listeners>
</rozie>`;
    expect(roz150(src)).toEqual([]);
  });
});

// ── <data> initializers + IIFE (quick 260922-hk4 Task 2b) ───────────────────

describe('setupOncePropReadValidator — <data> initializers and IIFEs', () => {
  const dataWrap = (data: string, script = `const x = 1`) =>
    wrap(script, `<div>{{ $data.draft }}</div>`, `<data>\n${data}\n</data>`);

  it('`{ fromData: $props.value }` → 1 warning naming the <data> initializer, Angular and Lit', () => {
    const src = dataWrap(`{ draft: '', fromData: $props.value }`);
    const hits = roz150(src);
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
    expect(hits[0]!.message).toContain('<data>');
    expect(hits[0]!.message).toContain('Angular');
    expect(hits[0]!.message).toContain('Lit');
    expect(hits[0]!.message).toContain('() => $props.value');
    expect(src.slice(hits[0]!.loc.start, hits[0]!.loc.end)).toBe('$props.value');
  });

  it('`{ fromModel: $model.open }` → 1', () => {
    expect(roz150(dataWrap(`{ draft: '', fromModel: $model.open }`)).length).toBe(1);
  });

  it('`{ fromData: () => $props.value }` → 0 (deferred)', () => {
    expect(roz150(dataWrap(`{ draft: '', fromData: () => $props.value }`))).toEqual([]);
  });

  it('a factory reading props only inside a nested function → 0', () => {
    const data = `{ draft: '', handlers: { get: () => $props.value, run() { return $props.a } } }`;
    expect(roz150(dataWrap(data))).toEqual([]);
  });

  it('an IIFE in a <data> initializer does not defer → 1', () => {
    expect(roz150(dataWrap(`{ draft: '', fromData: (() => $props.value)() }`)).length).toBe(1);
  });

  it('a top-level <script> IIFE does not defer → 1', () => {
    expect(roz150(wrap(`;(() => { $data.draft = $props.value })()`)).length).toBe(1);
  });

  it('a callback passed to a call (not an IIFE) still defers → 0', () => {
    expect(roz150(wrap(`$onMount(() => { $data.draft = $props.value })`))).toEqual([]);
  });
});

// ── compile() — the warning never blocks ────────────────────────────────────

describe('setupOncePropReadValidator — warning never blocks compile', () => {
  for (const target of ['angular', 'lit', 'vue'] as const) {
    it(`compile() to ${target} surfaces ROZ150 with zero error-severity diagnostics`, () => {
      const src = wrap(`$data.draft = $props.value\nconst snap = $props.value`);
      const result = compile(src, { target, filename: 'SetupOnceProbe.rozie' });
      expect(result.diagnostics.some((d) => d.code === 'ROZ150')).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    });
  }
});

// ── Repo-wide sweep ─────────────────────────────────────────────────────────

describe('setupOncePropReadValidator — repo-wide sweep', () => {
  // six `..` segments reach the repo root (same as the ROZ149 sweep).
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../');

  function collectRozieFiles(dir: string): string[] {
    const out: string[] = [];
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      return out;
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...collectRozieFiles(full));
      else if (ent.isFile() && ent.name.endsWith('.rozie')) out.push(full);
    }
    return out;
  }

  function offendersIn(roots: string[]): string[] {
    const offenders: string[] = [];
    for (const file of roots.flatMap((r) => collectRozieFiles(path.join(repoRoot, r)))) {
      // Read as utf8 — never shell grep (em-dash .rozie files are misdetected as binary).
      const source = readFileSync(file, 'utf8');
      const { diagnostics } = compile(source, { target: 'solid', filename: file });
      for (const d of diagnostics) {
        if (d.code !== 'ROZ150') continue;
        offenders.push(
          `${path.relative(repoRoot, file).split(path.sep).join('/')} ${source.slice(d.loc.start, d.loc.end)}`,
        );
      }
    }
    return offenders.sort();
  }

  it('SWEEP: the shipped packages/ui corpus produces ZERO ROZ150', () => {
    expect(collectRozieFiles(path.join(repoRoot, 'packages/ui')).length).toBeGreaterThan(0);
    const offenders = offendersIn(['packages/ui']);
    expect(offenders, `setup-once $props/$model read in shipped code: ${offenders.join(', ')}`).toEqual([]);
  }, 120_000);

  it('SWEEP: the whole repo produces exactly the three enumerated fixture sites', () => {
    // These are deliberate compile-shape TEST FIXTURES — the dist-parity
    // inline/partial-inline byte-identity oracles and a Solid null-widened
    // control — not shipped components. ROZ150 is TRUE for them (they would
    // read the prop default on Angular and Lit) but it is advisory and they are
    // left unchanged on purpose (quick 260922-hk4, D-A1). Any NEW offender is a
    // STOP-and-report finding — never an addition to this list.
    const offenders = offendersIn(['examples', 'packages/ui', 'tests']);
    expect(offenders).toEqual([
      'examples/InlineEquivHostF.rozie $props.base',
      'examples/PartialInlineHostF.rozie $props.base',
      'tests/regressions/fixtures/260712-ig6-solid-null-widened-prop/input.rozie $props.label',
    ]);
  }, 120_000);
});
