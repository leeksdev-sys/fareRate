#!/bin/bash
# 안전운임 DB 업데이트 + 배포 스크립트
# 사용법: bash deploy.sh [local|remote|all]
#   local  — 로컬 D1만 업데이트 (테스트용)
#   remote — Production D1 업데이트 + 빌드 + 배포
#   all    — 로컬 + remote 순서로 모두 실행 (기본값)

set -e

MODE=${1:-all}
DB_NAME="freight-rate-db"

apply_sql() {
  local FLAG=$1
  echo ""
  echo "▶ 기존 테이블 삭제 ($FLAG)..."
  npx wrangler d1 execute $DB_NAME $FLAG --file=./data_init.sql

  echo "▶ 스키마 생성 ($FLAG)..."
  npx wrangler d1 execute $DB_NAME $FLAG --file=./schema.sql

  echo "▶ 데이터 적재 시작..."
  for f in $(ls data_*.sql | grep -v '^data_init\.sql$' | sort); do
    echo "  → $f"
    npx wrangler d1 execute $DB_NAME $FLAG --file="./$f"
  done

  company_sql=$(ls db_sync/companies_local_data_*.sql 2>/dev/null | grep -v '_upsert\.sql$' | sort | tail -n 1 || true)
  if [ -n "$company_sql" ]; then
    echo "▶ 업체 데이터 복원 ($FLAG): $(basename "$company_sql")"
    npx wrangler d1 execute $DB_NAME $FLAG --file="./$company_sql"
  else
    echo "⚠ 업체 데이터 백업 SQL을 찾지 못했습니다. (db_sync/companies_local_data_*.sql)"
  fi

  echo "▶ 테이블 검증 ($FLAG)..."
  npx wrangler d1 execute $DB_NAME $FLAG --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('freight_rates','companies');"
  npx wrangler d1 execute $DB_NAME $FLAG --command "SELECT COUNT(*) AS companies_cnt FROM companies;"
  echo "✅ DB 적재 완료 ($FLAG)"
}

if [[ "$MODE" == "local" || "$MODE" == "all" ]]; then
  echo "=============================="
  echo " [1/2] 로컬 DB 업데이트"
  echo "=============================="
  apply_sql "--local"
fi

if [[ "$MODE" == "remote" || "$MODE" == "all" ]]; then
  echo ""
  echo "=============================="
  echo " [2/2] Production 배포"
  echo "=============================="
  apply_sql "--remote"

  echo ""
  echo "▶ 빌드 중..."
  npm run build

  echo ""
  echo "▶ Cloudflare Workers 배포 중..."
  npx wrangler deploy

  echo ""
  echo "🚀 배포 완료!"
fi
