import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { forgotPasswordRequestSchema, publicResetPasswordRequestSchema } from '@tinyhouse/contracts';
import { PublicContainer, PublicSurface } from '../../../components/public';
import { useForm, z, zodResolver } from '../../../app/forms';
import { authFormSx } from '../components/authFormStyles';
import { AuthService } from '../authService';
import { toast } from '../../../lib/toast';

const passwordSchema = publicResetPasswordRequestSchema.omit({ token: true }).extend({ confirmPassword: z.string() })
  .refine(value => value.newPassword === value.confirmPassword, { path: ['confirmPassword'], message: 'Mật khẩu nhập lại chưa khớp.' });

function recoveryError(error: unknown) {
  const failure = error as { status?: number; message?: string };
  return failure.status && failure.status < 600 && failure.message ? failure.message
    : 'Chưa thể kết nối máy chủ. Vui lòng thử lại.';
}

function ForgotPasswordForm() {
  const [message, setMessage] = useState('');
  const [serverError, setServerError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const busy = useRef(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotPasswordRequestSchema>>({
    resolver: zodResolver(forgotPasswordRequestSchema), defaultValues: { email: '' }, mode: 'onTouched',
  });
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      const next = Date.now(); setNow(next);
      if (next >= retryAt) setRetryAt(0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const email = register('email');
  return <Box component="form" sx={authFormSx} noValidate aria-label="Quên mật khẩu" aria-busy={isSubmitting}
    onSubmit={event => { void handleSubmit(async values => {
      if (busy.current || Date.now() < retryAt) return;
      busy.current = true;
      setServerError('');
      try {
        const result = await AuthService.forgotPassword(values.email);
        setMessage(result.message);
        setNow(Date.now()); setRetryAt(Date.now() + result.retryAfterSeconds * 1000);
        toast.success('Đã tiếp nhận yêu cầu khôi phục.');
      } catch (error) {
        const failure = error as { code?: string; payload?: { retryAfterSeconds?: number } };
        if (failure.code === 'SESSION_CHANGED') return;
        const seconds = failure.payload?.retryAfterSeconds;
        if (seconds && Number.isFinite(seconds)) { setNow(Date.now()); setRetryAt(Date.now() + seconds * 1000); }
        setServerError(recoveryError(error));
        toast.error(recoveryError(error));
      } finally { busy.current = false; }
    })(event); }}>
    <Stack spacing={2.5}>
      {message && <Alert severity="info">{message}</Alert>}
      {serverError && <Alert severity="error">{serverError}</Alert>}
      <TextField {...email} inputRef={email.ref} ref={undefined} id="forgot-email" label="Email tài khoản" required
        type="email" autoComplete="email" disabled={isSubmitting} error={Boolean(errors.email)} helperText={errors.email?.message}
        slotProps={{ htmlInput: { autoCapitalize: 'none', spellCheck: false } }} />
      <Button type="submit" variant="contained" disabled={isSubmitting || remaining > 0} sx={{ minHeight: 50 }}
        endIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}>
        {isSubmitting ? 'Đang gửi yêu cầu…' : remaining > 0 ? `Gửi lại sau ${remaining}s` : message ? 'Gửi lại liên kết' : 'Gửi liên kết khôi phục'}
      </Button>
    </Stack>
  </Box>;
}

function ResetPasswordForm({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [invalid, setInvalid] = useState(!publicResetPasswordRequestSchema.shape.token.safeParse(token).success);
  const busy = useRef(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema), defaultValues: { newPassword: '', confirmPassword: '' }, mode: 'onTouched',
  });
  if (invalid) return <Stack spacing={2}>
    <Alert severity="warning">liên kết khôi phục không hợp lệ, đã dùng hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.</Alert>
    <Button component={Link} to="/quen-mat-khau" variant="contained" sx={{ minHeight: 50 }}>Yêu cầu liên kết mới</Button>
  </Stack>;
  return <Box component="form" sx={authFormSx} noValidate aria-label="Đặt lại mật khẩu" aria-busy={isSubmitting}
    onSubmit={event => { void handleSubmit(async values => {
      if (busy.current) return;
      busy.current = true;
      try {
        await AuthService.resetPassword(token, values.newPassword);
        toast.success('Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.');
        onComplete();
      } catch (error) {
        const failure = error as { code?: string; payload?: { code?: string } };
        if (failure.code === 'SESSION_CHANGED') return;
        if (failure.payload?.code === 'RESET_LINK_INVALID') setInvalid(true);
        toast.error(recoveryError(error));
      } finally { busy.current = false; }
    })(event); }}>
    <Stack spacing={2.5}>
      {(['newPassword', 'confirmPassword'] as const).map(name => {
        const field = register(name);
        return <TextField key={name} {...field} inputRef={field.ref} ref={undefined} id={`reset-${name}`} required
          label={name === 'newPassword' ? 'Mật khẩu mới' : 'Nhập lại mật khẩu mới'}
          type={showPassword ? 'text' : 'password'} autoComplete="new-password" disabled={isSubmitting}
          error={Boolean(errors[name])} helperText={errors[name]?.message || (name === 'newPassword' ? 'Ít nhất 8 ký tự.' : undefined)}
          slotProps={{ input: name === 'newPassword' ? { endAdornment: <InputAdornment position="end">
            <IconButton aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}
              disabled={isSubmitting} onClick={() => setShowPassword(value => !value)} edge="end" sx={{ width: 44, height: 44 }}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </IconButton>
          </InputAdornment> } : undefined }} />;
      })}
      <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ minHeight: 50 }}
        endIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}>
        {isSubmitting ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
      </Button>
    </Stack>
  </Box>;
}

export function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Retain the secret only in this page's memory, never in history state/storage.
  const [token, setToken] = useState(() => reset ? new URLSearchParams(location.hash.slice(1)).get('token') || '' : '');
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    if (reset && location.hash) navigate(location.pathname, { replace: true });
  }, [reset, location.hash, location.pathname, navigate]);
  const loginUrl = reset ? '/dang-nhap' : `/dang-nhap${location.search}`;
  return <PublicSurface><PublicContainer>
    <Box sx={{ maxWidth: 460, mx: 'auto', py: { xs: 4, sm: 7 } }}>
      <Button component={Link} to={loginUrl} color="secondary" startIcon={<ArrowLeft size={18} />} sx={{ mb: 2, minHeight: 44 }}>Đăng nhập</Button>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontSize: 28, fontWeight: 800, mb: 1 }}>
          {reset ? 'Đặt lại mật khẩu' : 'Quên mật khẩu'}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {reset ? 'Tạo mật khẩu mới cho tài khoản của bạn.' : 'Nhập email tài khoản để nhận liên kết khôi phục.'}
        </Typography>
        {completed ? <Stack spacing={2}>
          <Alert severity="success">Mật khẩu đã được cập nhật. Hãy đăng nhập bằng mật khẩu mới.</Alert>
          <Button component={Link} to="/dang-nhap" variant="contained" sx={{ minHeight: 50 }}>Đăng nhập</Button>
        </Stack> : reset ? <ResetPasswordForm token={token} onComplete={() => { setToken(''); setCompleted(true); }} /> : <ForgotPasswordForm />}
      </Paper>
    </Box>
  </PublicContainer></PublicSurface>;
}
