import type { IQueryEditLog } from '../types';

type TSetChange = NonNullable<IQueryEditLog['arrSetChanges']>[number];

/**
 * 과거 로그: 세트 본문 수정을 삭제+추가로 쪼갠 경우 한 쌍으로 합침 (#369).
 * 연속 { before, after:'' } + { before:'', after } (동일 nSetIndex) → replace 1건.
 */
export const fnCoalesceSetChangeDeleteAddPairs = (
  arrChanges: TSetChange[],
): TSetChange[] => {
  const arrOut: TSetChange[] = [];
  for (let nIdx = 0; nIdx < arrChanges.length; nIdx++) {
    const objCur = arrChanges[nIdx];
    const objNext = arrChanges[nIdx + 1];
    const bCurDel = (objCur.strBefore ?? '') !== '' && (objCur.strAfter ?? '') === '';
    const bNextAdd = objNext
      && (objNext.strBefore ?? '') === ''
      && (objNext.strAfter ?? '') !== '';
    if (
      bCurDel
      && bNextAdd
      && objNext
      && objCur.nSetIndex === objNext.nSetIndex
    ) {
      arrOut.push({
        nSetIndex: objCur.nSetIndex,
        strBefore: objCur.strBefore,
        strAfter: objNext.strAfter,
      });
      nIdx++;
      continue;
    }
    arrOut.push(objCur);
  }
  return arrOut;
};
