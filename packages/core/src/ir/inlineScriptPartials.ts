/**
 * inlineScriptPartials — Phase 54 script-partial inline (R1–R7).
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
 * Behavior (Plan 02 = R1/R2/R3 single-level; Plan 03 = R4/R5/R6/R7):
 *  - R1: a host `ImportDeclaration` whose source matches `/\.(rzts|rzjs)$/` is
 *    detected; after the pass the import statement is gone from the body.
 *  - R2: for each imported name, the transitive closure of referenced top-level
 *    declarations within the partial (a used export may reference a non-exported
 *    same-file helper) is computed; ONLY that closure is spliced — an unused
 *    export contributes nothing.
 *  - R3: the spliced declarations carry their original Babel loc +
 *    `sourceFilename` (the `.rzts` absolute path, via `parseScript`) and land in
 *    the host body in source order, before `analyzeAST` observes the body.
 *  - R4: a partial's OWN top-level (non-partial) `ImportDeclaration`s are
 *    HOISTED into the host import region and deduped by the
 *    (source, importKind, default/namespace/named-imported, local) tuple, so an
 *    alias (`import { a as b }`) is preserved and the same symbol imported by
 *    both host and partial yields ONE statement.
 *  - R5: a partial that imports ANOTHER partial inlines recursively; the same
 *    partial reached twice (direct + transitive diamond) is inlined ONCE keyed
 *    on resolved absolute path (D-03); an import CYCLE pushes ROZ140 and
 *    terminates — no stack overflow (T-54-03).
 *  - R6: an inlined declaration whose name collides with a host top-level
 *    binding OR a name already inlined from an earlier partial pushes ROZ139
 *    (lexical collision) with a frame citing both sites; the colliding decl is
 *    dropped from the splice so the emitted program stays structurally valid.
 *    Expose/emit MERGED-surface collisions are NOT ROZ139 (D-04) — they stay on
 *    the existing post-splice deconflict pass inside lowerToIR.
 *  - R7: the spliced declarations carry the partial-file-local `loc` +
 *    `loc.filename === absPath` (via `parseScript(sourceFilename=absPath)`), so
 *    a deliberate partial error frames against the `.rzts` and a source map
 *    resolves an inlined statement to its `.rzts` origin.
 *  - Resolve/read failure pushes a collected diagnostic (reuses ROZ945), never throws.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { readFileSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import type { File, Statement } from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { ProducerResolver } from '../resolver/index.js';
import { parseScript } from '../parsers/parseScript.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

// Default-export interop: @babel/traverse ships a CJS default export that some
// bundlers (incl. Vitest's ESM resolver) wrap into { default: fn }. Normalize
// at module load. Same pattern as deconflict.ts:44-53 (COPY VERBATIM contract).
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
 * (export-unwrapped) statement, the binding names it introduces, its
 * source-order index, the set of OTHER top-level names it references
 * (intra-file tree-shaking edges), and the FULL set of identifiers it
 * references (used to decide which hoisted imports / nested partials are live).
 */
interface PartialDecl {
  stmt: Statement;
  names: string[];
  order: number;
  refs: Set<string>;
  allRefs: Set<string>;
}

/** A binding site recorded for lexical-collision (ROZ139) reporting. */
interface BindingSite {
  filename?: string;
  loc: SourceLoc;
}

/**
 * Per-invocation recursion context. The `visiting`/`visited` sets are FRESH per
 * top-level `inlineScriptPartials` call (per host per target — deterministic,
 * preserves dist-parity); they are NOT the IRCache reverse-deps map (A4).
 */
interface InlineCtx {
  resolver: ProducerResolver;
  diagnostics: Diagnostic[];
  /** Resolved paths currently on the recursion stack — cycle detection (R5). */
  visiting: Set<string>;
  /** Resolved paths already inlined — diamond dedup, inline ONCE (D-03). */
  visited: Set<string>;
  /** Dedup keys for module imports already present (host) or hoisted (R4). */
  hoistKeys: Set<string>;
  /** Grouped hoisted import declarations, keyed by `${source}\0${importKind}`. */
  hoistGroups: Map<string, t.ImportDeclaration>;
  /** Hoisted import declarations in insertion order (prepended to host body). */
  hoistImports: t.ImportDeclaration[];
  /** Host top-level binding names — lexical-collision targets (R6). */
  hostNames: Map<string, BindingSite>;
  /** Names already inlined from earlier partials — cross-partial collision (R6). */
  inlinedNames: Map<string, BindingSite>;
}

