import type { FileBoundClient } from "../core/client.js";
import type {
  CreateDocumentInput,
  Document,
  UpdateDocumentInput,
} from "../models/document.js";
import {
  buildFilter,
  type FilterInput,
  type RangeOptions,
} from "../query/filter.js";
import { paginate } from "../query/pagination.js";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

export interface ListDocumentsOptions extends RangeOptions {
  filter?: FilterInput;
}

/**
 * Everything you can do with /api/documents.
 *
 * Document routes live in two places on the wire:
 *   - /documents/...           for metadata, list, comments, grouping
 *   - /documentBinaryData/...  for raw bytes
 * Both are surfaced here as methods on the same resource, so callers
 * never think about the two paths.
 */
export class DocumentsResource {
  constructor(private readonly client: FileBoundClient) {}

  // ---- Reads --------------------------------------------------------------

  /**
   * GET /api/documents/{documentId}
   * Options mirror the API: binaryData, includeSignatures.
   */
  async get(
    documentId: number,
    opts: { binaryData?: boolean; includeSignatures?: boolean } = {},
  ): Promise<Document> {
    const params = new URLSearchParams();
    if (opts.binaryData !== undefined)
      params.set("binaryData", String(opts.binaryData));
    if (opts.includeSignatures !== undefined)
      params.set("includeSignatures", String(opts.includeSignatures));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.client.get<Document>(`/documents/${documentId}${qs}`);
  }

  /** GET /api/documents?filter=... */
  async list(opts: ListDocumentsOptions = {}): Promise<Document[]> {
    const filter = buildFilter(opts.filter, opts);
    const query = filter ? `?filter=${filter}` : "";
    return this.client.get<Document[]>(`/documents${query}`);
  }

  /**
   * GET /api/files/{fileId}/documents - documents in one file.
   * Dedicated path; the server does not accept RangeBegin/RangeLength here.
   */
  async listByFile(
    fileId: number,
    opts: { binaryData?: boolean } = {},
  ): Promise<Document[]> {
    const qs =
      opts.binaryData !== undefined ? `?binaryData=${opts.binaryData}` : "";
    return this.client.get<Document[]>(`/files/${fileId}/documents${qs}`);
  }

  /** Iterate every document matching a filter, page by page. */
  async *paginate(
    opts: ListDocumentsOptions & { pageSize?: number } = {},
  ): AsyncGenerator<Document> {
    const { pageSize = 100, ...rest } = opts;
    yield* paginate<Document>(
      (range) => this.list({ ...rest, ...range }),
      pageSize,
    );
  }

  // ---- Binary -------------------------------------------------------------

  /**
   * GET /api/documentBinaryData/{documentId} -> raw bytes.
   * Returns a Node Buffer. Write it to disk with fs.writeFile()
   * or feed it into a stream.
   */
  async getBinary(documentId: number): Promise<Buffer> {
    return this.client.requestBytes("GET", `/documentBinaryData/${documentId}`);
  }

  // ---- Writes -------------------------------------------------------------

  /**
   * PUT /api/documents/{fileId} - create a new document in a file.
   *
   * IMPORTANT: this endpoint returns the new documentId as a bare number,
   * not the created Document. Call `get()` if you need the full object.
   */
  async create(fileId: number, input: CreateDocumentInput): Promise<number> {
    const body = {
      documentId: 0,
      fileId,
      divider: input.divider,
      separator: input.separator ?? "",
      status: input.status ?? 1,
      extension: input.extension,
      name: input.name ?? `document.${input.extension}`,
      notes: input.notes ?? "",
      allowSaveBinaryData: input.allowSaveBinaryData ?? true,
      binaryData: input.binaryData ?? "",
    };
    return this.client.put<number>(`/documents/${fileId}`, body);
  }

