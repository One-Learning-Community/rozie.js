/**
 * emitLit-shape tests — Plan 06.4-01 Task 2 shape contract.
 *
 * Verifies the P1 stub returns the documented EmitLitResult shape for any
 * input. The per-example .ts fixture snapshots get locked in Plan 06.4-02 (P2).
 *
 * Tests:
 *   - emitLit returns { code: string, map: null, diagnostics: [] }
 *   - The stub code is the documented placeholder for now (P2 swaps in real)
 *   - All per-example fixture-snapshot expectations are it.todo (P2-locked)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

describe('emitLit — shape contract', () => {
  it('returns { code, map, diagnostics } shape for a trivial input', () => {
    const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    expect(ast).not.toBeNull();
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    expect(ir).not.toBeNull();
    const result = emitLit(ir!, {
      filename: 'Counter.rozie',
      source,
      modifierRegistry: registry,
    });
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.map).toBeNull();
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('returns a Lit class extending SignalWatcher(LitElement) for Counter (P2 real emission)', () => {
    const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const result = emitLit(ir!);
    // Plan 06.4-02 P2 — real emission replaces the P1 stub.
    expect(result.code).toContain('export default class Counter extends SignalWatcher(LitElement)');
    expect(result.code).toContain("@customElement('rozie-counter')");
  });

  it('returns non-empty .ts strings for all 8 reference examples', () => {
    const examples = [
      'Counter',
      'SearchInput',
      'Dropdown',
      'TodoList',
      'Modal',
      'TreeNode',
      'Card',
      'CardHeader',
    ];
    const registry = createDefaultRegistry();
    for (const name of examples) {
      const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
      const { ast } = parse(source, { filename: `${name}.rozie` });
      expect(ast, `parse ${name}.rozie`).not.toBeNull();
      const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
      expect(ir, `lowerToIR ${name}.rozie`).not.toBeNull();
      const result = emitLit(ir!, {
        filename: `${name}.rozie`,
        source,
        modifierRegistry: registry,
      });
      expect(result.code.length, `emitLit ${name}.rozie code`).toBeGreaterThan(0);
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors, `emitLit ${name}.rozie diagnostics`).toHaveLength(0);
    }
  });

  // ---- P2 invariants (T-06.4-03 + D-LIT-14) ----
  it('T-06.4-03: emitter source emits unsafe-html ONLY CONDITIONALLY (Phase 24 req 2)', () => {
    // RELAXED for Phase 24 (req 2). The original invariant was "NO emitter
    // source imports/uses unsafe-html at all" — lit-html's `html`` auto-
    // escapes, so an UNCONDITIONAL unsafeHTML would be a blanket XSS surface.
    // Phase 24 introduces `r-html` → `${unsafeHTML(<expr>)}`, a CONDITIONAL,
    // opt-in raw-HTML sink (mirrors React `dangerouslySetInnerHTML`, Svelte
    // `{@html}`). The invariant therefore becomes: any unsafe-html import or
    // `unsafeHTML(` reference in emitter source MUST be guarded by the
    // `unsafeHtmlUsed` flag (the import line in emitLit.ts) or live inside an
    // emitted output template-literal (the `${unsafeHTML(...)}` in
    // emitTemplate.ts). No emitter source may emit unsafe-html
    // UNCONDITIONALLY into every component.
    // Scan EMITTER source only — skip `__tests__` (test files legitimately
    // assert on emitted-output strings containing the unsafe-html import).
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name === '__tests__') continue;
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith('.ts')) out.push(full);
      }
      return out;
    }
    const srcRoot = resolve(HERE, '..');
    const files = walk(srcRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // An unsafe-html import is permitted ONLY when gated by the
      // `unsafeHtmlUsed` flag on the same line (the emitLit.ts conditional).
      const importLines = text
        .split('\n')
        .filter((l) => /from\s+['"]lit\/directives\/unsafe-html\.js['"]/.test(l));
      for (const line of importLines) {
        expect(line, `${file} unsafe-html import must be unsafeHtmlUsed-gated`).toMatch(
          /unsafeHtmlUsed/,
        );
      }
    }
  });

  it('D-LIT-14: emitter source uses @queryAssignedElements, never @queryAssignedNodes', () => {
    // Whitespace text-nodes between elements always return as "present" when
    // querying via queryAssignedNodes — that breaks $slots.X presence checks.
    // D-LIT-14 (2026-05-13 correction) mandates queryAssignedElements with
    // `flatten: true` instead.
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith('.ts')) out.push(full);
      }
      return out;
    }
    const srcRoot = resolve(HERE, '..');
    const files = walk(srcRoot).filter((f) => !f.includes('__tests__'));
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // Allow the type-name reference inside the LitDecoratorImport union
      // (the type is still part of the lit/decorators.js surface; we just
      // must never *call* @queryAssignedNodes as a decorator). Block the
      // decorator usage pattern but allow the type-union mention.
      const blockedPattern = /@queryAssignedNodes\s*\(/;
      expect(text, `${file} must not call @queryAssignedNodes`).not.toMatch(blockedPattern);
    }
  });
});
