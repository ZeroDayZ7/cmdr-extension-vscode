import fs from "node:fs";
import { execFileSync } from "node:child_process";

function fail(message) {
  console.error(`\nRelease stopped: ${message}\n`);
  process.exit(1);
}

function git(args, options = {}) {
  const output = execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  return options.capture ? (output ?? "").trim() : null;
}

try {
  const projectJson = JSON.parse(fs.readFileSync("metadata/project.json", "utf8"));
  const version = projectJson.version;

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`metadata/project.json version '${version}' is not a valid vX.Y.Z version.`);
  }

  const initialStatus = git(["status", "--porcelain"], { capture: true });
  if (initialStatus) {
    const changedFiles = initialStatus
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.slice(3));

    const onlyProjectMetadataChanged = changedFiles.length === 1
      && changedFiles[0] === "metadata/project.json";

    if (!onlyProjectMetadataChanged) {
      fail("working tree is not clean. Commit or stash all changes, without creating an automatic commit.");
    }
  }

  console.log(`Synchronizing generated metadata for ${version}...`);
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "prepare:metadata"], {
    stdio: "inherit",
  });

  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lockJson = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));

  if (packageJson.version !== version) {
    fail(`package.json version '${packageJson.version}' does not match metadata/project.json version '${version}' after synchronization.`);
  }
  if (lockJson.version !== version || lockJson.packages?.[""]?.version !== version) {
    fail(`package-lock.json was not synchronized to version '${version}'.`);
  }

  const status = git(["status", "--porcelain"], { capture: true });
  if (status) {
    fail("generated metadata is not committed. Commit the synchronized package.json and package-lock.json before release; no automatic commit was created.");
  }

  const tag = `v${version}`;
  const localTag = git(["tag", "--list", tag], { capture: true });

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

  let createdTag = false;

  if (localTag) {
    const localCommit = git(["rev-list", "-n", "1", tag], { capture: true });
    const headCommit = git(["rev-parse", "HEAD"], { capture: true });
    if (localCommit !== headCommit) {
      fail(`tag '${tag}' already exists locally and points to a different commit.`);
    }
    console.log(`Local tag ${tag} already exists for the current commit; retrying push...`);
  } else {
    console.log(`Creating release tag ${tag} from the current commit...`);
    git(["tag", "-a", tag, "-m", `Release ${tag}`]);
    createdTag = true;
  }

  try {
    git(["push", "origin", tag]);
  } catch (error) {
    if (createdTag) {
      try {
        git(["tag", "-d", tag]);
      } catch {
        // Keep the original push error visible if local tag cleanup also fails.
      }
    }
    fail(`could not push '${tag}' to origin. ${createdTag ? "The locally created tag was removed when possible." : "The existing local tag was kept."} ${error.message}`);
  }

  console.log(`\nRelease tag '${tag}' pushed successfully. GitHub Actions will create the release.`);
} catch (error) {
  if (error instanceof SyntaxError) {
    fail(`invalid JSON: ${error.message}`);
  } else if (!error.message?.startsWith("Release stopped:")) {
    fail(error.message || String(error));
  }
}
