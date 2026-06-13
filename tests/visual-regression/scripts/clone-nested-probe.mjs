// tests/visual-regression/scripts/clone-nested-probe.mjs — Phase 45-07 runtime
// probe + pinned regression for WR-02 / WR-06.
//
// HISTORY: Task 1 used this probe to PROVE the WR-02 hazard empirically — the
// original Vue `$clone` lowering `structuredClone(toRaw(x))` THREW whenever `x`
// held an INDEPENDENT nested reactive proxy / ref (not just a plain reactive()
// tree), because a single top-level `toRaw` leaves nested proxies live and
// `structuredClone` rejects a Proxy. Svelte's `$state.snapshot` did NOT share
// the hole (it recursively de-proxies).
//
// Task 2 (DIRECTION A — FIX) replaced the Vue lowering with `rozieDeepClone(x)`
// from `@rozie/runtime-vue` — `structuredClone(deepToRaw(x))`, a recursive
// proxy-safe deep clone. This probe now executes the NEW emitted Vue shape
// (`rozieDeepClone`) against the same scenarios and asserts Vue is SAFE on ALL
// of them, bringing it to parity with Svelte. It is kept as the pinned
// regression: every scenario declares its expected verdict and the probe exits
// non-zero on any divergence.
//
//   S1  plain reactive() tree (the COMMON / always-safe case)
//   S2  reactive() tree with a nested INDEPENDENT reactive() proxy member
//   S3  reactive() tree with a nested ref()
//   S4  array of independent reactive() items
//   S5  FlowCanvas dogfood shape: clone src.data where src.data is a nested
//       reactive proxy (now $clone(src.data) directly — the historical
//       `{ d: src.data }).d` object-literal wrapper was removed in 45-07)
//
// Lives in tests/visual-regression because that package has `vue` + `svelte` +
// `@rozie/runtime-vue` as direct deps (Node module resolution is by file
// location, not cwd). The probe imports the REAL `rozieDeepClone` helper so it
// executes the exact runtime the emitted Vue SFCs call. Run:
//   node tests/visual-regression/scripts/clone-nested-probe.mjs
// (requires `turbo run build --filter @rozie/runtime-vue` first so dist exists).
//
// Node 22 provides a global structuredClone — the same algorithm the browser
// uses — so the verdict is environment-faithful.

import { reactive, ref } from 'vue';
import { rozieDeepClone } from '@rozie/runtime-vue';

let svelteSnapshot, svelteProxy;
try {
  // Svelte 5's compiled `$state.snapshot(x)` calls `snapshot`; `proxy` is the
  // helper compiled `$state(...)` uses to mint a reactive $state proxy. We probe
  // the public semantic: deep, recursively de-proxied, independent static copy
  // — including over REAL nested $state proxies (not just plain objects).
  ({ snapshot: svelteSnapshot, proxy: svelteProxy } = await import(
    'svelte/internal/client'
  ));
} catch {
  svelteSnapshot = null;
  svelteProxy = null;
}

const results = [];

// `expect` is the documented verdict for this scenario ('SAFE' | 'THROWS').
// The probe doubles as a regression pin: if any scenario's runtime verdict
// diverges from its documented expectation, the probe exits non-zero.
function run(name, expect, build, cloneFn) {
  const built = build();
  let verdict, detail, independent = null;
  try {
    const clone = cloneFn(built.value);
    verdict = 'SAFE';
    try {
      independent = built.checkIndependent ? built.checkIndependent(clone) : null;
    } catch (e) {
      independent = `indep-check-error: ${e.message}`;
    }
    detail = 'no throw';
  } catch (e) {
    verdict = 'THROWS';
    detail = `${e.constructor.name}: ${e.message}`;
  }
  results.push({ name, expect, verdict, independent, detail, ok: verdict === expect });
}

// ---- Vue: rozieDeepClone(x) — the NEW EMITTED shape (Phase 45-07) -----------
// Every scenario is now SAFE: the recursive deepToRaw walk inside rozieDeepClone
// strips nested INDEPENDENT reactive proxies / refs before structuredClone runs,
// so none of S2..S5 throws anymore. This is the regression pin for the fix.
const vueClone = (x) => rozieDeepClone(x);

// S1 — plain reactive() tree of plain nested objects (always-safe case).
run('Vue S1 plain reactive() tree', 'SAFE', () => {
  const state = reactive({ count: 1, nested: { label: 'a', deep: { n: 2 } } });
  return {
    value: state,
    checkIndependent: (clone) => {
      clone.nested.label = 'MUTATED';
      return state.nested.label === 'a';
    },
  };
}, vueClone);

