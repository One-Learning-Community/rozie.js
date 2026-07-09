import type { JSX } from 'solid-js';
import { Show, createSignal, mergeProps, onMount, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('Tags-64848f8e', `.rozie-tags[data-rozie-s-64848f8e] {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rozie-tags-gap, 0.4rem);
  padding: var(--rozie-tags-padding, 0.35rem 0.45rem);
  font: var(--rozie-tags-font, inherit);
  background: var(--rozie-tags-bg, #fff);
  border: var(--rozie-tags-border-width, 1px) solid var(--rozie-tags-border-color, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-tags-radius, 0.5rem);
  min-width: var(--rozie-tags-min-width, 12rem);
}
.rozie-tags[data-rozie-s-64848f8e]:focus-within {
  border-color: var(--rozie-tags-accent, #0066cc);
  box-shadow: 0 0 0 var(--rozie-tags-focus-ring-width, 3px) var(--rozie-tags-focus-ring-color, rgba(0, 102, 204, 0.25));
}
.rozie-tags-list[data-rozie-s-64848f8e] {
  display: contents;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rozie-tags-chip[data-rozie-s-64848f8e] {
  display: inline-flex;
  align-items: center;
  gap: var(--rozie-tags-chip-gap, 0.3rem);
  padding: var(--rozie-tags-chip-padding, 0.15rem 0.5rem);
  font-size: var(--rozie-tags-chip-font-size, 0.85rem);
  color: var(--rozie-tags-chip-color, inherit);
  background: var(--rozie-tags-chip-bg, rgba(0, 102, 204, 0.12));
  border-radius: var(--rozie-tags-chip-radius, 0.375rem);
  white-space: nowrap;
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rozie-tags-remove-size, 1.1rem);
  height: var(--rozie-tags-remove-size, 1.1rem);
  padding: 0;
  font: inherit;
  line-height: 1;
  color: var(--rozie-tags-remove-color, currentColor);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: var(--rozie-tags-remove-opacity, 0.65);
  transition: opacity 0.15s, background 0.15s;
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e]:hover:not([data-rozie-s-64848f8e]:disabled) {
  opacity: 1;
  background: var(--rozie-tags-remove-hover-bg, rgba(0, 0, 0, 0.1));
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e]:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.rozie-tags-input[data-rozie-s-64848f8e] {
  flex: 1 1 var(--rozie-tags-input-min, 4rem);
  min-width: var(--rozie-tags-input-min, 4rem);
  padding: var(--rozie-tags-input-padding, 0.15rem 0.1rem);
  font: inherit;
  color: var(--rozie-tags-color, inherit);
  background: transparent;
  border: none;
  outline: none;
}
.rozie-tags-input[data-rozie-s-64848f8e]::placeholder {
  color: var(--rozie-tags-placeholder-color, rgba(0, 0, 0, 0.4));
}
.rozie-tags-input[data-rozie-s-64848f8e]:disabled {
  cursor: not-allowed;
}
.rozie-tags-count[data-rozie-s-64848f8e] {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.rozie-tags--disabled[data-rozie-s-64848f8e] {
  cursor: not-allowed;
  opacity: var(--rozie-tags-disabled-opacity, 0.6);
  background: var(--rozie-tags-disabled-bg, rgba(0, 0, 0, 0.04));
}`);

interface TagSlotCtx { tag: any; index: any; remove: any; }

interface TagsProps {
  /**
   * The committed tokens — `model: true`, so a commit/remove/paste writes a **fresh** array back through `r-model:modelValue` (uncontrolled fallback `[]`). Because it is the sole model prop, the Angular output is a `ControlValueAccessor` (`[formControl]` / `[(ngModel)]` bind directly).
   * @example
   * <Tags r-model:modelValue="skills" placeholder="Add a skill…" />
   */
  modelValue?: any[];
  defaultModelValue?: any[];
  onModelValueChange?: (modelValue: any[]) => void;
  /**
   * The keys that commit the current draft as a token (matched against the key event's `key`). Default `[',', 'Enter']`. Non-`'Enter'` entries also act as the split characters when pasting bulk text. Use e.g. `[' ', 'Enter']` for a space-delimited input.
   */
  delimiters?: any[];
  /**
   * Allow the same token value to be added more than once. Defaults to `false` — a candidate equal (case-sensitive) to an existing token is silently rejected on commit. Set `true` to permit duplicates.
   */
  allowDuplicates?: boolean;
  /**
   * Maximum number of tokens. Once the list reaches `max`, the input is disabled and further adds (type, paste, programmatic) are rejected. `null` (the default) means unlimited.
   */
  max?: (number) | null;
  /**
   * Disable the whole control — the text input is disabled, every remove button is disabled, and no token can be added or removed. Also sets the Angular CVA disabled state.
   */
  disabled?: boolean;
  /**
   * Render the tokens read-only — they remain visible but cannot be added or removed, and the text input is hidden. Unlike `disabled` it carries no disabled styling, so it reads as a display of committed values.
   */
  readonly?: boolean;
  /**
   * Optional per-token validator / normalizer. Called with `(candidate, tokens)` for each commit; return a (possibly normalized) **string** to accept it, or a falsy value (`false` / `null` / `""`) to reject the candidate. Runs before the dedup + `max` checks. Example: `v => /^\S+@\S+$/.test(v) ? v.toLowerCase() : false` for emails.
   * @example
   * validate: (v) => (v.length >= 2 ? v.trim() : false)
   */
  validate?: ((...args: unknown[]) => unknown) | null;
  /**
   * Placeholder text for the inline text input (e.g. `"Add a tag…"`).
   */
  placeholder?: string;
  /**
   * Accessible name for the whole control (`role="group"`). The inline text input is labelled with the same name so assistive tech announces what is being entered. A visually-hidden live region announces the current token count on change.
   */
  ariaLabel?: (string) | null;
  onChange?: (...args: unknown[]) => void;
  onAdd?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  tagSlot?: (ctx: TagSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: TagsHandle) => void;
}

export interface TagsHandle {
  clear: (...args: any[]) => any;
  focus: (...args: any[]) => any;
}

export default function Tags(_props: TagsProps): JSX.Element {
  const _merged = mergeProps({ delimiters: (() => [',', 'Enter'])(), allowDuplicates: false, max: null, disabled: false, readonly: false, validate: null, placeholder: '', ariaLabel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['modelValue', 'delimiters', 'allowDuplicates', 'max', 'disabled', 'readonly', 'validate', 'placeholder', 'ariaLabel', 'ref']);
  onMount(() => { local.ref?.({ clear, focus }); });

  const [modelValue, setModelValue] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'modelValue', (() => [])());
  const [draft, setDraft] = createSignal('');
  let rootRef: HTMLElement | null = null;

  // ---- derived view (plain functions, uniform ×6) ------------------------
  // The committed tokens, normalized to a string[].
  function tokens() {
    return Array.isArray(modelValue()) ? modelValue() : [];
  }

  // The configured commit keys, normalized to a string[].
  function commitKeys() {
    return Array.isArray(local.delimiters) ? local.delimiters : [',', 'Enter'];
  }

  // The non-Enter delimiters act as split characters for paste.
  function splitChars() {
    return commitKeys().filter((k: any) => k !== 'Enter');
  }

  // Whether the control has reached its token cap.
  function atMax() {
    return typeof local.max === 'number' && tokens().length >= local.max;
  }

  // Whether new input is accepted at all.
  function canEdit() {
    return !local.disabled && !local.readonly;
  }

  // ---- write funnel (single $emit site) ----------------------------------
  // Write the model and emit change. Every committed-list mutation funnels here.
  function commitTokens(next: any) {
    setModelValue(next);
    _props.onChange?.({
      value: next
    });
  }

  // ---- add / remove ------------------------------------------------------
  // Normalize → validate → dedup → cap a candidate, then commit + emit add.
  // Returns true if it was added (so the caller can clear the draft).
  function addToken(raw: any) {
    if (!canEdit()) return false;
    let candidate = String(raw == null ? '' : raw).trim();
    if (!candidate) return false;
    if (typeof local.validate === 'function') {
      const result = local.validate(candidate, tokens());
      if (!result) return false;
      candidate = String(result);
      if (!candidate) return false;
    }
    const cur = tokens();
    if (!local.allowDuplicates && cur.indexOf(candidate) !== -1) return false;
    if (typeof local.max === 'number' && cur.length >= local.max) return false;
    const next = cur.concat([candidate]);
    commitTokens(next);
    _props.onAdd?.({
      value: candidate,
      tokens: next
    });
    return true;
  }

  // Remove the token at `idx`, commit, and emit remove.
  function removeAt(idx: any) {
    if (!canEdit()) return;
    const cur = tokens();
    if (idx < 0 || idx >= cur.length) return;
    const removed = cur[idx];
    const next = cur.slice(0, idx).concat(cur.slice(idx + 1));
    commitTokens(next);
    _props.onRemove?.({
      value: removed,
      index: idx,
      tokens: next
    });
  }

  // ---- focus (container ref, post-mount only) ----------------------------
  // Read $refs.root only here / in $onMount / in $expose verbs (post-mount →
  // ROZ123-safe). querySelector reaches the input inside Lit's shadow root too.
  function focusTheInput() {
    const root = rootRef;
    if (!root) return;
    const el = root.querySelector('input');
    if (el) el.focus();
  }

  // ---- input handlers ----------------------------------------------------
  // Mirror the typed text into the draft buffer. Capture the fresh local value
  // (do NOT re-read $data.draft in the same handler — React setState is async and
  // would read the pre-write value).
  function onInput(e: any) {
    setDraft(e && e.target ? e.target.value : '');
  }

  // A delimiter key commits the current draft; Backspace in an empty input
  // deletes the previous token.
  function onKeydown(e: any) {
    if (!canEdit()) return;
    const key = e ? e.key : '';
    const value = e && e.target ? e.target.value : '';
    if (commitKeys().indexOf(key) !== -1) {
      if (e) e.preventDefault();
      if (addToken(value)) setDraft('');
      return;
    }
    if (key === 'Backspace' && value === '') {
      const cur = tokens();
      if (cur.length > 0) {
        if (e) e.preventDefault();
        removeAt(cur.length - 1);
      }
    }
  }

  // Commit any leftover draft when the input loses focus (a common chips UX).
  function onBlur(e: any) {
    if (!canEdit()) return;
    const value = e && e.target ? e.target.value : '';
    if (value && addToken(value)) setDraft('');
  }

  // Paste: split on the configured delimiter characters and bulk-add.
  function onPaste(e: any) {
    if (!canEdit()) return;
    const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
    const seps = splitChars();
    let parts = [text];
    if (seps.length) {
      // Split on every separator char in turn.
      for (let s = 0; s < seps.length; s++) {
        const sep = seps[s];
        const out = [];
        for (let p = 0; p < parts.length; p++) {
          const pieces = String(parts[p]).split(sep);
          for (let q = 0; q < pieces.length; q++) out.push(pieces[q]);
        }
        parts = out;
      }
    }
    const trimmed = parts.map((p: any) => String(p).trim()).filter((p: any) => p.length > 0);
    if (trimmed.length <= 1 && seps.length === 0) return; // let the input handle a plain paste
    if (e) e.preventDefault();
    let addedAny = false;
    for (let i = 0; i < trimmed.length; i++) {
      if (addToken(trimmed[i])) addedAny = true;
    }
    if (addedAny) setDraft('');
  }

  // ---- per-element attribute helpers -------------------------------------
  function removeLabel(t: any) {
    return 'Remove ' + String(t);
  }
  function countLabel() {
    const n = tokens().length;
    return n === 1 ? '1 tag' : n + ' tags';
  }

  // ---- lifecycle + imperative handle -------------------------------------
  // clear() — remove every token (emits change with []) and focus the input.
  function clear() {
    commitTokens([]);
    setDraft('');
    focusTheInput();
  }
  // focus() — move DOM focus to the text input. DELIBERATELY overrides the
  // inherited HTMLElement.focus on the Lit custom element (warn-only ROZ137,
  // accepted — the public focus() handle is the intended semantics; otp/slider
  // precedent, consistent with NumberField which also exposes `focus`).
  function focus() {
    return focusTheInput();
  }

  return (
    <>
    <div ref={(el) => { rootRef = el as HTMLElement; }} role="group" aria-label={rozieAttr(local.ariaLabel)} {...attrs} class={"rozie-tags" + " " + rozieClass({ 'rozie-tags--disabled': local.disabled, 'rozie-tags--readonly': local.readonly }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-64848f8e="">
      <ul class={"rozie-tags-list"} data-rozie-s-64848f8e="">
        <Key each={tokens() as readonly any[]} by={(t) => t + ':' + tokens().indexOf(t)}>{(t) => <li class={"rozie-tags-chip"} data-rozie-s-64848f8e="">
          {(_props.tagSlot ?? _props.slots?.['tag'])?.({ tag: t(), index: tokens().indexOf(t()), remove: () => removeAt(tokens().indexOf(t())) }) ?? <><span class={"rozie-tags-chip__label"} data-rozie-s-64848f8e="">{rozieDisplay(t())}</span>{<Show when={!local.readonly}><button type="button" aria-label={rozieAttr(removeLabel(t()))} class={"rozie-tags-chip__remove"} disabled={!!local.disabled} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { removeAt(tokens().indexOf(t())); }} data-rozie-s-64848f8e="">×</button></Show>}</>}
        </li>}</Key>
      </ul>

      {<Show when={!local.readonly}><input type="text" autocomplete="off" autocapitalize="off" aria-label={rozieAttr(local.ariaLabel)} aria-disabled={!!local.disabled} class={"rozie-tags-input"} value={draft()} placeholder={local.placeholder} disabled={!!local.disabled || !!atMax()} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onInput($event); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onKeydown($event); }} onPaste={($event: ClipboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onPaste($event); }} onBlur={($event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }) => { onBlur($event); }} data-rozie-s-64848f8e="" /></Show>}<span class={"rozie-tags-count"} aria-live="polite" data-rozie-s-64848f8e="">{rozieDisplay(countLabel())}</span>
    </div>
    </>
  );
}
