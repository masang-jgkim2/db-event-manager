-- jgkim2 등 가입 직후 active·역할 없음으로 로그인된 계정 보정 (1회성)
-- 실행 전 백업 권장

USE dqpm_meta;

UPDATE users
SET str_status = 'pending_approval'
WHERE str_user_id = 'jgkim2'
  AND (str_status IS NULL OR str_status = 'active')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.n_user_id = users.n_id
  );

-- guest 역할 없으면 scripts/dqpm_local.sql guest 블록 또는 서버 재기동(온보딩 bootstrap) 후
-- 승인 대기 탭에서 정식 승인

SELECT n_id, str_user_id, str_email, str_status FROM users WHERE str_user_id = 'jgkim2';
