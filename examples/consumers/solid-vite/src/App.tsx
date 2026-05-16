import { createSignal, createEffect, Show } from 'solid-js';
import CounterPage from './pages/CounterPage';
import SearchInputPage from './pages/SearchInputPage';
import DropdownPage from './pages/DropdownPage';
import TodoListPage from './pages/TodoListPage';
import ModalPage from './pages/ModalPage';
import CardPage from './pages/CardPage';
import CardHeaderPage from './pages/CardHeaderPage';
import TreeNodePage from './pages/TreeNodePage';
// Phase 07.2 Plan 06 — ModalConsumer dogfood page (Wave 2 close-out).
import ModalConsumerPage from './pages/ModalConsumer';

/**
 * Page-routing shell for the Solid Vite demo.
 *
 * Uses hash-based routing (no @solidjs/router dependency) to keep the demo
 * minimal. Each Playwright e2e test navigates by changing the hash directly.
 *
 * Phase 06.3 P3 anchor: this is the consumer-facing surface that proves Phase
 * 06.3 end-to-end. All 8 reference .rozie examples render under Solid and
 * exercise the full @rozie/target-solid + @rozie/runtime-solid + @rozie/unplugin
 * chain.
 */
export function App() {
  const [route, setRoute] = createSignal(window.location.hash.slice(1) || '/counter');

  createEffect(() => {
    const handler = () => setRoute(window.location.hash.slice(1) || '/counter');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  });

  return (
    <div>
      <header
        style={{
          padding: '1rem',
          'border-bottom': '1px solid rgba(0, 0, 0, 0.08)',
          'font-family': 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ margin: '0 0 0.5rem 0', 'font-size': '1.25rem' }}>
          Rozie Solid Demo
        </h1>
        <nav style={{ display: 'flex', gap: '0.25rem' }}>
          <a href="#/counter" data-testid="nav-counter">Counter</a>
          {' | '}
          <a href="#/search-input" data-testid="nav-search-input">SearchInput</a>
          {' | '}
          <a href="#/dropdown" data-testid="nav-dropdown">Dropdown</a>
          {' | '}
          <a href="#/todolist" data-testid="nav-todolist">TodoList</a>
          {' | '}
          <a href="#/modal" data-testid="nav-modal">Modal</a>
          {' | '}
          <a href="#/card" data-testid="nav-card">Card</a>
          {' | '}
          <a href="#/card-header" data-testid="nav-card-header">CardHeader</a>
          {' | '}
          <a href="#/treenode" data-testid="nav-treenode">TreeNode</a>
          {' | '}
          <a href="#/modal-consumer" data-testid="nav-modal-consumer">ModalConsumer</a>
        </nav>
      </header>
      <main style={{ padding: '1rem', 'font-family': 'system-ui, sans-serif' }}>
        <Show when={route() === '/counter'}><CounterPage /></Show>
        <Show when={route() === '/search-input'}><SearchInputPage /></Show>
        <Show when={route() === '/dropdown'}><DropdownPage /></Show>
        <Show when={route() === '/todolist'}><TodoListPage /></Show>
        <Show when={route() === '/modal'}><ModalPage /></Show>
        <Show when={route() === '/card'}><CardPage /></Show>
        <Show when={route() === '/card-header'}><CardHeaderPage /></Show>
        <Show when={route() === '/treenode'}><TreeNodePage /></Show>
        <Show when={route() === '/modal-consumer'}><ModalConsumerPage /></Show>
      </main>
    </div>
  );
}
