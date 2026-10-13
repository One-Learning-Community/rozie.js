import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { RozieSlotDistributor, attachOutsideClickListener, createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread, rozieStyle } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import '@rozie-ui/popover-lit';
// ---- option grouping (src/internal/groupOptions.ts) ---------------------
// The pure stable-partition helper is a RUNTIME import (not a `.rzts` partial):
// codegen's `copyInternal` vendors it into each leaf at `./internal/groupOptions`.
// It is a byte copy of @rozie-ui/headless-core/src/internal/groupOptions.ts.
import { groupOptions } from './internal/groupOptions';
// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally
// (a peer dep); every RUNTIME reference sits behind `if ($props.virtual)` / a
// `virtualizer` guard so the non-virtual emitted path executes none of it
// (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// Windowing instance state (the `let table` precedent — React hoists reassigned
// module-`let`s to useRef; do NOT const). NULL until $onMount, and ONLY constructed
// when $props.virtual. gridScrollEl is the captured .rozie-select-list scroll div the
// virtualizer observes; remeasurePending dedupes the deferred sweep.

/** An entry of the `groups` prop. */
export interface SelectGroup {
  id: string;
  label: string;
}

interface RozieChipSlotCtx {
  option: any;
  remove: () => void;
  index: number;
}

interface RozieSelectedSlotCtx {
  selected: any;
  value: any;
}

interface RozieOptionSlotCtx {
  option: any;
  index: any;
  active: any;
  selected: any;
  disabled: any;
}

interface RozieEmptySlotCtx {
  query: any;
}

interface RozieGroupHeadingSlotCtx {
  group: SelectGroup;
}

