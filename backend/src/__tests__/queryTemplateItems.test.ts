import { fnNormalizeItemsForTemplate, fnReplaceItemsInTemplate } from '../utils/queryTemplateItems';

describe('fnReplaceItemsInTemplate', () => {
  const strInput = '1\n2\n3';
  const strInputComma = '1,2,3';

  it("'{{items}}' — 쉼표 목록(따옴표 안)", () => {
    expect(fnReplaceItemsInTemplate("DECLARE @x = '{{items}}';", strInput, 'item_number')).toBe(
      "DECLARE @x = '1, 2, 3';",
    );
    expect(fnReplaceItemsInTemplate("='{{items}}'", 'a,b,c', 'item_string')).toBe("='a, b, c'");
  });

  it('({{items}}) — 쉼표 목록', () => {
    expect(fnReplaceItemsInTemplate('WHERE id IN ({{items}})', strInput, 'item_number')).toBe(
      'WHERE id IN (1, 2, 3)',
    );
    expect(fnReplaceItemsInTemplate("WHERE x IN ({{items}})", 'a\nb\nc', 'item_string')).toBe(
      "WHERE x IN ('a', 'b', 'c')",
    );
  });

  it('VALUES {{items}} — (n), (n) 행', () => {
    expect(fnReplaceItemsInTemplate('INSERT INTO t VALUES {{items}};', strInput, 'item_number')).toBe(
      'INSERT INTO t VALUES (1), (2), (3);',
    );
    expect(fnReplaceItemsInTemplate('VALUES {{items}}', strInputComma, 'item_string')).toBe(
      "VALUES ('1'), ('2'), ('3')",
    );
  });

  it('VALUES --주석 후 줄바꿈 {{items}} — VALUES 행 패턴', () => {
    const strTpl = 'INSERT INTO ##__D_TargetItem VALUES --삭제 아이템\n{{items}};';
    const strIn = '12694\n12701\n8833';
    expect(fnReplaceItemsInTemplate(strTpl, strIn, 'item_string')).toBe(
      "INSERT INTO ##__D_TargetItem VALUES --삭제 아이템\n('12694'), ('12701'), ('8833');",
    );
    expect(fnReplaceItemsInTemplate(strTpl, strIn, 'item_number')).toBe(
      'INSERT INTO ##__D_TargetItem VALUES --삭제 아이템\n(12694), (12701), (8833);',
    );
  });

  it('커스텀 입력 ID {{reward}} 치환', () => {
    expect(
      fnReplaceItemsInTemplate('ADD {{reward}}', '10\n20', 'item_number', 'reward'),
    ).toBe('ADD 10, 20');
  });
});

describe('fnNormalizeItemsForTemplate', () => {
  it('번호 — 쉼표 목록', () => {
    expect(fnNormalizeItemsForTemplate('7902\n9471', 'item_number')).toBe('7902, 9471');
  });
});
