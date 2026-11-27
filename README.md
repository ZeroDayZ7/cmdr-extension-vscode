# CMDR Tools

CMDR Tools integrates the CMDR command-line toolkit into Visual Studio Code. It provides Explorer context-menu actions, Command Palette commands, CLI status and source management, managed installation/update controls, and a settings Webview.

## Features

### File and project operations

- Annotate files or directories, with standard, verbose, and dry-run modes.
- Add `#region` wrappers to code.
- Remove comments from a selected file or directory.
- Copy project tree structures as standard, ASCII, JSON, CSV, or Markdown output.
- Combine files through the CMDR `fc` command.
- Generate passwords for a JSON file with default or custom lengths.

### CMDR CLI management

- Check the resolved CLI status and executable version.
- Check for stable CMDR CLI updates.
- Select System PATH, a custom executable, or the managed CMDR installation.
- Open the managed installation and update controls in a dedicated settings view.
- Configure automatic managed updates and periodic version checks.

## Access

Commands are available from:

- The Explorer context menu under **CMDR Tools**.
- The Command Palette. Commands use the `CMDR:` category prefix.

Password commands are available in the Command Palette even though they are not placed in the Explorer context menu.

## Requirements

- Visual Studio Code 1.116.0 or newer.
- Node.js is only required for building or developing the extension from source.
- A CMDR executable is required for commands that invoke the CLI.

Supported CMDR installation sources:

- System PATH.
- A custom executable path selected in settings.
- An extension-managed installation for supported Windows x64 and Linux x64 builds.

CMDR Tools is implemented with Node.js process APIs and does not require PowerShell specifically.

## Installation

Install CMDR Tools from the VS Code Marketplace, or install a generated VSIX package:

```powershell
code --install-extension cli-helper-<version>.vsix
```

## CLI Configuration

Open the Command Palette and run:

```text
CMDR: CLI Settings
```

The settings view lets you select the CLI source and configure managed update behavior. You can also run `CMDR: Configure CLI Source` to select the source quickly.

For PATH or custom installations, install and update CMDR independently through the corresponding CMDR CLI distribution mechanism.

## Development and releases

Do lokalnego budowania, przygotowania nowej wersji i publikacji GitHub Release służy proces opisany w [dokumentacji build i release](docs/release-local.md).

Krótko:

- `make build` tworzy lokalny pakiet VSIX.
- `make release` tworzy i wypycha tag `vX.Y.Z` po wcześniejszym zatwierdzeniu zmian i czystym working tree.
- GitHub Actions buduje VSIX i dołącza go do GitHub Release; pakiet pobierzesz ze [strony Releases](https://github.com/ZeroDayZ7/cli-helper-cmdr-extension-vscode/releases).

## Links

- [CMDR CLI repository](https://github.com/ZeroDayZ7/cmdr)
- [CMDR Tools extension repository](https://github.com/ZeroDayZ7/cli-helper-cmdr-extension-vscode)
