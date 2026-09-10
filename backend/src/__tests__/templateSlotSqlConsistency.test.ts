import {
  fnFindOrphanInputPlaceholdersInSql,
  fnFindUnusedSlotIdsInSql,
  fnValidateSetsSlotSqlConsistency,
  fnFirstSlotSqlConsistencyMessage,
} from '../utils/templateSlotSqlConsistency';

describe('templateSlotSqlConsistency', () => {
  it('orphan: SQL {{id}} without slot', () => {
    expect(fnFindOrphanInputPlaceholdersInSql('DELETE WHERE id IN ({{items}})', [])).toEqual(['items']);
  });

  it('meta date is not orphan', () => {
    expect(fnFindOrphanInputPlaceholdersInSql("SET @d := '{{date}}';", [])).toEqual([]);
  });

  it('unused: slot without {{id}} in SQL', () => {
    expect(fnFindUnusedSlotIdsInSql('SELECT 1', [{ strInputId: 'qty', strInputFormat: 'item_number' }]))
      .toEqual(['qty']);
  });

  // {{items}}에 {{item}} substring이 있어도 exact id만 인정
  it('unused: prefix id not matched by longer placeholder', () => {
    expect(fnFindUnusedSlotIdsInSql(
      'IN ({{items}})',
      [
        { strInputId: 'item', strInputFormat: 'item_number' },
        { strInputId: 'items', strInputFormat: 'item_number' },
      ],
    )).toEqual(['item']);
  });

  it('none format skipped for unused', () => {
    expect(fnFindUnusedSlotIdsInSql('SELECT 1', [{ strInputId: 'qty', strInputFormat: 'none' }]))
      .toEqual([]);
  });

  it('sets validator message', () => {
    const arr = fnValidateSetsSlotSqlConsistency([{
      strQueryTemplate: 'IN ({{items}})',
      arrInputs: [{ strInputId: 'qty', strInputFormat: 'item_number' }],
    }]);
    expect(arr.length).toBeGreaterThanOrEqual(2);
    expect(fnFirstSlotSqlConsistencyMessage(arr)).toMatch(/세트 1/);
  });
});
