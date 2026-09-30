// quick 260929-ua4 — runtime smoke for a `$emit` written ONLY in <template>.
//
// A component with no <script> whose template handlers are `$emit('ping', 1)`
// and `$emit('pong')`. Before the fix the event names were never collected
// into IRComponent.emits, so:
//   - Vue emitted `@click="emit('ping', 1)"` with no `defineEmits` → `emit`
//     was undefined at click time and the consumer's `onPing` never ran;
//   - Svelte emitted `onping?.(1)` with `onping` never declared or
//     destructured from `$props()` → ReferenceError at click time.
//
// This mounts the REAL compiled output (compile() from @rozie/core → the
// framework's own compiler → eval) and clicks both elements, asserting the
// consumer's handlers are called with the payload. Handler errors are
// captured (not allowed to crash the run) so a pre-fix failure reads as
// "spy not called" rather than an unhandled exception.
//
// The helpers below are copied (trimmed) from SearchInput.debounce.parity.test.ts,
// including its static-import rationale: heavy toolchain modules are imported
// at the top of the file so their transform cost is not charged against a
// per-test timeout under a parallel turbo run.

import * as babel from '@babel/core';
import presetTypeScriptDefault from '@babel/preset-typescript';
import { compile } from '@rozie/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const presetTypeScript =
  (presetTypeScriptDefault as { default?: unknown }).default ?? presetTypeScriptDefault;

import * as runtimeVue from '@rozie/runtime-vue';
// --- Vue toolchain -------------------------------------------------------
import * as sfc from '@vue/compiler-sfc';
import * as testUtils from '@vue/test-utils';
// --- Svelte toolchain ----------------------------------------------------
import * as svelteCompiler from 'svelte/compiler';
import * as svelteInternalClient from 'svelte/internal/client';
import * as vueRuntime from 'vue';
import 'svelte/internal/disclose-version';
import * as rozieRuntimeSvelte from '@rozie/runtime-svelte';
import * as svelte from 'svelte';

const SOURCE = `<rozie name="TemplateOnlyEmit">
<template>
<div>
  <button @click="$emit('ping', 1)">x</button>
  <span @click="$emit('pong')">y</span>
</div>
</template>
</rozie>
`;

function compileFor(target: 'vue' | 'svelte'): string {
  const result = compile(SOURCE, {
    target,
    filename: 'TemplateOnlyEmit.rozie',
    sourceMap: false,
  });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  expect(errors).toEqual([]);
  return result.code;
}

// Errors thrown inside DOM event listeners never reach the dispatching
// caller; jsdom reports them as `error` events on window. Capture them so a
// pre-fix ReferenceError/TypeError is recorded instead of crashing the run.
let handlerErrors: unknown[] = [];
const onWindowError = (ev: ErrorEvent) => {
  handlerErrors.push(ev.error ?? ev.message);
  ev.preventDefault();
};
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;
let vueErrorHandler: ((err: unknown) => void) | null = null;

beforeEach(() => {
  handlerErrors = [];
  window.addEventListener('error', onWindowError);
  // Vue routes handler errors through its own error handler (console.error in
  // dev); silence + record them.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    handlerErrors.push(args[0]);
  });
  vueErrorHandler = (err: unknown) => {
    handlerErrors.push(err);
  };
});

afterEach(() => {
  window.removeEventListener('error', onWindowError);
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = null;
});

function safeClick(el: Element): void {
  try {
    (el as HTMLElement).click();
  } catch (err) {
    handlerErrors.push(err);
  }
}

