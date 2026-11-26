import * as vscode from "vscode";
import { registerCommands } from "./commands/index.js";
import { CliManager } from "./core/cli-manager.js";
import { getCliConfiguration } from "./core/cli-config.js";

export function activate(context: vscode.ExtensionContext) {
  registerCommands(context);

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
}

export function deactivate() {}
