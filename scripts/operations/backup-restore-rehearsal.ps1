param(
  [string]$Container = 'integration-core-postgres-1',
  [string]$SourceDatabase = 'iot_dev',
  [string]$RestoreDatabase = ('iot_restore_' + (Get-Date -Format 'yyyyMMddHHmmss')),
  [string]$DatabaseUser = 'iot_app'
)

$ErrorActionPreference = 'Stop'

if ($SourceDatabase -notmatch '^[a-z0-9_]+$') {
  throw 'Source database name contains unsupported characters.'
}
if ($RestoreDatabase -notmatch '^iot_restore_[a-z0-9_]+$') {
  throw 'Restore target must start with iot_restore_ and contain only lowercase letters, digits or underscores.'
}
if ($SourceDatabase -eq $RestoreDatabase -or $RestoreDatabase -in @('iot_dev', 'iot_test', 'postgres')) {
  throw 'Restore target must be a new isolated rehearsal database.'
}
if ($DatabaseUser -notmatch '^[a-zA-Z0-9_]+$') {
  throw 'Database user contains unsupported characters.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$artifactRoot = Join-Path $repoRoot 'artifacts\backup-rehearsal'
New-Item -ItemType Directory -Force $artifactRoot | Out-Null
$backupName = "$SourceDatabase-$(Get-Date -Format 'yyyyMMddHHmmss').dump"
$containerBackup = "/tmp/$backupName"
$localBackup = Join-Path $artifactRoot $backupName

docker inspect $Container | Out-Null
$existing = docker exec $Container psql -U $DatabaseUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$RestoreDatabase'"
if ($existing -eq '1') {
  throw "Refusing to overwrite existing database $RestoreDatabase. Choose a new target name."
}

try {
  docker exec $Container pg_dump -U $DatabaseUser -d $SourceDatabase -Fc -f $containerBackup
  docker cp "${Container}:$containerBackup" $localBackup
  docker exec $Container createdb -U $DatabaseUser $RestoreDatabase
  docker exec $Container pg_restore -U $DatabaseUser -d $RestoreDatabase --exit-on-error $containerBackup

  $migrationCount = docker exec $Container psql -U $DatabaseUser -d $RestoreDatabase -tAc 'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
  if ([int]$migrationCount -lt 1) {
    throw 'Restored database has no completed Prisma migration.'
  }

  Write-Output "Restore rehearsal passed: $SourceDatabase -> $RestoreDatabase"
  Write-Output "Backup artifact: $localBackup"
  Write-Output 'The isolated database and backup are retained for review; this script never deletes or overwrites them.'
}
finally {
  docker exec $Container rm -f $containerBackup 2>$null | Out-Null
}
