// quick 260929-ua4 — `collectTemplateEmits` edge cases.
//
// A `$emit('<literal>')` written only in <template> or only in a <listeners>
// handler must land in `bindings.emits` (and so in `ir.emits`), in first-seen
// order: <script> names, then <template> names in DFS pre-order, then
// <listeners> names. Dynamic names are not collected. The semantic validators
// that read `bindings.emits` (ROZ148 here) must see the template names.
import { describe, expect, it } from 'vitest';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import { lowerToIR } from '../../../ir/lower.js';
import { createDefaultRegistry } from '../../../modifiers/registerBuiltins.js';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';

function parseOk(source: string) {
  const { ast, diagnostics } = parse(source, { filename: 'EmitProbe.rozie' });
  if (!ast) {
    throw new Error(`parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`);
  }
  return ast;
}

function emitsOf(source: string): string[] {
  return [...analyzeAST(parseOk(source)).bindings.emits];
}

const component = (blocks: string) => `<rozie name="EmitProbe">
${blocks}
</rozie>`;

describe('collectTemplateEmits — template / listeners $emit collection', () => {
  it('collects a template-only emit nested inside r-for > r-if', () => {
    const src = component(`<props>
{ items: { type: Array, default: () => [] } }
</props>
<template>
<ul>
  <li r-for="item in $props.items" :key="item.id">
    <a r-if="item.visible" @click="$emit('pick', item)">{{ item.label }}</a>
  </li>
</ul>
</template>`);
    expect(emitsOf(src)).toEqual(['pick']);
  });

  it('collects a <listeners>-only emit', () => {
    const src = component(`<listeners>
  <listener :target="document" @keydown="$emit('hit', $event)" />
</listeners>
<template><div></div></template>`);
    expect(emitsOf(src)).toEqual(['hit']);
  });

  it('collects an emit inside a slot-filler body on a component tag', () => {
    const src = component(`<template>
<Child>
  <template #default>
    <button @click="$emit('fromSlot')">x</button>
  </template>
</Child>
</template>`);
    expect(emitsOf(src)).toEqual(['fromSlot']);
  });

  it('collects an emit inside a :binding arrow', () => {
    const src = component(`<template>
<Child :on-select="(v) => $emit('select', v)" />
</template>`);
    expect(emitsOf(src)).toEqual(['select']);
  });

  it('collects an emit inside a {{ }} interpolation', () => {
    const src = component(`<template>
<div>{{ $emit('shown') }}</div>
</template>`);
    expect(emitsOf(src)).toEqual(['shown']);
  });

  it('collects a TS-cast payload handler (needs the typescript-plugin parse pass)', () => {
    const src = component(`<template>
<button @click="$emit('typed', $event.detail as number)">x</button>
</template>`);
    expect(emitsOf(src)).toEqual(['typed']);
  });

  it('does NOT collect a dynamic name or a template-literal name', () => {
    const src = component(`<script>
const nameVar = 'dyn'
</script>
<template>
<div>
  <button @click="$emit(nameVar)">a</button>
  <button @click="$emit(\`tpl\`)">b</button>
  <button @click="$emit()">c</button>
</div>
</template>`);
    expect(emitsOf(src)).toEqual([]);
  });

  it('dedupes a name emitted from both <script> and <template>', () => {
    const src = component(`<script>
const save = () => { $emit('saved') }
</script>
<template>
<div>
  <button @click="$emit('saved')">a</button>
  <button @click="save()">b</button>
</div>
</template>`);
    expect(emitsOf(src)).toEqual(['saved']);
  });

  it('orders script, then template DFS pre-order, then listeners', () => {
    const src = component(`<script>
const s = () => { $emit('fromScript') }
const late = () => { $emit('tplFirst') }
</script>
<listeners>
  <listener :target="document" @keydown="$emit('fromListener')" />
  <listener :target="document" @keyup="$emit('tplOuter')" />
</listeners>
<template>
<div :data-x="$emit('tplOuter')">
  <span @click="$emit('tplFirst')">
    <b @click="$emit('tplDeep')">{{ $emit('tplInterp') }}</b>
  </span>
  <i @click="$emit('tplSibling')">x</i>
</div>
</template>`);
    expect(emitsOf(src)).toEqual([
      'fromScript',
      'tplFirst',
      'tplOuter',
      'tplDeep',
      'tplInterp',
      'tplSibling',
      'fromListener',
    ]);
  });

  it('a component with a <template> but no <script> still yields ir.emits', () => {
    const ast = parseOk(
      component(`<template>
<div>
  <button @click="$emit('ping', 1)">x</button>
  <span @click="$emit('pong')">y</span>
</div>
</template>`),
    );
    const { ir } = lowerToIR(ast, {
      modifierRegistry: createDefaultRegistry(),
      filename: 'EmitProbe.rozie',
    });
    expect(ir).not.toBeNull();
    expect(ir!.emits).toEqual(['ping', 'pong']);
  });

  it('ROZ148 fires for a <props> key onPing next to a template-only $emit(ping)', () => {
    const src = component(`<props>
{ onPing: { type: Function, default: null } }
</props>
<template>
<button @click="$emit('ping')">x</button>
</template>`);
    const { diagnostics } = analyzeAST(parseOk(src));
    const roz148 = diagnostics.filter(
      (d) => d.code === RozieErrorCode.PROP_EMIT_CALLBACK_NAME_COLLISION,
    );
    expect(roz148).toHaveLength(1);
    expect(roz148[0]!.message).toContain("'onPing'");
  });
});
