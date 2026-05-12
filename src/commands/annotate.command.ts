// cmdr: cli-helper/src/commands/annotate.command.ts

import * as vscode from "vscode";
import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";
import { getCliTargetFlag } from "../utils/path.util";

interface AnnotateOptions {
  verbose?: boolean;
  dryRun?: boolean;
}

async function executeAnnotate(uri: vscode.Uri, options: AnnotateOptions = {}) {
  if (!uri) {
    vscode.window.showWarningMessage("CMDR: No file or folder selected.");

    return;
  }

  try {
    const targetFlag = await getCliTargetFlag(uri);

    const args: string[] = ["ant", targetFlag, uri.fsPath];

    if (options.verbose) {
      args.push("-v");
    }

    if (options.dryRun) {
      args.push("--dry-run");
    }

    await runCliCommand("cmdr", args, {
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      successMessage: options.dryRun
        ? "CMDR: Dry-run completed successfully."
        : "CMDR: Annotation completed successfully.",
      errorMessage: "CMDR: Annotation failed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    vscode.window.showErrorMessage(`CMDR: Annotate error: ${message}`);
  }
}

export function registerAnnotateCommand(context: vscode.ExtensionContext) {
  const register = (command: string, options?: AnnotateOptions) => {
    return vscode.commands.registerCommand(command, async (uri: vscode.Uri) => {
      await executeAnnotate(uri, options);
    });
  };

  context.subscriptions.push(
    register(COMMANDS.ANNOTATE),
    register(COMMANDS.ANNOTATE_VERBOSE, {
      verbose: true,
    }),
    register(COMMANDS.ANNOTATE_DRY_RUN, {
      verbose: true,
      dryRun: true,
    }),
  );
}
