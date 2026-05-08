// src/utils/path.util.ts

import * as vscode from "vscode";

export function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]
    ?.uri.fsPath;
}

export function getTargetPath(
  uri?: vscode.Uri,
): string | undefined {
  if (uri) {
    return uri.fsPath;
  }

  return getWorkspacePath();
}

export async function isDirectory(
  uri: vscode.Uri,
): Promise<boolean> {
  const stat = await vscode.workspace.fs.stat(uri);

  return stat.type === vscode.FileType.Directory;
}

export async function getCliTargetFlag(
  uri: vscode.Uri,
): Promise<"-d" | "-f"> {
  const directory = await isDirectory(uri);

  return directory ? "-d" : "-f";
}
