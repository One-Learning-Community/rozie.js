// command-palette-portal-overlay phase — Task 3 (RED-first).
//
// PortalOverlay.rozie exercises the NEW element-level `r-portal="<expr>"`
// teleport directive (distinct from the P33 `<slot portal>` slot-content
// primitive, whose own emitPortals.ts is untouched by this phase). The
// Angular target lowers it to an AOT-SAFE relocation — a per-element
// `#roziePortal_N` template-ref + `effect()`/`viewChild()` field pair in
// the signals-era lifecycle. NO `import.meta.url`, NO inline template
// arrow (both break analogjs AOT — memory project_angular_aot_no_import_
// meta_url / project_angular_aot_no_template_arrow).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitAngular } from '../emitAngular.js';

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
  const { code, diagnostics } = emitAngular(ir, { filename, source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return { code };
}

describe('emitAngular — PortalOverlay (command-palette-portal-overlay Task 3, r-portal)', () => {
  it('emits an AOT-safe #roziePortal_N ref + effect()/viewChild() relocation, no arrow-in-template / import.meta.url', async () => {
    const { code } = compilePortalOverlay();

    expect(code).toMatch(/#roziePortal_0/);
    expect(code).toMatch(/viewChild<ElementRef>\('roziePortal_0'\)/);
    expect(code).toMatch(/private __roziePortal_0_effect = effect\(\(\) => \{/);
    expect(code).toMatch(/private __roziePortalPlace\(/);
    expect(code).toMatch(/this\.__rozieDestroyRef\.onDestroy\(/);

    // AOT bans (memory project_angular_aot_no_import_meta_url /
    // project_angular_aot_no_template_arrow).
    expect(code).not.toMatch(/import\.meta\.url/);
    // No inline arrow INSIDE a template binding value (the r-portal host's
    // own attribute list must be a plain #ref + bound property/event
    // syntax, never `[x]="() => ...")`).
    expect(code).not.toMatch(/="\([^")]*\)\s*=>/);

    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'PortalOverlay.ts.snap'));
  });
});
