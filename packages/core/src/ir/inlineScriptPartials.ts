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
 * A contiguous run of spliced nodes that share ONE constant emit-line offset and
 * therefore preserve their intra-run relative line deltas.
 *
 * WR-01 split model: a single splice site no longer produces ONE block spanning
 * `[...newHoists, ...spliced]`. Heterogeneous nodes live in DIFFERENT line-spaces
 * — a freshly-hoisted import emits at the FILE TOP (the import region), while a
 * nested-partial decl and the parent-partial decl that consumes it come from two
 * DIFFERENT source files. Grouping them under one hoist-anchored offset over-shifts
 * the first body decl by the partial's import-section height and corrupts the
 * nested↔parent boundary delta (only visible on whole-program targets like Solid,
 * whose blank-line math reads `loc` deltas across the whole program). Instead each
 * splice emits:
 *  - ONE block per freshly-hoisted import (a single ImportDeclaration), anchored
 *    CONTIGUOUSLY in the import region (no blank line between consecutive imports);
 *  - ONE block per MAXIMAL contiguous same-source-file decl run, anchored
 *    SEQUENTIALLY in the body (one blank line below the preceding statement), so a
 *    nested-partial (file-B) decl run flows one blank line below the parent
 *    (file-A) decl run — exactly the inline-authored layout (byte-identity).
 */
interface SplicedEmitBlock {
  nodes: t.Node[];
  /** Host line this run should emit-anchor to when it is the FIRST walked block
   *  (no preceding statement to flow below). */
  anchorLine: number;
  /**
   * The ORIGINAL source gap above this run's first declaration (D-02, R2), as the
   * `prevEnd + gap` delta `normalizeSplicedEmitLines` should apply when flowing this
   * block below its preceding emitted statement: `gap = 1` reproduces a zero-blank
   * source adjacency (the block's first emit token lands on the next line), `gap = 2`
   * reproduces one source blank, `gap = N+1` reproduces N source blanks (no clamp).
   *
   * Measured PARTIAL-LOCAL at splice time (pre-shift) from the run's first emit token
   * (its banner comment if any, else its first node) to the nearest preceding node IN
   * THE SAME SOURCE FILE — a same-file freshly-hoisted import or a prior same-file decl
   * run. By the extraction rule (the host import sits at the run's first source line)
   * that partial-local delta equals the blank delta the run had above it in the host
   * source before extraction, so it reproduces the inline adjacency (Pitfall 3: measure
   * source-side, NOT the host splice seam). When the run's first decl has NO same-file
   * predecessor (a file-top nested-partial decl, e.g. HostD's `inner`), this is the
   * legacy default `2` — preserving the pre-D-02 behavior for that shape.
   *
   * Consumed ONLY by the non-import branch at the `gap` anchor; consecutive import
   * blocks keep their `gap = 1` contiguity special case.
   */
  originalGap: number;
}

/**
 * Shift a single Babel `Position` object's `.line` by `offset`, exactly once.
 *
 * CRITICAL (Phase 55-04 bug fix): `@babel/parser` SHARES one `Position` object
 * across the `loc.start`/`loc.end` of nested nodes that begin/end at the same
 * source position — e.g. a `const f = () => {...}` shares ONE `loc.end` object
 * between the VariableDeclaration, VariableDeclarator, ArrowFunctionExpression
 * and BlockStatement (verified: all four `.loc.end` are `===`). The earlier
 * `seen`-keyed-on-the-`loc`-WRAPPER dedupe therefore shifted such a shared
 * `Position` once PER wrapping node (4× for the example above), corrupting
 * `loc.end.line` to `original + 4·offset` (~13985 for a host-line-3502 decl).
 * That blew the trailing-comment delta hugely negative, collapsing a between-
 * declaration comment onto the prior closing brace (`}; // comment`). Deduping on
 * the `Position` object itself shifts each unique position exactly once. Never
 * throws (D-04).
 */
function shiftPositionLine(
  pos: { line: number } | null | undefined,
  offset: number,
  shifted: Set<object>,
): void {
  if (!pos || shifted.has(pos)) return;
  shifted.add(pos);
  pos.line += offset;
}

/**
 * Stash a node's `.rzts` origin (once, idempotent) then shift its `loc` lines by
 * `offset`. Byte offsets (`loc.start.index`/`loc.end.index`) and `loc.filename`
 * are NEVER touched. `shifted` dedupes shared `Position` objects (see
 * {@link shiftPositionLine}) so a position aliased across nested nodes — or a
 * comment attached to two adjacent statements — is shifted exactly once
 * (Pitfall 2). Never throws (D-04).
 */
