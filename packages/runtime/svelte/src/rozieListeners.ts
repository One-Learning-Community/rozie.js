/**
 * rozieListeners — Svelte 5 action attaching template `@event` listeners that
 * carry native listener options (`.capture` / `.passive` / `.once`).
 *
 * Svelte 5's `on<event>={...}` attributes take no listener options, so the
 * emitter lowers an option-bearing template event to
 *
 *   <div use:rozieListeners={[["keydown", handler, { capture: true, once: true }]]}>
 *
 * where `handler` is exactly what the `onkeydown={...}` attribute would have
 * carried (same `.stop`/`.prevent`/key-filter guards, same debounce/throttle
 * wrapper). One action per element holds every option-bearing listener of
 * that element; option-less listeners keep their plain `on<event>` attribute.
 *
 * Each entry slot gets ONE stable DOM listener that dispatches to the entry's
 * CURRENT handler, so `update(next)` (Svelte re-runs it when the parameter's
 * dependencies change) never leaves a stale closure attached and does not
 * re-add the listener unless the slot's event or options changed. `.once` is
 * tracked per action instance (= per element) and slot instead of passed to
 * the DOM, so swapping the handler on update does not re-arm it.
 *
 * @public — runtime API consumed by emitted .svelte files.
 */
export type RozieListener = readonly [
  type: string,
  // `any`: the template handler is written against the concrete event type
  // (`$event.key`, `$event.target.value`), which the tuple can't know.
  // biome-ignore lint/suspicious/noExplicitAny: see above
  handler: (event: any) => unknown,
  options?: { readonly capture?: boolean; readonly passive?: boolean; readonly once?: boolean },
];

interface Slot {
  type: string;
  capture: boolean;
  passive: boolean;
  once: boolean;
  fired: boolean;
  listener: (event: Event) => void;
}

export function rozieListeners(
  node: Element,
  entries: ReadonlyArray<RozieListener> | null | undefined,
): {
  update(next: ReadonlyArray<RozieListener> | null | undefined): void;
  destroy(): void;
} {
  let current: ReadonlyArray<RozieListener> = entries ?? [];
  const slots: Array<Slot | undefined> = [];

  const detach = (slot: Slot): void => {
    node.removeEventListener(slot.type, slot.listener, { capture: slot.capture });
  };

  const sync = (): void => {
    const len = Math.max(current.length, slots.length);
    for (let i = 0; i < len; i++) {
      const entry = current[i];
      const prev = slots[i];
      if (entry === undefined) {
        if (prev !== undefined) detach(prev);
        slots[i] = undefined;
        continue;
      }
      const [type, , options] = entry;
      const capture = options?.capture === true;
      const passive = options?.passive === true;
      const once = options?.once === true;
      if (
        prev !== undefined &&
        prev.type === type &&
        prev.capture === capture &&
        prev.passive === passive &&
        prev.once === once
      ) {
        continue; // same slot shape — the stable listener reads `current`.
      }
      if (prev !== undefined) detach(prev);
      const slot: Slot = {
        type,
        capture,
        passive,
        once,
        fired: false,
        listener: (event: Event): void => {
          if (slot.once) {
            if (slot.fired) return;
            slot.fired = true;
          }
          current[i]?.[1](event);
        },
      };
      node.addEventListener(type, slot.listener, { capture, passive });
      slots[i] = slot;
    }
    slots.length = current.length;
  };

  sync();

  return {
    update(next) {
      current = next ?? [];
      sync();
    },
    destroy() {
      for (const slot of slots) if (slot !== undefined) detach(slot);
      slots.length = 0;
      current = [];
    },
  };
}
