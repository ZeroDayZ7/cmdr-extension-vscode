import * as vscode from "vscode";
import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";
import { getCliTargetFlag } from "../utils/path.util";

async function executeAnnotate(uri: vscode.Uri, flags: string = "") {
  if (!uri) {
    return;
  }

  try {
    const targetFlag = await getCliTargetFlag(uri);
    const fullCommand =
      `cmdr ant ${targetFlag} "${uri.fsPath}" ${flags}`.trim();

    runCliCommand(fullCommand, {
      successMessage: flags.includes("dry-run")
        ? "CMDR: Dry-run completed. Check output for preview."
        : "CMDR: Path annotation process finished.",
    });
  } catch (error) {
    vscode.window.showErrorMessage(`CMDR: Annotate error: ${error}`);
  }
}

export function registerAnnotateCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.ANNOTATE, (uri: vscode.Uri) => {
      executeAnnotate(uri);
    }),
    vscode.commands.registerCommand(
      COMMANDS.ANNOTATE_VERBOSE,
      (uri: vscode.Uri) => {
        executeAnnotate(uri, "-v");
      },
    ),
    vscode.commands.registerCommand(
      COMMANDS.ANNOTATE_DRY_RUN,
      (uri: vscode.Uri) => {
        executeAnnotate(uri, "--dry-run -v");
      },
    ),
  );
}
