/**
 * emitStyle — Lit target (Plan 06.4-02 Task 2).
 *
 * Splits the IR StyleSection into two outputs (D-LIT-15 / D-LIT-16):
 *
 *   - `staticStylesField`: `static styles = css\`...\`;` — scoped rules go here.
 *     Lit's shadow-DOM encapsulation keeps them component-local.
 *   - `globalStyleCall`: `injectGlobalStyles('rozie-<tag>-global', \`...\`);`
 *     — `:root { }` rules from the escape hatch go here. The runtime helper
 *     idempotently injects a `<style>` tag into `document.head`.
 *
 * Mirrors solid/emit/emitStyle.ts's serialization approach (byte-slice rules
 * from the original .rozie source, then escape for template-literal embed)
 * but routes the output into two different sinks.
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type {
  LitImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';
import { toKebabCase } from './emitDecorator.js';

export interface EmitStyleOpts {
  componentName: string;
  lit: LitImportCollector;
  runtime: RuntimeLitImportCollector;
}

export interface EmitStyleResult {
  /** `  static styles = css\`...\`;` line — empty when no scoped rules. */
  staticStylesField: string;
  /** `injectGlobalStyles('rozie-<tag>-global', \`...\`);` — empty when no :root rules. */
  globalStyleCall: string;
  diagnostics: Diagnostic[];
}

/**
 * Slice each rule from the original .rozie source and join with newlines.
 * Verbatim port from solid/emit/emitStyle.ts.
 */
function stringifyRules(rules: StyleRule[], source: string): string {
  if (rules.length === 0) return '';
  const parts: string[] = [];
  for (const rule of rules) {
    const slice = source.slice(rule.loc.start, rule.loc.end);
    parts.push(slice);
  }
  return parts.join('\n');
}

/**
 * Escape CSS text for inclusion in a JS template literal.
 * Verbatim port from solid/emit/emitStyle.ts.
 */
function escapeCssForTemplateLiteral(css: string): string {
  return css
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

export function emitStyle(
  styles: StyleSection,
  source: string,
  opts: EmitStyleOpts,
): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];

  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];

  const scopedCss = stringifyRules(scopedRules, source);
  const globalCss = rootRules.length > 0 ? stringifyRules(rootRules, source) : '';

  let staticStylesField = '';
  let globalStyleCall = '';

  if (scopedCss.length > 0) {
    opts.lit.add('css');
    const escaped = escapeCssForTemplateLiteral(scopedCss);
    staticStylesField = `  static styles = css\`\n${escaped}\n\`;`;
  }

  if (globalCss.length > 0) {
    opts.runtime.add('injectGlobalStyles');
    const escaped = escapeCssForTemplateLiteral(globalCss);
    const id = `rozie-${toKebabCase(opts.componentName)}-global`;
    globalStyleCall = `injectGlobalStyles('${id}', \`\n${escaped}\n\`);`;
  }

  return { staticStylesField, globalStyleCall, diagnostics };
}
