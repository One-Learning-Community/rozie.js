// command-palette-portal-overlay phase — Task 3 (RED-first).
//
// PortalOverlay.rozie exercises the NEW element-level `r-portal="<expr>"`
// teleport directive (distinct from the P33 `<slot portal>`/PortalHost.svelte
// slot-content primitive, untouched by this phase). The Svelte target lowers
// it to a `use:roziePortal={<expr>}` action (`@rozie/runtime-svelte`) —
// Svelte 5 has no `<Teleport>`-equivalent framework component, so an action
// operating on the already-rendered node is the idiomatic primitive.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSvelte } from '../emitSvelte.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const FIXTURES = resolve(__dirname, '../../fixtures');

function compilePortalOverlay(): { code: string } {
  const filename = resolve(REPO_ROOT, 'examples/PortalOverlay.rozie');
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  const ir: IRComponent = lowered.ir;
  const { code, diagnostics } = emitSvelte(ir, { filename, source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return { code };
}

describe('emitSvelte — PortalOverlay (command-palette-portal-overlay Task 3, r-portal)', () => {
  it('emits use:roziePortal action + the @rozie/runtime-svelte import', async () => {
    const { code } = compilePortalOverlay();

    expect(code).toMatch(/import \{ roziePortal \} from '@rozie\/runtime-svelte';/);
    expect(code).toMatch(/use:roziePortal=\{/);
    // The tree markup renders exactly ONCE (unlike React/Solid's ternary/Show
    // duplication) — an action operates on the SAME already-rendered node,
    // it never branches the markup itself. Quote-anchored so the count
    // excludes the native `<style>` block's CSS-selector text (Svelte keeps
    // `<style>` inline in the SFC, unlike React/Vue's sibling-file/
    // separate-block routing).
    const boxOccurrences = code.match(/rozie-portal-overlay-box"/g) ?? [];
    expect(boxOccurrences.length).toBe(1);

    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'PortalOverlay.svelte.snap'));
  });
});
