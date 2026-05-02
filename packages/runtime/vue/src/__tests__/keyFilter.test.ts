// @rozie/runtime-vue — keyFilter predicate unit tests (Phase 3 Plan 04 Task 1).
//
// Mirrors Phase 2 keyFilters builtins for the runtime-vue side; emitter uses
// these inside watchEffect-emitted handlers when a `<listeners>` entry has a
// key-filter modifier (e.g., `keydown.escape`).
//
// 13 predicates covered: isEnter, isEscape, isTab, isSpace, isDelete, isUp,
// isDown, isLeft, isRight, isCtrl, isAlt, isShift, isMeta.
import { describe, expect, it } from 'vitest';
import {
  isEnter,
  isEscape,
  isTab,
  isSpace,
  isDelete,
  isUp,
  isDown,
  isLeft,
  isRight,
  isCtrl,
  isAlt,
  isShift,
  isMeta,
} from '../keyFilter.js';

describe('keyFilter — 13 predicates', () => {
  it('isEnter matches Enter key, rejects others', () => {
    expect(isEnter(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true);
    expect(isEnter(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe(false);
  });

  it('isEscape matches Escape key, rejects others', () => {
    expect(isEscape(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(true);
    expect(isEscape(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
  });

  it('isTab matches Tab key, rejects others', () => {
    expect(isTab(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe(true);
    expect(isTab(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
  });

  it('isSpace matches " " (space), rejects others', () => {
    expect(isSpace(new KeyboardEvent('keydown', { key: ' ' }))).toBe(true);
    expect(isSpace(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
  });

  it('isDelete matches Delete OR Backspace, rejects others', () => {
    expect(isDelete(new KeyboardEvent('keydown', { key: 'Delete' }))).toBe(true);
    expect(isDelete(new KeyboardEvent('keydown', { key: 'Backspace' }))).toBe(true);
    expect(isDelete(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
  });

  it('isUp matches ArrowUp, rejects others', () => {
    expect(isUp(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(true);
    expect(isUp(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(false);
  });

  it('isDown matches ArrowDown, rejects others', () => {
    expect(isDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(true);
    expect(isDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(false);
  });

  it('isLeft matches ArrowLeft, rejects others', () => {
    expect(isLeft(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe(true);
    expect(isLeft(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe(false);
  });

  it('isRight matches ArrowRight, rejects others', () => {
    expect(isRight(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe(true);
    expect(isRight(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe(false);
  });

  it('isCtrl matches when ctrlKey is true', () => {
    expect(isCtrl(new KeyboardEvent('keydown', { ctrlKey: true }))).toBe(true);
    expect(isCtrl(new KeyboardEvent('keydown', { ctrlKey: false }))).toBe(false);
  });

  it('isAlt matches when altKey is true', () => {
    expect(isAlt(new KeyboardEvent('keydown', { altKey: true }))).toBe(true);
    expect(isAlt(new KeyboardEvent('keydown', { altKey: false }))).toBe(false);
  });

  it('isShift matches when shiftKey is true', () => {
    expect(isShift(new KeyboardEvent('keydown', { shiftKey: true }))).toBe(true);
    expect(isShift(new KeyboardEvent('keydown', { shiftKey: false }))).toBe(false);
  });

  it('isMeta matches when metaKey is true', () => {
    expect(isMeta(new KeyboardEvent('keydown', { metaKey: true }))).toBe(true);
    expect(isMeta(new KeyboardEvent('keydown', { metaKey: false }))).toBe(false);
  });
});
