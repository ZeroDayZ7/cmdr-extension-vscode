import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readJson, validateProjectMetadata } from "./build-manifest.js";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectPath = path.join(scriptsDirectory, "../metadata/project.json");
const packagePath = path.join(scriptsDirectory, "../package.json");
const lockPath = path.join(scriptsDirectory, "../package-lock.json");

export function validateProjectMetadataFiles() {
  const project = validateProjectMetadata(readJson(projectPath));

  if (!fs.existsSync(packagePath)) {
    throw new Error("package.json is missing; run npm run gen-manifest first");
  }

  const manifest = readJson(packagePath);
  if (manifest.name !== project.name) {
    throw new Error(`package.json name ${manifest.name} does not match metadata/project.json name ${project.name}`);
  }
  if (manifest.displayName !== project.displayName) {
    throw new Error(`package.json displayName does not match metadata/project.json displayName`);
  }
  if (manifest.version !== project.version) {
    throw new Error(`package.json version ${manifest.version} does not match metadata/project.json version ${project.version}`);
  }

  if (fs.existsSync(lockPath)) {
    const lock = readJson(lockPath);
    const root = lock.packages?.[""];
    if (lock.name !== project.name || root?.name !== project.name) {
      throw new Error("package-lock.json name does not match metadata/project.json");
    }
    if (lock.version !== project.version || root?.version !== project.version) {
      throw new Error("package-lock.json version does not match metadata/project.json");
    }
  }

  return project;
}

try {
  if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const project = validateProjectMetadataFiles();
    console.log(`✅ Metadata validated: ${project.name} ${project.displayName} ${project.version}`);
  }
} catch (error) {
  console.error(`❌ Metadata validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
