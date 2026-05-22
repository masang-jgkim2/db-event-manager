#!/bin/bash
set -e

PROJECT_DIR="/masang/masanggames.co.kr/db-manager"
SYMLINK="${PROJECT_DIR}/current"
SHARED_DIR="${PROJECT_DIR}/shared"
MAX_RETRIES=10
RETRY_INTERVAL=3
BACKEND_PORT="${BACKEND_PORT:-4000}"

echo "## =========================================="
echo "## [ValidateService] 서비스 검증"
echo "## $(date '+%Y-%m-%d %H:%M:%S')"
echo "## =========================================="

# 심볼릭 링크 확인
if [ -L "$SYMLINK" ]; then
    CURRENT=$(readlink -f "$SYMLINK")
    echo "## 현재 릴리스: $(basename $CURRENT)"
else
    echo "## [ERROR] 심볼릭 링크가 존재하지 않습니다: ${SYMLINK}"
    exit 1
fi

# systemd 서비스 상태
echo ""
echo "## 서비스 상태"
DQPM_STATUS=$(systemctl is-active dqpm-backend)
NGINX_STATUS=$(systemctl is-active nginx)
echo "##   dqpm-backend: ${DQPM_STATUS}"
echo "##   nginx:        ${NGINX_STATUS}"

if [ "$DQPM_STATUS" != "active" ]; then
    echo "## [ERROR] dqpm-backend 비정상"
    systemctl status dqpm-backend --no-pager || true
    journalctl -u dqpm-backend -n 50 --no-pager || true
    exit 1
fi
if [ "$NGINX_STATUS" != "active" ]; then
    echo "## [ERROR] nginx 비정상"
    systemctl status nginx --no-pager || true
    exit 1
fi

# 백엔드 직접 헬스체크 (localhost:4000)
echo ""
echo "## 백엔드 헬스체크 http://127.0.0.1:${BACKEND_PORT}/api/health"
RETRY=0
HEALTH_OK=false
while [ $RETRY -lt $MAX_RETRIES ]; do
    RETRY=$((RETRY + 1))
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/api/health" --max-time 5 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "##   시도 ${RETRY}: HTTP ${HTTP_CODE} - OK"
        HEALTH_OK=true
        break
    else
        echo "##   시도 ${RETRY}: HTTP ${HTTP_CODE} - 재시도"
        sleep $RETRY_INTERVAL
    fi
done

if [ "$HEALTH_OK" != "true" ]; then
    echo ""
    echo "## [ERROR] 백엔드 헬스체크 실패"
    journalctl -u dqpm-backend -n 50 --no-pager || true
    exit 1
fi

# 프론트 정적 응답 확인 (nginx → index.html)
# .env 또는 호스트네임에서 도메인 추출 — 둘 다 안 되면 localhost
FRONT_HOST=""
if [ -f "$SHARED_DIR/backend.env" ]; then
    FRONT_HOST=$(grep -m1 '^CORS_ALLOWED_ORIGINS=' "$SHARED_DIR/backend.env" 2>/dev/null \
        | sed 's|CORS_ALLOWED_ORIGINS=||' | cut -d',' -f1 \
        | sed 's|https\?://||' | tr -d '\r')
fi
if [ -z "$FRONT_HOST" ]; then
    FRONT_HOST="localhost"
fi
echo ""
echo "## 프론트 정적 확인 (Host: ${FRONT_HOST})"

RETRY=0
FRONT_OK=false
while [ $RETRY -lt 5 ]; do
    RETRY=$((RETRY + 1))
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: ${FRONT_HOST}" http://127.0.0.1/ --max-time 5 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
        echo "##   시도 ${RETRY}: HTTP ${HTTP_CODE} - OK"
        FRONT_OK=true
        break
    else
        echo "##   시도 ${RETRY}: HTTP ${HTTP_CODE} - 재시도"
        sleep 2
    fi
done

if [ "$FRONT_OK" != "true" ]; then
    echo "## [WARNING] 프론트 응답 비정상 — nginx 설정 확인 필요"
    tail -20 /var/log/nginx/dqpm-front.access.log 2>/dev/null || true
    tail -20 /var/log/nginx/error.log 2>/dev/null || true
    # 백엔드만 살아있어도 일단 배포는 진행 (nginx server block 미설치 환경 고려)
fi

# 핵심 파일 확인
echo ""
echo "## 핵심 파일 확인"
[ -L "${CURRENT}/backend/.env" ] && echo "##   backend/.env: OK (symlink)" || echo "##   [WARNING] backend/.env 없음"
[ -L "${CURRENT}/backend/data" ] && echo "##   backend/data: OK (symlink)" || echo "##   [WARNING] backend/data 심볼릭 링크 아님"
[ -d "${CURRENT}/backend/dist" ] && echo "##   backend/dist: OK" || echo "##   [ERROR] backend/dist 없음"
[ -d "${CURRENT}/backend/node_modules" ] && echo "##   backend/node_modules: OK" || echo "##   [ERROR] backend/node_modules 없음"
[ -d "${CURRENT}/front/dist" ] && echo "##   front/dist: OK" || echo "##   [ERROR] front/dist 없음"

echo ""
echo "## =========================================="
echo "## [ValidateService] 검증 완료 — 배포 성공"
echo "## =========================================="
