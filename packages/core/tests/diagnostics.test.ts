// D-06 / D-07 / D-08 — diagnostics rendering + code stability scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 04. Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { Diagnostic } from '../src/diagnostics/Diagnostic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('diagnostics (D-06 / D-07 / D-08)', () => {
  it('Diagnostic type is imported from @rozie/core source', () => {
    // Compile-time check that type is reachable from tests.
    // (Type-only assertion — does not execute Diagnostic at runtime.)
    const _diag: Diagnostic | null = null;
    expect(_diag).toBeNull();
    expect(__dirname).toMatch(/tests$/);
  });

  it.todo('D-08: diagnostics are collected and returned, never thrown — parse() returns ParseResult.diagnostics');
  it.todo('D-06: ROZ010 diagnostic renders with @babel/code-frame caret pointing at the correct byte offset');
  it.todo('D-07: ROZxxx codes are stable strings — at least one negative test per ROZ-code range (ROZ001-009 envelope, ROZ010-029 declarative blocks, ROZ030-049 script, ROZ050-069 template, ROZ070-079 modifier, ROZ080-089 style)');
  it.todo('D-06: every diagnostic includes loc + (when applicable) hint field');
});
