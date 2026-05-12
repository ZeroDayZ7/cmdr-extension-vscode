import { exec } from "child_process";
import * as vscode from "vscode";

export interface RunCliOptions {
  successMessage?: string;
  cwd?: string;
}

const outputChannel = vscode.window.createOutputChannel("CMDR");

export function runCliCommand(command: string, options?: RunCliOptions) {
  outputChannel.show(true);
  outputChannel.appendLine(`> Executing: ${command}`);

  exec(command, { cwd: options?.cwd }, (error, stdout, stderr) => {
    if (stdout) {
      outputChannel.appendLine(stdout);
    }

    if (stderr) {
      outputChannel.appendLine(`Error: ${stderr}`);
    }

    if (error) {
      vscode.window.showErrorMessage(`CMDR Error: ${error.message}`);
      return;
    }

    if (options?.successMessage) {
      vscode.window.showInformationMessage(options.successMessage);
    }
  });
}
