import type { Meta, StoryObj } from '@storybook/react';
import { Button, Typography } from 'antd';
import { useDesignSystem } from '../../styles/DesignSystemContext';
import { fnTypoStyle } from '../../styles/typographyTokens';
import { STR_FONT_MONO, STR_FONT_UI } from '../../styles/cursorSiteTokens';
import type { ITypographyRoleStyle } from '../../styles/typographyTokens';

const RoleRow = ({
  strName,
  objRole,
  strSample,
  bMono,
}: {
  strName: string;
  objRole: ITypographyRoleStyle;
  strSample: string;
  bMono?: boolean;
}) => (
  <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(38,37,30,0.08)' }}>
    <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.55, marginBottom: 6 }}>{strName}</div>
    <div
      style={{
        ...fnTypoStyle(objRole),
        fontFamily: bMono ? STR_FONT_MONO : STR_FONT_UI,
      }}
    >
      {strSample}
    </div>
    <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6, fontFamily: STR_FONT_MONO }}>
      {objRole.nFontSize}px / {objRole.nFontWeight} / lh {objRole.nLineHeight} / ls{' '}
      {objRole.strLetterSpacing}
      {objRole.bUppercase ? ' / uppercase' : ''}
    </div>
  </div>
);

const TypographyPanel = () => {
  const { objTypoRoles, strFontUi } = useDesignSystem();

  return (
    <div style={{ maxWidth: 640, padding: 8 }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        폰트 UI: <code>{strFontUi}</code>
        <br />
        getdesign Cursor DESIGN.md 역할 — UI 설정 글자 크기에 비례 스케일
      </Typography.Paragraph>
      <RoleRow strName="pageTitle (display-sm)" objRole={objTypoRoles.pageTitle} strSample="프로덕트 관리" />
      <RoleRow strName="titleMd" objRole={objTypoRoles.titleMd} strSample="카드 섹션 제목" />
      <RoleRow strName="titleSm" objRole={objTypoRoles.titleSm} strSample="사이드바 로고" />
      <RoleRow strName="bodyMd" objRole={objTypoRoles.bodyMd} strSample="본문과 폼 라벨 기본 크기입니다." />
      <RoleRow strName="bodySm" objRole={objTypoRoles.bodySm} strSample="테이블 셀·보조 본문" />
      <RoleRow strName="caption" objRole={objTypoRoles.caption} strSample="CrudPageShell 설명 줄" />
      <RoleRow
        strName="captionUppercase"
        objRole={objTypoRoles.captionUppercase}
        strSample="이벤트"
      />
      <RoleRow
        strName="code"
        objRole={objTypoRoles.code}
        strSample="SELECT * FROM users;"
        bMono
      />
      <RoleRow strName="button" objRole={objTypoRoles.button} strSample="버튼 라벨" />
      <div style={{ marginTop: 8 }}>
        <Button type="primary">Primary (토큰 연동)</Button>
      </div>
      <RoleRow strName="navLink" objRole={objTypoRoles.navLink} strSample="메뉴 항목" />
    </div>
  );
};

const meta: Meta = {
  title: 'DQPM/Typography',
  component: TypographyPanel,
  parameters: { layout: 'padded' },
};

export default meta;
type TStory = StoryObj;

export const Roles: TStory = {
  render: () => <TypographyPanel />,
};
