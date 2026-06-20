/**
 * inlineScriptPartials — Phase 54 (R1/R2/R3) single-level script-partial inline.
 *
 * Inlines a `.rzts`/`.rzjs` script partial's EXPORTED declarations (sigils
 * intact) into the host component's `<script>` Babel program BEFORE
 * `analyzeAST` runs — so the partial rides the host's single per-target
 * lowering and reuses 100% of the existing sigil machinery. Because the splice
 * lands in host scope, a partial's bare `$props.x`/`$data.y` references resolve
 * against the host and the existing binder validates them (D-02:
 * implicit mixin-style host-state contract — no `requires {}` syntax).
 *
 * Pass shape mirrors `validateClassSelector.ts`: mutate in place, push to a
 * collected diagnostics array, NEVER throw (D-08). Sync-only — `resolveSync` +
 * `readFileSync`, no async.
 *
 * Single-level ONLY (Plan 02): partial-of-partial recursion, cross-file import
 * hoist/dedup, cycle detection, and ROZ139 collision are Plan 03.
 *
 * Behavior:
 *  - R1: a host `ImportDeclaration` whose source matches `/\.(rzts|rzjs)$/` is
 *    detected; after the pass the import statement is gone from the body.
 *  - R2: for each imported name, the transitive closure of referenced top-level
 *    declarations within the partial (a used export may reference a non-exported
 *    same-file helper) is computed; ONLY that closure is spliced — an unused
 *    export contributes nothing.
 *  - R3: the spliced declarations carry their original Babel loc +
 *    `sourceFilename` (the `.rzts` absolute path, via `parseScript`) and land in
 *    the host body in source order, before `analyzeAST` observes the body.
 *  - Resolve failure pushes a collected diagnostic (reuses ROZ945), never throws.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { readFileSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import type { File, Statement } from '@babel/types';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { ProducerResolver } from '../resolver/index.js';
import { parseScript } from '../parsers/parseScript.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

// Default-export interop: @babel/traverse ships a CJS default export that some
// bundlers (incl. Vitest's ESM resolver) wrap into { default: fn }. Normalize
// at module load. Same pattern as validateClassSelector.ts.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** Author-controlled script-partial extensions (D-01). */
export const PARTIAL_EXT = /\.(rzts|rzjs)$/;

/**
 * Whether an import specifier targets a `.rzts`/`.rzjs` script partial (a
 * COMPILE-TIME inline, NOT a module). Consulted by the unplugin/babel routing
 * (Plan 04) so a partial never produces a virtual id / sibling artifact.
 */
export function isPartialExtension(specifier: string): boolean {
  return PARTIAL_EXT.test(specifier);
}

/** Options for {@link inlineScriptPartials}. */
export interface InlineScriptPartialsOptions {
  /** Absolute (or relative-to-cwd) path of the host `.rozie` file. */
  hostFilename?: string;
  /** Producer resolver. When omitted, a fresh one is rooted at the host dir. */
  resolver?: ProducerResolver;
}

/** Result of {@link inlineScriptPartials}. `ast` is the SAME (mutated) File. */
export interface InlineScriptPartialsResult {
  ast: File;
  diagnostics: Diagnostic[];
}

/**
 * A single top-level declaration extracted from a partial program: the bare
 * (export-unwrapped) statement, the binding names it introduces, and its
 * source-order index. `refs` is the set of OTHER top-level names it references.
 */
interface PartialDecl {
  stmt: Statement;
  names: string[];
  order: number;
  refs: Set<string>;
}

/** Binding names introduced by a (bare, export-unwrapped) declaration. */
function bindingNames(stmt: Statement): string[] {
  if (t.isVariableDeclaration(stmt)) {
    const out: string[] = [];
    for (const d of stmt.declarations) {
      if (t.isIdentifier(d.id)) out.push(d.id.name);
    }
    return out;
  }
  if (
    (t.isFunctionDeclaration(stmt) || t.isClassDeclaration(stmt)) &&
    stmt.id
  ) {
    return [stmt.id.name];
  }
  if (t.isTSInterfaceDeclaration(stmt) || t.isTSTypeAliasDeclaration(stmt)) {
    return [stmt.id.name];
  }
  return [];
}

/** Referenced identifier names within a statement (excludes bindings/keys). */
function referencedNames(stmt: Statement): Set<string> {
  const out = new Set<string>();
  try {
    traverse(t.file(t.program([stmt])), {
      ReferencedIdentifier(path) {
        out.add(path.node.name);
      },
    });
  } catch {
    // Defensive (D-08) — a traverse failure yields an empty reference set.
  }
  return out;
}

/**
 * Resolve, read, parse, and tree-shake one partial import. Returns the closure
 * of declarations (in source order) to splice in place of the import. On any
 * failure pushes a collected diagnostic and returns `[]` (never throws).
 */
