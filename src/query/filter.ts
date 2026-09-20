/**
 * FileBound filter strings look like:
 *   key1_value1,key2_value2,...
 *
 * Rules we've verified from FileBound's own Help section:
 *   - Underscore (`_`) separates key from value.
 *   - Comma (`,`) separates properties.
 *   - A comma INSIDE a value must be escaped as `\,`.
 *   - Spaces must NOT be URL-encoded (the docs' own example says
 *     `Project%20ABC` returns 404; send `Project ABC` instead).
 *   - RangeBegin/RangeLength are FILTER properties, not query params,
 *     and are required by /files and /projects when filtering (we proved
 *     that by hand: ?filter=projectid_1246,RangeBegin_1,RangeLength_50
 *     works; ?filter=projectid_1246 alone returns HTTP 500).
 */

export interface RangeOptions {
  rangeBegin?: number;
  rangeLength?: number;
}

/**
 * A filter can be given as a raw string (escape hatch) or as an object
 * of key/value pairs (friendly form).
 */
export type FilterInput =
  | string
  | Record<string, string | number | boolean | undefined>;

/**
 * Merge a filter (string OR object) with range options into one
 * FileBound filter string.
 *
 * Returns undefined when there is nothing to filter on.
 */
export function buildFilter(
  filter: FilterInput | undefined,
  ranges: RangeOptions = {},
): string | undefined {
  const parts: string[] = [];

  if (typeof filter === "string") {
    if (filter.length > 0) parts.push(filter);
  } else if (filter && typeof filter === "object") {
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined) continue;
      parts.push(`${key}_${escapeValue(String(value))}`);
    }
  }

  if (ranges.rangeBegin !== undefined) {
    parts.push(`RangeBegin_${ranges.rangeBegin}`);
  }
  if (ranges.rangeLength !== undefined) {
    parts.push(`RangeLength_${ranges.rangeLength}`);
  }

  return parts.length > 0 ? parts.join(",") : undefined;
}

/**
 * Escape a value so it survives FileBound's filter parser.
 * Only commas are special *inside* a value. We deliberately do NOT
 * URL-encode anything - see the module docblock above.
 */
function escapeValue(value: string): string {
  return value.replace(/,/g, "\\,");
}
