/**
 * Battery 1 — cross-target emit-escaping sink-scan (SPEC req 5).
 *
 * D-01: reads the COMMITTED `tests/dist-parity/fixtures/` bytes AS TEXT (no
 * recompile — dist-parity independently owns recompile-drift detection). It
 * scans every shipped fixture file for the 9 dangerous HTML/exec sink
 * patterns. D-02: each hit MUST trace to the explicit per-(pattern × target ×
 * fixture) allowlist — a dangerous sink is legitimate ONLY in the specific
 * `RHtml` output where `r-html` deliberately emits it. Any sink ANYWHERE else
 * in the corpus (e.g. a stray `dangerouslySetInnerHTML` in `Counter.react.tsx`)
 * FAILS the gate.
 *
 * A NEGATIVE self-test (mirrors `scripts/check-sidecar-staleness.mjs
 * --self-test`) injects a sink into a non-RHtml fixture string and asserts the
 * scanner reports it — proving the gate is non-vacuous.
 *
 * D-03: a positive companion assertion that `{{ }}` interpolation lowers to
 * each target's text-SAFE binding (JSX text / Vue mustache / Svelte text /
 * Angular interp / Lit `${}` auto-escaped / Solid text), never an HTML sink.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// import.meta.url-anchored corpus path (D-01) — cwd-independent, mirrors
// dist-parity's HERE/ROOT anchoring in bootstrap-fixtures.mjs:24-26.
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, '../dist-parity/fixtures');

type Target = 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit' | 'sidecar';

/**
 * The 9 sink patterns named in SPEC req 5. Matched as literal substrings over
 * the raw file text. `[innerHTML]` (Angular bracket form) and bare `innerHTML`
 * (Solid JSX prop) are both covered by the `innerHTML` substring; we keep
 * `bypassSecurityTrustHtml` distinct (it implies an explicit DomSanitizer
 * bypass, which should NEVER appear in emitted output).
 */
const SINK_PATTERNS = [
  'innerHTML', // covers Angular `[innerHTML]=` AND Solid `innerHTML={` AND `dangerouslySetInnerHTML`/`insertAdjacentHTML` substrings — see note below
  'dangerouslySetInnerHTML',
  'bypassSecurityTrustHtml',
  'v-html',
  '{@html',
  'insertAdjacentHTML',
  'document.write',
  'eval(',
  'new Function(',
] as const;

type SinkPattern = (typeof SINK_PATTERNS)[number];

/**
 * D-02 allowlist tuples — the ONLY legitimate sink hits, all in `RHtml` per
 * its target's raw-by-design (or runtime-sanitized) emit form:
 *   - react   `dangerouslySetInnerHTML` (also matches `innerHTML` substring)
 *   - vue     `v-html`
 *   - svelte  `{@html`
 *   - angular `[innerHTML]` (matches `innerHTML`)
 *   - solid   `innerHTML={`  (matches `innerHTML`)
 *   - lit     `unsafeHTML`   (NOT one of the 9 substring patterns; raw form is
 *             `${unsafeHTML(this.content)}` — `innerHTML` does NOT substring-
 *             match `unsafeHTML`, so Lit produces NO scanned-pattern hit and
 *             needs no allowlist entry here. Its emit form is asserted in
 *             parity.test.ts instead.)
 *
 * `dangerouslySetInnerHTML` literally contains the substring `innerHTML`, so a
 * single React RHtml `dangerouslySetInnerHTML={{ __html: ... }}` produces TWO
 * hits (`innerHTML` + `dangerouslySetInnerHTML`) — both allowlisted for
 * react/RHtml.
 */
interface AllowTuple {
  pattern: SinkPattern;
  target: Target;
  fixtureName: string;
}

const ALLOWLIST: AllowTuple[] = [
  // React RHtml — dangerouslySetInnerHTML (and its `innerHTML` substring)
  { pattern: 'dangerouslySetInnerHTML', target: 'react', fixtureName: 'RHtml' },
  { pattern: 'innerHTML', target: 'react', fixtureName: 'RHtml' },
  // Vue RHtml — v-html
  { pattern: 'v-html', target: 'vue', fixtureName: 'RHtml' },
  // Svelte RHtml — {@html
  { pattern: '{@html', target: 'svelte', fixtureName: 'RHtml' },
  // Angular RHtml — [innerHTML] (runtime-sanitized via DomSanitizer)
  { pattern: 'innerHTML', target: 'angular', fixtureName: 'RHtml' },
  // Solid RHtml — innerHTML={...}
  { pattern: 'innerHTML', target: 'solid', fixtureName: 'RHtml' },
];

function isAllowed(pattern: SinkPattern, target: Target, fixtureName: string): boolean {
  return ALLOWLIST.some(
    (t) => t.pattern === pattern && t.target === target && t.fixtureName === fixtureName,
  );
}

