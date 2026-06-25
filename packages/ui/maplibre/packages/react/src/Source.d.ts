import type { ReactNode } from 'react';

export interface SourceProps {
  /**
   * The MapLibre source id (required). A `LayerSpecification.source` references this string, and nested `<Layer>` children auto-bind to it. Exposed to children as a live getter so it stays reactive.
   * @example
   * <Source id="pts" :spec="geojson"><Layer id="circles" type="circle" /></Source>
   */
  id: string;
  /**
   * The `SourceSpecification` (geojson / vector / raster / …). Registered into the parent `<MapLibre>` on mount and reconciled via `setData` (geojson) or re-add on change, once the style has loaded.
   */
  spec?: unknown;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function Source(props: SourceProps): JSX.Element;
export default Source;
