import { createTheme } from '@mui/material/styles';
import { appTheme } from '../../app/theme/appTheme';

// Search inherits the shared base. These overrides also reach portaled dialogs/popups.
export const discoveryTheme = createTheme(appTheme, {
  typography: { caption: { fontSize: '.875rem' }, button: { fontSize: '.875rem' } },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 44 } } },
    MuiInputBase: { styleOverrides: { root: { fontSize: '1rem' }, input: { fontSize: '1rem', fontWeight: 400 } } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: '1rem', fontWeight: 500 } } },
    MuiOutlinedInput: { styleOverrides: { notchedOutline: { '& legend': { fontSize: '.75rem' } } } },
    MuiToggleButton: { styleOverrides: { root: {
      minHeight: 44, minWidth: 44, padding: '8px 12px', fontSize: '.875rem', fontWeight: 600,
      textTransform: 'none', color: appTheme.palette.text.secondary,
      '&.Mui-selected': { color: appTheme.palette.primary.contrastText, backgroundColor: appTheme.palette.primary.main },
      '&.Mui-selected:hover': { backgroundColor: appTheme.palette.primary.dark },
    } } },
  },
});
