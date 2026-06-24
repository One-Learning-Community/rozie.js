// Phase 61 Plan 01 — the SINGLE SOURCE OF TRUTH for cross-target reserved-name
// data. Both halves of the collision system consume these tables:
//   - Half A (per-target emitter auto-deconfliction) widens its reserved
//     class-member sets from here (see deconflict.ts reservedClassMembers()).
//   - Half B (public-contract lint validator) reads these to flag prop/slot/
//     emit/$expose-verb/provide-inject-key names that collide with a per-target
//     reserved name and therefore CANNOT be auto-renamed.
// If these tables drift, the two halves disagree — so they live in exactly one
// place. Every constant is a `ReadonlySet<string>` with a one-line provenance
// comment citing the collision-{target}.md section it was transcribed from.
//
// IMPORTANT for the Solid + React legs: those targets emit a plain function (not
// a class), so they DO NOT inherit DOM / Object.prototype / CVA members — the
// Solid/React-specific tables here intentionally contain NONE of those names
// (collision-solid §4, collision-react §3.G). Only Lit + Angular get the
// class-field tables.

// DIRECTION (locked, documented per Plan 61-01): reservedNames.ts is a PURE LEAF
// — it imports NOTHING from deconflict.ts. deconflict.ts imports its reserved
// tables FROM here. This one direction avoids the module-init cycle that the
// reverse (re-exporting deconflict's runtime sets here) caused: deconflict.ts
// runs `deriveLitDomMembers()` at module-load and reads `LIT_DOM_MEMBERS`, so it
// must be able to load reservedNames.ts FIRST without re-entering deconflict.
//
// `OBJECT_PROTOTYPE_MEMBERS` lives HERE (not in deconflict.ts) so all reserved
// data is importable from this single module. It is pure data — the id-shaped
// own members of `Object.prototype` — with no traverse/AST dependency, so it
// belongs in the leaf. deconflict.ts re-exports it for back-compat with existing
// importers. Reserved on BOTH class targets (Angular + Lit): a user LOCAL that
// becomes a class field with one of these names overrides the inherited member;
// on Lit the legacy `@property` decorator's `Object`-assignability check then
// cascades TS1240/TS1271 to EVERY decorator on the class (the listbox `valueOf`
// finding — 38 errors from one name). The symbol-keyed `__proto__` accessor pair
// is excluded by the id-shape filter (cannot collide with a JS identifier).
export const OBJECT_PROTOTYPE_MEMBERS: ReadonlySet<string> = new Set(
  Object.getOwnPropertyNames(Object.prototype).filter(
    (n) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n),
  ),
);

// ============================================================================
// LIT (collision-lit.md §2)
// ============================================================================

