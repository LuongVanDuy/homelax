import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { verifyEmailRequestSchema } from '@tinyhouse/contracts';
import { PublicContainer, PublicSurface } from '../../../components/public';
import { AuthService } from '../authService';
import { accountKeys } from '../../account/api/account.api';
import { toast } from '../../../lib/toast';

export function EmailVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);
  const valid = verifyEmailRequestSchema.safeParse({ token }).success;
  const confirm = async () => {
    if (inFlight.current || !valid) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      await AuthService.verifyEmail(token);
      setToken(''); setComplete(true);
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast.success('Email đã được xác thực.');
    } catch (cause) {
      const failure = cause as { message?: string; payload?: { code?: string } };
      if (failure.payload?.code === 'VERIFY_LINK_INVALID') setToken('');
      setError(failure.message || 'Chưa thể xác thực. Vui lòng thử lại.');
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <PublicSurface><PublicContainer>
    <Box sx={{ maxWidth: 520, mx: 'auto', py: { xs: 4, sm: 7 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Typography component="h1" variant="h4" sx={{ fontSize: 28, fontWeight: 800 }}>Xác thực email</Typography>
          {complete ? <Alert severity="success">Email đã được xác thực thành công.</Alert> : <>
            {error && <Alert severity="error">{error}</Alert>}
            {valid ? <>
              <Typography color="text.secondary">Nhấn xác nhận để hoàn tất xác thực email cho tài khoản đã yêu cầu liên kết này.</Typography>
              <Button variant="contained" disabled={busy} sx={{ minHeight: 50 }} onClick={() => void confirm()}>{busy ? 'Đang xác thực…' : 'Xác nhận email'}</Button>
            </> : !error && <Alert severity="warning">Liên kết thiếu hoặc không hợp lệ. Mở lại liên kết từ email hoặc gửi lại trong hồ sơ cá nhân.</Alert>}
          </>}
          <Button component={Link} to="/tai-khoan" variant={complete ? 'contained' : 'outlined'}>Về hồ sơ cá nhân</Button>
        </Stack>
      </Paper>
    </Box>
  </PublicContainer></PublicSurface>;
}
