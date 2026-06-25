/**
 * Phase 61 Plan 07 (SC-2, Vue leg) — internal-kind ↔ generated-binding /
 * vue-import deconfliction.
 *
 * collision-vue §3 risks 2 + 3: today the Vue `vueGroups` deconfliction pass
 * (rewriteScript.ts) only covers a `<name>` param/local shadowing the THREE
 * lowered-to-bare symbols (model props / `$data` keys / `$computed`). A plain
 * `<data>`/helper/import/inject-local named a GENERATED `<script setup>` binding
 * (`props`/`emit`/`slots`/`portals`/`portalContainers`) or a `'vue'`/runtime-vue
 * import (`ref`/`computed`/`watch`/…) is NOT renamed → the emitted SFC carries
 * two same-named top-level `const`s → TS2451 (redeclare) / TS2440 (import shadow)
 * at vue-tsc (gate 3).
 *
 * This pass extends `vueGroups` with a `{ kind: 'binding' }` group seeded from
 * `VUE_EMITTER_BINDINGS ∪ VUE_IMPORT_NAMES ∪ VUE_RUNTIME_IMPORTS` (the single
 * source of truth in `@rozie/core/rewrite/reservedNames.ts`). The renameable
 * side is ALWAYS the USER binding (`X$local`); the generated binding / import is
 * the contract and stays intact. `$expose` verbs are public contract — never
 * renamed.
 *
 * RED-first: this file is authored BEFORE the Task-2 emitter change. The
 * `VueDataBindingShadow.rozie` fixture has `<data>` fields named `slots` + `emit`
 * (both forcing the generated `const slots = useSlots()` / `const emit =
 * defineEmits(...)` bindings to exist via a `$slots.footer` read + a `$emit`
 * call) — pre-fix this duplicates `const slots` / `const emit` (TS2451). Post-fix
 * the data fields rename to `slots$local` / `emit$local` and the generated
 * bindings are intact.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitVue } from '../../emitVue.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../__tests__/fixtures');

function compileVue(src: string, filename = 'Test.rozie'): string {
  const { ast } = parse(src, { filename });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitVue(ir, { filename, source: src });
  return result.code;
}

/** Count top-level `const <name> =` (or `let`) declarations of an exact name. */
function countTopLevelConst(code: string, name: string): number {
  const re = new RegExp(`^(?:const|let)\\s+${name}\\s*[=:]`, 'gm');
  return (code.match(re) ?? []).length;
}

describe('Vue internal-kind ↔ generated-binding deconfliction (61-07, SC-2)', () => {
  const FIXTURE = readFileSync(
    resolve(FIXTURES, 'VueDataBindingShadow.rozie'),
    'utf8',
  );

  it('fixture parses + lowers + emits', () => {
    expect(() => compileVue(FIXTURE, 'VueDataBindingShadow.rozie')).not.toThrow();
  });

  it('<data slots> shadowing useSlots() renames to slots$local; useSlots intact', () => {
    const code = compileVue(FIXTURE, 'VueDataBindingShadow.rozie');
    // The generated binding stays.
    expect(code).toContain('const slots = useSlots();');
    // The user <data> field is renamed.
    expect(code).toContain("const slots$local = ref('shadow-a');");
    // EXACTLY ONE top-level `const slots ` (the generated one) — no redeclare.
    expect(countTopLevelConst(code, 'slots')).toBe(1);
    // The renamed local is referenced in the template + script.
    expect(code).toContain('{{ slots$local }}');
    expect(code).toContain('const showSlots = () => slots$local.value;');
  });

  it('<data emit> shadowing defineEmits() renames to emit$local; emit fn intact', () => {
    const code = compileVue(FIXTURE, 'VueDataBindingShadow.rozie');
    // The generated emit binding stays as the defineEmits handle.
    expect(code).toContain('const emit = defineEmits<{');
    // The user <data> field is renamed.
    expect(code).toContain("const emit$local = ref('shadow-b');");
    // EXACTLY ONE top-level `const emit ` (the generated defineEmits handle).
    expect(countTopLevelConst(code, 'emit')).toBe(1);
    // The $emit('go', ...) call still uses the real emit fn; its payload reads
    // the renamed data local.
    expect(code).toContain("const fire = () => emit('go', emit$local.value);");
    expect(code).toContain('{{ emit$local }}');
  });

  it('non-model prop binding (props) is NOT redeclared by a data field', () => {
    const code = compileVue(FIXTURE, 'VueDataBindingShadow.rozie');
    // The withDefaults/defineProps `const props` is the only top-level `props`.
    expect(countTopLevelConst(code, 'props')).toBe(1);
    expect(code).toContain('const props = withDefaults(');
  });
});

