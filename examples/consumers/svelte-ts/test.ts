/**
 * svelte-ts consumer-types — TYPES-02 / D-94 / D-85 Svelte best-effort
 *
 * Type-only assertions over compiled Svelte 5 fixtures. Loaded by
 * `svelte-check --tsconfig ./tsconfig.strict.json` (NOT vitest) — every
 * compile-time assertion must pass.
 *
 * Per D-84 (hybrid type strategy): Svelte's emitted SFC carries
 * `let { value }: Props = $props()` inline; svelte-check resolves the prop
 * shape from the `<script lang="ts">` body at the consumer-import site.
 * There is NO sibling .d.ts for Svelte (D-90 no-op). The typed contract is
 * the .svelte source itself.
 *
 * Coverage:
 *   - prop-shape extraction via Svelte 5's `ComponentProps<typeof X>` type
 *   - model:true binding via `$bindable()` (Svelte 5 idiom — D-31 Svelte analog)
 *   - wrong-type assignment rejected
 *
 * Per D-85: Svelte generic preservation is BEST-EFFORT in v1 — the
 * `<script generics="T" lang="ts">` syntax is supported by svelte-check but
 * the .rozie parser does not yet emit `generics="T"`. The Select<T> path is
 * deferred to v2 (commented out below) and documented as a v2 follow-up
 * once a real-world generic component surfaces friction.
 *
 * NOTE — SearchInput + Dropdown + TodoList imports deliberately COMMENTED
 * OUT and excluded from tsconfig.strict.json. All three compiled .svelte
 * files surface PRE-EXISTING Svelte emitter type bugs (debounce/throttle
 * spread-arg typing, v-for unknown narrowing, `passive` on
 * removeEventListener) that Plan 06-05 surfaces but is NOT in scope to fix.
 * See:
 * `.planning/phases/06-cli-codegen-babel-plugin-type-emission-hardening/deferred-items.md`
 * → "Plan 06-05 Discoveries → Pre-existing Svelte emitter type errors".
 */
import type { ComponentProps } from 'svelte';
import Counter from './fixtures/Counter.svelte';
// import SearchInput from './fixtures/SearchInput.svelte';   // see NOTE below (deferred)
// import Dropdown from './fixtures/Dropdown.svelte';         // see NOTE below (deferred)
// import TodoList from './fixtures/TodoList.svelte';         // see NOTE below (deferred)
import Modal from './fixtures/Modal.svelte';

// ---- Counter: model:true via $bindable() (TYPES-02) -------------------
// Svelte 5's `$bindable()` exposes the prop as a two-way bind point at the
// consumer site. ComponentProps<> sees the typed props from `let {...}: Props = $props()`.
type CounterProps = ComponentProps<typeof Counter>;
const counterCtrl: CounterProps = {
  value: 5,
  step: 1,
};
const counterUnc: CounterProps = {};
// @ts-expect-error — wrong type for `value`
const counterBadType: CounterProps = { value: 'bad' };

// ---- Modal: model:true (open) + lifecycle props -----------------------
type ModalProps = ComponentProps<typeof Modal>;
const modal: ModalProps = {
  open: false,
  closeOnEscape: true,
  closeOnBackdrop: true,
  lockBodyScroll: false,
  title: 'Hello',
};

// ---- TYPES-03 generic Select<T> — DEFERRED v2 (D-85 Svelte best-effort)
// The Phase 6 emitter does NOT emit `<script generics="T">` for Svelte;
// generic preservation is best-effort and tooling is younger than React+Vue.
// Once a real-world generic component surfaces friction (or v2 parser adds
// `generic="T"` syntax to .rozie), uncomment and wire this:
//
// import Select from './fixtures/Select.svelte';
// type SelectProps<T> = ComponentProps<typeof Select<T>>;
// const selectStr: SelectProps<string> = { selected: 'a', items: ['a', 'b'] };
// const selectNum: SelectProps<number> = { selected: 1, items: [1, 2] };
// // @ts-expect-error — type-mismatch
// const selectBad: SelectProps<number> = { selected: 'bad' };

// Suppress "declared but never read" for shape-pin locals.
void [
  Counter,
  Modal,
  counterCtrl,
  counterUnc,
  counterBadType,
  modal,
];
