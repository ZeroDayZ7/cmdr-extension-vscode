import * as vscode from "vscode";
import stripAnsi from "strip-ansi";
import fs from "node:fs";
import { resolveCli } from "./cli-resolver.js";
import { getCliConfiguration } from "./cli-config.js";
import { ProcessCancelledError, ProcessTimeoutError, runProcess } from "./cli-process.js";

export interface RunCliOptions {
  cwd?: string;
  successMessage?: string;
  errorMessage?: string;
  env?: NodeJS.ProcessEnv;
  silent?: boolean;
  clearOutput?: boolean;
  timeoutMs?: number;
}

enum LogLevel {
  INFO = "INFO",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

class CmdrLogger {
  private static channel = vscode.window.createOutputChannel("CMDR");

  static show() {
    this.channel.show(true);
  }

  static clear() {
    this.channel.clear();
  }

  private static write(level: LogLevel, message: string) {
    const timestamp = new Date().toLocaleTimeString();

    const clean = stripAnsi(message).trimEnd();

    this.channel.appendLine(`[${timestamp}] [${level}] ${clean}`);
  }

  static info(message: string) {
    this.write(LogLevel.INFO, message);
  }

  static success(message: string) {
    this.write(LogLevel.SUCCESS, message);
  }

  static error(message: string) {
    this.write(LogLevel.ERROR, message);
  }

  static debug(message: string) {
    this.write(LogLevel.DEBUG, message);
  }

  static raw(message: string) {
    const clean = stripAnsi(message);

    const lines = clean.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      if (line.includes("[ERROR]")) {
        this.error(line);
        continue;
      }

      if (line.includes("[DEBUG]")) {
        this.debug(line);
        continue;
      }

      if (line.includes("[INFO]")) {
        this.info(line);
        continue;
      }

      this.channel.appendLine(line);
    }
  }
}

let extensionContext: vscode.ExtensionContext | undefined;

export function setCliExtensionContext(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

export async function runCliCommand(
  command: string,
  args: string[] = [],
  options: RunCliOptions = {},
): Promise<void> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Running ${command}`,
      cancellable: true,
    },
    async (_, token) => {
      if (!extensionContext) {
        throw new Error("CMDR extension context is not initialized.");
      }

      const status = await resolveCli(extensionContext);
      if (!status.available || !status.location) {
        const error = new Error(status.message ?? "CMDR executable is unavailable.");
        CmdrLogger.error(error.message);
        vscode.window.showErrorMessage(options.errorMessage ?? error.message);
        throw error;
      }

      const executable = status.location;
      CmdrLogger.show();

      const configuration = getCliConfiguration();
      const workingDirectory = options.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
      CmdrLogger.info(`[CMDR execution] Command requested: ${command}`);
      CmdrLogger.info(`[CMDR execution] Working directory: ${workingDirectory}`);
      CmdrLogger.info(`[CMDR execution] Configured source: ${configuration.source}`);
      CmdrLogger.info(`[CMDR execution] Resolved executable: ${executable}`);
      CmdrLogger.info(`[CMDR execution] Arguments: ${JSON.stringify(args)}`);
      if (command === "cmdr" && args[0] === "tree") {
        CmdrLogger.info(`[CMDR execution] Target URI: ${args[1] ?? ""}`);
      }

      if (options.clearOutput) {
        CmdrLogger.clear();
      }

      if (options.cwd && (!fs.existsSync(options.cwd) || !fs.statSync(options.cwd).isDirectory())) {
        const error = new Error(`CMDR working directory is invalid: ${options.cwd}`);
        CmdrLogger.error(`[CMDR execution] Failure stage: invalid cwd; executable: ${executable}; arguments: ${JSON.stringify(args)}; cwd: ${options.cwd}`);
        vscode.window.showErrorMessage(options.errorMessage ?? error.message);
        throw error;
      }

      CmdrLogger.info(`Executing: ${executable} ${args.join(" ")}`);
      CmdrLogger.info("[CMDR execution] Process started");

      const controller = new AbortController();
      const cancellationSubscription = token.onCancellationRequested(() => controller.abort());

      let result;
      try {
        result = await runProcess(executable, args, {
          cwd: options.cwd,
          env: options.env,
          timeoutMs: options.timeoutMs,
          signal: controller.signal,
          onStdout: (text) => CmdrLogger.raw(text),
          onStderr: (text) => {
            CmdrLogger.error(text);
          },
        });
      } catch (error) {
        if (error instanceof ProcessTimeoutError) {
          CmdrLogger.error(`[CMDR execution] Failure stage: timeout; executable: ${executable}; arguments: ${JSON.stringify(args)}; exit code: unavailable; timeout: ${options.timeoutMs} ms`);
          CmdrLogger.error(error.message);
          vscode.window.showErrorMessage(options.errorMessage ?? error.message);
        } else if (error instanceof ProcessCancelledError) {
          CmdrLogger.error("Process cancelled by user");
          vscode.window.showWarningMessage("CMDR process cancelled");
        } else {
          CmdrLogger.error(`[CMDR execution] Failure stage: spawn; executable: ${executable}; arguments: ${JSON.stringify(args)}; startup error: ${error instanceof Error ? error.message : String(error)}`);
          vscode.window.showErrorMessage(options.errorMessage ?? (error instanceof Error ? error.message : String(error)));
        }
        throw error;
      } finally {
        cancellationSubscription.dispose();
      }

      CmdrLogger.info(`[CMDR execution] Exit code: ${result.exitCode}`);

      if (result.exitCode === 0) {
        CmdrLogger.success("Process finished successfully");
        if (!options.silent && options.successMessage) {
          vscode.window.showInformationMessage(options.successMessage);
        }
        return;
      }

      const error = new Error(`Process exited with code ${result.exitCode}`);
      CmdrLogger.error(`[CMDR execution] Failure stage: process exit; executable: ${executable}; arguments: ${JSON.stringify(args)}; exit code: ${result.exitCode}; stderr: ${result.stderr.trim() || "none"}`);
      CmdrLogger.error(error.message);
      vscode.window.showErrorMessage(options.errorMessage ?? error.message);
      throw error;
    },
  );
}
