import type { JSX } from 'solid-js';
import { Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import Popover from '@rozie-ui/popover-solid';
// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally;
// every RUNTIME reference sits behind `if ($props.virtual)` / a `virtualizer` guard so
// the non-virtual emitted path executes none of it (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// ---- native option grouping (combobox-native-groups: src/internal/groupOptions.ts) ----
// The PURE stable-partition helper is a RUNTIME import (unlike listCore/windowing
// above, it is NOT a compile-time `.rzts` partial that dissolves at compile) —
// codegen's `copyInternal` vendors it verbatim into each leaf at
// `./internal/groupOptions`, mirroring command-palette's `scoreCommands.ts`.
import { groupOptions } from './internal/groupOptions';

// Windowing instance state (reassigned module-`let`s → React hoists to useRef; do NOT
// const). NULL until $onMount, ONLY constructed when $props.virtual. gridScrollEl is the
// captured .rozie-combobox-list scroll div; remeasurePending dedupes the deferred sweep.

__rozieInjectStyle('Combobox-9546115a', `.rozie-combobox[data-rozie-s-9546115a] {
  position: relative;
  display: inline-block;
  width: var(--rozie-combobox-width, 16rem);
  font: var(--rozie-combobox-font, inherit);
}
.rozie-combobox-input[data-rozie-s-9546115a] {
  box-sizing: border-box;
  /* Phase 86 R2 (plan 86-03): EXPLICIT width, not \`100%\`. The input now renders
     inside popover's \`.rozie-popover-anchor\` (\`display: inline-block\`,
     shrink-to-fit) rather than as a direct 100%-width child of \`.rozie-combobox\`
     (\`width: var(--rozie-combobox-width, 16rem)\`) — a percentage width here would
     be circular against that shrink-to-fit ancestor (CSS 2.1 §10.3.3: an
     unresolvable percentage against an auto-width parent degrades to the
     intrinsic/auto size, NOT the control's real width), which is exactly the
     bug this fixes: \`anchorEl\`'s measured rect must equal the input's real box
     for Floating UI's positioning AND \`matchWidth\`'s reference width to be
     correct. Reads the SAME \`--rozie-combobox-width\` token \`.rozie-combobox\`
     itself uses, so the rendered pixel width is IDENTICAL to before this change
     in the default (non-inline) case. \`.rozie-combobox--inline
     .rozie-combobox-input\` below restores \`100%\` for the inline pass-through
     path, where \`.rozie-combobox\` itself stretches to its container (unaffected
     by this fix — \`disablePositioning\` skips anchor measurement entirely there). */
  width: var(--rozie-combobox-width, 16rem);
  padding: var(--rozie-combobox-input-padding, 0.5rem 0.75rem);
  font: inherit;
  color: var(--rozie-combobox-color, inherit);
  background: var(--rozie-combobox-bg, #fff);
  border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-border-color, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-combobox-radius, 0.5rem);
  /*
    Render-neutral bottom-divider token (260715-50l finding 3). A longhand
    AFTER the \`border:\` shorthand above so it wins on the bottom side; the
    fallback REPLICATES the shorthand's own bottom (border-width solid
    border-color) so default rendering is byte-for-render unchanged. Lets a
    consumer (e.g. command-palette) render a borderless-with-underline input
    without touching the other three sides.
  */
  border-bottom: var(--rozie-combobox-input-underline, var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-border-color, rgba(0, 0, 0, 0.25)));
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.rozie-combobox-input[data-rozie-s-9546115a]:focus {
  /* Decoupled from --rozie-combobox-accent (finding 3) so a consumer can */
  /* neutralize the focus BORDER without touching the selected-option accent. */
  border-color: var(--rozie-combobox-focus-border-color, var(--rozie-combobox-accent, #0066cc));
  box-shadow: 0 0 0 var(--rozie-combobox-focus-ring-width, 3px) var(--rozie-combobox-focus-ring-color, rgba(0, 102, 204, 0.25));
  /*
    Same underline token, focus-colored fallback — the longhand keeps
    WINNING on the bottom side over the :focus border-color override above,
    so a consumer-set divider survives both blurred and focused states.
  */
  border-bottom: var(--rozie-combobox-input-underline, var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-focus-border-color, var(--rozie-combobox-accent, #0066cc)));
}
.rozie-combobox--disabled[data-rozie-s-9546115a] .rozie-combobox-input[data-rozie-s-9546115a] {
  cursor: not-allowed;
  opacity: var(--rozie-combobox-disabled-opacity, 0.55);
  background: var(--rozie-combobox-disabled-bg, rgba(0, 0, 0, 0.04));
}
.rozie-combobox-list[data-rozie-s-9546115a] {
  margin: 0;
  padding: var(--rozie-combobox-list-padding, 0.25rem);
  list-style: none;
  max-height: var(--rozie-combobox-list-max-height, 16rem);
  overflow-y: auto;
  background: var(--rozie-combobox-list-bg, #fff);
  border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-list-border-color, rgba(0, 0, 0, 0.15));
  border-radius: var(--rozie-combobox-radius, 0.5rem);
  box-shadow: var(--rozie-combobox-list-shadow, 0 10px 24px rgba(0, 0, 0, 0.16));
}
.rozie-combobox-option[data-rozie-s-9546115a] {
  padding: var(--rozie-combobox-option-padding, 0.4rem 0.6rem);
  border-radius: var(--rozie-combobox-option-radius, 0.375rem);
  cursor: pointer;
  color: var(--rozie-combobox-option-color, inherit);
}
.rozie-combobox-option--active[data-rozie-s-9546115a] {
  background: var(--rozie-combobox-option-active-bg, rgba(0, 102, 204, 0.12));
}
.rozie-combobox-option--selected[data-rozie-s-9546115a] {
  font-weight: var(--rozie-combobox-option-selected-weight, 600);
  color: var(--rozie-combobox-option-selected-color, var(--rozie-combobox-accent, #0066cc));
}
.rozie-combobox-option--disabled[data-rozie-s-9546115a] {
  cursor: not-allowed;
  opacity: var(--rozie-combobox-option-disabled-opacity, 0.45);
}
.rozie-combobox-empty[data-rozie-s-9546115a] {
  padding: var(--rozie-combobox-empty-padding, 0.5rem 0.6rem);
  color: var(--rozie-combobox-empty-color, rgba(0, 0, 0, 0.5));
  list-style: none;
}
.rozie-combobox-group[data-rozie-s-9546115a] {
  list-style: none;
}
.rozie-combobox-group-heading[data-rozie-s-9546115a] {
  /* Render-neutral section-separation token (260715-50l finding 4) — default */
  /* 0 = unchanged; a consumer-set value separates the leading ungrouped */
  /* block from the first group heading. */
  margin-top: var(--rozie-combobox-group-heading-margin-top, 0);
  padding: var(--rozie-combobox-group-heading-padding, 0.35rem 0.6rem 0.15rem);
  font-size: var(--rozie-combobox-group-heading-size, 0.75rem);
  font-weight: var(--rozie-combobox-group-heading-weight, 600);
  text-transform: var(--rozie-combobox-group-heading-transform, uppercase);
  letter-spacing: var(--rozie-combobox-group-heading-letter-spacing, 0.03em);
  color: var(--rozie-combobox-group-heading-color, rgba(0, 0, 0, 0.5));
  pointer-events: none;
  user-select: none;
}
.rozie-combobox-more[data-rozie-s-9546115a] {
  cursor: pointer;
  color: var(--rozie-combobox-more-color, rgba(0, 0, 0, 0.55));
  font-size: var(--rozie-combobox-more-size, 0.875rem);
}
.rozie-combobox-create[data-rozie-s-9546115a] {
  cursor: pointer;
  color: var(--rozie-combobox-create-color, var(--rozie-combobox-accent, #0066cc));
  background: var(--rozie-combobox-create-bg, transparent);
}
.rozie-combobox-spacer[data-rozie-s-9546115a] { margin: 0; padding: 0; border: 0; list-style: none; }
.rozie-combobox-chips[data-rozie-s-9546115a] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rozie-combobox-chip-gap, 0.4rem);
  padding: var(--rozie-combobox-chips-padding, 0.35rem 0.45rem 0 0.45rem);
  margin: 0;
  list-style: none;
}
.rozie-combobox-chip[data-rozie-s-9546115a] {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: var(--rozie-combobox-chip-padding, 0.15rem 0.5rem);
  font-size: var(--rozie-combobox-chip-size, 0.85rem);
  color: var(--rozie-combobox-chip-color, inherit);
  background: var(--rozie-combobox-chip-bg, rgba(0, 102, 204, 0.12));
  border-radius: var(--rozie-combobox-chip-radius, 0.375rem);
  white-space: nowrap;
}
.rozie-combobox-chip__remove[data-rozie-s-9546115a] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rozie-combobox-chip-remove-size, 1.1rem);
  height: var(--rozie-combobox-chip-remove-size, 1.1rem);
  padding: 0;
  font: inherit;
  line-height: 1;
  color: var(--rozie-combobox-chip-remove-color, currentColor);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: color 0.15s;
}
.rozie-combobox-chip__remove[data-rozie-s-9546115a]:hover:not([data-rozie-s-9546115a]:disabled) {
  color: var(--rozie-combobox-chip-remove-hover-color, var(--rozie-combobox-accent, #0066cc));
}
.rozie-combobox-chip__remove[data-rozie-s-9546115a]:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-combobox-option-disabled-opacity, 0.45);
}
.rozie-combobox--inline[data-rozie-s-9546115a] {
  display: block;
  width: 100%;
}
.rozie-combobox--inline[data-rozie-s-9546115a] .rozie-combobox-list[data-rozie-s-9546115a] {
  /* \`position: static\` dropped (plan 86-03): \`.rozie-combobox-list\` carries no
     absolute positioning to undo anymore — that geometry lives on popover's
     \`.rozie-popover-floating\`, and \`:disable-positioning="$props.inline"\`
     (D-09) already renders it as a static pass-through via popover's own
     \`.rozie-popover-floating--static\` rule. */
  margin-top: var(--rozie-combobox-list-gap, 0.25rem);
  border: none;
  border-radius: 0;
  box-shadow: none;
}
.rozie-combobox--inline[data-rozie-s-9546115a] .rozie-combobox-input[data-rozie-s-9546115a] {
  width: 100%;
}`);

interface ChipSlotCtx { option: any; remove: any; index: any; }

interface OptionSlotCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptySlotCtx { query: any; }

interface CreateSlotCtx { query: any; }

interface GroupHeadingSlotCtx { group: any; }

interface GroupMoreSlotCtx { group: any; hidden: any; expand: any; }

interface ComboboxProps {
  /**
   * The selected option's value (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a combobox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `null` when nothing is selected.
   * @example
   * <Combobox value={country()} onValueChange={setCountry} options={countries} />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (value: (unknown) | null) => void;
  /**
   * The option list — `[{ value, label, disabled?, group? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, an optional `disabled` flag makes an option non-selectable, and an optional `group` string buckets the option under a matching entry of the `groups` prop (or a first-appearance fallback section) when grouping is active.
   */
  options?: any[];
  /**
   * Placeholder text shown in the input while it is empty.
   */
  placeholder?: string;
  /**
   * Disable the control — the input becomes non-interactive and the popup cannot be opened. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Opt **out** of built-in client filtering (async / server-side mode): render `options` exactly as supplied and rely on the `search` event to refetch. By default the component filters `options` by `label`, case-insensitively, against the typed query.
   */
  disableFilter?: boolean;
  /**
   * Accessible name for the input (`aria-label`), used when there is no visible `<label for>` pointing at it. Provide this (or an external label) so the combobox is announced.
   */
  ariaLabel?: (string) | null;
  /**
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one combobox shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the combobox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  inline?: boolean;
  /**
   * Close the popup after a selection commits. Unset (default) resolves through `effectiveCloseOnSelect()`: `true` in single-select (today's default behavior) and `false` in `multiple` mode, where closing after every chip pick would make multi-select unusable. Pass an explicit `true` or `false` to override in either mode.
   */
  closeOnSelect?: (boolean) | null;
  /**
   * `value` widens to hold an **array** of selected values and remains the sole `model: true` prop, so the Angular `ControlValueAccessor` is preserved (a second model would forfeit it — `ROZ125`). Re-selecting an already-selected option toggles it off. Default `false` is byte-identical to single-select.
   */
  multiple?: boolean;
  /**
   * When the user commits text matching no option (case-insensitive, trimmed, exact label equality — no Unicode normalization applied), combobox emits `create` with the query and writes NOTHING to `value` — the consumer adds the option to `options` and updates the model itself. Composes with `multiple`. Turning this on replaces the `#empty` fill with the `#create` row whenever the query is creatable (non-empty, no exact match); `#empty` still renders for an empty or whitespace-only query. Default `false` is byte-identical to today.
   */
  creatable?: boolean;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  optionLabel?: ((...args: any[]) => any) | null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue?: ((...args: any[]) => any) | null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled?: ((...args: any[]) => any) | null;
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling popup (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed combobox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
   */
  virtual?: boolean;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS length string bounding the popup scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-combobox-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  maxHeight?: string;
  /**
   * Ordered section list `[{ id, label }]` setting group order + heading text. Options are partitioned by their optional `group?` string; groups present on options but absent here fall back to first-appearance order after the listed ones. Empty/absent ⇒ flat, ungrouped rendering (default).
   */
  groups?: any[];
  /**
   * Cap each native section group to its first `groupCap` results, adding a keyboard-reachable '+N more' row that expands that group IN PLACE when activated. `0`/absent = uncapped (default). Only applies to the non-virtual grouped render (`groups` non-empty); ignored when `virtual` is on.
   */
  groupCap?: number;
  /**
   * Floating UI placement of the popup relative to the control, forwarded to the composed `@rozie-ui/popover` leaf — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end`. Default `"bottom-start"` matches the pre-Phase-86 static popup alignment (flush with the control's left edge). Ignored when `inline` is set.
   */
  placement?: string;
  /**
   * Gap in pixels between the control and the popup, forwarded to the composed `@rozie-ui/popover` leaf. Default `4` preserves the pre-Phase-86 resting gap (`--rozie-combobox-list-gap`). Ignored when `inline` is set.
   */
  offset?: number;
  /**
   * Disable the popup's Floating UI `flip` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup flips above the control when it would overflow the viewport below; set this to keep it pinned to `placement` regardless. Ignored when `inline` is set.
   */
  disableFlip?: boolean;
  /**
   * Disable the popup's Floating UI `shift` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup shifts to stay within the viewport; set this to keep it strictly aligned to the control. Ignored when `inline` is set.
   */
  disableShift?: boolean;
  onCreate?: (...args: unknown[]) => void;
  onChange?: (...args: unknown[]) => void;
  onSearch?: (...args: unknown[]) => void;
  chipSlot?: (ctx: ChipSlotCtx) => JSX.Element;
  optionSlot?: (ctx: OptionSlotCtx) => JSX.Element;
  emptySlot?: (ctx: EmptySlotCtx) => JSX.Element;
  createSlot?: (ctx: CreateSlotCtx) => JSX.Element;
  groupHeadingSlot?: (ctx: GroupHeadingSlotCtx) => JSX.Element;
  groupMoreSlot?: (ctx: GroupMoreSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: ComboboxHandle) => void;
}

export interface ComboboxHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  seedQuery: (...args: any[]) => any;
  pinOpen: (...args: any[]) => any;
}

export default function Combobox(_props: ComboboxProps): JSX.Element {
  const _merged = mergeProps({ options: (() => [])() as any[], placeholder: '', disabled: false, disableFilter: false, ariaLabel: null, idBase: 'rozie-combobox', inline: false, closeOnSelect: null, multiple: false, creatable: false, optionLabel: null, optionValue: null, optionDisabled: null, virtual: false, estimateRowHeight: 36, maxHeight: '', groups: (() => [])() as any[], groupCap: 0, placement: 'bottom-start', offset: 4, disableFlip: false, disableShift: false }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'options', 'placeholder', 'disabled', 'disableFilter', 'ariaLabel', 'idBase', 'inline', 'closeOnSelect', 'multiple', 'creatable', 'optionLabel', 'optionValue', 'optionDisabled', 'virtual', 'estimateRowHeight', 'maxHeight', 'groups', 'groupCap', 'placement', 'offset', 'disableFlip', 'disableShift', 'ref', 'onCreate', 'onChange', 'onSearch']);
  onMount(() => { local.ref?.({ focus, clear, seedQuery, pinOpen }); });

  const [value, setValue] = createControllableSignal<unknown>(_props as unknown as Record<string, unknown>, 'value', null);
  const [query, setQuery] = createSignal('');
  const [isOpen, setIsOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [rows, setRows] = createSignal<any[]>([]);
  const [windowVer, setWindowVer] = createSignal(0);
  const [editVer, setEditVer] = createSignal(0);
  const [expandedGroups, setExpandedGroups] = createSignal<Record<string, any>>({});
  const [createdQuery, setCreatedQuery] = createSignal<any>(null);
  const [pinned, setPinned] = createSignal(false);
  onMount(() => {
    syncQueryToValue();
    syncRows();
    didMount = true;
    // Routes through the SAME buildVirtualizer() the virtual $watch calls below
    // (VIRT-BUILD) — one construction site, so the mount path cannot drift from the flip
    // path.
    if (local.virtual) buildVirtualizer();
  });
  onCleanup(() => {
    if (virtualizerCleanup) virtualizerCleanup();
  });
  createEffect(on(() => (() => value())(), (v) => untrack(() => (() => {
    syncQueryToValue();
  })()), { defer: true }));
  createEffect(on(() => (() => (local.options ? local.options.length : 0) + '|' + query())(), (v) => untrack(() => (() => {
    if (expandedGroups() && Object.keys(expandedGroups()).length) setExpandedGroups({});
    syncRows();
    if (local.virtual && virtualizer) {
      virtualizer.setOptions(virtualizerOptions());
      virtualizer._willUpdate();
      setWindowVer(windowVer() + 1);
      scheduleRemeasure();
    }
  })()), { defer: true }));
  createEffect(on(() => (() => local.virtual)(), (v) => untrack(() => (() => {
    if (expandedGroups() && Object.keys(expandedGroups()).length) setExpandedGroups({});
    if (local.virtual) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => buildVirtualizer());else setTimeout(() => buildVirtualizer(), 0);
    } else {
      teardownVirtualizer();
    }
  })()), { defer: true }));
  let inputElRef: HTMLElement | null = null;
  let __rozieRootRef: HTMLElement | null = null;

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
  //   - `focusControl()` / `scrollActiveIntoView()` — impure ref-reading functions (they touch the
  //     control / list ref elements, which are post-mount-only per ROZ123), so they are per-consumer
  //     HOST functions; this partial only closes over them (it reads NO refs itself).
  //   - the option set + form surface (`$props.options` / `$props.value` (model) / `$props.multiple` /
  //     `$props.id` / `$props.optionLabel` / `$props.optionValue` / `$props.optionDisabled` /
  //     `$props.closeOnSelect` / `$props.disabled`) and the reactive state (`$data.open` /
  //     `$data.activeIndex` / `$data.query`). Input-mode is by convention (the host's <input> writing
  //     `$data.query`), NOT a discriminant prop.

  // ---- option resolvers --------------------------------------------------
  function labelOf(opt: any) {
    if (local.optionLabel !== null) return local.optionLabel(opt);
    if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
    return String(opt);
  }
  function valueOf(opt: any) {
    if (local.optionValue !== null) return local.optionValue(opt);
    if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
    return opt;
  }
  function disabledOf(opt: any) {
    if (local.optionDisabled !== null) return !!local.optionDisabled(opt);
    if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
    return false;
  }

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
  //
  // AXIS MECHANISM (OQ1 / Assumption A1 — resolved from the installed source this session, NOT
  // implemented yet; this plan documents the contract only, the second instance lands starting 87-04):
  // `horizontal` is a PER-INSTANCE field of `VirtualizerOptions`
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

  // getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
  // React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
  // id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
  function virtualItemKey(i: any) {
    const src = windowSource();
    return src && src[i] ? src[i].id : undefined;
  }

  // COL_OVERSCAN (D-07): the column axis's own hardcoded overscan constant, separate from the
  // row axis's `overscan: 8` below. Columns are far wider than rows are tall, so one number
  // cannot serve both axes; no prop is exposed because no consumer has asked to tune the row
  // overscan across the four phases it has shipped. Unused until 87-04 constructs the second,
  // horizontal Virtualizer instance (see the AXIS MECHANISM note above).

  // The FULL virtualizer options. virtual-core's setOptions REPLACES options with
  // `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
  // source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
  // Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
  // on virtual-core's generic option inference. onChange uses the `$data.x = $data.x + 1`
  // increment the React emitter lowers to functional setState — correct even from a mount closure.
  function virtualizerOptions(): any {
    return {
      count: windowSource().length,
      getScrollElement: () => gridScrollEl,
      estimateSize: () => local.estimateRowHeight,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      measureElement,
      overscan: 8,
      getItemKey: virtualItemKey,
      onChange: () => {
        setWindowVer(windowVer() + 1);
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
        scheduleRemeasure();
      }
    };
  }

  // pinMeasurement(pin): the D-05 pin-hook read, RE-TYPED at the windowing layer so the
  // shared math is strict-clean across every host. The host-provided pinnedMeasurement() has
  // two shapes: the DataTable host returns a real virtual-core measurement; the listbox/combobox
  // no-op host returns bare `null` (inferred `(pin) => null`). Calling it directly makes
  // `const pm = pinnedMeasurement(pin)` flow-narrow to `null`, so the downstream `pm && pm.start`
  // guard collapses the object branch to `never` (TS2339, Class 3). Reading the hook through this
  // thin wrapper with an EXPLICIT return type (a return-type annotation is NOT flow-narrowed)
  // gives the measurement a real object-or-null shape, so `pm && pm.start` keeps the object branch.
  // Typing-only: the runtime value (a measurement or null) is unchanged.
  function pinMeasurement(pin: number): {
    start: number;
    size: number;
    index: number;
    end: number;
  } | null {
    return pinnedMeasurement(pin);
  }

  // windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
  // { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
  // $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
  // full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
  // `rows` binding → TS2448 self-shadow, line ~1149 lesson).
  function windowedRows() {
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
    void windowVer();
    void editVer();
    if (!virtualizer) {
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
      if (!rowsWindowed()) {
        const rowList = rows() || [];
        return rowList.map((r: any, i: any) => ({
          vi: {
            index: i
          },
          row: r
        }));
      }
      return [];
    }
    const items = virtualizer.getVirtualItems();
    const rowList = rows() || [];
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
    const pin = pinnedEditIndex();
    if (pin >= 0 && rowList[pin]) {
      let inWindow = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].index === pin) {
          inWindow = true;
          break;
        }
      }
      if (!inWindow) {
        const pm = pinMeasurement(pin);
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
  }

  // Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
  // the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
  // (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
  function padTop() {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void windowVer();
    void editVer();
    if (!rowsWindowed() || !virtualizer) return 0;
    const items = virtualizer.getVirtualItems();
    let pad = items.length ? items[0].start : 0;
    // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
    // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
    // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
      if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
    }
    return pad < 0 ? 0 : pad;
  }
  function padBottom() {
    // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
    // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
    // on pin/unpin.
    void windowVer();
    void editVer();
    if (!rowsWindowed() || !virtualizer) return 0;
    const items = virtualizer.getVirtualItems();
    if (!items.length) return 0;
    let pad = virtualizer.getTotalSize() - items[items.length - 1].end;
    // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
    // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
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
  }
  // pmIndexInWindow: is full-model index `idx` present in the rendered virtual window?
  function pmIndexInWindow(items: any, idx: any) {
    for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
    return false;
  }
  // rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
  // window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
  function rowIsOutsideWindow(r: any) {
    if (!rowsWindowed() || !virtualizer) return false;
    const items = virtualizer.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
  }
  // Windowing instance state (reassigned module-`let`s → React hoists to useRef; do NOT
  // const). NULL until $onMount, ONLY constructed when $props.virtual. gridScrollEl is the
  // captured .rozie-combobox-list scroll div; remeasurePending dedupes the deferred sweep.
  let virtualizer: any = null;
  let virtualizerCleanup: any = null;
  let gridScrollEl: any = null;
  let remeasurePending = false;
  // D-05/D-10/D-18 host-contract COLUMN-axis instance state (Phase 87 87-02) — INERT: Combobox has
  // no column axis (colsWindowed() below is constantly false), so this is never constructed. Exists
  // only so the windowing.rzts host contract's `colVirtualizer` symbol resolves, mirroring `let
  // virtualizer = null` above.
  let colVirtualizer: any = null;
  // Non-reactive per-instance flag (Phase 86 R2, plan 86-03, Solid-only): true for
  // the duration of an onFocus-triggered open transition (set before the isOpen
  // write, cleared in the deferred microtask after). Lets onBlur distinguish a
  // blur caused by Solid recreating the anchor's DOM mid-open (skip closing) from
  // a genuine user-initiated blur (close normally). See onFocus/onBlur below.
  let openingInProgress = false;
  // Non-reactive per-instance flag (combobox-virtual-reactivity phase): set true once
  // $onMount has run; read by windowedView() below so the blank-frame fallback (D-4) only
  // fires on a genuine RUNTIME flip — a virtual:true-at-mount (never-flipped) consumer's
  // first paint stays byte-stable (windowedRows()'s own pre-mount `[]` still applies before
  // didMount flips true). Mirrors the same write-in-$onMount/read-elsewhere holder class.
  let didMount = false;

  // ---- derived view (plain functions, uniform ×6) ------------------------
  // The filtered option list, each carrying its filtered-list index `_i`, a stable
  // windowing key `id`, and the RAW source option (`option`) so `@change` + the
  // `#option` slot expose the original object (CP reads `e.option.id` / `option.group`).
  //
  // REFERENCE-KEYED MEMO, NOT $computed — this is load-bearing for windowed perf. TanStack
  // virtual-core calls getItemKey(i)/getMeasurements O(count) times per pass, and windowSource()
  // (below) aliases this, so without a memo every scroll re-`.map()`s ALL options into fresh
  // wrapper objects — O(N²). On vue each wrapper read trips a reactive Proxy trap (valueOf/labelOf/
  // disabledOf), so a 60-ArrowDown batch over 1,000 options cost ~16s. It is deliberately NOT a
  // $computed: a $computed would re-SUBSCRIBE to the reactive `options` Proxy and re-run on
  // unrelated reactive churn (and on vue re-trip the Proxy traps); the whole point is to AVOID
  // re-mapping when only activeIndex changed. The cache key is pure VALUE/REFERENCE comparison
  // (no reactive subscription), so it adds zero reactivity churn — it collapses virtual-core's
  // O(count) re-maps to ONE map per real (options-ref / query / disableFilter) change.
  //
  // Quick 260717-8zb dogfood: re-expressed on the `$memo(fn, keyFn)` primitive.
  // `$memo` lowers (core, shared across all 6 targets) to a member-mutated
  // fresh-object cache const + a wrapper function — EXACTLY this foCache shape,
  // generalized. On React the emitted cache const is stabilized to
  // `useMemo(() => ({…}), [])` by the EXISTING collectMutatedInstanceBinders/
  // tryWrapMutatedInstanceUseMemo machinery (feedback_react_const_mutinstance_
  // not_stabilized) — no per-target $memo code. On the 5 setup-once targets the
  // top-level consts persist for the instance lifetime naturally.
  //
  // keyFn is the SUBSCRIBE-FIRST half (fine-grained Solid <For> / Svelte
  // {#each}): it reads ALL FOUR reactive inputs UNCONDITIONALLY — $data.query
  // even when disableFilter is true (mirrors windowing.rzts windowedRows
  // void-touch discipline) and $props.groups even when $props.virtual (so a
  // groups change while windowed still invalidates the cache once virtual
  // toggles off) — evaluated BEFORE $memo's cache-hit check, so the r-for
  // accessor subscribes to them on every eval. Deliberately NOT a $computed: a
  // $computed would re-SUBSCRIBE to the reactive `options` Proxy and re-run on
  // unrelated reactive churn (and on Vue re-trip the Proxy traps); the whole
  // point is to AVOID re-mapping when only activeIndex changed. The cache key
  // is pure VALUE/REFERENCE comparison (no reactive subscription), so it adds
  // zero reactivity churn — it collapses virtual-core's O(count) re-maps to ONE
  // map per real (options-ref / query / disableFilter / groups-ref) change.
  //
  // fn is the MISS path (unchanged from the hand-rolled foCache): run the
  // filter, then (native option grouping, combobox-native-groups) a
  // NON-VIRTUAL-ONLY stable re-partition into group-visual order, then map to
  // wrapper rows.
  const filteredOptionsCache = {
    keys: null as any[] | null,
    val: null as any
  };
  function filteredOptions() {
    const __rozieMemoKey = (() => {
      const opts = Array.isArray(local.options) ? local.options : [];
      const df = !!local.disableFilter;
      const q = String(query() == null ? '' : query());
      const groupsProp = local.groups;
      return [opts, q, df, groupsProp];
    })();
    const __rozieMemoPrev = filteredOptionsCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return filteredOptionsCache.val;
    }
    const __rozieMemoVal = (() => {
      const opts = Array.isArray(local.options) ? local.options : [];
      const df = !!local.disableFilter;
      const q = String(query() == null ? '' : query());
      const groupsProp = local.groups;
      let list = opts;
      if (!df) {
        const ql = q.toLowerCase();
        if (ql) list = opts.filter((o: any) => String(labelOf(o)).toLowerCase().indexOf(ql) !== -1);
      }
      // Gated to !$props.virtual (groups×virtual is deferred/unsupported per design) AND to
      // $props.groups being a NON-EMPTY array — an explicit author opt-in. This is deliberately
      // NOT just "!$props.virtual" (groupOptions() would otherwise also fire whenever any raw
      // option happens to carry a `.group` field, even with `groups` absent — a real collision
      // discovered against command-palette's CommandItem.group, which is a PRE-EXISTING,
      // unrelated per-row-badge field, not an opt-in to combobox's native grouping. The design's
      // "Empty/absent `groups` ⇒ today's flat behavior, byte-identical" contract is about the
      // `groups` PROP only — never inferred from incidental option shape.
      if (!local.virtual && Array.isArray(groupsProp) && groupsProp.length > 0) {
        const partition = groupOptions(list, groupsProp, (o: any) => o && o.group != null ? String(o.group) : null);
        list = partition.ordered;
      }
      // `_i` is assigned over the (now group-ordered) list, so the flat keyboard model
      // (activeIndex/aria-activedescendant/nextEnabled) walks visual order unchanged.
      // `group` carries the wrapper's normalized group id for groupBlocks() below.
      return list.map((o: any, i: any) => ({
        value: valueOf(o),
        label: labelOf(o),
        disabled: disabledOf(o),
        _i: i,
        id: valueOf(o),
        option: o,
        group: o && o.group != null ? String(o.group) : null
      }));
    })();
    filteredOptionsCache.keys = __rozieMemoKey;
    filteredOptionsCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  }
  // windowSource(): the windowing.rzts host-contract row source — the FILTERED option
  // list (the same wrapper rows the template iterates). Kept === $data.rows so the math's
  // rowList[vi.index] resolves to the same wrapper the count windows over.
  function windowSource() {
    return filteredOptions();
  }

  // windowedView() (combobox-virtual-reactivity, VIRT-FALLBACK): the combobox-side
  // blank-frame fallback for the mid-flip frame. While `virtual` is on but the virtualizer
  // has not yet (re)attached (didMount-gated, so the never-flipped virtual:true-at-mount
  // first paint is untouched — windowedRows()'s own pre-mount `[]` still governs it),
  // render the UN-WINDOWED full windowSource() slice mapped to the `{ vi: { index }, row }`
  // shape the windowed template consumes (`wr.vi.index` resolves to the wrapper's own `_i`,
  // since windowSource() IS the filtered/indexed list navRows()/activeIndex already walk).
  // Once the virtualizer is built, delegates to windowedRows() UNCHANGED — byte-identical
  // to today's steady windowed state. Entirely combobox-side: @rozie-ui/headless-core/
  // windowing.rzts is untouched, preserving data-table's B13 A==B byte-identity + its
  // empty-diff regen.
  function windowedView() {
    // SUBSCRIBE FIRST (fine-grained Solid <For> / Svelte {#each}) — touch windowVer at the
    // TOP, mirroring windowedRows()'s own subscribe-first discipline (windowing.rzts), so
    // the accessor re-runs when buildVirtualizer()/kickWindow() bump windowVer once the
    // virtualizer attaches — the transition OUT of this fallback and into windowedRows().
    void windowVer();
    if (local.virtual && !virtualizer && didMount) {
      return windowSource().map((row: any) => ({
        vi: {
          index: row._i
        },
        row
      }));
    }
    return windowedRows();
  }

  // ---- native option grouping render helpers (combobox-native-groups) ---------------
  // groupBlocks(): re-partition the ALREADY group-ordered filteredOptions() wrappers into
  // CONTIGUOUS runs by wrapper.group (trivial + guarantees `_i` alignment, since `ordered`
  // from groupOptions() is already group-contiguous). Attaches each run's `{ id, label }`
  // from $props.groups (fallback label = the group id itself). Plain function — never
  // $computed (mirrors filteredOptions()'s convention). Non-virtual only (isGrouped() below
  // already gates the template branch that calls this).
  function groupBlocks() {
    const wrappers = filteredOptions();
    const groupsProp = Array.isArray(local.groups) ? local.groups : [];
    const labelFor = (gid: any) => {
      const found = groupsProp.find((g: any) => g && g.id === gid);
      return found ? found.label : gid;
    };
    const blocks = [];
    let lastGid;
    for (let i = 0; i < wrappers.length; i++) {
      const w = wrappers[i];
      if (i === 0 || w.group !== lastGid) {
        blocks.push({
          group: w.group == null ? null : {
            id: w.group,
            label: labelFor(w.group)
          },
          items: [w]
        });
      } else {
        blocks[blocks.length - 1].items.push(w);
      }
      lastGid = w.group;
    }
    return blocks;
  }

  // isGrouped(): the grouped-vs-flat template branch selector. Grouping is active
  // (non-virtual only) SOLELY when the author explicitly set a non-empty `groups` prop —
  // deliberately NOT "OR any option carries a group" (a real collision discovered against
  // command-palette's pre-existing CommandItem.group per-row-badge field; see the
  // filteredOptions() comment above). Mirrors that same non-empty-`groups` gate exactly, so
  // isGrouped() and the filteredOptions() partition never disagree about which branch is active.
  function isGrouped() {
    return !local.virtual && Array.isArray(local.groups) && local.groups.length > 0;
  }

  // ---- per-group result cap + expand-in-place "+N more" (combobox-group-cap) --------
  // capNum(): coerce $props.groupCap to a whole, positive cap; anything else (NaN,
  // negative, absent) degrades to 0 (uncapped). Plain function — never $computed.
  function capNum() {
    const n = Number(local.groupCap);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  // isCapped(): the capped-render branch selector. isGrouped() already gates non-
  // virtual + non-empty `groups`, so the cap is automatically gated OUT of the
  // virtual and ungrouped paths.
  function isCapped() {
    return isGrouped() && capNum() > 0;
  }

  // gkey(gid): normalize a group id (possibly null, for the leading ungrouped
  // section) into an expandedGroups map key.
  function gkey(gid: any) {
    return gid == null ? '__ungrouped__' : String(gid);
  }

  // isExpanded(gid): whether the group has been expanded via its "+N more" row.
  function isExpanded(gid: any) {
    return !!(expandedGroups() && expandedGroups()[gkey(gid)]);
  }

  // expandGroup(gid): replace $data.expandedGroups IMMUTABLY (load-bearing for
  // React re-render — feedback_react_const_mutinstance_not_stabilized / the
  // graph-writeback immutability rule).
  function expandGroup(gid: any) {
    setExpandedGroups(Object.assign({}, expandedGroups(), {
      [gkey(gid)]: true
    }));
  }

  // cappedBlocks(): the visible-block model for the capped render — groupBlocks()
  // re-sliced to `capNum()` per group (unless expanded or non-overflowing), with a
  // trailing "+N more" row appended to any still-capped block. Re-indexes `_i` as a
  // running counter over the WHOLE visible+more sequence so option ids/aria-
  // activedescendant stay contiguous and never disagree with navRows() below.
  function cappedBlocks() {
    const blocks = groupBlocks();
    const cap = capNum();
    let running = 0;
    const out = [];
    for (let bi = 0; bi < blocks.length; bi++) {
      const blk = blocks[bi];
      const gid = blk.group ? blk.group.id : null;
      const showAll = isExpanded(gid) || blk.items.length <= cap;
      const visibleSrc = showAll ? blk.items : blk.items.slice(0, cap);
      const items = [];
      for (let vi = 0; vi < visibleSrc.length; vi++) {
        items.push(Object.assign({}, visibleSrc[vi], {
          _i: running
        }));
        running++;
      }
      let more: any = null;
      if (!showAll) {
        more = {
          isMore: true,
          group: gid,
          hidden: blk.items.length - cap,
          disabled: false,
          _i: running,
          expand: () => expandGroup(gid)
        };
        running++;
      }
      out.push({
        group: blk.group,
        items,
        more
      });
    }
    return out;
  }

  // ---- creatable mode (Phase 86 R3, D-17..D-20) ---------------------------
  // normalizedQuery(): trimmed + lower-cased query — reuses the SAME case-fold
  // filteredOptions() already applies above, but for an EXACT-EQUALITY
  // comparison, never a substring search, and with NO Unicode normalization
  // (R3 locked: a composition-form difference must NOT be treated as a match).
  function normalizedQuery() {
    return String(query() == null ? '' : query()).trim().toLowerCase();
  }

  // queryMatchesOption(nq): whether the (already-normalized) query is an exact,
  // case-insensitive, trimmed match of some option's label.
  function queryMatchesOption(nq: any) {
    const opts = Array.isArray(local.options) ? local.options : [];
    return opts.some((o: any) => String(labelOf(o)).trim().toLowerCase() === nq);
  }

  // isCreatableQuery(): the create-row visibility gate (also gates the `#empty`
  // -> `#create` swap, D-19). `creatable` must be set, the normalized query
  // must be non-empty (an empty/whitespace-only query never offers create —
  // `#empty` keeps its job there), and no option's normalized label may equal
  // it exactly.
  function isCreatableQuery() {
    if (!local.creatable) return false;
    const nq = normalizedQuery();
    if (!nq) return false;
    return !queryMatchesOption(nq);
  }

  // createRowAt(baseCount): the synthetic, non-option `role="option"` create
  // row (D-17) — mirrors the `groupMore` "+N more" row shape exactly (a real
  // id, arrow-reachable, commits through the SAME selectOption() dispatch
  // without writing the model). Each render branch passes ITS OWN flattened
  // pre-create-row row count (`baseCount`) as the running index, exactly as
  // `cappedBlocks()` already re-indexes `_i` across options + the more row —
  // so ids / aria-activedescendant / navRows() can never disagree.
  function createRowAt(baseCount: any) {
    return {
      isCreate: true,
      _i: baseCount,
      disabled: false
    };
  }

  // cappedRowCount(): the total navigable row count cappedBlocks() flattens to
  // (visible items + more-rows, across every block) — the running index the
  // capped branch's own create row (below) must continue from. Mirrors
  // cappedBlocks()'s own `running` counter without re-deriving `_i` per item.
  function cappedRowCount() {
    const blocks = cappedBlocks();
    let n = 0;
    for (let bi = 0; bi < blocks.length; bi++) {
      n += blocks[bi].items.length;
      if (blocks[bi].more) n++;
    }
    return n;
  }

  // navRows(): the SINGLE keyboard/aria source of truth. Returns the EXACT
  // filteredOptions() reference when not capped and not creatable (byte-
  // identical-off — untouched virtual/ungrouped keyboard path); flattens
  // cappedBlocks() into visible items + more-rows, in order, when capped.
  // Appends the create row, AFTER the full flattened visible(+more) sequence,
  // whenever isCreatableQuery() — R3's locked "renders last, after all options
  // and group sections" is a positional fact here, not a per-branch special case.
  function navRows() {
    if (!isCapped()) {
      const base = filteredOptions();
      if (!isCreatableQuery()) return base;
      return base.concat([createRowAt(base.length)]);
    }
    const out = [];
    const blocks = cappedBlocks();
    for (let bi = 0; bi < blocks.length; bi++) {
      const blk = blocks[bi];
      for (let ii = 0; ii < blk.items.length; ii++) out.push(blk.items[ii]);
      if (blk.more) out.push(blk.more);
    }
    if (isCreatableQuery()) out.push(createRowAt(out.length));
    return out;
  }

  // D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
  // A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
  // pinnedMeasurement() UNGUARDED by convention; a combobox has no edit-pinning, so these
  // reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
  // to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
  function pinnedEditIndex() {
    return -1;
  }
  function pinnedMeasurement(pin: any) {
    return null;
  }

  // D-05/D-10/D-18 windowing.rzts host-contract one-liners (Phase 87 87-02). rowsWindowed()
  // preserves today's EXACT truthiness (byte-behavior-identical) — it is the new REQUIRED symbol
  // windowing.rzts now calls in place of a bare `$props.virtual` read. The column-axis symbols are
  // INERT no-ops: Combobox never lights the column branch (D-20). columnSize/forcedColumns carry
  // explicit return-type annotations (the pinMeasurement() trick, windowing.rzts:65-74) so the
  // strict bundled-leaf tsc does not flow-narrow a no-op host's return to `never`.
  function rowsWindowed() {
    return !!local.virtual;
  }
  function colsWindowed() {
    return false;
  }
  function columnCount() {
    return 0;
  }
  function columnSize(i: number): number {
    return 0;
  }
  function forcedColumns(): number[] {
    return [];
  }

  // Keep $data.rows === windowSource() so the windowing math indexes the live filtered set.
  function syncRows() {
    setRows(windowSource());
  }

  // Defer remeasureWindow() until AFTER the framework commits the recycled window: TWO
  // passes (microtask THEN rAF) behind one in-flight flag (the data-table
  // virtualization.rzts pattern, copied per-consumer per D-04/D-09) — microtask catches
  // Solid's <For> / Svelte's {#each} synchronous commit (the Phase 63 Solid
  // under-convergence hazard — D-09 rAF-defer budget), rAF catches React's async commit.
  function scheduleRemeasure() {
    if (remeasurePending) return;
    remeasurePending = true;
    let ranMicro = false;
    const microPass = () => {
      remeasureWindow();
    };
    const rafPass = () => {
      remeasurePending = false;
      remeasureWindow();
    };
    if (typeof queueMicrotask !== 'undefined') {
      ranMicro = true;
      queueMicrotask(microPass);
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) remeasurePending = false;else setTimeout(rafPass, 0);
  }

  // measureElement sweep: hand every rendered windowed option to the virtualizer so its
  // true height is observed (virtual-core measures ONLY nodes passed to measureElement,
  // keyed by the data-index attribute). Bails during a programmatic scroll.
  function remeasureWindow() {
    if (!virtualizer || !gridScrollEl) return;
    if (virtualizer.scrollState) return;
    const els = gridScrollEl.querySelectorAll('.rozie-combobox-option[data-index]');
    for (const el of els as any) virtualizer.measureElement(el);
  }

  // Keep the active option visible inside the popup. When windowing, route through the
  // virtualizer (scrollToIndex) so an active option OUTSIDE the rendered window scrolls
  // into view (the windowed-arrow-nav seam). When NOT windowing, resolve the active
  // option element directly (a within-own-shadow query, Lit-safe) and scrollIntoView it
  // with 'nearest' block alignment — a plain long list taller than the popup's
  // max-height must also keep the active option visible during arrow navigation.
  function scrollActiveIntoView() {
    if (!local.virtual && isOpen() && activeIndex() >= 0) {
      const list = __rozieRootRef! ? __rozieRootRef!.querySelector('.rozie-combobox-list') : null;
      const opt = list ? list.querySelector('#' + optId(activeIndex())) : null;
      if (opt) opt.scrollIntoView({
        block: 'nearest'
      });
      return;
    }
    if (!local.virtual || !virtualizer || activeIndex() < 0) return;
    // 'center' (not 'auto'): keep the active option well inside the rendered slice — 'auto'
    // lands it at the viewport edge where the overscan band can leave it just-unrendered for
    // a frame on the fine-grained targets (Solid).
    virtualizer.scrollToIndex(activeIndex(), {
      align: 'center'
    });
    scheduleRemeasure();
  }
  function optId(i: any) {
    return local.idBase + '-opt-' + i;
  }
  function listId() {
    return local.idBase + '-list';
  }

  // The active option's id for aria-activedescendant (null when none).
  function activeId() {
    const list = navRows();
    if (isOpen() && activeIndex() >= 0 && list[activeIndex()]) return optId(activeIndex());
    return null;
  }

  // Next selectable index in `dir` (+1/-1), skipping disabled, clamped to ends.
  function nextEnabled(list: any, from: any, dir: any) {
    let i = from;
    for (let step = 0; step < list.length; step++) {
      i = i + dir;
      if (i < 0) i = 0;
      if (i >= list.length) i = list.length - 1;
      if (list[i] && !list[i].disabled) return i;
      if (dir < 0 && i === 0 || dir > 0 && i === list.length - 1) break;
    }
    return from;
  }

  // ---- multi-select membership + effective-default helpers (Phase 86 R1) -----
  // Ported from @rozie-ui/headless-core/listCore.rzts's select()/isSelected()
  // algorithm (also shipped, verbatim, via @rozie-ui/listbox) — PORTED, not
  // imported: combobox's own open/active/query state machine is deliberately
  // host-local (see the header comment above), and listCore.rzts is also
  // consumed by the release-ignored listbox family, so pulling this into the
  // shared partial would put listbox's frozen leaves back in scope.
  //
  // selectedValues(): the current selection as a de-duplicated array, tolerant
  // of a null/undefined model. De-duplicates the MODEL array itself (not just
  // `options`) so a re-normalized selection never reports the same value twice
  // even if the model ever ends up holding a duplicate.
  function selectedValues() {
    const cur = value();
    const arr = Array.isArray(cur) ? cur : [];
    return Array.from(new Set(arr));
  }

  // isRowSelected(row): array membership under `multiple`, strict equality
  // otherwise. Replaces every raw `opt.value === $props.value` / `wr.row.value
  // === $props.value` template comparison (task 2) so all four render branches
  // share exactly ONE membership check and can never disagree.
  function isRowSelected(row: any) {
    if (!row) return false;
    if (local.multiple) return selectedValues().indexOf(row.value) !== -1;
    return row.value === value();
  }

  // effectiveCloseOnSelect(): resolves the `closeOnSelect` sentinel (see the
  // prop's own doc comment above for why the prop's default is `null`, not a
  // literal `true`). Unset ⇒ `true` in single-select (today's default,
  // unchanged), `false` under `multiple`; an explicit `true`/`false` from the
  // consumer always wins in either mode. Every existing `closeOnSelect` read
  // routes through this helper so the four render branches cannot disagree.
  function effectiveCloseOnSelect() {
    const v = local.closeOnSelect;
    if (v === true || v === false) return v;
    return !local.multiple;
  }

  // ---- chip rail (Phase 86 R1, plan 86-05, D-13/D-16/D-18) ---------------
  // chipRows(): selectedValues() (already de-duplicated — see above) mapped to
  // chip-rail display rows. Each row carries the raw source `option` when it is
  // still present in `options` (mirroring how filteredOptions() attaches the raw
  // option to every wrapper row), or a raw-value fallback label when the option
  // has disappeared from an asynchronously swapped `options` array — the locked
  // R1 concurrency edge: an orphan chip persists, labelled by its raw value,
  // rather than vanishing. `value` array order IS chip display order (R1
  // locked); selectedValues() already preserves it.
  function chipRows() {
    const opts = Array.isArray(local.options) ? local.options : [];
    return selectedValues().map((v: any) => {
      const found = opts.find((o: any) => valueOf(o) === v);
      return found ? {
        value: v,
        label: labelOf(found),
        option: found
      } : {
        value: v,
        label: String(v),
        option: null
      };
    });
  }

  // chipRemoveLabel(row): the aria-label naming what a chip's remove control removes.
  function chipRemoveLabel(row: any) {
    return 'Remove ' + String(row.label);
  }

  // removeChipValue(v) is defined AFTER selectOption() below (not here) — React's
  // emitter derives each `useCallback`'s static dependency array from the
  // helpers its body calls, and `removeChipValue` calls `selectOption`. Declaring
  // it before `selectOption`'s own `const` would put `selectOption` in
  // `removeChipValue`'s deps array ahead of its OWN initializer in the SAME
  // module scope — a real same-render TDZ (`ReferenceError` at runtime on
  // React, TS2448 "used before its declaration" at typecheck). Source order
  // here IS emission order for these plain top-level consts, so
  // `removeChipValue` must textually follow `selectOption`.

  // ---- selection (writes the model + syncs query) ------------------------
  // `opt` is a filtered-row wrapper ({ value, label, disabled, _i, option }). Fire
  // `@change` with BOTH the committed value AND the raw source `option` (CP reads
  // `e.option`). `effectiveCloseOnSelect()` gates the popup close.
  function selectOption(opt: any) {
    if (!opt) return;
    if (opt.isMore) {
      expandGroup(opt.group);
      setActiveIndex(opt._i);
      return;
    }
    if (opt.isCreate) {
      // Read locals before any write (ROZ138 idiom).
      const q = query();
      const nq = normalizedQuery();
      // The double-commit latch (D-17/D-20): a second commit of the SAME
      // normalized query — whether a rapid double gesture, or the async
      // round-trip window before the consumer's `options` update lands — is a
      // no-op. An empty/whitespace normalized query never emits either (the
      // row should not even be reachable then, since isCreatableQuery() gates
      // it, but this guard is cheap insurance against a stale reference).
      if (!nq || nq === createdQuery()) return;
      setCreatedQuery(nq);
      _props.onCreate?.({
        query: q
      });
      // D-20: after `create` fires, local UI state behaves like a pick — the
      // effective close-on-select applies, and the query clears in `multiple`
      // mode (ready for the next entry) and is left alone in single mode (the
      // consumer's async add flows back through the ordinary `value` watch).
      // `value` itself is untouched — R3 locked.
      if (effectiveCloseOnSelect()) setIsOpen(false);
      if (local.multiple) setQuery('');
      setActiveIndex(-1);
      return;
    }
    if (opt.disabled) return;
    if (local.multiple) {
      // Capture whether the value was already present BEFORE the toggle — this
      // local is what feeds the `selected` field on the `change` payload (D-15).
      const cur = selectedValues();
      const wasSelected = cur.indexOf(opt.value) !== -1;
      // Fresh array on every commit — in-place mutation (.push/.splice) is
      // silently dropped by the React/Solid/Lit/Angular change detectors.
      const next = wasSelected ? cur.filter((v: any) => v !== opt.value) : [...cur, opt.value];
      setValue(next);
      // D-14: clear the query on pick under `multiple` (not the option's label)
      // so Backspace-removes-last stays reachable immediately after a pick.
      // `opt.isRemoval` (set only by removeChipValue() below) skips this —
      // removing a chip is not a pick, and clobbering whatever the user was
      // mid-typing in the search box is a separate, unrelated data loss.
      if (!opt.isRemoval) setQuery('');
      if (effectiveCloseOnSelect()) setIsOpen(false);
      setActiveIndex(-1);
      _props.onChange?.({
        value: next,
        option: opt.option,
        selected: !wasSelected
      });
      return;
    }
    setValue(opt.value);
    setQuery(String(opt.label));
    if (effectiveCloseOnSelect()) setIsOpen(false);
    setActiveIndex(-1);
    // D-15: `selected` is additive and always `true` in single-select.
    _props.onChange?.({
      value: opt.value,
      option: opt.option,
      selected: true
    });
  }

  // removeChipValue(v): routes chip removal through the EXACT SAME toggle path
  // selectOption() uses for a re-select — a synthetic wrapper row is enough,
  // since the `multiple` branch above only reads `opt.value`/`opt.option`/
  // `opt.disabled`/`opt.isMore` — so removal and toggle-off can never diverge
  // into different payload shapes. Declared here, after selectOption(), not
  // alongside chipRows()/chipRemoveLabel() above — see the comment there.
  function removeChipValue(v: any) {
    const opts = Array.isArray(local.options) ? local.options : [];
    const found = opts.find((o: any) => valueOf(o) === v);
    // isRemoval: true tells selectOption()'s `multiple` branch this is a
    // removal, not a pick — see the D-14 comment there.
    selectOption({
      value: v,
      option: found || null,
      isRemoval: true
    });
  }

  // onChipRemovePointerDown() (quick-260903-0s1, E1 audit finding): the POINTER
  // half of the chip remove control's split binding. Deliberately empty —
  // the `.prevent` modifier this is bound to (mousedown) is its ENTIRE payload:
  // preventDefault on mousedown suppresses the native focus shift, which is
  // what keeps the input focused, keeps onBlur() from firing, and therefore
  // keeps the popup open (the CR-02 hazard commit `d02a145ef` closed). The
  // removal deliberately does NOT live here: preventDefault on mousedown does
  // NOT suppress the click that follows it, so a handler bound to BOTH events
  // would remove the chip twice per pointer press. See onChipRemoveActivate()
  // below for where the removal actually happens.
  function onChipRemovePointerDown() {}

  // onChipRemoveActivate(v) (quick-260903-0s1, E1 audit finding): the CLICK half
  // of the split binding — the actual removal. `click` is the one event every
  // activation path produces: a real pointer press (mousedown+click), Enter or
  // Space on the focused button (native <button> behavior fires `click`, never
  // `keydown`-observable-as-such), AND a screen reader's synthesized activation
  // (which emits `click` with no preceding `mousedown` at all — the E1 defect
  // this fixes). Binding removal to `click` alone covers all three with exactly
  // one removal per activation.
  //
  // Keyboard/AT activation puts DOM focus ON the button, which this removal
  // then unmounts — without an explicit refocus, focus would fall to
  // `document.body`. Restore it using the EXACT idiom onFocus() above already
  // uses (proven on all six targets): a queued microtask that refocuses
  // `$refs.inputEl` only when it exists and is not already `document.activeElement`.
  // That activeElement guard is what makes this a strict no-op on the pointer
  // path — a pointer press never moves focus off the input in the first place
  // (onChipRemovePointerDown's preventDefault sees to that), so this refocus
  // never re-enters onFocus() and never re-selects the in-progress query.
  // $refs is safe here for the same reason it is safe everywhere else in this
  // file: this is a post-mount event handler, not module-init code.
  //
  // `.stop` on the template's `@click` binding (real-browser VR finding,
  // quick-260903-0s1): on Solid and Svelte specifically — the two targets whose
  // reactivity applies a DOM mutation SYNCHRONOUSLY, inside the very handler
  // that triggered it, rather than batched to a microtask like the other four
  // — removing this chip's own `<li>` mid-click detaches the click event's
  // `target` from the document BEFORE the event finishes bubbling. Popover's
  // own document-level `@click.outside($refs.anchorEl,$refs.floatingEl)`
  // dismiss listener (Popover.rozie) then evaluates `anchorEl.contains(target)`
  // against the NOW-DETACHED target, which is unconditionally `false` for any
  // detached node — misreading this internal removal as an outside click and
  // closing the popup. `.stop` (stopPropagation) keeps this click from ever
  // reaching that document listener, exactly like the sibling `@mousedown.stop`
  // pattern command-palette's own action-menu-affordance row already uses to
  // keep an inner gesture from bubbling into an ancestor's own listener.
  function onChipRemoveActivate(v: any) {
    removeChipValue(v);
    queueMicrotask(() => {
      if (inputElRef && document.activeElement !== inputElRef) inputElRef!.focus();
    });
  }

  // Reflect the externally-selected value into the input text. D-14: no-ops
  // under `multiple` — there is no single label to mirror into the input once
  // `value` holds an array, and the query is owned by chip-picking instead.
  //
  // quick-260903-0s1 (E2 audit finding): routed through the SAME valueOf()/
  // labelOf() resolvers every other option read in this file uses
  // (filteredOptions(), chipRows(), removeChipValue(), queryMatchesOption()) —
  // this was the single site that still read the raw `.value`/`.label`
  // properties directly. `optionValue`/`optionLabel` are documented public
  // props, and the resolvers additionally carry the primitive-option fallback
  // (`String(opt)` when `opt` has no `.label`) — bypassing them blanked the
  // input on both the mount path ($onMount → syncQueryToValue()) and the
  // external-value path ($watch(() => $props.value, ...) → syncQueryToValue()).
  //
  // The "not found" guard is on `opt` being neither `undefined` NOR `null`,
  // deliberately not on truthiness: with primitive options the found entry IS
  // the option, so a legitimate selection of an empty string or a zero would be
  // discarded by a truthiness test and re-blank the input — reintroducing the
  // bug in a new shape. `Array.prototype.find` returns `undefined` on a miss,
  // so that is the correct miss test; the `null` check keeps a `null` option
  // from rendering as the literal text "null".
  function syncQueryToValue() {
    if (local.multiple) return;
    const opts = Array.isArray(local.options) ? local.options : [];
    const opt = opts.find((o: any) => valueOf(o) === value());
    setQuery(opt === undefined || opt === null ? '' : String(labelOf(opt)));
  }

  // ---- input + keyboard handlers -----------------------------------------
  function onInput(e: any) {
    const q = e && e.target ? e.target.value : '';
    setQuery(q);
    // Any input change re-arms the double-commit latch (D-17/D-20) — a
    // freshly-typed query is a new gesture, never a repeat of whatever was
    // last created.
    setCreatedQuery(null);
    setIsOpen(true);
    setActiveIndex(0);
    _props.onSearch?.({
      query: q
    });
  }
  function onFocus(e: any) {
    // Phase 86 R2 (plan 86-03), Solid-only reentrancy guard: the input now
    // renders inside the composed popover's SCOPED `#anchor` slot
    // (`:open="$props.open"` among its params — see the <Popover> template
    // comment for why the input moved there). On Solid, a named slot invocation
    // with reactive scope params is a plain closure CALL re-run whenever any
    // param changes (@rozie/core's documented, intentional Solid
    // slot-reactivity design — not a bug to route around at the emitter level):
    // the `isOpen` write below changes the `open` param this exact handler is
    // responding to, which on Solid SYNCHRONOUSLY recreates the anchor's DOM
    // subtree (Solid's JSX has no virtual-DOM diffing to preserve node identity
    // across a closure re-invocation) — removing the just-focused `<input>`
    // fires a NATIVE blur on it, mid-call-stack, before this function even
    // returns. Without the guard below, that blur's own onBlur() would
    // immediately set isOpen back to false, and the deferred re-focus further
    // down would restart the SAME cycle on the fresh node — an infinite
    // recreate/blur/close/refocus loop. `openingInProgress` (below) tells
    // onBlur "this blur is a side effect of OUR OWN isOpen write, not the user
    // moving focus away" so it can skip closing. The other 5 targets diff their
    // scoped-slot re-render and keep the existing, already-focused node — no
    // blur ever fires there, so the guard is a no-op for them.
    openingInProgress = true;
    setIsOpen(true);
    // Cleared SYNCHRONOUSLY, immediately after the write — Solid's reactive
    // cascade (if any) runs SYNCHRONOUSLY as part of that write, before this
    // line executes, so the guard window covers exactly the recreate/blur
    // cascade and nothing past it. A deferred (microtask) clear would leave a
    // stale `true` window spanning an `await` boundary whenever the re-focus
    // below re-enters onFocus, incorrectly suppressing a LATER, genuine blur.
    openingInProgress = false;
    if (e && e.target && e.target.select) e.target.select();
    queueMicrotask(() => {
      // Re-assert focus onto whatever node is CURRENT — after Solid's
      // synchronous signal-write reactivity (if any) has already run and
      // `$refs.inputEl` reflects the latest node — recovering focus if it was
      // stranded on a since-removed one.
      if (inputElRef && document.activeElement !== inputElRef) inputElRef!.focus();
    });
  }

  // @blur closes the popup. Option selection uses @mousedown.prevent, which keeps
  // focus on the input, so a click on an option does NOT blur-close before select.
  // While `pinned` (pinOpen(true)), early-return BEFORE the isOpen write — a host
  // sub-surface (e.g. command-palette's action flyout) is holding focus and the
  // popup must stay open until the host calls pinOpen(false) itself. While
  // `openingInProgress` (Solid-only, see onFocus above), early-return too — this
  // blur is a side effect of our OWN open-transition recreating the anchor's DOM,
  // not the user moving focus elsewhere.
  function onBlur() {
    if (pinned()) return;
    if (openingInProgress) return;
    setIsOpen(false);
  }
  function onKeydown(e: any) {
    const key = e ? e.key : '';
    const list = navRows();
    // Capture the reactive reads into locals BEFORE any write so React never binds
    // a pre-write value (ROZ138; the read-then-write-same-key idiom). Each branch
    // is mutually exclusive, but a flow-insensitive analysis can't see that.
    const wasOpen = isOpen();
    const ai = activeIndex();
    if (key === 'ArrowDown') {
      if (e) e.preventDefault();
      if (!wasOpen) {
        setIsOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex(nextEnabled(list, ai, 1));
    } else if (key === 'ArrowUp') {
      if (e) e.preventDefault();
      if (!wasOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex(nextEnabled(list, ai, -1));
    } else if (key === 'Enter') {
      if (wasOpen && ai >= 0 && list[ai]) {
        if (e) e.preventDefault();
        selectOption(list[ai]);
      }
    } else if (key === 'Escape') {
      if (wasOpen) {
        if (e) e.preventDefault();
        setIsOpen(false);
      }
    } else if (key === 'Home') {
      if (wasOpen) {
        if (e) e.preventDefault();
        setActiveIndex(nextEnabled(list, -1, 1));
      }
    } else if (key === 'End') {
      if (wasOpen) {
        if (e) e.preventDefault();
        setActiveIndex(nextEnabled(list, list.length, -1));
      }
    } else if (key === 'Backspace') {
      // Backspace-removes-last-chip (Tags.rozie precedent, Phase 86 R1 plan
      // 86-05): guarded on `multiple` AND the LIVE input value being empty —
      // read `e.target.value` directly (Tags' proven idiom), never the mirrored
      // `$data.query`. A non-empty query falls through to normal text editing —
      // nothing here removes a chip while there is text to delete.
      if (local.multiple) {
        const liveValue = e && e.target ? e.target.value : '';
        if (liveValue === '') {
          const cur = selectedValues();
          if (cur.length > 0) {
            if (e) e.preventDefault();
            removeChipValue(cur[cur.length - 1]);
          }
        }
      }
    }
    // Keep the (new) active option in view — routes through the virtualizer when
    // windowing, direct scrollIntoView otherwise.
    scrollActiveIntoView();
  }

  // ---- lifecycle + imperative handle -------------------------------------
  // kickWindow: the cross-target first-paint settle (the data-table / listbox precedent).
  // Re-captures the LIVE scroll element, re-feeds the CURRENT option count, re-attaches the
  // rect observer (_willUpdate), and bumps the windowVer signal so the windowed slice
  // re-derives. Retried over a few frames because (a) virtual-core measures the scroll rect
  // asynchronously (D-09 Solid rAF-defer — a synchronous kick sees rectH 0 → empty window),
  // (b) Solid/Lit recreate the list node between mount and first commit (stale scrollElement),
  // and (c) the consumer often seeds options AFTER the combobox mounts (Lit/React). Stops once
  // the window paints — idempotent + loop-free.
  function kickWindow(attempts: any) {
    if (!virtualizer) return;
    gridScrollEl = __rozieRootRef! ? __rozieRootRef!.querySelector('.rozie-combobox-list') : gridScrollEl;
    // Only re-feed the count from a NON-EMPTY source: on React these rAF closures capture
    // stale (mount-time, empty) props, so feeding here would CLOBBER the $watch's correct
    // count back to 0. The $watch (fresh useEffect props) owns React's count; the kick owns
    // the Solid/Lit scroll-element re-attach + the deferred windowVer re-derive.
    if (windowSource().length > 0) {
      syncRows();
      virtualizer.setOptions(virtualizerOptions());
    }
    virtualizer._willUpdate();
    setWindowVer(windowVer() + 1);
    remeasureWindow();
    if (windowedRows().length === 0 && attempts > 0) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(attempts - 1));else setTimeout(() => kickWindow(attempts - 1), 16);
    }
  }

  // buildVirtualizer() (combobox-virtual-reactivity, VIRT-BUILD): the SINGLE virtualizer
  // construction site — called from $onMount below (mount-time virtual:true) AND from the
  // virtual $watch further down (a runtime false→true flip), so the mount path can never
  // drift from the flip path. Guarded so a build queued (rAF-deferred by the $watch) that
  // fires AFTER a flip-back is a no-op (rapid-flip idempotence), and so calling it twice
  // never double-constructs.
  function buildVirtualizer() {
    if (!local.virtual || virtualizer) return;
    // Capture the scroll container via $el.querySelector (the data-table gridScrollEl
    // precedent, proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered
    // node is null on Solid/Lit, leaving the virtualizer with no scroll element. The windowed
    // popup stays mounted whenever virtual (r-if="$props.virtual"); it is only hidden via
    // display:none when closed (CR-01), so the .rozie-combobox-list scroll container already
    // exists here for the virtualizer to attach to.
    gridScrollEl = __rozieRootRef! ? __rozieRootRef!.querySelector('.rozie-combobox-list') : null;
    virtualizer = new Virtualizer(virtualizerOptions());
    virtualizerCleanup = virtualizer._didMount();
    setWindowVer(windowVer() + 1);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(8));else setTimeout(() => kickWindow(8), 0);
  }

  // teardownVirtualizer() (VIRT-TEARDOWN): runs the SAME per-instance cleanup fn
  // $onUnmount invokes below, then nulls the instance state + bumps windowVer so the
  // windowed template branch (still mounted while $props.virtual — CR-01) re-derives to
  // the pre-construction fallback state instead of holding a stale virtualizer. This is
  // the true→false ResizeObserver-leak fix: previously ONLY $onUnmount ever called
  // virtualizerCleanup, so a runtime flip to non-virtual left the observer live.
  function teardownVirtualizer() {
    if (virtualizerCleanup) virtualizerCleanup();
    virtualizer = null;
    virtualizerCleanup = null;
    gridScrollEl = null;
    setWindowVer(windowVer() + 1);
  }
  // focus() — focus the input (accepted ROZ137 Lit override). clear() — reset the
  // selection + query. seedQuery(text) — imperative-only: write the input text
  // (and therefore filteredOptions()'s filter) without touching the `value`
  // model or selection state (a command-palette #2 levels/restore-on-pop
  // prerequisite — repopulating the input on back-navigation is NOT a
  // selection). pinOpen(v) — imperative-only: pin (or unpin) the popup open so
  // onBlur() does not collapse it while a host sub-surface holds focus, AND
  // (Phase 86-07 regression fix) so the composed Popover's OWN independent
  // Escape/click-outside dismissal is vetoed too via `:disable-dismiss`
  // (command-palette-sub-actions prerequisite). pinOpen(false) ONLY unpins — it
  // does NOT itself close the popup or move focus; that is the host's job.
  // Render-neutral when never called. All four are post-mount → $refs safe.
  function focus() {
    return inputElRef?.focus();
  }
  function clear() {
    // Fresh empty array under `multiple` (never in-place mutation), null in
    // single mode — mirrors selectOption()'s `{ value, option, selected }`
    // shape; nothing is selected after a clear, so `selected` is `false`.
    const empty = local.multiple ? [] : null;
    setValue(empty);
    setQuery('');
    setActiveIndex(-1);
    _props.onChange?.({
      value: empty,
      option: null,
      selected: false
    });
  }
  function seedQuery(text: any) {
    setQuery(String(text == null ? '' : text));
  }
  function pinOpen(v: any) {
    setPinned(!!v);
  }

  return (
    <>
    <div ref={(el) => { __rozieRootRef = el as HTMLElement; }} {...attrs} class={"rozie-combobox" + " " + rozieClass({ 'rozie-combobox--open': isOpen(), 'rozie-combobox--disabled': local.disabled, 'rozie-combobox--inline': local.inline, 'rozie-combobox--multiple': local.multiple }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-9546115a="">
      
      <Popover trigger="manual" open={isOpen()} onOpenChange={setIsOpen} bare={true} matchWidth={true} keepMounted={local.virtual} disablePositioning={local.inline} disableDismiss={local.inline || pinned()} placement={local.placement} offset={local.offset} disableFlip={local.disableFlip} disableShift={local.disableShift} data-rozie-s-9546115a="" anchorSlot={() => (<>
          
          {<Show when={local.multiple}><ul class={"rozie-combobox-chips"} data-rozie-s-9546115a="">
            <Key each={chipRows() as readonly any[]} by={(row) => 'chip-' + row.value}>{(row, idx) => <li class={"rozie-combobox-chip"} data-rozie-s-9546115a="">
              {(_props.chipSlot ?? _props.slots?.['chip'])?.({ option: row().option, remove: () => removeChipValue(row().value), index: idx() }) ?? <><span class={"rozie-combobox-chip__label"} data-rozie-s-9546115a="">{rozieDisplay(row().label)}</span><button type="button" aria-label={rozieAttr(chipRemoveLabel(row()))} class={"rozie-combobox-chip__remove"} disabled={!!local.disabled} onMouseDown={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.preventDefault(); onChipRemovePointerDown(); }} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.stopPropagation(); onChipRemoveActivate(row().value); }} data-rozie-s-9546115a="">×</button></>}
            </li>}</Key>
          </ul></Show>}<input type="text" role="combobox" aria-autocomplete="list" aria-expanded={!!isOpen()} aria-controls={rozieAttr(listId())} aria-activedescendant={rozieAttr(activeId())} aria-label={rozieAttr(local.ariaLabel)} autocomplete="off" ref={(el) => { inputElRef = el as HTMLElement; }} class={"rozie-combobox-input"} value={query()} placeholder={local.placeholder} disabled={!!local.disabled} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onInput($event); }} onFocus={($event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }) => { onFocus($event); }} onBlur={($event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }) => { onBlur(); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onKeydown($event); }} data-rozie-s-9546115a="" />
        </>)}>
        
        {<Show when={isOpen() && !local.virtual && !isGrouped()}><ul class={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" aria-multiselectable={(local.multiple ? 'true' : null) ?? undefined} data-rozie-s-9546115a="">
          <Key each={filteredOptions() as readonly any[]} by={(opt) => opt.value}>{(opt) => <li role="option" aria-selected={!!isRowSelected(opt())} aria-disabled={!!opt().disabled} class={"rozie-combobox-option" + " " + rozieClass({ 'rozie-combobox-option--active': opt()._i === activeIndex(), 'rozie-combobox-option--selected': isRowSelected(opt()), 'rozie-combobox-option--disabled': opt().disabled })} id={rozieAttr(optId(opt()._i))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { $event.preventDefault(); selectOption(opt()); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { setActiveIndex(opt()._i); }} data-rozie-s-9546115a="">
            {(_props.optionSlot ?? _props.slots?.['option'])?.({ option: opt().option, index: opt()._i, active: opt()._i === activeIndex(), selected: isRowSelected(opt()), disabled: opt().disabled }) ?? rozieDisplay(opt().label)}
          </li>}</Key>

          {<Show when={filteredOptions().length === 0 && !isCreatableQuery()}><li class={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
            {(_props.emptySlot ?? _props.slots?.['empty'])?.({ query: query() }) ?? "No results"}
          </li></Show>}{<Show when={isCreatableQuery()}><li role="option" class={"rozie-combobox-option rozie-combobox-create" + " " + rozieClass({ 'rozie-combobox-option--active': filteredOptions().length === activeIndex() })} id={rozieAttr(optId(filteredOptions().length))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { $event.preventDefault(); selectOption(createRowAt(filteredOptions().length)); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { setActiveIndex(filteredOptions().length); }} data-rozie-s-9546115a="">
            {(_props.createSlot ?? _props.slots?.['create'])?.({ query: query() }) ?? <>Create "{query()}"</>}
          </li></Show>}</ul></Show>}{<Show when={isOpen() && !local.virtual && isGrouped() && !isCapped()}><ul class={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" aria-multiselectable={(local.multiple ? 'true' : null) ?? undefined} data-rozie-s-9546115a="">
          <Key each={groupBlocks() as readonly any[]} by={(blk) => 'grp-' + (blk.group ? blk.group.id : '_ungrouped')}>{(blk) => <li class={"rozie-combobox-group"} role="group" aria-label={rozieAttr(blk().group ? blk().group.label : null)} data-rozie-s-9546115a="">
            {<Show when={blk().group}><div class={"rozie-combobox-group-heading"} role="presentation" data-rozie-s-9546115a="">
              {(_props.groupHeadingSlot ?? _props.slots?.['groupHeading'])?.({ group: blk().group }) ?? rozieDisplay(blk().group.label)}
            </div></Show>}<Key each={blk().items as readonly any[]} by={(opt) => opt.value}>{(opt) => <div role="option" aria-selected={!!isRowSelected(opt())} aria-disabled={!!opt().disabled} class={"rozie-combobox-option" + " " + rozieClass({ 'rozie-combobox-option--active': opt()._i === activeIndex(), 'rozie-combobox-option--selected': isRowSelected(opt()), 'rozie-combobox-option--disabled': opt().disabled })} id={rozieAttr(optId(opt()._i))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { $event.preventDefault(); selectOption(opt()); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { setActiveIndex(opt()._i); }} data-rozie-s-9546115a="">
              {(_props.optionSlot ?? _props.slots?.['option'])?.({ option: opt().option, index: opt()._i, active: opt()._i === activeIndex(), selected: isRowSelected(opt()), disabled: opt().disabled }) ?? rozieDisplay(opt().label)}
            </div>}</Key>
          </li>}</Key>

          {<Show when={groupBlocks().length === 0 && !isCreatableQuery()}><li class={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
            {(_props.emptySlot ?? _props.slots?.['empty'])?.({ query: query() }) ?? "No results"}
          </li></Show>}{<Show when={isCreatableQuery()}><li role="option" class={"rozie-combobox-option rozie-combobox-create" + " " + rozieClass({ 'rozie-combobox-option--active': filteredOptions().length === activeIndex() })} id={rozieAttr(optId(filteredOptions().length))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { $event.preventDefault(); selectOption(createRowAt(filteredOptions().length)); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { setActiveIndex(filteredOptions().length); }} data-rozie-s-9546115a="">
            {(_props.createSlot ?? _props.slots?.['create'])?.({ query: query() }) ?? <>Create "{query()}"</>}
          </li></Show>}</ul></Show>}{<Show when={isOpen() && !local.virtual && isCapped()}><ul class={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" aria-multiselectable={(local.multiple ? 'true' : null) ?? undefined} data-rozie-s-9546115a="">
          <Key each={cappedBlocks() as readonly any[]} by={(blk) => 'grp-' + (blk.group ? blk.group.id : '_ungrouped')}>{(blk) => <li class={"rozie-combobox-group"} role="group" aria-label={rozieAttr(blk().group ? blk().group.label : null)} data-rozie-s-9546115a="">
            {<Show when={blk().group}><div class={"rozie-combobox-group-heading"} role="presentation" data-rozie-s-9546115a="">
              {(_props.groupHeadingSlot ?? _props.slots?.['groupHeading'])?.({ group: blk().group }) ?? rozieDisplay(blk().group.label)}
            </div></Show>}<Key each={blk().items as readonly any[]} by={(opt) => opt.value}>{(opt) => <div role="option" aria-selected={!!isRowSelected(opt())} aria-disabled={!!opt().disabled} class={"rozie-combobox-option" + " " + rozieClass({ 'rozie-combobox-option--active': opt()._i === activeIndex(), 'rozie-combobox-option--selected': isRowSelected(opt()), 'rozie-combobox-option--disabled': opt().disabled })} id={rozieAttr(optId(opt()._i))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { $event.preventDefault(); selectOption(opt()); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { setActiveIndex(opt()._i); }} data-rozie-s-9546115a="">
              {(_props.optionSlot ?? _props.slots?.['option'])?.({ option: opt().option, index: opt()._i, active: opt()._i === activeIndex(), selected: isRowSelected(opt()), disabled: opt().disabled }) ?? rozieDisplay(opt().label)}
            </div>}</Key>

            {<Show when={blk().more}><div role="option" class={"rozie-combobox-option rozie-combobox-more" + " " + rozieClass({ 'rozie-combobox-option--active': blk().more._i === activeIndex() })} id={rozieAttr(optId(blk().more._i))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { $event.preventDefault(); selectOption(blk().more); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { setActiveIndex(blk().more._i); }} data-rozie-s-9546115a="">
              {(_props.groupMoreSlot ?? _props.slots?.['groupMore'])?.({ group: blk().group, hidden: blk().more.hidden, expand: blk().more.expand }) ?? <>+{rozieDisplay(blk().more.hidden)} more</>}
            </div></Show>}</li>}</Key>

          {<Show when={cappedBlocks().length === 0 && !isCreatableQuery()}><li class={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
            {(_props.emptySlot ?? _props.slots?.['empty'])?.({ query: query() }) ?? "No results"}
          </li></Show>}{<Show when={isCreatableQuery()}><li role="option" class={"rozie-combobox-option rozie-combobox-create" + " " + rozieClass({ 'rozie-combobox-option--active': cappedRowCount() === activeIndex() })} id={rozieAttr(optId(cappedRowCount()))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { $event.preventDefault(); selectOption(createRowAt(cappedRowCount())); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { setActiveIndex(cappedRowCount()); }} data-rozie-s-9546115a="">
            {(_props.createSlot ?? _props.slots?.['create'])?.({ query: query() }) ?? <>Create "{query()}"</>}
          </li></Show>}</ul></Show>}{<Show when={local.virtual}><ul class={"rozie-combobox-list rozie-combobox-list--virtual"} id={rozieAttr(listId())} role="listbox" aria-multiselectable={(local.multiple ? 'true' : null) ?? undefined} style={parseInlineStyle((isOpen() ? '' : 'display:none;') + (local.maxHeight ? 'height:' + local.maxHeight + ';max-height:' + local.maxHeight + ';overflow-y:auto;--rozie-combobox-list-max-height:' + local.maxHeight : 'overflow-y:auto'))} data-rozie-s-9546115a="">
          <li class={"rozie-combobox-spacer"} aria-hidden="true" style={parseInlineStyle('height:' + padTop() + 'px')} data-rozie-s-9546115a="" />

          <Key each={windowedView() as readonly any[]} by={(wr) => wr.row.id}>{(wr) => <li data-index={rozieAttr(wr().vi.index)} role="option" aria-selected={!!isRowSelected(wr().row)} aria-disabled={!!wr().row.disabled} class={"rozie-combobox-option" + " " + rozieClass({ 'rozie-combobox-option--active': wr().vi.index === activeIndex(), 'rozie-combobox-option--selected': isRowSelected(wr().row), 'rozie-combobox-option--disabled': wr().row.disabled })} id={rozieAttr(optId(wr().vi.index))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { $event.preventDefault(); selectOption(wr().row); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { setActiveIndex(wr().vi.index); }} data-rozie-s-9546115a="">
            {(_props.optionSlot ?? _props.slots?.['option'])?.({ option: wr().row.option, index: wr().vi.index, active: wr().vi.index === activeIndex(), selected: isRowSelected(wr().row), disabled: wr().row.disabled }) ?? rozieDisplay(wr().row.label)}
          </li>}</Key>

          <li class={"rozie-combobox-spacer"} aria-hidden="true" style={parseInlineStyle('height:' + padBottom() + 'px')} data-rozie-s-9546115a="" />

          {<Show when={windowSource().length === 0 && !isCreatableQuery()}><li class={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
            {(_props.emptySlot ?? _props.slots?.['empty'])?.({ query: query() }) ?? "No results"}
          </li></Show>}{<Show when={isCreatableQuery()}><li role="option" class={"rozie-combobox-option rozie-combobox-create" + " " + rozieClass({ 'rozie-combobox-option--active': windowSource().length === activeIndex() })} id={rozieAttr(optId(windowSource().length))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { $event.preventDefault(); selectOption(createRowAt(windowSource().length)); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { setActiveIndex(windowSource().length); }} data-rozie-s-9546115a="">
            {(_props.createSlot ?? _props.slots?.['create'])?.({ query: query() }) ?? <>Create "{query()}"</>}
          </li></Show>}</ul></Show>}</Popover>
    </div>
    </>
  );
}
