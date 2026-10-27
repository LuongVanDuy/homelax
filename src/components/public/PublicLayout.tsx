import { useId, type ReactNode } from 'react';
import { Box, Button, Stack, Typography, type ButtonProps } from '@mui/material';
import { designTokens as tokens } from '../../app/theme/tokens';

// Scoped to migrated public blocks. The shared app theme and CMS are unchanged.
export function PublicSurface({ children }: { children: ReactNode }) {
  return <Box className="tiny-public-ui" sx={{
    color: 'text.primary', fontFamily: tokens.typography.fontFamily, minWidth: 0,
    '& .MuiButton-root': { minHeight: 44, textTransform: 'none' },
    '& .MuiButton-contained.MuiButton-colorPrimary': { color: 'primary.contrastText' },
    '& .MuiButton-outlined.MuiButton-colorPrimary, & .MuiButton-text.MuiButton-colorPrimary': { color: 'primary.main' },
    // MUI fields draw focus on their outline; an inner input ring creates a second border.
    '& :is(a,button,input:not(.MuiInputBase-input)):focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 3 },
    '@media (prefers-reduced-motion: reduce)': {
      '& *, & *::before, & *::after': { animation: 'none !important', transition: 'none !important' },
    },
  }}>{children}</Box>;
}

export function PublicContainer({ children }: { children: ReactNode }) {
  return <Box sx={{ width: '100%', maxWidth: tokens.layout.publicContentMax, mx: 'auto', px: { xs: 2, sm: 2.5, lg: 3 }, minWidth: 0 }}>{children}</Box>;
}

export function PublicSection({ title, description, action, children, contained = true }: {
  title: string; description?: string; action?: ReactNode; children: ReactNode; contained?: boolean;
}) {
  const titleId = useId();
  const content = <Box component="section" aria-labelledby={titleId} sx={{ minWidth: 0 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" id={titleId} sx={{ fontSize: { xs: '1.5rem', md: '1.875rem' }, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{title}</Typography>
        {description && <Typography sx={{ mt: 1, color: 'text.secondary', maxWidth: '65ch' }}>{description}</Typography>}
      </Box>
      {action}
    </Stack>
    {children}
  </Box>;
  return <PublicSurface>{contained ? <PublicContainer>{content}</PublicContainer> : content}</PublicSurface>;
}

export function PublicListingGrid({ children, columns = 3 }: { children: ReactNode; columns?: 1 | 3 | 4 }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: columns === 1 ? 'minmax(0, 1fr)' : { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: `repeat(${columns}, minmax(0, 1fr))` }, gap: columns === 4 ? 2 : { xs: 2, md: 3 }, minWidth: 0 }}>{children}</Box>;
}

export function PublicButton(props: ButtonProps) {
  return <Button variant="contained" {...props} sx={[{ minHeight: 44, flexShrink: 0 }, ...(Array.isArray(props.sx) ? props.sx : [props.sx])]} />;
}
