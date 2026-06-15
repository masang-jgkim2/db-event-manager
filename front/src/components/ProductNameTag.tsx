import { DqpmTag } from './DqpmTag';

interface IProductNameTagProps {
  strName?: string | null;
  /** 긴 이름 툴팁(미지정 시 strName) */
  strTitle?: string;
}

/** 프로덕트명 — 포인트 컬러 팔레트 product 슬롯 */
export const ProductNameTag = ({ strName, strTitle }: IProductNameTagProps) => {
  const str = strName?.trim() || '-';
  const strTip = strTitle ?? (str !== '-' ? str : undefined);

  return (
    <DqpmTag
      tone="product"
      title={strTip}
      className="dqpm-product-name-tag"
    >
      {str}
    </DqpmTag>
  );
};
