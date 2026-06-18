/**
 * shell.ts — Plan 04-02 Task 2 (React target); Phase 06.1 Plan 01 Task 2
 * rearchitecture.
 *
 * Composes the .tsx file by anchoring `magic-string`'s MagicString at the
 * original `.rozie` source bytes and using `ms.overwrite(...)` over the
 * `<rozie>` envelope's byte range with the entire React module body
 * (Phase 06.1 P1, DX-04). Per-expression accuracy inside the script body
 * lands in P2 via @babel/generator's child sourcemap chained through
 * composeMaps().
 *
 * Returning a `BuildShellResult` (not a plain MagicString) lets `emitReact`
 * surface the byte-anchored map and the script-body output offset for P2's
 * `composeMaps()` integration.
 *
 * NO `import React from 'react'` line is ever generated (D-68 automatic JSX
 * runtime). The function return type uses `JSX.Element` (no type-only import
 * required, more portable across tsconfig).
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { BlockMap } from '../../../../core/src/ast/types.js';

export interface ShellParts {
  componentName: string;
  /** `interface FooProps {...}` from emitPropsInterface */
  propsInterface: string;
  /** `import { useState, ... } from 'react';\n` (or empty) */
  reactImports: string;
  /** `import type { ReactNode } from 'react';\n` line (or empty) — Plan 04-03 */
  reactTypeImports?: string;
  /** `import { useControllableState, ... } from '@rozie/runtime-react';\n` (or empty) */
  runtimeImports: string;
  /**
   * Portal-slot primitive (Spike 003) — `import { createRoot, type Root } from 'react-dom/client';\n`
   * line. Empty/undefined when the component has no portal slots.
   */
  portalImport?: string;
  /**
   * Spike 001 B1 — user-authored `<script>` `ImportDeclaration` statements
   * rendered as a string by emitScript. Placed AFTER target/runtime/CSS
   * imports and AFTER the component-imports block, but BEFORE the blank line
   * that separates imports from the interface declaration. Empty when no
   * user imports exist.
   */
  userImports?: string;
  /**
   * Quick task 260521-mj9 — author-declared `<script lang="ts">`
   * statement-position `interface` / `type` declarations, rendered as strings
   * by emitScript. Emitted at MODULE scope, immediately after the imports and
   * BEFORE the slot-context interfaces and the props interface — mirroring
   * Angular/Lit. Without this hoist a custom prop type (`kind?: Kind`)
   * referenced from the module-scope props interface fails with TS2304.
   * Empty/undefined for an untyped `<script>`.
   */
  hoistedTypeDecls?: string[];
  /** `import styles from './Foo.module.css';` or null (Plan 04-05 wires) */
  cssModuleImport: string | null;
  /** `import './Foo.global.css';` or null (Plan 04-05 wires) */
  globalCssImport: string | null;
  /**
   * Standalone interface declarations for slot-context types (Plan 04-03).
   * Each entry is a complete `interface XCtx { ... }` block. Goes BEFORE
   * the props interface.
   */
  ctxInterfaces?: string[];
  /**
   * Top-of-component-body lines (Plan 04-03):
   *   - lifted default-content functions like `function __defaultChildren(ctx) { ... }`
   *   - modifier-helper wraps like `const _rozieDebouncedSearch = useDebouncedCallback(...)`
   * Each entry is a complete declaration. Goes AFTER ctxInterfaces and
   * BEFORE the props interface (top-of-file constants).
   *
   * NOTE: in v1 we place these BEFORE the props interface so they sit at
   * the module top alongside other top-of-file declarations. The exception
   * is modifier-helper wraps that depend on hooks (e.g., useDebouncedCallback)
   * — these need to live INSIDE the function body. This v1 emits BOTH classes
   * at the module top; Plan 04-04 will refine to split.
   */
  scriptInjections?: string[];
  /** Body of the function above the `return ( <JSX> );`. */
  script: string;
  /**
   * Plan 04-04 — `<listeners>`-block useEffect / useOutsideClick blocks.
   * Placed AFTER `scriptInjections` so listener wrapper consts (which live in
   * `scriptInjections`) are in scope when the useEffect attaches them. Layout:
   *   hookSection → userArrowsSection (`script`)
   *     → wrapper consts (`scriptInjections`)
   *     → listener useEffects (`listenerEffects`)
   *     → return JSX
   */
  listenerEffects?: string;
  /**
   * When true, the function parameter is named `_props` (instead of `props`)
   * because the script body rebinds `props` to a defaults-merged version.
   * emitScript sets this whenever any non-model prop has a declared default.
   */
  hasPropsDefaults?: boolean;
  /**
   * Phase 21 ($expose, REQ-5, D-03) — names of the exposed `<script>`
   * functions, in source order. PRESENCE (length > 0) is the gate that flips
   * the function framing from `export default function Foo(props)` to the
   * `const Foo = forwardRef<FooHandle, FooProps>(function Foo(props, ref) {...});
   * export default Foo;` shape. Empty/undefined → byte-identical plain shape.
   */
  exposeNames?: string[] | undefined;
  /**
   * Phase 21 ($expose, REQ-10) — the inline `interface <Name>Handle {...}`
   * (from `synthesizeHandleType`, WITHOUT `export`), rendered immediately after
   * the props interface. Present iff `exposeNames` is non-empty.
   */
  handleInterface?: string | undefined;
  /**
   * Phase 21 ($expose) — the `useImperativeHandle(ref, () => ({ a, b }), []);`
   * line, appended inside the function body after the script + listenerEffects
   * but BEFORE `return (`. Present iff `exposeNames` is non-empty.
   */
  imperativeHandleBlock?: string | undefined;
  /** JSX body string (e.g., '<div>...</div>' or '(\n  <div>...</div>\n)') */
  jsx: string;
  /**
   * Phase 36 ($provide) — `<__ctx_<key>.Provider value={…}>` open tags,
   * OUTERMOST key first (nested for multiple keys). When non-empty, the JSX
   * payload (the `jsxIndented` body ONLY) is wrapped:
   * `providerOpen.join('') + jsxIndented + providerClose.join('')`. The
   * `return (` line and the `$expose` forwardRef close-tail are left
   * BYTE-UNTOUCHED (Pitfall 3 — a `$provide`+`$expose` component must still
   * emit a valid forwardRef). Empty/undefined when no `$provide`.
   */
  providerOpen?: string[];
  /**
   * Phase 36 ($provide) — `</__ctx_<key>.Provider>` close tags, in REVERSE
   * order so the nesting balances against `providerOpen`. Empty/undefined when
   * no `$provide`.
   */
  providerClose?: string[];
  /**
   * Phase 06.1 Plan 01: original `.rozie` source text — anchors the MagicString.
   */
  rozieSource: string;
  /**
   * Phase 06.1 Plan 01: block byte offsets from splitBlocks() — used to
   * anchor the React module's overwrite range at the `<rozie>` envelope.
   */
  blockOffsets: BlockMap;
  /**
   * Phase 06.1 P2 (D-101): per-expression child sourcemap from emitScript;
   * pass-through to BuildShellResult for composeMaps() consumption.
   */
  scriptMap?: EncodedSourceMap | null;
  /**
   * Number of hook-section statement lines (from emitScript.hookSectionLines).
   * Used to compute where userArrowsSection starts in the output so the script
   * source map can be line-adjusted correctly.
   */
  hookSectionLines?: number;
  /**
   * Phase 06.2 P2 (D-118): synthesized component-import lines for the
   * top-of-file imports section. Each line is
   * `import {LocalName} from '{rewrittenPath}';\n` (newline-terminated; the
   * helper joins them with `\n` and adds a trailing `\n` so concatenation
   * with sibling import sections stays clean).
   *
   * Per RESEARCH Pitfall 7, React's named-function declaration shape
   * supports self-reference natively — the `localName === ir.name` self-entry
   * is filtered out by emitReact BEFORE this string is built (no separate
   * `hasSelfReference` flag needed; the function-declaration scope handles it).
   *
   * Empty/undefined when no `<components>` block was authored OR every
   * entry was a self-entry that got filtered.
   */
  componentImportsBlock?: string;
}

