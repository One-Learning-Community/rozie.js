import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { useSortableJS } from './internal/useSortableJS';

interface DefaultCtx {
  $implicit: { item: any; index: any };
  item: any;
  index: any;
}

@Component({
  selector: 'rozie-sortable-list',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-sortable-wrap" #__rozieRoot #rozieSpread_0 #rozieListenersTarget_1>
      <div class="rozie-sortable-list" #listEl part="list">
        @for (item of items(); track keyFor(item, index); let index = $index) {
    <div class="rozie-sortable-item" [ngClass]="{ 'rozie-sortable-item-lifted': liftedIndex() === index }" role="listitem" tabindex="0" (keydown)="onRowKeyDown($event, index)">
          <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot']); context: { $implicit: { item: item, index: index }, item: item, index: index }" />
        </div>
    }
      </div>
      <div class="rozie-sortable-aria-live" data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true">{{ ariaLiveText() }}</div>
    </div>

  `,
  styles: [`
    .rozie-sortable-wrap { display: block; }
    .rozie-sortable-list { display: block; }
    .rozie-sortable-item { display: block; outline: none; }
    .rozie-sortable-item:focus { outline: 2px solid rgba(0, 102, 204, 0.6); outline-offset: -2px; }
    .rozie-sortable-item-lifted {
      background: rgba(0, 102, 204, 0.08);
      box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.4) inset;
    }
    .rozie-sortable-aria-live {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SortableList),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class SortableList {
  items = model<any[]>((() => [])());
  itemKey = input<(string) | null>(null);
  handle = input<(string) | null>(null);
  group = input<(string) | null>(null);
  animation = input<number>(150);
  disabled = input<boolean>(false);
  options = input<Record<string, any>>((() => ({}))());
  labelFor = input<((...args: unknown[]) => unknown) | null>(null);
  ghostClass = input<(string) | null>(null);
  chosenClass = input<(string) | null>(null);
  dragClass = input<(string) | null>(null);
  filter = input<(string) | null>(null);
  easing = input<(string) | null>(null);
  forceFallback = input<boolean>(false);
  swapThreshold = input<number>(1);
  cloneable = input<boolean>(false);
  liftedIndex = signal<any>(null);
  ariaLiveText = signal('');
  listEl = viewChild<ElementRef<HTMLDivElement>>('listEl');
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  change = output<unknown>();
  add = output<unknown>();
  remove = output<unknown>();
  start = output<unknown>();
  end = output<unknown>();
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;
  private __rozieWatchInitial_6 = true;
  private __rozieWatchInitial_7 = true;

  constructor() {
    effect(() => { const __watchVal = (() => (this.disabled() || this.__rozieCvaDisabled()))(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => this.instance?.option('disabled', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.group())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => this.instance?.option('group', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.handle())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } ((v: any) => this.instance?.option('handle', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.ghostClass())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => this.instance?.option('ghostClass', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.chosenClass())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => this.instance?.option('chosenClass', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.dragClass())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => this.instance?.option('dragClass', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.filter())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } ((v: any) => this.instance?.option('filter', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.easing())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((v: any) => this.instance?.option('easing', v))(__watchVal); }); });
  }

  ngAfterViewInit() {
    const __group = this.group();
    // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
    // when the options object below references it.
    const sortable = useSortableJS(this.listEl()!.nativeElement, {
      items: () => this.items(),
      onCommit: (next: any) => {
        this.items.set(next), this.__rozieCvaOnChange(next);
      },
      options: {
        animation: this.animation(),
        disabled: (this.disabled() || this.__rozieCvaDisabled()),
        // `cloneable` is a high-level Rozie prop that REPLACES a string
        // `group` with SortableJS's `{ name, pull: 'clone', put: true }`
        // object form. When `cloneable:false`, pass `$props.group` through
        // verbatim. When `cloneable:true` AND `$props.group` is null,
        // leave it null — a clone-mode list without a group name is not
        // meaningful (no peer list can join the cross-list flow).
        group: this.cloneable() && typeof __group === 'string' ? {
          name: __group,
          pull: 'clone',
          put: true
        } : __group,
        handle: this.handle(),
        ghostClass: this.ghostClass(),
        chosenClass: this.chosenClass(),
        dragClass: this.dragClass(),
        filter: this.filter(),
        forceFallback: this.forceFallback(),
        swapThreshold: this.swapThreshold(),
        easing: this.easing(),
        ...this.options()
      },
      // Lit lit-html `repeat` directive caches its part array by sentinel-
      // comment node identity; SortableJS's physical DOM mutation desyncs
      // that cache. The sigil lowers to `__rozieReconcileAfterDomMutation(this)`
      // on Lit (real call) and `void 0` on the other 5 targets (no-op).
      afterCommit: () => void 0,
      onChange: ({
        kind,
        oldIndex,
        newIndex,
        item
      }: any) => {
        if (kind === 'reorder') this.change.emit({
          oldIndex,
          newIndex,
          item
        });else if (kind === 'add') this.add.emit({
          newIndex,
          item
        });else if (kind === 'remove') this.remove.emit({
          oldIndex,
          item
        });
      },
      onStart: (e: any) => this.start.emit(e),
      onEnd: (e: any) => this.end.emit(e)
    });
    this.instance = sortable.instance;
    // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
    // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
    // outside the setup IIFE. Closing over `instance` (a module-scope `let`)
    // works on every target.
    this.__rozieDestroyRef.onDestroy(() => this.instance?.destroy());
  }

  instance: any = null;
  keyFor = (item: any, index: any) => {
    const __itemKey = this.itemKey();
    if (__itemKey && item !== null && typeof item === 'object') {
      return item[__itemKey] ?? index;
    }
    return item ?? index;
  };
  getLabel = (idx: any) => {
    const __labelFor = this.labelFor();
    const item = this.items()[idx];
    if (__labelFor !== null) return __labelFor(item, idx);
    if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
    return String(item);
  };
  onRowKeyDown = ($event: any, index: any) => {
    const key = $event.key;
    // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift/drop.
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      $event.preventDefault();
      if (this.liftedIndex() === null) {
        // LIFT
        this.liftedIndex.set(index);
        this.ariaLiveText.set('Lifted ' + this.getLabel(index));
        return;
      }
      // DROP
      const dropped = this.getLabel(this.liftedIndex());
      const at = this.liftedIndex();
      this.liftedIndex.set(null);
      this.ariaLiveText.set('Dropped ' + dropped + ' at position ' + (at + 1));
      return;
    }
    if (key === 'Escape') {
      if (this.liftedIndex() === null) return;
      $event.preventDefault();
      const cancelled = this.getLabel(this.liftedIndex());
      this.liftedIndex.set(null);
      this.ariaLiveText.set('Cancelled lift of ' + cancelled);
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (this.liftedIndex() === null) return;
      $event.preventDefault();
      const dir = key === 'ArrowDown' ? 1 : -1;
      const from = this.liftedIndex();
      const to = from + dir;
      if (to < 0 || to >= this.items().length) return;
      const next = [...this.items()];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      this.items.set(next), this.__rozieCvaOnChange(next);
      this.liftedIndex.set(to);
      this.ariaLiveText.set('Moved ' + this.getLabel(to) + ' to position ' + (to + 1));
      // After the keyed reorder write, restore focus to the moved row. No-op
      // on React/Vue/Angular (DOM identity preserved); queueMicrotask +
      // querySelectorAll + .focus() on Svelte/Solid/Lit (DOM re-created).
      void 0;
      this.change.emit({
        oldIndex: from,
        newIndex: to,
        item: moved
      });
    }
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
    _dir: SortableList,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }

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
}

export default SortableList;
