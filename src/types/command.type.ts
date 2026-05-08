// src/types/command.type.ts

export interface CliCommandOptions {
  command: string;
  successMessage?: string;
  errorPrefix?: string;
  cwd?: string;
}

export interface ExplorerCommandContext {
  fsPath: string;
  isDirectory: boolean;
}
