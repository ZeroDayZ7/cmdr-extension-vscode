import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildManifest,
  mergeContributes,
  validateContributes,
} from "./build-manifest.js";

function writeJson(directory, name, value) {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  return filePath;
}

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
    name: "cli-helper",
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

  buildManifest({ templatePath, metadataPath, outputPath });

  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.version, "1.2.3");
  assert.equal(output.contributes.commands[0].command, "cli-helper.test");
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
