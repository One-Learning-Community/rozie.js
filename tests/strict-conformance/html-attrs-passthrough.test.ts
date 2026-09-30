/**
 * Typed public surface phase 3 (spec §5) — a strict consumer can pass
 * pass-through HTML attributes to a single-root, attr-inheriting component
 * with no cast; the component's own props win on a name collision; and
 * content-owned keys stay rejected. The `@ts-expect-error` lines are the
 * negatives — if one stops erroring, TS2578 makes the total non-zero.
 *
 * Red-first anchor: before the phase-3 emitter change, `className` / `style`
 * / `id` / `disabled` / `type` in `ok` fail TS2322 (not in the props type).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = readFileSync(
  resolve(ROOT, 'tests/fixtures/typed-surface/AttrsButton.rozie'),
  'utf8',
);

const REACT_CONSUMER = `import AttrsButton from './AttrsButton';

export const ok = (
  <AttrsButton
    label="x"
    title={3}
    className="c"
    style={{ color: 'red' }}
    id="i"
    aria-label="l"
    data-test="t"
    disabled
    type="button"
    onClick={(e) => e.currentTarget.blur()}
    onPress={() => {}}
  />
);
// @ts-expect-error — not a <button> attribute
export const badHref = <AttrsButton href="/x" />;
// @ts-expect-error — own \`title: number\` wins over HTML \`title: string\`
export const badTitle = <AttrsButton title="x" />;
// @ts-expect-error — no default slot: children stay rejected
export const badChildren = <AttrsButton>kids</AttrsButton>;
`;

describe('HTML-ATTRS-PASSTHROUGH — strict consumer (typed-surface P3)', () => {
  it('react', () => {
    const { code, diagnostics } = compile(FIXTURE, {
      target: 'react',
      filename: 'AttrsButton.rozie',
      sourceMap: false,
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const { raw, inventory } = typecheckCompiled({
      target: 'react',
      files: { 'AttrsButton.tsx': code, 'Consumer.tsx': REACT_CONSUMER },
      nodeModulesFrom: 'packages/ui/combobox/packages/react',
    });
    expect(totalErrors(inventory), raw).toBe(0);
  });
});
