import {
  fnBuildStubEventTemplateFromInstance,
  fnEnsureEventTemplatesForInstances,
  type IEventTemplate,
} from '../data/events';

describe('fnEnsureEventTemplatesForInstances', () => {
  it('인스턴스가 참조하는 템플릿 ID가 없으면 스텁 추가', () => {
    const arrEvents: IEventTemplate[] = [
      {
        nId: 1,
        nProductId: 2,
        strProductName: 'P',
        strEventLabel: 'E1',
        strDescription: '',
        strCategory: 'c',
        strType: 't',
        strInputFormat: 'raw',
        strDefaultItems: '',
        strQueryTemplate: '',
        dtCreatedAt: '2026-01-01T00:00:00.000Z',
        strStatus: 'dba_confirmed',
        arrStatusLogs: [],
      },
    ];
    const nAdded = fnEnsureEventTemplatesForInstances(arrEvents, [
      {
        nEventTemplateId: 99,
        nProductId: 2,
        strProductName: 'P',
        strEventLabel: 'orphan',
        strCategory: 'c',
        strType: 't',
        dtCreatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(nAdded).toBe(1);
    expect(arrEvents.some((e) => e.nId === 99)).toBe(true);
    expect(fnBuildStubEventTemplateFromInstance(99, {
      nProductId: 2,
      strProductName: 'P',
      strEventLabel: 'x',
      strCategory: 'c',
      strType: 't',
      dtCreatedAt: '2026-01-01T00:00:00.000Z',
    }).strStatus).toBe('dba_confirmed');
  });
});
