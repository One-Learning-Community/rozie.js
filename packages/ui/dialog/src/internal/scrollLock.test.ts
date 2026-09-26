/**
 * Unit tests for the ref-counted `<html>` scroll lock (the only branchy,
 * non-reactive logic in the family). Vendored alongside scrollLock.ts but
 * EXCLUDED from leaves by copyInternal (`*.test.ts` filter).
 *
 * No real DOM needed (and no new jsdom/happy-dom devDependency to keep the
 * lockfile untouched) — a plain duck-typed `document` stub is enough, since
 * `applyScrollLock` only ever reads/writes `document.documentElement.style.overflow`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetScrollLockForTests, applyScrollLock } from './scrollLock';

function stubDocument(initialOverflow = '') {
  const root = { style: { overflow: initialOverflow } };
  (globalThis as unknown as { document: unknown }).document = { documentElement: root };
  return root;
}

describe('applyScrollLock', () => {
  beforeEach(() => {
    _resetScrollLockForTests();
  });

  afterEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  it('locks on the first call and restores on the matching unlock', () => {
    const root = stubDocument('');
    applyScrollLock(true);
    expect(root.style.overflow).toBe('hidden');
    applyScrollLock(false);
    expect(root.style.overflow).toBe('');
  });

  it('restores the ORIGINAL inline overflow, not a hardcoded empty string', () => {
    const root = stubDocument('auto');
    applyScrollLock(true);
    expect(root.style.overflow).toBe('hidden');
    applyScrollLock(false);
    expect(root.style.overflow).toBe('auto');
  });

  it('nested dialogs: closing the INNER one keeps the lock while the OUTER is still open', () => {
    const root = stubDocument('');
    applyScrollLock(true); // outer opens
    applyScrollLock(true); // inner opens
    expect(root.style.overflow).toBe('hidden');
    applyScrollLock(false); // inner closes
    expect(root.style.overflow).toBe('hidden'); // still locked — outer is open
    applyScrollLock(false); // outer closes
    expect(root.style.overflow).toBe(''); // now released
  });

  it('three-deep stack releases only after the last close', () => {
    const root = stubDocument('');
    applyScrollLock(true);
    applyScrollLock(true);
    applyScrollLock(true);
    applyScrollLock(false);
    applyScrollLock(false);
    expect(root.style.overflow).toBe('hidden');
    applyScrollLock(false);
    expect(root.style.overflow).toBe('');
  });

  it('an unbalanced extra unlock is a no-op, never going negative', () => {
    const root = stubDocument('');
    applyScrollLock(true);
    applyScrollLock(false);
    applyScrollLock(false); // extra, unbalanced release
    expect(root.style.overflow).toBe('');
    // A fresh lock still behaves like a clean 0 -> 1 transition.
    applyScrollLock(true);
    expect(root.style.overflow).toBe('hidden');
  });

  it('no-ops when document is undefined (pre-DOM / SSR)', () => {
    delete (globalThis as unknown as { document?: unknown }).document;
    expect(() => applyScrollLock(true)).not.toThrow();
  });
});
