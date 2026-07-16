import { describe, it, expect } from 'vitest';
import {
  argsOf,
  hasArgs,
  initArgValues,
  firstUnfilledRequiredIndex,
  canSubmitArgs,
  buildArgsPayload,
  isFirstFieldEmpty,
  type ArgSpec,
} from './argsSurface';

const arg = (id: string, opts: Partial<ArgSpec> = {}): ArgSpec => ({ id, ...opts });

describe('argsOf', () => {
  it('returns the normalized args list matching the source when every entry has an id', () => {
    const args = [arg('a'), arg('b')];
    expect(argsOf({ args })).toEqual(args);
  });

  it('normalizes absent/non-array args to []', () => {
    expect(argsOf({})).toEqual([]);
    expect(argsOf(null)).toEqual([]);
    expect(argsOf(undefined)).toEqual([]);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    expect(argsOf({ args: 'nope' } as any)).toEqual([]);
  });

  it('skips entries with no id, never throwing on a legacy/malformed item', () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed input
    const malformed = [{ placeholder: 'no id here' }, arg('valid'), null, undefined] as any;
    expect(argsOf({ args: malformed })).toEqual([arg('valid')]);
  });
});

describe('hasArgs', () => {
  it('is true for a non-null, non-disabled item with a non-empty args array', () => {
    expect(hasArgs({ args: [arg('a')] })).toBe(true);
  });

  it('is false for null/undefined', () => {
    expect(hasArgs(null)).toBe(false);
    expect(hasArgs(undefined)).toBe(false);
  });

  it('is false for a disabled item even with args', () => {
    expect(hasArgs({ disabled: true, args: [arg('a')] })).toBe(false);
  });

  it('is false when args is missing or empty', () => {
    expect(hasArgs({})).toBe(false);
    expect(hasArgs({ args: [] })).toBe(false);
  });
});

describe('initArgValues', () => {
  it('seeds each id with String(default) when a default is present', () => {
    expect(initArgValues([arg('name', { default: 'Untitled' }), arg('count', { default: '3' })])).toEqual({
      name: 'Untitled',
      count: '3',
    });
  });

  it('seeds with empty string when no default is present', () => {
    expect(initArgValues([arg('name'), arg('count', { required: true })])).toEqual({
      name: '',
      count: '',
    });
  });

  it('returns a fresh object on every call (not a shared reference)', () => {
    const argList = [arg('name', { default: 'x' })];
    const first = initArgValues(argList);
    const second = initArgValues(argList);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it('returns {} for an empty/absent arg list', () => {
    expect(initArgValues([])).toEqual({});
    expect(initArgValues(undefined)).toEqual({});
  });
});

describe('firstUnfilledRequiredIndex', () => {
  it('returns -1 when every required arg is satisfied', () => {
    const argList = [arg('a', { required: true }), arg('b')];
    expect(firstUnfilledRequiredIndex(argList, { a: 'hi', b: '' })).toBe(-1);
  });

  it('returns the index of the first required arg whose trimmed value is empty', () => {
    const argList = [arg('a', { required: true }), arg('b', { required: true })];
    expect(firstUnfilledRequiredIndex(argList, { a: 'hi', b: '' })).toBe(1);
  });

  it('treats a whitespace-only value as empty after trim', () => {
    const argList = [arg('a', { required: true })];
    expect(firstUnfilledRequiredIndex(argList, { a: '   ' })).toBe(0);
  });

  it('never blocks on a non-required empty field', () => {
    const argList = [arg('a', { required: false }), arg('b', { required: true })];
    expect(firstUnfilledRequiredIndex(argList, { a: '', b: 'ok' })).toBe(-1);
  });

  it('returns -1 for an empty arg list', () => {
    expect(firstUnfilledRequiredIndex([], {})).toBe(-1);
  });
});

describe('canSubmitArgs', () => {
  it('is true iff firstUnfilledRequiredIndex is -1', () => {
    const argList = [arg('a', { required: true })];
    expect(canSubmitArgs(argList, { a: 'filled' })).toBe(true);
    expect(canSubmitArgs(argList, { a: '' })).toBe(false);
  });

  it('is true for an arg list with no required fields regardless of values', () => {
    expect(canSubmitArgs([arg('a')], { a: '' })).toBe(true);
  });
});

describe('buildArgsPayload', () => {
  it('builds a trimmed { [id]: value } over every declared arg (required and optional)', () => {
    const argList = [arg('name', { required: true }), arg('note')];
    expect(buildArgsPayload(argList, { name: '  Untitled  ', note: '' })).toEqual({
      name: 'Untitled',
      note: '',
    });
  });

  it('trims surrounding whitespace on every value', () => {
    const argList = [arg('a')];
    expect(buildArgsPayload(argList, { a: '  spaced value  ' })).toEqual({ a: 'spaced value' });
  });

  it('includes optional-empty fields as empty string (not omitted)', () => {
    const argList = [arg('required1', { required: true }), arg('optional1')];
    const payload = buildArgsPayload(argList, { required1: 'x', optional1: '' });
    expect(payload).toHaveProperty('optional1', '');
  });

  it('ignores stray value keys not declared by the author', () => {
    const argList = [arg('a')];
    // biome-ignore lint/suspicious/noExplicitAny: deliberately extra key
    expect(buildArgsPayload(argList, { a: 'x', stray: 'y' } as any)).toEqual({ a: 'x' });
  });

  it('coerces a missing value to empty string for a declared id', () => {
    const argList = [arg('a')];
    expect(buildArgsPayload(argList, {})).toEqual({ a: '' });
  });
});

describe('isFirstFieldEmpty', () => {
  it('is true iff the FIRST arg raw value is exactly the empty string', () => {
    const argList = [arg('a'), arg('b')];
    expect(isFirstFieldEmpty(argList, { a: '', b: 'x' })).toBe(true);
    expect(isFirstFieldEmpty(argList, { a: 'x', b: '' })).toBe(false);
  });

  it('does NOT trim — a space-only field does not pop', () => {
    const argList = [arg('a')];
    expect(isFirstFieldEmpty(argList, { a: '  ' })).toBe(false);
  });

  it('is true when there are no args at all', () => {
    expect(isFirstFieldEmpty([], {})).toBe(true);
  });
});
