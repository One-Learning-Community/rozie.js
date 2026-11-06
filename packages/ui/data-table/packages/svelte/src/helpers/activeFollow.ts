// activeFollow.ts — the active cell follows its record (design doc 2026-11-06, Part 3).
// Sigil-free, self-contained: no $props/$data/$emit/$computed/$onMount/$refs/$el/$expose/
// $watch, and no cross-partial host-symbol calls. Pure decisions over row-id lists; the
// DataTable wiring (refreshRowModel → followActiveCell) applies them.

export type FollowResult =
  | { kind: 'stay' } // same index, nothing to do
  | { kind: 'move'; index: number } // follow to the new index
  | { kind: 'park' } // row gone after a view change / table write
  | { kind: 'clamp' } // row gone after navigation / reset → existing D-05 + B25

// resolveFollow: where does the active row (index `activeRow` in the PREVIOUS visible model,
// whose row ids are `prevIds`) live in the NEXT model (`nextIds`)?
//   • found at the same index → stay; found elsewhere → move there.
//   • not found → park on the header when the rows changed because of a view change (sort /
//     filter / refreshView) or one of the table's own writes — the next keystroke would
//     otherwise edit whichever record now sits at the old index — else clamp (paging, page
//     size, expand/collapse, an external data swap: navigation or reset).
//   • no previous model, or an index outside it → clamp (nothing to follow).
export function resolveFollow(
  prevIds: readonly string[] | null,
  activeRow: number,
  nextIds: readonly string[],
  viewChangeOrWrite: boolean,
): FollowResult {
  if (!prevIds || !Number.isInteger(activeRow) || activeRow < 0 || activeRow >= prevIds.length) {
    return { kind: 'clamp' }
  }
  const id = prevIds[activeRow]
  if (nextIds[activeRow] === id) return { kind: 'stay' }
  const index = nextIds.indexOf(id)
  if (index >= 0) return { kind: 'move', index }
  return viewChangeOrWrite ? { kind: 'park' } : { kind: 'clamp' }
}

// sameIdSequence: are both models the same rows in the same order? (A range can only survive
// a re-derive that keeps row membership AND order.)
export function sameIdSequence(a: readonly string[] | null, b: readonly string[]): boolean {
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
