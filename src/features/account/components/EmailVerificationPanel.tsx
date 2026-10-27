import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { MailCheck, Send } from 'lucide-react';
import { AuthService } from '../../auth/authService';
import { accountSessionGuard, useAccountDetailQuery } from '../api/account.api';
import { toast } from '../../../lib/toast';

export function EmailVerificationPanel({ verifiedAt }: { verifiedAt?: string | null }) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const profile = useAccountDetailQuery();
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      const next = Date.now(); setNow(next);
      if (next >= retryAt) setRetryAt(0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  if (verifiedAt || profile.data?.user.emailVerifiedAt) return <Alert severity="success" icon={<MailCheck size={20} />}>Email đã xác thực</Alert>;
  const send = async () => {
    if (inFlight.current || Date.now() < retryAt) return;
    const guard = accountSessionGuard();
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await AuthService.requestEmailVerification();
      guard();
      setMessage(result.message); setNow(Date.now()); setRetryAt(Date.now() + result.retryAfterSeconds * 1000);
      toast.success(result.message);
      void profile.refetch();
    } catch (cause) {
      try { guard(); } catch { return; }
      const failure = cause as { message?: string; code?: string; payload?: { retryAfterSeconds?: number } };
      if (failure.code === 'SESSION_CHANGED') return;
      const seconds = failure.payload?.retryAfterSeconds;
      if (seconds && Number.isFinite(seconds)) { setNow(Date.now()); setRetryAt(Date.now() + seconds * 1000); }
      const text = failure.message || 'Chưa gửi được email. Vui lòng thử lại.';
      setError(text); toast.error(text);
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <Stack spacing={1.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>Email chưa xác thực</Typography>
        <Typography variant="body2" color="text.secondary">Xác nhận email của bạn bằng liên kết gửi đến hộp thư. Bạn vẫn có thể sử dụng tài khoản bình thường.</Typography>
      </Box>
      <Button variant="outlined" startIcon={<Send size={17} />} disabled={busy || remaining > 0} onClick={() => void send()} sx={{ flexShrink: 0 }}>
        {busy ? 'Đang gửi…' : remaining > 0 ? `Gửi lại sau ${remaining}s` : message ? 'Gửi lại email' : 'Xác thực email'}
      </Button>
    </Stack>
    {error ? <Alert severity="error">{error}</Alert> : message && <Alert severity="info">{message}</Alert>}
  </Stack>;
}
