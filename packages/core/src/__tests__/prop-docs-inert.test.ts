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
// absent from every `result.code`. It is forward-compatible with Plans 03/04
// (JSDoc emission): once JSDoc lands the strings may surface in the `.d.ts`
// doc surface (`result.types`) and as `/** */` COMMENTS — but never in the
// runtime module body. The guard deliberately checks `result.code` only.
//
// A FAILURE here means a docs string leaked into runtime output — the SC-6
// inert guarantee is broken (T-58-03 Information Disclosure). Do NOT "fix" it
// by relaxing the assertion; fix the emitter that serialized the raw options.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const FIXTURE = resolve(REPO_ROOT, 'examples/PropDocs.rozie');

const TARGETS: CompileTarget[] = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

// The author-supplied docs prose from PropDocs.rozie's `label` prop. These are
// the strings that MUST stay out of every runtime module body.
const DOCS_DESCRIPTION = 'The visible text label for the control.';
const DOCS_DEPRECATED = 'Use `text` instead';
const DOCS_EXAMPLE_FRAGMENT = '<PropDocs label="Save" />';

describe('prop docs are inert [Phase 58] — SC-6 (metadata-only, never in runtime)', () => {
  const source = fs.readFileSync(FIXTURE, 'utf8');

  for (const target of TARGETS) {
    it(`${target}: docs strings never appear in the runtime module body (result.code)`, () => {
      const result = compile(source, { target, filename: 'PropDocs.rozie' });

      // The fixture is well-formed — compilation must not fatally error.
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors, `unexpected compile errors on ${target}: ${JSON.stringify(errors)}`).toEqual(
        [],
      );

      // SC-6: the runtime body carries NONE of the docs prose.
      expect(
        result.code.includes(DOCS_DESCRIPTION),
        `${target}: docs.description leaked into the runtime module body`,
      ).toBe(false);
      expect(
        result.code.includes(DOCS_DEPRECATED),
        `${target}: docs.deprecated leaked into the runtime module body`,
      ).toBe(false);
      expect(
        result.code.includes(DOCS_EXAMPLE_FRAGMENT),
        `${target}: docs.example leaked into the runtime module body`,
      ).toBe(false);
    });
  }
});
