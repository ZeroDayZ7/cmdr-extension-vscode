// src/utils/vscode.util.ts

import * as vscode from "vscode";

export function registerCommand(
  command: string,
  callback: (...args: any[]) => any,
) {
  return vscode.commands.registerCommand(
    command,
    callback,
  );
}

export function pushSubscription(
  context: vscode.ExtensionContext,
  ...subscriptions: vscode.Disposable[]
) {
  context.subscriptions.push(...subscriptions);
}

export function getWorkspaceFolders() {
  return vscode.workspace.workspaceFolders;
}

export function getActiveEditor() {
  return vscode.window.activeTextEditor;
}
