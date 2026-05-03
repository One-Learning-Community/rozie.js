/**
 * Plan 04-04 Task 1 — keyFilter predicate tests.
 *
 * Sanity-check that each exported predicate matches the intended key only.
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

function kbd(init: { key: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('keyFilter predicates (Plan 04-04 Task 1)', () => {
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

  it('arrow predicates', () => {
    expect(isUp(kbd({ key: 'ArrowUp' }))).toBe(true);
    expect(isDown(kbd({ key: 'ArrowDown' }))).toBe(true);
    expect(isLeft(kbd({ key: 'ArrowLeft' }))).toBe(true);
    expect(isRight(kbd({ key: 'ArrowRight' }))).toBe(true);
    expect(isUp(kbd({ key: 'ArrowDown' }))).toBe(false);
  });

  it('modifier-key predicates: read .ctrlKey/.altKey/.shiftKey/.metaKey', () => {
    expect(isCtrl(kbd({ key: 'a', ctrlKey: true }))).toBe(true);
    expect(isCtrl(kbd({ key: 'a', ctrlKey: false }))).toBe(false);
    expect(isAlt(kbd({ key: 'a', altKey: true }))).toBe(true);
    expect(isShift(kbd({ key: 'a', shiftKey: true }))).toBe(true);
    expect(isMeta(kbd({ key: 'a', metaKey: true }))).toBe(true);
  });
});
