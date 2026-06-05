/**
 * Hand-kept event-description manifest for @rozie-ui/fullcalendar.
 *
 * Events are derived structurally from the source via `ir.emits`
 * (`eventClick`, `dateClick`, `eventDrop`, `select`, `eventResize`,
 * `datesSet`, `eventMouseEnter`, `eventMouseLeave`, `unselect`, `loading`,
 * `eventsSet`), but their human-readable descriptions + payload prose have no
 * first-class `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every
 * emitted event name has an entry here and throws if one is missing.
 *
 * Payload shapes are PINNED by REQ-27-3 (do not improvise).
 */
export const eventManifest = {
  eventClick:
    'Fired when a calendar event is clicked. Payload `{ event: { id, title, start, end }, jsEvent, view }`.',
  dateClick:
    'Fired when an empty date/time cell is clicked. Payload `{ date, dateStr, allDay, view }`.',
  eventDrop:
    'Fired after an event is dragged to a new date/time. Payload `{ event: { id, title, start, end }, delta }`.',
  select:
    'Fired when a date/time range is selected by drag (requires `selectable`). Payload `{ start, end, startStr, endStr, allDay }`.',
  eventResize:
    'Fired after an event is resized by dragging its edge (requires `editable`). Payload `{ event: { id, title, start, end }, startDelta, endDelta }`.',
  datesSet:
    'Fired whenever the visible date range changes (navigation or view switch). Payload `{ start, end, view }` where `view` is the active view type string.',
  eventMouseEnter:
    'Fired when the pointer enters a calendar event. Payload `{ event: { id, title, start, end }, jsEvent }` (mirrors `eventClick`).',
  eventMouseLeave:
    'Fired when the pointer leaves a calendar event. Payload `{ event: { id, title, start, end }, jsEvent }` (mirrors `eventMouseEnter`).',
  unselect:
    'Fired when a previously selected date/time range is cleared. Payload `{ jsEvent }`.',
  loading:
    'Fired when the calendar begins or finishes loading events (e.g. from an event source). Payload `{ isLoading }` boolean.',
  eventsSet:
    'Fired after the set of rendered events changes. Payload `{ events: [{ id, title, start, end }, …] }` — the normalized current event set, for persistence/sync consumers.',
};

export default eventManifest;
