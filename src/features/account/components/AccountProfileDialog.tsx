import { useEffect, useRef, useState } from 'react';
import { Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Camera, Trash2 } from 'lucide-react';
import { profileBirthDateSchema, profilePhoneSchema, type AccountUser } from '@tinyhouse/contracts';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { toast } from '../../../lib/toast';
import { accountSessionGuard, saveAccountProfile, uploadAccountAvatar, useRefreshAccountData } from '../api/account.api';

const fields = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(200),
  phone: profilePhoneSchema,
  gender: z.enum(['', 'male', 'female', 'other']),
  birthDate: z.string().refine(value => !value || profileBirthDateSchema.safeParse(value).success, 'Ngày sinh không hợp lệ hoặc ở tương lai.'),
  address: z.string().trim().max(1000),
});
type Values = z.infer<typeof fields>;

export function AccountProfileDialog({ user, self, onClose }: { user: AccountUser; self: boolean; onClose: () => void }) {
  const refresh = useRefreshAccountData();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(user.avatar);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const uploadedUrl = useRef('');
  const busyRef = useRef(false);
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(fields), mode: 'onTouched',
    defaultValues: { name: user.name, phone: user.phone, gender: user.gender || '', birthDate: user.birthDate || '', address: user.address },
  });
  const bind = (key: 'name' | 'phone' | 'birthDate' | 'address') => {
    const field = register(key);
    return { ...field, inputRef: field.ref, ref: undefined, error: Boolean(errors[key]), helperText: errors[key]?.message };
  };
  return <Dialog open fullWidth maxWidth="sm" onClose={isSubmitting ? undefined : onClose} aria-labelledby="account-profile-title">
    <Box component="form" noValidate onSubmit={event => { void handleSubmit(async values => {
      if (busyRef.current) return;
      busyRef.current = true;
      const guard = accountSessionGuard();
      try {
        guard();
        if (file && !uploadedUrl.current) uploadedUrl.current = await uploadAccountAvatar(file);
        guard();
        await saveAccountProfile({
          ...values, gender: values.gender || null, birthDate: values.birthDate || null,
          ...(uploadedUrl.current ? { avatar: uploadedUrl.current } : removeAvatar ? { avatar: '' } : {}),
        }, self ? undefined : user);
        toast.success('Đã cập nhật hồ sơ tài khoản.');
        onClose();
        // A read-back failure cannot turn a committed write into a duplicate-save prompt.
        await refresh().catch(() => undefined);
      } catch (error) {
        const details = (error as { payload?: { details?: { path: string; message: string }[] } }).payload?.details || [];
        for (const issue of details) {
          if (['name', 'phone', 'birthDate', 'gender', 'address'].includes(issue.path)) setError(issue.path as keyof Values, { message: issue.message });
        }
        toast.error(error instanceof Error ? error.message : 'Không thể lưu hồ sơ.');
      } finally { busyRef.current = false; }
    })(event); }}>
      <DialogTitle id="account-profile-title">Chỉnh sửa hồ sơ</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar src={preview || undefined} alt={user.name} sx={{ width: 72, height: 72 }}>{user.name.slice(0, 1)}</Avatar>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Button component="label" variant="outlined" startIcon={<Camera size={17} />} disabled={isSubmitting}>
                  Chọn ảnh
                  <Box component="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" sx={{ display: 'none' }} onChange={event => {
                    const selected = event.target.files?.[0]; event.target.value = '';
                    if (!selected) return;
                    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(selected.type) || selected.size > 5 * 1024 * 1024) {
                      toast.error('Chọn ảnh JPG, PNG, WebP, GIF hoặc AVIF không quá 5 MB.'); return;
                    }
                    setFile(selected); setPreview(URL.createObjectURL(selected)); setRemoveAvatar(false); uploadedUrl.current = '';
                  }} />
                </Button>
                {preview && <Button disabled={isSubmitting} color="inherit" startIcon={<Trash2 size={16} />} onClick={() => {
                  setFile(null); setPreview(''); setRemoveAvatar(true); uploadedUrl.current = '';
                }}>Gỡ ảnh</Button>}
              </Stack>
              <Typography variant="caption" color="text.secondary">Ảnh tối đa 5 MB. Lưu thay đổi để áp dụng.</Typography>
            </Stack>
          </Stack>
          <TextField {...bind('name')} label="Họ và tên" autoComplete="name" required disabled={isSubmitting} />
          <TextField value={user.email} label="Email đăng nhập" slotProps={{ input: { readOnly: true } }} helperText="Email được quản lý riêng, không thay đổi qua hồ sơ cá nhân." />
          <TextField {...bind('phone')} label="Số điện thoại" type="tel" autoComplete="tel" disabled={isSubmitting} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller name="gender" control={control} render={({ field }) => <TextField {...field} inputRef={field.ref} ref={undefined} label="Giới tính" select fullWidth disabled={isSubmitting}
              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
              <MenuItem value="">Chưa cung cấp</MenuItem><MenuItem value="male">Nam</MenuItem><MenuItem value="female">Nữ</MenuItem><MenuItem value="other">Khác</MenuItem>
            </TextField>} />
            <TextField {...bind('birthDate')} label="Ngày sinh" type="date" fullWidth disabled={isSubmitting} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <TextField {...bind('address')} label="Địa chỉ cá nhân" autoComplete="street-address" multiline minRows={2} disabled={isSubmitting} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
      </DialogActions>
    </Box>
  </Dialog>;
}
