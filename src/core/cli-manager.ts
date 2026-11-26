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
  managedCliPath,
  resolveCli,
} from "./cli-resolver.js";
import type { CliOperationResult, CliStatus, CliUpdateStatus } from "./cli-types.js";

const RELEASES_URL = "https://api.github.com/repos/ZeroDayZ7/cmdr/releases/latest";
const MAX_RELEASE_BYTES = 4 << 20;
const MAX_ARCHIVE_BYTES = 128 << 20;

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
    const parse = (version: string) => version.replace(/^v/, "").split("-", 1)[0].split(".").map((part) => Number.parseInt(part, 10));
    const leftParts = parse(left);
    const rightParts = parse(right);

    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
      const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
      if (difference !== 0) {
        return difference;
      }
    }

    return 0;
  }

  async checkUpdate(): Promise<CliOperationResult> {
    try {
      const status = await this.getStatus();
      const release = await this.fetchRelease();
      const latestVersion = release.tag_name.replace(/^v/, "");
      const update: CliUpdateStatus = {
        currentVersion: status.version,
        latestVersion,
        updateAvailable: Boolean(status.version && this.compareVersions(latestVersion, status.version) > 0),
        releaseTag: release.tag_name,
      };

      return { success: true, status, update, message: update.updateAvailable ? "A CMDR update is available." : "CMDR is up to date." };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async fetchRelease(): Promise<Release> {
    const response = await this.fetchImpl(RELEASES_URL, {
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
          fs.copyFileSync(finalBinary, `${currentBinary}.new`);
          fs.chmodSync(`${currentBinary}.new`, 0o755);
          fs.renameSync(`${currentBinary}.new`, currentBinary);
        } catch (error) {
          if (fs.existsSync(backupBinary)) {
            fs.copyFileSync(backupBinary, currentBinary);
          }
          throw error;
        }

        const executableVersion = await getCliVersion(currentBinary);
        if (executableVersion !== version) {
          throw new Error(`Installed CMDR reported ${executableVersion ?? "unknown version"}, expected ${version}`);
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
    const response = await this.fetchImpl(url, { headers: { "User-Agent": "cmdr-vscode-extension" } });
    if (!response.ok) {
      throw new Error(`Download returned HTTP ${response.status}`);
    }

    const declaredLength = response.headers.get("content-length");
    if (declaredLength && Number(declaredLength) > limit) {
      throw new Error("Download exceeds size limit");
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > limit) {
      throw new Error("Download exceeds size limit");
    }

    fs.writeFileSync(destination, bytes, { flag: "w" });
    return bytes;
  }

  private async extractArchive(archivePath: string, destination: string, assetName: string): Promise<void> {
    if (assetName.toLowerCase().endsWith(".zip")) {
      const zip = new AdmZip(archivePath);
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) {
          continue;
        }
        const resolved = path.resolve(destination, entry.entryName);
        if (resolved !== destination && !resolved.startsWith(`${destination}${path.sep}`)) {
          throw new Error("Archive contains unsafe path traversal");
        }
        if (entry.entryName.endsWith("/")) {
          continue;
        }
      }
      zip.extractAllTo(destination, true);
      return;
    }

    if (assetName.toLowerCase().endsWith(".tar.gz")) {
      await tar.extract({
        file: archivePath,
        cwd: destination,
        strict: true,
        filter: (entryPath: string) => {
          const resolved = path.resolve(destination, entryPath);
          return resolved === destination || resolved.startsWith(`${destination}${path.sep}`);
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
