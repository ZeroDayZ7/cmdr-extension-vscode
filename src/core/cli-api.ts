import * as vscode from "vscode";
import { CliManager } from "./cli-manager.js";
import {
  getCliConfiguration,
  updateCliConfiguration,
  type CliConfiguration,
} from "./cli-config.js";
import type { CliOperationResult, CliStatus } from "./cli-types.js";

export class CliApi {
  private readonly manager: CliManager;

  constructor(context: vscode.ExtensionContext) {
    this.manager = new CliManager(context);
  }

  getConfiguration(): CliConfiguration {
    return getCliConfiguration();
  }

  async updateConfiguration(configuration: Partial<CliConfiguration>): Promise<void> {
    const current = this.getConfiguration();
    await updateCliConfiguration(
      configuration.source ?? current.source,
      configuration.customPath,
      configuration.autoUpdate,
      configuration.versionCheck,
    );
  }

  async getStatus(): Promise<CliStatus> {
    return this.manager.getStatus();
  }

  async checkUpdate(): Promise<CliOperationResult> {
    return this.manager.checkUpdate();
  }

  async install(): Promise<CliOperationResult> {
    return this.manager.install();
  }

  async update(): Promise<CliOperationResult> {
    return this.manager.update();
  }
}
