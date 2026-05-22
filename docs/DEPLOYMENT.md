# 배포 가이드 (DQPM)

GitLab CI/CD + AWS CodeDeploy + EC2(라라벨 공존) 운영 매뉴얼.

## 환경 매핑

| 환경 | 프론트 | 백엔드 API | 브랜치 |
|------|--------|------------|--------|
| QA   | https://qa-db.masanggames.co.kr | https://qa-db-api.masanggames.co.kr | `release/*`, `hotfix/*` (자동) |
| LIVE | https://db.masanggames.co.kr    | https://db-api.masanggames.co.kr    | `main` (수동 승인) |

- 빌드 검증만 도는 브랜치: `qa`, 그리고 `qa`를 타겟으로 한 MR

## 서버 디렉토리 구조

```
/masang/masanggames.co.kr/
├── renewal/                          ← 라라벨 (기존, 건드리지 않음)
└── db-manager/                       ← DQPM
    ├── releases/
    │   ├── 20260520_140000/          (각 배포 산출물)
    │   └── staging/                  (CodeDeploy 임시)
    ├── shared/
    │   ├── backend.env               ← 시크릿·환경변수
    │   ├── data/                     ← backend/data/*.json (영속)
    │   └── logs/
    └── current → releases/20260520_140000  (atomic swap)
```

## EC2 초기 셋업 (환경당 1회, root/관리자 수행)

1. **디렉토리 생성**
   ```bash
   sudo mkdir -p /masang/masanggames.co.kr/db-manager/{releases,shared/{data,logs}}
   sudo chown -R masang:masang /masang/masanggames.co.kr/db-manager
   ```

2. **Node.js 설치 — nvm 사용 + /usr/local/bin symlink** (ctrlhub EC2 표준)

   서버는 masang 유저의 nvm으로 Node를 관리합니다. systemd가 절대경로로 찾을 수 있도록 `/usr/local/bin/node`에 symlink를 만듭니다.

   ```bash
   # 1) masang 으로 — nvm 기본 버전 고정 (이미 설치되어 있다는 전제)
   nvm use 20.15.0
   nvm alias default 20.15.0

   # 2) root 로 — 시스템 경로에 symlink
   sudo ln -sf /home/masang/.nvm/versions/node/v20.15.0/bin/node /usr/local/bin/node
   sudo ln -sf /home/masang/.nvm/versions/node/v20.15.0/bin/npm  /usr/local/bin/npm

   # 3) 확인
   /usr/local/bin/node -v   # v20.15.0

   # 4) masang 홈 권한 — systemd가 읽을 수 있게 0755 이상
   ls -ld /home/masang
   sudo chmod 755 /home/masang   # 700 이면 풀어야 함
   ```

   ⚠️ apt 로 nodejs 별도 설치 금지 — nvm 과 충돌 가능. nvm 버전을 올릴 땐 위 symlink 도 같이 갱신.

3. **shared/backend.env 작성**
   ```bash
   sudo cp <repo>/deploy/server-setup/backend.env.example \
           /masang/masanggames.co.kr/db-manager/shared/backend.env
   sudo vi /masang/masanggames.co.kr/db-manager/shared/backend.env
   # JWT_SECRET, DB_CONNECTION_PASSWORD_SECRET 강한 랜덤값으로
   # CORS_ALLOWED_ORIGINS QA/LIVE에 맞게
   sudo chown masang:masang /masang/masanggames.co.kr/db-manager/shared/backend.env
   sudo chmod 600           /masang/masanggames.co.kr/db-manager/shared/backend.env
   ```

4. **systemd unit 등록**
   ```bash
   sudo cp /home/ubuntu/unit/dqpm-backend.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable dqpm-backend
   # 시작은 첫 배포 후 (current 심볼릭 링크 생성 이후)
   ```

5. **Nginx server block 등록** (도메인당 1파일 컨벤션 — LB가 SSL 종료, EC2는 80만 수신)
   ```bash
   # QA EC2 — 2개 파일
   sudo cp ~/qa-db.masanggames.co.kr.conf      /etc/nginx/sites-available/
   sudo cp ~/qa-db-api.masanggames.co.kr.conf  /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/qa-db.masanggames.co.kr.conf      /etc/nginx/sites-enabled/
   sudo ln -s /etc/nginx/sites-available/qa-db-api.masanggames.co.kr.conf  /etc/nginx/sites-enabled/

   # LIVE EC2 — 2개 파일
   sudo cp ~/db.masanggames.co.kr.conf      /etc/nginx/sites-available/
   sudo cp ~/db-api.masanggames.co.kr.conf  /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/db.masanggames.co.kr.conf      /etc/nginx/sites-enabled/
   sudo ln -s /etc/nginx/sites-available/db-api.masanggames.co.kr.conf  /etc/nginx/sites-enabled/

   sudo nginx -t && sudo systemctl reload nginx
   ```

