// Phase 5 Plan 05-04b — angular-analogjs demo router. All 5 reference .rozie
// components are imported and routed via a nav bar. Each component's state
// (model props, callback outputs) is owned by AppComponent so the Playwright
// e2e specs can observe the parent-tracked values.
//
// Layout mirrors examples/consumers/svelte-vite/src/App.svelte and react-vite/
// src/App.tsx (page-routing shell with a header nav + main panel). Page bodies
// are inlined here rather than split into per-page components because the
// state surface is small and Angular's two-way binding [(prop)] keeps the
// parent in sync without prop-drilling.
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import Counter from '../Counter.rozie';
import SearchInput from '../SearchInput.rozie';
import Dropdown from '../Dropdown.rozie';
import TodoList from '../TodoList.rozie';
import Modal from '../Modal.rozie';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

type PageKey = 'counter' | 'search-input' | 'dropdown' | 'todo-list' | 'modal';

@Component({
  selector: 'rozie-app',
  standalone: true,
  imports: [
    CommonModule,
    Counter,
    SearchInput,
    Dropdown,
    TodoList,
    Modal,
  ],
  template: `
    <header class="app-header">
      <h1>Rozie Angular Demo</h1>
      <nav>
        @for (p of pageKeys; track p) {
          <button
            [attr.data-testid]="'nav-' + p"
            [class.active]="current() === p"
            (click)="current.set(p)"
          >
            {{ p }}
          </button>
        }
      </nav>
    </header>

    <main class="app-main">
      @if (current() === 'counter') {
        <section>
          <h2>Counter Demo</h2>
          <rozie-counter
            [(value)]="counterValue"
            [step]="1"
            [min]="-10"
            [max]="10"
          />
          <p>External value: <span data-testid="parent-value">{{ counterValue() }}</span></p>
        </section>
      } @else if (current() === 'search-input') {
        <section>
          <h2>SearchInput Demo</h2>
          <rozie-search-input
            placeholder="Search…"
            [minLength]="2"
            [autofocus]="false"
            (search)="onSearch($event)"
            (clear)="onClear()"
          />
          @if (lastQuery()) {
            <p data-testid="last-query">Last query: {{ lastQuery() }}</p>
          }
        </section>
      } @else if (current() === 'dropdown') {
        <section>
          <h2>Dropdown Demo</h2>
          <rozie-dropdown
            [(open)]="dropdownOpen"
            [closeOnOutsideClick]="true"
            [closeOnEscape]="true"
          >
            <ng-template #trigger>
              <button class="dropdown-trigger" data-testid="dropdown-trigger">
                Toggle Dropdown
              </button>
            </ng-template>
            <ng-template #defaultSlot>
              <ul class="dropdown-items" data-testid="dropdown-items">
                <li>Item A</li>
                <li>Item B</li>
                <li>Item C</li>
              </ul>
            </ng-template>
          </rozie-dropdown>
          <p>Open state: <span data-testid="dropdown-open-state">{{ dropdownOpen() }}</span></p>
        </section>
      } @else if (current() === 'todo-list') {
        <section>
          <h2>TodoList Demo</h2>
          <rozie-todo-list [(items)]="todoItems" title="My Todos" />
        </section>
      } @else if (current() === 'modal') {
        <section>
          <h2>Modal Demo</h2>
          <button data-testid="open-modal" (click)="modalOpen.set(true)">
            Open Modal
          </button>
          <rozie-modal
            [(open)]="modalOpen"
            [closeOnEscape]="true"
            [closeOnBackdrop]="true"
            title="Hello from Modal.rozie"
            (close)="onModalClose()"
          >
            <ng-template #defaultSlot>
              <p>Modal body content. Close via Escape, backdrop click, or the × button.</p>
            </ng-template>
          </rozie-modal>
          @if (modalCloseCount() > 0) {
            <p data-testid="modal-close-count">Closed {{ modalCloseCount() }} time(s)</p>
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
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
    `,
  ],
})
export class AppComponent {
  pageKeys: ReadonlyArray<PageKey> = [
    'counter',
    'search-input',
    'dropdown',
    'todo-list',
    'modal',
  ];

  current = signal<PageKey>('counter');

  // Counter state
  counterValue = signal(0);

  // SearchInput state
  lastQuery = signal('');
  onSearch(q: unknown): void {
    this.lastQuery.set(String(q));
  }
  onClear(): void {
    this.lastQuery.set('');
  }

  // Dropdown state
  dropdownOpen = signal(false);

  // TodoList state
  todoItems = signal<TodoItem[]>([
    { id: '1', text: 'Write Phase 5 plan', done: true },
    { id: '2', text: 'Implement Angular emitter', done: true },
    { id: '3', text: 'Wire unplugin angular branch', done: false },
  ]);

  // Modal state
  modalOpen = signal(false);
  modalCloseCount = signal(0);
  onModalClose(): void {
    this.modalCloseCount.update((n) => n + 1);
  }
}
