// command-palette-portal-overlay phase — Task 2 (RED-first).
//
// PortalOverlay.rozie exercises the NEW element-level `r-portal="<expr>"`
// teleport directive (distinct from the P33 `<slot portal>` slot-content
// primitive, whose own emitPortals.ts is untouched by this phase). The
// React target lowers it to `react-dom`'s native `createPortal`, combined
// with the `r-if` on the same element (open-driven mount).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitReact } from '../emitReact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const FIXTURES = resolve(__dirname, '../../fixtures');

function compilePortalOverlay(): { code: string; ir: IRComponent } {
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
  const { code, diagnostics } = emitReact(ir, { filename, source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return { code, ir };
}

describe('emitReact — PortalOverlay (command-palette-portal-overlay Task 2, r-portal)', () => {
  it('emits react-dom createPortal, native element teleport, in-place fallback + SSR guard', async () => {
    const { code } = compilePortalOverlay();

    // The native React teleport construct — NEVER the P33 emitPortals.ts
    // createRoot-into-container path.
    expect(code).toMatch(/import \{ createPortal \} from 'react-dom';/);
    expect(code).toMatch(/createPortal\(/);
    // SSR guard — the container is resolved only when `document` exists.
    expect(code).toMatch(/typeof document === 'undefined'/);
    // Falsy-container in-place fallback: the SAME tree markup renders
    // whether or not the portal fires (a literal `rozie-portal-overlay-box`
    // class token appears exactly once per JSX branch — twice total, once
    // in the createPortal branch and once in the in-place branch).
    const boxOccurrences = code.match(/rozie-portal-overlay-box/g) ?? [];
    expect(boxOccurrences.length).toBe(2);
    // The old P33 slot-portal machinery (createRoot/flushSync) must NOT be
    // pulled in by this fixture — it has no <slot portal>.
    expect(code).not.toMatch(/createRoot/);
    expect(code).not.toMatch(/flushSync/);

    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'PortalOverlay.tsx.snap'));
  });
});
