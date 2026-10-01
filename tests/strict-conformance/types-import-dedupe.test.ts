/**
 * R16 (typed-surface P1, Task 18 review): `<types>` `import type { Thing }` +
 * `<script>` `import { Thing }` from the same module share ONE emitted module
 * scope. Before the fix every target failed TS2300 "Duplicate identifier
 * 'Thing'"; now the duplicated `<types>` specifier is dropped from the module
 * and module types that reference `Thing` still resolve (react/solid/lit here;
 * vue/svelte/angular in their harness dirs). Fixture: __fixtures__/types-import-dedupe.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(HERE, '__fixtures__/types-import-dedupe');
const SRC = readFileSync(resolve(FIX, 'Dup.rozie'), 'utf8');
const LIB = readFileSync(resolve(FIX, 'lib.ts'), 'utf8');

const CONSUMERS = {
  react: `import { useRef } from 'react';
import Dup, { type DupHandle, type DupInfo, type Thing } from './Dup';
const h = useRef<DupHandle>(null);
const n: number | undefined = h.current?.current().x;
void n;
export const ok = <Dup ref={h} onInfo={(p) => { const i: DupInfo = p; const t: Thing = p.thing; const x: number = t.x; void i; void x; }} />;
`,
  solid: `import Dup, { type DupHandle, type DupInfo, type Thing } from './Dup';
let h: DupHandle | undefined;
const n: number | undefined = h?.current().x;
void n;
export const ok = <Dup ref={(x) => { h = x; }} onInfo={(p) => { const i: DupInfo = p; const t: Thing = p.thing; const x: number = t.x; void i; void x; }} />;
`,
  lit: `import Dup, { type DupInfo, type Thing } from './Dup';
declare const el: Dup;
const n: number = el.current().x;
el.addEventListener('info', (e) => { const i: DupInfo = e.detail; const t: Thing = e.detail.thing; const x: number = t.x; void i; void x; });
void n;
`,
} as const;

describe('R16 — <types> import type + <script> value import of the same binding (react/solid/lit)', () => {
  for (const target of ['react', 'solid', 'lit'] as const) {
    it(`${target}: compiled module + typed consumer typecheck clean (no TS2300)`, () => {
      const r = compile(SRC, { target, filename: 'Dup.rozie', sourceMap: false });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const ext = target === 'lit' ? 'ts' : 'tsx';
      const { raw, inventory } = typecheckCompiled({
        target,
        files: { [`Dup.${ext}`]: r.code, 'lib.ts': LIB, [`Consumer.${ext}`]: CONSUMERS[target] },
        nodeModulesFrom: `packages/ui/popover/packages/${target}`,
      });
      expect(totalErrors(inventory), raw).toBe(0);
    });
  }
});
