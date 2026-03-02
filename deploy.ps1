# 안전운임 DB 업데이트 + 배포 스크립트 (PowerShell)
# 사용법:
#   .\deploy.ps1 local   — 로컬 D1만 업데이트 (테스트용)
#   .\deploy.ps1 remote  — Production D1 업데이트 + 빌드 + 배포
#   .\deploy.ps1 all     — 로컬 + remote 모두 (기본값)

param(
    [ValidateSet("local", "remote", "all")]
    [string]$Mode = "all"
)

$ErrorActionPreference = "Stop"
$DB_NAME = "freight-rate-db"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$DATA_INIT_FILE = Join-Path $SCRIPT_DIR "data_init.sql"
$SCHEMA_FILE = Join-Path $SCRIPT_DIR "schema.sql"
$DB_SYNC_DIR = Join-Path $SCRIPT_DIR "db_sync"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Step,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Step 실패 (exit code: $LASTEXITCODE)"
    }
}

function Invoke-SQL { param($Flag)
    Write-Host ""
    Write-Host "▶ 기존 테이블 삭제 ($Flag)..."
    Invoke-Checked "기존 테이블 삭제 ($Flag)" {
        npx wrangler d1 execute $DB_NAME $Flag --file="$DATA_INIT_FILE" --yes
    }

    Write-Host "▶ 스키마 생성 ($Flag)..."
    Invoke-Checked "스키마 생성 ($Flag)" {
        npx wrangler d1 execute $DB_NAME $Flag --file="$SCHEMA_FILE" --yes
    }

    Write-Host "▶ 데이터 적재 시작..."
        Get-ChildItem -Path $SCRIPT_DIR -Filter "data_*.sql" |
            Where-Object { $_.Name -ne "data_init.sql" } |
            Sort-Object Name | ForEach-Object {
        Write-Host "  → $($_.Name)"
        Invoke-Checked "데이터 적재: $($_.Name) ($Flag)" {
            npx wrangler d1 execute $DB_NAME $Flag --file="$($_.FullName)" --yes
        }
    }

        $companySql = Get-ChildItem -Path $DB_SYNC_DIR -Filter "companies_local_data_*.sql" -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike "*_upsert.sql" } |
            Sort-Object @{ Expression = 'LastWriteTime'; Descending = $true }, @{ Expression = 'Name'; Descending = $true } |
            Select-Object -First 1

        if ($companySql) {
            Write-Host "▶ 업체 데이터 복원 ($Flag): $($companySql.Name)"
            Invoke-Checked "업체 데이터 복원 ($Flag): $($companySql.Name)" {
                npx wrangler d1 execute $DB_NAME $Flag --file="$($companySql.FullName)" --yes
            }
        } else {
            Write-Host "⚠ 업체 데이터 백업 SQL을 찾지 못했습니다. (db_sync/companies_local_data_*.sql)"
        }

        Write-Host "▶ 테이블 검증 ($Flag)..."
        Invoke-Checked "테이블 검증 ($Flag)" {
            npx wrangler d1 execute $DB_NAME $Flag --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('freight_rates','companies');" --yes
        }
        Invoke-Checked "업체 건수 검증 ($Flag)" {
            npx wrangler d1 execute $DB_NAME $Flag --command "SELECT COUNT(*) AS companies_cnt FROM companies;" --yes
        }
    Write-Host "✅ DB 적재 완료 ($Flag)"
}

if ($Mode -eq "local" -or $Mode -eq "all") {
    Write-Host "=============================="
    Write-Host " [1] 로컬 DB 업데이트"
    Write-Host "=============================="
    Invoke-SQL "--local"
}

if ($Mode -eq "remote" -or $Mode -eq "all") {
    Write-Host ""
    Write-Host "=============================="
    Write-Host " [2] Production 배포"
    Write-Host "=============================="
    Invoke-SQL "--remote"

    Push-Location $SCRIPT_DIR
    try {
        Write-Host ""
        Write-Host "▶ 빌드 중..."
        Invoke-Checked "빌드" { npm run build }

        Write-Host ""
        Write-Host "▶ Cloudflare Workers 배포 중..."
        Invoke-Checked "Cloudflare Workers 배포" { npx wrangler deploy }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "🚀 배포 완료!"
}
