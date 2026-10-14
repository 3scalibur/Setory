import { useColorScheme } from 'react-native';

// Технічна тема без дизайну (дизайн — окремим етапом після логіки).
const palette = {
  light: {
    text: '#000000',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    card: '#F0F0F3',
    accent: '#208AEF',
    danger: '#D93025',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    background: '#000000',
    card: '#1C1C1F',
    accent: '#3D9BF5',
    danger: '#FF6B5E',
  },
};

export type Colors = (typeof palette)['light'];

export function useColors(): Colors {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
