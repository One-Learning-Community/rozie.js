/**
 * solid-ts consumer-types — TYPES-02 (Solid variant)
 *
 * Type-only assertions over the compiled Solid TSX fixtures. Loaded by
 * `tsc --strict --noEmit` (NOT vitest) — every line must typecheck.
 *
 * Solid target emits `.tsx` with JSX import source = solid-js.
 * splitProps is used universally (D-141). Model props are typed as
 * Accessor<T> / Setter<T> pairs via createControllableSignal.
 *
 * Coverage: import + basic JSX consumption of each fixture to confirm
 * the generated code type-checks under strict mode.
 */
import Counter from './fixtures/Counter';
import SearchInput from './fixtures/SearchInput';
import Dropdown from './fixtures/Dropdown';
import TodoList from './fixtures/TodoList';
import Modal from './fixtures/Modal';
import TreeNode from './fixtures/TreeNode';
import Card from './fixtures/Card';
import CardHeader from './fixtures/CardHeader';
import DynamicSlots from './fixtures/DynamicSlots';

// ---- DynamicSlots: R6 template-literal-keyed family type surface (AC-10) -
// `DynamicSlotsProps` is a PRIVATE (non-exported) interface — matching this
// fixture's own file (Solid's typed contract is the inline .tsx body, not a
// public .d.ts), so the component function is called DIRECTLY (Solid
// components are plain functions) to let TS structurally check the argument
// against that private type. This is a type-only assertion file; the call is
// never executed.
const dynamicSlotsFamily = DynamicSlots({
  row: { status: 'ok' },
  total: 3,
  slots: {
    'cell-status': ({ row, value }) => {
      const _row: unknown = row;
      const _value: unknown = value;
      void _row;
      void _value;
      return null;
    },
  },
});
const dynamicSlotsFamilyBad = DynamicSlots({
  slots: {
    // @ts-expect-error — misspelled param destructure inside the cell- family shape
    'cell-status': ({ rowx, value }: { rowx: unknown; value: unknown }) => {
      void rowx;
      void value;
      return null;
    },
  },
});
// Zero-param family ('row-') types its value as a zero-argument function.
const dynamicSlotsZeroParamFamily = DynamicSlots({
  slots: {
    'row-anything': () => null,
  },
});
// Coexistence — the static cell-total slot typechecks against ITS OWN
// one-param shape, not the overlapping cell- family's two-param shape.
const dynamicSlotsCoexist = DynamicSlots({
  slots: {
    'cell-total': ({ value }) => {
      void value;
      return null;
    },
  },
});

// Suppress "declared but never read" — these exist purely to
// pin down the typed shape of each fixture under tsc --strict --noEmit.
void [
  Counter,
  SearchInput,
  Dropdown,
  TodoList,
  Modal,
  TreeNode,
  Card,
  CardHeader,
  DynamicSlots,
  dynamicSlotsFamily,
  dynamicSlotsFamilyBad,
  dynamicSlotsZeroParamFamily,
  dynamicSlotsCoexist,
];
