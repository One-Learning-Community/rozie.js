/**
 * handle-types.test.ts — pins the real, action/data-aware TypeScript signatures
 * for Toaster's imperative handle (show/dismiss/clear/patch/promise).
 *
 * Quick-batch 260927-a2t: these five `$expose`d methods were previously
 * rendered with the untyped `(...args: any[]) => any` fallback in the
 * compiled react `.d.ts` output, despite being functionally action/data-aware
 * (matching the react README's documented Undo example) at runtime. Once
 * Toaster.rozie's `<script lang="ts">` block carries explicit param/return
 * annotations on all five, `synthesizeHandleType` (packages/core) renders the
 * REAL signature instead of the fallback. This test guards against a future
 * edit silently re-widening any of the five back to untyped.
 *
 * Pure GLUE over the @rozie/core public API — mirrors tests/surface.test.ts's
 * house pattern (read Toaster.rozie from disk, compile() for react).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'Toaster.rozie');
const FILENAME = 'Toaster.rozie';
const source = readFileSync(SRC, 'utf8');

const UNTYPED_FALLBACK = '(...args: any[]) => any';

describe('Toaster imperative-handle signatures (react)', () => {
  const result = compile(source, { target: 'react', filename: FILENAME });

  it('compiles with zero error-severity diagnostics', () => {
    const errs = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
  });

  it('emits a `types` string', () => {
    expect(typeof result.types).toBe('string');
    expect((result.types as string).length).toBeGreaterThan(0);
  });

  const types = () => result.types as string;

  it('show(input?: {...}): string — real action/data-aware signature', () => {
    expect(types()).toMatch(/show\(input\?: \{[\s\S]*?\): string;/);
  });

  it('dismiss(id: string): void', () => {
    expect(types()).toContain('dismiss(id: string): void;');
  });

  it('clear(): void', () => {
    expect(types()).toContain('clear(): void;');
  });

  it('patch(id: string, changes?: {...}): boolean — real action/data-aware signature', () => {
    expect(types()).toMatch(/patch\(id: string, changes\?: \{[\s\S]*?\): boolean;/);
  });

  it('promise(p: Promise<unknown>, opts?: {...}): string — real signature', () => {
    expect(types()).toMatch(/promise\(p: Promise<unknown>, opts\?: \{[\s\S]*?\): string;/);
  });

  it('no ToasterHandle member falls through to the untyped D-04 any-array fallback', () => {
    // Scoped to the `interface ToasterHandle { ... }` block specifically —
    // NOT the whole `result.types` string. `result.types` also carries an
    // UNRELATED `renderToast?: (params: { toast: unknown; dismiss:
    // (...args: any[]) => any }) => ReactNode;` prop-callback signature (the
    // #toast scoped-slot's render-prop parameter type, synthesized by a
    // completely different code path than `synthesizeHandleType`'s
    // `ToasterHandle` interface). That slot-param synthesis legitimately
    // falls back to the untyped shape today and is out of this fix's scope
    // (no packages/core file changes) — asserting against the whole string
    // would fail on that unrelated occurrence, not on the five handle
    // members this test actually pins.
    const match = types().match(/interface ToasterHandle \{[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    const handleInterface = match ? match[0] : '';
    expect(handleInterface).not.toContain(UNTYPED_FALLBACK);
  });
});
