import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as vscode from "vscode";
import stripAnsi from "strip-ansi";

export interface RunCliOptions {
  cwd?: string;
  successMessage?: string;
  errorMessage?: string;
  env?: NodeJS.ProcessEnv;
  silent?: boolean;
  clearOutput?: boolean;
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
        CmdrLogger.show();

        if (options.clearOutput) {
          CmdrLogger.clear();
        }

        CmdrLogger.info(`Executing: ${command} ${args.join(" ")}`);

        const child: ChildProcessWithoutNullStreams = spawn(command, args, {
          cwd: options.cwd,
          env: {
            ...process.env,
            ...options.env,
          },
          shell: process.platform === "win32",
        });

        token.onCancellationRequested(() => {
          child.kill();

          CmdrLogger.error("Process cancelled by user");

          vscode.window.showWarningMessage("CMDR process cancelled");

          reject(new Error("Process cancelled"));
        });

        child.stdout.on("data", (data: Buffer) => {
          CmdrLogger.raw(data.toString());
        });

        child.stderr.on("data", (data: Buffer) => {
          CmdrLogger.error(data.toString());
        });

        child.on("error", (error) => {
          CmdrLogger.error(error.message);

          vscode.window.showErrorMessage(options.errorMessage ?? error.message);

          reject(error);
        });

        child.on("close", (code) => {
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
    },
  );
}
