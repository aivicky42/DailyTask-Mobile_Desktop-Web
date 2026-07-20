import { useColorScheme } from 'react-native';
import { COLORS, DARK_THEME, LIGHT_THEME } from '../constants/colors';

export interface AppTheme {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  success: string;
  warning: string;
  danger: string;
}

export function useAppTheme(): AppTheme {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  return {
    isDark,
    ...theme,
    primary: COLORS.primary,
    primaryLight: COLORS.primaryLight,
    success: COLORS.success,
    warning: COLORS.warning,
    danger: COLORS.danger,
  };
}
