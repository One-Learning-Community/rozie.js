import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

/** An `aria-haspopup` token: what kind of popup a click popover's panel is (the `popupRole` prop). */
export type PopoverPopupRole = 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid';

export interface PopoverProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'open' | 'defaultOpen' | 'onOpenChange' | 'placement' | 'trigger' | 'offset' | 'disableFlip' | 'disableShift' | 'arrow' | 'disabled' | 'modal' | 'strategy' | 'bare' | 'disablePositioning' | 'keepMounted' | 'matchWidth' | 'disableDismiss' | 'popupRole' | 'idBase' | 'reference' | 'onChange' | 'renderAnchor' | 'children' | 'slots' | 'dangerouslySetInnerHTML'> {
  /**
   * Whether the floating content is open. The sole `model: true` prop, and its change event is the only change signal Popover fires. Bind it two-way — Vue `v-model:open`, React/Solid `open` + `onOpenChange`, Svelte `bind:open`, Angular `[(open)]`, Lit the `open` property + the `open-change` event — and Popover writes the new state back whenever the trigger, a dismissal or the handle toggles it. Left unbound it falls back to an uncontrolled default.
   */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  /**
   * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime.
   */
  placement?: string;
  /**
   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur, or `'manual'` for a composing component that drives `open` itself — every built-in gesture handler no-ops. Drives both the gesture handlers and the ARIA: `'click'` sets `aria-haspopup`/`aria-expanded`/`aria-controls` on the anchor wrapper; `'hover'`/`'focus'` are tooltips (`role="tooltip"` panel, `aria-describedby` on the wrapper, no popup claim); `'manual'` makes no anchor ARIA claim. The wrapper is not focusable, so put the matching attributes on your own focusable trigger too — the `anchor` slot passes `open`, `panelId` and `popupRole` for exactly that. The `aria-haspopup` value is the `popupRole` prop (default `'dialog'`).
   */
  trigger?: string;
  /**
   * Distance in pixels between the anchor and the floating content (the Floating UI `offset` middleware). Reconciled at runtime.
   */
  offset?: number;
  /**
   * Disable the Floating UI `flip` middleware. By default the content flips to the opposite side of the anchor when it would overflow the viewport; set this to keep it pinned to `placement` regardless.
   */
  disableFlip?: boolean;
  /**
   * Disable the Floating UI `shift` middleware. By default the content shifts along its axis to stay within the viewport; set this to keep it strictly aligned to the anchor.
   */
  disableShift?: boolean;
  /**
   * Opt in to a positioned arrow element. When set, Popover renders an arrow `<div>` and runs the Floating UI `arrow` middleware against it so it points at the anchor. Style it via the `--rozie-popover-*` arrow CSS custom properties.
   */
  arrow?: boolean;
  /**
   * Disable the control entirely: the trigger no longer opens the content and any open content is suppressed.
   */
  disabled?: boolean;
  /**
   * Opt in to modal dialog semantics for a `click` popover. **Off by default:** a click popover is a non-modal, click-outside-dismissable layer, so its panel is rendered role-neutral (the slot content owns its own ARIA role — e.g. a `role="menu"`) and carries NO `aria-modal`. Set `modal` for a genuinely modal dialog popover: the panel then gets `role="dialog"` + `aria-modal="true"`. **Note:** Popover ships no focus trap (it stays a minimal headless primitive); if you set `modal`, provide your own focus containment so the `aria-modal` claim holds. Ignored for `hover`/`focus` triggers (always tooltip-flavored).
   */
  modal?: boolean;
  /**
   * Floating UI positioning strategy — 'absolute' (default) or 'fixed'. Use 'fixed' to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). Reconciled at runtime.
   */
  strategy?: string;
  /**
   * Suppress the floating panel's own chrome (background, border, border-radius, box-shadow, padding) so a composing component can supply its own instead. Off by default — the panel keeps its standard `--rozie-popover-*` chrome tokens.
   */
  bare?: boolean;
  /**
   * Render the floating panel in normal document flow instead of computing a floating position — no `computePosition` call and no `autoUpdate` tracking is ever started. For a composing component that already controls the panel's layout (e.g. an `inline` consumer) rather than a genuinely floating popover.
   */
  disablePositioning?: boolean;
  /**
   * Render the floating panel hidden instead of unmounting it while closed, so a composing component whose panel content owns scroll state (e.g. a virtualizer) keeps its DOM across a close/open cycle. A one-shot position computation runs once at mount so the hidden panel already carries correct coordinates before the first open.
   */
  keepMounted?: boolean;
  /**
   * Match the floating panel's width exactly to the anchor's width, via the Floating UI `size` middleware. Writes the panel's `width` style only — never touches height.
   */
  matchWidth?: boolean;
  /**
   * Suppress Popover's own Escape-key and click-outside dismissal listeners while `true`. For a composing component that drives `open` itself and needs to temporarily veto Popover's independent dismissal — e.g. while a host sub-surface anchored to (but not nested inside) the composed control legitimately holds focus. Off by default; existing `trigger="manual"` consumers relying on real click-outside dismissal are unaffected unless they opt in.
   */
  disableDismiss?: boolean;
  /**
   * The kind of popup the panel content is, announced as `aria-haspopup` on the anchor wrapper of a `click` popover: `'dialog'` (the default), `'menu'`, `'listbox'`, `'tree'` or `'grid'`; any other value is treated as `'dialog'`. Set `'menu'` when the panel hosts a menu (your content carries `role="menu"`), so a menu button keeps the click trigger and its focus return. The `anchor` slot passes the same value as `popupRole` (with `open` and `panelId`) so you can put `aria-haspopup` / `aria-expanded` / `aria-controls` on your own focusable trigger. It is `null` for the tooltip triggers (`'hover'` / `'focus'`), which claim no popup; for `'manual'` it is the prop value, for the trigger you own.
   */
  popupRole?: string;
  /**
   * Id base for the floating panel, whose id is `idBase + '-panel'` — also exposed to the `anchor` slot as `panelId`, so your trigger can set `aria-controls` (click) or `aria-describedby` (tooltip) to it. Leave it empty (the default) and each instance generates a unique id base after mount (`rozie-popover-<n>`), so several popovers on one page never share a panel id; set it when you need a stable, predictable id. On Lit the panel lives in the element's shadow root, so an id reference from light DOM, including your slotted anchor content, cannot resolve to it; there the anchor wrapper's own attributes, which sit inside the shadow root, carry the reference. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  /**
   * Position the content against an external reference instead of the built-in anchor wrapper: either a DOM Element another component owns (e.g. a calendar event element) or a Floating UI virtual element — an object with a `getBoundingClientRect()` method and an optional `contextElement` — e.g. to open at a pointer position. The reference is measured and tracked with Floating UI's `autoUpdate` and reconciled at runtime; `null` (the default) keeps the built-in anchor. A click on a referenced Element does not count as an outside click (so a consumer toggle on it closes the panel); with a virtual element only the anchor wrapper and the panel count as inside. You own the trigger ARIA on your own element (`aria-haspopup` / `aria-expanded`, plus `aria-controls` pointing at `idBase + '-panel'`), typically with `trigger='manual'` and a two-way-bound `open`. If a referenced Element is removed from the document while open, the popover closes. Pass a stable value — a new object on every render restarts tracking.
   */
  reference?: (Element | Record<string, unknown>) | null;
  /**
   * @deprecated Removed in 0.3.0 — use the `open` model change event (React/Solid `onOpenChange`, Svelte `bind:open`).
   */
  onChange?: never;
  renderAnchor?: (params: { open: boolean; toggle: () => void; show: () => void; hide: () => void; panelId: string; popupRole: PopoverPopupRole | null }) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface PopoverHandle {
  show: () => void;
  hide: () => void;
  toggle: () => void;
  reposition: () => void;
}

declare const Popover: React.ForwardRefExoticComponent<PopoverProps & React.RefAttributes<PopoverHandle>>;
export default Popover;
