/**
 * rewriteAssetUrl — Angular target (quick 260718-uvp).
 *
 * Rewrites the EXACT static shape `new URL(<string-literal>, import.meta.url)`
 * into a hoisted `?url` asset import:
 *
 *   const worker = new Worker(new URL('./worker.js', import.meta.url));
 *      ─────────────────────────────────────────────────────────────────
 *   import __rozieAsset0 from './worker.js?url';   // module top
 *   const worker = new Worker(__rozieAsset0);      // original site
 *
 * WHY (Angular seam ONLY): analogjs AOT REJECTS `import.meta.url` — a spliced
 * `new URL('./worker.js', import.meta.url)` resolves to a worker 404 / JIT
 * fallback (memory `project_angular_aot_no_import_meta_url`). Vite/analog's
 * `?url` import convention yields the resolved asset URL string at runtime, so
 * the emitted `__rozieAsset<N>` reference is a drop-in for the removed
 * `new URL(...)`. The other five targets are Vite-based, tolerate
 * `import.meta.url`, and keep splicing it verbatim.
 *
 * SCOPE — fires ONLY when ALL hold: callee is bare `URL`, exactly two args, the
 * first is a StringLiteral, and the second is EXACTLY `import.meta.url`. A
 * dynamic/non-literal first arg, any other second arg, or a non-`URL` callee is
 * left byte-untouched (true no-op → byte-identical downstream when none match).
 *
 * Per Phase 2 D-T-2-01-04 CJS-interop: normalize the traverse default-export.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern; mirrors rewriteScript.ts).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : (_traverse as unknown as { default: TraverseFn }).default;

/**
 * True iff `node` is EXACTLY the member expression `import.meta.url`.
 */
function isImportMetaUrl(node: t.Node | null | undefined): boolean {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isMetaProperty(node.object) &&
    node.object.meta.name === 'import' &&
    node.object.property.name === 'meta' &&
    t.isIdentifier(node.property) &&
    node.property.name === 'url'
  );
}

/**
 * Rewrite every `new URL(<string-literal>, import.meta.url)` NewExpression in
 * `program` to a bare `__rozieAsset<N>` identifier, returning the synthesized
 * default-import declarations (empty array when nothing matched → the caller
 * unshifts nothing and emit is byte-identical).
 *
 * MUST run on a CLONED Program (never `ir.setupBody.scriptProgram`).
 */
export function rewriteAngularAssetImports(
  program: t.File,
): t.ImportDeclaration[] {
  const imports: t.ImportDeclaration[] = [];
  let n = 0;

  traverse(program, {
    NewExpression(path: NodePath<t.NewExpression>) {
      const { callee, arguments: args } = path.node;
      // Gate: `new URL(<StringLiteral>, import.meta.url)` — all conditions.
      if (
        !t.isIdentifier(callee) ||
        callee.name !== 'URL' ||
        args.length !== 2
      ) {
        return;
      }
      const [arg0, arg1] = args;
      if (!t.isStringLiteral(arg0) || !isImportMetaUrl(arg1)) {
        return;
      }

      const name = `__rozieAsset${n++}`;
      const specValue = `${arg0.value}?url`;
      const specifier = t.stringLiteral(specValue);
      // Single-quote form, mirroring buildScriptSlotsMerge's dynKeyLit — keeps the
      // hoisted import quote-consistent with user imports and minimizes diff.
      (
        specifier as t.StringLiteral & {
          extra?: { raw?: string; rawValue?: string };
        }
      ).extra = {
        raw: `'${specValue}'`,
        rawValue: specValue,
      };

      imports.push(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(name))],
          specifier,
        ),
      );

      path.replaceWith(t.identifier(name));
      path.skip();
    },
  });

  return imports;
}