// collision-lit §2 Group A — the FULL DOM prototype chain (EventTarget → Node →
// Element → HTMLElement) inherited by every `LitElement`. HARDCODED here (NOT
// relying on the runtime `deriveLitDomMembers()` walk) so a bare-Node compile
// with no DOM globals still has the complete set — closes R-NEW-6 (a `popover`/
// `inert`/`aria*`-named helper slipping the auto-rename). Includes the full
// aria* reflection block, popover, inert, enterKeyHint, autocapitalize,
// autocorrect, nonce, translate, editContext, attachInternals, hidePopover/
// showPopover/togglePopover, assignedSlot — every name in Group A.
export const LIT_DOM_MEMBERS: ReadonlySet<string> = new Set([
  // EventTarget
  'addEventListener', 'removeEventListener', 'dispatchEvent',
  // Node (instance props)
  'baseURI', 'childNodes', 'firstChild', 'isConnected', 'lastChild',
  'nextSibling', 'nodeName', 'nodeType', 'nodeValue', 'ownerDocument',
  'parentElement', 'parentNode', 'previousSibling', 'textContent',
  // Node (instance methods)
  'appendChild', 'cloneNode', 'compareDocumentPosition', 'contains',
  'getRootNode', 'hasChildNodes', 'insertBefore', 'isDefaultNamespace',
  'isEqualNode', 'isSameNode', 'lookupNamespaceURI', 'lookupPrefix',
  'normalize', 'removeChild', 'replaceChild',
  // Element (instance props)
  'assignedSlot', 'attributes', 'childElementCount', 'children', 'classList',
  'className', 'clientHeight', 'clientLeft', 'clientTop', 'clientWidth',
  'currentCSSZoom', 'firstElementChild', 'id', 'innerHTML', 'lastElementChild',
  'localName', 'namespaceURI', 'nextElementSibling', 'outerHTML', 'part',
  'prefix', 'previousElementSibling', 'scrollHeight', 'scrollLeft', 'scrollTop',
  'scrollWidth', 'shadowRoot', 'slot', 'tagName', 'role',
  // Element — aria* reflection set
  'ariaAtomic', 'ariaAutoComplete', 'ariaBrailleLabel',
  'ariaBrailleRoleDescription', 'ariaBusy', 'ariaChecked', 'ariaColCount',
  'ariaColIndex', 'ariaColIndexText', 'ariaColSpan', 'ariaCurrent',
  'ariaDescription', 'ariaDisabled', 'ariaExpanded', 'ariaHasPopup',
  'ariaHidden', 'ariaInvalid', 'ariaKeyShortcuts', 'ariaLabel', 'ariaLevel',
  'ariaLive', 'ariaModal', 'ariaMultiline', 'ariaMultiSelectable',
  'ariaOrientation', 'ariaPlaceholder', 'ariaPosInSet', 'ariaPressed',
  'ariaReadOnly', 'ariaRelevant', 'ariaRequired', 'ariaRoleDescription',
  'ariaRowCount', 'ariaRowIndex', 'ariaRowIndexText', 'ariaRowSpan',
  'ariaSelected', 'ariaSetSize', 'ariaSort', 'ariaValueMax', 'ariaValueMin',
  'ariaValueNow', 'ariaValueText',
  // Element (instance methods)
  'after', 'animate', 'append', 'attachShadow', 'before', 'checkVisibility',
  'closest', 'computedStyleMap', 'getAnimations', 'getAttribute',
  'getAttributeNames', 'getAttributeNode', 'getAttributeNodeNS',
  'getAttributeNS', 'getBoundingClientRect', 'getClientRects',
  'getElementsByClassName', 'getElementsByTagName', 'getElementsByTagNameNS',
  'getHTML', 'hasAttribute', 'hasAttributeNS', 'hasAttributes',
  'hasPointerCapture', 'insertAdjacentElement', 'insertAdjacentHTML',
  'insertAdjacentText', 'matches', 'prepend', 'querySelector',
  'querySelectorAll', 'releasePointerCapture', 'remove', 'removeAttribute',
  'removeAttributeNode', 'removeAttributeNS', 'replaceChildren', 'replaceWith',
  'requestFullscreen', 'requestPointerLock', 'scroll', 'scrollBy',
  'scrollIntoView', 'scrollTo', 'setAttribute', 'setAttributeNode',
  'setAttributeNodeNS', 'setAttributeNS', 'setPointerCapture',
  'toggleAttribute', 'setHTMLUnsafe',
  // HTMLElement (instance props)
  'accessKey', 'accessKeyLabel', 'attributeStyleMap', 'autocapitalize',
  'autocorrect', 'autofocus', 'contentEditable', 'dataset', 'dir', 'draggable',
  'editContext', 'enterKeyHint', 'hidden', 'inert', 'innerText', 'inputMode',
  'isContentEditable', 'lang', 'nonce', 'offsetHeight', 'offsetLeft',
  'offsetParent', 'offsetTop', 'offsetWidth', 'outerText', 'popover',
  'spellcheck', 'style', 'tabIndex', 'title', 'translate',
  // HTMLElement (instance methods)
  'attachInternals', 'blur', 'click', 'focus', 'hidePopover', 'showPopover',
  'togglePopover',
]);

// collision-lit §2 Group C — Lit ReactiveElement / LitElement reserved members.
// Lifecycle methods (overriding silently breaks reactivity) + instance accessors
// + static members. NOT in Group A/B; currently missing from every guard
// (R-NEW-2). The static members collide only with author statics (Rozie never
// emits those) — listed for completeness.
export const LIT_LIFECYCLE_MEMBERS: ReadonlySet<string> = new Set([
  // Instance lifecycle methods
  'connectedCallback', 'disconnectedCallback', 'attributeChangedCallback',
  'adoptedCallback', 'update', 'render', 'firstUpdated', 'updated',
  'willUpdate', 'shouldUpdate', 'performUpdate', 'scheduleUpdate',
  'requestUpdate', 'getUpdateComplete', 'createRenderRoot', 'enableUpdating',
  'addController', 'removeController',
  // Instance accessors / props
  'renderRoot', 'updateComplete', 'hasUpdated', 'isUpdatePending',
  // Static members
  'elementProperties', 'elementStyles', 'finalized', 'properties',
  'shadowRootOptions', 'styles', 'addInitializer', 'finalize',
  'observedAttributes', 'createProperty', 'getPropertyDescriptor',
  'getPropertyOptions', 'finalizeStyles',
]);

