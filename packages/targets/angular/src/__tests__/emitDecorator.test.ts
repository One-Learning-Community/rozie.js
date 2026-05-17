/**
 * emitDecorator — backtick / ${ escape guard.
 *
 * Regression test for a bug where Angular template bodies containing user
 * template-literal syntax (e.g. `:class="\`badge badge-${value}\`"`) emitted
 * an unescaped inner backtick that closed the surrounding @Component({
 * template: ` ... ` }) literal, producing TS source that esbuild could not
 * parse.
 *
 * The fix escapes backslashes, backticks, and `${` inside the template and
 * styles bodies before injecting them into the decorator's backtick literal.
 */
import { describe, it, expect } from 'vitest';
import { emitDecorator } from '../emit/emitDecorator.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

const STUB_IR = { name: 'Stub' } as unknown as IRComponent;

describe('emitDecorator — backtick-literal escape', () => {
  it('escapes inner backticks in template body', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: `<span [class]="\`badge badge-active\`">x</span>`,
      stylesArrayBody: '',
      hasSlots: false,
      hasNgModel: false,
    });
    // Inner backticks MUST appear as `\``, not as bare ``.
    expect(out).toContain('\\`badge badge-active\\`');
    expect(out).not.toMatch(/\[class]="`badge badge-active`"/);
  });

  it('escapes ${ in template body so it does not interpolate at TS-parse time', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: `<span [class]="\`badge-\${value}\`">x</span>`,
      stylesArrayBody: '',
      hasSlots: false,
      hasNgModel: false,
    });
    expect(out).toContain('\\${value}');
    // Confirm the inner `${value}` survives as literal source for Angular,
    // not as a TS template-literal placeholder.
    expect(out).not.toMatch(/`badge-\${value}`/);
  });

  it('escapes pre-existing backslashes so they round-trip', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: `<span title="a\\nb">x</span>`,
      stylesArrayBody: '',
      hasSlots: false,
      hasNgModel: false,
    });
    // Backslash must double in the source so the runtime string reads "a\nb".
    expect(out).toContain('a\\\\nb');
  });

  it('also escapes styles body', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: '<span>x</span>',
      stylesArrayBody: `.x::after { content: '\`'; }`,
      hasSlots: false,
      hasNgModel: false,
    });
    expect(out).toContain("content: '\\`'");
  });

  it('does not change plain templates without backticks / ${ / backslashes', () => {
    const tpl = '<div class="x">hello</div>';
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: tpl,
      stylesArrayBody: '',
      hasSlots: false,
      hasNgModel: false,
    });
    expect(out).toContain(tpl);
  });
});
