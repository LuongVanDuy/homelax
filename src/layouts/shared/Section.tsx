import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { designTokens } from '../../app/theme/tokens';

export type SectionProps = {
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
};

export function Section({
  children,
  title,
  description,
  actions,
  padded = true,
}: SectionProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: designTokens.colors.neutral[200],
        overflow: 'hidden',
      }}
    >
      {title || description || actions ? (
        <Stack
          sx={{
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            px: padded ? { xs: 2, md: 2.5 } : 0,
            py: padded ? 2 : 0,
            borderBottom: children
              ? `1px solid ${designTokens.colors.neutral[200]}`
              : undefined,
          }}
        >
          <Box>
            {title ? (
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {title}
              </Typography>
            ) : null}
            {description ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {description}
              </Typography>
            ) : null}
          </Box>
          {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
        </Stack>
      ) : null}

      {children ? (
        <Box sx={{ p: padded ? { xs: 2, md: 2.5 } : 0 }}>{children}</Box>
      ) : null}
    </Paper>
  );
}
