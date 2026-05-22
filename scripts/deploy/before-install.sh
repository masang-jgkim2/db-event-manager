#!/bin/bash
set -e

PROJECT_DIR="/masang/masanggames.co.kr/db-manager"
RELEASES_DIR="${PROJECT_DIR}/releases"
SHARED_DIR="${PROJECT_DIR}/shared"
STAGING_DIR="${RELEASES_DIR}/staging"
MAX_RELEASES=5

echo "## =========================================="
echo "## [BeforeInstall] 배포 사전 점검"
echo "## $(date '+%Y-%m-%d %H:%M:%S')"
echo "## =========================================="

# 디렉토리 구조 보장 (최초 배포 시 자동 생성)
mkdir -p "$RELEASES_DIR"
mkdir -p "$SHARED_DIR/data"
mkdir -p "$SHARED_DIR/logs"

# 소유권 설정 (codedeploy-agent는 root, 런타임은 masang)
chown -R masang:masang "$PROJECT_DIR"

# 이전 staging 잔여 디렉토리 정리
if [ -d "$STAGING_DIR" ]; then
    echo "## 이전 staging 디렉토리 정리"
    rm -rf "$STAGING_DIR"
fi

# 오래된 릴리스 정리 (최대 MAX_RELEASES개 유지)
RELEASE_COUNT=$(ls -dt "${RELEASES_DIR}"/20* 2>/dev/null | wc -l)
if [ "$RELEASE_COUNT" -gt "$MAX_RELEASES" ]; then
    echo "## 오래된 릴리스 정리 (${RELEASE_COUNT}개 → ${MAX_RELEASES}개)"
    ls -dt "${RELEASES_DIR}"/20* | tail -n +$((MAX_RELEASES + 1)) | xargs rm -rf
fi

# 시스템 리소스 확인
echo ""
echo "## 시스템 리소스"
df -h "$PROJECT_DIR" | tail -1 | awk '{print "##   디스크: "$3" / "$2" ("$5" 사용)"}'
free -h | grep Mem | awk '{print "##   메모리: "$3" / "$2}'

# 서비스 상태 확인 (라라벨 PHP-FPM은 건드리지 않음 — 상태만 표시)
echo ""
echo "## 서비스 상태"
systemctl is-active dqpm-backend >/dev/null 2>&1 && echo "##   dqpm-backend: active" || echo "##   dqpm-backend: inactive (최초 배포면 정상)"
systemctl is-active nginx        >/dev/null 2>&1 && echo "##   nginx:        active" || echo "##   nginx:        inactive"

# 현재 릴리스 정보
if [ -L "${PROJECT_DIR}/current" ]; then
    CURRENT=$(readlink -f "${PROJECT_DIR}/current")
    echo "##   현재 릴리스: $(basename $CURRENT)"
else
    echo "##   현재 릴리스: (없음 — 최초 배포)"
fi

# shared/backend.env 존재 확인 (없으면 경고만, 최초 배포 후 운영자가 작성)
if [ ! -f "$SHARED_DIR/backend.env" ]; then
    echo ""
    echo "## [WARNING] ${SHARED_DIR}/backend.env 파일이 없습니다."
    echo "## 최초 배포 후 운영자가 다음 명령으로 작성 필요:"
    echo "##   sudo vi ${SHARED_DIR}/backend.env"
    echo "##   sudo chown masang:masang ${SHARED_DIR}/backend.env"
    echo "##   sudo chmod 600 ${SHARED_DIR}/backend.env"
fi

echo ""
echo "## [BeforeInstall] 사전 점검 완료"
