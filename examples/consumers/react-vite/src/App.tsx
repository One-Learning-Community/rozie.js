import { useState } from 'react';
import type { JSX } from 'react';
import CounterPage from './pages/CounterPage';
import SearchInputPage from './pages/SearchInputPage';
import DropdownPage from './pages/DropdownPage';
import TodoListPage from './pages/TodoListPage';
import ModalPage from './pages/ModalPage';
import TreeNodePage from './pages/TreeNodePage';
import CardPage from './pages/CardPage';
import CardHeaderPage from './pages/CardHeaderPage';
// Phase 07.2 Plan 06 — ModalConsumer dogfood page (Wave 2 close-out).
import ModalConsumerPage from './pages/ModalConsumerPage';
import LitInteropPage from './pages/LitInteropPage';

/**
 * Page-routing shell. Each Playwright e2e test navigates by clicking
 * `data-testid="nav-<page>"` to reach the page under test. Counter is the
 * default landing page (matches the Vue demo convention).
 *
 * Plan 04-06 anchor: this is the consumer-facing surface that proves Phase 4
 * end-to-end. All 5 reference .rozie examples render under React StrictMode
 * (wrapped at main.tsx) and exercise the full @rozie/target-react +
 * @rozie/runtime-react + @rozie/unplugin chain.
 */
type PageKey =
  | 'counter'
  | 'search-input'
  | 'dropdown'
  | 'todo-list'
  | 'modal'
  | 'tree-node'
  | 'card'
  | 'card-header'
  | 'modal-consumer'
  | 'lit-interop';

const PAGES: Record<PageKey, () => JSX.Element> = {
  counter: CounterPage,
  'search-input': SearchInputPage,
  dropdown: DropdownPage,
  'todo-list': TodoListPage,
  modal: ModalPage,
  'tree-node': TreeNodePage,
  card: CardPage,
  'card-header': CardHeaderPage,
  'modal-consumer': ModalConsumerPage,
  'lit-interop': LitInteropPage,
};

const PAGE_KEYS: ReadonlyArray<PageKey> = [
  'counter',
  'search-input',
  'dropdown',
  'todo-list',
  'modal',
  'tree-node',
  'card',
  'card-header',
  'modal-consumer',
  'lit-interop',
];

export default function App(): JSX.Element {
  const [current, setCurrent] = useState<PageKey>('counter');
  const PageComponent = PAGES[current];

  return (
    <>
      <header
        style={{
          padding: '1rem',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
          Rozie React Demo
        </h1>
        <nav style={{ display: 'flex', gap: '0.25rem' }}>
          {PAGE_KEYS.map((p) => (
            <button
              key={p}
              data-testid={`nav-${p}`}
              onClick={() => setCurrent(p)}
              style={{
                padding: '0.25rem 0.5rem',
                font: 'inherit',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                background: current === p ? 'rgba(0, 100, 200, 0.1)' : 'white',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            >
              {p}
            </button>
          ))}
        </nav>
      </header>
      <main
        data-testid="rozie-mount"
        style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}
      >
        <PageComponent />
      </main>
    </>
  );
}
