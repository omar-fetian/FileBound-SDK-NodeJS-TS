/**
 * FileBound's universal "nested list" shape.
 * Every nested collection in the API looks like this:
 *   { "totalCount": 0, "collection": [] }
 */
export interface FBCollection<T> {
  totalCount: number;
  collection: T[];
}
