import * as vscode from "vscode";
import * as crypto from "node:crypto";
import { CliManager } from "../core/cli-manager.js";
import { CliApi } from "../core/cli-api.js";
import { validateGithubRepository } from "../core/cli-config.js";

const panelType = "cmdr.cliSettings";

export class CliSettingsPanel implements vscode.WebviewPanelSerializer {
  private panel: vscode.WebviewPanel | undefined;
  private panelSubscriptions: vscode.Disposable[] = [];
  private operationRunning = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      await this.sendStatus();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      panelType,
      "CMDR CLI Settings",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
      },
    );

    this.panel.webview.html = this.getHtml();
    this.attachPanelLifecycle(this.panel);

    await this.sendStatus();
  }

  async deserializeWebviewPanel(panel: vscode.WebviewPanel): Promise<void> {
    this.panel = panel;
    panel.webview.html = this.getHtml();
    this.attachPanelLifecycle(panel);
    await this.sendStatus();
  }

  private api(): CliApi {
    return new CliApi(this.context);
  }

  private async receiveMessage(value: unknown): Promise<void> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      await this.post({ type: "operationResult", success: false, message: "Invalid settings command." });
      return;
    }

    const message = value as Record<string, unknown>;
    if (typeof message.type !== "string") {
      await this.post({ type: "operationResult", success: false, message: "Invalid settings command." });
      return;
    }

    if (this.operationRunning && message.type !== "status" && message.type !== "refresh") {
      await this.post({ type: "operationResult", success: false, message: "Another CMDR operation is already running." });
      return;
    }

    const mutatingTypes = new Set(["save", "browse", "checkVersion", "checkUpdate", "install", "update"]);
    if (mutatingTypes.has(message.type)) {
      this.operationRunning = true;
    }

    try {
      switch (message.type) {
        case "refresh":
        case "status":
          await this.sendStatus();
          break;
        case "browse": {
          const selected = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: process.platform === "win32" ? { Executables: ["exe"] } : undefined,
          });
          if (selected?.[0]) {
            await this.post({ type: "selectedPath", path: selected[0].fsPath });
          }
          break;
        }
        case "save": {
          if (message.source !== undefined && message.source !== "path" && message.source !== "custom" && message.source !== "managed") {
            throw new Error("Invalid CLI source.");
          }
          if (message.customPath !== undefined && typeof message.customPath !== "string") {
            throw new Error("Invalid custom executable path.");
          }
          if (message.githubRepository !== undefined && typeof message.githubRepository !== "string") {
            throw new Error("Invalid GitHub repository.");
          }
          if (message.autoUpdate !== undefined && typeof message.autoUpdate !== "boolean") {
            throw new Error("Invalid automatic update setting.");
          }
          if (message.versionCheck !== undefined && typeof message.versionCheck !== "boolean") {
            throw new Error("Invalid version check setting.");
          }
          if (typeof message.githubRepository === "string") {
            const repositoryError = validateGithubRepository(message.githubRepository);
            if (repositoryError) {
              await this.post({ type: "operationResult", success: false, message: repositoryError });
              return;
            }
          }
          await this.api().updateConfiguration({
            source: message.source,
            customPath: message.customPath,
            githubRepository: message.githubRepository,
            autoUpdate: message.autoUpdate,
            versionCheck: message.versionCheck,
          });
          await this.sendStatus();
          await this.post({ type: "operationResult", success: true, message: "CMDR settings saved." });
          break;
        }
        case "checkVersion":
        case "checkUpdate": {
          const result = await this.api().checkUpdate();
          await this.post({ type: "operationResult", success: result.success, message: result.message, status: result.status, update: result.update });
          await this.sendStatus();
          break;
        }
        case "install": {
          const result = await this.api().install();
          await this.post({ type: "operationResult", success: result.success, message: result.message, status: result.status });
          await this.sendStatus();
          break;
        }
        case "update": {
          const result = await this.api().update();
          await this.post({ type: "operationResult", success: result.success, message: result.message, status: result.status, update: result.update });
          await this.sendStatus();
          break;
        }
        default:
          await this.post({ type: "operationResult", success: false, message: "Unknown settings command." });
      }
    } catch (error) {
      await this.post({
        type: "operationResult",
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (mutatingTypes.has(message.type)) {
        this.operationRunning = false;
      }
    }
  }

  private async sendStatus(): Promise<void> {
    const api = this.api();
    const status = await api.getStatus();
    await this.post({
      type: "status",
      status,
      configuration: api.getConfiguration(),
    });
  }

  private async post(message: unknown): Promise<void> {
    await this.panel?.webview.postMessage(message);
  }

  private getHtml(): string {
    const nonce = crypto.randomBytes(16).toString("base64").replace(/[^A-Za-z0-9]/g, "");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CMDR CLI Settings</title>
<style nonce="${nonce}">
:root { color-scheme: light dark; }
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; }
h1,h2 { font-weight: 600; } h1 { font-size: 24px; } h2 { font-size: 16px; margin-top: 24px; }
.card { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 14px; margin: 10px 0; background: var(--vscode-editorWidget-background); }
.row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; } label { display:block; margin:8px 0 4px; }
input, select { box-sizing:border-box; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); padding:7px; min-width:260px; }
button { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; padding:8px 12px; cursor:pointer; } button.secondary { background:var(--vscode-button-secondaryBackground); color:var(--vscode-button-secondaryForeground); } button:disabled { opacity:.55; cursor:not-allowed; }
#result { min-height:20px; white-space:pre-wrap; } .success { color:var(--vscode-testing-iconPassed); } .error { color:var(--vscode-errorForeground); }
</style>
</head>
<body>
<h1>CMDR CLI Settings</h1>
<div class="card"><h2>CLI Status</h2><div id="status">Loading...</div><div class="row" style="margin-top:10px"><button id="refresh">Refresh Status</button></div></div>
<div class="card"><h2>CLI Source</h2>
<label for="source">Source</label><select id="source"><option value="path">System PATH</option><option value="custom">Custom Executable</option><option value="managed">Managed Installation</option></select>
<label for="customPath">Custom executable path</label><div class="row"><input id="customPath" placeholder="C:\\tools\\cmdr\\cmdr.exe"><button class="secondary" id="browse">Browse</button></div>
</div>
<div class="card"><h2>GitHub Repository</h2><label for="githubRepository">owner/repository</label><input id="githubRepository" value="ZeroDayZ7/cmdr"><div class="row" style="margin-top:10px"><button class="secondary" id="saveRepository">Save Repository</button></div></div>
<div class="card"><h2>Version Management</h2><div class="row"><button class="secondary" id="checkVersion">Check CLI Version</button><button class="secondary" id="checkUpdate">Check for Updates</button><button id="install">Install CMDR</button><button id="update">Update CMDR</button></div></div>
<div class="card"><h2>General Settings</h2><label><input type="checkbox" id="autoUpdate"> Automatic updates</label><label><input type="checkbox" id="versionCheck"> Periodic version checks</label><div class="row" style="margin-top:10px"><button id="save">Save Settings</button></div></div>
<div id="result"></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const send = (message) => vscode.postMessage(message);
let operationRunning=false;
function setRunning(running){operationRunning=running; ['checkVersion','checkUpdate','install','update','save','saveRepository'].forEach(id=>$(id).disabled=running);}
$('refresh').addEventListener('click',()=>send({type:'refresh'}));
$('browse').addEventListener('click',()=>send({type:'browse'}));
$('checkVersion').addEventListener('click',()=>{setRunning(true);send({type:'checkVersion'});});
$('checkUpdate').addEventListener('click',()=>{setRunning(true);send({type:'checkUpdate'});});
$('install').addEventListener('click',()=>{setRunning(true);send({type:'install'});});
$('update').addEventListener('click',()=>{setRunning(true);send({type:'update'});});
$('save').addEventListener('click',()=>saveSettings());
$('saveRepository').addEventListener('click',()=>saveSettings());
function saveSettings(){const payload={type:'save',source:$('source').value,customPath:$('customPath').value,githubRepository:$('githubRepository').value,autoUpdate:$('autoUpdate').checked,versionCheck:$('versionCheck').checked};setRunning(true);send(payload);}
window.addEventListener('message',event=>{const message=event.data;if(message.type==='status'){const s=message.status,c=message.configuration;$('status').textContent=s.available?(s.source+' | '+(s.version||'unknown version')+' | '+(s.location||'')):(s.message||'CMDR unavailable');$('source').value=c.source;$('customPath').value=c.customPath||'';$('githubRepository').value=c.githubRepository||'ZeroDayZ7/cmdr';$('autoUpdate').checked=!!c.autoUpdate;$('versionCheck').checked=!!c.versionCheck;}else if(message.type==='selectedPath'){$('customPath').value=message.path;}else if(message.type==='operationResult'){setRunning(false);$('result').className=message.success?'success':'error';$('result').textContent=message.message||'';}});
send({type:'status'});
</script>
</body>
</html>`;
  }

  private attachPanelLifecycle(panel: vscode.WebviewPanel): void {
    this.disposePanelSubscriptions();
    this.panelSubscriptions = [
      panel.webview.onDidReceiveMessage((message: unknown) => void this.receiveMessage(message)),
      panel.onDidDispose(() => {
        if (this.panel === panel) {
          this.panel = undefined;
        }
        this.operationRunning = false;
        this.disposePanelSubscriptions();
      }),
    ];
  }

  private disposePanelSubscriptions(): void {
    for (const subscription of this.panelSubscriptions) {
      subscription.dispose();
    }
    this.panelSubscriptions = [];
  }
}
