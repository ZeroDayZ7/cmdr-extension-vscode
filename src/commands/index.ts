import * as vscode from "vscode";

import { registerAnnotateCommand } from "./annotate.command";
import { registerFCCommand } from "./fc.command";
import { registerRemoveCommentsCommand } from "./remove-comments.command";
import { registerTreeCommands } from "./tree.command";

export function registerCommands(context: vscode.ExtensionContext) {
  registerAnnotateCommand(context);
  registerFCCommand(context);
  registerRemoveCommentsCommand(context);
  registerTreeCommands(context);
}
