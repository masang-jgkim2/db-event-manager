ALTER USER 'root'@'localhost' IDENTIFIED BY 'root1234!@#$';


ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'root1234!@#$';
FLUSH PRIVILEGES;

CREATE USER 'dba'@'%' IDENTIFIED BY 'dba1234!@#$';

GRANT ALL PRIVILEGES ON *.* TO 'dba'@'%' WITH GRANT OPTION;

FLUSH PRIVILEGES;

CREATE DATABASE IF NOT EXISTS dqpm_qa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- QA 전용 계정 (비밀번호는 배포 전 CHANGE)
CREATE USER IF NOT EXISTS 'dqpm_qa'@'172.31.%' IDENTIFIED BY 'dqpm_qa123!@#';
CREATE USER IF NOT EXISTS 'dqpm_qa'@'localhost' IDENTIFIED BY 'dqpm_qa123!@#';

GRANT ALL PRIVILEGES ON dqpm_qa.* TO 'dqpm_qa'@'172.31.%';
GRANT ALL PRIVILEGES ON dqpm_qa.* TO 'dqpm_qa'@'localhost';

FLUSH PRIVILEGES;

-- 확인
SHOW DATABASES LIKE 'dqpm_qa';
SELECT user, host FROM mysql.user WHERE user = 'dqpm_qa';
