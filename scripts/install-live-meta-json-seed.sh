#!/bin/bash
# live_meta_reset.sql 실행 후, npm sync 스크립트 없을 때 shared/data 최소 시드 복사
# products·dbConnections 의 nServiceId(1~13) 가 MySQL과 일치해야 기동 시 reconcile 덮어쓰기 방지
set -e

PROJECT_DIR="${PROJECT_DIR:-/masang/masanggames.co.kr/db-manager}"
SHARED_DATA="${SHARED_DATA:-${PROJECT_DIR}/shared/data}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEED_DIR="${SCRIPT_DIR}/live_meta_json_seed"

if [ ! -d "$SEED_DIR" ]; then
  echo "[install-live-meta-json-seed] seed 없음: ${SEED_DIR}"
  echo "  배포 zip에 scripts/live_meta_json_seed 포함 후 재배포, 또는 git에서 파일 복사"
  exit 1
fi

if [ ! -d "$SHARED_DATA" ]; then
  echo "[install-live-meta-json-seed] shared/data 없음: ${SHARED_DATA}"
  exit 1
fi

echo "[install-live-meta-json-seed] ${SEED_DIR} → ${SHARED_DATA}"
cp -v "${SEED_DIR}"/*.json "${SHARED_DATA}/"
echo "[install-live-meta-json-seed] 완료"
echo "  users/roles/rolePermissions 는 MySQL만 사용 — 기동 전 DATA_MYSQL_SKIP_JSON_RECONCILE=1 권장(구 JSON 잔존 시)"
echo "  배포 반영 후: cd current/backend && npm run sync-meta-json-from-mysql 로 전체 미러 권장"
