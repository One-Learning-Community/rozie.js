// dateValue.ts — C-07. The ISO-date coercion `EditorDate` binds its native
// `<input type="date">` to. Pure and sigil-free (no $props/$data/...), so it is unit-testable
// and identical across all six leaves (helpers/ is vendored into each one by codegen).
//
// `EditorDate` seeded its draft with `String($props.value)` while its own `docs:` string —
// which ships as JSDoc in every leaf `.d.ts` — promised "String-coerced to an ISO
// `YYYY-MM-DD` string". `String()` is not that. A native date input accepts ONLY
// `YYYY-MM-DD` and silently renders BLANK for anything else, so every ordinary way of
// holding a date in a model produced an empty editor with no error:
//   a `Date` object          -> "Mon Sep 21 2026 00:00:00 GMT-0700 (…)"  -> blank
//   an ISO datetime string   -> "2026-09-21T00:00:00.000Z"               -> blank
//   an epoch number          -> "1789084800000"                          -> blank
//   a localised string       -> "09/21/2026"                             -> blank
// Only a value that was ALREADY `YYYY-MM-DD` worked, i.e. the one case needing no coercion.

/**
 * Coerce an arbitrary cell value to the `YYYY-MM-DD` string a native date input accepts.
 * Returns `''` for anything that cannot be read as a date — which is what the input shows for
 * "no date", so an unparseable value degrades to empty rather than to a broken control.
 */
const toIsoDateString = (v: unknown): string => {
  if (v == null || v === '') return ''

  // Already the target format.
  if (typeof v === 'string') {
    const s = v.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    // An ISO datetime: take the DATE PART AS WRITTEN. Parsing it and re-formatting from local
    // parts shifts the day for anyone west of UTC ('2026-09-21T00:00:00Z' would render as the
    // 20th in UTC-5), which is the classic off-by-one this branch exists to avoid.
    const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(s)
    if (iso) return iso[1]
    return fromDate(new Date(s))
  }

  if (typeof v === 'number') return Number.isFinite(v) ? fromDate(new Date(v)) : ''
  if (typeof v === 'object' && typeof (v as Date).getTime === 'function') return fromDate(v as Date)
  return ''
}

/**
 * Format a Date as `YYYY-MM-DD` from its LOCAL parts. Local, not UTC: the input renders a
 * calendar day, and `toISOString()` would show the previous day for anyone west of UTC on a
 * midnight-local value.
 */
const fromDate = (d: Date): string => {
  const t = d.getTime()
  if (!Number.isFinite(t)) return ''
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}

export { toIsoDateString }