function stashAndShiftNode(node: t.Node, offset: number, shifted: Set<object>): void {
  const loc = node.loc;
  if (!loc) return;
  const extra = (node.extra ?? {}) as Record<string, unknown>;
  if (!('__roziePartialOrigin' in extra)) {
    // Stash the pre-shift `.rzts` line. `loc.start` may already have been shifted
    // if a previously-processed node aliases this exact start Position (rare for
    // top-level decls, whose origins are the only ones Plan 03 reads); compensate
    // so the stashed origin is always the true partial-local line.
    const startAlreadyShifted = shifted.has(loc.start);
    node.extra = {
      ...extra,
      __roziePartialOrigin: {
        line: loc.start.line - (startAlreadyShifted ? offset : 0),
        column: loc.start.column,
        filename: loc.filename,
      } satisfies PartialEmitOrigin,
    };
  }
  shiftPositionLine(loc.start, offset, shifted);
  shiftPositionLine(loc.end, offset, shifted);
}

/** As {@link stashAndShiftNode} but for a comment (origin stashed on the comment). */
function stashAndShiftComment(comment: t.Comment, offset: number, shifted: Set<object>): void {
  const loc = comment.loc;
  if (!loc) return;
  const c = comment as t.Comment & WithPartialOrigin;
  if (c.__roziePartialOrigin === undefined) {
    const startAlreadyShifted = shifted.has(loc.start);
    c.__roziePartialOrigin = {
      line: loc.start.line - (startAlreadyShifted ? offset : 0),
      column: loc.start.column,
      filename: loc.filename,
    };
  }
  shiftPositionLine(loc.start, offset, shifted);
  shiftPositionLine(loc.end, offset, shifted);
}

/** Shift every leading/trailing/inner comment attached to `node`. */
function shiftAttachedComments(node: t.Node, offset: number, shifted: Set<object>): void {
  for (const c of node.leadingComments ?? []) stashAndShiftComment(c, offset, shifted);
  for (const c of node.trailingComments ?? []) stashAndShiftComment(c, offset, shifted);
  for (const c of node.innerComments ?? []) stashAndShiftComment(c, offset, shifted);
}

/** The line a block's first emitted token occupies: its banner comment if it has
 *  leading comments, else the node itself. */
function blockFirstEmitLine(firstNode: t.Node): number {
  const firstLeading = firstNode.leadingComments?.[0]?.loc;
  return firstLeading ? firstLeading.start.line : firstNode.loc!.start.line;
}

/**
 * Phase 56-R10 — true when `stmt` is a sigil DIRECTIVE that every target's residual-body
 * emit STRIPS (it is consumed into a non-residual section: lifecycle / context / computed /
 * expose / watch). Mirrors the strip lists in each `emitResidualScriptBody`
 * (`$onMount`/`$onUnmount`/`$onUpdate`/`$watch`/`$expose`/`$provide` ExpressionStatements,
 * and `$computed`/`$inject` VariableDeclarations).
 *
 * USED ONLY to decide whether a spliced LEADING-comment run's IMMEDIATE source predecessor
 * survives in the residual body. When that predecessor is STRIPPED (e.g. the real DataTable
 * `exposeStateVerbs` run sits below a `$provide(...)`), the inline-authored form attaches the
 * boundary comment to the predecessor's `trailingComments` + the spliced decl's
 * `leadingComments` (shared object), but per-statement generation drops the predecessor's
 * trailing copy WITH the stripped statement → the comment SINGLE-emits. The vue/svelte splice
 * mirror would otherwise re-create that prev-trailing copy and DOUBLE it (the R10 bug). When
 * the predecessor SURVIVES (a plain `let`/`const`, e.g. `let expandedTouched` above
 * `groupingActiveDefault`), both copies survive → the inline form DOUBLES and the mirror must
 * keep doing so. Never throws.
 */
function isStrippedSigilDirective(stmt: t.Statement): boolean {
  if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
    const callee = stmt.expression.callee;
    if (t.isIdentifier(callee)) {
      return (
        callee.name === '$onMount' ||
        callee.name === '$onUnmount' ||
        callee.name === '$onUpdate' ||
        callee.name === '$watch' ||
        callee.name === '$expose' ||
        callee.name === '$provide'
      );
    }
    return false;
  }
  if (t.isVariableDeclaration(stmt) && stmt.declarations.length > 0) {
    return stmt.declarations.every(
      (d) =>
        d.init !== null &&
        d.init !== undefined &&
        t.isCallExpression(d.init) &&
        t.isIdentifier(d.init.callee) &&
        (d.init.callee.name === '$computed' || d.init.callee.name === '$inject'),
    );
  }
  return false;
}

/**
 * Measure the ORIGINAL source gap above a decl run's first emit token (D-02, R2).
 *
 * Returns the `prevEnd + gap` delta the run should flow at: the distance, in source
 * lines, from the run's first emit token (its banner comment if any, else its first
 * node) DOWN from the END of the nearest preceding node IN THE SAME SOURCE FILE — a
 * same-file freshly-hoisted import (`sameFileHoists`) or the prior same-file decl run's
 * last node (`prevRunLastNode`). `gap = firstEmitLine − precedingEnd` so a zero-blank
 * adjacency yields `1` (next line) and N blanks yield `N+1` (no clamp). All `loc`s are
 * still PARTIAL-LOCAL here (the normalize shift runs later), so this reproduces the
 * partial's own pre-extraction layout — which, by the extraction rule, equals the host
 * adjacency the inline oracle has (Pitfall 3: measure source-side, NOT the host seam).
 *
 * When the run's first decl has NO same-file predecessor (a file-top nested-partial
 * decl, e.g. HostD's `inner` at the top of its own file), there is no source delta to
 * measure, so this falls back to the legacy default `2` — preserving the pre-D-02
 * behavior for that shape (no regression). Never throws.
 */
