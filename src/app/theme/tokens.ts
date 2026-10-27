// User-approved primary for both CMS and public UI. Derive interaction tones here only.
const primary = '#e8920a';
const primaryChannels = [1, 3, 5].map(index => parseInt(primary.slice(index, index + 2), 16));
const blendPrimary = (target: number, amount: number) => `#${primaryChannels
  .map(channel => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, '0')).join('')}`;

export const designTokens = {
  colors: {
    brand: {
      50: blendPrimary(255, 0.94),
      100: blendPrimary(255, 0.86),
      200: blendPrimary(255, 0.65),
      500: primary,
      600: blendPrimary(0, 0.08),
      700: blendPrimary(0, 0.3),
    },
    navy: {
      950: '#0B132B',
      900: '#0F172A',
      800: '#1E293B',
      700: '#334155',
    },
    neutral: {
      0: '#FFFFFF',
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
    status: {
      success: '#10B981',
      successSoft: '#D1FAE5',
      warning: '#F59E0B',
      warningSoft: '#FEF3C7',
      error: '#EF4444',
      errorSoft: '#FEE2E2',
      info: '#0284C7',
      infoSoft: '#E0F2FE',
    },
  },
  typography: {
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
  },
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
    sm: '0 1px 3px rgba(15, 23, 42, 0.06)',
    md: '0 4px 16px -2px rgba(15, 23, 42, 0.08)',
    lg: '0 12px 32px -4px rgba(15, 23, 42, 0.12)',
    overlay: '0 20px 60px -12px rgba(15, 23, 42, 0.22)',
  },
  breakpoints: {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
  layout: {
    publicContentMax: 1240,
    adminContentMax: 1440,
    formMax: 760,
    sidebarWidth: 280,
    headerHeight: 72,
  },
  zIndex: {
    header: 1100,
    drawer: 1200,
    modal: 1300,
    toast: 1400,
  },
} as const;

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';
