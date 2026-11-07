/**
 * `RozieOnce` — `.once` on a component event, which in Angular is an output rather than a DOM
 * listener, so there is no `{ once: true }` option to give it.
 *
 * The emitter puts the directive on the component tag and gates the binding with it:
 *
 *   <app-child rozieOnce #__rozieOnce1="rozieOnce" (ping)="__rozieOnce1.take(0) && onPing($event)">
 *
 * Angular creates one directive instance per rendered element, so each child, including each
 * `@for` row, fires once, and a re-created child starts fresh. Each `.once` listener on the tag
 * passes its own id, so two of them don't share state.
 *
 * @public — runtime API consumed by emitted Angular components.
 */
import { Directive } from '@angular/core';

@Directive({ selector: '[rozieOnce]', exportAs: 'rozieOnce', standalone: true })
export class RozieOnce {
  readonly #fired = new Set<number>();

  /** `true` the first time it is called for `id`, `false` after that. */
  take(id: number): boolean {
    if (this.#fired.has(id)) return false;
    this.#fired.add(id);
    return true;
  }
}
