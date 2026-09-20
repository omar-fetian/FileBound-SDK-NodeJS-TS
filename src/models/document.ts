/**
 * A FileBound Document, as returned by GET /api/documents/{id}.
 * Minimal by design - add fields as we need them.
 *
 * Note: objectType is 6 for Document (see ObjectType enum).
 */
export interface Document {
  // Identity
  id: number;
  documentId: number;
  fileId: number;

  // Classification
  name: string;
  extension: string;
  divider: string;
  separator: string;
  status: number;          // see DocumentStatus enum (1 = Active)
  objectType: number;      // 6 = Document

  // Free text
  notes: string;
  description: string;

  // Metadata
  documentSize: number;
  pages: number;
  dateCreated: string;
  dateFiled: string;

  /**
   * Base64-encoded bytes. Only present when the request asked for it
   * (e.g. `?binaryData=true`). Otherwise this may be missing or empty.
   */
  binaryData?: string | null;
}

/** What you send to create a new document via PUT /documents/{fileId}. */
export interface CreateDocumentInput {
  divider: string;
  extension: string;
  /** Defaults to 1 (Active). */
  status?: number;
  /** Defaults to `document.<extension>` if not provided. */
  name?: string;
  separator?: string;
  notes?: string;
  /**
   * Base64-encoded bytes. If omitted, the document is created with
   * empty binary data and can be filled later via the multipart endpoints.
   */
  binaryData?: string;
  /** Defaults to true. */
  allowSaveBinaryData?: boolean;
}

/** What you send to update document metadata via POST /documents/{documentId}. */
export interface UpdateDocumentInput {
  divider?: string;
  separator?: string;
  status?: number;
  extension?: string;
  name?: string;
  notes?: string;
  description?: string;
  /**
   * Whether to also send binaryData in this update. Defaults to false,
   * which makes the endpoint act as a metadata-only update
   * (setBinaryData=false on the query string).
   */
  setBinaryData?: boolean;
  /** Base64 bytes; only used when setBinaryData is true. */
  binaryData?: string;
}