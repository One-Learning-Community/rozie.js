import type { Snippet } from 'svelte';
interface Props {
    items?: any[];
    itemKey?: (string | ((...args: any[]) => any)) | null;
    handle?: (string) | null;
    group?: (string) | null;
    animation?: number;
    disabled?: boolean;
    disableKeyboard?: boolean;
    options?: any;
    labelFor?: ((...args: any[]) => any) | null;
    ghostClass?: (string) | null;
    chosenClass?: (string) | null;
    dragClass?: (string) | null;
    filter?: (string) | null;
    easing?: (string) | null;
    forceFallback?: boolean;
    swapThreshold?: number;
    cloneable?: boolean;
    listClass?: string | any[] | any;
    itemClass?: string | any[] | any | ((...args: any[]) => any);
    itemStyle?: (string | any | ((...args: any[]) => any)) | null;
    header?: Snippet;
    children?: Snippet<[{
        item: any;
        index: any;
    }]>;
    footer?: Snippet;
    snippets?: Record<string, any>;
    onchange?: (...args: unknown[]) => void;
    onadd?: (...args: unknown[]) => void;
    onremove?: (...args: unknown[]) => void;
    onstart?: (...args: unknown[]) => void;
    onend?: (...args: unknown[]) => void;
    [key: string]: unknown;
}
declare const SortableList: import("svelte").Component<Props, {
    getInstance: () => any;
    toArray: () => any;
    sort: (order: any, useAnimation?: boolean) => void;
    option: (name: any, value: any) => any;
}, "items">;
type SortableList = ReturnType<typeof SortableList>;
export default SortableList;
