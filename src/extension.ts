import * as vscode from "vscode";
import { exec } from "child_process";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "cli-helper.rmvComments",
    (uri: vscode.Uri) => {
      if (!uri) {
        vscode.window.showErrorMessage("Nie wybrano elementu!");
        return;
      }

      const filePath = uri.fsPath;

      // Sprawdzamy czy to folder czy plik
      const stats = fs.statSync(filePath);
      const isDirectory = stats.isDirectory();
      const flag = isDirectory ? "-d" : "-f";
      const modeText = isDirectory ? "folder" : "plik";

      exec(
        `cmdr rmc ${flag} "${filePath}"`,
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            vscode.window.showErrorMessage(`Błąd: ${error.message}`);
            return;
          }

          if (stdout) {
            console.log("CLI Output:", stdout);
          }
          if (stderr) {
            console.error(stderr);
          }

          vscode.window.showInformationMessage(
            `CMDR: Wyczyszczono ${modeText}: ${filePath}`,
          );
        },
      );
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
