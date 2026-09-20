# FileBound SDK (Node.js / TypeScript)

A small, typed Node.js SDK for the [FileBound Web API](https://ofetian.filebound.com/api).

Built module-by-module, tested against a live FileBound v9.0.4.0 site,
and documented honestly — including the places where FileBound's own
API reference and the live server disagree.

---

## Status

**Early but usable.** The following resources are implemented, tested,
and stable:

| Resource    | Operations                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects`  | list, get, getByName, paginate                                                                                                                 |
| `files`     | list, listByProject, get, getByKeyValue, create, paginate                                                                                      |
| `documents` | list, listByFile, get, getBinary, create, update, delete, addComment, listComments, group, ungroup, upload (multipart), getRendition, paginate |

Authentication (GUID + Basic), filtering, and pagination are complete.

**Not yet implemented:** `routes`, `routedItems`, `routeSteps`,
`assignments`, `users`, `groups`, `reports`, `eforms`.

---

## Install

```bash
pnpm install
```

Requires **Node 18+** (uses the built-in `fetch`, `FormData`, and
`Blob`).

---

## Quick start

### 1. Configure credentials

Create `.env` in the project root:

```env
FILEBOUND_CLOUD_OFETIAN_BASE_URL=https://ofetian.filebound.com
FILEBOUND_CLOUD_OFETIAN_USERNAME=your.username
FILEBOUND_CLOUD_OFETIAN_PASSWORD=your-password
FILEBOUND_CLOUD_OFETIAN_AUTH_MODE=guid
```

`AUTH_MODE` is either `guid` (default) or `basic`.

### 2. Your first script

```ts
import "dotenv/config";
import { FileBoundClient } from "./src/index.js";

const client = new FileBoundClient({
  baseUrl: process.env.FILEBOUND_CLOUD_OFETIAN_BASE_URL!,
  username: process.env.FILEBOUND_CLOUD_OFETIAN_USERNAME!,
  password: process.env.FILEBOUND_CLOUD_OFETIAN_PASSWORD!,
});

const projects = await client.projects.list();
for (const p of projects) {
  console.log(`[${p.projectId}] ${p.name}`);
}
```

Run it with `pnpm run dev` (uses `tsx` — no build step needed).

---

## Authentication

Two modes, picked at construction time via `authMode`:

### GUID (default)

Logs in once via `POST /api/login`, caches the returned GUID for 23
hours, and appends `?guid=…` to every subsequent request. Single-flight
safe: concurrent first calls only trigger one login.

### Basic

Stateless. Every request carries an
`Authorization: Basic <base64(user:pass)>` header. No login round-trip.

### Verbs

```ts
await client.login(); // ensure a session; no-op in Basic mode
client.logout(); // forget cached credentials
client.isAuthenticated(); // are we ready without a round-trip?
```

You never _have_ to call `login()` — the first request will log in
lazily. Call it up front when you want to fail fast on bad credentials.

**Note:** FileBound has no server-side logout. `logout()` only clears
the local GUID cache; the server-side session expires on its own after
24 hours.

---

## Using resources

Every resource returns typed objects and takes a filter as either a raw
string or a friendly object.

### Projects

```ts
const all = await client.projects.list();
const one = await client.projects.get(1237);
const named = await client.projects.getByName("Archive Project");
// getByName returns undefined if 0 or 2+ projects match.

for await (const p of client.projects.paginate({ pageSize: 50 })) {
  console.log(p.name);
}
```

### Files

```ts
const inProject = await client.files.listByProject(1237);

const byKey = await client.files.getByKeyValue(1237, "ABC-123");
// Returns the numeric fileId, not a File object.

const created = await client.files.create({
  projectId: 1237,
  field: ["", "ABC-124", "some value"], // index 0 is ignored
  notes: "Created from the SDK",
});
```

### Documents

```ts
// Read
const doc = await client.documents.get(9323);
const inFile = await client.documents.listByFile(4242);
const bytes = await client.documents.getBinary(9323); // Buffer

// Create (returns the new documentId as a number)
const newId = await client.documents.create(4242, {
  divider: "Example",
  extension: "txt",
  name: "greeting.txt",
  binaryData: Buffer.from("Hello").toString("base64"),
});

// Update metadata only (does GET-merge-POST under the hood)
await client.documents.update(newId, { name: "greeting-v2.txt" });

// Multipart upload from disk (returns nothing useful — find the new
// doc by diffing ids before/after, or by unique name)
await client.documents.upload(4242, "./samples/upload-me.txt", {
  divider: "EXAMPLE",
  name: "upload-me.txt",
});

// Comments
await client.documents.addComment(newId, "Reviewed.");
const comments = await client.documents.listComments(newId);

// Grouping
await client.documents.group([100, 101, 102]);
await client.documents.ungroup([100, 101, 102]);

// Delete
await client.documents.delete(newId);
```

### Filtering

Two forms, same wire format:

```ts
// Raw string (escape hatch)
client.files.list({ filter: "projectid_1237,status_1" });

// Object (friendly)
client.files.list({ filter: { projectId: 1237, status: 1 } });
```

Both produce `?filter=projectid_1237,status_1`.

Commas **inside values** are escaped automatically:

```ts
client.projects.list({ filter: { name: "Foo, Bar, and Baz" } });
// -> ?filter=name_Foo\, Bar\, and Baz
```

Spaces are **not** URL-encoded — FileBound rejects `%20`.

### Pagination

Every list method has a matching `paginate()` that returns an
`AsyncGenerator`:

```ts
for await (const doc of client.documents.paginate({
  filter: { projectId: 1237 },
  pageSize: 50,
})) {
  console.log(doc.documentId, doc.name);
}
```

Pages stop when the server returns an empty array. FileBound gives no
total count, so "empty page" is the only reliable stop condition.

---

## Project layout

```
src/
├── core/
│   ├── client.ts              FileBoundClient — composition root
│   ├── transport.ts           fetch wrapper (JSON, bytes, multipart)
│   └── auth/
│       ├── strategy.ts        interface every auth mode implements
│       ├── basic-auth.ts      Authorization header, stateless
│       └── guid-session.ts    24h GUID lifecycle + single-flight
├── resources/
│   ├── projects.ts
│   ├── files.ts
│   └── documents.ts
├── models/
│   ├── common.ts              FBCollection<T> and shared types
│   ├── project.ts
│   ├── file.ts
│   └── document.ts
├── query/
│   ├── filter.ts              filter DSL + comma escaping
│   └── pagination.ts          async iterator over pages
└── index.ts                   public surface

examples/quickstart.ts         live demo against a real site
docs/quirks.md                 verified deviations from the API docs
samples/upload-me.txt          test fixture used by the demo
```

Only `src/index.ts` is exported. Everything else is private.

---

## Design principles

1. **Composition root.** `FileBoundClient` wires together a
   `Transport` and an `AuthStrategy`. Resources receive the client
   and call `client.get/post/put/delete`. They never see `fetch` or
   auth. Adding a new resource touches three lines in `client.ts`.

2. **Type what we use.** Models are deliberately minimal. The server
   returns 40–80 fields per object; we type the handful callers
   actually reach for. Extra fields are present at runtime but not
   promised by TypeScript.

3. **Don't hide server errors.** When FileBound returns 500, the SDK
   throws. Callers who want leniency (e.g. "renditions on text files
   are expected to fail") add their own `try/catch`. Silently
   swallowing errors would make bugs invisible.

4. **Match the wire, not the docs.** When the reference and the live
   server disagree, the wire wins. `docs/quirks.md` records the
   differences.

---

## Known limitations

Documented in [`docs/quirks.md`](./docs/quirks.md). Highlights:

- **`documentBinaryData` update is not supported** on FileBound
  v9.0.4.0. All three plausible URLs return 404 or 405.
  Workaround: delete + re-create, or use the web UI.
- **Renditions on plain-text documents return 500.** Renditions are
  only meaningful for images and PDFs.
- **`/files?filter=projectid_X`** alone returns 500. Add
  `RangeBegin`/`RangeLength`. `listByProject()` handles this for you.
- **`/documentUpload` ignores the multipart filename.** Send `name`
  as a separate form field (`upload({ name: … })` does this).
- **Filter values must not be URL-encoded.** Raw spaces, escaped
  commas. `buildFilter()` handles this.

---

## Testing against a live site

The examples write to a real FileBound site. **Every write the demo
performs is cleaned up at the end** — the test document is deleted and
any temp files are removed. If a run fails partway through, leftover
test documents are reaped on the next run by a cleanup block that
matches names starting with `hello-from-sdk`, `sdk-upload`, or
`sdk-replacement`.

Be careful with credentials. Use a test account with a sandbox
project, not an admin account on a production site.

---

## Scripts

```bash
pnpm run dev         # run examples/quickstart.ts
pnpm run typecheck   # tsc --noEmit
```

---

## Roadmap

- [x] Auth (GUID + Basic), login/logout, lazy session
- [x] `projects` resource
- [x] `files` resource
- [x] `documents` resource (metadata, binary, multipart, comments, grouping)
- [x] Filter DSL (object + string), comma escaping
- [x] Async pagination
- [ ] `routes`, `routedItems`, `routeSteps` (workflow)
- [ ] `assignments`
- [ ] `users`, `groups`
- [ ] `reports`, `eforms`
- [ ] Mock transport for offline unit tests
- [ ] Contract tests against recorded fixtures

---

## License

Private project — not yet published.