function extractClosure(
  imp: t.ImportDeclaration,
  resolver: ProducerResolver,
  fromFile: string,
  diagnostics: Diagnostic[],
): Statement[] {
  const specifier = imp.source.value;

  // Imported names (named specifiers only this plan; default/namespace are
  // Plan 03 import-hoist territory).
  const importedNames: string[] = [];
  for (const spec of imp.specifiers) {
    if (t.isImportSpecifier(spec)) {
      importedNames.push(
        t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value,
      );
    }
  }
  if (importedNames.length === 0) return [];

  // Resolve via the producer resolver (T-072-02 containment; never path.resolve
  // raw author strings). null → collected diagnostic, no splice.
  const absPath = resolver.resolveProducerPath(specifier, fromFile);
  if (absPath === null) {
    diagnostics.push({
      code: RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED,
      severity: 'error',
      message: `Cannot resolve script partial '${specifier}' imported by the host <script>.`,
      loc: {
        start: typeof imp.start === 'number' ? imp.start : 0,
        end: typeof imp.end === 'number' ? imp.end : 0,
      },
      ...(fromFile ? { filename: fromFile } : {}),
      hint: 'Check the .rzts/.rzjs path is correct and the file exists.',
    });
    return [];
  }

  let partialSource: string;
  try {
    partialSource = readFileSync(absPath, 'utf8');
  } catch {
    diagnostics.push({
      code: RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED,
      severity: 'error',
      message: `Cannot read resolved script partial '${absPath}'.`,
      loc: {
        start: typeof imp.start === 'number' ? imp.start : 0,
        end: typeof imp.end === 'number' ? imp.end : 0,
      },
      ...(absPath ? { filename: absPath } : {}),
    });
    return [];
  }

  // Parse with the SAME parseScript the host <script> uses — `.rzts` → TS,
  // `.rzjs` → plain JS. `filename=absPath` stamps `loc.filename`/`sourceFilename`
  // onto every node (R7 substrate). Byte-identity guarantor (parseScript:89-105).
  const { node, diagnostics: parseDiags } = parseScript(
    partialSource,
    { start: 0, end: partialSource.length },
    partialSource,
    absPath,
    absPath.endsWith('.rzts') ? 'ts' : undefined,
  );
  diagnostics.push(...parseDiags);
  if (!node) return [];

  // `node` is a ScriptAST whose `.program` is the Babel `File`; the statement
  // list lives at `File.program.body`.
  const partialBody = node.program.program.body;

  // Collect top-level declarations (export-unwrapped) keyed by binding name.
  const decls: PartialDecl[] = [];
  const nameToDecl = new Map<string, PartialDecl>();
  const allNames = new Set<string>();
  let order = 0;
  for (const stmt of partialBody) {
    let bare: Statement | null = null;
    if (t.isExportNamedDeclaration(stmt) && stmt.declaration) {
      bare = stmt.declaration;
    } else if (
      t.isVariableDeclaration(stmt) ||
      t.isFunctionDeclaration(stmt) ||
      t.isClassDeclaration(stmt) ||
      t.isTSInterfaceDeclaration(stmt) ||
      t.isTSTypeAliasDeclaration(stmt)
    ) {
      bare = stmt;
    }
    if (!bare) continue; // imports / bare expressions — Plan 03 / not closure roots
    const names = bindingNames(bare);
    if (names.length === 0) continue;
    const decl: PartialDecl = { stmt: bare, names, order: order++, refs: new Set() };
    decls.push(decl);
    for (const n of names) {
      allNames.add(n);
      if (!nameToDecl.has(n)) nameToDecl.set(n, decl);
    }
  }

  // Compute each declaration's intra-file reference closure (only names that
  // resolve to ANOTHER top-level declaration matter for tree-shaking).
  for (const decl of decls) {
    for (const ref of referencedNames(decl.stmt)) {
      if (allNames.has(ref) && !decl.names.includes(ref)) decl.refs.add(ref);
    }
  }

  // BFS the transitive closure from the imported names.
  const included = new Set<PartialDecl>();
  const queue: string[] = [...importedNames];
  while (queue.length > 0) {
    const name = queue.shift() as string;
    const decl = nameToDecl.get(name);
    if (!decl || included.has(decl)) continue;
    included.add(decl);
    for (const ref of decl.refs) queue.push(ref);
  }

  // Splice in source order (R3).
  return [...included]
    .sort((a, b) => a.order - b.order)
    .map((d) => d.stmt);
}

/**
 * Inline every `.rzts`/`.rzjs` script partial referenced by `file`'s top-level
 * imports into `file.program.body` in place (sigils intact), removing the
 * partial import statements. Single-level only.
 */
export function inlineScriptPartials(
  file: File,
  opts: InlineScriptPartialsOptions = {},
): InlineScriptPartialsResult {
  const diagnostics: Diagnostic[] = [];

  // Fast path: no partial imports → byte-identical no-op.
  const hasPartial = file.program.body.some(
    (s) => t.isImportDeclaration(s) && PARTIAL_EXT.test(s.source.value),
  );
  if (!hasPartial) return { ast: file, diagnostics };

  // `fromFile` must be a concrete path so `dirname(fromFile)` is the resolution
  // root. Fall back to a cwd-anchored sentinel when no host filename is known.
  const hostFilename = opts.hostFilename;
  const fromFile =
    hostFilename !== undefined
      ? isAbsolute(hostFilename)
        ? hostFilename
        : join(process.cwd(), hostFilename)
      : join(process.cwd(), '__rozie_host__.rozie');

  const resolver =
    opts.resolver ?? new ProducerResolver({ root: dirname(fromFile) });

  const newBody: Statement[] = [];
  for (const stmt of file.program.body) {
    if (t.isImportDeclaration(stmt) && PARTIAL_EXT.test(stmt.source.value)) {
      newBody.push(...extractClosure(stmt, resolver, fromFile, diagnostics));
    } else {
      newBody.push(stmt);
    }
  }
  file.program.body = newBody;

  return { ast: file, diagnostics };
}
