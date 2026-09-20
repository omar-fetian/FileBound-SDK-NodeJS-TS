/**
 * Options for paginated list calls.
 * FileBound treats RangeBegin/RangeLength as FILTER properties,
 * not as separate query-string params. So they get merged into the
 * `filter=...` string like any other property: `RangeBegin_1,RangeLength_50`.
 *
 * Ranges are 1-based: RangeBegin_1 = start from the first record.
 */
export interface RangeOptions {
  rangeBegin?: number;
  rangeLength?: number;
}

/**
 * Merge a raw filter string with range parameters into one filter string.
 * - If nothing is provided, returns undefined (no filter query param).
 * - If only ranges are provided, returns "RangeBegin_X,RangeLength_Y".
 * - If both, they are joined with a comma.
 *
 * Note on encoding: we intentionally do NOT encode the commas or spaces.
 * FileBound's docs explicitly warn against URL-encoding spaces in filters,
 * and the raw comma is the structural separator between properties.
 * Callers are responsible for escaping commas that appear *inside* a value
 * (use "\," per FileBound's own Help section).
 */
export function buildFilter(
  filter: string | undefined,
  ranges: RangeOptions,
): string | undefined {
  const parts: string[] = [];

  if (filter && filter.length > 0) parts.push(filter);
  if (ranges.rangeBegin !== undefined)
    parts.push(`RangeBegin_${ranges.rangeBegin}`);
  if (ranges.rangeLength !== undefined)
    parts.push(`RangeLength_${ranges.rangeLength}`);

  return parts.length > 0 ? parts.join(",") : undefined;
}
