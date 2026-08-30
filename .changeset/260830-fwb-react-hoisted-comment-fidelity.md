---
"@rozie/core": patch
"@rozie-ui/chartjs-react": patch
"@rozie-ui/codemirror-react": patch
"@rozie-ui/combobox-react": patch
"@rozie-ui/command-palette-react": patch
"@rozie-ui/cropper-react": patch
"@rozie-ui/data-table-react": patch
"@rozie-ui/date-picker-react": patch
"@rozie-ui/embla-react": patch
"@rozie-ui/otp-react": patch
"@rozie-ui/pdf-react": patch
"@rozie-ui/popover-react": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/sortable-list-react": patch
"@rozie-ui/tags-react": patch
"@rozie-ui/tiptap-react": patch
"@rozie-ui/toast-react": patch
"@rozie-ui/wavesurfer-react": patch
---

React dropped the author's leading comments on any top-level `const f = () => {…}`. The
emitter rebuilds those as `function f() {…}` so the binding hoists (a real TDZ fix), but it
returned the bare synthetic node — no source position and no comments attached — so
`@babel/generator` printed the declaration and silently discarded everything documenting it.
Measured against the shipped corpus, that was 683 of React's 899 lost comments; Solid, whose
identically-named `tryHoistArrowToFunction` has always ended with `t.inherits(fn, stmt)`,
lost none. React simply never got that line.

Restoring it alone is only half the mechanism, and the half on its own is a regression. A
comment authored between a hoisted module-`let` and the declaration below it survives on the
inline path (one parse attaches the comment object to both neighbours, so the successor still
carries it) but not across a `<script src>` partial boundary, where the spliced successor
comes from a different parse with nothing attached. There the comment lives only on the
removed `let`'s trailing side and dies with the statement — so the inline host printed a
comment the partial-inlined host could not, and the two stopped being byte-identical.

Quick task 260829-j18 re-homed a removed statement's LEADING comments onto a surviving
neighbour but deliberately skipped the trailing side, on the reasoning that a removed
statement's trailing comments are the same objects Babel attached as the next statement's
leading comments, so that side already had an owner. That holds for an inline-authored
`<script>` and fails at a splice boundary. `hoistModuleLet` now re-homes the trailing side
too, onto the nearest following survivor, deduped by comment object IDENTITY — which is what
keeps the inline case from double-printing, since there the object is already present on the
successor.

The two changes ship together and are asserted together: `dist-parity`'s multi-boundary
"DataTable-shaped permanent guard" goes red with either half missing, and green with both.

Across the 38 regenerated React leaves this restores **2655 comments, with zero comments
dropped and zero non-comment bytes changed** — verified by parsing each file before and
after, comparing the parser's own comment list as a multiset, and comparing
`generate(ast, { comments: false })` on both sides, rather than by reading the diff. The
dist-parity fixture rebless was verified the same way (55 comments restored, no code delta).

One cosmetic wart, not fixed here: in `@rozie-ui/data-table-react` a single restored comment
prints on the same line as the preceding function's closing brace (`} // …`) instead of
starting its own line, because it is re-homed as the previous statement's trailing comment.
The block still reads immediately above the declaration it documents and the AST is
unaffected. Output prettiness stays a v2 concern.

Nine further React leaves drifted the same comment-only way but are deliberately absent from
the front matter — `@rozie-ui/dialog-react`, `lexical-react`, `listbox-react`,
`maplibre-react`, `number-field-react`, `pagination-react`, `resizable-react`,
`slider-react` and `switch-react` are all in `.changeset/config.json`'s `ignore` list, and
listing an ignored package beside a non-ignored one makes `changeset status` fail outright.
