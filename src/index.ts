export { FileBoundClient } from "./core/client.js";
export type { FileBoundClientOptions, AuthMode } from "./core/client.js";
export type { LoginResult } from "./core/auth/strategy.js";
export type { RangeOptions, FilterInput } from "./query/filter.js";
// Resources
export { ProjectsResource } from "./resources/projects.js";
export type { ListProjectsOptions } from "./resources/projects.js";
export { FilesResource } from "./resources/files.js";
export type { ListFilesOptions } from "./resources/files.js";
export { DocumentsResource } from "./resources/documents.js";
export type { ListDocumentsOptions } from "./resources/documents.js";

// Models
export type { Project } from "./models/project.js";
export type { FBCollection } from "./models/common.js";
export type { File, CreateFileInput } from "./models/file.js";
export type {
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
} from "./models/document.js";