  /**
   * POST /api/documents/{documentId}?setBinaryData=false
   * Metadata-only update by default. Pass setBinaryData:true + binaryData
   * to also replace the bytes in one call.
   */
  /**
   * POST /api/documents/{documentId}?setBinaryData=false
   *
   * FileBound treats this as a full replace, not a patch. So we:
   *   1. GET the current document
   *   2. merge your changes on top
   *   3. POST the merged object back
   *
   * This is what the FileBound docs themselves recommend for files,
   * and it holds for documents too. Without it, any field you omit
   * gets reset on the server.
   *
   * By default this is a metadata-only update (setBinaryData=false).
   * Pass setBinaryData:true + binaryData to also replace the bytes.
   */
  async update(
    documentId: number,
    input: UpdateDocumentInput,
  ): Promise<Document> {
    const setBinaryData = input.setBinaryData ?? false;

    // 1. Read current state.
    const current = await this.get(documentId);

    // 2. Merge - explicit undefined means "leave alone".
    const merged = {
      documentId: current.documentId,
      fileId: current.fileId,
      divider: input.divider ?? current.divider,
      separator: input.separator ?? current.separator,
      status: input.status ?? current.status,
      extension: input.extension ?? current.extension,
      name: input.name ?? current.name,
      notes: input.notes ?? current.notes,
      description: input.description ?? current.description,
      allowSaveBinaryData: true,
      binaryData: setBinaryData ? (input.binaryData ?? null) : null,
    };

    const qs = setBinaryData ? "" : "?setBinaryData=false";

    // 3. POST back.
    return this.client.post<Document>(`/documents/${documentId}${qs}`, merged);
  }

  /** DELETE /api/documents/{documentId} */
  async delete(documentId: number): Promise<void> {
    await this.client.delete(`/documents/${documentId}`);
  }

  // ---- Comments -----------------------------------------------------------

  /** PUT /api/documents/{documentId}/comments - returns nothing on success. */
  async addComment(documentId: number, commentText: string): Promise<void> {
    await this.client.put(`/documents/${documentId}/comments`, {
      DocumentId: documentId,
      CommentText: commentText,
    });
  }

  /** GET /api/documents/{documentId}/comments */
  async listComments(documentId: number): Promise<unknown[]> {
    return this.client.get<unknown[]>(`/documents/${documentId}/comments`);
  }

  // ---- Grouping -----------------------------------------------------------

  /** PUT /api/documents/groupDocuments */
  async group(documentIds: number[]): Promise<void> {
    await this.client.put(
      "/documents/groupDocuments",
      documentIds.map((id) => ({ DocumentId: id })),
    );
  }

  /** PUT /api/documents/ungroupDocuments */
  async ungroup(documentIds: number[]): Promise<void> {
    await this.client.put(
      "/documents/ungroupDocuments",
      documentIds.map((id) => ({ DocumentId: id })),
    );
  }

  // ---- Multipart uploads --------------------------------------------------

  /**
   * POST /api/documentUpload - upload one or more files into a file.
   *
   * QUIRK: this endpoint does NOT read the multipart part's filename.
   * Document properties (name, divider, status, ...) are taken from
   * separate form fields. If you don't pass `name`, the new document
   * is stored with an empty name.
   *
   * Also note: it does not return the new document id. To find what
   * was created, diff document ids in the file before/after, or pass
   * a single-file upload and read back the newest doc by dateCreated.
   *
   * `name` (if provided) applies to all files in a single request -
   * so only use it when uploading one file at a time.
   */
  async upload(
    fileId: number,
    filePaths: string | string[],
    opts: {
      divider?: string;
      separator?: string;
      status?: number;
      name?: string;
    } = {},
  ): Promise<unknown> {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    if (paths.length === 0) throw new Error("No files to upload.");

    const form = new FormData();
    form.append("fileId", String(fileId));
    form.append("status", String(opts.status ?? 1));
    if (opts.divider) form.append("divider", opts.divider);
    if (opts.separator) form.append("separator", opts.separator);
    if (opts.name) form.append("name", opts.name);

    for (const p of paths) {
      const buf = await readFile(p);
      const blob = new Blob([buf]);
      form.append("documentToUpload", blob, basename(p));
    }

    return this.client.requestMultipart("POST", "/documentUpload", form);
  }

