/**
 * Coerce an arbitrary cell value to the `YYYY-MM-DD` string a native date input accepts.
 * Returns `''` for anything that cannot be read as a date — which is what the input shows for
 * "no date", so an unparseable value degrades to empty rather than to a broken control.
 */
declare const toIsoDateString: (v: unknown) => string;
export { toIsoDateString };
