// Phase 58 (first-class prop documentation) — SC-6 INERT guard.
//
// SC-6: `docs` is metadata-only. It lands ONLY on the typed `PropDecl.docs`
// field (Plan 02, lowerProps.findPropDocs); NO emitter ever reaches back to the
// raw `<props>` options ObjectExpression. Therefore a documented prop's
// `description` / `example` strings can NEVER appear in any target's RUNTIME
// module body (`result.code`) — they are inert by construction.
//
// This test compiles the PropDocs.rozie fixture (one fully-documented prop +
// one docless control) to all six targets and asserts the docs strings are
// absent from every target's RUNTIME-EXECUTABLE body.
//
// PLAN 03 REFINEMENT (the inert guarantee, made precise): Plan 03 lands JSDoc
// emission, and the in-source prop type surface (interface members / `@property`
// + Angular class fields) lives INSIDE `result.code` for five targets — there is
// no separate `.d.ts` artifact in `compile().code` to hide it in. So once JSDoc
// lands, the docs prose DOES appear in `result.code` — but ONLY as `/** ... */`
// JSDoc COMMENTS (which every bundler erases at build) and in TS type-position,
// NEVER as a runtime value (a string literal, object property, or argument that
// survives transpilation into the shipped bundle). The original Plan 02 guard
// asserted `!result.code.includes(...)`, which was correct ONLY while no emitter
// consumed `docs`; it is incompatible with Plan 03's by-design JSDoc-comment
// emission. The refined guard strips JSDoc comment blocks from `result.code`,
// THEN asserts the docs strings are absent from the remaining runtime body —
// preserving SC-6's real intent (no docs prose in shipped runtime code,
// T-58-03 Information Disclosure) while accommodating JSDoc-as-comments.
//
// A FAILURE here means a docs string leaked into runtime-EXECUTABLE output —
// the SC-6 inert guarantee is broken. Do NOT "fix" it by widening the strip to
// swallow non-comment code; fix the emitter that serialized the raw options.
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const FIXTURE = resolve(REPO_ROOT, 'examples/PropDocs.rozie');

const TARGETS: CompileTarget[] = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

// The author-supplied docs prose from PropDocs.rozie's `label` prop. These are
// the strings that MUST stay out of every runtime-executable module body.
const DOCS_DESCRIPTION = 'The visible text label for the control.';
const DOCS_DEPRECATED = 'Use `text` instead';
const DOCS_EXAMPLE_FRAGMENT = '<PropDocs label="Save" />';

/**
 * Strip every JSDoc / block comment from emitted code, leaving only the
 * runtime-executable + type-declaration body. The docs prose is permitted to
 * live inside a `/** ... *​/` comment (erased at build); anything outside a
 * comment is shipped code and MUST NOT carry the prose (SC-6).
 */
function stripBlockComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('prop docs are inert [Phase 58] — SC-6 (metadata-only, never in runtime)', () => {
  // Read inside beforeAll (not at module load) so an absent fixture surfaces as a
  // clear suite failure rather than an ENOENT that crashes the module and
  // silently skips every test (IN-01).
  let source: string;
  beforeAll(() => {
    source = fs.readFileSync(FIXTURE, 'utf8');
  });

  for (const target of TARGETS) {
    it(`${target}: docs strings never appear in the runtime-executable body (result.code minus JSDoc)`, () => {
      const result = compile(source, { target, filename: 'PropDocs.rozie' });

      // The fixture is well-formed — compilation must not fatally error.
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors, `unexpected compile errors on ${target}: ${JSON.stringify(errors)}`).toEqual(
        [],
      );

      // SC-6: the runtime-executable body (code with JSDoc/block comments
      // stripped) carries NONE of the docs prose. The prose is allowed to
      // survive ONLY inside the stripped JSDoc comments (build-erased).
      const runtime = stripBlockComments(result.code);
      expect(
        runtime.includes(DOCS_DESCRIPTION),
        `${target}: docs.description leaked into the runtime-executable body`,
      ).toBe(false);
      expect(
        runtime.includes(DOCS_DEPRECATED),
        `${target}: docs.deprecated leaked into the runtime-executable body`,
      ).toBe(false);
      expect(
        runtime.includes(DOCS_EXAMPLE_FRAGMENT),
        `${target}: docs.example leaked into the runtime-executable body`,
      ).toBe(false);
    });
  }
});
