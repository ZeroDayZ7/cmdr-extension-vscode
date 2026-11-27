import fs from "node:fs";
import { execFileSync } from "node:child_process";

function fail(message) {
  console.error(`\nRelease stopped: ${message}\n`);
  process.exit(1);
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  }).trim();
}

try {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const projectJson = JSON.parse(fs.readFileSync("metadata/project.json", "utf8"));
  const lockJson = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  const version = packageJson.version;

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`package.json version '${version}' is not a valid vX.Y.Z version.`);
  }
  if (projectJson.version !== version) {
    fail(`package.json version '${version}' does not match metadata/project.json version '${projectJson.version}'.`);
  }
  if (lockJson.version !== version || lockJson.packages?.[""]?.version !== version) {
    fail(`package-lock.json version is not '${version}'. Run the metadata build scripts before releasing.`);
  }

  const status = git(["status", "--porcelain"], { capture: true });
  if (status) {
    fail("working tree is not clean. Commit or stash changes, without creating an automatic commit.");
  }

  const tag = `v${version}`;
  const localTag = git(["tag", "--list", tag], { capture: true });
  if (localTag) {
    fail(`tag '${tag}' already exists locally.`);
  }

  try {
    const remote = git(["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`], { capture: true });
    if (remote) {
      fail(`tag '${tag}' already exists on origin.`);
    }
  } catch (error) {
    if (error.status !== 2) {
      fail(`could not check '${tag}' on origin: ${error.message}`);
    }
  }

  console.log(`Creating release tag ${tag} from the current commit...`);
  git(["tag", "-a", tag, "-m", `Release ${tag}`]);

  try {
    git(["push", "origin", tag]);
  } catch (error) {
    try {
      git(["tag", "-d", tag]);
    } catch {
      // Keep the original push error visible if local tag cleanup also fails.
    }
    fail(`could not push '${tag}' to origin. The local tag was removed when possible: ${error.message}`);
  }

  console.log(`\nRelease tag '${tag}' pushed successfully. GitHub Actions will create the release.`);
} catch (error) {
  if (error instanceof SyntaxError) {
    fail(`invalid JSON: ${error.message}`);
  } else if (!error.message?.startsWith("Release stopped:")) {
    fail(error.message || String(error));
  }
}