/** Numeric byte span for a Babel node (defaults to 0,0 when unpositioned). */
function nodeLoc(node: { start?: number | null; end?: number | null }): SourceLoc {
  return {
    start: typeof node.start === 'number' ? node.start : 0,
    end: typeof node.end === 'number' ? node.end : 0,
  };
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
  if ((t.isFunctionDeclaration(stmt) || t.isClassDeclaration(stmt)) && stmt.id) {
    return [stmt.id.name];
  }
  if (t.isTSInterfaceDeclaration(stmt) || t.isTSTypeAliasDeclaration(stmt)) {
    return [stmt.id.name];
  }
  // Phase 54 (CR-01) — also recognize runtime `enum` and `declare function`
  // declarations. A `TSEnumDeclaration` is a RUNTIME value in TypeScript, so an
  // exported enum dropped here is a real behavioral defect (the host import
  // finds nothing in nameToDecl and the enum reference becomes an unknown-id
  // error with no ROZ explanation). `TSModuleDeclaration` (namespaces) stays
  // deferred (IN-tier) — namespace exports in reactive partials are rare.
  if (t.isTSEnumDeclaration(stmt)) return [stmt.id.name];
  if (t.isTSDeclareFunction(stmt) && stmt.id) return [stmt.id.name];
  return [];
}

/** Local binding names introduced by an `ImportDeclaration`. */
function importLocalNames(imp: t.ImportDeclaration): string[] {
  return imp.specifiers.map((s) => s.local.name);
}

/**
 * Root identifier of a TS entity name (`Foo` or `Foo.Bar.Baz` → `Foo`). A
 * `TSImportType` (`import('pkg').Foo`) has no root local identifier — returns
 * null (its module surface is already self-contained, never a hoist target).
 */
function rootTypeIdentifier(name: t.Node | null | undefined): string | null {
  let node: t.Node | null | undefined = name;
  while (node && t.isTSQualifiedName(node)) node = node.left;
  return node && t.isIdentifier(node) ? node.name : null;
}

/** Referenced identifier names within a statement (excludes bindings/keys). */
function referencedNames(stmt: Statement): Set<string> {
  const out = new Set<string>();
  try {
    traverse(t.file(t.program([stmt])), {
      ReferencedIdentifier(path) {
        out.add(path.node.name);
      },
      // IN-02: identifiers used SOLELY in TS type positions are NOT
      // `ReferencedIdentifier`s — Babel's `t.isReferenced` deliberately excludes
      // type-annotation references. Without capturing them, a `import type { T }`
      // (or a type-only helper decl) used only in annotations (`param: T`,
      // `type A = T`, `Array<T>`) would not be hoisted/included → the host
      // emits a reference to `T` with no import, and the consumer's `tsc` errors.
      // Capture the ROOT identifier of every type reference + `typeof`-type-query
      // so type-only imports/decls referenced only in annotations ARE pulled in.
      // Value-import behavior is unchanged: a name already collected as a
      // `ReferencedIdentifier` is just re-added to the same Set (idempotent).
      TSTypeReference(path) {
        const root = rootTypeIdentifier(path.node.typeName);
        if (root) out.add(root);
      },
      TSTypeQuery(path) {
        const root = rootTypeIdentifier(path.node.exprName);
        if (root) out.add(root);
      },
    });
  } catch {
    // Defensive (D-08) — a traverse failure yields an empty reference set.
  }
  return out;
}

/**
 * Effective import kind of a single specifier. A specifier is type-only when
 * EITHER the declaration is `import type { … }` (declKind === 'type', in which
 * case Babel reports the per-specifier `importKind` as `'value'`) OR the
 * specifier itself is the inline `import { type X }` form (spec.importKind ===
 * 'type'). The old `spec.importKind ? spec.importKind : declKind` form let the
 * `'value'` per-specifier kind of a declaration-level `import type` mask the
 * declaration's type-ness, so a hoisted `import type { T }` lost its type-only
 * marker and emitted as a runtime `import { T }` (IN-02). Value imports are
 * unaffected (both kinds are `'value'`).
 */
function effectiveImportKind(
  declKind: string,
  spec: t.ImportDeclaration['specifiers'][number],
): 'value' | 'type' {
  if (declKind === 'type') return 'type';
  if (t.isImportSpecifier(spec) && spec.importKind === 'type') return 'type';
  return 'value';
}

/**
 * Dedup key for a single import specifier per the R4 tuple:
 * (source, importKind, default|namespace|named:imported, local). Including the
 * LOCAL name keeps `import { thing }` and `import { thing as aliased }` distinct
 * (alias preserved); a same-source same-kind same-imported same-local pair in
 * host and partial collapses to ONE statement.
 */
function specifierKey(
  source: string,
  declKind: string,
  spec: t.ImportDeclaration['specifiers'][number],
): string {
  const kind = effectiveImportKind(declKind, spec);
  if (t.isImportDefaultSpecifier(spec)) {
    return `${source}\0${kind}\0default\0${spec.local.name}`;
  }
  if (t.isImportNamespaceSpecifier(spec)) {
    return `${source}\0${kind}\0namespace\0${spec.local.name}`;
  }
  const imported = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
  return `${source}\0${kind}\0named:${imported}\0${spec.local.name}`;
}

/**
 * Hoist one partial module-import specifier into the host import region (R4),
 * deduped by {@link specifierKey} and grouped by (source, importKind) so the
 * splice produces idiomatic merged `import { a, b } from 'src'` statements.
 */
