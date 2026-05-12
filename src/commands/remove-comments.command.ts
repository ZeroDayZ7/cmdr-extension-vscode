import * as vscode from "vscode";

import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";
import { getCliTargetFlag } from "../utils/path.util";

export function registerRemoveCommentsCommand(
  context: vscode.ExtensionContext,
) {
  const command = vscode.commands.registerCommand(
    COMMANDS.REMOVE_COMMENTS,
    async (uri: vscode.Uri) => {
      if (!uri) {
        vscode.window.showWarningMessage("CMDR: No target selected.");

        return;
      }

      try {
        const flag = await getCliTargetFlag(uri);

        await runCliCommand("cmdr", ["rmc", flag, uri.fsPath], {
          successMessage: "CMDR: Comments removed successfully.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        vscode.window.showErrorMessage(`CMDR: RMC error: ${message}`);
      }
    },
  );

  context.subscriptions.push(command);
}