  /**
   * Update an existing document's bytes via multipart.
   *
   * QUIRK: the API reference says POST /documentBinaryData/{id}, but
   * this server returns 405 for that URL. FileBound's own HTML sample
   * posts to /documentBinaryData with the id in a form field. We follow
   * the sample - it's the one that actually works.
   */
  async replaceBinary(
    documentId: number,
    filePath: string,
    extension?: string,
  ): Promise<unknown> {
    const buf = await readFile(filePath);
    const blob = new Blob([buf]);
    const ext = extension ?? extname(filePath).replace(/^\./, "").toLowerCase();

    const form = new FormData();
    form.append("id", String(documentId));
    form.append("extension", ext);
    form.append("documentToUpload", blob, basename(filePath));

    return this.client.requestMultipart("POST", "/documentBinaryData", form);
  }

  /**
   * TEMPORARY DIAGNOSTIC. Tries three URL shapes for documentBinaryData
   * update and reports which (if any) this server accepts.
   * Delete this method once replaceBinary() is confirmed.
   */
  async probeReplaceBinary(
    documentId: number,
    filePath: string,
  ): Promise<void> {
    const buf = await readFile(filePath);
    const ext = extname(filePath).replace(/^\./, "").toLowerCase();

    const makeForm = (withId: boolean) => {
      const f = new FormData();
      if (withId) f.append("id", String(documentId));
      f.append("extension", ext);
      f.append("documentToUpload", new Blob([buf]), basename(filePath));
      return f;
    };

    const trials: Array<{
      label: string;
      method: string;
      path: string;
      form: FormData;
    }> = [
      {
        label: "A: PUT /api/documentBinaryData/{id}",
        method: "PUT",
        path: `/documentBinaryData/${documentId}`,
        form: makeForm(false),
      },
      {
        label: "B: POST /api/documentBinaryData?id={id}",
        method: "POST",
        path: `/documentBinaryData?id=${documentId}`,
        form: makeForm(false),
      },
      {
        label: "C: POST /api/documentBinaryData (id in body)",
        method: "POST",
        path: `/documentBinaryData`,
        form: makeForm(true),
      },
    ];

    for (const t of trials) {
      try {
        await this.client.requestMultipart(t.method, t.path, t.form);
        console.log(`  ✓ ${t.label} — SUCCESS`);
        return;
      } catch (err) {
        console.log(
          `  ✗ ${t.label} — ${(err as Error).message.split("\n")[0]}`,
        );
      }
    }
    console.log(
      "  (none of the variants worked; will document as unsupported and move on)",
    );
  }

  /**
   * PUT /api/documentBinaryData (multipart)
   * Upload a document into the indexing queue (not tied to a file yet).
   * projectId is optional.
   */
  async addToIndexingQueue(
    filePath: string,
    opts: { projectId?: number; extension?: string } = {},
  ): Promise<unknown> {
    const buf = await readFile(filePath);
    const blob = new Blob([buf]);
    const ext =
      opts.extension ?? extname(filePath).replace(/^\./, "").toLowerCase();

    const form = new FormData();
    form.append("extension", ext);
    if (opts.projectId !== undefined)
      form.append("projectId", String(opts.projectId));
    form.append("documentToUpload", blob, basename(filePath));

    return this.client.requestMultipart("PUT", "/documentBinaryData", form);
  }

  // ---- Renditions ---------------------------------------------------------

  /**
   * GET /api/documents/{documentId}/rendition?page=N -> raw image bytes.
   *
   * REQUIRES the Accept header. FileBound's rendition endpoint uses it
   * to pick a renderer; without it the server returns HTTP 500
   * "Object reference not set to an instance of an object".
   *
   * Only meaningful for renderable documents (images, PDFs). Plain text
   * files have no rendition and also return 500 from this endpoint -
   * that's a server limitation, not an SDK one.
   */
  async getRendition(
    documentId: number,
    page = 1,
    accept: string = "image/png",
  ): Promise<Buffer> {
    return this.client.requestBytes(
      "GET",
      `/documents/${documentId}/rendition?page=${page}`,
      { Accept: accept },
    );
  }
}
