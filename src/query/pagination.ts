import type { RangeOptions } from "./filter.js";

/**
 * Fetch every page and yield items one at a time.
 *
 * `fetchPage` is a callback the resource supplies. Pagination doesn't
 * know about URLs, filters, or FileBound auth - it just keeps asking
 * for the next page until an empty page comes back.
 *
 * FileBound gives us no total count on list endpoints, so "empty page"
 * is the only reliable stop condition.
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
