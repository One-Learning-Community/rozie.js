// MentionNode.ts — the ONE reference DecoratorNode for @rozie-ui/lexical (D-07).
//
// This is a FRAMEWORK-NEUTRAL, plain-vanilla-TS Lexical DecoratorNode. It is
// SHARED verbatim into every leaf (NOT per-target, NOT a `.rozie`) by codegen.
// `decorate()` returns a `{ component, props }` DESCRIPTOR that names NO framework
// (no React/Vue/Svelte/Solid/Angular/Lit) — the seam that lets ONE node definition
// feed the 5 per-target mount bridges (`bridges/mountDecorators.<target>.ts`). This
// is the exact spike-015 `ChipNode.ts` shape, generalized into the shipped
// `@mention` chip: it stores a mention `label` (+ optional `id`) and its host span
// is what each bridge renders the target-native pill INTO.
//
// The `$`-prefixed helper names below are ORDINARY JS identifiers in a plain `.ts`
// module — the Svelte `dollar_prefix_invalid` reservation (D-05/REQ-37) applies only
// to `$`-prefixed NAMED imports inside a `.rozie` source, so this file is unaffected
// and consumers use these helpers from their own `.ts`. The shell never imports the
// `$`-helpers (it registers the `MentionNode` CLASS only).
import {
  DecoratorNode,
  type NodeKey,
  type LexicalNode,
  type SerializedLexicalNode,
} from 'lexical';

/**
 * The framework-NEUTRAL descriptor `decorate()` returns. Every per-target bridge
 * consumes exactly this shape — the cross-target seam (spike 015). It names no
 * framework: `component` is a neutral registry key, `props` is plain data.
 */
export interface MentionDescriptor {
  component: 'mention';
  props: { label: string; id: string | null };
}

type SerializedMentionNode = SerializedLexicalNode & {
  label: string;
  id: string | null;
};

export class MentionNode extends DecoratorNode<MentionDescriptor> {
  __label: string;
  __id: string | null;

  static override getType(): string {
    return 'mention';
  }

  static override clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__label, node.__id, node.__key);
  }

  constructor(label: string, id: string | null = null, key?: NodeKey) {
    super(key);
    this.__label = label;
    this.__id = id;
  }

  override createDOM(): HTMLElement {
    // The inline host span Lexical inserts into the document. The per-target bridge
    // renders the framework-native pill INTO this element (React roots here, Vue
    // renders here, Angular hosts here, …). It carries NO visible text itself — the
    // bridge owns the content, and always as escaped TEXT (never innerHTML).
    const span = document.createElement('span');
    span.className = 'rozie-mention-host';
    span.setAttribute('data-mention-host', '');
    return span;
  }

  override updateDOM(): boolean {
    // The host span never changes; a label edit produces a fresh node (new key) and
    // the bridge re-renders. Nothing for Lexical to reconcile on the host itself.
    return false;
  }

  override isInline(): boolean {
    return true;
  }

  override decorate(): MentionDescriptor {
    return { component: 'mention', props: { label: this.__label, id: this.__id } };
  }

  static override importJSON(json: SerializedMentionNode): MentionNode {
    return new MentionNode(json.label, json.id ?? null);
  }

  override exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      type: 'mention',
      version: 1,
      label: this.__label,
      id: this.__id,
    };
  }
}

/** Create an inline `@mention` chip node. `id` is the optional stable mention id. */
export function $createMentionNode(label: string, id: string | null = null): MentionNode {
  return new MentionNode(label, id);
}

/** Type guard: is this node a MentionNode? */
export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode;
}
