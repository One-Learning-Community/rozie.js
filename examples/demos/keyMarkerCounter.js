// keyMarkerCounter.js — shared mount-marker source for the SortableList keying
// behavioral fixture (quick 260620-o6a).
//
// This is a plain-module MUTATOR, deliberately NOT a `.rozie` <script> top-level
// `let`. The distinction is load-bearing for the pair-invariant reorder test:
//   - An ES module is a SINGLETON, so every KeyMarkerRow mount across every row
//     (on all six targets) shares this one `n`, stamping a DISTINCT marker per
//     row. Distinct markers are exactly what makes the (label -> mark) pair-set
//     assertion non-vacuous.
//   - A `.rozie` <script> top-level `let n = 0` would be PER-INSTANCE on all six
//     targets, so every row would mark `#0` and the pair-set test would pass
//     VACUOUSLY even under the position-keying corruption bug.
//   - An imported binding mutated at the consumer (`import { n }; n++`) is a
//     TypeError (ESM bindings are read-only) — hence the exported mutator fn.
let n = 0;

/** Return the next distinct mount marker (a stable string per call). */
export const nextKeyMark = () => String(n++);
