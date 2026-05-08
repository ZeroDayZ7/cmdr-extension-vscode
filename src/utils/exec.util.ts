// src/utils/exec.util.ts

import { exec } from "child_process";

export function execAsync(
  command: string,
  cwd?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
