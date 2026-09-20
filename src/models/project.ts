import type { FBCollection } from "./common.js";

/**
 * A FileBound Project, as returned by GET /api/projects.
 *
 * Deliberately minimal - only the fields we currently care about.
 * The wire carries ~70 fields per project; we promise the ones below
 * and leave the rest untyped on purpose. Add fields here when we
 * actually need them, not before.
 */
export interface Project {
  // Identity
  id: number;
  projectId: number; // usually equal to `id`, but both exist on the wire
  name: string;

  // Classification
  projectType: string;
  status: number;
  hidden: boolean;

  // Indexing config
  keyField: number;
  keyVisualField: number;

  // Metadata
  lastUpdated: string; // e.g. "2026-08-17T09:00:30.257"
  lastUpdatedBy: number;

  // Nested collections (empty unless the server chooses to populate them)
  dividers: FBCollection<unknown>;
  fields: FBCollection<unknown>;
  files: FBCollection<unknown>;
  separators: FBCollection<unknown>;
}
