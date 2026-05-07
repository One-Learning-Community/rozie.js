/**
 * react-ts consumer-types — TYPES-02 / TYPES-03 / D-94 / D-86
 *
 * Type-only assertions over the compiled React fixtures. Loaded by
 * `tsc --strict --noEmit` (NOT vitest) — every line must typecheck.
 *
 * The fixtures dir contains the .d.ts sidecars emitted by Plan 06-02's
 * emitReactTypes (TYPES-01). Per D-84 React-full, those .d.ts files carry
 * the canonical typed contract: `export interface FooProps { ... }`,
 * `declare function Foo(props: FooProps): JSX.Element;`, `export default Foo`.
 *
 * Coverage:
 *   - prop types per component (Counter/SearchInput/Dropdown/TodoList/Modal)
 *   - model:true two-way binding triplet — controlled, uncontrolled, both (TYPES-02)
 *   - slot context types — D-86 inference end-to-end (Dropdown.renderTrigger
 *     receives concrete `{ open: boolean; toggle: () => void }`, not `unknown`)
 *   - generic narrowing — Select<T> with @ts-expect-error for type mismatch (TYPES-03)
 */
import Counter from './fixtures/Counter';
import type { CounterProps } from './fixtures/Counter';
import SearchInput from './fixtures/SearchInput';
import type { SearchInputProps } from './fixtures/SearchInput';
import Dropdown from './fixtures/Dropdown';
import type { DropdownProps } from './fixtures/Dropdown';
import TodoList from './fixtures/TodoList';
import type { TodoListProps } from './fixtures/TodoList';
import Modal from './fixtures/Modal';
import type { ModalProps } from './fixtures/Modal';
import Select from './fixtures/Select';
import type { SelectProps } from './fixtures/Select';

// ---- Counter: model:true triplet (TYPES-02) ---------------------------
// Controlled (value + onValueChange).
const counterCtrl: CounterProps = {
  value: 5,
  onValueChange: (n: number) => void n,
};
// Uncontrolled (defaultValue only).
const counterUnc: CounterProps = { defaultValue: 5 };
// Both — overlap is allowed; React's controllable-state hook resolves at runtime.
const counterBoth: CounterProps = {
  value: 0,
  defaultValue: 0,
  onValueChange: (n) => void n,
  step: 1,
  min: -100,
  max: 100,
};
// @ts-expect-error — wrong type for `value` (string instead of number)
const counterBadType: CounterProps = { value: 'bad' };
// @ts-expect-error — unknown prop key
const counterBadKey: CounterProps = { value: 0, nonexistent: true };

// ---- SearchInput: simple props + emits ---------------------------------
const search: SearchInputProps = {
  placeholder: 'Search',
  minLength: 3,
  autofocus: true,
  onSearch: (...args: unknown[]) => void args,
  onClear: (...args: unknown[]) => void args,
};

// ---- Dropdown: D-86 slot context types end-to-end (TYPES-02) -----------
// renderTrigger's parameter type comes from the .d.ts: { open: boolean; toggle: () => void }
const dropdown: DropdownProps = {
  open: false,
  defaultOpen: false,
  onOpenChange: (next: boolean) => void next,
  closeOnOutsideClick: true,
  closeOnEscape: true,
  renderTrigger: ({ open, toggle }) => {
    // open MUST be boolean per D-86 inference (NOT unknown).
    const _o: boolean = open;
    // toggle MUST be a callable per the bare-identifier callable fallback.
    toggle();
    void _o;
    return null;
  },
};
const dropdownBad: DropdownProps = {
  // @ts-expect-error — renderTrigger param destructure with wrong open type
  renderTrigger: ({ open }: { open: number; toggle: () => void }) => {
    void open;
    return null;
  },
};

// ---- TodoList: scoped slots + emits ------------------------------------
const todoList: TodoListProps = {
  items: ['a', 'b'],
  defaultItems: [],
  onItemsChange: (next: unknown[]) => void next,
  title: 'My todos',
  onAdd: (...args: unknown[]) => void args,
  onToggle: (...args: unknown[]) => void args,
  onRemove: (...args: unknown[]) => void args,
  renderEmpty: () => null,
};

// ---- Modal: lifecycle props + named slots ------------------------------
const modal: ModalProps = {
  open: false,
  defaultOpen: false,
  onOpenChange: (next: boolean) => void next,
  closeOnEscape: true,
  closeOnBackdrop: true,
  lockBodyScroll: false,
  title: 'Hello',
  onClose: (...args: unknown[]) => void args,
  renderHeader: ({ close }) => {
    close();
    return null;
  },
  renderFooter: ({ close }) => {
    close();
    return null;
  },
};

// ---- Select<T> generic narrowing (TYPES-03 / D-85 React full) ----------
const selectStr: SelectProps<string> = {
  items: ['a', 'b', 'c'],
  selected: 'a',
  defaultSelected: 'a',
  onSelectedChange: (next) => {
    // next is narrowed to string at the call site
    const _s: string = next;
    void _s;
  },
};
const selectNum: SelectProps<number> = {
  items: [1, 2, 3],
  selected: 1,
  defaultSelected: 1,
  onSelectedChange: (next) => {
    const _n: number = next;
    void _n;
  },
};
const selectGenericMismatch: SelectProps<number> = {
  items: [1, 2],
  // @ts-expect-error — selected: 'a' is a string, but T=number ⇒ wrong type
  selected: 'a',
};

// Suppress all "declared but never read" — these locals exist purely to
// pin down the typed shape of each fixture under tsc --strict --noEmit.
void [
  Counter,
  SearchInput,
  Dropdown,
  TodoList,
  Modal,
  Select,
  counterCtrl,
  counterUnc,
  counterBoth,
  counterBadType,
  counterBadKey,
  search,
  dropdown,
  dropdownBad,
  todoList,
  modal,
  selectStr,
  selectNum,
  selectGenericMismatch,
];
