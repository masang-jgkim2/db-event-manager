import React, { useEffect, useMemo } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import koKR from 'antd/locale/ko_KR';
import type { Decorator } from '@storybook/react-vite';
import { fnBuildDesignSystem } from '../src/styles/design-system';
import { DesignSystemContext } from '../src/styles/DesignSystemContext';
import { fnApplyTypographyCssVars } from '../src/styles/typographyCss';
import {
  STR_PRIMARY_CURSOR_BRAND,
  STR_PRIMARY_CURSOR_NEUTRAL,
} from '../src/stores/useThemeStore';

/** Storybook — 앱과 동일 ConfigProvider + DesignSystemContext */
export const DqpmThemeDecorator: Decorator = (Story, context) => {
  const strPrimary =
    context.globals.primaryPreset === 'site'
      ? STR_PRIMARY_CURSOR_BRAND
      : STR_PRIMARY_CURSOR_NEUTRAL;
  const bDark = context.globals.theme === 'dark';
  const objDs = useMemo(
    () => fnBuildDesignSystem(strPrimary, bDark, 14),
    [strPrimary, bDark],
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-dqpm-theme', bDark ? 'dark' : 'light');
    document.documentElement.setAttribute(
      'data-dqpm-shell',
      objDs.bCursorSiteShell ? 'cursor-site' : 'ide',
    );
    fnApplyTypographyCssVars({
      strFontUi: objDs.strFontUi,
      strFontMono: objDs.strFontMono,
      objTypoRoles: objDs.objTypoRoles,
    });
  }, [bDark, objDs.bCursorSiteShell, objDs.strFontUi, objDs.strFontMono, objDs.objTypoRoles]);

  const objTheme = objDs.antdThemeConfig as {
    token: Record<string, unknown>;
    components: Record<string, Record<string, unknown>>;
  };

  return (
    <DesignSystemContext.Provider value={objDs}>
      <ConfigProvider
        locale={koKR}
        theme={{
          algorithm: [
            bDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          ],
          token: objTheme.token,
          components: objTheme.components,
        }}
      >
        <div
          style={{
            padding: 24,
            minHeight: '100vh',
            background: objTheme.token.colorBgLayout as string,
            color: objTheme.token.colorText as string,
          }}
        >
          <Story />
        </div>
      </ConfigProvider>
    </DesignSystemContext.Provider>
  );
};
