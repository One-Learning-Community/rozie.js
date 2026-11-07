import { Directive, ElementRef, Input, inject, output } from '@angular/core';
import type { OnChanges, OnDestroy, OutputEmitterRef, SimpleChanges } from '@angular/core';
import { RozieListenController } from './rozieListenController';
import type { RozieListenOptions } from './rozieListenController';

/**
 * The re-emitted DOM event, typed `any` on purpose: the slot is generic over
 * the event name, and a handler typed for the concrete event
 * (`onKey(e: KeyboardEvent)`) must still typecheck under `strictTemplates`,
 * exactly as it does on a plain `(keydown)` binding.
 */
// biome-ignore lint/suspicious/noExplicitAny: see above — mirrors `(event)` binding typing.
export type RozieListenEvent = any;

/** Number of option-bearing listener slots one element can carry. */
export const ROZIE_LISTEN_SLOTS = 8;

/**
 * RozieListen — attaches a template `@event.capture` / `.passive` / `.once`
 * listener natively, because Angular `(event)` bindings cannot carry
 * addEventListener options. The Rozie emitter lowers such a listener to a
 * numbered slot on the element:
 *
 *   [rozieOn0]="'keydown'" [rozieOn0Options]="{ capture: true, once: true }"
 *   (rozieOn0Fire)="onKey($event)"
 *
 * The native event is re-emitted through `rozieOn<N>Fire`, so the handler is
 * still an ordinary template statement: `$event` is the DOM event, `@for` loop
 * variables are in scope, and Angular marks the view dirty as for any output.
 * Slots are numbered per element (0..7) so one element can carry several
 * option listeners, including the same event with different options.
 */
@Directive({
  selector: '[rozieOn0],[rozieOn1],[rozieOn2],[rozieOn3],[rozieOn4],[rozieOn5],[rozieOn6],[rozieOn7]',
  standalone: true,
})
export class RozieListen implements OnChanges, OnDestroy {
  @Input() rozieOn0: string | null | undefined;
  @Input() rozieOn0Options: RozieListenOptions | null | undefined;
  readonly rozieOn0Fire = output<RozieListenEvent>();

  @Input() rozieOn1: string | null | undefined;
  @Input() rozieOn1Options: RozieListenOptions | null | undefined;
  readonly rozieOn1Fire = output<RozieListenEvent>();

  @Input() rozieOn2: string | null | undefined;
  @Input() rozieOn2Options: RozieListenOptions | null | undefined;
  readonly rozieOn2Fire = output<RozieListenEvent>();

  @Input() rozieOn3: string | null | undefined;
  @Input() rozieOn3Options: RozieListenOptions | null | undefined;
  readonly rozieOn3Fire = output<RozieListenEvent>();

  @Input() rozieOn4: string | null | undefined;
  @Input() rozieOn4Options: RozieListenOptions | null | undefined;
  readonly rozieOn4Fire = output<RozieListenEvent>();

  @Input() rozieOn5: string | null | undefined;
  @Input() rozieOn5Options: RozieListenOptions | null | undefined;
  readonly rozieOn5Fire = output<RozieListenEvent>();

  @Input() rozieOn6: string | null | undefined;
  @Input() rozieOn6Options: RozieListenOptions | null | undefined;
  readonly rozieOn6Fire = output<RozieListenEvent>();

  @Input() rozieOn7: string | null | undefined;
  @Input() rozieOn7Options: RozieListenOptions | null | undefined;
  readonly rozieOn7Fire = output<RozieListenEvent>();

  private readonly __fires: ReadonlyArray<OutputEmitterRef<RozieListenEvent>> = [this.rozieOn0Fire, this.rozieOn1Fire, this.rozieOn2Fire, this.rozieOn3Fire, this.rozieOn4Fire, this.rozieOn5Fire, this.rozieOn6Fire, this.rozieOn7Fire];
  private readonly __controller = new RozieListenController(
    inject(ElementRef).nativeElement as EventTarget | null,
    (slot, event) => this.__fires[slot]?.emit(event),
  );

  ngOnChanges(changes: SimpleChanges): void {
    for (let i = 0; i < ROZIE_LISTEN_SLOTS; i++) {
      if (!changes[`rozieOn${i}`] && !changes[`rozieOn${i}Options`]) continue;
      const self = this as unknown as Record<string, unknown>;
      this.__controller.set(
        i,
        self[`rozieOn${i}`] as string | null | undefined,
        self[`rozieOn${i}Options`] as RozieListenOptions | null | undefined,
      );
    }
  }

  ngOnDestroy(): void {
    this.__controller.destroy();
  }
}
