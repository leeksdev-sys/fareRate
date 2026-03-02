# Quarterly update precheck script (non-destructive)
# Usage:
#   .\precheck.ps1

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$DB_SYNC_DIR = Join-Path $SCRIPT_DIR "db_sync"

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[string]

function Add-Check {
    param([string]$Message)
    $checks.Add($Message) | Out-Null
    Write-Host "[OK] $Message"
}

function Add-Warn {
    param([string]$Message)
    $warnings.Add($Message) | Out-Null
    Write-Host "[WARN] $Message"
}

function Add-Error {
    param([string]$Message)
    $errors.Add($Message) | Out-Null
    Write-Host "[ERROR] $Message"
}

function Test-ToolCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    try {
        & $Command | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Add-Check "$Name available"
            return $true
        }
        Add-Error "$Name failed (exit code: $LASTEXITCODE)"
        return $false
    }
    catch {
        Add-Error "$Name error: $($_.Exception.Message)"
        return $false
    }
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Quarterly Update Precheck"
Write-Host "============================================"

# 1) Required files
$requiredFiles = @(
    "update.ps1",
    "deploy.ps1",
    "schema.sql",
    "data_init.sql",
    "import_data.py",
    "wrangler.toml"
)

foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $SCRIPT_DIR $file
    if (Test-Path $fullPath) {
        Add-Check "required file exists: $file"
    }
    else {
        Add-Error "required file missing: $file"
    }
}

# 2) data_init.sql safety signature
$dataInitPath = Join-Path $SCRIPT_DIR "data_init.sql"
if (Test-Path $dataInitPath) {
    try {
        $dataInitContent = Get-Content -Path $dataInitPath -Raw -Encoding UTF8
        if ($dataInitContent -match "DROP\s+TABLE\s+IF\s+EXISTS\s+freight_rates" -and $dataInitContent -match "DROP\s+TABLE\s+IF\s+EXISTS\s+companies") {
            Add-Check "data_init.sql signature verified"
        }
        else {
            Add-Warn "data_init.sql signature differs from expected"
        }
    }
    catch {
        Add-Warn "unable to read data_init.sql: $($_.Exception.Message)"
    }
}

# 3) companies backup availability
if (Test-Path $DB_SYNC_DIR) {
    $companySql = Get-ChildItem -Path $DB_SYNC_DIR -Filter "companies_local_data_*.sql" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike "*_upsert.sql" } |
        Sort-Object @{ Expression = 'LastWriteTime'; Descending = $true }, @{ Expression = 'Name'; Descending = $true } |
        Select-Object -First 1

    if ($companySql) {
        Add-Check "companies backup found: $($companySql.Name)"
    }
    else {
        Add-Error "companies backup missing (db_sync/companies_local_data_*.sql)"
    }
}
else {
    Add-Error "db_sync directory missing"
}

# 4) leftover split SQL warning
$leftoverSplitSql = Get-ChildItem -Path $SCRIPT_DIR -Filter "data_*.sql" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^data_\d{3}\.sql$' }

if ($leftoverSplitSql.Count -gt 0) {
    Add-Warn "leftover split SQL files detected: $($leftoverSplitSql.Count)"
}
else {
    Add-Check "no leftover split SQL files"
}

# 5) toolchain check
$pythonOk = Test-ToolCommand -Name "python" -Command { python --version }
$nodeOk = Test-ToolCommand -Name "node" -Command { node --version }
$npxOk = Test-ToolCommand -Name "npx" -Command { npx --version }

# 6) wrangler auth/secret check (only if npx works)
if ($npxOk) {
    try {
        $secretJson = npx wrangler secret list 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $secretJson) {
            Add-Error "wrangler secret list failed (check login/permissions)"
        }
        else {
            $secretList = $secretJson | ConvertFrom-Json
            $secretNames = @($secretList | ForEach-Object { $_.name })

            if ($secretNames -contains "ADMIN_PASSWORD") {
                Add-Check "secret found: ADMIN_PASSWORD"
            }
            else {
                Add-Error "secret missing: ADMIN_PASSWORD"
            }

            if ($secretNames -contains "ADMIN_TOKEN_SECRET") {
                Add-Check "secret found: ADMIN_TOKEN_SECRET"
            }
            else {
                Add-Error "secret missing: ADMIN_TOKEN_SECRET"
            }
        }
    }
    catch {
        Add-Error "wrangler secret check error: $($_.Exception.Message)"
    }
}

# 7) optional git cleanliness warning
try {
    $gitStatus = git status --porcelain 2>$null
    if ($LASTEXITCODE -eq 0) {
        if ([string]::IsNullOrWhiteSpace(($gitStatus | Out-String))) {
            Add-Check "git working tree clean"
        }
        else {
            Add-Warn "git has uncommitted changes"
        }
    }
}
catch {
    Add-Warn "git status check skipped"
}

Write-Host ""
Write-Host "--------------------------------------------"
Write-Host "Precheck Summary"
Write-Host "- Pass   : $($checks.Count)"
Write-Host "- Warn   : $($warnings.Count)"
Write-Host "- Errors : $($errors.Count)"
Write-Host "--------------------------------------------"

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "Precheck FAILED. Resolve errors before update."
    exit 1
}

if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Precheck PASSED WITH WARNINGS. Review warnings before update."
    exit 0
}

Write-Host ""
Write-Host "Precheck PASSED. You can proceed with update.ps1 local/remote."
exit 0
