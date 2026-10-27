import { CmsBadge as Chip } from '../../../components/cms';
import { useState } from 'react';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { collaboratorWriteSchema } from '@tinyhouse/contracts';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { updateAutocompleteSearch, useStableAutocompleteOptions } from '../../../hooks/useStableAutocompleteOptions';
import { useBookingsPageQuery } from '../../bookings/api';
import { useUsersPageQuery } from '../../users/api';
import { useContactsPageQuery, useSaveContactMutation, type ContactKind } from '../api';
import type { ContactSummary } from '../contact.types';
import { contactErrorMessage, contactLabels, displayRecordedDate } from '../contactPresentation';

const formSchema = collaboratorWriteSchema.extend({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(160, 'Họ tên không quá 160 ký tự.'),
  phone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại.').max(50, 'Số điện thoại không quá 50 ký tự.'),
  email: z.string().trim().max(254, 'Email không quá 254 ký tự.').refine((value) => !value || z.email().safeParse(value).success, 'Email chưa đúng định dạng.'),
  address: z.string().trim().max(500, 'Địa chỉ không quá 500 ký tự.'),
  notes: z.string().trim().max(4000, 'Ghi chú không quá 4.000 ký tự.'),
  age: z.string().trim().refine((value) => !value || (/^\d+$/.test(value) && Number(value) <= 2_147_483_647), 'Tuổi phải là số nguyên không âm hợp lệ.'),
  sourceType: z.enum(['', 'website', 'ctv', 'ads', 'social', 'other']),
  sourceChannel: z.string().trim().max(120, 'Kênh nguồn không quá 120 ký tự.'),
  referredByCollaboratorId: z.string().trim().max(200),
  bookingIds: z.array(z.string()),
});
type Values = z.infer<typeof formSchema>;