// collision-lit §2 Group D — Lit emitter-minted member names that are minted
// UNCONDITIONALLY (or commonly) on emitted components. An author identifier that
// EQUALS one of these collides with the generated member. The underscore /
// `__rozie`-prefixed per-feature names (`_<state>`, `_<prop>_attr`, `_ref<Cap>`,
// `_hasSlot<Cap>`, `__rozieCtx*`, …) are namespaced and listed in the research
// but excluded here — they cannot collide with an idiomatic bare author name.
export const LIT_EMITTER_MEMBERS: ReadonlySet<string> = new Set([
  '_disconnectCleanups', '_rozieTornDown', '_armListeners',
  'render', 'connectedCallback', 'disconnectedCallback', 'firstUpdated',
  'updated', 'attributeChangedCallback',
  '_portalContainers',
]);

// ============================================================================
// ANGULAR (collision-angular.md §2)
// ============================================================================

// collision-angular §2a — generated ControlValueAccessor members. Reserved ONLY
// CONDITIONALLY: a component with EXACTLY ONE `model:true` prop and `cva !==
// false` generates these (the public quartet → TS2300 on duplicate, plus the
// private/protected CVA fields). Half A/B fold this set in only behind the
// single-model gate (`cvaModelProp !== null`).
export const ANGULAR_CVA_MEMBERS: ReadonlySet<string> = new Set([
  // CVA public methods (TS2300 on duplicate)
  'writeValue', 'registerOnChange', 'registerOnTouched', 'setDisabledState',
  '__rozieCvaOnTouched', // host-bound public method
  // CVA private/protected fields
  '__rozieCvaOnChange', '__rozieCvaOnTouchedFn', '__rozieCvaDisabled',
]);

// collision-angular §2c — Angular lifecycle hooks + the special `constructor`
// member. `ngAfterViewInit` + `constructor` are ACTIVELY GENERATED by the
// emitter (→ hard TS2300 on duplicate); the other ngOn*/ngAfter* names are
// framework-reserved (a same-named member is silently invoked as a real hook —
// a behavior bug).
export const ANGULAR_LIFECYCLE_MEMBERS: ReadonlySet<string> = new Set([
  'ngOnChanges', 'ngOnInit', 'ngDoCheck', 'ngAfterContentInit',
  'ngAfterContentChecked', 'ngAfterViewInit', 'ngAfterViewChecked',
  'ngOnDestroy',
  'constructor',
]);

// collision-angular §2b — other emitter-minted Angular class members + the
// module-scope reserved file-level idents (`rozieToken`/`__rozieTokenRegistry`)
// that collide with a top-level helper of the same name.
export const ANGULAR_EMITTER_MEMBERS: ReadonlySet<string> = new Set([
  '__rozieDestroyRef', 'templates', '__rozieCtxHost',
  'rozieToken', '__rozieTokenRegistry',
]);

// collision-angular §2e — decorator / DI reserved tokens in class scope. A
// `<script>` import or helper named like one of these shadows the Angular-core
// import the generated codegen relies on (the floating-ui `offset`/`arrow`
// import-shadow class, generalized).
export const ANGULAR_DI_TOKENS: ReadonlySet<string> = new Set([
  'Component', 'Input', 'Output', 'ViewChild', 'ContentChild', 'TemplateRef',
  'ElementRef', 'signal', 'computed', 'effect', 'input', 'output', 'model',
  'viewChild', 'contentChild', 'inject', 'DestroyRef', 'forwardRef',
  'EventEmitter', 'NgTemplateOutlet', 'NgClass', 'NgStyle', 'FormsModule',
  'NG_VALUE_ACCESSOR',
]);

// ============================================================================
// VUE (collision-vue.md §2)
// ============================================================================

// collision-vue §2 set A — Vue reserved PROP names (eslint-plugin-vue
// no-reserved-props, vue3). A `<props>` key named one of these is stripped/warned
// by Vue's template compiler → the prop silently never receives a value (no TS
// error — the worst class).
export const VUE_RESERVED_PROPS: ReadonlySet<string> = new Set([
  'key', 'ref', 'ref_for', 'ref_key', 'is',
]);

// collision-vue §2 set C — emitter-GENERATED top-level `<script setup>` bindings.
// ANY author <data>/<computed>/helper/import/inject-local equal to one of these
// redeclares the generated binding → TS2451/TS2440.
export const VUE_EMITTER_BINDINGS: ReadonlySet<string> = new Set([
  'props', 'emit', 'slots', 'portals', 'portalContainers',
]);

// collision-vue §2 set D — `'vue'` named imports the emitter may inject. A helper
// or `<data>` named like one of these collides with the auto-injected import.
export const VUE_IMPORT_NAMES: ReadonlySet<string> = new Set([
  'ref', 'computed', 'watch', 'provide', 'inject', 'useSlots',
  'onMounted', 'onBeforeUnmount', 'onUpdated', 'h', 'render', 'Fragment',
]);