function hoistSpecifier(
  ctx: InlineCtx,
  sourceNode: t.StringLiteral,
  declKind: string,
  spec: t.ImportDeclaration['specifiers'][number],
  sourceImport?: t.ImportDeclaration,
): void {
  const source = sourceNode.value;
  const key = specifierKey(source, declKind, spec);
  if (ctx.hoistKeys.has(key)) return;
  ctx.hoistKeys.add(key);
  const groupKind = effectiveImportKind(declKind, spec);
  const groupKey = `${source}\0${groupKind}`;
  const existing = ctx.hoistGroups.get(groupKey);
  if (existing) {
    existing.specifiers.push(spec);
    return;
  }
  // Reuse the partial's ORIGINAL source StringLiteral node (carries `extra.raw`)
  // rather than rebuilding via `t.stringLiteral(source)` — a fresh literal has no
  // raw, so @babel/generator would emit DOUBLE quotes while an inline-authored
  // import preserves the source's quote style. Reusing the node keeps the
  // hoisted import byte-identical to the inline form AND preserves the `.rzts`
  // origin for source maps (R7).
  const decl = t.importDeclaration([spec], sourceNode);
  if (groupKind === 'type') decl.importKind = 'type';
  // Phase 55 (byte-identity): carry the original import's BETWEEN-STATEMENT
  // comments + its `.rzts` `loc` onto the hoisted node. The TRAILING/INNER
  // comments are the content between this import and the next surviving
  // declaration (e.g. a block comment shared with the next decl's leading
  // comments) — the inline-authored form emits them after the import, so the
  // hoisted form must too. LEADING comments are deliberately NOT copied: on a
  // partial's first import they are the file-header banner (partial-file
  // metadata that legitimately vanishes, like a tree-shaken decl's comments),
  // and the inline-equivalent host carries no such header. Copying `loc` (whose
  // `filename` is the `.rzts`, R7) gives @babel/generator the line delta it
  // needs to space the trailing comment correctly; `normalizeSplicedEmitLines`
  // then re-anchors it host-contiguously like every other spliced node.
  if (sourceImport) {
    if (sourceImport.loc) decl.loc = sourceImport.loc;
    if (sourceImport.trailingComments) decl.trailingComments = sourceImport.trailingComments;
    if (sourceImport.innerComments) decl.innerComments = sourceImport.innerComments;
  }
  ctx.hoistGroups.set(groupKey, decl);
  ctx.hoistImports.push(decl);
}

/**
 * The `.rzts` origin stashed on a spliced node/comment BEFORE its emit-position
 * line is normalized to a host-contiguous value (Phase 55). Plan 03 reads this
 * parallel channel to restore strict source-map LINE fidelity; `loc.filename`
 * (R7 file origin) is preserved on `loc` itself and never moves here.
 */
interface PartialEmitOrigin {
  line: number;
  column: number;
  filename?: string;
}

/** A `node`/`comment` that may carry a stashed {@link PartialEmitOrigin}. */
type WithPartialOrigin = { __roziePartialOrigin?: PartialEmitOrigin };

/**
 * A contiguous group of spliced nodes that share ONE constant emit-line offset.
 * `nodes` lists this partial's freshly-hoisted imports FIRST, then its closure
 * declarations (the .rzts-earliest node anchors the offset), so the whole group
 * reproduces the partial's intra-file relative line layout at host-contiguous
 * positions — which is exactly the inline-authored form (byte-identity).
 */
interface SplicedEmitBlock {
  nodes: t.Node[];
  /** Host line the group's first (.rzts-earliest) node should emit-anchor to. */
  anchorLine: number;
}

/**
 * Stash a node's `.rzts` origin (once, idempotent) then shift its `loc` lines by
 * `offset`. Byte offsets (`loc.start.index`/`loc.end.index`) and `loc.filename`
 * are NEVER touched. `seen` dedupes shared `loc` objects so a comment attached to
 * two adjacent statements is shifted exactly once (Pitfall 2). Never throws (D-04).
 */
function stashAndShiftNode(node: t.Node, offset: number, seen: Set<object>): void {
  const loc = node.loc;
  if (!loc || seen.has(loc)) return;
  seen.add(loc);
  const extra = (node.extra ?? {}) as Record<string, unknown>;
  if (!('__roziePartialOrigin' in extra)) {
    node.extra = {
      ...extra,
      __roziePartialOrigin: {
        line: loc.start.line,
        column: loc.start.column,
        filename: loc.filename,
      } satisfies PartialEmitOrigin,
    };
  }
  loc.start.line += offset;
  loc.end.line += offset;
}

/** As {@link stashAndShiftNode} but for a comment (origin stashed on the comment). */
function stashAndShiftComment(comment: t.Comment, offset: number, seen: Set<object>): void {
  const loc = comment.loc;
  if (!loc || seen.has(loc)) return;
  seen.add(loc);
  const c = comment as t.Comment & WithPartialOrigin;
  if (c.__roziePartialOrigin === undefined) {
    c.__roziePartialOrigin = {
      line: loc.start.line,
      column: loc.start.column,
      filename: loc.filename,
    };
  }
  loc.start.line += offset;
  loc.end.line += offset;
}

