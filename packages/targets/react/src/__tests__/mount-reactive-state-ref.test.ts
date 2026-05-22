/**
 * mount-reactive-state-ref.test.ts — regression for 260521 sortable-stale-state.
 *
 * React stale-closure defect surfaced by the SortableJS engine-wrapper example
 * (examples/SortableList.rozie):
 *
 *   - A `$onMount` hook lowers to `useEffect(() => {...}, [])` — mount-once, by
 *     contract (the `linechart-watch-recreate` fix; the other five targets run
 *     mount hooks exactly once structurally, React only via the `[]` dep array).
 *   - Inside that mount effect a long-lived engine callback closure is created
 *     ONCE. If its body reads reactive STATE / MODEL via a plain destructured
 *     `const items` from `useControllableState` / `useState`, that closure
 *     permanently captures the FIRST-render value — every later invocation acts
 *     on a stale snapshot.
 *   - The other five targets are immune: they read bound state through a LIVE
 *     accessor (`.value` / signal call / getter) that a mount-once closure
 *     still resolves freshly. Only React destructures a frozen plain value.
 *
 * Fix: the React emitter already routes watched-PROP reads inside `[]`-dep
 * effects through a synced ref (`_<X>Ref.current`, kept current via
 * `_<X>Ref.current = <X>` during render). This regression pins that the same
 * ref-sync machinery now also covers reactive state/model reads from a
 * mount-phase hook body — so the closure reads the latest value, not a frozen
 * const. A `$onUpdate` hook (which keeps its real dep array, so React
 * re-creates its closures on state change) is the negative control: it is NOT
 * rewritten.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitScript } from '../emit/emitScript.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function lower(src: string): IRComponent {
  const result = parse(src, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(src: string): { hookSection: string; lifecycleEffectsSection: string } {
  const ir = lower(src);
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const { hookSection, lifecycleEffectsSection } = emitScript(ir, collectors);
  return { hookSection, lifecycleEffectsSection };
}

describe('React mount-phase reactive-state synced ref (260521 sortable-stale-state)', () => {
  it('routes a model-prop read inside a $onMount engine callback through _<X>Ref.current', () => {
    // Minimal reproduction of the SortableList shape: a `model: true` array
    // prop read from a long-lived callback registered inside `$onMount`.
    const SRC = `<rozie name="MountModelProbe">
<props>
{
  items: { type: Array, default: () => [], model: true },
}
</props>
<script>
let engine = null
$onMount(() => {
  engine = {
    register(cb) { this.cb = cb },
  }
  engine.register(() => {
    const snapshot = [...$props.items]
    return snapshot.length
  })
})
</script>
<template><div>{{ $props.items }}</div></template>
</rozie>`;
    const { hookSection, lifecycleEffectsSection } = emit(SRC);

    // A synced ref is declared AFTER the useControllableState destructure.
    expect(hookSection).toContain(
      'const _itemsRef = useRef(items);\n_itemsRef.current = items;',
    );
    const refIdx = hookSection.indexOf('const _itemsRef = useRef(items);');
    const ucsIdx = hookSection.indexOf('useControllableState({');
    expect(ucsIdx).toBeGreaterThanOrEqual(0);
    expect(refIdx).toBeGreaterThan(ucsIdx);

    // The mount effect is `[]`-dep (mount-once) and the closure body reads the
    // synced ref, NOT the frozen `items` destructured const.
    expect(lifecycleEffectsSection).toContain('const snapshot = [..._itemsRef.current];');
    expect(lifecycleEffectsSection).not.toContain('const snapshot = [...items];');
    expect(lifecycleEffectsSection).toMatch(/}, \[\]\);/);
  });

  it('routes a $data state read inside a $onMount callback through a deferred _<X>Ref (declared after useState)', () => {
    const SRC = `<rozie name="MountStateProbe">
<data>
{
  rows: [],
}
</data>
<script>
let engine = null
$onMount(() => {
  engine = {
    register(cb) { this.cb = cb },
  }
  engine.register(() => {
    const copy = [...$data.rows]
    return copy.length
  })
})
</script>
<template><div>{{ $data.rows }}</div></template>
</rozie>`;
    const { hookSection, lifecycleEffectsSection } = emit(SRC);

    // The synced ref for a `<data>`/useState name must land AFTER the useState
    // declaration it references — emitting it before would be a TDZ
    // ReferenceError at render.
    expect(hookSection).toContain(
      'const _rowsRef = useRef(rows);\n_rowsRef.current = rows;',
    );
    const useStateIdx = hookSection.indexOf('const [rows, setRows] = useState');
    const refIdx = hookSection.indexOf('const _rowsRef = useRef(rows);');
    expect(useStateIdx).toBeGreaterThanOrEqual(0);
    expect(refIdx).toBeGreaterThan(useStateIdx);

    // The mount closure reads the live ref, not the frozen useState const.
    expect(lifecycleEffectsSection).toContain('const copy = [..._rowsRef.current];');
    expect(lifecycleEffectsSection).not.toContain('const copy = [...rows];');
  });

  it('does NOT rewrite a $data read inside a $onUpdate hook (negative control — update keeps live deps)', () => {
    // An `$onUpdate` hook keeps its real dep array, so React re-creates the
    // effect (and any closure inside it) when the watched state changes —
    // there is no mount-once frozen closure to defend against. The rewrite is
    // mount-phase only.
    const SRC = `<rozie name="UpdateStateProbe">
<data>
{
  rows: [],
}
</data>
<script>
$onUpdate(() => {
  const copy = [...$data.rows]
  console.log(copy.length)
})
</script>
<template><div>{{ $data.rows }}</div></template>
</rozie>`;
    const { hookSection, lifecycleEffectsSection } = emit(SRC);

    // No synced ref is emitted for an update-phase read.
    expect(hookSection).not.toContain('_rowsRef');
    // The update effect reads the plain reactive `rows` binding directly.
    expect(lifecycleEffectsSection).toContain('const copy = [...rows];');
    expect(lifecycleEffectsSection).not.toContain('_rowsRef.current');
  });
});