function measureOriginalGap(
  firstNode: t.Node,
  sameFileHoists: readonly t.Node[],
  prevRunLastNode: t.Node | null,
): number {
  const loc = firstNode.loc;
  if (!loc) return 2;
  const firstEmitLine = blockFirstEmitLine(firstNode);
  const fname = loc.filename;
  let precedingEnd = 0;
  for (const h of sameFileHoists) {
    const hl = h.loc;
    if (hl && hl.filename === fname && hl.end.line < firstEmitLine) {
      precedingEnd = Math.max(precedingEnd, hl.end.line);
    }
  }
  const pl = prevRunLastNode?.loc;
  if (pl && pl.filename === fname && pl.end.line < firstEmitLine) {
    precedingEnd = Math.max(precedingEnd, pl.end.line);
  }
  // No same-file predecessor → no source delta to reproduce; keep the legacy gap.
  if (precedingEnd === 0) return 2;
  return Math.max(1, firstEmitLine - precedingEnd);
}

/**
 * Shift every node + attached comment in a block by `offset`, deduping on the
 * underlying `Position` objects (see {@link shiftPositionLine}). Never throws.
 *
 * WR-01: `shifted` is supplied by the CALLER and SHARED across every block in one
 * normalize pass. A between-statement comment can be aliased across two blocks —
 * `@babel/parser` attaches the comment between a hoisted import and the first decl
 * to BOTH the import's `trailingComments` and the decl's `leadingComments` (the
 * SAME `Position` objects). When the hoist and that decl run land in separate
 * blocks, a per-block `shifted` set would shift the aliased comment TWICE (once per
 * block), corrupting its emit line. A shared set shifts each unique `Position`
 * exactly once. The adjacent hoist/decl offsets are equal by construction (the
 * sequential decl anchor is derived from the shifted hoist end + the same gap the
 * partial's import→decl delta encodes), so first-touch-wins is the correct offset.
 */
function shiftBlock(block: SplicedEmitBlock, offset: number, shifted: Set<object>): void {
  for (const top of block.nodes) {
    stashAndShiftNode(top, offset, shifted);
    shiftAttachedComments(top, offset, shifted);
    // Reach NESTED nodes + their attached comments (Pitfall 2). Reuse the
    // already-imported `traverse` over a synthetic File wrapping the SAME node
    // objects (the established `referencedNames` pattern) — mutations land on the
    // real spliced nodes. Guarded so a traverse failure never throws (D-04); the
    // top-level shift above is already applied.
    try {
      traverse(t.file(t.program([top as Statement])), {
        enter(path) {
          stashAndShiftNode(path.node, offset, shifted);
          shiftAttachedComments(path.node, offset, shifted);
        },
      });
    } catch {
      // D-04: nested shift is best-effort; top-level normalization stands.
    }
  }
}

/** Shift a single comment's loc lines by `offset` WITHOUT stashing a partial origin. */
function shiftCommentLinesOnly(comment: t.Comment, offset: number, shifted: Set<object>): void {
  const loc = comment.loc;
  if (!loc) return;
  shiftPositionLine(loc.start, offset, shifted);
  shiftPositionLine(loc.end, offset, shifted);
}

/**
 * Phase 56-R8 — shift a HOST node's loc + attached/nested comments by `offset`,
 * deduping on the underlying `Position` objects (shared `shifted` set, like
 * {@link shiftBlock}). Never throws (D-04).
 *
 * Unlike {@link shiftBlock} / {@link stashAndShiftNode}, this does NOT stash a
 * `__roziePartialOrigin`: a host statement belongs to the HOST `.rozie` file, so its
 * `loc` is the host source-map anchor and must NOT be re-keyed onto a partial origin
 * (`buildPartialLineOffsets` is per-FILE first-stash-wins and would mis-offset every
 * other host segment). This is invoked ONLY for an after-side host run that carries a
 * GENUINE intended blank below a spliced run (`afterGap >= 2`) — the gap-1 trailing
 * seam. Such runs never appear in any built source-map gate today (dist-parity compiles
 * with `sourceMap: false`; the R5 smoke fixtures have no `afterGap >= 2` host run), so
 * the line shift is invisible to the source-map gates while making the @babel/generator
 * blank-line delta reproduce the source's after-side blank on vue/svelte/solid. The
 * host node's residual source-map LINE imperfection for such runs is the same class of
 * `userCodeLineOffset` limitation already documented in deferred-items.md (#1).
 */
