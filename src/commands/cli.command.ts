import * as vscode from "vscode";
import { CliManager } from "../core/cli-manager.js";
import { updateCliConfiguration } from "../core/cli-config.js";
import { resolveCli } from "../core/cli-resolver.js";
import { setCliExtensionContext } from "../core/run-cli.js";

export const CLI_COMMANDS = {
  CONFIGURE: "cli-helper.cliConfigure",
  STATUS: "cli-helper.cliStatus",
  UPDATE_CHECK: "cli-helper.cliUpdateCheck",
  INSTALL: "cli-helper.cliInstall",
  UPDATE: "cli-helper.cliUpdate",
} as const;

export function registerCliCommands(context: vscode.ExtensionContext): void {
  setCliExtensionContext(context);
  const manager = new CliManager(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(CLI_COMMANDS.STATUS, async () => {
      const status = await resolveCli(context);
      if (!status.available) {
        vscode.window.showErrorMessage(status.message ?? "CMDR is unavailable.");
        return;
      }

      vscode.window.showInformationMessage(
        `CMDR ${status.version ?? "unknown version"} — ${status.location ?? "unknown location"}`,
      );
    }),
    vscode.commands.registerCommand(CLI_COMMANDS.UPDATE_CHECK, async () => {
      const result = await manager.checkUpdate();
      if (!result.success) {
        vscode.window.showErrorMessage(result.message);
      } else {
        vscode.window.showInformationMessage(result.message);
      }
    }),
    vscode.commands.registerCommand(CLI_COMMANDS.INSTALL, async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Installing CMDR" },
        async () => {
          const result = await manager.install();
          if (!result.success) {
            vscode.window.showErrorMessage(result.message);
          } else {
            vscode.window.showInformationMessage(result.message);
          }
        },
      );
    }),
    vscode.commands.registerCommand(CLI_COMMANDS.UPDATE, async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Updating CMDR" },
        async () => {
          const result = await manager.update();
          if (!result.success) {
            vscode.window.showErrorMessage(result.message);
          } else {
            vscode.window.showInformationMessage(result.message);
          }
        },
      );
    }),
    vscode.commands.registerCommand(CLI_COMMANDS.CONFIGURE, async () => {
      const selected = await vscode.window.showQuickPick(
        [
          { label: "System PATH", description: "Find CMDR in the system PATH", value: "path" as const },
          { label: "Custom executable", description: "Choose a specific CMDR executable", value: "custom" as const },
          { label: "Managed installation", description: "Use the CMDR installation managed by this extension", value: "managed" as const },
        ],
        { placeHolder: "Select CMDR CLI source" },
      );

      if (!selected) {
        return;
      }

      if (selected.value === "custom") {
        const executable = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: process.platform === "win32" ? { Executables: ["exe"] } : undefined,
        });

        if (!executable?.[0]) {
          return;
        }

        await updateCliConfiguration("custom", executable[0].fsPath);
      } else {
        await updateCliConfiguration(selected.value);
      }

      const status = await resolveCli(context);
      if (status.available) {
        vscode.window.showInformationMessage(`CMDR configured: ${status.location} (${status.version ?? "unknown version"})`);
      } else {
        vscode.window.showWarningMessage(status.message ?? "CMDR is not available.");
      }
    }),
  );
}

export async function configureCliSourceForApi(
  source: "path" | "custom" | "managed",
  customPath?: string,
  autoUpdate?: boolean,
  versionCheck?: boolean,
) {
  await updateCliConfiguration(source, customPath, autoUpdate, versionCheck);
}
