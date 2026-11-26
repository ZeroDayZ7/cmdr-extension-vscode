import * as vscode from "vscode";
import { registerCommands } from "./commands/index.js";
import { CliManager } from "./core/cli-manager.js";
import { getCliConfiguration } from "./core/cli-config.js";
import { initializeDiagnostics, logActivation, logActivationError } from "./core/diagnostics.js";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = initializeDiagnostics(context);
  diagnostics.show(true);
  logActivation("extension activation started");

  try {
    registerCommands(context);
    logActivation("command registration completed");
  } catch (error) {
    logActivationError(error);
    void vscode.window.showErrorMessage("CMDR Tools failed to activate. See the CMDR Tools output channel.");
    throw error;
  }

  try {
    const configuration = getCliConfiguration();
    if (!configuration.versionCheck || configuration.source !== "managed") {
      return;
    }

    const lastCheckKey = "cmdr.lastVersionCheck";
    const intervalMs = 24 * 60 * 60 * 1000;
    const lastCheck = context.globalState.get<number>(lastCheckKey, 0);

    if (Date.now() - lastCheck < intervalMs) {
      return;
    }

    void context.globalState.update(lastCheckKey, Date.now()).then(async () => {
      const manager = new CliManager(context);
      const check = await manager.checkUpdate();

      if (check.success && check.update?.updateAvailable && configuration.autoUpdate) {
        await manager.update();
      }
    });
  } catch (error) {
    logActivationError(error);
  }
}

export function deactivate() {}
