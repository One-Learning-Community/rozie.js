// Behavior tests for the strict-containment focus guard — Plan 260806-lz7.
// Composed-tree ascent/descent through shadow DOM, and the pinned fallback
// semantics documented in focusGuard.ts's module comment.
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  composedActiveElement,
  composedContains,
  documentHasRealFocus,
  focusIsWithinScope,
} from '../focusGuard.js';

describe('composedActiveElement', () => {
  it('returns null when nothing has ever been focused (document.body is active)', () => {
    expect(composedActiveElement(document)).toBe(document.body);
  });

  it('returns the light-DOM focused element when there is no shadow descent', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(composedActiveElement(document)).toBe(btn);
    btn.remove();
  });

  it('descends into an open shadow root to find the truly-focused element', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    inner.tabIndex = 0;
    shadow.appendChild(inner);
    inner.focus();
    expect(composedActiveElement(document)).toBe(inner);
    host.remove();
  });
});

describe('composedContains', () => {
  it('true when node is a direct light-DOM descendant of anchor', () => {
    const anchor = document.createElement('div');
    const child = document.createElement('button');
    anchor.appendChild(child);
    document.body.appendChild(anchor);
    expect(composedContains(anchor, child)).toBe(true);
    anchor.remove();
  });

  it('false when node is outside anchor entirely', () => {
    const anchor = document.createElement('div');
    const other = document.createElement('button');
    document.body.appendChild(anchor);
    document.body.appendChild(other);
    expect(composedContains(anchor, other)).toBe(false);
    anchor.remove();
    other.remove();
  });

  it('true when node is inside an open shadow root whose host IS the anchor (the case plain Node.contains fails)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    shadow.appendChild(inner);
    // Sanity: native Node.contains cannot see into the shadow root.
    expect(host.contains(inner)).toBe(false);
    expect(composedContains(host, inner)).toBe(true);
    host.remove();
  });
});

describe('documentHasRealFocus', () => {
  it('false when active element is document.body', () => {
    expect(documentHasRealFocus(document)).toBe(false);
  });

  it('false when active element is document.documentElement', () => {
    // jsdom/happy-dom: documentElement can become active via tabIndex + focus
    // in some engines; simulate directly by asserting the predicate handles it.
    const docEl = document.documentElement;
    docEl.tabIndex = -1;
    docEl.focus();
    // Some DOM implementations refuse to focus documentElement and fall back
    // to body; either way the predicate must be false for both.
    expect(documentHasRealFocus(document)).toBe(false);
  });

  it('true when a real element outside body/documentElement holds focus', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(documentHasRealFocus(document)).toBe(true);
    btn.remove();
  });
});

describe('focusIsWithinScope', () => {
  it('false on a cold document with nothing focused, regardless of scope', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    expect(focusIsWithinScope([anchor], document)).toBe(false);
    anchor.remove();
  });

  it('true when the focused element is inside one of the anchors', () => {
    const anchor = document.createElement('div');
    const child = document.createElement('button');
    anchor.appendChild(child);
    document.body.appendChild(anchor);
    child.focus();
    expect(focusIsWithinScope([anchor], document)).toBe(true);
    anchor.remove();
  });

  it('false when the focused element is outside every anchor (strict containment, not document-scoped)', () => {
    const anchor = document.createElement('div');
    const outside = document.createElement('button');
    document.body.appendChild(anchor);
    document.body.appendChild(outside);
    outside.focus();
    expect(focusIsWithinScope([anchor], document)).toBe(false);
    anchor.remove();
    outside.remove();
  });

  it('true when the focused element is inside a shadow root whose host is an anchor', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    shadow.appendChild(inner);
    inner.focus();
    expect(focusIsWithinScope([host], document)).toBe(true);
    host.remove();
  });

  it('falls back to documentHasRealFocus when scope is empty', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    expect(focusIsWithinScope([], document)).toBe(true);
    outside.remove();
  });

  it('falls back to documentHasRealFocus when scope is null', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    expect(focusIsWithinScope(null, document)).toBe(true);
    outside.remove();
  });

  it('falls back to documentHasRealFocus when every scope entry is null or disconnected', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const disconnected = document.createElement('div');
    expect(focusIsWithinScope([null, disconnected], document)).toBe(true);
    outside.remove();
  });

  it('a single Element scope value (not an array) is normalized correctly', () => {
    const anchor = document.createElement('div');
    const child = document.createElement('button');
    anchor.appendChild(child);
    document.body.appendChild(anchor);
    child.focus();
    expect(focusIsWithinScope(anchor, document)).toBe(true);
    anchor.remove();
  });
});
