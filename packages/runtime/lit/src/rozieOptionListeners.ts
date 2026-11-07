/**
 * `rozieOptionListeners` — element-position directive for template listeners that carry
 * `.capture` / `.passive` / `.once` when their event already has a binding on the same element.
 *
 * Lit forbids two bindings with the same attribute name on one element, so
 * `<div @click=${a} @click=${{ handleEvent: b, capture: true }}>` breaks the template (every
 * later binding shifts by one part). The emitter keeps the plain `@click=${a}` and lowers the
 * option-bearing one to
 *
 *   <div @click=${a} ${rozieOptionListeners([['click', b, { capture: true }]])}>
 *
 * Each entry gets one stable DOM listener that calls the entry's CURRENT handler, so inline
 * arrows re-created every render never go stale and are never re-added. `.once` is tracked per
 * entry instead of passed to the DOM, so re-rendering can't re-arm it. A listener is re-added
 * only when its event or options change. `disconnected()` removes everything.
 *
 * @public — runtime API consumed by emitted Lit components.
 */
import { noChange } from 'lit';
import { AsyncDirective, directive } from 'lit/async-directive.js';
import type { ElementPart, PartInfo } from 'lit/directive.js';
import { PartType } from 'lit/directive.js';

export type RozieOptionListener = readonly [
  type: string,
  // biome-ignore lint/suspicious/noExplicitAny: handlers are typed by the emitted template
  handler: (event: any) => unknown,
  options: { capture?: boolean; passive?: boolean; once?: boolean },
];

interface Slot {
  type: string;
  key: string;
  capture: boolean;
  passive: boolean;
  once: boolean;
  fired: boolean;
  handler: RozieOptionListener[1];
  listener: EventListener;
}

class RozieOptionListenersDirective extends AsyncDirective {
  #el: Element | null = null;
  #slots: Slot[] = [];

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error('rozieOptionListeners can only be used in element position.');
    }
  }

  override update(part: ElementPart, [entries]: [ReadonlyArray<RozieOptionListener>]): symbol {
    const el = part.element;
    this.#el = el;
    const next: Slot[] = [];
    entries.forEach(([type, handler, options], i) => {
      const capture = options.capture === true;
      const passive = options.passive === true;
      const once = options.once === true;
      const key = `${type}|${capture}|${passive}|${once}`;
      const prev = this.#slots[i];
      if (prev !== undefined && prev.key === key) {
        prev.handler = handler;
        next.push(prev);
        return;
      }
      if (prev !== undefined) el.removeEventListener(prev.type, prev.listener, prev.capture);
      const slot: Slot = { type, key, capture, passive, once, fired: false, handler, listener: () => {} };
      slot.listener = (event: Event): void => {
        if (slot.once) {
          if (slot.fired) return;
          slot.fired = true;
        }
        slot.handler(event);
      };
      el.addEventListener(type, slot.listener, { capture, passive });
      next.push(slot);
    });
    for (const stale of this.#slots.slice(entries.length)) {
      el.removeEventListener(stale.type, stale.listener, stale.capture);
    }
    this.#slots = next;
    return noChange;
  }

  protected override disconnected(): void {
    const el = this.#el;
    if (el === null) return;
    for (const slot of this.#slots) el.removeEventListener(slot.type, slot.listener, slot.capture);
    this.#slots = [];
  }

  render(_entries: ReadonlyArray<RozieOptionListener>): symbol {
    return noChange;
  }
}

export const rozieOptionListeners = directive(RozieOptionListenersDirective);
