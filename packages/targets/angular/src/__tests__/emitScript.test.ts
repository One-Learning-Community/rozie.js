/**
 * emitScript test — Phase 5 Plan 05-04a Task 1.
 *
 * Behavior tests on the script-side emitter for Angular standalone components.
 * Drives the per-block fixture snapshots Counter.script.snap, SearchInput.script.snap,
 * and Modal.script.snap.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type {
  IRComponent,
  TemplateNode,
  TemplateSlotInvocationIR,
} from '../../../../core/src/ir/types.js';
import { emitScript } from '../emit/emitScript.js';
import { emitSlotInvocation } from '../emit/emitSlotInvocation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadIR(name: string): IRComponent {
  const filename = resolve(EXAMPLES, `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

describe('emitScript — Counter signal mapping', () => {
  it('Counter $props with model:true emits model<number>(0)', () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('value = model<number>(0)');
  });

  it('Counter $data emits hovering = signal(false)', () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('hovering = signal(false)');
  });

  it('Counter $computed emits canIncrement = computed(() => ...)', () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).toMatch(/canIncrement = computed\(\(\) =>/);
    expect(classBody).toMatch(/canDecrement = computed\(\(\) =>/);
    // Should reference this.value() etc.
    expect(classBody).toMatch(/this\.value\(\)/);
  });

  it("Counter constructor body contains console.log('hello from rozie') verbatim (DX-03)", () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('console.log("hello from rozie")');
  });

  it('Counter has no slot interfaces (no slots)', () => {
    const ir = loadIR('Counter');
    const { interfaceDecls } = emitScript(ir);
    expect(interfaceDecls).toEqual([]);
  });

  it('Counter imports do NOT include FormsModule', () => {
    const ir = loadIR('Counter');
    const { imports } = emitScript(ir);
    expect(imports.hasForms('FormsModule')).toBe(false);
  });
});

describe('emitScript — Modal D-19 paired-cleanup', () => {
  it('Modal registers paired cleanup via the hoisted __rozieDestroyRef field', () => {
    const ir = loadIR('Modal');
    const { classBody } = emitScript(ir);
    // D-19 paired pair: lockScroll mounted with unlockScroll cleanup. The
    // cleanup is registered from ngAfterViewInit, which is outside injection
    // context — so it must dereference the hoisted private field rather than
    // calling inject(DestroyRef) inline.
    expect(classBody).toContain('private __rozieDestroyRef = inject(DestroyRef);');
    expect(classBody).toContain('this.__rozieDestroyRef.onDestroy(this.unlockScroll)');
  });

  it('Modal $el-touching mount setup lives in ngAfterViewInit (not constructor)', () => {
    const ir = loadIR('Modal');
    const { classBody } = emitScript(ir);
    // Bug fix: viewChild() signals are undefined until view-init fires, so
    // `this.dialogEl()?.nativeElement?.focus()` would no-op (or throw on
    // .nativeElement-required APIs) in the constructor. Mount hooks must
    // lower into ngAfterViewInit.
    const afterViewInitMatch = classBody.match(/ngAfterViewInit\(\) \{([\s\S]*?)\n\}/);
    expect(afterViewInitMatch).not.toBeNull();
    const afterViewInitBody = afterViewInitMatch![1]!;
    expect(afterViewInitBody).toContain('this.dialogEl()?.nativeElement?.focus()');
    expect(afterViewInitBody).toContain('this.lockScroll()');
  });

  it('Modal class body has inject() ONLY in injection context (Pitfall 8)', () => {
    const ir = loadIR('Modal');
    const { classBody } = emitScript(ir);
    // Pitfall 8: inject() is only valid in constructor body or field
    // initializers. After the mount-→-ngAfterViewInit lowering, paired
    // cleanups call this.__rozieDestroyRef.onDestroy(...) instead — and the
    // ngAfterViewInit body itself must contain zero `inject(` calls.
    const afterViewInitMatch = classBody.match(/ngAfterViewInit\(\) \{([\s\S]*?)\n\}/);
    expect(afterViewInitMatch).not.toBeNull();
    const afterViewInitBody = afterViewInitMatch![1]!;
    expect(afterViewInitBody.match(/inject\(/g) ?? []).toEqual([]);
    // And the class globally must still inject DestroyRef at least once
    // (through the hoisted field initializer).
    expect((classBody.match(/inject\(/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});

describe('emitScript — SearchInput debounce + cleanup-return', () => {
  it('SearchInput inputEl ref emits viewChild<ElementRef<HTMLInputElement>>', () => {
    const ir = loadIR('SearchInput');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain("inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl')");
  });

  it('SearchInput onMount-with-cleanup-return registers cleanup via __rozieDestroyRef in ngAfterViewInit', () => {
    const ir = loadIR('SearchInput');
    const { classBody } = emitScript(ir);
    // The cleanup-return form pairs setup + cleanup; both land in
    // ngAfterViewInit so the cleanup arrow can still close over locals
    // declared in the setup body. The registration call dereferences the
    // hoisted private field (inject() is invalid outside injection context).
    expect(classBody).toContain('private __rozieDestroyRef = inject(DestroyRef);');
    expect(classBody).toContain('this.__rozieDestroyRef.onDestroy(');
    const afterViewInitMatch = classBody.match(/ngAfterViewInit\(\) \{([\s\S]*?)\n\}/);
    expect(afterViewInitMatch).not.toBeNull();
    expect(afterViewInitMatch![1]!).toContain('this.__rozieDestroyRef.onDestroy(');
  });

  it('SearchInput emits output() for both `search` and `clear` events', () => {
    const ir = loadIR('SearchInput');
    const { classBody } = emitScript(ir);
    // `search` carries a payload (`$emit('search', query)`) → output<unknown>().
    expect(classBody).toContain('search = output<unknown>()');
    // `clear` is payload-less (`$emit('clear')`) → output<void>() so a
    // no-arg `.emit()` typechecks (bug 4).
    expect(classBody).toContain('clear = output<void>()');
  });
});

describe('emitScript — TodoList slot context interfaces', () => {
  it('TodoList emits interface HeaderCtx and DefaultCtx and EmptyCtx', () => {
    const ir = loadIR('TodoList');
    const { interfaceDecls } = emitScript(ir);
    const joined = interfaceDecls.join('\n');
    expect(joined).toContain('interface HeaderCtx');
    expect(joined).toContain('interface DefaultCtx');
    expect(joined).toContain('interface EmptyCtx');
  });

  it('TodoList class body emits @ContentChild fields with synthetic #defaultSlot ref name', () => {
    const ir = loadIR('TodoList');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain("@ContentChild('header'");
    expect(classBody).toContain("@ContentChild('defaultSlot'");
    expect(classBody).toContain("@ContentChild('empty'");
  });

  it('TodoList class has ngTemplateContextGuard static method', () => {
    const ir = loadIR('TodoList');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('static ngTemplateContextGuard');
  });
});

describe('emitScript — per-block snapshot fixtures', () => {
  it('Counter.script.snap', async () => {
    const ir = loadIR('Counter');
    const { classBody, interfaceDecls, imports } = emitScript(ir);
    const out = [
      imports.render(),
      interfaceDecls.join('\n\n'),
      classBody,
    ]
      .filter((s) => s.trim().length > 0)
      .join('\n\n');
    await expect(out).toMatchFileSnapshot(resolve(FIXTURES, 'Counter.script.snap'));
  });

  it('SearchInput.script.snap', async () => {
    const ir = loadIR('SearchInput');
    const { classBody, interfaceDecls, imports } = emitScript(ir);
    const out = [
      imports.render(),
      interfaceDecls.join('\n\n'),
      classBody,
    ]
      .filter((s) => s.trim().length > 0)
      .join('\n\n');
    await expect(out).toMatchFileSnapshot(resolve(FIXTURES, 'SearchInput.script.snap'));
  });

  it('Modal.script.snap', async () => {
    const ir = loadIR('Modal');
    const { classBody, interfaceDecls, imports } = emitScript(ir);
    const out = [
      imports.render(),
      interfaceDecls.join('\n\n'),
      classBody,
    ]
      .filter((s) => s.trim().length > 0)
      .join('\n\n');
    await expect(out).toMatchFileSnapshot(resolve(FIXTURES, 'Modal.script.snap'));
  });
});

describe('emitScript — Quick 260515-u2b $watch lowering', () => {
  function lowerSrc(src: string): IRComponent {
    const parsed = parse(src, { filename: 'Synth.rozie' });
    return lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
  }

  it('emits `effect(() => { const __watchVal = (getter)(); untracked(() => (cb)()); });` for a 0-param callback (TS2554-safe)', () => {
    // 0-param `() => ...` cb: passing __watchVal would be runtime-safe but TS2554
    // ("Expected 0 arguments, but got 1") in `tsc --noEmit` — bind no arg.
    const src = `<rozie name="Synth">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
$watch(() => $props.open, () => { console.log('fired') })
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerSrc(src);
    const { classBody, imports } = emitScript(ir);
    // __watchVal is still computed (we keep the binding shape consistent),
    // but the callback receives NO arg when it declares zero params.
    //
    // Bug B fix (260519 linechart-watch-recreate) — the callback runs inside
    // `untracked(...)` so its reads (and transitive helper reads) DON'T join
    // the watcher effect's dependency set; only the getter defines re-runs.
    expect(classBody).toMatch(/effect\(\(\) => \{ const __watchVal = \([\s\S]+?\)\(\); untracked\(\(\) => \([\s\S]+?\)\(\)\); \}\);/);
    expect(imports.has('effect')).toBe(true);
    expect(imports.has('untracked')).toBe(true);
  });

  it('emits `effect(() => { const __watchVal = (getter)(); untracked(() => (cb)(__watchVal)); });` for a (v) => callback', () => {
    // (v) => ...` cb: pass __watchVal so the user-authored param actually
    // receives the getter's evaluated value.
    const src = `<rozie name="Synth">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
$watch(() => $props.open, (v) => { console.log('fired', v) })
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerSrc(src);
    const { classBody, imports } = emitScript(ir);
    // Bug B fix (260519 linechart-watch-recreate) — the callback is invoked
    // with __watchVal as its first arg, inside an `untracked(...)` wrapper so
    // its reads don't subscribe the watcher effect; only the getter does.
    expect(classBody).toMatch(/effect\(\(\) => \{ const __watchVal = \([\s\S]+?\)\(\); untracked\(\(\) => \([\s\S]+?\)\(__watchVal\)\); \}\);/);
    expect(imports.has('effect')).toBe(true);
    expect(imports.has('untracked')).toBe(true);
  });

  it('emits no effect() call AND no `effect` import when there are zero watchers AND no $onUpdate', () => {
    // Counter has no $onUpdate and no $watch — `effect` should NOT be in imports.
    const ir = loadIR('Counter');
    const { imports } = emitScript(ir);
    expect(imports.has('effect')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 07.3.2 Plan 03 — §templates-merge intake + binding
//
// Producer-side dynamic-name slot intake: every Angular component that
// declares slots accepts a signal-era `templates = input<Record<string,
// TemplateRef<unknown>> | undefined>(undefined);` field (NOT decorator
// `@Input()` per RESEARCH A7). The producer-side intake closes SC#3 (dogfood
// ModalConsumer Modal 2 "Dynamic header via slotName" silently dropped in
// Angular).
//
// D-02 static-wins invariant: at each *ngTemplateOutlet binding the merge
// expression `(<X>Tpl ?? templates()?.['<x>'])` places the `@ContentChild`
// static-name ref on the LEFT and the dynamic `templates()` signal lookup on
// the RIGHT, so the static-name path wins by `??` left-precedence + Angular's
// `ngAfterContentInit` lifecycle ordering (Assumption A5).
//
// D-05 byte-equivalence invariant: gated on `ir.slots.length > 0` so
// non-slotted components (Counter, SearchInput, Dropdown) emit byte-identical
// output before and after Plan 03.
// ---------------------------------------------------------------------------

describe('emitScript — §templates-merge intake (Phase 07.3.2 D-SV-16 port, A7 signal-era)', () => {
  it('Modal (slotted) class body contains `templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);`', () => {
    const ir = loadIR('Modal');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
  });

  it('Modal (slotted) class body does NOT contain `@Input() templates` (A7 signal-form override of CONTEXT.md decorator recommendation)', () => {
    const ir = loadIR('Modal');
    const { classBody } = emitScript(ir);
    expect(classBody).not.toMatch(/@Input\(\)\s+templates/);
  });

  it('Counter (non-slotted) emits NO `templates = input<...>` field (D-05 byte-equivalence)', () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).not.toMatch(/templates\s*=\s*input</);
  });

  it('TodoList (slotted) class body contains the `templates = input<...>` intake', () => {
    const ir = loadIR('TodoList');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
  });

  it('Modal (slotted) collector includes `input` import (defensive — slotted components always need `input` to call `input<T>()` for templates)', () => {
    const ir = loadIR('Modal');
    const { imports } = emitScript(ir);
    expect(imports.has('input')).toBe(true);
  });
});

describe('emitSlotInvocation — §templates-merge binding (Phase 07.3.2 D-02 static-wins, A7 signal call)', () => {
  // Synthetic slot-invocation node helper. Mirrors the shape produced by
  // lowerToIR for `<slot name="header" />` references inside a producer
  // template body. node.fallback / args default to empty.
  function makeSlotInvocation(slotName: string): TemplateSlotInvocationIR {
    return {
      type: 'slot-invocation',
      slotName,
      args: [],
      fallback: [] as TemplateNode[],
      context: undefined,
    } as TemplateSlotInvocationIR;
  }

  function makeCtx(ir: IRComponent) {
    return {
      ir,
      emitChildren: (_children: TemplateNode[]) => '',
    };
  }

  it('Modal header-slot binding merges `(headerTpl ?? templates()?.[\'header\'])` at *ngTemplateOutlet (inline form per A7 signal call)', () => {
    const ir = loadIR('Modal');
    const out = emitSlotInvocation(makeSlotInvocation('header'), makeCtx(ir));
    // Inline form (Pitfall 3 not triggered) — matches the canonical D-SV-16
    // shape adapted for Angular's signal-call `templates()` read.
    expect(out).toContain(
      `*ngTemplateOutlet="(headerTpl ?? templates()?.['header'])"`,
    );
  });

  it('Modal footer-slot binding merges `(footerTpl ?? templates()?.[\'footer\'])` at *ngTemplateOutlet', () => {
    const ir = loadIR('Modal');
    const out = emitSlotInvocation(makeSlotInvocation('footer'), makeCtx(ir));
    expect(out).toContain(
      `*ngTemplateOutlet="(footerTpl ?? templates()?.['footer'])"`,
    );
  });

  it('Modal default-slot binding uses synthetic `defaultSlot` key (refineSlotTypes.ts:24): `(defaultTpl ?? templates()?.[\'defaultSlot\'])`', () => {
    const ir = loadIR('Modal');
    const out = emitSlotInvocation(makeSlotInvocation(''), makeCtx(ir));
    // tplField for default slot is `defaultTpl` (slotFieldName('') === 'defaultTpl');
    // dynKey is the synthetic `defaultSlot` ref name.
    expect(out).toContain(
      `*ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])"`,
    );
  });

  it('Modal header-slot binding still emits @ContentChild static-name path on LEFT of `??` (D-02 invariant)', () => {
    const ir = loadIR('Modal');
    const out = emitSlotInvocation(makeSlotInvocation('header'), makeCtx(ir));
    // Static ref MUST appear before `??`; dynamic templates() MUST appear after.
    const match = out.match(
      /\*ngTemplateOutlet="\((\w+Tpl)\s*\?\?\s*templates\(\)\?\.\['([^']+)'\]\)/,
    );
    expect(match).not.toBeNull();
    expect(match![1]).toBe('headerTpl');
    expect(match![2]).toBe('header');
  });
});

// Phase 21 Plan 06 (REQ-7, REQ-10) — $expose emit guarantee. Compile inline
// .rozie source (no on-disk fixture) so each case is self-contained.
function emitFromSource(source: string): string {
  const result = parse(source, { filename: 'ExposeProbe.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST for inline source');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR for inline source');
  return emitScript(lowered.ir).classBody;
}

const EXPOSE_PROBE_SRC = `<rozie name="ExposeProbe">
<template>
  <input :ref="inputEl" :value="text" @input="onInput" />
</template>
<data>
{ text: "" }
</data>
<script>
function reset() { $data.text = ""; }
function focus() { $refs.inputEl.focus(); }
function onInput(e) { $data.text = e.target.value; }
$expose({ reset, focus });
</script>
</rozie>`;

// Exposed-ONLY: `unusedReset` is referenced nowhere except $expose.
const EXPOSE_ONLY_SRC = `<rozie name="ExposeOnly">
<template>
  <input :value="text" @input="onInput" />
</template>
<data>
{ text: "" }
</data>
<script>
function unusedReset() { $data.text = ""; }
function onInput(e) { $data.text = e.target.value; }
$expose({ unusedReset });
</script>
</rozie>`;

describe('emitScript — $expose public class methods (REQ-7)', () => {
  it('exposed functions emit as PUBLIC class members (no private/protected)', () => {
    const classBody = emitFromSource(EXPOSE_PROBE_SRC);
    // Both exposed names appear as class members …
    expect(classBody).toMatch(/\breset\s*=/);
    expect(classBody).toMatch(/\bfocus\s*=/);
    // … and are NOT private/protected/#-private.
    expect(classBody).not.toMatch(/(private|protected)\s+reset\b/);
    expect(classBody).not.toMatch(/(private|protected)\s+focus\b/);
    expect(classBody).not.toContain('#reset');
    expect(classBody).not.toContain('#focus');
  });

  it('strips the top-level $expose(...) call — no bare `$expose(` leaks', () => {
    const classBody = emitFromSource(EXPOSE_PROBE_SRC);
    expect(classBody).not.toContain('$expose(');
  });

  it('retains an exposed-ONLY function (not referenced by template/listeners)', () => {
    const classBody = emitFromSource(EXPOSE_ONLY_SRC);
    expect(classBody).toMatch(/\bunusedReset\s*=/);
    expect(classBody).not.toContain('$expose(');
  });

  it('byte-identical when ir.expose is empty (Counter unchanged)', () => {
    const withExpose = emitScript(loadIR('Counter')).classBody;
    // Re-emit a second time to confirm deterministic, expose-free output.
    const again = emitScript(loadIR('Counter')).classBody;
    expect(withExpose).toBe(again);
    expect(withExpose).not.toContain('$expose(');
  });
});
