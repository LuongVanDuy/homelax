import { CmsPageHeader } from '../../../components/cms';
import { Alert, Autocomplete, Box, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowLeft, Building2, DoorOpen, Images, Save, Sparkles, View } from 'lucide-react';
import { media360ListSchema, roomTypeWriteSchema, roomUnitWriteSchema, type RoomType } from '@tinyhouse/contracts';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Controller, useForm, z, zodResolver } from '../../../app/forms';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { updateAutocompleteSearch, useStableAutocompleteOptions } from '../../../hooks/useStableAutocompleteOptions';
import { AmenityMultiSelect } from '../../amenities/components/AmenityMultiSelect';
import { Media360Field } from '../../inventory/components/Media360Field';
import { useBuildingQuery, useBuildingsPageQuery } from '../../buildings/api';
import { useCreateRoomUnitMutation, useDeleteRoomUnitMutation, useRoomQuery, useSaveRoomMutation, useUpdateRoomUnitMutation } from '../api';
import { roomErrorMessage } from '../roomPresentation';
import { RoomDescriptionEditor } from '../components/RoomDescriptionEditor';
import { normalizeRoomDescription } from '../roomDescription';
import { RoomImageGalleryField } from '../components/RoomImageGalleryField';
import { RoomUnitsEditor, type UnitDraft } from '../components/RoomUnitsEditor';
import { useRoomTypeCatalogPageQuery } from '../../room-types/api';
import { ROOM_AUDIENCES, roomAudienceGroupsSchema } from '@tinyhouse/contracts';

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
  return <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
    <Stack direction="row" spacing={1.25} sx={{ px: 2, py: 1.25, alignItems: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 1.75, bgcolor: 'action.hover' }}>{icon}</Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
      </Box>
    </Stack>
    <Divider />
    <Box sx={{ p: { xs: 1.75, sm: 2 } }}>{children}</Box>
  </Paper>;
}

const formSchema = z.object({
  buildingId: z.string().min(1, 'Vui lòng chọn tòa nhà.'),
  buildingCode: z.string(),
  roomTypeCatalogId: z.string().min(1, 'Vui lòng chọn loại phòng.'),
  price: z.number().finite().nonnegative('Giá không được âm.'),
  area: z.number().finite().positive('Diện tích phải lớn hơn 0.'),
  maxOccupants: z.number().int().positive('Số người phải lớn hơn 0.'),
  coverImage: z.string(),
  images: z.array(z.string()).max(25),
  media360: media360ListSchema,
  description: z.string().max(10000),
  amenityIds: z.array(z.string()),
  audienceGroups: roomAudienceGroupsSchema,
});

type FormValues = z.infer<typeof formSchema>;

function toDrafts(room?: RoomType): UnitDraft[] {
  return (room?.roomUnits || []).map((unit) => ({
    localId: unit.id,
    persistedId: unit.id,
    code: unit.code,
    status: unit.status,
    availableFrom: unit.availableFrom,
  }));
}

