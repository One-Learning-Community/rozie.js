// A nested object-payload field (`<emits>` payload `{ title: string }`) must
// never leak into the attrs `Omit<…>` list on react / solid / svelte, in the
// inline module or the sidecar renderer.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { collectInterfaceMemberNames } from '../codegen/htmlAttrsExtends.js';
import { renderPropsInterface } from '../codegen/renderPropsInterface.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SRC = readFileSync(resolve(ROOT, 'tests/fixtures/typed-surface/AttrsPayload.rozie'), 'utf8');

function omitList(code: string): string {
  const m = /extends Omit<[^,]+, ([^>]*)>/.exec(code);
  if (!m) throw new Error('no Omit clause in:\n' + code);
  return m[1]!;
}

describe('payload fields do not leak into the attrs Omit list', () => {
  it('collectInterfaceMemberNames ignores a nested object-type field at any indent', () => {
    expect(
      collectInterfaceMemberNames(['  onpress?: (payload: {\n  title: string;\n}) => void;', '  label?: string;']),
    ).toEqual(['onpress', 'label']);
  });

  for (const target of ['react', 'solid', 'svelte'] as const) {
    it(`${target}: inline module keeps \`title\` out of Omit`, () => {
      const r = compile(SRC, { target, filename: 'AttrsPayload.rozie', sourceMap: false });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const omit = omitList(r.code);
      expect(omit).toContain("'label'");
      expect(omit).not.toContain("'title'");
    });

    it(`${target}: sidecar renderer keeps \`title\` out of Omit and indents the payload`, () => {
      const { ast } = parse(SRC, { filename: 'AttrsPayload.rozie' });
      const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
      const out = renderPropsInterface(ir!, {
        slotChildrenType: 'X',
        target,
        htmlAttrs: target,
        ...(target === 'svelte' ? { emitHandlerName: (e: string) => `on${e}` } : {}),
      });
      expect(omitList(out)).not.toContain("'title'");
      expect(out).toMatch(/\(payload: \{\n {4}title: string;\n {2}\}\) => void/);
    });
  }
});