/** Shift every leading/trailing/inner comment attached to `node`. */
function shiftAttachedComments(node: t.Node, offset: number, seen: Set<object>): void {
  for (const c of node.leadingComments ?? []) stashAndShiftComment(c, offset, seen);
  for (const c of node.trailingComments ?? []) stashAndShiftComment(c, offset, seen);
  for (const c of node.innerComments ?? []) stashAndShiftComment(c, offset, seen);
}

/**
 * FINAL inline-pass step (Phase 55) — decouple the line `@babel/generator` reads
 * for blank-line/comment placement from the line it reads for the source-map
 * origin, for every spliced partial node.
 *
 * Rationale (RESEARCH Key Finding 1): under `retainLines:false` the generator's
 * comment-adjacency + blank-line math reads `node.loc.start.line` and
 * `comment.loc.start.line` only as DELTAS; only the host↔partial BOUNDARY delta is
 * wrong (a spliced node carries a small `.rzts`-local line discontinuous with its
 * ~3500 host neighbour). A CONSTANT per-block offset that lands the block's first
 * node on its host-contiguous anchor preserves intra-block deltas and repairs the
 * boundary delta — the entire fix surface.
 *
 * OFFSET ANCHOR (Open Question 2 / Assumption A1): the anchor is the replaced host
 * import's line (`importStmt.loc.start.line`). The partial's own imports and decls
 * already carry their .rzts-relative layout, so re-anchoring the whole group at the
 * import line reproduces the inline-authored spacing exactly. The comment-bearing
 * oracle (Plan 02 Task 2) confirms this empirically on all six targets.
 *
 * Runs AFTER all diagnostics are collected (they captured true `.rzts` byte loc via
 * `nodeLoc`, which reads `node.start`/`node.end`, NOT `loc.{line,column}`), so the
 * R7 error-frame path is untouched (Pitfall 1). Never throws (D-04).
 */
function normalizeSplicedEmitLines(blocks: SplicedEmitBlock[]): void {
  for (const block of blocks) {
    const first = block.nodes.find((n) => n.loc)?.loc;
    if (!first) continue;
    const offset = block.anchorLine - first.start.line;
    const seen = new Set<object>();
    for (const top of block.nodes) {
      stashAndShiftNode(top, offset, seen);
      shiftAttachedComments(top, offset, seen);
      // Reach NESTED nodes + their attached comments (Pitfall 2). Reuse the
      // already-imported `traverse` over a synthetic File wrapping the SAME node
      // objects (the established `referencedNames` pattern) — mutations land on
      // the real spliced nodes. Guarded so a traverse failure never throws (D-04);
      // the top-level shift above is already applied.
      try {
        traverse(t.file(t.program([top as Statement])), {
          enter(path) {
            stashAndShiftNode(path.node, offset, seen);
            shiftAttachedComments(path.node, offset, seen);
          },
        });
      } catch {
        // D-04: nested shift is best-effort; top-level normalization stands.
      }
    }
  }
}

/** Build the named imported-name list for a (host or nested) partial import. */
function namedImports(imp: t.ImportDeclaration): string[] {
  const out: string[] = [];
  for (const spec of imp.specifiers) {
    if (t.isImportSpecifier(spec)) {
      out.push(t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value);
    }
  }
  return out;
}

/**
 * Resolve, read, parse, tree-shake, recurse, and collision-check one partial,
 * returning the closure of declarations (nested-first, then source-order) to
 * splice in place of the importing statement. Hoists the partial's own module
 * imports into `ctx.hoistImports`. Never throws — on any failure pushes a
 * collected diagnostic and returns `[]`.
 *
 * @param absPath  absolute resolved path of THIS partial.
 * @param importedNames  names the importer pulled from this partial.
 * @param importStmt  the importing `ImportDeclaration` (for diagnostic loc).
 * @param importerFile  absolute path of the file that issued the import.
 */