function shiftHostNodeLines(node: t.Node, offset: number, shifted: Set<object>): void {
  if (offset === 0) return;
  const apply = (n: t.Node): void => {
    if (n.loc) {
      shiftPositionLine(n.loc.start, offset, shifted);
      shiftPositionLine(n.loc.end, offset, shifted);
    }
    for (const c of n.leadingComments ?? []) shiftCommentLinesOnly(c, offset, shifted);
    for (const c of n.trailingComments ?? []) shiftCommentLinesOnly(c, offset, shifted);
    for (const c of n.innerComments ?? []) shiftCommentLinesOnly(c, offset, shifted);
  };
  apply(node);
  try {
    traverse(t.file(t.program([node as Statement])), {
      enter(path) {
        apply(path.node);
      },
    });
  } catch {
    // D-04: nested shift is best-effort; top-level normalization stands.
  }
}

/**
 * FINAL inline-pass step (Phase 55) — decouple the line `@babel/generator` reads
 * for blank-line/comment placement from the line it reads for the source-map
 * origin, for every spliced partial node.
 *
 * Rationale (RESEARCH Key Finding 1): under `retainLines:false` the generator's
 * comment-adjacency + blank-line math reads `node.loc.start.line` and
 * `comment.loc.start.line` only as DELTAS; only the host↔partial (and
 * partial↔partial) BOUNDARY deltas are wrong (a spliced node carries a small
 * `.rzts`-local line discontinuous with its host neighbour). A CONSTANT per-block
 * offset preserves each block's intra deltas; the right boundary delta is restored
 * by anchoring each block SEQUENTIALLY in residual-body order.
 *
 * SEQUENTIAL ANCHOR (Phase 55-04): each block's first emitted line (its banner
 * comment, else its first node) is anchored ONE blank line below the PRECEDING
 * statement in the final body. Anchoring every block at its own replaced import
 * line (Plan 02's approach) collapsed multi-partial hosts: three consecutive
 * mid-body imports made expand/group/facet pile onto adjacent host lines, so each
 * 30-45-line block overlapped the next and the partial↔partial comment deltas went
 * negative (`}; // banner` collapse). Flowing the blocks sequentially reproduces the
 * inline-authored contiguous layout. The first block (or any block preceded only by
 * un-located content) falls back to its replaced import's host line.
 *
 * WR-01 (whole-program byte-identity): the walk runs over the FULL emit body
 * (`[...hoistImports, ...residualBody]`), NOT just the residual body, so a
 * freshly-hoisted import flows in true emit order ahead of the decls. Consecutive
 * IMPORT blocks anchor CONTIGUOUSLY (gap 1 — no blank between imports); every other
 * run anchors one blank line below the preceding statement (gap 2). Because each
 * source-file decl run is now its OWN block (see {@link SplicedEmitBlock}), a
 * nested-partial decl run flows one blank line below the parent decl run rather than
 * inheriting the hoist's incommensurate file-top offset.
 *
 * TWO PASSES (WR-01): a between-statement comment is aliased across blocks — the
 * `Position` that is a hoisted import's `trailingComments[i]` is the SAME object as
 * the next decl's `leadingComments[i]`. If offsets were applied while walking, the
 * hoist block would shift that comment, and the decl block's `blockFirstEmitLine`
 * would then read the ALREADY-SHIFTED comment line and derive a wrong offset
 * (collapsing the comment onto the decl). So PASS 1 MEASURES every block's offset
 * from ORIGINAL (unmutated) lines, tracking the running emit end arithmetically;
 * PASS 2 MUTATES, applying every offset with ONE shared dedup set so each aliased
 * `Position` shifts exactly once (adjacent hoist/decl offsets are equal by
 * construction, so first-touch-wins is the correct line).
 *
 * Runs AFTER all diagnostics are collected (they captured true `.rzts` byte loc via
 * `nodeLoc`, which reads `node.start`/`node.end`, NOT `loc.{line,column}`), so the
 * R7 error-frame path is untouched (Pitfall 1). Never throws (D-04).
 */
