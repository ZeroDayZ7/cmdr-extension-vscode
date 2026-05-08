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
        return;
      }

      try {
        const flag = await getCliTargetFlag(uri);
        runCliCommand(`cmdr rmc ${flag} "${uri.fsPath}"`, {
          successMessage: "CMDR: Comments removed successfully.",
        });
      } catch (error) {
        vscode.window.showErrorMessage(`CMDR: RMC error: ${error}`);
      }
    },
  );
  context.subscriptions.push(command);
}
