/**
 * rozieListenController — the DOM-only core of the `RozieListen` directive.
 *
 * Angular template `(event)` bindings cannot carry addEventListener options,
 * so a Rozie template `@event.capture` / `.passive` / `.once` is lowered to a
 * `RozieListen` slot binding instead. This controller owns the native
 * listeners for one element: one listener per numbered slot, attached with
 * the slot's options, forwarding every native event to `fire(slot, event)`.
 *
 * Semantics:
 *   - `fire` is resolved per event, so the CURRENT handler always runs (the
 *     directive forwards through its output; the template statement bound to
 *     that output is whatever change detection last produced).
 *   - `.once` is the native `once` option. Once a once-slot has fired it is
 *     never re-armed, even if the slot is re-configured later.
 *   - Re-configuring a slot with the same event + flags is a no-op (no
 *     detach/attach churn across change detection).
 *   - `destroy()` removes every live listener.
 *
 * Framework-agnostic on purpose (no Angular imports) so it is unit-testable
 * against a real DOM without an Angular compiler.
 */

export interface RozieListenOptions {
  capture?: boolean;
  passive?: boolean;
  once?: boolean;
}

interface SlotState {
  event: string;
  capture: boolean;
  passive: boolean;
  once: boolean;
  listener: EventListener | null;
  fired: boolean;
}

export class RozieListenController {
  private readonly slots = new Map<number, SlotState>();

  constructor(
    private readonly target: EventTarget | null | undefined,
    private readonly fire: (slot: number, event: Event) => void,
  ) {}

  /** Configure (or re-configure) slot `slot`. `event` null/empty clears it. */
  set(slot: number, event: string | null | undefined, options?: RozieListenOptions | null): void {
    const capture = options?.capture === true;
    const passive = options?.passive === true;
    const once = options?.once === true;
    const prev = this.slots.get(slot);
    if (prev) {
      if (prev.event === event && prev.capture === capture && prev.passive === passive && prev.once === once) {
        return;
      }
      // A once-slot that already fired stays spent: never re-arm it.
      if (prev.once && prev.fired) return;
      this.detach(prev);
      this.slots.delete(slot);
    }
    if (!event) return;
    const state: SlotState = { event, capture, passive, once, listener: null, fired: false };
    this.slots.set(slot, state);
    const target = this.target;
    if (!target || typeof target.addEventListener !== 'function') return;
    const listener: EventListener = (e) => {
      if (state.once) {
        if (state.fired) return;
        state.fired = true;
        state.listener = null;
      }
      this.fire(slot, e);
    };
    state.listener = listener;
    target.addEventListener(event, listener, { capture, passive, once });
  }

  destroy(): void {
    for (const state of this.slots.values()) this.detach(state);
    this.slots.clear();
  }

  private detach(state: SlotState): void {
    if (state.listener && this.target && typeof this.target.removeEventListener === 'function') {
      this.target.removeEventListener(state.event, state.listener, { capture: state.capture });
    }
    state.listener = null;
  }
}
