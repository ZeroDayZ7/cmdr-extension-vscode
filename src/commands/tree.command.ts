// cmdr: cli-helper/src/commands/tree.command.ts

import * as vscode from "vscode";
import fs from "node:fs";

import { runCliCommand } from "../core/run-cli.js";
import { COMMANDS } from "../constants/commands.js";

export function resolveTreeTarget(uri?: vscode.Uri): string | undefined {
  const target = uri?.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return target ? fs.realpathSync.native(target) : undefined;
}

export function buildTreeArguments(targetPath: string, format?: string): string[] {
  const args: string[] = ["tree", targetPath, "-c"];
  if (format) {
    args.push("-f", format);
  }
  return args;
}

export async function runTreeCommand(uri: vscode.Uri, format?: string): Promise<void> {
  let targetPath: string | undefined;
  try {
    targetPath = resolveTreeTarget(uri);
  } catch {
    vscode.window.showWarningMessage("CMDR: The selected Tree target no longer exists.");
    return;
  }

  if (!targetPath) {
    vscode.window.showWarningMessage("CMDR: No target path found.");
    return;
  }

  if (fs.statSync(targetPath).isFile()) {
    vscode.window.showWarningMessage("CMDR: Select a directory to generate a Tree structure.");
    return;
  }

  const args = buildTreeArguments(targetPath, format);
  await runCliCommand("cmdr", args, {
    successMessage: `CMDR: Tree copied (${format ?? "standard"}).`,
    errorMessage: "CMDR: Tree command failed.",
  });
}

export function registerTreeCommands(context: vscode.ExtensionContext) {
  const commands = [
    vscode.commands.registerCommand(
      COMMANDS.TREE_CLIPBOARD,
      async (uri: vscode.Uri) => runTreeCommand(uri),
    ),

    vscode.commands.registerCommand(
      COMMANDS.TREE_ASCII,
      async (uri: vscode.Uri) => runTreeCommand(uri, "ascii"),
    ),

    vscode.commands.registerCommand(
      COMMANDS.TREE_JSON,
      async (uri: vscode.Uri) => runTreeCommand(uri, "json"),
    ),

    vscode.commands.registerCommand(
      COMMANDS.TREE_CSV,
      async (uri: vscode.Uri) => runTreeCommand(uri, "csv"),
    ),

    vscode.commands.registerCommand(COMMANDS.TREE_MD, async (uri: vscode.Uri) =>
      runTreeCommand(uri, "md"),
    ),
  ];

  context.subscriptions.push(...commands);
}
