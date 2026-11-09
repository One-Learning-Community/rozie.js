/**
 * Lit `r-on="$listeners"` onto a child Rozie component forwards the
 * consumer's listeners to it, as React/Solid do (the `$listeners` rest props
 * spread onto the child).
 *
 * Lit has no bag of consumer listeners: a consumer listens on the host
 * element itself (`<rozie-wrapper @save=${h}>`, `addEventListener`). Since
 * `$emit` stopped bubbling, the inner component's `save` never reaches the
 * wrapper host, so `$listeners` must be real here: the wrapper tracks the
 * event types its consumer listens for and re-dispatches those events from
 * the child (a fresh non-bubbling, non-composed CustomEvent on the host).
 * Composed events (a native click from inside the child) already reach the
 * host and are not re-dispatched, so nothing fires twice.
 *
 * Also: a teardown that runs before the first update (an element removed
 * before Lit got to render it) left `_rozieTornDown` true, so the mount that
 * followed was never torn down again and a reconnect re-ran it on top of the
 * live one. `firstUpdated()` now clears the flag.
 *
 * Mounted for real in happy-dom (emitLit → transpile → import).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { html, render } from 'lit';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(HERE, '.tmp-listeners-forward');

const INNER = `<rozie name="FwdInner">
<template>
<div>
  <button class="save" @click="$emit('save', 7)">s</button>
</div>
</template>
</rozie>
`;

const WRAPPER = `<rozie name="FwdWrapper" inherit-listeners="false">
<components>{ FwdInner: './FwdInner.rozie' }</components>
<template>
<FwdInner r-on="$listeners" />
</template>
</rozie>
`;

// Same wrapper without the explicit forward: no listener reaches the child.
const NO_FORWARD = `<rozie name="FwdNone" inherit-listeners="false">
<components>{ FwdInner: './FwdInner.rozie' }</components>
<template>
<FwdInner />
</template>
</rozie>
`;

const MOUNT_COUNT = `<rozie name="FwdMountCount">
<script>
$onMount(() => {
  globalThis.__fwdMounts = (globalThis.__fwdMounts ?? 0) + 1
  return () => { globalThis.__fwdMounts = globalThis.__fwdMounts - 1 }
})
</script>
<template><div>m</div></template>
</rozie>
`;

interface El extends HTMLElement {
  updateComplete: Promise<boolean>;
  hasUpdated: boolean;
  scheduleUpdate(): void | Promise<unknown>;
  performUpdate(): void;
}

function compile(src: string, filename: string): string {
  const { ast, diagnostics: parseDiags } = parse(src, { filename });
  if (!ast) throw new Error(`parse() null AST: ${parseDiags.map((d) => d.code).join(', ')}`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() null IR');
  const { code, diagnostics } = emitLit(ir, { filename, source: src, modifierRegistry: registry });
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return code;
}

function load(code: string, out: string): Promise<unknown> {
  const js = ts
    .transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    })
    .outputText.replace("import './FwdInner.rozie';", "import './FwdInner.mjs';");
  const file = resolve(TMP_DIR, out);
  writeFileSync(file, js, 'utf8');
  return import(pathToFileURL(file).href);
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Lit: r-on="$listeners" on a child component forwards consumer listeners', () => {
  let wrapperCode = '';
  beforeAll(async () => {
    mkdirSync(TMP_DIR, { recursive: true });
    wrapperCode = compile(WRAPPER, 'FwdWrapper.rozie');
    await load(compile(INNER, 'FwdInner.rozie'), 'FwdInner.mjs');
    await load(wrapperCode, 'FwdWrapper.mjs');
    await load(compile(NO_FORWARD, 'FwdNone.rozie'), 'FwdNone.mjs');
    await load(compile(MOUNT_COUNT, 'FwdMountCount.rozie'), 'FwdMountCount.mjs');
  });

  afterAll(() => rmSync(TMP_DIR, { recursive: true, force: true }));

  async function mount(tag: string, extra: (e: Event) => void = () => {}) {
    const outer = document.createElement('div');
    document.body.appendChild(outer);
    const heard: unknown[] = [];
    const clicks: string[] = [];
    if (tag === 'rozie-fwd-wrapper') {
      render(
        html`<rozie-fwd-wrapper
          @save=${(e: CustomEvent) => heard.push(e.detail)}
          @click=${() => clicks.push('click')}
        ></rozie-fwd-wrapper>`,
        outer,
      );
    } else {
      render(html`<rozie-fwd-none @save=${(e: CustomEvent) => heard.push(e.detail)}></rozie-fwd-none>`, outer);
    }
    const host = outer.firstElementChild as El;
    host.addEventListener('save', extra);
    await host.updateComplete;
    await flush();
    const inner = host.shadowRoot!.querySelector('rozie-fwd-inner') as El;
    await inner.updateComplete;
    return { outer, host, inner, heard, clicks };
  }

  it("re-dispatches the child's event on the host, once, without bubbling", async () => {
    const direct: unknown[] = [];
    const { outer, host, inner, heard } = await mount('rozie-fwd-wrapper', (e) => {
      direct.push((e as CustomEvent).detail);
      expect(e.bubbles).toBe(false);
      expect(e.composed).toBe(false);
      expect(e.target).toBe(host);
    });
    const ancestors: string[] = [];
    outer.addEventListener('save', () => ancestors.push('outer'));
    (inner.shadowRoot!.querySelector('button.save') as HTMLButtonElement).click();
    expect(heard).toEqual([7]);
    expect(direct).toEqual([7]);
    expect(ancestors).toEqual([]);
    outer.remove();
  });

  it('a composed native event from inside the child reaches the host once', async () => {
    const { outer, inner, clicks } = await mount('rozie-fwd-wrapper');
    (inner.shadowRoot!.querySelector('button.save') as HTMLButtonElement).click();
    expect(clicks).toEqual(['click']);
    outer.remove();
  });

  it('without r-on="$listeners" the child event stays on the child', async () => {
    const { outer, inner, heard } = await mount('rozie-fwd-none');
    (inner.shadowRoot!.querySelector('button.save') as HTMLButtonElement).click();
    expect(heard).toEqual([]);
    outer.remove();
  });

  it('the forwarding wrapper typechecks under strict tsc', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rozie-lit-listeners-forward-tsc-'));
    try {
      writeFileSync(join(dir, 'FwdWrapper.lit.ts'), wrapperCode, 'utf8');
      writeFileSync(
        join(dir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            noEmit: true,
            module: 'ESNext',
            target: 'ES2022',
            moduleResolution: 'bundler',
            strict: true,
            verbatimModuleSyntax: true,
            experimentalDecorators: true,
            useDefineForClassFields: false,
            skipLibCheck: true,
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          },
          include: ['FwdWrapper.lit.ts'],
        }),
        'utf8',
      );
      const pkgRoot = resolve(HERE, '../..');
      symlinkSync(join(pkgRoot, 'node_modules'), join(dir, 'node_modules'), 'dir');
      try {
        execFileSync(resolve(pkgRoot, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], {
          cwd: dir,
          stdio: 'pipe',
        });
      } catch (err) {
        const out = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        throw new Error('tsc --noEmit failed:\n' + out);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the $listeners getter a no-op placeholder when nothing forwards to a component', () => {
    const code = compile(
      `<rozie name="PlainRoot"><template><button>b</button></template></rozie>`,
      'PlainRoot.rozie',
    );
    expect(code).toContain('private get $listeners(): Record<string, EventListener> | undefined {');
    expect(code).not.toContain('addEventListener(type');
  });
});

// FwdMountCount is defined by the first describe's beforeAll.
describe('Lit: a teardown before the first update does not stick', () => {
  it('firstUpdated() clears _rozieTornDown, so the later mount is torn down and not doubled', async () => {
    const g = globalThis as { __fwdMounts?: number };
    g.__fwdMounts = 0;
    const el = document.createElement('rozie-fwd-mount-count') as El;
    // Hold the first update back until after the deferred teardown has run.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    el.scheduleUpdate = async function (this: El) {
      await gate;
      return this.performUpdate();
    };
    document.body.appendChild(el);
    el.remove();
    await flush(); // the deferred teardown runs; no first update yet
    expect(el.hasUpdated).toBe(false);
    document.body.appendChild(el);
    release();
    await el.updateComplete;
    await flush();
    expect(g.__fwdMounts).toBe(1);
    // A real un-mount now tears the mount down.
    el.remove();
    await flush();
    expect(g.__fwdMounts).toBe(0);
    // And a reconnect mounts once again — not on top of a live mount.
    document.body.appendChild(el);
    await el.updateComplete;
    await flush();
    expect(g.__fwdMounts).toBe(1);
    el.remove();
    await flush();
  });
});
