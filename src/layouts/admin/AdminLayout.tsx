import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { Outlet } from 'react-router';

export function AdminLayout({ sessionReady, sessionError, onRetry }: {
  sessionReady: boolean;
  sessionError: boolean;
  onRetry: () => void;
}) {
  if (!sessionReady || sessionError) {
    return <Box component="main" sx={{
      minHeight: '100dvh', display: 'grid', placeItems: 'center',
      bgcolor: 'background.default', px: 3,
    }}>
      <Stack spacing={2} role={sessionError ? 'alert' : 'status'} aria-live="polite"
        sx={{ maxWidth: 440, textAlign: 'center', alignItems: 'center' }}>
        {sessionError ? <>
          <Typography component="h1" variant="h5">Chưa thể tải trang quản trị</Typography>
          <Typography color="text.secondary">Vui lòng kiểm tra kết nối và thử lại.</Typography>
          <Button color="secondary" variant="contained" onClick={onRetry}>Thử lại</Button>
        </> : <>
          <CircularProgress color="secondary" size={28} />
          <Typography variant="body2" color="text.secondary">Đang tải trang quản trị…</Typography>
        </>}
      </Stack>
    </Box>;
  }
  return <Outlet />;
}
