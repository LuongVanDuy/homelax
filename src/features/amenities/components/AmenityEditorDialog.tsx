import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { amenityWriteSchema, type Amenity, type AmenityCategory, type AmenityScope } from '@tinyhouse/contracts';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { toast } from '../../../lib/toast';
import { useSaveAmenityMutation } from '../api';
import { AMENITY_CATEGORY_LABELS, amenityErrorMessage, categoryOptions, scopeLabel } from '../amenityPresentation';

const schema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên tiện ích.').max(160),
  category: z.string().min(1, 'Vui lòng chọn nhóm tiện ích.'),
});

type Values = z.infer<typeof schema>;

export function AmenityEditorDialog({
  scope,
  amenity,
  onClose,
}: {
  scope: AmenityScope;
  amenity?: Amenity;
  onClose: () => void;
}) {
  const save = useSaveAmenityMutation();
  const categories = categoryOptions(scope);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: amenity?.name || '',
      category: amenity?.category || categories[0],
    },
  });
  const busy = isSubmitting || save.isPending;

  return <Dialog
    open
    fullWidth
    maxWidth="sm"
    onClose={busy ? undefined : onClose}
    aria-labelledby="amenity-editor-title"
  >
    <Box component="form" onSubmit={handleSubmit(async (values) => {
      try {
        const payload = amenityWriteSchema.parse({
          name: values.name,
          scope,
          category: values.category as AmenityCategory,
          sortOrder: amenity?.sortOrder ?? 0,
        });
        await save.mutateAsync({ id: amenity?.id, data: payload });
        toast.success(amenity ? 'Đã cập nhật tiện ích.' : 'Đã thêm tiện ích.');
        onClose();
      } catch (error) {
        toast.error(amenityErrorMessage(error));
      }
    })}>
      <DialogTitle id="amenity-editor-title" sx={{ pr: 6 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {amenity ? 'Chỉnh sửa tiện ích' : 'Thêm tiện ích'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {scopeLabel(scope)}
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

      <DialogContent dividers>
        <Stack spacing={2.25}>
          <TextField
            {...register('name')}
            label="Tên tiện ích"
            required
            autoFocus
            disabled={busy}
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
          />
          <Controller control={control} name="category" render={({ field }) => <TextField
            {...field}
            select
            label="Nhóm tiện ích"
            disabled={busy}
            error={Boolean(errors.category)}
            helperText={errors.category?.message}
          >
            {categories.map((category) => <MenuItem key={category} value={category}>
              {AMENITY_CATEGORY_LABELS[category]}
            </MenuItem>)}
          </TextField>} />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>Hủy</Button>
        <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu tiện ích'}</Button>
      </DialogActions>
    </Box>
  </Dialog>;
}
