import * as vscode from "vscode";
import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";

async function executePreparePassword(
  uri: vscode.Uri,
  askLength: boolean = false,
) {
  const targetUri = uri || vscode.window.activeTextEditor?.document.uri;

  if (!targetUri) {
    vscode.window.showWarningMessage("CMDR: No JSON file selected.");
    return;
  }

  let length = 16;

  if (askLength) {
    const input = await vscode.window.showInputBox({
      prompt: "Enter generated password length",
      value: "16",
      validateInput: (value) => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed <= 0) {
          return "Please enter a valid positive number";
        }
        return null;
      },
    });

    if (!input) {
      return; // Anulowano przez użytkownika
    }

    length = parseInt(input, 10);
  }

  try {
    const args = [
      "bootstrap",
      "prepare-password",
      "-f",
      targetUri.fsPath,
      "-l",
      length.toString(),
    ];

    await runCliCommand("cmdr", args, {
      successMessage: `CMDR: Passwords successfully generated (length: ${length}).`,
      errorMessage: "CMDR: Failed to prepare passwords.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`CMDR: Bootstrap error: ${message}`);
  }
}

export function registerBootstrapCommands(context: vscode.ExtensionContext) {
  const commands = [
    vscode.commands.registerCommand(
      COMMANDS.PREPARE_PASSWORD,
      async (uri: vscode.Uri) => executePreparePassword(uri, false),
    ),
    vscode.commands.registerCommand(
      COMMANDS.PREPARE_PASSWORD_CUSTOM,
      async (uri: vscode.Uri) => executePreparePassword(uri, true),
    ),
  ];

  context.subscriptions.push(...commands);
}
