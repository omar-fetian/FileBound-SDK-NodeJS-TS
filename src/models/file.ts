import type { FBCollection } from "./common.js";

/**
 * A FileBound File, as returned by GET /api/files.
 *
 * Minimal by design. Add fields as we need them.
 */
export interface File {
  // Identity
  id: number;
  fileId: number; // usually equal to `id`
  projectId: number;
  projectName: string;

  // Index values - THE important part of FileBound
  // field[0] is a placeholder; field[1] is field 1's value, etc.
  field: string[];
  formattedField: string[];

  // Convenience copies of the key field value(s)
  keyValue: string;
  keyVisualValue: string;

  // Metadata
  notes: string;
  status: number; // 1 = Active
  isIndexed: boolean;
  lastUpdated: string;

  // Nested collections (empty unless populated)
  documents: FBCollection<unknown>;
}

/**
 * What you send to create a new file.
 * Only the writable fields - the server fills everything else.
 */
export interface CreateFileInput {
  projectId: number;
  /** Index values. Index 0 is ignored by the server. */
  field?: string[];
  notes?: string;
}
