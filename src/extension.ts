import * as vscode from "vscode";
import { registerCommands } from "./commands/index.js";

export function activate(context: vscode.ExtensionContext) {
  registerCommands(context);
}

export function deactivate() {}
