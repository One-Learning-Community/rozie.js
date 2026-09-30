/**
 * Behavioral (real React, real DOM) regression test — React port of the Solid
 * `pickListeners` fix (0cff671ed), found by the typed-surface phase 3 review.
 *
 * CONFIRMED BUG: a React root with auto attr/listener fallthrough AND its own
 * `@click` emitted `<button {...attrs} className={…} onClick={own}>`. JSX is
 * last-wins, so a consumer's `onClick` (an undeclared pass-through prop riding
 * in `attrs`) never fired — while Solid / Svelte / Vue all-fire both (R6).
 * Phase 3 made this worse by TYPE-ACCEPTING the consumer's `onClick`.
 *
 * FIX shape (mirrors Solid):
 *   <button {...attrs} className={clsx(own, attrs.className)}
 *           {...mergeListeners({ onClick: own }, pickListeners(attrs))}>
 * `pickListeners` filters `attrs` to function-valued `on[A-Z]*` keys, so
 * `attrs.className` never re-enters the trailing spread (no clobber of the
 * merged class), while both click handlers fire in source order.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { clsx } from '../clsx.js';
import { mergeListeners } from '../mergeListeners.js';
import { pickListeners } from '../pickListeners.js';

afterEach(() => cleanup());

describe('mergeListeners + pickListeners — React R6 all-fire with auto attrs fallthrough', () => {
  it('FIX: className merges (own + consumer) and BOTH onClick handlers fire, own first', () => {
    const calls: string[] = [];
    const attrs: Record<string, unknown> = {
      className: 'consumer-class',
      'data-testid': 'btn',
      onClick: () => calls.push('consumer'),
    };
    const { getByTestId } = render(
      <button
        {...attrs}
        className={clsx('attrs-button', attrs.className as string | undefined)}
        {...mergeListeners({ onClick: () => calls.push('own') }, pickListeners(attrs))}
      >
        x
      </button>,
    );
    const el = getByTestId('btn');
    expect(el.className).toBe('attrs-button consumer-class');
    fireEvent.click(el);
    expect(calls).toEqual(['own', 'consumer']);
  });

  it('MECHANISM GUARD: the pre-fix shape (local onClick after {...attrs}) drops the consumer handler', () => {
    const calls: string[] = [];
    const attrs: Record<string, unknown> = {
      'data-testid': 'btn',
      onClick: () => calls.push('consumer'),
    };
    const { getByTestId } = render(
      <button {...attrs} onClick={() => calls.push('own')}>
        x
      </button>,
    );
    fireEvent.click(getByTestId('btn'));
    expect(calls).toEqual(['own']);
  });

  it('pickListeners keeps only function-valued on[A-Z] keys and skips pollution keys', () => {
    const fn = () => undefined;
    const picked = pickListeners({
      onClick: fn,
      onMouseEnter: fn,
      onclick: fn,
      online: fn,
      onFoo: 'not-a-function',
      className: 'c',
      style: { color: 'red' },
      ['__proto__']: fn,
    } as Record<string, unknown>);
    expect(Object.keys(picked).sort()).toEqual(['onClick', 'onMouseEnter']);
  });
});
