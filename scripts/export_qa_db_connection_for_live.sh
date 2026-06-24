#!/usr/bin/env bash
# QA db_connection → live_meta_reset.sql 5절 병합 (npm 래퍼)
#   export QA_MYSQL_HOST=... QA_MYSQL_USER=... QA_MYSQL_PASSWORD=... QA_MYSQL_DATABASE=dqpm
#   bash scripts/export_qa_db_connection_for_live.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../backend"
npm run merge-qa-db-connection-into-reset
