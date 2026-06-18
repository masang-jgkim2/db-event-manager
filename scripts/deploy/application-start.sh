#!/bin/bash
set -e

PROJECT_DIR="/masang/masanggames.co.kr/db-manager"
SYMLINK="${PROJECT_DIR}/current"

echo "## =========================================="
echo "## [ApplicationStart] 애플리케이션 시작"
echo "## $(date '+%Y-%m-%d %H:%M:%S')"
echo "## =========================================="

# AfterInstall에서 저장한 릴리스 경로 읽기
RELEASE_DIR=$(cat /tmp/codedeploy_release_dir)

if [ ! -d "$RELEASE_DIR" ]; then
    echo "## [ERROR] 릴리스 디렉토리를 찾을 수 없습니다: ${RELEASE_DIR}"
    exit 1
fi

echo "## 새 릴리스: $(basename $RELEASE_DIR)"

# 이전 릴리스 기록 (롤백용)
PREVIOUS=""
if [ -L "$SYMLINK" ]; then
    PREVIOUS=$(readlink -f "$SYMLINK")
    echo "## 이전 릴리스: $(basename $PREVIOUS)"
fi

# ============================================================
# 심볼릭 링크 Atomic Swap — 무중단 핵심
# ln -s 로 임시 링크 생성 → mv -T 로 원자적 교체
# ============================================================
echo "## 심볼릭 링크 Atomic Swap"
ln -s "$RELEASE_DIR" "${SYMLINK}_new"
mv -Tf "${SYMLINK}_new" "$SYMLINK"
echo "## current → $(basename $RELEASE_DIR)"

# 백엔드 systemd 재시작 (Node 프로세스 교체)
echo "## dqpm-backend 재시작"
systemctl restart dqpm-backend

# nginx reload (정적 dist 경로는 current 심볼릭 링크로 따라옴 → reload만으로 OK)
# 라라벨과 nginx 인스턴스를 공유하므로 절대 restart 금지 (reload는 무중단)
echo "## nginx reload (라라벨 무중단 유지)"
systemctl reload nginx

# 안정화 대기 — 백엔드가 :4000 LISTEN 시작할 시간
sleep 3

# 서비스 상태 1차 확인
echo ""
echo "## 서비스 상태"
DQPM_STATUS=$(systemctl is-active dqpm-backend)
NGINX_STATUS=$(systemctl is-active nginx)
echo "##   dqpm-backend: ${DQPM_STATUS}"
echo "##   nginx:        ${NGINX_STATUS}"

if [ "$DQPM_STATUS" != "active" ] || [ "$NGINX_STATUS" != "active" ]; then
    echo ""
    echo "## [ERROR] 서비스 비정상 — 이전 릴리스로 자동 롤백 시도"
    if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
        ln -s "$PREVIOUS" "${SYMLINK}_rollback"
        mv -Tf "${SYMLINK}_rollback" "$SYMLINK"
        systemctl restart dqpm-backend || true
        systemctl reload nginx || true
        echo "## 롤백 완료: current → $(basename $PREVIOUS)"
    else
        echo "## [ERROR] 이전 릴리스가 없어 롤백 불가 (최초 배포)"
    fi
    journalctl -u dqpm-backend -n 50 --no-pager || true
    exit 1
fi

# 임시 파일 정리
rm -f /tmp/codedeploy_release_dir

echo ""
echo "## [ApplicationStart] 완료"
