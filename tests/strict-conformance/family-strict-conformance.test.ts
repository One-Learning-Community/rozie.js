/**
 * FAMILY-STRICT-CONFORMANCE — Layer-3 baseline-split strict-tsc gate over the
 * committed @rozie-ui React/Solid/Lit family leaf bodies (Phase 65, Plan 03).
 *
 * Mirror of tests/vue-typecheck/family-children.test.ts (the Bundle-A
 * reported/baseline-split pattern), but driving PLAIN `tsc --noEmit` under the
 * THREE strict flags the leaf tsconfigs currently RELAX (`strictNullChecks` +
 * `noImplicitAny` + `exactOptionalPropertyTypes`) over each leaf's committed
 * `src/*.{tsx,ts}` (react/solid emit `.tsx`, lit emits `.ts`). Reuses the 65-01
 * harness (`typecheckLeaf`: tmpdir copy + symlinked LEAF node_modules + pinned
 * tsc, `parseErrors` keyed `file → { TScode → count }`).
 *
 * ── WHY EVERY LEAF CARRIES A BASELINE (none enforced-clean YET) ───────────────
 * The empirical post-65-01/02 state (captured 2026-06-29) is that NO react/solid/
 * lit leaf — including the combobox/slider/listbox "canaries" — is fully strict-
 * clean. 65-01 (Class 1: nullable-prop→attr) and 65-02 (Class 2/5: narrow signal/
 * `<data>` defaults) ARE fixed and their dedicated witnesses stay GREEN — but the
 * leaf bodies still carry INHERENT residual that this phase explicitly does NOT
 * fix (65-CONTEXT scope fence):
 *   - Class 3 (TS2339 `Property … does not exist on type 'never'`) — was the shared
 *     `windowing.rzts` `return null`→`never`-narrowed helper, dominant in combobox +
 *     listbox (8 each × 3 targets). CLEARED by Plan 04 (the `pinMeasurement` typed
 *     wrapper retype in headless-core/windowing.rzts gives the host pin-hook read a
 *     real object-or-null shape, so `pm && pm.start` keeps the object branch). The
 *     TS2339 counts have been removed from the baselines below; listbox/lit reached
 *     zero and is now ENFORCED CLEAN ({}).
 *   - Class 4 (TS2531 / TS18047 / TS18046 / the `… not assignable to 'null'`
 *     TS2322/TS2345 from member-mutated body consts like `const foCache = {…null}`)
 *     — body-passthrough nullability. Inherent; CONTEXT forbids blanket
 *     `as any`/`!` to zero it.
 *   - Class 6 (TS7006 / TS7053 / TS7022/3/4 / TS2379) — the noImplicitAny /
 *     implicit-index tail. Inherent body-passthrough; out of scope.
 * So strict-flag RE-ENABLE in the leaf tsconfigs is (for Plan 03) EMPTY — turning
 * the flags on would make each leaf's own typecheck RED on this inherent residual.
 * Instead this gate LOCKS the residual: it is the durable regression boundary
 * that keeps the inherent inventory from silently rotting and forces a baseline
 * tightening the moment any emitter/authoring fix (Plan 04+) reduces it.
 *
 * ── BASELINE-SPLIT SEMANTICS (mirror of family-children.test.ts) ──────────────
 *   - Each leaf declares a BASELINE of its current strict errors, keyed
 *     `file → { TScode → count }` (counts, NOT line numbers — robust to the line
 *     shifts a routine regen produces).
 *   - The gate asserts the LIVE per-file/per-code counts EQUAL the baseline.
 *   - MORE errors (regression: new file/code/higher count) flips RED.
 *   - FEWER errors (an emitter/authoring fix improved a leaf) ALSO flips RED —
 *     intentional: it forces whoever improves the emitter to TIGHTEN this
 *     baseline (and, ideally, delete it → switch to `{}`) rather than let the
 *     gate rot.
 *   - A leaf with an EMPTY baseline ({}) is ENFORCED CLEAN — any error fails.
 *     (None today; this is the target state as Plans 04+ shrink the residual.)
 *
 * Baselines captured 2026-06-29 from the 65-01 strict harness (strict +
 * strictNullChecks + noImplicitAny + exactOptionalPropertyTypes) over each
 * leaf's committed src. Tighten/delete per the IMPROVEMENT-flips-RED rule above.
 */
