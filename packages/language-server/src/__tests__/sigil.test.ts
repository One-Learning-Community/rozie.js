import { describe, expect, it } from 'vitest';
import { resolveSigilMemberAt, sigilCompletionContext } from '../sigil.js';

describe('resolveSigilMemberAt', () => {
  const text = 'a = $props.count + $data.hovering';

  it('resolves a token when the offset is inside the member', () => {
    const offset = text.indexOf('count') + 2;
    const ref = resolveSigilMemberAt(text, offset);
    expect(ref?.sigil).toBe('props');
    expect(ref?.member).toBe('count');
    expect(text.slice(ref!.memberLoc.start, ref!.memberLoc.end)).toBe('count');
    expect(text.slice(ref!.tokenLoc.start, ref!.tokenLoc.end)).toBe('$props.count');
  });

  it('resolves when the offset is on the sigil', () => {
    const ref = resolveSigilMemberAt(text, text.indexOf('$data') + 1);
    expect(ref?.sigil).toBe('data');
    expect(ref?.member).toBe('hovering');
  });

  it('returns null when the offset is outside any sigil token', () => {
    expect(resolveSigilMemberAt(text, 0)).toBeNull();
  });

  it('ignores bare member access on unknown sigils', () => {
    expect(resolveSigilMemberAt('$state.x', 4)).toBeNull();
  });
});

describe('sigilCompletionContext', () => {
  it('detects the trigger immediately after the dot', () => {
    const text = 'value: $refs.';
    const ctx = sigilCompletionContext(text, text.length);
    expect(ctx?.sigil).toBe('refs');
    expect(ctx?.partial).toBe('');
    expect(ctx?.partialStart).toBe(text.length);
  });

  it('captures a partially typed member and where it starts', () => {
    const text = '{{ $props.co';
    const ctx = sigilCompletionContext(text, text.length);
    expect(ctx?.sigil).toBe('props');
    expect(ctx?.partial).toBe('co');
    expect(ctx?.partialStart).toBe(text.length - 2);
  });

  it('returns null when not in a sigil member position', () => {
    expect(sigilCompletionContext('const x = 1', 11)).toBeNull();
    expect(sigilCompletionContext('$props', 6)).toBeNull();
  });
});
