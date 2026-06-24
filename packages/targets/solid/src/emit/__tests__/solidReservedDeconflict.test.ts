/**
 * Solid reserved-name deconfliction — Phase 61 Plan 06 (Half A, SC-2).
 *
 * Solid's deconfliction registered ONLY `solidProps` (accessor `$props`) +
 * `solidSetters` (binding). `<data>` getters, `$computed` consts, and the
 * `<name>Ref`-suffixed ref locals were minted as bare top-level consts in NO
 * `GeneratedSymbolGroup`, so they collided with:
 *
 *   - bare solid-js imports (`children`/`on`/`For`)        → TS2440/TS2451
 *   - emitter locals (`local`/`attrs`/`_merged`/`resolved`/`portals`) → TS2451
 *   - sibling consts (`<data> x` vs `$computed x`)         → TS2451
 *
 * and `$expose({ value })` where `value` is a `$computed` silently referenced
 * the memo getter (the IR pass walked only `ir.state`).
 *
 * This plan adds the binding groups + extends `deconflictStateExposeCollision`
 * to walk `ir.computed`. All renames are INTERNAL → `X$local`. The public
 * contract (prop names, `$expose` verbs) is NEVER renamed. Off-collision
 * components stay byte-identical (verified against the unchanged corpus by the
 * snapshot + dist-parity suites).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { emitSolid } from '../../emitSolid.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../__tests__/fixtures');

function compileSolid(source: string, filename: string): string {
  const parsed = parse(source, { filename });
  expect(parsed.ast).not.toBeNull();
  const { ir } = lowerToIR(parsed.ast!, {});
  expect(ir).not.toBeNull();
  return emitSolid(ir!, { filename, source }).code;
}

describe('Solid reserved-name deconfliction — <data> shadowing a solid-js import', () => {
  it('`<data children>` in a default-slot component renames to `children$local`, import intact', () => {
    const source = readFileSync(
      resolve(FIXTURES, 'SolidDataImportShadow.rozie'),
      'utf8',
    );
    const code = compileSolid(source, 'SolidDataImportShadow.rozie');

    // The default slot forces `import { children } from 'solid-js'` +
    // `const resolved = children(() => local.children)`.
    expect(code).toContain('children');
    expect(code).toContain('const resolved = children(');

    // FIX: the `<data> children` signal binding is renamed off the import.
    expect(code).toContain('const [children$local, setChildren$local] = createSignal');
    // The solid-js `children` import binding must NOT be shadowed by a second
    // top-level `const children = createSignal(...)`.
    expect(code).not.toMatch(/const \[children,\s*setChildren\]\s*=\s*createSignal/);
  });
});
