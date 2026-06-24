#!/bin/bash
set -e

PROJECT_DIR="/masang/masanggames.co.kr/db-manager"
RELEASES_DIR="${PROJECT_DIR}/releases"
SHARED_DIR="${PROJECT_DIR}/shared"
STAGING_DIR="${RELEASES_DIR}/staging"

echo "## =========================================="
echo "## [AfterInstall] 배포 후 설정"
echo "## $(date '+%Y-%m-%d %H:%M:%S')"
echo "## =========================================="

# staging → 타임스탬프 릴리스 디렉토리로 이동
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"

echo "## 릴리스 디렉토리: ${RELEASE_DIR}"
mv "$STAGING_DIR" "$RELEASE_DIR"

# 빌드 산출물 확인
if [ ! -d "$RELEASE_DIR/backend/dist" ]; then
    echo "## [ERROR] backend/dist 가 없습니다. 빌드 아티팩트 확인."
    exit 1
fi
if [ ! -d "$RELEASE_DIR/backend/node_modules" ]; then
    echo "## [ERROR] backend/node_modules 가 없습니다. CI에서 npm prune 후 zip 했는지 확인."
    exit 1
fi
if [ ! -d "$RELEASE_DIR/front/dist" ]; then
    echo "## [ERROR] front/dist 가 없습니다. 빌드 아티팩트 확인."
    exit 1
fi
echo "## backend/dist, backend/node_modules, front/dist: OK"

# shared backend.env 심볼릭 링크 (백엔드 .env)
if [ -f "$SHARED_DIR/backend.env" ]; then
    ln -sf "$SHARED_DIR/backend.env" "$RELEASE_DIR/backend/.env"
    echo "## backend/.env 심볼릭 링크: OK"
else
    echo "## [WARNING] shared/backend.env 가 없습니다. 백엔드가 기본값으로 동작합니다 (JWT_SECRET=default-secret 위험)."
fi

# shared data 디렉토리 연결 (JSON 영속·MySQL 모드 미러 둘 다 사용)
if [ -d "$RELEASE_DIR/backend/data" ]; then
    rm -rf "$RELEASE_DIR/backend/data"
fi
ln -sfn "$SHARED_DIR/data" "$RELEASE_DIR/backend/data"
echo "## backend/data → shared/data 심볼릭 링크: OK"

# 권한 (런타임 user = masang)
echo "## 파일 권한 설정"
chown -R masang:masang "$RELEASE_DIR"
find "$RELEASE_DIR" -type f -exec chmod 644 {} \;
find "$RELEASE_DIR" -type d -exec chmod 755 {} \;
# 스크립트 실행 권한
chmod 755 "$RELEASE_DIR"/scripts/deploy/*.sh 2>/dev/null || true
chmod 755 "$RELEASE_DIR"/scripts/install-live-meta-json-seed.sh 2>/dev/null || true

# 릴리스 경로를 ApplicationStart 단계로 전달
echo "$RELEASE_DIR" > /tmp/codedeploy_release_dir

echo ""
echo "## [AfterInstall] 완료"
