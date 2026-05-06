// Phase 5 success criterion #4 — @input.debounce(300) parity across all 4 targets.
//
// REAL behavioral mount harnesses (NOT just structural greps).
//
// For each target T in {vue, react, svelte, angular}:
//   1. Parse examples/SearchInput.rozie → AST → IR
//   2. Call emitT(ir) → emitted source code
//   3. Compile/eval the emitted source into a mountable component using each
//      framework's test API
//   4. Mount the component with a spy onSearch handler
//   5. Use vi.useFakeTimers(); dispatch 5 input events at 50ms intervals
//      (values 'q0','q1','q2','q3','q4'); advance timers by 350ms
//   6. Assert spy.mock.calls.length === 1 AND spy.mock.calls[0][0] === 'q4'
//
// The test exercises the debounce wiring path (a pure JS timer wrapper) —
// no full SSR/hydration needed. Feasible in pure jsdom for all 4 targets.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitVue } from '@rozie/target-vue';
import { emitReact } from '@rozie/target-react';
import { emitSvelte } from '@rozie/target-svelte';
import { emitAngular } from '@rozie/target-angular';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const SEARCH_INPUT_ROZIE = resolve(__dirname, '../../examples/SearchInput.rozie');

function loadIR() {
  const src = readFileSync(SEARCH_INPUT_ROZIE, 'utf8');
  const parseRes = parse(src, { filename: 'SearchInput.rozie' });
  if (!parseRes.ast) throw new Error('parse failed');
  const lowerRes = lowerToIR(parseRes.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowerRes.ir) throw new Error('lowerToIR failed');
  return { ir: lowerRes.ir, src };
}

/**
 * Drive the standard 5-keystroke debounce-timing scenario against a mounted
 * input element. Caller is responsible for wrapping with `vi.useFakeTimers()`
 * and providing a flush() shim to push framework state between dispatches if
 * needed.
 *
 * Sequence: dispatch 5 input events spaced 50ms apart with values
 * q0, q1, q2, q3, q4. Then advance 350ms (past the 300ms debounce window).
 *
 * The last keystroke happens at t=200ms (4*50ms); the debounce timer fires
 * at t=200+300=500ms — within our final 350ms tail.
 */
