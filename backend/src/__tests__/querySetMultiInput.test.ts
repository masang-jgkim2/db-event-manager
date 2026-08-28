import {
  fnNormalizeQuerySetInputs,
  fnMirrorLegacyInputFieldsFromSlots,
  fnFindDuplicateInputIdsInSet,
  fnFindDuplicateInputIdMessageInSets,
} from '../utils/querySetInput';
import { fnReplaceAllInputsInTemplate, fnReplaceItemsInTemplate } from '../utils/queryTemplateItems';
import { fnQuerySetInputPersistFields } from '../db/mysqlRelationalSync';
import {
  fnEncodeInstanceInputValues,
  fnDecodeInstanceInputValues,
  MULTI_SET_INPUT_DELIMITER,
} from '../utils/instanceInputValues';

describe('querySetInput — arrInputs dual-read', () => {
  it('레거시 1슬롯 → arrInputs 길이 1', () => {
    const arr = fnNormalizeQuerySetInputs({ strInputId: 'reward', strInputFormat: 'item_number' });
    expect(arr).toEqual([{ strInputId: 'reward', strInputFormat: 'item_number' }]);
    expect(fnMirrorLegacyInputFieldsFromSlots(arr).strInputId).toBe('reward');
  });

  it('arrInputs 우선 · 세트 안 중복 ID 스킵', () => {
    const arr = fnNormalizeQuerySetInputs({
      strInputId: 'items',
      arrInputs: [
        { strInputId: 'item_id', strInputFormat: 'item_number' },
        { strInputId: 'qty', strInputFormat: 'item_number', strDefaultItems: '1' },
        { strInputId: 'item_id', strInputFormat: 'item_string' },
      ],
    });
    expect(arr.map((s) => s.strInputId)).toEqual(['item_id', 'qty']);
    expect(arr[1].strDefaultItems).toBe('1');
  });

  it('중복 ID 검출', () => {
    expect(
      fnFindDuplicateInputIdsInSet([
        { strInputId: 'a' },
        { strInputId: 'b' },
        { strInputId: 'a' },
      ]),
    ).toBe('a');
  });

  it('세트 배열 중복 메시지', () => {
    const obj = fnFindDuplicateInputIdMessageInSets([
      { arrInputs: [{ strInputId: 'x' }, { strInputId: 'y' }] },
      { arrInputs: [{ strInputId: 'dup' }, { strInputId: 'dup' }] },
    ]);
    expect(obj?.nSetIdx).toBe(1);
    expect(obj?.strMessage).toMatch(/세트 2.*dup/);
  });
});

describe('fnReplaceAllInputsInTemplate', () => {
  it('원본 기준 다중 슬롯 치환', () => {
    const strTpl = "UPDATE t SET qty={{qty}} WHERE id IN ({{item_id}}) AND d='{{expire}}'";
    const strOut = fnReplaceAllInputsInTemplate(
      strTpl,
      [
        { strInputId: 'item_id', strInputFormat: 'item_number' },
        { strInputId: 'qty', strInputFormat: 'item_number' },
        { strInputId: 'expire', strInputFormat: 'date' },
      ],
      { item_id: '1\n2', qty: '10', expire: '20251231' },
    );
    expect(strOut).toBe("UPDATE t SET qty=10 WHERE id IN (1, 2) AND d='20251231'");
  });

  it('단일 치환 API는 다중 래퍼와 동일', () => {
    expect(fnReplaceItemsInTemplate('X {{items}}', '1,2', 'item_number')).toBe('X 1, 2');
  });
});

describe('instanceInputValues JSON / legacy', () => {
  it('JSON encode/decode', () => {
    const str = fnEncodeInstanceInputValues([
      { item_id: '1', qty: '2' },
      { items: '9' },
    ]);
    const arr = fnDecodeInstanceInputValues(str, [
      [{ strInputId: 'item_id' }, { strInputId: 'qty' }],
      [{ strInputId: 'items' }],
    ]);
    expect(arr[0]).toEqual({ item_id: '1', qty: '2' });
    expect(arr[1]).toEqual({ items: '9' });
  });

  it('구 \\u0001 는 세트당 첫 슬롯에 매핑', () => {
    const str = `1001${MULTI_SET_INPUT_DELIMITER}7902`;
    const arr = fnDecodeInstanceInputValues(str, [
      [{ strInputId: 'item_id' }, { strInputId: 'qty' }],
      [{ strInputId: 'items' }],
    ]);
    expect(arr[0].item_id).toBe('1001');
    expect(arr[0].qty).toBe('');
    expect(arr[1].items).toBe('7902');
  });
});

describe('fnQuerySetInputPersistFields (MySQL json_arr_inputs + 미러)', () => {
  it('다중 슬롯 — json 전체 + str_input_* 는 첫 슬롯 미러', () => {
    const obj = fnQuerySetInputPersistFields(
      {
        nQaDbConnectionId: 1,
        nLiveDbConnectionId: 2,
        arrInputs: [
          { strInputId: 'item_id', strInputFormat: 'item_number', strDefaultItems: '1,2' },
          { strInputId: 'qty', strInputFormat: 'item_number', strDefaultItems: '10' },
        ],
        strQueryTemplate: 'UPDATE t SET qty={{qty}} WHERE id IN ({{item_id}})',
      },
      'item_number',
    );
    expect(obj.strInputId).toBe('item_id');
    expect(obj.strInputFormat).toBe('item_number');
    expect(obj.strDefaultItems).toBe('1,2');
    const arrParsed = JSON.parse(obj.jsonArrInputs ?? '[]') as Array<{ strInputId: string }>;
    expect(arrParsed.map((s) => s.strInputId)).toEqual(['item_id', 'qty']);
  });
});
