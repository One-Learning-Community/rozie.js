// command-palette-portal-overlay phase — Task 3 (Lit — the shadow-DOM
// hazard target).
//
// PortalOverlay.rozie exercises the NEW element-level `r-portal="<expr>"`
// teleport directive (distinct from the P33 `<slot portal>` slot-content
// primitive, whose own emitPortals.ts is untouched by this phase). The Lit
// target lowers it to a `RoziePortalController` ReactiveController
// (`@rozie/runtime-lit`) driving a CACHED `@query(..., true)` ref — cache
// is REQUIRED because an uncached @query re-searches `this.shadowRoot`,
// which no longer contains the node once relocated. The hazard: Lit's
// `static styles` is shadow-scoped (`adoptedStyleSheets`), so the
// relocated light-DOM element ALSO needs its scoped CSS pushed through
// `injectGlobalStyles` (reusing the P33/`:root{}` sink).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitLit } from '../emitLit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const FIXTURES = resolve(__dirname, 'fixtures');

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
  const { code, diagnostics } = emitLit(ir, { filename, source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return { code };
}

describe('emitLit — PortalOverlay (command-palette-portal-overlay Task 3, r-portal)', () => {
  it('emits a RoziePortalController + CACHED @query ref, and pushes scoped CSS through injectGlobalStyles', async () => {
    const { code } = compilePortalOverlay();

    expect(code).toMatch(/import \{[^}]*RoziePortalController[^}]*\} from '@rozie\/runtime-lit';/);
    // CACHED query — the load-bearing fix. An uncached @query would lose
    // the node after the first relocation (see module doc comment).
    // Finding 5 (R1) — the portal marker rides a DISTINCT attribute name
    // (`data-rozie-portal-ref`) so it never collides with an author `ref=`.
    expect(code).toMatch(/@query\('\[data-rozie-portal-ref="__roziePortal0"\]', true\)/);
    expect(code).toMatch(/data-rozie-portal-ref="__roziePortal0"/);
    expect(code).toMatch(
      /new RoziePortalController\(this, \(\) => this\.__roziePortal0, \(\) => \(/,
    );

    // The shadow-DOM hazard fix: the component's OWN scoped CSS (not just
    // :root rules) must ALSO be pushed through injectGlobalStyles, because
    // static styles' adoptedStyleSheets never reaches light-DOM content.
    expect(code).toMatch(/injectGlobalStyles\('rozie-portal-overlay-global',/);
    // The globally-injected copy must be SCOPE-QUALIFIED (matches only this
    // component's own elements outside the shadow root) — assert the
    // scoped selector text appears inside the injectGlobalStyles call.
    const injectCallMatch = code.match(
      /injectGlobalStyles\('rozie-portal-overlay-global', `([\s\S]*?)`\);/,
    );
    expect(injectCallMatch).not.toBeNull();
    expect(injectCallMatch![1]).toMatch(/\.rozie-portal-overlay-backdrop\[data-rozie-s-/);

    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'PortalOverlay.lit.ts.snap'));
  });
});
