// rangeFill.ts — which cells a range fill writes. Pure, sigil-free.
//
// A range fill (Ctrl/Cmd+Enter in an editor, or Space on a checkbox range) writes one value
// down the ACTIVE cell's column for every row the range covers. Other columns of a
// multi-column range are left alone: one typed value rarely makes sense in several columns.
// With no range, or an active cell outside it, the fill is the active cell alone (size 1).

export interface FillRange { r0: number; r1: number; c0: number; c1: number }
export interface FillTargets { top: number; bottom: number; col: number; size: number }

const rangeFillTargets = (range: FillRange | null, activeRow: number, activeCol: number): FillTargets => {
  const single = { top: activeRow, bottom: activeRow, col: activeCol, size: 1 }
  if (!range) return single
  const top = Math.min(range.r0, range.r1)
  const bottom = Math.max(range.r0, range.r1)
  const left = Math.min(range.c0, range.c1)
  const right = Math.max(range.c0, range.c1)
  if (activeCol < left || activeCol > right || activeRow < top || activeRow > bottom) return single
  return { top, bottom, col: activeCol, size: bottom - top + 1 }
}

export { rangeFillTargets }
