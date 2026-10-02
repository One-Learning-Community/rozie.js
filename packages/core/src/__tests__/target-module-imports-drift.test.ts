/**
 * Typed public surface P1 follow-up — drift guard for the ROZ025 import
 * catalog (`codegen/targetModuleImports.ts`).
 *
 * The typed import collectors and literal import lines are tied to the catalog
 * at the type level. A few emitter sites still mint import names from plain
 * strings (modifier-registry helper names, Svelte/Vue value-import sets,
 * Angular keynav helpers), so this test compiles the whole component corpus on
 * all six targets (module + type sidecar) and asserts that EVERY module-scope
 * import binding the emitters add is either in the catalog (same name, same
 * source), a `<components>`-derived import (the local name / `<Local>Handle`),
 * the author's own `<script>`/`<types>`/partial import, or a relative import.
 * A new emitter import that is not in the catalog fails here — which is what
 * keeps ROZ025's reserved set complete.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as babelParse } from '@babel/parser';
import { compile } from '../compile.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { handleInterfaceName } from '../codegen/generatedTypeNames.js';
import { targetModuleImportBindings } from '../codegen/targetModuleImports.js';
import type { IRComponent } from '../ir/types.js';
import { emitReactTypes } from '../../../targets/react/src/emit/emitTypes.js';
import { emitVueTypes } from '../../../targets/vue/src/emit/emitTypes.js';
import { emitSvelteTypes } from '../../../targets/svelte/src/emit/emitTypes.js';
import { emitAngularTypes } from '../../../targets/angular/src/emit/emitTypes.js';
import { emitSolidTypes } from '../../../targets/solid/src/emit/emitTypes.js';
import { emitLitTypes } from '../../../targets/lit/src/emit/emitTypes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
const SIDECAR: Record<(typeof TARGETS)[number], (ir: IRComponent) => string> = {
  react: emitReactTypes,
  vue: emitVueTypes,
  svelte: emitSvelteTypes,
  angular: emitAngularTypes,
  solid: emitSolidTypes,
  lit: emitLitTypes,
};

function rozieFilesUnder(rel: string): string[] {
  const abs = join(ROOT, rel);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    if (entry.isDirectory()) out.push(...rozieFilesUnder(`${rel}/${entry.name}`));
    else if (entry.name.endsWith('.rozie')) out.push(`${rel}/${entry.name}`);
  }
  return out;
}

function scriptBodies(code: string, target: string, isModule: boolean): string[] {
  if (isModule && (target === 'vue' || target === 'svelte')) {
    return [...code.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  }
  return [code];
}

function importBindings(code: string, jsx: boolean): Array<{ name: string; from: string }> {
  const out: Array<{ name: string; from: string }> = [];
  const program = babelParse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators-legacy', ...(jsx ? (['jsx'] as const) : [])],
    errorRecovery: true,
  }).program;
  for (const s of program.body) {
    if (s.type !== 'ImportDeclaration') continue;
    for (const sp of s.specifiers) out.push({ name: sp.local.name, from: s.source.value });
  }
  return out;
}

describe('targetModuleImports catalog covers every emitted import (ROZ025 drift guard)', () => {
  it('every emitter-added module-scope import binding is in the catalog', () => {
    const catalog = new Set(targetModuleImportBindings().map((b) => `${b.name}\u0000${b.from}`));
    // Node 20-compatible (no fs.globSync): top-level examples + every
    // `packages/ui/<family>/src/**` .rozie (a hand walk that never enters
    // node_modules / dist).
    const files = [
      ...readdirSync(join(ROOT, 'examples'))
        .filter((f) => f.endsWith('.rozie'))
        .map((f) => `examples/${f}`),
      ...readdirSync(join(ROOT, 'packages/ui')).flatMap((family) =>
        rozieFilesUnder(`packages/ui/${family}/src`),
      ),
    ].sort();
    expect(files.length).toBeGreaterThan(100);
    const missing = new Set<string>();
    let checked = 0;
    for (const rel of files) {
      const abs = join(ROOT, rel);
      const src = readFileSync(abs, 'utf8');
      const parsed = parse(src, { filename: abs });
      if (!parsed.ast) continue;
      const { ir } = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
      if (!ir) continue;
      const own = new Set<string>();
      for (const s of ir.setupBody.scriptProgram.program.body) {
        if (s.type === 'ImportDeclaration') for (const sp of s.specifiers) own.add(sp.local.name);
      }
      for (const s of ir.types?.statements ?? []) {
        if (s.type === 'ImportDeclaration') for (const sp of s.specifiers) own.add(sp.local.name);
      }
      for (const c of ir.components ?? []) {
        own.add(c.localName);
        own.add(handleInterfaceName(c.localName));
      }
      for (const target of TARGETS) {
        const r = compile(src, {
          target,
          filename: abs,
          resolverRoot: dirname(abs),
          sourceMap: false,
        });
        const sources: Array<[string, boolean]> = [[r.code, true]];
        // A sidecar renderer that throws is a real failure, not a skip.
        sources.push([SIDECAR[target](ir), false]);
        for (const [code, isModule] of sources) {
          if (!code) continue;
          for (const body of scriptBodies(code, target, isModule)) {
            const bindings = importBindings(body, target === 'react' || target === 'solid');
            // A composed child's OWN module (the one that also binds the child
            // component) is child-derived, like the component name itself:
            // e.g. Lit imports the child's `<types>` names a fill's threaded
            // `:param-types` print (`import type { Combobox, ComboboxGroup }`).
            // The emitter skips any name the consumer already binds, so these
            // can never collide and need no ROZ025 reservation.
            const childModules = new Set(bindings.filter((b) => own.has(b.name)).map((b) => b.from));
            for (const { name, from } of bindings) {
              checked++;
              if (own.has(name) || name === ir.name || from.startsWith('.') || childModules.has(from)) continue;
              if (!catalog.has(`${name}\u0000${from}`))
                missing.add(`${target}: \`${name}\` from '${from}' (${rel})`);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect([...missing].sort()).toEqual([]);
  }, 300_000);
});
