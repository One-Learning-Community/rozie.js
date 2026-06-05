import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface EventCtx {
  $implicit: { arg: any };
  arg: any;
}

@Component({
  selector: 'rozie-full-calendar',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-fullcalendar" #__rozieRoot></div>


    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [`
    .rozie-fullcalendar {
      width: 100%;
      font-size: 0.875rem;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FullCalendar),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class FullCalendar {
  events = input<any[]>((() => [])());
  view = model<string>('dayGridMonth');
  weekends = input<boolean>(true);
  editable = input<boolean>(true);
  selectable = input<boolean>(true);
  height = input<number>(480);
  defaultColor = input<string>('#3b82f6');
  locale = input<string>('en');
  firstDay = input<number>(0);
  slotDuration = input<string>('00:30:00');
  nowIndicator = input<boolean>(false);
  headerToolbar = input<Record<string, any>>((() => ({
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  }))());
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  eventClick = output<unknown>();
  dateClick = output<unknown>();
  eventDrop = output<unknown>();
  select = output<unknown>();
  eventResize = output<unknown>();
  datesSet = output<unknown>();
  @ContentChild('event', { read: TemplateRef }) eventTpl?: TemplateRef<EventCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _eventTpl = contentChild('event', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;
  private __rozieWatchInitial_6 = true;
  private __rozieWatchInitial_7 = true;
  private __rozieWatchInitial_8 = true;
  private __rozieWatchInitial_9 = true;
  private __rozieWatchInitial_10 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.events())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (!this.instance) return;
      this.instance.removeAllEvents();
      for (const e of v as any) this.instance.addEvent(this.normalizeEvent(e));
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.view())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => {
      if (!this.instance || !v) return;
      if (v === this.instance.view.type) return;
      this.suppressViewSync = true;
      this.instance.changeView(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.weekends())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } ((v: any) => this.instance?.setOption('weekends', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.editable())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => this.instance?.setOption('editable', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.selectable())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => this.instance?.setOption('selectable', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.height())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => this.instance?.setOption('height', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.locale())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } ((v: any) => this.instance?.setOption('locale', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.firstDay())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((v: any) => this.instance?.setOption('firstDay', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.slotDuration())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } ((v: any) => this.instance?.setOption('slotDuration', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.nowIndicator())(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } ((v: any) => this.instance?.setOption('nowIndicator', v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.headerToolbar())(); untracked(() => { if (this.__rozieWatchInitial_10) { this.__rozieWatchInitial_10 = false; return; } ((v: any) => this.instance?.setOption('headerToolbar', v))(__watchVal); }); });
  }

  ngAfterViewInit() {
    const portals = {
      event: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._eventTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-event', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
    };
    const opts = {
      plugins: this.PLUGINS,
      initialView: this.view(),
      weekends: this.weekends(),
      editable: this.editable(),
      selectable: this.selectable(),
      height: this.height(),
      locale: this.locale(),
      firstDay: this.firstDay(),
      slotDuration: this.slotDuration(),
      nowIndicator: this.nowIndicator(),
      events: this.events().map(this.normalizeEvent),
      // D-02: a consumer-passed headerToolbar fully REPLACES the built-in
      // toolbar; the built-in default lives in the `headerToolbar` prop default.
      headerToolbar: this.headerToolbar(),
      eventClick: (info: any) => {
        this.eventClick.emit({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent
        });
      },
      dateClick: (info: any) => {
        this.dateClick.emit({
          date: info.date,
          dateStr: info.dateStr,
          allDay: info.allDay
        });
      },
      eventDrop: (info: any) => {
        this.eventDrop.emit({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          delta: info.delta
        });
      },
      select: (info: any) => {
        this.select.emit({
          start: info.start,
          end: info.end,
          startStr: info.startStr,
          endStr: info.endStr,
          allDay: info.allDay
        });
      },
      eventResize: (info: any) => {
        this.eventResize.emit({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          startDelta: info.startDelta,
          endDelta: info.endDelta
        });
      },
      datesSet: (info: any) => {
        this.datesSet.emit({
          start: info.start,
          end: info.end,
          view: info.view.type
        });
      },
      viewDidMount: (info: any) => {
        // viewDidMount fires both on initial mount AND on changeView calls.
        // Same round-trip guard pattern as Flatpickr / LeafletMap.
        if (this.suppressViewSync) {
          this.suppressViewSync = false;
          return;
        }
        if (info.view.type !== this.view()) this.view.set(info.view.type), this.__rozieCvaOnChange(info.view.type);
      }
    };

    // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
    // slot, route every cell render through it. The portal helper mounts the
    // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
    // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
    // handle is returned to FullCalendar so it cleans up the mounted tree when
    // the cell is removed. Consumers that don't fill the slot get FullCalendar's
    // default rendering (title text) — guarded by `$slots.event`.
    // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
    // slot, route every cell render through it. The portal helper mounts the
    // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
    // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
    // handle is returned to FullCalendar so it cleans up the mounted tree when
    // the cell is removed. Consumers that don't fill the slot get FullCalendar's
    // default rendering (title text) — guarded by `$slots.event`.
    if ((this.eventTpl ?? this.templates()?.['event'])) {
      opts.eventContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.event(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    this.instance = new Calendar(this.__rozieRoot()!.nativeElement, opts);
    this.instance.render();
    this.__rozieDestroyRef.onDestroy(() => this.instance?.destroy());
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
  }

  instance: any = null;
  suppressViewSync = false;
  PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];
  normalizeEvent = (e: any) => {
    // Object spread + template-literal default — common reconcile shape:
    // pass user props through, but stamp a sensible title fallback and
    // honor the wrapper's defaultColor only when the event omits one.
    return {
      ...e,
      title: e.title || `Event ${e.id ?? '(no id)'}`,
      color: e.color || this.defaultColor()
    };
  };
  getApi = () => {
    return this.instance;
  };
  changeView = (...a: any[]) => {
    return this.instance?.changeView(...a);
  };
  addEvent = (...a: any[]) => {
    return this.instance?.addEvent(...a);
  };
  removeEvent = (id: any) => {
    this.instance?.getEventById(id)?.remove();
  };
  today = () => {
    this.instance?.today();
  };
  prev = () => {
    this.instance?.prev();
  };
  next = () => {
    this.instance?.next();
  };
  gotoDate = (...a: any[]) => {
    this.instance?.gotoDate(...a);
  };

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  private __rozieCvaDisabled = signal(false);

  writeValue(v: string | null): void {
    this.view.set(v ?? 'dayGridMonth');
  }
  registerOnChange(fn: (v: string) => void): void {
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
    _dir: FullCalendar,
    _ctx: unknown,
  ): _ctx is EventCtx {
    return true;
  }
}

export default FullCalendar;
