#!/usr/bin/env node
// scripts/check-readme-jsx-props.mjs — quick-260903-qw5 (E5 / P-04).
//
// THE DEFECT: a README custom-render example that passes the bare SLOT name
// as a JSX attribute (`option={(…) => …}`) instead of the emitted component's
// actual render-prop name (`renderOption`). A reader who copy-pastes that
// example gets code that silently no-ops (React/Solid ignore an unknown prop)
// — never a compile error, so nothing catches it short of reading the
// generated `.d.ts`/`.tsx` by hand.
//
// THIS GATE closes that gap mechanically: for every `packages/ui/<family>/
// packages/{react,solid}` leaf that publishes both a `README.md` and a
// `src/`, it (a) parses every `src/*.d.ts` and `src/*.tsx` for `interface
// <Name>Props { … }` blocks and collects their DEPTH-1 member names only —
// a whole-file identifier search is NOT sufficient: a slot-param object
// literal nested inside a render-prop signature (e.g. `renderOption?:
// (params: { option: unknown; … }) => ReactNode`) contains the very
// identifier a bad example uses, so a naive substring/whole-file search
// false-negatives on exactly the leaf (combobox) this gate exists to catch;
// (b) scans the README for JSX attributes written with an inline arrow or
// object VALUE (the render-prop calling convention), and (c) reports any
// attribute name that is not a declared depth-1 Props member.
//
// EXTENSION (fullcalendar escapes, 2026-10): two more instances of the same
// silent-no-op class slipped past the README-only React/Solid sweep:
//
//   1. SVELTE leaves. A Svelte README used `oneventClick={…}` while the
//      compiled prop is all-lowercase `oneventclick` — Svelte 5 silently
//      ignores an unknown prop exactly like React/Solid do. So every
//      `packages/ui/<family>/packages/svelte` leaf is now swept too: the
//      depth-1 members of each `src/*.svelte` file's `interface Props { … }`
//      (or the inline type literal / named type annotating `$props()`) are
//      collected PER COMPONENT FILE, and every attribute on a `<Component …>`
//      tag whose name matches one of those files is checked when it is either
//      a render-shaped value (`name={(…` / `name={{…`) or ANY `on…=` handler.
//
//   2. DOCS-SITE pages. `docs/components/fullcalendar.md` showed the Solid
//      slot render props as `event={…}` while the compiled Solid prop is
//      `eventSlot`. So every `docs/components/*.md` page is swept: the page is
//      tied to a family (longest family-name filename prefix, overridden per
//      block by an `@rozie-ui/<family>-<target>` import), each fenced code
//      block (or each `// React` / `// Solid` comment-delimited segment of a
//      combined block) is assigned a target framework from — in order — a
//      segment marker comment, the fence language (`svelte` / `vue`), an
//      `@rozie-ui/<family>-<target>` import, a framework import (`solid-js`,
//      `react`, `svelte`, …), or the nearest preceding heading / bold label
//      naming exactly one framework. React/Solid segments are checked for
//      render-shaped attributes, Svelte segments for render-shaped AND
//      handler attributes, against that target leaf's per-component Props.
//      A segment whose target cannot be determined confidently is SKIPPED and
//      counted in the summary; Vue/Angular/Lit segments are out of scope.
//
// The docs + Svelte sweeps are TAG-AWARE: an attribute is only checked when
// it sits on an opening tag whose name resolves to a component of the target
// leaf (`<FullCalendar …>` → `FullCalendarProps` / `FullCalendar.svelte`), so
// handlers on native elements (`<button onclick={…}>`) and third-party
// components (`<Show when={…}>`) are never mistaken for Props members. When a
// Props interface inherits the host element's attributes (`extends Omit<…
// HTMLAttributes…>` / `SvelteHTMLElements[…]`), a standard DOM event handler
// (`onclick` / `onClick`) not in the `Omit<…>` key list is accepted as a
// forwarded host attribute.
//
// `KNOWN_UNFIXED` is a narrow, per-(family, target, attr[, source]) allowlist
// for bugs of this same class OUT of the current wave's fence. It is
// SELF-CLEARING: if an allowlisted entry stops reproducing (because someone
// fixed it), the gate fails loudly demanding the stale entry be removed — an
// allowlist must never quietly outlive the bug it was written to suppress.
//
// `--family <name>` restricts the sweep to one family (used by per-task
// verification during incremental fixes); no flag sweeps all families.
//
// Structure mirrors scripts/check-dep-drift.mjs and
// scripts/check-sidecar-staleness.mjs (the repo's other dependency-free
// `.mjs` gates): `import.meta.url` ROOT anchoring, clear exit-non-zero
// messaging, zero runtime dependencies.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_ROOT = join(ROOT, 'packages', 'ui');
const DOCS_COMPONENTS = join(ROOT, 'docs', 'components');

