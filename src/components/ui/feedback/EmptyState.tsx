import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export type EmptyStateProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  title = 'Chưa có dữ liệu',
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Stack
      sx={{
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
        py: { xs: 5, md: 6 },
        px: 2,
        color: 'text.secondary',
      }}
    >
      {icon ? <Box sx={{ mb: 0.5 }}>{icon}</Box> : null}
      <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" sx={{ maxWidth: 520 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 1.5 }}>{action}</Box> : null}
    </Stack>
  );
}
