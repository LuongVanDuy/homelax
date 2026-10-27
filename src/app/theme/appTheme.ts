import { viVN } from '@mui/material/locale';
import { createTheme } from '@mui/material/styles';
import { componentOverrides } from './componentOverrides';
import { designTokens } from './tokens';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: designTokens.colors.brand[500],
      dark: designTokens.colors.brand[600],
      light: designTokens.colors.brand[50],
      contrastText: designTokens.colors.neutral[0],
    },
    secondary: {
      main: designTokens.colors.navy[900],
      contrastText: designTokens.colors.neutral[0],
    },
    background: {
      default: designTokens.colors.neutral[50],
      paper: designTokens.colors.neutral[0],
    },
    text: {
      primary: designTokens.colors.neutral[800],
      secondary: designTokens.colors.neutral[600],
    },
    success: {
      main: designTokens.colors.status.success,
      contrastText: designTokens.colors.neutral[0],
    },
    warning: {
      main: designTokens.colors.status.warning,
      contrastText: designTokens.colors.neutral[0],
    },
    error: {
      main: designTokens.colors.status.error,
      contrastText: designTokens.colors.neutral[0],
    },
    info: {
      main: designTokens.colors.status.info,
      contrastText: designTokens.colors.neutral[0],
    },
  },
  typography: {
    fontFamily: designTokens.typography.fontFamily,
    h1: { fontWeight: designTokens.typography.weights.extrabold, lineHeight: 1.15 },
    h2: { fontWeight: designTokens.typography.weights.extrabold, lineHeight: 1.18 },
    h3: { fontWeight: designTokens.typography.weights.extrabold, lineHeight: 1.2 },
    h4: { fontWeight: designTokens.typography.weights.extrabold, lineHeight: 1.25 },
    h5: { fontWeight: designTokens.typography.weights.bold, lineHeight: 1.3 },
    h6: { fontWeight: designTokens.typography.weights.bold, lineHeight: 1.35 },
    button: { fontWeight: designTokens.typography.weights.bold },
  },
  shape: {
    borderRadius: designTokens.radius.sm,
  },
  breakpoints: {
    values: designTokens.breakpoints,
  },
  spacing: 8,
  components: componentOverrides,
}, viVN);

export default appTheme;
