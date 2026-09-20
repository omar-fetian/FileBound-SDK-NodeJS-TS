import type { FileBoundClient } from "../core/client.js";
import type { CreateFileInput, File } from "../models/file.js";

export interface ListFilesOptions {
  /** Raw FileBound filter, e.g. "projectid_1237,status_1". */
  filter?: string;
}

/**
 * Everything you can do with /api/files.
 *
 * Unlike Projects, Files are almost always *scoped* - by project, by
 * key value, by an index field. So the interesting methods here are the
 * lookups, not the raw list.
 */
export class FilesResource {
  constructor(private readonly client: FileBoundClient) {}

  // ---- Reads --------------------------------------------------------------

  /** GET /api/files - all files the current user can see. */
  async list(opts: ListFilesOptions = {}): Promise<File[]> {
    const query = opts.filter
      ? `?filter=${encodeURIComponent(opts.filter)}`
      : "";
    return this.client.get<File[]>(`/files${query}`);
  }

  /** GET /api/files/{fileId} - one file. */
  async get(fileId: number): Promise<File> {
    return this.client.get<File>(`/files/${fileId}`);
  }

  /**
   * GET /api/files/{projectId}/ByKeyValue - the single file in a project
   * whose key field matches `value`. Returns the file id, or throws on 404.
   *
   * This is the fast path FileBound provides; prefer it over a filter
   * when you already know the project and the key value.
   */
  async getByKeyValue(projectId: number, value: string): Promise<number> {
    const q = `?value=${encodeURIComponent(value)}`;
    return this.client.get<number>(`/files/${projectId}/ByKeyValue${q}`);
  }

  // ---- Writes -------------------------------------------------------------

  /**
   * PUT /api/files - create a new file.
   * Returns the created File (with server-assigned ids populated).
   */
  async create(input: CreateFileInput): Promise<File> {
    return this.client.put<File>("/files", input);
  }
}
