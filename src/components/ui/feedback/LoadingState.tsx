import type { ReactNode } from 'react';
import { CircularProgress, Stack, Typography } from '@mui/material';

export type LoadingStateProps = {
  label?: ReactNode;
  minHeight?: number | string;
};

export function LoadingState({
  label = 'Đang tải dữ liệu...',
  minHeight = 180,
}: LoadingStateProps) {
  return (
    <Stack
      role="status"
      aria-live="polite"
      sx={{
        minHeight,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
      }}
    >
      <CircularProgress size={30} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
