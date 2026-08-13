import {
  fnBuildQueryEditLog,
  fnSnapshotQueryBefore,
  fnTemplateQueryBodyChanged,
} from '../utils/queryEditLog';

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

  it('다중 세트 추가 시 SQL diff 감지', () => {
    const before = fnSnapshotQueryBefore({
      strGeneratedQuery: 'A',
      arrExecutionTargets: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQuery: 'A' },
        { nQaDbConnectionId: 2, nLiveDbConnectionId: 22, strQuery: 'B' },
      ],
    });
    const edit = fnBuildQueryEditLog(before, {
      strGeneratedQuery: 'A',
      arrExecutionTargets: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQuery: 'A' },
        { nQaDbConnectionId: 2, nLiveDbConnectionId: 22, strQuery: 'B' },
        { nQaDbConnectionId: 3, nLiveDbConnectionId: 33, strQuery: 'C' },
      ],
    });
    expect(edit).toEqual({
      arrSetChanges: [{ nSetIndex: 2, strBefore: '', strAfter: 'C' }],
    });
  });

  it('다중 세트 마지막 삭제 시 SQL diff 감지', () => {
    const before = fnSnapshotQueryBefore({
      strGeneratedQuery: 'A',
      arrExecutionTargets: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQuery: 'A' },
        { nQaDbConnectionId: 2, nLiveDbConnectionId: 22, strQuery: 'B' },
        { nQaDbConnectionId: 3, nLiveDbConnectionId: 33, strQuery: 'C' },
      ],
    });
    const edit = fnBuildQueryEditLog(before, {
      strGeneratedQuery: 'A',
      arrExecutionTargets: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQuery: 'A' },
        { nQaDbConnectionId: 2, nLiveDbConnectionId: 22, strQuery: 'B' },
      ],
    });
    expect(edit).toEqual({
      arrSetChanges: [{ nSetIndex: 2, strBefore: 'C', strAfter: '' }],
    });
  });

  it('중간 세트 삭제 시 나머지 SQL을 수정으로 오인하지 않음', () => {
    const before = fnSnapshotQueryBefore({
      strGeneratedQuery: 'A',
      arrExecutionTargets: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQuery: 'A' },
        { nQaDbConnectionId: 2, nLiveDbConnectionId: 22, strQuery: 'B' },
        { nQaDbConnectionId: 3, nLiveDbConnectionId: 33, strQuery: 'C' },
      ],
    });
    const edit = fnBuildQueryEditLog(before, {
      strGeneratedQuery: 'A',
      arrExecutionTargets: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQuery: 'A' },
        { nQaDbConnectionId: 3, nLiveDbConnectionId: 33, strQuery: 'C' },
      ],
    });
    expect(edit).toEqual({
      arrSetChanges: [{ nSetIndex: 1, strBefore: 'B', strAfter: '' }],
    });
  });

  it('세트 개수 동일·본문만 변경 시 replace 1건 (#369)', () => {
    const strOld = '--아이템\nSELECT 1';
    const strNew = 'use master;\n--아이템\nSELECT 1';
    const before = fnSnapshotQueryBefore({
      strGeneratedQuery: strOld,
      arrExecutionTargets: [{ nQaDbConnectionId: 1, nLiveDbConnectionId: 2, strQuery: strOld }],
    });
    const edit = fnBuildQueryEditLog(before, {
      strGeneratedQuery: strNew,
      arrExecutionTargets: [{ nQaDbConnectionId: 1, nLiveDbConnectionId: 2, strQuery: strNew }],
    });
    expect(edit).toEqual({
      arrSetChanges: [{ nSetIndex: 0, strBefore: strOld, strAfter: strNew }],
    });
  });

  it('세트 2개 중 1개 본문만 변경 시 해당 세트 replace만', () => {
    const before = fnSnapshotQueryBefore({
      strGeneratedQuery: 'A',
      arrExecutionTargets: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQuery: 'AAA' },
        { nQaDbConnectionId: 2, nLiveDbConnectionId: 22, strQuery: 'BBB' },
      ],
    });
    const edit = fnBuildQueryEditLog(before, {
      strGeneratedQuery: 'A',
      arrExecutionTargets: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQuery: 'AAA2' },
        { nQaDbConnectionId: 2, nLiveDbConnectionId: 22, strQuery: 'BBB' },
      ],
    });
    expect(edit).toEqual({
      arrSetChanges: [{ nSetIndex: 0, strBefore: 'AAA', strAfter: 'AAA2' }],
    });
  });

  it('템플릿 세트 삭제 시 본문 변경으로 감지', () => {
    const objBefore = {
      arrQueryTemplates: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQueryTemplate: 'A', strDefaultItems: '' },
        { nQaDbConnectionId: 2, nLiveDbConnectionId: 22, strQueryTemplate: 'B', strDefaultItems: '' },
      ],
    };
    const objAfter = {
      arrQueryTemplates: [
        { nQaDbConnectionId: 1, nLiveDbConnectionId: 11, strQueryTemplate: 'A', strDefaultItems: '' },
      ],
    };
    expect(fnTemplateQueryBodyChanged(objBefore, objAfter)).toBe(true);
  });
});
