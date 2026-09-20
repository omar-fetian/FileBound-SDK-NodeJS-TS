import "dotenv/config";
import { FileBoundClient } from "../src/index.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. Check your .env file.`);
  return value;
}

async function main() {
  const ofetian_cloud = new FileBoundClient({
    baseUrl: requireEnv("FILEBOUND_OFETIAN_CLOUD_BASE_URL"),
    username: requireEnv("FILEBOUND_OFETIAN_CLOUD_USERNAME"),
    password: requireEnv("FILEBOUND_OFETIAN_CLOUD_PASSWORD"),
    authMode:
      (process.env.FILEBOUND_OFETIAN_CLOUD_AUTH_MODE as "guid" | "basic") ??
      "guid",
  });

  await ofetian_cloud.login();
  
  ofetian_cloud.files
    .list({
      filter: "projectid_1246",
      rangeBegin: 1,
      rangeLength: 1,
    })
    .then((files) => {
      console.log("Files in project 1:", files);
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