// collision-vue §2 set E — @rozie/runtime-vue helper imports the emitter may
// inject.
export const VUE_RUNTIME_IMPORTS: ReadonlySet<string> = new Set([
  'rozieDeepClone', 'debounce', 'throttle', 'useOutsideClick',
  'normalizeListeners',
]);

// ============================================================================
// SVELTE (collision-svelte.md §2)
// ============================================================================

// collision-svelte §2a — Svelte 5 runes. An author identifier named like a rune
// is illegal or shadows the rune in the runes-mode `<script>`.
export const SVELTE_RUNE_NAMES: ReadonlySet<string> = new Set([
  '$props', '$state', '$derived', '$effect', '$bindable', '$inspect', '$host',
]);

// collision-svelte §2d — emitter-generated names occupying the single unified
// `<script>` scope (Svelte 5 collapses props + snippets + emit-callbacks into one
// `$props()` destructure). An author helper/prop/data/computed equal to one of
// these duplicate-binds or shadows the generated symbol.
export const SVELTE_EMITTER_NAMES: ReadonlySet<string> = new Set([
  'children', 'snippets', '__rozieAttrs', 'portals', 'applyListeners',
  '__rozieRoot',
]);

// collision-svelte §2d — imported value names folded into the single `'svelte'`
// import line. A helper/import named like one of these duplicate-binds or
// shadows the generated import.
export const SVELTE_RUNTIME_IMPORTS: ReadonlySet<string> = new Set([
  'onMount', 'onDestroy', 'untrack', 'getContext', 'setContext',
]);

// ============================================================================
// SOLID (collision-solid.md "Reserved emitter-minted identifiers" + imports)
// ============================================================================
// NOTE: Solid emits a plain function — no class, no prototype chain. These
// tables therefore contain NO DOM/Object.prototype/CVA names (collision-solid
// §4). A linter must NOT flag DOM-member names for the Solid leg.

// collision-solid — emitter-minted function-scope locals (+ the `render` /
// `__rozieInjectStyle` module-top names). An author helper/<data>/<computed>/ref
// equal to one of these collides with an emitter-minted binding → TS2451.
export const SOLID_EMITTER_LOCALS: ReadonlySet<string> = new Set([
  'local', 'attrs', '_props', '_merged', 'resolved', 'portals',
  '__rozieRoot', '__rozieInjectStyle', 'render',
]);

// collision-solid — solid-js + @rozie/runtime-solid imports done by BARE name
// (shadowable). A `<data>`/helper/import named like one of these collides with
// the auto-injected import.
export const SOLID_IMPORT_NAMES: ReadonlySet<string> = new Set([
  // solid-js
  'splitProps', 'children', 'createSignal', 'createMemo', 'createEffect', 'on',
  'untrack', 'mergeProps', 'onMount', 'onCleanup', 'Show', 'For', 'useContext',
  // solid-js/web
  'render',
  // @rozie/runtime-solid
  'createControllableSignal', 'createOutsideClick', 'createDebouncedHandler',
  'createThrottledHandler', 'rozieDisplay', 'rozieAttr', 'rozieClass',
  'rozieContext', 'parseInlineStyle', 'normalizeAttrs', 'normalizeListeners',
  'mergeListeners', '__rozieInjectStyle',
]);

// ============================================================================
// REACT (collision-react.md §3.G + §2)
// ============================================================================
// NOTE: React emits a plain function — no class. These tables contain NO
// DOM/Object.prototype/CVA names (collision-react §3.G).

// collision-react §3.G — React SILENT-tier reserved props. React's element
// machinery consumes these (`key`/`ref` swallowed, `children`/
// `dangerouslySetInnerHTML` special) — a `<props>` key named one of these
// produces a behavior bug with NO TS error at any gate (lint-only catchable).
// PUBLIC-CONTRACT inputs for Half B; named-exported so Plan 02 imports the set
// rather than inlining a literal (single-source-of-truth discipline).
export const REACT_RESERVED_PROPS: ReadonlySet<string> = new Set([
  'key', 'ref', 'children', 'dangerouslySetInnerHTML',
]);

// ============================================================================
// SHARED (collision-react.md §2 — JS reserved words)
// ============================================================================

// collision-react §2 — JS reserved words. Shared by ALL targets for the
// reserved-word prop/data lint (a prop/data/loop-var named a reserved word is
// illegal as a binding on every target).
export const JS_RESERVED_WORDS: ReadonlySet<string> = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
  'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'let', 'static', 'yield', 'await',
  'implements', 'interface', 'package', 'private', 'protected', 'public',
]);