6. **TLS 인증서**: LB(`qa-ctrl`/`ctrl`)에서 ACM 인증서로 SSL 종료. EC2 nginx는 80만 수신하므로 EC2에서 certbot 작업 불필요.

7. **masang 운영 sudoers (선택)**
   ```bash
   sudo cp <repo>/deploy/server-setup/sudoers.d-masang-dqpm /etc/sudoers.d/masang-dqpm
   sudo chmod 0440 /etc/sudoers.d/masang-dqpm
   ```

8. **codedeploy-agent**: 라라벨용으로 이미 설치되어 있으면 그대로 사용. 미설치면 AWS 공식 가이드 참고.

9. **EC2 태그**: ctrlhub과 동일 EC2를 공유하므로 **새 태그를 추가하지 않고 기존 태그를 그대로 사용**.
   - QA EC2: `Application=qa-internal-ctrlhub-full` (ctrlhub QA가 이미 부착)
   - LIVE EC2: `Application=live-internal-ctrlhub-full` (ctrlhub LIVE가 이미 부착)
   - CodeDeploy Deployment Group 생성 시 위 값으로 매칭. 한 태그가 두 앱(ctrlhub + db-event-manager)에 동시 매칭되는 건 정상 동작.

## AWS 측 1회 셋업

- **S3 버킷**: 기존 `prod-web-deployments-apne1` 재사용, prefix `internal-db-event-manager/`
- **CodeDeploy Application**: `Internal-db-event-manager` (대문자 I, ctrlhub 네이밍 규칙 정렬 — compute platform: EC2/On-premises)
- **Deployment Group**:
  - `qa-internal-db-event-manager-group` → QA EC2 태그 매칭
  - `live-internal-db-event-manager-group` → LIVE EC2 태그 매칭
- **EC2 태그** (ctrlhub과 동일 EC2 공유 — 기존 태그 재활용):
  - QA EC2: `Application=qa-internal-ctrlhub-full` (이미 부착됨)
  - LIVE EC2: `Application=live-internal-ctrlhub-full` (이미 부착됨)
  - 한 EC2에 `Application` 키는 1개만 둘 수 있어 별도 태그 추가 불가. Deployment Group 매칭은 기존 값 그대로 사용.
- **GitLab CI/CD Variables**: 그룹 또는 프로젝트 레벨에 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (S3 PutObject + CodeDeploy CreateDeployment 권한 IAM)

## LIVE 셋업 시 QA와 다른 점 (체크리스트)

QA에서 한 동일 절차를 LIVE EC2에서 반복하되, 아래 항목은 **QA와 값이 다름** — 절대 QA 값 복사하지 말 것.

| 항목 | QA | LIVE |
|------|-----|------|
| 프론트 도메인 | `qa-db.masanggames.co.kr` | `db.masanggames.co.kr` |
| API 도메인 | `qa-db-api.masanggames.co.kr` | `db-api.masanggames.co.kr` |
| nginx 파일 2개 | `qa-db.*.conf`, `qa-db-api.*.conf` | `db.*.conf`, `db-api.*.conf` |
| EC2 태그 | `Application=qa-internal-ctrlhub-full` | `Application=live-internal-ctrlhub-full` |
| Deployment Group | `qa-internal-db-event-manager-group` | `live-internal-db-event-manager-group` |
| LB | `qa-ctrl` | `ctrl` |
| 배포 트리거 | `release/*`·`hotfix/*` push (자동) | `main` push → **수동 승인 버튼 클릭** |

### shared/backend.env의 LIVE 값 (QA와 반드시 다른 키 사용)

```bash
PORT=4000
NODE_ENV=production

# LIVE 전용 — QA와 절대 같으면 안 됨
JWT_SECRET=3NaB3oduBzKQELGnx4fKKADjV8kmLDGgY4WQol/QzU03Ad4VdZBaYZwA1+cHtu6T
JWT_EXPIRES_IN=24h
DB_CONNECTION_PASSWORD_SECRET=AyEzbWCN3vMWhwU43GQk7bq6a8EvZ6kyTcN1f6+Rp6o=

# CORS — LIVE 프론트 도메인 (qa- 빠짐)
CORS_ALLOWED_ORIGINS=https://db.masanggames.co.kr

ACTIVITY_LOG_ENABLED=1
```

> ⚠️ `DB_CONNECTION_PASSWORD_SECRET`은 한 번 정하면 변경 금지 (변경 시 등록된 DB 비밀번호 전부 복호화 불가).

### LIVE 배포 진행 순서

