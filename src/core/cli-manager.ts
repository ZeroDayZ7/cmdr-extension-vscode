import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as vscode from "vscode";
import AdmZip from "adm-zip";
import * as tar from "tar";

import { getCliConfiguration } from "./cli-config.js";
import { runProcess } from "./cli-process.js";
import {
  getCliVersion,
  managedCliDirectory,
  resolveCli,
} from "./cli-resolver.js";
import type { CliOperationResult, CliStatus, CliUpdateStatus } from "./cli-types.js";

const RELEASES_API_BASE = "https://api.github.com/repos";
const MAX_RELEASE_BYTES = 4 << 20;
const MAX_ARCHIVE_BYTES = 128 << 20;
const DOWNLOAD_TIMEOUT_MS = 60_000;

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export function parseSemanticVersion(value: string): SemanticVersion | undefined {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-ZaZ-]+)*))?(?:\+[0-9A-ZaZ-]+(?:\.[0-9A-ZaZ-]+)*)?$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ? match[4].split(".") : [] };
}

export function compareSemanticVersions(left: string, right: string): number {
  const a = parseSemanticVersion(left);
  const b = parseSemanticVersion(right);
  if (!a || !b) {
    throw new Error("Invalid semantic version");
  }

  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) {
      return a[key] > b[key] ? 1 : -1;
    }
  }
  if (!a.prerelease.length && b.prerelease.length) {
    return 1;
  }
  if (a.prerelease.length && !b.prerelease.length) {
    return -1;
  }

  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    if (a.prerelease[i] === b.prerelease[i]) {
      continue;
    }
    if (a.prerelease[i] === undefined) {
      return -1;
    }
    if (b.prerelease[i] === undefined) {
      return 1;
    }
    const aNumeric = /^\d+$/.test(a.prerelease[i]);
    const bNumeric = /^\d+$/.test(b.prerelease[i]);
    if (aNumeric && bNumeric) {
      return Number(a.prerelease[i]) > Number(b.prerelease[i]) ? 1 : -1;
    }
    if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1;
    }
    return a.prerelease[i] > b.prerelease[i] ? 1 : -1;
  }
  return 0;
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export class CliManager {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  async getStatus(): Promise<CliStatus> {
    return resolveCli(this.context);
  }

  private platformAssetName(version: string): string {
    if (process.platform === "win32" && process.arch === "x64") {
      return `cmdr_${version}_windows_amd64.zip`;
    }
    if (process.platform === "linux" && process.arch === "x64") {
      return `cmdr_${version}_linux_amd64.tar.gz`;
    }
    throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`);
  }

  private compareVersions(left: string, right: string): number {
    return compareSemanticVersions(left, right);
  }

  async checkUpdate(): Promise<CliOperationResult> {
    try {
      const status = await this.getStatus();
      const release = await this.fetchRelease();
      const latestVersion = release.tag_name.replace(/^v/, "");
      if (!parseSemanticVersion(latestVersion)) {
        throw new Error(`Invalid CMDR release version: ${release.tag_name}`);
      }
      if (status.version && !parseSemanticVersion(status.version)) {
        throw new Error(`Invalid installed CMDR version: ${status.version}`);
      }
      const update: CliUpdateStatus = {
        installed: status.available,
        currentVersion: status.version,
        latestVersion,
        updateAvailable: Boolean(status.version && this.compareVersions(latestVersion, status.version) > 0),
        releaseTag: release.tag_name,
      };

      const message = !status.available
        ? "CMDR is not installed or unavailable. Install it before checking updates."
        : update.updateAvailable
          ? "A CMDR update is available."
          : "CMDR is up to date.";

      return { success: true, status, update, message };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async fetchRelease(): Promise<Release> {
    const repository = getCliConfiguration().githubRepository.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
      throw new Error("GitHub repository must use the owner/repository format.");
    }

    const releasesUrl = `${RELEASES_API_BASE}/${repository}/releases/latest`;
    const response = await this.fetchImpl(releasesUrl, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "cmdr-vscode-extension" },
    });

    if (!response.ok) {
      throw new Error(`GitHub Releases returned HTTP ${response.status}`);
    }

    const body = await response.text();
    if (body.length > MAX_RELEASE_BYTES) {
      throw new Error("GitHub Releases response exceeds size limit");
    }

    const release = JSON.parse(body) as Release;
    if (release.draft || release.prerelease) {
      throw new Error("The latest stable CMDR release is unavailable");
    }
    if (!Array.isArray(release.assets)) {
      throw new Error("CMDR release contains invalid asset metadata");
    }

    return release;
  }

  async install(): Promise<CliOperationResult> {
    const configuration = getCliConfiguration();
    if (configuration.source !== "managed") {
      return { success: false, message: "Managed installation requires cmdr.cli.source to be managed." };
    }

    try {
      const release = await this.fetchRelease();
      const version = release.tag_name.replace(/^v/, "");
      const assetName = this.platformAssetName(version);
      const asset = release.assets.find((candidate) => candidate.name === assetName);
      const checksumAsset = release.assets.find((candidate) => candidate.name === "checksums.txt");

      if (!asset) {
        throw new Error(`Release ${release.tag_name} does not contain ${assetName}`);
      }
      if (!checksumAsset) {
        throw new Error(`Release ${release.tag_name} does not contain checksums.txt`);
      }

      const root = managedCliDirectory(this.context);
      fs.mkdirSync(root, { recursive: true });
      const staging = fs.mkdtempSync(path.join(root, ".staging-"));

      try {
        const archivePath = path.join(staging, assetName);
        await this.downloadVerified(asset, checksumAsset, archivePath, staging);
        await this.extractArchive(archivePath, staging, assetName);

        const binaryName = process.platform === "win32" ? "cmdr.exe" : "cmdr";
        const extractedBinary = path.join(staging, binaryName);
        if (!fs.existsSync(extractedBinary) || !fs.statSync(extractedBinary).isFile()) {
          throw new Error(`Archive did not contain ${binaryName}`);
        }

        const versionDirectory = path.join(root, "versions", version);
        fs.mkdirSync(versionDirectory, { recursive: true });
        const stagedBinary = path.join(versionDirectory, `.${binaryName}.new`);
        fs.copyFileSync(extractedBinary, stagedBinary);
        fs.chmodSync(stagedBinary, 0o755);

        const finalBinary = path.join(versionDirectory, binaryName);
        fs.renameSync(stagedBinary, finalBinary);

        const currentDirectory = path.join(root, "current");
        fs.mkdirSync(currentDirectory, { recursive: true });
        const currentBinary = path.join(currentDirectory, binaryName);
        const backupBinary = path.join(currentDirectory, `.${binaryName}.backup`);

        if (fs.existsSync(currentBinary)) {
          fs.copyFileSync(currentBinary, backupBinary);
        }

        try {
          const replacementPath = `${currentBinary}.new`;
          fs.copyFileSync(finalBinary, replacementPath);
          fs.chmodSync(replacementPath, 0o755);

          if (process.platform === "win32" && fs.existsSync(currentBinary)) {
            fs.rmSync(currentBinary, { force: true });
          }
          fs.renameSync(replacementPath, currentBinary);

          const executableVersion = await getCliVersion(currentBinary);
          if (!executableVersion || parseSemanticVersion(executableVersion) === undefined) {
            throw new Error(`Installed CMDR reported an invalid version: ${executableVersion ?? "unknown"}`);
          }
          if (compareSemanticVersions(executableVersion, version) !== 0) {
            throw new Error(`Installed CMDR reported ${executableVersion}, expected ${version}`);
          }
        } catch (error) {
          if (fs.existsSync(backupBinary)) {
            try {
              fs.rmSync(currentBinary, { force: true });
              fs.copyFileSync(backupBinary, currentBinary);
              fs.chmodSync(currentBinary, 0o755);
            } catch {
              // Best-effort rollback; retain the verification/replacement error.
            }
          } else {
            fs.rmSync(currentBinary, { force: true });
          }
          throw error;
        }

        return {
          success: true,
          status: await resolveCli(this.context),
          message: `CMDR ${version} was installed successfully.`,
        };
      } finally {
        fs.rmSync(staging, { recursive: true, force: true });
      }
    } catch (error) {
      return {
        success: false,
        status: await resolveCli(this.context),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async update(): Promise<CliOperationResult> {
    const configuration = getCliConfiguration();
    if (configuration.source !== "managed") {
      return {
        success: false,
        status: await this.getStatus(),
        message: "Updates are available only for the managed CMDR installation.",
      };
    }

    const check = await this.checkUpdate();
    if (!check.success) {
      return check;
    }
    if (!check.update?.updateAvailable) {
      return { ...check, message: "CMDR is already up to date." };
    }
    return this.install();
  }

  private async downloadVerified(asset: ReleaseAsset, checksumAsset: ReleaseAsset, archivePath: string, staging: string): Promise<void> {
    const archive = await this.download(asset.browser_download_url, archivePath, MAX_ARCHIVE_BYTES);
    const checksumPath = path.join(staging, "checksums.txt");
    await this.download(checksumAsset.browser_download_url, checksumPath, 1 << 20);

    const checksumText = fs.readFileSync(checksumPath, "utf8");
    const match = checksumText.split(/\r?\n/).map((line) => line.trim()).find((line) => line.endsWith(`  ${asset.name}`) || line.endsWith(` *${asset.name}`));
    if (!match) {
      throw new Error(`checksums.txt does not contain ${asset.name}`);
    }

    const expected = match.trim().split(/\s+/)[0];
    if (!/^[a-fA-F0-9]{64}$/.test(expected)) {
      throw new Error("Invalid SHA-256 checksum");
    }

    const actual = crypto.createHash("sha256").update(archive).digest("hex");
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      throw new Error("CMDR archive SHA-256 checksum mismatch");
    }
  }

  private async download(url: string, destination: string, limit: number): Promise<Buffer> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("Invalid download URL");
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error("Release downloads must use HTTPS");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(url, {
        headers: { "User-Agent": "cmdr-vscode-extension" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Download returned HTTP ${response.status}`);
      }

      const declaredLength = response.headers.get("content-length");
      if (declaredLength) {
        const length = Number(declaredLength);
        if (!Number.isFinite(length) || length < 0) {
          throw new Error("Download has an invalid content length");
        }
        if (length > limit) {
          throw new Error("Download exceeds size limit");
        }
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > limit) {
        throw new Error("Download exceeds size limit");
      }

      fs.writeFileSync(destination, bytes, { flag: "w" });
      return bytes;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Download timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async extractArchive(archivePath: string, destination: string, assetName: string): Promise<void> {
    if (assetName.toLowerCase().endsWith(".zip")) {
      const zip = new AdmZip(archivePath);
      let extractedBytes = 0;
      for (const entry of zip.getEntries()) {
        const resolved = path.resolve(destination, entry.entryName);
        if (resolved !== destination && !resolved.startsWith(`${destination}${path.sep}`)) {
          throw new Error("Archive contains unsafe path traversal");
        }
        const unixMode = typeof entry.header.attr === "number" ? entry.header.attr : 0;
        if ((unixMode & 0o170000) === 0o120000) {
          throw new Error("Archive contains unsupported symbolic links");
        }
        extractedBytes += entry.header.size;
        if (extractedBytes > MAX_ARCHIVE_BYTES) {
          throw new Error("Archive exceeds extracted size limit");
        }
      }
      zip.extractAllTo(destination, false);
      return;
    }

    if (assetName.toLowerCase().endsWith(".tar.gz")) {
      let extractedBytes = 0;
      await tar.extract({
        file: archivePath,
        cwd: destination,
        strict: true,
        preservePaths: false,
        filter: (entryPath, entry) => {
          const resolved = path.resolve(destination, entryPath);
          if (resolved !== destination && !resolved.startsWith(`${destination}${path.sep}`)) {
            throw new Error("Archive contains unsafe path traversal");
          }
          if ("type" in entry && (entry.type === "SymbolicLink" || entry.type === "Link")) {
            throw new Error("Archive contains unsupported links");
          }
          if (typeof entry.size === "number") {
            extractedBytes += entry.size;
            if (extractedBytes > MAX_ARCHIVE_BYTES) {
              throw new Error("Archive exceeds extracted size limit");
            }
          }
          return true;
        },
      });
      return;
    }

    throw new Error(`Unsupported archive artifact: ${assetName}`);
  }
}

export async function testCliProcess(location: string): Promise<CliStatus> {
  const version = await getCliVersion(location);
  return {
    source: "custom",
    available: Boolean(version),
    location,
    version,
    message: version ? undefined : "CMDR executable could not report a valid version.",
  };
}