const TARGETS = ['react', 'solid'];
const ALL_LEAF_TARGETS = ['react', 'solid', 'svelte'];
// `rozie` = the authoring source itself; `html` fences carry Angular
// templates or Rozie markup (`r-model`, `@event`) — never React/Solid/Svelte.
const OUT_OF_SCOPE_TARGETS = new Set(['vue', 'angular', 'lit', 'rozie', 'html']);

// JSX attributes written with an inline arrow or object VALUE — the render-
// prop calling convention this gate is checking. A plain string/identifier
// attribute (`placeholder="…"`, `value={value}`) is not in scope: those are
// not render-prop slot examples and cannot carry this specific defect.
const JSX_RENDER_PROP_ATTR = /^\s+([a-zA-Z][A-Za-z0-9]*)=\{[({]/gm;

// Standard DOM event names (lowercase, no `on` prefix). Used ONLY to accept a
// handler attribute on a component whose Props inherits the host element's
// attributes — `<Combobox onclick={…}>` forwards to the root element.
const DOM_EVENTS = new Set(
  (
    'abort animationcancel animationend animationiteration animationstart auxclick beforeinput ' +
    'beforetoggle blur cancel canplay canplaythrough change click close compositionend ' +
    'compositionstart compositionupdate contextmenu copy cuechange cut dblclick drag dragend ' +
    'dragenter dragleave dragover dragstart drop durationchange emptied ended error focus focusin ' +
    'focusout formdata gotpointercapture input invalid keydown keypress keyup load loadeddata ' +
    'loadedmetadata loadstart lostpointercapture mousedown mouseenter mouseleave mousemove ' +
    'mouseout mouseover mouseup paste pause play playing pointercancel pointerdown pointerenter ' +
    'pointerleave pointermove pointerout pointerover pointerup progress ratechange reset resize ' +
    'scroll scrollend securitypolicyviolation seeked seeking select selectionchange selectstart ' +
    'slotchange stalled submit suspend timeupdate toggle touchcancel touchend touchmove ' +
    'touchstart transitioncancel transitionend transitionrun transitionstart volumechange ' +
    'waiting wheel'
  ).split(' '),
);

// Attributes the host framework itself consumes on ANY component — never
// Props members, never this defect.
const FRAMEWORK_INTRINSIC = {
  react: new Set(['key', 'ref', 'children']),
  solid: new Set(['ref', 'children']),
  svelte: new Set(['children']),
};
// Host-element attributes accepted when the Props inherit the root element's
// attributes (render-shaped `style={{…}}` etc.).
const DOM_HOST_ATTRS = new Set(['style', 'class', 'className', 'classList', 'id']);

/**
 * Out-of-wave same-bug-class instances, tracked here so the gate stays GREEN
 * repo-wide without silently losing the defect. Each entry must reproduce a
 * real mismatch every run — see the self-clearing check below.
 *
 * Shape: `{ family, target, attr, source? }` — `source` is `'readme'`
 * (default) or `'docs'`.
 */
const KNOWN_UNFIXED = [];

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Split an interface's interior text on top-level (brace-depth-0) `;`
 * separators and pull the leading identifier off each segment. Depth is
 * tracked ONLY on `{`/`}` — a nested object-literal type inside a render-prop
 * signature's params (`(params: { option: unknown; … })`) pushes depth to 1,
 * so the `;` separators INSIDE it are never mistaken for member boundaries.
 * Parens/brackets also count toward depth so a `,` inside a function type's
 * parameter list is never read as a member boundary; `,` at depth 0 splits
 * too (inline `$props()` type literals may be comma-separated).
 */
function collectDepth1Members(interiorText) {
  const members = [];
  let depth = 0;
  let current = '';
  for (const ch of interiorText) {
    if (ch === '{' || ch === '(' || ch === '[') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      depth--;
      current += ch;
      continue;
    }
    if ((ch === ';' || ch === ',') && depth === 0) {
      members.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) members.push(current);

  const names = [];
  for (const seg of members) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(?:readonly\s+)?([a-zA-Z_$][\w$]*)\??\s*:/);
    if (m) names.push(m[1]);
  }
  return names;
}

/** Brace-match the `{ … }` body starting at `openIdx` (index of `{`); return
 * the interior text and the index just past the closing brace. */
function braceBody(text, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
  }
  return { interior: text.slice(openIdx + 1, i - 1), end: i };
}

