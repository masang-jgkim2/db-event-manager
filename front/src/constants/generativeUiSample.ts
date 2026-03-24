import type { IUiSpec } from '../types/generativeUi';

/** 데모·개발 확인용 샘플 스펙 — 프로덕션 라우트에는 직접 묶지 말 것 */
export const OBJ_SAMPLE_UI_SPEC: IUiSpec = {
  strSchemaVersion: '1',
  arrBlocks: [
    {
      strBlockId: 'b1',
      strType: 'alert',
      strLevel: 'info',
      strMessage:
        '아래는 Generative UI 샘플입니다. 실제 서비스에서는 API/LLM 응답을 검증한 뒤 전달하세요.',
    },
    {
      strBlockId: 'b2',
      strType: 'statistic',
      strTitle: '진행 중 인스턴스',
      strValue: '12',
      strSuffix: '건',
    },
    {
      strBlockId: 'b3',
      strType: 'table',
      strTitle: '프로덕트별 건수(예시)',
      arrColumns: [
        { strKey: 'strProduct', strTitle: '프로덕트' },
        { strKey: 'nCount', strTitle: '건수' },
      ],
      arrRows: [
        { strProduct: 'A', nCount: 3 },
        { strProduct: 'B', nCount: 7 },
      ],
    },
  ],
};