function inlineResolvedPartial(
  absPath: string,
  importedNames: string[],
  importStmt: t.ImportDeclaration,
  importerFile: string,
  ctx: InlineCtx,
): Statement[] {
  // Cycle: this path is already on the recursion stack (R5 / T-54-03).
  if (ctx.visiting.has(absPath)) {
    ctx.diagnostics.push({
      code: RozieErrorCode.PARTIAL_INLINE_CYCLE,
      severity: 'error',
      message: `Script-partial import cycle detected at '${absPath}'. A .rzts/.rzjs partial cannot (transitively) import itself.`,
      loc: nodeLoc(importStmt),
      ...(importerFile ? { filename: importerFile } : {}),
      hint: 'Break the cycle by removing the circular .rzts/.rzjs import.',
    });
    return [];
  }
  // Diamond: already inlined via another path — bind the same decls once (D-03).
  if (ctx.visited.has(absPath)) return [];
  ctx.visiting.add(absPath);
  // WR-01: do NOT add to `visited` yet. Adding it before the read means a
  // read FAILURE still marks the path visited, so a SECOND import site for the
  // same (unreadable) path gets silently swallowed by the diamond guard with no
  // diagnostic. Mark visited only after a successful read, below — so the
  // diamond-dedup memory reflects "actually inlined" rather than "attempted".

  try {
    if (importedNames.length === 0) return [];

    let partialSource: string;
    try {
      partialSource = readFileSync(absPath, 'utf8');
    } catch {
      ctx.diagnostics.push({
        code: RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED,
        severity: 'error',
        message: `Cannot read resolved script partial '${absPath}'.`,
        loc: nodeLoc(importStmt),
        ...(absPath ? { filename: absPath } : {}),
      });
      return [];
    }

    // Successfully read — mark visited NOW so a genuine diamond (the same
    // partial reached again transitively) deduplicates against a real inline.
    ctx.visited.add(absPath);

    // Parse with the SAME parseScript the host <script> uses — `.rzts` → TS,
    // `.rzjs` → plain JS. Its OWN 0-based contentLoc + sourceFilename=absPath
    // stamp partial-file-local positions + `loc.filename` onto every node (R7).
    const { node, diagnostics: parseDiags } = parseScript(
      partialSource,
      { start: 0, end: partialSource.length },
      partialSource,
      absPath,
      absPath.endsWith('.rzts') ? 'ts' : undefined,
    );
    ctx.diagnostics.push(...parseDiags);
    if (!node) return [];

    // `node` is a ScriptAST whose `.program` is the Babel `File`; the statement
    // list lives at `File.program.body`.
    const partialBody = node.program.program.body;

    // Partition the partial body: declarations (closure candidates), module
    // imports (hoist R4), nested partial imports (recurse R5).
    const decls: PartialDecl[] = [];
    const nameToDecl = new Map<string, PartialDecl>();
    const allNames = new Set<string>();
    const moduleImports: t.ImportDeclaration[] = [];
    const nestedImports: t.ImportDeclaration[] = [];
    /** local name -> nested partial resolved path + the imported name. */
    const nestedLocalMap = new Map<string, { absPath: string; imported: string }>();
    // IN-01: re-export-from specifiers (`export { Bar as Baz } from '@pkg'`).
    // Each provides a host binding equal to its EXPORTED name, mapping to the
    // source module's ORIGINAL name (alias preserved). Collected here and hoisted
    // as host imports below, gated on the live closure (tree-shaken like module
    // imports). A re-export does NOT create a local binding inside the partial,
    // so it is only ever consumed by an IMPORTER — never a sibling decl.
    const reExports: Array<{
      exportedName: string;
      source: t.StringLiteral;
      kind: 'value' | 'type';
      build: () => t.ImportSpecifier | t.ImportNamespaceSpecifier;
    }> = [];
    let order = 0;

    for (const stmt of partialBody) {
      if (t.isImportDeclaration(stmt)) {
        const src = stmt.source.value;
        if (PARTIAL_EXT.test(src)) {
          const nestedAbs = ctx.resolver.resolveProducerPath(src, absPath);
          if (nestedAbs === null) {
            ctx.diagnostics.push({
              code: RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED,
              severity: 'error',
              message: `Cannot resolve nested script partial '${src}' imported by '${absPath}'.`,
              loc: nodeLoc(stmt),
              ...(absPath ? { filename: absPath } : {}),
              hint: 'Check the .rzts/.rzjs path is correct and the file exists.',
            });
            continue;
          }
          nestedImports.push(stmt);
          for (const spec of stmt.specifiers) {
            if (t.isImportSpecifier(spec)) {
              nestedLocalMap.set(spec.local.name, {
                absPath: nestedAbs,
                imported: t.isIdentifier(spec.imported)
                  ? spec.imported.name
                  : spec.imported.value,
              });
            }
          }
        } else {
          moduleImports.push(stmt);
        }
        continue;
      }

      // IN-01: re-export-from — `export { Bar } from '@pkg'` /
      // `export { Bar as Baz } from '@pkg'` / `export * as ns from '@pkg'`. No
      // inline `declaration` and no local binding; the exported name resolves to
      // the source module. Map each to a host import so a host `import { Baz }`
      // binds. A bare `export * from '@pkg'` (ExportAllDeclaration) has no
      // statically-known named surface → ROZ141 (never a silent drop, D-08).
      if (t.isExportNamedDeclaration(stmt) && !stmt.declaration && stmt.source) {
        const src = stmt.source;
        const declTypeOnly = stmt.exportKind === 'type';
        for (const spec of stmt.specifiers) {
          if (t.isExportSpecifier(spec)) {
            const exportedName = t.isIdentifier(spec.exported)
              ? spec.exported.name
              : spec.exported.value;
            const kind: 'value' | 'type' =
              declTypeOnly || spec.exportKind === 'type' ? 'type' : 'value';
            const localId = spec.local; // name in the SOURCE module (alias source)
            reExports.push({
              exportedName,
              source: src,
              kind,
              build: () =>
                // `import { <local> as <exported> }`: local binding = the
                // exported name the importer pulls; imported = source name. The
                // type-only marker rides the declaration via `re.kind` (passed as
                // declKind to hoistSpecifier), grouping type re-exports into a
                // dedicated `import type { … }` statement.
                t.importSpecifier(
                  t.identifier(exportedName),
                  t.identifier(localId.name),
                ),
            });
          } else if (t.isExportNamespaceSpecifier(spec)) {
            // `export * as ns from '@pkg'` — `exported` is always an Identifier.
            const nsName = spec.exported.name;
            reExports.push({
              exportedName: nsName,
              source: src,
              kind: declTypeOnly ? 'type' : 'value',
              build: () => t.importNamespaceSpecifier(t.identifier(nsName)),
            });
          }
        }
        continue;
      }
      if (t.isExportAllDeclaration(stmt)) {
        ctx.diagnostics.push({
          code: RozieErrorCode.PARTIAL_UNSUPPORTED_IMPORT_FORM,
          severity: 'error',
          message: `Script partial '${absPath}' uses \`export * from '${stmt.source.value}'\`. A star re-export has no statically-known named surface to inline — a partial is a compile-time inline, so each re-exported symbol must be named (e.g. \`export { foo } from '${stmt.source.value}'\`).`,
          loc: nodeLoc(stmt),
          ...(absPath ? { filename: absPath } : {}),
          hint: `Replace the star re-export with explicit named re-exports: export { foo, bar } from '${stmt.source.value}'.`,
        });
        continue;
      }

      let bare: Statement | null = null;
      if (t.isExportNamedDeclaration(stmt) && stmt.declaration) {
        bare = stmt.declaration;
      } else if (
        t.isVariableDeclaration(stmt) ||
        t.isFunctionDeclaration(stmt) ||
        t.isClassDeclaration(stmt) ||
        t.isTSInterfaceDeclaration(stmt) ||
        t.isTSTypeAliasDeclaration(stmt) ||
        // Phase 54 (CR-01) — bare (non-exported) enum / declare-function forms
        // must be recognized too so a closure-referenced helper enum survives
        // tree-shaking. Mirrors the bindingNames() extension above.
        t.isTSEnumDeclaration(stmt) ||
        t.isTSDeclareFunction(stmt)
      ) {
        bare = stmt;
      }
      if (!bare) continue;
      const names = bindingNames(bare);
      if (names.length === 0) continue;
      const decl: PartialDecl = {
        stmt: bare,
        names,
        order: order++,
        refs: new Set(),
        allRefs: new Set(),
      };
      decls.push(decl);
      for (const n of names) {
        allNames.add(n);
        if (!nameToDecl.has(n)) nameToDecl.set(n, decl);
      }
    }

    // Reference edges: full identifier set (for hoist/nested liveness) + the
    // intra-file subset (for tree-shaking BFS).
    for (const decl of decls) {
      decl.allRefs = referencedNames(decl.stmt);
      for (const ref of decl.allRefs) {
        if (allNames.has(ref) && !decl.names.includes(ref)) decl.refs.add(ref);
      }
    }

    // BFS the transitive intra-file closure from the imported names (R2).
    const included = new Set<PartialDecl>();
    const queue: string[] = [...importedNames];
    while (queue.length > 0) {
      const name = queue.shift() as string;
      const decl = nameToDecl.get(name);
      if (!decl || included.has(decl)) continue;
      included.add(decl);
      for (const ref of decl.refs) queue.push(ref);
    }
    const includedSorted = [...included].sort((a, b) => a.order - b.order);

    // Union of all identifiers referenced by the live closure — drives which
    // hoisted imports + nested partials are actually pulled in.
    const referencedAll = new Set<string>();
    for (const decl of includedSorted) {
      for (const r of decl.allRefs) referencedAll.add(r);
    }

    // Recurse nested partials FIRST so their decls precede the decls that
    // reference them. Recurse the whole nested import (all named specifiers) so
    // a self-referential nested import is still entered for cycle detection;
    // per-nested tree-shaking happens inside each recursive call from that
    // import's own named specifiers.
    const nestedDecls: Statement[] = [];
    for (const nested of nestedImports) {
      const names = namedImports(nested);
      if (names.length === 0) {
        // WR-02: a nested partial imported via default/namespace form has no
        // inlinable surface — emit ROZ141 rather than silently dropping it.
        ctx.diagnostics.push({
          code: RozieErrorCode.PARTIAL_UNSUPPORTED_IMPORT_FORM,
          severity: 'error',
          message: `Script partial '${nested.source.value}' imported by '${absPath}' uses a default or namespace import. Only named imports (e.g. \`import { foo } from './partial.rzts'\`) are supported — a partial is a compile-time inline with no default/namespace module surface.`,
          loc: nodeLoc(nested),
          ...(absPath ? { filename: absPath } : {}),
          hint: "Switch to a named import: import { foo } from './partial.rzts'.",
        });
        continue;
      }
      const info = nestedLocalMap.get(nested.specifiers[0]?.local.name ?? '');
      const nestedAbs = info?.absPath;
      if (nestedAbs === undefined) continue;
      nestedDecls.push(
        ...inlineResolvedPartial(nestedAbs, names, nested, absPath, ctx),
      );
    }

    // Hoist the partial's own module imports whose local name is referenced by
    // the live closure (R4 + tree-shaking — an import only used by a dropped
    // export is not hoisted).
    for (const imp of moduleImports) {
      const declKind = imp.importKind ?? 'value';
      for (const spec of imp.specifiers) {
        if (referencedAll.has(spec.local.name)) {
          hoistSpecifier(ctx, imp.source, declKind, spec, imp);
        }
      }
    }

    // IN-01: hoist re-export-from specifiers whose EXPORTED name is consumed by
    // this importer (or the live closure). The exported name is the host-visible
    // binding; building it as `import { <source> as <exported> }` makes a host
    // `import { <exported> }` resolve, alias preserved. Tree-shaken: a
    // re-exported symbol nobody imports contributes no host import.
    for (const re of reExports) {
      if (importedNames.includes(re.exportedName) || referencedAll.has(re.exportedName)) {
        hoistSpecifier(ctx, re.source, re.kind, re.build());
      }
    }

    // Splice the closure (R3 source order), enforcing lexical-collision (R6).
    const out: Statement[] = [];
    for (const decl of includedSorted) {
      // WR-03: iterate ALL names in a multi-name declaration (`export let a, b`)
      // and emit a diagnostic PER colliding name — not just the first. The old
      // `break`-after-first form forced the author into a "fix one, recompile,
      // get the next" loop. The whole declaration is still dropped (drop
      // semantics unchanged) if ANY name collides, so a half-declaration is
      // never spliced.
      const collidingNames: string[] = [];
      for (const name of decl.names) {
        const prior = ctx.hostNames.get(name) ?? ctx.inlinedNames.get(name);
        if (prior) {
          collidingNames.push(name);
          ctx.diagnostics.push({
            code: RozieErrorCode.PARTIAL_INLINE_COLLISION,
            severity: 'error',
            message: `Inlined script-partial declaration '${name}' collides with an existing binding of the same name. Two top-level declarations named '${name}' would emit invalid code.`,
            loc: nodeLoc(decl.stmt),
            ...(absPath ? { filename: absPath } : {}),
            related: [
              {
                message: `Existing '${name}' declared here${prior.filename ? ` (${prior.filename})` : ''}.`,
                loc: prior.loc,
                // WR-04: expose the prior site's filename as a STRUCTURED field
                // (not only smuggled into the message text) so a renderer can
                // load that file and frame the actual source line at `prior.loc`
                // — essential for cross-file collisions, the primary motivation
                // for the `related` frame.
                ...(prior.filename ? { filename: prior.filename } : {}),
              },
            ],
            hint: 'Rename the declaration in the script partial or the host <script> so the inlined name is unique.',
          });
        }
      }
      if (collidingNames.length > 0) continue;
      for (const name of decl.names) {
        ctx.inlinedNames.set(name, { ...(absPath ? { filename: absPath } : {}), loc: nodeLoc(decl.stmt) });
      }
      out.push(decl.stmt);
    }

    return [...nestedDecls, ...out];
  } finally {
    // Pop the recursion stack — siblings reached via a DIFFERENT path are not a
    // cycle (only an ancestor-on-stack re-entry is). `visited` keeps the
    // diamond-dedup memory across siblings.
    ctx.visiting.delete(absPath);
  }
}

