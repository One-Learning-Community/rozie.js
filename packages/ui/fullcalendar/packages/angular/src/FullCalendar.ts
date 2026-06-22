import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, inject, input, model, output, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface EventCtx {
  $implicit: { arg: any };
  arg: any;
}

interface DayCellCtx {
  $implicit: { arg: any };
  arg: any;
}

interface DayHeaderCtx {
  $implicit: { arg: any };
  arg: any;
}

interface SlotLabelCtx {
  $implicit: { arg: any };
  arg: any;
}

interface WeekNumberCtx {
  $implicit: { arg: any };
  arg: any;
}

interface NowIndicatorContentCtx {
  $implicit: { arg: any };
  arg: any;
}

interface MoreLinkCtx {
  $implicit: { arg: any };
  arg: any;
}

interface AllDayContentCtx {
  $implicit: { arg: any };
  arg: any;
}

interface SlotLaneContentCtx {
  $implicit: { arg: any };
  arg: any;
}

interface NoEventsContentCtx {
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
  options = input<Record<string, any>>((() => ({}))());
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  eventClick = output<unknown>();
  dateClick = output<unknown>();
  eventDrop = output<unknown>();
  select = output<unknown>();
  eventResize = output<unknown>();
  datesSet = output<unknown>();
  eventMouseEnter = output<unknown>();
  eventMouseLeave = output<unknown>();
  unselect = output<unknown>();
  loading = output<unknown>();
  eventsSet = output<unknown>();
  @ContentChild('event', { read: TemplateRef }) eventTpl?: TemplateRef<EventCtx>;
  @ContentChild('dayCell', { read: TemplateRef }) dayCellTpl?: TemplateRef<DayCellCtx>;
  @ContentChild('dayHeader', { read: TemplateRef }) dayHeaderTpl?: TemplateRef<DayHeaderCtx>;
  @ContentChild('slotLabel', { read: TemplateRef }) slotLabelTpl?: TemplateRef<SlotLabelCtx>;
  @ContentChild('weekNumber', { read: TemplateRef }) weekNumberTpl?: TemplateRef<WeekNumberCtx>;
  @ContentChild('nowIndicatorContent', { read: TemplateRef }) nowIndicatorContentTpl?: TemplateRef<NowIndicatorContentCtx>;
  @ContentChild('moreLink', { read: TemplateRef }) moreLinkTpl?: TemplateRef<MoreLinkCtx>;
  @ContentChild('allDayContent', { read: TemplateRef }) allDayContentTpl?: TemplateRef<AllDayContentCtx>;
  @ContentChild('slotLaneContent', { read: TemplateRef }) slotLaneContentTpl?: TemplateRef<SlotLaneContentCtx>;
  @ContentChild('noEventsContent', { read: TemplateRef }) noEventsContentTpl?: TemplateRef<NoEventsContentCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _eventTpl = contentChild('event', { read: TemplateRef });
  private _dayCellTpl = contentChild('dayCell', { read: TemplateRef });
  private _dayHeaderTpl = contentChild('dayHeader', { read: TemplateRef });
  private _slotLabelTpl = contentChild('slotLabel', { read: TemplateRef });
  private _weekNumberTpl = contentChild('weekNumber', { read: TemplateRef });
  private _nowIndicatorContentTpl = contentChild('nowIndicatorContent', { read: TemplateRef });
  private _moreLinkTpl = contentChild('moreLink', { read: TemplateRef });
  private _allDayContentTpl = contentChild('allDayContent', { read: TemplateRef });
  private _slotLaneContentTpl = contentChild('slotLaneContent', { read: TemplateRef });
  private _noEventsContentTpl = contentChild('noEventsContent', { read: TemplateRef });
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
  private __rozieWatchInitial_11 = true;

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
    effect(() => { const __watchVal = (() => this.options())(); untracked(() => { if (this.__rozieWatchInitial_11) { this.__rozieWatchInitial_11 = false; return; } ((v: any) => {
      if (!this.instance) return;
      for (const k in v) this.instance.setOption(k, v[k]);
    })(__watchVal); }); });
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
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      dayCell: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._dayCellTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-dayCell', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      dayHeader: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._dayHeaderTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-dayHeader', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      slotLabel: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._slotLabelTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-slotLabel', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      weekNumber: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._weekNumberTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-weekNumber', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      nowIndicatorContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._nowIndicatorContentTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-nowIndicatorContent', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      moreLink: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._moreLinkTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-moreLink', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      allDayContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._allDayContentTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-allDayContent', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      slotLaneContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._slotLaneContentTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-slotLaneContent', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      noEventsContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this._noEventsContentTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-noEventsContent', '5589629a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
    };
    const __options = this.options();
    const opts: Record<string, any> = {
      // :options passthrough spread FIRST — the curated keys below + the portal
      // *Content handlers added after this object override any colliding key, so
      // an explicitly-bound prop (e.g. :height) wins over options.height.
      //
      // EXCEPTION — `plugins` is the one curated key that AUGMENTS rather than
      // overrides: instead of clobbering a consumer-supplied `:options.plugins`,
      // it MERGES the always-on baked-in defaults (dayGrid + timeGrid +
      // interaction) with any consumer-added plugins. This makes the wrapper
      // consumer-extensible (opt-in) — a consumer can engage list/rrule/premium/
      // etc. via `:options="{ plugins: [listPlugin] }"` with NO bundle cost and NO
      // per-plugin wrapper code. FullCalendar dedupes plugins by identity, so a
      // consumer re-passing a default is harmless.
      ...__options,
      plugins: [...this.PLUGINS, ...(__options?.plugins ?? [])],
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
      eventMouseEnter: (info: any) => {
        this.eventMouseEnter.emit({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent
        });
      },
      eventMouseLeave: (info: any) => {
        this.eventMouseLeave.emit({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent
        });
      },
      unselect: (info: any) => {
        this.unselect.emit({
          jsEvent: info.jsEvent
        });
      },
      loading: (isLoading: any) => {
        // FullCalendar's `loading` callback receives a bare boolean (not an info
        // object) — normalize to the structured `{ isLoading }` payload shape.
        this.loading.emit({
          isLoading
        });
      },
      eventsSet: (events: any) => {
        // `eventsSet` receives the array of current EventApi objects — map each to
        // the normalized floor shape for persistence/sync consumers.
        this.eventsSet.emit({
          events: events.map((e: any) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end
          }))
        });
      },
      viewDidMount: (info: any) => {
        // viewDidMount fires both on initial mount AND on changeView calls.
        // Same round-trip guard pattern as Flatpickr / LeafletMap.
        if (this.suppressViewSync) {
          this.suppressViewSync = false;
          return;
        }
        if (info.view.type !== this.view()) this.view.set(info.view.type);
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
    // The 9 remaining *Content portal-slots — wired identically to `event`, one
    // per FullCalendar per-cell content hook. Each guarded by its own slot so
    // unfilled slots keep FullCalendar's default rendering. (10 portal-slots total
    // counting `event` above; allDayContent + slotLaneContent are the two timeGrid
    // axis/lane hooks, and noEventsContent is the list-view "no events" hook —
    // inert unless the consumer engages @fullcalendar/list via :options.plugins.)
    //
    // NOTE the `nowIndicatorContent` slot is named for its FullCalendar engine
    // hook (`nowIndicatorContent`) so it does NOT clash with the boolean
    // `nowIndicator` PROP — a slot name that equals a declared prop name is now a
    // hard compile error (ROZ127 SLOT_PROP_NAME_COLLISION), because Svelte 5
    // unifies snippets and props into one `$props` namespace.
    // The 9 remaining *Content portal-slots — wired identically to `event`, one
    // per FullCalendar per-cell content hook. Each guarded by its own slot so
    // unfilled slots keep FullCalendar's default rendering. (10 portal-slots total
    // counting `event` above; allDayContent + slotLaneContent are the two timeGrid
    // axis/lane hooks, and noEventsContent is the list-view "no events" hook —
    // inert unless the consumer engages @fullcalendar/list via :options.plugins.)
    //
    // NOTE the `nowIndicatorContent` slot is named for its FullCalendar engine
    // hook (`nowIndicatorContent`) so it does NOT clash with the boolean
    // `nowIndicator` PROP — a slot name that equals a declared prop name is now a
    // hard compile error (ROZ127 SLOT_PROP_NAME_COLLISION), because Svelte 5
    // unifies snippets and props into one `$props` namespace.
    if ((this.dayCellTpl ?? this.templates()?.['dayCell'])) {
      opts.dayCellContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.dayCell(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((this.dayHeaderTpl ?? this.templates()?.['dayHeader'])) {
      opts.dayHeaderContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.dayHeader(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((this.slotLabelTpl ?? this.templates()?.['slotLabel'])) {
      opts.slotLabelContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.slotLabel(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((this.weekNumberTpl ?? this.templates()?.['weekNumber'])) {
      opts.weekNumberContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.weekNumber(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((this.nowIndicatorContentTpl ?? this.templates()?.['nowIndicatorContent'])) {
      opts.nowIndicatorContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.nowIndicatorContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((this.moreLinkTpl ?? this.templates()?.['moreLink'])) {
      opts.moreLinkContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.moreLink(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((this.allDayContentTpl ?? this.templates()?.['allDayContent'])) {
      opts.allDayContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.allDayContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((this.slotLaneContentTpl ?? this.templates()?.['slotLaneContent'])) {
      opts.slotLaneContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.slotLaneContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    // noEventsContent — the list-view "no events to display" hook. Pre-declared
    // and wired like the other 9 *Content slots, but INERT unless the consumer
    // (a) engages @fullcalendar/list via the now-merged :options.plugins AND
    // (b) shows a list view (listWeek/listDay/listMonth) with ZERO events. With
    // the bundled-only plugin set there is no list view, so this hook never fires
    // — by design, documented, zero bundle cost.
    // noEventsContent — the list-view "no events to display" hook. Pre-declared
    // and wired like the other 9 *Content slots, but INERT unless the consumer
    // (a) engages @fullcalendar/list via the now-merged :options.plugins AND
    // (b) shows a list view (listWeek/listDay/listMonth) with ZERO events. With
    // the bundled-only plugin set there is no list view, so this hook never fires
    // — by design, documented, zero bundle cost.
    if ((this.noEventsContentTpl ?? this.templates()?.['noEventsContent'])) {
      opts.noEventsContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.noEventsContent(node, {
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
  getDate = () => {
    return this.instance ? this.instance.getDate() : null;
  };
  getEvents = () => {
    return this.instance ? this.instance.getEvents() : [];
  };
  scrollToTime = (...a: any[]) => {
    this.instance?.scrollToTime(...a);
  };
  updateSize = () => {
    this.instance?.updateSize();
  };
  prevYear = () => {
    this.instance?.prevYear();
  };
  nextYear = () => {
    this.instance?.nextYear();
  };
  selectRange = (...a: any[]) => {
    this.instance?.select(...a);
  };
  clearSelection = () => {
    this.instance?.unselect();
  };

  static ngTemplateContextGuard(
    _dir: FullCalendar,
    _ctx: unknown,
  ): _ctx is EventCtx | DayCellCtx | DayHeaderCtx | SlotLabelCtx | WeekNumberCtx | NowIndicatorContentCtx | MoreLinkCtx | AllDayContentCtx | SlotLaneContentCtx | NoEventsContentCtx {
    return true;
  }
}

export default FullCalendar;
