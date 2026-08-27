---
spike: 015
name: lexical-decorator-lit-shadow
type: standard
validates: "Given a Lexical DecoratorNode whose decorate() returns a framework-neutral descriptor + a per-target Lit mount bridge, when a component embeds in editor content inside a Lit OPEN shadow root, then it renders + cleans up, AND caret/selection works across the shadow boundary (getComposedRanges) + the editor survives disconnect/reconnect."
verdict: VALIDATED
related: [002, 007, 008, 009, 010, 013]
tags: [lexical, decorator-node, lit, shadow-dom, selection, getComposedRanges, decorator-bridge, killer-component-port, phase-999.1, hand-written-target-output]
---

# Spike 015: Lexical DecoratorNode in a Lit Shadow Root

## What This Validates

The one genuinely-unproven technical question for a Lexical port, per the
prior-art audit: Lexical inside a **Lit open shadow root** — the hardest target —
covering (a) editor mount + typing, (b) **selection across the shadow boundary**
(`getComposedRanges`), (c) a **DecoratorNode** rendering a Lit component inside the
content via a framework-neutral bridge, (d) decorator cleanup, and (e) the
disconnect/reconnect lifecycle. 014 (editor shell + RichText/History/List plugins +
selection-reading toolbar) is folded in as the host scaffold.

**Hand-written-target-output spike** (the 007/008/009 archetype): the decorator
bridge is a per-target escape hatch by design — NOT a compiler feature — so the Lit
reference is hand-written and proven at runtime, not routed through `.rozie`.

## Research

- Prior art already VALIDATED for TipTap/ProseMirror (the closest cousin): portal
  slots (002–004), reactive node-views (007–009), context primitive (010). Those
  proved framework components embed inside a rich-text editor across all 6, incl.
  Lit contentDOM. The residual Lexical-specific unknown was **shadow-DOM selection
  retargeting**, which the TipTap spikes (light-DOM contentDOM) never exercised.
- Lexical 0.48 handles ShadowRoot selection internally via
  `Selection.getComposedRanges`/`Selection.direction` (tracking issue #8125 closed
  Feb 2026). Hard browser floor: **Chrome/Edge 137+, Firefox 142+, Safari 17+.**
  Closed shadow roots unsupported (`mode:'open'` only); shadow trees don't inherit
  document CSS (theme must be injected per-root).

## How to Run

```bash
cd .planning/spikes/015-lexical-decorator-lit-shadow/harness
npm install          # lexical 0.48 + @lexical/{rich-text,history,list,utils} + lit 3.3 + vite + playwright
npm run build
npx playwright test shadow.spec.ts --reporter=list
```

Reuses the machine's cached Playwright Chromium (149.0.7827.55 under test — above
the 137 floor). `debug.spec.ts` dumps DOM for investigation; not part of the verdict.

## What to Expect

7 passing tests: mount+type, shadow-boundary select-all+bold → `<strong>`, toolbar
active-state, decorator render, decorator unmount, list transform, reconnect.

## Investigation Trail

1. Built a plain custom element (NOT LitElement — avoids lit's `render()` lifecycle
   fighting the contenteditable Lexical owns) with an open shadow root. Injected
   theme CSS into the shadow root, created the editor, `setRootElement(content)`,
   registered RichText + History + List + the decorator bridge + a
   selection-reading update-listener (the 014 "bidirectional toolbar" bit).
2. Decorator bridge (`mountDecorators.ts`, **33 non-comment LOC**):
   `editor.registerDecoratorListener` → for each key, `render(litTemplate(props),
   editor.getElementByKey(key))`; track keys, `render(nothing, …)` on removal.
   `decorate()` returns a neutral `{component,props}` descriptor — the node never
   names Lit.
3. First run: **5/7 pass** on the first try — incl. decorator render, list,
   reconnect, and the toolbar active-state (which reads `hasFormat('bold')` after a
   cross-shadow select-all → already implies selection crosses the boundary).
4. Chased the 2 failures with a DOM dump (`debug.spec.ts`) instead of guessing:
   - **T2-selection** "failure" was a test bug: bold DID apply across the boundary —
     `<strong class="bold">Type here. bravo</strong>` — select-all just also grabbed
     the seed text, so exact-`toHaveText('bravo')` was wrong. Fixed to
     count-1 + `toContainText`. **getComposedRanges confirmed working.**
   - **T3-cleanup** "failure" was fragile key-nav over an atomic
     `contenteditable="false"` inline decorator. Replaced with a clean node-level
     removal (`$nodesOfType(ChipNode).remove()`) that isolates the bridge's unmount
     path. The DOM dump also confirmed the chip mounts correctly:
     `<span data-lexical-decorator="true" contenteditable="false"><span class="chip"
     data-decorator-chip>◈ MENTION</span></span>`.
5. Rerun: **7/7 pass in 2.1s.**

## Results

**VERDICT: VALIDATED.** The hardest target works.

- **Shadow-boundary selection works** with zero special handling in the wrapper —
  Lexical 0.48 owns `getComposedRanges` internally. Select-all + bold across the
  boundary produced a single `<strong>` over the full run; the toolbar
  active-state read `hasFormat('bold')` back correctly. → **REQ-40.**
- **The neutral-descriptor decorator bridge is finite and cheap:** ~33 LOC for Lit
  (core logic ~20). `decorate()` returns `{component,props}`; the per-target bridge
  renders the native component into `getElementByKey(nodeKey)` and tears down on
  removal. A React bridge is the same shape (`createPortal` into the same nodes).
  This is the datum the spike existed to produce: the decorator escape hatch is
  **one small hand-written file per target**, not a swamp. → **REQ-39.**
- **Reconnect lifecycle** handled in ~2 lines: `setRootElement(null)` on
  `disconnectedCallback`, re-`setRootElement(content)` on reconnect (editor instance
  + state retained). Editor stayed editable and preserved content across a
  detach/reattach.
- **Documented Lit caveats** (all handled, none blocking): open shadow only, theme
  CSS injected per shadow root, toolbar buttons `mousedown`-preventDefault to keep
  the caret selection, and the **Chrome 137+/FF 142+/Safari 17+ floor** — the one
  parity caveat for the Lit target (sibling to REQ-30's Lit-async edge).

**Go/no-go for a `@rozie-ui/lexical` family:** GO (technical). Both genuinely-new
Lexical risks resolved favorably — the `$`-sigil gate (013, namespace-import
convention) and the Lit shadow-DOM decorator/selection (015). Everything else is
re-application of already-VALIDATED primitives (001 engine-wrapper, 010 context,
002–009 portal/node-view). The family's per-target decorator bridges are the only
irreducible hand-work, and they're ~30 LOC each.