function dispatchFiveInputs(input: HTMLInputElement, flush?: () => void): void {
  for (let i = 0; i < 5; i++) {
    input.value = `q${i}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (flush) flush();
    vi.advanceTimersByTime(50);
  }
  vi.advanceTimersByTime(350);
  if (flush) flush();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Phase 5 success criterion #4 — @input.debounce(300) parity', () => {
  // -------------------------------------------------------------------------
  // VUE
  // -------------------------------------------------------------------------
  it('vue: SearchInput.rozie debounce(300) fires once with final value after 350ms quiescence', async () => {
    const { ir, src } = loadIR();
    const { code } = emitVue(ir, { filename: 'SearchInput.rozie', source: src });

    const sfc = await import('@vue/compiler-sfc');
    const vueRuntime = await import('vue');
    const testUtils = await import('@vue/test-utils');
    const runtimeVue = await import('@rozie/runtime-vue');

    const { descriptor } = sfc.parse(code, { filename: 'SearchInput.vue' });
    if (!descriptor.scriptSetup) throw new Error('No <script setup> block');
    if (!descriptor.template) throw new Error('No <template> block');

    const compiledScript = sfc.compileScript(descriptor, {
      id: 'searchinput-test',
      isProd: false,
    });
    const compiledTemplate = sfc.compileTemplate({
      source: descriptor.template.content,
      id: 'searchinput-test',
      filename: 'SearchInput.vue',
      compilerOptions: { bindingMetadata: compiledScript.bindings },
    });

    // Strip TypeScript via Babel — compileScript leaves type annotations
    // (`<HTMLInputElement>`, `(__props: any)` etc.) which `new Function()`
    // cannot eval.
    const scriptJs = await stripTypeScript(compiledScript.content);

    // Combine: script (defaults `export default`) + template (export render).
    // Replace `export default` with `__rozieExports.default =` and `export function render`
    // with `__rozieExports.render =`.
    const combined = `${scriptJs}\n${compiledTemplate.code}\n__rozieExports.default.render = render;`;

    const mod = await evalEsModule(combined, {
      vue: vueRuntime,
      '@rozie/runtime-vue': runtimeVue,
    });
    const Component = mod.default;

    const onSearch = vi.fn();
    const wrapper = testUtils.mount(Component as any, {
      props: { onSearch, autofocus: false, minLength: 0 },
    });

    const inputEl = wrapper.find('input');
    if (!inputEl.exists()) throw new Error('No <input> in mounted component');
    const input = inputEl.element as HTMLInputElement;

    // Vue test-utils auto-flushes; no extra flush needed beyond the
    // input.dispatchEvent which v-model picks up synchronously.
    dispatchFiveInputs(input);

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch.mock.calls[0]?.[0]).toBe('q4');

    wrapper.unmount();
  });

  // -------------------------------------------------------------------------
  // REACT
  // -------------------------------------------------------------------------
  it('react: SearchInput.rozie useDebouncedCallback fires once with final value after 350ms quiescence', async () => {
    const { ir, src } = loadIR();
    const { code } = emitReact(ir, { filename: 'SearchInput.rozie', source: src });

    // Strip the CSS Module import — the parity test doesn't need styles.
    const codeNoCss = code.replace(
      /import\s+styles\s+from\s+['"][^'"]+['"];?\s*\n?/g,
      'const styles = new Proxy({}, { get: () => "" });\n',
    );

    const babel = await import('@babel/core');
    const presetTypeScript = (await import('@babel/preset-typescript')).default;
    const presetReact = (await import('@babel/preset-react')).default;
    const transformed = await babel.transformAsync(codeNoCss, {
      presets: [
        // automatic JSX runtime → no `React` global needed; jsx-runtime
        // imports added by Babel and resolved through evalEsModule's import
        // map below.
        [presetReact, { runtime: 'automatic' }],
        presetTypeScript,
      ],
      filename: 'SearchInput.tsx',
      babelrc: false,
      configFile: false,
    });
    if (!transformed?.code) throw new Error('Babel transform failed for React');

    const reactRuntime = await import('react');
    const reactJsxRuntime = await import('react/jsx-runtime');
    const reactDom = await import('react-dom');
    const reactDomClient = await import('react-dom/client');
    const tlr = await import('@testing-library/react');
    const runtimeReact = await import('@rozie/runtime-react');

    const mod = await evalEsModule(transformed.code, {
      react: reactRuntime,
      'react/jsx-runtime': reactJsxRuntime,
      'react-dom': reactDom,
      'react-dom/client': reactDomClient,
      '@rozie/runtime-react': runtimeReact,
    });
    const Component = mod.default;

    const onSearch = vi.fn();
    const { container, unmount } = tlr.render(
      reactRuntime.createElement(Component as any, {
        onSearch,
        autofocus: false,
        minLength: 0,
      }),
    );

    const input = container.querySelector('input');
    if (!input) throw new Error('No <input> in mounted React component');

    // React tracks controlled-input values via a property descriptor; raw
    // `input.value = 'x'; input.dispatchEvent(new Event('input'))` is
    // bypassed by React's value-tracker.
    //
    // Use @testing-library's fireEvent.input which handles the React-aware
    // path AND fires the bubbling 'input' event the debounced handler is
    // wired to. fireEvent already wraps in act() internally.
    for (let i = 0; i < 5; i++) {
      tlr.fireEvent.input(input, { target: { value: `q${i}` } });
      vi.advanceTimersByTime(50);
    }
    // Tail past the 300ms debounce window. Wrap in act() so React processes
    // any queued state updates.
    tlr.act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch.mock.calls[0]?.[0]).toBe('q4');

    unmount();
  });

  // -------------------------------------------------------------------------
  // SVELTE
  // -------------------------------------------------------------------------
  it('svelte: SearchInput.rozie debounce wrapper fires once with final value after 350ms quiescence', async () => {
    const { ir, src } = loadIR();
    const { code } = emitSvelte(ir, { filename: 'SearchInput.rozie', source: src });

    const compiler = await import('svelte/compiler');
    const compiled = compiler.compile(code, {
      generate: 'client',
      filename: 'SearchInput.svelte',
      runes: true,
    });

    const svelteInternalClient = await import('svelte/internal/client');
    // Side-effect import — disclose-version sets a global flag for HMR.
    await import('svelte/internal/disclose-version');
    const svelte = await import('svelte');

    const mod = await evalEsModule(compiled.js.code, {
      'svelte/internal/client': svelteInternalClient,
      'svelte/internal/disclose-version': {},
      svelte: svelte,
    });
    const Component = mod.default;

    const onSearch = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));

    const instance = svelte.mount(Component as any, {
      target,
      props: { onsearch: onSearch, autofocus: false, minLength: 0 },
    });

    const input = target.querySelector('input');
    if (!input) throw new Error('No <input> in mounted Svelte component');

    // Svelte 5 batches reactive updates; flushSync from svelte triggers a
    // synchronous flush so input value writes propagate to the bound state.
    const flush = () => {
      try {
        (svelte as any).flushSync?.();
      } catch {
        // flushSync may throw if no work pending — ignore.
      }
    };

    dispatchFiveInputs(input, flush);

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch.mock.calls[0]?.[0]).toBe('q4');

    svelte.unmount(instance);
    target.remove();
  });

  // -------------------------------------------------------------------------
  // ANGULAR
  // -------------------------------------------------------------------------
  it('angular: SearchInput.rozie debounce field initializer fires once with final value after 350ms quiescence', async () => {
    const { ir, src } = loadIR();
    const { code } = emitAngular(ir, { filename: 'SearchInput.rozie', source: src });

    // Side-effect imports needed before any Angular module runs.
    await import('zone.js');
    // @angular/compiler must be imported BEFORE @angular/core for JIT support.
    await import('@angular/compiler');

    const ngCore = await import('@angular/core');
    const ngCommon = await import('@angular/common');
    const ngForms = await import('@angular/forms');
    const ngTesting = await import('@angular/core/testing');
    const ngBrowserDynamicTesting = await import(
      '@angular/platform-browser-dynamic/testing'
    );

    const babel = await import('@babel/core');
    const presetTypeScript = (await import('@babel/preset-typescript')).default;
    const decoratorsPlugin = (await import('@babel/plugin-proposal-decorators')).default;
    const classPropsPlugin = (await import('@babel/plugin-transform-class-properties')).default;
    const transformed = await babel.transformAsync(code, {
      presets: [presetTypeScript],
      plugins: [
        [decoratorsPlugin, { version: 'legacy' }],
        classPropsPlugin,
      ],
      filename: 'SearchInput.ts',
      babelrc: false,
      configFile: false,
    });
    if (!transformed?.code) throw new Error('Babel transform failed for Angular');

    // Initialize TestBed once across the suite. Angular's TestBed.initTestEnvironment
    // throws if called twice; guard via global flag.
    const angularInit = globalThis as unknown as { __rozieAngularTestBedInit?: boolean };
    if (!angularInit.__rozieAngularTestBedInit) {
      ngTesting.TestBed.initTestEnvironment(
        ngBrowserDynamicTesting.BrowserDynamicTestingModule,
        ngBrowserDynamicTesting.platformBrowserDynamicTesting(),
      );
      angularInit.__rozieAngularTestBedInit = true;
    }

    const mod = await evalEsModule(transformed.code, {
      '@angular/core': ngCore,
      '@angular/common': ngCommon,
      '@angular/forms': ngForms,
    });
    const Component = mod.default;

    ngTesting.TestBed.resetTestingModule();
    ngTesting.TestBed.configureTestingModule({
      imports: [Component as any],
    });

    const fixture = ngTesting.TestBed.createComponent(Component as any);

    const onSearch = vi.fn();
    // The emitted Angular component declares `search = output<unknown>()`.
    // Angular's OutputEmitterRef exposes .subscribe(handler) — register
    // before any input dispatch so handlers fire on .emit().
    const instance = fixture.componentInstance as {
      search: { subscribe: (h: (v: unknown) => void) => void };
    };
    instance.search.subscribe((v) => onSearch(v));

    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement | null;
    if (!input) throw new Error('No <input> in mounted Angular component');

    // Angular's signal updates need detectChanges() to propagate.
    const flush = () => fixture.detectChanges();
    dispatchFiveInputs(input, flush);

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch.mock.calls[0]?.[0]).toBe('q4');

    fixture.destroy();
  });

  // -------------------------------------------------------------------------
  // CROSS-TARGET STRUCTURAL SANITY
  // -------------------------------------------------------------------------
  it('cross-target structural: all 4 emitted sources contain a debounce wrapper for @input.debounce(300)', () => {
    const { ir, src } = loadIR();
    const vueCode = emitVue(ir, { filename: 'SearchInput.rozie', source: src }).code;
    const reactCode = emitReact(ir, { filename: 'SearchInput.rozie', source: src }).code;
    const svelteCode = emitSvelte(ir, { filename: 'SearchInput.rozie', source: src }).code;
    const angularCode = emitAngular(ir, { filename: 'SearchInput.rozie', source: src }).code;

    expect(vueCode).toMatch(/debounce/);
    expect(reactCode).toMatch(/[uU]se[Dd]ebounce|useDebouncedCallback/);
    expect(svelteCode).toMatch(/debounce/);
    expect(angularCode).toMatch(/debounce/);

    // All four must reference the 300ms window from @input.debounce(300).
    expect(vueCode).toMatch(/300/);
    expect(reactCode).toMatch(/300/);
    expect(svelteCode).toMatch(/300/);
    expect(angularCode).toMatch(/300/);
  });
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Strip TypeScript syntax from JS source via Babel. Preserves JSX (no JSX
 * transform applied — input is expected to be JS-with-types).
 */
async function stripTypeScript(source: string): Promise<string> {
  const babel = await import('@babel/core');
  const presetTypeScript = (await import('@babel/preset-typescript')).default;
  const out = await babel.transformAsync(source, {
    presets: [[presetTypeScript, { onlyRemoveTypeImports: false }]],
    filename: 'inline.ts',
    babelrc: false,
    configFile: false,
  });
  if (!out?.code) throw new Error('Babel TS-strip failed');
  return out.code;
}

/**
 * Evaluate an ES-module source string by rewriting bare imports to lookups
 * onto a provided import-map of pre-loaded modules. Returns the module's
 * exports namespace.
 *
 * This is a focused alternative to `import('data:text/javascript;base64,...')`
 * because data: URLs cannot resolve bare module specifiers — the JS runtime
 * has no resolver context for them. By rewriting `import X from 'vue'` to
 * `const X = __rozieImports.vue.default || __rozieImports.vue`, we side-step
 * the resolver entirely and keep the runtime binding stable.
 */
async function evalEsModule(
  source: string,
  importMap: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let body = source;

  // Side-effect imports `import 'spec';` — record the module in the import map
  // (already loaded by caller) and drop the line.
  body = body.replace(/^[\t ]*import\s+['"]([^'"]+)['"];?[\t ]*$/gm, '');

  // Static imports: `import {a, b as c} from 'spec';`, `import D from 'spec';`,
  // `import * as N from 'spec';`, `import D, { a } from 'spec';`.
  body = body.replace(
    /^[\t ]*import\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"];?[\t ]*$/gm,
    (_m, clauseRaw: string, spec: string) => {
      const safe = JSON.stringify(spec);
      const clause = clauseRaw.trim();
      const lines: string[] = [];
      if (clause.startsWith('* as ')) {
        const name = clause.slice('* as '.length).trim();
        lines.push(`const ${name} = __rozieImports[${safe}];`);
      } else if (clause.startsWith('{')) {
        const inside = clause.replace(/^\{|\}$/g, '');
        const dest = rewriteNamedSpecifiers(inside);
        if (dest) lines.push(`const { ${dest} } = __rozieImports[${safe}];`);
      } else if (clause.includes(',')) {
        // Default + named: e.g. `Default, { a, b }` or `Default, * as Ns`
        const idx = clause.indexOf(',');
        const defaultName = clause.slice(0, idx).trim();
        const rest = clause.slice(idx + 1).trim();
        lines.push(
          `const ${defaultName} = (__rozieImports[${safe}]?.default ?? __rozieImports[${safe}]);`,
        );
        if (rest.startsWith('{')) {
          const inside = rest.replace(/^\{|\}$/g, '');
          const dest = rewriteNamedSpecifiers(inside);
          if (dest) lines.push(`const { ${dest} } = __rozieImports[${safe}];`);
        } else if (rest.startsWith('* as ')) {
          const name = rest.slice('* as '.length).trim();
          lines.push(`const ${name} = __rozieImports[${safe}];`);
        }
      } else {
        // Default-only: `import D from 'spec';`
        lines.push(
          `const ${clause} = (__rozieImports[${safe}]?.default ?? __rozieImports[${safe}]);`,
        );
      }
      return lines.join('\n');
    },
  );

  // Exports.
  body = body.replace(/^[\t ]*export\s+default\s+/gm, '__rozieExports.default = ');
  body = body.replace(
    /^[\t ]*export\s*\{([^}]+)\};?[\t ]*$/gm,
    (_m, inside: string) => {
      return inside
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
        .map((entry) => {
          const m = entry.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
          if (!m) return '';
          const [, local, exported] = m;
          return `__rozieExports[${JSON.stringify(exported || local)}] = ${local};`;
        })
        .join('\n');
    },
  );
  body = body.replace(
    /^[\t ]*export\s+(const|let|var|function|class|async\s+function)\s+(\w+)/gm,
    (_m, kw: string, name: string) => {
      return `${kw} ${name}`;
    },
  );

  const exports: Record<string, unknown> = {};
  const fnSource = `
    "use strict";
    return (async function __rozieEvalModule(__rozieImports, __rozieExports) {
      ${body}
      return __rozieExports;
    });
  `;
  const factory = new Function(fnSource)();
  return await factory(importMap, exports);
}

function rewriteNamedSpecifiers(inside: string): string {
  return inside
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const noType = entry.replace(/^type\s+/, '');
      const m = noType.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!m) return noType;
      const [, source, asName] = m;
      return asName ? `${source}: ${asName}` : source;
    })
    .filter(Boolean)
    .join(', ');
}
