import type { RangeOptions } from "./filter.js";

/**
 * Generic paginated iterator.
 *
 * FileBound gives us no "total count" on list endpoints, so we keep
 * requesting pages until one comes back empty. `fetchPage` is supplied
 * by each resource so this module stays endpoint-agnostic.
 */
export async function* paginate<T>(
  fetchPage: (range: {
    rangeBegin: number;
    rangeLength: number;
  }) => Promise<T[]>,
  pageSize = 100,
): AsyncGenerator<T> {
  if (pageSize <= 0) throw new Error("pageSize must be > 0");

  let begin = 1; // FileBound ranges are 1-based
  while (true) {
    const page = await fetchPage({ rangeBegin: begin, rangeLength: pageSize });
    if (page.length === 0) return;
    for (const item of page) yield item;
    begin += page.length;
  }
}
