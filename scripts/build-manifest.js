import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(scriptsDirectory, "../package.template.json");
const metadataPath = path.join(scriptsDirectory, "../metadata/menus.json");
const projectMetadataPath = path.join(scriptsDirectory, "../metadata/project.json");
const outputPath = path.join(scriptsDirectory, "../package.json");

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

export function validateProjectMetadata(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new Error("metadata/project.json must be a JSON object");
  }

  for (const field of ["name", "displayName", "version"]) {
    if (typeof project[field] !== "string" || !project[field].trim()) {
      throw new Error(`metadata/project.json must contain a non-empty ${field}`);
    }
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(project.name)) {
    throw new Error("metadata/project.json name must be a lowercase npm package name");
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(project.version)) {
    throw new Error("metadata/project.json version must use semantic version format");
  }

  return project;
}

export function mergeUniqueBy(arrays, keyName) {
  const result = [];
  const seen = new Set();

  for (const array of arrays) {
    if (array !== undefined && !Array.isArray(array)) {
      throw new Error(`${keyName === "command" ? "commands" : "submenus"} must be an array`);
    }

    for (const item of array || []) {
      if (!item || typeof item !== "object") {
        throw new Error(`Invalid ${keyName === "command" ? "command" : "submenu"} entry`);
      }

      const key = item[keyName];
      if (typeof key !== "string" || !key.trim()) {
        throw new Error(`Every ${keyName === "command" ? "command" : "submenu"} entry must have a non-empty ${keyName === "command" ? "command identifier" : "id"}`);
      }
      if (seen.has(key)) {
        throw new Error(`Duplicate ${keyName === "command" ? "command identifier" : "submenu identifier"}: ${key}`);
      }
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

export function mergeContributes(templateContributes = {}, metadataContributes = {}) {
  if (!templateContributes || typeof templateContributes !== "object" || Array.isArray(templateContributes)) {
    throw new Error("Invalid template contributes metadata");
  }
  if (!metadataContributes || typeof metadataContributes !== "object" || Array.isArray(metadataContributes)) {
    throw new Error("Invalid metadata contributes JSON");
  }

  const merged = { ...templateContributes };

  for (const [section, value] of Object.entries(metadataContributes)) {
    if (section === "commands") {
      merged.commands = mergeUniqueBy([templateContributes.commands, value], "command");
      continue;
    }

    if (section === "submenus") {
      merged.submenus = mergeUniqueBy([templateContributes.submenus, value], "id");
      continue;
    }

    if (section === "menus") {
      const menus = { ...(templateContributes.menus || {}) };
      for (const [menuId, entries] of Object.entries(value || {})) {
        if (!Array.isArray(entries)) {
          throw new Error(`Menu ${menuId} must contain an array`);
        }
        menus[menuId] = [...(menus[menuId] || []), ...entries];
      }
      merged.menus = menus;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(merged, section)) {
      throw new Error(`Unsupported duplicate contributes section: ${section}. Add it explicitly to mergeContributes()`);
    }

    merged[section] = value;
  }

  return merged;
}

export function validateContributes(contributes) {
  if (!contributes || typeof contributes !== "object" || Array.isArray(contributes)) {
    throw new Error("contributes must be a JSON object");
  }

  if (contributes.commands !== undefined && !Array.isArray(contributes.commands)) {
    throw new Error("contributes.commands must be an array");
  }
  if (contributes.submenus !== undefined && !Array.isArray(contributes.submenus)) {
    throw new Error("contributes.submenus must be an array");
  }
  if (contributes.menus !== undefined && (!contributes.menus || typeof contributes.menus !== "object" || Array.isArray(contributes.menus))) {
    throw new Error("contributes.menus must be an object");
  }

  const commandIds = new Set();
  for (const entry of contributes.commands || []) {
    if (!entry || typeof entry !== "object" || typeof entry.command !== "string" || !entry.command.trim()) {
      throw new Error("Every contributes.commands entry must have a non-empty command identifier");
    }
    if (commandIds.has(entry.command)) {
      throw new Error(`Duplicate command identifier: ${entry.command}`);
    }
    commandIds.add(entry.command);
  }

  const submenuIds = new Set();
  for (const entry of contributes.submenus || []) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id.trim()) {
      throw new Error("Every contributes.submenus entry must have a non-empty id");
    }
    if (submenuIds.has(entry.id)) {
      throw new Error(`Duplicate submenu identifier: ${entry.id}`);
    }
    submenuIds.add(entry.id);
  }

  for (const [menuId, entries] of Object.entries(contributes.menus || {})) {
    if (!Array.isArray(entries)) {
      throw new Error(`Menu ${menuId} must contain an array`);
    }

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        throw new Error(`Invalid menu entry in ${menuId}`);
      }

      if (typeof entry.command === "string" && !commandIds.has(entry.command)) {
        throw new Error(`Menu ${menuId} references unknown command: ${entry.command}`);
      }

      if (typeof entry.submenu === "string" && !submenuIds.has(entry.submenu)) {
        throw new Error(`Menu ${menuId} references unknown submenu: ${entry.submenu}`);
      }
    }
  }

  return contributes;
}

export function buildManifest(options = {}) {
  const paths = {
    templatePath: options.templatePath || templatePath,
    metadataPath: options.metadataPath || metadataPath,
    projectMetadataPath: options.projectMetadataPath || projectMetadataPath,
    outputPath: options.outputPath || outputPath,
  };

  const template = readJson(paths.templatePath);
  const metadata = readJson(paths.metadataPath);
  const project = validateProjectMetadata(readJson(paths.projectMetadataPath));

  if (!template || typeof template !== "object" || Array.isArray(template)) {
    throw new Error("Package template must be a JSON object");
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Manifest metadata must be a JSON object");
  }

  for (const field of ["name", "displayName", "version"]) {
    if (Object.prototype.hasOwnProperty.call(template, field)) {
      throw new Error(`package.template.json must not define ${field}; it is managed by metadata/project.json`);
    }
  }

  const contributes = validateContributes(mergeContributes(template.contributes, metadata));
  const output = {
    name: project.name,
    displayName: project.displayName,
    ...template,
    version: project.version,
    contributes,
  };

  fs.mkdirSync(path.dirname(paths.outputPath), { recursive: true });
  fs.writeFileSync(paths.outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  return output;
}

try {
  if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    buildManifest();
    console.log("✅ Success: package.json generated and validated");
  }
} catch (error) {
  console.error(`❌ Error building package.json: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
