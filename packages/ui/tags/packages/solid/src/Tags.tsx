import type { JSX } from 'solid-js';
import { Show, createSignal, mergeProps, onMount, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('Tags-64848f8e', `.rozie-tags[data-rozie-s-64848f8e] {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rozie-tags-gap, var(--rtg-gap, 0.4rem));
  padding: var(--rozie-tags-padding, var(--rtg-padding, 0.35rem 0.45rem));
  font: var(--rozie-tags-font, inherit);
  background: var(--rozie-tags-bg, var(--rtg-bg, #fff));
  border: var(--rozie-tags-border-width, var(--rtg-border-width, 1px)) solid var(--rozie-tags-border-color, var(--rtg-border-color, rgba(0, 0, 0, 0.25)));
  border-radius: var(--rozie-tags-radius, var(--rtg-radius, 0.5rem));
  min-width: var(--rozie-tags-min-width, var(--rtg-min-width, 12rem));
}
.rozie-tags[data-rozie-s-64848f8e]:focus-within {
  border-color: var(--rozie-tags-accent, var(--rtg-accent, #0066cc));
  box-shadow: 0 0 0 var(--rozie-tags-focus-ring-width, var(--rtg-focus-ring-width, 3px)) var(--rozie-tags-focus-ring-color, var(--rtg-focus-ring-color, rgba(0, 102, 204, 0.25)));
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
  gap: var(--rozie-tags-chip-gap, var(--rtg-chip-gap, 0.3rem));
  padding: var(--rozie-tags-chip-padding, var(--rtg-chip-padding, 0.15rem 0.5rem));
  font-size: var(--rozie-tags-chip-font-size, var(--rtg-chip-font-size, 0.85rem));
  color: var(--rozie-tags-chip-color, var(--rtg-chip-color, inherit));
  background: var(--rozie-tags-chip-bg, var(--rtg-chip-bg, rgba(0, 102, 204, 0.12)));
  border-radius: var(--rozie-tags-chip-radius, var(--rtg-chip-radius, 0.375rem));
  white-space: nowrap;
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rozie-tags-remove-size, var(--rtg-remove-size, 1.1rem));
  height: var(--rozie-tags-remove-size, var(--rtg-remove-size, 1.1rem));
  padding: 0;
  font: inherit;
  line-height: 1;
  color: var(--rozie-tags-remove-color, var(--rtg-remove-color, currentColor));
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: var(--rozie-tags-remove-opacity, var(--rtg-remove-opacity, 0.65));
  transition: opacity 0.15s, background 0.15s;
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e]:hover:not([data-rozie-s-64848f8e]:disabled) {
  opacity: 1;
  background: var(--rozie-tags-remove-hover-bg, var(--rtg-remove-hover-bg, rgba(0, 0, 0, 0.1)));
}
.rozie-tags-chip__remove[data-rozie-s-64848f8e]:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.rozie-tags-input[data-rozie-s-64848f8e] {
  flex: 1 1 var(--rozie-tags-input-min, var(--rtg-input-min, 4rem));
  min-width: var(--rozie-tags-input-min, var(--rtg-input-min, 4rem));
  padding: var(--rozie-tags-input-padding, var(--rtg-input-padding, 0.15rem 0.1rem));
  font: inherit;
  color: var(--rozie-tags-color, var(--rtg-color, inherit));
  background: transparent;
  border: none;
  outline: none;
}
.rozie-tags-input[data-rozie-s-64848f8e]::placeholder {
  color: var(--rozie-tags-placeholder-color, var(--rtg-placeholder-color, rgba(0, 0, 0, 0.4)));
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
  opacity: var(--rozie-tags-disabled-opacity, var(--rtg-disabled-opacity, 0.6));
  background: var(--rozie-tags-disabled-bg, var(--rtg-disabled-bg, rgba(0, 0, 0, 0.04)));
}
@media (prefers-color-scheme: dark) {
    :where(:root:not(.light):not([data-theme="light"])) {
      --rtg-bg: #1e293b;
      --rtg-border-color: rgba(255, 255, 255, 0.16);
      --rtg-accent: #60a5fa;
      --rtg-focus-ring-color: rgba(96, 165, 250, 0.35);
      --rtg-chip-bg: rgba(96, 165, 250, 0.22);
      --rtg-remove-hover-bg: rgba(255, 255, 255, 0.14);
      --rtg-placeholder-color: rgba(255, 255, 255, 0.45);
      --rtg-disabled-bg: rgba(255, 255, 255, 0.06);
    }
  }`);

interface TagSlotCtx { tag: any; index: any; remove: any; }

interface TagsProps extends Omit<import('solid-js').ComponentProps<'div'>, 'modelValue' | 'defaultModelValue' | 'onModelValueChange' | 'delimiters' | 'allowDuplicates' | 'max' | 'disabled' | 'readonly' | 'validate' | 'placeholder' | 'ariaLabel' | 'onChange' | 'onAdd' | 'onRemove' | 'tagSlot' | 'slots' | 'ref' | 'children' | 'innerHTML' | 'innerText' | 'textContent'> {
  /**
   * The committed tokens — `model: true`, so a commit/remove/paste writes a **fresh** array back through `r-model:modelValue` (uncontrolled fallback `[]`). Because it is the sole model prop, the Angular output is a `ControlValueAccessor` (`[formControl]` / `[(ngModel)]` bind directly).
   * @example
   * <Tags modelValue={skills()} onModelValueChange={setSkills} placeholder="Add a skill…" />
   */
  modelValue?: any[];
  defaultModelValue?: any[];
  onModelValueChange?: (modelValue: any[]) => void;
  /**
   * The keys that commit the current draft as a token (matched against the key event's `key`). Default `[',', 'Enter']`. Non-`'Enter'` entries also act as the split characters when pasting bulk text: a paste containing one is split and every part is added, and the parts that are rejected (by `validate` or `max`) are inserted at the caret, so the typed draft is kept. A paste with no split character is ordinary text. Use e.g. `[' ', 'Enter']` for a space-delimited input.
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
  validate?: ((...args: any[]) => any) | null;
  /**
   * Placeholder text for the inline text input (e.g. `"Add a tag…"`).
   */
  placeholder?: string;
  /**
   * Accessible name for the whole control (`role="group"`). The inline text input is labelled with the same name so assistive tech announces what is being entered. A visually-hidden live region announces the current token count on change.
   */
  ariaLabel?: (string) | null;
  onChange?: (...args: any[]) => void;
  onAdd?: (...args: any[]) => void;
  onRemove?: (...args: any[]) => void;
  tagSlot?: (ctx: TagSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: TagsHandle) => void;
}

export interface TagsHandle {
  clear: (...args: any[]) => any;
  focus: (...args: any[]) => any;
}

export default function Tags(_props: TagsProps): JSX.Element {
  const _merged = mergeProps({ delimiters: (() => [',', 'Enter'])() as any[], allowDuplicates: false, max: null, disabled: false, readonly: false, validate: null, placeholder: '', ariaLabel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['modelValue', 'delimiters', 'allowDuplicates', 'max', 'disabled', 'readonly', 'validate', 'placeholder', 'ariaLabel', 'ref', 'onChange', 'onAdd', 'onRemove']);
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
  // Normalize → validate → dedup → cap ONE candidate against the running list
  // `cur`. Returns `{ value }` to add, or `value: null` with a reason: 'duplicate' (already a
  // token — dropping it loses nothing) or 'rejected' (empty, invalid or over the
  // cap).
  function candidateFor(raw: any, cur: any) {
    let candidate = String(raw == null ? '' : raw).trim();
    if (!candidate) return {
      value: null,
      reject: 'rejected'
    };
    if (typeof local.validate === 'function') {
      const result = local.validate(candidate, cur);
      if (!result) return {
        value: null,
        reject: 'rejected'
      };
      candidate = String(result);
      if (!candidate) return {
        value: null,
        reject: 'rejected'
      };
    }
    if (!local.allowDuplicates && cur.indexOf(candidate) !== -1) return {
      value: null,
      reject: 'duplicate'
    };
    if (typeof local.max === 'number' && cur.length >= local.max) return {
      value: null,
      reject: 'rejected'
    };
    return {
      value: candidate,
      reject: ''
    };
  }

  // Add every raw candidate in order: ONE model write (commitTokens) with the
  // accumulated list, then one `add` per added token with the running list as of
  // that token. Accumulating locally matters: re-reading `tokens()` between adds
  // in one handler sees the pre-write list on React (and on Vue until the next
  // tick), so a multi-part paste used to keep only its last part. Returns the
  // added tokens and the raw candidates that were rejected (duplicates are neither).
  function addTokens(raws: any) {
    if (!canEdit()) return {
      added: [],
      rejected: raws.slice()
    };
    let next = tokens();
    const added = [];
    const snapshots = [];
    const rejected = [];
    for (let i = 0; i < raws.length; i++) {
      const r = candidateFor(raws[i], next);
      if (r.value === null) {
        if (r.reject === 'rejected') rejected.push(raws[i]);
        continue;
      }
      next = next.concat([r.value]);
      added.push(r.value);
      snapshots.push(next);
    }
    if (added.length > 0) commitTokens(next);
    for (let i = 0; i < added.length; i++) {
      _props.onAdd?.({
        value: added[i],
        tokens: snapshots[i]
      });
    }
    return {
      added,
      rejected
    };
  }

  // Add one candidate. Returns true if it was added (so the caller can clear the
  // draft).
  function addToken(raw: any) {
    return addTokens([raw]).added.length === 1;
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

  // insertAtCaret(el, text): insert `text` into the input at the caret, replacing
  // the selection — what an ordinary paste does — and leave the caret after it.
  // The element is written directly too: Angular skips a `[value]` write when the
  // bound value equals the last RENDERED one.
  function insertAtCaret(el: any, text: any) {
    const cur = el && typeof el.value === 'string' ? el.value : String(draft());
    const start = el && typeof el.selectionStart === 'number' ? el.selectionStart : cur.length;
    const end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
    const next = cur.slice(0, start) + text + cur.slice(end);
    setDraft(next);
    if (el && typeof el.value === 'string' && el.value !== next) el.value = next;
    const caret = start + text.length;
    if (el && typeof el.setSelectionRange === 'function') el.setSelectionRange(caret, caret);
  }

  // Paste: text containing a delimiter character is split on them and bulk-added;
  // the parts that are rejected (invalid, or over `max`) are inserted at the caret
  // as an ordinary paste would be, so the typed draft is kept. Text with no
  // delimiter is an ordinary paste into the draft (the browser handles it).
  function onPaste(e: any) {
    if (!canEdit()) return;
    const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
    const seps = splitChars();
    let hasSep = false;
    for (let s = 0; s < seps.length; s++) {
      if (text.indexOf(seps[s]) !== -1) hasSep = true;
    }
    if (!hasSep) return;
    if (e) e.preventDefault();
    let parts = [text];
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
    const trimmed = parts.map((p: any) => String(p).trim()).filter((p: any) => p.length > 0);
    const rejected = addTokens(trimmed).rejected;
    if (rejected.length > 0) insertAtCaret(e ? e.target : null, rejected.join(seps[0] + ' '));
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
          {(_props.tagSlot ?? _props.slots?.['tag'])?.({ get tag() { return t(); }, get index() { return tokens().indexOf(t()); }, remove: () => removeAt(tokens().indexOf(t())) }) ?? <><span class={"rozie-tags-chip__label"} data-rozie-s-64848f8e="">{rozieDisplay(t())}</span>{<Show when={!local.readonly}><button type="button" aria-label={rozieAttr(removeLabel(t()))} class={"rozie-tags-chip__remove"} disabled={!!local.disabled} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { removeAt(tokens().indexOf(t())); }} data-rozie-s-64848f8e="">×</button></Show>}</>}
        </li>}</Key>
      </ul>

      {<Show when={!local.readonly}><input type="text" autocomplete="off" autocapitalize="off" aria-label={rozieAttr(local.ariaLabel)} aria-disabled={!!local.disabled} class={"rozie-tags-input"} value={draft()} placeholder={local.placeholder} disabled={!!local.disabled || !!atMax()} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onInput($event); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onKeydown($event); }} onPaste={($event: ClipboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onPaste($event); }} onBlur={($event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }) => { onBlur($event); }} data-rozie-s-64848f8e="" /></Show>}<span class={"rozie-tags-count"} aria-live="polite" data-rozie-s-64848f8e="">{rozieDisplay(countLabel())}</span>
    </div>
    </>
  );
}
