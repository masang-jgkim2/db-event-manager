/**
 * 특정 사용자 비밀번호를 지정한 값으로 초기화 (비밀번호 분실 시 사용)
 * 사용: node scripts/reset-password.js <strUserId> <새비밀번호>
 * 예: node scripts/reset-password.js admin2 admin123
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const strUserId = process.argv[2];
const strNewPassword = process.argv[3];

if (!strUserId || !strNewPassword) {
  console.error('사용법: node scripts/reset-password.js <아이디> <새비밀번호>');
  console.error('예: node scripts/reset-password.js admin2 admin123');
  process.exit(1);
}

const strDataDir = path.join(process.cwd(), 'data');
const strFilePath = path.join(strDataDir, 'users.json');

if (!fs.existsSync(strFilePath)) {
  console.error('파일 없음:', strFilePath);
  process.exit(1);
}

const arrUsers = JSON.parse(fs.readFileSync(strFilePath, 'utf-8'));
const objUser = arrUsers.find((u) => u.strUserId === strUserId);
if (!objUser) {
  console.error('사용자를 찾을 수 없음:', strUserId);
  process.exit(1);
}

bcrypt.hash(strNewPassword, 10).then((strHash) => {
  objUser.strPassword = strHash;
  fs.writeFileSync(strFilePath, JSON.stringify(arrUsers, null, 2), 'utf-8');
  console.log(`[비밀번호 초기화] ${strUserId} → 완료. 새 비밀번호로 로그인하세요.`);
});
