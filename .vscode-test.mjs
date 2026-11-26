import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@vscode/test-cli";

const configuredPath = process.env.VSCODE_TEST_EXECUTABLE;
const windowsDefaultPath = "C:/Users/Neo/AppData/Local/Programs/Microsoft VS Code/Code.exe";
const vscodeExecutablePath = configuredPath
  ? path.resolve(configuredPath)
  : fs.existsSync(windowsDefaultPath)
    ? windowsDefaultPath
    : undefined;

if (configuredPath && !fs.existsSync(vscodeExecutablePath)) {
  throw new Error(`VSCODE_TEST_EXECUTABLE does not exist: ${vscodeExecutablePath}`);
}

export default defineConfig({
  files: "out/test/**/*.test.js",
  useInstallation: vscodeExecutablePath
    ? { fromPath: vscodeExecutablePath }
    : undefined,
  launchArgs: [
    "--disable-extensions",
    `--user-data-dir=${path.join(os.tmpdir(), "cmdr-vscode-test-profile")}`,
  ],
});
