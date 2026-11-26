import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const npmExecutable = process.env.npm_execpath;

if (!npmExecutable) {
  throw new Error("npm_execpath is unavailable; run sync:metadata through npm");
}

execFileSync(process.execPath, [npmExecutable, "install", "--package-lock-only", "--ignore-scripts"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
});

console.log("✅ package-lock.json synchronized with package.json");
