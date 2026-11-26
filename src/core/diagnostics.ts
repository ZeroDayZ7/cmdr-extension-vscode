import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export function initializeDiagnostics(context: vscode.ExtensionContext): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("CMDR Tools");
  }
  context.subscriptions.push(channel);
  return channel;
}

export function logActivation(message: string): void {
  channel?.appendLine(`[CMDR activation] ${message}`);
}

export function logCommand(message: string): void {
  channel?.appendLine(`[CMDR commands] ${message}`);
}

export function logActivationError(error: unknown): void {
  const detail = error instanceof Error
    ? `${error.message}\n${error.stack ?? ""}`
    : String(error);
  channel?.appendLine(`[CMDR activation ERROR]\n${detail}`);
}
