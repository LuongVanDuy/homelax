import { useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField } from '@mui/material';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { registerRequestSchema } from '@tinyhouse/contracts';
import { useLocation, useNavigate } from 'react-router';
import { useForm, z, zodResolver } from '../../../app/forms';
import { AuthService } from '../authService';
import { toast } from '../../../lib/toast';
import { publicAuthFormSx, publicAuthSubmitSx } from './authFormStyles';

const fields = registerRequestSchema.pick({ name: true, phone: true, email: true, password: true }).extend({
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Mật khẩu nhập lại chưa khớp.' });
type Values = z.infer<typeof fields>;

export function RegisterForm() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const busy = useRef(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(fields), mode: 'onTouched',
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
  });
  const input = (name: keyof Values, label: string, type = 'text', autoComplete?: string) => {
    const field = register(name);
    return <TextField key={name} id={`register-${name}`} label={label} required size="small" {...field} inputRef={field.ref} ref={undefined}
        type={type} autoComplete={autoComplete} disabled={isSubmitting} fullWidth
        error={Boolean(errors[name])} helperText={errors[name]?.message || (name === 'password' ? 'Ít nhất 8 ký tự.' : undefined)}
        slotProps={{ input: name === 'password' ? { endAdornment: <InputAdornment position="end">
          <IconButton type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}
            disabled={isSubmitting} onClick={() => setShowPassword(value => !value)} edge="end" sx={{ width: 44, height: 44 }}>
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </IconButton>
        </InputAdornment> } : undefined }} />;
  };
  return <Box component="form" sx={publicAuthFormSx} noValidate aria-label="Đăng ký tài khoản" aria-busy={isSubmitting}
    onSubmit={event => { void handleSubmit(async values => {
      if (busy.current) return;
      busy.current = true;
      try {
        const { confirmPassword: _, ...data } = values;
        await AuthService.register(data);
        toast.success('Đã tạo tài khoản. Bạn có thể đăng nhập ngay.', { id: 'auth-register' });
        navigate(`/dang-nhap${search}`, { replace: true });
      } catch (error) {
        const failure = error as { code?: string; status?: number; message?: string; payload?: { details?: { path: string; message: string }[] } };
        if (failure.code === 'SESSION_CHANGED') return;
        for (const detail of failure.payload?.details || []) {
          if (detail.path in values) setError(detail.path as keyof Values, { message: detail.message });
        }
        toast.error(failure.status && failure.status < 500 ? failure.message || 'Không thể đăng ký.'
          : 'Chưa xác nhận được kết quả đăng ký. Hãy kiểm tra kết nối hoặc thử đăng nhập trước khi gửi lại.', { id: 'auth-register' });
      } finally { busy.current = false; }
    })(event); }}>
    <Stack spacing={2.5}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' }, gap: 2.5 }}>
        {input('name', 'Họ và tên', 'text', 'name')}
        {input('phone', 'Số điện thoại', 'tel', 'tel')}
      </Box>
      {input('email', 'Email', 'email', 'email')}
      {input('password', 'Mật khẩu', showPassword ? 'text' : 'password', 'new-password')}
      {input('confirmPassword', 'Nhập lại mật khẩu', showPassword ? 'text' : 'password', 'new-password')}
      <Button type="submit" variant="contained" color="primary" disabled={isSubmitting} fullWidth sx={publicAuthSubmitSx}
        endIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <ArrowRight size={18} />}>
        {isSubmitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
      </Button>
    </Stack>
  </Box>;
}
