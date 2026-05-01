/**
 * BindingsTable + collectors substage entrypoint for Phase 2.
 *
 * `collectAllDeclarations(ast)` runs the four per-block collectors in order
 * and returns the populated BindingsTable. NEVER emits diagnostics —
 * collectors are silent. Plan 02 wraps this with the validators substage to
 * produce a full `analyzeAST` result.
 *
 * Per D-08 collected-not-thrown: NEVER throws.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../ast/types.js';
import type { BindingsTable } from './types.js';
import { collectPropDecls } from './collectors/collectPropDecls.js';
import { collectDataDecls } from './collectors/collectDataDecls.js';
import { collectRefsAndSlots } from './collectors/collectRefsAndSlots.js';
import { collectScriptDecls } from './collectors/collectScriptDecls.js';

export type {
  BindingsTable,
  PropDeclEntry,
  DataDeclEntry,
  RefDeclEntry,
  SlotDeclEntry,
  SlotParamDecl,
  ComputedDeclEntry,
  LifecycleHookEntry,
} from './types.js';

export function createEmptyBindings(): BindingsTable {
  return {
    props: new Map(),
    data: new Map(),
    refs: new Map(),
    slots: new Map(),
    computeds: new Map(),
    emits: new Set(),
    lifecycle: [],
  };
}

/**
 * Collectors substage of analyzeAST (Plan 02 wraps this with validators).
 *
 * Walks the AST once per block and populates the BindingsTable. NEVER
 * throws (D-08). NEVER emits diagnostics — collectors stay silent; Plan 02
 * validators are responsible for diagnostics.
 *
 * @param ast — A non-null RozieAST from `parse()`.
 * @returns The populated BindingsTable.
 *
 * @experimental — shape may change before v1.0
 */
export function collectAllDeclarations(ast: RozieAST): BindingsTable {
  const bindings = createEmptyBindings();
  if (ast.props) collectPropDecls(ast.props, bindings);
  if (ast.data) collectDataDecls(ast.data, bindings);
  if (ast.template) collectRefsAndSlots(ast.template, bindings);
  if (ast.script) collectScriptDecls(ast.script, bindings);
  return bindings;
}
