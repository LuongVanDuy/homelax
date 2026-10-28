import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { USER_STATUSES, isCombinableRoleCode, type UserSummary, type UserStatus } from '@tinyhouse/contracts';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { toast } from '../../../lib/toast';
import type { RoleSummary } from '../../roles/api/role.queries';
import { useProvisionUserMutation, useSaveUserMutation } from '../api';
import { canonicalUserStatus, userErrorMessage } from '../userPresentation';
import { UserPasswordField } from './UserPasswordField';

type Props = {
  user?: UserSummary;
  roles: RoleSummary[];
  currentUserId: string;
  initialRoleCode?: string;
  lockRole?: boolean;
  title?: string;
  onClose: () => void;
};

const fields = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên.'),
  email: z.string().trim().min(1, 'Vui lòng nhập email.').email('Email chưa đúng định dạng.'),
  phone: z.string().trim().refine((value) => !value || /^[+\d][\d\s().-]{5,19}$/.test(value), 'Số điện thoại chưa đúng định dạng.'),
  roleCode: z.string().min(1, 'Vui lòng chọn vai trò.'),
  extraRoleCodes: z.array(z.string()),
  status: z.string().refine((value) => USER_STATUSES.includes(value as UserStatus), 'Vui lòng chọn trạng thái.'),
  password: z.string(),
  confirmPassword: z.string(),
});
type Values = z.infer<typeof fields>;

