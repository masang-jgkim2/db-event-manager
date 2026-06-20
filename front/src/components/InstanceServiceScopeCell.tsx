import { Typography } from 'antd';
import { DqpmTag } from './DqpmTag';
import { fnFormatCountryPlatformAbbr } from '../utils/countryPlatformLabel';

const { Text } = Typography;

/** 인스턴스 스냅샷 — 서비스 구분 약자 (나의 대시보드·카드 등) */
export function InstanceServiceScopeCell({
  strServiceAbbr,
}: {
  strServiceAbbr?: string | null;
}) {
  const strAbbr = (strServiceAbbr ?? '').trim();
  if (!strAbbr) {
    return <Text type="secondary">-</Text>;
  }
  return (
    <DqpmTag tone="service" style={{ fontSize: 11 }}>
      {fnFormatCountryPlatformAbbr(strAbbr)}
    </DqpmTag>
  );
}
