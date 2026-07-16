import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { useSortableJS } from './internal/useSortableJS';

interface HeaderCtx {}

interface DefaultCtx {
  $implicit: { item: any; index: any };
  item: any;
  index: any;
}

interface FooterCtx {}

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
  selector: 'rozie-sortable-list',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-sortable-wrap" #__rozieRoot #rozieSpread_0 #rozieListenersTarget_1>
      <div [class]="['rozie-sortable-list', listClass()]" #listEl part="list">
        <ng-container *ngTemplateOutlet="(headerTpl ?? templates()?.['header'])" />
        @for (item of items(); track keyFor(item, index); let index = $index) {
    <div [class]="['rozie-sortable-item', itemClassFor(item, index), { 'rozie-sortable-item-lifted': liftedIndex() === index }]" [style]="itemStyleFor(item, index)" [attr.data-id]="rozieAttr(keyFor(item, index))" role="listitem" [attr.tabindex]="rozieAttr(keyboardEnabled() ? 0 : null)" (keydown)="onRowKeyDown($event, index)">
          <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot']); context: { $implicit: { item: item, index: index }, item: item, index: index }" />
        </div>
    }
        <ng-container *ngTemplateOutlet="(footerTpl ?? templates()?.['footer'])" />
      </div>
      <div class="rozie-sortable-aria-live" data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true">{{ ariaLiveText() }}</div>
    </div>

  `,
  styles: [`
    :host(rozie-sortable-list) { display: contents; }
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
  /**
   * The bound items array. The sole `model: true` prop — two-way bind it (`r-model:items` / `v-model:items` / `bind:items` / `[(items)]`) and SortableList writes the re-ordered array back whenever a drag, cross-list move, or keyboard reorder commits, with no manual `onChange → setState` wiring.
   * @example
   * <SortableList r-model:items="$data.todos" itemKey="id" />
   */
  items = model<any[]>((() => [])());
  /**
   * The per-row key the framework reconciler tracks each item by across a reorder — either a property name (e.g. `itemKey="id"` reads `item.id`) or an `(item, index) => key` function. With neither, id-less object items get a stable synthetic key via an internal `WeakMap` (survives reorder by object identity); primitive items fall back to index — pass a function for reorderable duplicate primitives.
   */
  itemKey = input<(string | ((...args: any[]) => any)) | null>(null);
  /**
   * CSS selector identifying the per-row drag handle, so a drag starts only from that element rather than anywhere in the row. Authored class names render literally on every target (React included), so a plain `.grip` works; `$classSelector('grip')` is an optional, typo-checked way to author it.
   */
  handle = input<(string) | null>(null);
  /**
   * SortableJS group name enabling cross-list drag — two lists sharing a `group` accept items between each other (the source fires `remove`, the destination fires `add`). Set `cloneable: true` to flip a string group into clone-mode.
   */
  group = input<(string) | null>(null);
  /**
   * Reorder animation duration in milliseconds. `0` disables the animation. Runtime-updatable.
   */
  animation = input<number>(150);
  /**
   * Temporarily disable dragging without unmounting — reapplied live via `instance.option('disabled', v)` (no remount). Also suppresses keyboard reordering: a disabled list is not sortable by any input, so rows lose their `tabindex` and the keydown handler no-ops.
   */
  disabled = input<boolean>(false);
  /**
   * Opt out of keyboard reordering (Space lift / Arrow move / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no `tabindex`) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`.
   */
  disableKeyboard = input<boolean>(false);
  /**
   * Verbatim SortableJS options pass-through for anything not covered by the named props. The named props win on key conflict but `options` lands AFTER them in the merge so consumers can override defaults; handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onClone`) are stripped — the helper owns those paths.
   */
  options = input<Record<string, any>>((() => ({}))());
  /**
   * Optional `(item, idx) => string` returning the screen-reader label for the aria-live announcer during keyboard drag. Defaults to `item.label` (or `String(item)` when no `label` field exists).
   */
  labelFor = input<((...args: any[]) => any) | null>(null);
  /**
   * Class name applied to the drop-placeholder (ghost) element while dragging. Forwarded live via `instance.option`, so toggling it at runtime takes effect without a remount.
   */
  ghostClass = input<(string) | null>(null);
  /**
   * Class name applied to the currently-chosen item while dragging. Forwarded live via `instance.option` (no remount needed to change it).
   */
  chosenClass = input<(string) | null>(null);
  /**
   * Class name applied to the dragging element. Only takes effect in fallback mode (`forceFallback: true`). Forwarded live via `instance.option`.
   */
  dragClass = input<(string) | null>(null);
  /**
   * CSS selector that prevents drag initiation on matching rows (locked items). SortableJS checks it at `mousedown`/`touchstart` and aborts the drag if it matches. A `data-*` attribute selector (e.g. `[data-locked]`) is the most robust choice across all targets.
   */
  filter = input<(string) | null>(null);
  /**
   * CSS easing function for the reorder animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). Runtime-updatable.
   */
  easing = input<(string) | null>(null);
  /**
   * Force SortableJS's mouse-event drag path over HTML5 DnD — useful for touch devices, consistent cross-browser behavior, and synthetic test drivers (and `dragClass` only applies in this mode). **Construction-time only**: SortableJS reads it once at construction, so re-key the `<SortableList>` to toggle it at runtime.
   */
  forceFallback = input<boolean>(false);
  /**
   * SortableJS swap threshold (0..1) — a lower value makes rows swap earlier as the dragged item overlaps a neighbor. Reapplied live via `instance.option('swapThreshold', v)` — SortableJS reads it on every dragover, so no remount is needed.
   */
  swapThreshold = input<number>(1);
  /**
   * High-level prop that REPLACES a string `group` with SortableJS's `{ name, pull: 'clone', put: true }` clone-mode object form — the source deposits a COPY onto the destination and keeps its own array unchanged (the palette → canvas pattern). With `group: null` it is a no-op (a clone-mode list with no group name has no peer to clone into). Reapplied live — toggling `cloneable` (or changing `group`) recomputes the clone-mode shape and reapplies it via `instance.option('group', …)`, no remount.
   */
  cloneable = input<boolean>(false);
  /**
   * Extra class(es) merged onto the list container (the SortableJS root) alongside the base `rozie-sortable-list` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding), normalized identically across all six targets — the hook for bridging a CSS framework (`.list-group`) or a flex/grid parent onto the component.
   */
  listClass = input<string | any[] | Record<string, any>>('');
  /**
   * Extra class(es) merged onto every item row alongside the base `rozie-sortable-item` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding) applied uniformly, OR an `(item, index) => class` function for per-row classes evaluated at render time. Normalized identically across all six targets.
   */
  itemClass = input<string | any[] | Record<string, any> | ((...args: any[]) => any)>('');
  /**
   * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
   */
  itemStyle = input<(string | Record<string, any> | ((...args: any[]) => any)) | null>(null);
  liftedIndex = signal<any>(null);
  ariaLiveText = signal('');
  listEl = viewChild<ElementRef<HTMLDivElement>>('listEl');
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  change = output<unknown>();
  add = output<unknown>();
  remove = output<unknown>();
  start = output<unknown>();
  end = output<unknown>();
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;
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
  private __rozieWatchInitial_8 = true;
  private __rozieWatchInitial_9 = true;

  constructor() {
    effect(() => { const __watchVal = (() => (this.disabled() || this.__rozieCvaDisabled()))(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => this.instance?.option('disabled', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.group())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => this.instance?.option('group', this.resolveGroup()))(); }); });
    effect(() => { const __watchVal = (() => this.cloneable())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => this.instance?.option('group', this.resolveGroup()))(); }); });
    effect(() => { const __watchVal = (() => this.swapThreshold())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => this.instance?.option('swapThreshold', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.handle())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => this.instance?.option('handle', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.ghostClass())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => this.instance?.option('ghostClass', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.chosenClass())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } ((v: any) => this.instance?.option('chosenClass', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.dragClass())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((v: any) => this.instance?.option('dragClass', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.filter())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } ((v: any) => this.instance?.option('filter', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.easing())(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } ((v: any) => this.instance?.option('easing', v))(__watchVal); }); });
  }

  ngAfterViewInit() {
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
        group: this.resolveGroup(),
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
  __rowKeyMap = new WeakMap();
  __rowKeySeq = 0;
  keyFor = (item: any, index: any) => {
    const __itemKey = this.itemKey();
    // (a) function itemKey: consumer-supplied (item, index) => key.
    if (typeof __itemKey === 'function') {
      return __itemKey(item, index);
    }
    // (b) string itemKey: a property name on a non-null object item.
    if (typeof __itemKey === 'string' && item !== null && typeof item === 'object' && item[__itemKey] != null) {
      return item[__itemKey];
    }
    // (c) id-less object (or function) item: assign-on-first-sight WeakMap
    //     synthetic id. Survives reorder because it is keyed by object identity.
    if (item !== null && typeof item === 'object' || typeof item === 'function') {
      if (!this.__rowKeyMap.has(item)) {
        this.__rowKeyMap.set(item, '__rk' + this.__rowKeySeq++);
      }
      return this.__rowKeyMap.get(item);
    }
    // (d) primitive item: fall back to index. NOTE: duplicate primitives are
    //     unsafe to reorder this way — pass a function itemKey for those.
    return index;
  };
  resolveGroup = () => this.cloneable() && typeof this.group() === 'string' ? {
    name: this.group(),
    pull: 'clone' as const,
    put: true as const
  } : this.group() ?? undefined;
  itemClassFor = (item: any, index: any) => {
    const v = this.itemClass();
    return typeof v === 'function' ? v(item, index) : v;
  };
  itemStyleFor = (item: any, index: any) => {
    const __itemStyle = this.itemStyle();
    const s = typeof __itemStyle === 'function' ? __itemStyle(item, index) : __itemStyle;
    return s == null || s === '' ? null : s;
  };
  getLabel = (idx: any) => {
    const __labelFor = this.labelFor();
    const item = this.items()[idx];
    if (__labelFor !== null) return __labelFor(item, idx);
    if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
    return String(item);
  };
  keyboardEnabled = () => !(this.disabled() || this.__rozieCvaDisabled()) && !this.disableKeyboard();
  onRowKeyDown = ($event: any, index: any) => {
    // Origin guard (quick 260716-ggq): reorder keys apply ONLY when the row
    // element ITSELF is focused. A slotted interactive child (an <input>,
    // <button>, etc. rendered into the row's default slot) bubbles its own
    // keydown up to this handler — without this guard, Space/Enter typed into
    // that child would be hijacked for lift/drop instead of reaching the
    // child. Must run FIRST, before the keyboardEnabled() check.
    if ($event.target !== $event.currentTarget) return;
    // Defense-in-depth: when keyboard reordering is off the rows carry no
    // tabindex and can't receive focus, but a consumer-focused row (or a
    // programmatic .focus()) must still no-op here rather than reorder.
    if (!this.keyboardEnabled()) return;
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
  getInstance = () => {
    return this.instance;
  };
  toArray = () => {
    return this.instance ? this.instance.toArray() : [];
  };
  sort = (order: any, useAnimation: any = true) => {
    this.instance?.sort(order, useAnimation);
  };
  option = (name: any, value: any) => {
    if (!this.instance) return undefined;
    if (value === undefined) return this.instance.option(name);
    this.instance.option(name, value);
    return value;
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
    _dir: SortableList,
    _ctx: unknown,
  ): _ctx is HeaderCtx | DefaultCtx | FooterCtx {
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default SortableList;
