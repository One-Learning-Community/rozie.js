/**
 * EVENT-CONTRACT HARNESS — quick task 260811-sdd.
 *
 * Compile-only (no checkers, no tmpdir, no sibling node_modules — contrast
 * `tests/composed-ref-conformance/composed-ref.harness.ts`, which boots real
 * `tsc`/`vue-tsc`/`svelte-check` processes). This suite needs `compile()`
 * twice per target plus regex extraction over the emitted string — the
 * mechanism precedent is `tests/slot-matrix/slot-matrix.test.ts`
 * (`compile()` from `@rozie/core` + per-target snapshot), NOT the
 * composed-ref checker harness.
 *
 * Exposes:
 *   - `compilePair()` — compiles a child+parent `.rozie` fixture pair to one
 *     target, throwing on any compiler-error diagnostic.
 *   - `childTagFor()` — the parent-side tag name for a composed child,
 *     per target (component name verbatim for react/solid/svelte/vue;
 *     `rozie-<kebab-name>` for lit/angular).
 *   - `extractChildPublicNames()` / `extractParentBoundNames()` — per-target
 *     regex extraction of the two sides of the event-name contract, using
 *     the exact shapes observed live during planning (see the PLAN.md
 *     orchestrator_evidence table) — with ONE verified correction: react's
 *     dispatch-linkage regex accepts BOTH `props.onX(` (the common,
 *     non-escaping-helper shape this suite's fixtures actually produce) and
 *     `_rozieProp_onX(` (the escaping-helper-hoisted shape emitScript.ts's
 *     `tryWrapEscapingHelperUseCallback` produces when a helper is
 *     referenced from an effect/callback dependency array) — the plan's
 *     table named only the latter, but a direct compile of these fixtures
 *     confirms react's plain-click-handler shape emits the former. Accepting
 *     both keeps the contract meaningful regardless of which lowering path a
 *     future fixture edit happens to hit, rather than hard-coding one
 *     observed shape (Rule 1 — the fix scope is this regex only; every other
 *     target's regex matched a direct probe compile byte-for-byte).
 *   - `canonicalize()` — the per-target agreement normalizer.
 *   - `stem()` — the authored-name provenance normalizer.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, type CompileTarget } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, 'fixtures');

export type Target = 'react' | 'vue' | 'svelte' | 'solid' | 'lit' | 'angular';
export const ALL_TARGETS: Target[] = ['react', 'solid', 'vue', 'svelte', 'lit', 'angular'];

/** Compile one fixture source to `target`; throw on a compiler-error diagnostic. */
function compileFixture(source: string, target: Target, filename: string): string {
  const result = compile(source, {
    target: target as CompileTarget,
    filename,
    // Both fixture pairs are two-file (parent's <components> resolves the
    // sibling child by relative path) — resolverRoot + an ABSOLUTE filename
    // is required for the producer resolver to find the sibling, mirroring
    // tests/slot-matrix's multi-file fixture handling.
    resolverRoot: FIXTURE_DIR,
    sourceMap: false,
  });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `[${target}] compile(${filename}) reported errors: ${errors
        .map((d) => d.message)
        .join('; ')}`,
    );
  }
  return result.code;
}

/** Compile a child+parent fixture pair to one target. Throws on a compile error. */
export function compilePair(
  childFixture: string,
  parentFixture: string,
  target: Target,
): { childCode: string; parentCode: string } {
  const childPath = join(FIXTURE_DIR, childFixture);
  const parentPath = join(FIXTURE_DIR, parentFixture);
  const childSrc = readFileSync(childPath, 'utf8');
  const parentSrc = readFileSync(parentPath, 'utf8');
  const childCode = compileFixture(childSrc, target, childPath);
  const parentCode = compileFixture(parentSrc, target, parentPath);
  return { childCode, parentCode };
}

