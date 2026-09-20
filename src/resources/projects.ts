import type { FileBoundClient } from "../core/client.js";
import type { Project } from "../models/project.js";
import {
  buildFilter,
  type FilterInput,
  type RangeOptions,
} from "../query/filter.js";
import { paginate } from "../query/pagination.js";

/** Options accepted by list-style methods. */
export interface ListProjectsOptions extends RangeOptions {
  filter?: FilterInput;
}

/**
 * Everything you can do with /api/projects.
 *
 * Note what this class does NOT do:
 *   - It never imports `fetch`, `Transport`, or any auth class.
 *   - It never builds query strings by hand beyond `?filter=`.
 *   - It never touches `process.env`.
 * All of that is the client's job. This is just "the projects endpoint,
 * spelled out as methods."
 */
export class ProjectsResource {
  constructor(private readonly client: FileBoundClient) {}

  /** GET /api/projects - all projects the current user can see. */
  async list(opts: ListProjectsOptions = {}): Promise<Project[]> {
    const filter = buildFilter(opts.filter, opts);
    const query = filter ? `?filter=${filter}` : "";
    return this.client.get<Project[]>(`/projects${query}`);
  }

  async *paginate(
    opts: ListProjectsOptions & { pageSize?: number } = {},
  ): AsyncGenerator<Project> {
    const { pageSize = 100, ...rest } = opts;
    yield* paginate<Project>(
      (range) => this.list({ ...rest, ...range }),
      pageSize,
    );
  }

  /** GET /api/projects/{id} - one project, or throws if not found. */
  async get(id: number): Promise<Project> {
    return this.client.get<Project>(`/projects/${id}`);
  }

  /**
   * Convenience: find a single project by exact name.
   * Returns undefined if there are zero OR more than one match
   * (FileBound does not enforce unique project names).
   */
  async getByName(name: string): Promise<Project | undefined> {
    const matches = await this.list({ filter: `name_${name}` });
    return matches.length === 1 ? matches[0] : undefined;
  }
}
