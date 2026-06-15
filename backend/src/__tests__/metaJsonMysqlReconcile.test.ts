import {
  fnEventInstanceRevisionMs,
  fnMergeByNId,
} from '../data/metaJsonMysqlReconcile';
import type { IEventInstance } from '../data/eventInstances';

const fnMakeInst = (nId: number, strStatus: string, dtCreatedAt: string, dtLog?: string): IEventInstance =>
  ({
    nId,
    strStatus,
    dtCreatedAt,
    arrStatusLogs: dtLog
      ? [{ strStatus: strStatus as IEventInstance['strStatus'], dtChangedAt: dtLog, strChangedBy: 't', nChangedByUserId: 1, strComment: '' }]
      : [],
  }) as IEventInstance;

describe('metaJsonMysqlReconcile', () => {
  it('fnEventInstanceRevisionMs — 상태 이력 시각 반영', () => {
    const obj = fnMakeInst(1, 'confirm_requested', '2026-01-01T00:00:00.000Z', '2026-06-11T11:01:20.422Z');
    expect(fnEventInstanceRevisionMs(obj)).toBe(Date.parse('2026-06-11T11:01:20.422Z'));
  });

  it('fnMergeByNId — json만 있는 ID 병합', () => {
    const arrMysql = [fnMakeInst(177, 'event_created', '2026-06-01T00:00:00.000Z')];
    const arrJson = [
      ...arrMysql,
      fnMakeInst(179, 'event_created', '2026-06-11T11:00:53.395Z'),
      fnMakeInst(180, 'confirm_requested', '2026-06-11T11:01:20.422Z', '2026-06-11T11:01:20.422Z'),
    ];
    const { arrMerged, stats } = fnMergeByNId(arrMysql, arrJson, fnEventInstanceRevisionMs);
    expect(stats.bChanged).toBe(true);
    expect(stats.arrJsonOnly).toEqual([179, 180]);
    expect(arrMerged.map((e) => e.nId)).toEqual([177, 179, 180]);
  });

  it('fnMergeByNId — 동일 ID는 revision 큰 쪽(json)', () => {
    const arrMysql = [fnMakeInst(180, 'event_created', '2026-06-11T11:00:00.000Z')];
    const arrJson = [
      fnMakeInst(180, 'confirm_requested', '2026-06-11T11:01:20.422Z', '2026-06-11T11:01:20.422Z'),
    ];
    const { arrMerged, stats } = fnMergeByNId(arrMysql, arrJson, fnEventInstanceRevisionMs);
    expect(stats.bChanged).toBe(true);
    expect(stats.arrJsonWon).toEqual([180]);
    expect(arrMerged[0].strStatus).toBe('confirm_requested');
  });

  it('fnMergeByNId — 동률이면 mysql 유지', () => {
    const row = fnMakeInst(1, 'event_created', '2026-06-01T00:00:00.000Z');
    const { arrMerged, stats } = fnMergeByNId([row], [{ ...row }], fnEventInstanceRevisionMs);
    expect(stats.bChanged).toBe(false);
    expect(arrMerged[0]).toBe(row);
  });
});
