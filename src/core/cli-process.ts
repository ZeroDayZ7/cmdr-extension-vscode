import { spawn } from "node:child_process";

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface RunProcessOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
}

export class ProcessTimeoutError extends Error {
  readonly code = "PROCESS_TIMEOUT";

  constructor(timeoutMs: number) {
    super(`Process timed out after ${timeoutMs} ms`);
    this.name = "ProcessTimeoutError";
  }
}

export class ProcessCancelledError extends Error {
  readonly code = "PROCESS_CANCELLED";

  constructor() {
    super("Process cancelled");
    this.name = "AbortError";
  }
}

export async function runProcess(
  executable: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<ProcessResult> {
  if (options.signal?.aborted) {
    throw new ProcessCancelledError();
  }

  return new Promise((resolve, reject) => {
    const isWindowsScript = process.platform === "win32" && /\.(cmd|bat)$/i.test(executable);
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      shell: isWindowsScript,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let killFallback: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      options.signal?.removeEventListener("abort", handleAbort);
    };

    const settleResolve = (result: ProcessResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const settleReject = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const terminateChild = () => {
      if (child.killed || child.exitCode !== null || child.signalCode !== null) {
        return;
      }

      child.kill("SIGTERM");
      killFallback = setTimeout(() => {
        killFallback = undefined;
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }, 500);
    };

    const handleAbort = () => {
      terminateChild();
      settleReject(new ProcessCancelledError());
    };

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      options.onStdout?.(text);
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      options.onStderr?.(text);
    });

    child.on("error", (error) => {
      if (killFallback) {
        clearTimeout(killFallback);
        killFallback = undefined;
      }
      settleReject(error);
    });

    child.on("close", (exitCode) => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      if (killFallback) {
        clearTimeout(killFallback);
        killFallback = undefined;
      }
      settleResolve({ exitCode, stdout, stderr });
    });

    options.signal?.addEventListener("abort", handleAbort, { once: true });

    if (options.signal?.aborted) {
      handleAbort();
      return;
    }

    if (options.timeoutMs !== undefined) {
      timeout = setTimeout(() => {
        terminateChild();
        settleReject(new ProcessTimeoutError(options.timeoutMs as number));
      }, options.timeoutMs);
    }
  });
}
