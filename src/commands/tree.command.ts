import * as vscode from "vscode";
import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";

function runTreeCommand(uri: vscode.Uri, format?: string) {
  const targetPath = uri
    ? uri.fsPath
    : vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!targetPath) {
    return;
  }

  const formatFlag = format ? `-f ${format}` : "";
  runCliCommand(`cmdr tree "${targetPath}" -c ${formatFlag}`, {
    successMessage: `CMDR: Tree copied ${format ?? "standard"}`,
  });
}

export function registerTreeCommands(context: vscode.ExtensionContext) {
  const commands = [
    vscode.commands.registerCommand(COMMANDS.TREE_CLIPBOARD, (uri) =>
      runTreeCommand(uri),
    ),
    vscode.commands.registerCommand(COMMANDS.TREE_ASCII, (uri) =>
      runTreeCommand(uri, "ascii"),
    ),
    vscode.commands.registerCommand(COMMANDS.TREE_JSON, (uri) =>
      runTreeCommand(uri, "json"),
    ),
    vscode.commands.registerCommand(COMMANDS.TREE_CSV, (uri) =>
      runTreeCommand(uri, "csv"),
    ),
    vscode.commands.registerCommand(COMMANDS.TREE_MD, (uri) =>
      runTreeCommand(uri, "md"),
    ),
  ];
  context.subscriptions.push(...commands);
}
