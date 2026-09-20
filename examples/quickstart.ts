import "dotenv/config";
import { FileBoundClient } from "../src/index.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. Check your .env file.`);
  return value;
}

async function main() {
  const client = new FileBoundClient({
    baseUrl: requireEnv("FILEBOUND_BASE_URL"),
    username: requireEnv("FILEBOUND_USERNAME"),
    password: requireEnv("FILEBOUND_PASSWORD"),
    authMode: (process.env.FILEBOUND_AUTH_MODE as "guid" | "basic") ?? "guid",
  });

  await client.login();

  // Before Step 3:   await client.get<Project[]>('/projects')
  // Now:
  const all = await client.projects.list();
  console.log(`Found ${all.length} projects.`);

  console.log("\nNames:");
  for (const p of all) {
    console.log(`  [${p.projectId}] ${p.name}  (${p.projectType})`);
  }

  // Single, unambiguous lookup by exact name.
  const archive = await client.projects.getByName("Archive Project");
  console.log(
    archive
      ? `\n"Archive Project" -> id=${archive.projectId}, updated=${archive.lastUpdated}`
      : `\n"Archive Project" was not a unique match.`,
  );

  // Direct GET by id - same data, different path.
  if (archive) {
    const same = await client.projects.get(archive.projectId);
    console.log(`get(${archive.projectId}) returned "${same.name}" too.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
