/**
 * Runtime wrapper around the peggy-generated modifier-chain parser.
 *
 * The generated parser (`generated.js`) is created at install time by the
 * `prepare` script (`peggy --output ...`). The generated file is .gitignored
 * and not committed to source control (RESEARCH.md Open Question 2 resolution:
 * regenerate on prepare path). peggy itself is therefore a devDependency only;
 * the runtime never imports peggy.
 *
 * The wrapper handles two responsibilities:
 *   1. **baseOffset translation** (Pitfall 4): peggy's `location()` builtin
 *      returns offsets relative to the parser's input. Listener keys and
 *      template event-attribute names live INSIDE the .rozie file at some
 *      absolute offset (the position of the leading `.`). We add `baseOffset`
 *      to every emitted loc so consumers see byte offsets in the original
 *      .rozie source.
 *   2. **collected-not-thrown** (D-08): peggy throws on parse errors. We
 *      catch and return `chain: null` with a single ROZ070 diagnostic. The
 *      function NEVER propagates exceptions to callers.
 *
 * Empty input returns an empty chain — zero modifiers is valid (it represents
 * "no chain", e.g., `@click` with no `.modifier` suffix).
 *
 * @experimental — shape may change before v1.0
 */
// The generated.js file is created at install time by `peggy --output`.
// It is .gitignored and not committed.
// @ts-ignore — generated file (no .d.ts; we type the surface manually below)
import * as generated from './generated.js';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ModifierChain {
  name: string;
  args: ModifierArg[];
  /** Absolute byte offsets in the .rozie file (after baseOffset translation). */
  loc: SourceLoc;
}

export type ModifierArg =
  | { kind: 'literal'; value: string | number; loc: SourceLoc }
  | { kind: 'refExpr'; ref: string; loc: SourceLoc };

/** peggy's location() return shape. */
type RawLoc = {
  start: { offset: number; line: number; column: number };
  end: { offset: number; line: number; column: number };
};

/** peggy thrown error shape (verified per RESEARCH.md Pattern 8). */
type PeggyError = {
  message?: string;
  location?: RawLoc;
  expected?: unknown;
  found?: unknown;
};

interface RawArg {
  kind: 'literal' | 'refExpr';
  loc: RawLoc;
  value?: string | number;
  ref?: string;
}

interface RawModifier {
  name: string;
  args: RawArg[];
  loc: RawLoc;
}

function shift(loc: RawLoc, baseOffset: number): SourceLoc {
  return {
    start: loc.start.offset + baseOffset,
    end: loc.end.offset + baseOffset,
  };
}

function shiftArg(arg: RawArg, baseOffset: number): ModifierArg {
  if (arg.kind === 'literal') {
    return {
      kind: 'literal',
      value: arg.value as string | number,
      loc: shift(arg.loc, baseOffset),
    };
  }
  return {
    kind: 'refExpr',
    ref: arg.ref as string,
    loc: shift(arg.loc, baseOffset),
  };
}

/**
 * Parse a modifier-chain text fragment (e.g., `.outside($refs.x).stop`) into
 * a structured `ModifierChain[]`. Adds `baseOffset` to every emitted loc so
 * all source locations are absolute byte offsets in the original .rozie file
 * (Pitfall 4 mitigation).
 *
 * Empty input yields an empty chain (zero modifiers is valid).
 * Errors are collected, never thrown (D-08). On parse error, returns
 * `chain: null` with a single ROZ070 diagnostic.
 *
 * @experimental — shape may change before v1.0
 */
export function parseModifierChain(
  input: string,
  baseOffset: number,
): { chain: ModifierChain[] | null; diagnostics: Diagnostic[] } {
  if (input === '') return { chain: [], diagnostics: [] };
  try {
    const raw = (generated as { parse: (s: string) => RawModifier[] }).parse(input);
    const chain: ModifierChain[] = raw.map((m) => ({
      name: m.name,
      args: m.args.map((a) => shiftArg(a, baseOffset)),
      loc: shift(m.loc, baseOffset),
    }));
    return { chain, diagnostics: [] };
  } catch (err: unknown) {
    const e = err as PeggyError;
    const startOff = e.location?.start.offset ?? 0;
    const endOff = e.location?.end.offset ?? input.length;
    return {
      chain: null,
      diagnostics: [
        {
          code: RozieErrorCode.MODIFIER_GRAMMAR_ERROR,
          severity: 'error',
          message: `Invalid modifier chain: ${e.message ?? 'parse failed'}`,
          loc: {
            start: startOff + baseOffset,
            end: endOff + baseOffset,
          },
        },
      ],
    };
  }
}
