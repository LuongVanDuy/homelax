import { createTheme } from '@mui/material/styles';
import { appTheme } from '../../app/theme/appTheme';
import { designTokens } from '../../app/theme/tokens';
import { publicBrand } from '../../app/theme/publicBrand';

/** Home's reference design: logo orange, navy, and a single spacing/type scale. */
export const homeDesign = {
  accent: publicBrand.orange,
  navy: designTokens.colors.navy[900],
  muted: designTokens.colors.neutral[600],
  border: designTokens.colors.neutral[200],
  canvas: designTokens.colors.neutral[50],
  surface: designTokens.colors.neutral[0],
  sectionGap: { xs: 7, md: 10 },
  sectionPadding: { xs: 6, md: 8 },
  gridGap: 2,
  radius: '12px',
  shadow: '0 4px 20px rgba(16,29,48,.045)',
  heading: { fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-.035em' },
  subheading: { fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.4 },
  body: { fontSize: '1rem', lineHeight: 1.7 },
  eyebrow: { fontSize: '.875rem', fontWeight: 700, lineHeight: 1.5, letterSpacing: '.06em', textTransform: 'uppercase' },
} as const;

// Home adjusts typography and spacing; brand colors inherit the shared app theme.
export const homeTheme = createTheme(appTheme, {
  typography: { caption: { fontSize: '.875rem' }, button: { fontSize: '.875rem' } },
  components: {
    MuiSlider: { styleOverrides: { rail: { opacity: 1, backgroundColor: homeDesign.border } } },
  },
});