/** Summarise an `extends …` clause: does it inherit host-element attributes,
 * and which keys does its `Omit<…>` remove? */
function parseExtends(extendsText) {
  if (!extendsText) return { inheritsDom: false, omitted: new Set() };
  const inheritsDom = /HTMLAttributes|SvelteHTMLElements|HTMLElements|JSX\.|ComponentProps/.test(
    extendsText,
  );
  const omitted = new Set();
  for (const m of extendsText.matchAll(/['"]([^'"]+)['"]/g)) omitted.add(m[1]);
  return { inheritsDom, omitted };
}

/** Brace-match every `interface <Name>Props { … }` block in `fileText` and
 * return a Map of interface name -> { members, inheritsDom, omitted }. */
function extractPropsInterfaces(fileText, nameRe = /\w+Props/) {
  const text = stripComments(fileText);
  const results = new Map();
  // The optional `extends …` clause covers the typed-surface P3 shape
  // `interface XProps extends Omit<…HTMLAttributes<…>, …> {` (no braces inside).
  const re = new RegExp(
    `interface\\s+(${nameRe.source})\\b(?:\\s+extends\\s+([^{]*))?\\s*\\{`,
    'g',
  );
  let match;
  while ((match = re.exec(text))) {
    const name = match[1];
    const { interior } = braceBody(text, match.index + match[0].length - 1);
    results.set(name, { members: collectDepth1Members(interior), ...parseExtends(match[2]) });
  }
  return results;
}

/** Union of every `*Props` interface's depth-1 members declared anywhere in
 * a leaf's `src/*.d.ts` / `src/*.tsx` files. */
function declaredPropNames(srcDir) {
  const names = new Set();
  for (const info of jsxPropsByInterface(srcDir).values()) {
    for (const m of info.members) names.add(m);
  }
  return names;
}

/** Map interface name (`FullCalendarProps`) -> merged Props info across a
 * React/Solid leaf's `src/*.d.ts` / `src/*.tsx` files. */
function jsxPropsByInterface(srcDir) {
  const out = new Map();
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(d\.ts|tsx)$/.test(entry.name)) continue;
    const text = readFileSync(join(srcDir, entry.name), 'utf8');
    for (const [name, info] of extractPropsInterfaces(text)) {
      const prev = out.get(name);
      if (!prev) {
        out.set(name, {
          members: new Set(info.members),
          inheritsDom: info.inheritsDom,
          omitted: info.omitted,
        });
      } else {
        for (const m of info.members) prev.members.add(m);
        prev.inheritsDom ||= info.inheritsDom;
        for (const o of info.omitted) prev.omitted.add(o);
      }
    }
  }
  return out;
}

/** Component tag name -> Props info for a React/Solid leaf
 * (`<FullCalendar>` → `FullCalendarProps`). */
function jsxComponentProps(srcDir) {
  const byTag = new Map();
  for (const [name, info] of jsxPropsByInterface(srcDir)) {
    byTag.set(name.replace(/Props$/, ''), info);
  }
  return byTag;
}

/** Props info for one compiled `.svelte` component: `interface Props { … }`,
 * else the type annotating the `$props()` destructure (inline literal or a
 * named interface/type alias). */