import { describe, it, expect } from 'vitest';
import {
  typecheckLeaf,
  totalErrors,
  type Inventory,
  type LeafSpec,
} from './strict-conformance.harness.js';

interface FamilySpec extends LeafSpec {
  /**
   * Currently-known strict-typecheck errors, keyed file → code → count. RECORDED,
   * NOT FIXED here (inherent Class 3/4/6 residual — see module docblock). Empty
   * ({}) = ENFORCED CLEAN.
   */
  baseline: Inventory;
}

const FAMILIES: FamilySpec[] = [
  // ── combobox ── Class-3 windowing (TS2339 ×8/target, → Plan 04) + Class-4
  // foCache body-const nullability (TS2322 `… to 'null'`, TS2531, TS18047) +
  // Class-6 tail (react TS7006/TS2345). NOT the Class-1/2 signatures (those are
  // fixed; witnesses green).
  {
    name: 'combobox',
    target: 'react',
    leaf: 'packages/ui/combobox/packages/react',
    baseline: {
      'Combobox.tsx': {
        // combobox-virtual-reactivity: windowedView() added a 6th windowSource()
        // call site — one more occurrence of the KNOWN Class-4 nullable-return
        // body-noise class (TS2531), do-not-fix-here per this file's scope fence.
        TS2531: 6,
        // TS2339 ×8 (Class-3 windowing) CLEARED by Plan 04 (windowing.rzts pinMeasurement retype).
        // 260714-nqe: Function-prop TS lowering flipped `unknown`→`any` (optionLabel/
        // optionValue/optionDisabled) shifted 2 more body-passthrough nullability
        // sites into tsc's reach (TS2322 4→5, TS18047 4→6) — inherent Class-4
        // residual, unrelated to the emitter fix itself.
        // Quick 260717-8zb: filteredOptions() re-expressed on $memo(fn, keyFn)
        // shifted the null-initialized cache-object shape (`{ keys: null, val:
        // null, has: false }` vs the old hand-rolled foCache's individually
        // typed fields) — tsc's strict null-check narrowing sees
        // filteredOptionsCache.keys/.val differently across the .has-gated
        // branches, moving 3 sites from TS2322 into TS18047 (5→2, 6→8). Inherent
        // Class-4 residual from the new cache shape, unrelated to any emitter
        // change — do-not-fix-here per this file's scope fence.
        TS2322: 2,
        TS2345: 1,
        TS18047: 8,
        TS7006: 1,
      },
    },
  },
  {
    name: 'combobox',
    target: 'solid',
    leaf: 'packages/ui/combobox/packages/solid',
    baseline: {
      'Combobox.tsx': {
        // TS2339 ×8 (Class-3 windowing) CLEARED by Plan 04.
        // 260712-a09 (Pattern D): the onMount ref-call non-null assertion
        // shifted which downstream body-passthrough nullability sites tsc
        // reaches (TS2349 cleared; TS2322/TS2531/TS18047/TS2769 now visible
        // instead) — inherent Class-4 residual, unrelated to Pattern D/F
        // itself, do-not-fix-here per this file's scope fence.
        // 260714-nqe: Function-prop TS lowering flipped `unknown`→`any`
        // shifted 2 more sites into tsc's reach (TS2322 4→5, TS18047 4→6).
        // Quick 260717-8zb: same $memo(fn, keyFn) cache-shape shift as the
        // react leaf above (TS2322 5→2, TS18047 6→8) — do-not-fix-here.
        TS2322: 2,
        // combobox-virtual-reactivity: windowedView() added a 6th windowSource()
        // call site — one more occurrence of the KNOWN Class-4 nullable-return
        // body-noise class (TS2531), do-not-fix-here per this file's scope fence.
        TS2531: 5,
        TS18047: 8,
        TS2769: 1,
      },
    },
  },
  {
    name: 'combobox',
    target: 'lit',
    leaf: 'packages/ui/combobox/packages/lit',
    baseline: {
      'Combobox.ts': {
        TS2769: 1,
        // combobox-virtual-reactivity: windowedView() added a 6th windowSource()
        // call site — one more occurrence of the KNOWN Class-4 nullable-return
        // body-noise class (TS2531), do-not-fix-here per this file's scope fence.
        // Quick 260717-8zb: the $memo(fn, keyFn) cache-shape shift (see the
        // react/solid leaves above) moved 3 sites from TS2322 into TS2531 on
        // Lit specifically (5→7) — do-not-fix-here.
        TS2531: 7,
        // TS2339 ×8 (Class-3 windowing) CLEARED by Plan 04.
        // 260714-nqe: Function-prop TS lowering flipped `unknown`→`any`
        // shifted 2 more sites into tsc's reach (TS2322 5→6, TS18047 4→6).
        // Quick 260717-8zb: $memo cache-shape shift, TS2322 6→3.
        TS2322: 3,
        TS18047: 6,
      },
    },
  },

  // ── slider ── NO windowing (no Class-3). Pure Class-4 body-passthrough
  // nullability (TS2531/TS18047) + solid Class-6 unknown-tail (TS18046/TS2349).
  {
    name: 'slider',
    target: 'react',
    leaf: 'packages/ui/slider/packages/react',
    baseline: {
      'Slider.tsx': {
        TS18047: 2,
        TS2531: 2,
      },
    },
  },
  {
    name: 'slider',
    target: 'solid',
    leaf: 'packages/ui/slider/packages/solid',
    baseline: {
      'Slider.tsx': {
        TS18046: 2,
        // TS2349 cleared 260712-a09 (Pattern F object/array-prop default cast).
        TS18047: 2,
        TS2531: 2,
      },
    },
  },
  {
    name: 'slider',
    target: 'lit',
    leaf: 'packages/ui/slider/packages/lit',
    baseline: {
      'Slider.ts': {
        TS18047: 2,
        TS2531: 2,
      },
    },
  },

  // ── listbox ── Was almost entirely Class-3 windowing (TS2339 ×8/target);
  // Plan 04 (windowing.rzts pinMeasurement retype) CLEARED it. react keeps a
  // single Class-6 tail (TS7006); solid a single TS2349; lit is now ENFORCED
  // CLEAN ({}) — the first leaf to reach zero.
  {
    name: 'listbox',
    target: 'react',
    leaf: 'packages/ui/listbox/packages/react',
    baseline: {
      'Listbox.tsx': {
        // TS2339 ×8 (Class-3 windowing) CLEARED by Plan 04.
        TS7006: 1,
      },
    },
  },
  {
    name: 'listbox',
    target: 'solid',
    leaf: 'packages/ui/listbox/packages/solid',
    // ENFORCED CLEAN: TS2339 ×8 (Class-3 windowing) CLEARED by Plan 04; the
    // remaining TS2349 cleared 260712-a09 (Pattern F object/array-prop
    // default cast). Empty baseline ({}) — ANY strict error now fails this leaf.
    baseline: {},
  },
  {
    name: 'listbox',
    target: 'lit',
    leaf: 'packages/ui/listbox/packages/lit',
    // ENFORCED CLEAN: Plan 04 cleared the only residual (TS2339 ×8 Class-3
    // windowing). Empty baseline ({}) — ANY strict error now fails this leaf.
    baseline: {},
  },

  // ── data-table ── the inherent-residual heavyweight (Classes 3/4/6 mixed).
  // Class 3 shrinks when Plan 04 lands the windowing fix; the rest is body-
  // passthrough Class 4/6 (TS7053 implicit-index, TS2345 narrow-default fallout,
  // TS7006/7022/7023/7024 noImplicitAny tail). Locked, do-not-fix-here.
  {
    name: 'data-table',
    target: 'react',
    leaf: 'packages/ui/data-table/packages/react',
    baseline: {
      'DataTable.tsx': {
        TS7023: 1,
        TS7022: 1,
        // 9 → 11 (260708-ni6, grid pointer §1): the two new `isActiveCell(...)` header
        // calls mirror `cellTabindex`'s existing `level = null` param shape (a `number`
        // hgLevel passed to a param TS narrows to `null`) — the identical inherent
        // strict-null residual already recorded for cellTabindex's header calls.
        TS2345: 11,
        TS7053: 4,
        TS2379: 1,
        TS7006: 12,
        TS2322: 4,
      },
      'DetailPanel.tsx': {
        TS7053: 2,
      },
    },
  },
  {
    name: 'data-table',
    target: 'solid',
    leaf: 'packages/ui/data-table/packages/solid',
    baseline: {
      'DataTable.tsx': {
        // 11 → 13 (260708-ni6, grid pointer §1): the two new `isActiveCell(...)` header
        // calls mirror `cellTabindex`'s existing `level = null` inherent strict-null shape.
        // 13 → 11 (260712-kl1): `createControllableSignal<T>` now widens to `T | null`
        // for a literal `default: null` model prop — `expanded`/`grouping` (2 sites)
        // no longer TS2345 (`null` not assignable to `T`) under strictNullChecks.
        TS2345: 11,
        TS2379: 1,
        TS7023: 1,
        TS7022: 1,
        TS7053: 4,
        // TS2322 (2) cleared 2026-07-05: the rozieAttr nullish-union type fix
        // (a nullish member of a mixed string-literal union now maps to `never`,
        // not `string`) narrows the two role/aria attr bindings that previously
        // widened to `string` and tripped Solid's strict AriaRole union.
        TS7006: 2,
      },
      'DetailPanel.tsx': {
        TS7053: 2,
      },
      // GroupBar.tsx TS2345/TS2322 cleared 260712-a09 (Pattern D onMount
      // ref-call non-null assertion + Pattern F object/array-prop default
      // cast) — the file is now strict-clean, so it's dropped from this
      // leaf's baseline entirely.
    },
  },
  {
    name: 'data-table',
    target: 'lit',
    leaf: 'packages/ui/data-table/packages/lit',
    baseline: {
      'DataTable.ts': {
        TS2322: 1,
        TS2379: 1,
        // 9 → 11 (260708-ni6, grid pointer §1): the two new `isActiveCell(...)` header
        // calls mirror `cellTabindex`'s existing `level = null` inherent strict-null shape.
        TS2345: 11,
        TS7006: 2,
        TS7024: 1,
        TS7022: 1,
        TS7053: 4,
      },
      'DetailPanel.ts': {
        TS7053: 2,
      },
    },
  },
];

