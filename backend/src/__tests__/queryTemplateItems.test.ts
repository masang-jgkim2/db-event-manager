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

  it('혼합 패턴', () => {
    const str = fnReplaceItemsInTemplate(
      "A='{{items}}' B IN ({{items}}) C VALUES {{items}}",
      '1\n2',
      'item_number',
    );
    expect(str).toBe("A='1, 2' B IN (1, 2) C VALUES (1), (2)");
  });
});

describe('fnNormalizeItemsForTemplate', () => {
  it('번호 — 쉼표 목록', () => {
    expect(fnNormalizeItemsForTemplate('7902\n9471', 'item_number')).toBe('7902, 9471');
  });
});
