/**
 * `<script>` block parser (PARSE-03).
 *
 * Per PARSE-03 / RESEARCH.md Risk 5 (trust-erosion floor): user code MUST
 * survive verbatim through to the AST — including `console.log` calls,
 * comments, and multiple `$onMount`/`$onUnmount` calls in source order. We
 * never strip, never transform at parse time. This is the load-bearing trust
 * promise of the toolchain.
 *
 * Babel options used (verified per RESEARCH.md §"Code Examples"):
 *  - sourceType: 'module'      — supports top-level import/export
 *  - attachComment: true       — leading/trailing comments attached to neighbours
 *  - errorRecovery: true       — collect parse errors instead of throwing on first
 *  - startIndex/startLine/startColumn — Pitfall 2: pass all three together
 *
 * D-08 contract: even if Babel throws despite errorRecovery (truly
 * unrecoverable input), we catch and return `{ node: null, diagnostics:
 * [ROZ031] }`. The function NEVER propagates exceptions to callers.
 *
 * ROZxxx codes owned here:
 *  - ROZ030  Recoverable script syntax error (Babel collected via errorRecovery)
 *  - ROZ031  Unrecoverable script syntax error (Babel threw despite errorRecovery)
 *
 * @experimental — shape may change before v1.0
 */
import { parse as babelParse } from '@babel/parser';
import type { File } from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { ScriptAST } from '../ast/blocks/ScriptAST.js';
import { parserPositionFor } from './parserPosition.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ParseScriptResult {
  node: ScriptAST | null;
  diagnostics: Diagnostic[];
}

/**
 * Parse a `<script>` block into a Babel `File` AST.
 *
 * @param content - the raw `<script>` block body text.
 * @param contentLoc - byte span of the content inside the original `.rozie` file.
 * @param source - the full `.rozie` source (for position accounting).
 * @param filename - optional filename for diagnostics / `sourceFilename`.
 * @param lang - the resolved `lang=` attribute from the source `<script>` tag
 *   (Phase 9). When `'ts'`, the Babel `typescript` parser plugin is enabled so
 *   author type annotations parse into `TS*` AST nodes. Any other value (or
 *   undefined) keeps the plugin off — byte-identical to plain-JS parsing.
 */
export function parseScript(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
  lang?: string,
): ParseScriptResult {
  const diagnostics: Diagnostic[] = [];
  const pos = parserPositionFor(source, contentLoc);

  let program: File;
  try {
    program = babelParse(content, {
      sourceType: 'module',
      ...pos,
      ...(filename !== undefined ? { sourceFilename: filename } : {}),
      attachComment: true,
      errorRecovery: true,
      // Plugin policy (Phase 9):
      //   - 'typescript' is enabled ONLY for `<script lang="ts">` (lang === 'ts').
      //     A plain `<script>` (or any other lang value) keeps plugins: [] —
      //     byte-identical to pre-Phase-9 plain-JavaScript parsing.
      //   - 'jsx' stays OFF unconditionally — Rozie does not accept JSX in
      //     <script> (PROJECT.md Out of Scope: "JSX as an input syntax"). With
      //     jsx off and typescript on, `<T>expr` parses as a TS type assertion,
      //     which is the desired behavior — do NOT "fix" this by enabling jsx.
      plugins: lang === 'ts' ? ['typescript'] : [],
    });
  } catch (err: unknown) {
    const e = err as { message?: string; loc?: { line: number; column: number; index?: number } };
    diagnostics.push({
      code: RozieErrorCode.SCRIPT_UNRECOVERABLE,
      severity: 'error',
      message: `Unrecoverable script syntax error: ${e.message ?? 'parse failed'}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
    return { node: null, diagnostics };
  }

  // Lift recoverable errors Babel collected under errorRecovery.
  // For parse() (vs parseExpression), errors live on the File node.
  const errors =
    (program as unknown as { errors?: Array<{ loc?: { index?: number; line?: number; column?: number }; message?: string }> })
      .errors ?? [];
  for (const e of errors) {
    diagnostics.push({
      code: RozieErrorCode.SCRIPT_PARSE_ERROR,
      severity: 'error',
      message: `Script syntax error: ${e.message ?? ''}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  return {
    node: {
      type: 'ScriptAST',
      loc: contentLoc,
      program,
      // Phase 9: carry the resolved `lang` onto the ScriptAST so downstream
      // passes (IR lowering, typeNeutralizeScript) can branch on it. Set only
      // when present — conditional-spread keeps the key absent under
      // `exactOptionalPropertyTypes: true`.
      ...(lang !== undefined ? { lang } : {}),
    },
    diagnostics,
  };
}
