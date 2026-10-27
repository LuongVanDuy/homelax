import { useState } from 'react';
import { Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { loginRequestSchema } from '@tinyhouse/contracts';
import { Link, useLocation } from 'react-router';
import { useForm, z, zodResolver } from '../../../app/forms';
import { AuthService } from '../authService';
import { toast } from '../../../lib/toast';
import { authFormSx, publicAuthFormSx, publicAuthSubmitSx } from './authFormStyles';

const schema = loginRequestSchema.extend({
  email: z.string().trim().min(1, 'Vui lòng nhập email.').email('Email chưa đúng định dạng.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});
type LoginValues = z.infer<typeof schema>;

function loginError(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status === 401) return 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.';
  if (status === 403) return 'Tài khoản chưa được kích hoạt hoặc đã bị khóa. Vui lòng liên hệ quản trị viên.';
  if (status === 429) return 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.';
  return 'Không thể kết nối để đăng nhập. Vui lòng thử lại sau.';
}

export function LoginForm({ audience }: { audience: 'admin' | 'public' }) {
  const { search } = useLocation();
  const prefix = audience === 'admin' ? 'admin' : 'public';
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(schema), defaultValues: { email: '', password: '' }, mode: 'onTouched',
  });
  const email = register('email');
  const password = register('password');

  return (
    <Box component="form" sx={audience === 'public' ? publicAuthFormSx : authFormSx} noValidate aria-label={audience === 'admin' ? 'Đăng nhập quản trị' : 'Đăng nhập tài khoản'} aria-busy={isSubmitting} onSubmit={handleSubmit(async (values) => {
      try {
        const result = await AuthService.login(values.email, values.password);
        if (!result?.success || !result?.user || !result?.accessToken) {
          toast.error('Không thể đăng nhập. Vui lòng kiểm tra tài khoản hoặc liên hệ quản trị viên.', { id: 'auth-login' });
          return;
        }
        toast.success('Đăng nhập thành công.', { id: 'auth-login' });
      } catch (error) {
        if ((error as { code?: string })?.code === 'SESSION_CHANGED') return;
        toast.error(loginError(error), { id: 'auth-login' });
      }
    })}>
      <Stack spacing={2.5}>
          <TextField
            id={`${prefix}-email`} label="Email" required fullWidth size="small" placeholder="ten@email.com" type="email" autoComplete="username"
            {...email} inputRef={email.ref} ref={undefined} disabled={isSubmitting}
            error={Boolean(errors.email)} helperText={errors.email?.message}
            slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: 'none' } }}
          />
          <TextField
            id={`${prefix}-password`} label="Mật khẩu" required fullWidth size="small" placeholder="Nhập mật khẩu" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
            {...password} inputRef={password.ref} ref={undefined} disabled={isSubmitting}
            error={Boolean(errors.password)} helperText={errors.password?.message}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">
              <IconButton type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}
                disabled={isSubmitting} onClick={() => setShowPassword((show) => !show)} edge="end" sx={{ width: 44, height: 44 }}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </IconButton>
            </InputAdornment> } }}
          />
        {audience === 'public' && <Button component={Link} to={`/quen-mat-khau${search}`} color="secondary"
          sx={{ alignSelf: 'flex-end', minHeight: 44, px: 0.5, '&&': { mt: 0.5, mb: 0.5 }, fontSize: 13 }}>Quên mật khẩu?</Button>}
        <Button type="submit" variant="contained" color="primary" fullWidth disabled={isSubmitting}
          endIcon={isSubmitting ? <CircularProgress color="inherit" size={18} /> : <ArrowRight size={18} />}
          sx={audience === 'public' ? { ...publicAuthSubmitSx, '&&': { mt: 0 } } : { minHeight: 50 }}>
          {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
        {audience === 'admin' && <Button component={Link} to={`/quen-mat-khau${search}`} color="secondary" sx={{ minHeight: 44 }}>Quên mật khẩu?</Button>}
        {audience === 'admin' && <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', lineHeight: 1.7 }}>
          Chưa có tài khoản quản trị?<br />Liên hệ quản trị viên để được hỗ trợ.
        </Typography>}
      </Stack>
    </Box>
  );
}