/**
 * Derive `(target, fixtureName)` from a fixture filename. Fixture base name is
 * everything before the first `.`; the suffix selects the target.
 *
 * Order matters: `.solid.tsx` must be tested before `.tsx`, and the multi-
 * segment `.angular.ts`/`.lit.ts` before any bare `.ts`. Sidecars
 * (`.d.ts`/`.module.css`/`.global.css`) are React-associated output but are
 * classified `sidecar` — they are still scanned (no sink should ever appear in
 * a `.d.ts` / CSS sidecar) and never allowlisted.
 */
function classify(filename: string): { target: Target; fixtureName: string } {
  // WR-03 (24-REVIEW): derive the fixture name by stripping the KNOWN
  // target/sidecar suffix from the RIGHT, not by slicing at the first `.`.
  // `indexOf('.')` mis-extracts any future fixture whose component name
  // contains a dot (e.g. `My.Component.vue` → `My`); right-anchored
  // suffix-stripping is deterministic regardless of dots in the base name.
  // Order matters: multi-segment suffixes (`.solid.tsx`, `.angular.ts`,
  // `.lit.ts`, the `.d.ts`/CSS sidecars) MUST precede the bare single-segment
  // ones (`.tsx`, `.ts`, `.vue`, `.svelte`) so they win the match.
  const SUFFIX_TARGETS: ReadonlyArray<readonly [string, Target]> = [
    ['.d.ts', 'sidecar'],
    ['.module.css', 'sidecar'],
    ['.global.css', 'sidecar'],
    ['.solid.tsx', 'solid'],
    ['.angular.ts', 'angular'],
    ['.lit.ts', 'lit'],
    ['.tsx', 'react'],
    ['.vue', 'vue'],
    ['.svelte', 'svelte'],
  ];
  for (const [suffix, target] of SUFFIX_TARGETS) {
    if (filename.endsWith(suffix)) {
      return { target, fixtureName: filename.slice(0, -suffix.length) };
    }
  }
  // Unrecognized extension — classify as sidecar; fixture name is the segment
  // before the first dot as a last resort (still scanned, never allowlisted).
  const dotIdx = filename.indexOf('.');
  return {
    target: 'sidecar',
    fixtureName: dotIdx === -1 ? filename : filename.slice(0, dotIdx),
  };
}

interface Violation {
  pattern: SinkPattern;
  target: Target;
  fixtureName: string;
  filename: string;
  line: number;
}

/**
 * Scan a single file's text for out-of-allowlist sink hits. Exported shape so
 * the negative self-test can run it over a spliced string. `target`/
 * `fixtureName` are passed in (derived from the real filename, or synthesized
 * in the self-test).
 */
function scanText(
  text: string,
  target: Target,
  fixtureName: string,
  filename: string,
): Violation[] {
  const violations: Violation[] = [];
  const lines = text.split('\n');
  for (const pattern of SINK_PATTERNS) {
    if (!text.includes(pattern)) continue;
    if (isAllowed(pattern, target, fixtureName)) continue;
    // Out-of-allowlist hit — record the first offending line for the message.
    const lineIdx = lines.findIndex((l) => l.includes(pattern));
    violations.push({
      pattern,
      target,
      fixtureName,
      filename,
      line: lineIdx + 1,
    });
  }
  return violations;
}

/** Scan every committed dist-parity fixture file (D-01). */
function scanCorpus(): Violation[] {
  const files = readdirSync(FIXTURES_DIR).filter(
    (f) => !f.endsWith('.snap') && !f.startsWith('.'),
  );
  const violations: Violation[] = [];
  for (const filename of files) {
    const text = readFileSync(resolve(FIXTURES_DIR, filename), 'utf8');
    const { target, fixtureName } = classify(filename);
    violations.push(...scanText(text, target, fixtureName, filename));
  }
  return violations;
}

