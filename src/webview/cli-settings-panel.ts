import * as vscode from "vscode";
import * as crypto from "node:crypto";
import { CliApi } from "../core/cli-api.js";

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
          if (message.autoUpdate !== undefined && typeof message.autoUpdate !== "boolean") {
            throw new Error("Invalid automatic update setting.");
          }
          if (message.versionCheck !== undefined && typeof message.versionCheck !== "boolean") {
            throw new Error("Invalid version check setting.");
          }
          await this.api().updateConfiguration({
            source: message.source,
            customPath: message.customPath,
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
* { box-sizing: border-box; }
body {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px;
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  font-family: var(--vscode-font-family);
}
.page-header { margin-bottom: 18px; }
.page-header h1 { margin: 0; font-size: 24px; font-weight: 600; }
.card {
  margin: 12px 0;
  padding: 16px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: var(--vscode-editorWidget-background);
}
.card h2 { margin: 0 0 14px; font-size: 15px; font-weight: 600; }
.status-layout { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: start; }
.status-details { min-width: 0; }
.status-value { font-weight: 600; margin-bottom: 8px; }
.status-meta { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; color: var(--vscode-descriptionForeground); }
.status-meta dt { font-weight: 500; }
.status-meta dd { margin: 0; overflow-wrap: anywhere; }
.field { margin-bottom: 14px; }
.field:last-child { margin-bottom: 0; }
.field-label { display: block; margin-bottom: 6px; color: var(--vscode-foreground); font-weight: 500; }
.field-help { margin-top: 6px; color: var(--vscode-descriptionForeground); font-size: 12px; }
input, select {
  width: 100%;
  min-height: 32px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
}
input:focus, select:focus, button:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 1px;
}
.input-action { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.custom-field[aria-disabled="true"] { opacity: .55; }
.custom-field[aria-disabled="true"] input, .custom-field[aria-disabled="true"] button { cursor: not-allowed; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.actions.end { justify-content: flex-end; }
button {
  min-height: 32px;
  border: 0;
  border-radius: 4px;
  padding: 6px 12px;
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  cursor: pointer;
}
button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
button:disabled { opacity: .55; cursor: wait; }
.version-actions { display: grid; grid-template-columns: repeat(2, minmax(180px, 220px)); gap: 8px; }
.version-actions button { width: 100%; }
.check-row { display: flex; gap: 10px; align-items: flex-start; margin: 10px 0; }
.check-row input { width: 16px; min-height: 16px; height: 16px; margin: 2px 0 0; flex: 0 0 auto; }
.check-row label { line-height: 20px; cursor: pointer; }
.check-copy { display: grid; gap: 2px; }
.check-copy small { color: var(--vscode-descriptionForeground); }
.general-actions { display: flex; justify-content: flex-end; margin-top: 14px; }
#result { min-height: 20px; margin-top: 12px; white-space: pre-wrap; }
.success { color: var(--vscode-testing-iconPassed); }
.error { color: var(--vscode-errorForeground); }
@media (max-width: 560px) {
  body { padding: 16px; }
  .status-layout { grid-template-columns: 1fr; }
  .status-layout .actions { justify-content: flex-start; }
  .input-action { grid-template-columns: 1fr; }
  .input-action button { width: 100%; }
  .version-actions { grid-template-columns: 1fr; }
  .general-actions { justify-content: stretch; }
  .general-actions button { width: 100%; }
}
</style>
</head>
<body>
<header class="page-header"><h1>CMDR CLI Settings</h1></header>

<section class="card" aria-labelledby="status-heading">
  <h2 id="status-heading">CLI Status</h2>
  <div class="status-layout">
    <div class="status-details">
      <div id="status-value" class="status-value">Loading...</div>
      <dl class="status-meta">
        <dt>Version</dt><dd id="status-version">—</dd>
        <dt>Executable</dt><dd id="status-location">—</dd>
      </dl>
    </div>
    <div class="actions"><button class="secondary" id="refresh" type="button">Refresh Status</button></div>
  </div>
</section>

<section class="card" aria-labelledby="source-heading">
  <h2 id="source-heading">CLI Source</h2>
  <div class="field">
    <label class="field-label" for="source">Source</label>
    <select id="source"><option value="path">System PATH</option><option value="custom">Custom Executable</option><option value="managed">Managed Installation</option></select>
  </div>
  <div class="field custom-field" id="custom-field" aria-disabled="true">
    <label class="field-label" for="customPath">Custom executable path</label>
    <div class="input-action"><input id="customPath" type="text" spellcheck="false" placeholder="C:\\tools\\cmdr\\cmdr.exe"><button class="secondary" id="browse" type="button">Browse</button></div>
  </div>
</section>

<section class="card" aria-labelledby="version-heading">
  <h2 id="version-heading">Version Management</h2>
  <div class="version-actions">
    <button class="secondary" id="checkVersion" type="button">Check CLI Version</button>
    <button class="secondary" id="checkUpdate" type="button">Check for Updates</button>
    <button id="install" type="button">Install CMDR</button>
    <button id="update" type="button">Update CMDR</button>
  </div>
</section>

<section class="card" aria-labelledby="general-heading">
  <h2 id="general-heading">General Settings</h2>
  <div class="check-row"><input type="checkbox" id="autoUpdate"><label for="autoUpdate"><span class="check-copy">Automatic updates<small>Install managed CMDR updates automatically when available</small></span></label></div>
  <div class="check-row"><input type="checkbox" id="versionCheck"><label for="versionCheck"><span class="check-copy">Periodic version checks<small>Check for managed CMDR updates periodically</small></span></label></div>
  <div class="general-actions"><button id="save" type="button">Save Settings</button></div>
</section>
<div id="result" role="status" aria-live="polite"></div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const send = (message) => vscode.postMessage(message);
let operationRunning = false;

function setRunning(running) {
  operationRunning = running;
  ['refresh','checkVersion','checkUpdate','install','update','save','browse'].forEach((id) => { $(id).disabled = running; });
}

function updateCustomField() {
  const enabled = $('source').value === 'custom';
  $('custom-field').setAttribute('aria-disabled', String(!enabled));
  $('customPath').disabled = !enabled;
  $('browse').disabled = !enabled || operationRunning;
}

$('refresh').addEventListener('click', () => send({type:'refresh'}));
$('browse').addEventListener('click', () => send({type:'browse'}));
$('source').addEventListener('change', updateCustomField);
$('checkVersion').addEventListener('click', () => { setRunning(true); send({type:'checkVersion'}); });
$('checkUpdate').addEventListener('click', () => { setRunning(true); send({type:'checkUpdate'}); });
$('install').addEventListener('click', () => { setRunning(true); send({type:'install'}); });
$('update').addEventListener('click', () => { setRunning(true); send({type:'update'}); });
$('save').addEventListener('click', () => {
  setRunning(true);
  send({type:'save', source:$('source').value, customPath:$('customPath').value, autoUpdate:$('autoUpdate').checked, versionCheck:$('versionCheck').checked});
});

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'status') {
    const s = message.status;
    const c = message.configuration;
    $('status-value').textContent = s.available ? (s.source === 'managed' ? 'Managed installation' : s.source === 'custom' ? 'Custom executable' : 'System PATH') : 'Unavailable';
    $('status-version').textContent = s.version || 'Unknown';
    $('status-location').textContent = s.location || s.message || 'No executable configured';
    $('source').value = c.source;
    $('customPath').value = c.customPath || '';
    $('autoUpdate').checked = !!c.autoUpdate;
    $('versionCheck').checked = !!c.versionCheck;
    updateCustomField();
  } else if (message.type === 'selectedPath') {
    $('customPath').value = message.path;
  } else if (message.type === 'operationResult') {
    setRunning(false);
    $('result').className = message.success ? 'success' : 'error';
    $('result').textContent = message.message || '';
    updateCustomField();
  }
});
updateCustomField();
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
