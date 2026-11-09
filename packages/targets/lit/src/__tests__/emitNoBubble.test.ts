/**
 * Lit component events stay on the element that emits them, as on the other
 * five targets. `$emit` lowers to `new CustomEvent(name, { bubbles: false,
 * composed: false })`, so a listener on the element itself (a Lit `@ping=${…}`
 * binding, `addEventListener` on the element, a Rozie consumer) hears it, but
 * an ancestor's same-named listener — e.g. an outer sortable-list's `reorder`
 * listener around a nested list — does not, and the event never leaves the
 * shadow root the element sits in.
 *
 * Mounted for real in happy-dom (emitLit → transpile → import). Covers both
 * lowering paths: `$emit` in a template handler and `$emit` in `<script>`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { html, render } from 'lit';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(HERE, '.tmp-emit-no-bubble');
const OUT_FILE = resolve(TMP_DIR, 'PingProbe.mjs');

const SOURCE = `<rozie name="PingProbe">
<script>
const fromScript = () => { $emit('script-ping', 2) }
</script>
<template>
<div>
  <button class="tpl" @click="$emit('ping', 1)">t</button>
  <button class="scr" @click="fromScript">s</button>
</div>
</template>
</rozie>
`;

interface Probe extends HTMLElement {
  updateComplete: Promise<boolean>;
}

function compile(src: string): string {
  const { ast, diagnostics: parseDiags } = parse(src, { filename: 'PingProbe.rozie' });
  if (!ast) throw new Error(`parse() null AST: ${parseDiags.map((d) => d.code).join(', ')}`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() null IR');
  const { code, diagnostics } = emitLit(ir, {
    filename: 'PingProbe.rozie',
    source: src,
    modifierRegistry: registry,
  });
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return code;
}

async function mountInShadow(): Promise<{ outerHost: HTMLElement; wrapper: HTMLElement; probe: Probe; own: string[] }> {
  // outerHost ─#shadow─ wrapper ─ <rozie-ping-probe @ping @script-ping>
  const outerHost = document.createElement('div');
  document.body.appendChild(outerHost);
  const root = outerHost.attachShadow({ mode: 'open' });
  const own: string[] = [];
  render(
    html`<div class="wrapper"><rozie-ping-probe
      @ping=${(e: CustomEvent) => own.push(`ping:${e.detail}`)}
      @script-ping=${(e: CustomEvent) => own.push(`script-ping:${e.detail}`)}
    ></rozie-ping-probe></div>`,
    root as unknown as HTMLElement,
  );
  const probe = root.querySelector('rozie-ping-probe') as Probe;
  await probe.updateComplete;
  return { outerHost, wrapper: root.querySelector('.wrapper') as HTMLElement, probe, own };
}

describe('Lit: component events do not bubble or cross shadow roots', () => {
  let code = '';
  beforeAll(async () => {
    code = compile(SOURCE);
    const js = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    }).outputText;
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(OUT_FILE, js, 'utf8');
    await import(pathToFileURL(OUT_FILE).href);
  });

  afterAll(() => rmSync(TMP_DIR, { recursive: true, force: true }));

  it('emits bubbles: false, composed: false for both $emit lowerings', () => {
    expect(code).toContain('new CustomEvent("ping", {');
    expect(code).toContain('new CustomEvent("script-ping", {');
    expect(code).not.toMatch(/bubbles: true/);
    expect(code).not.toMatch(/composed: true/);
  });

  for (const [cls, name, detail] of [
    ['tpl', 'ping', 1],
    ['scr', 'script-ping', 2],
  ] as const) {
    it(`${name}: the element's own listeners hear it; ancestors do not`, async () => {
      const { outerHost, wrapper, probe, own } = await mountInShadow();
      const ancestors: string[] = [];
      wrapper.addEventListener(name, () => ancestors.push('wrapper'));
      outerHost.addEventListener(name, () => ancestors.push('outerHost'));
      document.addEventListener(name, () => ancestors.push('document'));
      const direct: unknown[] = [];
      probe.addEventListener(name, (e) => direct.push((e as CustomEvent).detail));

      (probe.shadowRoot!.querySelector(`button.${cls}`) as HTMLButtonElement).click();

      expect(own).toEqual([`${name}:${detail}`]);
      expect(direct).toEqual([detail]);
      expect(ancestors).toEqual([]);
      outerHost.remove();
    });
  }
});
