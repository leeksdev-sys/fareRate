# Freight rate data update script
# Usage:
#   .\update.ps1          -> remote DB update + build + deploy
#   .\update.ps1 local    -> local DB update only

param(
    [ValidateSet("local", "remote")]
    [string]$Mode = "remote"
)

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PARENT_DIR = Split-Path -Parent $SCRIPT_DIR
$DB_NAME = "freight-rate-db"

$IMPORT_SCRIPT = Join-Path $SCRIPT_DIR "import_data.py"
$DATA_INIT_FILE = Join-Path $SCRIPT_DIR "data_init.sql"
$SCHEMA_FILE = Join-Path $SCRIPT_DIR "schema.sql"
$DB_SYNC_DIR = Join-Path $SCRIPT_DIR "db_sync"

$CONVERT_SCRIPT = Get-ChildItem -Path $PARENT_DIR -Recurse -Filter "convert_freight_data.py" -File -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $CONVERT_SCRIPT) {
    throw ([System.Exception]::new("convert_freight_data.py not found under parent directory."))
}

$DATA_DIR = Split-Path -Parent $CONVERT_SCRIPT

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Step,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    $global:LASTEXITCODE = 0
    & $Command
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw ([System.Exception]::new($Step + " failed. rc=" + $exitCode))
    }
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Freight Rate Data Update"
Write-Host "  Mode: $Mode"
Write-Host "============================================"

# STEP 1: Excel -> CSV
Write-Host ""
Write-Host "[1/5] Excel to CSV conversion..."
Invoke-Checked "CSV conversion" {
    python "$CONVERT_SCRIPT" --input-dir "$DATA_DIR"
}
Write-Host "Done: CSV conversion"

# STEP 2: CSV -> SQL split files
Write-Host ""
Write-Host "[2/5] CSV to SQL generation..."
Invoke-Checked "SQL generation" {
    python "$IMPORT_SCRIPT"
}
Write-Host "Done: SQL generation"

# STEP 3: DB load
$Flag = if ($Mode -eq "local") { "--local" } else { "--remote" }

Write-Host ""
Write-Host "[3/5] Loading DB ($Flag)..."
Invoke-Checked "Drop tables ($Flag)" {
    npx wrangler d1 execute $DB_NAME $Flag --file="$DATA_INIT_FILE" --yes
}
Invoke-Checked "Create schema ($Flag)" {
    npx wrangler d1 execute $DB_NAME $Flag --file="$SCHEMA_FILE" --yes
}

Get-ChildItem -Path $SCRIPT_DIR -Filter "data_*.sql" |
    Where-Object { $_.Name -match '^data_\d{3}\.sql$' } |
    Sort-Object Name | ForEach-Object {
    Write-Host "  -> $($_.Name)"
    Invoke-Checked "Load split SQL: $($_.Name) ($Flag)" {
        npx wrangler d1 execute $DB_NAME $Flag --file="$($_.FullName)" --yes
    }
}

$companySql = Get-ChildItem -Path $DB_SYNC_DIR -Filter "companies_local_data_*.sql" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "*_upsert.sql" } |
    Sort-Object @{ Expression = 'LastWriteTime'; Descending = $true }, @{ Expression = 'Name'; Descending = $true } |
    Select-Object -First 1

if ($companySql) {
    Write-Host "Restoring companies from: $($companySql.Name)"
    Invoke-Checked "Restore companies ($Flag)" {
        npx wrangler d1 execute $DB_NAME $Flag --file="$($companySql.FullName)" --yes
    }
} else {
    Write-Host "Warning: companies backup SQL not found in db_sync."
}

Invoke-Checked "Verify companies count ($Flag)" {
    npx wrangler d1 execute $DB_NAME $Flag --command "SELECT COUNT(*) AS companies_cnt FROM companies;" --yes
}
Write-Host "Done: DB load"

# STEP 4: Build & deploy (remote only)
if ($Mode -eq "remote") {
    Push-Location $SCRIPT_DIR
    try {
        Write-Host ""
        Write-Host "[4/5] Build and deploy..."
        Invoke-Checked "Build" { npm run build }
        Invoke-Checked "Deploy" { npx wrangler deploy }
        Write-Host "Done: deploy"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host ""
    Write-Host "[4/5] Local mode: build/deploy skipped"
}

# STEP 5: Cleanup split SQL files
Write-Host ""
Write-Host "[5/5] Cleaning split SQL files..."
$splitSqlFiles = Get-ChildItem -Path $SCRIPT_DIR -Filter "data_*.sql" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^data_\d{3}\.sql$' }

if ($splitSqlFiles) {
    try {
        $splitSqlFiles | Remove-Item -Force
        Write-Host "Done: removed $($splitSqlFiles.Count) split SQL files"
    }
    catch {
        Write-Host "Warning: cleanup partially failed: $($_.Exception.Message)"
    }
}
else {
    Write-Host "Nothing to clean"
}

Write-Host ""
Write-Host "============================================"
Write-Host "  All tasks completed"
Write-Host "============================================"