describe('Vue <data>/helper ↔ vue-import deconfliction (61-07, risk 3)', () => {
  // A `<data>` field named `ref` (a 'vue' import the emitter injects) collides
  // with `import { ref } from 'vue'` — the author local must be renamed `ref$local`
  // and the import kept intact.
  const IMPORT_SHADOW = `<rozie name="VueImportShadow">
<data>
{
  ref: 'shadowed'
}
</data>
<script>
const show = () => $data.ref;
</script>
<template>
  <div>{{ $data.ref }}</div>
</template>
</rozie>`;

  it('<data ref> shadowing the injected `ref` import renames to ref$local; import intact', () => {
    const code = compileVue(IMPORT_SHADOW, 'VueImportShadow.rozie');
    // The vue `ref` import is intact (still `import { ref } from 'vue'`).
    expect(code).toMatch(/import\s*\{[^}]*\bref\b[^}]*\}\s*from\s*'vue'/);
    // The user data local is renamed and its ref() call uses the real `ref`.
    expect(code).toContain("const ref$local = ref('shadowed');");
    expect(code).toContain('{{ ref$local }}');
    // No raw `const ref = ref(...)` self-shadow.
    expect(code).not.toContain('const ref = ref(');
  });
});

describe('Vue deconfliction — non-colliding corpus byte-identical (61-07)', () => {
  // A component whose <data>/helper names never touch a generated binding or vue
  // import must be byte-identical to its pre-pass output (only-on-collision).
  const CLEAN = `<rozie name="VueClean">
<data>
{
  count: 0,
  label: 'hi'
}
</data>
<script>
const bump = () => { $data.count = $data.count + 1; };
const greeting = () => $data.label;
</script>
<template>
  <div @click="bump">{{ $data.count }} {{ $data.label }}</div>
</template>
</rozie>`;

  it('emits no $local rename for a non-colliding component', () => {
    const code = compileVue(CLEAN, 'VueClean.rozie');
    expect(code).not.toContain('$local');
    expect(code).toContain("const count = ref(0);");
    expect(code).toContain("const label = ref('hi');");
  });

  // REGRESSION (over-application guard): a function PARAMETER or a function-LOCAL
  // `const` named a vue-import symbol (`h`/`ref`/…) is a LEGAL nested shadow —
  // NOT a top-level redeclare — and must NEVER be renamed. (The chartjs
  // `resizeChart(w, h)` + rete `const h = portals.body(...)` corpus drift.) The
  // `programOnly` gate + the actually-generated-set gate keep these byte-identical.
  const NESTED_SHADOW = `<rozie name="VueNestedShadow">
<data>
{
  size: 10
}
</data>
<script>
const resize = (w, h) => { return w * h + $data.size; };
const build = () => {
  const h = { dispose() {} };
  return h;
};
</script>
<template>
  <div>{{ $data.size }}</div>
</template>
</rozie>`;

  it('does NOT rename a function param `h` or a function-local `const h` (legal nested shadow)', () => {
    const code = compileVue(NESTED_SHADOW, 'VueNestedShadow.rozie');
    // `ref` import IS injected (there is <data>), so `h` would be in the
    // generated-name set — but `h` here is only a nested param/local, never a
    // top-level binding, so it must stay un-renamed.
    expect(code).not.toContain('h$local');
    // The param `h` and the function-local `const h` survive un-renamed (the
    // type-neutralizer may annotate params `: any`, but the NAME `h` is intact).
    expect(code).toMatch(/const resize = \(w(?::\s*any)?,\s*h(?::\s*any)?\)\s*=>/);
    expect(code).toMatch(/const h = \{/);
  });
});
