// tests/visual-regression/scripts/clone-nested-probe.mjs — Phase 45-07 runtime
// probe for WR-02 / WR-06.
//
// PURPOSE: prove or disprove the WR-02 hazard empirically. Does the Vue `$clone`
// lowering `structuredClone(toRaw(x))` actually THROW when `x` holds an
// INDEPENDENT nested reactive proxy / ref (not just a plain reactive() tree)?
//
// This executes the EXACT emitted Vue shape `structuredClone(toRaw(x))` and the
// Svelte shape `$state.snapshot(x)` at runtime against real Vue reactive proxies
// across the scenarios WR-02 / WR-06 call out:
//
//   S1  plain reactive() tree (the COMMON / documented-safe case)
//   S2  reactive() tree with a nested INDEPENDENT reactive() proxy member
//   S3  reactive() tree with a nested ref()
//   S4  array of independent reactive() items
//   S5  FlowCanvas dogfood shape: $clone({ d: src.data }).d where src.data is a
//       nested reactive proxy (object-literal wrapper, then unwrap .d)
//
// Lives in tests/visual-regression because that package has `vue` + `svelte` as
// direct deps (Node module resolution is by file location, not cwd). Run:
//   node tests/visual-regression/scripts/clone-nested-probe.mjs
//
// Node 22 provides a global structuredClone — the same algorithm the browser
// uses — so the verdict is environment-faithful.

import { reactive, toRaw, ref } from 'vue';

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

// ---- Vue: structuredClone(toRaw(x)) — the EMITTED shape ----------------------
const vueClone = (x) => structuredClone(toRaw(x));

// S1 — plain reactive() tree of plain nested objects (documented-safe case).
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
run('Vue S2 nested INDEPENDENT reactive() proxy', 'THROWS', () => {
  const inner = reactive({ label: 'a', deep: { n: 2 } });
  const state = reactive({ count: 1, box: { inner } });
  return { value: state };
}, vueClone);

// S3 — reactive() tree whose nested member is a ref().
run('Vue S3 nested ref()', 'THROWS', () => {
  const r = ref({ label: 'a' });
  const state = reactive({ count: 1, box: { inner: r } });
  return { value: state };
}, vueClone);

// S4 — array of independent reactive() items.
run('Vue S4 array of independent reactive() items', 'THROWS', () => {
  const state = reactive({ items: [reactive({ id: 1 }), reactive({ id: 2 })] });
  return { value: state };
}, vueClone);

// S5 — FlowCanvas dogfood shape: $clone({ d: src.data }).d where src.data is a
// nested INDEPENDENT reactive proxy.
// Emitted Vue: structuredClone(toRaw({ d: src.data })).d
run('Vue S5 FlowCanvas $clone({ d: src.data }).d, src.data = nested reactive', 'THROWS', () => {
  const srcData = reactive({ label: 'node A', meta: reactive({ tag: 'x' }) });
  return { value: { d: srcData } };
}, (x) => structuredClone(toRaw(x)).d);

// S5b — same shape but src.data is a SINGLE reactive() tree of plain objects
// (the benign case the wrapper was likely written for).
run('Vue S5b FlowCanvas $clone({ d: src.data }).d, src.data = plain reactive tree', 'THROWS', () => {
  const srcData = reactive({ label: 'node A', meta: { tag: 'x' } });
  return {
    value: { d: srcData },
    checkIndependent: (clone) => {
      clone.label = 'MUTATED';
      return srcData.label === 'node A';
    },
  };
}, (x) => structuredClone(toRaw(x)).d);

// ---- FlowCanvas reachability (WR-06) — mount vs duplicate-fallthrough -------
// Faithful reproduction of packages/ui/rete/src/FlowCanvas.rozie:
//   currentGraph() = $props.graph (a reactive prop on Vue)
//   lastWrittenGraph = $clone(currentGraph())   (seeded at mount)
//   baseGraph() = lastWrittenGraph ?? currentGraph()
//   duplicateNode: $clone({ d: src.data }).d  where src = baseGraph().nodes.find(...)
{
  const consumerData = reactive({
    graph: {
      nodes: [{ id: 'a', type: 'step', x: 40, y: 60, data: { label: 'A', meta: { tag: 'x' } } }],
      connections: [],
    },
  });
  const propsGraph = consumerData.graph; // $props.graph as the canvas sees it (reactive)
  const currentGraph = () => propsGraph || { nodes: [], connections: [] };

  // (1) MOUNT: lastWrittenGraph = $clone(currentGraph()) → structuredClone(toRaw($props.graph))
  let lastWrittenGraph = null;
  run('FlowCanvas (1) MOUNT $clone(currentGraph()) [top-level toRaw]', 'SAFE', () => ({
    value: currentGraph(),
  }), (x) => {
    const c = structuredClone(toRaw(x));
    lastWrittenGraph = c; // seed, as the real mount IIFE does
    return c;
  });

  // (2) duplicateNode AFTER mount: baseGraph() = plain lastWrittenGraph → src.data plain → SAFE
  run('FlowCanvas (2) duplicate AFTER mount [lastWrittenGraph plain]', 'SAFE', () => {
    const g = lastWrittenGraph != null ? lastWrittenGraph : currentGraph();
    const src = g.nodes.find((n) => n.id === 'a');
    return { value: { d: src.data } };
  }, (x) => structuredClone(toRaw(x)).d);

  // (3) HAZARD WINDOW: duplicate when lastWrittenGraph == null → baseGraph() falls
  // through to currentGraph() = $props.graph → src.data is a LIVE proxy → THROWS.
  run('FlowCanvas (3) duplicate w/ lastWrittenGraph=null [src.data LIVE proxy]', 'THROWS', () => {
    const g = currentGraph(); // the fallthrough branch
    const src = g.nodes.find((n) => n.id === 'a');
    return { value: { d: src.data } };
  }, (x) => structuredClone(toRaw(x)).d);
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

  // The decisive cross-target contrast: a REAL nested $state proxy. Svelte's
  // snapshot RECURSIVELY de-proxies (where Vue's single top-level toRaw does
  // not) — proving Svelte does NOT share the Vue hole.
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
  `\nWR-02/WR-06 HAZARD: ${vueThrowCount > 0 ? 'CONFIRMED' : 'NOT observed'} — ` +
    `${vueThrowCount} Vue scenario(s) throw "could not be cloned" under structuredClone(toRaw(x)) ` +
    `when x is / contains a live nested reactive proxy.`,
);
console.log(
  `REGRESSION PIN: ${anyMismatch ? 'FAIL — a scenario diverged from its documented verdict' : 'PASS — all scenarios matched expectation'}\n`,
);
// Exit non-zero ONLY on a regression (verdict != documented expectation), not on
// the (expected, documented) hazard throws.
process.exit(anyMismatch ? 1 : 0);
