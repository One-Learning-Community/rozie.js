/**
 * Quick-task 260711 (fast) — lock the f1c29520 React-emitter fix:
 * "custom-component prop binding no longer aliased to HTML/JSX name".
 *
 * The HTML→JSX attribute-name alias table (`autofocus`→`autoFocus`,
 * `tabindex`→`tabIndex`, …) applies to REAL DOM elements only. Component
 * (`<Child :autofocus="x" />`) and self-tag prop bindings carry USER-NAMED
 * props, not HTML attributes, so the alias must NOT fire for them — otherwise
 * `:autofocus="expr"` on a child component is emitted as `autoFocus={expr}`,
 * a name the component's declared `autofocus` prop never receives (the exact
 * bug found via EditorText in the data-table editor-owns-focus contract).
 *
 * The alias is gated on `ctx.elementTagKind === 'html'` (the default when
 * absent). This test drives `emitAttributes` directly and asserts:
 *   - elementTagKind 'component'/'self' → attr name passes through VERBATIM
 *   - elementTagKind 'html' (and the legacy default) → STILL aliased
 *
 * Before f1c29520 the 'component'/'self' cases below emitted `autoFocus`/
 * `tabIndex` and would FAIL (verified by temporarily restoring the pre-fix
 * emitter). This locks the general emitter behavior independent of the
 * downstream data-table VR coverage.
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, AttributeBinding } from '../../../../core/src/ir/types.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitAttributes, type EmitAttrCtx } from '../emit/emitTemplateAttribute.js';

function emptyIR(): IRComponent {
  const src = `<rozie name="Test">
<template>
  <div></div>
</template>
</rozie>`;
  const { ast } = parse(src, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return ir;
}

function attrBinding(name: string, exprSrc: string): AttributeBinding {
  return {
    kind: 'binding',
    name,
    expression: parseExpression(exprSrc) as t.Expression,
    deps: [],
    sourceLoc: { start: 0, end: exprSrc.length },
  };
}

function ctxWith(ir: IRComponent, elementTagKind?: 'html' | 'component' | 'self'): EmitAttrCtx {
  return {
    ir,
    collectors: {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    },
    elementTagKind,
  };
}

describe('emitTemplateAttribute (React) — component prop passthrough (f1c29520)', () => {
  it("elementTagKind 'component' → :autofocus / :tabindex pass through VERBATIM (not HTML-aliased)", () => {
    const ir = emptyIR();
    const { jsx } = emitAttributes(
      [attrBinding('autofocus', 'shouldFocus'), attrBinding('tabindex', 'idx')],
      ctxWith(ir, 'component'),
    );
    // Verbatim user-named props.
    expect(jsx).toContain('autofocus={');
    expect(jsx).toContain('tabindex={');
    // NOT the HTML/JSX-aliased casing.
    expect(jsx).not.toContain('autoFocus={');
    expect(jsx).not.toContain('tabIndex={');
  });

  it("elementTagKind 'self' → also passes through VERBATIM", () => {
    const ir = emptyIR();
    const { jsx } = emitAttributes(
      [attrBinding('autofocus', 'shouldFocus'), attrBinding('tabindex', 'idx')],
      ctxWith(ir, 'self'),
    );
    expect(jsx).toContain('autofocus={');
    expect(jsx).toContain('tabindex={');
    expect(jsx).not.toContain('autoFocus={');
    expect(jsx).not.toContain('tabIndex={');
  });

  it("elementTagKind 'html' → STILL aliased to JSX casing (native DOM, no regression)", () => {
    const ir = emptyIR();
    const { jsx } = emitAttributes(
      [attrBinding('autofocus', 'shouldFocus'), attrBinding('tabindex', 'idx')],
      ctxWith(ir, 'html'),
    );
    expect(jsx).toContain('autoFocus={');
    expect(jsx).toContain('tabIndex={');
    expect(jsx).not.toContain('autofocus={');
    expect(jsx).not.toContain('tabindex={');
  });

  it('legacy default (elementTagKind absent) → aliased as before (backward-compatible)', () => {
    const ir = emptyIR();
    const { jsx } = emitAttributes(
      [attrBinding('autofocus', 'shouldFocus'), attrBinding('tabindex', 'idx')],
      ctxWith(ir, undefined),
    );
    expect(jsx).toContain('autoFocus={');
    expect(jsx).toContain('tabIndex={');
  });
});
