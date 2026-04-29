import * as vscode from "vscode";
import { exec } from "child_process";

export function activate(context: vscode.ExtensionContext) {
  const runTreeCommand = async (uri: vscode.Uri, format?: string) => {
    const targetPath = uri
      ? uri.fsPath
      : vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!targetPath) {
      return;
    }

    const formatFlag = format ? `-f ${format}` : "";
    const command = `cmdr tree "${targetPath}" -c ${formatFlag}`;

    exec(command, (error) => {
      if (error) {
        vscode.window.showErrorMessage(`Tree Error: ${error.message}`);
        return;
      }
      vscode.window.showInformationMessage(
        `CMDR: Struktura ${format ? `(${format.toUpperCase()})` : ""} skopiowana!`,
      );
    });
  };

  // Rejestracja komend głównych
  const rmvComments = vscode.commands.registerCommand(
    "cli-helper.rmvComments",
    async (uri: vscode.Uri) => {
      if (!uri) {
        return;
      }
      const fileStat = await vscode.workspace.fs.stat(uri);
      const command = `cmdr rmc ${fileStat.type === vscode.FileType.Directory ? "-d" : "-f"} "${uri.fsPath}"`;
      exec(command, (error) => {
        if (error) {
          vscode.window.showErrorMessage(`RMC Error: ${error.message}`);
        } else {
          vscode.window.showInformationMessage("CMDR: Wyczyszczono pliki.");
        }
      });
    },
  );

  const fcDart = vscode.commands.registerCommand(
    "cli-helper.fcDart",
    async (uri: vscode.Uri) => {
      const targetPath = uri
        ? uri.fsPath
        : vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      if (!targetPath) {
        return;
      }

      exec(`cmdr fc -d`, { cwd: targetPath }, (error) => {
        if (error) {
          vscode.window.showErrorMessage(`FC Error: ${error.message}`);
        } else {
          vscode.window.showInformationMessage("CMDR: Pliki Dart połączone!");
        }
      });
    },
  );

  // Rejestracja wariantów TREE
  const treeClipboard = vscode.commands.registerCommand(
    "cli-helper.treeClipboard",
    (uri) => runTreeCommand(uri),
  );
  const treeAscii = vscode.commands.registerCommand(
    "cli-helper.treeAscii",
    (uri) => runTreeCommand(uri, "ascii"),
  );
  const treeJson = vscode.commands.registerCommand(
    "cli-helper.treeJson",
    (uri) => runTreeCommand(uri, "json"),
  );
  const treeCsv = vscode.commands.registerCommand("cli-helper.treeCsv", (uri) =>
    runTreeCommand(uri, "csv"),
  );
  const treeMd = vscode.commands.registerCommand("cli-helper.treeMd", (uri) =>
    runTreeCommand(uri, "md"),
  );

  context.subscriptions.push(
    rmvComments,
    fcDart,
    treeClipboard,
    treeAscii,
    treeJson,
    treeCsv,
    treeMd,
  );
}

export function deactivate() {}
