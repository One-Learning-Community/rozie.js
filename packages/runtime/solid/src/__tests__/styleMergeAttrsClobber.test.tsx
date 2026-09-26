/**
 * Quick 260926 — behavioral (real solid-js, real DOM) regression test for
 * the "own `style` clobbered by consumer `style`" bug (Slider/Resizable
 * shape).
 *
 * CONFIRMED BUG: a root element that computes its OWN `style` (e.g.
 * `:style="fillStyle"`, a `$computed` CSS-custom-property map) AND carries
 * the auto-fallthrough `{...attrs}` spread previously emitted
 * `style={parseInlineStyle(fillStyle())} {...attrs}` — `style=` BEFORE the
 * spread, with NO re-merge after. Solid's compiler flattens same-element
 * attrs/spreads into ONE `mergeProps(...)` call where a LATER source always
 * wins per key (verified against `packages/ui/slider/packages/solid/dist/
 * index.mjs`'s `mergeProps({ get style() {...} }, attrs, { get class() {...}
 * })` shape) — so a consumer's pass-through `style` prop (an undeclared key,
 * landing in the same `attrs` rest bucket) REPLACED the component's own
 * style OUTRIGHT, wiping custom properties like
 * `--rozie-slider-fill-start`/`--rozie-slider-fill-end` instead of merging
 * with them.
 *
 * THE FIX mirrors Vue's fallthrough-attrs parity target
 * (`normalizeStyle([own, fallthrough])` — fallthrough wins per OVERLAPPING
 * declaration, but the component's own properties the consumer never set
 * survive): the emitter now defers the `style=` attribute to AFTER the
 * spread and wraps BOTH sources in `parseInlineStyle([own, attrs.style])` —
 * `parseInlineStyle`'s array form was already purpose-built for exactly this
 * "later wins" cascade merge (see its own doc comment).
 *
 * This test exercises the REAL `mergeProps`/`spread` from `solid-js/web` (the
 * same primitives Solid's compiler emits) against a REAL DOM node, so it
 * proves the merge executes correctly, not just that the emitted source text
 * looks right.
 */
import { describe, expect, it } from 'vitest';
import { createRoot } from 'solid-js';
import { mergeProps, spread } from 'solid-js/web';
import { parseInlineStyle } from '../parseInlineStyle.js';

describe('parseInlineStyle array-merge — R6 style-clobber bugfix (real DOM, real solid-js merge)', () => {
  it('FIX: consumer style MERGES with (does not replace) the component\'s own custom properties', () => {
    createRoot((dispose) => {
      const attrs: Record<string, unknown> = { style: 'color: red' };
      const fillStyle = () => ({
        '--rozie-slider-fill-start': '10%',
        '--rozie-slider-fill-end': '90%',
      });
      const el = document.createElement('div');
      document.body.appendChild(el);

      // Mirrors the emitted shape (post-fix): `{...attrs}` FIRST, the
      // (deferred) merged `style=` LAST so it wins JSX's last-write
      // ordering — `parseInlineStyle([own, attrs.style])`.
      spread(
        el,
        mergeProps(attrs, {
          get style() {
            return parseInlineStyle([
              fillStyle(),
              attrs.style as string | undefined,
            ]);
          },
        }),
        false,
        true,
      );

      // The component's own custom properties SURVIVE …
      expect(el.style.getPropertyValue('--rozie-slider-fill-start')).toBe('10%');
      expect(el.style.getPropertyValue('--rozie-slider-fill-end')).toBe('90%');
      // … AND the consumer's own declaration is honored (merge, not
      // replace).
      expect(el.style.color).toBe('red');

      el.remove();
      dispose();
    });
  });

  it('MECHANISM GUARD: emitting style BEFORE the spread (no merge) reproduces the historical clobber', () => {
    createRoot((dispose) => {
      const attrs: Record<string, unknown> = { style: 'color: red' };
      const fillStyle = () => ({ '--rozie-slider-fill-start': '10%' });
      const el = document.createElement('div');
      document.body.appendChild(el);

      // The PRE-FIX shape: `style=` (own value only, no merge) THEN
      // `{...attrs}` — attrs' raw `style` key rides in AFTER and wins.
      spread(
        el,
        mergeProps(
          { get style() { return parseInlineStyle(fillStyle()); } },
          attrs,
        ),
        false,
        true,
      );

      // CONFIRMED BUG: the custom property is gone — replaced outright by
      // the consumer's `style`.
      expect(el.style.getPropertyValue('--rozie-slider-fill-start')).toBe('');
      expect(el.style.color).toBe('red');

      el.remove();
      dispose();
    });
  });
});
