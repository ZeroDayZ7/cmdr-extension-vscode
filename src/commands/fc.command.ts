// src/commands/fc.command.ts

import * as vscode from "vscode";

import { runCliCommand } from "../core/run-cli";
import { COMMANDS } from "../constants/commands";

export function registerFCCommand(
  context: vscode.ExtensionContext,
) {
  const command = vscode.commands.registerCommand(
    COMMANDS.FILES_COMBINE,
    async (uri: vscode.Uri) => {
      const targetPath = uri
        ? uri.fsPath
        : vscode.workspace.workspaceFolders?.[0]
            .uri.fsPath;

      if (!targetPath) {
        return;
      }

      runCliCommand(
        `cmdr fc`,
        {
          cwd: targetPath,
          successMessage:
            "CMDR: Files combined successfully.",
        },
      );
    },
  );

  context.subscriptions.push(command);
}
