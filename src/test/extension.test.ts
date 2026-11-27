import * as assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('activates extension and executes CLI Settings command', async () => {
		const extension = vscode.extensions.getExtension("zerodayz7.cli-helper");
		assert.ok(extension, "CMDR Tools extension must be available");
		await extension.activate();
		assert.strictEqual(extension.isActive, true);
		await vscode.commands.executeCommand("cli-helper.cliSettings");
	});

	test('executes the registered CMDR Tree command', async () => {
		const extension = vscode.extensions.getExtension("zerodayz7.cli-helper");
		assert.ok(extension, "CMDR Tools extension must be available");
		await extension.activate();

		const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-tree-fixture-"));
		const directory = path.join(temporary, "project");
		const argsFile = path.join(temporary, "args.txt");
		fs.mkdirSync(path.join(directory, "child"), { recursive: true });

		const configuration = vscode.workspace.getConfiguration("cmdr");
		const previousSource = configuration.get("cli.source", "path");
		const previousCustomPath = configuration.get("cli.customPath", "");
		const executable = path.join(temporary, process.platform === "win32" ? "cmdr.cmd" : "cmdr");

		if (process.platform === "win32") {
			fs.writeFileSync(executable,
				`@echo off\r\nif "%1"=="version" (echo 0.3.324 & exit /b 0)\r\necho %* > "${argsFile.replace(/%/g, "%%")}"\r\nexit /b 0\r\n`,
				{ mode: 0o755 });
		} else {
			fs.writeFileSync(executable,
				`#!/bin/sh\nif [ "$1" = "version" ]; then echo 0.3.324; exit 0; fi\nprintf '%s\\n' "$*" > ${JSON.stringify(argsFile)}\nexit 0\n`,
				{ mode: 0o755 });
		}

		try {
			await configuration.update("cli.source", "custom", vscode.ConfigurationTarget.Global);
			await configuration.update("cli.customPath", executable, vscode.ConfigurationTarget.Global);

			await vscode.commands.executeCommand("cli-helper.treeClipboard", vscode.Uri.file(directory));

			assert.ok(fs.existsSync(argsFile), "fake CMDR should receive the Tree invocation");
			const invocation = fs.readFileSync(argsFile, "utf8").trim();
			assert.match(invocation, /^tree /);
			assert.match(invocation, /-c$/);
			assert.ok(invocation.includes(directory), "fake CMDR should receive the selected directory");
		} finally {
			await configuration.update("cli.customPath", previousCustomPath, vscode.ConfigurationTarget.Global);
			await configuration.update("cli.source", previousSource, vscode.ConfigurationTarget.Global);
			fs.rmSync(temporary, { recursive: true, force: true });
		}
	});
});
