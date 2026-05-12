import * as vscode from "vscode";

import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";

async function runTreeCommand(uri: vscode.Uri, format?: string) {
  const targetPath = uri
    ? uri.fsPath
    : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!targetPath) {
    vscode.window.showWarningMessage("CMDR: No target path found.");

    return;
  }

  const args: string[] = ["tree", targetPath, "-c"];

  if (format) {
    args.push("-f", format);
  }

  try {
    await runCliCommand("cmdr", args, {
      successMessage: `CMDR: Tree copied (${format ?? "standard"}).`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    vscode.window.showErrorMessage(`CMDR: Tree error: ${message}`);
  }
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