function normalizeSplicedEmitLines(body: Statement[], blocks: SplicedEmitBlock[]): void {
  // Map every block-member node to its block so block starts are detectable while
  // walking the body in emit order.
  const nodeToBlock = new Map<t.Node, SplicedEmitBlock>();
  for (const b of blocks) for (const n of b.nodes) nodeToBlock.set(n, b);
  const measured = new Set<SplicedEmitBlock>();

  // PASS 1 — MEASURE. Compute each block's constant offset from ORIGINAL lines
  // (nothing mutated yet) and accumulate the plan; `prevEnd` tracks the running
  // emit end line ARITHMETICALLY (maxOriginalEnd + offset), never by reading a
  // mutated `loc`, so an aliased comment a prior block will shift cannot perturb a
  // later block's anchor. `prevWasImport` lets consecutive imports flow contiguously.
  //
  // Phase 56-R8 (gap-1 after-side seam): the walk ALSO measures an offset for a HOST
  // statement that immediately follows a spliced block when the host successor carries
  // a GENUINE intended blank (`afterGap >= 2`). The spliced block expands a 1-line
  // import into an N-line run, so the host successor's ORIGINAL (un-shifted) line falls
  // BEHIND the run's emit end and @babel/generator computes a non-positive delta — the
  // intended source blank collapses on vue/svelte/solid (the gap-1 trailing seam).
  // Re-anchoring the host run host-contiguous (run first emit = block emit end +
  // afterGap) reproduces the blank. Gated to `afterGap >= 2`: a zero-blank adjacency
  // (`afterGap <= 1`, the gap-0 trailing seam HostE/HostMulti) already renders correctly
  // and is LEFT UN-SHIFTED so the proven baseline stays byte-identical (no existing
  // fixture has an `afterGap >= 2` host-after-spliced seam — only the new HostJ guard).
  const plan: Array<
    | { block: SplicedEmitBlock; offset: number; leadingSeamPrevStripped?: boolean }
    | { hostNode: t.Statement; offset: number; afterGap?: number }
  > = [];
  let prevEnd = 0;
  let prevWasImport = false;
  // After-side host-gap state: was the previous emitted statement a spliced block, its
  // import (anchor) line, the running offset of the current host run, and the after-side
  // gap (>= 2) of the seam node to stamp on its `extra.__rozieAfterGap` marker.
  let prevWasBlock = false;
  let prevBlockAnchorLine = 0;
  let hostRunOffset = 0;
  let seamAfterGap: number | undefined;
  let prevWasHostStmt = false;
  let prevHostOrigEnd = 0;
  let prevHostStmt: t.Statement | null = null;
  for (const stmt of body) {
    const block = nodeToBlock.get(stmt);
    if (block) {
      if (measured.has(block)) continue;
      measured.add(block);
      const firstNode = block.nodes.find((n) => n.loc);
      if (!firstNode?.loc) continue;
      // A hoist block is a single ImportDeclaration. Consecutive import blocks flow
      // CONTIGUOUSLY (gap 1 — imports carry no inter-statement blank line); every
      // other run flows one blank line below the preceding statement (gap 2).
      const isImportBlock = t.isImportDeclaration(block.nodes[0] as t.Node);
      // D-02 (R2): consecutive import blocks stay contiguous (no inter-import
      // blank); every other run flows the block's ORIGINAL source gap below its
      // preceding emitted statement instead of a hardcoded one-blank `+2`, so a
      // zero-blank source adjacency stays zero-blank (gap 1) and an intentional
      // 2+-blank gap is reproduced faithfully (no clamp).
      let gap = isImportBlock && prevWasImport ? 1 : block.originalGap;
      // Phase 56-R9 (gap-0 LEADING seam) — the BEFORE-side sibling of the R8 gap-1
      // trailing seam. `measureOriginalGap` measures the run's gap PARTIAL-LOCALLY (from
      // its first emit token to its nearest same-file predecessor). When the run's first
      // decl has NO same-file predecessor (a partial that hoists NO import, e.g. the real
      // DataTable `columnChrome` whose arrow bodies close over host scope), that measure
      // FALLS BACK to the legacy `2` — injecting one spurious blank. But when this block
      // immediately FOLLOWS a HOST statement, the AUTHORITATIVE gap is the HOST-side
      // `beforeGap` (the original source distance from the replaced import — `block.anchorLine`
      // — down from the preceding host statement's end), exactly as the extraction rule
      // promises (the host import sits at the run's first source line). Use it when it is
      // SMALLER than the partial-local fallback AND the run's first emit token is a LEADING
      // COMMENT (`blockFirstEmitLine < firstNode.loc.start.line`). The leading-comment gate
      // is what makes this SURGICAL: it matches ONLY the gap-0 leading-comment seam (the
      // spliced run's banner injected one line too low → a spurious blank on vue/svelte/solid;
      // react/angular/lit reconstruct/strip the comment so the blank is invisible). It
      // EXCLUDES every existing fixture and the live data-table baseline: HostE/HostG's
      // spliced runs carry NO leading comment (their authored oracles bake in the blank),
      // and data-table's host-following commented runs (groupingActiveDefault / focusCell /
      // onSortingChangeCb) all have `beforeGap === originalGap === 2` (a genuine intended
      // blank). Correcting the loc here fixes ALL THREE comment-preserving targets uniformly
      // (svelte/vue read the shifted loc via the mirror; solid via whole-program generation)
      // with NO per-target mirror change.
      // Phase 56-R10 (STRIPPED-PREDECESSOR LEADING seam) — the spliced run's first emit
      // token is a LEADING comment whose IMMEDIATE source predecessor is a sigil DIRECTIVE
      // that the residual-body emit STRIPS (the real DataTable `exposeStateVerbs` run sits
      // directly below `$provide('data-table:columns', …)`). Inline, @babel attaches the
      // boundary comment to BOTH the predecessor's `trailingComments` and the spliced decl's
      // `leadingComments` (one shared object); per-statement generation drops the predecessor's
      // trailing copy WITH the stripped statement, so the comment SINGLE-emits. The splice
      // severs the shared object (comment only on the spliced decl's leading), so the vue/svelte
      // mirror's LEADING-seam branch would re-create the prev-trailing copy and DOUBLE it.
      // Stamp the seam (PASS 2) so the mirror suppresses the doubling. Gated to a STRIPPED
      // predecessor: when the predecessor SURVIVES (a plain `let`/`const`, e.g. `let
      // expandedTouched` above `groupingActiveDefault`, or `let refreshRowModel` /
      // `const editRow`), BOTH copies survive inline → the form DOUBLES and the mirror must
      // keep doing so (the live data-table baseline + HostK gap-0 stay byte-identical).
      let stampLeadingSeamStripped = false;
      if (!isImportBlock && prevWasHostStmt) {
        const beforeGap = block.anchorLine - prevHostOrigEnd;
        const firstTokenIsLeadingComment =
          blockFirstEmitLine(firstNode) < firstNode.loc.start.line;
        if (firstTokenIsLeadingComment) {
          if (beforeGap >= 1 && beforeGap < gap) gap = beforeGap;
          if (prevHostStmt && isStrippedSigilDirective(prevHostStmt)) {
            stampLeadingSeamStripped = true;
          }
        }
      }
      const anchorLine = prevEnd > 0 ? prevEnd + gap : block.anchorLine;
      const offset = anchorLine - blockFirstEmitLine(firstNode);
      let maxEnd = 0;
      for (const n of block.nodes) if (n.loc) maxEnd = Math.max(maxEnd, n.loc.end.line);
      prevEnd = maxEnd + offset;
      prevWasImport = isImportBlock;
      prevWasBlock = true;
      prevWasHostStmt = false;
      prevHostStmt = null;
      prevBlockAnchorLine = block.anchorLine;
      plan.push(
        stampLeadingSeamStripped ? { block, offset, leadingSeamPrevStripped: true } : { block, offset },
      );
      continue;
    }
    if (stmt.loc) {
      const firstEmit = blockFirstEmitLine(stmt);
      let offset: number;
      if (prevWasBlock) {
        // First host node after a spliced block. `afterGap` is the ORIGINAL host-source
        // distance from the replaced import to this host successor's first emit token;
        // `afterGap >= 2` means at least one intended blank that the splice expansion
        // collapsed. Re-anchor the run `afterGap` lines below the block's emit end.
        const afterGap = firstEmit - prevBlockAnchorLine;
        if (afterGap >= 2) {
          offset = prevEnd + afterGap - firstEmit;
          // Mark the seam node with the reproduced after-side gap so the per-target
          // svelte/vue/solid mirrors position the boundary comment on the spliced
          // PREDECESSOR's trailingComments at `prev.end + afterGap` (the gap @babel/
          // generator needs a PREV-trailing comment to emit — a host-successor LEADING
          // comment alone never triggers the boundary blank). No marker => the gap-0
          // trailing seam (HostE/HostMulti), where the existing `prev.end + 1` clone is
          // already correct and MUST stay byte-identical.
          seamAfterGap = afterGap;
        } else {
          offset = 0;
        }
        hostRunOffset = offset;
      } else {
        // Continuing host run — carry the run offset so inter-host deltas are preserved.
        offset = hostRunOffset;
      }
      if (offset !== 0) {
        plan.push(
          seamAfterGap !== undefined
            ? { hostNode: stmt, offset, afterGap: seamAfterGap }
            : { hostNode: stmt, offset },
        );
      }
      prevEnd = stmt.loc.end.line + offset;
      seamAfterGap = undefined;
      prevWasImport = t.isImportDeclaration(stmt);
      prevWasBlock = false;
      prevWasHostStmt = true;
      prevHostOrigEnd = stmt.loc.end.line;
      prevHostStmt = stmt;
    }
  }

  // Safety net: any block not reached via the body walk keeps its own import-line
  // anchor so nothing is left un-normalized (still measured against original lines).
  for (const block of blocks) {
    if (measured.has(block)) continue;
    measured.add(block);
    const firstNode = block.nodes.find((n) => n.loc);
    if (!firstNode?.loc) continue;
    plan.push({ block, offset: block.anchorLine - blockFirstEmitLine(firstNode) });
  }

  // PASS 2 — MUTATE. Apply every measured offset with ONE shared dedup set so a
  // `Position` aliased across blocks (or a comment shared with a host successor)
  // shifts exactly once. Spliced blocks stash their `.rzts` origin (source-map
  // decouple); host runs shift loc lines only (see {@link shiftHostNodeLines}).
  const shifted = new Set<object>();
  for (const entry of plan) {
    if ('block' in entry) {
      shiftBlock(entry.block, entry.offset, shifted);
      // Phase 56-R10 — stamp the stripped-predecessor leading-seam marker on the block's first
      // emitted node so the vue/svelte mirror suppresses the LEADING-seam comment doubling.
      // Stamped ONLY when the spliced run's immediate source predecessor is a STRIPPED sigil
      // directive (set in PASS 1) — so the inline form single-emits (the predecessor's trailing
      // copy is dropped with the stripped statement) and the mirror must NOT re-create it. A
      // SURVIVING predecessor (plain `let`/`const`) leaves the seam unstamped → the mirror still
      // doubles, matching the inline form (the live data-table baseline + HostK gap-0 unchanged).
      if (entry.leadingSeamPrevStripped) {
        const firstNode = entry.block.nodes.find((n) => n.loc);
        if (firstNode) {
          const extra = (firstNode.extra ?? {}) as Record<string, unknown>;
          firstNode.extra = { ...extra, __rozieLeadingSeamPrevStripped: true };
        }
      }
    } else {
      shiftHostNodeLines(entry.hostNode, entry.offset, shifted);
      // Stamp the after-side gap marker on the seam node so the per-target
      // svelte/vue/solid mirrors reproduce the boundary blank (see PASS 1).
      if (entry.afterGap !== undefined) {
        const extra = (entry.hostNode.extra ?? {}) as Record<string, unknown>;
        entry.hostNode.extra = { ...extra, __rozieAfterGap: entry.afterGap };
      }
    }
  }
}

