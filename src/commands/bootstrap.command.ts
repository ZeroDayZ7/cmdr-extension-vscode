import * as vscode from "vscode";
import { runCliCommand } from "../core/run-cli.js";
import { COMMANDS } from "../constants/commands.js";

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
      prompt: "Enter generated password length (1-4096)",
      value: "16",
      validateInput: (value) => {
        if (!/^\d+$/.test(value.trim())) {
          return "Enter a whole number from 1 to 4096";
        }
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 4096) {
          return "Enter a whole number from 1 to 4096";
        }
        return null;
      },
    });

    if (input === undefined) {
      return;
    }

    length = Number(input);
  }

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
