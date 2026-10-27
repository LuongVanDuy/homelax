import { CmsBadge as Chip } from '../../../components/cms';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormHelperText, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CMS_ROLE_SCREENS, ROLE_RESERVED_CODES, roleWriteSchema, type RoleSummary, type RoleWrite } from '@tinyhouse/contracts';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { toast } from '../../../lib/toast';
import { useSaveRoleMutation, useUpdateRoleMutation } from '../api';
import { editableRoleScreens, isFixedAuthorityRole, isSystemRole, roleErrorMessage, unsupportedRoleScreens } from '../rolePresentation';

type Props = { role?: RoleSummary; duplicate?: boolean; onClose: () => void };
const formSchema = roleWriteSchema.safeExtend({
  name: z.string().trim().min(1, 'Vui lòng nhập tên vai trò.').max(120, 'Tên vai trò không quá 120 ký tự.'),
  code: z.string().trim().min(1, 'Vui lòng nhập mã vai trò.').max(64, 'Mã vai trò không quá 64 ký tự.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Dùng chữ thường, số và dấu gạch dưới; bắt đầu bằng chữ.'),
  description: z.string().trim().max(1000, 'Mô tả không quá 1.000 ký tự.'),
  allowedScreens: z.array(z.enum(CMS_ROLE_SCREENS.map((screen) => screen.code))),
});
type Values = z.infer<typeof formSchema>;
const screenGroups = [
  { name: 'Tổng quan', codes: ['dashboard'] },
  { name: 'Vận hành', codes: ['buildings', 'rooms', 'bookings', 'deals'] },
  { name: 'Hoa hồng', codes: ['commissionHistory'] },
  { name: 'Hệ thống', codes: ['auditlog'] },
];