function sveltePropsInfo(fileText) {
  const scripts = [...fileText.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const text = stripComments(scripts.join('\n'));
  const direct = extractPropsInterfaces(text, /Props/).get('Props');
  if (direct) return direct;

  const call = text.search(/\$props\s*\(\s*\)/);
  if (call === -1) return null;
  const before = text.slice(0, call);
  const named = before.match(/:\s*([A-Za-z_$][\w$]*)\s*=\s*$/);
  if (named) {
    const iface = extractPropsInterfaces(text, new RegExp(named[1])).get(named[1]);
    if (iface) return iface;
    const alias = new RegExp(`type\\s+${named[1]}\\s*=\\s*\\{`).exec(text);
    if (alias) {
      const { interior } = braceBody(text, alias.index + alias[0].length - 1);
      return { members: collectDepth1Members(interior), inheritsDom: false, omitted: new Set() };
    }
    return null;
  }
  const literalEnd = before.match(/\}\s*=\s*$/);
  if (!literalEnd) return null;
  // Walk back from the closing `}` of the inline type literal to its `{`.
  let i = before.length - literalEnd[0].length;
  let depth = 0;
  for (; i >= 0; i--) {
    if (before[i] === '}') depth++;
    else if (before[i] === '{') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (i < 0) return null;
  const { interior } = braceBody(before, i);
  return { members: collectDepth1Members(interior), inheritsDom: false, omitted: new Set() };
}

/** Component tag name -> Props info for a Svelte leaf (`<FullCalendar>` →
 * `src/FullCalendar.svelte`'s Props). */
function svelteComponentProps(srcDir) {
  const byTag = new Map();
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.svelte')) continue;
    const info = sveltePropsInfo(readFileSync(join(srcDir, entry.name), 'utf8'));
    if (!info) continue;
    byTag.set(entry.name.replace(/\.svelte$/, ''), {
      members: new Set(info.members),
      inheritsDom: info.inheritsDom,
      omitted: info.omitted,
    });
  }
  return byTag;
}

/** Every JSX attribute name in `readmeText` written with an inline arrow or
 * object value. */
function readmeRenderPropAttrs(readmeText) {
  const attrs = [];
  let match;
  JSX_RENDER_PROP_ATTR.lastIndex = 0;
  while ((match = JSX_RENDER_PROP_ATTR.exec(readmeText))) {
    attrs.push(match[1]);
  }
  return attrs;
}

// ---------------------------------------------------------------------------
// Tag-aware attribute scanner (docs + Svelte sweeps).
// ---------------------------------------------------------------------------

/** Skip a JS string/template starting at `i` (the quote); return the index
 * just past its end. */
function skipString(code, i) {
  const q = code[i];
  i++;
  while (i < code.length) {
    const c = code[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (q === '`' && c === '$' && code[i + 1] === '{') {
      i = skipBraces(code, i + 1);
      continue;
    }
    if (c === q) return i + 1;
    if (q !== '`' && c === '\n') return i; // unterminated — bail at EOL
    i++;
  }
  return i;
}

/** Skip a balanced `{ … }` starting at `i` (the `{`), honouring JS strings and
 * comments; JSX text inside (`<p>Don't</p>`) is handled by treating a quote
 * that follows `>` + text as text, not a string opener. Returns the index
 * just past the matching `}`, or -1 if unbalanced. */
function skipBraces(code, i) {
  let depth = 0;
  let inJsxText = false;
  for (; i < code.length; i++) {
    const c = code[i];
    if (c === '{') {
      depth++;
      inJsxText = false;
      continue;
    }
    if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
      continue;
    }
    if (c === '>') {
      // Entering JSX element children text (`<span>text</span>`), unless this
      // is an arrow `=>` or a comparison.
      if (code[i - 1] !== '=' && code[i - 1] !== '-') inJsxText = true;
      continue;
    }
    if (c === '<') {
      inJsxText = false;
      continue;
    }
    if (inJsxText) continue;
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(code, i) - 1;
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i);
      i = nl === -1 ? code.length : nl;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 1;
    }
  }
  return -1;
}

/**
 * Find every `<PascalCase …>` opening tag in `code` and parse its attributes.
 * Returns `[{ tag, attrs: [{ name, offset, render }] }]` where `render` is
 * true for an inline arrow / object value (`={(…`, `={{…`, `={x =>`).
 * Tags whose attribute list does not parse cleanly (TS generics such as
 * `Map<Foo, Bar>`, comparisons) are discarded.
 */