/**
 * Diff live inventory against baseline. Returns human-readable mismatch lines
 * (empty = exact match). A mismatch is any of: a file with errors absent from
 * the baseline, a missing baseline file, a new/missing error code, or a count
 * delta. Flags BOTH directions (REGRESSION on increase, IMPROVED on decrease).
 */
function diffAgainstBaseline(live: Inventory, baseline: Inventory): string[] {
  const mismatches: string[] = [];
  const files = new Set([...Object.keys(live), ...Object.keys(baseline)]);
  for (const file of [...files].sort()) {
    const liveCodes = live[file] ?? {};
    const baseCodes = baseline[file] ?? {};
    const codes = new Set([...Object.keys(liveCodes), ...Object.keys(baseCodes)]);
    for (const code of [...codes].sort()) {
      const lc = liveCodes[code] ?? 0;
      const bc = baseCodes[code] ?? 0;
      if (lc !== bc) {
        const verb = lc > bc ? 'REGRESSION' : 'IMPROVED (tighten baseline)';
        mismatches.push(`  ${file} ${code}: live=${lc} baseline=${bc}  [${verb}]`);
      }
    }
  }
  return mismatches;
}

describe('FAMILY-STRICT-CONFORMANCE — strict tsc over @rozie-ui react/solid/lit family leaf bodies (Plan 03 baseline lock)', () => {
  for (const spec of FAMILIES) {
    const baselineTotal = totalErrors(spec.baseline);
    const label =
      baselineTotal === 0
        ? `${spec.name}/${spec.target}: leaf body is strict-clean (enforced)`
        : `${spec.name}/${spec.target}: strict errors match the recorded baseline (${baselineTotal} known, do-not-fix-here)`;

    it(label, () => {
      const { inventory } = typecheckLeaf(spec);
      const mismatches = diffAgainstBaseline(inventory, spec.baseline);
      expect(
        mismatches,
        `[${spec.name}/${spec.target}] strict-typecheck inventory drifted from the recorded baseline.\n` +
          `If you ADDED an error, that is a regression — fix it.\n` +
          `If you FIXED emitter/authoring residual (e.g. Plan 04 windowing), tighten/remove this leaf's baseline in family-strict-conformance.test.ts ` +
          `(and switch it to {} once it reaches zero so it becomes enforced-clean).\n` +
          mismatches.join('\n'),
      ).toEqual([]);
    });
  }
});
