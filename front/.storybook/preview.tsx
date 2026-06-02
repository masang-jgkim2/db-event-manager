import type { Preview } from '@storybook/react-vite';
import { DqpmThemeDecorator } from './DqpmThemeDecorator';

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
      description: 'Cursor IDE vs Cursor.com',
      defaultValue: 'site',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'ide', title: 'Cursor IDE (#434343)' },
          { value: 'site', title: 'Cursor.com (#f54e00)' },
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
