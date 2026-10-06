export interface PreflightInput {
  profile: string;
  env: Record<string, string | undefined>;
  manifest: unknown;
  cpuArch: string;
  freeBytes: number;
  nodeVersion: string;
  dockerVersion: string;
  composeVersion: string;
}
export function validateDeploymentPreflight(input: PreflightInput): {
  valid: boolean;
  profile: string;
  checks: string[];
  errors: string[];
  limitations: string[];
};
