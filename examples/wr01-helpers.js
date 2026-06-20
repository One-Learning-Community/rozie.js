// wr01-helpers.js — Phase 55 quick-task (WR-01) plain-JS helper module.
//
// A NON-partial (.js) module that the script partial `partialOuterD.rzts` imports
// `{ clampD }` from. Because the host (PartialInlineHostD.rozie) does NOT import
// clampD, inlining partialOuterD FRESHLY HOISTS this import into the host — the
// exact heterogeneous-block shape WR-01 regresses. A plain `.js` import is hoisted
// as-is (inlineScriptPartials only resolves/reads `.rzts`/`.rzjs`), so this file is
// never read at compile time; the byte-identity fixtures bootstrap with
// `sourceMap: false`. It is a real, tiny module anyway so the example is runnable.
export const clampD = (n) => Math.max(0, n);