// S2 — reactive() tree whose nested member is an INDEPENDENT reactive() proxy.
// PREVIOUSLY THREW under structuredClone(toRaw(x)); now SAFE + independent.
run('Vue S2 nested INDEPENDENT reactive() proxy', 'SAFE', () => {
  const inner = reactive({ label: 'a', deep: { n: 2 } });
  const state = reactive({ count: 1, box: { inner } });
  return {
    value: state,
    checkIndependent: (clone) => {
      clone.box.inner.label = 'MUTATED';
      return inner.label === 'a';
    },
  };
}, vueClone);

// S3 — reactive() tree whose nested member is a ref(). PREVIOUSLY THREW; now
// SAFE with the ref unwrapped to its inner value.
run('Vue S3 nested ref()', 'SAFE', () => {
  const r = ref({ label: 'a' });
  const state = reactive({ count: 1, box: { inner: r } });
  return {
    value: state,
    checkIndependent: (clone) => {
      // ref unwrapped: clone.box.inner is the plain { label } value.
      clone.box.inner.label = 'MUTATED';
      return r.value.label === 'a';
    },
  };
}, vueClone);

// S4 — array of independent reactive() items. PREVIOUSLY THREW; now SAFE.
run('Vue S4 array of independent reactive() items', 'SAFE', () => {
  const state = reactive({ items: [reactive({ id: 1 }), reactive({ id: 2 })] });
  return {
    value: state,
    checkIndependent: (clone) => {
      clone.items[0].id = 99;
      return state.items[0].id === 1;
    },
  };
}, vueClone);

// S5 — FlowCanvas dogfood shape, now simplified to $clone(src.data) directly
// (the historical `{ d: src.data }).d` wrapper was removed in 45-07). src.data
// is a nested INDEPENDENT reactive proxy. PREVIOUSLY THREW; now SAFE.
run('Vue S5 FlowCanvas $clone(src.data), src.data = nested reactive', 'SAFE', () => {
  const srcData = reactive({ label: 'node A', meta: reactive({ tag: 'x' }) });
  return {
    value: srcData,
    checkIndependent: (clone) => {
      clone.meta.tag = 'MUTATED';
      return srcData.meta.tag === 'x';
    },
  };
}, vueClone);

// S5b — same call shape but src.data is a SINGLE reactive() tree of plain
// objects (the benign case). SAFE + independent.
run('Vue S5b FlowCanvas $clone(src.data), src.data = plain reactive tree', 'SAFE', () => {
  const srcData = reactive({ label: 'node A', meta: { tag: 'x' } });
  return {
    value: srcData,
    checkIndependent: (clone) => {
      clone.label = 'MUTATED';
      return srcData.label === 'node A';
    },
  };
}, vueClone);

// ---- FlowCanvas reachability (WR-06) — mount + duplicate, all SAFE now ------
// Faithful reproduction of packages/ui/rete/src/FlowCanvas.rozie:
//   currentGraph() = $props.graph (a reactive prop on Vue)
//   lastWrittenGraph = $clone(currentGraph())   (seeded at mount)
//   baseGraph() = lastWrittenGraph ?? currentGraph()
//   duplicateNode: $clone(src.data)  where src = baseGraph().nodes.find(...)
// The historical hazard window (3) — duplicate while lastWrittenGraph == null
// so src.data is a LIVE proxy — is now SAFE because rozieDeepClone de-proxies
// recursively. The latent FlowCanvas throw is ELIMINATED, not merely masked.
{
  const consumerData = reactive({
    graph: {
      nodes: [{ id: 'a', type: 'step', x: 40, y: 60, data: { label: 'A', meta: { tag: 'x' } } }],
      connections: [],
    },
  });
  const propsGraph = consumerData.graph; // $props.graph as the canvas sees it (reactive)
  const currentGraph = () => propsGraph || { nodes: [], connections: [] };

  // (1) MOUNT: lastWrittenGraph = $clone(currentGraph()) → rozieDeepClone($props.graph)
  let lastWrittenGraph = null;
  run('FlowCanvas (1) MOUNT $clone(currentGraph())', 'SAFE', () => ({
    value: currentGraph(),
  }), (x) => {
    const c = rozieDeepClone(x);
    lastWrittenGraph = c; // seed, as the real mount IIFE does
    return c;
  });

  // (2) duplicateNode AFTER mount: baseGraph() = plain lastWrittenGraph → SAFE.
  run('FlowCanvas (2) duplicate AFTER mount [lastWrittenGraph plain]', 'SAFE', () => {
    const g = lastWrittenGraph != null ? lastWrittenGraph : currentGraph();
    const src = g.nodes.find((n) => n.id === 'a');
    return { value: src.data };
  }, vueClone);

  // (3) FORMER HAZARD WINDOW: duplicate when lastWrittenGraph == null → baseGraph()
  // falls through to currentGraph() = $props.graph → src.data is a LIVE proxy.
  // PREVIOUSLY THREW; now SAFE — the latent FlowCanvas throw is eliminated.
  run('FlowCanvas (3) duplicate w/ lastWrittenGraph=null [src.data LIVE proxy]', 'SAFE', () => {
    const g = currentGraph(); // the fallthrough branch
    const src = g.nodes.find((n) => n.id === 'a');
    return {
      value: src.data,
      checkIndependent: (clone) => {
        clone.meta.tag = 'MUTATED';
        return src.data.meta.tag === 'x';
      },
    };
  }, vueClone);
}