/**
 * Phase 56 (Shape-3, R4) — un-FLOAT a hoisted import's between-statement comment that
 * has separated from its owning declaration.
 *
 * `hoistSpecifier` copies a partial import's `trailingComments` onto the HOISTED import
 * node so a comment authored BETWEEN that import and the next surviving decl rides the
 * import to the host module-top (Phase 55 byte-identity). @babel/parser attaches such a
 * between-statement comment to BOTH neighbours: the import's `trailingComments` AND the
 * following decl's `leadingComments` (the SAME comment object). That copy is CORRECT
 * only when the import and its decl stay ADJACENT in the final body (e.g. HostC: the
 * hoisted `clamp` import is immediately followed by the `double` decl it shares the
 * comment with — the inline oracle ALSO has the comment on both neighbours, so
 * per-statement targets double it identically).
 *
 * When the spliced decl lands NON-adjacent to its hoisted import — a host statement
 * (e.g. a reassigned module-`let`) sits between them (HostH/the DataTable P15
 * `editTransition` after-`let` seam) — the import's copy FLOATS the comment to
 * module-top, away from the decl. The inline oracle keeps the comment ONLY on the decl
 * (its import is authored far above, never adjacent), so the float is a partial-vs-inline
 * divergence on ALL six targets (svelte/vue double it at the wrong place, react/angular/
 * lit drop it, solid dedups). This pass restores the inline placement by STRIPPING the
 * floated comment from the import's `trailingComments`; the decl keeps it on its
 * `leadingComments` (object identity preserved), and the per-target emitters then handle
 * the decl-attached comment exactly as they do for the inline oracle (svelte/vue's
 * `mirrorSpliceBoundaryComments` restores the doubling at the decl seam).
 *
 * Runs BEFORE `normalizeSplicedEmitLines` so the corrected attachment is in place when
 * the emit-line shift runs. A comment is treated as FLOATED iff it is shared (object
 * identity) with some body node's `leadingComments` whose owner is NOT the import's
 * immediate body-successor; a genuine import-only trailing comment (owned by no decl's
 * leadingComments) and the adjacent-decl case (HostC) are both left untouched. Never
 * throws (D-04).
 */