/** PascalCase component name → kebab-case (`AliasEmitChild` → `alias-emit-child`). */
function toKebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * The parent-side tag name for a `<components>`-composed child, per target.
 * Verbatim component name for react/solid/svelte/vue (JSX/SFC component
 * reference); `rozie-<kebab-name>` for lit/angular (the registered custom
 * element / Angular selector — matches `emitDecorator.ts`'s
 * `rozie-${toKebabCase(componentName)}` on both targets).
 */
export function childTagFor(componentName: string, target: Target): string {
  if (target === 'lit' || target === 'angular') {
    return `rozie-${toKebabCase(componentName)}`;
  }
  return componentName;
}

export interface ChildNameEntry {
  /** The child's PUBLIC event name — what a consumer must bind to receive it. */
  name: string;
  /**
   * The name referenced at the child's OWN dispatch/emit call site. Equal to
   * `name` on every target EXCEPT Angular with an alias, where the dispatch
   * site uses the FIELD ID (`this.<fieldId>.emit(`) while the public name is
   * the alias. Empty string when no matching call site was found (a silently
   * dropped event — the internal-linkage layer's whole point).
   */
  dispatchLinkage: string;
}

function matchInterfaceBody(code: string, headerRe: RegExp, label: string): string {
  const m = headerRe.exec(code);
  if (!m) {
    throw new Error(`could not locate ${label} block in emitted code:\n${code}`);
  }
  return m[1]!;
}

/**
 * Extract the child's declared PUBLIC event names + their dispatch-site
 * linkage, per target. Shapes below are the exact ones observed compiling
 * this suite's own fixtures (see file header for the one react correction).
 */
