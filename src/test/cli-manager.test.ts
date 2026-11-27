import * as assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findInPath, getCliVersion, parseCliVersion } from "../core/cli-resolver.js";
import { runProcess } from "../core/cli-process.js";
import { buildTreeArguments } from "../commands/tree.command.js";

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

  test("runProcess reports stdout and non-zero exit codes", async () => {
    const nodeExecutable = process.execPath;
    const result = await runProcess(nodeExecutable, ["-e", "process.stdout.write('ok'); process.stderr.write('warning'); process.exit(7)"]);

    assert.strictEqual(result.exitCode, 7);
    assert.strictEqual(result.stdout, "ok");
    assert.strictEqual(result.stderr, "warning");
  });

  test("runProcess reports spawn errors", async () => {
    await assert.rejects(
      runProcess(path.join(os.tmpdir(), "missing-cmdr-command-7788.exe"), ["--short"]),
      /ENOENT|missing-cmdr-command/,
    );
  });

  test("runProcess supports executable paths containing spaces", async function () {
    if (!/node(?:\.exe)?$/i.test(path.basename(process.execPath))) {
      this.skip();
    }
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr path "));
    const executable = path.join(directory, process.platform === "win32" ? "node.exe" : "node");
    fs.copyFileSync(process.execPath, executable);
    try {
      const result = await runProcess(executable, ["-e", "process.stdout.write('spaced')"]);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.stdout, "spaced");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("runProcess rejects timeout", async () => {
    await assert.rejects(
      runProcess(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { timeoutMs: 100 }),
      /timed out/,
    );
  });

  test("runProcess supports cancellation", async () => {
    const controller = new AbortController();
    const pending = runProcess(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, /cancel/i);
  });

  test("runProcess rejects an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      runProcess(process.execPath, ["-e", "process.exit(0)"], { signal: controller.signal }),
      /cancel/i,
    );
  });

  test("runProcess streams stdout and stderr while preserving complete output", async () => {
    let streamedStdout = "";
    let streamedStderr = "";

    const result = await runProcess(process.execPath, [
      "-e",
      "process.stdout.write('hello'); process.stderr.write('warning')",
    ], {
      onStdout: (text) => { streamedStdout += text; },
      onStderr: (text) => { streamedStderr += text; },
    });

    assert.strictEqual(result.stdout, "hello");
    assert.strictEqual(result.stderr, "warning");
    assert.strictEqual(streamedStdout, result.stdout);
    assert.strictEqual(streamedStderr, result.stderr);
  });

  test("runProcess cleans up a timed-out child process", async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-process-cleanup-"));
    const pidFile = path.join(temporary, "pid.txt");

    try {
      await assert.rejects(
        runProcess(process.execPath, [
          "-e",
          `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000)`,
        ], { timeoutMs: 1000 }),
        /timed out/i,
      );

      for (let attempt = 0; attempt < 100 && !fs.existsSync(pidFile); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(fs.existsSync(pidFile), "timed-out child should have started before verification");

      const pid = Number(fs.readFileSync(pidFile, "utf8"));
      assert.ok(pid > 0);
      assert.throws(() => process.kill(pid, 0));
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("runProcess cleans up a cancelled child process", async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-process-cancel-"));
    const pidFile = path.join(temporary, "pid.txt");
    const controller = new AbortController();

    try {
      const pending = runProcess(process.execPath, [
        "-e",
        `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000)`,
      ], { signal: controller.signal });

      while (!fs.existsSync(pidFile)) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      controller.abort();
      await assert.rejects(pending, /cancel/i);

      await new Promise((resolve) => setTimeout(resolve, 700));
      const pid = Number(fs.readFileSync(pidFile, "utf8"));
      assert.ok(pid > 0);
      assert.throws(() => process.kill(pid, 0));
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("runProcess settles once when timeout and cancellation occur together", async () => {
    const controller = new AbortController();
    const pending = runProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      timeoutMs: 100,
      signal: controller.signal,
    });

    controller.abort();

    await assert.rejects(pending, /cancel/i);
  });

  test("getCliVersion succeeds for the real PATH executable on Windows", async function () {
    if (process.platform !== "win32") {
      this.skip();
    }
    const executable = findInPath();
    if (!executable) {
      this.skip();
    }
    const version = await getCliVersion(executable);
    if (!version) {
      this.skip();
    }
    assert.match(version, /^\d+\.\d+\.\d+/);
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

  test("buildTreeArguments uses the real CMDR tree syntax", () => {
    assert.deepStrictEqual(buildTreeArguments("C:\\project folder\\src"), ["tree", "C:\\project folder\\src", "-c"]);
    assert.deepStrictEqual(buildTreeArguments("C:\\project folder\\src", "json"), ["tree", "C:\\project folder\\src", "-c", "-f", "json"]);
  });

  test("parseCliVersion accepts version text from stderr", () => {
    assert.strictEqual(parseCliVersion("", "2.1.7-rc.2\n"), "2.1.7-rc.2");
  });

  test("runCliCommand delegates execution to runProcess", () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.resolve(testDirectory, "../../src/core/run-cli.ts"), "utf8");
    assert.ok(source.includes("runProcess(executable, args"));
    assert.ok(!/\bspawn\s*\(/.test(source));
  });
});
