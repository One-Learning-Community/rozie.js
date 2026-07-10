import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { clampPercent, percentFromPointer, nudge } from './internal/resizeMath';

// ---- derived view (plain functions, uniform ×6) ------------------------
// The current size, normalized + clamped. Plain function (called in template
// bindings AND handlers) — never $computed (a $computed is a value on React but
// an accessor on Solid; a plain fn reads uniformly).

interface StartCtx {}

interface HandleCtx {}

interface EndCtx {}

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
  selector: 'rozie-resizable',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-resizable" [ngClass]="{ 'rozie-resizable--vertical': isVertical(), 'rozie-resizable--horizontal': !isVertical(), 'rozie-resizable--dragging': dragging(), 'rozie-resizable--disabled': (disabled() || this.__rozieCvaDisabled()) }" #root [style]="sizeStyle()" #rozieSpread_0 #rozieListenersTarget_1>
      
      <div class="rozie-resizable-panel rozie-resizable-panel--start">
        <ng-container *ngTemplateOutlet="(startTpl ?? templates()?.['start'])" />
      </div>

      
      <div class="rozie-resizable-handle" role="separator" tabindex="0" [attr.aria-orientation]="rozieAttr(isVertical() ? 'horizontal' : 'vertical')" [attr.aria-valuenow]="size()" [attr.aria-valuemin]="min()" [attr.aria-valuemax]="max()" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" (pointerdown)="onPointerDown($event)" (pointermove)="onPointerMove($event)" (pointerup)="onPointerUp($event)" (keydown)="onKeydown($event)">
        @if ((handleTpl ?? templates()?.['handle'])) {
    <ng-container *ngTemplateOutlet="(handleTpl ?? templates()?.['handle'])" />
    } @else {

          <span class="rozie-resizable-grip" aria-hidden="true"></span>
        
    }
      </div>

      
      <div class="rozie-resizable-panel rozie-resizable-panel--end">
        <ng-container *ngTemplateOutlet="(endTpl ?? templates()?.['end'])" />
      </div>
    </div>

  `,
  styles: [`
    :host(rozie-resizable) { display: contents; }
    .rozie-resizable {
      display: flex;
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      font: var(--rozie-resizable-font, inherit);
    }
    .rozie-resizable--horizontal {
      flex-direction: row;
    }
    .rozie-resizable--vertical {
      flex-direction: column;
    }
    .rozie-resizable-panel {
      box-sizing: border-box;
      overflow: auto;
    }
    .rozie-resizable-panel--start {
      flex: 0 0 auto;
    }
    .rozie-resizable--horizontal .rozie-resizable-panel--start {
      width: var(--rozie-resizable-size, 50%);
      height: 100%;
    }
    .rozie-resizable--vertical .rozie-resizable-panel--start {
      height: var(--rozie-resizable-size, 50%);
      width: 100%;
    }
    .rozie-resizable-panel--end {
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
    }
    .rozie-resizable-handle {
      flex: 0 0 var(--rozie-resizable-handle-size, 0.5rem);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--rozie-resizable-handle-bg, rgba(0, 0, 0, 0.08));
      outline: none;
      transition: background-color 0.15s;
      touch-action: none;
    }
    .rozie-resizable--horizontal .rozie-resizable-handle {
      cursor: col-resize;
      align-self: stretch;
    }
    .rozie-resizable--vertical .rozie-resizable-handle {
      cursor: row-resize;
    }
    .rozie-resizable-handle:hover {
      background: var(--rozie-resizable-handle-hover-bg, rgba(0, 0, 0, 0.16));
    }
    .rozie-resizable-handle:focus-visible {
      box-shadow: 0 0 0 var(--rozie-resizable-focus-ring-width, 2px)
        var(--rozie-resizable-focus-ring-color, rgba(0, 102, 204, 0.5));
      z-index: 1;
    }
    .rozie-resizable--dragging .rozie-resizable-handle {
      background: var(--rozie-resizable-handle-active-bg, var(--rozie-resizable-accent, #0066cc));
    }
    .rozie-resizable-grip {
      display: block;
      border-radius: 999px;
      background: var(--rozie-resizable-grip-bg, rgba(0, 0, 0, 0.35));
    }
    .rozie-resizable--horizontal .rozie-resizable-grip {
      width: var(--rozie-resizable-grip-thickness, 2px);
      height: var(--rozie-resizable-grip-length, 1.5rem);
    }
    .rozie-resizable--vertical .rozie-resizable-grip {
      height: var(--rozie-resizable-grip-thickness, 2px);
      width: var(--rozie-resizable-grip-length, 1.5rem);
    }
    .rozie-resizable--disabled .rozie-resizable-handle {
      cursor: default;
      opacity: var(--rozie-resizable-disabled-opacity, 0.55);
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Resizable),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Resizable {
  /**
   * The first (`start`) panel's size as a percent of the container along the split axis (its width when `direction="horizontal"`, its height when `"vertical"`). Two-way via `r-model:size`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so the splitter position **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Every commit (drag, keyboard, or a programmatic `applySize`) is clamped to `[min, max]` and written back.
   * @example
   * <Resizable r-model:size="split" :min="20" :max="80" direction="horizontal" />
   */
  size = model<number>(50);
  /**
   * The split axis. `'horizontal'` (default) lays the two panels out side-by-side with a vertical drag handle between them (`size` is the first panel's **width**); `'vertical'` stacks them with a horizontal handle (`size` is the first panel's **height**). Also sets the handle's `aria-orientation`.
   */
  direction = input<string>('horizontal');
  /**
   * The minimum `size` percent — the first panel can never be dragged or nudged below this. Clamps every commit.
   */
  min = input<number>(10);
  /**
   * The maximum `size` percent — the first panel can never be dragged or nudged beyond this (so the second panel keeps at least `100 - max` percent). Clamps every commit.
   */
  max = input<number>(90);
  /**
   * Disable resizing — the handle becomes non-interactive (pointer drag and keyboard are ignored) and the panels lock at the current `size`. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled = input<boolean>(false);
  dragging = signal(false);
  root = viewChild<ElementRef<HTMLDivElement>>('root');
  resize = output<unknown>();
  @ContentChild('start', { read: TemplateRef }) startTpl?: TemplateRef<StartCtx>;
  @ContentChild('handle', { read: TemplateRef }) handleTpl?: TemplateRef<HandleCtx>;
  @ContentChild('end', { read: TemplateRef }) endTpl?: TemplateRef<EndCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  currentSize = () => {
    const __size = this.size();
    const __min = this.min();
    const raw = typeof __size === 'number' ? __size : __min;
    return clampPercent(raw, __min, this.max());
  };
  isVertical = () => this.direction() === 'vertical';
  sizeStyle = () => ({
    '--rozie-resizable-size': this.currentSize() + '%'
  });
  commitSize = (raw: any) => {
    const next = clampPercent(raw, this.min(), this.max());
    this.size.set(next), this.__rozieCvaOnChange(next);
    this.resize.emit({
      size: next
    });
  };
  onPointerDown = (e: any) => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    if (e && e.preventDefault) e.preventDefault();
    this.dragging.set(true);
    // Capture the pointer on the handle so move/up keep firing on it even when the
    // pointer leaves the handle mid-drag.
    if (e && e.currentTarget && e.currentTarget.setPointerCapture && e.pointerId != null) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  onPointerMove = (e: any) => {
    if (!this.dragging() || (this.disabled() || this.__rozieCvaDisabled())) return;
    const root = this.root()?.nativeElement;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const pct = this.isVertical() ? percentFromPointer(e.clientY, rect.top, rect.height) : percentFromPointer(e.clientX, rect.left, rect.width);
    this.commitSize(pct);
  };
  onPointerUp = (e: any) => {
    if (!this.dragging()) return;
    this.dragging.set(false);
    if (e && e.currentTarget && e.currentTarget.releasePointerCapture && e.pointerId != null) {
      if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };
  onKeydown = (e: any) => {
    const __min = this.min();
    const __max = this.max();
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    const key = e ? e.key : '';
    const vertical = this.isVertical();
    const decKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const incKey = vertical ? 'ArrowDown' : 'ArrowRight';
    if (key === decKey) {
      if (e) e.preventDefault();
      this.commitSize(nudge(this.currentSize(), -1, __min, __max));
    } else if (key === incKey) {
      if (e) e.preventDefault();
      this.commitSize(nudge(this.currentSize(), 1, __min, __max));
    } else if (key === 'Home') {
      if (e) e.preventDefault();
      this.commitSize(__min);
    } else if (key === 'End') {
      if (e) e.preventDefault();
      this.commitSize(__max);
    }
  };
  applySize = (percent: any) => this.commitSize(percent);
  reset = () => this.commitSize((this.min() + this.max()) / 2);

  private __rozieCvaOnChange: (v: number) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: number | null): void {
    this.size.set(v ?? 50);
  }
  registerOnChange(fn: (v: number) => void): void {
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
    _dir: Resizable,
    _ctx: unknown,
  ): _ctx is StartCtx | HandleCtx | EndCtx {
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Resizable;