describe('260929-ua4 — template-only $emit reaches the consumer at runtime', () => {
  it('vue: clicking a template-only $emit calls the consumer onPing / onPong', async () => {
    const code = compileFor('vue');
    const { descriptor } = sfc.parse(code, { filename: 'TemplateOnlyEmit.vue' });
    if (!descriptor.template) throw new Error('No <template> block');
    // Pre-fix the no-<script> component emitted NO <script> block at all, so
    // compile the template alone in that case (a plain `{ render }` component)
    // and let the click assertions report the missing `emit`.
    const hasScript = Boolean(descriptor.scriptSetup || descriptor.script);
    const compiledScript = hasScript
      ? sfc.compileScript(descriptor, { id: 'template-only-emit-test', isProd: false })
      : null;
    const compiledTemplate = sfc.compileTemplate({
      source: descriptor.template.content,
      id: 'template-only-emit-test',
      filename: 'TemplateOnlyEmit.vue',
      compilerOptions: compiledScript ? { bindingMetadata: compiledScript.bindings } : {},
    });
    const combined = compiledScript
      ? `${await stripTypeScript(compiledScript.content)}\n${compiledTemplate.code}\n__rozieExports.default.render = render;`
      : `${compiledTemplate.code}\n__rozieExports.default = { render };`;
    const mod = await evalEsModule(combined, {
      vue: vueRuntime,
      '@rozie/runtime-vue': runtimeVue,
    });
    const Component = mod.default;

    const onPing = vi.fn();
    const onPong = vi.fn();
    const wrapper = testUtils.mount(Component as any, {
      props: { onPing, onPong },
      global: {
        config: { errorHandler: (err: unknown) => vueErrorHandler?.(err) },
      },
    });

    safeClick(wrapper.find('button').element);
    safeClick(wrapper.find('span').element);

    expect(handlerErrors).toEqual([]);
    expect(onPing).toHaveBeenCalledTimes(1);
    expect(onPing).toHaveBeenCalledWith(1);
    expect(onPong).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('svelte: clicking a template-only $emit calls the consumer onping / onpong', async () => {
    const code = compileFor('svelte');
    const compiled = svelteCompiler.compile(code, {
      generate: 'client',
      filename: 'TemplateOnlyEmit.svelte',
      runes: true,
    });
    const mod = await evalEsModule(compiled.js.code, {
      'svelte/internal/client': svelteInternalClient,
      'svelte/internal/disclose-version': {},
      svelte: svelte,
      '@rozie/runtime-svelte': rozieRuntimeSvelte,
    });
    const Component = mod.default;

    const onping = vi.fn();
    const onpong = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));
    const instance = svelte.mount(Component as any, {
      target,
      props: { onping, onpong },
    });
    const flush = () => {
      try {
        (svelte as any).flushSync?.();
      } catch {
        // flushSync may throw if no work pending — ignore.
      }
    };
    flush();

    const button = target.querySelector('button');
    const span = target.querySelector('span');
    if (!button || !span) throw new Error('Svelte component did not render button + span');
    safeClick(button);
    flush();
    safeClick(span);
    flush();

    expect(handlerErrors).toEqual([]);
    expect(onping).toHaveBeenCalledTimes(1);
    expect(onping).toHaveBeenCalledWith(1);
    expect(onpong).toHaveBeenCalledTimes(1);

    svelte.unmount(instance);
    target.remove();
  });
});

// ----------------------------------------------------------------------------
// Helpers (copied from SearchInput.debounce.parity.test.ts)
// ----------------------------------------------------------------------------

async function stripTypeScript(source: string): Promise<string> {
  const out = await babel.transformAsync(source, {
    presets: [[presetTypeScript, { onlyRemoveTypeImports: false }]],
    filename: 'inline.ts',
    babelrc: false,
    configFile: false,
  });
  if (!out?.code) throw new Error('Babel TS-strip failed');
  return out.code;
}

async function evalEsModule(
  source: string,
  importMap: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let body = source;

  body = body.replace(/^[\t ]*import\s+['"]([^'"]+)['"];?[\t ]*$/gm, '');

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
        lines.push(
          `const ${clause} = (__rozieImports[${safe}]?.default ?? __rozieImports[${safe}]);`,
        );
      }
      return lines.join('\n');
    },
  );

  body = body.replace(/^[\t ]*export\s+default\s+/gm, '__rozieExports.default = ');
  body = body.replace(/^[\t ]*export\s*\{([^}]+)\};?[\t ]*$/gm, (_m, inside: string) => {
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
  });
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
