import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { UserSummary } from '@tinyhouse/contracts';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { toast } from '../../../lib/toast';
import { useResetUserPasswordMutation } from '../api';
import { userErrorMessage } from '../userPresentation';
import { UserPasswordField } from './UserPasswordField';

const schema = z.object({
  password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'Mật khẩu xác nhận chưa khớp.' });
type Values = z.infer<typeof schema>;

export function ResetUserPasswordDialog({ user, onClose }: { user: UserSummary; onClose: () => void }) {
  const mutation = useResetUserPasswordMutation();
  const { control, register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), mode: 'onTouched', defaultValues: { password: '', confirmPassword: '' },
  });
  const confirm = register('confirmPassword');
  return (
    <Dialog open fullWidth maxWidth="sm" onClose={isSubmitting ? undefined : onClose} aria-labelledby="reset-password-title">
      <Box component="form" noValidate onSubmit={handleSubmit(async ({ password }) => {
        try {
          await mutation.mutateAsync({ id: user.id, newPassword: password });
          toast.success('Đã đặt lại mật khẩu.');
          onClose();
        } catch (error) { toast.error(userErrorMessage(error)); }
      })}>
        <DialogTitle id="reset-password-title">Đặt lại mật khẩu</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Typography><strong>{user.name}</strong><br />{user.email}</Typography>
            <Controller name="password" control={control} render={({ field }) => (
              <UserPasswordField field={field} disabled={isSubmitting} error={errors.password?.message} onGenerate={(password) => {
                setValue('password', password, { shouldValidate: true });
                setValue('confirmPassword', password, { shouldValidate: true });
              }} />
            )} />
            <TextField {...confirm} inputRef={confirm.ref} ref={undefined} label="Nhập lại mật khẩu" required type="password" autoComplete="new-password"
              disabled={isSubmitting} error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button color="inherit" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu…' : 'Xác nhận đặt lại'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