1. EC2 초기 셋업 1~9번 — QA와 동일 절차, 위 표의 LIVE 값으로 치환
2. AWS CodeDeploy 콘솔 → Applications → `Internal-db-event-manager` → **Create deployment group**:
   - Name: `live-internal-db-event-manager-group`
   - Tag: `Application=live-internal-ctrlhub-full`
   - 나머지 설정 QA와 동일
3. `main` 브랜치에 머지 → GitLab 파이프라인에서 `deploy_to_live` 가 **수동 대기 상태(▶)**
4. GitLab UI에서 `deploy_to_live` 버튼 클릭 → CodeDeploy 실행
5. 첫 배포 후 admin/admin123 로그인 → **즉시 비밀번호 변경**

### LIVE에서 자주 빠뜨리는 것

- ❌ LIVE EC2에 QA용 nginx conf 잘못 올림 → `nginx -t` 통과해도 `db.*` 도메인 매칭 실패
- ❌ `CORS_ALLOWED_ORIGINS`에 `qa-db` 그대로 → 프론트 호출 다 막힘
- ❌ LIVE EC2에 IAM Instance Profile 미부착 → CodeDeploy agent에 `Missing credentials` 에러
- ❌ AWS Deployment Group 이름 오타 → `DeploymentGroupDoesNotExistException`

## 배포 흐름

```
[로컬] git push origin release/0.1.0
   ↓
[GitLab CI] build_qa: backend/front 빌드 → zip → S3 업로드
   ↓
[GitLab CI] deploy_to_qa: aws deploy create-deployment
   ↓
[CodeDeploy Agent (EC2)] zip 다운로드 → /releases/staging
   ↓
[BeforeInstall]   디렉토리 점검, 오래된 릴리스 정리
[Install]         staging 에 파일 배치
[AfterInstall]    staging → releases/YYYYMMDD_HHMMSS, .env/data 심볼릭 링크
[ApplicationStart] current 심볼릭 atomic swap, dqpm-backend 재시작, nginx reload
[ValidateService] /api/health 200, 프론트 200 확인 → 실패 시 자동 롤백
```

## 평상시 운영 명령 (masang으로 SSH)

```bash
# 백엔드 재시작
sudo systemctl restart dqpm-backend

# 로그 실시간
sudo journalctl -u dqpm-backend -f

# nginx reload (라라벨에 영향 없음)
sudo nginx -t && sudo systemctl reload nginx

# 긴급 롤백 (이전 릴리스로)
sudo /masang/masanggames.co.kr/db-manager/current/scripts/deploy/rollback.sh --force

# 현재 릴리스 확인
readlink -f /masang/masanggames.co.kr/db-manager/current
```

## 주의사항 (라라벨과 공존)

- `php8.3-fpm`은 **절대 reload/restart 하지 않음** — 라라벨 종속
- Nginx는 `systemctl reload`만 사용 (라라벨 무중단). `restart` 금지.
- `/masang/masanggames.co.kr/renewal` 경로는 어떤 DQPM 스크립트에서도 참조 금지
- 포트 4000은 DQPM 백엔드 전용 — 다른 서비스 점유 여부 사전 확인

## DATA_STORE 모드 전환 (json ↔ mysql)

운영 중 전환 가능. 다만 데이터 보존 책임은 운영자.

- **json → mysql**: meta DB 구성 후 `shared/backend.env`에 `DATA_STORE=mysql`+`DATA_MYSQL_URL` 설정 → 빈 DB면 기동 시 `shared/data/*.json` 자동 적재 (`DATA_MYSQL_NO_JSON_IMPORT=1`로 끌 수도 있음)
- **mysql → json**: `DATA_STORE` 제거. `shared/data/*.json`이 최신인지 미리 점검 (mysql 모드는 JSON 미러 유지)
- 전환 시 `sudo systemctl restart dqpm-backend` 한 번이면 끝

## 트러블슈팅

- **502 Bad Gateway**: `systemctl status dqpm-backend` / `journalctl -u dqpm-backend -n 100`
- **`status=203/EXEC` / `Failed to locate executable /usr/bin/node`**: nvm 으로 깐 node 가 systemd 가 찾는 경로에 없음. 위 "EC2 초기 셋업 2번"의 symlink 단계 누락. `sudo ln -sf /home/masang/.nvm/versions/node/v20.15.0/bin/node /usr/local/bin/node` 후 `sudo systemctl restart dqpm-backend`.
- **CORS 오류**: `shared/backend.env`의 `CORS_ALLOWED_ORIGINS`에 정확한 origin(스킴 포함, 슬래시 없이) 등록 확인
- **SSE 끊김**: nginx server block의 `proxy_buffering off` 누락 확인
- **빌드 실패 (CI)**: GitLab Runner의 node/aws cli 설치, `linux-builder`/`linux-deploy` 태그 부여 확인
