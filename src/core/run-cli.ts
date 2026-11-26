import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import * as vscode from "vscode";
import stripAnsi from "strip-ansi";
import { resolveCli } from "./cli-resolver.js";

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

          if (options.clearOutput) {
            CmdrLogger.clear();
          }

          CmdrLogger.info(`Executing: ${executable} ${args.join(" ")}`);

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
          });

          child.on("error", (error) => {
            finish(() => {
              if (timeout) {
                clearTimeout(timeout);
              }
              CmdrLogger.error(error.message);
              vscode.window.showErrorMessage(options.errorMessage ?? error.message);
              reject(error);
            });
          });

          child.on("close", (code) => {
            finish(() => {
              if (timeout) {
                clearTimeout(timeout);
              }

              if (code === 0) {
                CmdrLogger.success("Process finished successfully");

                if (!options.silent && options.successMessage) {
                  vscode.window.showInformationMessage(options.successMessage);
                }

                resolve();
                return;
              }

              const error = new Error(`Process exited with code ${code}`);
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
