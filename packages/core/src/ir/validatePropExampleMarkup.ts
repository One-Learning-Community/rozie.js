/**
 * validatePropExampleMarkup — Phase 81 Plan 03 (R3 / SPEC decision D-04).
 *
 * The ONE place a rejected `docs.example` becomes a diagnostic. It runs
 * BEFORE the per-target emit switch — that ordering is what makes the
 * empty-`code` guarantee (D-04: hard error, always) uniform across all six
 * targets, and it exists instead of threading a diagnostics channel through
 * `renderExampleMarkup`'s nine pure per-target attribute/element builders
 * (Plan 01), which stay total and never throw.
 *
 * Reuses Plan 01's `classifyExampleMarkup` — the SAME oracle
 * `renderExampleMarkup` consults to decide whether to render or pass an
 * example through verbatim. One classifier, two consumers, means the
 * renderer and this diagnostic can never disagree about what is supported.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Mutates `diagnostics` in
 * place; NEVER mutates `ir`. Mirrors the signature shape of the sibling
 * pre-emit validator `validatePortalScopedStyle` — a pure `(ir, ...,
 * diagnostics) => void` pass with no cache or resolver of its own — except
 * this pass also takes `filename` directly (conditional-spread onto the
 * pushed diagnostic, matching the convention already used at other
 * `compile.ts`-adjacent push sites such as the ROZ977 guard) since it reads
 * only `ir.props` and has no other dependency to thread.
 *
 * @experimental — shape may change before v1.0
 */
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent } from './types.js';
import { classifyExampleMarkup } from '../codegen/renderExampleMarkup.js';

/** Constructs the renderer covers — echoed in the diagnostic's `hint`. */
const SUPPORTED_CONSTRUCTS_HINT =
  'The rendered example supports component and element tags, static ' +
  'attributes, colon-prefixed bindings (:prop), at-prefixed event handlers ' +
  '(@event), two-way model bindings that name their prop (r-model:propName), ' +
  'and nested children. Demonstrate anything else in the family README instead.';

/**
 * Validate every declared prop's `docs.example` against
 * `classifyExampleMarkup`, pushing an error-severity ROZ097 diagnostic for
 * any example classified `unsupported`.
 *
 * A prop with no `docs`, or whose `example` is absent, empty, or
 * whitespace-only, is skipped — that mirrors `buildPropJsdoc`'s own
 * presence gate (Plan 02, R4): an example the builder would never emit an
 * `@example` tag for cannot be a compile error.
 *
 * @param ir          the lowered IRComponent (reads only `ir.props`)
 * @param filename    the host `.rozie` filename, when known — conditionally
 *                    spread onto the pushed diagnostic (never `filename:
 *                    undefined` under `exactOptionalPropertyTypes`)
 * @param diagnostics accumulator, mutated in place
 */
export function validatePropExampleMarkup(
  ir: IRComponent,
  filename: string | undefined,
  diagnostics: Diagnostic[],
): void {
  for (const prop of ir.props) {
    const example = prop.docs?.example;
    if (example === undefined || example.trim() === '') continue;

    const classification = classifyExampleMarkup(example, filename);
    if (classification.kind !== 'unsupported') continue; // 'markup' and 'non-markup' both pass

    diagnostics.push({
      code: RozieErrorCode.PROP_DOCS_EXAMPLE_UNSUPPORTED_CONSTRUCT,
      severity: 'error',
      message: `Prop '${prop.name}' has a 'docs.example' that cannot be rendered as consumer markup — ${classification.reason}.`,
      loc: prop.sourceLoc,
      hint: SUPPORTED_CONSTRUCTS_HINT,
      ...(filename !== undefined ? { filename } : {}),
    });
  }
}
