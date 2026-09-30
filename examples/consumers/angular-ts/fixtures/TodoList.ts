import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

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

    <div class="todo-list" #rozieSpread_0 #rozieListenersTarget_1>
      <header>
        @if ((headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])) {
    <ng-container *ngTemplateOutlet="(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header']); context: { $implicit: { remaining: remaining(), total: items().length }, remaining: remaining(), total: items().length }" />
    } @else {

          
          <h3>{{ title() }} ({{ rozieDisplay(remaining()) }} remaining)</h3>
        
    }
      </header>

      <form (submit)="$event.preventDefault(); _add()">
        <input [ngModel]="draft()" (ngModelChange)="draft.set($event)" [ngModelOptions]="{standalone: true}" placeholder="What needs doing?" />
        <button type="submit" [disabled]="!draft().trim()">Add</button>
      </form>

      @if (items().length > 0) {
    <ul>
        @for (item of items(); track item.id) {
    <li [class]="{ done: item.done }">
          
          @if ((defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])) {
    <ng-container *ngTemplateOutlet="(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot']); context: _defaultSlot_ctx_2(item)" />
    } @else {

            <label><input type="checkbox" [checked]="item.done" (change)="_toggle(item.id)" /><span>{{ rozieDisplay(item.text) }}</span></label>
            <button aria-label="Remove" (click)="removeItem(item.id)">×</button>
          
    }
        </li>
    }
      </ul>
    } @else {
    <p class="empty">
        @if ((emptyTpl ?? __rozieFillMap()['empty'] ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? __rozieFillMap()['empty'] ?? templates()?.['empty'])" />
    } @else {
    Nothing to do. ✨
    }
      </p>
    }</div>

  `,
  styles: [`
    :host(rozie-todo-list) { display: contents; }
    .todo-list { font-family: system-ui, sans-serif; }
    ul { list-style: none; padding: 0; }
    li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
    li.done span { text-decoration: line-through; opacity: 0.5; }
    .empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
    form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TodoList),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
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
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map = Object.create(null) as Record<string, TemplateRef<unknown>>;
    for (const f of this.__rozieFills()) {
      const k = f.rozieSlot();
      if (k == null) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      map[k === '' ? 'defaultSlot' : k] = f.templateRef;
    }
    return map;
  });

  remaining = computed(() => this.items().filter((i: any) => !i.done).length);

  _add = () => {
    const text = this.draft().trim();
    if (!text) return;
    this.items.set([...this.items(), {
      id: crypto.randomUUID(),
      text,
      done: false
    }]), this.__rozieCvaOnChange([...this.items(), {
      id: crypto.randomUUID(),
      text,
      done: false
    }]);
    this.draft.set('');
    this.add.emit(text);
  };
  _toggle = (id: any) => {
    this.items.set(this.items().map((i: any) => i.id === id ? {
      ...i,
      done: !i.done
    } : i)), this.__rozieCvaOnChange(this.items().map((i: any) => i.id === id ? {
      ...i,
      done: !i.done
    } : i));
    this.toggle.emit(id);
  };
  // Internal method renamed from `remove` to `removeItem` to avoid colliding
  // with `HTMLElement.prototype.remove()` on the Lit target — Lit emits user
  // methods as class fields and the resulting `remove(id)` signature is
  // incompatible with the inherited `remove(): void`. Public API is unchanged:
  // the slot param is still `:remove`, the emitted event is still `'remove'`.
  removeItem = (id: any) => {
    this.items.set(this.items().filter((i: any) => i.id !== id)), this.__rozieCvaOnChange(this.items().filter((i: any) => i.id !== id));
    this.remove.emit(id);
  };

  private __rozieCvaOnChange: (v: any[]) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: any[] | null): void {
    this.items.set(v ?? (() => [])());
  }
  registerOnChange(fn: (v: any[]) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  static ngTemplateContextGuard(
    _dir: TodoList,
    _ctx: unknown,
  ): _ctx is HeaderCtx | DefaultCtx | EmptyCtx {
    return true;
  }

  private __rozieDestroyRef = inject(DestroyRef);

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });

  private _defaultSlot_ctx_2 = (item: any) => ({ $implicit: { item: item, toggle: () => this._toggle(item.id), remove: () => this.removeItem(item.id) }, item: item, toggle: () => this._toggle(item.id), remove: () => this.removeItem(item.id) });

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default TodoList;
