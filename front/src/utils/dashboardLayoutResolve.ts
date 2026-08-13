import type { ICardLabelRow, IDashboardLayoutRoot, IInstanceListWidgetOptions } from '../types/dashboardLayout';

/** 레거시 «반영 일시»(dtDeployDate) 행 → QA/LIVE 분리 */
export function fnNormalizeCardRowsDeployDates(arrRows: ICardLabelRow[]): ICardLabelRow[] {
  const arrOut: ICardLabelRow[] = [];
  for (const row of arrRows) {
    if (
      row.strFieldPath === 'dtDeployDate'
      && (row.strRender === 'datetime_short' || row.strRender === 'datetime_full' || row.strRender == null)
    ) {
      arrOut.push({
        strLabel: 'QA 반영',
        strFieldPath: 'dtQaDeployDate',
        strRender: 'deploy_qa',
        strEmpty: row.strEmpty,
        strLabelWidth: row.strLabelWidth,
        nGridColumn: row.nGridColumn,
        nGridRow: row.nGridRow,
        nColSpan: row.nColSpan,
      });
      arrOut.push({
        strLabel: 'LIVE 반영',
        strFieldPath: 'dtLiveDeployDate',
        strRender: 'deploy_live',
        strEmpty: row.strEmpty,
        strLabelWidth: row.strLabelWidth,
        nGridColumn: row.nGridColumn != null ? row.nGridColumn : undefined,
        nColSpan: row.nColSpan,
      });
      continue;
    }
    arrOut.push(row);
  }
  return arrOut;
}

/** 기본 레이아웃에서 첫 `instance_list` 위젯의 카드 옵션 (테이블 모드는 미사용 가능) */
export function fnFindFirstInstanceListOptions(
  objLayout: IDashboardLayoutRoot
): IInstanceListWidgetOptions | null {
  const objW = objLayout.arrWidgets.find((r) => r.strWidgetType === 'instance_list');
  if (!objW?.objOptions || typeof objW.objOptions !== 'object') return null;
  const objOpts = { ...(objW.objOptions as IInstanceListWidgetOptions) };
  if (objOpts.arrCardRows?.length) {
    objOpts.arrCardRows = fnNormalizeCardRowsDeployDates(objOpts.arrCardRows);
  }
  return objOpts;
}
