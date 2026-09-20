import "dotenv/config";
import { FileBoundClient } from "../src/index.js";
import { writeFile, unlink, access } from "node:fs/promises";
import { join, basename } from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. Check your .env file.`);
  return value;
}

async function main() {
  const client = new FileBoundClient({
    baseUrl: requireEnv("FILEBOUND_CLOUD_OFETIAN_BASE_URL"),
    username: requireEnv("FILEBOUND_CLOUD_OFETIAN_USERNAME"),
    password: requireEnv("FILEBOUND_CLOUD_OFETIAN_PASSWORD"),
    authMode:
      (process.env.FILEBOUND_CLOUD_OFETIAN_AUTH_MODE as "guid" | "basic") ??
      "guid",
  });

  await client.login();

  // ---- Setup -------------------------------------------------------------

  const targetProject = await client.projects.getByName(
    "AP Checks Destination",
  );
  if (!targetProject)
    throw new Error('Project "AP Checks Destination" not found.');
  console.log(
    `Using project [${targetProject.projectId}] "${targetProject.name}".`,
  );

  const files = await client.files.listByProject(targetProject.projectId);
  if (files.length === 0) {
    throw new Error(`No files in project ${targetProject.projectId}.`);
  }
  const targetFile = files[0];
  console.log(`Using file [${targetFile.fileId}] in "${targetProject.name}".`);

  // ---- Cleanup any leftover test documents ------------------------------
  // (Safe to remove once you stop iterating on this example.)

  const beforeCleanup = await client.documents.listByFile(targetFile.fileId);
  for (const d of beforeCleanup) {
    const isTestDoc =
      (d.name ?? "").startsWith("hello-from-sdk") ||
      (d.name ?? "").startsWith("sdk-upload") ||
      (d.name ?? "").startsWith("sdk-replacement") ||
      (d.name ?? "") === "";
    if (isTestDoc) {
      await client.documents.delete(d.documentId);
      console.log(
        `Cleaned leftover test doc id=${d.documentId} name="${d.name}"`,
      );
    }
  }

  // ---- Multipart upload demo --------------------------------------------

  console.log("\n--- Multipart upload demo ---");

  // Path relative to where `pnpm run dev` is executed (project root).
  const localPath = join(process.cwd(), "samples", "ImageDoc_001.tiff");

  // Sanity-check the file exists before we try to upload it.
  await access(localPath); // throws if missing
  console.log(`Using local file: ${localPath}`);

  // Snapshot ids before upload so we can identify the new one afterward.
  const idsBefore = new Set(
    (await client.documents.listByFile(targetFile.fileId)).map(
      (d) => d.documentId,
    ),
  );

  await client.documents.upload(targetFile.fileId, localPath, {
    divider: "EXAMPLE",
    status: 1,
    name: basename(localPath),
  });
  console.log(`Uploaded "${basename(localPath)}".`);

  const idsAfter = await client.documents.listByFile(targetFile.fileId);
  const newIds = idsAfter
    .filter((d) => !idsBefore.has(d.documentId))
    .map((d) => d.documentId);

  if (newIds.length === 0) {
    throw new Error(
      "Upload succeeded but no new document appeared in the file.",
    );
  }
  const uploadedId = newIds[0];
  console.log(`Server assigned id=${uploadedId}`);

  // Read its bytes back to prove the round-trip.
  const fetchedBytes = await client.documents.getBinary(uploadedId);
  console.log(`Round-trip binary: "${fetchedBytes.toString("utf8")}"`);

  // Probe the documentBinaryData variants so we resolve that endpoint too.
  const replacePath = join(process.cwd(), "samples", "ImageDoc_001.tiff");
  await writeFile(replacePath, "This replaced the original upload.");
  console.log(`\nProbing documentBinaryData variants for doc ${uploadedId}:`);
  await client.documents.probeReplaceBinary(uploadedId, replacePath);

  // Cleanup: delete the uploaded doc; remove the temp replace file.
  try {
    await client.documents.delete(uploadedId);
    console.log(`Deleted test document ${uploadedId}.`);
  } catch (err) {
    console.log(
      `Cleanup: could not delete ${uploadedId}: ${(err as Error).message}`,
    );
  }
  await unlink(replacePath).catch(() => {});
  console.log(`Removed temp replacement file.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});