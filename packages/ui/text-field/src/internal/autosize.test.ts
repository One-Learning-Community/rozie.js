import { describe, it, expect } from 'vitest';
import { autosizeHeight, applyAutosize } from './autosize';

describe('autosizeHeight', () => {
  // 20px line height, 8px vertical padding, 2px vertical border.
  const box = { lineHeight: 20, paddingY: 8, borderY: 2 };

  it('grows to fit the content (scrollHeight + border)', () => {
    expect(autosizeHeight({ ...box, scrollHeight: 108, minRows: 1, maxRows: null })).toEqual({
      height: 110,
      capped: false,
    });
  });

  it('never shrinks below minRows', () => {
    expect(autosizeHeight({ ...box, scrollHeight: 28, minRows: 3, maxRows: null })).toEqual({
      height: 3 * 20 + 8 + 2,
      capped: false,
    });
  });

  it('caps at maxRows and reports the cap', () => {
    expect(autosizeHeight({ ...box, scrollHeight: 500, minRows: 1, maxRows: 4 })).toEqual({
      height: 4 * 20 + 8 + 2,
      capped: true,
    });
  });

  it('ignores a maxRows below minRows', () => {
    expect(autosizeHeight({ ...box, scrollHeight: 28, minRows: 3, maxRows: 2 }).height).toBe(70);
  });

  it('treats non-positive or non-numeric rows as unset', () => {
    expect(autosizeHeight({ ...box, scrollHeight: 48, minRows: 0, maxRows: 0 })).toEqual({
      height: 50,
      capped: false,
    });
  });
});

describe('applyAutosize', () => {
  const makeEl = (scrollHeight: number) => {
    const style = { height: '73px', overflowY: '' };
    const el = { style, scrollHeight };
    const computed = {
      lineHeight: '20px',
      fontSize: '16px',
      paddingTop: '4px',
      paddingBottom: '4px',
      borderTopWidth: '1px',
      borderBottomWidth: '1px',
    };
    return { el, style, getStyle: () => computed };
  };

  it('resets height to auto before measuring, then writes the fitted height', () => {
    const { el, style, getStyle } = makeEl(108);
    const seen: string[] = [];
    Object.defineProperty(el, 'scrollHeight', {
      get() {
        seen.push(style.height);
        return 108;
      },
    });
    applyAutosize(el, 1, null, getStyle);
    expect(seen).toEqual(['auto']);
    expect(style.height).toBe('110px');
    expect(style.overflowY).toBe('hidden');
  });

  it('turns scrolling back on once capped', () => {
    const { el, style, getStyle } = makeEl(500);
    applyAutosize(el, 1, 3, getStyle);
    expect(style.height).toBe('70px');
    expect(style.overflowY).toBe('auto');
  });

  it('falls back to 1.2 × font-size when line-height is "normal"', () => {
    const { el, style } = makeEl(10);
    const getStyle = () => ({
      lineHeight: 'normal',
      fontSize: '10px',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderTopWidth: '0px',
      borderBottomWidth: '0px',
    });
    applyAutosize(el, 2, null, getStyle);
    expect(style.height).toBe('24px');
  });

  it('is a no-op for a missing element', () => {
    expect(() => applyAutosize(null, 1, null)).not.toThrow();
  });
});
