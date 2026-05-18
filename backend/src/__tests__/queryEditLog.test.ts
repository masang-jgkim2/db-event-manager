import { fnBuildQueryEditLog, fnSnapshotQueryBefore } from '../utils/queryEditLog';

describe('queryEditLog', () => {
  it('단일 쿼리 변경 diff', () => {
    const before = fnSnapshotQueryBefore({ strGeneratedQuery: 'SELECT 1', arrExecutionTargets: undefined });
    const edit = fnBuildQueryEditLog(before, { strGeneratedQuery: 'SELECT 2', arrExecutionTargets: undefined });
    expect(edit).toEqual({ strBefore: 'SELECT 1', strAfter: 'SELECT 2' });
  });

  it('변경 없으면 null', () => {
    const before = fnSnapshotQueryBefore({ strGeneratedQuery: 'A', arrExecutionTargets: undefined });
    expect(fnBuildQueryEditLog(before, { strGeneratedQuery: 'A', arrExecutionTargets: undefined })).toBeNull();
  });
});
