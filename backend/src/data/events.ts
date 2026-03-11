// 이벤트 템플릿 데이터 저장소 (추후 DB 연동 시 교체)

export interface IEventTemplate {
  nId: number;
  nProductId: number;
  strProductName: string;
  strEventLabel: string;
  strDescription: string;
  strCategory: string;
  strType: string;
  strInputFormat: string;
  strDefaultItems: string;
  strQueryTemplate: string;
  dtCreatedAt: string;
}

export const arrEvents: IEventTemplate[] = [];

// 다음 ID
export const fnGetNextEventId = (): number => {
  return arrEvents.length > 0 ? Math.max(...arrEvents.map((e) => e.nId)) + 1 : 1;
};
