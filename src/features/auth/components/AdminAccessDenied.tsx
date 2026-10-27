import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ShieldAlert } from 'lucide-react';
import { AuthShell } from './AuthShell';
import type { AppIdentity } from '../identityStore';

export function AdminAccessDenied({ user, onLogout }: { user: AppIdentity; onLogout: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell>
      <Stack spacing={2} role="status">
        <Box sx={{ color: 'secondary.main' }}><ShieldAlert size={32} aria-hidden="true" /></Box>
        <Typography variant="h4" component="h1">Chưa có quyền truy cập</Typography>
        <Typography color="text.secondary">
          Tài khoản {String(user?.email || user?.name || 'hiện tại')} chưa được cấp quyền vào hệ thống quản trị.
          Vui lòng liên hệ quản trị viên để kiểm tra quyền hoặc trạng thái tài khoản.
        </Typography>
        <Button variant="contained" color="secondary" disabled={busy} sx={{ minHeight: 48 }} onClick={async () => {
          setBusy(true);
          try { await onLogout(); } finally { setBusy(false); }
        }}>
          {busy ? 'Đang đăng xuất…' : 'Đăng nhập bằng tài khoản khác'}
        </Button>
      </Stack>
    </AuthShell>
  );
}
