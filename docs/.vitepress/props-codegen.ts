/**
 * props-codegen — VitePress markdown-it plugin that generates a component's
 * API props table LIVE from the family's `.rozie` source.
 *
 * The single fence kind it recognizes is:
 *
 *   ```rozie-props <Name>
 *   ```
 *     → replaced with the 6-column props table (Name | Type | Default |
 *       Two-way (model) | Required | Description) rendered by the core
 *       `renderPropsTable(ir)` generator, from the IR of
 *       `packages/ui/<product>/src/<Name>.rozie` (or `examples/<Name>.rozie`).
 *
 * The fence body in the .md source is ignored — like `rozie-src`/`rozie-out`
 * it is regenerated on every `vitepress build` / `vitepress dev` from the real
 * `.rozie` source through `@rozie/core`, so the docs-site props table can never
 * drift from `ir.props[].docs`. Nothing pre-rendered is committed.
 *
 * This plugin is a THIN wrapper: it resolves + parses the family `.rozie`,
 * lowers it to IR, and calls the SAME core `renderPropsTable` the family README
 * glue uses (D-06). Per-family generality lives entirely in the resolver's
 * product list below — adding a new family means adding its slug there (the
 * ADDING-A-FAMILY recipe documents this).
 *
 * Implementation mirrors `rozie-codegen.ts` / `diagnostics-codegen.ts`: a
 * markdown-it `core` ruler mutates the placeholder `fence` token (into an
 * `html_block`) BEFORE VitePress renders. The markdown table must be run
 * through `md.render(...)` so it becomes a real `<table>` — a markdown table
 * left inside a `fence` would render as literal text.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  renderPropsTable,
  parse,
  lowerToIR,
  createDefaultRegistry,
} from '@rozie/core';
import type MarkdownIt from 'markdown-it';

export interface PropsCodegenOptions {
  /** Absolute path to the repo's `examples/` directory. */
  examplesDir: string;
}

export function propsCodegen(
  md: MarkdownIt,
  opts: PropsCodegenOptions,
): void {
  // LOCAL resolver copy (intentionally diverges from rozie-codegen.ts's): this
  // plugin owns its own product list. `data-table` is included here (it is NOT
  // in rozie-codegen's list) so `DataTable` resolves to
  // `packages/ui/data-table/src/DataTable.rozie`. Each new family adds its slug
  // to THIS list (per the ADDING-A-FAMILY recipe) — do NOT edit rozie-codegen.ts.
  const resolveExample = (name: string): string => {
    for (const product of [
      'data-table',
      'tags',
      'number-field',
      'pagination',
      'date-picker',
      'switch',
      'popover',
      'sortable-list',
      'flatpickr',
      'fullcalendar',
      'codemirror',
      'chartjs',
      'tiptap',
      'maplibre',
      'cropper',
      'pdf',
    ]) {
      const pkgSrc = resolve(
        opts.examplesDir,
        '..',
        `packages/ui/${product}/src`,
        `${name}.rozie`,
      );
      if (existsSync(pkgSrc)) return pkgSrc;
    }
    const root = resolve(opts.examplesDir, `${name}.rozie`);
    if (existsSync(root)) return root;
    const demo = resolve(opts.examplesDir, 'demos', `${name}.rozie`);
    if (existsSync(demo)) return demo;
    const typed = resolve(opts.examplesDir, 'typed', `${name}.rozie`);
    if (existsSync(typed)) return typed;
    throw new Error(
      `[props-codegen] cannot resolve a .rozie source for "${name}" (looked under ` +
        `packages/ui/<product>/src, ${root}, demos/ and typed/). If this is a new ` +
        `family, add its product slug to the resolveExample product list in ` +
        `props-codegen.ts (see ADDING-A-FAMILY.md, "Prop docs" step 3).`,
    );
  };
  const readExample = (name: string): { source: string; path: string } => {
    const path = resolveExample(name);
    try {
      return { source: readFileSync(path, 'utf8'), path };
    } catch (err) {
      throw new Error(`[props-codegen] cannot read example source: ${path}`, {
        cause: err,
      });
    }
  };

  md.core.ruler.push('rozie-props', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence') continue;
      const info = token.info.trim();
      if (!info.startsWith('rozie-props')) continue;

      const name = info.slice('rozie-props'.length).trim();
      if (!name) {
        throw new Error('[props-codegen] `rozie-props` needs a component name');
      }

      const { source, path } = readExample(name);
      // Pass the ABSOLUTE host path as `filename` (exactly as
      // data-table/scripts/codegen.mjs:149-153 does) — not a bare
      // `${name}.rozie`. The absolute path lets the lower pass resolve the
      // family's sibling `.rzts`/`.rzjs` script partials and `<components>`
      // importPaths relative to the source dir; a bare basename makes those
      // resolutions fail (ROZ118/ROZ945 errors) and would break the build.
      const filename = path;

      // IR-load path (copied from data-table/scripts/codegen.mjs:149-153):
      // CompileResult has no `ir` field, so the IR comes from parse() +
      // lowerToIR() only.
      const { ast, diagnostics: parseDiagnostics } = parse(source, {
        filename,
      });
      if (!ast) {
        const errors = parseDiagnostics.filter((d) => d.severity === 'error');
        throw new Error(
          `[props-codegen] compile errors for ${name}:\n` +
            errors.map((d) => `  ${d.code}: ${d.message}`).join('\n'),
        );
      }
      const { ir, diagnostics: lowerDiagnostics } = lowerToIR(ast, {
        modifierRegistry: createDefaultRegistry(),
        filename,
      });

      const errors = [...parseDiagnostics, ...lowerDiagnostics].filter(
        (d) => d.severity === 'error',
      );
      if (errors.length > 0 || !ir) {
        throw new Error(
          `[props-codegen] compile errors for ${name}:\n` +
            errors.map((d) => `  ${d.code}: ${d.message}`).join('\n'),
        );
      }

      // The core generator returns a markdown table; render it through
      // markdown-it so it becomes a real <table> (a markdown table left inside
      // the fence would render as literal text). T-59-06: the table's cells are
      // already escaped by the core renderer (escapeTableCell) and md.render
      // applies markdown-it's standard escaping, so author prose cannot inject
      // raw HTML or break the table.
      const markdown = renderPropsTable(ir);
      const renderedHtml = md.render(markdown);

      token.type = 'html_block';
      token.content = renderedHtml + '\n';
      token.info = '';
      token.tag = '';
    }
  });
}
