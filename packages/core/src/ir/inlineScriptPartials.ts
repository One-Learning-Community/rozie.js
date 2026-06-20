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
  return [];
}

/** Local binding names introduced by an `ImportDeclaration`. */
function importLocalNames(imp: t.ImportDeclaration): string[] {
  return imp.specifiers.map((s) => s.local.name);
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
  const kind =
    (t.isImportSpecifier(spec) && spec.importKind ? spec.importKind : declKind) || 'value';
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
  source: string,
  declKind: string,
  spec: t.ImportDeclaration['specifiers'][number],
): void {
  const key = specifierKey(source, declKind, spec);
  if (ctx.hoistKeys.has(key)) return;
  ctx.hoistKeys.add(key);
  const groupKind =
    (t.isImportSpecifier(spec) && spec.importKind ? spec.importKind : declKind) || 'value';
  const groupKey = `${source}\0${groupKind}`;
  const existing = ctx.hoistGroups.get(groupKey);
  if (existing) {
    existing.specifiers.push(spec);
    return;
  }
  const decl = t.importDeclaration([spec], t.stringLiteral(source));
  if (groupKind === 'type') decl.importKind = 'type';
  ctx.hoistGroups.set(groupKey, decl);
  ctx.hoistImports.push(decl);
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
  ctx.visited.add(absPath);

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
      if (names.length === 0) continue;
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
          hoistSpecifier(ctx, imp.source.value, declKind, spec);
        }
      }
    }

    // Splice the closure (R3 source order), enforcing lexical-collision (R6).
    const out: Statement[] = [];
    for (const decl of includedSorted) {
      let collided = false;
      for (const name of decl.names) {
        const prior = ctx.hostNames.get(name) ?? ctx.inlinedNames.get(name);
        if (prior) {
          collided = true;
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
              },
            ],
            hint: 'Rename the declaration in the script partial or the host <script> so the inlined name is unique.',
          });
          break;
        }
      }
      if (collided) continue;
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

  const newBody: Statement[] = [];
  for (const stmt of file.program.body) {
    if (t.isImportDeclaration(stmt) && PARTIAL_EXT.test(stmt.source.value)) {
      const absPath = resolver.resolveProducerPath(stmt.source.value, fromFile);
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
      newBody.push(
        ...inlineResolvedPartial(absPath, namedImports(stmt), stmt, fromFile, ctx),
      );
    } else {
      newBody.push(stmt);
    }
  }

  // Prepend hoisted partial imports to the host import region (imports hoist).
  file.program.body = [...ctx.hoistImports, ...newBody];

  return { ast: file, diagnostics };
}
