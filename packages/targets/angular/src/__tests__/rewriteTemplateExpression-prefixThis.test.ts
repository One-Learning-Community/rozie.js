/**
 * rewriteTemplateExpression — `prefixThis: true` (class-body context).
 *
 * Regression test for B-07.3.2-05-02: when the rewritten expression is
 * interpolated into the consumer-side `templates` getter (a class-body
 * context), the IR member references must be `this.X()` not bare `X()`.
 * Bug arose because the original codepath string-prefixed `this.` onto
 * the whole expression — broken for non-identifier shapes like template
 * literals.
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function makeIR(): IRComponent {
  return {
    name: 'TableDemo',
    props: [],
    state: [{ name: 'footerMode', initial: 'literal("summary")', isModel: false }],
    refs: [],
    computed: [],
    methods: [],
    lifecycle: {},
    slots: [],
    events: [],
    template: { type: 'TemplateFragment', children: [] },
    styles: [],
    components: [],
    listenersBlock: { listeners: [] },
  } as unknown as IRComponent;
}

describe('rewriteTemplateExpression — prefixThis (class-body context)', () => {
  it('rewrites bare $data identifier to `this.X()`', () => {
    const ir = makeIR();
    const expr = parseExpression('$data.footerMode');
    const out = rewriteTemplateExpression(expr, ir, { prefixThis: true });
    expect(out).toBe('this.footerMode()');
  });

  it('rewrites template literal with $data interpolation to use `this.X()` inside ${}', () => {
    const ir = makeIR();
    // Source: `footer${$data.footerMode}`
    const expr = parseExpression('`footer${$data.footerMode}`');
    const out = rewriteTemplateExpression(expr, ir, { prefixThis: true });
    // Outer template literal must NOT be prefixed with `this.`; inner ${} must be `this.footerMode()`.
    expect(out).toBe('`footer${this.footerMode()}`');
    expect(out).not.toContain('this.`');
  });

  it('default (no prefixThis) still emits bare identifiers for template-context bindings', () => {
    const ir = makeIR();
    const expr = parseExpression('`footer${$data.footerMode}`');
    const out = rewriteTemplateExpression(expr, ir);
    expect(out).toBe('`footer${footerMode()}`');
  });

  it('handles bare-identifier signal reference with prefixThis', () => {
    const ir = makeIR();
    const expr = parseExpression('footerMode');
    const out = rewriteTemplateExpression(expr, ir, { prefixThis: true });
    expect(out).toBe('this.footerMode()');
  });
});
