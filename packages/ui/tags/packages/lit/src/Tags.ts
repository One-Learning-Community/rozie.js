import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { RozieSlotDistributor, createLitControllableProperty, injectGlobalStyles, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

interface RozieTagSlotCtx {
  tag: any;
  index: any;
  remove: any;
}

@customElement('rozie-tags')
export default class Tags extends SignalWatcher(LitElement) {
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };

  static styles = css`
:host{display:contents}
.rozie-tags[data-rozie-s-64848f8e] {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rozie-tags-gap, var(--rtg-gap, 0.4rem));
  padding: var(--rozie-tags-padding, var(--rtg-padding, 0.35rem 0.45rem));
  font: var(--rozie-tags-font, inherit);
  background: var(--rozie-tags-bg, var(--rtg-bg, #fff));
  border: var(--rozie-tags-border-width, var(--rtg-border-width, 1px)) solid var(--rozie-tags-border-color, var(--rtg-border-color, rgba(0, 0, 0, 0.25)));
  border-radius: var(--rozie-tags-radius, var(--rtg-radius, 0.5rem));
  min-width: var(--rozie-tags-min-width, var(--rtg-min-width, 12rem));
}
.rozie-tags[data-rozie-s-64848f8e]:focus-within {
  border-color: var(--rozie-tags-accent, var(--rtg-accent, #0066cc));
  box-shadow: 0 0 0 var(--rozie-tags-focus-ring-width, var(--rtg-focus-ring-width, 3px)) var(--rozie-tags-focus-ring-color, var(--rtg-focus-ring-color, rgba(0, 102, 204, 0.25)));
}
.rozie-tags-list[data-rozie-s-64848f8e] {
  display: contents;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rozie-tags-chip[data-rozie-s-64848f8e] {
  display: inline-flex;
  align-items: center;
  gap: var(--rozie-tags-chip-gap, var(--rtg-chip-gap, 0.3rem));
  padding: var(--rozie-tags-chip-padding, var(--rtg-chip-padding, 0.15rem 0.5rem));
  font-size: var(--rozie-tags-chip-font-size, var(--rtg-chip-font-size, 0.85rem));
  color: var(--rozie-tags-chip-color, var(--rtg-chip-color, inherit));
  background: var(--rozie-tags-chip-bg, var(--rtg-chip-bg, rgba(0, 102, 204, 0.12)));
  border-radius: var(--rozie-tags-chip-radius, var(--rtg-chip-radius, 0.375rem));
  white-space: nowrap;
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rozie-tags-remove-size, var(--rtg-remove-size, 1.1rem));
  height: var(--rozie-tags-remove-size, var(--rtg-remove-size, 1.1rem));
  padding: 0;
  font: inherit;
  line-height: 1;
  color: var(--rozie-tags-remove-color, var(--rtg-remove-color, currentColor));
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: var(--rozie-tags-remove-opacity, var(--rtg-remove-opacity, 0.65));
  transition: opacity 0.15s, background 0.15s;
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e]:hover:not([data-rozie-s-64848f8e]:disabled) {
  opacity: 1;
  background: var(--rozie-tags-remove-hover-bg, var(--rtg-remove-hover-bg, rgba(0, 0, 0, 0.1)));
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e]:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.rozie-tags-input[data-rozie-s-64848f8e] {
  flex: 1 1 var(--rozie-tags-input-min, var(--rtg-input-min, 4rem));
  min-width: var(--rozie-tags-input-min, var(--rtg-input-min, 4rem));
  padding: var(--rozie-tags-input-padding, var(--rtg-input-padding, 0.15rem 0.1rem));
  font: inherit;
  color: var(--rozie-tags-color, var(--rtg-color, inherit));
  background: transparent;
  border: none;
  outline: none;
}
.rozie-tags-input[data-rozie-s-64848f8e]::placeholder {
  color: var(--rozie-tags-placeholder-color, var(--rtg-placeholder-color, rgba(0, 0, 0, 0.4)));
}
.rozie-tags-input[data-rozie-s-64848f8e]:disabled {
  cursor: not-allowed;
}
.rozie-tags-count[data-rozie-s-64848f8e] {
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
.rozie-tags--disabled[data-rozie-s-64848f8e] {
  cursor: not-allowed;
  opacity: var(--rozie-tags-disabled-opacity, var(--rtg-disabled-opacity, 0.6));
  background: var(--rozie-tags-disabled-bg, var(--rtg-disabled-bg, rgba(0, 0, 0, 0.04)));
}
@media (prefers-color-scheme: dark) {
    :where(:root:not(.light):not([data-theme="light"])) {
      --rtg-bg: #1e293b;
      --rtg-border-color: rgba(255, 255, 255, 0.16);
      --rtg-accent: #60a5fa;
      --rtg-focus-ring-color: rgba(96, 165, 250, 0.35);
      --rtg-chip-bg: rgba(96, 165, 250, 0.22);
      --rtg-remove-hover-bg: rgba(255, 255, 255, 0.14);
      --rtg-placeholder-color: rgba(255, 255, 255, 0.45);
      --rtg-disabled-bg: rgba(255, 255, 255, 0.06);
    }
  }
`;

  /**
   * The committed tokens — `model: true`, so a commit/remove/paste writes a **fresh** array back through `r-model:modelValue` (uncontrolled fallback `[]`). Because it is the sole model prop, the Angular output is a `ControlValueAccessor` (`[formControl]` / `[(ngModel)]` bind directly).
   * @example
   * <rozie-tags .modelValue=${skills} @model-value-change=${…} placeholder="Add a skill…"></rozie-tags>
   */
  @property({ type: Array, attribute: 'model-value' }) _modelValue_attr: any[] = [];
  private _modelValueControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'model-value-change', defaultValue: [], initialControlledValue: undefined });
  /**
   * The keys that commit the current draft as a token (matched against the key event's `key`). Default `[',', 'Enter']`. Non-`'Enter'` entries also act as the split characters when pasting bulk text: a paste containing one is split and every part is added, and the parts that are rejected (by `validate` or `max`) are inserted at the caret, so the typed draft is kept. A paste with no split character is ordinary text. Use e.g. `[' ', 'Enter']` for a space-delimited input.
   */
  @property({ type: Array }) delimiters: any[] = [',', 'Enter'];
  /**
   * Allow the same token value to be added more than once. Defaults to `false` — a candidate equal (case-sensitive) to an existing token is silently rejected on commit. Set `true` to permit duplicates.
   */
  @property({ type: Boolean, reflect: true, attribute: 'allow-duplicates' }) allowDuplicates: boolean = false;
  /**
   * Maximum number of tokens. Once the list reaches `max`, the input is disabled and further adds (type, paste, programmatic) are rejected. `null` (the default) means unlimited.
   */
  @property({ type: Number, reflect: true }) max: number | null = null;
  /**
   * Disable the whole control — the text input is disabled, every remove button is disabled, and no token can be added or removed. Also sets the Angular CVA disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Render the tokens read-only — they remain visible but cannot be added or removed, and the text input is hidden. Unlike `disabled` it carries no disabled styling, so it reads as a display of committed values.
   */
  @property({ type: Boolean, reflect: true }) readonly: boolean = false;
  /**
   * Optional per-token validator / normalizer. Called with `(candidate, tokens)` for each commit; return a (possibly normalized) **string** to accept it, or a falsy value (`false` / `null` / `""`) to reject the candidate. Runs before the dedup + `max` checks. Example: `v => /^\S+@\S+$/.test(v) ? v.toLowerCase() : false` for emails.
   * @example
   * validate: (v) => (v.length >= 2 ? v.trim() : false)
   */
  @property({ type: Function }) validate: ((...args: any[]) => any) | null = null;
  /**
   * Placeholder text for the inline text input (e.g. `"Add a tag…"`).
   */
  @property({ type: String, reflect: true }) placeholder: string = '';
  /**
   * Accessible name for the whole control (`role="group"`). The inline text input is labelled with the same name so assistive tech announces what is being entered. A visually-hidden live region announces the current token count on change.
   */
  @property({ type: String, reflect: true, attribute: 'aria-label' }) ariaLabel: string | null = null;
  private _draft = signal('');
  @query('[data-rozie-ref="root"]') private _refRoot!: HTMLElement;

  private _rozieSlotDistributor = new RozieSlotDistributor(this);

  @state() private _hasSlotTag = false;
  @queryAssignedElements({ slot: 'tag', flatten: true }) private _slotTagElements!: Element[];
  @property({ attribute: false }) tag?: (scope: { tag: any; index: any; remove: any }) => unknown;
  // Phase 79 Plan 08 (R4) contract for 79-09: the record intake for
  // record-routed slot fills. 79-09's consumer-side emitSlotFiller
  // accumulates an object literal onto the SAME `.rozieSlots=${{ ... }}`
  // open-tag binding; the KEY is the fill's authored (possibly
  // non-identifier) name and the VALUE is a scope-taking render
  // function. `rozieSlots?.[name]` must be checked BEFORE the legacy
  // named function-prop / <slot> fallback (AC-9). Attribute
  // deserialization is disabled — this is a function-valued record,
  // never reflected to/from an HTML attribute.
  @property({ attribute: false }) rozieSlots?: Record<string, (scope: any) => unknown>;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="tag"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotTag = this._slotTagElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotTag = Array.from(this.children).some((el) => el.getAttribute('slot') === 'tag');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'model-value') this._modelValueControllable.notifyAttributeChange(value as unknown as any[]);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-tags": true, 'rozie-tags--disabled': this.disabled, 'rozie-tags--readonly': this.readonly }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="group" aria-label=${rozieAttr(this.ariaLabel)} ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="root" data-rozie-s-64848f8e>
  <ul class="rozie-tags-list" data-rozie-s-64848f8e>
    ${repeat<any>(this.tokens(), (t, _idx) => t + ':' + this.tokens().indexOf(t), (t, _idx) => html`<li class="rozie-tags-chip" data-rozie-s-64848f8e>
      ${this.tag !== undefined ? this.tag({tag: t, index: this.tokens().indexOf(t), remove: () => this.removeAt(this.tokens().indexOf(t))}) : html`<slot name="tag" data-rozie-params=${(() => { try { return JSON.stringify({tag: t, index: this.tokens().indexOf(t)}); } catch { return '{}'; } })()} @rozie-tag-remove=${($event: CustomEvent) => ((() => this.removeAt(this.tokens().indexOf(t))) as (...args: any[]) => any)($event.detail)}>
        <span class="rozie-tags-chip__label" data-rozie-s-64848f8e>${rozieDisplay(t)}</span>
        ${!this.readonly ? html`<button class="rozie-tags-chip__remove" type="button" ?disabled=${!!this.disabled} aria-label=${rozieAttr(this.removeLabel(t))} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.removeAt(this.tokens().indexOf(t)); }} data-rozie-s-64848f8e>×</button>` : nothing}</slot>`}
    </li>`)}
  </ul>

  ${!this.readonly ? html`<input class="rozie-tags-input" type="text" autocomplete="off" autocapitalize="off" .value=${this._draft.value} placeholder=${this.placeholder} ?disabled=${!!this.disabled || !!this.atMax()} aria-label=${rozieAttr(this.ariaLabel)} aria-disabled=${!!this.disabled} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInput($event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown($event); }} @paste=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onPaste($event); }} @blur=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onBlur($event); }} data-rozie-s-64848f8e />` : nothing}<span class="rozie-tags-count" aria-live="polite" data-rozie-s-64848f8e>${rozieDisplay(this.countLabel())}</span>
