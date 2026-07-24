#!/bin/bash
# 운영자가 SSH 접속해서 수동으로 실행하는 긴급 롤백 스크립트.
# ubuntu 유저가 직접 호출할 경우 sudoers.d에 등록되어 있어야 함(런타임은 www-data, 운영자는 ubuntu).
set -e

PROJECT_DIR="/masang/masanggames.co.kr/internal-db-event-manager"
RELEASES_DIR="${PROJECT_DIR}/releases"
SYMLINK="${PROJECT_DIR}/current"

echo "## =========================================="
echo "## [Rollback] 긴급 롤백"
echo "## $(date '+%Y-%m-%d %H:%M:%S')"
echo "## =========================================="

# 현재 릴리스 확인
if [ -L "$SYMLINK" ]; then
    CURRENT=$(readlink -f "$SYMLINK")
    echo "## 현재 릴리스: $(basename $CURRENT)"
else
    echo "## [ERROR] 심볼릭 링크가 없습니다."
    exit 1
fi

# 사용 가능한 릴리스 목록
echo ""
echo "## 사용 가능한 릴리스:"
ls -dt "${RELEASES_DIR}"/20* 2>/dev/null | while read dir; do
    NAME=$(basename "$dir")
    if [ "$(readlink -f $SYMLINK)" = "$dir" ]; then
        echo "##   ${NAME}  ← 현재 (문제 발생)"
    else
        echo "##   ${NAME}"
    fi
done

# 이전 릴리스 찾기 (현재 다음으로 최신)
PREVIOUS=$(ls -dt "${RELEASES_DIR}"/20* 2>/dev/null | grep -v "$(basename $CURRENT)" | head -1)

if [ -z "$PREVIOUS" ]; then
    echo "## [ERROR] 롤백할 이전 릴리스가 없습니다."
    exit 1
fi

echo ""
echo "## 롤백 대상: $(basename $PREVIOUS)"

# --force 플래그 확인 (자동화·sudoers 호출용)
if [ "$1" != "--force" ]; then
    read -p "## 롤백을 진행하시겠습니까? (y/N): " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "## 롤백 취소"
        exit 0
    fi
fi

# Atomic swap → 이전 릴리스로
echo "## 심볼릭 링크 교체: current → $(basename $PREVIOUS)"
ln -s "$PREVIOUS" "${SYMLINK}_rollback"
mv -Tf "${SYMLINK}_rollback" "$SYMLINK"

# 백엔드 재시작 + nginx reload
echo "## dqpm-backend 재시작 / nginx reload"
systemctl restart dqpm-backend
systemctl reload nginx

# 헬스체크
echo ""
echo "## 헬스체크 (최대 5회)"
RETRY=0
HEALTH_OK=false
while [ $RETRY -lt 5 ]; do
    RETRY=$((RETRY + 1))
    sleep 3
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health --max-time 5 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "##   HTTP ${HTTP_CODE} - OK"
        HEALTH_OK=true
        break
    else
        echo "##   시도 ${RETRY}/5: HTTP ${HTTP_CODE}"
    fi
done

if [ "$HEALTH_OK" = "true" ]; then
    echo ""
    echo "## =========================================="
    echo "## [Rollback] 롤백 성공"
    echo "## 현재: $(basename $PREVIOUS)"
    echo "## =========================================="
else
    echo ""
    echo "## [ERROR] 롤백 후 헬스체크 실패 — 수동 확인 필요"
    journalctl -u dqpm-backend -n 50 --no-pager || true
    exit 1
fi
