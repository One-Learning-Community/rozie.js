/**
 * Quick 260926 — behavioral (real solid-js, real DOM) regression test for the
 * `mergeListeners(..., attrs)` full-attrs-clobber bug.
 *
 * CONFIRMED BUG (solid-js 1.9.12 render audit): a Solid leaf's root element
 * with an OWN class (recomputed AFTER the auto-fallthrough `{...attrs}`
 * spread — `class={"rozie-dialog" + (attrs.class ? " " + attrs.class : "")}`)
 * AND a directly-bound `@event` listener emits
 * `{...mergeListeners({ onCancel: ..., onClick: ... }, attrs)}` — passing the
 * WHOLE `attrs` rest-of-props bucket (not just its listener keys) into the
 * merge. Affected: dialog-solid, switch-solid, pagination-solid, toast-solid.
 *
 * This test exercises the REAL compiled shape: Solid's compiler flattens an
 * element's mixed attrs+spreads into ONE `mergeProps(...)` call, spread onto
 * the DOM via `spread()` (verified against
 * `packages/ui/dialog/packages/solid/dist/index.mjs`). Both `mergeProps` and
 * `spread` here are the REAL `solid-js/web` exports — not string assertions
 * against emitter output — so this proves the merge executes correctly
 * against Solid's actual reactivity/DOM-patching system, not just that the
 * emitted source text looks right.
 *
 * `pickListeners` (the fix, `../pickListeners.js`) filters the merge-partial
 * down to `on*`-prefixed, function-valued keys ONLY, so `attrs.class` never
 * re-enters `mergeListeners` and can't clobber the class computed one
 * attribute earlier — while a consumer-supplied `onClick` (an undeclared
 * pass-through prop, landing in the same `attrs` bucket) still R6-all-fires
 * alongside the component's own handler.
 */
import { describe, expect, it } from 'vitest';
import { createRoot } from 'solid-js';
import { mergeProps, spread } from 'solid-js/web';
import { mergeListeners } from '../mergeListeners.js';
import { pickListeners } from '../pickListeners.js';

describe('mergeListeners + pickListeners — R6 attrs-clobber bugfix (real DOM, real solid-js merge)', () => {
  it('FIX: class merges (own + consumer) and BOTH onClick handlers still all-fire (R6)', () => {
    createRoot((dispose) => {
      const ownClicks: string[] = [];
      const consumerClicks: string[] = [];
      const attrs: Record<string, unknown> = {
        class: 'consumer-class',
        onClick: () => consumerClicks.push('consumer'),
      };
      const el = document.createElement('button');
      document.body.appendChild(el);

      // Mirrors the emitted shape (post-fix):
      //   {...attrs} class={"rozie-dialog" + (attrs.class ? " " + attrs.class : "")}
      //   {...mergeListeners({ onClick: ... }, pickListeners(attrs))}
      spread(
        el,
        mergeProps(
          attrs,
          {
            get class() {
              return 'rozie-dialog' + (attrs.class ? ` ${attrs.class as string}` : '');
            },
          },
          () => mergeListeners({ onClick: () => ownClicks.push('own') }, pickListeners(attrs)),
        ),
        false,
        true,
      );

      // The component's OWN class survives alongside the consumer's — no
      // clobber.
      expect(el.className).toBe('rozie-dialog consumer-class');

      el.click();
      // R6 all-fire: BOTH the component's own handler and the consumer's
      // pass-through `onClick` (an undeclared prop riding in `attrs`) fire.
      expect(ownClicks).toEqual(['own']);
      expect(consumerClicks).toEqual(['consumer']);

      el.remove();
      dispose();
    });
  });

  it('MECHANISM GUARD: merging the RAW (unfiltered) attrs bucket reproduces the historical clobber', () => {
    // Same shape as above, MINUS `pickListeners` — documents exactly why the
    // fix is necessary. If this ever starts passing (class survives) without
    // `pickListeners`, `mergeListeners` itself changed shape and the seam
    // this bugfix relies on needs re-review.
    createRoot((dispose) => {
      const attrs: Record<string, unknown> = {
        class: 'consumer-class',
        onClick: () => undefined,
      };
      const el = document.createElement('button');
      document.body.appendChild(el);

      spread(
        el,
        mergeProps(attrs, { get class() {
          return 'rozie-dialog' + (attrs.class ? ` ${attrs.class as string}` : '');
        } }, () => mergeListeners({ onClick: () => undefined }, attrs)),
        false,
        true,
      );

      // CONFIRMED BUG: the raw `attrs.class` rides along in the trailing
      // `mergeListeners(...)` spread and clobbers the class computed one
      // attribute earlier.
      expect(el.className).toBe('consumer-class');

      el.remove();
      dispose();
    });
  });
});
