export const COLORS = {
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  primaryDark: '#4F46E5',
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  status: {
    TODO: '#9CA3AF',
    IN_PROGRESS: '#3B82F6',
    COMPLETED: '#22C55E',
  },
  statusBg: {
    TODO: '#F3F4F6',
    IN_PROGRESS: '#EFF6FF',
    COMPLETED: '#F0FDF4',
  },
  categories: {
    '00000000-0000-0000-0000-000000000001': '#2196F3', // Work
    '00000000-0000-0000-0000-000000000002': '#9C27B0', // Personal
    '00000000-0000-0000-0000-000000000003': '#FF9800', // Study
    '00000000-0000-0000-0000-000000000004': '#4CAF50', // Health
    '00000000-0000-0000-0000-000000000005': '#F44336', // Life
    '00000000-0000-0000-0000-000000000006': '#9E9E9E', // Others
  } as Record<string, string>,
  categoryPalette: [
    '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
    '#10B981', '#14B8A6', '#3B82F6', '#0EA5E9', '#22C55E',
    '#F97316', '#84CC16',
  ],
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const DARK_THEME = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  border: '#2D2D2D',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

export const LIGHT_THEME = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
};

export function getCategoryColor(categoryId: string, fallback = '#6366F1'): string {
  return COLORS.categories[categoryId] ?? fallback;
}
