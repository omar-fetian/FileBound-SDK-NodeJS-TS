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

  const targetFile = await client.files.get(4242);
  console.log(
    `Using file [${targetFile.fileId}] in "${targetFile.projectName}".`,
  );

  // Path relative to where `pnpm run dev` is executed (project root).
  const localPath = join(process.cwd(), "samples/ImageDoc_001.tiff");

  // Upload the file to the target file in FileBound.
  await client.documents.upload(targetFile.fileId, localPath, {
    divider: "EXAMPLE",
    status: 1,
    name: 'Example Upload',
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
