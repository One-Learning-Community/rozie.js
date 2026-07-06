/**
 * Phase 61 Plan 05 — React reserved/synthesized-name deconfliction.
 *
 * Closes four confirmed React emitter gaps from collision-react.md:
 *   (A) declare-then-assign ref shadow → TS2451 redeclare (the module-let
 *       collides with the ref-const). Fix: rename the module-let → `X$local`.
 *   (B) `hoistModuleLet` skips `ir.expose` bodies → a module-let mutated only
 *       inside an exposed verb resets every render. Fix: reachability walk
 *       reaches the expose-verb helper bodies → hoist to `useRef`.
 *   (D) cross-kind collisions with synthesized internal names
 *       (`attrs`/`props`/`_props`/`_rozieExposeRef`/`portals`/`prev`) →
 *       rename the user helper/const → `X$local`.
 *   (E) `$computed` == helper duplicate `const` → rename the helper → `X$local`.
 *
 * RED-FIRST (Task 1): the first two `describe`s pin the BROKEN pre-fix output
 * (fixture A = two `anchorEl` declarations; fixture B = `let nextId = 0` left in
 * the render body, un-hoisted). Task 2 flips them to the fixed assertions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../../core/src/ir/types.js';
import { emitReact } from '../../emitReact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../__tests__/fixtures');

function load(name: string): { ir: IRComponent; src: string } {
  const src = readFileSync(resolve(FIXTURES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse failed for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed for ${name}`);
  return { ir: lowered.ir, src };
}

function emit(name: string): string {
  const { ir, src } = load(name);
  return emitReact(ir, { filename: `${name}.rozie`, source: src }).code;
}

/** Count non-overlapping occurrences of a substring. */
function count(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

describe('Phase 61-05 risk A — declare-then-assign ref shadow', () => {
  it('renames the colliding module-let to anchorEl$local; only ONE anchorEl ref binding', () => {
    const code = emit('ReactDeclareThenAssignRef');

    // The ref-const is the contract — exactly one `const anchorEl = useRef`.
    expect(count(code, 'const anchorEl = useRef')).toBe(1);

    // The user module-let is renamed; it is NEVER re-declared as a second
    // `anchorEl` (the TS2451 shape). The hoisted let surfaces as `anchorEl$local`.
    expect(code).toContain('anchorEl$local');

    // After stripping comments + the renamed local, exactly one `anchorEl`
    // BINDING remains (the ref-const). Pre-fix there were two (`const anchorEl =
    // useRef` + the hoisted module-let `const anchorEl = useRef`) → TS2451.
    const codeNoComments = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/anchorEl\$local/g, 'STRIPPED');
    // `useRef(` bound to `anchorEl` occurs exactly once.
    expect(count(codeNoComments, 'anchorEl = useRef')).toBe(1);

    // The $onMount body reads the ref through `.current` and writes the renamed
    // local — proving the assign-from-ref still resolves to the ref-const.
    expect(code).toContain('anchorEl$local = anchorEl.current');
  });
});

describe('Phase 73 item #9 — hoisted capture-let == ref name collides WITHOUT a $refs.X read', () => {
  it('renames the colliding module-let to chart$local even though it never reads $refs.chart (chartjs case)', () => {
    const code = emit('ReactRefLetHoistCollision');

    // The ref-const is the contract — exactly one `const chart = useRef`.
    expect(count(code, 'const chart = useRef')).toBe(1);

    // The user module-let is renamed; it is NEVER re-declared as a second
    // `chart` (the TS2451 shape). The hoisted let surfaces as `chart$local`.
    expect(code).toContain('chart$local');

    // After stripping comments + the renamed local, exactly one `chart`
    // BINDING remains (the ref-const).
    const codeNoComments = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/chart\$local/g, 'STRIPPED');
    expect(count(codeNoComments, 'chart = useRef')).toBe(1);

    // The $onMount body still assigns/reads the renamed local (mirrors the
    // shipped risk-A precedent: the RENAME is the fix's contract — whether
    // the renamed local is ALSO hoisted to a useRef is a separate, orthogonal
    // concern already governed by hoistModuleLet's pre-existing reachability
    // detection over `ir.lifecycle`'s ORIGINAL identifiers, same as
    // `anchorEl$local` above staying a bare local rather than `.current`).
    expect(code).toMatch(/chart\$local\s*=\s*new FakeEngine/);
    expect(code).toMatch(/chart\$local\.destroy\(\)/);
  });
});

describe('Phase 61-05 risk B — expose-body module-let hoist', () => {
  it('hoists `nextId` to a useRef (not a per-render `let nextId = 0`)', () => {
    const code = emit('ReactExposeModuleLet');

    // `nextId` is hoisted: a `useRef` is generated and references go through
    // `.current`. The un-hoisted `let nextId = 0` must NOT appear in the body.
    expect(code).not.toContain('let nextId = 0');
    expect(code).toContain('nextId = useRef(0)');
    expect(code).toContain('nextId.current');
  });
});

describe('Phase 61-05 risk D + Plan 09 — synthesized-internal program-scope-only rename', () => {
  it('renames a TOP-LEVEL `const attrs` (redeclare) but NEVER a nested `attrs` param or function-local `prev` (legal shadow)', () => {
    const code = emit('ReactSynthesizedInternalShadow');

    // GENUINE collision: the user TOP-LEVEL `const attrs = { role: 'group' }`
    // redeclares the synthesized fallthrough `const attrs = props as Record<…>`
    // → renamed to `attrs$local`. The synthesized one keeps the bare name.
    expect(code).toContain('attrs$local');
    expect(code).toContain("const attrs$local = {");
    // The synthesized fallthrough binding keeps the bare `attrs` name.
    expect(code).toContain('const attrs = props as Record');

    // OVER-APPLICATION GUARD (Plan 09): the function PARAMETER `attrs` of
    // `mergeAttrs` is a LEGAL nested shadow — it must STAY `attrs`, not become
    // `attrs$local`. The param + its body spread stay bare.
    expect(code).toContain('mergeAttrs(attrs');
    expect(code).toContain('...attrs,');

    // The function-LOCAL `const prev` (chartjs-style reconcile local) is NEVER a
    // top-level React binding → it must stay byte-identical, no `prev$local`.
    expect(code).not.toContain('prev$local');
    expect(code).toContain('const prev = rows.slice()');

    // Count guard: exactly one `attrs$local` BINDING (the renamed top-level
    // const). The nested param/body keep the bare name.
    expect(count(code, 'attrs$local')).toBeGreaterThanOrEqual(1);
  });
});
