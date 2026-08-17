// Phase 79 Plan 14 — AC-15 first half: zero-row / zero-column behaviour of
// the reworked `Table.rozie` producer.
//
// Hybrid two-stage assertion, mirroring `treenode-mount.test.ts`'s established
// shape (per that file's own header comment: "keeps the harness tractable in
// pure happy-dom + @vue/test-utils — no in-memory module loader for the
// cross-file `./Table.vue` import, which would require a bundler round-trip").
//
//   STAGE 1 — Structural: compile `examples/Table.rozie` via the public emit
//   path and assert the zero-row / zero-column branching survives emission:
//     - `v-if="props.rows.length > 0"` / `<tbody v-else>` — the row-count
//       gate that AC-15's zero-rows half depends on
//     - `<td v-for="column in props.columns">` — the per-column cell loop
//       that AC-15's zero-columns half depends on (0 columns → 0 iterations)
//     - the new `cell-${column.key}` dynamic-name family with the shared
//       `cell` slot nested as its own fallback (D-01)
//
//   STAGE 2 — Functional: mount a runtime-equivalent Vue component against
//   happy-dom, built to the SAME branching shape Stage 1 just verified in the
//   real emitted source, and assert:
//     - zero rows (`rows: []`) → the `empty` slot's fallback content ("No
//       data") renders, and no per-row cell content is present
//     - zero columns (`columns: []`, non-empty rows) → NO `<td>` cell element
//       renders at all (the per-column `<td v-for="column in columns">` loop
//       iterates zero times)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitVue } from '../src/emitVue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const TABLE_ROZIE = resolve(REPO_ROOT, 'examples/Table.rozie');

function compileTable(): { code: string } {
  const src = readFileSync(TABLE_ROZIE, 'utf8');
  const parsed = parse(src, { filename: TABLE_ROZIE });
  if (!parsed.ast) {
    throw new Error(`parse() returned null AST: ${parsed.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  const ir: IRComponent = lowered.ir;
  const { code, diagnostics } = emitVue(ir, { filename: TABLE_ROZIE, source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return { code };
}

interface Column {
  key: string;
  label: string;
}
interface Row {
  [key: string]: unknown;
}

describe('Table (Phase 79-14 rework) — zero-row / zero-column emission + mount (AC-15)', () => {
  // Stage 1 — emit-side structural assertions.
  it('emitted Vue template preserves the row-count gate and the per-column cell loop', () => {
    const { code } = compileTable();
    expect(code).toMatch(/v-if="props\.rows\.length > 0"/);
    expect(code).toMatch(/<tbody v-else>/);
    expect(code).toMatch(/<td v-for="column in props\.columns"/);
  });

  it('emitted Vue template carries the cell-${column.key} family with the shared cell slot nested as its fallback (D-01)', () => {
    const { code } = compileTable();
    expect(code).toMatch(/:name="`cell-\$\{column\.key\}`"/);
    expect(code).toMatch(/<slot name="cell"/);
  });

  // Stage 2 — runtime mount assertions (AC-15, first half).
  //
  // Runtime-equivalent component shape mirroring the emitted Vue template
  // exactly: `v-if="rows.length > 0"` tbody / `v-else` tbody with an `empty`
  // slot default ("No data"), and a `<td v-for="column in columns">` per-row
  // cell loop. Slots are represented via the component's own `default`
  // rendering (no external filler needed — Table's own fallback content IS
  // the behaviour under test).
  const RuntimeTable = defineComponent({
    name: 'RuntimeTable',
    props: {
      rows: { type: Array as () => Row[], default: () => [] },
      columns: { type: Array as () => Column[], default: () => [] },
    },
    render() {
      const { rows, columns } = this;
      if (rows.length > 0) {
        return h(
          'table',
          { class: 'rozie-table' },
          h(
            'tbody',
            rows.map((row, rowIndex) =>
              h(
                'tr',
                { key: rowIndex },
                columns.map((column) =>
                  h(
                    'td',
                    { key: column.key, class: 'cell' },
                    String((row as Record<string, unknown>)[column.key] ?? ''),
                  ),
                ),
              ),
            ),
          ),
        );
      }
      return h(
        'table',
        { class: 'rozie-table' },
        h('tbody', h('tr', h('td', { colspan: columns.length }, 'No data'))),
      );
    },
  });

  it('zero rows: the empty slot fallback ("No data") renders', () => {
    const wrapper = mount(RuntimeTable, {
      props: { rows: [], columns: [{ key: 'name', label: 'Name' }] },
    });
    expect(wrapper.text()).toContain('No data');
    // No per-row cell content — the empty branch, not the data branch, rendered.
    expect(wrapper.findAll('td.cell')).toHaveLength(0);
    wrapper.unmount();
  });

  it('zero columns: no cell slots render at all', () => {
    const wrapper = mount(RuntimeTable, {
      props: {
        rows: [{ id: 1, name: 'Alpha' }],
        columns: [],
      },
    });
    // rows.length > 0, so the data branch renders a <tr> per row — but with
    // zero columns the per-column `<td>` loop iterates zero times.
    expect(wrapper.findAll('tr')).toHaveLength(1);
    expect(wrapper.findAll('td')).toHaveLength(0);
    wrapper.unmount();
  });
});
