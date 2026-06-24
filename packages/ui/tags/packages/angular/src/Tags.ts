import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

interface TagCtx {
  $implicit: { tag: any; index: any; remove: any };
  tag: any;
  index: any;
  remove: any;
}

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
  selector: 'rozie-tags',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-tags" [ngClass]="{ 'rozie-tags--disabled': (disabled() || this.__rozieCvaDisabled()), 'rozie-tags--readonly': readonly() }" #root role="group" [attr.aria-label]="ariaLabel()" #rozieSpread_0 #rozieListenersTarget_1>
      <ul class="rozie-tags-list">
        @for (t of tokens(); track t + ':' + tokens().indexOf(t)) {
    <li class="rozie-tags-chip">
          @if ((tagTpl ?? templates()?.['tag'])) {
    <ng-container *ngTemplateOutlet="(tagTpl ?? templates()?.['tag']); context: _tag_ctx_2(t)" />
    } @else {

            <span class="rozie-tags-chip__label">{{ rozieDisplay(t) }}</span>
            @if (!readonly()) {
    <button type="button" class="rozie-tags-chip__remove" [disabled]="!!(disabled() || this.__rozieCvaDisabled())" [attr.aria-label]="rozieAttr(removeLabel(t))" (click)="removeAt(tokens().indexOf(t))">×</button>
    }
    }
        </li>
    }
      </ul>

      @if (!readonly()) {
    <input class="rozie-tags-input" type="text" autocomplete="off" autocapitalize="off" [value]="draft()" [placeholder]="placeholder()" [disabled]="!!(disabled() || this.__rozieCvaDisabled()) || !!atMax()" [attr.aria-label]="ariaLabel()" [attr.aria-disabled]="!!(disabled() || this.__rozieCvaDisabled())" (input)="onInput($event)" (keydown)="onKeydown($event)" (paste)="onPaste($event)" (blur)="onBlur($event)" />
    }<span class="rozie-tags-count" aria-live="polite">{{ rozieDisplay(countLabel()) }}</span>
    </div>

  `,
  styles: [`
    .rozie-tags {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--rozie-tags-gap, 0.4rem);
      padding: var(--rozie-tags-padding, 0.35rem 0.45rem);
      font: var(--rozie-tags-font, inherit);
      background: var(--rozie-tags-bg, #fff);
      border: var(--rozie-tags-border-width, 1px) solid var(--rozie-tags-border-color, rgba(0, 0, 0, 0.25));
      border-radius: var(--rozie-tags-radius, 0.5rem);
      min-width: var(--rozie-tags-min-width, 12rem);
    }
    .rozie-tags:focus-within {
      border-color: var(--rozie-tags-accent, #0066cc);
      box-shadow: 0 0 0 var(--rozie-tags-focus-ring-width, 3px) var(--rozie-tags-focus-ring-color, rgba(0, 102, 204, 0.25));
    }
    .rozie-tags-list {
      display: contents;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rozie-tags-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--rozie-tags-chip-gap, 0.3rem);
      padding: var(--rozie-tags-chip-padding, 0.15rem 0.5rem);
      font-size: var(--rozie-tags-chip-font-size, 0.85rem);
      color: var(--rozie-tags-chip-color, inherit);
      background: var(--rozie-tags-chip-bg, rgba(0, 102, 204, 0.12));
      border-radius: var(--rozie-tags-chip-radius, 0.375rem);
      white-space: nowrap;
    }
    .rozie-tags-chip__remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--rozie-tags-remove-size, 1.1rem);
      height: var(--rozie-tags-remove-size, 1.1rem);
      padding: 0;
      font: inherit;
      line-height: 1;
      color: var(--rozie-tags-remove-color, currentColor);
      background: transparent;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      opacity: var(--rozie-tags-remove-opacity, 0.65);
      transition: opacity 0.15s, background 0.15s;
    }
    .rozie-tags-chip__remove:hover:not(:disabled) {
      opacity: 1;
      background: var(--rozie-tags-remove-hover-bg, rgba(0, 0, 0, 0.1));
    }
    .rozie-tags-chip__remove:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
    .rozie-tags-input {
      flex: 1 1 var(--rozie-tags-input-min, 4rem);
      min-width: var(--rozie-tags-input-min, 4rem);
      padding: var(--rozie-tags-input-padding, 0.15rem 0.1rem);
      font: inherit;
      color: var(--rozie-tags-color, inherit);
      background: transparent;
      border: none;
      outline: none;
    }
    .rozie-tags-input::placeholder {
      color: var(--rozie-tags-placeholder-color, rgba(0, 0, 0, 0.4));
    }
    .rozie-tags-input:disabled {
      cursor: not-allowed;
    }
    .rozie-tags-count {
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
    .rozie-tags--disabled {
      cursor: not-allowed;
      opacity: var(--rozie-tags-disabled-opacity, 0.6);
      background: var(--rozie-tags-disabled-bg, rgba(0, 0, 0, 0.04));
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Tags),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Tags {
  /**
   * The committed tokens — `model: true`, so a commit/remove/paste writes a **fresh** array back through `r-model:modelValue` (uncontrolled fallback `[]`). Because it is the sole model prop, the Angular output is a `ControlValueAccessor` (`[formControl]` / `[(ngModel)]` bind directly).
   * @example
   * <Tags r-model:modelValue="skills" placeholder="Add a skill…" />
   */
  modelValue = model<any[]>((() => [])());
  /**
   * The keys that commit the current draft as a token (matched against the key event's `key`). Default `[',', 'Enter']`. Non-`'Enter'` entries also act as the split characters when pasting bulk text. Use e.g. `[' ', 'Enter']` for a space-delimited input.
   */
  delimiters = input<any[]>((() => [',', 'Enter'])());
  /**
   * Allow the same token value to be added more than once. Defaults to `false` — a candidate equal (case-sensitive) to an existing token is silently rejected on commit. Set `true` to permit duplicates.
   */
  allowDuplicates = input<boolean>(false);
  /**
   * Maximum number of tokens. Once the list reaches `max`, the input is disabled and further adds (type, paste, programmatic) are rejected. `null` (the default) means unlimited.
   */
  max = input<(number) | null>(null);
  /**
   * Disable the whole control — the text input is disabled, every remove button is disabled, and no token can be added or removed. Also sets the Angular CVA disabled state.
   */
  disabled = input<boolean>(false);
  /**
   * Render the tokens read-only — they remain visible but cannot be added or removed, and the text input is hidden. Unlike `disabled` it carries no disabled styling, so it reads as a display of committed values.
   */
  readonly = input<boolean>(false);
  /**
   * Optional per-token validator / normalizer. Called with `(candidate, tokens)` for each commit; return a (possibly normalized) **string** to accept it, or a falsy value (`false` / `null` / `""`) to reject the candidate. Runs before the dedup + `max` checks. Example: `v => /^\S+@\S+$/.test(v) ? v.toLowerCase() : false` for emails.
   * @example
   * validate: (v) => (v.length >= 2 ? v.trim() : false)
   */
  validate = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Placeholder text for the inline text input (e.g. `"Add a tag…"`).
   */
  placeholder = input<string>('');
  /**
   * Accessible name for the whole control (`role="group"`). The inline text input is labelled with the same name so assistive tech announces what is being entered. A visually-hidden live region announces the current token count on change.
   */
  ariaLabel = input<(string) | null>(null);
  draft = signal('');
  root = viewChild<ElementRef<HTMLDivElement>>('root');
  change = output<unknown>();
  add = output<unknown>();
  remove = output<unknown>();
  @ContentChild('tag', { read: TemplateRef }) tagTpl?: TemplateRef<TagCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  tokens = () => Array.isArray(this.modelValue()) ? this.modelValue() : [];
  commitKeys = () => Array.isArray(this.delimiters()) ? this.delimiters() : [',', 'Enter'];
  splitChars = () => this.commitKeys().filter((k: any) => k !== 'Enter');
  atMax = () => typeof this.max() === 'number' && this.tokens().length >= this.max();
  canEdit = () => !(this.disabled() || this.__rozieCvaDisabled()) && !this.readonly();
  commitTokens = (next: any) => {
    this.modelValue.set(next), this.__rozieCvaOnChange(next);
    this.change.emit({
      value: next
    });
  };
  addToken = (raw: any) => {
    const __validate = this.validate();
    const __max = this.max();
    if (!this.canEdit()) return false;
    let candidate = String(raw == null ? '' : raw).trim();
    if (!candidate) return false;
    if (typeof __validate === 'function') {
      const result = __validate(candidate, this.tokens());
      if (!result) return false;
      candidate = String(result);
      if (!candidate) return false;
    }
    const cur = this.tokens();
    if (!this.allowDuplicates() && cur.indexOf(candidate) !== -1) return false;
    if (typeof __max === 'number' && cur.length >= __max) return false;
    const next = cur.concat([candidate]);
    this.commitTokens(next);
    this.add.emit({
      value: candidate,
      tokens: next
    });
    return true;
  };
  removeAt = (idx: any) => {
    if (!this.canEdit()) return;
    const cur = this.tokens();
    if (idx < 0 || idx >= cur.length) return;
    const removed = cur[idx];
    const next = cur.slice(0, idx).concat(cur.slice(idx + 1));
    this.commitTokens(next);
    this.remove.emit({
      value: removed,
      index: idx,
      tokens: next
    });
  };
  focusTheInput = () => {
    const root = this.root()?.nativeElement;
    if (!root) return;
    const el = root.querySelector('input');
    if (el) el.focus();
  };
  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
  };
  onKeydown = (e: any) => {
    if (!this.canEdit()) return;
    const key = e ? e.key : '';
    const value = e && e.target ? e.target.value : '';
    if (this.commitKeys().indexOf(key) !== -1) {
      if (e) e.preventDefault();
      if (this.addToken(value)) this.draft.set('');
      return;
    }
    if (key === 'Backspace' && value === '') {
      const cur = this.tokens();
      if (cur.length > 0) {
        if (e) e.preventDefault();
        this.removeAt(cur.length - 1);
      }
    }
  };
  onBlur = (e: any) => {
    if (!this.canEdit()) return;
    const value = e && e.target ? e.target.value : '';
    if (value && this.addToken(value)) this.draft.set('');
  };
  onPaste = (e: any) => {
    if (!this.canEdit()) return;
    const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
    const seps = this.splitChars();
    let parts = [text];
    if (seps.length) {
      // Split on every separator char in turn.
      for (let s = 0; s < seps.length; s++) {
        const sep = seps[s];
        const out = [];
        for (let p = 0; p < parts.length; p++) {
          const pieces = String(parts[p]).split(sep);
          for (let q = 0; q < pieces.length; q++) out.push(pieces[q]);
        }
        parts = out;
      }
    }
    const trimmed = parts.map((p: any) => String(p).trim()).filter((p: any) => p.length > 0);
    if (trimmed.length <= 1 && seps.length === 0) return; // let the input handle a plain paste
    if (e) e.preventDefault();
    let addedAny = false;
    for (let i = 0; i < trimmed.length; i++) {
      if (this.addToken(trimmed[i])) addedAny = true;
    }
    if (addedAny) this.draft.set('');
  };
  removeLabel = (t: any) => 'Remove ' + String(t);
  countLabel = () => {
    const n = this.tokens().length;
    return n === 1 ? '1 tag' : n + ' tags';
  };
  clear = () => {
    this.commitTokens([]);
    this.draft.set('');
    this.focusTheInput();
  };
  focusInput = () => this.focusTheInput();

  private __rozieCvaOnChange: (v: any[]) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: any[] | null): void {
    this.modelValue.set(v ?? (() => [])());
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
    _dir: Tags,
    _ctx: unknown,
  ): _ctx is TagCtx {
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

  private _tag_ctx_2 = (t: any) => ({ $implicit: { tag: t, index: this.tokens().indexOf(t), remove: () => this.removeAt(this.tokens().indexOf(t)) }, tag: t, index: this.tokens().indexOf(t), remove: () => this.removeAt(this.tokens().indexOf(t)) });

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Tags;
