export function mapBuildingRow(row: Record<string, any>) {
  return {
    id: row.id,
    code: row.code || '',
    name: row.name || row.code || 'Tòa nhà',
    isTiny: Boolean(row.is_tiny),
    ownerType: row.owner_type || 'tiny',
    ownerId: row.owner_id || '',
    createdBy: row.created_by || '',
    allowedViewerIds: Array.isArray(row.allowed_viewer_ids)
      ? row.allowed_viewer_ids.map(String)
      : [],
    status: row.status || 'active',
    deletedAt: row.deleted_at || null,
    rating: Number(row.rating || 5),
    address: row.address || '',
    district: row.district || '',
    ward: row.ward || '',
    city: row.city || 'Hà Nội',
    province: row.province || row.city || 'Hà Nội',
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    vacantRoomsCount: Number(row.vacant_units_calc ?? row.vacant_rooms_count ?? 0),
    totalRoomsCount: Number(row.total_rooms_count || 0),
    minPrice: Number(row.min_price_calc ?? row.min_price ?? 0),
    maxPrice: Number(row.max_price_calc ?? row.max_price ?? 0),
    coverImage: row.cover_image || '',
    images: Array.isArray(row.images) ? row.images : [],
    media360: Array.isArray(row.media_360) ? row.media_360 : [],
    rooms: Array.isArray(row.rooms) ? row.rooms : [],
    hostName: row.host_name || '',
    hostPhone: row.host_phone || '',
    hostEmail: row.host_email || '',
    hostAddress: row.host_address || '',
    host: {
      name: row.host_name || '',
      phone: row.host_phone || '',
      email: row.host_email || '',
      address: row.host_address || '',
    },
    amenitiesPccc: Array.isArray(row.amenities_pccc)
      ? row.amenities_pccc
      : [],
    amenitiesBuilding: Array.isArray(row.amenities_building)
      ? row.amenities_building
      : [],
    amenitiesBuildingChung: Array.isArray(row.amenities_building_chung)
      ? row.amenities_building_chung
      : [],
    amenitiesBuildingAnNinh: Array.isArray(row.amenities_building_an_ninh)
      ? row.amenities_building_an_ninh
      : [],
    amenitiesBuildingPccc: Array.isArray(row.amenities_building_pccc)
      ? row.amenities_building_pccc
      : [],
    amenitiesBuildingThoatNan: Array.isArray(row.amenities_building_thoat_nan)
      ? row.amenities_building_thoat_nan
      : [],
    amenityIds: Array.isArray(row.amenity_ids) ? row.amenity_ids.map(String) : [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapDateOnly(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value).trim();
  const direct = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return direct || null;
}

export function mapRoomUnitRow(row: Record<string, any>) {
  return {
    id: row.id,
    roomTypeId: row.room_type_id || '',
    buildingId: row.building_id || '',
    code: row.code || '',
    status: row.status || 'available',
    availableFrom: mapDateOnly(row.available_from),
    migrationSource: row.migration_source || 'manual',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function mapRoomRow(row: Record<string, any>) {
  const specificRooms = Array.isArray(row.specific_rooms)
    ? row.specific_rooms.map(String)
    : [];
  const roomUnits = Array.isArray(row.room_units)
    ? row.room_units.map((unit: Record<string, any>) => mapRoomUnitRow(unit))
    : [];
  const totalUnits = Number(
    row.total_units ??
      roomUnits.filter((unit) => unit.status !== 'archived').length,
  );
  const vacantCount = Number(
    row.vacant_units ??
      roomUnits.filter((unit) => unit.status === 'available').length,
  );
  const lifecycleStatus =
    row.lifecycle_status === 'archived' ? 'archived' : 'active';
  const nextAvailableFrom =
    mapDateOnly(row.next_available_from) ||
    roomUnits
      .map((unit) => unit.availableFrom)
      .filter(Boolean)
      .sort()[0] ||
    null;
  const availabilityStatus =
    lifecycleStatus === 'archived'
      ? 'archived'
      : vacantCount > 0
        ? 'Có sẵn'
        : totalUnits > 0
          ? 'Hết phòng'
          : 'Chưa có căn';

  return {
    id: row.id,
    // U04.2 canonical Room Type identity is the stable rooms.id.
    roomTypeId: row.id,
    buildingId: row.building_id || '',
    buildingCode: row.building_code || '',
    buildingName: row.building_name || '',
    roomNumber: row.room_number || specificRooms[0] || '',
    specificRooms,
    roomUnits,
    totalUnits,
    vacantCount,
    lifecycleStatus,
    status: availabilityStatus,
    price: Number(row.price || 0),
    type: row.type || row.room_type_catalog_name || 'Studio',
    roomTypeCatalogId: String(row.room_type_catalog_id || ''),
    audienceGroups: Array.isArray(row.audience_groups) ? row.audience_groups : [],
    roomTypeCatalogName: String(row.room_type_catalog_name || row.type || 'Chưa phân loại'),
    roomTypeCatalogStatus: row.room_type_catalog_status === 'archived' ? 'archived' : 'active',
    area: Number(row.area || 0),
    maxOccupants: Number(row.max_occupants || 0),
    availableFrom: nextAvailableFrom,
    nextAvailableFrom,
    coverImage: row.cover_image || '',
    images: Array.isArray(row.images) ? row.images : [],
    media360: Array.isArray(row.media_360) ? row.media_360 : [],
    description: row.description || '',
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    amenitiesNoiThat: Array.isArray(row.amenities_noi_that)
      ? row.amenities_noi_that
      : [],
    amenitiesThietBiDien: Array.isArray(row.amenities_thiet_bi_dien)
      ? row.amenities_thiet_bi_dien
      : [],
    amenitiesKhuVucBep: Array.isArray(row.amenities_khu_vuc_bep)
      ? row.amenities_khu_vuc_bep
      : [],
    amenitiesDacDiemRieng: Array.isArray(row.amenities_dac_diem_rieng)
      ? row.amenities_dac_diem_rieng
      : [],
    amenitiesRieng: Array.isArray(row.amenities_rieng)
      ? row.amenities_rieng
      : [],
    amenitiesChung: Array.isArray(row.amenities_chung)
      ? row.amenities_chung
      : [],
    amenitiesAnNinh: Array.isArray(row.amenities_an_ninh)
      ? row.amenities_an_ninh
      : [],
    amenitiesPccc: Array.isArray(row.amenities_pccc)
      ? row.amenities_pccc
      : [],
    amenitiesAnToan: Array.isArray(row.amenities_an_toan)
      ? row.amenities_an_toan
      : [],
    amenityIds: Array.isArray(row.amenity_ids) ? row.amenity_ids.map(String) : [],
    ownerId: row.owner_id || '',
    createdBy: row.created_by || '',
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function bookingDateOnly(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const text = String(value);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text;
}

export function mapBookingRow(row: Record<string, any>) {
  return {
    id: row.id,
    customerName: row.customer_name || '',
    phone: row.phone || '',
    email: row.email || '',
    customerId: row.customer_id || null,
    dealId: row.deal_id || null,
    collaboratorId: row.collaborator_id || null,
    sourceType: row.source_type || '',
    sourceChannel: row.source_channel || '',
    sourceRecordedAt: row.source_recorded_at || null,
    collaboratorName: row.collaborator_name || '',
    assignedUserId: row.assigned_user_id || null,
    assignedUserName: row.assigned_user_name || '',
    assignedUserEmail: row.assigned_user_email || '',
    finalPrice:
      row.final_price === null || row.final_price === undefined
        ? null
        : Number(row.final_price),
    roomUnitId: row.resolved_room_unit_id || row.room_unit_id || null,
    buildingId: row.building_id || '',
    buildingCode: row.building_code || '',
    buildingName: row.building_name || '',
    roomTypeId: row.resolved_room_type_id || row.room_type_id || null,
    roomTypeName: row.room_type_name || '',
    roomNumber: row.resolved_room_number || row.room_number || '',
    appointmentDate: bookingDateOnly(row.appointment_date),
    appointmentTime: row.appointment_time || '',
    appointmentAt: row.appointment_at || null,
    appointmentTimezoneOffsetMinutes:
      row.appointment_timezone_offset_minutes === null
      || row.appointment_timezone_offset_minutes === undefined
        ? null
        : Number(row.appointment_timezone_offset_minutes),
    status: row.status || 'Chờ xác nhận',
    notes: row.notes || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function mapAuditRow(row: Record<string, any>) {
  return {
    id: row.id,
    userId: row.user_id || 'unknown',
    userName: row.user_name || 'Người dùng',
    userEmail: row.user_email || '',
    action: row.action || 'UPDATE',
    entityType: row.entity_type || 'other',
    entityId: row.entity_id || '',
    summary: row.summary || '',
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? row.metadata
        : {},
    createdAt: row.created_at || null,
  };
}

export function isPrivilegedBuildingRole(roleCode: string) {
  return [
    'admin',
    'superadmin',
    'manager',
    'building_manager',
  ].includes(String(roleCode || '').toLowerCase());
}

export function canAccessBuilding(
  building: Record<string, any>,
  user: Record<string, any> | null | undefined,
) {
  if (!user) return false;
  if (isPrivilegedBuildingRole(user.roleCode)) return true;

  const uid = String(user.id || '').trim().toLowerCase();
  const ownerId = String(
    building.ownerId || building.owner_id || '',
  )
    .trim()
    .toLowerCase();
  const createdBy = String(
    building.createdBy || building.created_by || '',
  )
    .trim()
    .toLowerCase();

  const viewers = Array.isArray(
    building.allowedViewerIds ||
      building.allowed_viewer_ids,
  )
    ? (
        building.allowedViewerIds ||
        building.allowed_viewer_ids
      ).map((value: unknown) =>
        String(value).trim().toLowerCase(),
      )
    : [];

  return (
    (ownerId && ownerId === uid) ||
    (createdBy && createdBy === uid) ||
    viewers.includes(uid)
  );
}
