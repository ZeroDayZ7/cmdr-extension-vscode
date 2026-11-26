export type CliSource = "path" | "custom" | "managed";

export interface CliStatus {
  source: CliSource;
  available: boolean;
  location?: string;
  version?: string;
  message?: string;
}

export interface CliUpdateStatus {
  installed: boolean;
  currentVersion?: string;
  latestVersion?: string;
  updateAvailable: boolean;
  releaseTag?: string;
}

export interface CliOperationResult {
  success: boolean;
  status?: CliStatus;
  update?: CliUpdateStatus;
  message: string;
}