export function ContactEditorDialog({ kind, contact, onClose }: { kind: ContactKind; contact?: ContactSummary; onClose: () => void }) {
  const labels = contactLabels[kind];
  const mutation = useSaveContactMutation(kind);
  const { register, handleSubmit, setError, control, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(formSchema), mode: 'onTouched',
    defaultValues: {
      name: contact?.name || '', phone: contact?.phone || '', email: contact?.email || '', address: contact?.address || '', notes: contact?.notes || '',
      age: contact && 'age' in contact && contact.age !== null ? String(contact.age) : '',
      userId: contact?.userId || '',
      sourceType: contact && 'sourceType' in contact ? (contact.sourceType as Values['sourceType']) || '' : '',
      sourceChannel: contact && 'sourceChannel' in contact ? contact.sourceChannel : '',
      referredByCollaboratorId: contact && 'referredByCollaboratorId' in contact ? contact.referredByCollaboratorId || '' : '',
      bookingIds: contact?.bookingIds || [],
    },
  });
  const bind = (name: keyof Values) => {
    const field = register(name);
    return { ...field, inputRef: field.ref, ref: undefined, error: Boolean(errors[name]), helperText: errors[name]?.message };
  };
  const recorded = contact && 'ageRecordedAt' in contact ? displayRecordedDate(contact.ageRecordedAt) : '';
  const sourceType = watch('sourceType');
  const linkedUserId = watch('userId');
  const referredCollaboratorId = watch('referredByCollaboratorId');
  const selectedBookingIds = watch('bookingIds') || [];
  const [userSearch, setUserSearch] = useState(contact?.userId || '');
  const [collaboratorSearch, setCollaboratorSearch] = useState(
    contact && 'referredByCollaboratorId' in contact ? contact.referredByCollaboratorId || '' : '',
  );
  const [bookingSearch, setBookingSearch] = useState('');
  const debouncedUserSearch = useDebouncedValue(userSearch, 300);
  const debouncedCollaboratorSearch = useDebouncedValue(collaboratorSearch, 300);
  const debouncedBookingSearch = useDebouncedValue(bookingSearch, 300);
  const usersQuery = useUsersPageQuery({
    page: 1,
    pageSize: 30,
    search: debouncedUserSearch,
    sort: 'name',
    order: 'asc',
  });
  const collaboratorsQuery = useContactsPageQuery('collaborators', {
    page: 1,
    pageSize: 30,
    search: debouncedCollaboratorSearch,
    archived: 'active',
    sort: 'name',
    order: 'asc',
  }, kind === 'customers');
  const bookingsQuery = useBookingsPageQuery({
    page: 1,
    pageSize: 30,
    search: debouncedBookingSearch,
    sort: 'createdAt',
    order: 'desc',
  });
  const userAutocomplete = useStableAutocompleteOptions(
    usersQuery.data?.items || [],
    linkedUserId ? [linkedUserId] : [],
    (user) => user.id,
  );
  const collaboratorAutocomplete = useStableAutocompleteOptions(
    collaboratorsQuery.data?.items || [],
    referredCollaboratorId ? [referredCollaboratorId] : [],
    (item) => item.id,
  );
  const bookingAutocomplete = useStableAutocompleteOptions(
    bookingsQuery.data?.items || [],
    selectedBookingIds,
    (booking) => booking.id,
  );
  const bookings = bookingAutocomplete.options;
  const lockedBookingIds = contact?.bookingIds || [];

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={isSubmitting ? undefined : onClose} aria-labelledby="contact-editor-title">
      <Box component="form" noValidate aria-busy={isSubmitting} onSubmit={handleSubmit(async (values) => {
        try {
          const common = {
            name: values.name, phone: values.phone, email: values.email, address: values.address, notes: values.notes,
            userId: values.userId ? values.userId : null,
            bookingIds: values.bookingIds || [],
          };
          await mutation.mutateAsync({
            id: contact?.id,
            data: kind === 'customers'
              ? {
                  ...common,
                  age: values.age === '' ? null : Number(values.age),
                  ...(!contact ? {
                    sourceType: values.sourceType || undefined,
                    sourceChannel: values.sourceChannel || undefined,
                    referredByCollaboratorId: values.referredByCollaboratorId || null,
                  } : {}),
                }
              : common,
          });
          toast.success(contact ? 'Đã cập nhật hồ sơ.' : `Đã thêm ${labels.singular}.`);
          onClose();
        } catch (error) {
          const details = (error as { payload?: { details?: { path: string; message: string }[] } })?.payload?.details || [];
          for (const issue of details) {
            if (['name', 'phone', 'email', 'address', 'notes', 'age', 'userId', 'sourceType', 'sourceChannel', 'referredByCollaboratorId', 'bookingIds'].includes(issue.path)) {
              setError(issue.path as keyof Values, { message: issue.message }, { shouldFocus: true });
            }
          }
          toast.error(contactErrorMessage(error));
        }
      })}>
        <DialogTitle id="contact-editor-title">{contact ? `Chỉnh sửa ${labels.singular}` : labels.create}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField {...bind('name')} label="Họ và tên" autoComplete="name" required autoFocus disabled={isSubmitting} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
              <TextField {...bind('phone')} label="Số điện thoại" type="tel" autoComplete="tel" required disabled={isSubmitting} sx={{ minWidth: 0 }} />
              <TextField {...bind('email')} label="Email" type="email" autoComplete="email" disabled={isSubmitting} sx={{ minWidth: 0 }} />
            </Box>
            {kind === 'customers' && <TextField {...bind('age')} label="Tuổi ghi nhận" disabled={isSubmitting}
              helperText={errors.age?.message || (recorded ? `Ghi nhận ngày ${recorded}` : undefined)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
            <Controller control={control} name="userId" render={({ field }) => {
              const options = userAutocomplete.options;
              return <Autocomplete
                options={options}
                value={options.find((user) => user.id === field.value) || null}
                onChange={(_, user) => {
                  userAutocomplete.rememberOption(user);
                  field.onChange(user?.id || '');
                }}
                onInputChange={(_, value, reason) => {
                  updateAutocompleteSearch(setUserSearch, value, reason);
                }}
                onBlur={field.onBlur}
                loading={usersQuery.isFetching}
                disabled={isSubmitting || usersQuery.isPending}
                getOptionLabel={(user) => `${user.name} · ${user.email}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText="Không tìm thấy tài khoản"
                renderInput={(params) => <TextField
                  {...params}
                  label="Tài khoản liên kết"
                  placeholder="Chưa liên kết · tìm theo tên hoặc email"
                  error={Boolean(errors.userId)}
                  helperText={errors.userId?.message || 'Liên kết thủ công; hệ thống không tự ghép theo email hoặc số điện thoại.'}
                />}
                sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
              />;
            }} />
            {kind === 'customers' && <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                <TextField {...bind('sourceType')} select label="Nguồn ban đầu" disabled={isSubmitting || Boolean(contact)}
                  helperText={contact ? 'Nguồn ban đầu được giữ nguyên sau khi hồ sơ đã được tạo.' : errors.sourceType?.message}>
                  <MenuItem value="">Chưa xác định</MenuItem>
                  <MenuItem value="website">Website</MenuItem>
                  <MenuItem value="ctv">CTV</MenuItem>
                  <MenuItem value="ads">Ads</MenuItem>
                  <MenuItem value="social">Social</MenuItem>
                  <MenuItem value="other">Khác</MenuItem>
                </TextField>
                <TextField {...bind('sourceChannel')} label="Kênh nguồn" placeholder="Facebook, TikTok, trang giới thiệu…" disabled={isSubmitting || Boolean(contact)}
                  helperText={contact ? 'Không tự ghi đè kênh nguồn đã ghi nhận.' : errors.sourceChannel?.message} />
              </Box>
              <Controller control={control} name="referredByCollaboratorId" render={({ field }) => {
                const options = collaboratorAutocomplete.options;
                return <Autocomplete
                  options={options}
                  value={options.find((item) => item.id === field.value) || null}
                  onChange={(_, item) => {
                    collaboratorAutocomplete.rememberOption(item);
                    field.onChange(item?.id || '');
                  }}
                  onInputChange={(_, value, reason) => {
                    updateAutocompleteSearch(setCollaboratorSearch, value, reason);
                  }}
                  onBlur={field.onBlur}
                  loading={collaboratorsQuery.isFetching}
                  disabled={isSubmitting || Boolean(contact) || sourceType !== 'ctv' || collaboratorsQuery.isPending}
                  getOptionLabel={(item) => `${item.name} · ${item.phone}`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  noOptionsText="Không tìm thấy CTV"
                  renderInput={(params) => <TextField
                    {...params}
                    label="CTV giới thiệu ban đầu"
                    placeholder="Chưa gắn CTV · tìm theo tên hoặc SĐT"
                    error={Boolean(errors.referredByCollaboratorId)}
                    helperText={contact ? 'CTV giới thiệu ban đầu được giữ nguyên.' : errors.referredByCollaboratorId?.message}
                  />}
                  sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
                />;
              }} />
            </>}
            <Controller control={control} name="bookingIds" render={({ field }) =>
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={[
                  ...bookings,
                  ...(field.value || [])
                    .filter((id) => !bookings.some((booking) => booking.id === id))
                    .map((id) => ({ id, customerName: 'Lịch xem đã liên kết', buildingCode: '', appointmentDate: null })),
                ]}
                value={[
                  ...bookings.filter((booking) => (field.value || []).includes(booking.id)),
                  ...(field.value || [])
                    .filter((id) => !bookings.some((booking) => booking.id === id))
                    .map((id) => ({ id, customerName: 'Lịch xem đã liên kết', buildingCode: '', appointmentDate: null })),
                ]}
                onChange={(_, selected) => {
                  for (const selectedBooking of selected) {
                    const realBooking = bookings.find((booking) => booking.id === selectedBooking.id);
                    bookingAutocomplete.rememberOption(realBooking);
                  }
                  field.onChange([
                    ...new Set([
                      ...lockedBookingIds,
                      ...selected.map((booking) => booking.id),
                    ]),
                  ]);
                }}
                onInputChange={(_, value, reason) => {
                  updateAutocompleteSearch(setBookingSearch, value, reason);
                }}
                onBlur={field.onBlur}
                loading={bookingsQuery.isFetching}
                disabled={isSubmitting || bookingsQuery.isPending}
                getOptionLabel={(booking) => `${booking.id} · ${booking.customerName || 'Khách'}${booking.buildingCode ? ` · ${booking.buildingCode}` : ''}${booking.appointmentDate ? ` · ${booking.appointmentDate}` : ''}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText="Không tìm thấy lịch xem"
                filterSelectedOptions
                renderValue={(value, getItemProps) => value.map((booking, index) => {
                  const itemProps = getItemProps({ index });
                  const { key, onDelete, ...chipProps } = itemProps;
                  const locked = lockedBookingIds.includes(booking.id);
                  return <Chip
                    key={key}
                    {...chipProps}
                    label={booking.id}
                    onDelete={locked ? undefined : onDelete}
                    title={locked ? 'Lịch xem đã ghi nhận nguồn - không thể gỡ tại đây' : undefined}
                  />;
                })}
                renderInput={(params) => <TextField
                  {...params}
                  label="Lịch xem liên kết"
                  placeholder="Tìm theo mã lịch, khách hoặc tòa nhà"
                  error={Boolean(errors.bookingIds)}
                  helperText={errors.bookingIds?.message || 'Có thể thêm lịch chưa liên kết. Các lịch đã ghi nhận nguồn không thể gỡ hoặc chuyển sang hồ sơ khác tại đây.'}
                />}
                sx={{
                  minWidth: 0,
                  '& .MuiAutocomplete-inputRoot': {
                    minHeight: '44px !important',
                    height: 'auto !important',
                    maxHeight: 'none',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    overflow: 'visible',
                    columnGap: 0.75,
                    rowGap: 0.75,
                    pt: '10px !important',
                    pb: '6px !important',
                    pr: '34px !important',
                  },
                  '& .MuiAutocomplete-input': {
                    minWidth: '120px !important',
                    width: 'auto !important',
                    flex: '1 1 120px !important',
                    py: '2px !important',
                  },
                  '& .MuiChip-root': {
                    height: 30,
                    maxWidth: '100%',
                    margin: '0 !important',
                  },
                }}
              />} />
            <TextField {...bind('address')} label="Địa chỉ" autoComplete="street-address" disabled={isSubmitting} />
            <TextField {...bind('notes')} label="Ghi chú" multiline minRows={3} disabled={isSubmitting} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button color="inherit" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
          <Button variant="contained" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu…' : contact ? 'Lưu thay đổi' : labels.create}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