/**
 * Phase 06.1 Plan 01 D-101: buildShell return shape carries both the
 * byte-anchored MagicString AND the script-body offset within the rendered
 * shell so P2's composeMaps() can chain @babel/generator's per-expression
 * child map at the correct output position.
 */
export interface BuildShellResult {
  /** MagicString anchored to rozieSource with whole-module overwrite + outer-region remove. */
  ms: MagicString;
  /** Byte offset within ms.toString() where the React function body begins. */
  scriptOutputOffset: number;
  /**
   * 0-indexed line offset of the user-authored statements within the tsx output.
   * Computed right before the script body is appended, accounting for the
   * module header and hookSection lines. Used by composeMaps to shift the
   * @babel/generator script map so it references tsx output lines, not script-body lines.
   */
  userCodeLineOffset: number;
  /**
   * Phase 06.1 P2 (D-101): pass-through of emitScript's per-expression child
   * map. composeMaps() chains this into the shell map at scriptOutputOffset.
   * null when no child map produced (D-102 fallback).
   */
  scriptMap: EncodedSourceMap | null;
}

export function buildShell(parts: ShellParts): BuildShellResult {
  const blocks = parts.blockOffsets;

  // Back-compat fallback: when rozieSource is empty (old callers without
  // opts.source / opts.blockOffsets), construct the module body on an empty
  // MagicString. This preserves pre-Phase-06.1 behavior.
  if (parts.rozieSource.length === 0 || !blocks.rozie) {
    return buildShellLegacy(parts);
  }

  const ms = new MagicString(parts.rozieSource);

  // Compose the entire React module as a single string, then overwrite the
  // <rozie> envelope's byte range with it. This anchors the React output at
  // the `<rozie>` start byte; per-block accuracy inside the script body
  // lands in P2 via @babel/generator sourceMaps:true. P1's contribution:
  // stack traces resolve to "somewhere inside <rozie>" rather than line 1
  // col 0.
  const moduleParts: string[] = [];

  if (parts.reactImports.length > 0) moduleParts.push(parts.reactImports);
  if (parts.reactTypeImports && parts.reactTypeImports.length > 0)
    moduleParts.push(parts.reactTypeImports);
  if (parts.portalImport && parts.portalImport.length > 0)
    moduleParts.push(parts.portalImport);
  if (parts.runtimeImports.length > 0) moduleParts.push(parts.runtimeImports);
  if (parts.cssModuleImport !== null) moduleParts.push(parts.cssModuleImport + '\n');
  if (parts.globalCssImport !== null) moduleParts.push(parts.globalCssImport + '\n');
  // Phase 06.2 P2 (D-118): user-component imports (PascalCase, ext-omitted).
  if (parts.componentImportsBlock && parts.componentImportsBlock.length > 0) {
    moduleParts.push(parts.componentImportsBlock);
  }
  // Spike 001 B1 — user-authored `<script>` imports, AFTER target/runtime/CSS/
  // component imports but BEFORE the blank-line separator.
  if (parts.userImports && parts.userImports.length > 0) {
    moduleParts.push(parts.userImports);
  }

  // Blank line between imports and interface (only if any imports).
  if (
    parts.reactImports.length > 0 ||
    (parts.reactTypeImports && parts.reactTypeImports.length > 0) ||
    parts.runtimeImports.length > 0 ||
    parts.cssModuleImport !== null ||
    parts.globalCssImport !== null ||
    (parts.componentImportsBlock !== undefined && parts.componentImportsBlock.length > 0) ||
    (parts.userImports !== undefined && parts.userImports.length > 0)
  ) {
    moduleParts.push('\n');
  }

  // Quick task 260521-mj9 — author-declared `<script lang="ts">` `interface` /
  // `type` declarations, hoisted to MODULE scope above the props interface so
  // a custom prop type referenced from `interface FooProps` resolves.
  if (parts.hoistedTypeDecls && parts.hoistedTypeDecls.length > 0) {
    for (const decl of parts.hoistedTypeDecls) {
      moduleParts.push(decl);
      moduleParts.push('\n\n');
    }
  }

  // Slot-context interfaces — Plan 04-03 — BEFORE the props interface.
  if (parts.ctxInterfaces && parts.ctxInterfaces.length > 0) {
    for (const iface of parts.ctxInterfaces) {
      moduleParts.push(iface);
      moduleParts.push('\n\n');
    }
  }

  // Props interface.
  moduleParts.push(parts.propsInterface);
  moduleParts.push('\n\n');

  // Phase 21 ($expose, REQ-10) — inline `interface <Name>Handle {...}`,
  // rendered immediately after the props interface so the
  // `forwardRef<<Name>Handle, <Name>Props>` generic + the useImperativeHandle
  // factory both resolve it. Only present when exposeNames is non-empty.
  const hasExpose = (parts.exposeNames?.length ?? 0) > 0;
  if (hasExpose && parts.handleInterface && parts.handleInterface.length > 0) {
    moduleParts.push(parts.handleInterface);
    moduleParts.push('\n\n');
  }

  // Top-of-file scriptInjections that are NOT hooks (default-content lifts).
  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const moduleTop = parts.scriptInjections.filter((s) =>
      s.startsWith('function '),
    );
    for (const inj of moduleTop) {
      moduleParts.push(inj);
      moduleParts.push('\n\n');
    }
  }

  // Function declaration. Record the byte offset of the first byte of the
  // function body (after `export default function Name(...): JSX.Element {\n`)
  // for P2 composeMaps consumption.
  const propsParam = parts.hasPropsDefaults ? '_props' : 'props';
  // Phase 21 ($expose, REQ-5, D-03) — when exposed, wrap in forwardRef:
  //   const Foo = forwardRef<FooHandle, FooProps>(function Foo(props, ref): JSX.Element {
  // and emit `export default Foo;` as the closing line (see JSX-body section).
  // When NOT exposed, the plain `export default function Foo(props): JSX.Element {`
  // shape is emitted BYTE-FOR-BYTE unchanged.
  const functionSignature = hasExpose
    ? `const ${parts.componentName} = forwardRef<${parts.componentName}Handle, ${parts.componentName}Props>(function ${parts.componentName}(${propsParam}: ${parts.componentName}Props, ref): JSX.Element {\n`
    : `export default function ${parts.componentName}(${propsParam}: ${parts.componentName}Props): JSX.Element {\n`;

  const preBodyLength = moduleParts.join('').length;
  moduleParts.push(functionSignature);
  const scriptOutputOffset = preBodyLength + functionSignature.length;

  // Compute where user-authored statements start in the output (0-indexed lines).
  // This is used by composeMaps to shift the @babel/generator script map.
  // We count newlines in everything assembled so far (after the function open brace),
  // then add hookSection lines + 1 blank line separator (if hookSection is non-empty).
  const preScriptNewlines = (moduleParts.join('').match(/\n/g) ?? []).length;
  const hookSectionLines = parts.hookSectionLines ?? 0;
  // When hookSection is non-empty, a '\n\n' separator precedes userArrowsSection,
  // producing hookSectionLines statement lines + 1 blank line before user code.
  const userCodeLineOffset = preScriptNewlines + (hookSectionLines > 0 ? hookSectionLines + 1 : 0);

  // Script body — indented 2 spaces per line.
  if (parts.script.trim().length > 0) {
    const indented = parts.script
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    moduleParts.push(indented);
    moduleParts.push('\n\n');
  }

  // In-function-body scriptInjections (hook-wraps).
  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const inFn = parts.scriptInjections.filter((s) => !s.startsWith('function '));
    for (const inj of inFn) {
      const indented = inj
        .split('\n')
        .map((line) => (line.length > 0 ? '  ' + line : line))
        .join('\n');
      moduleParts.push(indented);
      moduleParts.push('\n');
    }
    if (inFn.length > 0) moduleParts.push('\n');
  }

  // Plan 04-04 — listener-block useEffect / useOutsideClick blocks.
  if (parts.listenerEffects && parts.listenerEffects.trim().length > 0) {
    const indented = parts.listenerEffects
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    moduleParts.push(indented);
    moduleParts.push('\n\n');
  }

  // Phase 21 ($expose) — `useImperativeHandle(ref, () => ({ a, b }), []);`,
  // appended after the script body + any listenerEffects but BEFORE `return (`.
  // The exposed functions are user `<script>` arrows/functions already emitted
  // into the body above, so they are in scope here.
  if (hasExpose && parts.imperativeHandleBlock && parts.imperativeHandleBlock.length > 0) {
    // 260618-ao9 — the handle block is now multi-line (useRef mirror + sync +
    // useImperativeHandle), so indent PER LINE, not just the first line.
    const indented = parts.imperativeHandleBlock
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    moduleParts.push(indented + '\n\n');
  }

  // JSX body — wrap in `return ( ... );`.
  const jsxIndented = parts.jsx
    .split('\n')
    .map((line) => (line.length > 0 ? '    ' + line : line))
    .join('\n');
  moduleParts.push('  return (\n');
  // Phase 36 ($provide) — wrap ONLY the jsxIndented payload in the
  // `<C.Provider value={…}>` subtree(s). The `return (` line above and the
  // `$expose` forwardRef close-tail below are left BYTE-UNTOUCHED so a
  // component that BOTH `$provide`s AND `$expose`s still closes its forwardRef
  // correctly (Pitfall 3). Provider tags are indented to the same column as the
  // payload so the emitted JSX stays well-formed.
  moduleParts.push(wrapWithProviders(jsxIndented, parts));
  // Phase 21 ($expose) — close the forwardRef call + emit the default export
  // when exposed; otherwise close the plain function declaration byte-for-byte.
  if (hasExpose) {
    moduleParts.push('\n  );\n});\n');
    moduleParts.push(`export default ${parts.componentName};\n`);
  } else {
    moduleParts.push('\n  );\n}\n');
  }

  const moduleSource = moduleParts.join('');

  // Anchor the entire React module at the `<rozie>` envelope's byte range.
  const anchorStart = blocks.rozie.loc.start;
  const anchorEnd = blocks.rozie.loc.end;
  ms.overwrite(anchorStart, anchorEnd, moduleSource);

  // Remove pre-envelope and post-envelope characters (e.g. leading whitespace,
  // trailing newlines, HTML comments outside the envelope).
  if (anchorStart > 0) ms.remove(0, anchorStart);
  if (anchorEnd < parts.rozieSource.length)
    ms.remove(anchorEnd, parts.rozieSource.length);

  return { ms, scriptOutputOffset, userCodeLineOffset, scriptMap: parts.scriptMap ?? null };
}