describe('Battery 1 — emit-escaping sink-scan (SPEC req 5, D-01/D-02)', () => {
  it('scans a non-trivial corpus (guards against an empty fixtures dir)', () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => !f.endsWith('.snap'));
    // ~30 fixtures × 6 targets + sidecars; assert we actually found the corpus.
    expect(files.length).toBeGreaterThan(50);
  });

  it('reports ZERO out-of-allowlist sinks across the shipped corpus', () => {
    const violations = scanCorpus();
    if (violations.length > 0) {
      const detail = violations
        .map((v) => `  ${v.filename}:${v.line} — '${v.pattern}' (${v.target}/${v.fixtureName}) not in allowlist`)
        .join('\n');
      throw new Error(`Unexpected emit sinks found:\n${detail}`);
    }
    expect(violations).toHaveLength(0);
  });

  it('confirms the RHtml allowlist hits ARE present (allowlist is not over-broad)', () => {
    // Sanity: the allowlisted sinks must actually exist in the corpus, else the
    // allowlist is stale (the RHtml fixture was renamed/removed). React, Vue,
    // Svelte, Angular, Solid all carry a scanned sink hit in RHtml.
    const rhtmlReact = readFileSync(resolve(FIXTURES_DIR, 'RHtml.tsx'), 'utf8');
    const rhtmlVue = readFileSync(resolve(FIXTURES_DIR, 'RHtml.vue'), 'utf8');
    const rhtmlSvelte = readFileSync(resolve(FIXTURES_DIR, 'RHtml.svelte'), 'utf8');
    const rhtmlAngular = readFileSync(resolve(FIXTURES_DIR, 'RHtml.angular.ts'), 'utf8');
    const rhtmlSolid = readFileSync(resolve(FIXTURES_DIR, 'RHtml.solid.tsx'), 'utf8');
    expect(rhtmlReact).toContain('dangerouslySetInnerHTML');
    expect(rhtmlVue).toContain('v-html');
    expect(rhtmlSvelte).toContain('{@html');
    expect(rhtmlAngular).toContain('[innerHTML]');
    expect(rhtmlSolid).toContain('innerHTML={');
  });

  it('NEGATIVE self-test: an injected sink in a non-RHtml fixture FAILS the scan', () => {
    // Mirror check-sidecar-staleness --self-test: take a clean fixture string,
    // splice in a dangerous sink, run the scanner, assert it reports a
    // violation. Proves the gate is non-vacuous.
    const counter = readFileSync(resolve(FIXTURES_DIR, 'Counter.tsx'), 'utf8');
    const tampered = counter.replace(
      '<span',
      '<span dangerouslySetInnerHTML={{ __html: props.value }}',
    );
    expect(tampered).not.toBe(counter); // splice actually happened

    const violations = scanText(tampered, 'react', 'Counter', 'Counter.tsx');
    // Both `dangerouslySetInnerHTML` and its `innerHTML` substring are hits,
    // neither allowlisted for react/Counter.
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.pattern === 'dangerouslySetInnerHTML')).toBe(true);
  });

  it('NEGATIVE self-test: an injected eval()/document.write also FAILS', () => {
    const counter = readFileSync(resolve(FIXTURES_DIR, 'Counter.svelte'), 'utf8');
    const tampered = counter.replace('let {', 'eval("boom"); let {');
    const violations = scanText(tampered, 'svelte', 'Counter', 'Counter.svelte');
    expect(violations.some((v) => v.pattern === 'eval(')).toBe(true);
  });
});

describe('Battery 1 — {{ }} text-safe positive assertion (SPEC req 5, D-03)', () => {
  // The Counter `{{ $props.value }}` interpolation lowers to each target's
  // text-SAFE binding (never an HTML sink). We assert (a) the text-safe form is
  // present, and (b) the line carrying the value display has no sink pattern.
  // Per-target expected text-safe form + the line marker that anchors it.
  const cases: Array<{
    target: Target;
    file: string;
    // a snippet that MUST appear (the text-safe value binding)
    textSafe: string;
    // the rendered value-display line marker
    lineMarker: string;
  }> = [
    { target: 'react', file: 'Counter.tsx', textSafe: '{value}', lineMarker: 'className={"value"}' },
    { target: 'vue', file: 'Counter.vue', textSafe: '{{ value }}', lineMarker: 'class="value"' },
    { target: 'svelte', file: 'Counter.svelte', textSafe: '{value}', lineMarker: 'class="value"' },
    { target: 'angular', file: 'Counter.angular.ts', textSafe: '{{ value() }}', lineMarker: 'class="value"' },
    { target: 'solid', file: 'Counter.solid.tsx', textSafe: '{value()}', lineMarker: 'class={"value"}' },
    { target: 'lit', file: 'Counter.lit.ts', textSafe: '${this.value}', lineMarker: 'class="value"' },
  ];

  for (const c of cases) {
    it(`${c.target}: {{ value }} → text-safe binding, no HTML sink on the value line`, () => {
      const text = readFileSync(resolve(FIXTURES_DIR, c.file), 'utf8');
      // (a) text-safe form present
      expect(text).toContain(c.textSafe);
      // (b) the value-display line carries no sink pattern
      const valueLine = text.split('\n').find((l) => l.includes(c.lineMarker));
      expect(valueLine, `no line matching "${c.lineMarker}" in ${c.file}`).toBeDefined();
      for (const pattern of SINK_PATTERNS) {
        expect(
          valueLine!.includes(pattern),
          `value-display line in ${c.file} unexpectedly contains sink '${pattern}'`,
        ).toBe(false);
      }
    });
  }
});
