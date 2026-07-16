// command-palette-portal-overlay phase — Task 1 (RED-first).
//
// `r-portal="<container-expr>"` on an ORDINARY template element — a NEW,
// element-level teleport directive distinct from the pre-existing `<slot
// portal>` slot-content-INTO-container primitive (`isPortal` on
// `TemplateSlotInvocationIR` — untouched by this phase). Covers:
//   1. a plain element lowers with a new `TemplateElementIR.portalTo` field
//      carrying the parsed container EXPRESSION + its computed deps.
//   2. `r-portal` co-existing with `r-if` + `@click`/`:class` on the SAME
//      element lowers cleanly (conditional + listeners preserved alongside
//      `portalTo`).
//   3. `r-portal="false"` (a falsy literal) STILL lowers the field — the
//      falsy/disabled path is a runtime decision, not a lower-time drop.
//   4. Diagnostics: r-portal on a <slot> (ROZ990, redirect to `portal`
//      boolean attr), r-portal on a registered child component (ROZ991, v1
//      limitation), r-portal with an empty value (ROZ992).
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type {
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
} from '../types.js';

function rozie(
  templateBody: string,
  opts?: { componentsBlock?: string },
): string {
  return `<rozie name="PortalDirectiveUnit">
<props>{ to: { type: [Boolean, String], default: false }, open: { type: Boolean, default: false }, cls: { type: String, default: '' } }</props>
<script>
function onClick() {}
</script>
${opts?.componentsBlock ? `<components>${opts.componentsBlock}</components>\n` : ''}<template>
${templateBody}
</template>
</rozie>
`;
}

function firstIRElementByTag(
  node: IRTemplateNode | null,
  tagName: string,
): TemplateElementIR {
  if (!node) throw new Error('IR template is null');
  const stack: IRTemplateNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (cur.type === 'TemplateElement' && cur.tagName === tagName) return cur;
    if (cur.type === 'TemplateElement') stack.push(...cur.children);
    if (cur.type === 'TemplateFragment') stack.push(...cur.children);
    if (cur.type === 'TemplateConditional') {
      for (const branch of cur.branches) stack.push(...branch.body);
    }
  }
  throw new Error(`no IR TemplateElement <${tagName}> found`);
}

function lower(source: string): { ir: ReturnType<typeof lowerToIR>['ir']; diagnostics: Diagnostic[] } {
  const { ast, diagnostics: parseDiags } = parse(source);
  expect(ast, JSON.stringify(parseDiags)).not.toBeNull();
  const { ir, diagnostics: lowerDiags } = lowerToIR(ast!, {
    modifierRegistry: createDefaultRegistry(),
  });
  return { ir, diagnostics: [...parseDiags, ...lowerDiags] };
}

function lowerOk(source: string): TemplateElementIR {
  const { ir, diagnostics } = lower(source);
  expect(ir, JSON.stringify(diagnostics)).not.toBeNull();
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected lowering errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return firstIRElementByTag(ir!.template, 'div');
}

describe('r-portal element directive (command-palette-portal-overlay Task 1)', () => {
  it('a plain element with r-portal lowers a portalTo field carrying the parsed expression + computed deps', () => {
    const el = lowerOk(rozie(`<div r-portal="$props.to">content</div>`));
    expect(el.portalTo).toBeDefined();
    expect(t.isMemberExpression(el.portalTo!.expression)).toBe(true);
    expect(el.portalTo!.deps.length).toBeGreaterThan(0);
  });

  it('r-portal co-exists with r-if + @click + :class on the same element', () => {
    const source = rozie(
      `<div r-if="$props.open" r-portal="$props.to" @click="onClick" :class="$props.cls">content</div>`,
    );
    const el = lowerOk(source);
    expect(el.portalTo).toBeDefined();
    expect(el.events.some((e) => e.event === 'click')).toBe(true);
    expect(
      el.attributes.some(
        (a) => a.kind === 'binding' && a.name === 'class',
      ),
    ).toBe(true);
  });

  it('r-portal="false" (falsy literal) still lowers the field — falsy is a runtime decision, not a lower-time drop', () => {
    const el = lowerOk(rozie(`<div r-portal="false">content</div>`));
    expect(el.portalTo).toBeDefined();
    expect(t.isBooleanLiteral(el.portalTo!.expression, { value: false })).toBe(
      true,
    );
  });

  it('r-portal on a <slot> is ROZ990 (redirect to the boolean `portal` attribute)', () => {
    const { diagnostics } = lower(
      rozie(`<slot r-portal="$props.to"></slot>`),
    );
    const errs = diagnostics.filter(
      (d) => d.code === RozieErrorCode.PORTAL_DIRECTIVE_ON_SLOT,
    );
    expect(errs.length).toBe(1);
    expect(errs[0]!.severity).toBe('error');
    expect(errs[0]!.message).toMatch(/portal/i);
  });

  it('r-portal on a registered child component is ROZ991 (v1 limitation)', () => {
    const { diagnostics } = lower(
      rozie(`<Child r-portal="$props.to"></Child>`, {
        componentsBlock: `{ Child: './Child.rozie' }`,
      }),
    );
    const errs = diagnostics.filter(
      (d) => d.code === RozieErrorCode.PORTAL_DIRECTIVE_ON_COMPONENT,
    );
    expect(errs.length).toBe(1);
    expect(errs[0]!.severity).toBe('error');
  });

  it('r-portal with an empty value is ROZ992', () => {
    const { diagnostics } = lower(rozie(`<div r-portal="">content</div>`));
    const errs = diagnostics.filter(
      (d) => d.code === RozieErrorCode.PORTAL_DIRECTIVE_EMPTY_VALUE,
    );
    expect(errs.length).toBe(1);
    expect(errs[0]!.severity).toBe('error');
  });
});
