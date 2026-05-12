import * as vscode from "vscode";

import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";
import { getCliTargetFlag } from "../utils/path.util";

export function registerRegionsCommand(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    COMMANDS.CODE_REGIONS,
    async (uri: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;

      if (!targetUri) {
        vscode.window.showWarningMessage("CMDR: No target selected.");

        return;
      }

      try {
        const flag = await getCliTargetFlag(targetUri);

        await runCliCommand("cmdr", ["reg", flag, targetUri.fsPath], {
          successMessage: "CMDR: Code regions (#region) added successfully.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        vscode.window.showErrorMessage(`CMDR: Regions error: ${message}`);
      }
    },
  );

  context.subscriptions.push(command);
}
