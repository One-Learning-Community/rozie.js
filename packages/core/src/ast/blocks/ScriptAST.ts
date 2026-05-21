/**
 * `<script>` block AST. Wraps the Babel `File` node from
 * `@babel/parser.parse({ sourceType: 'module', attachComment: true })`.
 *
 * Per PARSE-03 / Risk 5 (trust-erosion floor): user code MUST survive
 * verbatim through to this AST — including `console.log` calls and comments.
 * No transformation, no stripping at parse time.
 *
 * @experimental — shape may change before v1.0
 */
import type { File } from '@babel/types';
import type { SourceLoc } from '../types.js';

export interface ScriptAST {
  type: 'ScriptAST';
  loc: SourceLoc;
  /** Babel File node (Program inside) — sourceType: 'module', attachComment: true. */
  program: File;
  /**
   * Resolved `lang="..."` attribute from the source `<script>` opening tag.
   * `'ts'` when the source block was `<script lang="ts">` — the `typescript`
   * Babel parser plugin was enabled and `program` may contain `TS*` nodes.
   * Undefined (key omitted under `exactOptionalPropertyTypes`) for a plain
   * `<script>` or any `lang` value other than `ts`. Phase 9.
   */
  lang?: string;
}
