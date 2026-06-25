import type { Snippet } from 'svelte';
interface Props {
    /**
     * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
     * @example
     * <CommandPalette r-model:open="paletteOpen" :items="commands" />
     */
    open?: boolean;
    /**
     * The current search text (two-way `r-model`). Two-way bind it to read or pre-seed the query; the component filters `items` by this string over each item `label` plus its `keywords`. Cleared to `""` whenever the palette opens.
     */
    query?: string;
    /**
     * The command list — `[{ id, label, group?, keywords?, disabled? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` buckets items under a heading; optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation.
     */
    items?: any[];
    /**
     * Placeholder text shown in the search input while the query is empty.
     */
    placeholder?: string;
    /**
     * Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup.
     */
    emptyText?: string;
    /**
     * Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row.
     */
    closeOnSelect?: boolean;
    /**
     * Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands").
     */
    ariaLabel?: string;
    /**
     * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
     */
    idBase?: string;
    item?: Snippet<[{
        item: any;
        active: any;
    }]>;
    empty?: Snippet;
    footer?: Snippet;
    snippets?: Record<string, any>;
    onselect?: (...args: unknown[]) => void;
    [key: string]: unknown;
}
declare const CommandPalette: import("svelte").Component<Props, {
    show: () => void;
    close: () => void;
    toggle: () => void;
    focus: () => void;
}, "open" | "query">;
type CommandPalette = ReturnType<typeof CommandPalette>;
export default CommandPalette;
