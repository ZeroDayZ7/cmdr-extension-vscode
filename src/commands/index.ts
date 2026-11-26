// cmdr: cli-helper/src/commands/index.ts

import * as vscode from "vscode";

import { registerAnnotateCommand } from "./annotate.command.js";
import { registerFCCommand } from "./fc.command.js";
import { registerRemoveCommentsCommand } from "./remove-comments.command.js";
import { registerTreeCommands } from "./tree.command.js";
import { registerRegionsCommand } from "./regions.command.js";
import { registerBootstrapCommands } from "./bootstrap.command.js";
import { registerCliCommands } from "./cli.command.js";

export function registerCommands(context: vscode.ExtensionContext) {
  registerAnnotateCommand(context);
  registerFCCommand(context);
  registerRemoveCommentsCommand(context);
  registerTreeCommands(context);
  registerRegionsCommand(context);
  registerBootstrapCommands(context);
  registerCliCommands(context);
}
