// autosize.ts — fit a <textarea> to its content, between a minimum and an
// optional maximum number of rows.
//
// The math is split from the DOM read so it can be unit-tested without layout:
// `autosizeHeight` is pure; `applyAutosize` reads the element's computed box
// and writes `style.height` / `style.overflowY`. The element is typed
// structurally (style + scrollHeight) because the per-target `$refs` handle is
// a generic HTMLElement on several leaves.
//
// Vendored (byte-identical) into every `@rozie-ui/text-field-*` leaf's
// `src/internal/` by `scripts/codegen.mjs`, unit-tested once here (the dialog
// `scrollLock.ts` convention).

export interface AutosizeBox {
  /** The element's scrollHeight measured with `height: auto` (content + padding). */
  scrollHeight: number;
  lineHeight: number;
  paddingY: number;
  borderY: number;
  minRows: number | null;
  maxRows: number | null;
}

export interface AutosizeResult {
  /** The border-box height to apply, in px. */
  height: number;
  /** True when the content is taller than `maxRows` (the textarea should scroll). */
  capped: boolean;
}

const positive = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;

export function autosizeHeight(box: AutosizeBox): AutosizeResult {
  const chrome = box.paddingY + box.borderY;
  const contentHeight = box.scrollHeight + box.borderY;
  const minRows = positive(box.minRows);
  let maxRows = positive(box.maxRows);
  if (minRows !== null && maxRows !== null && maxRows < minRows) maxRows = null;

  const min = minRows === null ? 0 : minRows * box.lineHeight + chrome;
  const max = maxRows === null ? Number.POSITIVE_INFINITY : maxRows * box.lineHeight + chrome;

  const height = Math.min(Math.max(contentHeight, min), max);
  return { height, capped: contentHeight > max };
}

interface BoxStyle {
  lineHeight: string;
  fontSize: string;
  paddingTop: string;
  paddingBottom: string;
  borderTopWidth: string;
  borderBottomWidth: string;
}

interface AutosizeElement {
  style: { height: string; overflowY: string };
  readonly scrollHeight: number;
}

const px = (v: string): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const defaultGetStyle = (el: AutosizeElement): BoxStyle =>
  getComputedStyle(el as unknown as Element) as unknown as BoxStyle;

/**
 * Resize `el` to fit its content. `getStyle` is injectable for tests; it
 * defaults to `getComputedStyle`.
 */
export function applyAutosize(
  el: AutosizeElement | null | undefined,
  minRows: number | null,
  maxRows: number | null,
  getStyle: (el: AutosizeElement) => BoxStyle = defaultGetStyle,
): void {
  if (!el || !el.style) return;
  const cs = getStyle(el);
  // `line-height: normal` has no px value; browsers render it at roughly 1.2em.
  const lineHeight = cs.lineHeight === 'normal' ? px(cs.fontSize) * 1.2 : px(cs.lineHeight);

  // Collapse first so scrollHeight reports the content height, not the current box.
  el.style.height = 'auto';
  const { height, capped } = autosizeHeight({
    scrollHeight: el.scrollHeight,
    lineHeight,
    paddingY: px(cs.paddingTop) + px(cs.paddingBottom),
    borderY: px(cs.borderTopWidth) + px(cs.borderBottomWidth),
    minRows,
    maxRows,
  });
  el.style.height = `${height}px`;
  el.style.overflowY = capped ? 'auto' : 'hidden';
}
