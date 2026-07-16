// command-palette-portal-overlay phase — Task 2 (RED-first).
//
// PortalOverlay.rozie exercises the NEW element-level `r-portal="<expr>"`
// teleport directive (distinct from the P33 `<slot portal>` slot-content
// primitive, whose own emitPortals.ts is untouched by this phase). The
// Vue target lowers it to the NATIVE `<Teleport :to :disabled>` component
// — authors cannot write `<Teleport>` directly (ROZ926), but the emitter
// may synthesize it; Teleport tolerates a v-if child, so r-portal + r-if
// on the same element compose without special-casing the conditional
// emitter.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse as parseVueSFC } from '@vue/compiler-sfc';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitVue } from '../emitVue.js';

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
  const { code, diagnostics } = emitVue(ir, { filename, source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return { code };
}

describe('emitVue — PortalOverlay (command-palette-portal-overlay Task 2, r-portal)', () => {
  it('emits native <Teleport :to :disabled>, tolerates the v-if child, parses as valid SFC', async () => {
    const { code } = compilePortalOverlay();

    expect(code).toMatch(/<Teleport :to="[^"]+" :disabled="![^"]+">/);
    // r-if lowers to v-if on the INNER element, not the <Teleport> wrapper —
    // the wrapper is unconditional; Teleport tolerates a v-if child.
    expect(code).toMatch(/<Teleport[^>]*>\s*<div v-if="/);
    expect(code).toMatch(/<\/Teleport>/);

    // Must parse as a valid Vue SFC (smoke test — @vue/compiler-sfc doesn't throw).
    const parsed = parseVueSFC(code, { filename: 'PortalOverlay.vue' });
    expect(parsed.descriptor.template).not.toBeNull();

    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'PortalOverlay.vue.snap'));
  });
});
