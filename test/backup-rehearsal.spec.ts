import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type RehearsalResult = { ok: boolean; calls: string[]; error: string; report: string[] };

function rehearse(scenario: string): RehearsalResult {
  const script = resolve('scripts/operations/backup-restore-rehearsal.ps1').replaceAll("'", "''");
  const command = `
$global:calls = [System.Collections.Generic.List[string]]::new()
$global:scenario = '${scenario}'
$WarningPreference = 'Stop'
function global:docker {
  $stage = if ($args[0] -eq 'inspect') { 'inspect' }
    elseif ($args[0] -eq 'cp') { 'copy' }
    elseif ($args -contains 'pg_dump') { 'dump' }
    elseif ($args -contains 'createdb') { 'create' }
    elseif ($args -contains 'pg_restore') { 'restore' }
    elseif ($args -contains 'rm') { 'cleanup' }
    elseif (($args -join ' ') -match 'SELECT 1') { 'exists' }
    else { 'verify' }
  $global:calls.Add($stage)
  $global:LASTEXITCODE = 0
  if ($global:scenario -eq ('fail_' + $stage) -or
      ($global:scenario -eq 'creation_race' -and $stage -eq 'create') -or
      ($global:scenario -eq 'fail_dump_cleanup' -and $stage -in @('dump', 'cleanup'))) {
    $global:LASTEXITCODE = 17
    return
  }
  if ($stage -eq 'exists') {
    if ($global:scenario -eq 'existing') { '1' }
    elseif ($global:scenario -eq 'invalid_exists') { 'unexpected' }
  }
  if ($stage -eq 'verify') {
    if ($global:scenario -eq 'invalid_count') { 'unexpected' }
    else { '2' }
  }
}
$ok = $false; $errorText = ''; $report = @()
try {
  $report = @(& '${script}' -Container 'fake-rehearsal' -SourceDatabase 'iot_fixture' -RestoreDatabase 'iot_restore_fake' 3>$null)
  $ok = $true
} catch { $errorText = $_.Exception.Message }
@{ ok = $ok; calls = @($global:calls); error = $errorText; report = $report } | ConvertTo-Json -Compress
`;
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      Buffer.from(command, 'utf16le').toString('base64'),
    ],
    { encoding: 'utf8', timeout: 10_000, windowsHide: true },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout.trim()) as RehearsalResult;
}

// This helper is Windows PowerShell-specific; no real Docker or database is invoked.
describe.skipIf(process.platform !== 'win32')('backup rehearsal fail-closed boundary', () => {
  it('stops a check-then-create race before restoring to somebody else’s database', () => {
    const result = rehearse('creation_race');
    expect(result.ok).toBe(false);
    expect(result.calls).not.toContain('restore');
    expect(result.report.join('\n')).not.toContain('passed');
  });

  it.each(['inspect', 'exists', 'dump', 'copy', 'create', 'restore', 'verify'])(
    'aborts on native %s failure without reporting success',
    (stage) => {
      const result = rehearse(`fail_${stage}`);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('failed');
      expect(result.report.join('\n')).not.toContain('passed');
      if (['inspect', 'exists', 'dump', 'copy', 'create'].includes(stage)) {
        expect(result.calls).not.toContain('restore');
      }
    },
  );

  it.each(['existing', 'invalid_exists', 'invalid_count'])(
    'rejects %s target/count evidence',
    (scenario) => {
      const result = rehearse(scenario);
      expect(result.ok).toBe(false);
      if (scenario !== 'invalid_count') expect(result.calls).not.toContain('create');
    },
  );

  it('reports successful database restoration only after every checked step', () => {
    const result = rehearse('success');
    expect(result.ok).toBe(true);
    expect(result.calls).toEqual([
      'inspect',
      'exists',
      'dump',
      'copy',
      'create',
      'restore',
      'verify',
      'cleanup',
    ]);
    expect(result.report.join('\n')).toContain('Restore rehearsal passed');
  });

  it('does not turn temporary-dump cleanup failure into data-restore failure', () => {
    const result = rehearse('fail_cleanup');
    expect(result.ok).toBe(true);
    expect(result.calls.at(-1)).toBe('cleanup');
  });

  it('preserves the original failure when cleanup also fails with warnings configured to stop', () => {
    const result = rehearse('fail_dump_cleanup');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('dump failed');
    expect(result.calls).not.toContain('restore');
    expect(result.calls.at(-1)).toBe('cleanup');
  });
});
