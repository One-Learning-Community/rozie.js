// Template `@event.capture/.passive/.once` — mount the EMITTED .svelte source
// in happy-dom and drive real DOM events through it.
//
// emitSvelte → svelte/compiler (client, runes) → eval with an import map that
// routes `@rozie/runtime-svelte` to the package source → mount. Asserts:
//   - `.once` fires exactly once per element, across re-renders it causes;
//   - `.once` inside `r-for` is per element;
//   - `.capture` on an ancestor runs before the target's own handler, and
//     `.stop` in that capture handler stops the event reaching the target;
//   - a same-event plain listener and an option-bearing listener coexist.
import { describe, expect, it } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitSvelte } from '../src/emitSvelte.js';
import * as runtimeSvelte from '../../../runtime/svelte/src/index.js';
import * as svelteCompiler from 'svelte/compiler';
import * as svelteInternalClient from 'svelte/internal/client';
import 'svelte/internal/disclose-version';
import * as svelte from 'svelte';

const SRC = `<rozie name="T" inherit-listeners="false" inherit-attrs="false">
<data>
{ onceHits: 0, plainHits: 0, log: '', items: ['a', 'b'] }
</data>
<template>
<div class="root">
  <button class="once" @click.once="$data.onceHits++" @click="$data.plainHits++">{{ $data.onceHits }}/{{ $data.plainHits }}</button>
  <span r-for="it in $data.items" :key="it" :class="'item-' + it" @click.once="$data.log = $data.log + it">{{ it }}</span>
  <div class="outer" @click.capture="$data.log = $data.log + 'C'">
    <button class="inner" @click="$data.log = $data.log + 'I'">in</button>
  </div>
  <div class="stopper" @click.capture.stop="$data.log = $data.log + 'S'">
    <button class="blocked" @click="$data.log = $data.log + 'X'">in</button>
  </div>
  <p class="log">{{ $data.log }}</p>
</div>
</template>
</rozie>`;

async function mountEmitted(): Promise<{ target: HTMLElement; destroy: () => void }> {
  const parsed = parse(SRC, { filename: 'T.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const emitted = emitSvelte(lowered.ir, { filename: 'T.rozie', source: SRC });
  const errors = emitted.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) throw new Error(JSON.stringify(errors));
  const compiled = svelteCompiler.compile(emitted.code, {
    generate: 'client',
    filename: 'T.svelte',
    runes: true,
  });
  const mod = await evalEsModule(compiled.js.code, {
    'svelte/internal/client': svelteInternalClient,
    'svelte/internal/disclose-version': {},
    svelte,
    '@rozie/runtime-svelte': runtimeSvelte,
  });
  const target = document.body.appendChild(document.createElement('div'));
  const instance = svelte.mount(mod.default as never, { target });
  svelte.flushSync();
  return {
    target,
    destroy: () => {
      svelte.unmount(instance);
      target.remove();
    },
  };
}

function click(target: HTMLElement, sel: string): void {
  (target.querySelector(sel) as HTMLElement).click();
  svelte.flushSync();
}

describe('Svelte template @event native options — mounted', () => {
  it('.once fires once across the re-renders it causes; the plain sibling keeps firing', async () => {
    const { target, destroy } = await mountEmitted();
    click(target, '.once');
    click(target, '.once');
    click(target, '.once');
    expect(target.querySelector('.once')!.textContent).toBe('1/3');
    destroy();
  });

  it('.once inside r-for is per element', async () => {
    const { target, destroy } = await mountEmitted();
    click(target, '.item-a');
    click(target, '.item-a');
    click(target, '.item-b');
    click(target, '.item-b');
    expect(target.querySelector('.log')!.textContent).toBe('ab');
    destroy();
  });

  it('.capture runs before the target handler; .capture.stop blocks the target', async () => {
    const { target, destroy } = await mountEmitted();
    click(target, '.inner');
    expect(target.querySelector('.log')!.textContent).toBe('CI');
    click(target, '.blocked');
    expect(target.querySelector('.log')!.textContent).toBe('CIS');
    destroy();
  });
});

// Minimal in-memory ESM evaluator (same approach as treenode-mount.test.ts):
// rewrites `import { a, b as c } from 'x'` / `import * as n from 'x'` to
// lookups in `importMap`, and `export default` to an exports slot.
async function evalEsModule(
  source: string,
  importMap: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let body = source.replace(/^[\t ]*import\s+['"]([^'"]+)['"];?[\t ]*$/gm, '');
  body = body.replace(
    /^[\t ]*import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?[\t ]*$/gm,
    (_m, clauseRaw: string, spec: string) => {
      const safe = JSON.stringify(spec);
      const clause = clauseRaw.trim();
      if (clause.startsWith('* as ')) {
        return `const ${clause.slice(5).trim()} = __imports[${safe}];`;
      }
      if (clause.startsWith('{')) {
        const dest = clause
          .replace(/^\{|\}$/g, '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
          .map((e) => e.replace(/\s+as\s+/, ': '))
          .join(', ');
        return `const { ${dest} } = __imports[${safe}];`;
      }
      return `const ${clause} = __imports[${safe}].default;`;
    },
  );
  body = body.replace(/^[\t ]*export\s+default\s+/gm, '__exports.default = ');
  const factory = new Function(
    `"use strict"; return (async function (__imports, __exports) { ${body}\n return __exports; });`,
  )();
  return await factory(importMap, {});
}
