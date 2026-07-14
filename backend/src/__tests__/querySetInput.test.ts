import {
  fnNormalizeQuerySetInputFields,
  fnIsValidQuerySetInputId,
} from '../utils/querySetInput';
import { fnReplaceItemsInTemplate } from '../utils/queryTemplateItems';

describe('querySetInput — 세트별 입력 ID·형식', () => {
  it('입력 ID 기본값 items', () => {
    expect(fnNormalizeQuerySetInputFields({}).strInputId).toBe('items');
    expect(fnNormalizeQuerySetInputFields({ strInputId: 'reward' }).strInputId).toBe('reward');
  });

  it('입력 형식 dual-read — 세트 없으면 템플릿 fallback', () => {
    expect(fnNormalizeQuerySetInputFields({}, 'item_string').strInputFormat).toBe('item_string');
    expect(fnNormalizeQuerySetInputFields({ strInputFormat: 'date' }, 'item_number').strInputFormat).toBe('date');
  });

  it('입력 ID 검증', () => {
    expect(fnIsValidQuerySetInputId('items')).toBe(true);
    expect(fnIsValidQuerySetInputId('Items')).toBe(false);
    expect(fnIsValidQuerySetInputId('1bad')).toBe(false);
  });

  it('세트 형식·ID로 치환', () => {
    const obj = fnNormalizeQuerySetInputFields({ strInputId: 'reward', strInputFormat: 'item_number' });
    expect(
      fnReplaceItemsInTemplate('X {{reward}}', '1,2', obj.strInputFormat as 'item_number', obj.strInputId),
    ).toBe('X 1, 2');
  });
});
