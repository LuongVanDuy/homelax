import type { ReactNode } from 'react';
import { Alert, Typography } from '@mui/material';

export type ErrorStateProps = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function ErrorState({
  title = 'Không thể tải dữ liệu',
  description = 'Đã xảy ra lỗi. Vui lòng thử lại.',
  action,
}: ErrorStateProps) {
  return (
    <Alert
      severity="error"
      variant="outlined"
      action={action}
      sx={{ alignItems: 'center' }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography variant="body2">{description}</Typography>
    </Alert>
  );
}
