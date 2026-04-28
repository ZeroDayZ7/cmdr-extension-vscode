import * as vscode from "vscode";
import { exec } from "child_process";

export function activate(context: vscode.ExtensionContext) {
  const rmvComments = vscode.commands.registerCommand(
    "cli-helper.rmvComments",
    async (uri: vscode.Uri) => {
      if (!uri) {
        return;
      }
      try {
        const fileStat = await vscode.workspace.fs.stat(uri);
        const isDirectory = fileStat.type === vscode.FileType.Directory;
        const flag = isDirectory ? "-d" : "-f";
        const command = `cmdr rmc ${flag} "${uri.fsPath}"`;

        exec(command, (error) => {
          if (error) {
            vscode.window.showErrorMessage(`RMC Error: ${error.message}`);
            return;
          }
          vscode.window.showInformationMessage(
            `CMDR: Wyczyszczono ${isDirectory ? "folder" : "plik"}`,
          );
        });
      } catch (err) {
        vscode.window.showErrorMessage(`System Error: ${err}`);
      }
    },
  );

  const treeClipboard = vscode.commands.registerCommand(
    "cli-helper.treeClipboard",
    async (uri: vscode.Uri) => {
      const targetPath = uri
        ? uri.fsPath
        : vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!targetPath) {
        return;
      }

      const command = `cmdr tree "${targetPath}" -c`;

      exec(command, (error) => {
        if (error) {
          vscode.window.showErrorMessage(`Tree Error: ${error.message}`);
          return;
        }
        vscode.window.showInformationMessage(
          "CMDR: Struktura skopiowana do schowka!",
        );
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

      const command = `cmdr fc -d`;

      exec(command, { cwd: targetPath }, (error) => {
        if (error) {
          vscode.window.showErrorMessage(`FC Error: ${error.message}`);
          return;
        }
        vscode.window.showInformationMessage(
          "CMDR: Pliki Dart zostały połączone!",
        );
      });
    },
  );

  context.subscriptions.push(rmvComments, treeClipboard, fcDart);
}

export function deactivate() {}
