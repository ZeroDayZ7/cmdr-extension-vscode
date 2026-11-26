import * as vscode from "vscode";
import { CliManager } from "../core/cli-manager.js";
import { updateCliConfiguration } from "../core/cli-config.js";
import { resolveCli } from "../core/cli-resolver.js";
import { setCliExtensionContext } from "../core/run-cli.js";
import { COMMANDS } from "../constants/commands.js";
import { CliSettingsPanel } from "../webview/cli-settings-panel.js";
import { logCommand, logActivationError } from "../core/diagnostics.js";

export function registerCliCommands(context: vscode.ExtensionContext): void {
  logCommand("CLI commands registered started");
  try {
    setCliExtensionContext(context);
    const manager = new CliManager(context);
    const settingsPanel = new CliSettingsPanel(context);
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer("cmdr.cliSettings", settingsPanel),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(COMMANDS.CLI_STATUS, async () => {
        const status = await resolveCli(context);
        if (!status.available) {
          vscode.window.showErrorMessage(status.message ?? "CMDR is unavailable.");
          return;
        }

        vscode.window.showInformationMessage(
          `CMDR ${status.version ?? "unknown version"} — ${status.location ?? "unknown location"}`,
        );
      }),
      vscode.commands.registerCommand(COMMANDS.CLI_UPDATE_CHECK, async () => {
        const result = await manager.checkUpdate();
        if (!result.success) {
          vscode.window.showErrorMessage(result.message);
        } else {
          vscode.window.showInformationMessage(result.message);
        }
      }),
      vscode.commands.registerCommand(COMMANDS.CLI_INSTALL, async () => {
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
      vscode.commands.registerCommand(COMMANDS.CLI_UPDATE, async () => {
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
      vscode.commands.registerCommand(COMMANDS.CLI_CONFIGURE, async () => {
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
      vscode.commands.registerCommand(COMMANDS.CLI_SETTINGS, async () => {
        logCommand(`CLI Settings command registered handler executing: ${COMMANDS.CLI_SETTINGS}`);
        await settingsPanel.open();
      }),
    );

    logCommand(`CLI Settings command registered: ${COMMANDS.CLI_SETTINGS}`);
    logCommand("CLI commands registered");
  } catch (error) {
    logActivationError(error);
    throw error;
  }
}

export async function configureCliSourceForApi(
  source: "path" | "custom" | "managed",
  customPath?: string,
  autoUpdate?: boolean,
  versionCheck?: boolean,
) {
  await updateCliConfiguration(source, customPath, undefined, autoUpdate, versionCheck);
}
