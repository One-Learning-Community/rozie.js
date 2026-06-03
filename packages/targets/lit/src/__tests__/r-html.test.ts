// Phase 24 (req 2) — Lit r-html → `${unsafeHTML(<expr>)}` element-content emit.
//
// D-13: Lit mirrors Svelte's element-content form (NOT an attribute). The
// `unsafeHTML` directive is imported CONDITIONALLY (gated on the
// `unsafeHtmlUsed` flag), and the `r-html` attribute is stripped from the open
// tag so no literal `r-html=` leaks (Pitfall 2). An r-html element with
// children raises ROZ833 (severity error).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { emitLit } from '../emitLit.js';

function compileLit(source: string): {
  code: string;
  diagnostics: ReturnType<typeof emitLit>['diagnostics'];
} {
  const { ast } = parse(source, { filename: 'RHtmlProbe.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitLit(ir, {
    filename: 'RHtmlProbe.rozie',
    source,
    modifierRegistry: registry,
  });
}

const RHTML_SOURCE = `<rozie name="RHtmlProbe">

<props>
{
  content: { type: String, default: '<strong>safe</strong>' },
}
</props>

<template>
<div class="rhtml" r-html="$props.content"></div>
</template>

</rozie>
`;

const RHTML_WITH_CHILDREN_SOURCE = `<rozie name="RHtmlProbe">

<props>
{
  content: { type: String, default: '<strong>safe</strong>' },
}
</props>

<template>
<div r-html="$props.content"><span>child</span></div>
</template>

</rozie>
`;

const NO_RHTML_SOURCE = `<rozie name="PlainProbe">

<props>
{
  label: { type: String, default: 'hi' },
}
</props>

<template>
<div class="plain">{{ $props.label }}</div>
</template>

</rozie>
`;

describe('Lit r-html → unsafeHTML element content (Phase 24 req 2)', () => {
  it('Test 1: r-html emits ${unsafeHTML(<expr>)} as element content (not an attribute)', () => {
    const { code } = compileLit(RHTML_SOURCE);
    expect(code).toMatch(/\$\{unsafeHTML\(/);
    // Element-content form: the directive sits between the open tag and the
    // closing </div>, NOT inside the open tag as an attribute.
    expect(code).not.toMatch(/<div[^>]*unsafeHTML/);
  });

  it('Test 2: the module imports unsafeHTML from lit/directives/unsafe-html.js', () => {
    const { code } = compileLit(RHTML_SOURCE);
    expect(code).toContain(
      "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
    );
  });

  it('Test 3: no literal r-html= survives in the output (stripped from the open tag — Pitfall 2)', () => {
    const { code } = compileLit(RHTML_SOURCE);
    expect(code).not.toContain('r-html=');
  });

  it('Test 4: r-html with children pushes ROZ833, severity error', () => {
    const { diagnostics } = compileLit(RHTML_WITH_CHILDREN_SOURCE);
    const diag = diagnostics.find(
      (d) => d.code === RozieErrorCode.TARGET_LIT_RHTML_WITH_CHILDREN,
    );
    expect(diag).toBeDefined();
    expect(diag!.severity).toBe('error');
  });

  it('Test 5: a component with no r-html emits no unsafeHTML and no unsafe-html import (flag-gated)', () => {
    const { code } = compileLit(NO_RHTML_SOURCE);
    expect(code).not.toMatch(/unsafeHTML/);
    expect(code).not.toContain('lit/directives/unsafe-html.js');
  });
});