@customElement('rozie-select')
export default class Select extends SignalWatcher(LitElement) {
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };

  static styles = css`
:host{display:contents}
.rozie-select[data-rozie-s-6e3ebfa6] {
  position: relative;
  display: inline-block;
  min-width: var(--rozie-select-min-width, var(--rsl-min-width, 12rem));
  font: var(--rozie-select-font, inherit);
  /* The popup's stacking order is the composed popover's now; keep the select's own
     \`--rozie-select-z\` token steering it (custom properties inherit into the panel). */
  --rozie-popover-z: var(--rozie-select-z, var(--rsl-z, 1000));
}
.rozie-select-control[data-rozie-s-6e3ebfa6] {
  box-sizing: border-box;
  /* NOT \`width: 100%\`: the control renders inside the popover's anchor wrapper
     (\`display: inline-block\`, shrink-to-fit), so a percentage width is circular. It
     sizes to its content with the root's own minimum, which is the box the root's
     \`inline-block\` + \`min-width\` gave it before. \`block\` and \`inline\` stretch it. */
  min-width: var(--rozie-select-min-width, var(--rsl-min-width, 12rem));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-select-gap, var(--rsl-gap, 0.5rem));
  padding: var(--rozie-select-control-padding, var(--rsl-control-padding, 0.5rem 0.75rem));
  font: inherit;
  text-align: left;
  background: var(--rozie-select-bg, var(--rsl-bg, #fff));
  color: var(--rozie-select-fg, var(--rsl-fg, #1a1a1a));
  border: var(--rozie-select-border-width, var(--rsl-border-width, 1px)) solid var(--rozie-select-border, var(--rsl-border, rgba(0, 0, 0, 0.2)));
  border-radius: var(--rozie-select-radius, var(--rsl-radius, 6px));
  cursor: pointer;
}
.rozie-select-control[data-rozie-s-6e3ebfa6]:focus-within {
  outline: var(--rozie-select-ring-width, var(--rsl-ring-width, 2px)) solid var(--rozie-select-ring, var(--rozie-select-accent, var(--rsl-ring, var(--rsl-accent, #0066cc))));
  outline-offset: var(--rozie-select-ring-offset, var(--rsl-ring-offset, 1px));
}
.rozie-select-control[data-rozie-s-6e3ebfa6] { flex-wrap: wrap; }
.rozie-select-chip[data-rozie-s-6e3ebfa6] {
  display: inline-flex; align-items: center; max-width: 100%;
  gap: var(--rozie-select-chip-gap, var(--rsl-chip-gap, 0.25rem));
  padding: var(--rozie-select-chip-padding, var(--rsl-chip-padding, 0.1rem 0.4rem));
  border-radius: var(--rozie-select-chip-radius, var(--rsl-chip-radius, 4px));
  background: var(--rozie-select-chip-bg, var(--rsl-chip-bg, rgba(0, 0, 0, 0.08)));
  color: var(--rozie-select-chip-color, var(--rsl-chip-color, inherit));
  font-size: var(--rozie-select-chip-size, var(--rsl-chip-size, 0.875em));
}
.rozie-select-chip__label[data-rozie-s-6e3ebfa6] { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rozie-select-chip__remove[data-rozie-s-6e3ebfa6] {
  border: 0; background: none; padding: 0; cursor: pointer; line-height: 1;
  color: var(--rozie-select-chip-remove-color, var(--rsl-chip-remove-color, currentColor));
  font-size: var(--rozie-select-chip-remove-size, var(--rsl-chip-remove-size, 1em));
}
.rozie-select-trigger[data-rozie-s-6e3ebfa6] { flex: 1 1 auto; min-width: 0; min-height: 1.5em; outline: none; background: none; border: 0; padding: 0; text-align: start; }
.rozie-select-disabled[data-rozie-s-6e3ebfa6] .rozie-select-control[data-rozie-s-6e3ebfa6] { cursor: default; }
.rozie-select-disabled[data-rozie-s-6e3ebfa6] { opacity: var(--rozie-select-disabled-opacity, var(--rsl-disabled-opacity, 0.6)); pointer-events: none; }
.rozie-select-placeholder[data-rozie-s-6e3ebfa6] { color: var(--rozie-select-placeholder, var(--rsl-placeholder, rgba(0, 0, 0, 0.45))); }
.rozie-select-clear[data-rozie-s-6e3ebfa6] {
  flex: none; border: 0; background: none; padding: 0; cursor: pointer; line-height: 1;
  color: var(--rozie-select-clear-color, var(--rsl-clear-color, currentColor));
  font-size: var(--rozie-select-clear-size, var(--rsl-clear-size, 1rem));
  opacity: var(--rozie-select-arrow-opacity, var(--rsl-arrow-opacity, 0.6));
}
.rozie-select-clear[data-rozie-s-6e3ebfa6]:hover { opacity: 1; }
.rozie-select-arrow[data-rozie-s-6e3ebfa6] {
  font-size: 0.75em;
  color: var(--rozie-select-arrow-color, var(--rsl-arrow-color, currentColor));
  opacity: var(--rozie-select-arrow-opacity, var(--rsl-arrow-opacity, 0.7));
}
.rozie-select-list[data-rozie-s-6e3ebfa6] {
  margin: 0;
  padding: var(--rozie-select-popup-padding, var(--rsl-popup-padding, 0.25rem));
  max-height: var(--rozie-select-max-height, var(--rsl-max-height, 16rem));
  overflow-y: auto;
  list-style: none;
  background: var(--rozie-select-popup-bg, var(--rozie-select-bg, var(--rsl-popup-bg, var(--rsl-bg, #fff))));
  color: var(--rozie-select-fg, var(--rsl-fg, #1a1a1a));
  border: var(--rozie-select-border-width, var(--rsl-border-width, 1px)) solid var(--rozie-select-popup-border, var(--rozie-select-border, var(--rsl-popup-border, var(--rsl-border, rgba(0, 0, 0, 0.15)))));
  border-radius: var(--rozie-select-popup-radius, var(--rozie-select-radius, var(--rsl-popup-radius, var(--rsl-radius, 6px))));
  box-shadow: var(--rozie-select-shadow, var(--rsl-shadow, 0 6px 24px rgba(0, 0, 0, 0.12)));
}
.rozie-select-inline[data-rozie-s-6e3ebfa6] {
  display: block;
  width: 100%;
}
.rozie-select-inline[data-rozie-s-6e3ebfa6] .rozie-select-list[data-rozie-s-6e3ebfa6] {
  margin-top: var(--rozie-select-popup-offset, var(--rsl-popup-offset, 4px));
  border: none;
  border-radius: 0;
  box-shadow: none;
}
.rozie-select-inline[data-rozie-s-6e3ebfa6],
.rozie-select--block[data-rozie-s-6e3ebfa6] {
  container-type: inline-size;
}
.rozie-select-inline[data-rozie-s-6e3ebfa6] .rozie-select-control[data-rozie-s-6e3ebfa6],
.rozie-select--block[data-rozie-s-6e3ebfa6] .rozie-select-control[data-rozie-s-6e3ebfa6] {
  width: 100cqw;
}
.rozie-select--block[data-rozie-s-6e3ebfa6] {
  display: block;
  width: 100%;
}
.rozie-select-option[data-rozie-s-6e3ebfa6] {
  padding: var(--rozie-select-option-padding, var(--rsl-option-padding, 0.4rem 0.6rem));
  border-radius: var(--rozie-select-option-radius, var(--rsl-option-radius, 4px));
  color: var(--rozie-select-option-fg, inherit);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-select-gap, var(--rsl-gap, 0.5rem));
}
.rozie-select-option.is-active[data-rozie-s-6e3ebfa6] {
  background: var(--rozie-select-active-bg, var(--rsl-active-bg, rgba(0, 102, 204, 0.12)));
  color: var(--rozie-select-active-fg, var(--rsl-active-fg, inherit));
}
.rozie-select-option.is-selected[data-rozie-s-6e3ebfa6] {
  background: var(--rozie-select-selected-bg, var(--rsl-selected-bg, transparent));
  color: var(--rozie-select-selected-fg, var(--rsl-selected-fg, inherit));
  font-weight: var(--rozie-select-selected-weight, var(--rsl-selected-weight, 600));
}
.rozie-select-option.is-selected[data-rozie-s-6e3ebfa6]::after {
  content: var(--rozie-select-check, var(--rsl-check, '✓'));
  color: var(--rozie-select-check-color, var(--rozie-select-accent, var(--rsl-check-color, var(--rsl-accent, #0066cc))));
}
.rozie-select-option.is-disabled[data-rozie-s-6e3ebfa6] { opacity: var(--rozie-select-disabled-opacity, var(--rsl-disabled-opacity, 0.45)); cursor: not-allowed; }
.rozie-select-group-heading[data-rozie-s-6e3ebfa6] {
  padding: var(--rozie-select-group-heading-padding, var(--rsl-group-heading-padding, 0.25rem 0.6rem));
  font-size: var(--rozie-select-group-heading-size, var(--rsl-group-heading-size, 0.75rem));
  font-weight: var(--rozie-select-group-heading-weight, var(--rsl-group-heading-weight, 600));
  color: var(--rozie-select-group-heading-color, var(--rsl-group-heading-color, rgba(0, 0, 0, 0.55)));
}
.rozie-select-empty[data-rozie-s-6e3ebfa6] { padding: var(--rozie-select-option-padding, var(--rsl-option-padding, 0.5rem 0.6rem)); color: var(--rozie-select-empty-fg, var(--rsl-empty-fg, rgba(0, 0, 0, 0.5))); }
.rozie-select-spacer[data-rozie-s-6e3ebfa6] { margin: 0; padding: 0; border: 0; flex: none; }
.rozie-select-list--virtual[data-rozie-s-6e3ebfa6] { overflow-anchor: none; }
`;

  /**
   * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`.
   */
  @property({ type: Array }) options: any[] = [];
  /**
   * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Select **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <rozie-select .value=${fruit} @value-change=${…} .options=${fruits}></rozie-select>
   */
  @property({ type: Object, attribute: 'value' }) _value_attr: unknown = null;
  private _valueControllable = createLitControllableProperty<unknown>({ host: this, eventName: 'value-change', defaultValue: null, initialControlledValue: undefined });
  /**
   * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit. Selected values render as removable chips inside the control (a value missing from `options` keeps a chip labelled by its raw value), and Backspace removes the last chip while the popup is closed.
   */
  @property({ type: Boolean, reflect: true }) multiple: boolean = false;
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the select inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  @property({ type: Boolean, reflect: true }) inline: boolean = false;
  /**
   * Disable the control entirely. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Placeholder text shown in the empty control.
   */
  @property({ type: String, reflect: true }) placeholder: string = '';
  /**
   * Close the popup after a single-select commit. Defaults `true`; multi-select keeps the popup open regardless of this setting.
   */
  @property({ type: Boolean, reflect: true, attribute: 'close-on-select' }) closeOnSelect: boolean = true;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  @property({ type: Function, attribute: 'option-label' }) optionLabel: ((...args: any[]) => any) | null = null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  @property({ type: Function, attribute: 'option-value' }) optionValue: ((...args: any[]) => any) | null = null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  @property({ type: Function, attribute: 'option-disabled' }) optionDisabled: ((...args: any[]) => any) | null = null;
  /**
   * Id base for the popup, option and control elements — `aria-activedescendant` needs real ids. Option ids are `idBase + "-opt-" + i`, the popup id is `idBase + "-list"`. Leave it empty (the default) and each instance generates a unique id base after mount (`rozie-select-<n>`). Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  @property({ type: String, reflect: true, attribute: 'id-base' }) idBase: string = '';
  /**
   * Show nothing instead of the empty state: when there are no options the popup is not shown, the control reports `aria-expanded="false"`, and Escape is left to the host.
   */
  @property({ type: Boolean, reflect: true, attribute: 'hide-empty' }) hideEmpty: boolean = false;
  /**
   * Tab picks the highlighted option while the popup is open and an option is highlighted, then moves focus normally. Default `false` (Tab only closes the popup).
   */
  @property({ type: Boolean, reflect: true, attribute: 'select-on-tab' }) selectOnTab: boolean = false;
  /**
   * Show a clear button in the control whenever there is a value, and let Delete clear it from the keyboard while the popup is closed. In single-select Backspace clears too; in multi-select Delete clears every value while Backspace removes only the last chip.
   */
  @property({ type: Boolean, reflect: true }) clearable: boolean = false;
  /**
   * Accessible name of the clear button (`aria-label`). Localise it.
   */
  @property({ type: String, reflect: true, attribute: 'clear-label' }) clearLabel: string = 'Clear';
  /**
   * Floating UI placement of the popup relative to the control, forwarded to the composed `@rozie-ui/popover` leaf — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end`. Default `"bottom-start"` keeps the popup flush with the control's left edge. Ignored when `inline` is set.
   */
  @property({ type: String, reflect: true }) placement: string = 'bottom-start';
  /**
   * Gap in pixels between the control and the popup, forwarded to the composed `@rozie-ui/popover` leaf. Default `4`. Ignored when `inline` is set (the in-flow gap is the `--rozie-select-popup-offset` token).
   */
  @property({ type: Number, reflect: true }) offset: number = 4;
  /**
   * Disable the popup's Floating UI `flip` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup flips above the control when it would overflow the viewport below; set this to keep it pinned to `placement` regardless. Ignored when `inline` is set.
   */
  @property({ type: Boolean, reflect: true, attribute: 'disable-flip' }) disableFlip: boolean = false;
  /**
   * Disable the popup's Floating UI `shift` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup shifts to stay within the viewport; set this to keep it strictly aligned to the control. Ignored when `inline` is set.
   */
  @property({ type: Boolean, reflect: true, attribute: 'disable-shift' }) disableShift: boolean = false;
  /**
   * Fill the container: the root becomes `display: block; width: 100%`, the control stretches to that width, and the width-matched popup follows. Adds the `rozie-select--block` modifier class on the root. Default `false` keeps the content-sized control (at least `--rozie-select-min-width`).
   */
  @property({ type: Boolean, reflect: true }) block: boolean = false;
  /**
   * Ordered section list `[{ id, label }]` setting group order and heading text. Options are partitioned by their optional `group` string; groups present on options but absent here follow in first-appearance order. Empty (the default) renders a flat list. Ignored when `virtual` is on.
   */
  @property({ type: Array }) groups: any[] = [];
  /**
   * Accessible name for the control when there is no visible `<label for>` pointing at its `id` (`aria-label`).
   */
  @property({ type: String, reflect: true, attribute: 'aria-label' }) ariaLabel: string | null = null;
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed select. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded. Grouping is not applied while `virtual` is on.
   */
  @property({ type: Boolean, reflect: true }) virtual: boolean = false;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  @property({ type: Number, reflect: true, attribute: 'estimate-row-height' }) estimateRowHeight: number = 36;
  /**
   * A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-select-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  @property({ type: String, reflect: true, attribute: 'max-height' }) maxHeight: string = '';
  private _autoId = signal('');
  private _open$local = signal(false);
  private _panelOpen = signal(false);
  private _panelEcho = signal(false);
  private _activeIndex = signal(-1);
  private _query = signal('');
  private _rows = signal<any[]>([]);
  private _windowVer = signal(0);
  private _editVer = signal(0);
  @query('[data-rozie-ref="controlEl"]') private _refControlEl!: HTMLElement;
  @query('[data-rozie-ref="triggerEl"]') private _refTriggerEl!: HTMLElement;
  @query('[data-rozie-ref="listEl"]') private _refListEl!: HTMLElement;
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieWatchInitial_1 = true;
private __rozieWatchInitial_2 = true;
private __rozieFirstUpdateDone = false;

  private _rozieSlotDistributor = new RozieSlotDistributor(this);

  @state() private _hasSlotChip = false;
  @queryAssignedElements({ slot: 'chip', flatten: true }) private _slotChipElements!: Element[];
  @property({ attribute: false }) chip?: (scope: { option: any; remove: () => void; index: number }) => unknown;
  @state() private _hasSlotSelected = false;
  @queryAssignedElements({ slot: 'selected', flatten: true }) private _slotSelectedElements!: Element[];
  @property({ attribute: false }) selected?: (scope: { selected: any; value: any }) => unknown;
  @state() private _hasSlotOption = false;
  @queryAssignedElements({ slot: 'option', flatten: true }) private _slotOptionElements!: Element[];
  @property({ attribute: false }) option?: (scope: { option: any; index: any; active: any; selected: any; disabled: any }) => unknown;
  @state() private _hasSlotEmpty = false;
  @queryAssignedElements({ slot: 'empty', flatten: true }) private _slotEmptyElements!: Element[];
  @property({ attribute: false }) empty?: (scope: { query: any }) => unknown;
  @state() private _hasSlotGroupHeading = false;
  @queryAssignedElements({ slot: 'groupHeading', flatten: true }) private _slotGroupHeadingElements!: Element[];
  @property({ attribute: false }) groupHeading?: (scope: { group: SelectGroup }) => unknown;
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
    const _u0 = attachOutsideClickListener([() => this._refControlEl, () => this._refListEl], ($event) => {  ((this.close) as (...args: any[]) => any)($event); }, () => (this._open$local.value && (this.inline || !this.popupVisible())));
    this._disconnectCleanups.push(_u0);

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="chip"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotChip = this._slotChipElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="selected"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSelected = this._slotSelectedElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="option"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotOption = this._slotOptionElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="empty"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotEmpty = this._slotEmptyElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="groupHeading"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotGroupHeading = this._slotGroupHeadingElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotChip = Array.from(this.children).some((el) => el.getAttribute('slot') === 'chip');
    this._hasSlotSelected = Array.from(this.children).some((el) => el.getAttribute('slot') === 'selected');
    this._hasSlotOption = Array.from(this.children).some((el) => el.getAttribute('slot') === 'option');
    this._hasSlotEmpty = Array.from(this.children).some((el) => el.getAttribute('slot') === 'empty');
    this._hasSlotGroupHeading = Array.from(this.children).some((el) => el.getAttribute('slot') === 'groupHeading');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => (this._open$local.value ? 'o' : 'c') + (this.hideEmpty ? 'h' : 's') + (this.options ? this.options.length : 0) + '|' + this._query.value)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.syncPanel();
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._panelOpen.value)(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      if (this._panelOpen.value === this._panelEcho.value) return;
      this._panelEcho.value = this._panelOpen.value;
      if (!this._panelOpen.value) this.close();
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => (this.options ? this.options.length : 0) + '|' + this._query.value)(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      this.syncRows();
      if (this.virtual && this.virtualizer) {
        this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-select-list') : this.gridScrollEl;
        this.virtualizer.setOptions(this.virtualizerOptions());
        this.virtualizer._willUpdate();
        this._windowVer.value = this._windowVer.value + 1;
        this.scheduleRemeasure();
      }
    })(); }); }));

    if (!this.idBase) this._autoId.value = 'rozie-select-' + this.nextAutoId();
    this.syncRows();
    if (this.virtual) {
      // The list renders at mount when virtual, so the .rozie-select-list scroll container
      // exists here. Capture it via $el.querySelector (the data-table gridScrollEl precedent,
      // proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered node is null on
      // Solid/Lit, which leaves the virtualizer with no scroll element.
      this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-select-list') : null;
      this.virtualizer = new Virtualizer(this.virtualizerOptions());
      this.virtualizerCleanup = this.virtualizer._didMount();
      this._windowVer.value = this._windowVer.value + 1;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.kickWindow(8));else setTimeout(() => this.kickWindow(8), 0);
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('options'))) { const __watchVal = (() => this.options ? this.options.length : 0)(); (() => {
      if (this._activeIndex.value >= this.visibleOptions().length) this._activeIndex.value = this.visibleOptions().length > 0 ? this.nextEnabled(-1, 1) : -1;
    })(); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      (() => {
        if (this.typeTimer !== null) clearTimeout(this.typeTimer);
        // Tear down the virtualizer's scroll-element ResizeObserver (no-op when virtual off).
        if (this.virtualizerCleanup) this.virtualizerCleanup();
      })();
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as unknown);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-select": true, 'rozie-select-open': this.popupVisible(), 'rozie-select-disabled': this.disabled, 'rozie-select-inline': this.inline, 'rozie-select--block': this.block }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="__rozieRoot" data-rozie-s-6e3ebfa6>
  
  <rozie-popover trigger="manual" .open=${this._panelOpen.value} @open-change=${($event: CustomEvent) => { this._panelOpen.value = $event.detail; }} .bare=${true} .matchWidth=${true} .keepMounted=${this.virtual} .disablePositioning=${this.inline} .disableDismiss=${this.inline} .placement=${this.placement} .offset=${this.offset} .disableFlip=${this.disableFlip} .disableShift=${this.disableShift} .idBase=${this.idRoot()} data-rozie-s-6e3ebfa6><div class="rozie-select-control" @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onControlClick($event); }} data-rozie-ref="controlEl" data-rozie-s-6e3ebfa6 slot="anchor">
        ${this.multiple ? html`${repeat<any>(this.chipRows(), (row, idx) => 'chip-' + row.value, (row, idx) => html`<span class="rozie-select-chip" data-rozie-s-6e3ebfa6>
          ${this.chip !== undefined ? this.chip({option: row.option, remove: () => this.onChipRemove(row.value), index: idx}) : html`<slot name="chip" data-rozie-params=${(() => { try { return JSON.stringify({option: row.option, index: idx}); } catch { return '{}'; } })()} @rozie-chip-remove=${($event: CustomEvent) => ((() => this.onChipRemove(row.value)) as (...args: any[]) => any)($event.detail)}>
            <span class="rozie-select-chip__label" data-rozie-s-6e3ebfa6>${rozieDisplay(row.label)}</span>
            <button class="rozie-select-chip__remove" type="button" tabindex="-1" ?disabled=${!!this.disabled} aria-label=${rozieAttr(this.chipRemoveLabel(row))} @mousedown=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { $event.preventDefault(); this.noop(); }} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onChipRemove(row.value); }} data-rozie-s-6e3ebfa6>×</button>
          </slot>`}
        </span>`)}` : nothing}<div class="rozie-select-trigger" role="combobox" aria-haspopup="listbox" tabindex=${rozieAttr(this.triggerTabindex())} aria-expanded=${!!this.popupVisible()} aria-controls=${rozieAttr(this.idRoot() + '-list')} aria-activedescendant=${rozieAttr(this.popupVisible() && this._activeIndex.value < this.visibleOptions().length ? this.activeDescendant : null)} aria-label=${rozieAttr(this.ariaLabel)} aria-disabled=${!!this.disabled} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onTriggerKeyDown($event); }} data-rozie-ref="triggerEl" data-rozie-s-6e3ebfa6>
          ${!this.multiple ? html`${this.selected !== undefined ? this.selected({selected: this.selectedLabel, value: this.value}) : html`<slot name="selected" data-rozie-params=${(() => { try { return JSON.stringify({selected: this.selectedLabel, value: this.value}); } catch { return '{}'; } })()}>
            ${this.selectedLabel ? html`<span class="rozie-select-selected" data-rozie-s-6e3ebfa6>${rozieDisplay(this.selectedLabel)}</span>` : html`<span class="rozie-select-placeholder" data-rozie-s-6e3ebfa6>${this.placeholder}</span>`}</slot>`}` : nothing}${this.multiple && this.selectedValues().length === 0 ? html`<span class="rozie-select-placeholder" data-rozie-s-6e3ebfa6>${this.placeholder}</span>` : nothing}</div>
        ${this.clearable && this.hasValue() && !this.disabled ? html`<button class="rozie-select-clear" type="button" tabindex="-1" aria-label=${this.clearLabel} @mousedown=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { $event.preventDefault(); this.noop(); }} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onClearClick(); }} data-rozie-s-6e3ebfa6>×</button>` : nothing}<span class="rozie-select-arrow" aria-hidden="true" data-rozie-s-6e3ebfa6>▾</span>
      </div>
      
      ${this.popupVisible() && !this.virtual && !this.isGrouped() ? html`<div class="rozie-select-list" role="listbox" id=${rozieAttr(this.idRoot() + '-list')} aria-label=${rozieAttr(this.ariaLabel)} aria-multiselectable=${this.multiple} data-rozie-ref="listEl" data-rozie-s-6e3ebfa6>
        ${repeat<any>(this.visibleOptions(), (opt, index) => this.optionId(index), (opt, index) => html`<div class="${Object.entries({ "rozie-select-option": true, 'is-active': this._activeIndex.value === index, 'is-selected': this.isSelected(opt), 'is-disabled': this.disabledOf(opt) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" id=${rozieAttr(this.optionId(index))} role="option" aria-selected=${!!this.isSelected(opt)} aria-disabled=${!!this.disabledOf(opt)} @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.select(opt); }} @mousemove=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onOptionPointerMove(index); }} data-rozie-s-6e3ebfa6>
          ${this.option !== undefined ? this.option({option: opt, index: index, active: this._activeIndex.value === index, selected: this.isSelected(opt), disabled: this.disabledOf(opt)}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: opt, index: index, active: this._activeIndex.value === index, selected: this.isSelected(opt), disabled: this.disabledOf(opt)}); } catch { return '{}'; } })()}>
            ${rozieDisplay(this.labelOf(opt))}
          </slot>`}
        </div>`)}

        ${this.visibleOptions().length === 0 ? html`<div class="rozie-select-empty" role="presentation" data-rozie-s-6e3ebfa6>
          ${this.empty !== undefined ? this.empty({query: this._query.value}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: this._query.value}); } catch { return '{}'; } })()}>No options</slot>`}
        </div>` : nothing}</div>` : nothing}${this.popupVisible() && !this.virtual && this.isGrouped() ? html`<div class="rozie-select-list" role="listbox" id=${rozieAttr(this.idRoot() + '-list')} aria-label=${rozieAttr(this.ariaLabel)} aria-multiselectable=${this.multiple} data-rozie-ref="listEl" data-rozie-s-6e3ebfa6>
        ${repeat<any>(this.groupBlocks(), (blk, _idx) => 'grp-' + (blk.group ? blk.group.id : '_ungrouped'), (blk, _idx) => html`<div class="rozie-select-group" role="group" aria-label=${rozieAttr(blk.group ? blk.group.label : null)} data-rozie-s-6e3ebfa6>
          ${blk.group ? html`<div class="rozie-select-group-heading" role="presentation" data-rozie-s-6e3ebfa6>
            ${this.groupHeading !== undefined ? this.groupHeading({group: blk.group}) : html`<slot name="groupHeading" data-rozie-params=${(() => { try { return JSON.stringify({group: blk.group}); } catch { return '{}'; } })()}>${rozieDisplay(blk.group.label)}</slot>`}
          </div>` : nothing}${repeat<any>(blk.items, (row, _idx) => this.optionId(row.index), (row, _idx) => html`<div class="${Object.entries({ "rozie-select-option": true, 'is-active': this._activeIndex.value === row.index, 'is-selected': this.isSelected(row.opt), 'is-disabled': this.disabledOf(row.opt) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" id=${rozieAttr(this.optionId(row.index))} role="option" aria-selected=${!!this.isSelected(row.opt)} aria-disabled=${!!this.disabledOf(row.opt)} @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.select(row.opt); }} @mousemove=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onOptionPointerMove(row.index); }} data-rozie-s-6e3ebfa6>
            ${this.option !== undefined ? this.option({option: row.opt, index: row.index, active: this._activeIndex.value === row.index, selected: this.isSelected(row.opt), disabled: this.disabledOf(row.opt)}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: row.opt, index: row.index, active: this._activeIndex.value === row.index, selected: this.isSelected(row.opt), disabled: this.disabledOf(row.opt)}); } catch { return '{}'; } })()}>
              ${rozieDisplay(this.labelOf(row.opt))}
            </slot>`}
          </div>`)}
        </div>`)}
        ${this.visibleOptions().length === 0 ? html`<div class="rozie-select-empty" role="presentation" data-rozie-s-6e3ebfa6>
          ${this.empty !== undefined ? this.empty({query: this._query.value}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: this._query.value}); } catch { return '{}'; } })()}>No options</slot>`}
        </div>` : nothing}</div>` : nothing}${this.virtual ? html`<div class="rozie-select-list rozie-select-list--virtual" role="listbox" id=${rozieAttr(this.idRoot() + '-list')} aria-label=${rozieAttr(this.ariaLabel)} aria-multiselectable=${this.multiple} style=${rozieStyle((this.popupVisible() ? '' : 'display:none;') + (this.maxHeight ? 'height:' + this.maxHeight + ';max-height:' + this.maxHeight + ';overflow-y:auto;--rozie-select-max-height:' + this.maxHeight : 'overflow-y:auto'))} data-rozie-ref="listEl" data-rozie-s-6e3ebfa6>
        <div class="rozie-select-spacer" aria-hidden="true" style=${rozieStyle('height:' + this.padTop() + 'px')} data-rozie-s-6e3ebfa6></div>

        ${repeat<any>(this.windowedRows(), (wr, _idx) => wr.row.id, (wr, _idx) => html`<div class="${Object.entries({ "rozie-select-option": true, 'is-active': this._activeIndex.value === wr.vi.index, 'is-selected': this.isSelected(wr.row._opt), 'is-disabled': this.disabledOf(wr.row._opt) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" id=${rozieAttr(this.optionId(wr.vi.index))} data-index=${rozieAttr(wr.vi.index)} role="option" aria-selected=${!!this.isSelected(wr.row._opt)} aria-disabled=${!!this.disabledOf(wr.row._opt)} @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.select(wr.row._opt); }} @mousemove=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onOptionPointerMove(wr.vi.index); }} data-rozie-s-6e3ebfa6>
          ${this.option !== undefined ? this.option({option: wr.row._opt, index: wr.vi.index, active: this._activeIndex.value === wr.vi.index, selected: this.isSelected(wr.row._opt), disabled: this.disabledOf(wr.row._opt)}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: wr.row._opt, index: wr.vi.index, active: this._activeIndex.value === wr.vi.index, selected: this.isSelected(wr.row._opt), disabled: this.disabledOf(wr.row._opt)}); } catch { return '{}'; } })()}>
            ${rozieDisplay(this.labelOf(wr.row._opt))}
          </slot>`}
        </div>`)}

        <div class="rozie-select-spacer" aria-hidden="true" style=${rozieStyle('height:' + this.padBottom() + 'px')} data-rozie-s-6e3ebfa6></div>

        ${this.windowSource().length === 0 ? html`<div class="rozie-select-empty" role="presentation" data-rozie-s-6e3ebfa6>
          ${this.empty !== undefined ? this.empty({query: this._query.value}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: this._query.value}); } catch { return '{}'; } })()}>No options</slot>`}
        </div>` : nothing}</div>` : nothing}</rozie-popover>
</div>
`;
  }

  // Type-ahead buffer for the select-only trigger. Module-scope
  // `let`s reassigned from handlers → the React emitter hoists them to `useRef`
  // so they persist across renders (the setup-once guarantee); no-op elsewhere.
  // They STAY in this host (not the shared spine) per the A==B rule: reassigned
  // module-`let`s + sigils live in the host; the partial only closes over them.
  typeBuffer = '';

  typeTimer: any = null;

  // ---- shared list spine (P2: @rozie-ui/headless-core/listCore.rzts) ------
  // The option resolvers, single+multi selection, close/clear, and the
  // activeDescendant derivation come from the shared list spine. It is a
  // compile-time `.rzts` script-partial: it dissolves into this leaf via
  // inlineScriptPartials() before IR lowering (zero runtime dep). The spine closes
  // over this host's pieces by convention: idRoot() and the impure ref fn
  // focusControl (below). Navigation, type-ahead and open/toggle are host-local —
  // see HOST-LOCAL NAVIGATION below; they use the reassigned module-`let`s
  // typeBuffer/typeTimer (above) and scrollActiveIntoView (below).
  // ══ Shared headless LIST SPINE (Phase 64, D-06) — the target-agnostic list-core bridge ══
  // Lifted verbatim from Listbox.rozie's <script> (the monolithic pure-Rozie list logic). This
  // partial holds ONLY the PURE list spine — option resolvers, the client-side filter, enabled-index
  // navigation, the arrow/home/end/enter/escape/space/tab keyboard reducer, type-ahead, single+multi
  // selection, open/close state, and activeDescendant derivation. It is a compile-time `.rzts`
  // script-partial: it dissolves into each consumer's compiled leaf via inlineScriptPartials() before
  // IR lowering — leaving zero runtime dependency (the 64-01-proven cross-package bare-specifier path).
  //
  // ── PARAMETERIZATION (D-06) ──────────────────────────────────────────────────────────────────
  // The spine is parameterized BY HOST CONVENTION (the same implicit by-convention mixin contract
  // windowing.rzts uses) along two axes:
  //   - focus-model: `activedescendant` | `roving`. Both list families default to `activedescendant`
  //     (what they use today): the highlighted option is tracked virtually via `activeDescendant`
  //     (an option id) while DOM focus stays on the control. `roving` (real per-option tabindex
  //     focus) is SUPPORTED-BUT-UNUSED — no focus rewrite is forced here; a roving host would supply
  //     its own focus mover. The `activeDescendant` / `optionId` derivation below IS the
  //     activedescendant model.
  //   - input-mode: `select-only` (Listbox — a button trigger + type-ahead) | `filter-input`
  //     (Combobox — a text <input> that filters by the typed query). The mode is by HOST CONVENTION,
  //     NOT a discriminant prop (P3 retired the Listbox `combobox`/`filterable` props): a select-only
  //     host never writes `$data.query`, so `visibleOptions` is the identity path for it and the
  //     printable-char branch of the reducer feeds type-ahead; a filter-input host writes `$data.query`
  //     from its <input>, so `visibleOptions` substring-filters and `onInput` drives the query.
  //
  // ── HOST CONTRACT (symbols the consuming host MUST define before importing) ────────────────────
  //   - the reassigned module-`let`s `typeBuffer` / `typeTimer` — type-ahead scratch state. They are
  //     reassigned from handlers → the React emitter hoists them to `useRef` (the setup-once
  //     guarantee), so per the A==B playbook rule they STAY IN THE HOST; this partial only closes
  //     over them (in `onTypeahead`).
  //   - `idRoot()` — the host's id base (Listbox: the `id` prop, else the per-instance id it
  //     generates in $onMount); `optionId` below derives every option id from it.
  //   - `focusControl()` / `scrollActiveIntoView()` — impure ref-reading functions (they touch the
  //     control / list ref elements, which are post-mount-only per ROZ123), so they are per-consumer
  //     HOST functions; this partial only closes over them (it reads NO refs itself).
  //   - the option set + form surface (`$props.options` / `$props.value` (model) / `$props.multiple` /
  //     `$props.optionLabel` / `$props.optionValue` / `$props.optionDisabled` /
  //     `$props.closeOnSelect` / `$props.disabled`) and the reactive state (`$data.open` /
  //     `$data.activeIndex` / `$data.query`). Input-mode is by convention (the host's <input> writing
  //     `$data.query`), NOT a discriminant prop.
  // ---- option resolvers --------------------------------------------------
  labelOf = (opt: any) => {
  if (this.optionLabel !== null) return this.optionLabel(opt);
  if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
  return String(opt);
};

  valueOf$local = (opt: any) => {
  if (this.optionValue !== null) return this.optionValue(opt);
  if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
  return opt;
};

  disabledOf = (opt: any) => {
  if (this.optionDisabled !== null) return !!this.optionDisabled(opt);
  if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
  return false;
};

  // `idRoot()` is a HOST function (the host's id base: its id prop, else a generated
  // per-instance id) so the option ids follow the host's auto-id fallback.
  optionId = (index: any) => this.idRoot() + '-opt-' + index;

  // ---- derived state -----------------------------------------------------
  // The visible option list: identity in select-only / non-filtering mode,
  // a case-insensitive substring filter when a combobox query is present.
  // A plain function (not `$computed`) so it reads uniformly across all six
  // targets — a `$computed` is a value on React but an accessor on Solid, so
  // aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
  // plain function is identical everywhere.
  // The label shown in the (select-only) trigger when closed. A real `$computed`
  // — read bare in the template, never aliased in script, so the per-target
  // accessor form stays uniform.
  get selectedLabel() {
    const cur = this.value;
    if (this.multiple) {
      // Read the model value into a local before narrowing: `$props.value` lowers
      // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
      // separate calls — narrowing one stable local works on every target.
      const arr = Array.isArray(cur) ? cur : [];
      if (arr.length === 0) return '';
      return this.options.filter((o: any) => arr.includes(this.valueOf$local(o))).map(this.labelOf).join(', ');
    }
    const match = this.options.find((o: any) => this.valueOf$local(o) === cur);
    return match === undefined ? '' : this.labelOf(match);
  }

  // The id of the active option, for aria-activedescendant. null when none.
  get activeDescendant() {
    if (!this._open$local.value || this._activeIndex.value < 0) return null;
    return this.optionId(this._activeIndex.value);
  }

  // Is a given option currently selected? Multi compares array membership.
  isSelected = (opt: any) => {
  const v = this.valueOf$local(opt);
  const cur = this.value;
  if (this.multiple) return Array.isArray(cur) && cur.includes(v);
  return cur === v;
};

  // First enabled visible index, preferring the currently-selected option.
  close = () => {
  if (!this._open$local.value) return;
  this._open$local.value = false;
  this._activeIndex.value = -1;
  this.dispatchEvent(new CustomEvent("open-change", {
    detail: {
      open: false
    },
    bubbles: true,
    composed: true
  }));
};

  // ---- selection ---------------------------------------------------------
  select = (opt: any) => {
  if (this.disabledOf(opt)) return;
  const v = this.valueOf$local(opt);
  if (this.multiple) {
    const cur = this.value;
    const arr = Array.isArray(cur) ? cur : [];
    // Fresh array on every commit — in-place mutation is dropped by the
    // React/Solid/Lit/Angular change detectors.
    const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
    this._valueControllable.write(next);
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        value: next,
        option: opt
      },
      bubbles: true,
      composed: true
    }));
  } else {
    this._valueControllable.write(v);
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        value: v,
        option: opt
      },
      bubbles: true,
      composed: true
    }));
    if (this.closeOnSelect) {
      this.close();
      this.focusControl();
    }
  }
};

  clear = () => {
  const empty = this.multiple ? [] : null;
  this._valueControllable.write(empty);
  this._query.value = '';
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: empty,
      option: null
    },
    bubbles: true,
    composed: true
  }));
};

  // ---- keyboard navigation over the VISIBLE list -------------------------
  // Pointer hover sets the virtual highlight (matches native <select> feel).
  onOptionPointerMove = (index: any) => {
  if (this._activeIndex.value !== index) this._activeIndex.value = index;
};

  groupOfOption = (opt: any) => opt !== null && typeof opt === 'object' && 'group' in opt ? opt.group : null;

  // Grouping is active only for a non-empty `groups` list, and never while windowing.
  isGrouped = () => !this.virtual && Array.isArray(this.groups) && this.groups.length > 0;

  // Visual order: identity when ungrouped, group-partitioned when grouped. Memoised on
  // the inputs so repeated calls in one render return the SAME array (stable indices).
  orderedOptionsCache = {
  keys: null as any[] | null,
  val: null as any
};

  orderedOptions = () => {
  const __rozieMemoKey = [this.options, this.groups, this.virtual];
  const __rozieMemoPrev = this.orderedOptionsCache.keys;
  if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
    return this.orderedOptionsCache.val;
  }
  const __rozieMemoVal = this.isGrouped() ? groupOptions(this.options, this.groups, this.groupOfOption).ordered : this.options;
  this.orderedOptionsCache.keys = __rozieMemoKey;
  this.orderedOptionsCache.val = __rozieMemoVal;
  return __rozieMemoVal;
};

  // Blocks for the grouped render; each item carries its index in visibleOptions().
  groupBlocks = () => {
  const res = groupOptions(this.options, this.groups, this.groupOfOption);
  let i = 0;
  return res.blocks.map((b: any) => ({
    group: b.group,
    items: b.items.map((opt: any) => ({
      opt,
      index: i++
    }))
  }));
};

  // ══ HOST-LOCAL NAVIGATION (begin) ═════════════════════════════════════════
  // These ten functions are defined here instead of imported from listCore.rzts.
  // The spine's navigation is bound to the spine's own `visibleOptions()`, and the
  // partial inliner does not allow shadowing one function of a partial (ROZ139).
  // Select needs navigation over the grouped VISUAL order, so it owns
  // `visibleOptions` and every spine function that reaches it. The nine below
  // `visibleOptions` are VERBATIM copies of listCore.rzts, kept in sync by
  // tests/spine-copies.test.ts — change them in the spine first, then here.
  // Combobox likewise keeps its navigation host-local.
  // The option list every index refers to, in visual order. Select-only: there is
  // no query filter (nothing writes `$data.query`).
  visibleOptions = () => this.orderedOptions();

  resolveInitialActive = () => {
  const opts = this.visibleOptions();
  const sel = opts.findIndex((o: any) => this.isSelected(o) && !this.disabledOf(o));
  if (sel !== -1) return sel;
  return opts.findIndex((o: any) => !this.disabledOf(o));
};

  open = () => {
  if (this.disabled) return;
  if (this._open$local.value) return;
  this._open$local.value = true;
  this._activeIndex.value = this.resolveInitialActive();
  this.dispatchEvent(new CustomEvent("open-change", {
    detail: {
      open: true
    },
    bubbles: true,
    composed: true
  }));
};

  toggle = () => {
  if (this._open$local.value) this.close();else this.open();
};

  nextEnabled = (from: any, dir: any) => {
  const opts = this.visibleOptions();
  if (opts.length === 0) return -1;
  let i = from;
  for (let step = 0; step < opts.length; step++) {
    i += dir;
    if (i < 0) i = opts.length - 1;else if (i >= opts.length) i = 0;
    if (!this.disabledOf(opts[i])) return i;
  }
  return from;
};

  move = (dir: any) => {
  if (!this._open$local.value) {
    this.open();
    return;
  }
  const start = this._activeIndex.value < 0 ? dir > 0 ? -1 : 0 : this._activeIndex.value;
  this._activeIndex.value = this.nextEnabled(start, dir);
  this.scrollActiveIntoView();
};

  moveEdge = (toEnd: any) => {
  if (!this._open$local.value) this.open();
  this._activeIndex.value = toEnd ? this.nextEnabled(-1, -1) : this.nextEnabled(-1, 1);
  this.scrollActiveIntoView();
};

  commitActive = () => {
  const opts = this.visibleOptions();
  if (this._activeIndex.value >= 0 && this._activeIndex.value < opts.length) this.select(opts[this._activeIndex.value]);
};

  onTypeahead = (ch: any) => {
  if (this.typeTimer !== null) clearTimeout(this.typeTimer);
  this.typeBuffer += ch.toLowerCase();
  this.typeTimer = setTimeout(() => {
    this.typeBuffer = '';
  }, 600);
  const opts = this.visibleOptions();
  const idx = opts.findIndex((o: any) => !this.disabledOf(o) && this.labelOf(o).toLowerCase().startsWith(this.typeBuffer));
  if (idx !== -1) {
    if (!this._open$local.value) this.open();
    this._activeIndex.value = idx;
    this.scrollActiveIntoView();
  }
};

  onControlKeyDown = ($event: any) => {
  const key = $event.key;
  if (key === 'ArrowDown') {
    $event.preventDefault();
    this.move(1);
  } else if (key === 'ArrowUp') {
    $event.preventDefault();
    this.move(-1);
  } else if (key === 'Home') {
    $event.preventDefault();
    this.moveEdge(false);
  } else if (key === 'End') {
    $event.preventDefault();
    this.moveEdge(true);
  } else if (key === 'Enter') {
    if (this._open$local.value) {
      $event.preventDefault();
      this.commitActive();
    }
  } else if (key === 'Escape') {
    if (this._open$local.value) {
      $event.preventDefault();
      this.close();
      this.focusControl();
    }
  } else if (key === ' ' || key === 'Spacebar') {
    // Space toggles / commits in a select-only host (a button trigger). A
    // filter-input host types the literal space into its <input> and does NOT
    // route Space through this reducer, so this branch is select-only by use.
    $event.preventDefault();
    if (!this._open$local.value) this.open();else this.commitActive();
  } else if (key === 'Tab') {
    if (this._open$local.value) this.close();
  } else if (key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
    this.onTypeahead(key);
  }
};

  // ══ HOST-LOCAL NAVIGATION (end) ═══════════════════════════════════════════
  // ---- shared windowing math (Phase 64 P4: @rozie-ui/headless-core/windowing.rzts) ----
  // The PURE windowing math (the windowed slice + spacer geometry) is the SAME
  // virtual-core bridge data-table consumes. It is a compile-time `.rzts` partial:
  // the imported symbols DISSOLVE into this leaf via inlineScriptPartials() before
  // IR lowering (zero runtime dep). The math closes over this host's pieces BY
  // CONVENTION (D-04/D-05): windowSource(), the virtualizer instance + gridScrollEl +
  // the virtual-core fns, scheduleRemeasure(), $data.windowVer/$data.editVer, and the
  // no-op pin hook pinnedEditIndex()/pinnedMeasurement() defined below. The impure
  // DOM/refs pieces stay HERE per-consumer (ROZ123). NB the pin hooks are defined in
  // THIS host (not the shared partial) so data-table's A==B byte-identity is untouched.
  // ══ Generic vertical windowing math (Phase 64, D-04) — the target-agnostic virtual-core bridge ══
  // Lifted verbatim from the DataTable virtualization.rzts (the Phase 53/63 B13 baseline). This partial
  // holds ONLY the PURE windowing math; every DOM/refs/virtualizer-instance impurity stays per-consumer
  // in the host (ROZ123). It is a compile-time `.rzts` script-partial: it dissolves into each consumer's
  // compiled leaf via inlineScriptPartials() before IR lowering — leaving zero runtime dependency.
  //
  // HOST CONTRACT (symbols the consuming host MUST define before importing — the same implicit
  // by-convention mixin contract the DataTable host's other partials already use for `$data.windowVer`):
  //   - windowSource(): T[]   — the full list to window (the KEY generalization; the DataTable host
  //                             returns its pre-pagination row model, listbox/combobox return the
  //                             filtered options). This partial MUST NOT reach into the host data engine
  //                             directly — rows arrive ONLY through windowSource().
  //   - $props.estimateRowHeight — per-item size estimate (kept aliased for DataTable back-compat).
  //   - $data.windowVer / $data.editVer — window/edit-version reactivity bumps.
  //   - gridScrollEl              — the scroll-container element handle.
  //   - virtualizer               — the host virtual-core instance (built in $onMount from the ref).
  //   - observeElementRect / observeElementOffset / elementScroll / measureElement — virtual-core fns.
  //   - scheduleRemeasure()       — the host's rAF/microtask remeasure defer.
  //   - pinnedEditIndex() / pinnedMeasurement(pin) — the D-05 OPTIONAL pin-extension hook (host-provided,
  //                             defaulting to no-op): the DataTable host passes its edit-pinning hooks;
  //                             listbox passes nothing. Routing pinning through this host hook (NOT
  //                             inlining it) keeps DataTable's B13 edit-pinning behavior byte-identical.
  //   - rowsWindowed(): boolean  — is the ROW axis windowed. REQUIRED, no default — replaces every bare
  //                             truthiness read of the host's windowing prop (D-05); `windowedRows()` /
  //                             `padTop()` / `padBottom()` / `rowIsOutsideWindow()` below call it by
  //                             convention exactly as they already call `pinnedEditIndex()`.
  //   - colsWindowed(): boolean  — is the COLUMN axis windowed. REQUIRED, no default. `false` for every
  //                             host until it defines the real column-axis mechanism (87-04+).
  //   - columnCount(): number    — the leaf-column count the column virtualizer windows over. REQUIRED,
  //                             no default.
  //   - columnSize(i: number): number — the authoritative width of absolute leaf column `i`, sourced
  //                             from table-core's `getSize()` under D-06. REQUIRED, no default.
  //   - forcedColumns(): number[] — the D-10 OPTIONAL column-axis mirror of `pinnedEditIndex()`: the
  //                             DataTable host unions pinned + active-cell + editing column indices into
  //                             the column-window slice; listbox/combobox pass an empty array (host-
  //                             provided, defaulting to `[]`).
  //   - colVirtualizer           — the host's SECOND virtual-core instance, windowing the COLUMN axis
  //                             (see the AXIS MECHANISM note below). Host-provided, defaulting to `null`.
  //   - autoMeasureOn(): boolean — the D-18 REQUIRED content-driven-estimate gate (Phase 87 87-07):
  //                             data-table's real body reads `$props.autoMeasure === true`; listbox/
  //                             combobox/command-palette return `false` so the accumulator branch
  //                             estimateRowSize() gates on is dead code for them (D-20).
  //   - afterRowRemeasure        — OPTIONAL host-owned mutable `let` (defaults to a no-op / undefined),
  //                             assigned to refineRowEstimate() (below) by the host. The DataTable
  //                             host's remeasureWindow() (virtualization.rzts) calls it AFTER its
  //                             measureElement sweep so the fold + hysteresis re-feed run on every
  //                             window commit. Routed through a mutable `let` rather than a direct
  //                             call FROM virtualization.rzts INTO this file: a relative-partial CONST
  //                             calling a bare-specifier-partial CONST is the exact forward-reference
  //                             TDZ class remeasureColumnWindow()'s own DataTable.rozie comment
  //                             documents for columnVirtualizerOptions() (inlineScriptPartials()
  //                             groups the relative partial BEFORE the bare-specifier partial in the
  //                             merged per-target output, regardless of source import order). A
  //                             mutable `let` hoists to `useRef` on React and is excluded from a
  //                             useCallback's dependency array, sidestepping the hazard entirely — the
  //                             SAME mechanism `refreshRowModel` already relies on.
  //
  // AXIS MECHANISM (OQ1 / Assumption A1 — resolved from the installed source in 87-02;
  // LANDED in 87-04: `columnVirtualizerOptions()` below IS the second, horizontal instance this
  // note originally only documented). `horizontal` is a PER-INSTANCE field of `VirtualizerOptions`
  // (`node_modules/@tanstack/virtual-core/dist/esm/index.d.ts:67`, installed version 3.17.1 per
  // `package.json`), and every axis-sensitive internal read consults `instance.options.horizontal` —
  // `measureElement`'s inlineSize/blockSize + offsetWidth/offsetHeight branch
  // (`dist/esm/index.js:137,150`), `observeElementOffset`'s scrollLeft/scrollTop branch
  // (`dist/esm/index.js:118-121`), `getMaxScrollOffset`'s scrollWidth/scrollHeight branch
  // (`dist/esm/index.js:907-915`), and `scrollWithAdjustments`'s left/top branch
  // (`dist/esm/index.js:152-161`). So ONE `Virtualizer` instance windows exactly ONE axis: the column
  // axis needs its own SECOND, independent `Virtualizer` instance constructed with `horizontal: true`,
  // sharing the SAME `getScrollElement()` (the `rdt-scroll` wrapper) the row instance already uses.
  // Two options the row axis does not set that the column instance will need: `isRtl?: boolean`
  // (data-table ships an RTL grid path) and `overscan?: number` (D-07 gives the column axis its own
  // hardcoded constant, separate from the row axis's `overscan: 8` below).
  //
  // isRtl WIRING (gap-closure 87-09, LANDED — see `ensureColRtlWatch()`/`isColRtl()` below,
  // immediately ahead of `columnVirtualizerOptions()`): data-table has no construction-time RTL
  // signal (no `dir`/`rtl` prop), and `dir` can be set on `gridScrollEl` at ANY point relative to
  // mount. `isRtl` is therefore computed LIVE via `getComputedStyle`, not baked in once.
  // getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
  // React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
  // id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
  virtualItemKey = (i: any) => {
  const src = this.windowSource();
  return src && src[i] ? src[i].id : undefined;
};

  // COL_OVERSCAN (D-07): the column axis's own hardcoded overscan constant, separate from the
  // row axis's `overscan: 8` below. Columns are far wider than rows are tall, so one number
  // cannot serve both axes; no prop is exposed because no consumer has asked to tune the row
  // overscan across the four phases it has shipped. Unused until 87-04 constructs the second,
  // horizontal Virtualizer instance (see the AXIS MECHANISM note above).
  // ══ Phase 87 87-07 (D-15/D-18) — content-driven auto-measure: the shared engine's FIRST
  // mutable top-level state. Hoisted to `useRef` PER-INSTANCE by the React emitter's
  // hoistModuleLet — the SAME mechanism already load-bearing for `table`, `virtualizer`,
  // `remeasurePending`, and `gridScrollEl` in the DataTable host (Task 1's confirmed
  // precedent), so two DataTable instances on one page never share an accumulator
  // (T-87-07-04). measuredRowTotal/measuredRowCount together give the running MEAN of every
  // row folded in so far; lastFedRowEstimate is the estimate value most recently pushed into
  // virtual-core (the hysteresis comparison baseline). ══
  measuredRowTotal = 0;

  measuredRowCount = 0;

  // ══ Gap-closure 87-10 — windowVerBumpPending / bumpWindowVer(): coalesce EVERY $data.windowVer
  // write behind a SINGLE microtask-deferred increment, regardless of how many callers request
  // one within the same synchronous JS task. ══
  //
  // ROOT CAUSE (framework-agnostic; the Solid-specific symptom this closes only EXPOSES it) —
  // confirmed by instrumenting the installed @tanstack/virtual-core@3.17.1 source directly
  // (dist/esm/index.js), not by reasoning abstractly: virtual-core's resizeItem() calls
  // `this.notify(false)` — synchronously invoking `virtualizerOptions().onChange` below — EVERY
  // TIME a measured row's real size differs from its cached one (`delta !== 0`), independent of
  // framework (dist/esm/index.js:836-874). remeasureWindow()'s CR-01 sweep
  // (packages/ui/data-table/src/virtualization.rzts) measures EVERY currently-rendered `<tr>` in
  // ONE for-loop BEFORE calling afterRowRemeasure() (refineRowEstimate() below) — so a single
  // synchronous JS task (e.g. the very first measurement pass, which transitions N never-before-
  // measured rows from the flat seed to their real heights) can fire onChange, and therefore an
  // UNCOALESCED `$data.windowVer = $data.windowVer + 1`, MANY times in a row — well BEFORE
  // refineRowEstimate()'s own fold-then-re-feed (which runs only AFTER that loop finishes) has
  // folded those same measurements into the running mean or re-fed the converged estimate into
  // virtual-core via setOptions(). A live trace of this exact sequence (instrumented resizeItem/
  // getMeasurements calls, DataTableColumnVirtualDemo, autoMeasure on) showed Vue batching 3
  // resizeItem calls before its ONE downstream re-render reads getMeasurements() — already
  // reflecting the fully-folded, re-fed state — versus Solid re-running its padTop()/padBottom()
  // effects SYNCHRONOUSLY and IMMEDIATELY on EVERY individual windowVer write (11 interleaved
  // resize-then-immediate-recompute pairs, each recompute happening mid-sweep, before
  // refineRowEstimate() had run even once). React/Vue/Svelte/Angular/Lit all batch their own
  // reactivity to at least a microtask boundary, so their downstream reads land AFTER the whole
  // synchronous burst (measurement sweep + fold + re-feed) completes — accidentally correct, not
  // correct by construction. Solid does not auto-batch a signal write made from outside a
  // Solid-owned event/effect context, so it is the one target where the mid-burst TORN read is
  // externally observable. Because `setOptions()` + `_willUpdate()` alone do NOT invalidate
  // virtual-core's own `getMeasurements()` memo (keyed on itemSizeCacheVersion /
  // getMeasurementOptions() — never on the estimateSize FUNCTION reference itself; confirmed from
  // the same installed source, dist/esm/index.js:585-587,624), Solid's LAST such mid-sweep
  // recompute is also the LAST time getMeasurements() is ever invoked for that sweep once no
  // further row happens to differ from its cache — so the DOM stays frozen on that stale,
  // pre-fold/pre-re-feed snapshot indefinitely, even though the accumulator itself has already
  // converged correctly (T-87-07's own confirmed finding).
  //
  // FIX: coalesce every requester of a windowVer bump — virtual-core's own onChange AND
  // refineRowEstimate()'s explicit re-feed bump — behind ONE microtask-deferred write, the SAME
  // idiom scheduleRemeasure() already uses in virtualization.rzts. This makes the render happen
  // EXACTLY ONCE, strictly AFTER the entire synchronous burst (including refineRowEstimate()'s
  // fold + re-feed) on EVERY target, by construction rather than by incidental host-framework
  // batching. Scoped to the ROW axis only: colVirtualizer never calls resizeItem() at all (D-06 —
  // column widths come from table-core's getSize() oracle, never measured from the DOM), so
  // columnVirtualizerOptions()'s onChange cannot hit this burst class and is left untouched.
  windowVerBumpPending = false;

  bumpWindowVer = (): void => {
  if (this.windowVerBumpPending) return;
  this.windowVerBumpPending = true;
  const flush = () => {
    this.windowVerBumpPending = false;
    this._windowVer.value = this._windowVer.value + 1;
  };
  // Mirrors scheduleRemeasure()'s own defensive queueMicrotask-with-setTimeout-fallback
  // (virtualization.rzts) for environments where queueMicrotask is unavailable.
  if (typeof queueMicrotask !== 'undefined') queueMicrotask(flush);else setTimeout(flush, 0);
};

  // ESTIMATE_REFEED_DELTA_PX (D-15): the hysteresis threshold gating a re-feed into
  // virtual-core. Without it, a mean nudging by a fraction of a pixel on every fold would
  // re-feed on every window commit — the T-87-07-01 DoS control, paired with virtual-core's
  // own measureElement/resizeItem idempotence (see refineRowEstimate() below).
  // estimateRowSize(i) (D-15/D-17): the estimateSize() resolver. MUST check !autoMeasureOn()
  // FIRST so the off path touches zero accumulator state and returns $props.estimateRowHeight
  // verbatim (D-17's byte-behavioral no-op). The zero-measurements case (first paint,
  // regardless of autoMeasure) still returns the seed — the very first render has nothing
  // measured yet either way (D-15).
  estimateRowSize = (i: number): number => {
  if (!this.autoMeasureOn()) return this.estimateRowHeight;
  if (this.measuredRowCount === 0) return this.estimateRowHeight;
  return Math.round(this.measuredRowTotal / this.measuredRowCount);
};

  // foldMeasuredRow(index, height): fold ONE measured row's height into the running-mean
  // accumulator, UPDATING (not double-adding) an already-folded index (T-87-07-03).
  // The FULL virtualizer options. virtual-core's setOptions REPLACES options with
  // `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
  // source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
  // Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
  // on virtual-core's generic option inference. onChange's windowVer write is routed through
  // bumpWindowVer() (87-10) rather than a raw `$data.x = $data.x + 1` — resizeItem() can call
  // this onChange MANY times in a single synchronous sweep (once per row whose real measured
  // size differs from its cache, e.g. every never-before-measured row in the FIRST window),
  // and coalescing those into one microtask-deferred write is what keeps every target's render
  // landing strictly AFTER the whole sweep (see bumpWindowVer()'s own comment for the confirmed
  // Solid-specific rendering gap this closes). The React emitter still lowers the underlying
  // `$data.windowVer = $data.windowVer + 1` to functional setState — correct even deferred to a
  // microtask, exactly as it was correct from a mount closure before.
  virtualizerOptions = (): any => ({
  count: this.windowSource().length,
  getScrollElement: () => this.gridScrollEl,
  estimateSize: (i: any) => this.estimateRowSize(i),
  observeElementRect,
  observeElementOffset,
  scrollToFn: elementScroll,
  measureElement,
  overscan: 8,
  getItemKey: this.virtualItemKey,
  onChange: () => {
    this.bumpWindowVer();
    // CR-01: re-observe the freshly-committed window so RECYCLED rows get measured.
    // virtual-core only observe()s a node you explicitly hand to measureElement (it does
    // NOT auto-discover rendered rows — measureElement is the SOLE caller of
    // observer.observe, virtual-core@3.17.1 dist/esm/index.js:794-817). Rows that recycle
    // into view on scroll are brand-new DOM nodes; without re-sweeping they keep the
    // estimateRowHeight seed forever and the spacer math drifts (req-2). Deferred one frame
    // so the new <tr> set is in the DOM before we measure. Safe from an infinite
    // measure→onChange→measure loop: measureElement is idempotent on an already-observed
    // node (the `prevNode !== node` guard), and resizeItem only re-fires onChange when the
    // measured height actually DIFFERS from the cached one (delta !== 0) — an unchanged
    // re-measure is a no-op.
    this.scheduleRemeasure();
  }
});

  // pinMeasurement(pin): the D-05 pin-hook read, RE-TYPED at the windowing layer so the
  // shared math is strict-clean across every host. The host-provided pinnedMeasurement() has
  // two shapes: the DataTable host returns a real virtual-core measurement; the listbox/combobox
  // no-op host returns bare `null` (inferred `(pin) => null`). Calling it directly makes
  // `const pm = pinnedMeasurement(pin)` flow-narrow to `null`, so the downstream `pm && pm.start`
  // guard collapses the object branch to `never` (TS2339, Class 3). Reading the hook through this
  // thin wrapper with an EXPLICIT return type (a return-type annotation is NOT flow-narrowed)
  // gives the measurement a real object-or-null shape, so `pm && pm.start` keeps the object branch.
  // Typing-only: the runtime value (a measurement or null) is unchanged.
  pinMeasurement = (pin: number): {
  start: number;
  size: number;
  index: number;
  end: number;
} | null => this.pinnedMeasurement(pin);

  // windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
  // { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
  // $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
  // full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
  // `rows` binding → TS2448 self-shadow, line ~1149 lesson).
  windowedRows = () => {
  // SUBSCRIBE FIRST (fine-grained targets): touch the reactive windowVer at the TOP — BEFORE any
  // early return — so Solid's <For>/Svelte's {#each} accessor subscribes to it on its FIRST eval,
  // which happens at initial render while `virtualizer` is still null (it is built in $onMount,
  // after the first render). `virtualizer` is a non-reactive `let`, so if the windowVer read sat
  // BELOW the `!virtualizer` guard the accessor would early-return [] without ever reading the
  // signal → it would NEVER re-run when onChange later bumps windowVer, and the window would stay
  // blank forever (the Solid/Svelte fine-grained bug). Coarse targets re-render wholesale so the
  // placement is a no-op for them. The post-construction windowVer bump in $onMount fires the
  // first re-run that picks up the now-non-null virtualizer.
  // ALSO subscribe to editVer here so the slice re-derives when an editor opens/closes (the
  // pin/unpin transition), mirroring the probe's windowVer bump on pin (Solid/Svelte fine-grained).
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.virtualizer) {
    // Rows OFF (Phase 87 D-04: this now includes the colsWindowed()-only path, since the
    // wrapper template is entered whenever isWindowed(), not just rowsWindowed() — the row
    // virtualizer is never constructed when only the column axis is windowed, D-04) → the FULL
    // set, with a SYNTHETIC `vi.index` set to each row's array position (matching rowIndexOf's
    // own `$data.rows.indexOf(row)` semantics exactly, since $data.rows IS windowSource()'s
    // output here). Every windowed body binding reads wr.vi.index (data-row, aria-rowindex,
    // colIndexOf, isEditing, the fill handle) — a bare `null` there is a hard crash the moment
    // this branch is reached with the wrapper mounted, which colsWindowed()-only now does.
    // Row-virtual ON but the virtualizer is not yet constructed (pre-$onMount first paint) →
    // render NOTHING so the template never dereferences a not-yet-real `vi`; the rows appear on
    // the first onChange after _didMount.
    if (!this.rowsWindowed()) {
      const rowList = this._rows.value || [];
      return rowList.map((r: any, i: any) => ({
        vi: {
          index: i
        },
        row: r
      }));
    }
    return [];
  }
  const items = this.virtualizer.getVirtualItems();
  const rowList = this._rows.value || [];
  // WR-01: drop any virtual item whose index outruns the current full-model rows (a brief
  // shrink window where the virtualizer count is stale relative to $data.rows on the async
  // onChange→windowVer path). The template keys on wr.row.id, so a row:undefined entry would
  // throw "Cannot read properties of undefined"; filter it here so the template never sees it.
  const out = items.map((vi: any) => ({
    vi,
    row: rowList[vi.index]
  })).filter((wr: any) => wr.row);
  // ── D-02 pin-row union (req-9): if an editor is open on a row that is NOT in the current
  // window, UNION it into the slice (keyed on row.id so Lit repeat / Solid For never recycle it
  // into another full-model row), LEADING the slice when it sits above the window and TRAILING
  // it when below — so DOM order matches visual/aria order. The spacer subtraction (padTop/
  // padBottom) keeps the total exactly getTotalSize(). This is the 51-01-proven mechanism wired
  // into the real windowing.
  const pin = this.pinnedEditIndex();
  if (pin >= 0 && rowList[pin]) {
    let inWindow = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].index === pin) {
        inWindow = true;
        break;
      }
    }
    if (!inWindow) {
      const pm = this.pinMeasurement(pin);
      const firstStart = items.length ? items[0].start : 0;
      const above = pm ? pm.start < firstStart : pin < (items.length ? items[0].index : pin);
      const pinnedEntry = {
        vi: pm != null ? pm : {
          index: pin
        },
        row: rowList[pin],
        pinned: true
      };
      if (above) out.unshift(pinnedEntry);else out.push(pinnedEntry);
    }
  }
  return out;
};

  // Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
  // the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
  // (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
  padTop = () => {
  // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
  // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
  // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.rowsWindowed() || !this.virtualizer) return 0;
  const items = this.virtualizer.getVirtualItems();
  let pad = items.length ? items[0].start : 0;
  // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
  // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
  // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
  const pin = this.pinnedEditIndex();
  if (pin >= 0) {
    const pm = this.pinMeasurement(pin);
    const inWindow = this.pmIndexInWindow(items, pin);
    if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
  }
  return pad < 0 ? 0 : pad;
};

  padBottom = () => {
  // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
  // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
  // on pin/unpin.
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.rowsWindowed() || !this.virtualizer) return 0;
  const items = this.virtualizer.getVirtualItems();
  if (!items.length) return 0;
  let pad = this.virtualizer.getTotalSize() - items[items.length - 1].end;
  // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
  // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
  const pin = this.pinnedEditIndex();
  if (pin >= 0) {
    const pm = this.pinMeasurement(pin);
    const inWindow = this.pmIndexInWindow(items, pin);
    // WR-01: decide "below the window" by INDEX, not by start-OFFSET. On variable-height rows
    // measurement drift can leave pm.start at-or-past items[0].start while the pinned row's
    // index is actually ABOVE the window, mis-subtracting its height from the trailing spacer.
    // The pinned full-model index vs the last rendered item's index is drift-proof. Fall back to
    // the offset comparison only if the measurement lacks an index (defensive).
    const lastItemIdx = items[items.length - 1].index;
    const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
    if (pm && !inWindow && below) {
      // below the window → it trailed the slice; subtract its height from the trailing spacer.
      if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
    }
  }
  return pad < 0 ? 0 : pad;
};

  // pmIndexInWindow: is full-model index `idx` present in the rendered virtual window?
  pmIndexInWindow = (items: any, idx: any) => {
  for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
  return false;
};

  // rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
  // window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
  rowIsOutsideWindow = (r: any) => {
  if (!this.rowsWindowed() || !this.virtualizer) return false;
  const items = this.virtualizer.getVirtualItems();
  for (const it of items as any) if (it.index === r) return false;
  return true;
};

  // ══ Phase 87 87-04 — the column-axis analogs of windowedRows()/padTop()/padBottom()/
  // rowIsOutsideWindow() above. The column axis has no "row-shaped" identity to carry alongside
  // a VirtualItem (a column is not a full-model object the way a row is), so windowedColIndices()
  // returns bare ABSOLUTE leaf-column indices; the template resolves each index back to a header/
  // cell through the host's own header-group / visibleCellsFor lookups (D-08/D-09). ══
  // windowedColIndices(): the ordered array of ABSOLUTE leaf-column indices to render.
  virtualizer: any = null;

  virtualizerCleanup: any = null;

  gridScrollEl: any = null;

  remeasurePending = false;

  // Scroll-end pin state (see recordScrollEnd()): whether the USER left the view at the end,
  // the option count at that moment, and the last scrollTop already accounted for.
  scrollEndPinned = false;

  scrollEndPinnedCount = -1;

  scrollEndPinnedTop = -1;

  // windowSource(): the windowing.rzts host-contract row source — the FILTERED option
  // set. CR-02: the shared windowing contract requires each row to carry a STABLE `.id`
  // (windowing.rzts virtualItemKey reads src[i].id, and the windowed template keys on
  // wr.row.id). A raw Select option is a primitive or a bare { label, value, disabled }
  // — NOT guaranteed to have `.id` — so an unwrapped raw set keyed on wr.row.id collapses
  // every framework :key (and every virtual-core measurement key) to `undefined`, which
  // recycles the wrong DOM node as the window scrolls. Wrap each option into an id-bearing
  // row the way the sibling Combobox's filteredOptions() does — `id` is the resolved
  // value, `_opt` the original option (read via wr.row._opt in the windowed template),
  // `_i` the source index. Kept === $data.rows so the math's rowList[vi.index] resolves to
  // the same wrapped row the count windows over.
  //
  // $memo, keyed on the TRUE inputs. The key covers everything the map reads:
  // options ref + groups + virtual (visibleOptions' inputs — with `virtual` on,
  // grouping is off, so this is source order) and the optionValue resolver
  // (valueOf in the map body).
  // Same reference-stability contract the sibling Combobox's filteredOptions carries —
  // virtual-core's getItemKey/getMeasurements walk this O(count) per pass, so an
  // unmemoized per-call re-map made every scroll tick O(N²) in wrapper allocations.
  windowSourceCache = {
  keys: null as any[] | null,
  val: null as any
};

  windowSource = () => {
  const __rozieMemoKey = [this.options, this.groups, this.virtual, this.optionValue];
  const __rozieMemoPrev = this.windowSourceCache.keys;
  if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
    return this.windowSourceCache.val;
  }
  const __rozieMemoVal = this.visibleOptions().map((o: any, i: any) => ({
    id: this.valueOf$local(o),
    _opt: o,
    _i: i
  }));
  this.windowSourceCache.keys = __rozieMemoKey;
  this.windowSourceCache.val = __rozieMemoVal;
  return __rozieMemoVal;
};

  // D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
  // A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
  // pinnedMeasurement() UNGUARDED by convention; a select has no edit-pinning, so these
  // reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
  // to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
  pinnedEditIndex = () => -1;

  pinnedMeasurement = (pin: any) => null;

  // D-05 windowing.rzts host-contract one-liner (Phase 87 87-02). rowsWindowed() preserves
  // today's EXACT truthiness (byte-behavior-identical) — it is the REQUIRED symbol
  // windowing.rzts calls in place of a bare `$props.virtual` read. NOT type-annotated — this
  // `<script>` block has no `lang="ts"` (unlike windowing.rzts / Combobox.rozie), so the
  // pinMeasurement() explicit-return-type trick (windowing.rzts:65-74) does not apply here; nothing
  // in this plan calls these through a type-narrowing wrapper.
  //
  // GAP-CLOSURE 87-16 (WR-02): the column-axis host-contract symbols (`colVirtualizer`,
  // `colsWindowed()`, `columnCount()`, `columnSize()`, `forcedColumns()`) that 87-02 added
  // alongside this were REMOVED here — they were dead code shipped on a mistaken premise
  // about the compiler's tree-shaking BFS. Select imports only `{ virtualItemKey,
  // virtualizerOptions, windowedRows, padTop, padBottom, pmIndexInWindow, rowIsOutsideWindow }`
  // from windowing.rzts; none of those functions' bodies reference the column-axis symbols
  // (only `columnVirtualizerOptions()`/`windowedColIndices()`/`colPadLeft()`/`colPadRight()`/
  // `colIsOutsideWindow()` do, and Select never imports any of those), so
  // `inlineScriptPartials()`'s BFS never needed them to exist. See 87-REVIEW.md WR-02 /
  // 87-16-SUMMARY.md for the verification trail.
  rowsWindowed = () => !!this.virtual;

  // autoMeasureOn() (Phase 87 87-07, D-18/D-20): the content-driven-estimate host-contract
  // gate. Select never lights this branch — a permanent `false` keeps windowing.rzts's
  // estimateRowSize()/refineRowEstimate() accumulator dead code here. RETAINED (unlike the
  // column-axis symbols above): `virtualizerOptions()` — which Select DOES import and call
  // — wires `estimateSize: (i) => estimateRowSize(i)`, and `estimateRowSize()` calls
  // `autoMeasureOn()` as its first line. This one IS reachable through the import graph.
  autoMeasureOn = () => false;

  // Keep $data.rows === windowSource() so the windowing math indexes the live option set.
  syncRows = () => {
  this._rows.value = this.windowSource();
};

  // SCROLL-END PIN (the data-table D-19 twin): keep a user who scrolled to the END of a
  // variable-height list at the end while the options in view measure taller than their
  // estimate. The view is judged on the DOM, and only at a move the USER made — a move is
  // virtual-core's own when it still holds an unreconciled scroll adjustment
  // (scrollAdjustments !== 0): its above-viewport compensation writes an ABSOLUTE scrollTop
  // computed from its last-observed (stale) offset, so it pulls the view back up from the end
  // and must neither clear the pin nor be mistaken for the user leaving the end. That position
  // is remembered so the scroll event that later reports it is not read as a user move either.
  // (Judging on virtual-core's MODEL, as the data-table host does, fails here: its total grows
  // with every option measured in the ResizeObserver batch while its offset stays at the stale
  // value, so the pin was cleared mid-batch — every target ended 10-126px short, measured.)
  recordScrollEnd = () => {
  if (!this.virtualizer || !this.gridScrollEl || this.virtualizer.scrollState) return;
  const top = this.gridScrollEl.scrollTop;
  if (top === this.scrollEndPinnedTop) return;
  this.scrollEndPinnedTop = top;
  if (this.virtualizer.scrollAdjustments !== 0) return;
  // Only a list that actually overflows has an end to hold: while the window has not painted
  // yet (or the list is closed), scrollHeight <= clientHeight reads as "at the end" and a pin
  // recorded then would jump the freshly opened list to the bottom.
  const sh = this.gridScrollEl.scrollHeight;
  const ch = this.gridScrollEl.clientHeight;
  this.scrollEndPinned = ch > 0 && sh - ch > 1 && sh - top - ch <= 1;
  this.scrollEndPinnedCount = this.windowSource().length;
};

  // Re-apply the pin after the framework has committed the window (called from the rAF pass):
  // the real maximum is known only then. Not while a programmatic scroll (scrollToIndex) is in
  // flight, and not when the option count changed since the user reached the end (a new filter
  // or appended options must not be auto-followed).
  keepScrollEnd = () => {
  if (!this.scrollEndPinned || !this.virtualizer || !this.gridScrollEl || this.virtualizer.scrollState) return;
  if (this.windowSource().length !== this.scrollEndPinnedCount) return;
  const maxTop = this.gridScrollEl.scrollHeight - this.gridScrollEl.clientHeight;
  if (maxTop - this.gridScrollEl.scrollTop > 1) {
    this.gridScrollEl.scrollTop = maxTop;
    this.scrollEndPinnedTop = this.gridScrollEl.scrollTop;
  }
};

  // Defer remeasureWindow() until AFTER the framework commits the recycled window
  // (onChange fires BEFORE React/Solid commit). TWO deferred passes (microtask THEN rAF)
  // behind one in-flight flag (the data-table virtualization.rzts:46-56 pattern, copied
  // per-consumer per D-04/D-09): the microtask catches Solid's <For> / Svelte's {#each}
  // SYNCHRONOUS commit (the Phase 63 Solid under-convergence hazard — D-09 rAF-defer
  // budget), the rAF catches React's async commit. measureElement is idempotent on an
  // already-observed node, so running both is cheap and loop-free.
  scheduleRemeasure = () => {
  this.recordScrollEnd();
  if (this.remeasurePending) return;
  this.remeasurePending = true;
  let ranMicro = false;
  const microPass = () => {
    this.remeasureWindow();
  };
  // N-05 (quick 260923-rrr): key the rAF pass on the OUTCOME. React and Angular commit the
  // recycled window AFTER the first rAF, so one pass measured the OLD options and the new ones
  // waited for virtual-core's 150ms scrolling-ended tick — with variable-height options the late
  // above-viewport adjustment then moved the whole list (measured). Re-run next frame until the
  // committed options cover the virtualizer's window, bounded (the data-table host twin).
  let rafAttempts = 0;
  const rafPass = () => {
    const covered = this.remeasureWindow();
    rafAttempts = rafAttempts + 1;
    if (!covered && rafAttempts < 10 && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(rafPass);
      return;
    }
    this.keepScrollEnd();
    this.remeasurePending = false;
  };
  if (typeof queueMicrotask !== 'undefined') {
    ranMicro = true;
    queueMicrotask(microPass);
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) this.remeasurePending = false;else setTimeout(rafPass, 0);
};

  // measureElement sweep: hand every rendered windowed option to the virtualizer so its
  // true (variable) height is observed (virtual-core measures ONLY nodes passed to
  // measureElement, keyed by the data-index attribute). Bails during a programmatic
  // scroll (scrollToIndex) so a measure can't starve the scroll target.
  remeasureWindow = () => {
  if (!this.virtualizer || !this.gridScrollEl) return true;
  if (this.virtualizer.scrollState) return true;
  const els = this.gridScrollEl.querySelectorAll('.rozie-select-option[data-index]');
  const rendered = new Set();
  for (const el of els as any) {
    this.virtualizer.measureElement(el);
    rendered.add(el.getAttribute('data-index'));
  }
  // N-05: false while the framework has not yet committed the recycled window.
  const items = this.virtualizer.getVirtualItems();
  for (let i = 0; i < items.length; i++) {
    if (!rendered.has(String(items[i].index))) return false;
  }
  return true;
};

  // ---- focus / scroll helpers (post-mount $refs only) --------------------
  // Impure ($refs) → per the ROZ123 + A==B rules they stay in the host (the spine
  // only closes over them). Named `focusControl` (not `focus`): a `focus` $expose
  // verb would override the inherited HTMLElement.focus method on the Lit element.
  focusControl = () => {
  this._refTriggerEl?.focus();
};

  // Keep the active option visible inside the scrolling listbox. Reads $refs in
  // a post-mount callback only (never eagerly — ROZ123). When windowing, route through
  // the virtualizer (scrollToIndex) so an active option OUTSIDE the rendered window is
  // scrolled into view (the windowed-arrow-nav seam); else the native scrollIntoView.
  scrollActiveIntoView = () => {
  if (this._activeIndex.value < 0) return;
  if (this.virtual && this.virtualizer) {
    // 'center' (not 'auto'): keep the active option well inside the rendered slice as the
    // window scrolls — 'auto' lands it at the viewport edge where the overscan band can
    // leave it just-unrendered for a frame on the fine-grained targets (Solid).
    this.virtualizer.scrollToIndex(this._activeIndex.value, {
      align: 'center'
    });
    this.scheduleRemeasure();
    return;
  }
  if (!this._refListEl) return;
  const el = this._refListEl.querySelector('#' + CSS.escape(this.optionId(this._activeIndex.value)));
  el?.scrollIntoView({
    block: 'nearest'
  });
};

  // ---- windowing lifecycle (post-mount; ONLY when virtual) ----------------
  // kickWindow: the cross-target first-paint settle. Re-captures the LIVE scroll element,
  // re-feeds the CURRENT option count into the virtualizer, re-attaches its rect observer
  // (_willUpdate), and bumps the windowVer signal so the windowed <For>/{#each}/repeat
  // re-derives. Retried over a few frames because (a) virtual-core measures the scroll rect
  // asynchronously (D-09 Solid rAF-defer — a synchronous kick sees rectH 0 → empty window),
  // (b) Solid/Lit recreate the list node between mount and first commit (leaving virtual-core's
  // scrollElement stale), and (c) the consumer often seeds options AFTER the select mounts
  // (Lit/React), so the count must be re-read once the prop propagates. Stops once the window
  // paints (or attempts run out) — idempotent + loop-free.
  kickWindow = (attempts: any) => {
  if (!this.virtualizer) return;
  this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-select-list') : this.gridScrollEl;
  // Only re-feed the count from a NON-EMPTY source: on React these rAF closures capture
  // stale (mount-time, empty) props, so feeding here would CLOBBER the $watch's correct
  // count back to 0. The $watch (fresh useEffect props) owns React's count; the kick owns
  // the Solid/Lit scroll-element re-attach + the deferred windowVer re-derive.
  if (this.windowSource().length > 0) {
    this.syncRows();
    this.virtualizer.setOptions(this.virtualizerOptions());
  }
  this.virtualizer._willUpdate();
  this._windowVer.value = this._windowVer.value + 1;
  this.remeasureWindow();
  if (this.windowedRows().length === 0 && attempts > 0) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.kickWindow(attempts - 1));else setTimeout(() => this.kickWindow(attempts - 1), 16);
  }
};

  // nextAutoId(): a page-wide counter shared by every Rozie component instance. It
  // lives on globalThis (read through Reflect, which type-checks in the plain-JS and
  // the TS script alike) so separately bundled copies of a leaf never hand out the
  // same id. The same four lines live in Combobox, Select and Popover.
  nextAutoId = () => {
  const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
  Reflect.set(globalThis, '__rozieAutoId', n);
  return n;
};

  // idRoot(): the `idBase` prop, else the per-instance id generated in $onMount, else the
  // pre-mount fallback. Also the listCore.rzts host contract (its optionId reads it).
  idRoot = () => this.idBase || this._autoId.value || 'rozie-select';

  // popupVisible(): the single gate every list branch and aria-expanded read.
  popupVisible = () => {
  if (!this._open$local.value) return false;
  if (!this.hideEmpty) return true;
  return this.visibleOptions().length > 0;
};

  // ---- composed popover <-> open state ------------------------------------
  // The popover's `open` model is bound to $data.panelOpen, NOT to $data.open: the
  // popover emits nothing of its own, it only writes its model when it dismisses
  // (outside click, or Escape seen at the document). Binding it to a field of its own
  // makes that write visible, so a popover-initiated close is routed through the
  // spine's close() like every other close — one `open-change` per real transition and
  // the highlight reset.
  //
  // Telling the popover's write from our own is done with STATE, not a flag:
  // $data.panelEcho is written together with every $data.panelOpen write made here, so
  // in any one render/flush the pair is consistent — equal means "ours", different
  // means "the popover closed itself" (it can never open itself: `trigger="manual"`).
  // A plain variable in its place is read live while the reactive values are per-render
  // snapshots on React: when a close and a re-open land in one commit, both watchers
  // run in one pass and the second one misreads our own write as a dismissal (seen as
  // a popup that stayed shut after Enter-then-ArrowDown).
  // The echo is written FIRST, for targets whose watchers run synchronously on a write.
  syncPanel = () => {
  const visible = this.popupVisible();
  if (visible === this._panelOpen.value) return;
  this._panelEcho.value = visible;
  this._panelOpen.value = visible;
};

  // select -> popover: follows a derived primitive covering everything popupVisible() reads.
  // Select-local keydown wrapper (kept out of listCore so the shared partial and the sibling
  // families' generated output stay untouched).
  //  - hideEmpty: when the popup is hidden because the list is empty ($data.open is still true
  //    internally; only the rendered/ARIA state is gated), Escape and Enter are left entirely to
  //    the host - not preventDefault'ed, not consumed. All other keys still reach listCore.
  //  - selectOnTab: Tab commits the highlighted option before listCore closes the popup, only
  //    while the popup is actually visible.
  onTriggerKeyDown = ($event: any) => {
  if (this.disabled) return;
  const hidden = this._open$local.value && !this.popupVisible();
  if (hidden && ($event.key === 'Escape' || $event.key === 'Enter')) return;
  if (this.onChipKey($event)) return;
  if (this.onClearKey($event)) return;
  if ($event.key === 'Tab' && this._open$local.value && this.selectOnTab && this.popupVisible() && this._activeIndex.value >= 0) this.commitActive();
  this.onControlKeyDown($event);
};

  // ── clearable ──────────────────────────────────────────────────────────────
  hasValue = () => {
  const cur = this.value;
  if (this.multiple) return Array.isArray(cur) && cur.length > 0;
  return cur !== null && cur !== undefined && cur !== '';
};

  // The clear button's mousedown is prevented (keeps focus on the trigger); the handler
  // is a deliberate no-op, mirroring Combobox's onChipRemovePointerDown.
  noop = () => {};

  onClearClick = () => {
  if (this.disabled) return;
  this.clear();
  this.focusControl();
};

  // Keyboard clear while the popup is closed. Returns true when it handled the key.
  onClearKey = ($event: any) => {
  if (!this.clearable || this.popupVisible() || !this.hasValue()) return false;
  if ($event.key === 'Delete' || $event.key === 'Backspace' && !this.multiple) {
    $event.preventDefault();
    this.clear();
    return true;
  }
  return false;
};

  // ── multi-select chips ─────────────────────────────────────────────────────
  selectedValues = () => {
  const cur = this.value;
  return Array.isArray(cur) ? cur : [];
};

  // One row per selected value, in value order. A value missing from `options` keeps a
  // chip labelled by its raw value (and a null option) rather than vanishing.
  chipRows = () => {
  const opts = Array.isArray(this.options) ? this.options : [];
  return this.selectedValues().map((v: any) => {
    const found = opts.find((o: any) => this.valueOf$local(o) === v);
    return found ? {
      value: v,
      label: this.labelOf(found),
      option: found
    } : {
      value: v,
      label: String(v),
      option: null
    };
  });
};

  chipRemoveLabel = (row: any) => 'Remove ' + String(row.label);

  removeChipValue = (v: any) => {
  if (this.disabled) return;
  const next = this.selectedValues().filter((x: any) => x !== v); // fresh array every commit
  this._valueControllable.write(next);
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: next,
      option: null
    },
    bubbles: true,
    composed: true
  }));
};

  onChipRemove = (v: any) => {
  this.removeChipValue(v);
  this.focusControl();
};

  // Backspace with the popup closed removes the last chip (regardless of `clearable`).
  // Returns true when it handled the key.
  onChipKey = ($event: any) => {
  if (!this.multiple || this.popupVisible() || $event.key !== 'Backspace') return false;
  const vals = this.selectedValues();
  if (vals.length === 0) return false;
  $event.preventDefault();
  this.removeChipValue(vals[vals.length - 1]);
  return true;
};

  // A number-typed helper: a literal `0`/`-1` tabindex trips TS2869 on React
  // (`?? undefined` on a provably non-null operand) - the data-table cellTabindex precedent.
  triggerTabindex = () => this.disabled ? -1 : 0;

  // One click handler on the whole control: the arrow, padding and (later) the chip
  // row all open the popup; the buttons inside stop propagation themselves.
  onControlClick = ($event: any) => {
  if (this.disabled) return;
  // React, Svelte and Solid delegate events at the root, so stopPropagation in a
  // button handler cannot keep the click from here: decide from the event target
  // instead (one code path on all six targets). The clear button never toggles; an
  // INTERACTIVE element inside a chip (the default remove button, or any control a
  // `chip` slot fill brings) never toggles; a chip's plain content (its label) does.
  // Walk the composed path when the event offers one: on Lit a slotted fill lives in
  // the light DOM while the chip wrapper is in the shadow root, and `closest()` does
  // not cross that boundary. Fall back to `closest()` (React's synthetic event has no
  // composedPath, and has no shadow boundary either).
  const interactive = 'button, a[href], input, select, textarea, [role="button"]';
  const path = typeof $event.composedPath === 'function' ? $event.composedPath() : [];
  if (path.length > 0) {
    let seenInteractive = false;
    for (const el of path as any) {
      if (el === $event.currentTarget) break;
      if (!el || typeof el.matches !== 'function') continue;
      if (el.matches('.rozie-select-clear')) return;
      if (el.matches('.rozie-select-chip')) {
        if (seenInteractive) return;
        break;
      }
      if (el.matches(interactive)) seenInteractive = true;
    }
  } else {
    const t = $event.target;
    if (t && typeof t.closest === 'function') {
      if (t.closest('.rozie-select-clear')) return;
      const chip = t.closest('.rozie-select-chip');
      const hit = t.closest(interactive);
      if (chip && hit && chip.contains(hit)) return;
    }
  }
  this.toggle();
  this.focusControl();
};

  get value(): unknown { return this._valueControllable.read(); }
  set value(v: unknown) { this._valueControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['data-rozie-ref', 'options', 'value', 'multiple', 'inline', 'disabled', 'placeholder', 'close-on-select', 'closeonselect', 'option-label', 'optionlabel', 'option-value', 'optionvalue', 'option-disabled', 'optiondisabled', 'id-base', 'idbase', 'hide-empty', 'hideempty', 'select-on-tab', 'selectontab', 'clearable', 'clear-label', 'clearlabel', 'placement', 'offset', 'disable-flip', 'disableflip', 'disable-shift', 'disableshift', 'block', 'groups', 'aria-label', 'arialabel', 'virtual', 'estimate-row-height', 'estimaterowheight', 'max-height', 'maxheight']);
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
