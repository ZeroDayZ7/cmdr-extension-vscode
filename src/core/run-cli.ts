import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import * as vscode from "vscode";
import stripAnsi from "strip-ansi";
import { resolveCli } from "./cli-resolver.js";
import { getCliConfiguration } from "./cli-config.js";
import fs from "node:fs";

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
      return new Promise((resolve, reject) => {
        if (!extensionContext) {
          reject(new Error("CMDR extension context is not initialized."));
          return;
        }

        const executeCli = (executable: string) => {
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

          CmdrLogger.info(`Executing: ${executable} ${args.join(" ")}`);
          CmdrLogger.info("[CMDR execution] Process started");

          const cwd = options.cwd;
          if (cwd && (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory())) {
            const error = new Error(`CMDR working directory is invalid: ${cwd}`);
            CmdrLogger.error(`[CMDR execution] Failure stage: invalid cwd; executable: ${executable}; arguments: ${JSON.stringify(args)}; cwd: ${cwd}`);
            vscode.window.showErrorMessage(options.errorMessage ?? error.message);
            reject(error);
            return;
          }

          const child: ChildProcessWithoutNullStreams = spawn(executable, args, {
            cwd: options.cwd,
            env: {
              ...process.env,
              ...options.env,
            },
            shell: false,
            windowsHide: true,
          });

          let settled = false;
          let stderrOutput = "";
          const finish = (callback: () => void) => {
            if (settled) {
              return;
            }
            settled = true;
            callback();
          };

          const timeout = options.timeoutMs
            ? setTimeout(() => {
                finish(() => {
                  child.kill();
                  const error = new Error(`CMDR process timed out after ${options.timeoutMs} ms`);
                  CmdrLogger.error(`[CMDR execution] Failure stage: timeout; executable: ${executable}; arguments: ${JSON.stringify(args)}; exit code: unavailable; timeout: ${options.timeoutMs} ms`);
                  CmdrLogger.error(error.message);
                  vscode.window.showErrorMessage(options.errorMessage ?? error.message);
                  reject(error);
                });
              }, options.timeoutMs)
            : undefined;

          token.onCancellationRequested(() => {
            finish(() => {
              if (timeout) {
                clearTimeout(timeout);
              }
              child.kill();
              CmdrLogger.error("Process cancelled by user");
              vscode.window.showWarningMessage("CMDR process cancelled");
              reject(new Error("Process cancelled"));
            });
          });

          child.stdout.on("data", (data: Buffer) => {
            CmdrLogger.raw(data.toString());
          });

          child.stderr.on("data", (data: Buffer) => {
            CmdrLogger.error(data.toString());
            stderrOutput += data.toString();
          });

          child.on("error", (error) => {
            finish(() => {
              if (timeout) {
                clearTimeout(timeout);
              }
              CmdrLogger.error(`[CMDR execution] Failure stage: spawn; executable: ${executable}; arguments: ${JSON.stringify(args)}; startup error: ${error.message}`);
              vscode.window.showErrorMessage(options.errorMessage ?? error.message);
              reject(error);
            });
          });

          child.on("close", (code) => {
            finish(() => {
              if (timeout) {
                clearTimeout(timeout);
              }
              CmdrLogger.info(`[CMDR execution] Exit code: ${code}`);

              if (code === 0) {
                CmdrLogger.success("Process finished successfully");

                if (!options.silent && options.successMessage) {
                  vscode.window.showInformationMessage(options.successMessage);
                }

                resolve();
                return;
              }

              const error = new Error(`Process exited with code ${code}`);
              CmdrLogger.error(`[CMDR execution] Failure stage: process exit; executable: ${executable}; arguments: ${JSON.stringify(args)}; exit code: ${code}; stderr: ${stderrOutput.trim() || "none"}`);
              CmdrLogger.error(error.message);
              vscode.window.showErrorMessage(options.errorMessage ?? error.message);
              reject(error);
            });
          });
        };

        resolveCli(extensionContext).then((status) => {
          if (!status.available || !status.location) {
            const error = new Error(status.message ?? "CMDR executable is unavailable.");
            CmdrLogger.error(error.message);
            vscode.window.showErrorMessage(options.errorMessage ?? error.message);
            reject(error);
            return;
          }

          executeCli(status.location);
        }).catch(reject);
      });
    },
  );
}