export function RoleEditorDialog({ role, duplicate = false, onClose }: Props) {
  const create = useSaveRoleMutation();
  const update = useUpdateRoleMutation();
  const editing = Boolean(role && !duplicate);
  const system = Boolean(editing && role && isSystemRole(role.code));
  const fixedAuthority = Boolean(editing && role && isFixedAuthorityRole(role.code));
  const authorityLocked = system || fixedAuthority;
  const fixedScreens = role?.code === 'commission_accountant' ? ['commissionHistory'] as const : [] as const;
  const unsupported = role && editing ? unsupportedRoleScreens(role) : [];
  const schema = formSchema.superRefine((values, context) => {
    if (!editing && (ROLE_RESERVED_CODES as readonly string[]).includes(values.code)) {
      context.addIssue({ code: 'custom', path: ['code'], message: 'Mã này dành riêng cho hệ thống.' });
    }
  });
  const { register, control, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), mode: 'onTouched',
    defaultValues: {
      name: role ? duplicate ? `${role.name} (bản sao)` : role.name : '',
      code: editing ? role?.code || '' : '', description: role?.description || '',
      allowedScreens: fixedAuthority ? [...fixedScreens] : editableRoleScreens(role),
      bookingScope: system ? 'all' : fixedAuthority ? 'none' : role?.bookingScope || 'none',
      bookingCanAssign: system ? true : fixedAuthority ? false : role?.bookingCanAssign || false,
      bookingCanReassign: system ? true : fixedAuthority ? false : role?.bookingCanReassign || false,
      bookingCanTransition: system ? true : fixedAuthority ? false : role?.bookingCanTransition || false,
      bookingCanCancel: system ? true : fixedAuthority ? false : role?.bookingCanCancel || false,
      bookingCanReschedule: system ? true : fixedAuthority ? false : role?.bookingCanReschedule || false,
      dealScope: system ? 'all' : fixedAuthority ? 'none' : role?.dealScope || 'none',
      dealCanCreate: system ? true : fixedAuthority ? false : role?.dealCanCreate || false,
      dealCanCreateDirect: system ? true : fixedAuthority ? false : role?.dealCanCreateDirect || false,
      dealCanManageContractDeposit: system ? true : fixedAuthority ? false : role?.dealCanManageContractDeposit || false,
      dealCanManageRentalSchedule: system ? true : fixedAuthority ? false : role?.dealCanManageRentalSchedule || false,
      dealCanManageLifecycle: system ? true : fixedAuthority ? false : role?.dealCanManageLifecycle || false,
    },
  });
  const bookingScope = watch('bookingScope');
  const dealScope = watch('dealScope');
  const bind = (name: 'name' | 'code' | 'description') => {
    const field = register(name);
    return { ...field, inputRef: field.ref, ref: undefined, error: Boolean(errors[name]), helperText: errors[name]?.message };
  };

  return (
    <Dialog open maxWidth="md" fullWidth onClose={isSubmitting ? undefined : onClose} aria-labelledby="role-editor-title">
      <Box component="form" noValidate aria-busy={isSubmitting} onSubmit={handleSubmit(async (values) => {
        try {
          const payload: RoleWrite = {
            name: values.name,
            code: values.code,
            description: values.description,
            allowedScreens: system ? ['*'] : fixedAuthority ? [...fixedScreens] : values.allowedScreens,
            bookingScope: system ? 'all' : fixedAuthority ? 'none' : values.bookingScope,
            bookingCanAssign: system ? true : fixedAuthority ? false : values.bookingCanAssign,
            bookingCanReassign: system ? true : fixedAuthority ? false : values.bookingCanReassign,
            bookingCanTransition: system ? true : fixedAuthority ? false : values.bookingCanTransition,
            bookingCanCancel: system ? true : fixedAuthority ? false : values.bookingCanCancel,
            bookingCanReschedule: system ? true : fixedAuthority ? false : values.bookingCanReschedule,
            dealScope: system ? 'all' : fixedAuthority ? 'none' : values.dealScope,
            dealCanCreate: system ? true : fixedAuthority ? false : values.dealCanCreate,
            dealCanCreateDirect: system ? true : fixedAuthority ? false : values.dealCanCreateDirect,
            dealCanManageContractDeposit: system ? true : fixedAuthority ? false : values.dealCanManageContractDeposit,
            dealCanManageRentalSchedule: system ? true : fixedAuthority ? false : values.dealCanManageRentalSchedule,
            dealCanManageLifecycle: system ? true : fixedAuthority ? false : values.dealCanManageLifecycle,
          };
          const result = editing && role ? await update.mutateAsync({ id: role.id, role: payload }) : await create.mutateAsync(payload);
          if (result.identityRefreshFailed) toast.warning('Đã lưu vai trò. Hãy tải lại trang để cập nhật phiên đăng nhập.');
          else toast.success(editing ? 'Đã cập nhật vai trò.' : 'Đã tạo vai trò.');
          onClose();
        } catch (error) {
          const failure = error as { status?: number; payload?: { details?: { path: string; message: string }[] } };
          const details = failure.payload?.details || [];
          for (const issue of details) {
            if (['name', 'code', 'description', 'allowedScreens', 'bookingScope', 'bookingCanAssign', 'bookingCanReassign', 'bookingCanTransition', 'bookingCanCancel', 'bookingCanReschedule', 'dealScope', 'dealCanCreate', 'dealCanCreateDirect', 'dealCanManageContractDeposit', 'dealCanManageRentalSchedule', 'dealCanManageLifecycle'].includes(issue.path)) {
              setError(issue.path as keyof Values, { message: issue.message }, { shouldFocus: true });
            }
          }
          if (failure.status === 409 && !details.length) setError('code', { message: 'Mã vai trò đã được sử dụng.' }, { shouldFocus: true });
          toast.error(roleErrorMessage(error));
        }
      })}>
        <DialogTitle id="role-editor-title">{editing ? 'Chỉnh sửa vai trò' : duplicate ? 'Nhân bản vai trò' : 'Tạo vai trò'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2 }}>
              <TextField {...bind('name')} label="Tên vai trò" required autoFocus disabled={isSubmitting} />
              <TextField {...bind('code')} label="Mã vai trò" required disabled={isSubmitting} placeholder="vi_du_vai_tro"
                slotProps={{ input: { readOnly: editing }, htmlInput: { autoCapitalize: 'none', spellCheck: false } }} />
              <TextField {...bind('description')} label="Mô tả" multiline minRows={2} disabled={isSubmitting} sx={{ gridColumn: '1 / -1' }} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
                <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>Quyền truy cập</Typography>
                {system && <Chip label="Toàn quyền quản trị" size="small" />}
                {fixedAuthority && <Chip label="Quyền nghiệp vụ cố định" size="small" color="info" variant="outlined" />}
              </Stack>
              <Controller name="allowedScreens" control={control} render={({ field }) => {
                const selected = field.value;
                return <>
                  <FormControlLabel label="Chọn tất cả" control={<Checkbox disabled={isSubmitting || authorityLocked}
                    checked={selected.length === CMS_ROLE_SCREENS.length} indeterminate={selected.length > 0 && selected.length < CMS_ROLE_SCREENS.length}
                    onChange={(_, checked) => field.onChange(checked ? CMS_ROLE_SCREENS.map((screen) => screen.code) : [])} />} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                    {screenGroups.map((group) => <Box component="fieldset" key={group.name} sx={{ m: 0, px: 2, py: 1, border: 1, borderColor: 'divider', borderRadius: 2, minWidth: 0 }}>
                      <Typography component="legend" variant="body2" sx={{ px: 0.75, fontWeight: 700 }}>{group.name}</Typography>
                      <Stack>{CMS_ROLE_SCREENS.filter((screen) => group.codes.includes(screen.code)).map((screen) => (
                        <FormControlLabel key={screen.code} label={screen.label} control={<Checkbox name={`${field.name}.${screen.code}`}
                          checked={selected.includes(screen.code)} disabled={isSubmitting || authorityLocked} onBlur={field.onBlur}
                          onChange={(_, checked) => field.onChange(checked ? [...selected, screen.code] : selected.filter((code) => code !== screen.code))} />} />
                      ))}</Stack>
                    </Box>)}
                  </Box>
                </>;
              }} />
              {errors.allowedScreens?.message && <FormHelperText error>{errors.allowedScreens.message}</FormHelperText>}
              {unsupported.length > 0 && <Typography variant="body2" color="warning.main" sx={{ mt: 1.5 }}>Quyền cũ sẽ bỏ khi lưu: {unsupported.join(', ')}.</Typography>}
            </Box>

            <Box component="fieldset" sx={{ m: 0, px: 2, py: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Typography component="legend" variant="body2" sx={{ px: 0.75, fontWeight: 700 }}>
                Chính sách Lịch xem phòng
              </Typography>
              <Stack spacing={1.5}>
                <Controller name="bookingScope" control={control} render={({ field }) => <TextField
                  {...field}
                  select
                  label="Phạm vi dữ liệu lịch xem"
                  disabled={isSubmitting || authorityLocked}
                  error={Boolean(errors.bookingScope)}
                  helperText={errors.bookingScope?.message || 'Không có / Toàn bộ / Chỉ lịch được phân cho tài khoản.'}
                >
                  <MenuItem value="none">Không có quyền dữ liệu lịch xem</MenuItem>
                  <MenuItem value="all">Xem toàn bộ lịch</MenuItem>
                  <MenuItem value="assigned">Chỉ lịch được phân cho mình</MenuItem>
                </TextField>} />
                <Controller name="bookingCanAssign" control={control} render={({ field }) => <FormControlLabel
                  label="Được phân công lịch chưa có người phụ trách"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || bookingScope !== 'all'} />}
                />} />
                <Controller name="bookingCanReassign" control={control} render={({ field }) => <FormControlLabel
                  label="Được giao lại hoặc gỡ người phụ trách"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || bookingScope !== 'all'} />}
                />} />
                <Controller name="bookingCanTransition" control={control} render={({ field }) => <FormControlLabel
                  label="Được cập nhật tiến trình trạng thái lịch xem"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || bookingScope === 'none'} />}
                />} />
                <Controller name="bookingCanCancel" control={control} render={({ field }) => <FormControlLabel
                  label="Được hủy lịch theo state machine"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || bookingScope === 'none'} />}
                />} />
                <Controller name="bookingCanReschedule" control={control} render={({ field }) => <FormControlLabel
                  label="Được đổi ngày/giờ lịch xem"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || bookingScope === 'none'} />}
                />} />
                {errors.bookingCanReassign?.message && <FormHelperText error>{errors.bookingCanReassign.message}</FormHelperText>}
                {errors.bookingCanTransition?.message && <FormHelperText error>{errors.bookingCanTransition.message}</FormHelperText>}
                {errors.bookingCanCancel?.message && <FormHelperText error>{errors.bookingCanCancel.message}</FormHelperText>}
                {errors.bookingCanReschedule?.message && <FormHelperText error>{errors.bookingCanReschedule.message}</FormHelperText>}
              </Stack>
            </Box>

            <Box component="fieldset" sx={{ m: 0, px: 2, py: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Typography component="legend" variant="body2" sx={{ px: 0.75, fontWeight: 700 }}>
                Chính sách Giao dịch thuê
              </Typography>
              <Stack spacing={1.5}>
                <Controller name="dealScope" control={control} render={({ field }) => <TextField
                  {...field}
                  select
                  label="Phạm vi giao dịch thuê"
                  disabled={isSubmitting || authorityLocked}
                  error={Boolean(errors.dealScope)}
                  helperText={errors.dealScope?.message || 'Không có / Toàn bộ / Chỉ giao dịch từ lịch xem được phân cho tài khoản.'}
                >
                  <MenuItem value="none">Không có quyền xem giao dịch</MenuItem>
                  <MenuItem value="all">Xem toàn bộ giao dịch</MenuItem>
                  <MenuItem value="assigned">Chỉ giao dịch từ lịch xem được phân cho mình</MenuItem>
                </TextField>} />
                <Controller name="dealCanCreate" control={control} render={({ field }) => <FormControlLabel
                  label="Được tạo giao dịch từ lịch xem"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || dealScope !== 'all'} />}
                />} />
                <Controller name="dealCanCreateDirect" control={control} render={({ field }) => <FormControlLabel
                  label="Được tạo giao dịch trực tiếp không cần lịch xem"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || dealScope !== 'all'} />}
                />} />
                <Controller name="dealCanManageContractDeposit" control={control} render={({ field }) => <FormControlLabel
                  label="Được cập nhật hợp đồng và tiền cọc"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || dealScope !== 'all'} />}
                />} />
                <Controller name="dealCanManageRentalSchedule" control={control} render={({ field }) => <FormControlLabel
                  label="Được cập nhật lịch thuê"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || dealScope !== 'all'} />}
                />} />
                <Controller name="dealCanManageLifecycle" control={control} render={({ field }) => <FormControlLabel
                  label="Được đổi căn / hủy giao dịch"
                  control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={isSubmitting || authorityLocked || dealScope !== 'all'} />}
                />} />
                {errors.dealCanCreate?.message && <FormHelperText error>{errors.dealCanCreate.message}</FormHelperText>}
                {errors.dealCanCreateDirect?.message && <FormHelperText error>{errors.dealCanCreateDirect.message}</FormHelperText>}
                {errors.dealCanManageContractDeposit?.message && <FormHelperText error>{errors.dealCanManageContractDeposit.message}</FormHelperText>}
                {errors.dealCanManageRentalSchedule?.message && <FormHelperText error>{errors.dealCanManageRentalSchedule.message}</FormHelperText>}
                {errors.dealCanManageLifecycle?.message && <FormHelperText error>{errors.dealCanManageLifecycle.message}</FormHelperText>}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button color="inherit" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
          <Button variant="contained" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo vai trò'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
