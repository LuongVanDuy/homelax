import { CmsPageHeader } from '../../../components/cms';
import { Box, Button, Divider, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowLeft, Building2, Images, MapPin, Save, Sparkles, UserRound, View } from 'lucide-react';
import { buildingWriteSchema, media360ListSchema } from '@tinyhouse/contracts';
import { useNavigate } from 'react-router';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { toast } from '../../../lib/toast';
import { AmenityMultiSelect } from '../../amenities/components/AmenityMultiSelect';
import { Media360Field } from '../../inventory/components/Media360Field';
import { useBuildingQuery, useSaveBuildingMutation } from '../api';
import { buildingErrorMessage } from '../buildingPresentation';
import type { BuildingRecord } from '../building.types';
import { BuildingImageGalleryField } from '../components/BuildingImageGalleryField';
import { BuildingMapField } from '../components/BuildingMapField';
import { HanoiWardSelect } from '../../locations/components/HanoiWardSelect';
import { HANOI_CITY } from '../../locations/hanoiWards';

const formSchema = z.object({
  code: z.string().trim().max(80),
  name: z.string().trim().min(1, 'Vui lòng nhập tên tòa nhà.').max(200),
  ownerType: z.enum(['tiny', 'partner']),
  address: z.string().trim().min(1, 'Vui lòng nhập địa chỉ tòa nhà.').max(500),
  ward: z.string().trim().max(160),
  latitude: z.string().trim(),
  longitude: z.string().trim(),
  hostName: z.string().trim().min(1, 'Vui lòng nhập tên chủ nhà/người quản lý.').max(160),
  hostPhone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại.').max(50),
  hostEmail: z.string().trim().refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'Email không hợp lệ.',
  ),
  hostAddress: z.string().trim().min(1, 'Vui lòng nhập địa chỉ chủ nhà.').max(500),
  images: z.array(z.string()).max(25),
  media360: media360ListSchema,
  amenityIds: z.array(z.string()),
}).superRefine((value, context) => {
  const hasLat = value.latitude !== '';
  const hasLng = value.longitude !== '';
  if (hasLat !== hasLng) {
    context.addIssue({
      code: 'custom',
      path: hasLat ? ['longitude'] : ['latitude'],
      message: 'Vĩ độ và kinh độ phải nhập cùng nhau.',
    });
  }
  if (hasLat) {
    const lat = Number(value.latitude);
    const lng = Number(value.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      context.addIssue({ code: 'custom', path: ['latitude'], message: 'Vĩ độ không hợp lệ.' });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      context.addIssue({ code: 'custom', path: ['longitude'], message: 'Kinh độ không hợp lệ.' });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', height: '100%' }}>
    <Stack direction="row" spacing={1.25} sx={{ px: { xs: 1.75, sm: 2 }, py: 1.25, alignItems: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 1.75, bgcolor: 'action.hover' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
      </Box>
    </Stack>
    <Divider />
    <Box sx={{ p: { xs: 1.75, sm: 2 } }}>{children}</Box>
  </Paper>;
}

function BuildingEditorForm({ building }: { building?: BuildingRecord }) {
  const navigate = useNavigate();
  const mutation = useSaveBuildingMutation();
  const editing = Boolean(building);
  const { register, control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: building?.code || '',
      name: building?.name || '',
      ownerType: building?.ownerType || 'tiny',
      address: building?.address || '',
      ward: building?.ward || '',
      latitude: building?.latitude == null ? '' : String(building.latitude),
      longitude: building?.longitude == null ? '' : String(building.longitude),
      hostName: building?.hostName || '',
      hostPhone: building?.hostPhone || '',
      hostEmail: building?.hostEmail || '',
      hostAddress: building?.hostAddress || '',
      images: building?.images || [],
      media360: building?.media360 || [],
      amenityIds: building?.amenityIds || [],
    },
  });
  const values = watch();
  const busy = isSubmitting || mutation.isPending;

  const bind = (name: Exclude<keyof FormValues, 'ownerType' | 'images' | 'media360' | 'amenityIds'>) => {
    const field = register(name);
    return {
      ...field,
      inputRef: field.ref,
      ref: undefined,
      error: Boolean(errors[name]),
      helperText: errors[name]?.message,
    };
  };

  const cancel = () => navigate('/cms/buildings');

  return <Box
    component="form"
    sx={{
      '& .MuiInputBase-root': { minHeight: 44 },
      '& .MuiFormHelperText-root': { mt: 0.5 },
      '& .MuiInputLabel-root': { fontSize: 14 },
    }}
    onSubmit={handleSubmit(async (form) => {
    try {
      const payload = buildingWriteSchema.parse({
        ...(building ? { id: building.id } : {}),
        code: form.code || undefined,
        name: form.name,
        ownerType: form.ownerType,
        isTiny: form.ownerType === 'tiny',
        address: form.address,
        city: HANOI_CITY,
        province: HANOI_CITY,
        ward: form.ward,
        ...(form.latitude !== '' && form.longitude !== ''
          ? { latitude: Number(form.latitude), longitude: Number(form.longitude) }
          : {}),
        hostName: form.hostName,
        hostPhone: form.hostPhone,
        hostEmail: form.hostEmail,
        hostAddress: form.hostAddress,
        images: form.images,
        media360: form.media360,
        coverImage: form.images[0] || '',
        amenityIds: form.amenityIds,
      });
      await mutation.mutateAsync({ id: building?.id, data: payload });
      toast.success(building ? 'Đã cập nhật tòa nhà.' : 'Đã tạo tòa nhà.');
      navigate('/cms/buildings');
    } catch (error) {
      toast.error(buildingErrorMessage(error));
    }
  })}>
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button color="inherit" startIcon={<ArrowLeft size={18} />} onClick={cancel}>Quay lại</Button>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
          <CmsPageHeader title={editing ? 'Chỉnh sửa tòa nhà' : 'Thêm tòa nhà'} description={editing ? `${building?.name} · ${building?.code}` : 'Nhập đầy đủ thông tin tòa nhà, vị trí, chủ nhà và hình ảnh.'} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={cancel} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="contained" startIcon={<Save size={18} />} disabled={busy}>
            {busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tòa nhà'}
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '5fr 7fr' }, alignItems: 'stretch' }}>
        <SectionCard icon={<Building2 size={18} />} title="Thông tin tòa nhà" description="Thông tin định danh và loại hình.">
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 2fr) minmax(140px, 1fr)' } }}>
            <TextField {...bind('name')} label="Tên tòa nhà" required autoFocus disabled={busy} />
            <TextField {...bind('code')} label="Mã tòa" placeholder="Hệ thống tự sinh" disabled={busy || editing} />
            <Controller name="ownerType" control={control} render={({ field }) =>
              <TextField {...field} select fullWidth label="Loại hình" disabled={busy} sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <MenuItem value="tiny">Tòa Homelax</MenuItem>
                <MenuItem value="partner">Tòa đối tác</MenuItem>
              </TextField>
            } />
          </Box>
        </SectionCard>

        <SectionCard icon={<UserRound size={18} />} title="Chủ nhà / người quản lý" description="Thông tin liên hệ nội bộ.">
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1.4fr) minmax(150px, .8fr)', lg: 'minmax(0, 1.4fr) 180px minmax(0, 1.2fr)' } }}>
            <TextField {...bind('hostName')} label="Họ tên" required disabled={busy} />
            <TextField {...bind('hostPhone')} label="Số điện thoại" required disabled={busy} />
            <TextField {...bind('hostEmail')} label="Email" type="email" disabled={busy} sx={{ gridColumn: { xs: '1', sm: '1 / -1', lg: 'auto' } }} />
            <TextField {...bind('hostAddress')} label="Địa chỉ chủ nhà / người quản lý" required disabled={busy}
              sx={{ gridColumn: { xs: '1', sm: '1 / -1', lg: '1 / -1' } }} />
          </Box>
        </SectionCard>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 3fr) minmax(0, 2fr)' }, alignItems: 'stretch' }}>
        <SectionCard icon={<MapPin size={18} />} title="Địa chỉ & bản đồ" description="Địa chỉ tại Hà Nội và vị trí thực tế.">
          <Stack spacing={2}>
            <Stack spacing={1.5}>
              <TextField {...bind('address')} label="Địa chỉ tòa nhà" required disabled={busy} />
              <Controller name="ward" control={control} render={({ field }) => <HanoiWardSelect
                label="Phường / xã" allLabel="Chọn phường / xã" value={field.value}
                onChange={value => field.onChange(value === 'all' ? '' : value)} onBlur={field.onBlur} inputRef={field.ref}
                disabled={busy} error={Boolean(errors.ward)} helperText={errors.ward?.message}
              />} />
              {(errors.latitude || errors.longitude) && <Typography variant="caption" color="error">
                {errors.latitude?.message || errors.longitude?.message}
              </Typography>}
            </Stack>
            <BuildingMapField
              address={values.address}
              ward={values.ward}
              latitude={values.latitude}
              longitude={values.longitude}
              disabled={busy}
              onCoordinateChange={(latitude, longitude) => {
                setValue('latitude', latitude, { shouldDirty: true, shouldValidate: true });
                setValue('longitude', longitude, { shouldDirty: true, shouldValidate: true });
              }}
            />
          </Stack>
        </SectionCard>

        <SectionCard icon={<Images size={18} />} title="Album ảnh" description="Ảnh đầu tiên là ảnh bìa.">
          <BuildingImageGalleryField
            images={values.images}
            disabled={busy}
            onChange={(images) => setValue('images', images, { shouldDirty: true, shouldValidate: true })}
          />
        </SectionCard>

      </Box>

      <SectionCard icon={<View size={18} />} title="Media 360°" description="Ảnh toàn cảnh hoặc liên kết tour 360°, lưu riêng với ảnh tĩnh.">
        <Media360Field
          label="Media 360° của tòa nhà"
          value={values.media360 || []}
          disabled={busy}
          onChange={(media360) => setValue('media360', media360, { shouldDirty: true, shouldValidate: true })}
        />
      </SectionCard>

      <SectionCard icon={<Sparkles size={18} />} title="Tiện ích tòa nhà" description="Chọn nhanh theo 4 nhóm tiện ích.">
        <Controller name="amenityIds" control={control} render={({ field }) => <AmenityMultiSelect
          scope="building"
          value={field.value || []}
          onChange={field.onChange}
          disabled={busy}
          label="Tiện ích của tòa nhà"
        />} />
      </SectionCard>

      <Paper
        elevation={3}
        sx={{
          position: 'sticky',
          bottom: 12,
          zIndex: 5,
          px: { xs: 1.5, sm: 2 },
          py: 1,
          borderRadius: 2.5,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button color="inherit" onClick={cancel} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="contained" startIcon={<Save size={18} />} disabled={busy}>
            {busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tòa nhà'}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  </Box>;
}

export function BuildingEditorPage({ buildingId }: { buildingId?: string }) {
  const editing = Boolean(buildingId);
  const buildingQuery = useBuildingQuery(buildingId, 'cms');

  if (editing && buildingQuery.isPending) {
    return <LoadingState label="Đang tải thông tin tòa nhà…" minHeight={360} />;
  }
  if (editing && buildingQuery.isError) {
    return <ErrorState
      title="Không tải được tòa nhà"
      description="Tòa nhà không tồn tại hoặc bạn không có quyền truy cập."
      action={<Button color="inherit" onClick={() => void buildingQuery.refetch()}>Thử lại</Button>}
    />;
  }

  return <BuildingEditorForm key={buildingId || 'new'} building={buildingQuery.data || undefined} />;
}
