import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildManifest,
  mergeContributes,
  validateContributes,
  validateProjectMetadata,
} from "./build-manifest.js";

function writeJson(directory, name, value) {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  return filePath;
}

test("every contributed command has explicit activation and a source registration", () => {
  const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const rootDirectory = path.join(scriptsDirectory, "..");
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8"));
  const contributedIds = packageJson.contributes.commands.map((entry) => entry.command);
  const activationEvents = new Set(packageJson.activationEvents);

  const constantsSource = fs.readFileSync(path.join(rootDirectory, "src/constants/commands.ts"), "utf8");
  const commandSources = [
    "src/commands/annotate.command.ts",
    "src/commands/fc.command.ts",
    "src/commands/remove-comments.command.ts",
    "src/commands/tree.command.ts",
    "src/commands/regions.command.ts",
    "src/commands/bootstrap.command.ts",
    "src/commands/cli.command.ts",
  ].map((relativePath) => fs.readFileSync(path.join(rootDirectory, relativePath), "utf8")).join("\n");

  for (const commandId of contributedIds) {
    assert.ok(activationEvents.has(`onCommand:${commandId}`), `missing activation event for ${commandId}`);
    const constantMatch = constantsSource.match(new RegExp("\\b([A-Z0-9_]+):\\s*\\\"" + commandId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\\""));
    assert.ok(constantMatch, `missing command constant for ${commandId}`);
    assert.ok(commandSources.includes(constantMatch[1]), `missing source registration handler for ${commandId} (${constantMatch[1]})`);
  }
});

test("CLI settings webview has panel, message, status, and disposal handlers", () => {
  const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const panelSource = fs.readFileSync(path.join(scriptsDirectory, "../src/webview/cli-settings-panel.ts"), "utf8");
  for (const requiredFragment of [
    "createWebviewPanel",
    "onDidReceiveMessage",
    "onDidDispose",
    "private async sendStatus",
    "private api(): CliApi",
    "private getHtml(): string",
  ]) {
    assert.ok(panelSource.includes(requiredFragment), `CLI settings panel missing ${requiredFragment}`);
  }
});

test("validates CLI configuration metadata", () => {
  const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const metadata = JSON.parse(fs.readFileSync(path.join(scriptsDirectory, "../metadata/menus.json"), "utf8"));

  assert.equal(metadata.configuration.properties["cmdr.cli.source"].type, "string");
  assert.deepEqual(metadata.configuration.properties["cmdr.cli.source"].enum, ["path", "custom", "managed"]);
  assert.equal(metadata.configuration.properties["cmdr.cli.customPath"].type, "string");
  assert.equal(metadata.configuration.properties["cmdr.cli.autoUpdate"].type, "boolean");
  assert.equal(metadata.configuration.properties["cmdr.cli.versionCheck"].type, "boolean");
  assert.ok(metadata.commands.some((entry) => entry.command === "cli-helper.cliConfigure"));
});

test("validates central project metadata", () => {
  assert.deepEqual(
    validateProjectMetadata({ name: "cli-helper", displayName: "CMDR Tools", version: "0.3.322" }),
    { name: "cli-helper", displayName: "CMDR Tools", version: "0.3.322" },
  );

  assert.throws(
    () => validateProjectMetadata({ name: "cli-helper", displayName: "CMDR Tools" }),
    /non-empty version/,
  );
  assert.throws(
    () => validateProjectMetadata({ name: "CLI Helper", displayName: "CMDR Tools", version: "0.3.322" }),
    /lowercase npm package name/,
  );
  assert.throws(
    () => validateProjectMetadata({ name: "cli-helper", displayName: "CMDR Tools", version: "latest" }),
    /semantic version format/,
  );
});

test("rejects project identity duplicated in template", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-project-identity-"));
  const templatePath = writeJson(temporary, "package.template.json", {
    name: "old-name",
    description: "Test",
  });
  const projectPath = writeJson(temporary, "project.json", {
    name: "cli-helper",
    displayName: "CMDR Tools",
    version: "0.3.322",
  });
  const metadataPath = writeJson(temporary, "menus.json", {
    commands: [],
    submenus: [],
    menus: {},
  });

  assert.throws(
    () => buildManifest({ templatePath, metadataPath, projectMetadataPath: projectPath, outputPath: path.join(temporary, "package.json") }),
    /must not define name/,
  );
});

test("merges template and metadata contributes without losing template sections", () => {
  const merged = mergeContributes(
    {
      configuration: {
        title: "CMDR",
        properties: { "cmdr.enabled": { type: "boolean", default: true } },
      },
    },
    {
      commands: [{ command: "cli-helper.annotate", title: "Annotate" }],
      menus: { "explorer/context": [{ command: "cli-helper.annotate", group: "navigation" }] },
    },
  );

  assert.equal(merged.configuration.title, "CMDR");
  assert.equal(merged.commands.length, 1);
  assert.equal(merged.menus["explorer/context"][0].command, "cli-helper.annotate");
});

