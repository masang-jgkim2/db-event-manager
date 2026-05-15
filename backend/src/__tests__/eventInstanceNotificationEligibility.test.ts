import type { IEventInstance } from '../data/eventInstances';
import {
  fnIsEventInstanceInvolved,
  fnIsEventInstanceMyAction,
  fnShouldNotifyEventInstanceProgress,
  fnShouldSkipEventInstanceProgressNotification,
} from '../services/eventInstanceNotificationEligibility';

const fnMakeInstance = (objPartial: Partial<IEventInstance>): IEventInstance => ({
  nId: 1,
  nEventTemplateId: 1,
  nProductId: 1,
  strEventLabel: 'L',
  strProductName: 'P',
  strServiceAbbr: 'S',
  strServiceRegion: 'KR',
  strCategory: 'C',
  strType: 'T',
  strEventName: '테스트',
  strInputValues: '',
  strGeneratedQuery: '',
  dtDeployDate: new Date().toISOString(),
  arrDeployScope: ['qa', 'live'],
  strStatus: 'confirm_requested',
  arrStatusLogs: [],
  objCreator: { nUserId: 2, strUserId: 'gm01', strDisplayName: 'GM', dtProcessedAt: new Date().toISOString() },
  objConfirmer: null,
  objQaRequester: null,
  objQaDeployer: null,
  objQaVerifier: null,
  objLiveRequester: null,
  objLiveDeployer: null,
  objLiveVerifier: null,
  strCreatedBy: 'GM',
  nCreatedByUserId: 2,
  dtCreatedAt: new Date().toISOString(),
  ...objPartial,
});

describe('eventInstanceNotificationEligibility', () => {
  it('관여자는 진행 알림 대상', () => {
    const objInstance = fnMakeInstance({});
    expect(fnIsEventInstanceInvolved(objInstance, 2)).toBe(true);
    expect(fnShouldNotifyEventInstanceProgress(objInstance, 2, [])).toBe(true);
  });

  it('DBA confirm 권한은 confirm_requested 에서 my_action', () => {
    const objInstance = fnMakeInstance({ strStatus: 'confirm_requested' });
    expect(fnIsEventInstanceMyAction(objInstance, ['my_dashboard.confirm'])).toBe(true);
    expect(fnShouldNotifyEventInstanceProgress(objInstance, 3, ['my_dashboard.confirm'])).toBe(true);
  });

  it('무관한 사용자·권한은 제외', () => {
    const objInstance = fnMakeInstance({ strStatus: 'event_created' });
    expect(fnShouldNotifyEventInstanceProgress(objInstance, 99, ['my_dashboard.confirm'])).toBe(false);
  });

  it('qa_deployed 에서 LIVE 반영 요청 권한은 my_action', () => {
    const objInstance = fnMakeInstance({ strStatus: 'qa_deployed' });
    expect(fnIsEventInstanceMyAction(objInstance, ['my_dashboard.request_live'])).toBe(true);
    expect(fnShouldNotifyEventInstanceProgress(objInstance, 5, ['my_dashboard.request_live'])).toBe(true);
  });

  it('qa_verified·live_verified 는 my_action 매핑 없음(관여자만)', () => {
    const objQaVerified = fnMakeInstance({ strStatus: 'qa_verified' });
    expect(fnIsEventInstanceMyAction(objQaVerified, ['my_dashboard.request_live'])).toBe(false);
    expect(fnShouldNotifyEventInstanceProgress(objQaVerified, 5, ['my_dashboard.request_live'])).toBe(false);

    const objLiveVerified = fnMakeInstance({ strStatus: 'live_verified' });
    expect(fnIsEventInstanceMyAction(objLiveVerified, ['my_dashboard.request_live_rereq'])).toBe(false);
  });

  it('qa_verified·영구 삭제는 진행 알림 적재 생략', () => {
    const objQaVerified = fnMakeInstance({ strStatus: 'qa_verified' });
    expect(fnShouldSkipEventInstanceProgressNotification(objQaVerified)).toBe(true);

    const objDeleted = fnMakeInstance({ strStatus: 'live_verified', bPermanentlyRemoved: true });
    expect(fnShouldSkipEventInstanceProgressNotification(objDeleted)).toBe(true);

    const objQaDeployed = fnMakeInstance({ strStatus: 'qa_deployed' });
    expect(fnShouldSkipEventInstanceProgressNotification(objQaDeployed)).toBe(false);
  });
});