export function extractChildPublicNames(childCode: string, target: Target): ChildNameEntry[] {
  switch (target) {
    case 'react':
    case 'solid': {
      const body = matchInterfaceBody(
        childCode,
        /interface \w+Props\s*\{([\s\S]*?)\n\}/,
        `${target} Props interface`,
      );
      const names = [...body.matchAll(/(on[A-Za-z0-9]+)\?:/g)].map((m) => m[1]!);
      const callRe =
        target === 'react'
          ? /(?:props\.|_rozieProp_)(on[A-Za-z0-9]+)\(/g
          : /_props\.(on[A-Za-z0-9]+)\?\.\(/g;
      const callNames = new Set([...childCode.matchAll(callRe)].map((m) => m[1]!));
      return names
        .map((name) => ({ name, dispatchLinkage: callNames.has(name) ? name : '' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    case 'svelte': {
      const body = matchInterfaceBody(
        childCode,
        /interface Props\s*\{([\s\S]*?)\n\}/,
        'svelte Props interface',
      );
      const names = [...body.matchAll(/(on[a-z0-9]+)\?:/g)].map((m) => m[1]!);
      const callNames = new Set(
        [...childCode.matchAll(/(on[a-z0-9]+)\?\.\(/g)].map((m) => m[1]!),
      );
      return names
        .map((name) => ({ name, dispatchLinkage: callNames.has(name) ? name : '' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    case 'vue': {
      const body = matchInterfaceBody(
        childCode,
        /defineEmits<\{([\s\S]*?)\}>\(\)/,
        'vue defineEmits<{}> type literal',
      );
      const names = [...body.matchAll(/(?:'([^']+)'|([A-Za-z_$][\w$]*)):\s*\[/g)].map(
        (m) => (m[1] ?? m[2])!,
      );
      const callNames = new Set([...childCode.matchAll(/emit\('([^']+)'/g)].map((m) => m[1]!));
      return names
        .map((name) => ({ name, dispatchLinkage: callNames.has(name) ? name : '' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    case 'lit': {
      // Lit has no separate declaration — the dispatch string IS the public
      // name, so linkage === name by construction.
      const names = [...childCode.matchAll(/new CustomEvent\("([^"]+)"/g)].map((m) => m[1]!);
      return names
        .map((name) => ({ name, dispatchLinkage: name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    case 'angular': {
      const fieldRe = /(\w+)\s*=\s*output<[^>]*>\(([^)]*)\)/g;
      const emitFieldIds = [...childCode.matchAll(/this\.(\w+)\.emit\(/g)].map((m) => m[1]!);
      const entries: ChildNameEntry[] = [];
      for (const m of childCode.matchAll(fieldRe)) {
        const fieldId = m[1]!;
        const argText = m[2] ?? '';
        const aliasMatch = /alias:\s*'([^']+)'/.exec(argText);
        // Angular resolves template bindings against the ALIAS when present,
        // the field id otherwise — the alias?? fieldId rule from
        // orchestrator_evidence.
        const publicName = aliasMatch ? aliasMatch[1]! : fieldId;
        entries.push({
          name: publicName,
          dispatchLinkage: emitFieldIds.includes(fieldId) ? fieldId : '',
        });
      }
      return entries.sort((a, b) => a.name.localeCompare(b.name));
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the child's opening tag text from the parent's emitted code,
 * scoped so a stray match elsewhere in the file cannot satisfy the contract.
 * Stops at the first bare `>` (not part of an arrow `=>`) or `/>` — a lazy
 * `[\s\S]*?` alone would stop inside an inline `($event) => { ... }` handler
 * body, which every non-Vue/Angular target's listener callback contains.
 */
function extractOpeningTag(parentCode: string, tag: string, target: Target): string {
  const re = new RegExp(`<${escapeRegExp(tag)}\\b[\\s\\S]*?(?:/>|(?<!=)>)`);
  const m = re.exec(parentCode);
  if (!m) {
    throw new Error(`[${target}] could not locate opening tag <${tag}> in parent code:\n${parentCode}`);
  }
  return m[0];
}

/**
 * Extract the parent's listener-registration names for the composed child,
 * scoped to the child's own opening tag.
 */
export function extractParentBoundNames(
  parentCode: string,
  childTag: string,
  target: Target,
): string[] {
  const tagText = extractOpeningTag(parentCode, childTag, target);
  switch (target) {
    case 'react':
    case 'solid':
      return [...tagText.matchAll(/(on[A-Za-z0-9]+)=\{/g)].map((m) => m[1]!).sort();
    case 'svelte':
      return [...tagText.matchAll(/(on[a-z0-9]+)=\{/g)].map((m) => m[1]!).sort();
    case 'vue':
      return [...tagText.matchAll(/@([a-zA-Z0-9-]+)=/g)].map((m) => m[1]!).sort();
    case 'lit':
      return [...tagText.matchAll(/@([a-zA-Z0-9-]+)=\$\{/g)].map((m) => m[1]!).sort();
    case 'angular':
      return [...tagText.matchAll(/\((\w+)\)=/g)].map((m) => m[1]!).sort();
  }
}

/**
 * The per-target agreement normalizer — the place where "agrees under that
 * target's own event mechanism" is encoded.
 *
 * react, solid, svelte, lit, angular → IDENTITY. These five resolve the name
 * by exact string match (a JSX/Svelte prop key, a case-sensitive
 * `addEventListener`, an Angular output public name), so anything less than
 * identity would not be the real contract — and identity is precisely what
 * both shipped bugs (Lit 82918527, Angular 9d651e12) violated.
 *
 * vue → camelize (strip separators, upper-case the following letter). Vue's
 * runtime normalizes an emitted name and a template binding to the same
 * camelCase handler prop, so `emit('itemActivated')` and `@item-activated`
 * legitimately agree without being string-equal. Encoding this as identity
 * would be a false failure; encoding the other five as camelize would be a
 * false pass that hides exactly the class of bug this suite exists to catch.
 */
export function canonicalize(name: string, target: Target): string {
  if (target !== 'vue') return name;
  return name.replace(/[-_]([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * The authored-name provenance normalizer: strip a leading `on` (case
 * insensitive), remove `-`/`_`/whitespace separators, lower-case the rest.
 * `onItemActivated`, `item-activated`, `onitemactivated`, `itemActivated`
 * all reduce to `itemactivated`.
 */
export function stem(name: string): string {
  const withoutOn = /^on/i.test(name) ? name.slice(2) : name;
  return withoutOn.replace(/[-_\s]/g, '').toLowerCase();
}
