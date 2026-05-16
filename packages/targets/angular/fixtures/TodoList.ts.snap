import { Component, ContentChild, TemplateRef, ViewEncapsulation, computed, input, model, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface HeaderCtx {
  $implicit: { remaining: any; total: any };
  remaining: any;
  total: any;
}

interface DefaultCtx {
  $implicit: { item: any; toggle: any; remove: any };
  item: any;
  toggle: any;
  remove: any;
}

interface EmptyCtx {}

@Component({
  selector: 'rozie-todo-list',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule],
  template: `

    <div class="todo-list">
      <header>
        @if (headerTpl) {
    <ng-container *ngTemplateOutlet="headerTpl; context: { $implicit: { remaining: remaining(), total: items().length }, remaining: remaining(), total: items().length }" />
    } @else {

          
          <h3>{{ title() }} ({{ remaining() }} remaining)</h3>
        
    }
      </header>

      <form (submit)="_guarded_add($event)">
        <input [ngModel]="draft()" (ngModelChange)="draft.set($event)" [ngModelOptions]="{standalone: true}" placeholder="What needs doing?" />
        <button type="submit" [disabled]="!draft().trim()">Add</button>
      </form>

      @if (items().length > 0) {
    <ul>
        @for (item of items(); track item.id) {
    <li [class]="{ done: item.done }">
          
          @if (defaultTpl) {
    <ng-container *ngTemplateOutlet="defaultTpl; context: _defaultSlot_ctx_1(item)" />
    } @else {

            <label><input type="checkbox" [checked]="item.done" (change)="_toggle(item.id)" /><span>{{ item.text }}</span></label>
            <button aria-label="Remove" (click)="_remove(item.id)">×</button>
          
    }
        </li>
    }
      </ul>
    } @else {
    <p class="empty">
        @if (emptyTpl) {
    <ng-container *ngTemplateOutlet="emptyTpl" />
    } @else {
    Nothing to do. ✨
    }
      </p>
    }</div>

  `,
  styles: [`
    .todo-list { font-family: system-ui, sans-serif; }
    ul { list-style: none; padding: 0; }
    li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
    li.done span { text-decoration: line-through; opacity: 0.5; }
    .empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
    form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }
  `],
})
export class TodoList {
  items = model<any[]>((() => [])());
  title = input<string>('Todo');
  draft = signal('');
  add = output<unknown>();
  toggle = output<unknown>();
  remove = output<unknown>();
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;

  remaining = computed(() => this.items().filter(i => !i.done).length);

  _add = () => {
    const text = this.draft().trim();
    if (!text) return;
    this.items.set([...this.items(), {
      id: crypto.randomUUID(),
      text,
      done: false
    }]);
    this.draft.set('');
    this.add.emit(text);
  };
  _toggle = (id: any) => {
    this.items.set(this.items().map(i => i.id === id ? {
      ...i,
      done: !i.done
    } : i));
    this.toggle.emit(id);
  };
  _remove = (id: any) => {
    this.items.set(this.items().filter(i => i.id !== id));
    this.remove.emit(id);
  };

  static ngTemplateContextGuard(
    _dir: TodoList,
    _ctx: unknown,
  ): _ctx is HeaderCtx | DefaultCtx | EmptyCtx {
    return true;
  }

  private _guarded_add = (e: any) => {
    e.preventDefault();
    this._add();
  };

  private _defaultSlot_ctx_1 = (item: any) => ({ $implicit: { item: item, toggle: () => this._toggle(item.id), remove: () => this._remove(item.id) }, item: item, toggle: () => this._toggle(item.id), remove: () => this._remove(item.id) });
}

export default TodoList;
