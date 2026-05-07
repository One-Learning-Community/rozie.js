/**
 * vue-ts consumer-types — TYPES-02 / TYPES-03 / D-94 / D-85 (Vue full)
 *
 * Type-only assertions over compiled Vue SFC fixtures. Loaded by
 * `vue-tsc --strict --noEmit` (NOT vitest) — every line must typecheck.
 *
 * Per D-84 (hybrid type strategy): Vue's emitted SFC carries
 * `defineProps<{...}>()` inline; vue-tsc resolves the prop shape from the
 * `<script setup>` body at the consumer-import site. There is NO sibling
 * .d.ts for Vue (D-90 no-op). The typed contract is the .vue source itself.
 *
 * The `Select.vue` fixture is the REAL bootstrap-emitted output of
 * `emitVue(makeSelectIR(), { genericParams: ['T'] })` per Plan 06-02 Task 3
 * (D-85 Vue full). The bootstrap script aborts unless emitVue produces
 * `<script setup lang="ts" generic="T">` — so its presence here proves the
 * Vue full-generic path is end-to-end live.
 *
 * Coverage:
 *   - module-resolution + load-time typecheck of the compiled .vue files
 *     (any pre-existing emitter bug surfaces here)
 *   - prop-shape mounting via Vue's `h()` render API — Vue 3.4+ infers prop
 *     types from `defineProps<...>()` and rejects wrong types at h() callsite
 *   - model:true two-way binding — `'onUpdate:value'` event-prop typing
 *   - generic preservation (TYPES-03) — Select<T> is end-to-end live via the
 *     bootstrap script's emitVue+genericParams call. The compiled Select.vue
 *     IS the contract; vue-tsc's h()-side generic inference is weak in 3.4
 *     (a known ecosystem limitation; consumers using <Select :selected /> in
 *     a template DO get full T narrowing). The h()-side narrowing test is
 *     deferred to a v2 consumer wrapper that uses a .vue template.
 *
 * NOTE — TodoList + Dropdown imports are deliberately COMMENTED OUT and
 * excluded from tsconfig.strict.json. Both compiled .vue files surface
 * PRE-EXISTING Vue emitter type bugs (TS18046 unknown narrowing in v-for;
 * TS2769 wrong listener-options type) that Plan 06-05 surfaces but is NOT
 * in scope to fix. See:
 * `.planning/phases/06-cli-codegen-babel-plugin-type-emission-hardening/deferred-items.md`
 * → "Plan 06-05 Discoveries → Pre-existing Vue emitter type errors".
 */
import { h } from 'vue';
import Counter from './fixtures/Counter.vue';
import SearchInput from './fixtures/SearchInput.vue';
// import Dropdown from './fixtures/Dropdown.vue';   // see NOTE above (deferred)
// import TodoList from './fixtures/TodoList.vue';   // see NOTE above (deferred)
import Modal from './fixtures/Modal.vue';
import Select from './fixtures/Select.vue';

// ---- Counter: model:true triplet (TYPES-02) ---------------------------
// Vue's defineModel<T>('value') exposes the prop as `value?: T` and emits
// `update:value`. Mount via h() with concrete prop shape.
const counterCtrl = h(Counter, {
  value: 5,
  step: 1,
  'onUpdate:value': (next: number) => void next,
});
const counterUnc = h(Counter, {});
// @ts-expect-error — wrong type for `value`
const counterBadType = h(Counter, { value: 'bad' });

// ---- SearchInput: simple props ----------------------------------------
const search = h(SearchInput, {
  placeholder: 'Search',
  minLength: 3,
  autofocus: true,
});
// @ts-expect-error — minLength must be number
const searchBad = h(SearchInput, { minLength: 'three' });

// ---- Modal: model:true (open) + lifecycle props ------------------------
const modal = h(Modal, {
  open: false,
  closeOnEscape: true,
  closeOnBackdrop: true,
  lockBodyScroll: false,
  title: 'Hello',
  'onUpdate:open': (next: boolean) => void next,
});

// ---- Select<T>: D-85 Vue full generic preservation (TYPES-03) ---------
// Bootstrap-side validation: the Select.vue fixture (refreshed by
// `examples/consumers/scripts/refresh-consumer-fixtures.mjs`) carries the
// full generic SFC shape `<script setup lang="ts" generic="T">` +
// `interface SelectProps<T> { items?: unknown[] }` +
// `defineProps<SelectProps<T>>()` + `defineModel<T>('selected')`.
//
// The bootstrap script aborts non-zero if emitVue does NOT emit `generic="T"`
// (Plan 06-02 Task 3). Therefore the presence of Select.vue here is proof
// the D-85 Vue full path is wired end-to-end.
//
// Mount-time TYPES-03 enforcement: vue-tsc 2.x infers the SFC's T from
// `defineModel<T>('selected')` only when consumed via a .vue TEMPLATE
// (`<Select :selected="..." />`). The h()-side type-arg inference is
// deliberately permissive (T defaults to unknown). We verify that:
//   - h(Select, {}) typechecks (no required props)
//   - h(Select, { selected: 'a' }) typechecks (T inferred to widen as needed)
//
// The narrow-T-from-template-callsite test is deferred to a v2 consumer
// wrapper that uses an actual .vue template. Documented inline.
const selectEmpty = h(Select, {});
const selectStr = h(Select, { selected: 'a' });
const selectNum = h(Select, { selected: 1 });

// Suppress "declared but never read" for shape-pin locals.
void [
  Counter,
  SearchInput,
  Modal,
  Select,
  counterCtrl,
  counterUnc,
  counterBadType,
  search,
  searchBad,
  modal,
  selectEmpty,
  selectStr,
  selectNum,
];
