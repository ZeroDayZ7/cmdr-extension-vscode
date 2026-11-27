import * as vscode from "vscode";
import type { CliSource } from "./cli-types.js";

export interface CliConfiguration {
  source: CliSource;
  customPath: string;
  autoUpdate: boolean;
  versionCheck: boolean;
}

export function getCliConfiguration(): CliConfiguration {
  const configuration = vscode.workspace.getConfiguration("cmdr");

  return {
    source: configuration.get<CliSource>("cli.source", "path"),
    customPath: configuration.get<string>("cli.customPath", ""),
    autoUpdate: configuration.get<boolean>("cli.autoUpdate", false),
    versionCheck: configuration.get<boolean>("cli.versionCheck", true),
  };
}

export async function updateCliConfiguration(
  source: CliSource,
  customPath?: string,
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
  if (autoUpdate !== undefined) {
    await configuration.update("cli.autoUpdate", autoUpdate, vscode.ConfigurationTarget.Global);
  }
  if (versionCheck !== undefined) {
    await configuration.update("cli.versionCheck", versionCheck, vscode.ConfigurationTarget.Global);
  }
}