export function UserEditorDialog({ user, roles, currentUserId, initialRoleCode = '', lockRole = false, title, onClose }: Props) {
  const save = useSaveUserMutation();
  const provision = useProvisionUserMutation();
  const isSelf = user?.id === currentUserId;
  const schema = fields.superRefine((values, context) => {
    if (!user && values.password.length < 8) context.addIssue({ code: 'custom', path: ['password'], message: 'Mật khẩu cần ít nhất 8 ký tự.' });
    if (!user && values.password !== values.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Mật khẩu xác nhận chưa khớp.' });
  });
  const { control, register, handleSubmit, setValue, setError, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), mode: 'onTouched',
    defaultValues: {
      name: user?.name || '', email: user?.email || '', phone: user?.phone || '', roleCode: user?.roleCode || initialRoleCode,
      extraRoleCodes: user?.extraRoleCodes || [],
      status: user ? canonicalUserStatus(user.status) : 'Hoạt động', password: '', confirmPassword: '',
    },
  });
  const roleCode = watch('roleCode');
  const combinable = isCombinableRoleCode(roleCode);
  const extraRoleOptions = roles.filter((role) => role.code !== roleCode && isCombinableRoleCode(role.code));
  const extraRoleCodesFor = (values: Values) => combinable ? values.extraRoleCodes.filter((code) => code !== values.roleCode) : [];
  const bind = (name: 'name' | 'email' | 'phone' | 'confirmPassword') => {
    const field = register(name);
    return { ...field, inputRef: field.ref, ref: undefined, error: Boolean(errors[name]), helperText: errors[name]?.message };
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={isSubmitting ? undefined : onClose} aria-labelledby="user-editor-title">
      <Box component="form" noValidate aria-busy={isSubmitting} onSubmit={handleSubmit(async (values) => {
        try {
          const profile = { name: values.name, email: values.email, phone: values.phone };
          if (user) {
            const result = await save.mutateAsync({ id: user.id, ...profile, ...(!isSelf ? { roleCode: values.roleCode, extraRoleCodes: extraRoleCodesFor(values), status: values.status as UserStatus } : {}) });
            if (result.identityRefreshFailed) {
              toast.warning('Đã lưu tài khoản. Hãy tải lại trang để cập nhật thông tin phiên đăng nhập.');
              onClose();
              return;
            }
          } else {
            await provision.mutateAsync({ ...profile, roleCode: values.roleCode, extraRoleCodes: extraRoleCodesFor(values), status: values.status as UserStatus, password: values.password });
          }
          toast.success(user ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản.');
          onClose();
        } catch (error) {
          const failure = error as { status?: number; payload?: { details?: { path: string; message: string }[] } };
          const fieldErrors = failure.payload?.details || [];
          for (const issue of fieldErrors) {
            if (['name', 'email', 'phone', 'roleCode', 'extraRoleCodes', 'status', 'password'].includes(issue.path)) {
              setError(issue.path as keyof Values, { message: issue.message }, { shouldFocus: true });
            }
          }
          if (failure.status === 409 && !fieldErrors.length) setError('email', { message: 'Email đã được sử dụng.' }, { shouldFocus: true });
          toast.error(userErrorMessage(error));
        }
      })}>
        <DialogTitle id="user-editor-title">{title || (user ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField {...bind('name')} label="Họ và tên" autoComplete="name" required autoFocus disabled={isSubmitting} />
            <TextField {...bind('email')} label="Email đăng nhập" type="email" autoComplete="off" required disabled={isSubmitting} />
            <TextField {...bind('phone')} label="Số điện thoại" type="tel" autoComplete="tel" disabled={isSubmitting} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller name="roleCode" control={control} render={({ field }) => (
                <TextField {...field} inputRef={field.ref} ref={undefined} label="Vai trò" select required fullWidth
                  disabled={isSubmitting || isSelf || lockRole} error={Boolean(errors.roleCode)} helperText={errors.roleCode?.message}>
                  <MenuItem value="" disabled>Chọn vai trò</MenuItem>
                  {user && !roles.some((role) => role.code === user.roleCode) && <MenuItem value={user.roleCode} disabled>{user.roleName || user.roleCode}</MenuItem>}
                  {roles.map((role) => <MenuItem key={role.id} value={role.code}>{role.name}</MenuItem>)}
                </TextField>
              )} />
              <Controller name="status" control={control} render={({ field }) => (
                <TextField {...field} inputRef={field.ref} ref={undefined} label="Trạng thái" select required fullWidth
                  disabled={isSubmitting || isSelf} error={Boolean(errors.status)} helperText={errors.status?.message}>
                  <MenuItem value="" disabled>Chọn trạng thái</MenuItem>
                  {USER_STATUSES.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                </TextField>
              )} />
            </Stack>
            {!lockRole && <Controller name="extraRoleCodes" control={control} render={({ field }) => (
              <TextField label="Gộp thêm vai trò (không bắt buộc)" select fullWidth
                value={combinable ? field.value.filter((code) => code !== roleCode) : []}
                onChange={(event) => field.onChange(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}
                disabled={isSubmitting || isSelf || !combinable || !extraRoleOptions.length}
                error={Boolean(errors.extraRoleCodes)}
                helperText={errors.extraRoleCodes?.message || (combinable
                  ? 'Tài khoản có quyền của vai trò chính cộng thêm các vai trò được chọn, ví dụ BTV + Quản lý tòa nhà.'
                  : 'Vai trò chính này không gộp được với vai trò khác.')}
                slotProps={{ select: {
                  multiple: true,
                  renderValue: (value) => (value as string[]).map((code) => roles.find((role) => role.code === code)?.name || code).join(', '),
                } }}>
                {extraRoleOptions.map((role) => <MenuItem key={role.id} value={role.code}>
                  <Checkbox size="small" checked={field.value.includes(role.code)} sx={{ py: 0, ml: -1 }} />{role.name}
                </MenuItem>)}
              </TextField>
            )} />}
            {!user && <>
              <Controller name="password" control={control} render={({ field }) => (
                <UserPasswordField field={field} disabled={isSubmitting} error={errors.password?.message} onGenerate={(password) => {
                  setValue('password', password, { shouldValidate: true });
                  setValue('confirmPassword', password, { shouldValidate: true });
                }} />
              )} />
              <TextField {...bind('confirmPassword')} label="Nhập lại mật khẩu" type="password" autoComplete="new-password" required disabled={isSubmitting} />
            </>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button color="inherit" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
          <Button variant="contained" type="submit" disabled={isSubmitting || !roles.length}>
            {isSubmitting ? 'Đang lưu…' : user ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
