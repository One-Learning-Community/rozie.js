// command-palette-portal-overlay phase — Task 2 (RED-first).
//
// PortalOverlay.rozie exercises the NEW element-level `r-portal="<expr>"`
// teleport directive (distinct from the P33 `<slot portal>` slot-content
// primitive, whose own emitPortals.ts is untouched by this phase). The
// Solid target lowers it to `solid-js/web`'s native `<Portal>`, gated by a
// `<Show when={container} fallback={tree}>` so a falsy container renders
// the tree in place (never mounts `<Portal>` at all).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSolid } from '../emitSolid.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const FIXTURES = resolve(__dirname, '../../fixtures');

function compilePortalOverlay(): { code: string } {
  const filename = resolve(REPO_ROOT, 'examples/PortalOverlay.rozie');
  const src = readFileSync(filename, 'utf8');
  const { ast } = parse(src, { filename });
  expect(ast).not.toBeNull();
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  expect(ir).not.toBeNull();
  const result = emitSolid(ir!, { filename, source: src });
  expect(
    result.diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(result.diagnostics)}`,
  ).toEqual([]);
  return { code: result.code };
}

describe('emitSolid — PortalOverlay (command-palette-portal-overlay Task 2, r-portal)', () => {
  it('emits native <Portal> gated by <Show>, in-place fallback + SSR guard', async () => {
    const { code } = compilePortalOverlay();

    expect(code).toMatch(/import \{ Portal \} from 'solid-js\/web';/);
    expect(code).toMatch(/<Show when=\{[^}]*typeof document === 'undefined'/);
    expect(code).toMatch(/<Portal mount=\{/);
    // Falsy-container in-place fallback: the tree markup's `class=` attribute
    // is present TWICE (once inside <Portal>, once as the <Show> fallback).
    // Quote-anchored so the count excludes Solid's inlined
    // `__rozieInjectStyle` CSS-selector text (which also contains the bare
    // class token, unquoted, as `.rozie-portal-overlay-box[data-rozie-s-…]`).
    const boxOccurrences = code.match(/rozie-portal-overlay-box"/g) ?? [];
    expect(boxOccurrences.length).toBe(2);
    // The old P33 slot-portal machinery (`render` from solid-js/web) must
    // NOT be pulled in by this fixture — it has no <slot portal>.
    expect(code).not.toMatch(/import \{ render \}/);

    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'PortalOverlay.snap.tsx'));
  });
});
