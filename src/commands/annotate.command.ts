// cmdr: cli-helper/src/commands/annotate.command.ts

import * as vscode from "vscode";
import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";
import { getCliTargetFlag } from "../utils/path.util";

export function registerAnnotateCommand(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    COMMANDS.ANNOTATE,
    async (uri: vscode.Uri) => {
      if (!uri) {
        return;
      }

      try {
        const flag = await getCliTargetFlag(uri);
        runCliCommand(`cmdr ant ${flag} "${uri.fsPath}"`, {
          successMessage: "CMDR: Path annotation added successfully.",
        });
      } catch (error) {
        vscode.window.showErrorMessage(`CMDR: Annotate error: ${error}`);
      }
    },
  );
  context.subscriptions.push(command);
}
