import { useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useForm, z, zodResolver } from '../../../app/forms';
import { toast } from '../../../lib/toast';
import { changeAccountPassword } from '../api/account.api';

const schema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
  newPassword: z.string().min(8, 'Mật khẩu mới cần ít nhất 8 ký tự.'),
  confirmPassword: z.string(),
}).refine(value => value.newPassword === value.confirmPassword, { path: ['confirmPassword'], message: 'Mật khẩu xác nhận chưa khớp.' });
type Values = z.infer<typeof schema>;

export function AccountPasswordDialog({ onClose, loginTo = '/admin/login?returnTo=%2Fcms%2Faccount' }: { onClose: () => void; loginTo?: string }) {
  const navigate = useNavigate();
  const locked = useRef(false);
  const [visible, setVisible] = useState(false);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  return <Dialog open fullWidth maxWidth="sm" onClose={isSubmitting ? undefined : onClose} aria-labelledby="account-password-title">
    <Box component="form" noValidate onSubmit={event => { void handleSubmit(async values => {
      if (locked.current) return;
      locked.current = true;
      try {
        await changeAccountPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
        reset(); onClose();
        toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
        navigate(loginTo, { replace: true });
      } catch (error) {
        const failure = error as { status?: number; payload?: { details?: { path: string; message: string }[] } };
        for (const issue of failure.payload?.details || []) {
          if (['currentPassword', 'newPassword'].includes(issue.path)) setError(issue.path as keyof Values, { message: issue.message }, { shouldFocus: true });
        }
        toast.error(error instanceof Error ? error.message : 'Không thể xác nhận kết quả đổi mật khẩu.');
      } finally { locked.current = false; }
    })(event); }}>
      <DialogTitle id="account-password-title">Đổi mật khẩu</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">Sau khi đổi mật khẩu, bạn cần đăng nhập lại.</Typography>
          {([
            ['currentPassword', 'Mật khẩu hiện tại', 'current-password'],
            ['newPassword', 'Mật khẩu mới', 'new-password'],
            ['confirmPassword', 'Nhập lại mật khẩu mới', 'new-password'],
          ] as const).map(([key, label, autoComplete]) => {
            const field = register(key);
            return <TextField key={key} {...field} inputRef={field.ref} ref={undefined} label={label}
              required disabled={isSubmitting} type={visible ? 'text' : 'password'} autoComplete={autoComplete}
              error={Boolean(errors[key])} helperText={errors[key]?.message}
              slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton
                aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(value => !value)} edge="end"
              >{visible ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton></InputAdornment> } }} />;
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>Hủy</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</Button>
      </DialogActions>
    </Box>
  </Dialog>;
}
