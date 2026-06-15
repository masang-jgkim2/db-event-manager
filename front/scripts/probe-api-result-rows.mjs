const strBase = 'http://112.185.196.8:4000/api';
const resLogin = await fetch(`${strBase}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ strUserId: 'dba01', strPassword: 'dba01' }),
});
const objLogin = await resLogin.json();
const strToken = objLogin.strToken || objLogin.objData?.strToken;
if (!strToken) {
  console.log('LOGIN_FAIL', objLogin);
  process.exit(1);
}
const hdr = { Authorization: `Bearer ${strToken}` };
for (const nId of [69, 41, 118]) {
  const res = await fetch(`${strBase}/event-instances/${nId}`, { headers: hdr });
  const obj = await res.json();
  const inst = obj.objData ?? obj;
  let nWithRows = 0;
  for (const log of inst.arrStatusLogs ?? []) {
    const ex = log.objExecutionResult;
    if (!ex?.arrQueryResults) continue;
    for (const q of ex.arrQueryResults) {
      if (q.arrResultRows?.length) nWithRows++;
    }
  }
  console.log(`#${nId} status=${inst.strStatus} logsWithResultRows=${nWithRows}`);
}
