// src/utils/notification.util.ts

import * as vscode from "vscode";

export function showSuccess(message: string) {
  vscode.window.showInformationMessage(message);
}

export function showError(message: string) {
  vscode.window.showErrorMessage(message);
}

export function showWarning(message: string) {
  vscode.window.showWarningMessage(message);
}
