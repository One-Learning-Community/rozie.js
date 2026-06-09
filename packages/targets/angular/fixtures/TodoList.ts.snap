import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

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

function __rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}

function __rozieAttr(v: unknown): string | null {
  return v == null ? null : __rozieDisplay(v);
}

@Component({
  selector: 'rozie-todo-list',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule],
  template: `

    <div class="todo-list" #rozieSpread_0 #rozieListenersTarget_1>
      <header>
        @if ((headerTpl ?? templates()?.['header'])) {
    <ng-container *ngTemplateOutlet="(headerTpl ?? templates()?.['header']); context: { $implicit: { remaining: remaining(), total: items().length }, remaining: remaining(), total: items().length }" />
    } @else {

          
          <h3>{{ title() }} ({{ rozieDisplay(remaining()) }} remaining)</h3>
        
    }
      </header>

      <form (submit)="_guarded_add_2($event)">
        <input [ngModel]="draft()" (ngModelChange)="draft.set($event)" [ngModelOptions]="{standalone: true}" placeholder="What needs doing?" />
        <button type="submit" [disabled]="!draft().trim()">Add</button>
      </form>

      @if (items().length > 0) {
    <ul>
        @for (item of items(); track item.id) {
    <li [class]="{ done: item.done }">
          
          @if ((defaultTpl ?? templates()?.['defaultSlot'])) {
    <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot']); context: _defaultSlot_ctx_3(item)" />
    } @else {

            <label><input type="checkbox" [checked]="item.done" (change)="_toggle(item.id)" /><span>{{ rozieDisplay(item.text) }}</span></label>
            <button aria-label="Remove" (click)="removeItem(item.id)">×</button>
          
    }
        </li>
    }
      </ul>
    } @else {
    <p class="empty">
        @if ((emptyTpl ?? templates()?.['empty'])) {
    <ng-container *ngTemplateOutlet="(emptyTpl ?? templates()?.['empty'])" />
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
  removeItem = (id: any) => {
    this.items.set(this.items().filter((i: any) => i.id !== id)), this.__rozieCvaOnChange(this.items().filter((i: any) => i.id !== id));
    this.remove.emit(id);
  };

  private __rozieCvaOnChange: (v: any[]) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  private __rozieCvaDisabled = signal(false);

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

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

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

  private _guarded_add_2 = ($event: any) => {
    $event.preventDefault();
    this._add();
  };

  private _defaultSlot_ctx_3 = (item: any) => ({ $implicit: { item: item, toggle: () => this._toggle(item.id), remove: () => this.removeItem(item.id) }, item: item, toggle: () => this._toggle(item.id), remove: () => this.removeItem(item.id) });

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default TodoList;
