import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";

import { getCliConfiguration } from "./cli-config.js";
import { runProcess } from "./cli-process.js";
import type { CliStatus } from "./cli-types.js";

function executableName(): string {
  return process.platform === "win32" ? "cmdr.exe" : "cmdr";
}

export function managedCliDirectory(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, "cli");
}

export function managedCliPath(context: vscode.ExtensionContext): string {
  return path.join(managedCliDirectory(context), "current", executableName());
}

export function findInPath(): string | undefined {
  const directory = process.env.PATH?.split(path.delimiter).find((entry) => {
    const candidate = path.join(entry, executableName());
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  });

  return directory ? path.join(directory, executableName()) : undefined;
}

export async function getCliVersion(location: string): Promise<string | undefined> {
  try {
    const result = await runProcess(location, ["version", "--short"], { timeoutMs: 10_000 });
    if (result.exitCode !== 0) {
      return undefined;
    }

    const version = result.stdout.trim().split(/\r?\n/, 1)[0]?.trim();
    return version || undefined;
  } catch {
    return undefined;
  }
}

export async function resolveCli(context: vscode.ExtensionContext): Promise<CliStatus> {
  const configuration = getCliConfiguration();

  let location: string | undefined;

  if (configuration.source === "custom") {
    location = configuration.customPath.trim() || undefined;
  } else if (configuration.source === "managed") {
    location = managedCliPath(context);
  } else {
    location = findInPath();
  }

  if (!location) {
    return {
      source: configuration.source,
      available: false,
      message: configuration.source === "custom"
        ? "No custom CMDR executable path is configured."
        : configuration.source === "managed"
          ? "Managed CMDR executable is not installed."
          : "CMDR executable was not found in system PATH.",
    };
  }

  if (!fs.existsSync(location) || !fs.statSync(location).isFile()) {
    return {
      source: configuration.source,
      available: false,
      location,
      message: `CMDR executable was not found at ${location}.`,
    };
  }

  const version = await getCliVersion(location);
  if (!version) {
    return {
      source: configuration.source,
      available: false,
      location,
      message: "CMDR executable exists but could not report its version.",
    };
  }

  return {
    source: configuration.source,
    available: true,
    location,
    version,
  };
}
