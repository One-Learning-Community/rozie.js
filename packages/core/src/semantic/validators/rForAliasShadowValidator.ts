/**
 * ROZ161 — an `r-for` alias named like a `<data>` key or a prop.
 *
 * `$data.open` and `$props.open` lower to a bare `open` (or `open()` /
 * `this.open`) on every target, and the loop alias `open` is a bare `open` too.
 * Inside the loop the two cannot be told apart, and each target resolves the
 * clash its own way: Svelte and Vue write `$data.open = open` as `open = open`,
 * Lit reads the alias as the data field, Angular calls `.set` on the alias.
 * None of them does what the source says, so the clash is an error: rename the
 * alias.
 *
 * Never throws (D-08).
 */
import type { RozieAST } from '../../ast/types.js';
import type { TemplateElement } from '../../ast/blocks/TemplateAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { extractRForAliases } from '../extractRForAliases.js';
import type { BindingsTable } from '../types.js';
import { walkTemplateElements } from '../walkTemplate.js';

export function runRForAliasShadowValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  if (!ast.template) return;
  const check = (el: TemplateElement): void => {
    const attr = el.attributes.find((a) => a.kind === 'directive' && a.name === 'for');
    if (!attr) return;
    const aliases = extractRForAliases(attr.value ?? '');
    if (!aliases) return;
    for (const alias of [aliases.item, aliases.index]) {
      if (alias === null) continue;
      const kind = bindings.data.has(alias) ? '<data> key' : bindings.props.has(alias) ? 'prop' : null;
      if (kind === null) continue;
      const sigil = kind === 'prop' ? '$props' : '$data';
      diagnostics.push({
        code: RozieErrorCode.RFOR_ALIAS_SHADOWS_STATE,
        severity: 'error',
        message: `r-for alias '${alias}' has the name of the ${kind} '${alias}'. Inside the loop the targets cannot tell '${alias}' from ${sigil}.${alias}.`,
        loc: attr.valueLoc ?? attr.loc,
        hint: `Rename the alias, e.g. r-for="${alias}Item in …".`,
      });
    }
  };
  walkTemplateElements(ast.template, check);
}