/**
 * Legacy fallback path — empty rozieSource or missing blockOffsets.
 * Constructs the React module from scratch on an empty MagicString,
 * preserving pre-Phase-06.1 behavior so old callers (tests that don't
 * thread opts.source through) keep working.
 */
function buildShellLegacy(parts: ShellParts): BuildShellResult {
  const ms = new MagicString('');

  // Imports section.
  if (parts.reactImports.length > 0) ms.append(parts.reactImports);
  if (parts.reactTypeImports && parts.reactTypeImports.length > 0)
    ms.append(parts.reactTypeImports);
  if (parts.portalImport && parts.portalImport.length > 0)
    ms.append(parts.portalImport);
  if (parts.runtimeImports.length > 0) ms.append(parts.runtimeImports);
  if (parts.cssModuleImport) ms.append(parts.cssModuleImport + '\n');
  if (parts.globalCssImport) ms.append(parts.globalCssImport + '\n');
  // Phase 06.2 P2 (D-118): user-component imports (PascalCase, ext-omitted).
  if (parts.componentImportsBlock && parts.componentImportsBlock.length > 0) {
    ms.append(parts.componentImportsBlock);
  }
  // Spike 001 B1 — user-authored `<script>` imports.
  if (parts.userImports && parts.userImports.length > 0) {
    ms.append(parts.userImports);
  }

  if (
    parts.reactImports.length > 0 ||
    (parts.reactTypeImports && parts.reactTypeImports.length > 0) ||
    parts.runtimeImports.length > 0 ||
    parts.cssModuleImport ||
    parts.globalCssImport ||
    (parts.componentImportsBlock !== undefined && parts.componentImportsBlock.length > 0) ||
    (parts.userImports !== undefined && parts.userImports.length > 0)
  ) {
    ms.append('\n');
  }

  // Quick task 260521-mj9 — module-scope hoisted `<script lang="ts">` types.
  if (parts.hoistedTypeDecls && parts.hoistedTypeDecls.length > 0) {
    for (const decl of parts.hoistedTypeDecls) {
      ms.append(decl);
      ms.append('\n\n');
    }
  }

  if (parts.ctxInterfaces && parts.ctxInterfaces.length > 0) {
    for (const iface of parts.ctxInterfaces) {
      ms.append(iface);
      ms.append('\n\n');
    }
  }

  ms.append(parts.propsInterface);
  ms.append('\n\n');

  // Phase 21 ($expose, REQ-10) — inline handle interface after the props
  // interface (legacy path mirror).
  const hasExpose = (parts.exposeNames?.length ?? 0) > 0;
  if (hasExpose && parts.handleInterface && parts.handleInterface.length > 0) {
    ms.append(parts.handleInterface);
    ms.append('\n\n');
  }

  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const moduleTop = parts.scriptInjections.filter((s) => s.startsWith('function '));
    for (const inj of moduleTop) {
      ms.append(inj);
      ms.append('\n\n');
    }
  }

  const propsParam = parts.hasPropsDefaults ? '_props' : 'props';
  // Phase 21 ($expose, REQ-5, D-03) — forwardRef framing when exposed (legacy
  // path mirror); plain `export default function` shape byte-identical otherwise.
  ms.append(
    hasExpose
      ? `const ${parts.componentName} = forwardRef<${parts.componentName}Handle, ${parts.componentName}Props>(function ${parts.componentName}(${propsParam}: ${parts.componentName}Props, ref): JSX.Element {\n`
      : `export default function ${parts.componentName}(${propsParam}: ${parts.componentName}Props): JSX.Element {\n`,
  );

  if (parts.script.trim().length > 0) {
    const indented = parts.script
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented);
    ms.append('\n\n');
  }

  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const inFn = parts.scriptInjections.filter((s) => !s.startsWith('function '));
    for (const inj of inFn) {
      const indented = inj
        .split('\n')
        .map((line) => (line.length > 0 ? '  ' + line : line))
        .join('\n');
      ms.append(indented);
      ms.append('\n');
    }
    if (inFn.length > 0) ms.append('\n');
  }

  if (parts.listenerEffects && parts.listenerEffects.trim().length > 0) {
    const indented = parts.listenerEffects
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented);
    ms.append('\n\n');
  }

  // Phase 21 ($expose) — useImperativeHandle before `return (` (legacy mirror).
  if (hasExpose && parts.imperativeHandleBlock && parts.imperativeHandleBlock.length > 0) {
    // 260618-ao9 — multi-line handle block, indent per line (legacy mirror).
    const indented = parts.imperativeHandleBlock
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented + '\n\n');
  }

  const jsxIndented = parts.jsx
    .split('\n')
    .map((line) => (line.length > 0 ? '    ' + line : line))
    .join('\n');
  ms.append('  return (\n');
  // Phase 36 ($provide) — payload-only Provider wrap (legacy-path mirror).
  ms.append(wrapWithProviders(jsxIndented, parts));
  // Phase 21 ($expose) — close forwardRef + default export when exposed.
  if (hasExpose) {
    ms.append('\n  );\n});\n');
    ms.append(`export default ${parts.componentName};\n`);
  } else {
    ms.append('\n  );\n}\n');
  }

  return { ms, scriptOutputOffset: 0, userCodeLineOffset: 0, scriptMap: parts.scriptMap ?? null };
}

/**
 * Phase 36 ($provide) — wrap the already-indented JSX payload in the
 * `<C.Provider value={…}>` subtree(s). OUTERMOST key first in `providerOpen`,
 * reverse-order close tags in `providerClose`. Indented to the same 4-space
 * column as the payload so the JSX is well-formed. Returns `jsxIndented`
 * UNCHANGED when there are no providers (byte-identity guarantee, D-5) — this
 * is the ONLY mutation point; `return (` and the forwardRef close-tail are
 * never touched (Pitfall 3).
 */
function wrapWithProviders(jsxIndented: string, parts: ShellParts): string {
  const open = parts.providerOpen ?? [];
  const close = parts.providerClose ?? [];
  if (open.length === 0) return jsxIndented;
  const openLines = open.map((tag) => '    ' + tag).join('\n');
  const closeLines = close.map((tag) => '    ' + tag).join('\n');
  return openLines + '\n' + jsxIndented + '\n' + closeLines;
}
