import { Tag, type TagProps } from 'antd';
import { useDesignSystem } from '../styles/DesignSystemContext';
import { fnResolveTagColor, type TTagVariant } from '../styles/tagPalette';

export interface IDqpmTagProps extends Omit<TagProps, 'color'> {
  /** 포인트 컬러 팔레트 슬롯 (Ant Tag `variant` solid/filled 와 별개) */
  tone?: TTagVariant;
  /** legacy Ant preset 이름·hex — primary 팔레트로 치환 (tone 우선) */
  color?: string;
}

/** primary 팔레트 기반 Tag — UI 설정 포인트 컬러와 연동 */
export const DqpmTag = ({ tone, color, variant, ...rest }: IDqpmTagProps) => {
  const { objTag } = useDesignSystem();
  const strHex = tone
    ? objTag[tone]
    : fnResolveTagColor(objTag, typeof color === 'string' ? color : undefined);

  if (!strHex) {
    return <Tag variant={variant} {...rest} />;
  }
  return <Tag color={strHex} variant={variant} {...rest} />;
};