// ---- Svelte: $state.snapshot(x) — the EMITTED shape -------------------------
if (svelteSnapshot) {
  run('Svelte $state.snapshot plain nested tree', 'SAFE', () => {
    const obj = { count: 1, nested: { label: 'a', deep: { n: 2 } } };
    return {
      value: obj,
      checkIndependent: (clone) => {
        clone.nested.label = 'MUTATED';
        return obj.nested.label === 'a';
      },
    };
  }, (x) => svelteSnapshot(x));

  run('Svelte $state.snapshot nested INDEPENDENT (Vue) proxy member', 'SAFE', () => {
    const inner = reactive({ label: 'a', deep: { n: 2 } });
    const obj = { count: 1, box: { inner } };
    return { value: obj };
  }, (x) => svelteSnapshot(x));

  // Svelte's snapshot RECURSIVELY de-proxies a REAL nested $state proxy. This
  // was the original reference behavior Vue lacked under single-top-level-toRaw;
  // Vue now matches it via rozieDeepClone (see the Vue S2..S5 scenarios above).
  if (svelteProxy) {
    run('Svelte $state.snapshot REAL nested $state proxy', 'SAFE', () => {
      const inner = svelteProxy({ tag: 'x', deep: { n: 2 } });
      const obj = svelteProxy({ label: 'a', meta: inner, items: [svelteProxy({ id: 1 })] });
      return {
        value: obj,
        checkIndependent: (clone) => {
          clone.label = 'MUTATED';
          return obj.label === 'a';
        },
      };
    }, (x) => svelteSnapshot(x));
  }
} else {
  results.push({
    name: 'Svelte $state.snapshot',
    expect: 'SKIPPED',
    verdict: 'SKIPPED',
    independent: null,
    detail: 'svelte/internal/client snapshot not importable in this context',
    ok: true,
  });
}

// ---- Report -----------------------------------------------------------------
// The probe is a REGRESSION PIN: every scenario declares its documented verdict
// (`expect`). A divergence (e.g. a future Vue lowering change that makes a
// THROWS case SAFE, or vice-versa) flips `ok` and exits non-zero.
let anyMismatch = false;
let vueThrowCount = 0;
console.log('\n=== Phase 45-07 nested-reactive $clone probe ===\n');
for (const r of results) {
  if (!r.ok) anyMismatch = true;
  if (r.verdict === 'THROWS' && r.name.startsWith('Vue')) vueThrowCount++;
  const indep =
    r.independent === true
      ? 'independent'
      : r.independent === false
        ? 'NOT-independent'
        : r.independent == null
          ? ''
          : String(r.independent);
  const mark = r.ok ? '  ' : '!!';
  console.log(
    `${mark} ${r.verdict.padEnd(8)} (expect ${r.expect.padEnd(7)}) ${r.name}\n           ${r.detail}${indep ? `  [${indep}]` : ''}`,
  );
}
console.log(
  `\nWR-02/WR-06 HAZARD: ${vueThrowCount > 0 ? 'PRESENT' : 'ELIMINATED'} — ` +
    `${vueThrowCount} Vue scenario(s) threw under the rozieDeepClone lowering. ` +
    `Expected 0: rozieDeepClone recursively de-proxies, so no nested reactive ` +
    `proxy survives into structuredClone (Vue now at parity with Svelte).`,
);
console.log(
  `REGRESSION PIN: ${anyMismatch ? 'FAIL — a scenario diverged from its documented verdict' : 'PASS — all scenarios matched expectation'}\n`,
);
// Exit non-zero on ANY regression: a scenario diverged from its documented
// verdict, OR a Vue scenario threw (the 45-07 fix guarantees zero Vue throws).
process.exit(anyMismatch || vueThrowCount > 0 ? 1 : 0);