function scanComponentTags(code) {
  const tags = [];
  const re = /<([A-Z][\w$]*(?:\.[\w$]+)*)(?=[\s/>])/g;
  let m;
  while ((m = re.exec(code))) {
    const tag = m[1];
    let i = m.index + m[0].length;
    const attrs = [];
    let ok = false;
    while (i < code.length) {
      while (i < code.length && /\s/.test(code[i])) i++;
      const c = code[i];
      if (c === '>' || (c === '/' && code[i + 1] === '>')) {
        ok = true;
        break;
      }
      if (c === '{') {
        // Spread `{...rest}` / Svelte shorthand `{events}`.
        const end = skipBraces(code, i);
        if (end === -1) break;
        i = end;
        continue;
      }
      const nm = /^[A-Za-z_$:@#][\w$:.-]*/.exec(code.slice(i, i + 200));
      if (!nm) break;
      const name = nm[0];
      const offset = i;
      i += name.length;
      let j = i;
      while (j < code.length && /[ \t]/.test(code[j])) j++;
      if (code[j] !== '=') {
        attrs.push({ name, offset, render: false, valued: false });
        continue;
      }
      j++;
      while (j < code.length && /[ \t]/.test(code[j])) j++;
      const v = code[j];
      if (v === '"' || v === "'") {
        i = skipString(code, j);
        attrs.push({ name, offset, render: false, valued: true });
        continue;
      }
      if (v === '{') {
        const end = skipBraces(code, j);
        if (end === -1) break;
        const inner = code.slice(j + 1, end - 1);
        const render =
          /^[({]/.test(inner) || /^\s*(?:async\s+)?[\w$]+\s*=>/.test(inner) || /^\s*\(/.test(inner);
        attrs.push({ name, offset, render, valued: true });
        i = end;
        continue;
      }
      break;
    }
    if (ok) tags.push({ tag, attrs });
  }
  return tags;
}

/** Should attribute `attr` on a `target` component be validated? */
function attrInScope(target, attr) {
  if (attr.name.includes(':') || attr.name.includes('-') || attr.name.includes('.')) return false;
  if (/^[@#]/.test(attr.name)) return false;
  if (target === 'svelte') return attr.render || (/^on[a-z]/i.test(attr.name) && attr.valued);
  return attr.render;
}

/** Is `name` acceptable on a component with Props `info` for `target`? */
function attrAccepted(target, name, info) {
  if (info.members.has(name)) return true;
  if (FRAMEWORK_INTRINSIC[target]?.has(name)) return true;
  if (!info.inheritsDom || info.omitted.has(name)) return false;
  if (DOM_HOST_ATTRS.has(name)) return true;
  const ev = /^on(.+)$/.exec(name);
  if (!ev) return false;
  if (target === 'svelte') {
    // Svelte 5 DOM handlers are all-lowercase (`onclick`).
    return ev[1] === ev[1].toLowerCase() && DOM_EVENTS.has(ev[1]);
  }
  // React/Solid DOM handlers are camelCase (`onClick`, `onKeyDown`).
  return /^[A-Z]/.test(ev[1]) && DOM_EVENTS.has(ev[1].toLowerCase());
}

function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/** Fenced code blocks: `[{ lang, startLine (1-based, fence line), body,
 * bodyOffset, infoFrameworks, contextFrameworks }]`. `infoFrameworks` are
 * named in the fence info string (VitePress code-group title: ```tsx
 * [Solid]```); `contextFrameworks` are named by the nearest preceding
 * heading, or — taking precedence — by the BOLD span of a label line
 * (`**Solid** (render prop):`, `**React / Solid**`) appearing after the
 * previous fence and heading. A bold paragraph lead that names no framework
 * is not a label. */
function fencedBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let offset = 0;
  let heading = []; // frameworks named by the nearest heading
  let label = null; // frameworks named by a bold label since the last fence
  let open = null;
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln];
    const lineStart = offset;
    offset += line.length + 1;
    if (open) {
      if (new RegExp(`^\\s*${open.fence[0]}{${open.fence.length},}\\s*$`).test(line)) {
        open.body = text.slice(open.bodyOffset, lineStart);
        blocks.push(open);
        open = null;
        label = null;
      }
      continue;
    }
    const f = /^\s*(`{3,}|~{3,})\s*([\w-]*)(.*)$/.exec(line);
    if (f) {
      open = {
        fence: f[1],
        lang: f[2].toLowerCase(),
        startLine: ln + 1,
        bodyOffset: offset,
        infoFrameworks: frameworksNamed((/\[([^\]]*)\]/.exec(f[3]) ?? ['', ''])[1]),
        contextFrameworks: label ?? heading,
      };
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      heading = frameworksNamed(line);
      label = null;
      continue;
    }
    const bold = /^\s*\*\*(.+?)\*\*/.exec(line);
    if (bold) {
      const named = frameworksNamed(bold[1]);
      if (named.length > 0) label = named;
    }
  }
  return blocks;
}

function frameworksNamed(line) {
  const found = new Set();
  for (const m of line.matchAll(/\b(React|Solid|Svelte|Vue|Angular|Lit)\b/g)) {
    found.add(m[1].toLowerCase());
  }
  return [...found];
}

/** Split a block body into segments at framework-marker comment lines
 * (`// React`, `// Solid`, `<!-- Svelte -->`). */
function blockSegments(body) {
  const segs = [];
  const re = /^[ \t]*(?:\/\/|<!--|\{\/\*)[ \t]*(React|Solid|Svelte|Vue|Angular|Lit)\b.*$/gim;
  let last = 0;
  let marker = null;
  let m;
  while ((m = re.exec(body))) {
    if (m.index > last || marker)
      segs.push({ marker, text: body.slice(last, m.index), offset: last });
    marker = m[1].toLowerCase();
    last = m.index + m[0].length;
  }
  segs.push({ marker, text: body.slice(last), offset: last });
  return segs.filter((s) => s.text.trim());
}

/** A framework list a code segment can be validated against: one framework,
 * or the React+Solid pair (a `**React / Solid**` label asserts the same JSX
 * snippet is valid on both, so it is checked against BOTH leaves). Any other
 * multi-framework list is ambiguous → `null`. */
function confidentTargets(list) {
  if (list.length === 1) return list;
  if (list.length === 2 && list.includes('react') && list.includes('solid')) return list;
  return null;
}

/** Resolve a segment's target framework(s) and (optionally) family override.
 * `targets` is `null` when the target cannot be determined confidently. */
function resolveSegment(seg, block, familyNames) {
  let family = null;
  const fromRozie = new Set();
  for (const m of seg.text.matchAll(
    /['"]@rozie-ui\/([a-z0-9-]+)-(react|solid|svelte|vue|angular|lit)(?:\/[\w./-]*)?['"]/g,
  )) {
    if (familyNames.has(m[1])) family = m[1];
    fromRozie.add(m[2]);
  }
  const done = (targets) => ({ targets, family });
  if (seg.marker) return done([seg.marker]);
  if (block.infoFrameworks.length > 0) return done(confidentTargets(block.infoFrameworks));
  if (['svelte', 'vue', 'rozie', 'html'].includes(block.lang)) return done([block.lang]);
  if (fromRozie.size > 0) return done(fromRozie.size === 1 ? [...fromRozie] : null);
  const fw = new Set();
  if (/from\s+['"]solid-js(?:\/[\w-]+)?['"]/.test(seg.text)) fw.add('solid');
  if (/from\s+['"]react(?:-dom)?(?:\/[\w-]+)?['"]/.test(seg.text)) fw.add('react');
  if (/from\s+['"]svelte(?:\/[\w-]+)?['"]/.test(seg.text)) fw.add('svelte');
  if (/from\s+['"]@angular\//.test(seg.text)) fw.add('angular');
  if (/from\s+['"]lit(?:\/[\w-]+)?['"]/.test(seg.text)) fw.add('lit');
  // Framework-exclusive primitives used without an import line.
  if (/\buse(?:State|Ref|Effect|Memo|Callback|Reducer|Context)\s*[<(]/.test(seg.text))
    fw.add('react');
  if (/\bcreate(?:Signal|Effect|Memo|Store|Resource)\s*[<(]/.test(seg.text)) fw.add('solid');
  if (fw.size > 0) return done(fw.size === 1 ? [...fw] : null);
  if (block.contextFrameworks.length > 0) return done(confidentTargets(block.contextFrameworks));
  return done(null);
}

// ---------------------------------------------------------------------------
// Sweep discovery.
// ---------------------------------------------------------------------------

function findLeaves(familyFilter, targets = TARGETS) {
  const leaves = [];
  for (const familyEntry of readdirSync(UI_ROOT, { withFileTypes: true })) {
    if (!familyEntry.isDirectory()) continue;
    const family = familyEntry.name;
    if (familyFilter && family !== familyFilter) continue;
    for (const target of targets) {
      const leafDir = join(UI_ROOT, family, 'packages', target);
      const readmePath = join(leafDir, 'README.md');
      const srcDir = join(leafDir, 'src');
      if (!existsSync(readmePath) || !existsSync(srcDir)) continue;
      leaves.push({ family, target, readmePath, srcDir });
    }
  }
  return leaves;
}

/** Every family with at least one react/solid/svelte leaf `src/`. */
function allFamilies() {
  const fams = new Set();
  for (const e of readdirSync(UI_ROOT, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (ALL_LEAF_TARGETS.some((t) => existsSync(join(UI_ROOT, e.name, 'packages', t, 'src')))) {
      fams.add(e.name);
    }
  }
  return fams;
}

/** The family a docs page belongs to by filename (longest matching prefix). */
function pageFamily(fileName, familyNames) {
  const base = fileName.replace(/\.md$/, '');
  let best = null;
  for (const f of familyNames) {
    if ((base === f || base.startsWith(`${f}-`)) && (!best || f.length > best.length)) best = f;
  }
  return best;
}

const componentPropsCache = new Map();
function componentPropsFor(family, target) {
  const key = `${family}/${target}`;
  if (componentPropsCache.has(key)) return componentPropsCache.get(key);
  const srcDir = join(UI_ROOT, family, 'packages', target, 'src');
  let map = null;
  if (existsSync(srcDir)) {
    map = target === 'svelte' ? svelteComponentProps(srcDir) : jsxComponentProps(srcDir);
  }
  componentPropsCache.set(key, map);
  return map;
}

/** Check one chunk of component code against a leaf's per-component Props.
 * Returns `[{ attr, tag, offset }]` mismatches (offset relative to `code`). */
function checkTaggedCode(code, family, target) {
  const byTag = componentPropsFor(family, target);
  if (!byTag) return [];
  const bad = [];
  for (const { tag, attrs } of scanComponentTags(code)) {
    const info = byTag.get(tag);
    if (!info) continue; // not this leaf's component (native el / 3rd party)
    for (const attr of attrs) {
      if (!attrInScope(target, attr)) continue;
      if (attrAccepted(target, attr.name, info)) continue;
      bad.push({ attr: attr.name, tag, offset: attr.offset });
    }
  }
  return bad;
}

function main() {
  const args = process.argv.slice(2);
  const familyIdx = args.indexOf('--family');
  const familyFilter = familyIdx !== -1 ? args[familyIdx + 1] : null;

  const leaves = findLeaves(familyFilter);
  const svelteLeaves = findLeaves(familyFilter, ['svelte']);
  if (leaves.length === 0 && svelteLeaves.length === 0) {
    console.error(
      `check-readme-jsx-props: no leaves found${familyFilter ? ` for --family ${familyFilter}` : ''}.`,
    );
    process.exit(1);
  }

  const failures = [];
  const usedAllowlistKeys = new Set();
  const swept = new Set(); // `${source}/${family}/${target}`

  function report(source, family, target, attr, message) {
    const allowEntry = KNOWN_UNFIXED.find(
      (e) =>
        e.family === family &&
        e.target === target &&
        e.attr === attr &&
        (e.source ?? 'readme') === source,
    );
    if (allowEntry) {
      usedAllowlistKeys.add(`${source}/${family}/${target}/${attr}`);
      return;
    }
    failures.push(message);
  }

  // (1) React/Solid leaf READMEs — the original line-anchored sweep.
  for (const { family, target, readmePath, srcDir } of leaves) {
    swept.add(`readme/${family}/${target}`);
    const declared = declaredPropNames(srcDir);
    const readmeText = readFileSync(readmePath, 'utf8');
    const attrs = readmeRenderPropAttrs(readmeText);

    for (const attr of attrs) {
      if (declared.has(attr)) continue;
      report(
        'readme',
        family,
        target,
        attr,
        `${family}/${target}: README attribute \`${attr}\` is not a declared Props member ` +
          `(checked ${srcDir}).`,
      );
    }
  }

  // (2) Svelte leaf READMEs — tag-aware, per-component Props.
  for (const { family, target, readmePath, srcDir } of svelteLeaves) {
    swept.add(`readme/${family}/${target}`);
    const readmeText = readFileSync(readmePath, 'utf8');
    for (const block of fencedBlocks(readmeText)) {
      for (const bad of checkTaggedCode(block.body, family, target)) {
        const line = lineOf(readmeText, block.bodyOffset + bad.offset);
        report(
          'readme',
          family,
          target,
          bad.attr,
          `${family}/${target}: README attribute \`${bad.attr}\` on <${bad.tag}> ` +
            `(${relative(ROOT, readmePath)}:${line}) is not a declared Props member ` +
            `(checked ${srcDir}).`,
        );
      }
    }
  }

  // (3) Docs-site component pages.
  const familyNames = allFamilies();
  let docsPages = 0;
  let docsSegmentsChecked = 0;
  let docsSegmentsOutOfScope = 0;
  const docsSkipped = []; // undetermined-target segments that hold component tags
  if (existsSync(DOCS_COMPONENTS)) {
    for (const entry of readdirSync(DOCS_COMPONENTS, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const pagePath = join(DOCS_COMPONENTS, entry.name);
      const pageFam = pageFamily(entry.name, familyNames);
      const text = readFileSync(pagePath, 'utf8');
      let pageCounted = false;
      for (const block of fencedBlocks(text)) {
        for (const seg of blockSegments(block.body)) {
          const { targets, family: importFam } = resolveSegment(seg, block, familyNames);
          const family = importFam ?? pageFam;
          if (!family) continue;
          if (familyFilter && family !== familyFilter) continue;
          if (targets?.some((t) => OUT_OF_SCOPE_TARGETS.has(t))) {
            docsSegmentsOutOfScope++;
            continue;
          }
          if (!targets) {
            // Only count segments that actually use one of this family's
            // components (TS generics like `DecoratorNode<Descriptor>` don't).
            const familyTags = new Set(
              ALL_LEAF_TARGETS.flatMap((t) => [...(componentPropsFor(family, t)?.keys() ?? [])]),
            );
            if (scanComponentTags(seg.text).some(({ tag }) => familyTags.has(tag))) {
              docsSkipped.push(
                `${relative(ROOT, pagePath)}:${lineOf(text, block.bodyOffset + seg.offset)}`,
              );
            }
            continue;
          }
          for (const target of targets) {
            if (!componentPropsFor(family, target)) continue;
            docsSegmentsChecked++;
            swept.add(`docs/${family}/${target}`);
            if (!pageCounted) {
              docsPages++;
              pageCounted = true;
            }
            for (const bad of checkTaggedCode(seg.text, family, target)) {
              const line = lineOf(text, block.bodyOffset + seg.offset + bad.offset);
              report(
                'docs',
                family,
                target,
                bad.attr,
                `${family}/${target}: docs attribute \`${bad.attr}\` on <${bad.tag}> ` +
                  `(${relative(ROOT, pagePath)}:${line}) is not a declared Props member of the ` +
                  `${target} leaf (checked ${join(UI_ROOT, family, 'packages', target, 'src')}).`,
              );
            }
          }
        }
      }
    }
  }

  // Self-clearing allowlist: an entry that no longer reproduces a mismatch on
  // THIS run (because the leaf/target it names was actually swept) means the
  // bug was fixed and the suppression is now stale — fail loudly rather than
  // silently keep suppressing a defect that no longer exists.
  const staleEntries = [];
  for (const entry of KNOWN_UNFIXED) {
    const source = entry.source ?? 'readme';
    // not in this run's scope (e.g. --family filter) — can't judge staleness.
    if (!swept.has(`${source}/${entry.family}/${entry.target}`)) continue;
    const key = `${source}/${entry.family}/${entry.target}/${entry.attr}`;
    if (!usedAllowlistKeys.has(key)) {
      staleEntries.push(
        `${key}: allowlisted but reported NO mismatch this run — the bug appears fixed. ` +
          `Remove this entry from KNOWN_UNFIXED in scripts/check-readme-jsx-props.mjs.`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('check-readme-jsx-props: FAILED — unsuppressed README/Props mismatches:\n');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('');
  }
  if (staleEntries.length > 0) {
    console.error('check-readme-jsx-props: FAILED — stale KNOWN_UNFIXED allowlist entries:\n');
    for (const s of staleEntries) console.error(`  - ${s}`);
    console.error('');
  }

  const skippedNote =
    docsSkipped.length > 0
      ? ` ${docsSkipped.length} docs code segment(s) with component tags skipped (target framework undetermined): ` +
        `${docsSkipped.join(', ')}.`
      : ' 0 docs code segments skipped (target framework undetermined).';
  const summary =
    `${leaves.length} react/solid leaf README(s) + ${svelteLeaves.length} svelte leaf README(s) + ` +
    `${docsSegmentsChecked} react/solid/svelte docs code segment(s) across ${docsPages} ` +
    `docs/components page(s) checked against their emitted Props ` +
    `(${docsSegmentsOutOfScope} vue/angular/lit/rozie/html segment(s) out of scope).${skippedNote}`;

  if (failures.length > 0 || staleEntries.length > 0) {
    console.error(`check-readme-jsx-props: ${summary}`);
    process.exit(1);
  }

  console.log(`check-readme-jsx-props: OK — ${summary}`);
}

main();
