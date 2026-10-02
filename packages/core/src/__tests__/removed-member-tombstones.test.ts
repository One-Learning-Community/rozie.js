/**
 * Removed-member tombstones (quick 261002-ekf F8).
 *
 * `<emits>` `change: { removed: '<msg>' }` and `<props>` `oldName: { removed:
 * '<msg>' }` keep a removed/renamed member visible to TYPED consumers for a
 * release: on React, Solid and Svelte the props interface carries
 * `<handler>?: never` / `oldName?: never` under a `@deprecated <msg>` JSDoc, so
 * the member is also dropped from the native-attrs `Omit<…>` base (otherwise
 * `<Popover onChange>` type-checks as the native DOM handler and never fires).
 * A tombstone has NO runtime presence on any target. `$emit` of a removed
 * event, or a `$props`/`$model` read of a removed prop, is ROZ158; a tombstone
 * carrying anything besides `removed`, or a non-string message, is ROZ159.
 * ROZ152 (declared-never-emitted) ignores tombstones.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { buildManifest } from '../manifest/buildManifest.js';
import { parseManifest } from '../manifest/readManifest.js';
import { emitReactTypes } from '../../../targets/react/src/emit/emitTypes.js';
import { emitSolidTypes } from '../../../targets/solid/src/emit/emitTypes.js';
import { emitSvelteTypes } from '../../../targets/svelte/src/emit/emitTypes.js';

const EVENT_MSG = 'Removed in 0.3.0 — use the `open` model change event (onOpenChange).';
const PROP_MSG = 'Renamed to `newName`.';

const PROPS = `{
  open: { type: Boolean, default: false, model: true },
  oldName: { removed: '${PROP_MSG}' },
  newName: { type: String, default: '' },
}`;
const EMITS = `{
  toggle: { payload: 'boolean' },
  change: { removed: '${EVENT_MSG}' },
}`;
const SCRIPT = `function flip() { $model.open = !$props.open; $emit('toggle', $props.open) }`;
const TEMPLATE = `<div @click="flip">{{ $props.newName }}</div>`;

const src = (opts: { props?: string; emits?: string; script?: string; template?: string } = {}) =>
  `<rozie name="Probe">
<props>
${opts.props ?? PROPS}
</props>
<emits>
${opts.emits ?? EMITS}
</emits>
<script>
${opts.script ?? SCRIPT}
</script>
<template>
${opts.template ?? TEMPLATE}
</template>
</rozie>
`;

function lower(s: string) {
  const { ast, diagnostics: pd } = parse(s, { filename: 'Probe.rozie' });
  const { ir, diagnostics } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return { ir: ir!, diagnostics: [...pd, ...diagnostics] };
}

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function compiled(target: Target, s = src()): string {
  const r = compile(s, { target, filename: 'Probe.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.code;
}

function omitList(code: string): string {
  const m = /extends Omit<[^,]+, ([^>]*)>/.exec(code);
  if (!m) throw new Error(`no Omit clause in:\n${code}`);
  return m[1]!;
}

/** The text of the `interface …Props … { … }` block (inline module or sidecar). */
function propsInterface(code: string): string {
  const m = /(?:export )?interface (?:Probe)?Props\b[^{]*\{\n[\s\S]*?\n\}/.exec(code);
  if (!m) throw new Error(`no Props interface in:\n${code}`);
  return m[0];
}

const tombstone = (key: string, msg: string) =>
  `  /**\n   * @deprecated ${msg}\n   */\n  ${key}?: never;`;

/** Per-target handler key of the removed `change` event. */
const HANDLER = { react: 'onChange', solid: 'onChange', svelte: 'onchange' } as const;

describe('removed-member tombstones — lowering', () => {
  it('a valid component lowers with no errors and no ROZ152 for the tombstone', () => {
    const { ir, diagnostics } = lower(src());
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(diagnostics.filter((d) => d.code === 'ROZ152')).toEqual([]);
    // Tombstones are not live members.
    expect(ir.emits).toEqual(['toggle']);
    expect(ir.emitDecls!.map((d) => d.name)).toEqual(['toggle']);
    expect(ir.props.map((p) => p.name)).toEqual(['open', 'newName']);
    expect(ir.removedMembers).toEqual([
      expect.objectContaining({ kind: 'prop', name: 'oldName', message: PROP_MSG }),
      expect.objectContaining({ kind: 'event', name: 'change', message: EVENT_MSG }),
    ]);
  });

  it('a component without tombstones carries no removedMembers field', () => {
    const { ir } = lower(src({ props: `{ newName: { type: String, default: '' } }`, emits: `{ toggle: { payload: 'boolean' } }`, script: `function flip() { $emit('toggle', true) }` }));
    expect('removedMembers' in ir).toBe(false);
  });

  it("$emit of a removed event is a located ROZ158 error (not ROZ151)", () => {
    const s = src({ script: `${SCRIPT}\nfunction legacy() { $emit('change') }` });
    const { diagnostics } = lower(s);
    expect(diagnostics.filter((d) => d.code === 'ROZ151')).toEqual([]);
    const d = diagnostics.filter((x) => x.code === 'ROZ158');
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe('error');
    expect(d[0]!.message).toContain(EVENT_MSG);
    expect(s.slice(d[0]!.loc.start, d[0]!.loc.end)).toBe(`$emit('change')`);
  });

  it('$emit of a removed event in the template is ROZ158 too', () => {
    const s = src({ template: `<div @click="flip" @keydown="$emit('change')">{{ $props.newName }}</div>` });
    expect(lower(s).diagnostics.filter((x) => x.code === 'ROZ158')).toHaveLength(1);
  });

  it('$props / $model read of a removed prop is ROZ158 (not the unknown-ref code)', () => {
    const s = src({ script: `${SCRIPT}\nconst a = () => $props.oldName;` });
    const { diagnostics } = lower(s);
    const d = diagnostics.filter((x) => x.code === 'ROZ158');
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain(PROP_MSG);
    expect(diagnostics.filter((x) => x.code === 'ROZ101')).toEqual([]);
    const m = lower(src({ script: `${SCRIPT}\nfunction w() { $model.oldName = 1 }` })).diagnostics;
    expect(m.filter((x) => x.code === 'ROZ158')).toHaveLength(1);
    expect(m.filter((x) => x.code === 'ROZ113')).toEqual([]);
  });

  it.each([
    [`{ toggle: { payload: 'boolean' }, change: { removed: 'x', payload: 'number' } }`],
    [`{ toggle: { payload: 'boolean' }, change: { removed: 42 } }`],
    [`{ toggle: { payload: 'boolean' }, change: { removed: '' } }`],
    [`{ toggle: { payload: 'boolean' }, change: { removed: 'x', docs: { description: 'y' } } }`],
  ])('a malformed <emits> tombstone is ROZ159: %s', (emits) => {
    const d = lower(src({ emits })).diagnostics.filter((x) => x.code === 'ROZ159');
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe('error');
  });

  it.each([
    [`{ open: { type: Boolean, default: false, model: true }, oldName: { removed: 'x', type: String }, newName: { type: String, default: '' } }`],
    [`{ open: { type: Boolean, default: false, model: true }, oldName: { removed: 'x', default: 1 }, newName: { type: String, default: '' } }`],
    [`{ open: { type: Boolean, default: false, model: true }, oldName: { removed: 1 }, newName: { type: String, default: '' } }`],
  ])('a malformed <props> tombstone is ROZ159: %s', (props) => {
    const d = lower(src({ props })).diagnostics.filter((x) => x.code === 'ROZ159');
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe('error');
  });
});

describe('removed-member tombstones — typed surface (react / solid / svelte)', () => {
  for (const target of ['react', 'solid', 'svelte'] as const) {
    const key = HANDLER[target];
    it(`${target}: inline module interface carries @deprecated never members and omits them from the attrs base`, () => {
      const code = compiled(target);
      const iface = propsInterface(code);
      expect(iface).toContain(tombstone(key, EVENT_MSG));
      expect(iface).toContain(tombstone('oldName', PROP_MSG));
      const omit = omitList(code);
      expect(omit).toContain(`'${key}'`);
      expect(omit).toContain(`'oldName'`);
    });

    it(`${target}: .d.rozie.ts sidecar carries the same members and Omit keys`, () => {
      const { ir } = lower(src());
      const emitTypes = { react: emitReactTypes, solid: emitSolidTypes, svelte: emitSvelteTypes }[target];
      const out = emitTypes(ir);
      const iface = propsInterface(out);
      expect(iface).toContain(tombstone(key, EVENT_MSG));
      expect(iface).toContain(tombstone('oldName', PROP_MSG));
      const omit = omitList(out);
      expect(omit).toContain(`'${key}'`);
      expect(omit).toContain(`'oldName'`);
    });
  }

  it('a `*/` in the message cannot close the JSDoc early', () => {
    const code = compiled('react', src({ emits: `{ toggle: { payload: 'boolean' }, change: { removed: 'a */ b' } }` }));
    expect(propsInterface(code)).toContain('@deprecated a *\\/ b');
  });

  it('a tombstone whose handler name collides with a live prop is skipped (no duplicate member)', () => {
    const code = compiled('react', src({
      props: `{ open: { type: Boolean, default: false, model: true }, onChange: { type: Function, default: null }, newName: { type: String, default: '' } }`,
    }));
    const iface = propsInterface(code);
    expect(iface.match(/^ {2}onChange\??:/gm)).toHaveLength(1);
    expect(iface).not.toContain('onChange?: never');
  });
});

describe('removed-member tombstones — no runtime presence', () => {
  for (const target of TARGETS) {
    it(`${target}: neither tombstone reaches runtime code`, () => {
      let code = compiled(target);
      // Strip the type surface (React/Solid/Svelte props interface) — only
      // runtime code may remain.
      if (target === 'react' || target === 'solid' || target === 'svelte') {
        code = code.replace(propsInterface(code), '');
      }
      expect(code).not.toContain('oldName');
      expect(code).not.toMatch(/['"]change['"]/);
      expect(code).not.toMatch(/\bonChange\b|\bonchange\b/);
      expect(code).not.toContain(EVENT_MSG);
      expect(code).not.toContain(PROP_MSG);
    });
  }
});

describe('removed-member tombstones — manifest (schema v2 unchanged)', () => {
  it('tombstones are not serialized: the manifest equals the tombstone-free component\'s', () => {
    const withTombs = buildManifest(lower(src()).ir);
    const without = buildManifest(lower(src({
      props: `{
  open: { type: Boolean, default: false, model: true },
  newName: { type: String, default: '' },
}`,
      emits: `{
  toggle: { payload: 'boolean' },
}`,
    })).ir);
    expect(withTombs).toEqual(without);
    expect(JSON.stringify(withTombs)).not.toMatch(/oldName|removed|"change"/);
  });

  it('the reader tolerates an unknown top-level key (forward compatibility)', () => {
    const m = { ...buildManifest(lower(src()).ir), removed: [{ kind: 'event', name: 'change', message: 'x' }] };
    const r = parseManifest(JSON.parse(JSON.stringify(m)));
    expect(r.error).toBeNull();
  });
});
