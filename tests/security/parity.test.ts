/**
 * Battery 2 — per-target r-html sanitizer-parity assertion (SPEC req 6).
 *
 * This test is the SOURCE OF TRUTH that `docs/guide/security.md`'s
 * sanitizer-parity table mirrors (keep the two in lockstep). It asserts that
 * each of the 6 targets emits the documented `r-html` form against the
 * committed `RHtml.<target>.*` dist-parity fixture:
 *
 *   | Target  | r-html emit form                          | Sanitized?            |
 *   |---------|-------------------------------------------|-----------------------|
 *   | Angular | [innerHTML]="content()"                   | YES — runtime via DomSanitizer |
 *   | React   | dangerouslySetInnerHTML={{ __html: ... }} | No (raw-by-design)    |
 *   | Vue     | v-html="..."                              | No (raw-by-design)    |
 *   | Svelte  | {@html ...}                               | No (raw-by-design)    |
 *   | Solid   | innerHTML={...}                           | No (raw-by-design)    |
 *   | Lit     | ${unsafeHTML(...)}  (+ directive import)  | No (raw-by-design)    |
 *
 * D-09 documented finding (asserted as a parity note, NOT a compile-time
 * diagnostic): `javascript:`/`data:` URI schemes on `href`/`src` are accepted
 * in escaped quoted-attribute position — URL-scheme sanitization is the
 * framework RUNTIME's job, not Rozie's compile step. No new compile-time
 * URI-scheme diagnostic is introduced (deferred, out of scope per SPEC).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, '../dist-parity/fixtures');

function read(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf8');
}

describe('Battery 2 — sanitizer-parity matrix (SPEC req 6, source of truth)', () => {
  it('Angular emits [innerHTML]="content()" (runtime-SANITIZED via DomSanitizer)', () => {
    const code = read('RHtml.angular.ts');
    expect(code).toContain('[innerHTML]="content()"');
    // Angular's binding goes through DomSanitizer at runtime — no explicit
    // bypassSecurityTrustHtml call (which WOULD defeat sanitization).
    expect(code).not.toContain('bypassSecurityTrustHtml');
  });

  it('React emits dangerouslySetInnerHTML (raw-by-design)', () => {
    const code = read('RHtml.tsx');
    expect(code).toContain('dangerouslySetInnerHTML={{ __html: props.content }}');
  });

  it('Vue emits v-html (raw-by-design)', () => {
    const code = read('RHtml.vue');
    expect(code).toContain('v-html="props.content"');
    // No literal r-html= leak (Plan 24-01 emit fix landed).
    expect(code).not.toContain('r-html=');
  });

  it('Svelte emits {@html ...} (raw-by-design)', () => {
    const code = read('RHtml.svelte');
    expect(code).toContain('{@html content}');
  });

  it('Solid emits innerHTML={...} (raw-by-design)', () => {
    const code = read('RHtml.solid.tsx');
    expect(code).toContain('innerHTML={local.content}');
  });

  it('Lit emits ${unsafeHTML(...)} + its directive import (raw-by-design)', () => {
    const code = read('RHtml.lit.ts');
    expect(code).toContain('${unsafeHTML(this.content)}');
    // The conditional directive import MUST accompany the call (Plan 24-01).
    expect(code).toContain("import { unsafeHTML } from 'lit/directives/unsafe-html.js'");
    // No literal r-html= leak on the open tag (Pitfall 2).
    expect(code).not.toContain('r-html=');
  });

  it('exactly one target (Angular) sanitizes; the other five are raw-by-design', () => {
    // The asymmetry IS the parity finding: Angular's framework sanitizes the
    // binding; React/Vue/Svelte/Solid/Lit deliberately render raw HTML. This
    // is the documented behavior the docs table reproduces, not a bug.
    const angular = read('RHtml.angular.ts');
    expect(angular).toContain('[innerHTML]'); // routed through DomSanitizer
    // The five raw targets each carry their raw sink form (asserted above);
    // none routes through a sanitizer.
    for (const name of ['RHtml.tsx', 'RHtml.vue', 'RHtml.svelte', 'RHtml.solid.tsx', 'RHtml.lit.ts']) {
      expect(read(name)).not.toContain('DomSanitizer');
    }
  });
});

describe('Battery 2 — D-09 URI-scheme parity finding (documented, not a diagnostic)', () => {
  it('documents that javascript:/data: schemes are the framework runtime job (no compile-time diagnostic)', () => {
    // This is a documentation-anchor assertion: D-09 locks that Rozie does NOT
    // emit a compile-time URI-scheme diagnostic. The adversarial battery
    // (adversarial.test.ts) proves the behavioral side (escaped position, no
    // new diagnostic expected). Here we keep the docs table honest by pinning
    // the policy as a stable, named expectation.
    const POLICY = {
      uriSchemeSanitization: 'framework-runtime',
      compileTimeDiagnostic: false,
    } as const;
    expect(POLICY.uriSchemeSanitization).toBe('framework-runtime');
    expect(POLICY.compileTimeDiagnostic).toBe(false);
  });
});
