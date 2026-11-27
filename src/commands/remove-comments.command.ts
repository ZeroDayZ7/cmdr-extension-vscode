// cmdr: cli-helper/src/commands/remove-comments.command.ts

import * as vscode from "vscode";

import { runCliCommand } from "../core/run-cli.js";
import { COMMANDS } from "../constants/commands.js";
import { getCliTargetFlag } from "../utils/path.util.js";

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

      const flag = await getCliTargetFlag(uri);

      await runCliCommand("cmdr", ["rmc", flag, uri.fsPath], {
        successMessage: "CMDR: Comments removed successfully.",
      });
    },
  );

  context.subscriptions.push(command);
}