function RoomEditorForm({ room }: { room?: RoomType }) {
  const navigate = useNavigate();
  const saveRoom = useSaveRoomMutation();
  const createUnit = useCreateRoomUnitMutation();
  const updateUnit = useUpdateRoomUnitMutation();
  const deleteUnit = useDeleteRoomUnitMutation();
  const editing = Boolean(room);
  const [units, setUnits] = useState<UnitDraft[]>(() => toDrafts(room));
  const [buildingSearch, setBuildingSearch] = useState('');
  const originalIds = useMemo(() => new Set((room?.roomUnits || []).map((unit) => unit.id)), [room?.roomUnits]);
  const debouncedBuildingSearch = useDebouncedValue(buildingSearch, 300);
  const buildingsQuery = useBuildingsPageQuery({
    scope: 'cms',
    page: 1,
    pageSize: 30,
    search: debouncedBuildingSearch,
    status: 'active',
    sort: 'name',
    order: 'asc',
  });
  const currentBuildingQuery = useBuildingQuery(room?.buildingId, 'cms');
  const activeCatalogQuery = useRoomTypeCatalogPageQuery({
    page: 1, pageSize: 500, status: 'active', sort: 'sortOrder', order: 'asc',
  });
  const currentCatalogQuery = useRoomTypeCatalogPageQuery({
    page: 1, pageSize: 20, ids: room?.roomTypeCatalogId || '', status: '', sort: 'sortOrder', order: 'asc',
  }, Boolean(room?.roomTypeCatalogId));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      buildingId: room?.buildingId || '',
      buildingCode: room?.buildingCode || '',
      roomTypeCatalogId: room?.roomTypeCatalogId || '',
      price: room?.price || 0,
      area: room?.area || 25,
      maxOccupants: room?.maxOccupants || 2,
      coverImage: room?.coverImage || '',
      images: room?.images || [],
      media360: room?.media360 || [],
      description: room?.description || '',
      amenityIds: room?.amenityIds || [],
      audienceGroups: room?.audienceGroups || [],
    },
  });

  const images = watch('images') || [];
  const media360 = watch('media360') || [];
  const selectedBuildingId = watch('buildingId') || '';
  const busy =
    isSubmitting ||
    saveRoom.isPending ||
    createUnit.isPending ||
    updateUnit.isPending ||
    deleteUnit.isPending;

  const buildings = useMemo(() => {
    const pageItems = buildingsQuery.data?.items || [];
    const current = currentBuildingQuery.data;
    return current && !pageItems.some((building) => building.id === current.id)
      ? [current, ...pageItems]
      : pageItems;
  }, [buildingsQuery.data?.items, currentBuildingQuery.data]);
  const buildingAutocomplete = useStableAutocompleteOptions(
    buildings,
    selectedBuildingId ? [selectedBuildingId] : [],
    (building) => building.id,
  );
  const buildingOptions = buildingAutocomplete.options;
  const selectedBuilding = buildingOptions.find((building) => building.id === selectedBuildingId);
  const canChangeBuilding = !editing || Number(room?.totalUnits || 0) === 0;
  const selectedCatalogId = watch('roomTypeCatalogId') || '';
  const catalogOptions = useMemo(() => {
    const active = activeCatalogQuery.data?.items || [];
    const current = currentCatalogQuery.data?.items?.[0];
    return current && !active.some(item => item.id === current.id) ? [current, ...active] : active;
  }, [activeCatalogQuery.data?.items, currentCatalogQuery.data?.items]);

  const cancel = () => navigate('/cms/rooms');

  const submit = handleSubmit(async (values) => {
    let savedRoomTypeId = room?.id || '';
    try {
      const parsedUnits = units.map((unit) => ({
        localId: unit.localId,
        persistedId: unit.persistedId,
        data: roomUnitWriteSchema.parse({
          code: unit.code,
          status: unit.status,
          availableFrom: unit.availableFrom || null,
        }),
      }));

      const payload = roomTypeWriteSchema.parse({
        ...values,
        buildingId: selectedBuildingId,
        buildingCode: selectedBuilding?.code || values.buildingCode || '',
        coverImage: images[0] || '',
        images,
        media360,
        description: normalizeRoomDescription(values.description),
      });

      const saved = await saveRoom.mutateAsync({
        id: room?.id,
        data: payload,
      });
      savedRoomTypeId = saved.id;

      if (room?.lifecycleStatus !== 'archived') {
        const keptIds = new Set(parsedUnits.flatMap((unit) => unit.persistedId ? [unit.persistedId] : []));
        for (const existingId of originalIds) {
          if (!keptIds.has(existingId)) {
            await deleteUnit.mutateAsync({
              roomTypeId: saved.id,
              unitId: existingId,
            });
          }
        }

        for (const unit of parsedUnits) {
          if (unit.persistedId) {
            await updateUnit.mutateAsync({
              roomTypeId: saved.id,
              unitId: unit.persistedId,
              data: unit.data,
            });
          } else {
            await createUnit.mutateAsync({
              roomTypeId: saved.id,
              data: unit.data,
            });
          }
        }
      }

      toast.success(editing ? 'Đã cập nhật loại phòng.' : 'Đã tạo loại phòng.');
      navigate('/cms/rooms');
    } catch (error) {
      if (!editing && savedRoomTypeId) {
        navigate(`/cms/rooms/${encodeURIComponent(savedRoomTypeId)}/edit`, { replace: true });
      }
      toast.error(roomErrorMessage(error));
    }
  });

  return <Box component="form" onSubmit={submit} sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}>
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Button color="inherit" startIcon={<ArrowLeft size={18} />} onClick={cancel}>Quay lại</Button>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
          <CmsPageHeader title={editing ? 'Chỉnh sửa loại phòng' : 'Thêm loại phòng'} description={editing ? `${room?.type} · ${room?.buildingCode}` : 'Thông tin loại phòng và từng căn vật lý.'} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={cancel} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="contained" startIcon={<Save size={18} />} disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </Stack>
      </Stack>

      {room?.lifecycleStatus === 'archived' && <Alert severity="warning">
        Loại phòng đang lưu trữ. Có thể sửa thông tin loại phòng, nhưng hãy khôi phục trước khi thay đổi danh sách căn.
      </Alert>}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '5fr 7fr' } }}>
        <SectionCard icon={<Building2 size={18} />} title="Room Type" description="Tòa nhà, loại phòng chuẩn và thông số niêm yết.">
          <Stack spacing={1.5}>
            <Controller name="buildingId" control={control} render={({ field }) => <Autocomplete
              options={buildingOptions}
              value={buildingOptions.find((building) => building.id === field.value) || null}
              onChange={(_, building) => {
                buildingAutocomplete.rememberOption(building);
                field.onChange(building?.id || '');
                setValue('buildingCode', building?.code || '', { shouldDirty: true });
              }}
              onInputChange={(_, value, reason) => {
                updateAutocompleteSearch(setBuildingSearch, value, reason);
              }}
              onBlur={field.onBlur}
              loading={buildingsQuery.isFetching}
              disabled={busy || !canChangeBuilding || buildingsQuery.isPending}
              getOptionLabel={(building) => `${building.code} · ${building.name}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="Không tìm thấy tòa nhà"
              renderInput={(params) => <TextField
                {...params}
                label="Tòa nhà"
                required
                error={Boolean(errors.buildingId)}
                helperText={!canChangeBuilding ? 'Đã có căn vật lý nên không thể đổi tòa.' : errors.buildingId?.message}
              />}
            />} />
            <Controller name="roomTypeCatalogId" control={control} render={({ field }) => <Autocomplete
              options={catalogOptions}
              value={catalogOptions.find(item => item.id === field.value) || null}
              onChange={(_, item) => field.onChange(item?.id || '')}
              onBlur={field.onBlur}
              loading={activeCatalogQuery.isFetching || currentCatalogQuery.isFetching}
              disabled={busy || activeCatalogQuery.isPending}
              getOptionLabel={item => item.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              getOptionDisabled={item => item.status === 'archived' && item.id !== selectedCatalogId}
              noOptionsText="Chưa có loại phòng đang hoạt động"
              renderOption={(props, item) => {
                const { key, ...rest } = props;
                return <li key={key} {...rest}>
                  <Stack direction="row" sx={{ width: '100%', justifyContent: 'space-between', gap: 1 }}>
                    <span>{item.name}</span>
                    {item.status === 'archived' && <Typography component="span" variant="caption" color="text.secondary">Đã lưu trữ</Typography>}
                  </Stack>
                </li>;
              }}
              renderInput={params => <TextField {...params} label="Loại phòng" required
                error={Boolean(errors.roomTypeCatalogId)}
                helperText={room?.roomTypeCatalogStatus === 'archived'
                  ? 'Loại phòng hiện tại đã lưu trữ. Có thể giữ nguyên hoặc chọn loại đang hoạt động.'
                  : errors.roomTypeCatalogId?.message || 'Danh mục được quản lý tại Phòng → Loại phòng.'} />}
            />} />
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
              <TextField
                {...register('area', { valueAsNumber: true })}
                type="number"
                label="Diện tích (m²)"
                disabled={busy}
                error={Boolean(errors.area)}
                helperText={errors.area?.message}
                slotProps={{ htmlInput: { min: 1, step: 0.1 } }}
              />
              <TextField
                {...register('maxOccupants', { valueAsNumber: true })}
                type="number"
                label="Tối đa người"
                disabled={busy}
                error={Boolean(errors.maxOccupants)}
                helperText={errors.maxOccupants?.message}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
              />
            </Box>
            <TextField
              {...register('price', { valueAsNumber: true })}
              type="number"
              label="Giá niêm yết / tháng"
              disabled={busy}
              error={Boolean(errors.price)}
              helperText={errors.price?.message}
              slotProps={{ htmlInput: { min: 0, step: 100000 } }}
            />
            <Controller name="audienceGroups" control={control} render={({ field }) => <Autocomplete multiple
              options={ROOM_AUDIENCES.map(item => item.value)} value={field.value} disabled={busy}
              getOptionLabel={value => ROOM_AUDIENCES.find(item => item.value === value)?.label || value}
              onChange={(_, value) => field.onChange(value)} onBlur={field.onBlur}
              renderInput={params => <TextField {...params} inputRef={field.ref} label="Nhóm khách phù hợp"
                error={Boolean(errors.audienceGroups)} helperText={errors.audienceGroups?.message || 'Chọn nhóm phù hợp với loại phòng này. Có thể chọn nhiều nhóm.'} />} />}
            />
          </Stack>
        </SectionCard>

        <SectionCard icon={<DoorOpen size={18} />} title="Căn vật lý & khả dụng" description="Mã căn, trạng thái và ngày dự kiến trống.">
          <RoomUnitsEditor
            units={units}
            disabled={busy}
            readOnly={room?.lifecycleStatus === 'archived'}
            onChange={setUnits}
          />
        </SectionCard>
      </Box>

      <SectionCard icon={<Images size={18} />} title="Nội dung & hình ảnh" description="Mô tả và album dùng chung cho loại phòng.">
        <Stack spacing={1.5}>
          <Controller
            name="description"
            control={control}
            render={({ field }) => <RoomDescriptionEditor
              value={field.value || ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={busy}
              error={errors.description?.message}
            />}
          />
          <RoomImageGalleryField
            images={images}
            disabled={busy}
            onChange={(nextImages) => {
              setValue('images', nextImages, { shouldDirty: true, shouldValidate: true });
              setValue('coverImage', nextImages[0] || '', { shouldDirty: true });
            }}
          />
        </Stack>
      </SectionCard>

      <SectionCard icon={<View size={18} />} title="Media 360°" description="Ảnh toàn cảnh hoặc liên kết tour 360° của loại phòng.">
        <Media360Field
          label="Media 360° của loại phòng"
          value={media360}
          disabled={busy}
          onChange={(nextMedia) => setValue('media360', nextMedia, { shouldDirty: true, shouldValidate: true })}
        />
      </SectionCard>

      <SectionCard icon={<Sparkles size={18} />} title="Tiện ích loại phòng" description="Chọn nhanh theo 4 nhóm tiện ích.">
        <Controller name="amenityIds" control={control} render={({ field }) => <AmenityMultiSelect
          scope="room"
          value={field.value || []}
          onChange={field.onChange}
          disabled={busy}
          label="Tiện ích của loại phòng"
        />} />
      </SectionCard>

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 12, zIndex: 5, px: 2, py: 1, borderRadius: 2.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button color="inherit" onClick={cancel} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="contained" startIcon={<Save size={18} />} disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu loại phòng'}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  </Box>;
}

export function RoomEditorPage({ roomTypeId }: { roomTypeId?: string }) {
  const editing = Boolean(roomTypeId);
  const query = useRoomQuery(roomTypeId, 'cms');

  if (editing && query.isPending) {
    return <LoadingState label="Đang tải loại phòng…" minHeight={320} />;
  }
  if (editing && query.isError) {
    return <ErrorState
      title="Không tải được loại phòng"
      description="Loại phòng không tồn tại hoặc bạn không có quyền truy cập."
      action={<Button color="inherit" onClick={() => void query.refetch()}>Thử lại</Button>}
    />;
  }

  return <RoomEditorForm key={roomTypeId || 'new'} room={query.data || undefined} />;
}
