import type { IDashboardLayoutRoot, IInstanceListWidgetOptions } from '../types/dashboardLayout';

/** 기본 레이아웃에서 첫 `instance_list` 위젯의 카드 옵션 (테이블 모드는 미사용 가능) */
export function fnFindFirstInstanceListOptions(
  objLayout: IDashboardLayoutRoot
): IInstanceListWidgetOptions | null {
  const objW = objLayout.arrWidgets.find((r) => r.strWidgetType === 'instance_list');
  if (!objW?.objOptions || typeof objW.objOptions !== 'object') return null;
  return objW.objOptions as IInstanceListWidgetOptions;
}
