import * as assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findInPath, getCliVersion } from "../core/cli-resolver.js";
import { runProcess } from "../core/cli-process.js";

suite("CMDR CLI unit tests", () => {
  test("findInPath returns undefined when executable is missing", () => {
    const oldPath = process.env.PATH;
    process.env.PATH = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-empty-path-"));

    try {
      assert.strictEqual(findInPath(), undefined);
    } finally {
      process.env.PATH = oldPath;
    }
  });

  test("findInPath detects an executable file", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-path-"));
    const executable = path.join(directory, process.platform === "win32" ? "cmdr.exe" : "cmdr");
    fs.writeFileSync(executable, "test", { mode: 0o755 });

    const oldPath = process.env.PATH;
    process.env.PATH = directory;

    try {
      assert.strictEqual(findInPath(), executable);
    } finally {
      process.env.PATH = oldPath;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("runProcess captures output and exit code", async () => {
    const nodeExecutable = process.execPath;
    const result = await runProcess(nodeExecutable, ["-e", "process.stdout.write('1.2.3')"], { timeoutMs: 5_000 });

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, "1.2.3");
  });

  test("getCliVersion rejects a non-reporting executable", async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-invalid-"));
    const executable = path.join(temporary, process.platform === "win32" ? "cmdr.exe" : "cmdr");
    fs.writeFileSync(executable, "", { mode: 0o755 });

    try {
      assert.strictEqual(await getCliVersion(executable), undefined);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
});