function defloatHoistedImportComments(
  body: Statement[],
  hoistImports: readonly t.ImportDeclaration[],
): void {
  if (hoistImports.length === 0) return;
  const hoistSet = new Set<t.Node>(hoistImports);
  // Map every leading-comment object to the index of its FIRST owning body node.
  const leadOwnerIndex = new Map<t.Comment, number>();
  for (let i = 0; i < body.length; i++) {
    for (const c of body[i]!.leadingComments ?? []) {
      if (!leadOwnerIndex.has(c)) leadOwnerIndex.set(c, i);
    }
  }
  for (let hi = 0; hi < body.length; hi++) {
    const node = body[hi]!;
    if (!hoistSet.has(node)) continue;
    const trailing = node.trailingComments;
    if (!trailing || trailing.length === 0) continue;
    const kept = trailing.filter((c) => {
      const owner = leadOwnerIndex.get(c);
      // Genuine import-only trailing comment (no decl claims it as a leading) → keep.
      if (owner === undefined) return true;
      // Shared with the IMMEDIATE successor's leadingComments (adjacent decl, HostC) →
      // keep both copies; the inline oracle doubles them too.
      if (owner === hi + 1) return true;
      // Shared with a NON-adjacent decl's leadingComments → FLOATED to module-top when
      // the import hoisted away from its decl → strip from the import (decl keeps it).
      return false;
    });
    if (kept.length !== trailing.length) {
      node.trailingComments = kept.length > 0 ? kept : null;
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
        // Phase 56 (Shape-3, R4): preserve the export wrapper's leading comments onto
        // the bare declaration ONLY when @babel shared that comment with a PRECEDING
        // module IMPORT's trailing comments — the Shape-3 import-FLOAT case. @babel
        // attaches a comment authored above `export const X` to the
        // ExportNamedDeclaration WRAPPER; unwrapping to `stmt.declaration` discards it (a
        // "banner-drop"). When the comment sits between the partial's OWN module import
        // and this first exported decl, that import is HOISTED to module-top and the
        // shared copy FLOATS there (`defloatHoistedImportComments` then strips it) — so
        // WITHOUT preserving it on the decl the comment is lost from BOTH places. The
        // predecessor-IS-an-import gate is what makes this surgical: a comment shared with
        // an adjacent DECL predecessor (HostC's `double`) survives via that decl's
        // trailing and needs no preservation, and a pure banner not shared with any
        // predecessor (HostE/G/I) is untouched — keeping the proven baseline byte-identical.
        const prevStmt = partialBody[partialBody.indexOf(stmt) - 1];
        const floatedViaImport =
          prevStmt &&
          t.isImportDeclaration(prevStmt) &&
          !PARTIAL_EXT.test(prevStmt.source.value) &&
          prevStmt.trailingComments &&
          stmt.leadingComments
            ? stmt.leadingComments.some((c) => prevStmt.trailingComments!.includes(c))
            : false;
        if (
          floatedViaImport &&
          stmt.leadingComments &&
          stmt.leadingComments.length > 0 &&
          (!bare.leadingComments || bare.leadingComments.length === 0)
        ) {
          bare.leadingComments = stmt.leadingComments;
        }
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
      // freshly-hoisted imports can be re-anchored independently of its decls.
      const hoistBefore = ctx.hoistImports.length;
      const spliced = inlineResolvedPartial(absPath, unionNames, stmt, fromFile, ctx);
      const newHoists = ctx.hoistImports.slice(hoistBefore);
      if (stmt.loc) {
        const anchorLine = stmt.loc.start.line;
        // WR-01: do NOT group file-top hoists with body decls (and do NOT group
        // decls from different source files) under one constant offset. Emit each
        // freshly-hoisted import as its OWN block (anchored contiguously in the
        // import region) and each MAXIMAL contiguous same-source-file decl run as
        // its own block (anchored sequentially in the body). A nested-partial
        // (file-B) decl run then flows one blank line below the parent (file-A)
        // decl run instead of inheriting the hoist's incommensurate line-space.
        // Hoist blocks are single imports; they only ever flow via the import
        // contiguity special case (gap 1) or the first-block anchorLine fallback,
        // so their originalGap is never read — set the contiguous default.
        for (const hoist of newHoists) {
          splicedBlocks.push({ nodes: [hoist], anchorLine, originalGap: 1 });
        }
        let runStart = 0;
        let prevRunLastNode: t.Node | null = null;
        while (runStart < spliced.length) {
          const fname = spliced[runStart]!.loc?.filename ?? null;
          let runEnd = runStart + 1;
          while (
            runEnd < spliced.length &&
            (spliced[runEnd]!.loc?.filename ?? null) === fname
          ) {
            runEnd++;
          }
          const nodes = spliced.slice(runStart, runEnd);
          // D-02 (R2): capture this run's ORIGINAL source gap (partial-local, pre-shift)
          // so normalizeSplicedEmitLines reproduces the source blank-delta above its
          // first decl instead of a hardcoded one-blank `+2`.
          const firstNode = nodes.find((n) => n.loc) ?? nodes[0]!;
          const originalGap = measureOriginalGap(firstNode, newHoists, prevRunLastNode);
          splicedBlocks.push({ nodes, anchorLine, originalGap });
          prevRunLastNode = nodes[nodes.length - 1] ?? prevRunLastNode;
          runStart = runEnd;
        }
      }
      newBody.push(...spliced);
    } else {
      newBody.push(stmt);
    }
  }

  // Prepend hoisted partial imports to the host import region (imports hoist).
  file.program.body = [...ctx.hoistImports, ...newBody];

  // Phase 56 (Shape-3, R4): un-float a hoisted import's between-statement comment that
  // separated from its owning decl when the import hoisted to module-top but its decl
  // landed non-adjacent (a host `let` between them). Restores the inline-oracle
  // placement (comment stays on the decl's leadingComments) before the emit-line shift.
  defloatHoistedImportComments(file.program.body, ctx.hoistImports);

  // Phase 55 FINAL step: normalize spliced nodes' emit-position lines (and their
  // attached comments) to host-contiguous values, stashing the true `.rzts`
  // origin on `extra.__roziePartialOrigin`. Runs LAST so all diagnostics kept
  // their true `.rzts` loc (Pitfall 1). Decouples generator spacing from the
  // source-map origin (D-01: filename preserved, line recoverable). Walks the
  // FULL emit body (hoisted imports INCLUDED — WR-01) so hoists flow in true emit
  // order ahead of the decls and each source-file run anchors SEQUENTIALLY.
  normalizeSplicedEmitLines(file.program.body, splicedBlocks);

  return { ast: file, diagnostics };
}
