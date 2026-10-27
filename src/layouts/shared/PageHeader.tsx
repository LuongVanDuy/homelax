import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  compact = false,
}: PageHeaderProps) {
  return (
    <Stack
      sx={{
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', md: 'flex-start' },
        gap: 2,
        mb: compact ? 2 : 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography
            variant="overline"
            color="primary.main"
            sx={{ fontWeight: 800, letterSpacing: '0.08em' }}
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography
          component="h1"
          variant={compact ? 'h5' : 'h4'}
          sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          {title}
        </Typography>
        {description ? (
          <Typography
            color="text.secondary"
            sx={{ mt: 0.75, maxWidth: 760, lineHeight: 1.65 }}
          >
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Box sx={{ flexShrink: 0, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {actions}
        </Box>
      ) : null}
    </Stack>
  );
}
