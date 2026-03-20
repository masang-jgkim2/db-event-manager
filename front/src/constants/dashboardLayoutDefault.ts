import type { IDashboardLayoutRoot } from '../types/dashboardLayout';

/**
 * 기본 보드 — 프로토타입용. 이후 localStorage/API 오버레이로 교체.
 */
export const OBJ_DEFAULT_DASHBOARD_LAYOUT: IDashboardLayoutRoot = {
  strSchemaVersion: '1.0',
  strLayoutId: 'default',
  strLabel: '운영 기본 보드',
  arrProductGroups: [
    {
      strGroupId: 'fishing',
      strLabel: '낚시 계열',
      arrProductIds: [1, 2],
      strColor: 'blue',
    },
  ],
  arrWidgets: [
    {
      strWidgetId: 'w-status',
      strWidgetType: 'status_summary',
      strTitle: '프로세스별 진행',
      objFilter: {
        strInstanceFilter: 'involved',
        bExcludeDeleted: true,
      },
      objOptions: { strDisplay: 'chips', bShowZero: false },
    },
    {
      strWidgetId: 'w-list',
      strWidgetType: 'instance_list',
      strTitle: '내 관여 이벤트',
      objFilter: {
        strInstanceFilter: 'involved',
        bExcludeDeleted: true,
      },
      objOptions: {
        strView: 'card',
        nPageSize: 8,
        strDensity: 'compact',
        arrCardRows: [
          { strLabel: '프로덕트', strFieldPath: 'strProductName', strRender: 'tag', strEmpty: '-' },
          { strLabel: '서비스', strFieldPath: 'strServiceAbbr', strRender: 'text' },
          {
            strLabel: '반영 일시',
            strFieldPath: 'dtDeployDate',
            strRender: 'datetime_short',
          },
          { strLabel: '상태', strFieldPath: 'strStatus', strRender: 'status_tag' },
          { strLabel: '생성자', strFieldPath: 'strCreatedBy', strEmpty: '-' },
          { strLabel: '생성일', strFieldPath: 'dtCreatedAt', strRender: 'datetime_short' },
        ],
      },
    },
    {
      strWidgetId: 'w-cal',
      strWidgetType: 'deploy_calendar',
      objFilter: { bExcludeDeleted: true },
      objOptions: { strView: 'month', nWeeksAhead: 4 },
    },
  ],
  arrLayoutRows: [
    {
      nOrder: 0,
      strHeight: 'auto',
      arrColumnSpans: [
        { strWidgetId: 'w-status', nColSpan: 24 },
        { strWidgetId: 'w-cal', nColSpan: 12 },
        { strWidgetId: 'w-list', nColSpan: 12 },
      ],
    },
  ],
};
