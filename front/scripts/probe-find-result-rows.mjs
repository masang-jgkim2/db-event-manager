/** qa_requested·arrResultRows 있는 인스턴스 탐색 */
const strBase = process.env.DQPM_API || 'http://localhost:4000/api';
const strUser = process.env.DQPM_USER || 'dba01';
const strPass = process.env.DQPM_PASS || 'dba01';

const resLogin = await fetch(`${strBase}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ strUserId: strUser, strPassword: strPass }),
});
const objLogin = await resLogin.json();
const strToken = objLogin.strToken || objLogin.objData?.strToken;
if (!strToken) {
  console.log('LOGIN_FAIL', objLogin);
  process.exit(1);
}
const hdr = { Authorization: `Bearer ${strToken}` };

const resMy = await fetch(`${strBase}/event-instances?strScope=my`, { headers: hdr });
const objMy = await resMy.json();
const arrMy = objMy.arrInstances ?? objMy.objData ?? objMy.arrData ?? [];
const arrQa = arrMy.filter((x) => x.strStatus === 'qa_requested');
console.log(`my_dashboard: total=${arrMy.length} qa_requested=${arrQa.length}`);
for (const x of arrQa.slice(0, 8)) {
  console.log(`  QA #${x.nId} ${(x.strEventName || x.strName || '').slice(0, 40)}`);
}

const resAll = await fetch(`${strBase}/event-instances?nPage=1&nPageSize=300`, { headers: hdr });
const objAll = await resAll.json();
const arrAll = objAll.arrInstances ?? objAll.objData?.arrItems ?? objAll.arrItems ?? [];
let nWithRows = 0;
for (const inst of arrAll) {
  for (const log of inst.arrStatusLogs ?? []) {
    for (const q of log.objExecutionResult?.arrQueryResults ?? []) {
      if (q.arrResultRows?.length) {
        nWithRows++;
        console.log(`ROWS #${inst.nId} status=${inst.strStatus} rows=${q.arrResultRows.length} cols=${q.arrResultColumns?.length ?? 0}`);
        break;
      }
    }
  }
}
console.log(`scanned=${arrAll.length} instances_with_result_rows=${nWithRows}`);
