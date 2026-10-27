import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { DEFAULT_SCHOOL_RADIUS_KM, schoolWriteSchema, type School } from '@tinyhouse/contracts';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { BuildingMapField } from '../../buildings/components/BuildingMapField';
import { toast } from '../../../lib/toast';
import { useSaveSchoolMutation } from '../api';
import { schoolErrorMessage } from '../schoolPresentation';

type SchoolFormValues = z.input<typeof schoolWriteSchema>;

export function SchoolEditorDialog({
  school,
  onClose,
}: {
  school?: School;
  onClose: () => void;
}) {
  const save = useSaveSchoolMutation();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolWriteSchema),
    defaultValues: {
      name: school?.name || '',
      campus: school?.campus || '',
      address: school?.address || '',
      latitude: school?.latitude ?? null,
      longitude: school?.longitude ?? null,
      radiusKm: school?.radiusKm ?? null,
    },
  });
  const values = watch();
  const busy = isSubmitting || save.isPending;

  return <Dialog
    open
    fullWidth
    maxWidth="md"
    onClose={busy ? undefined : onClose}
    aria-labelledby="school-editor-title"
  >
    <Box
      component="form"
      onSubmit={handleSubmit(async (values) => {
        try {
          const payload = schoolWriteSchema.parse(values);
          await save.mutateAsync({ id: school?.id, data: payload });
          toast.success(school ? 'Đã cập nhật trường học.' : 'Đã thêm trường học.');
          onClose();
        } catch (error) {
          toast.error(schoolErrorMessage(error));
        }
      })}
    >
      <DialogTitle id="school-editor-title" sx={{ pr: 6 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {school ? 'Chỉnh sửa trường học' : 'Thêm trường học'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Danh mục phục vụ dữ liệu vị trí và bộ lọc gần trường.
          </Typography>
        </Box>
        <IconButton
          aria-label="Đóng"
          onClick={onClose}
          disabled={busy}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ maxHeight: 'min(76vh, 760px)' }}>
        <Stack spacing={2}>
          <TextField
            {...register('name')}
            label="Tên trường"
            required
            autoFocus
            disabled={busy}
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
          />

          <TextField
            {...register('campus')}
            label="Cơ sở"
            placeholder="Ví dụ: Cơ sở Xuân Thủy"
            disabled={busy}
            error={Boolean(errors.campus)}
            helperText={errors.campus?.message}
          />

          <TextField
            {...register('address')}
            label="Địa chỉ"
            required
            disabled={busy}
            error={Boolean(errors.address)}
            helperText={errors.address?.message}
          />

          <BuildingMapField
            address={values.address || ''}
            ward=""
            latitude={values.latitude == null ? '' : String(values.latitude)}
            longitude={values.longitude == null ? '' : String(values.longitude)}
            disabled={busy}
            onCoordinateChange={(latitude, longitude) => {
              setValue(
                'latitude',
                latitude === '' ? null : Number(latitude),
                { shouldDirty: true, shouldValidate: true },
              );
              setValue(
                'longitude',
                longitude === '' ? null : Number(longitude),
                { shouldDirty: true, shouldValidate: true },
              );
            }}
          />

          {(errors.latitude || errors.longitude) && <Typography variant="caption" color="error">
            {errors.latitude?.message || errors.longitude?.message}
          </Typography>}

          <Controller
            control={control}
            name="radiusKm"
            render={({ field }) => <TextField
              label={`Bán kính gần trường (km) · mặc định ${DEFAULT_SCHOOL_RADIUS_KM}`}
              type="number"
              value={field.value ?? ''}
              onChange={(event) => field.onChange(
                event.target.value === '' ? null : Number(event.target.value),
              )}
              onBlur={field.onBlur}
              disabled={busy}
              error={Boolean(errors.radiusKm)}
              helperText={errors.radiusKm?.message}
              slotProps={{ htmlInput: { min: 0.1, max: 100, step: 0.1 } }}
            />}
          />

          <Typography variant="caption" color="text.secondary">
            Có thể để trống bán kính để dùng mặc định 3 km. Tọa độ phải là vị trí thật của từng cơ sở; hệ thống không suy vị trí từ phường, tên trường hoặc từ khóa.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>Hủy</Button>
        <Button type="submit" variant="contained" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu trường học'}
        </Button>
      </DialogActions>
    </Box>
  </Dialog>;
}
