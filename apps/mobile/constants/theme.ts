export const theme = {
  colors: {
    primary: '#0EA5A4',
    primaryDark: '#0B3B4A',
    background: '#F7FAFC',
    surface: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    accent: '#F59E0B',
    white: '#FFFFFF',
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    md: 12,
    lg: 16,
    xl: 24,
  },
};

export const Colors = {
  light: {
    text: theme.colors.text,
    background: theme.colors.background,
  },
  dark: {
    text: theme.colors.white,
    background: theme.colors.primaryDark,
  },
} as const;
