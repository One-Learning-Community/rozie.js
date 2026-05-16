<!--
  Phase 5 Plan 05-02b — svelte-vite demo router. All 5 reference .rozie
  components are imported and routed via a nav bar. Each component's
  state ($bindable model props, callback props) is owned by App.svelte
  so the Playwright e2e specs can observe the parent-tracked values.

  Layout mirrors examples/consumers/vue-vite/src/App.vue + react-vite/App.tsx
  (page-routing shell with a header nav + main panel). Page bodies are
  inlined here rather than split into per-page Svelte files because the
  state surface is small and Svelte 5 components can't host other
  components' bindable props ergonomically across file boundaries.
-->
<script lang="ts">
  import Counter from './Counter.rozie';
  import SearchInput from './SearchInput.rozie';
  import Dropdown from './Dropdown.rozie';
  import TodoList from './TodoList.rozie';
  import Modal from './Modal.rozie';
  import TreeNode from './TreeNode.rozie';
  import Card from './Card.rozie';
  import CardHeader from './CardHeader.rozie';
  // Phase 07.2 Plan 06 — ModalConsumer dogfood page (Wave 2 close-out).
  import ModalConsumerPage from './pages/ModalConsumer.svelte';
  import LitInterop from './routes/lit-interop/+page.svelte';

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

  let current = $state<PageKey>('counter');

  // Counter state
  let counterValue = $state(0);

  // SearchInput state
  let lastQuery = $state('');
  const onSearch = (q: string) => {
    lastQuery = q;
  };
  const onClear = () => {
    lastQuery = '';
  };

  // Dropdown state
  let dropdownOpen = $state(false);

  // TodoList state
  interface TodoItem {
    id: string;
    text: string;
    done: boolean;
  }
  let todoItems = $state<TodoItem[]>([
    { id: '1', text: 'Write Phase 5 plan', done: true },
    { id: '2', text: 'Implement Svelte emitter', done: true },
    { id: '3', text: 'Wire unplugin svelte branch', done: false },
  ]);

  // Modal state
  let modalOpen = $state(false);
  let modalCloseCount = $state(0);
  const onModalClose = () => {
    modalCloseCount++;
  };

  // TreeNode demo fixture (3-level tree)
  const treeRoot = {
    id: 'r',
    label: 'root',
    children: [
      {
        id: 'a',
        label: 'alpha',
        children: [
          { id: 'a1', label: 'alpha-1', children: [] },
          { id: 'a2', label: 'alpha-2', children: [] },
        ],
      },
      {
        id: 'b',
        label: 'beta',
        children: [{ id: 'b1', label: 'beta-1', children: [] }],
      },
    ],
  };

  // Card / CardHeader state
  let cardCloseCount = $state(0);
  let cardHeaderCloseCount = $state(0);
</script>

<header class="app-header">
  <h1>Rozie Svelte Demo</h1>
  <nav>
    {#each PAGE_KEYS as p}
      <button
        data-testid={`nav-${p}`}
        class:active={current === p}
        onclick={() => (current = p)}
      >
        {p}
      </button>
    {/each}
  </nav>
</header>

<main class="app-main">
  {#if current === 'counter'}
    <section>
      <h2>Counter Demo</h2>
      <Counter bind:value={counterValue} step={1} min={-10} max={10} />
      <p>External value: <span data-testid="parent-value">{counterValue}</span></p>
    </section>
  {:else if current === 'search-input'}
    <section>
      <h2>SearchInput Demo</h2>
      <SearchInput
        placeholder="Search…"
        minLength={2}
        autofocus={false}
        onsearch={onSearch}
        onclear={onClear}
      />
      {#if lastQuery}
        <p data-testid="last-query">Last query: {lastQuery}</p>
      {/if}
    </section>
  {:else if current === 'dropdown'}
    <section>
      <h2>Dropdown Demo</h2>
      <Dropdown
        bind:open={dropdownOpen}
        closeOnOutsideClick={true}
        closeOnEscape={true}
      >
        {#snippet trigger(_open: boolean, _toggle: () => void)}
          <button class="dropdown-trigger" data-testid="dropdown-trigger">
            Toggle Dropdown
          </button>
        {/snippet}
        {#snippet children(_close: () => void)}
          <ul class="dropdown-items" data-testid="dropdown-items">
            <li>Item A</li>
            <li>Item B</li>
            <li>Item C</li>
          </ul>
        {/snippet}
      </Dropdown>
      <p>Open state: <span data-testid="dropdown-open-state">{dropdownOpen}</span></p>
    </section>
  {:else if current === 'todo-list'}
    <section>
      <h2>TodoList Demo</h2>
      <TodoList bind:items={todoItems} title="My Todos" />
    </section>
  {:else if current === 'modal'}
    <section>
      <h2>Modal Demo</h2>
      <button data-testid="open-modal" onclick={() => (modalOpen = true)}>
        Open Modal
      </button>
      <Modal
        bind:open={modalOpen}
        closeOnEscape={true}
        closeOnBackdrop={true}
        title="Hello from Modal.rozie"
        onclose={onModalClose}
      >
        {#snippet children(_close: () => void)}
          <p>Modal body content. Close via Escape, backdrop click, or the × button.</p>
        {/snippet}
      </Modal>
      {#if modalCloseCount > 0}
        <p data-testid="modal-close-count">Closed {modalCloseCount} time(s)</p>
      {/if}
    </section>
  {:else if current === 'tree-node'}
    <section>
      <h2>TreeNode Demo</h2>
      <p>Recursive component composition (D-119) — TreeNode renders itself for each child.</p>
      <TreeNode node={treeRoot} />
    </section>
  {:else if current === 'card'}
    <section>
      <h2>Card Demo</h2>
      <p>Wrapper composition (D-119) — Card embeds CardHeader and renders default-slot content.</p>
      <Card title="Hello world" onClose={() => cardCloseCount++}>
        {#snippet children()}
          <p>This body lives in Card's default slot.</p>
          <p>Closes: <span data-testid="card-close-count">{cardCloseCount}</span></p>
        {/snippet}
      </Card>
    </section>
  {:else if current === 'card-header'}
    <section>
      <h2>CardHeader Demo</h2>
      <p>Standalone leaf component — wrapper-pair partner of Card.</p>
      <CardHeader title="Standalone header" onClose={() => cardHeaderCloseCount++} />
      <p>Closes: <span data-testid="card-header-close-count">{cardHeaderCloseCount}</span></p>
    </section>
  {:else if current === 'modal-consumer'}
    <ModalConsumerPage />
  {:else if current === 'lit-interop'}
    <LitInterop />
  {/if}
</main>

<style>
  .app-header {
    padding: 1rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    font-family: system-ui, sans-serif;
  }
  .app-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
  }
  nav {
    display: flex;
    gap: 0.25rem;
  }
  button {
    padding: 0.25rem 0.5rem;
    font: inherit;
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: white;
    cursor: pointer;
    border-radius: 4px;
  }
  button.active {
    background: rgba(0, 100, 200, 0.1);
    border-color: rgba(0, 100, 200, 0.5);
  }
  .app-main {
    padding: 1rem;
    font-family: system-ui, sans-serif;
  }
</style>
