import type { Preview } from '@storybook/react-vite';
import '../src/index.css';
import { DqpmThemeDecorator } from './DqpmThemeDecorator';
import { STR_PRIMARY_ANT_BLUE } from '../src/stores/useThemeStore';

const preview: Preview = {
  decorators: [DqpmThemeDecorator],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: '라이트 / 다크',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    primaryPreset: {
      name: 'Point',
      description: 'Cursor IDE / Cursor.com / 블루 (앱 UI 설정 3종 중 툴바는 2종)',
      defaultValue: 'site',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'ide', title: 'Cursor IDE (#434343)' },
          { value: 'site', title: 'Cursor.com (#f54e00)' },
          { value: 'blue', title: `블루 (${STR_PRIMARY_ANT_BLUE})` },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    docs: {
      toc: true,
    },
  },
};

export default preview;
