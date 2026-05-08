import { exec } from "child_process";
import * as vscode from "vscode";

export interface RunCliOptions {
  successMessage?: string;
  cwd?: string;
}

export function runCliCommand(
  command: string,
  options?: RunCliOptions,
) {
  exec(command, { cwd: options?.cwd }, (error) => {
    if (error) {
      vscode.window.showErrorMessage(
        `CMDR Error: ${error.message}`,
      );
      return;
    }

    if (options?.successMessage) {
      vscode.window.showInformationMessage(
        options.successMessage,
      );
    }
  });
}

