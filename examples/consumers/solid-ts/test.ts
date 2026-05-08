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

// Suppress "declared but never read" — these exist purely to
// pin down the typed shape of each fixture under tsc --strict --noEmit.
void [Counter, SearchInput, Dropdown, TodoList, Modal, TreeNode, Card, CardHeader];
