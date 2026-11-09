/**
 * A non-Rozie Lit consumer fills scoped slots through the `rozieSlots` record
 * ONLY, on a producer that gates each slot's wrapper with `r-if="$slots.X"`
 * (the command-palette `icon` / `actions` / `trailing` shape, the Modal
 * header / footer shape). The wrapper must render, and the fill must receive
 * its scope. Mounted for real in happy-dom (compile → transpile → import).
 *
 * Before the fix the presence check was `_hasSlotIcon || this.icon !==
 * undefined`, so a record-only fill left the gate false and nothing rendered.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { html } from 'lit';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(HERE, '.tmp-rozie-slots-gated');
const OUT_FILE = resolve(TMP_DIR, 'GatedProbe.mjs');
const OLD_FILE = resolve(TMP_DIR, 'GatedProbeOld.mjs');

const SOURCE = `<rozie name="GatedProbe">
<props>
{
  label: { type: String, default: 'Row' },
}
</props>
<template>
<div class="row">
  <span r-if="$slots.icon" class="icon-wrap"><slot name="icon" :size="16"></slot></span>
  <span class="label">{{ $props.label }}</span>
  <span r-if="$slots.trailing" class="trailing-wrap"><slot name="trailing" :label="$props.label"></slot></span>
</div>
</template>
</rozie>
`;

interface Probe extends HTMLElement {
  rozieSlots?: Record<string, (scope: any) => unknown>;
  updateComplete: Promise<boolean>;
}

describe('Lit: a record-only rozieSlots fill opens an r-if="$slots.X" gate', () => {
  beforeAll(async () => {
    const result = compile(SOURCE, { target: 'lit', filename: 'GatedProbe.rozie', sourceMap: false });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const toJs = (code: string) =>
      ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      }).outputText;
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(OUT_FILE, toJs(result.code), 'utf8');
    // Premise: the same element with the pre-fix gate (no record term),
    // registered under another tag.
    const old = result.code
      .replace(/ \|\| this\.rozieSlots\?\.\["(icon|trailing)"\] !== undefined/g, '')
      .replace("customElement('rozie-gated-probe')", "customElement('rozie-gated-probe-old')");
    expect(old).not.toBe(result.code);
    expect(old).toContain("customElement('rozie-gated-probe-old')");
    writeFileSync(OLD_FILE, toJs(old), 'utf8');
    await import(pathToFileURL(OUT_FILE).href);
    await import(pathToFileURL(OLD_FILE).href);
  });

  afterAll(() => rmSync(TMP_DIR, { recursive: true, force: true }));

  it('unfilled: both gated wrappers are absent', async () => {
    const el = document.createElement('rozie-gated-probe') as Probe;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.icon-wrap')).toBeNull();
    expect(el.shadowRoot!.querySelector('.trailing-wrap')).toBeNull();
    el.remove();
  });

  it('record-only fill: the gated wrappers render the fills with their scope', async () => {
    const el = document.createElement('rozie-gated-probe') as Probe;
    el.rozieSlots = {
      icon: ({ size }: { size: number }) => html`<i class="ico">${size}</i>`,
      trailing: ({ label }: { label: string }) => html`<b class="trail">${label}!</b>`,
    };
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.icon-wrap .ico')?.textContent).toBe('16');
    expect(el.shadowRoot!.querySelector('.trailing-wrap .trail')?.textContent).toBe('Row!');
    el.remove();
  });

  it('premise: with the pre-fix gate a record-only fill renders nothing', async () => {
    const el = document.createElement('rozie-gated-probe-old') as Probe;
    el.rozieSlots = { icon: () => html`<i class="ico">x</i>`, trailing: () => html`<b class="trail">y</b>` };
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.icon-wrap')).toBeNull();
    expect(el.shadowRoot!.querySelector('.trailing-wrap')).toBeNull();
    el.remove();
  });
});