test("rejects duplicate command identifiers", () => {
  assert.throws(
    () => mergeContributes(
      { commands: [{ command: "cli-helper.test", title: "Test" }] },
      { commands: [{ command: "cli-helper.test", title: "Test again" }] },
    ),
    /Duplicate command identifier: cli-helper\.test/,
  );
});

test("rejects duplicate submenu identifiers", () => {
  assert.throws(
    () => mergeContributes(
      { submenus: [{ id: "cli-helper.menu", label: "Menu" }] },
      { submenus: [{ id: "cli-helper.menu", label: "Menu again" }] },
    ),
    /Duplicate submenu identifier: cli-helper\.menu/,
  );
});

test("rejects menu entries for unknown commands", () => {
  assert.throws(
    () => validateContributes({
      commands: [{ command: "cli-helper.valid", title: "Valid" }],
      menus: { "explorer/context": [{ command: "cli-helper.missing", group: "navigation" }] },
    }),
    /unknown command: cli-helper\.missing/,
  );
});

test("rejects menus that reference unknown submenus", () => {
  assert.throws(
    () => validateContributes({
      submenus: [{ id: "cli-helper.valid", label: "Valid" }],
      menus: { "explorer/context": [{ submenu: "cli-helper.missing", group: "navigation" }] },
    }),
    /unknown submenu: cli-helper\.missing/,
  );
});

test("rejects duplicate submenu identifiers in validation", () => {
  assert.throws(
    () => validateContributes({
      submenus: [
        { id: "cli-helper.menu", label: "Menu" },
        { id: "cli-helper.menu", label: "Menu again" },
      ],
    }),
    /Duplicate submenu identifier: cli-helper\.menu/,
  );
});

test("rejects invalid commands and submenus structures", () => {
  assert.throws(
    () => validateContributes({ commands: { command: "cli-helper.test" } }),
    /commands must be an array/,
  );
  assert.throws(
    () => validateContributes({ submenus: "cli-helper.menu" }),
    /submenus must be an array/,
  );
  assert.throws(
    () => validateContributes({ menus: [] }),
    /menus must be an object/,
  );
});

test("rejects malformed command and submenu entries", () => {
  assert.throws(
    () => validateContributes({ commands: [{ title: "Missing identifier" }] }),
    /non-empty command identifier/,
  );
  assert.throws(
    () => validateContributes({ submenus: [{ label: "Missing identifier" }] }),
    /non-empty id/,
  );
});

test("generates package.json from valid template and metadata", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-manifest-"));
  const templatePath = writeJson(temporary, "package.template.json", {
    description: "Test extension",
  });
  const projectPath = writeJson(temporary, "project.json", {
    name: "cli-helper",
    displayName: "CMDR Tools",
    version: "1.2.3",
  });
  const metadataPath = writeJson(temporary, "menus.json", {
    commands: [{ command: "cli-helper.test", title: "Test" }],
    submenus: [{ id: "cli-helper.menu", label: "Menu" }],
    menus: {
      "explorer/context": [{ submenu: "cli-helper.menu", group: "navigation" }],
      "cli-helper.menu": [{ command: "cli-helper.test", group: "1_test" }],
    },
  });
  const outputPath = path.join(temporary, "package.json");

  buildManifest({ templatePath, metadataPath, projectMetadataPath: projectPath, outputPath });

  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.name, "cli-helper");
  assert.equal(output.displayName, "CMDR Tools");
  assert.equal(output.version, "1.2.3");
  assert.equal(output.contributes.commands[0].command, "cli-helper.test");
});

test("regenerates package.json after version changes in project metadata only", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-project-version-"));
  const templatePath = writeJson(temporary, "package.template.json", {
    description: "Test",
  });
  const projectPath = writeJson(temporary, "project.json", {
    name: "cli-helper",
    displayName: "CMDR Tools",
    version: "0.3.323",
  });
  const metadataPath = writeJson(temporary, "menus.json", {
    commands: [],
    submenus: [],
    menus: {},
  });
  const outputPath = path.join(temporary, "package.json");

  buildManifest({ templatePath, metadataPath, projectMetadataPath: projectPath, outputPath });

  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.name, "cli-helper");
  assert.equal(output.displayName, "CMDR Tools");
  assert.equal(output.version, "0.3.323");
});

test("buildManifest rejects invalid JSON", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-invalid-json-"));
  const templatePath = writeJson(temporary, "package.template.json", { name: "cli-helper" });
  const metadataPath = path.join(temporary, "menus.json");
  fs.writeFileSync(metadataPath, "{ invalid", "utf8");

  assert.throws(
    () => buildManifest({
      templatePath,
      metadataPath,
      outputPath: path.join(temporary, "package.json"),
    }),
    /invalid JSON/i,
  );
});
