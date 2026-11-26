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
  const pathValue = process.env.PATH ?? process.env.Path ?? process.env.path ?? "";
  const entries = pathValue.split(path.delimiter);

  for (const entry of entries) {
    let directory = entry.trim();
    if (!directory) {
      continue;
    }
    if (directory.startsWith('"') && directory.endsWith('"')) {
      directory = directory.slice(1, -1);
    }
    directory = path.resolve(directory);

    const candidates = process.platform === "win32"
      ? [executableName(), ...(process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .filter((extension) => extension.trim())
          .map((extension) => `cmdr${extension.trim().toLowerCase()}`)]
      : [executableName()];

    for (const candidateName of candidates) {
      const candidate = path.join(directory, candidateName);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
  }

  return undefined;
}

export function parseCliVersion(stdout: string, stderr = ""): string | undefined {
  const output = stdout.trim() || stderr.trim();
  const version = output.split(/\r?\n/, 1)[0]?.trim();
  return version || undefined;
}

export async function getCliVersion(location: string): Promise<string | undefined> {
  try {
    const result = await runProcess(location, ["version", "--short"], { timeoutMs: 10_000 });
    if (result.exitCode !== 0) {
      return undefined;
    }

    return parseCliVersion(result.stdout, result.stderr);
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
  return {
    source: configuration.source,
    available: true,
    location,
    version,
  };
}