</div>
`;
  }

  // ---- derived view (plain functions, uniform ×6) ------------------------
  // The committed tokens, normalized to a string[].
  tokens = () => Array.isArray(this.modelValue) ? this.modelValue : [];

  // The configured commit keys, normalized to a string[].
  commitKeys = () => Array.isArray(this.delimiters) ? this.delimiters : [',', 'Enter'];

  // The non-Enter delimiters act as split characters for paste.
  splitChars = () => this.commitKeys().filter((k: any) => k !== 'Enter');

  // Whether the control has reached its token cap.
  atMax = () => typeof this.max === 'number' && this.tokens().length >= this.max;

  // Whether new input is accepted at all.
  canEdit = () => !this.disabled && !this.readonly;

  // ---- write funnel (single $emit site) ----------------------------------
  // Write the model and emit change. Every committed-list mutation funnels here.
  commitTokens = (next: any) => {
  this._modelValueControllable.write(next);
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: next
    },
    bubbles: true,
    composed: true
  }));
};

  // ---- add / remove ------------------------------------------------------
  // Normalize → validate → dedup → cap ONE candidate against the running list
  // `cur`. Returns `{ value }` to add, or `value: null` with a reason: 'duplicate' (already a
  // token — dropping it loses nothing) or 'rejected' (empty, invalid or over the
  // cap).
  candidateFor = (raw: any, cur: any) => {
  let candidate = String(raw == null ? '' : raw).trim();
  if (!candidate) return {
    value: null,
    reject: 'rejected'
  };
  if (typeof this.validate === 'function') {
    const result = this.validate(candidate, cur);
    if (!result) return {
      value: null,
      reject: 'rejected'
    };
    candidate = String(result);
    if (!candidate) return {
      value: null,
      reject: 'rejected'
    };
  }
  if (!this.allowDuplicates && cur.indexOf(candidate) !== -1) return {
    value: null,
    reject: 'duplicate'
  };
  if (typeof this.max === 'number' && cur.length >= this.max) return {
    value: null,
    reject: 'rejected'
  };
  return {
    value: candidate,
    reject: ''
  };
};

  // Add every raw candidate in order: ONE model write (commitTokens) with the
  // accumulated list, then one `add` per added token with the running list as of
  // that token. Accumulating locally matters: re-reading `tokens()` between adds
  // in one handler sees the pre-write list on React (and on Vue until the next
  // tick), so a multi-part paste used to keep only its last part. Returns the
  // added tokens and the raw candidates that were rejected (duplicates are neither).
  addTokens = (raws: any) => {
  if (!this.canEdit()) return {
    added: [],
    rejected: raws.slice()
  };
  let next = this.tokens();
  const added = [];
  const snapshots = [];
  const rejected = [];
  for (let i = 0; i < raws.length; i++) {
    const r = this.candidateFor(raws[i], next);
    if (r.value === null) {
      if (r.reject === 'rejected') rejected.push(raws[i]);
      continue;
    }
    next = next.concat([r.value]);
    added.push(r.value);
    snapshots.push(next);
  }
  if (added.length > 0) this.commitTokens(next);
  for (let i = 0; i < added.length; i++) {
    this.dispatchEvent(new CustomEvent("add", {
      detail: {
        value: added[i],
        tokens: snapshots[i]
      },
      bubbles: true,
      composed: true
    }));
  }
  return {
    added,
    rejected
  };
};

  // Add one candidate. Returns true if it was added (so the caller can clear the
  // draft).
  addToken = (raw: any) => this.addTokens([raw]).added.length === 1;

  // Remove the token at `idx`, commit, and emit remove.
  removeAt = (idx: any) => {
  if (!this.canEdit()) return;
  const cur = this.tokens();
  if (idx < 0 || idx >= cur.length) return;
  const removed = cur[idx];
  const next = cur.slice(0, idx).concat(cur.slice(idx + 1));
  this.commitTokens(next);
  this.dispatchEvent(new CustomEvent("remove", {
    detail: {
      value: removed,
      index: idx,
      tokens: next
    },
    bubbles: true,
    composed: true
  }));
};

  // ---- focus (container ref, post-mount only) ----------------------------
  // Read $refs.root only here / in $onMount / in $expose verbs (post-mount →
  // ROZ123-safe). querySelector reaches the input inside Lit's shadow root too.
  focusTheInput = () => {
  const root = this._refRoot;
  if (!root) return;
  const el = root.querySelector('input');
  if (el) el.focus();
};

  // ---- input handlers ----------------------------------------------------
  // Mirror the typed text into the draft buffer. Capture the fresh local value
  // (do NOT re-read $data.draft in the same handler — React setState is async and
  // would read the pre-write value).
  onInput = (e: any) => {
  this._draft.value = e && e.target ? e.target.value : '';
};

  // A delimiter key commits the current draft; Backspace in an empty input
  // deletes the previous token.
  onKeydown = (e: any) => {
  if (!this.canEdit()) return;
  const key = e ? e.key : '';
  const value = e && e.target ? e.target.value : '';
  if (this.commitKeys().indexOf(key) !== -1) {
    if (e) e.preventDefault();
    if (this.addToken(value)) this._draft.value = '';
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

  // Commit any leftover draft when the input loses focus (a common chips UX).
  onBlur = (e: any) => {
  if (!this.canEdit()) return;
  const value = e && e.target ? e.target.value : '';
  if (value && this.addToken(value)) this._draft.value = '';
};

  // insertAtCaret(el, text): insert `text` into the input at the caret, replacing
  // the selection — what an ordinary paste does — and leave the caret after it.
  // The element is written directly too: Angular skips a `[value]` write when the
  // bound value equals the last RENDERED one.
  insertAtCaret = (el: any, text: any) => {
  const cur = el && typeof el.value === 'string' ? el.value : String(this._draft.value);
  const start = el && typeof el.selectionStart === 'number' ? el.selectionStart : cur.length;
  const end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
  const next = cur.slice(0, start) + text + cur.slice(end);
  this._draft.value = next;
  if (el && typeof el.value === 'string' && el.value !== next) el.value = next;
  const caret = start + text.length;
  if (el && typeof el.setSelectionRange === 'function') el.setSelectionRange(caret, caret);
};

  // Paste: text containing a delimiter character is split on them and bulk-added;
  // the parts that are rejected (invalid, or over `max`) are inserted at the caret
  // as an ordinary paste would be, so the typed draft is kept. Text with no
  // delimiter is an ordinary paste into the draft (the browser handles it).
  onPaste = (e: any) => {
  if (!this.canEdit()) return;
  const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
  const seps = this.splitChars();
  let hasSep = false;
  for (let s = 0; s < seps.length; s++) {
    if (text.indexOf(seps[s]) !== -1) hasSep = true;
  }
  if (!hasSep) return;
  if (e) e.preventDefault();
  let parts = [text];
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
  const trimmed = parts.map((p: any) => String(p).trim()).filter((p: any) => p.length > 0);
  const rejected = this.addTokens(trimmed).rejected;
  if (rejected.length > 0) this.insertAtCaret(e ? e.target : null, rejected.join(seps[0] + ' '));
};

  // ---- per-element attribute helpers -------------------------------------
  removeLabel = (t: any) => 'Remove ' + String(t);

  countLabel = () => {
  const n = this.tokens().length;
  return n === 1 ? '1 tag' : n + ' tags';
};

  // ---- lifecycle + imperative handle -------------------------------------
  // clear() — remove every token (emits change with []) and focus the input.
  clear = () => {
  this.commitTokens([]);
  this._draft.value = '';
  this.focusTheInput();
};

  // focus() — move DOM focus to the text input. DELIBERATELY overrides the
  // inherited HTMLElement.focus on the Lit custom element (warn-only ROZ137,
  // accepted — the public focus() handle is the intended semantics; otp/slider
  // precedent, consistent with NumberField which also exposes `focus`).
  focus = () => this.focusTheInput();

  get modelValue(): any[] { return this._modelValueControllable.read(); }
  set modelValue(v: any[]) { this._modelValueControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'model-value', 'modelvalue', 'delimiters', 'allow-duplicates', 'allowduplicates', 'max', 'disabled', 'readonly', 'validate', 'placeholder', 'aria-label', 'arialabel']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}

injectGlobalStyles('rozie-tags-4c7fd76a-global', `
@media (prefers-color-scheme: dark) {
    :where(:root:not(.light):not([data-theme="light"])) {
      --rtg-bg: #1e293b;
      --rtg-border-color: rgba(255, 255, 255, 0.16);
      --rtg-accent: #60a5fa;
      --rtg-focus-ring-color: rgba(96, 165, 250, 0.35);
      --rtg-chip-bg: rgba(96, 165, 250, 0.22);
      --rtg-remove-hover-bg: rgba(255, 255, 255, 0.14);
      --rtg-placeholder-color: rgba(255, 255, 255, 0.45);
      --rtg-disabled-bg: rgba(255, 255, 255, 0.06);
    }
  }
`);
