/**
 * Quick task 260521-qsh — keyFilter predicate tests for @rozie/runtime-solid.
 *
 * runtime-solid's keyFilter.ts is a verbatim copy of runtime-react's; this
 * mirrors runtime-react's keyFilter.test.ts (a `kbd()` factory builds a
 * KeyboardEvent) and asserts all 12 predicates true-on-match + false-on-miss.
 */
import { describe, it, expect } from 'vitest';
import {
  isEnter,
  isEscape,
  isTab,
  isSpace,
  isUp,
  isDown,
  isLeft,
  isRight,
  isCtrl,
  isAlt,
  isShift,
  isMeta,
} from '../keyFilter.js';

function kbd(init: {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('keyFilter predicates (runtime-solid)', () => {
  it('isEnter matches Enter only', () => {
    expect(isEnter(kbd({ key: 'Enter' }))).toBe(true);
    expect(isEnter(kbd({ key: 'a' }))).toBe(false);
  });

  it('isEscape matches Escape only', () => {
    expect(isEscape(kbd({ key: 'Escape' }))).toBe(true);
    expect(isEscape(kbd({ key: 'Esc' }))).toBe(false);
  });

  it('isTab matches Tab only', () => {
    expect(isTab(kbd({ key: 'Tab' }))).toBe(true);
    expect(isTab(kbd({ key: 'a' }))).toBe(false);
  });

  it('isSpace matches " " only', () => {
    expect(isSpace(kbd({ key: ' ' }))).toBe(true);
    expect(isSpace(kbd({ key: 'Space' }))).toBe(false);
  });

  it('arrow predicates match their own arrow only', () => {
    expect(isUp(kbd({ key: 'ArrowUp' }))).toBe(true);
    expect(isUp(kbd({ key: 'ArrowDown' }))).toBe(false);
    expect(isDown(kbd({ key: 'ArrowDown' }))).toBe(true);
    expect(isDown(kbd({ key: 'ArrowUp' }))).toBe(false);
    expect(isLeft(kbd({ key: 'ArrowLeft' }))).toBe(true);
    expect(isLeft(kbd({ key: 'ArrowRight' }))).toBe(false);
    expect(isRight(kbd({ key: 'ArrowRight' }))).toBe(true);
    expect(isRight(kbd({ key: 'ArrowLeft' }))).toBe(false);
  });

  it('modifier-key predicates read .ctrlKey/.altKey/.shiftKey/.metaKey', () => {
    expect(isCtrl(kbd({ key: 'a', ctrlKey: true }))).toBe(true);
    expect(isCtrl(kbd({ key: 'a', ctrlKey: false }))).toBe(false);
    expect(isAlt(kbd({ key: 'a', altKey: true }))).toBe(true);
    expect(isAlt(kbd({ key: 'a', altKey: false }))).toBe(false);
    expect(isShift(kbd({ key: 'a', shiftKey: true }))).toBe(true);
    expect(isShift(kbd({ key: 'a', shiftKey: false }))).toBe(false);
    expect(isMeta(kbd({ key: 'a', metaKey: true }))).toBe(true);
    expect(isMeta(kbd({ key: 'a', metaKey: false }))).toBe(false);
  });
});
