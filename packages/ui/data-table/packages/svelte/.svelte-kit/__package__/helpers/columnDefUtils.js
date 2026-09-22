// columnDefUtils.ts — pure column-def helpers extracted from columnBuilders.rzts
// (D-22, Phase 87 plan 87-01). Sigil-free, self-contained: no $props/$data/$emit/
// $computed/$onMount/$refs/$el/$expose/$watch, and no cross-partial host-symbol
// calls. Moved verbatim (bodies + explanatory comments intact) — behavior-neutral
// extraction, proven by dist-parity zero drift + the data-table VR gate.
// Prototype-safe id-keyed column resolution (T-48-PP): the `:columns` config array is
// applied FIRST (lower precedence), then the <Column> registry OVERRIDES by id (LWW).
// byId is a null-prototype object so a consumer column id of "__proto__"/"constructor"
// cannot pollute Object.prototype. Returns the table-core ColumnDef[]. (No per-column
// render callbacks — cells render via the single #cell/#header scoped slot on this
// component, dispatched by columnId; <Column> carries metadata only.)
const isSafeKey = (k) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
// wrapAggregationFn (phase 50 req-5, D-05, threat T-50-04): resolve a per-column
// aggregationFn straight onto the ColumnDef (no component-side switch — RESEARCH
// anti-pattern). A built-in NAME string ('sum'/'min'/'max'/'extent'/'mean'/'median'/
// 'unique'/'uniqueCount'/'count') passes through verbatim — table-core resolves it from its
// built-in `aggregationFns` map. A CUSTOM function `(columnId, leafRows, childRows) => any`
// is DEFENSIVELY WRAPPED (the runValidator precedent): a consumer fn runs per group, so a
// throw is coerced to `undefined` and can never crash getGroupedRowModel (DoS guard).
// Anything else → undefined (no aggregation; the cell renders as a placeholder).
const wrapAggregationFn = (fn) => {
    if (typeof fn === 'string')
        return fn;
    if (typeof fn !== 'function')
        return undefined;
    return (columnId, leafRows, childRows) => {
        try {
            return fn(columnId, leafRows, childRows);
        }
        catch (err) {
            return undefined;
        }
    };
};
// ── B1 (quick 260906-afh) — nested group leaf def index ─────────────────────────────
// LOOKUP-ONLY. This map is never fed to table-core (it does not replace/reshape the
// columnDefs() array table-core consumes for createTable/setOptions — that stays
// byte-identical); it exists purely so `defFor(colId)` (columnChrome.rzts) can resolve
// a NESTED leaf's def (a `columns:` group child) in O(1), the same as a top-level leaf.
//
// collectNestedDefs: depth-first walk of a `columns` array (each entry may itself carry
// a nested `columns` array — 3+ levels deep is supported). Writes `out[String(d.id)] = d`
// ONLY when the id is ABSENT from `out` — first-write-wins so a caller can pre-seed `out`
// with the higher-precedence top-level defs and this pass only ever fills GAPS.
const collectNestedDefs = (list, out) => {
    if (!Array.isArray(list))
        return;
    for (const d of list) {
        if (!d || d.id == null)
            continue;
        const id = String(d.id);
        if (!(id in out))
            out[id] = d;
        if (Array.isArray(d.columns))
            collectNestedDefs(d.columns, out);
    }
};
// indexDefsById: builds a null-prototype `{ id: def }` map from a `columnDefs()`-shaped
// array in TWO passes. Pass 1 registers every TOP-LEVEL def unconditionally — so any id
// that already resolves at HEAD (a top-level leaf OR a top-level group's OWN id) keeps
// resolving to the EXACT SAME def, the byte-identical-lookup guarantee for every
// pre-existing caller. Pass 2 walks each top-level entry's `columns` (if any) via
// collectNestedDefs, so a nested leaf only fills a GAP — it can never shadow a
// same-named top-level id (top-level wins regardless of array order). Object.create(null)
// (T-AFH-01): a consumer column id of "__proto__"/"constructor" cannot pollute
// Object.prototype through this map — mirrors the existing `byId` T-48-PP guard in
// columnBuilders.rzts.
const indexDefsById = (defs) => {
    const out = Object.create(null);
    if (!Array.isArray(defs))
        return out;
    for (const d of defs) {
        if (!d || d.id == null)
            continue;
        out[String(d.id)] = d;
    }
    for (const d of defs) {
        if (d && Array.isArray(d.columns))
            collectNestedDefs(d.columns, out);
    }
    return out;
};
// ── C5+C6 (quick 260906-cvo) — groupable-leaf collection for the #groupBar ──────────────
// C5: buildConfigDef's GROUP branch (columnBuilders.rzts) returns `{ id, header, columns }`
// with NO `groupable` key and no accessor, so the OLD `groupableColumns()` loop's
// `d.groupable === false` skip never fired for a group column — it was wrongly OFFERED to
// the bar even though a group column can never produce a grouping value.
// C6: that same loop walked TOP-LEVEL `columnDefs()` entries only, so a genuinely groupable
// NESTED leaf (a `columns:` group child) was never offered at all.
//
// collectGroupableLeafDefs: a DEDICATED depth-first walk, NOT a reuse of `indexDefsById`.
// `indexDefsById` is a LOOKUP index — it deliberately registers group columns too (a group
// id must keep resolving for `defFor`), and its insertion order is all-top-level-first-then-
// nested, which would both offer group columns AND hand the group bar an order that does not
// match the rendered header order. This walk instead: recurses into a `columns:` array
// WITHOUT ever pushing the group entry itself (closes C5 — a group column has no accessor
// and cannot be a grouping target, so an explicit `groupable: true` on a group entry is
// meaningless and is likewise never pushed); pushes every other (leaf) entry unless it opts
// out via `groupable === false` (closes C6 — nested leaves are now reachable); walks in
// DECLARATION order, depth-first, matching the rendered header order.
const collectGroupableLeafDefs = (defs) => {
    const out = [];
    if (!Array.isArray(defs))
        return out;
    for (const d of defs) {
        if (!d)
            continue;
        if (Array.isArray(d.columns)) {
            out.push(...collectGroupableLeafDefs(d.columns));
            continue;
        }
        if (d.groupable === false)
            continue;
        out.push(d);
    }
    return out;
};
// ── E-03: the `editor` union is FOUR built-ins plus the 'custom' gate ────────────────────
// `editorTypeOf` falls through to the plain text `<input>` for ANY unrecognised value, so a
// consumer writing `editor="date"` — a value the comparison page and the root README both
// advertised as a fifth built-in until the 260910 audit corrected them — got a text box with
// no error, no warning, and no hint that `EditorDate` is a DROP-IN reached through
// `editor="custom"` + an `#editor` fill. Same for any typo. The silent degradation was the
// defect; the docs half is already corrected.
//
// Pure and message-returning rather than warning in place, so the contract (which values are
// accepted, and what a rejected one is told) is unit-testable; `columnBuilders.rzts` owns the
// latch and the console.warn.
const EDITOR_KINDS = ['text', 'number', 'select', 'checkbox', 'custom'];
const editorKindWarning = (id, editor) => {
    if (editor == null)
        return null;
    if (typeof editor === 'string' && EDITOR_KINDS.indexOf(editor) !== -1)
        return null;
    return ('[rozie-data-table] column "' + String(id) + '": editor="' + String(editor) + '" is not a ' +
        'built-in editor. The built-ins are text | number | select | checkbox; anything else needs ' +
        'editor="custom" plus an #editor slot fill (that is how <EditorDate> is used). Falling back ' +
        'to the text input.');
};
// ── C-09: is this column spec EQUIVALENT to the one already registered? ──────────────────
// `<Column>`'s re-register `$watch` keys on `$props.editorOptions`, `$props.aggregationFn` and
// `$props.validate` — all reference types. The documented wiring for them is an INLINE literal
// (`:editorOptions="[{ value: 'a' }, …]"`, `:validate="(v) => v !== ''"`), and an inline
// literal is a NEW identity on every consumer render. So the watch fired every render,
// `registerColumn` whole-object-replaced `$data.colReg`, the parent's re-feed watch keys on
// `$data.colReg`, the re-feed re-rendered the parent, and the next render produced a new
// identity again: not a slow path, a feedback loop.
//
// Equality is by VALUE, with functions compared on identity first and `toString()` second.
// Source-text comparison is the point rather than a shortcut: an inline arrow re-created each
// render has a different identity and identical source, which is exactly the case that has to
// stop churning, while a genuinely different validator has different source and still
// re-registers. Depth-bounded so a consumer object graph with a cycle cannot hang the compare.
const columnSpecsEquivalent = (a, b, depth) => {
    const d = typeof depth === 'number' ? depth : 0;
    if (a === b)
        return true;
    if (d > 4)
        return false;
    const ta = typeof a;
    const tb = typeof b;
    if (ta !== tb)
        return false;
    if (ta === 'function') {
        try {
            return String(a) === String(b);
        }
        catch (err) {
            return false;
        }
    }
    if (ta === 'number')
        return a !== a && b !== b; // NaN === NaN, for this purpose
    if (a === null || b === null || ta !== 'object')
        return false;
    const aArr = Array.isArray(a);
    if (aArr !== Array.isArray(b))
        return false;
    if (aArr) {
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++)
            if (!columnSpecsEquivalent(a[i], b[i], d + 1))
                return false;
        return true;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length)
        return false;
    for (let i = 0; i < ka.length; i++) {
        const k = ka[i];
        if (!Object.prototype.hasOwnProperty.call(b, k))
            return false;
        if (!columnSpecsEquivalent(a[k], b[k], d + 1))
            return false;
    }
    return true;
};
export { isSafeKey, wrapAggregationFn, collectNestedDefs, indexDefsById, collectGroupableLeafDefs, EDITOR_KINDS, editorKindWarning, columnSpecsEquivalent };
