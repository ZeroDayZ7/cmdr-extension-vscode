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
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cmdr-tree-"));
		fs.mkdirSync(path.join(directory, "child"));
		await vscode.commands.executeCommand("cli-helper.treeClipboard", vscode.Uri.file(directory));
		fs.rmSync(directory, { recursive: true, force: true });
	});
});
