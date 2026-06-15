# scripts/db/setup-local-db.ps1
# Local PostgreSQL setup for MailZen — creates database, role, verifies connection.
# Windows-native PowerShell version (works on PS 5.1 and PS Core).
#
# Usage:  pwsh -File scripts/db/setup-local-db.ps1
#         powershell -ExecutionPolicy Bypass -File scripts/db/setup-local-db.ps1

[CmdletBinding()]
param(
  [string]$PgUser     = 'mailzen',
  [string]$PgPassword = 'mailzen',
  [string]$PgDb       = 'mailzen',
  [string]$PgHost     = 'localhost',
  [int]$PgPort        = 5432
)

$ErrorActionPreference = 'Stop'

# ---- Locate PostgreSQL binaries ----
$pgBin = $null
$candidates = @(
  'C:\Program Files\PostgreSQL\17\bin',
  'C:\Program Files\PostgreSQL\16\bin',
  'C:\Program Files\PostgreSQL\15\bin'
)
foreach ($c in $candidates) {
  if (Test-Path (Join-Path $c 'psql.exe')) { $pgBin = $c; break }
}

if (-not $pgBin) {
  Write-Host "✗ PostgreSQL psql.exe not found in standard locations." -ForegroundColor Red
  Write-Host "  Set MAILZEN_DB_* env vars manually or install PostgreSQL 15/16/17." -ForegroundColor Yellow
  exit 1
}

$psql = Join-Path $pgBin 'psql.exe'
Write-Host "→ Using PostgreSQL: $pgBin" -ForegroundColor Cyan
Write-Host "→ Target: $PgUser@$PgHost`:$PgPort/$PgDb" -ForegroundColor Cyan

# ---- 1. Verify connection as superuser (peer/trust auth) ----
Write-Host ""
Write-Host "▶ Step 1/4: Verify 'postgres' superuser connection" -ForegroundColor Cyan
$superOk = & $psql -U postgres -h $PgHost -d postgres -tAc "SELECT 1;" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ✗ Cannot connect as postgres superuser. Start the service first:" -ForegroundColor Red
  Write-Host "    sc start postgresql-x64-17" -ForegroundColor Yellow
  exit 1
}

# ---- 2. Create the role ----
Write-Host ""
Write-Host "▶ Step 2/4: Create role '$PgUser' (if missing)" -ForegroundColor Cyan
$roleCheck = & $psql -U postgres -h $PgHost -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PgUser';"
if ($roleCheck -ne '1') {
  & $psql -U postgres -h $PgHost -d postgres -c "CREATE ROLE $PgUser WITH LOGIN SUPERUSER PASSWORD '$PgPassword';"
  Write-Host "  ✓ Role created" -ForegroundColor Green
} else {
  Write-Host "  ✓ Role already exists" -ForegroundColor Green
  & $psql -U postgres -h $PgHost -d postgres -c "ALTER USER $PgUser WITH PASSWORD '$PgPassword';" | Out-Null
}

# ---- 3. Create the database ----
Write-Host ""
Write-Host "▶ Step 3/4: Create database '$PgDb' (if missing)" -ForegroundColor Cyan
$dbCheck = & $psql -U postgres -h $PgHost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PgDb';"
if ($dbCheck -ne '1') {
  & $psql -U postgres -h $PgHost -d postgres -c "CREATE DATABASE $PgDb OWNER $PgUser;"
  Write-Host "  ✓ Database created" -ForegroundColor Green
} else {
  Write-Host "  ✓ Database already exists" -ForegroundColor Green
}

# ---- 4. Verify connection as the new user with password ----
Write-Host ""
Write-Host "▶ Step 4/4: Verify connection as '$PgUser'" -ForegroundColor Cyan
$env:PGPASSWORD = $PgPassword
$verify = & $psql -U $PgUser -h $PgHost -p $PgPort -d $PgDb -tAc "SELECT current_database() || ' | ' || current_user;" 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  ✓ Connected: $verify" -ForegroundColor Green
} else {
  Write-Host "  ✗ Connection failed: $verify" -ForegroundColor Red
  Write-Host "  Check pg_hba.conf — local connections may still require scram-sha-256" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "[OK] PostgreSQL is ready." -ForegroundColor Green
Write-Host ""
Write-Host "Add this to apps/backend/.env:" -ForegroundColor Cyan
Write-Host "  DATABASE_URL=postgresql://$PgUser`:$PgPassword@$PgHost`:$PgPort/$PgDb" -ForegroundColor White
Write-Host "  TYPEORM_SYNCHRONIZE=true" -ForegroundColor White
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  - Boot the backend; it will auto-create all tables via TypeORM synchronize." -ForegroundColor White
Write-Host "  - Then run:  cd apps/backend ; npm run seed:demo:fresh" -ForegroundColor White