/**
 * Inline every `.rzts`/`.rzjs` script partial referenced by `file`'s top-level
 * imports into `file.program.body` in place (sigils intact), removing the
 * partial import statements, hoisting the partials' own imports, recursing into
 * partial-of-partial chains with cycle detection, and enforcing lexical-name
 * collisions (ROZ139).
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

  const resolver = opts.resolver ?? new ProducerResolver({ root: dirname(fromFile) });

  const ctx: InlineCtx = {
    resolver,
    diagnostics,
    visiting: new Set(),
    visited: new Set(),
    hoistKeys: new Set(),
    hoistGroups: new Map(),
    hoistImports: [],
    hostNames: new Map(),
    inlinedNames: new Map(),
  };

  // Seed dedup + collision state from the HOST top-level program: existing
  // module-import specifiers (so a hoisted partial import dedups against them)
  // and host top-level binding names (so a colliding inlined name trips R6).
  // The partial imports themselves are SKIPPED — their local names are about to
  // be replaced by the inlined declarations, not real host bindings.
  for (const stmt of file.program.body) {
    if (t.isImportDeclaration(stmt)) {
      if (PARTIAL_EXT.test(stmt.source.value)) continue;
      const declKind = stmt.importKind ?? 'value';
      for (const spec of stmt.specifiers) {
        ctx.hoistKeys.add(specifierKey(stmt.source.value, declKind, spec));
      }
      for (const name of importLocalNames(stmt)) {
        if (!ctx.hostNames.has(name)) ctx.hostNames.set(name, { ...(hostFilename ? { filename: hostFilename } : {}), loc: nodeLoc(stmt) });
      }
      continue;
    }
    for (const name of bindingNames(stmt)) {
      if (!ctx.hostNames.has(name)) {
        ctx.hostNames.set(name, { ...(hostFilename ? { filename: hostFilename } : {}), loc: nodeLoc(stmt) });
      }
    }
  }

  // WR-01 pre-pass: group host-level partial imports by resolved absolute path
  // and UNION their named specifiers. Two distinct host import statements that
  // name DIFFERENT symbols from the SAME partial
  // (`import { a } from './p.rzts'` then `import { b } from './p.rzts'`) must
  // BOTH inline. The naive per-statement form inlined the first and let the
  // diamond `visited` guard silently drop the second. We splice the UNION once,
  // at the first named-import occurrence, and remove every later occurrence.
  const hostPartialNames = new Map<string, string[]>();
  const hostPartialAbs = new Map<t.ImportDeclaration, string | null>();
  for (const stmt of file.program.body) {
    if (t.isImportDeclaration(stmt) && PARTIAL_EXT.test(stmt.source.value)) {
      const absPath = resolver.resolveProducerPath(stmt.source.value, fromFile);
      hostPartialAbs.set(stmt, absPath);
      if (absPath !== null) {
        const union = hostPartialNames.get(absPath) ?? [];
        for (const n of namedImports(stmt)) {
          if (!union.includes(n)) union.push(n);
        }
        hostPartialNames.set(absPath, union);
      }
    }
  }
  const splicedAbs = new Set<string>();

  // Phase 55: emit-line normalization blocks, collected per splice site below.
  const splicedBlocks: SplicedEmitBlock[] = [];

  const newBody: Statement[] = [];
  for (const stmt of file.program.body) {
    if (t.isImportDeclaration(stmt) && PARTIAL_EXT.test(stmt.source.value)) {
      const absPath = hostPartialAbs.get(stmt) ?? null;
      if (absPath === null) {
        diagnostics.push({
          code: RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED,
          severity: 'error',
          message: `Cannot resolve script partial '${stmt.source.value}' imported by the host <script>.`,
          loc: nodeLoc(stmt),
          ...(fromFile ? { filename: fromFile } : {}),
          hint: 'Check the .rzts/.rzjs path is correct and the file exists.',
        });
        continue;
      }
      // WR-02: this specific import statement carries no named specifiers — a
      // default (`import Foo from`) or namespace (`import * as p from`) form.
      // It has no inlinable surface; emit ROZ141 and remove it (no inline).
      if (namedImports(stmt).length === 0) {
        diagnostics.push({
          code: RozieErrorCode.PARTIAL_UNSUPPORTED_IMPORT_FORM,
          severity: 'error',
          message: `Script partial '${stmt.source.value}' was imported via a default or namespace import. Only named imports (e.g. \`import { foo } from './partial.rzts'\`) are supported — a partial is a compile-time inline with no default/namespace module surface to bind.`,
          loc: nodeLoc(stmt),
          ...(fromFile ? { filename: fromFile } : {}),
          hint: "Switch to a named import: import { foo } from './partial.rzts'.",
        });
        continue;
      }
      // WR-01: splice the UNION of all named symbols pulled from this partial
      // exactly once (at the first named-import occurrence). Later host imports
      // of the same partial are removed without re-splicing.
      if (splicedAbs.has(absPath)) continue;
      splicedAbs.add(absPath);
      const unionNames = hostPartialNames.get(absPath) ?? namedImports(stmt);
      // Phase 55: snapshot the hoist list around this splice so THIS partial's
      // freshly-hoisted imports share one emit-line offset with its spliced decls
      // (preserving the .rzts relative layout → byte-identity with inline form).
      const hoistBefore = ctx.hoistImports.length;
      const spliced = inlineResolvedPartial(absPath, unionNames, stmt, fromFile, ctx);
      const newHoists = ctx.hoistImports.slice(hoistBefore);
      if (stmt.loc && (spliced.length > 0 || newHoists.length > 0)) {
        splicedBlocks.push({
          nodes: [...newHoists, ...spliced],
          anchorLine: stmt.loc.start.line,
        });
      }
      newBody.push(...spliced);
    } else {
      newBody.push(stmt);
    }
  }

  // Prepend hoisted partial imports to the host import region (imports hoist).
  file.program.body = [...ctx.hoistImports, ...newBody];

  // Phase 55 FINAL step: normalize spliced nodes' emit-position lines (and their
  // attached comments) to host-contiguous values, stashing the true `.rzts`
  // origin on `extra.__roziePartialOrigin`. Runs LAST so all diagnostics kept
  // their true `.rzts` loc (Pitfall 1). Decouples generator spacing from the
  // source-map origin (D-01: filename preserved, line recoverable).
  normalizeSplicedEmitLines(splicedBlocks);

  return { ast: file, diagnostics };
}
