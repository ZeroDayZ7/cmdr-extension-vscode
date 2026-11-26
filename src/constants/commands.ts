// cmdr: cli-helper/src/constants/commands.ts

export const COMMANDS = {
  REMOVE_COMMENTS: "cli-helper.rmvComments",
  FILES_COMBINE: "cli-helper.fcDart",

  TREE_CLIPBOARD: "cli-helper.treeClipboard",
  TREE_ASCII: "cli-helper.treeAscii",
  TREE_JSON: "cli-helper.treeJson",
  TREE_CSV: "cli-helper.treeCsv",
  TREE_MD: "cli-helper.treeMd",

  ANNOTATE: "cli-helper.annotate",
  ANNOTATE_VERBOSE: "cli-helper.annotateVerbose",
  ANNOTATE_DRY_RUN: "cli-helper.annotateDryRun",

  CODE_REGIONS: "cli-helper.codeRegions",

  PREPARE_PASSWORD: "cli-helper.preparePassword",
  PREPARE_PASSWORD_CUSTOM: "cli-helper.preparePasswordCustom",

  CLI_CONFIGURE: "cli-helper.cliConfigure",
  CLI_STATUS: "cli-helper.cliStatus",
  CLI_UPDATE_CHECK: "cli-helper.cliUpdateCheck",
  CLI_INSTALL: "cli-helper.cliInstall",
  CLI_UPDATE: "cli-helper.cliUpdate",
} as const;
