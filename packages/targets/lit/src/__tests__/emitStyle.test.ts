/**
 * emitStyle unit tests — Plan 06.4-02 Task 1/2.
 *
 * Per D-LIT-15 / D-LIT-16:
 *   - Scoped CSS rules go into `static styles = css\`...\``
 *   - `:root { }` rules extract to a module-level `injectGlobalStyles(id, ...)` call
 *     imported from @rozie/runtime-lit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';
import { emitStyle } from '../emit/emitStyle.js';
import {
  LitImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

describe('emitStyle — D-LIT-15 / D-LIT-16 split', () => {
  it('Counter: scoped-only CSS produces only static styles (no injectGlobalStyles)', () => {
    const code = compile('Counter');
    expect(code).toContain('static styles = css`');
    expect(code).not.toContain('injectGlobalStyles');
  });

  it('Modal: :root rules extract to injectGlobalStyles call with rozie-modal-global id', () => {
    const code = compile('Modal');
    expect(code).toContain("injectGlobalStyles('rozie-modal-global'");
    expect(code).toContain('static styles = css`');
    // Both blocks present — scoped portion lives in static styles, :root in
    // the module-level call.
  });

  it('Dropdown: :root rules extract to injectGlobalStyles call with rozie-dropdown-global id', () => {
    const code = compile('Dropdown');
    expect(code).toContain("injectGlobalStyles('rozie-dropdown-global'");
  });

  it('CardHeader: scoped-only CSS does NOT add injectGlobalStyles import', () => {
    const code = compile('CardHeader');
    expect(code).not.toContain('injectGlobalStyles');
  });

  it('emitStyle() unit: empty styles still emit the host-display parity default', () => {
    const result = emitStyle(
      { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
      '',
      {
        componentName: 'X',
        lit: new LitImportCollector(),
        runtime: new RuntimeLitImportCollector(),
      },
    );
    // Even a style-less component normalizes its custom-element host so it lays
    // out like the 4 hostless targets (quick 260710-fjj): the `static styles`
    // field is always emitted carrying at least `:host{display:contents}`. No
    // author rules → no injectGlobalStyles.
    expect(result.staticStylesField).toContain('static styles = css`');
    expect(result.staticStylesField).toContain(':host{display:contents}');
    expect(result.globalStyleCall).toBe('');
  });
});

describe('emitStyle — injectGlobalStyles id keyed by CSS content (quick 260716-npt Finding 1)', () => {
  // Two versions of the same component on one page (e.g. during an HMR
  // update, or two co-mounted builds) must NOT collapse onto the same
  // runtime dedup id when their global CSS payload differs — else
  // injectGlobalStyles silently drops the second version's styles.
  function rootRule(source: string): {
    selector: string;
    isRootEscape: boolean;
    loc: { start: number; end: number };
  } {
    return { selector: ':root', isRootEscape: true, loc: { start: 0, end: source.length } };
  }

  function emitForGlobalCss(componentName: string, source: string): string {
    const result = emitStyle(
      {
        type: 'StyleSection',
        scopedRules: [],
        rootRules: [rootRule(source)],
        portalRules: [],
        engineRules: [],
        sourceLoc: { start: 0, end: 0 },
      },
      source,
      {
        componentName,
        lit: new LitImportCollector(),
        runtime: new RuntimeLitImportCollector(),
      },
    );
    return result.globalStyleCall;
  }

  function extractId(globalStyleCall: string): string {
    const match = globalStyleCall.match(/injectGlobalStyles\('([^']+)'/);
    if (match === null) throw new Error(`no injectGlobalStyles id found in: ${globalStyleCall}`);
    return match[1];
  }

  it('distinct global CSS payloads (same componentName) produce DISTINCT ids', () => {
    const sourceA = ':root { --a: 1px; }';
    const sourceB = ':root { --a: 2px; }';
    const idA = extractId(emitForGlobalCss('Modal', sourceA));
    const idB = extractId(emitForGlobalCss('Modal', sourceB));
    expect(idA).not.toBe(idB);
  });

  it('identical global CSS payload + same componentName produces IDENTICAL id (idempotent)', () => {
    const source = ':root { --a: 1px; }';
    const idFirst = extractId(emitForGlobalCss('Modal', source));
    const idSecond = extractId(emitForGlobalCss('Modal', source));
    expect(idFirst).toBe(idSecond);
  });

  it('id keeps the readable rozie-<kebab-name>- prefix and is a valid CSS attribute-selector value', () => {
    const source = ':root { --a: 1px; }';
    const id = extractId(emitForGlobalCss('Modal', source));
    expect(id.startsWith('rozie-modal-')).toBe(true);
    expect(id.endsWith('-global')).toBe(true);
    // No characters that would require CSS.escape() to differ from the raw
    // string — keeps the runtime's querySelector marker simple/debuggable.
    expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('emitStyle — ::part() cross-shadow styling bridge (Phase 17, SPEC-R1/R2/R6)', () => {
  it('PartCardConsumer: consumer ::part rule lowers to <child-tag>[scope]::part(body)', () => {
    const code = compile('PartCardConsumer');
    // The consumer's `PartCard::part(body)` rule must reach the child's
    // `part="body"` shadow element: tag lowered to the custom-element tag
    // `rozie-part-card`, scope attr stamped on the child-tag compound BEFORE
    // `::part`, part name literal (SPEC-R2 + SPEC-R6).
    expect(code).toMatch(
      /rozie-part-card\[data-rozie-s-[a-z0-9]+\]::part\(body\)/,
    );
    // Scope attr lands BEFORE ::part, never after.
    expect(code).not.toMatch(/::part\(body\)\[data-rozie-s/);
    // Part name `body` is literal — no scope hash adjacent to the name.
    expect(code).not.toMatch(/::part\(body\[data-rozie-s/);
    // The author-form PascalCase `PartCard` tag must NOT survive in the emitted
    // selector (it would never match the emitted <rozie-part-card> element).
    expect(code).not.toMatch(/PartCard\[data-rozie-s-[a-z0-9]+\]::part/);
  });
});
