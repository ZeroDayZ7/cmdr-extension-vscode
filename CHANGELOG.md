# Changelog

All notable changes to CMDR Tools are documented in this file.

## [Unreleased]

### Added

- Added a dedicated CMDR CLI Settings Webview with status details and source selection.
- Added managed CMDR installation and update commands.
- Added semantic version validation and comparison for update checks.
- Added process timeout and cancellation handling for CLI operations.

### Changed

- Unified CLI child-process execution through the shared process runner.
- Improved the CLI Settings layout and responsive behavior.
- Standardized Command Palette names using the `CMDR:` category convention.
- Updated extension descriptions and documentation to match implemented functionality.

### Fixed

- Removed duplicate process execution paths.
- Improved Webview message validation and listener lifecycle.
- Added archive, download, checksum, and installation rollback safeguards.
- Removed redundant `onCommand:*` activation declarations.

### Removed

- Removed the configurable GitHub repository setting.
- Removed the unnecessary Prepare Password context-menu submenu.
- Removed misleading edition-tier references.