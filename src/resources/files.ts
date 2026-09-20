import { buildFilter, type FilterInput, type RangeOptions } from '../query/filter.js';
import type { FileBoundClient } from "../core/client.js";
import type { CreateFileInput, File } from "../models/file.js";
import { paginate } from "../query/pagination.js";

export interface ListFilesOptions extends RangeOptions {
  /** Raw FileBound filter, e.g. "projectid_1237,status_1". */
  filter?: FilterInput;
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

  /**
   * GET /api/files - files the current user can see.
   *
   * FileBound's /files endpoint requires RangeBegin/RangeLength for
   * some filters (notably `projectid_X`) or it returns HTTP 500
   * "unsupported File data request". Pass them here.
   *
   * Example:
   *   client.files.list({
   *     filter: 'projectid_1246',
   *     rangeBegin: 1,
   *     rangeLength: 50,
   *   })
   * builds: /api/files?filter=projectid_1246,RangeBegin_1,RangeLength_50
   */

  async *paginate(
    opts: ListFilesOptions & { pageSize?: number } = {},
  ): AsyncGenerator<File> {
    const { pageSize = 100, ...rest } = opts;
    yield* paginate<File>(
      (range) => this.list({ ...rest, ...range }),
      pageSize,
    );
  }

  // ---- Reads --------------------------------------------------------------

  /** GET /api/files - all files the current user can see. */
  async list(opts: ListFilesOptions = {}): Promise<File[]> {
    const filter = buildFilter(opts.filter, opts);
    const query = filter ? `?filter=${filter}` : "";
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

  /**
   * Convenience: list files in one project with sensible default paging.
   * This is the "always works" path for the common case.
   */
  async listByProject(
    projectId: number,
    opts: RangeOptions = { rangeBegin: 1, rangeLength: 100 },
  ): Promise<File[]> {
    return this.list({ filter: `projectid_${projectId}`, ...opts });
  }
}
