import * as vscode from "vscode";
import type { CliSource } from "./cli-types.js";

export interface CliConfiguration {
  source: CliSource;
  customPath: string;
  githubRepository: string;
  autoUpdate: boolean;
  versionCheck: boolean;
}

export function getCliConfiguration(): CliConfiguration {
  const configuration = vscode.workspace.getConfiguration("cmdr");

  return {
    source: configuration.get<CliSource>("cli.source", "path"),
    customPath: configuration.get<string>("cli.customPath", ""),
    githubRepository: configuration.get<string>("cli.githubRepository", "ZeroDayZ7/cmdr"),
    autoUpdate: configuration.get<boolean>("cli.autoUpdate", false),
    versionCheck: configuration.get<boolean>("cli.versionCheck", true),
  };
}

export function validateGithubRepository(repository: string): string | undefined {
  const trimmed = repository.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) {
    return "GitHub repository must use the owner/repository format.";
  }
  return undefined;
}

export async function updateCliConfiguration(
  source: CliSource,
  customPath?: string,
  githubRepository?: string,
  autoUpdate?: boolean,
  versionCheck?: boolean,
): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("cmdr");

  if (source !== undefined) {
    await configuration.update("cli.source", source, vscode.ConfigurationTarget.Global);
  }
  if (customPath !== undefined) {
    await configuration.update("cli.customPath", customPath, vscode.ConfigurationTarget.Global);
  }
  if (githubRepository !== undefined) {
    await configuration.update("cli.githubRepository", githubRepository, vscode.ConfigurationTarget.Global);
  }
  if (autoUpdate !== undefined) {
    await configuration.update("cli.autoUpdate", autoUpdate, vscode.ConfigurationTarget.Global);
  }
  if (versionCheck !== undefined) {
    await configuration.update("cli.versionCheck", versionCheck, vscode.ConfigurationTarget.Global);
  }
}
