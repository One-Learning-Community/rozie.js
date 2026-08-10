/**
 * languages.test.ts — runtime gate for the `/languages` subpath export.
 *
 * Before this suite the generated `languages.ts` module (11 `@codemirror/lang-*`
 * constructors, 16 named presets, the `lang` raw-constructor namespace) shipped
 * on typecheck + a files-resolve precheck alone — no test anywhere instantiated
 * a preset (UAT follow-up 2026-08-10). Two contracts:
 *
 *   1. SIX-LEAF BYTE-IDENTITY — the module is framework-agnostic and codegen
 *      stamps the same file into every leaf. Anything importing "the react
 *      copy" (the VR demo does) relies on this; a divergent leaf would ship a
 *      different preset surface under the same docs.
 *
 *   2. EVERY EXPORT IS A LIVE, VALID EXTENSION — each named preset feeds
 *      `EditorState.create()` (the real acceptance check: CM throws at state
 *      creation on a malformed extension, exactly the failure class the
 *      decoration-slot `Decoration.none` bug demonstrated only surfaces at
 *      runtime), and each `lang.*` raw constructor is callable and its result
 *      state-creatable. Eager-preset instantiation happens at import, so the
 *      import itself is already half the test.
 *
 * The in-browser counterpart (parsed-HTML token spans via the `web` preset) is
 * the `lang-cell` leg in tests/visual-regression/specs/code-mirror.spec.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EditorState } from '@codemirror/state';
import * as languages from '../packages/react/src/languages';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEAVES = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
const leafPath = (leaf: string) =>
  resolve(HERE, '..', 'packages', leaf, 'src', 'languages.ts');

// The 16 named presets the module documents. `web` and `html` are the same
// array by design; `scss`/`sass` differ by the `indented` flag.
const PRESETS = [
  'web', 'html', 'css', 'scss', 'sass', 'vue', 'javascript', 'typescript',
  'jsx', 'tsx', 'json', 'markdown', 'yaml', 'xml', 'python', 'sql',
] as const;

const CONSTRUCTORS = [
  'html', 'css', 'sass', 'vue', 'javascript', 'json', 'markdown', 'yaml',
  'xml', 'python', 'sql',
] as const;

describe('languages module — six-leaf byte-identity', () => {
  const reactSource = readFileSync(leafPath('react'), 'utf8');
  for (const leaf of LEAVES.slice(1)) {
    it(`${leaf} leaf's languages.ts is byte-identical to react's`, () => {
      expect(readFileSync(leafPath(leaf), 'utf8')).toBe(reactSource);
    });
  }
});

describe('languages module — every preset is a live, valid Extension', () => {
  for (const name of PRESETS) {
    it(`preset \`${name}\` instantiates and EditorState.create accepts it`, () => {
      const preset = (languages as Record<string, unknown>)[name];
      expect(Array.isArray(preset)).toBe(true);
      expect((preset as unknown[]).length).toBeGreaterThan(0);
      // The real acceptance check — CM throws HERE on a malformed extension.
      const state = EditorState.create({
        doc: 'test',
        extensions: preset as never,
      });
      expect(state.doc.toString()).toBe('test');
    });
  }

  it('exports exactly the 16 documented presets + the `lang` namespace (no silent surface drift)', () => {
    // The generator's import-collision aliasing (`export const css_ = …;
    // export { css_ as css }`) makes each aliased preset ALSO visible under
    // its `X_` name. Those twins must be reference-equal to their documented
    // preset — anything else in the export surface is drift.
    const names = Object.keys(languages);
    const documented = names.filter((n) => !n.endsWith('_'));
    expect(documented.sort()).toEqual([...PRESETS, 'lang'].sort());
    for (const twin of names.filter((n) => n.endsWith('_'))) {
      const documentedName = twin.slice(0, -1);
      expect(PRESETS).toContain(documentedName);
      expect((languages as Record<string, unknown>)[twin]).toBe(
        (languages as Record<string, unknown>)[documentedName],
      );
    }
  });
});

describe('languages module — `lang` raw-constructor namespace', () => {
  it(`exposes exactly the 11 constructors`, () => {
    expect(Object.keys(languages.lang).sort()).toEqual([...CONSTRUCTORS].sort());
  });

  for (const name of CONSTRUCTORS) {
    it(`lang.${name}() constructs a state-creatable extension`, () => {
      const ctor = languages.lang[name] as () => unknown;
      expect(typeof ctor).toBe('function');
      const ext = ctor();
      expect(ext).toBeTruthy();
      const state = EditorState.create({ doc: '', extensions: ext as never });
      expect(state).toBeTruthy();
    });
  }
});
